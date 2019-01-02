import {
  default as Sequelize
} from "sequelize";

class Database {
  constructor(config, env) {
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
  }

  async sync(params) {
    return await this.sequelize.sync(params);
  }
}

export {
  Database
};