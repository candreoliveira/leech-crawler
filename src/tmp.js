const HCCrawler = require("headless-chrome-crawler");

(async () => {
  const crawler = await HCCrawler.launch({
    headless: true,
    retryDelay: 1000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors"
    ],
    evaluatePage: () => {
      throw new Error("Global functions won't be called");
    },
    onSuccess: result => {
      console.log(
        `Got ${result.result.title} ${result.result.carlos} for ${
          result.options.url
        }.`
      );
    },
    onError: err => {
      console.log(err);
    }
  });

  console.log("launch");

  await crawler.queue({
    url: "https://www.leilaovip.com.br/home",
    evaluatePage: () => {
      console.log("evaluate");
      return {
        title: $("title").text(),
        carlos: "a"
      };
    }
  });

  console.log("queue");
  await crawler.onIdle();
  await crawler.close();
})();
