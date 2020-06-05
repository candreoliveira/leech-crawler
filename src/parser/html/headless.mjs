import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import { default as Crawler } from "headless-chrome-crawler";
import { default as cheerio } from "cheerio";
import sha256 from "sha256";
import { userAgent, getUrl } from "../helper.mjs";

const saveError = async (instance, err, url, date, start, parg) => {
  await instance.db.upsertConfig(
    {
      serial: sha256(url),
      date: date,
      url,
      time: err.date - start,
      type: instance.config.type,
      website: instance.config.name,
      name: parg,
      selector: err.selector,
    },
    true
  );

  instance.log("ERROR", `[HEADLESS] ${err.message}`);
};

const exposeFunction = ({
  instance,
  parg,
  domain,
  uri,
  start,
  resolve,
  reject,
}) => async (html) => {
  const date = new Date();

  instance.db.upsertMetric({
    serial: sha256(getUrl(domain, uri.href)),
    date: date,
    url: getUrl(domain, uri.href),
    time: new Date() - start,
    type: instance.config.type,
    website: instance.config.name,
    name: parg,
  });

  let output = {
    yield: null,
    nextPages: [],
    meta: {
      date: date,
      url: getUrl(domain, uri.href),
    },
  };
  const $ = cheerio.load(html);

  if (!$) {
    const err = `[HEADLESS] Error parsing website: without $.`;
    instance.log("ERROR", err);

    reject(err);
  } else if (instance.config.pages && Array.isArray(instance.config.pages)) {
    let parsedPage;

    try {
      // ($, domain, uri, parg, config, logger)
      parsedPage = parser($, domain, uri, parg, instance.config, instance.log);
    } catch (e) {
      saveError(instance, e, getUrl(domain, uri.href), date, start, parg);
      reject(e.message);
    }

    // Save all errors
    parsedPage.errors.forEach(
      async (err) =>
        await saveError(
          instance,
          err,
          getUrl(domain, uri.href),
          date,
          start,
          parg
        )
    );

    // Save all nextPages on output
    parsedPage.nextPages.forEach((pages) => {
      output.nextPages = output.nextPages.concat(pages);
    });

    instance.log(
      "INFO",
      `[HEADLESS] Completing parsing ${parsedPage.result.length} page(s) ${uri}...`
    );

    output.yield = parsedPage.result;
  }

  output.nextPages = output.nextPages.length === 0 ? null : output.nextPages;

  resolve(output);
  return output;
};

class Headless extends Parser {
  constructor(config, args, db) {
    super();
    this.args = args;
    this.config = config || {};
    this.config.parserOptions = this.config.settings
      ? this.config.settings.parserOptions || {}
      : {};
    this.db = db;
  }

  async init() {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
    ];

    if (!!this.config.parserOptions.proxy) {
      args.push(`--proxy-server=${this.config.parserOptions.proxy}`);
    }

    this.log = l(this.args.log);
    this.parser = await Crawler.launch({
      args,
      headless: true,
      devtools: false,
      obeyRobotsTxt: false,
      maxConnections: 20,
      userAgent: userAgent("rotate", this.args.website),
      jQuery: true,
      retryCount: 10,
      retryDelay: 1000,
      timeout: 30000,
      onSuccess: (res) => {
        this.db.upsertMetric(
          {
            date: res.result.meta.date,
            serial: sha256(getUrl(res.result.meta.domain, res.options.url)),
            url: res.result.meta.url,
            status: res.response.status,
          },
          true
        );
      },
      ...this.config.parserOptions,
    });
  }

  async close() {
    await this.parser.onIdle();
    await this.parser.close();
  }

  async reader(parg, urls) {
    if (!urls) return;

    let uris;

    if (Array.isArray(urls)) {
      uris = urls.map((url) =>
        getUrl(this.config.domain, url.url || this.config.rootUrl)
      );
    } else {
      uris = [getUrl(this.config.domain, urls.url || this.config.rootUrl)];
    }

    this.log("VERBOSE", `[HEADLESS] Parsing website(s) ${uris}...`);

    // TODO: Reprocess only error page
    return await Promise.all(
      uris.map(
        (uri) =>
          new Promise((resolve, reject) => {
            this.parser.queue({
              url: uri,
              userAgent: userAgent("rotate", this.args.website),
              evaluatePage: async (config, parg) => {
                const promises = [];
                config.pages.forEach((page) => {
                  const isPargEqName =
                    parg &&
                    page.name === parg &&
                    page.preprocess &&
                    Array.isArray(page.preprocess);
                  const hasNotParg =
                    !parg && page.preprocess && Array.isArray(page.preprocess);
                  if (isPargEqName || hasNotParg) {
                    page.preprocess.forEach((pre) => {
                      const result = new Function(pre.script)();
                      if (result && Array.isArray(result)) {
                        result.forEach((r) => {
                          promises.push(r);
                        });
                      } else {
                        promises.push(result);
                      }
                    });
                  }
                });

                await Promise.all(promises);
                return await window.__execAction(
                  window.document.documentElement.outerHTML
                );
              },
              evaluatePageArgs: [this.config, parg],
              exposeFunctionsNames: ["__execAction"],
              exposeFunctions: [
                exposeFunction({
                  instance: this,
                  parg,
                  domain: this.config.domain,
                  uri: new URL(uri),
                  start: new Date(),
                  resolve,
                  reject,
                }),
              ],
            });
          })
      )
    );
  }
}

export { Headless };
