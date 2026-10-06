/*
Stream Transform - sync module

Please look at the project documentation for
additional information.
*/

import { Transformer } from "./index.js";
import { is_async_iterable, is_sync_iterable } from "./utils/is_records.js";

// The sync API only consumes sync iterables. Strings, buffers and async
// iterables are rejected during argument normalization; this only covers the
// missing records argument which would otherwise fail with the cryptic
// "records is not iterable" error.
const assert_sync_records = function (records) {
  if (!is_sync_iterable(records)) {
    throw new Error("Invalid Arguments: records must be a sync iterable");
  }
};

const transform = function () {
  // Import arguments normalization
  let handler, records;
  let options = {};
  for (const i in arguments) {
    const argument = arguments[i];
    let type = typeof argument;
    if (argument === null) {
      type = "null";
    } else if (type === "object" && Array.isArray(argument)) {
      type = "array";
    } else if (type === "object" && Buffer.isBuffer(argument)) {
      type = "buffer";
    }
    if (type === "array" || (type === "object" && is_sync_iterable(argument))) {
      records = argument;
    } else if (
      type === "object" &&
      is_async_iterable(argument) &&
      !is_sync_iterable(argument)
    ) {
      throw new Error(
        `Invalid Arguments: got an async iterable at position ${i}, the sync API does not support async iterables`,
      );
    } else if (type === "string" || type === "buffer") {
      throw new Error(
        `Invalid Arguments: got a ${type} at position ${i}, strings and buffers are not iterated as records`,
      );
    } else if (type === "object") {
      options = { ...argument };
    } else if (type === "function") {
      handler = argument;
    } else if (type !== "null") {
      throw new Error(
        `Invalid Arguments: got ${JSON.stringify(argument)} at position ${i}`,
      );
    }
  }
  // Validate arguments
  assert_sync_records(records);
  let expected_handler_length = 1;
  if (options.params) {
    expected_handler_length++;
  }
  if (handler.length > expected_handler_length) {
    throw Error("Invalid Handler: only synchronous handlers are supported");
  }
  // Start transformation
  const chunks = [];
  const transformer = new Transformer(options, handler);
  transformer.push = function (chunk) {
    chunks.push(chunk);
  };
  for (const record of records) {
    transformer._transform(record, null, function () {});
  }
  return chunks;
};

export { transform };
