import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import { default as Crawler } from "headless-chrome-crawler";
import { default as cheerio } from "cheerio";
import { userAgent, getUrl } from "../helper.mjs";

const exposeFunction = ({
  instance,
  parg,
  domain,
  uri,
  resolve,
  reject
}) => async html => {
  const $ = cheerio.load(html);
  let output = {
    yield: null,
    nextPages: []
  };

  if (!$) {
    const err = `[HEADLESS] Error parsing website: without $.`;
    instance.log("ERROR", err);

    reject(err);
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
      `[HEADLESS] Completing parsing ${
        parsedPage.result.length
      } page(s) ${uri}...`
    );

    output.yield = parsedPage.result;
  }

  output.nextPages = output.nextPages.length === 0 ? null : output.nextPages;

  resolve(output);
  return output;
};

class Headless extends Parser {
  constructor(config, args) {
    super();
    this.args = args;
    this.config = config;
  }

  async init() {
    this.log = l(this.args.log);
    this.parser = await Crawler.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--ignore-certificate-errors"
      ],
      headless: true,
      devtools: false,
      obeyRobotsTxt: false,
      maxConnections: 20,
      userAgent: userAgent("rotate", this.args.website),
      jQuery: true,
      retryCount: 10,
      retryDelay: 1000,
      timeout: 30000,
      ...this.config.parserOptions
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
      uris = urls.map(url =>
        getUrl(this.config.domain, url.url || this.config.rootUrl)
      );
    } else {
      uris = [getUrl(this.config.domain, urls.url || this.config.rootUrl)];
    }

    this.log("VERBOSE", `[HEADLESS] Parsing website(s) ${uris}...`);

    // TODO: Reprocess only error page
    return await Promise.all(
      uris.map(
        uri =>
          new Promise((resolve, reject) => {
            this.parser.queue({
              url: uri,
              userAgent: userAgent("rotate", this.args.website),
              evaluatePage: async (config, parg) => {
                const promises = [];
                config.pages.forEach(page => {
                  const isPargEqName =
                    parg &&
                    page.name === parg &&
                    page.preprocess &&
                    Array.isArray(page.preprocess);
                  const hasNotParg =
                    !parg && page.preprocess && Array.isArray(page.preprocess);
                  if (isPargEqName || hasNotParg) {
                    page.preprocess.forEach(pre => {
                      const result = new Function(pre.script)();
                      if (result && Array.isArray(result)) {
                        result.forEach(r => {
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
                  resolve,
                  reject
                })
              ]
            });
          })
      )
    );
  }
}

export { Headless };
