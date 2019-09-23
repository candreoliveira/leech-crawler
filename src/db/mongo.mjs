import { default as Mongodb } from "mongodb";
import { sleep } from "../parser/helper.mjs";
import sha256 from "sha256";

const connect = async (config, env) => {
  let db;
  const client = new Mongodb.MongoClient(
    `mongodb${process.env.DB_SRV || config[env].srv ? "+srv" : ""}://${process
      .env.DB_USER || config[env].user}:${process.env.DB_PASS ||
      config[env].password}@${process.env.DB_HOST || config[env].host}${
      process.env.DB_SRV || config[env].srv
        ? ""
        : ":" + (process.env.DB_PORT || config[env].port)
    }/${process.env.DB_NAME || config[env].name}`,
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
    console.log(`[Mongodb] Can't create indexes ${e}.`);
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

const sync = (client, model) => {
  return async () => {
    await model.Page.drop();
    await model.Item.drop();
    await model.Metric.drop();
    return await Promise.resolve("[Mongodb] Mongodb collections dropped.");
  };
};

const findPages = model => {
  return async params => {
    const r = await model
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

    if (Array.isArray(r)) {
      return r.map(v => {
        if (v._id) v.id = v._id.toString();
        return v;
      });
    }

    return r;
  };
};

const findOnePageByUrl = model => {
  return async url => {
    const r = await model.findOne({
      serial: sha256(url)
    });

    if (r && r._id) r.id = r._id.toString();
    return r;
  };
};

const findOneItemByUrl = model => {
  return async url => {
    const r = await model.findOne({
      "data.pageSerial": sha256(url)
    });

    if (r && r._id) r.id = r._id.toString();
    return r;
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
      { upsert: false }
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
  return async (doc, upsert = false) => {
    const { id, serial, data } = doc;
    const filter = {};

    if (serial) {
      filter["serial"] = serial;
    } else if (id) {
      filter["_id"] = new Mongodb.ObjectID(id);
    } else if (data && data.pageSerial) {
      filter["data.pageSerial"] = data.pageSerial;
    } else {
      filter = doc;
    }

    // Prevent performing an update on the path '_id'
    const tmp = { ...doc };
    delete tmp._id;

    const r = await model.findOneAndUpdate(
      filter,
      {
        $set: tmp
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
      ...doc
    };
  };
};

const upsertItem = upsertPage;

const upsertMetric = model => {
  return async (doc, tryToGetPage = false, slip = 1000) => {
    await sleep(slip);

    if (!doc.PageId && tryToGetPage) {
      const p = await findOnePageByUrl(model)(doc.url);
      if (p) doc.PageId = p.id;
    }

    const { id, serial, data } = doc;
    const filter = {};
    if (serial) {
      filter["serial"] = serial;
    } else if (id) {
      filter["_id"] = new Mongodb.ObjectID(id);
    } else if (data && data.pageSerial) {
      filter["data.pageSerial"] = data.pageSerial;
    } else {
      filter = doc;
    }

    const r = await model.findOneAndUpdate(
      filter,
      {
        $set: doc
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
      ...doc
    };
  };
};

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
