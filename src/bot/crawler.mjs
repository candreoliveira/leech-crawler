import {
  sleep,
  getUrl,
  setAll,
  find,
  getPrettyJson,
  getStacktrace
} from "../parser/helper.mjs";
import {
  log as l
} from "../log/log.mjs";
import sha256 from "sha256";

class Crawler {
  constructor(db, crawl, args) {
    this.db = db;
    this.crawl = crawl;
    this.name = args.page;
    this.log = l(args.log);
    this.type = args.type;
    this.website = args.website;
  }

  sendError(msg) {
    this.log("ERROR", msg);
    throw new Error(msg);
  }

  async getNextPages(count = 0) {
    if (count < 50) {
      try {
        const result = await this.db.Page.findAll({
          where: {
            name: this.name,
            type: this.type,
            website: this.website,
            processedAt: {
              [this.db.op.eq]: null
            },
            startedAt: {
              [this.db.op.eq]: null
            }
          },
          limit: 10
        });
        return result.map(i => i.dataValues);
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error getting next page ${count} ${getStacktrace(err)}.`
        );

        await sleep(500);
        return await this.getNextPages(++count);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error cant get next page.`
      );
    }
  }

  async getObject(coll, key, url, dataValues = true, count = 0) {
    if (count < 50) {
      try {
        const query = {};
        query[key] = url;

        const result = await this.db[coll].findOne({
          where: query
        });

        return dataValues && result ? result.dataValues : result;
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error getting ${coll} ${getStacktrace(err)}.`
        );

        await sleep(500);
        return await this.getObject(coll, key, url, dataValues, ++count);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error getting object ${coll}.`
      );
    }
  }

  async getPage(url, dataValues = true) {
    return await this.getObject("Page", "url", url, dataValues);
  }

  async getItem(url, dataValues = true) {
    return await this.getObject("Item", "data.url", url, dataValues);
  }

  async tryToGetPage(url, count = 0) {
    const errorMessage = `[${this.crawl.config.type.toUpperCase()}] Error cant get page ${
      this.crawl.config.name
      } #${count}`;
    let page;

    if (count > 0) {
      await sleep(500);
    }

    if (!url && count < 50) {
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
          `[${this.crawl.config.type.toUpperCase()}] Get ${this.crawl.config.name} #${count} ${getPrettyJson(page)} pages.`
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

      page = await this.upsertObject({
        url: getUrl(this.crawl.config.domain, url),
        name: this.name,
        type: this.type,
        website: this.website
      },
        "Page"
      );

      return [page];
    } else {
      return this.sendError(`${errorMessage}.`);
    }
  }

  async upsertObject(doc, coll, options = {}, count = 0) {
    if (count < 50) {
      if (!doc.serial) {
        doc = {
          ...doc,
          serial: coll === "Page" ? sha256(doc.url) : sha256(JSON.stringify(doc.data))
        };
      }

      try {
        const result = await this.db[coll].upsert(doc, {
          returning: true,
          ...options
        });

        return result[0].dataValues;
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on saving object ${
          this.crawl.config.name
          } #${count} ${getStacktrace(err)} ${getPrettyJson(doc)}.`
        );

        return await this.upsertObject(doc, coll, options, ++count);
      }
    } else {
      this.sendError(
        `[${this.crawl.config.type.toUpperCase()}] Error on saving object, cant save ${
        this.crawl.config.name
        } #${count}.`
      );
    }
  }

  async upsertMany(coll, docs, count = 0) {
    if (count < 50) {
      try {
        return await Promise.all(
          docs.map(doc => {
            return this.upsertObject(doc, coll);
          })
        );
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on upserting many ${
          this.crawl.config.name
          } #${count} ${getStacktrace(err)}.`
        );

        return await this.upsertMany(coll, docs, ++count);
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
    const arr = setAll(array, attr, null);
    return await this.upsertMany(coll, arr);
  }

  async setAllAttribute(array, attr, value, coll) {
    const arr = setAll(array, attr, value);
    return await this.upsertMany(coll, arr);
  }

  async insertPages(currentPage, nextPages, unset) {
    if (Array.isArray(nextPages)) {
      try {
        this.log(
          "VERBOSE",
          `[${this.crawl.config.type.toUpperCase()}] Saving next page(s) ${
          nextPages[0]
          }...`
        );
        await this.upsertMany(
          "Page",
          nextPages.map(next => ({
            url: getUrl(this.crawl.config.domain, next),
            name: this.name,
            type: this.type,
            website: this.website,
            PageId: currentPage.id
          }))
        );
      } catch (err) {
        this.log(
          "ERROR",
          `[${this.crawl.config.type.toUpperCase()}] Error saving pages ${getStacktrace(err)}.`
        );
      }
    }
  }

  async insertItems(currentPage, items, unset) {
    try {
      const insertedItems = await this.upsertMany(
        "Item",
        items.map(v => ({
          data: v,
          name: this.name,
          PageId: currentPage.id
        }))
      );

      currentPage.processedAt = new Date();
      await this.upsertObject(currentPage, "Page");

      this.log(
        "VERBOSE",
        `[${this.crawl.config.type.toUpperCase()}] ${currentPage.url} ${
        insertedItems.length
        } inserted item(s).`
      );
    } catch (err) {
      this.log(
        "WARN",
        `[${this.crawl.config.type.toUpperCase()}] Error on recovering saving items error ${getStacktrace(err)}, unsetting ${getPrettyJson(
          currentPage
        )}.`
      );

      unset(
        [currentPage],
        `[${this.crawl.config.type.toUpperCase()}] Error on recovering saving items error ${getStacktrace(err)}.`
      );
    }
  }

  async insertDependencies(currentPage, items, unset) {
    if (
      this.crawl.config.dependency &&
      this.crawl.config.dependency[this.name]
    ) {
      const its = items
        .filter(v => v[this.crawl.config.dependency[this.name].through])
        .map(v => ({
          PageId: currentPage.id,
          url: getUrl(
            this.crawl.config.domain,
            v[this.crawl.config.dependency[this.name].through]
          ),
          name: this.crawl.config.dependency[this.name].hasMany,
          website: this.website,
          type: this.crawl.config.dependency[this.name].type || "html" // dependencies are always html
        }));

      if (
        this.crawl.config.dependency[this.name].add &&
        Object.values(this.crawl.config.dependency[this.name].add).every(v =>
          Array.isArray(v)
        )
      ) {
        const keys = Object.keys(
          this.crawl.config.dependency[this.name].add
        ).filter(k => new RegExp(k).test(currentPage.url));

        // Every key that matches current url
        keys.forEach(k => {
          // Every dependency
          this.crawl.config.dependency[this.name].add[k].forEach(dep => {
            its.push({
              PageId: currentPage.id,
              url: getUrl(this.crawl.config.domain, dep),
              name: this.crawl.config.dependency[this.name].hasMany,
              website: this.website,
              type: this.crawl.config.dependency[this.name].type || "html" // dependencies are always html
            });
          });
        });
      }

      if (its.length > 0) {
        try {
          const insertedDependencies = await this.upsertMany("Page", its);
          this.log(
            "VERBOSE",
            `[${this.crawl.config.type.toUpperCase()}] ${
            insertedDependencies.length
            } inserted pages(s) dependency.`
          );
        } catch (err) {
          this.log(
            "WARN",
            `[${this.crawl.config.type.toUpperCase()}] Error saving dependencies ${getStacktrace(err)}, unsetting ${getPrettyJson(
              currentPage
            )}.`
          );

          unset(
            [currentPage],
            `[${this.crawl.config.type.toUpperCase()}] Error on recovering saving dependencies error.`
          );
        }
      }
    }
  }

  async restartProccess(website, page) {
    const query = {};

    if (website) {
      query.where = {
        website: {
          [this.db.op.eq]: website
        },
        name: {
          [this.db.op.eq]: page
        }
      };
    }

    const count = await this.db.Page.count({
      where: {
        ...query.where,
        processedAt: {
          [this.db.op.eq]: null
        },
        startedAt: {
          [this.db.op.eq]: null
        }
      }
    });

    if (count == 0) {
      return this.db.Page.update({
        processedAt: null,
        startedAt: null
      },
        query
      );
    }

    // Do nothing
    return;
  }

  async close() {
    return await this.crawl.close();
  }

  async start(uri = null, count = 0) {
    const unset = async (pages, msg) => {
      try {
        await this.unsetAllAttribute(pages, "startedAt", "Page");
      } catch (errors) {
        this.sendError(`${msg} ${errors}.`);
      }
    };

    let pages, pagesResult;

    if (count > 0) {
      await sleep(500);
    }

    if (count < 50) {
      const pageConfig = find(this.crawl.config.pages, "name", this.name);
      try {

        this.log(
          "DEBUG",
          `[${this.crawl.config.type.toUpperCase()}] Start crawling with uri ${pageConfig.rootUrl || uri} ${
          this.crawl.config.name
          } #${count}.`
        );
        pages = await this.tryToGetPage(pageConfig.rootUrl || uri);
      } catch (err) {
        this.log(
          "WARN",
          `[${this.crawl.config.type.toUpperCase()}] Error on start trying to get page ${pageConfig.rootUrl || uri} ${
          this.crawl.config.name
          } #${count} ${getStacktrace(err)}.`
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
    try {
      pages = await this.setAllAttribute(
        pages,
        "startedAt",
        new Date(),
        "Page"
      );
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
      pagesResult = await this.crawl.reader(this.name, pages);
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
          result.yield.forEach(async items => {
            if (Array.isArray(items) && items.length > 0) {
              // Get the pageUrl attribute from any (in the case first) page.
              let currentPage = find(
                pages.map(obj => ({
                  ...obj,
                  url: getUrl(this.crawl.config.domain, obj.url, true)
                })),
                "url",
                getUrl(this.crawl.config.domain, items[0].pageUrl, true)
              );

              if ((currentPage && !currentPage.id) || !currentPage) {
                try {
                  currentPage = await this.getPage(
                    items[0].pageUrl || currentPage.url
                  );
                } catch (err) {
                  this.log(
                    "WARN",
                    `[${this.crawl.config.type.toUpperCase()}] Error on start getting page, unsetting after read page ${
                    this.crawl.config.name
                    } #${count} ${getStacktrace(err)} ${getPrettyJson(currentPage)}.`
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
              await this.insertItems(currentPage, items, unset);

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
              await this.insertItems(pages[index], items, unset);
            }
          });
        } else {
          this.log(
            "WARN",
            `[${this.crawl.config.type.toUpperCase()}] Unsetting on start: yield empty ${
            this.crawl.config.name
            } #${count} ${getPrettyJson(pages)}.`
          );
        }
      });
    } else {
      this.log(
        "WARN",
        `[${this.crawl.config.type.toUpperCase()}] Unsetting on start: result is empty ${
        this.crawl.config.name
        } #${count} ${getPrettyJson(pages)}.`
      );
    }

    this.log(
      "DEBUG",
      `[${this.crawl.config.type.toUpperCase()}] Restarting processing...`
    );

    // Restart all processing
    return await this.start(null);
  }
}

export {
  Crawler
};