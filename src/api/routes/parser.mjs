import { default as express } from "express";
import {
  parserMiddleware,
  parseReaderResponse,
} from "../utils/parserHelper.mjs";
import { getUrl } from "../../parser/helper.mjs";
import { asyncMiddleware } from "../utils/asyncMiddleware.mjs";

var router = express.Router();

// Body
// [{ website: "", type: "", pages: [{ name: "", url: [] }]}];
router.post(
  "/",
  parserMiddleware,
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
          const urls = p.url.map((u) => {
            return { url: getUrl(domain, u) };
          });

          promises.push(crawl.crawler.reader(p.name, urls));
        }
      }
    }

    const response = await Promise.all(promises);
    res.status(200).json(parseReaderResponse(req.body, response));
  })
);

export { router };
