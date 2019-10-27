import { default as express } from "express";
var router = express.Router();

/* GET home page. */
router.get("/", async (req, res, next) => {
  const database = res.app.get("database"); 
  const config = res.app.get("configuration"); 
  const metricsCursor = await database.metrics({
    website: config.website,
    name: undefined,
    type: config.type,
    limit: 50
  });

  const metrics = await metricsCursor.toArray();
  res.render("index", { title: "Express", metrics: metrics });
});

export {
  router
};