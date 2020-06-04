(() => {
  const calulateFreight = (zipcode, input, submit, action = "click") => {
    // --- REMOVE SKU ELEMENT SELECT
    const skuElement = window.document.querySelector("#variation-label");

    if (skuElement) skuElement.remove();
    const zipcodeChangeElement = window.document.querySelector(
      ".js-freight-zipcode-change"
    );

    if (zipcodeChangeElement) zipcodeChangeElement.click();
    // --- REMOVE FREIGHT CONTENT ELEMENT
    const zipcodeContentElement = window.document.querySelector(
      ".freight-product__table"
    );

    if (zipcodeContentElement) zipcodeContentElement.remove();
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

    Array.from(node.rows).forEach((row) => {
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

      const tdTest = window.document.createElement("td");
      tdTest.innerText = window.document.querySelector(
        ".js-freight-address"
      ).innerText;
      tr.appendChild(tdTest);
      table.appendChild(tr);
    });

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
    notAvailableText
  ) {
    return new Promise(async (resolve, reject) => {
      for (zipcode of zipcodes) {
        try {
          await calulateFreightFromZipcode(
            zipcode,
            inputFreight,
            submitFreight,
            freightResultSelector,
            freightErrorSelector,
            crawlerScriptResult,
            notAvailableText
          );
        } catch (ex) {
          reject();
        }
      }
      resolve();
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
        console.error(msg);
        reject(msg);
      }
    });
  };

  return start(
    ["04208-002", "21721-240", "69922-000"],
    "input.input__zipcode",
    "button.input__zipcode-button",
    "table.freight-product__table",
    ".freight-product__freight-text > :not(.js-loading)",
    "crawlerScriptResult",
    "Não disponível"
  );
})();
