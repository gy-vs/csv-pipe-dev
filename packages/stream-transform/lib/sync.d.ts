/// <reference types="node" />

import { Input, Options } from "./index.js";

export type Handler<T = unknown, U = unknown> = (record: T) => U;

export function transform<T = unknown, U = unknown>(
  records: Input<T>,
  handler: Handler<T, U>,
): Array<U>;
export function transform<T = unknown, U = unknown>(
  records: Input<T>,
  options: Options,
  handler: Handler<T, U>,
): Array<U>;

export { Options };
