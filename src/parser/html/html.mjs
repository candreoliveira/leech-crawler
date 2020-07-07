import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import Crawler from "crawler";
import URL from "url";
import sha256 from "sha256";
import { userAgent, getUrl, getStacktrace } from "../helper.mjs";

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

const defaultCb = ({ instance, parg, domain, uri, start, resolve, reject }) => (
  error,
  res,
  done
) => {
  const date = new Date();

  instance.db.upsertMetric(
    {
      serial: sha256(getUrl(domain, uri.href)),
      date: date,
      url: getUrl(domain, uri.href),
      time: new Date() - start,
      status: res.statusCode,
      type: instance.config.type,
      website: instance.config.name,
      name: parg,
    },
    true
  );

  const $ = res.$;
  let output = {
    yield: null,
    nextPages: [],
    meta: null,
  };

  if (error) {
    const err = `[HTML] Error parsing website ${uri}: ${getStacktrace(error)}.`;
    instance.log("ERROR", err);
    reject(err);
  } else if (!$) {
    output.yield = [
      [
        {
          _statusCode: res.statusCode,
          _pageSerial: sha256(getUrl(domain, uri.href)),
          _pageUrl: getUrl(domain, uri.href),
          _pageName: parg,
          _pageWebsite: instance.config.name,
          _pageProcessedAt: new Date(),
        },
      ],
    ];

    instance.log("ERROR", `[HTML] Error parsing website ${uri}: without $.`);
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
    parsedPage.errors.forEach((err) =>
      saveError(instance, err, getUrl(domain, uri.href), date, start, parg)
    );

    // Save all nextPages on output
    parsedPage.nextPages.forEach((pages) => {
      output.nextPages = output.nextPages.concat(pages);
    });

    instance.log(
      "INFO",
      `[HTML] Completing parsing ${parsedPage.result.length} page(s) ${uri}...`
    );

    output.yield = parsedPage.result;
  }

  output.nextPages = output.nextPages.length === 0 ? null : output.nextPages;

  done();
  resolve(output);
};

class Html extends Parser {
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
    this.log = l(this.args.log);
    this.parser = new Crawler({
      maxConnections: 20,
      userAgent: userAgent("list", this.args.website),
      rotateUA: true,
      jQuery: "cheerio",
      retries: 100,
      retryTimeout: 1000,
      timeout: 30000,
      ...this.config.parserOptions,
    });
  }

  async close() {}

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

    this.log("VERBOSE", `[HTML] Parsing website(s) ${uris.length} ${uris}...`);

    return await Promise.allSettled(
      uris.map(
        (uri) =>
          new Promise((resolve, reject) => {
            this.parser.queue({
              uri: uri,
              proxy: this.config.parserOptions.proxy,
              priority: pageConfig.priority || 5,
              callback: defaultCb({
                instance: this,
                parg,
                domain: this.config.domain,
                uri: new URL.URL(uri),
                start: new Date(),
                resolve,
                reject,
              }),
            });
          })
      )
    );
  }
}

export { Html };
