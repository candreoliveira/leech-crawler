import { start as loadConfig } from "../config/config.mjs";
import { start as parserPool } from "./utils/parserPool.mjs";
import { router as metricRouter } from "./routes/metric.mjs";
import { router as errorRouter } from "./routes/configError.mjs";
import { router as healthRouter } from "./routes/health.mjs";
import { router as parserRouter } from "./routes/parser.mjs";

import { default as createError } from "http-errors";
import { default as express } from "express";
import { default as cookieParser } from "cookie-parser";
import { default as logger } from "morgan";

const start = async () => {
  const app = express();
  const { database, configuration, args } = await loadConfig();
  const websitesArg = args.website ? args.website : [];
  const pagesArg = args.page ? args.page : [];
  let websites = configuration.websites || [];

  websites = websites
    .filter(
      (w) =>
        w.type === args.type &&
        ((websitesArg.length > 0 && websitesArg.indexOf(w.name) > -1) ||
          websitesArg.length === 0)
    )
    .map((w) => {
      let pages = w.pages || [];
      pages = pages.filter((p) => pagesArg.indexOf(p.name) > -1);
      w.pages = pages;
      return w;
    });

  const pool = await parserPool(configuration.api, websites, args, database);

  app.set("apiConfiguration", configuration.api);
  app.set("websitesConfiguration", websites);
  app.set("database", database);
  app.set("args", args);
  app.set("parserPool", pool);

  app.use(logger("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use("/", healthRouter);
  app.use("/metrics", metricRouter);
  app.use("/configs", errorRouter);
  app.use("/parse", parserRouter);

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    next(createError(404));
  });

  // error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      message: err.message || "Internal server error.",
      status: err.status,
    });
  });

  return app;
};

export { start };
