import Parser from "rss-parser";
import { userAgent, getUrl } from "../helper.mjs";
import { Parser as P } from "../parser.mjs";
import { log as l } from "../../log/log.mjs";

class Rss extends P {
  constructor(config, args) {
    super();
    this.config = config;
  }

  async init() {
    this.log = l(args.log);
    this.parser = new Parser({
      maxRedirects: 50,
      headers: {
        "User-Agent": userAgent("rotate", this.args.website)
      },
      customFields: {
        item: [["media:content", "media:content"]]
      },
      ...config.parserOptions
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

    this.log("VERBOSE", `[RSS] Parsing website(s) ${uris}...`);
    return await Promise.all(
      uris.map(async uri => {
        let feed = await this.parser.parseURL(uri);

        if (this.config.pages && Array.isArray(this.config.pages)) {
          // Return an array of array of items
          const res = this.config.pages
            .filter(v => {
              return parg ? v.name === parg : true;
            })
            .map(page => {
              // Return an array of selection result to zip and
              // Object with config idx as key and config as value
              const fields = page.data.reduce(
                (acc, cur, idx) => {
                  if (typeof cur !== "object")
                    return this.log(
                      "ERROR",
                      `[RSS] Error parsing config: ${cur} is not an object.`
                    );

                  acc[0].push(cur.selector);
                  acc[1][cur.selector] = cur;

                  return acc;
                },
                [[], {}]
              );

              return feed.items.map(item => {
                return Object.keys(item)
                  .filter(key => fields[0].includes(key))
                  .reduce((acc, cur) => {
                    const data = fields[1][cur];
                    const key = data.newKey || cur;

                    // Attr is string?
                    if (
                      item.hasOwnProperty(cur) &&
                      typeof item[cur] === "object" &&
                      typeof data === "object" &&
                      data.hasOwnProperty("attr") &&
                      typeof data["attr"] === "string"
                    ) {
                      acc[key] = item[cur][data["attr"]];
                      // Attr is an array?
                    } else if (
                      item.hasOwnProperty(cur) &&
                      typeof item[cur] === "object" &&
                      typeof data === "object" &&
                      data.hasOwnProperty("attr") &&
                      Array.isArray(data["attr"])
                    ) {
                      acc[key] = data["attr"].reduce((accumulate, current) => {
                        return accumulate[current];
                      }, item[cur]);
                      // Default
                    } else {
                      acc[key] = item[cur];
                    }

                    acc["pageUrl"] = uri;

                    return acc;
                  }, {});
              });
            });

          return {
            yield: res,
            nextPages: null
          };
        } else {
          return {
            yield: [feed.items],
            nextPages: null
          };
        }
      })
    );
  }
}

export { Rss };
