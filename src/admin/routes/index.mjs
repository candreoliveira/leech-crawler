import { default as express } from "express";
var router = express.Router();

const getMetrics = async (database, website = undefined, name = undefined, type = undefined, limit = 50) => {
  return await database.metrics({
    website,
    name,
    type,
    limit
  });
}

router.get("/", async (req, res, next) => {
  const database = res.app.get("database");
  const config = res.app.get("configuration");
  const website = req.query.website || undefined,
    type = undefined,
    name = undefined;

  try {
    const metrics = await getMetrics(database, website);
    res.render("index", {
      title: "Crawler",
      metrics: metrics,
      website: website,
      websites: config.websites.map(v => v.name),
      type: type,
      name: name
    });
  } catch (e) {
    res.status(500).send(e);
  }
});

router.get("/metrics", async (req, res, next) => {
  const database = res.app.get("database");
  const website = req.query.website || undefined,
    type = undefined,
    name = undefined;

  try {
    const metrics = await getMetrics(database, website);
    res.status(200).json(metrics);
  } catch (e) {
    res.status(500).send(e);
  }
});

export {
  router
};
