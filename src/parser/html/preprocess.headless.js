(() => {
  const calulateFreight = (zipcode, input, submit, action = "click") => {
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
      }, 500);
    });
  };

  const writeResult = (
    zipcode,
    freightResultSelector,
    scriptResultID = "crawlerScriptResult"
  ) => {
    let scriptResult = window.document.querySelector(scriptResultID);
    if (!scriptResult) {
      scriptResult = window.document.createElement("div");
      scriptResult.setAttribute("id", scriptResultID);
      window.document.body.appendChild(scriptResult);
    }

    const node = window.document.querySelector(freightResultSelector);
    const cloneWrapper = window.document.createElement("div");
    cloneWrapper.setAttribute("id", zipcode);
    cloneWrapper.setAttribute("class", "zipcode");
    const clone = node.cloneNode(true);
    cloneWrapper.appendChild(clone);
    scriptResult.appendChild(cloneWrapper);
  };

  const start = (
    zipcodes,
    inputFreight,
    submitFreight,
    freightResultSelector,
    freightErrorSelector,
    crawlerScriptResult
  ) => {
    const input = window.document.querySelector(inputFreight);
    const submit = window.document.querySelector(submitFreight);

    if (!(input && submit)) return [Promise.resolve("NO FREIGHT CALCULATOR!")];

    return zipcodes.map(zipcode => {
      calulateFreight(zipcode, input, submit);
      return new Promise(async (resolve, reject) => {
        const msg = "ERROR WAITING FOR FREIGHT RESULT " + zipcode;
        try {
          const ret = await getFreightResponse(
            freightResultSelector,
            freightErrorSelector
          );

          if (ret) {
            writeResult(zipcode, freightResultSelector, crawlerScriptResult);
          } else {
            console.error(msg);
          }

          resolve(zipcode);
        } catch (e) {
          console.error(msg);
          reject(msg);
        }
      });
    });
  };

  return start(
    ["24240-660"],
    "input.input__zipcode",
    "button.input__zipcode-button",
    "table.freight-product__table",
    ".freight-product__freight-text > :not(.js-loading)",
    "crawlerScriptResult"
  );
})();
