import { default as htmlToText } from "html-to-text";
import { clean, zip, getUrl, flat } from "../helper.mjs";
import sha256 from "sha256";

const getNextPages = ($, uri, pageNextPages) => {
  let output = [];

  if (pageNextPages && Array.isArray(pageNextPages)) {
    pageNextPages
      .filter((p) => typeof p === "object")
      .forEach((p) => {
        let res;

        if (p.param) {
          res = Array.from($(p.selector)).map((elem) => {
            if (p.attr && typeof p.attr === "string") {
              const page = $(elem).attr(p.attr);

              return `${uri.origin}${uri.pathname}?${p.param}=${page}`;
            } else if (p.attr && Array.isArray(p.attr)) {
              const page = p.attr.reduce((accumulate, current) => {
                return $(accumulate).attr(current);
              }, elem);

              return `${uri.origin}${uri.pathname}?${p.param}=${page}`;
            } else if (p.method == "text") {
              const page = htmlToText.fromString($(elem).html(), {
                linkHrefBaseUrl: uri.origin,
                wordwrap: false,
                ignoreImage: true,
              });

              return `${uri.origin}${uri.pathname}?${p.param}=${page}`;
            }

            return null;
          });
        } else {
          res = Array.from($(p.selector)).map((elem) => {
            if (p.attr && typeof p.attr === "string") {
              return $(elem).attr(p.attr);
            } else if (p.attr && Array.isArray(p.attr)) {
              return p.attr.reduce((accumulate, current) => {
                return $(accumulate).attr(current);
              }, elem);
            } else if (p.method == "text") {
              return htmlToText.fromString($(elem).html(), {
                linkHrefBaseUrl: uri.origin,
                wordwrap: false,
                ignoreImage: true,
              });
            }

            return null;
          });
        }

        output = output.concat(res);
      });
  }

  return clean(output);
};

const parseDataWithZipJoinList = (previousParsedPage, pageDataWithJoin) => {
  if (pageDataWithJoin.length === 0) return previousParsedPage;

  let output = previousParsedPage;
  pageDataWithJoin.forEach((curr) => {
    if (Array.isArray(curr.join) && curr.join.length > 1 && curr.list) {
      const values = curr.join.map((key) => {
        return output[key];
      });

      const zippedValues = zip.apply(this, values);

      const initial = {};
      initial[curr.newKey] = zippedValues.reduce(
        (accumulate, current, index) => {
          const obj = curr.join.reduce((a, c, i) => {
            a[c] = current[i];
            return a;
          }, {});
          accumulate[0].push(obj);
          return accumulate;
        },
        [[]]
      );

      output = Object.keys(output).reduce((accumulate, current) => {
        if (curr.join.indexOf(current) === -1)
          accumulate[current] = output[current];
        return accumulate;
      }, initial);
    }
  });

  return output;
};

const parseDataWithJoin = (previousParsedPage, array) => {
  if (array.length === 0) return previousParsedPage;

  return previousParsedPage.map((element, i) => {
    return array.reduce((acc, curr) => {
      if (Array.isArray(curr.join) && curr.join.length > 1) {
        // Set array of join keys
        acc[curr.newKey] = curr.join.reduce((accumulate, current) => {
          if (element[current]) {
            let obj = {};
            obj[current] = element[current];
            accumulate.push(obj);
          }

          return accumulate;
        }, []);

        // Copy not join (others) keys
        Object.keys(element)
          .filter((k) => curr.join.indexOf(k) === -1)
          .forEach((k) => {
            acc[k] = element[k];
          });

        return acc;
      }
    }, {});
  });
};

// $ => cheerio html loaded, element => page config element, selector => current value from content array
const getValueFromSelector = ($, element, selector, domain) => {
  let output = null;
  let gotData = false;

  // Transform selector to array
  selector = Array.isArray(selector) ? selector : [selector];

  // Is a method text?
  if (selector && element.method === "text") {
    gotData = true;
    output = selector.map((e) => {
      return htmlToText.fromString($(e).html(), {
        linkHrefBaseUrl: domain,
        wordwrap: false,
        ignoreImage: true,
      });
    });

    // Is a method?
  } else if (selector && element.method) {
    gotData = true;
    output = selector.map((e) => {
      return $(e)[element.method]();
    });
  }

  // Attr is string?
  if (selector && typeof element.attr === "string") {
    gotData = true;
    output = selector.map((e, i) => {
      if (output && output[i]) {
        return output[i];
      }

      return $(e).attr(element.attr);
    });

    // Attr is array?
  } else if (selector && Array.isArray(element.attr)) {
    gotData = true;
    output = selector.map((e, i) => {
      if (output && output[i]) {
        return output[i];
      }

      return element.attr.reduce((accumulate, current) => {
        return $(accumulate).attr(current);
      }, e);
    });
  }

  // Default
  if (selector && !gotData) {
    output = selector.map((e) => {
      return e;
    });
  }

  // Replace
  if (
    element.replace &&
    element.replace.pattern &&
    (element.replace.new || element.replace.new === "")
  ) {
    const patt = Array.isArray(element.replace.pattern)
      ? element.replace.pattern
      : [element.replace.pattern];

    patt.forEach((p) => {
      const regex = new RegExp(p, element.replace.options || "");

      // Replace all values
      output = output.map((e) => {
        return e.replace(regex, element.replace.new);
      });
    });
  }

  // Trim
  if (element.trim) {
    output = output.map((e) => {
      return e.trim();
    });
  }

  return output;
};

// array => pageConfig, $ => cheerio obj with html loaded
const parseDataWithSelector = ($, domain, href, type, array, logger) => {
  let output = {};
  const errors = [];

  // Loop page config data
  array.forEach((element) => {
    if (typeof element !== "object")
      return logger(
        "ERROR",
        `[${type.toUpperCase()}] Error parsing config: ${element} is not an object.`
      );

    let selector = [],
      selectors = [];
    const niw = {};

    if (Array.isArray(element.selector)) {
      for (let i = 0; i < element.selector.length; i++) {
        // Content array from html
        const tmp = Array.from($(element.selector[i]));

        // Push content array on selectors array
        selectors.push(tmp);

        if (tmp.length > selector.length) {
          // Bigger array of content on selector
          selector = tmp;
        }
      }

      let values = [];

      // Loop the bigger array of content
      for (let i = 0; i < selector.length; i++) {
        // This value can be empty or null
        let value = getValueFromSelector($, element, selector[i], domain)[0];

        // Get the value from any selector to prevent the empty value above
        for (let j = 0; j < selectors.length; j++) {
          if (selectors[j][i]) {
            value =
              value ||
              getValueFromSelector($, element, selectors[j][i], domain)[0];
          }
        }

        // Value is the content and cant be empty otherwise the config is not working for this page
        if (!value || (Array.isArray(value) && value.length === 0)) {
          if (element.required === true) {
            throw createErrorOnEmpty(element.selector, href);
          } else {
            errors.push(createErrorOnEmpty(element.selector, href));
          }
        }

        values.push(value);
      }

      niw[element.newKey] = values;
      output = { ...output, ...niw };
    } else {
      selector = Array.from($(element.selector));
      const value = getValueFromSelector($, element, selector, domain);

      // Value is the content and cant be empty otherwise the config is not working for this page
      if (!value || (Array.isArray(value) && value.length === 0)) {
        if (element.required === true) {
          throw createErrorOnEmpty(element.selector, href);
        } else {
          errors.push(createErrorOnEmpty(element.selector, href));
        }
      }

      niw[element.newKey] = value;
      output = { ...output, ...niw };
    }

    // Update url/link to fullUrl
    if (
      ["url", "link"].indexOf(element.newKey) > -1 &&
      output[element.newKey]
    ) {
      output[element.newKey] = output[element.newKey].map((u) =>
        getUrl(domain, decodeURIComponent(u))
      );
    }

    if (element.uri && output[element.newKey]) {
      output[element.newKey] = decodeURIComponent(output[element.newKey]);
    }

    if (element.list && output[element.newKey]) {
      output[element.newKey] = [output[element.newKey]];
    }

    if (element.number && output[element.newKey]) {
      output[element.newKey] = output[element.newKey].map((u) => {
        let tmp = u.match(/\d+(?:(?:\.|\,)(?:\d*))?/);
        if (tmp) {
          tmp = Number(tmp[0].replace(",", "."));
        }

        return tmp || "";
      });
    }
  });

  return [output, errors];
};

const createErrorOnEmpty = (selector, domain) => {
  const e = new Error();
  e.message = `Selector ${selector.toString()} not working on ${domain}!`;
  e.selector = Array.isArray(selector) ? selector : [selector];
  e.url = domain;
  e.date = new Date();
  return e;
};

// {label: [string], value: [string], description: [string], name: [string]}
const parseDataWithZip = (previousParsedPage) => {
  const keys = Object.keys(previousParsedPage);
  const values = Object.values(previousParsedPage);
  const zippedValues = zip.apply(this, values);

  return Array(values[0].length)
    .fill()
    .map((v, idx) => {
      return keys.reduce((accumulate, current, index) => {
        accumulate[current] = zippedValues[idx][index];
        return accumulate;
      }, {});
    });
};

const appendData = (out, data) => {
  return out.map((element) => {
    return { ...element, ...data };
  });
};

const parsePage = ($, logger, { domain, href, website, name, type, data }) => {
  // Parse data
  // ($, domain, href, type, array, logger)
  // [{newKey: []}, [errors]]
  const parsed = parseDataWithSelector(
    $,
    domain,
    href,
    type,
    data.filter((e) => !!e.selector),
    logger
  );

  let out = parsed[0];

  // zip join list
  out = parseDataWithZipJoinList(
    out,
    data.filter((e) => !!e.join)
  );

  // zip array of selectors; Transform {key:[values]} to [{key:value}]
  out = parseDataWithZip(out);

  // Adjust the "Join" case
  out = parseDataWithJoin(
    out,
    data.filter((e) => !!e.join)
  );

  // Set pageUrl and website
  out = appendData(out, {
    _pageSerial: sha256(getUrl(domain, href)),
    _pageUrl: getUrl(domain, href),
    _pageName: name,
    _pageWebsite: website,
    _pageProcessedAt: new Date(),
  });

  return { output: out, errors: parsed[1] };
};

const parser = ($, { domain, url, page, website, type, pages, logger }) => {
  // Return an array of array of items
  let filteredPages = pages;

  if (page) {
    filteredPages = filteredPages.filter((e) => e.name === page);
  }

  const output = [];
  const errors = [];

  filteredPages.forEach((page) => {
    // ($, {domain, href, website, name, type, data}, logger)
    const parsed = parsePage($, logger, {
      domain,
      href: url,
      website,
      type: type,
      data: page.data,
      name: page.name,
    });

    output.push(parsed.output);
    errors.push(parsed.errors);
  });

  return {
    result: output,
    errors: flat(errors),
    nextPages: filteredPages.map((page) => {
      return getNextPages($, new URL(url), page.nextPages);
    }),
  };
};

export {
  parseDataWithSelector,
  parseDataWithZipJoinList,
  parseDataWithZip,
  parseDataWithJoin,
  getNextPages,
  parsePage,
  parser,
};
