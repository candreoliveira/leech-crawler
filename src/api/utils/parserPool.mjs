import { Html } from "../../parser/html/html.mjs";
import { Headless } from "../../parser/html/headless.mjs";

const start = async (apiConfig, websitesConfig, args, database) => {
  const pool = [];

  for (let i = 0; i < websitesConfig.length; i++) {
    const w = websitesConfig[i];
    for (let j = 0; j < w.pages.length; j++) {
      const p = w.pages[j];

      const arg = {
        page: p.name,
        type: args.type,
        env: args.env,
        website: w.name,
        restart: false,
        log: args.log,
      };

      const logMetric = apiConfig.log ? apiConfig.log.metric : false;
      const logConfig = apiConfig.log ? apiConfig.log.metric : false;
      const log = {
        metric: logMetric,
        config: logConfig,
      };

      let crawler;
      if (args.type === "headless") {
        crawler = new Headless(w, arg, database, log);
        await crawler.init();
      } else {
        crawler = new Html(w, arg, database, log);
        await crawler.init();
      }

      pool.push({
        website: w.name,
        page: p.name,
        type: args.type,
        crawler: crawler,
      });
    }
  }

  return pool;
};

export { start };
