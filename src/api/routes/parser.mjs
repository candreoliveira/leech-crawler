import { default as express } from "express";
import { validateBody, createErrorForType } from "../utils/helper.mjs";
import { getUrl } from "../../parser/helper.mjs";
import { asyncMiddleware } from "../utils/asyncMiddleware.mjs";

var router = express.Router();

// Body
// [{ website: "", type: "", pages: [{ name: "", urls: [] }]}];
router.post(
  "/",
  (req, res, next) => {
    const args = res.app.get("args");
    const websitesConfiguration = res.app.get("websitesConfiguration");
    const pool = res.app.get("parserPool");
    const urls = [
      "//zoom.com.br/some/path",
      "http://www.zoom.com.br",
      "//www.zoom.com.br/",
      "https://zoom.com.br/some/path",
    ];

    if (!Array.isArray(pool) || pool.length === 0) {
      return next(createErrorForType("pool", "array"));
    } else {
      const e = validateBody(
        req.body,
        {
          type: args.type,
          websites: args.website,
          pages: args.page,
          urls,
        },
        websitesConfiguration
      );
      if (e) {
        return next(e);
      }
    }

    return next();
  },
  asyncMiddleware(async (req, res) => {
    const pool = res.app.get("parserPool");
    const websites = res.app.get("websitesConfiguration");
    const promises = [];

    for (let i = 0; i < req.body.length; ++i) {
      const w = req.body[i];
      const website = websites.filter((web) => web.name === w.website)[0];
      const domain = website ? website.domain : "";

      for (let j = 0; j < w.pages.length; ++j) {
        const p = w.pages[j];
        const crawl = pool.filter(
          (c) =>
            c.website === w.website && c.type === w.type && c.page === p.name
        )[0];

        if (crawl && crawl.crawler) {
          const urls = p.urls.map((u) => {
            return { url: getUrl(domain, u) };
          });

          promises.push(crawl.crawler.reader(p.name, urls));
        }
      }
    }

    res.status(200).json(await Promise.all(promises));
  })
);

export { router };
