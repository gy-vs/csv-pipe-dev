import "should";
import {
  stringify,
  RecordDelimiter,
  Cast,
  PlainObject,
  Input,
  ColumnOption,
  CastingContext,
  Options,
} from "../lib/sync.js";

describe("API Types", function () {
  it("stringify return string", function () {
    const input: Input = [[1, 2, 3]];
    const stringifier: string = stringify(input);
    stringifier;
  });

  it("accepts synchronous iterables", function () {
    function* gen() {
      yield ["a", 1];
      yield ["b", 2];
    }
    const from_gen: string = stringify(gen());
    const from_set: string = stringify(new Set([["a", 1]]));
    const from_values: string = stringify(
      new Map<string, unknown[]>().values(),
    );
    const with_options: string = stringify(gen(), { eof: false });
    from_gen;
    from_set;
    from_values;
    with_options;
  });

  it("rejects asynchronous iterables", function () {
    async function* agen() {
      yield ["a", 1];
    }
    // `@ts-expect-error`: async iterables are not accepted by the sync API.
    // Wrapped so the invalid call is never executed at runtime.
    const typecheck: () => string = () =>
      // @ts-expect-error async iterables are not accepted by the sync API
      stringify(agen());
    typecheck;
  });

  it("Options", function () {
    (options: Options) => {
      const rd: RecordDelimiter | undefined = options.record_delimiter;
      const cast = options.cast;
      const castBoolean: Cast<boolean> | undefined = cast?.boolean;
      const columns:
        ReadonlyArray<string | ColumnOption> | PlainObject<string> | undefined =
        options.columns;
      return [rd, castBoolean, columns];
    };
  });

  it("CastingContext", function () {
    const options: Options = {
      cast: {
        boolean: (value: boolean, context: CastingContext) => {
          return `${value} ${context.index}`;
        },
      },
    };
    return options;
  });

  it("allows cast to return an object", function () {
    const options: Options = {
      cast: {
        boolean: (value: boolean) => ({
          value: value.toString(),
          delimiter: ";",
          quote: false,
        }),
      },
    };
    options;
  });
});
