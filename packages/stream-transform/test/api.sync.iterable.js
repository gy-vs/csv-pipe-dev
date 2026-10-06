import "should";
import { transform } from "../lib/sync.js";

describe("api.sync.iterable", function () {
  it("accepts a generator", function () {
    const data = transform(
      (function* () {
        yield ["a", 1];
        yield ["b", 2];
      })(),
      (record) => record.join("|"),
    );
    data.should.eql(["a|1", "b|2"]);
  });

  it("accepts a Set", function () {
    const data = transform(
      new Set([
        ["a", 1],
        ["b", 2],
      ]),
      (record) => record.join("|"),
    );
    data.should.eql(["a|1", "b|2"]);
  });

  it("accepts Map.values()", function () {
    const map = new Map([
      ["k1", ["a", 1]],
      ["k2", ["b", 2]],
    ]);
    transform(map.values(), (record) => record.join("|")).should.eql([
      "a|1",
      "b|2",
    ]);
  });

  it("accepts options", function () {
    const data = transform(
      (function* () {
        yield ["a", "b"];
        yield ["1", "2"];
      })(),
      { params: { separator: "|" } },
      (record, params) => record.join(params.separator),
    );
    data.should.eql(["a|b", "1|2"]);
  });

  it("propagates errors thrown while iterating", function () {
    const source = function* () {
      yield ["a", 1];
      throw new Error("generator failure");
    };
    (() => transform(source(), (record) => record)).should.throw(
      "generator failure",
    );
  });

  it("rejects async iterables with an explicit error", function () {
    const source = async function* () {
      yield ["a", 1];
    };
    (() => transform(source(), (record) => record)).should.throw(
      /async iterables are not supported by the sync API/,
    );
  });

  it("does not split a string into characters", function () {
    (() => transform("abc", (record) => record)).should.throw(
      /Invalid Arguments/,
    );
  });

  it("does not treat a Buffer as a source", function () {
    (() => transform(Buffer.from("abc"), (record) => record)).should.throw(
      /Invalid Arguments/,
    );
  });
});
