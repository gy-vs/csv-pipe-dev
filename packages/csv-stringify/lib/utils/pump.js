import { Readable } from "stream";
import { is_async_iterable } from "./is_records.js";

// Adapt any records argument (array, sync or async iterable, including a
// Node.js readable stream) into an object mode readable stream. Only the
// Readable constructor, `push` and `pipe` are used so the code also runs on
// older stream implementations such as the browser polyfill which does not
// provide `Readable.from` nor `stream.pipeline`.
const from_iterable = function (records) {
  const is_async = is_async_iterable(records);
  const iterator = is_async
    ? records[Symbol.asyncIterator]()
    : records[Symbol.iterator]();
  let pulling = false;
  let ended = false;
  const readable = new Readable({
    objectMode: true,
    read: function () {
      // One pull per `read` request is enough: when `push` returns false
      // (buffer full), the stream stops calling `read` until it drains,
      // which honors backpressure. An in-flight async pull guards against
      // overlapping requests.
      if (pulling || ended) return;
      pulling = true;
      const done = function () {
        ended = true;
        readable.push(null);
      };
      const next = function (value) {
        pulling = false;
        readable.push(value);
      };
      const fail = function (err) {
        pulling = false;
        ended = true;
        if (readable.destroy !== undefined) {
          readable.destroy(err);
        } else {
          readable.emit("error", err);
        }
      };
      try {
        if (is_async) {
          iterator
            .next()
            .then(
              (result) => (result.done ? done() : next(result.value)),
              fail,
            );
        } else {
          const result = iterator.next();
          if (result.done) done();
          else next(result.value);
        }
      } catch (err) {
        fail(err);
      }
    },
  });
  // Closing the readable (destination destroyed, or iteration completed)
  // must release the source the same way `break` in a `for await` loop
  // triggers `return` on the iterator, releasing server-side cursors.
  const close = function () {
    if (ended || typeof iterator.return !== "function") return;
    ended = true;
    try {
      const returned = iterator.return();
      if (returned && typeof returned.then === "function") {
        returned.then(undefined, () => {});
      }
    } catch {
      // Ignore cleanup errors.
    }
  };
  readable.on("end", close);
  readable.on("close", close);
  return readable;
};

// Pull records from `records` into `destination` while honoring
// backpressure. Errors raised while iterating the source are forwarded to
// `destination` (hence to its callback or "error" event) with their
// original identity, and destroying `destination` closes the source.
const pump = function (records, destination) {
  const source = from_iterable(records);
  // `pipe` propagates backpressure and source "end"; source errors are not
  // forwarded by `pipe`, so wire them explicitly in both directions.
  const destroy_source = function () {
    if (typeof source.destroy === "function") source.destroy();
  };
  source.on("error", function (err) {
    if (typeof destination.destroy === "function") {
      destination.destroy(err);
    } else {
      destination.emit("error", err);
    }
  });
  destination.on("error", destroy_source);
  destination.on("close", destroy_source);
  source.pipe(destination);
};

export { pump, from_iterable };
