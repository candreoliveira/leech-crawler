const calulateFreight = (zipcode, input, submit, action = "click") => {
  // // --- REMOVE SKU ELEMENT SELECT
  input.value = zipcode;

  const descriptor = Object.getOwnPropertyDescriptor(input, "value");
  let event = document.createEvent("UIEvents");
  event.initEvent("focus", false, false);
  input.dispatchEvent(event);

  const initialValue = input.value;
  input.value = initialValue + "#";

  if (descriptor && descriptor.configurable) {
    delete input["value"];
  }

  input.value = initialValue;
  event = document.createEvent("HTMLEvents");
  event.initEvent("propertychange", false, false);
  event.propertyName = "value";
  input.dispatchEvent(event);
  event = document.createEvent("HTMLEvents");
  event.initEvent("input", true, false);
  input.dispatchEvent(event);

  if (descriptor) {
    Object.defineProperty(input, "value", descriptor);
  }

  action === "click" ? submit.click() : submit.submit();
};

const getFreightResponse = (freightResultSelector, freightErrorSelector) => {
  return new Promise((resolve, reject) => {
    let retries = 0;
    const interval = setInterval(() => {
      if (!!window.document.querySelector(freightResultSelector)) {
        clearInterval(interval);
        resolve(true);
      } else if (!!window.document.querySelector(freightErrorSelector)) {
        clearInterval(interval);
        resolve(false);
      } else if (
        !window.document.querySelector(freightResultSelector) &&
        retries >= 50
      ) {
        clearInterval(interval);
        resolve(false);
      } else {
        ++retries;
      }
    }, 1000);
  });
};

const writeResult = (
  zipcode,
  freightResultSelector,
  scriptResultID = "crawlerScriptResult",
  notAvailableText = "Não disponível"
) => {
  let scriptResult = window.document.querySelector("#" + scriptResultID);

  if (!scriptResult) {
    scriptResult = window.document.createElement("div");
    scriptResult.setAttribute("id", scriptResultID);
    window.document.body.appendChild(scriptResult);
  }

  const node = window.document.querySelector(freightResultSelector);
  const maxCells = Array.from(node.rows).reduce((acc, curr) => {
    acc = curr.cells.length > acc ? curr.cells.length : acc;
    return acc;
  }, 0);

  // --- VERIFY AND CREATE
  let cloneWrapper = scriptResult.querySelector(".zipcode");

  if (!cloneWrapper) {
    cloneWrapper = window.document.createElement("div");
    cloneWrapper.setAttribute("class", "zipcode");
    scriptResult.appendChild(cloneWrapper);
  }

  // --- VERIFY AND CREATE
  let table = scriptResult.querySelector(".zipcode .table");
  if (!table) {
    table = window.document.createElement("table");
    table.setAttribute("class", "table");
    cloneWrapper.appendChild(table);
  }

  for (let j = 0; j < Array.from(node.rows).length; j++) {
    const row = Array.from(node.rows)[j];
    const tr = window.document.createElement("tr");
    tr.setAttribute("id", zipcode);
    tr.setAttribute("class", "tr");

    for (let i = 0; i < maxCells; i++) {
      const td = window.document.createElement("td");
      td.setAttribute("class", "td");
      td.innerText = row.cells[i]
        ? row.cells[i].innerText.trim()
        : notAvailableText;
      tr.appendChild(td);
    }

    table.appendChild(tr);
  }

  // cloneWrapper.appendChild(table);
  // scriptResult.appendChild(cloneWrapper);
};
function start(
  zipcodes,
  inputFreight,
  submitFreight,
  freightResultSelector,
  freightErrorSelector,
  crawlerScriptResult,
  notAvailableText,
  deleteCookie
) {
  return new Promise(async (resolve, reject) => {
    const promises = [];
    for (let zipcode of zipcodes) {
      if (Array.isArray(deleteCookie)) {
        for (let ck of deleteCookie) {
          document.cookie =
            ck + "=; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Path=/;";
        }
      }

      try {
        promises.push(
          calulateFreightFromZipcode(
            zipcode,
            inputFreight,
            submitFreight,
            freightResultSelector,
            freightErrorSelector,
            crawlerScriptResult,
            notAvailableText
          )
        );
      } catch (ex) {
        reject(ex);
      }
    }

    const ret = await Promise.all(promises);
    resolve(ret);
  });
}

const calulateFreightFromZipcode = (
  zipcode,
  inputFreight,
  submitFreight,
  freightResultSelector,
  freightErrorSelector,
  crawlerScriptResult,
  notAvailableText
) => {
  const input = window.document.querySelector(inputFreight);
  const submit = window.document.querySelector(submitFreight);

  if (!(input && submit)) return [Promise.resolve("NO FREIGHT CALCULATOR!")];
  calulateFreight(zipcode, input, submit);

  return new Promise(async (resolve, reject) => {
    const msg = "ERROR WAITING FOR FREIGHT RESULT " + zipcode;
    try {
      const ret = await getFreightResponse(
        freightResultSelector,
        freightErrorSelector
      );

      if (ret) {
        writeResult(
          zipcode,
          freightResultSelector,
          crawlerScriptResult,
          notAvailableText
        );
      } else {
        console.error(msg);
      }

      resolve(zipcode);
    } catch (e) {
      console.error(msg, e);
      reject(msg);
    }
  });
};

return start(...arguments);
