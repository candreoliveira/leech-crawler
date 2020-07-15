const r2 = require("r2");

const process = (result, ...args) => {
  return r2.post("http://localhost:8088/test", {
    json: { ...result, args: args },
  }).response;
};

module.exports = process;
