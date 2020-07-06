import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import { default as Crawler } from "node-headless-crawler";
import { default as cheerio } from "cheerio";
import sha256 from "sha256";
import { userAgent, getUrl, reversePriority } from "../helper.mjs";

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

  instance.db.upsertMetric(
    {
      serial: sha256(getUrl(domain, uri.href)),
      date: date,
      url: getUrl(domain, uri.href),
      time: date - start,
      type: instance.config.type,
      website: instance.config.name,
      name: parg,
    },
    true
  );

  let output = {
    yield: null,
    nextPages: [],
    meta: {
      date: date,
      url: getUrl(domain, uri.href),
    },
  };

  const $ = cheerio.load(html || "");

  if (!html) {
    output.yield = [
      [
        {
          _statusCode: 204,
          _pageSerial: sha256(getUrl(domain, uri.href)),
          _pageUrl: getUrl(domain, uri.href),
          _pageName: parg,
          _pageWebsite: instance.config.name,
          _pageProcessedAt: new Date(),
        },
      ],
    ];

    instance.log(
      "ERROR",
      `[HEADLESS] Error parsing website ${uri}: without html.`
    );
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

    const launchOpts = {
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
      onError: (res) => {
        const domain = this.config.domain;
        // TODO: discover how to get status code correctly
        this.db.upsertMetric(
          {
            serial: sha256(getUrl(domain, res.options.url)),
            status: 500,
          },
          false,
          true
        );
      },
      onSuccess: (res) => {
        this.db.upsertMetric(
          {
            serial: sha256(res.result.meta.url),
            status: res.response.status,
          },
          false,
          true
        );
      },
      ...this.config.parserOptions,
    };

    launchOpts.customCrawl = async (page, crawl) => {
      const delCookie = async (page, config) => {
        if (
          config.parserOptions.deleteCookie &&
          Array.isArray(config.parserOptions.deleteCookie)
        ) {
          await page.deleteCookie(...config.parserOptions.deleteCookie);
        }
      };

      // await page.setRequestInterception(true);
      // page.on("request", async (request) => {
      //   await delCookie(page, this.config);
      //   request.continue();
      // });

      await delCookie(page, this.config);
      let result = await crawl(true, false);
      await delCookie(page, this.config);

      for (let i = 0; i < this.config.pages.length; i++) {
        const pg = this.config.pages[i];
        const isPargEqName =
          this.args.page &&
          pg.name === this.args.page &&
          pg.preprocess &&
          Array.isArray(pg.preprocess);

        const hasNotParg =
          !this.args.page && pg.preprocess && Array.isArray(pg.preprocess);

        if (isPargEqName || hasNotParg) {
          for (let j = 0; j < pg.preprocess.length; j++) {
            const pre = pg.preprocess[j];
            if (pre.type === "function" || pre.type === "inline") {
              const argValues = pre.args.reduce(
                (acc, curr, index) => {
                  acc.args.push(`arg${index}`);
                  acc.values.push(curr);
                  return acc;
                },
                { args: [], values: [] }
              );

              const fn = new Function(
                ...argValues.args,
                pre.script || pre.function
              );

              // fn(...argValues.values);
              await page.evaluate(fn, ...argValues.values);
              await delCookie(page, this.config);
            }
          }
        }
      }

      result = await crawl(false, true);
      result.content = await page.content();

      return result;
    };

    this.parser = await Crawler.launch(launchOpts);
  }

  async close() {
    await this.parser.onIdle();
    await this.parser.close();
  }

  async reader(parg, urls, pageConfig) {
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
    // Create a custom crawl
    // Set redis cache
    // Save screenshot on error
    return await Promise.all(
      uris.map(
        (uri) =>
          new Promise((resolve, reject) => {
            this.parser.queue({
              url: uri,
              userAgent: userAgent("rotate", this.args.website),
              maxDepth: this.config.parserOptions.maxDepth || 1,
              priority: reversePriority(pageConfig.priority || 1),
              evaluatePage: async (config, parg) => {
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
