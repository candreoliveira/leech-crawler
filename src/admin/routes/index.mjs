import { default as express } from "express";
import { default as moment } from "moment";

var router = express.Router();

const getMetrics = async (
  database,
  website = undefined,
  name = undefined,
  type = undefined,
  limit = 50
) => {
  return await database.metrics({
    website,
    name,
    type,
    limit,
  });
};

const getConfigErrors = async (
  database,
  website = undefined,
  name = undefined,
  type = undefined,
  limit = 50
) => {
  return await database.configErrors({
    website,
    name,
    type,
    limit,
  });
};

router.get("/", async (req, res) => {
  const database = res.app.get("database");
  const config = res.app.get("configuration");
  const website = req.query.website || undefined;

  try {
    const metrics = await getMetrics(database, website);
    const configErrors = await getConfigErrors(database, website);

    res.render("index", {
      title: "Crawler",
      metrics: metrics,
      errors: configErrors,
      website: website,
      websites: config.websites.map((v) => v.name),
      type: undefined,
      name: undefined,
      hasData: !!metrics && !!configErrors,
      moment: moment,
    });
  } catch (e) {
    res.status(500).send(e);
  }
});

export { router };
