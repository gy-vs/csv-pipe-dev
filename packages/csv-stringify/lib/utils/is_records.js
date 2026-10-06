// Detect records sources as opposed to option objects.
// Arrays and any object implementing the sync or async iterator protocol are
// treated as sources. Strings and Buffers, although iterable, are excluded so
// they are not split character by character.

const is_sync_iterable = function (value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Buffer.isBuffer(value) &&
    typeof value[Symbol.iterator] === "function"
  );
};

const is_async_iterable = function (value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Buffer.isBuffer(value) &&
    typeof value[Symbol.asyncIterator] === "function"
  );
};

// Async iterables also expose a sync iterator in Node.js (Readable),
// they must be consumed asynchronously.
const is_records = function (value) {
  return (
    Array.isArray(value) || is_async_iterable(value) || is_sync_iterable(value)
  );
};

export { is_sync_iterable, is_async_iterable, is_records };
