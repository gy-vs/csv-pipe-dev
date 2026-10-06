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

    it("accept iterable sources and infer the handler record type", function () {
      type Row = { value: number };
      // Sync generator
      const generator = function* (): Generator<Row> {
        yield { value: 1 };
      };
      transform(
        generator(),
        (record) => {
          const value: number = record.value;
          return { doubled: value * 2 };
        },
        (err, records) => err || records,
      );
      // Set
      transform(new Set<Row>([{ value: 1 }]), (record) => record.value);
      // Map.values()
      const records: IterableIterator<Row> = new Map<string, Row>([
        ["a", { value: 1 }],
      ]).values();
      transform(records, { consume: true }, (record) => record.value);
      // Async generator
      const asyncGenerator = async function* (): AsyncGenerator<Row> {
        yield { value: 1 };
      };
      transform(
        asyncGenerator(),
        (record) => {
          const value: number = record.value;
          return value;
        },
        (err, result) => err || result,
      );
      // Node.js Readable
      const readable: Readable = Readable.from([{ value: 1 }] as Row[], {
        objectMode: true,
      });
      transform(readable, (record) => record.value);
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
