import { promisify } from "util";

class Database {
  constructor(config, env) {
    this.config = config;
    this.env = env;
    this.engine = config[env].engine || "postgres";
  }

  async close() {
    return await this.dbcli.client.close();
  }

  async init() {
    switch (this.engine) {
      case "postgres":
        this.db = await import("./postgres.mjs");
        break;
      case "mongo":
        this.db = await import("./mongo.mjs");
        break;
      default:
        throw new Error(
          `[${this.config.type.toUpperCase()}] Engine not found.`
        );
    }

    if (this.config.importer) {
      this.importer = {};
      this.importer.db = await import("./importer/mysql.mjs");
      this.importer.client = await this.importer.db.connect(this.config.importer);
      this.importer.pause = promisify(this.importer.client.pause).bind(this.importer.client);
      this.importer.resume = promisify(this.importer.client.resume).bind(this.importer.client);
      this.importer.end = promisify(this.importer.client.end).bind(this.importer.client);
    }

    this.dbcli = await this.db.connect(this.config, this.env);
    this.sync = this.db.sync(this.dbcli.client, this.dbcli.model);
    this.findPages = this.db.findPages(this.dbcli.model.Page);
    this.lastPageImported = this.db.lastPageImported(this.dbcli.model.Page);
    this.findOnePageByUrl = this.db.findOnePageByUrl(this.dbcli.model.Page);
    this.findOneItemByUrl = this.db.findOneItemByUrl(this.dbcli.model.Item);
    this.restartPages = this.db.restartPages(this.dbcli.model.Page);
    this.countPages = this.db.countPages(this.dbcli.model.Page);
    this.countItems = this.db.countItems(this.dbcli.model.Item);
    this.upsertItem = this.db.upsertItem(this.dbcli.model.Item);
    this.upsertPage = this.db.upsertPage(this.dbcli.model.Page);
    this.upsertMetric = this.db.upsertMetric(this.dbcli.model.Metric);
    this.metrics = this.db.metrics(this.dbcli.model.Metric);
  }
}

export { Database };
