import { default as Crawler } from "node-headless-crawler";
import { default as Cheerio } from "cheerio";
import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import sha256 from "sha256";
import { userAgent, getUrl, reversePriority } from "../helper.mjs";

const PROMISES_CONTROL = {};

const parseContent = (
  url,
  { domain, type, website, page, pages },
  logger,
  html
) => {
  let output = {
    yield: null,
    nextPages: null,
    errors: null,
  };

  const $ = Cheerio.load(html || "");

  if (!html) {
    output.yield = [
      [
        {
          _statusCode: 204,
          _pageSerial: sha256(getUrl(domain, url)),
          _pageUrl: getUrl(domain, url),
          _pageName: page,
          _pageWebsite: website,
          _pageProcessedAt: new Date(),
        },
      ],
    ];

    logger("ERROR", `[HEADLESS] Error parsing website ${url}: without html.`);
  } else if (pages) {
    pages = Array.isArray(pages) ? pages : [pages];
    let parsedPage;

    try {
      // ($, domain, url, page, website, type, pages, logger)
      parsedPage = parser($, {
        domain,
        url,
        page,
        website,
        type,
        pages,
        logger,
      });
    } catch (e) {
      parsedPage = { errors: [e] };
    }

    output.errors = parsedPage.errors;

    // Save all nextPages on output
    parsedPage.nextPages.forEach((pages) => {
      output.nextPages = output.nextPages
        ? output.nextPages.concat(pages)
        : [pages];
    });

    logger(
      "INFO",
      `[HEADLESS] Completing parsing ${parsedPage.result.length} page(s) ${url}...`
    );

    output.yield = parsedPage.result;
  }

  return output;
};

class Headless extends Parser {
  constructor(config, args, db) {
    super();
    this.args = args;
    this.config = config || {};
    this.config.settings = this.config.settings ? this.config.settings : {};
    this.config.settings.parserOptions = this.config.settings.parserOptions
      ? this.config.settings.parserOptions
      : {};
    this.db = db;
  }

  async init() {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
    ];

    if (!!this.config.settings.parserOptions.proxy) {
      args.push(`--proxy-server=${this.config.settings.parserOptions.proxy}`);
    }

    this.log = l(this.args.log);

    const parseResponse = (res) => {
      const date = new Date();
      const url = getUrl(res.options.config.domain, res.options.url);
      if (res.result) {
        if (
          res.result.errors &&
          Array.isArray(res.result.errors) &&
          res.result.errors.length > 0
        ) {
          res.result.errors.forEach((e) => {
            this.db.upsertConfig(
              {
                serial: sha256(url),
                url,
                date,
                time: date - res.options.startedAt,
                type: res.options.config.type,
                website: res.options.config.website,
                name: res.options.config.page,
                selector: e.selector,
              },
              true
            );

            this.log("ERROR", `[HEADLESS] ${e.message}`);
          });
        }
      }

      if (res.result || res.type) {
        try {
          this.db.upsertMetric(
            {
              serial: sha256(url),
              url,
              date,
              time: date - res.options.startedAt,
              type: res.options.config.type,
              website: res.options.config.website,
              name: res.options.config.page,
              status: res.response.status,
            },
            true
          );

          if (PROMISES_CONTROL[res.options.url]) {
            const fulfill = PROMISES_CONTROL[res.options.url].resolve;
            fulfill.forEach((r) => {
              r(res.result);
            });
            delete PROMISES_CONTROL[res.options.url];
          }
        } catch (e) {
          if (PROMISES_CONTROL[res.options.url]) {
            const fulfill = PROMISES_CONTROL[res.options.url].reject;
            fulfill.forEach((r) => {
              r(e);
            });
            delete PROMISES_CONTROL[res.options.url];
          }
        }
      }
    };

    const parserResponseError = (status) => (res) => {
      const date = new Date();
      const url = getUrl(res.options.config.domain, res.options.url);
      let output = res;
      try {
        this.db.upsertMetric(
          {
            serial: sha256(url),
            url,
            date,
            time: date - res.options.startedAt,
            type: res.options.config.type,
            website: res.options.config.website,
            name: res.options.config.page,
            status,
          },
          true
        );
      } catch (e) {
        output = e;
      }

      if (PROMISES_CONTROL[res.options.url]) {
        const fulfill = PROMISES_CONTROL[res.options.url].reject;
        fulfill.forEach((r) => {
          r(output);
        });
        delete PROMISES_CONTROL[res.options.url];
      }
    };

    const launchOpts = {
      args,
      headless: true,
      devtools: false,
      obeyRobotsTxt: false,
      maxConnections: 20,
      userAgent: userAgent("rotate", this.args.website),
      retryCount: 10,
      retryDelay: 1000,
      timeout: 30000,
      onError: parserResponseError(500),
      onDisallow: parserResponseError(403),
      onSuccess: parseResponse,
      onSkip: parseResponse,
      onDisallow: parseResponse,
      ...this.config.settings.parserOptions,
    };

    if (this.db.cache && this.db.cache.client) {
      launchOpts.cache = this.db.cache.client;
      launchOpts.persistCache = this.db.cache.persist;
    }

    launchOpts.customCrawl = async (page, crawl) => {
      const delCookie = async (page, config) => {
        if (
          config.settings.parserOptions.deleteCookie &&
          Array.isArray(config.settings.parserOptions.deleteCookie)
        ) {
          await page.deleteCookie(
            ...config.settings.parserOptions.deleteCookie
          );
        }
      };

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

        if (isPargEqName) {
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

      if (result.content) {
        result.result = parseContent(
          result.options.url,
          result.options.config,
          this.log,
          result.content
        );

        for (let i = 0; i < this.config.pages.length; i++) {
          const pg = this.config.pages[i];
          const isPargEqName =
            this.args.page &&
            pg.name === this.args.page &&
            pg.postprocess &&
            Array.isArray(pg.postprocess);

          if (isPargEqName) {
            for (let j = 0; j < pg.postprocess.length; j++) {
              const post = pg.postprocess[j];
              if (post.type === "module" && post.path) {
                const module = await import(post.path);

                try {
                  if (
                    post.init &&
                    post.init !== "default" &&
                    typeof module[post.init] === "function"
                  ) {
                    await module[post.init](
                      result.result,
                      ...(post.args || [])
                    );
                  } else if (typeof module === "function") {
                    await module(result.result, ...(post.args || []));
                  } else if (typeof module["default"] === "function") {
                    await module["default"](
                      result.result,
                      ...(post.args || [])
                    );
                  }
                } catch (e) {
                  this.log("ERROR", `[HEADLESS] Postprocess error ${e}.`);
                }
              }
            }
          }
        }
      }

      return result;
    };

    this.parser = await Crawler.launch(launchOpts);
  }

  async close() {
    await this.parser.onIdle();
    await this.parser.close();
  }

  async markRequested(uri) {
    return new Promise((resolve, reject) => {
      if (PROMISES_CONTROL[uri]) {
        PROMISES_CONTROL[uri].resolve.push(resolve);
        PROMISES_CONTROL[uri].reject.push(reject);
      } else {
        PROMISES_CONTROL[uri] = { resolve: [resolve], reject: [reject] };
      }
    });
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

    // TODO: Save screenshot on error
    return await Promise.allSettled(
      uris.map((uri) => {
        const date = new Date();
        this.parser.queue({
          url: uri,
          userAgent: userAgent("rotate", this.args.website),
          maxDepth: this.config.settings.parserOptions.maxDepth || 1,
          priority: reversePriority(pageConfig.priority || 1),
          startedAt: date,
          config: {
            domain: this.config.domain,
            type: this.config.type,
            website: this.config.name,
            page: parg,
            pages: pageConfig,
          },
        });

        return this.markRequested(uri);
      })
    );
  }
}

export { Headless };
