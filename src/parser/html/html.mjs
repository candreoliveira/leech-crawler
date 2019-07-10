import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import Crawler from "crawler";
import URL from "url";
import sha256 from "sha256";
import { userAgent, getUrl, getStacktrace } from "../helper.mjs";

const defaultCb = ({ instance, parg, domain, uri, start, resolve, reject }) => (
  error,
  res,
  done
) => {
  // Zero seconds to prevent error
  const date = new Date();
  date.setSeconds(0);

  instance.db.upsertMetric({
    serial: sha256(uri.href),
    date: date,
    url: uri.href,
    time: new Date() - start,
    status: res.statusCode
  }, true);

  const $ = res.$;
  let output = {
    yield: null,
    nextPages: []
  };

  if (error) {
    const err = `[HTML] Error parsing website ${uri}: ${getStacktrace(error)}.`;
    instance.log("ERROR", err);
    reject(err);
  } else if (!$) {
    output.yield = [[{ statusCode: res.statusCode, pageUrl: uri.href }]];

    instance.log(
      "ERROR",
      `[HTML] [HEADLESS] Error parsing website ${uri}: without $.`
    );
  } else if (instance.config.pages && Array.isArray(instance.config.pages)) {
    const parsedPage = parser(
      $,
      domain,
      uri,
      parg,
      instance.config.pages,
      instance.config.name,
      instance.log
    );

    // Save all nextPages on output
    parsedPage.nextPages.forEach(pages => {
      output.nextPages.concat(pages);
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
    this.config = config;
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
      ...this.config.parserOptions
    });
  }

  async close() {}

  async reader(parg, urls) {
    if (!urls) return;

    let uris;

    if (Array.isArray(urls)) {
      uris = urls.map(url =>
        getUrl(this.config.domain, url.url || this.config.rootUrl)
      );
    } else {
      uris = [getUrl(this.config.domain, urls.url || this.config.rootUrl)];
    }

    this.log("VERBOSE", `[HTML] Parsing website(s) ${uris.length} ${uris}...`);

    return await Promise.all(
      uris.map(
        uri =>
          new Promise((resolve, reject) => {
            this.parser.queue({
              uri: uri,
              callback: defaultCb({
                instance: this,
                parg,
                domain: this.config.domain,
                uri: new URL.URL(uri),
                start: new Date(),
                resolve,
                reject
              })
            });
          })
      )
    );
  }
}

export { Html };
