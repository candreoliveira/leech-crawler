import { Parser } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";
import { parser } from "./helper.mjs";
import Crawler from "crawler";
import URL from "url";
import sha256 from "sha256";
import { userAgent, getUrl, getStacktrace } from "../helper.mjs";

const parseContent = (
  url,
  startedAt,
  { domain, type, website, page, pages },
  logger,
  upsertMetric,
  upsertConfig,
  resolve,
  reject
) => async (error, res, done) => {
  // html
  const $ = res.$;
  const status = res.statusCode || 500;
  let date = new Date();

  let output = {
    yield: null,
    nextPages: null,
    errors: null,
  };

  if (error) {
    const err = `[HTML] Error parsing website ${url}: ${getStacktrace(error)}.`;
    logger("ERROR", err);
    reject(err);
  } else if (!$) {
    output.yield = [
      [
        {
          _statusCode: 204,
          _pageSerial: sha256(getUrl(domain, url)),
          _pageUrl: getUrl(domain, url),
          _pageName: page,
          _pageWebsite: website,
          _pageProcessedAt: date,
        },
      ],
    ];

    logger("ERROR", `[HtML] Error parsing website ${url}: without $.`);
  } else if (pages) {
    pages = Array.isArray(pages) ? pages : [pages];
    let parsedPage;

    try {
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

    date = new Date();
    output.errors = parsedPage.errors;
    output.errors.forEach((e) => {
      upsertConfig(
        {
          serial: sha256(url),
          url,
          date,
          time: date - startedAt,
          type: type,
          website: website,
          name: page,
          selector: e.selector,
        },
        true
      );

      logger("ERROR", `[HEADLESS] ${e.message}`);
    });

    // Save all nextPages on output
    parsedPage.nextPages.forEach((pages) => {
      output.nextPages = output.nextPages
        ? output.nextPages.concat(pages)
        : [pages];
    });

    logger(
      "INFO",
      `[HTML] Completing parsing ${parsedPage.result.length} page(s) ${url}...`
    );

    output.yield = parsedPage.result;

    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      if (pg.postprocess && Array.isArray(pg.postprocess)) {
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
                await module[post.init](result.result, ...(post.args || []));
              } else if (
                typeof module === "function" ||
                typeof module["default"] === "function"
              ) {
                const fn =
                  typeof module === "function" ? module : module["default"];
                await fn(result.result, ...(post.args || []));
              }
            } catch (e) {
              logger("ERROR", `[HTML] Postprocess error ${e}.`);
            }
          }
        }
      }
    }
  }

  upsertMetric(
    {
      serial: sha256(url),
      url,
      date,
      time: date - startedAt,
      type: type,
      website: website,
      name: page,
      status: status,
    },
    true
  );

  done();
  resolve(output);
};

class Html extends Parser {
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
    this.log = l(this.args.log);
    this.parser = new Crawler({
      maxConnections: 20,
      userAgent: userAgent("list", this.args.website),
      rotateUA: true,
      jQuery: "cheerio",
      retries: 100,
      retryTimeout: 1000,
      timeout: 30000,
      ...this.config.settings.parserOptions,
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
              proxy: this.config.settings.parserOptions.proxy,
              priority: pageConfig.priority || 5,
              callback: parseContent(
                uri,
                new Date(),
                {
                  domain: this.config.domain,
                  type: this.config.type,
                  website: this.config.name,
                  page: parg,
                  pages: pageConfig,
                },
                this.log,
                this.db.upsertMetric,
                this.db.upsertConfig,
                resolve,
                reject
              ),
            });
          })
      )
    );
  }
}

export { Html };
