import "should";
import { transform } from "../lib/sync.js";

describe("api.sync", function () {
  it("accept data and handler without options", function () {
    const data = transform(
      [
        ["a", "b", "c"],
        ["1", "2", "3"],
      ],
      function (record) {
        return record.join("|");
      },
    );
    data.should.eql(["a|b|c", "1|2|3"]);
  });

  it("honors params option", function () {
    const data = transform(
      [
        ["a", "b", "c"],
        ["1", "2", "3"],
      ],
      {
        params: { separator: "|" },
      },
      function (record, params) {
        return record.join(params.separator);
      },
    );
    data.should.eql(["a|b|c", "1|2|3"]);
  });

  it("only sync handlers are supported", function () {
    // Without options
    (function () {
      transform(
        [
          ["a", "b", "c"],
          ["1", "2", "3"],
        ],
        function (record, callback) {
          record;
          callback;
        },
      );
    }).should.throw("Invalid Handler: only synchronous handlers are supported");
    // With options
    (function () {
      transform(
        [
          ["a", "b", "c"],
          ["1", "2", "3"],
        ],
        {
          params: { a_key: "a value" },
        },
        function (record, callback, params) {
          record;
          callback;
          params;
        },
      );
    }).should.throw("Invalid Handler: only synchronous handlers are supported");
  });

  it("work on a generator", function () {
    function* gen() {
      yield [1];
      yield [2];
    }
    const data = transform(gen(), function (record) {
      return record[0] * 2;
    });
    data.should.eql(["2", "4"]);
  });

  it("work on a Set", function () {
    const data = transform(
      new Set([[1], [2]]),
      {
        params: { multiplier: 3 },
      },
      function (record, params) {
        return record[0] * params.multiplier;
      },
    );
    data.should.eql(["3", "6"]);
  });

  it("reject an async iterable", function () {
    async function* gen() {
      yield 1;
    }
    (function () {
      transform(gen(), function (record) {
        return record;
      });
    }).should.throw(/does not support async iterables/);
  });

  it("reject a string", function () {
    (function () {
      transform("abc", function (record) {
        return record;
      });
    }).should.throw(/not iterated as records/);
  });

  it("reject a buffer", function () {
    (function () {
      transform(Buffer.from("abc"), function (record) {
        return record;
      });
    }).should.throw(/not iterated as records/);
  });
});
