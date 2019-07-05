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
        this.dbcli = await this.db.connect(this.config, this.env);
        this.sync = this.db.sync(this.dbcli.client);
        this.findPages = this.db.findPages(this.dbcli.model.Page);
        this.findOnePageByUrl = this.db.findOnePageByUrl(this.dbcli.model.Page);
        this.findOneItemByUrl = this.db.findOneItemByUrl(this.dbcli.model.Item);
        this.restartPages = this.db.restartPages(this.dbcli.model.Page);
        this.countPages = this.db.countPages(this.dbcli.model.Page);
        this.countItems = this.db.countItems(this.dbcli.model.Item);
        this.upsertItem = this.db.upsertItem(this.dbcli.model.Item);
        this.upsertPage = this.db.upsertPage(this.dbcli.model.Page);
        break;
      case "mongo":
        this.db = await import("./mongo.mjs");
        this.dbcli = await this.db.connect(this.config);
        this.sync = this.db.sync();
        this.findPages = this.db.findPages(this.dbcli.model.Page);
        this.findOnePageByUrl = this.db.findOnePageByUrl(this.dbcli.model.Page);
        this.findOneItemByUrl = this.db.findOneItemByUrl(this.dbcli.model.Item);
        this.restartPages = this.db.restartPages(this.dbcli.model.Page);
        this.countPages = this.db.countPages(this.dbcli.model.Page);
        this.countItems = this.db.countItems(this.dbcli.model.Item);
        this.upsertItem = this.db.upsertItem(this.dbcli.model.Item);
        this.upsertPage = this.db.upsertPage(this.dbcli.model.Page);
        break;
      default:
        throw new Error(
          `[${this.config.type.toUpperCase()}] Engine not found.`
        );
    }
  }
}

export { Database };
