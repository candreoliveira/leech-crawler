import { default as express } from "express";
import { default as moment } from "moment";
import { getConfigErrors } from "./configError.mjs";
import { getMetrics } from "./metric.mjs";

var router = express.Router();

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
