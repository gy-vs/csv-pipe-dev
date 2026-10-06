import "should";
import { stringify } from "../lib/sync.js";

describe("sync.iterable", function () {
  it("accepts a generator", function () {
    const data = stringify(
      (function* () {
        yield ["a", 1];
        yield ["b", 2];
      })(),
    );
    data.should.eql("a,1\nb,2\n");
  });

  it("accepts a Set", function () {
    const data = stringify(
      new Set([
        ["a", 1],
        ["b", 2],
      ]),
    );
    data.should.eql("a,1\nb,2\n");
  });

  it("accepts Map.values()", function () {
    const map = new Map([
      ["k1", ["a", 1]],
      ["k2", ["b", 2]],
    ]);
    stringify(map.values()).should.eql("a,1\nb,2\n");
  });

  it("passes options", function () {
    const data = stringify(
      (function* () {
        yield ["a", 1];
        yield ["b", 2];
      })(),
      { eof: false },
    );
    data.should.eql("a,1\nb,2");
  });

  it("propagates errors thrown while iterating", function () {
    const source = function* () {
      yield ["a", 1];
      throw new Error("generator failure");
    };
    (() => stringify(source())).should.throw("generator failure");
  });

  it("rejects async iterables with an explicit error", function () {
    const source = async function* () {
      yield ["a", 1];
    };
    (() => stringify(source())).should.throw(
      /async iterables are not supported by the sync API/,
    );
  });

  it("does not split a string into characters", function () {
    (() => stringify("abc")).should.throw(
      /expect an array or a synchronous iterable/,
    );
  });

  it("does not treat a Buffer as a source", function () {
    (() => stringify(Buffer.from("abc"))).should.throw(
      /expect an array or a synchronous iterable/,
    );
  });
});
