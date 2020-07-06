import { default as normalizeUrl } from "normalize-url";

const reversePriority = (priority, max = 10) => {
  return Math.round((1 / priority) * max);
};

const zip = (arr, ...arrs) => {
  return arr.map((val, i) => arrs.reduce((a, cur) => [...a, cur[i]], [val]));
};

const randomize = (length) => {
  return Math.floor(Math.random() * length);
};

const getUrl = (domain, uri, removeTrailingSlash = false, stripWWW = false) => {
  if (!uri) return;

  let output = uri;
  if (uri.indexOf("http") === -1) output = domain + uri;

  return normalizeUrl(decodeURIComponent(output), {
    removeTrailingSlash: removeTrailingSlash,
    stripWWW: stripWWW,
  });
};

const flat = (array) => {
  return array.reduce((acc, val) => acc.concat(val), []);
};

const sleep = async (duration) => {
  return await new Promise((resolve) => setTimeout(resolve, duration));
};

const diff = (array1, array2) => {
  return array1.filter((i) => {
    return array2.indexOf(i) < 0;
  });
};

const clean = (array) => {
  if (!Array.isArray(array)) return array;

  let output = [];

  for (var i = 0; i < array.length; i++) {
    let add = true;

    for (var j = i + 1; j < array.length; j++)
      if (array[i] == array[j]) add = false;

    if (add && array[i]) output.push(array[i]);
  }

  return output;
};

const getStacktrace = (err) => {
  if (!err) return;
  if (typeof err == "object" && err.stack) return err.stack;
  if (typeof err == "object" && !err.stack && err.message) return err.message;
  if (typeof err == "object" && !err.stack && !err.message) return err;
};

const getPrettyJson = (object) => {
  if (process.env.NODE_ENV === "production") return JSON.stringify(object);
  return JSON.stringify(object, null, 2);
};

const find = (array, attr, value) => {
  return array.filter((f) => f[attr] === value)[0];
};

const setAll = (array, attr, value) => {
  return array.map((a) => {
    a[attr] = value;
    return a;
  });
};

const userAgent = (type, website) => {
  const list = {
    default: [
      "APIs-Google (+https://developers.google.com/webmasters/APIs-Google.html)",
      "Googlebot-Image/1.0",
      "Googlebot-News",
      "Googlebot-Video/1.0",
      "Mediapartners-Google/2.1",
      "AdsBot-Google (+http://www.google.com/adsbot.html)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexAccessibilityBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexDirectDyn/1.0; +http://yandex.com/bots",
      "Mozilla/5.0 (compatible; YandexBlogs/0.99; robot; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexWebmaster/2.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; YandexNews/4.0; +http://yandex.com/bots)",
    ],
    pontofrio: [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.81 Safari/537.36",
    ],
    vitacost: [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.81 Safari/537.36",
    ],
    americanas: [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.81 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36",
    ],
  };

  const l = list[website || "default"] || list.default;
  return type === "rotate" ? l[randomize(l.length)] : l;
};

export {
  getPrettyJson,
  getStacktrace,
  setAll,
  find,
  zip,
  randomize,
  userAgent,
  getUrl,
  flat,
  sleep,
  clean,
  diff,
  reversePriority,
};
