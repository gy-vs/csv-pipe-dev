import "should";
import { Readable } from "stream";
import { stringify } from "../lib/index.js";

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
      stringify(records(), (err, output) => {
        output.should.eql("a,1\nb,2\n");
        next(err);
      });
    });

    it("accepts an async generator", function (next) {
      stringify(arecords(), (err, output) => {
        output.should.eql("a,1\nb,2\n");
        next(err);
      });
    });

    it("accepts a Set", function (next) {
      stringify(
        new Set([
          ["a", 1],
          ["b", 2],
        ]),
        (err, output) => {
          output.should.eql("a,1\nb,2\n");
          next(err);
        },
      );
    });

    it("accepts Map.values()", function (next) {
      const map = new Map([
        ["k1", ["a", 1]],
        ["k2", ["b", 2]],
      ]);
      stringify(map.values(), (err, output) => {
        output.should.eql("a,1\nb,2\n");
        next(err);
      });
    });

    it("accepts a Node.js readable stream", function (next) {
      const source = Readable.from(
        [
          ["a", 1],
          ["b", 2],
        ],
        { objectMode: true },
      );
      stringify(source, (err, output) => {
        output.should.eql("a,1\nb,2\n");
        next(err);
      });
    });

    it("accepts options after the source", function (next) {
      stringify(records(), { eof: false }, (err, output) => {
        output.should.eql("a,1\nb,2");
        next(err);
      });
    });

    it("propagates errors thrown by a sync generator", function (next) {
      const error = new Error("sync source failure");
      const source = function* () {
        yield ["a", 1];
        throw error;
      };
      stringify(source(), (err) => {
        err.should.eql(error);
        next();
      });
    });

    it("propagates errors rejected by an async generator", function (next) {
      const error = new Error("async source failure");
      const source = async function* () {
        yield ["a", 1];
        throw error;
      };
      stringify(source(), (err) => {
        err.should.eql(error);
        next();
      });
    });

    it("does not split a string into characters", function () {
      (() => {
        stringify("abc", () => {});
      }).should.throw(/Invalid argument/);
    });

    it("does not treat a Buffer as a source", function () {
      (() => {
        stringify(Buffer.from("abc"), () => {});
      }).should.throw(/Invalid argument/);
    });
  });

  describe("stream", function () {
    it("is a readable stream without a callback", async function () {
      const stringifier = stringify(arecords());
      let output = "";
      for await (const chunk of stringifier) {
        output += chunk;
      }
      output.should.eql("a,1\nb,2\n");
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
      const stringifier = stringify(source());
      let count = 0;
      stringifier.on("data", () => {
        count++;
        if (count === 1) {
          stringifier.destroy();
        }
      });
      stringifier.on("close", () => {
        // The iterator `return` settles on the following microtask.
        setImmediate(() => {
          closed.should.be.true();
          next();
        });
      });
      stringifier.on("error", () => {});
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
      const stringifier = stringify(source());
      let count = 0;
      stringifier.on("data", () => {
        count++;
        if (count === 1) {
          stringifier.destroy();
        }
      });
      stringifier.on("close", () => {
        // The iterator `return` settles on the following microtask.
        setImmediate(() => {
          closed.should.be.true();
          next();
        });
      });
      stringifier.on("error", () => {});
    });

    it("emits source errors on the error event", function (next) {
      const error = new Error("stream source failure");
      const source = async function* () {
        yield ["a", 1];
        throw error;
      };
      const stringifier = stringify(source());
      stringifier.resume();
      stringifier.on("error", (err) => {
        err.should.eql(error);
        next();
      });
    });

    it("stops pulling from the source after an error", function (next) {
      let pulls = 0;
      const source = async function* () {
        yield ["a", 1];
        await new Promise((resolve) => setImmediate(resolve));
        yield true; // Invalid record
        for (let i = 0; ; i++) {
          pulls++;
          yield ["b", i];
        }
      };
      const stringifier = stringify(source());
      stringifier.resume();
      stringifier.on("error", () => {
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
      // A tiny output buffer and no consumer of the stringifier: the
      // generator must not be drained into memory.
      const stringifier = stringify(source(), {
        readableHighWaterMark: 1,
        writableHighWaterMark: 1,
      });
      setTimeout(() => {
        stringifier.destroy();
        stringifier.on("error", () => {});
        stringifier.on("close", () => {
          (pulls < 100).should.be.true();
          next();
        });
      }, 200);
    });
  });
});
