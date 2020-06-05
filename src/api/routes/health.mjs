import { default as express } from "express";

var router = express.Router();

router.get("/", async (req, res) => {
  res.status(200).send("I'm healthy!");
});

export { router };
