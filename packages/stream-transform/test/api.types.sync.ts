import "should";
import { transform, Options } from "../lib/sync.js";

describe("api.types", function () {
  it("sync", function () {
    // With records + handler
    const transformer: string[] = transform(["record"], (record) => record);
    transformer.should.be.an.Array();
    // With records + options + handler
    transform(["record"], { consume: true }, (record) => record);
  });

  it("infers the record type from a generator", function () {
    function* gen(): Generator<{ v: number }> {
      yield { v: 1 };
    }
    const out: number[] = transform(gen(), (record) => record.v);
    out;
  });

  it("accepts a Set and Map.values()", function () {
    transform(new Set<string>(), (record) => record.length);
    transform(new Map<string, string>().values(), (record) => record.length);
  });

  it("rejects asynchronous iterables", function () {
    async function* gen(): AsyncGenerator<{ v: number }> {
      yield { v: 1 };
    }
    // `@ts-expect-error`: async iterables are not accepted by the sync API.
    // Wrapped so the invalid call is never executed at runtime.
    const typecheck: () => unknown[] = () =>
      // @ts-expect-error async iterables are not accepted by the sync API
      transform(gen(), (record) => record);
    typecheck;
  });

  it("Options", function () {
    (options: Options) => {
      const consume: boolean | undefined = options.consume;
      const parallel: number | undefined = options.parallel;
      const params: number = options.params as number;
      return { consume, parallel, params };
    };
  });
});
