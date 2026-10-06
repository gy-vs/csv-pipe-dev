import "should";
import { Readable, Writable } from "stream";
import { transform } from "../lib/index.js";

describe("api.iterable", function () {
  describe("sync iterables", function () {
    it("generator + handler + callback", function (next) {
      function* gen() {
        yield 1;
        yield 2;
      }
      transform(
        gen(),
        (record) => record * 2,
        (err, records) => {
          records.should.eql(["2", "4"]);
          next(err);
        },
      );
    });

    it("Set + options + handler + callback", function (next) {
      transform(
        new Set([1, 2, 3]),
        {},
        (record) => record + 10,
        (err, records) => {
          records.should.eql(["11", "12", "13"]);
          next(err);
        },
      );
    });

    it("Map.values()", function (next) {
      const records = new Map([
        ["a", 1],
        ["b", 2],
      ]).values();
      transform(
        records,
        (record) => record,
        (err, result) => {
          result.should.eql(["1", "2"]);
          next(err);
        },
      );
    });
  });

  describe("async iterables", function () {
    it("async generator + callback", function (next) {
      async function* gen() {
        yield 1;
        yield 2;
      }
      transform(
        gen(),
        (record) => record * 2,
        (err, records) => {
          records.should.eql(["2", "4"]);
          next(err);
        },
      );
    });

    it("Node.js Readable", function (next) {
      const records = Readable.from([1, 2], { objectMode: true });
      transform(
        records,
        (record) => record * 3,
        (err, result) => {
          result.should.eql(["3", "6"]);
          next(err);
        },
      );
    });

    it("used as a readable stream", async function () {
      async function* gen() {
        yield 1;
        yield 2;
      }
      const result = [];
      for await (const record of transform(gen(), (record) => record + 1)) {
        result.push(record);
      }
      result.should.eql(["2", "3"]);
    });
  });

  describe("backpressure", function () {
    it("stops pulling when the destination cannot accept more data", function (next) {
      this.timeout(0);
      let pulled = 0;
      async function* gen() {
        for (let i = 0; i < 100000; i++) {
          pulled++;
          yield { index: i, padding: "x".repeat(1000) };
        }
      }
      const transformer = transform(gen(), { parallel: 1 }, (record) => record);
      const destination = new Writable({
        objectMode: true,
        highWaterMark: 2,
        write(chunk, encoding, callback) {
          setImmediate(callback);
        },
      });
      transformer.on("error", next);
      destination.on("error", next);
      transformer.pipe(destination);
      setTimeout(() => {
        pulled.should.be.below(100000);
        transformer.destroy();
        transformer.removeListener("error", next);
        next();
      }, 100);
    });
  });

  describe("source closure", function () {
    it("closes the generator when the stream is destroyed early", function (next) {
      let pulled = 0;
      let closed = false;
      async function* gen() {
        try {
          for (let i = 0; i < 100000; i++) {
            pulled++;
            yield { index: i, padding: "x".repeat(1000) };
          }
        } finally {
          closed = true;
        }
      }
      const transformer = transform(gen(), { parallel: 1 }, (record) => record);
      transformer.on("error", () => {});
      const destination = new Writable({
        objectMode: true,
        highWaterMark: 2,
        write(chunk, encoding, callback) {
          setImmediate(callback);
        },
      });
      transformer.pipe(destination);
      setTimeout(() => transformer.destroy(new Error("cancelled")), 30);
      transformer.on("close", () => {
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
          this.push({ padding: "x".repeat(1000) });
        },
      });
      const transformer = transform(source, (record) => record);
      transformer.on("error", () => {});
      const destination = new Writable({
        objectMode: true,
        highWaterMark: 2,
        write(chunk, encoding, callback) {
          setImmediate(callback);
        },
      });
      transformer.pipe(destination);
      source.on("close", () => {
        transformer.destroyed.should.eql(true);
        next();
      });
      setTimeout(() => transformer.destroy(new Error("cancelled")), 30);
    });
  });

  describe("errors", function () {
    it("propagates sync errors thrown while iterating", function (next) {
      function* gen() {
        yield 1;
        throw new Error("cursor fail");
      }
      transform(
        gen(),
        (record) => record,
        (err) => {
          err.message.should.eql("cursor fail");
          next();
        },
      );
    });

    it("propagates async rejections while iterating", function (next) {
      async function* gen() {
        yield 1;
        await Promise.reject(new Error("cursor reject"));
      }
      transform(
        gen(),
        (record) => record,
        (err) => {
          err.message.should.eql("cursor reject");
          next();
        },
      );
    });

    it("emits the error when used as a stream", function (next) {
      async function* gen() {
        yield 1;
        throw new Error("cursor fail");
      }
      const transformer = transform(gen(), (record) => record);
      transformer.resume();
      transformer.on("error", (err) => {
        err.message.should.eql("cursor fail");
        next();
      });
    });

    it("closes the source after an iteration error", function (next) {
      let closed = false;
      async function* gen() {
        try {
          yield 1;
          throw new Error("cursor fail");
        } finally {
          closed = true;
        }
      }
      transform(
        gen(),
        (record) => record,
        () => {
          closed.should.eql(true);
          next();
        },
      );
    });
  });

  describe("invalid sources", function () {
    it("rejects a string", function () {
      (() =>
        transform(
          "abc",
          (record) => record,
          () => {},
        )).should.throw(/not iterated as records/);
    });

    it("rejects a buffer", function () {
      (() =>
        transform(
          Buffer.from("abc"),
          (record) => record,
          () => {},
        )).should.throw(/not iterated as records/);
    });
  });
});
