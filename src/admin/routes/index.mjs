import { default as express } from "express";
var router = express.Router();

/* GET home page. */
router.get("/", async (req, res, next) => {
  const database = res.app.get("database"); 
  const config = res.app.get("configuration"); 
  const metrics = await database.metrics({
    website: config.website,
    name: undefined,
    type: config.type,
    limit: 50
  });

  // Return metrics object
  res.render("index", { title: "Express", metrics: metrics });
});

export {
  router
};
