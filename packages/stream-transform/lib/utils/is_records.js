// True when `value` is a synchronous iterable source of records.
// Strings and Buffers are iterable but must not be treated as a record
// source, otherwise they would be consumed one character (or one byte) at
// a time.
const is_sync_iterable = function (value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Buffer.isBuffer(value) &&
    typeof value[Symbol.iterator] === "function"
  );
};

// True when `value` is an asynchronous iterable source of records, such as
// an async generator or a Node.js readable stream. Buffers are iterable
// but excluded.
const is_async_iterable = function (value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Buffer.isBuffer(value) &&
    typeof value[Symbol.asyncIterator] === "function"
  );
};

// True when `value` can be used as the records argument, synchronously or
// asynchronously. Async iterables take precedence over sync ones since
// async generators (and Node.js streams) may expose both protocols.
const is_records = function (value) {
  return is_async_iterable(value) || is_sync_iterable(value);
};

export { is_sync_iterable, is_async_iterable, is_records };
