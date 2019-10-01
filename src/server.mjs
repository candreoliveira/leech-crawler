import { default as express } from "express";
import { default as path } from "path";

const app = express();

//setting middleware
app.use(express.static(path.join(path.resolve(), "src/admin"))); //Serves resources from public folder
app.use("/assets", express.static(path.join(path.resolve(), "node_modules/material-dashboard/assets")));

// console.log(path.join(path.resolve(), "node_modules/material-dashboard/assets"))
const server = app.listen(5000);