import { start as loadConfig } from "./config/config.mjs";
import { Crawler } from "./bot/crawler.mjs";
import { Rss } from "./parser/rss/rss.mjs";
import { Html } from "./parser/html/html.mjs";
import { Headless } from "./parser/html/headless.mjs";
import { getUrl, getStacktrace } from "./parser/helper.mjs";
import { log as l } from "./log/log.mjs";
import { default as dotenv } from "dotenv";
import { spawn, spawnSync } from "child_process";
import { default as path } from "path";
import fs from "fs";

// Start dotenv
dotenv.config();

// Start vars
let runners = 0;

const run = async (cfg) => {
  let crawl;

  switch (cfg.config.type) {
    case "html":
      const html = new Html(cfg.config, cfg.args, cfg.db);
      await html.init();
      crawl = new Crawler(cfg.db, html, cfg.args);
      break;
    case "rss":
      const rss = new Rss(cfg.config, cfg.args);
      await rss.init();
      crawl = new Crawler(cfg.db, rss, cfg.args);
      break;
    case "headless":
      const headless = new Headless(cfg.config, cfg.args, cfg.db);
      await headless.init();
      crawl = new Crawler(cfg.db, headless, cfg.args);
      break;
  }

  if (cfg.args.restart) {
    await crawl.restartProccess(cfg.args.website, cfg.args.page, cfg.args.type);
  }

  if (
    (crawl && cfg.args.type && crawl.type === cfg.args.type) ||
    (crawl && !cfg.args.type)
  ) {
    cfg.log(
      "INFO",
      `Starting proccess for ${getUrl(
        cfg.config.domain,
        cfg.config.rootUrl
      )}...`
    );

    try {
      await crawl.import();
    } catch (err) {
      cfg.log("ERROR", `Closing ${getStacktrace(err)}`);
      await crawl.close();
      process.exit(0);
    }

    try {
      runners += 1;
      await crawl.start();
    } catch (err) {
      cfg.log("ERROR", `Closing ${getStacktrace(err)}`);

      runners -= 1;
      if (runners === 0) {
        await crawl.close();
        process.exit(0);
      }
    }
  }
};

const spawnSubmodule = (mod, args, log) => {
  const www = path.join(path.resolve(), "src", mod, "bin", "www.mjs");
  const programArgs = ["--experimental-modules", www];

  if (args.debug) {
    programArgs.unshift("--inspect-brk");
  }

  Object.entries(args).forEach(([key, value]) => {
    if (key !== "$0" && key !== "_" && key.length === 1) {
      if (Array.isArray(value)) {
        value.forEach((k, v) => {
          programArgs.push(`--${key}`);
          programArgs.push(String(v));
        });
      } else {
        programArgs.push(`--${key}`);
        programArgs.push(String(value));
      }
    }
  });

  // Install dependencies before starting api
  spawnSync("npm", ["install"], {
    cwd: path.join(path.resolve(), "src", mod),
  });

  const mode = spawn("node", programArgs);
  mode.stdout.on("data", (data) =>
    log("VERBOSE", `[${mod.toUpperCase()}] ${data}`)
  );
  mode.stderr.on("data", (data) =>
    log("ERROR", `[${mod.toUpperCase()}] ${data}`)
  );
  mode.on("close", (code) => {
    log("INFO", `[${mod.toUpperCase()}] Process closed by ${code}.`);
    process.exit(0);
  });
};

const startBot = (database, configuration, args, log) => {
  let websites = configuration.websites.slice(0) || [];
  let websitesArg = args.website ? args.website.slice(0) : [];
  let pagesArg = args.page ? args.page.slice(0) : [];

  // Adjust config with preprocessed file
  websites.forEach((w) => {
    const pages = w.pages || [];
    pages.forEach((p) => {
      const preprocesses = p.preprocess || [];
      preprocesses.forEach((s) => {
        if (s.type.toLowerCase() === "file") {
          s.script = `return ${fs.readFileSync(s.path, "utf-8")}`;
        }
      });
    });
  });

  const filteredWebsites = websites.filter(
    (v) =>
      v.type === args.type &&
      ((websitesArg.length > 0 && websitesArg.indexOf(v.name) > -1) ||
        websitesArg.length === 0)
  );

  filteredWebsites.forEach((w) => {
    pagesArg.forEach((p) => {
      const websitePages = w.pages.map((i) => i.name);
      if (websitePages.indexOf(p) > -1) {
        run({
          log: log,
          db: database,
          config: w,
          args: {
            page: p,
            type: args.type,
            env: args.environment,
            website: w.name,
            restart: args.restart,
            log: args.log,
          },
        });
      }
    });
  });

  if (filteredWebsites.length === 0) {
    log("ERROR", `No website found for these parameters, check them.`);
    process.exit(0);
  }
};

const start = async () => {
  const { database, configuration, args } = await loadConfig();
  const log = l(args.log);

  if (args.admin) {
    spawnSubmodule("admin", args, log);
  }

  if (args.microservice) {
    spawnSubmodule("api", args, log);
  }

  if (args.bot) {
    startBot(database, configuration, args, log);
  }

  if (!(args.bot || args.admin || args.microservice)) {
    log(
      "ERROR",
      `Start the crawler with admin or bot or microservice parameters.`
    );
    process.exit(0);
  }
};

export { start };
