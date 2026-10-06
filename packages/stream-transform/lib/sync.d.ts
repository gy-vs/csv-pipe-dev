/// <reference types="node" />

import { Options } from "./index.js";

export type Handler<T = unknown, U = unknown> = (record: T) => U;

export function transform<T, U = unknown>(
  records: ReadonlyArray<T> | Iterable<T>,
  handler: Handler<T, U>,
): Array<U>;
export function transform<T, U = unknown>(
  records: ReadonlyArray<T> | Iterable<T>,
  options: Options,
  handler: Handler<T, U>,
): Array<U>;

export { Options };
