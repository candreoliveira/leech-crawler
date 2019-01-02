import { default as cluster } from "cluster";
import { default as yargs } from "yargs";
import { log as l } from "./log/log.mjs";
import { start } from "./index.mjs";

if (process.env.NODE_ENV === "production") {
  const numCPUs = yargs.argv.cpu;
  const log = l("debug");

  if (cluster.isMaster) {
    log("INFO", `Master ${process.pid} is running`);

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      log("INFO", `Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    });
    
  } else {
    log("INFO", `Worker ${process.pid} started`);
    start();
  }
} else {
  start();
}
