import { default as Sequelize } from "sequelize";

const connect = (config, env) => {
  const sequelize = new Sequelize(
    process.env.DB_NAME || config[env].name,
    process.env.DB_USER || config[env].user,
    process.env.DB_PASS || config[env].password,
    {
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

  const Page = sequelize.define(
    "Page",
    {
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
    },
    {
      schema: "public",
      indexes: [
        {
          unique: true,
          fields: ["serial"]
        },
        {
          fields: ["name", "type", "website", "processedAt", "startedAt"]
        }
      ]
    }
  );

  const Metric = sequelize.define(
    "Metric",
    {
      serial: {
        type: Sequelize.STRING,
        allowNull: false
      },
      url: {
        type: Sequelize.STRING(5000),
        allowNull: false
      },
      date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      time: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false
      }
    },
    {
      schema: "public",
      indexes: [
        {
          fields: ["serial"]
        }
      ]
    }
  );

  const Item = sequelize.define(
    "Item",
    {
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
      }
    },
    {
      schema: "public",
      indexes: [
        {
          unique: true,
          fields: ["serial"]
        },
        {
          fields: ["name"]
        }
      ]
    }
  );

  const PageItems = Page.hasMany(Item, {
    onDelete: "CASCADE"
  });

  const PagePages = Page.hasMany(Page, {
    onDelete: "CASCADE"
  });

  const PageMetrics = Page.hasMany(Metric, {
    onDelete: "CASCADE"
  });

  return Promise.resolve({
    client: sequelize,
    model: {
      Page,
      Item,
      Metric,
      PageItems,
      PagePages,
      PageMetrics
    }
  });
};

// Try to create database if force is false;
// If force is true, drop if exists before.
const sync = model => {
  return async params => {
    return await model.sync(params);
  };
};

const findPages = (model, op = Sequelize.Op) => {
  return async params => {
    const r = await model.findAll({
      where: {
        name: params.name,
        type: params.type,
        website: params.website,
        processedAt: {
          [op.eq]: params.processedAt
        },
        startedAt: {
          [op.eq]: params.startedAt
        }
      },
      limit: params.limit
    });
    return r.map(i => i.dataValues);
  };
};

const findOnePageByUrl = model => {
  return async url => {
    const r = await model.findOne({
      where: {
        url: url
      }
    });
    return r && r.dataValues ? r.dataValues : r;
  };
};

const findOneItemByUrl = model => {
  return async url => {
    const r = await model.findOne({
      where: {
        "data.url": url
      }
    });
    return r && r.dataValues ? r.dataValues : r;
  };
};

const restartPages = (model, op = Sequelize.Op) => {
  return async params => {
    return await model.update(
      {
        processedAt: params.processedAt,
        startedAt: params.startedAt
      },
      {
        where: {
          website: {
            [op.eq]: params.website
          },
          name: {
            [op.eq]: params.name
          }
        }
      }
    );
  };
};

const countPages = (model, op = Sequelize.Op) => {
  return async params => {
    return await model.count({
      where: {
        website: {
          [op.eq]: params.website
        },
        name: {
          [op.eq]: params.name
        },
        processedAt: {
          [op.eq]: params.processedAt
        },
        startedAt: {
          [op.eq]: params.startedAt
        }
      }
    });
  };
};

const countItems = (model, op = Sequelize.Op) => {
  return async params => {
    return await model.count({
      where: {
        website: {
          [op.eq]: params.website
        },
        name: {
          [op.eq]: params.name
        },
        processedAt: {
          [op.eq]: params.processedAt
        },
        startedAt: {
          [op.eq]: params.startedAt
        }
      }
    });
  };
};

const upsertItem = model => {
  return async doc => {
    const r = await model.upsert(doc, {
      returning: true
    });
    return r[0].dataValues;
  };
};

const upsertPage = upsertItem;
const upsertMetric = upsertItem;

export {
  connect,
  sync,
  findPages,
  findOnePageByUrl,
  findOneItemByUrl,
  upsertPage,
  upsertItem,
  upsertMetric,
  countItems,
  countPages,
  restartPages
};
