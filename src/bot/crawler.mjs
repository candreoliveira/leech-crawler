import {
  sleep,
  getUrl,
  setAll,
  find,
  getPrettyJson,
  getStacktrace,
} from "../parser/helper.mjs";
import { log as l } from "../log/log.mjs";
import sha256 from "sha256";
import { default as LRU } from "lru-cache";

class Crawler {
  constructor(db, crawl, args) {
    // Defaults
    if (!crawl.config.settings) crawl.config.settings = {};
    crawl.config.settings.lru = crawl.config.settings.lru || {};
    crawl.config.settings.retryDelay = crawl.config.settings.retryDelay || 500;
    crawl.config.settings.restartDelay =
      crawl.config.settings.restartDelay || 500;
    crawl.config.settings.retry = crawl.config.settings.retry || 50;
    crawl.config.settings.unset = crawl.config.settings.unset || 10;
    crawl.config.settings.retryOnEmpty =
      crawl.config.settings.retryOnEmpty || 5;

    this.db = db;
    this.crawl = crawl;
    this.name = args.page;
    this.log = l(args.log);
    this.type = args.type;
    this.website = args.website;
    this.lru = new LRU({
      max: 5000,
      maxAge: 1000 * 60 * 60,
      ...crawl.config.settings.lru,
    });
  }

  sendError(msg) {
    this.log("ERROR", msg);
    throw new Error(msg);
  }

  async getNextPages(count = 0) {
    if (count < (this.crawl.config.settings.retry || 50)) {
      try {
        return await this.db.findPages({
          name: this.name,
          type: this.type,
          website: this.website,
          processedAt: null,
          startedAt: null,
          limit:
            this.crawl.config.settings &&
            this.crawl.config.settings.parserOptions &&
            this.crawl.config.settings.parserOptions.pages
              ? this.crawl.config.settings.parserOptions.pages
              : 10,
        });
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error getting next page ${count} ${getStacktrace(
            err
          )}.`
        );

        await sleep(this.crawl.config.settings.retryDelay || 500);
        return await this.getNextPages(++count);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error cant get next page.`
      );
    }
  }

  async getObject(coll, url, count = 0) {
    if (count < (this.crawl.config.settings.retry || 50)) {
      try {
        return await this.db[`findOne${coll}ByUrl`](url);
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error getting ${coll} ${getStacktrace(
            err
          )}.`
        );

        await sleep(this.crawl.config.settings.retryDelay || 500);
        return await this.getObject(coll, url, ++count);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error getting object ${coll}.`
      );
    }
  }

  async getPage(url) {
    return await this.getObject("Page", url);
  }

  async getItem(url) {
    return await this.getObject("Item", url);
  }

  async tryToGetPage(url, count = 0) {
    const errorMessage = `[${this.crawl.config.type.toUpperCase()}] Error cant get page ${
      this.crawl.config.name
    } #${count}`;
    let page;

    if (count > 0) {
      await sleep(this.crawl.config.settings.retryDelay || 500);
    }

    if (!url && count < (this.crawl.config.settings.retry || 50)) {
      this.log(
        "DEBUG",
        `[${this.crawl.config.type.toUpperCase()}] Trying ${
          this.crawl.config.name
        } #${count} to get next page.`
      );

      try {
        page = await this.getNextPages();
        this.log(
          "DEBUG",
          `[${this.crawl.config.type.toUpperCase()}] Get ${
            this.crawl.config.name
          } #${count} ${getPrettyJson(page)} pages.`
        );
      } catch (err) {
        return this.sendError(`${getStacktrace(err)}.`);
      }

      if (!page || (Array.isArray(page) && page.length === 0)) {
        return this.sendError(`${errorMessage}.`);
      }

      return page;
    } else if (url) {
      this.log(
        "DEBUG",
        `[${this.crawl.config.type.toUpperCase()}] Trying ${
          this.crawl.config.name
        } #${count} to get page.`
      );

      page = await this.getPage(getUrl(this.crawl.config.domain, url));

      if (page && (page.processedAt || page.startedAt)) {
        return await this.tryToGetPage(null, ++count);
      }

      page = await this.upsertObject(
        {
          url: getUrl(this.crawl.config.domain, url),
          name: this.name,
          type: this.type,
          website: this.website,
        },
        "Page",
        0,
        true
      );

      return [page];
    } else {
      return this.sendError(`${errorMessage}.`);
    }
  }

  async upsertObject(doc, coll, count = 0, upsert = false) {
    if (count < (this.crawl.config.settings.retry || 50)) {
      if (!doc.serial) {
        doc = {
          ...doc,
          serial:
            coll === "Page"
              ? sha256(doc.url)
              : sha256(JSON.stringify(doc.data)),
        };
      }

      try {
        return await this.db[`upsert${coll}`](doc, upsert);
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on saving object ${
            this.crawl.config.name
          } #${count} ${getStacktrace(err)} ${getPrettyJson(doc)}.`
        );

        return await this.upsertObject(doc, coll, ++count, upsert);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error on saving object, cant save ${
          this.crawl.config.name
        } #${count}.`
      );
    }
  }

  async upsertMany(coll, docs, count = 0, upsert = true) {
    if (count < (this.crawl.config.settings.retry || 50)) {
      try {
        return await Promise.all(
          docs.map((doc) => {
            return this.upsertObject(doc, coll, 0, upsert);
          })
        );
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on upserting many ${
            this.crawl.config.name
          } #${count} ${getStacktrace(err)}.`
        );

        return await this.upsertMany(coll, docs, ++count, upsert);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error on upserting many, cant save ${
          this.crawl.config.name
        } #${count}.`
      );
    }
  }

  async unsetAllAttribute(array, attr, coll) {
    let count = 0;
    array.forEach((e) => {
      const enc = sha256(e);
      // Inc count for the key e
      count = (this.lru.get(enc) || count) + 1;
      this.lru.set(enc, count);
    });

    // Should really unset?
    // Should really retryOnEmpty?
    if (
      count <
      (this.crawl.config.settings.retryOnEmpty ||
        this.crawl.config.settings.unset ||
        10)
    ) {
      const arr = setAll(array, attr, null);
      return await this.upsertMany(coll, arr, 0, false);
    }

    this.log(
      "WARN",
      `[${this.crawl.config.type.toUpperCase()}] Prevented unset of ${
        array.length
      } ${coll.toLowerCase()}(s) using attribute ${attr}.`
    );
    return Promise.resolve("Unsets limited!");
  }

  async setAllAttribute(array, attr, value, coll) {
    const arr = setAll(array, attr, value);
    return await this.upsertMany(coll, arr, 0, false);
  }

  async insertPages(currentPage, nextPages, unset) {
    if (Array.isArray(nextPages)) {
      try {
        await this.upsertMany(
          "Page",
          nextPages.map((next) => ({
            url: getUrl(this.crawl.config.domain, next),
            name: this.name,
            type: this.type,
            website: this.website,
            PageId: currentPage.id,
          }))
        );
        this.log(
          "VERBOSE",
          `[${this.crawl.config.type.toUpperCase()}] Saved ${
            nextPages.length
          } next page(s) ${nextPages[0]},...`
        );
      } catch (err) {
        this.log(
          "ERROR",
          `[${this.crawl.config.type.toUpperCase()}] Error saving pages ${getStacktrace(
            err
          )}.`
        );
      }
    }
  }

  async insertItems(currentPage, items, startedAt, unset) {
    try {
      const insertedItems = await this.upsertMany(
        "Item",
        items.map((v) => ({
          data: { ...v, _pageStartedAt: startedAt },
          name: this.name,
          PageId: currentPage.id,
        }))
      );

      currentPage.processedAt = items.slice(-1)[0]
        ? items.slice(-1)[0]._pageProcessedAt
        : new Date();
      await this.upsertObject(currentPage, "Page", 0, true);

      this.log(
        "VERBOSE",
        `[${this.crawl.config.type.toUpperCase()}] Inserted ${
          insertedItems.length
        } item(s) for ${currentPage.url}.`
      );
    } catch (err) {
      const msg = `[${this.crawl.config.type.toUpperCase()}] Error on recovering saving items error ${getStacktrace(
        err
      )}`;

      this.log("WARN", `${msg}, unsetting ${getPrettyJson(currentPage)}.`);
      unset([currentPage], `${msg}.`);
    }
  }

  async insertDependencies(currentPage, items, unset) {
    if (
      this.crawl.config.dependency &&
      this.crawl.config.dependency[this.name]
    ) {
      const its = items
        .filter((v) => v[this.crawl.config.dependency[this.name].through])
        .map((v) => ({
          PageId: currentPage.id,
          url: getUrl(
            this.crawl.config.domain,
            v[this.crawl.config.dependency[this.name].through]
          ),
          name: this.crawl.config.dependency[this.name].hasMany,
          website: this.website,
          type: this.crawl.config.dependency[this.name].type || "html", // dependencies are always html
        }));

      if (
        this.crawl.config.dependency[this.name].add &&
        Object.values(this.crawl.config.dependency[this.name].add).every((v) =>
          Array.isArray(v)
        )
      ) {
        const keys = Object.keys(
          this.crawl.config.dependency[this.name].add
        ).filter((k) => new RegExp(k).test(currentPage.url));

        // Every key that matches current url
        keys.forEach((k) => {
          // Every dependency
          this.crawl.config.dependency[this.name].add[k].forEach((dep) => {
            its.push({
              PageId: currentPage.id,
              url: getUrl(this.crawl.config.domain, dep),
              name: this.crawl.config.dependency[this.name].hasMany,
              website: this.website,
              type: this.crawl.config.dependency[this.name].type || "html", // dependencies are always html
            });
          });
        });
      }

      if (its.length > 0) {
        try {
          const insertedDependencies = await this.upsertMany("Page", its);
          this.log(
            "VERBOSE",
            `[${this.crawl.config.type.toUpperCase()}] Inserted ${
              insertedDependencies.length
            } pages(s) dependency.`
          );
        } catch (err) {
          this.log(
            "WARN",
            `[${this.crawl.config.type.toUpperCase()}] Error saving dependencies ${getStacktrace(
              err
            )}, unsetting ${getPrettyJson(currentPage)}.`
          );

          unset(
            [currentPage],
            `[${this.crawl.config.type.toUpperCase()}] Error on recovering saving dependencies error.`
          );
        }
      }
    }
  }

  async restartProccess(website, page, type) {
    const count = await this.db.countPages({
      website,
      name: page,
      type,
      processedAt: null,
      startedAt: null,
    });

    if (count == 0) {
      return this.db.restartPages({
        processedAt: null,
        startedAt: null,
        website,
        name: page,
      });
    }

    // Do nothing
    return;
  }

  async import() {
    const time = 60 * 60 * 24 * 1000;
    const urlKey =
      this.db.config &&
      this.db.config.importer &&
      this.db.config.importer.mapping &&
      this.db.config.importer.mapping.url &&
      this.db.config.importer.mapping.url.name
        ? this.db.config.importer.mapping.url.name
        : "url";
    const uri =
      this.db.config &&
      this.db.config.importer &&
      this.db.config.importer.mapping &&
      this.db.config.importer.mapping.url &&
      this.db.config.importer.mapping.url.uri
        ? this.db.config.importer.mapping.url.uri
        : false;
    const defaultName =
      this.db.config &&
      this.db.config.importer &&
      this.db.config.importer.mapping &&
      this.db.config.importer.mapping.defaults &&
      this.db.config.importer.mapping.defaults.name
        ? this.db.config.importer.mapping.defaults.name
        : "importer";
    const processRow = async (config, row) => {
      this.log(
        "DEBUG",
        `[${this.crawl.config.type.toUpperCase()}] Importer processing row.`
      );

      const transform =
        config &&
        config.importer &&
        config.importer.mapping &&
        config.importer.mapping.url &&
        config.importer.mapping.url.transform &&
        config.importer.mapping.url.transform !== ""
          ? new Function("value", config.importer.mapping.url.transform)
          : (x) => {
              return x;
            };

      let metadata = { ...row };
      delete metadata.url;

      let url = row[urlKey];
      if (uri) {
        url = decodeURIComponent(url);
      }

      url = transform(url);

      return await this.upsertObject(
        {
          url: getUrl(this.crawl.config.domain, url),
          name: defaultName,
          type: this.type,
          website: this.website,
          importer: true,
          metadata,
        },
        "Page",
        0,
        true
      );
    };

    const page = await this.db.lastPageImported({
      website: this.website,
      name: defaultName,
    });

    if (
      (!page || new Date() - page.processedAt > time) &&
      this.db.config &&
      this.db.config.importer &&
      this.db.config.importer.query &&
      this.db.config.importer.query.block &&
      this.db.config.importer.query.count &&
      this.db.config.importer.block
    ) {
      this.log(
        "DEBUG",
        `[${this.crawl.config.type.toUpperCase()}] Starting importer.`
      );

      const count = this.db.importer.client.query(
        this.db.config.importer.query.count
      );
      count
        .on("error", (err) => {
          this.log(
            "ERROR",
            `[${this.crawl.config.type.toUpperCase()}] Error running importer ${getStacktrace(
              err
            )} counter.`
          );
        })
        .on("result", async (r) => {
          for (let i = 0; i < r.count; i += this.db.config.importer.block) {
            const q = `${this.db.config.importer.query.block} limit ${this.db.config.importer.block} offset ${i}`;
            const query = this.db.importer.client.query(q);
            query
              .on("error", (err) => {
                this.log(
                  "ERROR",
                  `[${this.crawl.config.type.toUpperCase()}] Error running importer ${getStacktrace(
                    err
                  )} idx ${i}.`
                );
              })
              .on("result", async (row) => {
                await processRow(this.db.config, row);
              });
          }
        })
        .on("end", () => {
          this.log(
            "DEBUG",
            `[${this.crawl.config.type.toUpperCase()}] Completing importer.`
          );
        });
    }
    return;
  }

  async close() {
    await sleep(5000);

    if (this.db.importer) {
      await this.db.importer.end();
    }

    await this.crawl.close();

    await sleep(5000);
    return await this.db.close();
  }

  async start(uri = null, count = 0) {
    let pages, pagesResult, pageConfig;

    const unset = async (pages, msg) => {
      try {
        await this.unsetAllAttribute(pages, "startedAt", "Page");
      } catch (errors) {
        this.sendError(`${msg} ${errors}.`);
      }
    };

    if (count > 0) {
      await sleep(this.crawl.config.settings.retryDelay || 500);
    }

    if (count < (this.crawl.config.settings.retry || 50)) {
      pageConfig = find(this.crawl.config.pages, "name", this.name);
      try {
        this.log(
          "DEBUG",
          `[${this.crawl.config.type.toUpperCase()}] Start crawling with uri ${
            pageConfig.rootUrl || uri
          } ${this.crawl.config.name} #${count}.`
        );
        pages = await this.tryToGetPage(pageConfig.rootUrl || uri);
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on start trying to get page ${
            pageConfig.rootUrl || uri
          } ${this.crawl.config.name} #${count} ${getStacktrace(err)}.`
        );

        return await this.start(null, ++count);
      }
    }

    // No result, stop working.
    if (!pages || (Array.isArray(pages) && pages.length === 0)) {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] No Pages results...Finishing crawler`
      );
    }

    // Hack to work smothly with concurrency (array) and single page.
    if (!Array.isArray(pages)) {
      pages = [pages];
    }

    // Save all pages as started while processing
    const startedAt = new Date();
    try {
      pages = await this.setAllAttribute(pages, "startedAt", startedAt, "Page");
    } catch (err) {
      this.log(
        "WARN",
        `[${this.crawl.config.type.toUpperCase()}] Error on start saving all atributes ${
          this.crawl.config.name
        } #${count} ${getStacktrace(err)}.`
      );

      return await this.start(null, ++count);
    }

    this.log(
      "INFO",
      `[${this.crawl.config.type.toUpperCase()}] Starting crawl, received url ${getPrettyJson(
        pages
      )}...`
    );

    // Start the processing of page
    try {
      // return an array of all settled promises
      pagesResult = await this.crawl.reader(this.name, pages, pageConfig);

      const rejects = pagesResult.reduce(
        (acc, curr, index) => {
          if (curr.status === "rejected") {
            acc.count = acc.count + 1;
            acc.uris.push(pages[index]);
          }
          return acc;
        },
        { count: 0, uris: [] }
      );

      if (rejects.count > 0) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on start reading page ${
            this.crawl.config.name
          } #${count} urls ${rejects.uris.toString()}.`
        );

        unset(
          rejects.uris,
          `[${this.crawl.config.type.toUpperCase()}] Error on start unseting start after reading page ${
            this.crawl.config.name
          } #${count} urls ${rejects.uris.toString()}.`
        );
      }

      if (rejects.count === pages.length) {
        return await this.start(null, ++count);
      }

      pagesResult = pagesResult
        .filter((p) => p.status !== "rejected")
        .map((p) => p.value);
    } catch (err) {
      this.log(
        "WARN",
        `[${this.crawl.config.type.toUpperCase()}] Error on start reading page ${
          this.crawl.config.name
        } #${count} ${getStacktrace(err)}.`
      );

      unset(
        pages,
        `[${this.crawl.config.type.toUpperCase()}] Error on start unseting start after reading page ${
          this.crawl.config.name
        } #${count} ${getStacktrace(err)}.`
      );
      return await this.start(null, ++count);
    }

    if (Array.isArray(pagesResult)) {
      pagesResult.forEach(async (result, index) => {
        if (Array.isArray(result.yield)) {
          result.yield.forEach(async (items) => {
            if (Array.isArray(items) && items.length > 0) {
              // Get the pageUrl attribute from any (in the case first) page.
              let currentPage = find(
                pages.map((obj) => ({
                  ...obj,
                  url: getUrl(this.crawl.config.domain, obj.url, true),
                })),
                "url",
                getUrl(this.crawl.config.domain, items[0]._pageUrl, true)
              );

              if ((currentPage && !currentPage.id) || !currentPage) {
                try {
                  currentPage = await this.getPage(
                    items[0]._pageUrl || currentPage.url
                  );
                } catch (err) {
                  this.log(
                    "WARN",
                    `[${this.crawl.config.type.toUpperCase()}] Error on start getting page, unsetting after read page ${
                      this.crawl.config.name
                    } #${count} ${getStacktrace(err)} ${getPrettyJson(
                      currentPage
                    )}.`
                  );

                  unset(
                    [currentPage],
                    `[${this.crawl.config.type.toUpperCase()}] Error on start unseting start after read page ${
                      this.crawl.config.name
                    } #${count} ${getStacktrace(err)}.`
                  );

                  return await this.start(currentPage.url, ++count);
                }
              }

              // Insert dependencies
              await this.insertDependencies(currentPage, items, unset);

              // Insert items
              await this.insertItems(currentPage, items, startedAt, unset);

              // Insert pages
              await this.insertPages(currentPage, result.nextPages, unset);
            } else {
              this.log(
                "WARN",
                `[${this.crawl.config.type.toUpperCase()}] Unsetting on start: zero items ${
                  this.crawl.config.name
                } #${count} ${getPrettyJson(pages[index])}.`
              );

              // Insert dependencies to add config values
              await this.insertDependencies(pages[index], items, unset);

              // Insert items to mark as processed
              await this.insertItems(pages[index], items, startedAt, unset);

              await sleep(this.crawl.config.settings.retryDelay || 500);
            }
          });
        } else {
          this.log(
            "WARN",
            `[${this.crawl.config.type.toUpperCase()}] Unsetting on start: yield empty ${
              this.crawl.config.name
            } #${count} ${getPrettyJson(pages)}.`
          );

          await sleep(this.crawl.config.settings.retryDelay || 500);
        }
      });
    } else {
      this.log(
        "WARN",
        `[${this.crawl.config.type.toUpperCase()}] Unsetting on start: result is empty ${
          this.crawl.config.name
        } #${count} ${getPrettyJson(pages)}.`
      );

      await sleep(this.crawl.config.settings.retryDelay || 500);
    }

    this.log(
      "DEBUG",
      `[${this.crawl.config.type.toUpperCase()}] Restarting processing...`
    );

    // Restart all processing
    await sleep(this.crawl.config.settings.restartDelay || 0);
    return await this.start(null);
  }
}

export { Crawler };
