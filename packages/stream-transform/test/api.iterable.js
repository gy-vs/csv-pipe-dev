import "should";
import { Readable } from "stream";
import { transform } from "../lib/index.js";

const records = function* () {
  yield ["a", 1];
  yield ["b", 2];
};
const arecords = async function* () {
  yield ["a", 1];
  yield ["b", 2];
};

describe("api.iterable", function () {
  describe("callback", function () {
    it("accepts a generator", function (next) {
      transform(
        records(),
        (record) => record.join("|"),
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("accepts an async generator", function (next) {
      transform(
        arecords(),
        (record) => record.join("|"),
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("accepts a Set", function (next) {
      transform(
        new Set([
          ["a", 1],
          ["b", 2],
        ]),
        (record) => record.join("|"),
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("accepts Map.values()", function (next) {
      const map = new Map([
        ["k1", ["a", 1]],
        ["k2", ["b", 2]],
      ]);
      transform(
        map.values(),
        (record) => record.join("|"),
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("accepts a Node.js readable stream", function (next) {
      const source = Readable.from(
        [
          ["a", 1],
          ["b", 2],
        ],
        { objectMode: true },
      );
      transform(
        source,
        (record) => record.join("|"),
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("accepts options between the source and the handler", function (next) {
      transform(
        records(),
        { params: "|" },
        (record, params) => record.join(params),
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("works with asynchronous handlers", function (next) {
      transform(
        arecords(),
        (record, callback) => {
          setImmediate(() => callback(null, record.join("|")));
        },
        (err, output) => {
          output.should.eql(["a|1", "b|2"]);
          next(err);
        },
      );
    });

    it("propagates errors thrown by a sync generator", function (next) {
      const error = new Error("sync source failure");
      const source = function* () {
        yield ["a", 1];
        throw error;
      };
      transform(
        source(),
        (record) => record,
        (err) => {
          err.should.eql(error);
          next();
        },
      );
    });

    it("propagates errors rejected by an async generator", function (next) {
      const error = new Error("async source failure");
      const source = async function* () {
        yield ["a", 1];
        throw error;
      };
      transform(
        source(),
        (record) => record,
        (err) => {
          err.should.eql(error);
          next();
        },
      );
    });

    it("propagates errors rejected by an async handler", function (next) {
      const error = new Error("handler failure");
      transform(
        records(),
        (record) => {
          record;
          return Promise.reject(error);
        },
        (err) => {
          err.should.eql(error);
          next();
        },
      );
    });

    it("does not split a string into characters", function () {
      (() => {
        transform(
          "abc",
          (record) => record,
          () => {},
        );
      }).should.throw(/Invalid Arguments/);
    });

    it("does not treat a Buffer as a source", function () {
      (() => {
        transform(
          Buffer.from("abc"),
          (record) => record,
          () => {},
        );
      }).should.throw(/Invalid Arguments/);
    });
  });

  describe("stream", function () {
    it("is a readable stream without a callback", async function () {
      const transformer = transform(arecords(), (record) => record.join("|"));
      const output = [];
      for await (const record of transformer) {
        output.push(record);
      }
      output.should.eql(["a|1", "b|2"]);
    });

    it("closes the source when destroyed early", function (next) {
      let closed = false;
      const source = async function* () {
        try {
          for (let i = 0; ; i++) {
            yield ["row", i];
          }
        } finally {
          closed = true;
        }
      };
      const transformer = transform(source(), (record) => record);
      let count = 0;
      transformer.on("data", () => {
        count++;
        if (count === 1) {
          transformer.destroy();
        }
      });
      transformer.on("close", () => {
        setImmediate(() => {
          closed.should.be.true();
          next();
        });
      });
      transformer.on("error", () => {});
    });

    it("closes a sync generator when destroyed early", function (next) {
      let closed = false;
      const source = function* () {
        try {
          for (let i = 0; ; i++) {
            yield ["row", i];
          }
        } finally {
          closed = true;
        }
      };
      const transformer = transform(source(), (record) => record);
      let count = 0;
      transformer.on("data", () => {
        count++;
        if (count === 1) {
          transformer.destroy();
        }
      });
      transformer.on("close", () => {
        setImmediate(() => {
          closed.should.be.true();
          next();
        });
      });
      transformer.on("error", () => {});
    });

    it("emits source errors on the error event", function (next) {
      const error = new Error("stream source failure");
      const source = async function* () {
        yield ["a", 1];
        throw error;
      };
      const transformer = transform(source(), (record) => record);
      transformer.resume();
      transformer.on("error", (err) => {
        err.should.eql(error);
        next();
      });
    });

    it("stops pulling after a handler error", function (next) {
      let pulls = 0;
      const error = new Error("handler boom");
      const source = async function* () {
        yield ["a", 1];
        await new Promise((resolve) => setImmediate(resolve));
        yield ["b", 2];
        for (let i = 0; ; i++) {
          pulls++;
          yield ["c", i];
        }
      };
      const transformer = transform(
        source(),
        { parallel: 1 },
        (record, callback) => {
          setImmediate(() => callback(error));
        },
      );
      transformer.resume();
      transformer.on("error", () => {
        // At most one record may already have been prefetched; the count
        // must then stay bounded instead of draining the generator.
        const prefetched = pulls;
        prefetched.should.be.belowOrEqual(1);
        setTimeout(() => {
          pulls.should.eql(prefetched);
          next();
        }, 50);
      });
    });

    it("respects backpressure", function (next) {
      this.timeout(4000);
      let pulls = 0;
      const source = async function* () {
        for (let i = 0; i < 1_000_000; i++) {
          pulls++;
          yield ["record", i];
        }
      };
      // The default `parallel` (100) bounds how many records may be
      // prefetched; with no consumer the generator must not be drained.
      const transformer = transform(
        source(),
        { highWaterMark: 1 },
        function (record, callback) {
          setImmediate(() => callback(null, record));
        },
      );
      setTimeout(() => {
        transformer.destroy();
        transformer.on("error", () => {});
        transformer.on("close", () => {
          (pulls <= 200).should.be.true();
          next();
        });
      }, 200);
    });

    it("bounds prefetch to the parallel option", function (next) {
      this.timeout(4000);
      let pulls = 0;
      let active = 0;
      let max_active = 0;
      const source = async function* () {
        for (let i = 0; i < 1_000_000; i++) {
          pulls++;
          yield ["record", i];
        }
      };
      const transformer = transform(
        source(),
        { parallel: 2, highWaterMark: 1, readableHighWaterMark: 1 },
        function (record, callback) {
          active++;
          max_active = Math.max(max_active, active);
          setTimeout(() => {
            active--;
            callback(null, record);
          }, 10);
        },
      );
      setTimeout(() => {
        transformer.destroy();
        transformer.on("error", () => {});
        transformer.on("close", () => {
          // At most the source high water mark plus `parallel` records may
          // be buffered/in flight; the generator is never drained.
          (pulls <= 30).should.be.true();
          (max_active <= 2).should.be.true();
          next();
        });
      }, 200);
    });
  });
});
