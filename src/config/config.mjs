import { Database } from "../db/database.mjs";
import { default as colors } from "colors";
import { default as yargs } from "yargs";
import { default as path } from "path";
import { default as r2 } from "r2";
import fs from "fs";

yargs
  .option("website", {
    alias: "w",
    describe: "Ordered array of websites to run first.",
  })
  .option("type", {
    alias: "t",
    describe: "Crawler page type to run.",
  })
  .option("page", {
    alias: "p",
    describe: "Crawler page to run.",
  })
  .option("environment", {
    alias: "e",
    describe: "Environment to run.",
    default: "development",
  })
  .option("log", {
    alias: "l",
    describe: "Log level.",
  })
  .option("cpu", {
    alias: "c",
    describe: "Cpu quantity to fork.",
    default: 1,
  })
  .option("file", {
    alias: "f",
    describe: "File config to load.",
    default: "config.json",
  })
  .option("restart", {
    alias: "r",
    describe: "Clean processedAt and startedAt.",
    default: false,
  })
  .option("sync", {
    alias: "s",
    describe: "Sync database.",
    default: false,
  })
  .option("admin", {
    alias: "a",
    describe: "Launch admin panel.",
  })
  .option("microservice", {
    alias: "m",
    describe: "Launch the api server.",
  })
  .option("debug", {
    alias: "d",
    describe: "Debug submodules (admin, api).",
    default: false,
  })
  .option("bot", {
    alias: "b",
    describe: "Launch bot.",
  })
  .demandOption(["environment"])
  .boolean(["restart", "sync", "admin", "microservice", "debug", "bot"])
  .string(["file", "log", "environment", "type"])
  .array(["website", "page"])
  .number("cpu");

if (
  process.argv.indexOf("-b") > -1 ||
  process.argv.indexOf("--b") > -1 ||
  process.argv.indexOf("-bot") > -1 ||
  process.argv.indexOf("--bot") > -1
) {
  yargs.demandOption(["page", "type", "cpu", "website", "bot"]);
} else if (
  process.argv.indexOf("-a") > -1 ||
  process.argv.indexOf("--a") > -1 ||
  process.argv.indexOf("-admin") > -1 ||
  process.argv.indexOf("--admin") > -1
) {
  yargs.demandOption(["admin"]);
} else {
  yargs.demandOption(["microservice"]);
}

colors.setTheme({
  silly: "rainbow",
  input: "grey",
  verbose: "cyan",
  prompt: "grey",
  info: "green",
  data: "grey",
  help: "cyan",
  warn: "yellow",
  debug: "blue",
  error: "red",
});

const start = async () => {
  // Load remote config
  const getRemoteConfig = async (config) => {
    if (config && config.remote && config.remote.url) {
      try {
        return await r2(config.remote.url).json;
      } catch (e) {}
    }
    return null;
  };

  // Load configuration
  const file = path.join(".", "config", yargs.argv.file);
  const config = JSON.parse(fs.readFileSync(file, "utf-8"));
  const remote = await getRemoteConfig(config);
  let configuration = remote ? remote : config;
  configuration = {
    ...config,
    ...configuration,
  };

  // Start database
  const database = new Database(configuration.database, yargs.argv.environment);
  await database.init();
  if (yargs.argv.sync === "true" || yargs.argv.sync === true) {
    await database.sync({ force: yargs.argv.sync });
  }

  return {
    database,
    configuration,
    args: yargs.argv,
  };
};

export { start };
