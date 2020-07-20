const r2 = require("r2");

const process = (result, metadata, ...args) => {
  return r2.post("http://localhost:8088/test", {
    json: { ...result, metadata, args: args },
  }).response;
};

module.exports = process;
