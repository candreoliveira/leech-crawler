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

  const isOnDOM = query => {
    return !!window.document.querySelector(query);
  };

  const getFreightResponse = (freightResultSelector, freightErrorSelector) => {
    return new Promise((resolve, reject) => {
      let retries = 0;
      const interval = setInterval(() => {
        if (isOnDOM(freightResultSelector)) {
          clearInterval(interval);
          resolve(true);
        } else if (
          isOnDOM(freightErrorSelector) ||
          (!isOnDom(freightResultSelector) && retries >= 50)
        ) {
          clearInterval(interval);
          reject(false);
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
    const clone = node.cloneNode(true);
    cloneWrapper.appendChild(clone);
    scriptResult.appendChild(cloneWrapper);
  };

  const start = (zipcodes, inputFreight, submitFreight) => {
    const input = window.document.querySelector(inputFreight);
    const submit = window.document.querySelector(submitFreight);

    return zipcodes.map((zipcode, i) => {
      calulateFreight(zipcode, input, submit);
      return new Promise(async (resolve, reject) => {
        try {
          await getFreightResponse(".freight-result", ".freight-feedback-error");
          writeResult(zipcode, ".freight-result");
          resolve(zipcode);
        } catch (e) {
          const msg = "ERROR WAITING FOR FREIGHT RESULT " + zipcode;
          console.error(msg);
          reject(msg);
        }
      });
    });
  };

  return start(
    ["24240-660"],
    "#input-freight-product",
    "#bt-freight-product"
  );
})();
