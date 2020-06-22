import { includedIn, validUrls } from "./helper.mjs";

// Body
// [
//   {
//     website: "",
//     type: "",
//     pages: [
//       {
//         name: "",
//         urls: [],
//       },
//     ],
//   },
// ];
const validateBody = (body, args, websites) => {
  if (!Array.isArray(body)) {
    return createErrorForType("body", "array");
  } else {
    for (let i = 0; i < body.length; ++i) {
      const w = body[i];
      const wconf = websites.filter((web) => web.name === w.website)[0];

      if (!wconf) {
        return createErrorForList(
          websites.map((web) => web.name),
          "website"
        );
      } else if (wconf.type !== w.type || args.type !== w.type) {
        return createErrorForList([wconf.type, args.type], "type");
      } else if (!includedIn(args.websites, [w.website])) {
        return createErrorForList(args.websites, "website");
      } else if (!Array.isArray(w.pages)) {
        return createErrorForType("pages", "array");
      } else if (
        !includedIn(
          args.pages,
          w.pages.map((p) => p.name)
        )
      ) {
        return createErrorForList(args.pages, "pages");
      } else if (
        !includedIn(
          wconf.pages.map((p) => p.name),
          w.pages.map((p) => p.name)
        )
      ) {
        return createErrorForList(
          wconf.pages.map((p) => p.name),
          "pages"
        );
      }

      for (let j = 0; j < w.pages.length; ++j) {
        const p = w.pages[j];
        if (
          !Array.isArray(p.urls) ||
          p.urls.length === 0 ||
          !validUrls(p.urls, wconf.domain)
        ) {
          return createErrorForList(args.urls, "urls");
        }
      }
    }
  }
};

const createErrorForType = (param, type) => {
  const e = new Error(`You must pass the '${param}' as '${type}'.`);
  e.status = 400;
  return e;
};

const createErrorForList = (values, param) => {
  const e = new Error(
    `You must pass '${param}' parameter correctly. Allowed values: ${JSON.stringify(
      values
    )}.`
  );
  e.status = 400;
  return e;
};

const parserMiddleware = (req, res, next) => {
  const args = res.app.get("args");
  const websitesConfiguration = res.app.get("websitesConfiguration");
  const pool = res.app.get("parserPool");
  const urls = [
    "//zoom.com.br/some/path",
    "http://www.zoom.com.br",
    "//www.zoom.com.br/",
    "https://zoom.com.br/some/path",
  ];

  if (!Array.isArray(pool) || pool.length === 0) {
    return next(createErrorForType("pool", "array"));
  } else {
    const e = validateBody(
      req.body,
      {
        type: args.type,
        websites: args.website,
        pages: args.page,
        urls,
      },
      websitesConfiguration
    );
    if (e) {
      return next(e);
    }
  }

  return next();
};

// [{ "website": "magalu", "type": "headless", "pages": [{ "name": "category", "urls": ["/notebook-e-macbook/informatica/s/in/ntmk"]}]}]
const parseReaderResponse = (body, response) => {
  return response;
  const out = [];

  // body.forEach((w, index) => {
  //   const website = response[index];
  //   out.website = w.website;
  //   out.type = w.type;
  //   w.pages.forEach((page, jndex) => {
  //     page.urls.forEach((url, kndex) => {
  //       website[kndex] = "";
  //     });
  //   });
  // });

  // 1 - website / type
  // 2 - uris
  // 3 - pages
  // 4 - selector
  // [{
  //   website: "",
  //   type: "",
  //   pages: [{
  //     url: "",
  //     name: "",
  //     data: [{}]
  //   }]
  // }]

  (response || []).forEach((website, index) => {
    const oweb = {};
    const bwebsite = body[index];
    oweb.website = bwebsite.website;
    oweb.type = bwebsite.type;
    oweb.pages = [];

    (website || []).forEach((url) => {
      const opage = {};
      (url.yield || []).forEach((page) => {
        (page || []).forEach((selector) => {
          out.website = selector[0] ? selector[0].website : "";
          out.type = "";
        });
      });
    });
  });

  return out;
};

export { parserMiddleware, parseReaderResponse };
