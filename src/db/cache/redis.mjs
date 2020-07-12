import { default as RedisCache } from "node-headless-crawler/cache/redis.js";

const connect = async (config) => {
  const R = new RedisCache(config);
  await R.init();
  return R;
};

export { connect };
