import { default as Mongodb } from "mongodb";
import { sleep } from "../parser/helper.mjs";
import sha256 from "sha256";

const connect = async (config, env) => {
  let db;
  const server = process.env.DB_SRV || config[env].srv;
  const user = process.env.DB_USER || config[env].user;
  const password = process.env.DB_PASS || config[env].password;
  const auth = (user && `${user}:${password}@`) || "";
  const host = process.env.DB_HOST || config[env].host;
  const port = process.env.DB_PORT || config[env].port;
  const name = process.env.DB_NAME || config[env].name;
  const client = new Mongodb.MongoClient(
    `mongodb${server ? "+srv" : ""}://${auth}${host}${
      server ? "" : ":" + port
    }/${name}`,
    {
      useNewUrlParser: true,
      poolSize: 50,
      minSize: 0,
      keepAlive: true,
      loggerLevel: "warn",
      useUnifiedTopology: true,
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
  const Config = db.collection("configs");

  try {
    await Page.createIndex({ serial: 1 }, { unique: true });
    await Page.createIndex(
      { name: 1, type: 1, website: 1, processedAt: 1, startedAt: 1 },
      { background: true }
    );

    await Item.createIndex({ serial: 1 }, { unique: true });
    await Item.createIndex({ name: 1 }, { background: true });

    await Metric.createIndex({ serial: 1, contentSerial: 1 }, { unique: true });
    await Config.createIndex({ serial: 1, contentSerial: 1 }, { unique: true });
  } catch (e) {
    console.log(`[Mongodb] Can't create indexes ${e}.`);
  }

  return {
    client: client,
    model: {
      Page,
      Item,
      Metric,
      Config,
    },
  };
};

const sync = (client, model, cache) => {
  return async () => {
    await model.Page.dropIndexes();
    await model.Item.dropIndexes();
    await model.Metric.dropIndexes();
    await model.Config.dropIndexes();
    await model.Page.drop();
    await model.Item.drop();
    await model.Metric.drop();
    await model.Config.drop();

    if (cache) {
      await cache.clear();
    }

    return await Promise.resolve(
      "[Mongodb] Mongodb collections and indexes dropped."
    );
  };
};

const lastPageImported = (model) => {
  return async (params) => {
    const tmp = {};
    if (params.website) tmp.website = params.website;
    if (params.name) tmp.name = params.name;
    if (params.type) tmp.type = params.type;
    if (!params.limit) params.limit = 1;
    tmp.processedAt = { $exists: true };
    tmp.startedAt = { $exists: true };
    tmp.PageId = null;

    const r = await model
      .find(tmp, { limit: params.limit })
      .sort({ processedAt: -1 })
      .toArray();

    if (r[0] && r[0]._id) r[0].id = r[0]._id.toString();
    return r[0];
  };
};

const findPages = (model) => {
  return async (params) => {
    const tmp = {};
    if (params.website) tmp.website = params.website;
    if (params.name) tmp.name = params.name;
    if (params.type) tmp.type = params.type;
    if (params.processedAt || params.processedAt === null)
      tmp.processedAt = params.processedAt;
    if (params.startedAt || params.startedAt === null)
      tmp.startedAt = params.startedAt;
    if (!params.limit) params.limit = 50;

    const r = await model
      .find(tmp, {
        limit: params.limit,
      })
      .toArray();

    if (Array.isArray(r)) {
      return r.map((v) => {
        if (v._id) v.id = v._id.toString();
        return v;
      });
    }

    return r;
  };
};

const findOnePageByUrl = (model) => {
  return async (url) => {
    const r = await model.findOne({
      serial: sha256(url),
    });

    if (r && r._id) r.id = r._id.toString();
    return r;
  };
};

const findOneItemByUrl = (model) => {
  return async (url) => {
    const r = await model.findOne({
      "data._pageSerial": sha256(url),
    });

    if (r && r._id) r.id = r._id.toString();
    return r;
  };
};

const restartPages = (model) => {
  return async (params) => {
    const tmp = {};
    if (params.website) tmp.website = params.website;
    if (params.name) tmp.name = params.name;
    if (params.type) tmp.type = params.type;
    if (!params.processedAt) params.processedAt = null;
    if (!params.startedAt) params.startedAt = null;

    if (params)
      return await model.updateMany(
        tmp,
        {
          $set: {
            processedAt: params.processedAt,
            startedAt: params.startedAt,
          },
        },
        { upsert: false }
      );
  };
};

const countPages = (model) => {
  return async (params) => {
    const tmp = {};
    if (params.website) tmp.website = params.website;
    if (params.name) tmp.name = params.name;
    if (params.type) tmp.type = params.type;
    if (params.processedAt || params.processedAt === null)
      tmp.processedAt = params.processedAt;
    if (params.startedAt || params.startedAt === null)
      tmp.startedAt = params.startedAt;
    return await model.countDocuments(tmp);
  };
};

const countItems = countPages;

const configErrors = (model) => {
  return async (params) => {
    const tmp = {};
    if (params.website) tmp.website = params.website;
    if (params.name) tmp.name = params.name;
    if (params.type) tmp.type = params.type;
    if (!params.limit) params.limit = 50;

    const r = await model.find(tmp, { limit: params.limit }).toArray();

    return r.map((v) => {
      if (v && v._id) v.id = v._id.toString();
      return v;
    });
  };
};

const metrics = (model) => {
  return async (params) => {
    const tmp = {};
    if (params.website) tmp.website = params.website;
    if (params.name) tmp.name = params.name;
    if (params.type) tmp.type = params.type;
    if (!params.limit) params.limit = 50;

    const aggs = [
      {
        $match: tmp,
      },
      {
        $sort: { time: -1 },
      },
      {
        $group: {
          _id: "$status",
          statusTotal: { $sum: parseInt(1) },
          statusAvgTime: { $avg: "$time" },
          statusUrlDateTime: {
            $push: { url: "$url", date: "$date", time: "$time" },
          },
        },
      },
      {
        $project: {
          statusUrlDateTime: { $slice: ["$statusUrlDateTime", params.limit] },
          statusAvgTime: 1,
          statusTotal: 1,
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: "$statusAvgTime" },
          total: { $sum: "$statusTotal" },
          metrics: { $push: "$$ROOT" },
        },
      },
    ];

    const ret = await model.aggregate(aggs).toArray();
    return ret[0] ? formatMetrics(ret[0]) : ret[0];
  };
};

const formatMetrics = (res) => {
  const { avgTime, total, metrics } = res;
  const output = {
    total,
    avgTime,
    metrics: metrics.map((v, i) => {
      return {
        statusCode: v._id,
        total: v.statusTotal,
        avgTime: v.statusAvgTime,
        mostTimeConsuming: v.statusUrlDateTime,
      };
    }),
  };
  return output;
};

const upsertPage = (model) => {
  return async (doc, upsert = false) => {
    const { id, serial, data } = doc;
    let filter = {};

    if (serial) {
      filter.serial = serial;
    } else if (id) {
      filter._id = new Mongodb.ObjectID(id);
    } else if (data && data._pageSerial) {
      filter["data._pageSerial"] = data._pageSerial;
    } else {
      filter = doc;
    }

    // Prevent performing an update on the path '_id'
    const tmp = { ...doc };
    delete tmp._id;

    const r = await model.findOneAndUpdate(
      filter,
      {
        $set: tmp,
      },
      { upsert: upsert, returnNewDocument: true }
    );

    if (r.value && r.value._id) {
      r.id = r.value._id.toString();
    } else if (r.lastErrorObject && r.lastErrorObject.upserted) {
      r.id = r.lastErrorObject.upserted.toString();
    }

    return {
      id: r.id,
      ...r.value,
      ...doc,
    };
  };
};

const upsertItem = upsertPage;

const upsertMetric = (model, Page) => {
  return async (
    doc,
    tryToGetPage = false,
    tryToForceUpdate = false,
    slip = 1000
  ) => {
    await sleep(slip);

    let tmpDoc = { ...doc };
    if (!tmpDoc.PageId && tryToGetPage) {
      const p = await findOnePageByUrl(Page)(tmpDoc.url);
      if (p) tmpDoc.PageId = p.id;
    }

    const { id, serial, data, contentSerial } = tmpDoc;
    let filter = {};

    if (tryToForceUpdate) {
      if (serial) {
        filter.serial = serial;
      } else if (id) {
        filter._id = new Mongodb.ObjectID(id);
      } else if (data && data._pageSerial) {
        filter["data._pageSerial"] = data._pageSerial;
      } else if (contentSerial) {
        filter.contentSerial = contentSerial;
      } else {
        // TODO: Should update? Maybe just ignore this call.
        // return;
        filter = doc;
      }
    } else {
      tmpDoc.contentSerial = sha256(JSON.stringify(doc));
      filter.contentSerial = contentSerial;
    }

    const r = await model.findOneAndUpdate(
      filter,
      {
        $set: tmpDoc,
      },
      { upsert: true, returnNewDocument: true }
    );

    if (r.value && r.value._id) {
      r.id = r.value._id.toString();
    } else if (r.lastErrorObject && r.lastErrorObject.upserted) {
      r.id = r.lastErrorObject.upserted.toString();
    }

    return {
      id: r.id,
      ...r.value,
      ...doc,
    };
  };
};

const upsertConfig = upsertMetric;

export {
  connect,
  sync,
  findPages,
  lastPageImported,
  findOnePageByUrl,
  findOneItemByUrl,
  upsertPage,
  upsertMetric,
  upsertConfig,
  upsertItem,
  countItems,
  countPages,
  restartPages,
  metrics,
  configErrors,
};
