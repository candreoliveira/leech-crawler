import { default as validUri } from "is-url";
import { getUrl } from "../../parser/helper.mjs";

const includedIn = (control, inn) => {
  return inn.every((i) => {
    return control.indexOf(i) > -1;
  });
};

const validUrls = (urls, domain) => {
  const uris = urls.map((url) => getUrl(url, domain));
  return uris.every((url) => validUri(url));
};

export { validUrls, includedIn };
