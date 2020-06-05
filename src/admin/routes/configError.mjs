import { default as express } from "express";
import { default as moment } from "moment";

var router = express.Router();

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

router.get("/configErrors", async (req, res) => {
  const database = res.app.get("database");
  const website = req.query.website || undefined;

  try {
    const metrics = await getConfigErrors(database, website);
    res.status(200).json(metrics);
  } catch (e) {
    res.status(500).send(e);
  }
});

export { router, getConfigErrors };
