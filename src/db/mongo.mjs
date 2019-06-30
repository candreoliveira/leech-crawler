import { default as Mongodb } from "mongodb";

const connect = async (config, env) => {
  let db;
  const client = new Mongodb.MongoClient(
    `mongodb://${process.env.DB_USER || config[env].user}:${process.env
      .DB_PASS || config[env].password}@${process.env.DB_HOST ||
      config[env].host}:${process.env.DB_PORT || config[env].port}`,
    {
      useNewUrlParser: true,
      poolSize: 50,
      minSize: 0,
      keepAlive: true,
      loggerLevel: "warn"
    }
  );

  try {
    await client.connect();
    db = client.db(`${process.env.DB_NAME || config[env].name}`);
  } catch (e) {
    throw new Error(
      `[${config.type.toUpperCase()}] Can't connect to mongo ${e}.`
    );
  }

  const Page = db.collection("pages");
  const Item = db.collection("items");

  try {
    Page.createIndex({ serial: 1 }, { unique: true });
    Page.createIndex(
      { name: 1, type: 1, website: 1, processedAt: 1, startedAt: 1 },
      { background: true }
    );

    Item.createIndex({ serial: 1 }, { unique: true });
    Item.createIndex({ name: 1 }, { background: true });
  } catch (e) {
    throw new Error(
      `[${config.type.toUpperCase()}] Can't create indexes ${e}.`
    );
  }

  return {
    client: client,
    model: {
      Page,
      Item
    }
  };
};

const sync = () => {
  return async () => {
    return await Promise.resolve("Don't need to sync mongo db.");
  };
};

const findPages = (model, op) => {
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
    return r.dataValues;
  };
};

const findOneItemByUrl = model => {
  return async url => {
    const r = await model.findOne({
      where: {
        "data.url": url
      }
    });
    return r.dataValues;
  };
};

const restartPages = (model, op) => {
  return async params => {
    return model.update(
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

const countPages = (model, op) => {
  return async params => {
    const r = await model.count({
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
    return r.dataValues;
  };
};

const countItems = (model, op) => {
  return async params => {
    const r = await model.count({
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
    return r.dataValues;
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

const upsertPage = model => {
  return async doc => {
    const r = await model.upsert(doc, {
      returning: true
    });
    return r[0].dataValues;
  };
};

export {
  connect,
  sync,
  findPages,
  findOnePageByUrl,
  findOneItemByUrl,
  upsertPage,
  upsertItem,
  countItems,
  countPages,
  restartPages
};
