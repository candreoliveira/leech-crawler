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

const run = async cfg => {
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
    await crawl.restartProccess(cfg.args.website, cfg.args.page);
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

const start = async () => {
  const { database, configuration, args } = await loadConfig();  
  const log = l(args.log);

  if (args.admin) {
    const www = path.join(path.resolve(), "src", "admin", "bin", "www.mjs");
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
    
    // Install dependencies before starting admin
    spawnSync("npm", ["install"], { cwd: path.join(path.resolve(), "src", "admin") });

    const adm = spawn("node", programArgs);
    adm.stdout.on('data', data => log("VERBOSE", `[ADMIN] ${data}`));
    adm.stderr.on('data', data => log("ERROR", `[ADMIN] ${data}`));
    adm.on('close', code => log("INFO", `[ADMIN] Process closed by ${code}.`));
  }

  if (args.bot) {
    let websites = configuration["websites"].slice(0) || [];
    let websitesArg = args.website ? args.website.slice(0) : [];
    let pagesArg = args.page ? args.page.slice(0) : [];
  
    // Adjust config with preprocessed file
    websites.forEach(w => {
      const pages = w.pages || [];
      pages.forEach(p => {
        const preprocesses = p.preprocess || [];
        preprocesses.forEach(s => {
          if (s.type.toLowerCase() === "file") {
            s.script = `return ${fs.readFileSync(s.path, "utf-8")}`;
          }
        });
      });
    });
  
    websites
      .filter(
        v =>
          v.type === args.type &&
          ((websitesArg.length > 0 && websitesArg.indexOf(v.name) > -1) ||
            websitesArg.length === 0)
      )
      .forEach(w => {
        pagesArg.forEach(p => {
          const websitePages = w.pages.map(i => i.name);
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
                log: args.log
              }
            });
          }
        });
      });
  }
};

export { start };
