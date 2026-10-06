import "should";
import { Readable } from "stream";
import { transform, Options, Transformer } from "../lib/index.js";

describe("api.types", function () {
  describe("Initialisation", function () {
    it("stream", function () {
      // With handler
      const transformer: Transformer = transform((record) => record);
      transformer.should.be.an.Object();
      // With handler + callback
      transform(
        (record) => record,
        (err, records) => err || records,
      );
      // With records + handler
      transform(["record"], (record) => record);
      // With options + handler
      transform({ consume: true }, (record) => record);
      // With records + options + handler
      transform(["record"], { consume: true }, (record) => record);
      // With records + options + handler + callback
      transform(
        ["record"],
        { consume: true },
        (record) => record,
        (err, records) => err || records,
      );
    });
  });

  describe("Iterable sources", function () {
    type Row = { v: number };

    it("infers the record type from a generator", function () {
      function* gen(): Generator<Row> {
        yield { v: 1 };
      }
      transform(gen(), (record) => {
        const value: number = record.v;
        return value;
      });
    });

    it("infers the record type from a Set", function () {
      transform(new Set<Row>(), (record) => record.v);
    });

    it("infers the record type from Map.values()", function () {
      transform(new Map<string, Row>().values(), (record) => record.v);
    });

    it("infers the record type from an async generator", function () {
      async function* gen(): AsyncGenerator<Row> {
        yield { v: 1 };
      }
      transform(gen(), (record) => {
        const value: number = record.v;
        return value;
      });
    });

    it("accepts a Node.js readable stream", function () {
      const source: Readable = new Readable({ objectMode: true, read() {} });
      transform(source, (record: unknown) => record);
    });

    it("accepts options after an iterable source", function () {
      function* gen(): Generator<Row> {
        yield { v: 1 };
      }
      transform(gen(), { params: { factor: 2 } }, (record, callback, params) =>
        callback(null, record.v * (params as { factor: number }).factor),
      );
    });
  });

  describe("Parser", function () {
    it("Expose options", function () {
      const transformer: Transformer = transform((record) => record);
      const options: Options = transformer.options;
      const keys = Object.keys(options);
      keys.sort().should.eql(["consume", "objectMode", "parallel", "params"]);
    });
  });

  describe("Options", function () {
    it("consume", function () {
      const options: Options = {};
      options.consume = true;
    });

    it("parallel", function () {
      const options: Options = {};
      options.parallel = 100;
    });

    it("params", function () {
      const options: Options = {};
      options.params = { my_key: "my value" };
    });
  });

  describe("State", function () {
    it("finished", function () {
      const transformer: Transformer = transform((record) => record);
      const finished: number = transformer.state.finished;
      finished.should.eql(0);
    });

    it("running", function () {
      const transformer: Transformer = transform((record) => record);
      const running: number = transformer.state.running;
      running.should.eql(0);
    });

    it("started", function () {
      const transformer: Transformer = transform((record) => record);
      const started: number = transformer.state.started;
      started.should.eql(0);
    });
  });
});
