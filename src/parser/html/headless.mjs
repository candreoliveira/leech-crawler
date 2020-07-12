import { default as Crawler } from "node-headless-crawler";
import { default as Cheerio } from "cheerio";
import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import sha256 from "sha256";
import { userAgent, getUrl, reversePriority } from "../helper.mjs";

const GOLBAL_PROMISES_CONTROL = {};

const parseContent = (
  url,
  { domain, type, website, page, pages },
  logger,
  html
) => {
  let output = {
    yield: null,
    nextPages: [],
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
      output.nextPages = output.nextPages.concat(pages);
    });

    logger(
      "INFO",
      `[HEADLESS] Completing parsing ${parsedPage.result.length} page(s) ${url}...`
    );

    output.yield = parsedPage.result;
  }

  output.nextPages = output.nextPages.length === 0 ? null : output.nextPages;
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

          if (GOLBAL_PROMISES_CONTROL[res.options.url]) {
            const resolve = GOLBAL_PROMISES_CONTROL[res.options.url][0];
            delete GOLBAL_PROMISES_CONTROL[res.options.url];
            resolve(res.result);
          }
        } catch (e) {
          if (GOLBAL_PROMISES_CONTROL[res.options.url]) {
            const reject = GOLBAL_PROMISES_CONTROL[res.options.url][1];
            delete GOLBAL_PROMISES_CONTROL[res.options.url];
            reject(e);
          }
        }
      }
    };

    const parserResponseError = (status) => (res) => {
      const date = new Date();
      const url = getUrl(res.options.config.domain, res.options.url);
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
        if (GOLBAL_PROMISES_CONTROL[res.options.url]) {
          const reject = GOLBAL_PROMISES_CONTROL[res.options.url][1];
          delete GOLBAL_PROMISES_CONTROL[res.options.url];
          return reject(e);
        }
      }

      if (GOLBAL_PROMISES_CONTROL[res.options.url]) {
        const reject = GOLBAL_PROMISES_CONTROL[res.options.url][1];
        delete GOLBAL_PROMISES_CONTROL[res.options.url];
        return reject(res);
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

      if (result.content) {
        result.result = parseContent(
          result.options.url,
          result.options.config,
          this.log,
          result.content
        );
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
    return await new Promise((resolve, reject) => {
      GOLBAL_PROMISES_CONTROL[uri] = [resolve, reject];
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
