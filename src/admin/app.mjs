import { start as loadConfig } from "../config/config.mjs";
import { router as indexRouter } from "./routes/index.mjs";
import { default as createError } from "http-errors";
import { default as express } from "express";
import { default as path } from "path";
import { default as cookieParser } from "cookie-parser";
import { default as logger } from "morgan";
import { default as sassMiddleware } from "node-sass-middleware";

const start = async () => {
  const app = express();
  const { database, configuration, args } = await loadConfig();

  // view engine setup
  app.set("views", path.join(path.resolve(), "src", "admin", "views"));
  app.set("view engine", "ejs");
  app.set("configuration", configuration);
  app.set("database", database);
  app.set("args", args);

  app.use(logger("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(sassMiddleware({
    src: path.join(path.resolve(), "src", "admin", "public"),
    dest: path.join(path.resolve(), "src", "admin", "public"),
    indentedSyntax: false, // true = .sass and false = .scss
    sourceMap: true,
    debug: true,
    outputStyle: 'compressed'
  }));
  app.use(express.static(path.join(path.resolve(), "src", "admin", "public")));
  app.use("/assets", express.static(path.join(path.resolve(), "src", "admin", "node_modules/material-dashboard/assets")));

  app.use("/", indexRouter);

  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    next(createError(404));
  });

  // error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render("error");
  });

  return app;
}

export {
  start
}