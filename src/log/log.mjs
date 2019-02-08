const print = (level, strings) => {
  let strs;
  switch (level) {
    case "INFO":
      strs = strings.map(s => s && s.info);
      console.log.apply(this, strs);
      break;
    case "DEBUG":
      strs = strings.map(s => s && s.debug);
      console.log.apply(this, strs);
      break;
    case "ERROR":
      strs = strings.map(s => s && s.error);
      console.log.apply(this, strs);
      break;
    case "WARN":
      strs = strings.map(s => s && s.warn);
      console.log.apply(this, strs);
      break;
    case "VERBOSE":
      strs = strings.map(s => s && s.verbose);
      console.log.apply(this, strs);
      break;
    default:
      console.log.apply(this, strings);
  }
};

const log = levelConfig => (level, ...strings) => {
  const config = levelConfig || "info";

  if (
    (config === "warn" && ["WARN", "ERROR"].indexOf(level) > -1) ||
    (config === "error" && ["ERROR"].indexOf(level) > -1) ||
    (config === "info" && ["WARN", "INFO", "ERROR"].indexOf(level) > -1) ||
    (config === "verbose" &&
      ["WARN", "ERROR", "INFO", "VERBOSE"].indexOf(level) > -1) ||
    (config === "debug" &&
      ["ERROR", "WARN", "INFO", "VERBOSE", "DEBUG"].indexOf(level) > -1)
  ) {
    print(level, strings.map(s => "\n" + s));
  }
};

export { log };
