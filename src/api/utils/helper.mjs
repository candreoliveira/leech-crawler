import { default as validUri } from "is-url";
import { getUrl } from "../../parser/helper.mjs";

const includedIn = (control, inn) => {
  return inn.every((i) => {
    return control.indexOf(i) > -1;
  });
};

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

const validUrls = (urls, domain) => {
  const uris = urls.map((url) => getUrl(url, domain));
  return uris.every((url) => validUri(url));
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

export { validateBody, createErrorForType };
