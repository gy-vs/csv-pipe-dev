import "should";
import { Readable, Writable } from "stream";
import { stringify } from "../lib/index.js";

describe("api.iterable", function () {
  describe("sync iterables", function () {
    it("generator + callback", function (next) {
      function* gen() {
        yield ["a", 1];
        yield ["b", 2];
      }
      stringify(gen(), (err, data) => {
        data.should.eql("a,1\nb,2\n");
        next(err);
      });
    });

    it("Set + options + callback", function (next) {
      stringify(
        new Set([
          ["a", 1],
          ["b", 2],
        ]),
        { eof: false },
        (err, data) => {
          data.should.eql("a,1\nb,2");
          next(err);
        },
      );
    });

    it("Map.values()", function (next) {
      const records = new Map([
        ["a", ["x", 1]],
        ["b", ["y", 2]],
      ]).values();
      stringify(records, (err, data) => {
        data.should.eql("x,1\ny,2\n");
        next(err);
      });
    });

    it("readable stream", function (next) {
      const records = Readable.from(
        [
          ["a", 1],
          ["b", 2],
        ],
        { objectMode: true },
      );
      stringify(records, (err, data) => {
        data.should.eql("a,1\nb,2\n");
        next(err);
      });
    });
  });

  describe("async iterables", function () {
    it("async generator + callback", function (next) {
      async function* gen() {
        yield ["a", 1];
        yield ["b", 2];
      }
      stringify(gen(), (err, data) => {
        data.should.eql("a,1\nb,2\n");
        next(err);
      });
    });

    it("async generator as a readable stream", async function () {
      async function* gen() {
        yield ["a", 1];
        yield ["b", 2];
      }
      let data = "";
      for await (const chunk of stringify(gen())) {
        data += chunk;
      }
      data.should.eql("a,1\nb,2\n");
    });

    it("sync generator as a readable stream", async function () {
      function* gen() {
        yield ["a", 1];
        yield ["b", 2];
      }
      let data = "";
      for await (const chunk of stringify(gen())) {
        data += chunk;
      }
      data.should.eql("a,1\nb,2\n");
    });
  });

  describe("backpressure", function () {
    it("stops pulling when the destination cannot accept more data", function (next) {
      this.timeout(0);
      let pulled = 0;
      const record = ["x".repeat(10000)];
      async function* gen() {
        for (let i = 0; i < 100000; i++) {
          pulled++;
          yield record;
        }
      }
      const stringifier = stringify(gen());
      const destination = new Writable({
        highWaterMark: 16,
        write(chunk, encoding, callback) {
          setImmediate(callback);
        },
      });
      stringifier.on("error", next);
      destination.on("error", next);
      stringifier.pipe(destination);
      // While the slow destination backs up, the source must not be drained.
      setTimeout(() => {
        pulled.should.be.below(100000);
        stringifier.destroy();
        stringifier.removeListener("error", next);
        next();
      }, 100);
    });
  });

  describe("source closure", function () {
    it("closes the generator when the stream is destroyed early", function (next) {
      let pulled = 0;
      let closed = false;
      const record = ["x".repeat(10000)];
      async function* gen() {
        try {
          for (let i = 0; i < 100000; i++) {
            pulled++;
            yield record;
          }
        } finally {
          closed = true;
        }
      }
      const stringifier = stringify(gen());
      stringifier.on("error", () => {});
      const destination = new Writable({
        highWaterMark: 16,
        write(chunk, encoding, callback) {
          setImmediate(callback);
        },
      });
      stringifier.pipe(destination);
      // Destroy while the slow destination keeps backpressure active.
      setTimeout(() => stringifier.destroy(new Error("cancelled")), 30);
      stringifier.on("close", () => {
        setImmediate(() => {
          closed.should.eql(true);
          pulled.should.be.below(100000);
          next();
        });
      });
    });

    it("destroys the source Readable when the stream is destroyed early", function (next) {
      const source = new Readable({
        objectMode: true,
        highWaterMark: 1,
        read() {
          this.push(["x".repeat(10000)]);
        },
      });
      const stringifier = stringify(source);
      stringifier.on("error", () => {});
      const destination = new Writable({
        highWaterMark: 16,
        write(chunk, encoding, callback) {
          setImmediate(callback);
        },
      });
      stringifier.pipe(destination);
      source.on("close", () => {
        stringifier.destroyed.should.eql(true);
        next();
      });
      setTimeout(() => stringifier.destroy(new Error("cancelled")), 30);
    });
  });

  describe("errors", function () {
    it("propagates sync errors thrown while iterating", function (next) {
      function* gen() {
        yield ["a", 1];
        throw new Error("cursor fail");
      }
      stringify(gen(), (err) => {
        err.message.should.eql("cursor fail");
        next();
      });
    });

    it("propagates async rejections while iterating", function (next) {
      async function* gen() {
        yield ["a", 1];
        await Promise.reject(new Error("cursor reject"));
      }
      stringify(gen(), (err) => {
        err.message.should.eql("cursor reject");
        next();
      });
    });

    it("emits the error when used as a stream", function (next) {
      async function* gen() {
        yield ["a", 1];
        throw new Error("cursor fail");
      }
      const stringifier = stringify(gen());
      stringifier.resume();
      stringifier.on("error", (err) => {
        err.message.should.eql("cursor fail");
        next();
      });
    });

    it("closes the source after an iteration error", function (next) {
      let closed = false;
      async function* gen() {
        try {
          yield ["a", 1];
          throw new Error("cursor fail");
        } finally {
          closed = true;
        }
      }
      stringify(gen(), () => {
        closed.should.eql(true);
        next();
      });
    });
  });

  describe("invalid sources", function () {
    it("rejects a string", function () {
      (() => stringify("abc", () => {})).should.throw(/Invalid argument/);
    });

    it("rejects a buffer", function () {
      (() => stringify(Buffer.from("abc"), () => {})).should.throw(
        /Invalid argument/,
      );
    });
  });
});
