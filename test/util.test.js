const util = require("../src/util");

test.only("zip()", () => {
  const test = [{
    arguments: [
      [1, 2, 3],
      ["a", "b", "c"],
      ["I", "II", "III"]
    ],
    output: [
      [1, "a", "I"],
      [2, "b", "II"],
      [3, "c", "III"]
    ]
  }, {
    arguments: [
      ["name"],
      ["description"],
      [{
        "marca": "philco",
        "polegadas": "50",
        "resolucao": "4k"
      }],
    ],
    output: [
      ["name", "description", {
        "marca": "philco",
        "polegadas": "50",
        "resolucao": "4k"
      }]
    ]
  }];

  expect(util.zip.apply(this, test[0].arguments)).toEqual(test[0].output);
  expect(util.zip.apply(this, test[1].arguments)).toEqual(test[1].output);
});

test("randomize()", () => {
  const length = 100;
  Array(length)
    .fill()
    .forEach((v, i) => {
      expect(util.randomize(1)).toBeGreaterThanOrEqual(0);
      expect(util.randomize(1)).toBeLessThanOrEqual(1);
      expect(util.randomize(length)).toBeLessThanOrEqual(length - 1);
    });
});

describe.each([/google|yandex|bing/i])("userAgent()", (regex) => {
  it("return an array of user agents if rotate is false", () => {
    const uas = util.userAgent(false);
    expect(uas).toBeInstanceOf(Array);
    expect(uas).toEqual(
      expect.arrayContaining([expect.stringMatching(regex)])
    );
  });

  it("return an ua string with bot if rotate is true", () => {
    expect(util.userAgent(true)).toMatch(regex);
  });
});

describe("getUrl()", () => {
  const test = {
    arguments: {
      origin: String,
      pathname: String
    },
    output: String
  };

  it("should return full url", () => {
    test.arguments.origin = "https://www.americanas.com.br";
    test.arguments.pathname = "/produto/132276480";
    test.output = "https://americanas.com.br/produto/132276480";
    expect(util.getUrl(test.arguments.origin, test.arguments.pathname)).toEqual(test.output);
  });

  it("should not return slashed url", () => {
    test.arguments.origin = "https://veiculos.mercadolivre.com.br/";
    test.arguments.pathname = "https://veiculos.mercadolivre.com.br/";
    test.output = "https://veiculos.mercadolivre.com.br";
    expect(util.getUrl(test.arguments.origin, test.arguments.pathname, true)).toEqual(test.output);
  });
});

describe("flat()", () => {

  const test = {
    arguments: [1, 2, "asd"],
    output: [1, 2, "asd"]
  };

  it("should return flat array", () => {
    expect(util.flat.apply(this, [test.arguments])).toEqual(test.output);
  });

});

describe("diff()", () => {

  const test = {
    arr1: [1, 2, 3, 4, 5],
    arr2: [1, 3, 4, 5],
    output: [2]
  };

  it("should return the difference between the arrays", () => {
    expect(util.diff.apply(this, [test.arr1, test.arr2])).toEqual(test.output);
  });

  it("should return an empty array", () => {
    test.arr2.push(test.output.shift())
    expect(util.diff.apply(this, [test.arr1, test.arr2])).toEqual(test.output);
  });

});

describe("clean()", () => {
  const test = {
    arguments: [1, 2, 1, "string", 3, 4, 5, "string", 6, 7],
    output: [2, 1, 3, 4, 5, "string", 6, 7]
  };

  it("should return an array without repeated items", () => {
    expect(util.clean.apply(this, [test.arguments])).toEqual(test.output);
  });

  it("should return the same array", () => {
    test.arguments = util.clean.apply(this, [test.arguments])
    expect(test.arguments).toEqual(test.output);
  });

});


// // TODO: Move test below to its respective file
// const parseDataWithZip = (previousParsedPage) => {
//   const keys = Object.keys(previousParsedPage);
//   const values = Object.values(previousParsedPage);
//   const zippedValues = util.zip.apply(this, values);

//   return Array(values[0].length).fill().map((v, idx) => {
//     return keys.reduce((accumulate, current, index) => {
//       accumulate[current] = zippedValues[idx][index];
//       return accumulate;
//     }, {});
//   });
// }


// const parseDataWithZip = (previousParsedPage) => {
//   const keys = Object.keys(previousParsedPage);
//   const values = Object.values(previousParsedPage);
//   const zippedValues = util.zip.apply(this, values);

//   return Array(values[0].length).fill().map((v, idx) => {
//     return keys.reduce((accumulate, current, index) => {
//       accumulate[current] = zippedValues[idx][index];
//       return accumulate;
//     }, {});
//   });
// }

// test.only("yuri sem fe", () => {
//   expect(parseDataWithZip({
//     key1: [1, 2, 3],
//     key2: [4, 5, 6]
//   })).toEqual([{
//     key1: 1,
//     key2: 4
//   }, {
//     key1: 2,
//     key2: 5
//   }, {
//     key1: 3,
//     key2: 6
//   }]);
// });