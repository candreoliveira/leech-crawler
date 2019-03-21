import {
  default as Sequelize
} from "sequelize";
import {
  default as postgres
} from "./postgres.mjs";
import {
  default as mongo
} from "./mongo.mjs";

class Database {
  constructor(config, env, engine = "postgres") {
    this.engine = engine;
    this.config = config;

    this.op = Sequelize.Op;
    this.sequelize = new Sequelize(
      process.env.DB_NAME || config[env].name,
      process.env.DB_USER || config[env].user,
      process.env.DB_PASS || config[env].password, {
        host: process.env.DB_HOST || config[env].host,
        port: process.env.DB_PORT || config[env].port,
        dialect: "postgres",
        pool: {
          max: 50,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        keepAlive: true,
        operatorsAliases: false,
        logging: false
      }
    );

    const Page = this.sequelize.define(
      "Page", {
        serial: {
          type: Sequelize.STRING,
          allowNull: false
        },
        url: {
          type: Sequelize.STRING(5000),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        type: {
          type: Sequelize.ENUM,
          allowNull: false,
          values: ["rss", "html", "headless"]
        },
        website: {
          type: Sequelize.STRING,
          allowNull: false
        },
        processedAt: {
          type: Sequelize.DATE
        },
        startedAt: {
          type: Sequelize.DATE
        }
      }, {
        schema: 'public',
        indexes: [{
            unique: true,
            fields: ["serial"]
          },
          {
            fields: ["name", "type", "website", "processedAt", "startedAt"]
          }
        ]
      }
    );

    const Item = this.sequelize.define(
      "Item", {
        data: {
          type: Sequelize.JSONB,
          allowNull: false
        },
        serial: {
          type: Sequelize.STRING,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
      }, {
        schema: 'public',
        indexes: [{
          unique: true,
          fields: ["serial"]
        }, {
          fields: ["name"]
        }]
      }
    );

    this.PageItems = Page.hasMany(Item, {
      onDelete: "CASCADE"
    });

    this.PagePages = Page.hasMany(Page, {
      onDelete: "CASCADE"
    });

    this.Item = Item;
    this.Page = Page;

    switch (engine) {
      case "postgres":
        this.sync = postgres.sync(this.sequelize);
        this.findPages = postgres.findPages(this.Page, this.op);
        this.findOnePageByUrl = postgres.findOnePageByUrl(this.Page);
        this.findOneItemByUrl = postgres.findOneItemByUrl(this.Item);
        this.restartPages = postgres.restartPages(this.Page, this.op);
        this.countPages = postgres.countPages(this.Page, this.op);
        this.countItems = postgres.countItems(this.Item, this.op);
        this.upsertItem = postgres.upsertItem(this.Item);
        this.upsertPage = postgres.upsertPage(this.Page);
        break;
      default:
        this.sync = postgres.sync(this.sequelize);
        this.findPages = postgres.findPages(this.Page, this.op);
        this.findOnePageByUrl = postgres.findOnePageByUrl(this.Page);
        this.findOneItemByUrl = postgres.findOneItemByUrl(this.Item);
        this.restartPages = postgres.restartPages(this.Page, this.op);
        this.countPages = postgres.countPages(this.Page, this.op);
        this.countItems = postgres.countItems(this.Item, this.op);
        this.upsertItem = postgres.upsertItem(this.Item);
        this.upsertPage = postgres.upsertPage(this.Page);
    }
  }
}

export {
  Database
};