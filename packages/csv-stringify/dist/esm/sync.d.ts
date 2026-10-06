import { Options } from "./index.js";

/**
 * Source of records accepted by the sync API: arrays and synchronous
 * iterables (generators, `Set`, `Map.values()`, ...).
 */
export type SyncInput = ReadonlyArray<unknown> | Iterable<unknown>;

declare function stringify(
  input: ReadonlyArray<unknown> | Iterable<unknown>,
  options?: Options,
): string;

export { stringify };

export {
  RecordDelimiter,
  Cast,
  PlainObject,
  Input,
  ColumnOption,
  CastingContext,
  Options,
  OptionsNormalized,
} from "./index.js";
