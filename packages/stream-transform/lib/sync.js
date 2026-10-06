/*
Stream Transform - sync module

Please look at the project documentation for
additional information.
*/

import { Transformer } from "./index.js";
import {
  is_async_iterable,
  is_records,
  is_sync_iterable,
} from "./utils/is_records.js";

const transform = function () {
  // Import arguments normalization
  let handler, records;
  let options = {};
  for (const i in arguments) {
    const argument = arguments[i];
    let type = typeof argument;
    if (argument === null) {
      type = "null";
    } else if (is_records(argument)) {
      type = "records";
    }
    if (type === "records") {
      records = argument;
    } else if (type === "object" && !Buffer.isBuffer(argument)) {
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
  if (!is_sync_iterable(records)) {
    if (is_async_iterable(records)) {
      throw Error(
        "Invalid Records: async iterables are not supported by the sync API, use the callback or stream API instead",
      );
    }
    throw Error(
      "Invalid Records: expect an array or a synchronous iterable of records",
    );
  }
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
