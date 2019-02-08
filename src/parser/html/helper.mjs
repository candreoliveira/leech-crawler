import { default as htmlToText } from "html-to-text";
import { clean, zip, getUrl } from "../helper.mjs";

const getNextPages = ($, uri, pageNextPages) => {
  let output = [];

  if (pageNextPages && Array.isArray(pageNextPages)) {
    pageNextPages.filter(p => typeof p === "object").forEach(p => {
      let res;

      if (p.param) {
        res = Array.from($(p.selector)).map(elem => {
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
              ignoreImage: true
            });

            return `${uri.origin}${uri.pathname}?${p.param}=${page}`;
          }

          return null;
        });
      } else {
        res = Array.from($(p.selector)).map(elem => {
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
              ignoreImage: true
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
  pageDataWithJoin.forEach(curr => {
    if (Array.isArray(curr.join) && curr.join.length > 1 && curr.list) {
      const values = curr.join.map(key => {
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
          .filter(k => curr.join.indexOf(k) === -1)
          .forEach(k => {
            acc[k] = element[k];
          });

        return acc;
      }
    }, {});
  });
};

const getValueFromSelector = ($, element, selector, domain) => {
  let output = null;
  let gotData = false;
  selector = Array.isArray(selector) ? selector : [selector];

  // Is a method text?
  if (selector && element.method === "text") {
    gotData = true;
    output = selector.map((e, i) => {
      return htmlToText.fromString($(e).html(), {
        linkHrefBaseUrl: domain,
        wordwrap: false,
        ignoreImage: true
      });
    });

    // Is a method?
  } else if (selector && element.method) {
    gotData = true;
    output = selector.map((e, i) => {
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
    output = selector.map((e, i) => {
      return e;
    });
  }

  // Replace
  if (element.replace && element.replace.pattern && (element.replace.new || element.replace.new === "")) {
    const regex = new RegExp(element.replace.pattern, (element.replace.options || ""));

    // Replace all values
    output = output.map(e => {
      return e.replace(regex, element.replace.new);
    });
  }

  // Trim
  if (element.trim) {
    output = output.map(e => {
      return e.trim();
    });
  }

  return output;
};

const parseDataWithSelector = ($, domain, array, logger) => {
  let output = {};

  array.forEach(element => {
    if (typeof element !== "object")
      return logger(
        "ERROR",
        `[HTML] Error parsing config: ${element} is not an object.`
      );

    let selector = [], selectors = [];
    const niw = {};

    if (Array.isArray(element.selector)) {
      for (let i = 0; i < element.selector.length; i++) {
        const tmp = Array.from($(element.selector[i]));
        selectors.push(tmp);
        if (tmp.length > selector.length) {
          selector = tmp;
        }
      }

      let values = [];
      for (let i = 0; i < selector.length; i++) {
        // This value can be empty or null
        let value = getValueFromSelector($, element, selector[i], domain)[0];

        // Get the value from any selector to prevent the empty value above
        for (let j = 0; j < selectors.length; j++) {
          if (selectors[j][i]) {
            value = value || getValueFromSelector($, element, selectors[j][i], domain)[0];
          }
        }

        values.push(value);
      }

      niw[element.newKey] = values;
      output = { ...output, ...niw };
    } else {
      selector = Array.from($(element.selector));
      niw[element.newKey] = getValueFromSelector($, element, selector, domain);
      output = { ...output, ...niw };
    }

    // Update url/link to fullUrl
    if (
      ["url", "link"].indexOf(element.newKey) > -1 &&
      output[element.newKey]
    ) {
      output[element.newKey] = output[element.newKey].map(u =>
        getUrl(domain, u)
      );
    }

    if (element.list && output[element.newKey]) {
      output[element.newKey] = [output[element.newKey]];
    }

    if (element.number && output[element.newKey]) {
      output[element.newKey] = output[element.newKey].map(u => {
        let tmp = u.match(/\d+(?:(?:\.|\,)(?:\d*))?/);
        if (tmp) {
          tmp = Number(tmp[0].replace(",", "."));
        }

        return tmp || "";
      });
    }
  });

  return output;
};

// {label: [string], value: [string], description: [string], name: [string]}
const parseDataWithZip = previousParsedPage => {
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
  return out.map(element => {
    return { ...element, ...data };
  });
}

const parsePage = ($, domain, href, page, pageData, logger) => {
  // Parse data
  let out = parseDataWithSelector(
    $,
    domain,
    pageData.filter(e => !!e.selector),
    logger
  );

  // zip join list
  out = parseDataWithZipJoinList(out, pageData.filter(e => !!e.join));

  // zip array of selectors
  out = parseDataWithZip(out);

  // Adjust the "Join" case
  out = parseDataWithJoin(out, pageData.filter(e => !!e.join));

  // Set pageUrl and website
  out = appendData(out, {
    pageUrl: href,
    website: page
  });

  return out;
}

const parser = ($, domain, uri, parg, configPages, configName, logger) => {
  // Return an array of array of items
  let filteredPages = configPages;

  if (parg) {
    filteredPages = filteredPages.filter(e => e.name === parg);
  }

  return {
    result: filteredPages.map(page => {
      return parsePage($, domain, uri.href, configName, page.data, logger);
    }),
    nextPages: filteredPages.map(page => {
      return getNextPages($, uri, page.nextPages);
    })
  };
}

export {
  parseDataWithSelector,
  parseDataWithZipJoinList,
  parseDataWithZip,
  parseDataWithJoin,
  getNextPages,
  parsePage,
  parser
};
