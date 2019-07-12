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
    throw new Error(`[Mongodb] Can't connect to mongo ${e}.`);
  }

  const Page = db.collection("pages");
  const Item = db.collection("items");
  const Metric = db.collection("metrics");

  try {
    await Page.createIndex({ serial: 1 }, { unique: true });
    await Page.createIndex(
      { name: 1, type: 1, website: 1, processedAt: 1, startedAt: 1 },
      { background: true }
    );

    await Item.createIndex({ serial: 1 }, { unique: true });
    await Item.createIndex({ name: 1 }, { background: true });

    await Metric.createIndex({ serial: 1 }, { unique: true });
  } catch (e) {
    throw new Error(`[Mongodb] Can't create indexes ${e}.`);
  }

  return {
    client: client,
    model: {
      Page,
      Item,
      Metric
    }
  };
};

const sync = () => {
  return async () => {
    return await Promise.resolve("[Mongodb] Don't need to sync mongodb.");
  };
};

const findPages = model => {
  return async params => {
    return await model
      .find(
        {
          name: params.name,
          type: params.type,
          website: params.website,
          processedAt: params.processedAt,
          startedAt: params.startedAt
        },
        {
          limit: params.limit
        }
      )
      .toArray();
  };
};

const findOnePageByUrl = model => {
  return async url => {
    return await model.findOne({
      url: url
    });
  };
};

const findOneItemByUrl = model => {
  return async url => {
    return await model.findOne({
      "data.url": url
    });
  };
};

const restartPages = model => {
  return async params => {
    return await model.updateMany(
      {
        website: params.website,
        name: params.name
      },
      {
        $set: {
          processedAt: params.processedAt,
          startedAt: params.startedAt
        }
      },
      { upsert: true }
    );
  };
};

const countPages = model => {
  return async params => {
    return await model.countDocuments({
      website: params.website,
      name: params.name,
      processedAt: params.processedAt,
      startedAt: params.startedAt
    });
  };
};

const countItems = countPages;

const upsertPage = model => {
  return async doc => {
    return await model.updateOne(doc, {
      $set: doc
    });
  };
};

const upsertItem = upsertPage;  
const upsertMetric = upsertPage;

export {
  connect,
  sync,
  findPages,
  findOnePageByUrl,
  findOneItemByUrl,
  upsertPage,
  upsertMetric,
  upsertItem,
  countItems,
  countPages,
  restartPages
};
