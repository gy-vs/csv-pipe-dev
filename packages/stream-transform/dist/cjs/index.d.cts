/// <reference types="node" />

import * as stream from "stream";

export type Handler<T = unknown, U = unknown> = (
  record: T,
  callback: HandlerCallback,
  params?: unknown,
) => U;
export type HandlerCallback<T = unknown> = (
  err?: null | Error,
  record?: T,
) => void;
export type Callback = (err?: null | Error, output?: string) => void;

/**
 * Source of records: arrays, synchronous iterables (generators, `Set`,
 * `Map.values()`, ...) and asynchronous iterables (async generators,
 * Node.cjs readable streams).
 */
export type Records<T> = ReadonlyArray<T> | Iterable<T> | AsyncIterable<T>;

export interface Options extends stream.TransformOptions {
  /**
   * In the absence of a consumer, like a `stream.Readable`, trigger the consumption of the stream.
   */
  consume?: boolean;
  /**
   * The number of transformation callbacks to run in parallel; only apply with asynchronous handlers; default to "100".
   */
  parallel?: number;
  /**
   * Pass user defined parameters to the user handler as last argument.
   */
  params?: unknown;
}
export interface State {
  finished: number;
  running: number;
  started: number;
}
export class Transformer extends stream.Transform {
  constructor(options: Options);
  readonly options: Options;
  readonly state: State;
}

declare function transform<U = unknown>(
  handler: Handler<unknown, U>,
  callback?: Callback,
): Transformer;
declare function transform<T, U = unknown>(
  records: ReadonlyArray<T> | Iterable<T>,
  handler: Handler<Awaited<T>, U>,
  callback?: Callback,
): Transformer;
declare function transform<T, U = unknown>(
  records: AsyncIterable<Awaited<T>>,
  handler: Handler<Awaited<T>, U>,
  callback?: Callback,
): Transformer;
declare function transform<U = unknown>(
  options: Options,
  handler: Handler<unknown, U>,
  callback?: Callback,
): Transformer;
declare function transform<T, U = unknown>(
  records: ReadonlyArray<T> | Iterable<T>,
  options: Options,
  handler: Handler<Awaited<T>, U>,
  callback?: Callback,
): Transformer;
declare function transform<T, U = unknown>(
  records: AsyncIterable<Awaited<T>>,
  options: Options,
  handler: Handler<Awaited<T>, U>,
  callback?: Callback,
): Transformer;

export default transform;
export { transform };
