import { start as loadConfig } from "../config/config.mjs";
import { router as metricRouter } from "./routes/metric.mjs";
import { router as errorRouter } from "./routes/configError.mjs";
import { router as healthRouter } from "./routes/health.mjs";
import { default as createError } from "http-errors";
import { default as express } from "express";
import { default as cookieParser } from "cookie-parser";
import { default as logger } from "morgan";

const start = async () => {
  const app = express();
  const { database, configuration, args } = await loadConfig();

  app.set("configuration", configuration);
  app.set("database", database);
  app.set("args", args);

  app.use(logger("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  app.use("/", healthRouter);
  app.use("/metrics", metricRouter);
  app.use("/configs", errorRouter);

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    next(createError(404));
  });

  // error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error =
      req.app.get("args").environment === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render("error");
  });

  return app;
};

export { start };
