import { stringifier } from "./api/index.js";
import { CsvError } from "./api/CsvError.js";
import { normalize_options } from "./api/normalize_options.js";
import { is_async_iterable, is_sync_iterable } from "./utils/is_records.js";

// The sync API only consumes sync iterables; async sources would otherwise be
// silently ignored and yield an empty output.
const assert_sync_records = function (records) {
  if (typeof records === "string" || Buffer.isBuffer(records)) {
    throw new CsvError("CSV_INVALID_ARGUMENT", [
      "Invalid argument:",
      "strings and buffers are not iterated as records",
    ]);
  }
  if (is_async_iterable(records) && !is_sync_iterable(records)) {
    throw new CsvError("CSV_INVALID_ARGUMENT", [
      "Invalid argument:",
      "the sync API does not support async iterables",
    ]);
  }
  if (records != null && !is_sync_iterable(records)) {
    throw new CsvError("CSV_INVALID_ARGUMENT", [
      "Invalid argument:",
      "records must be a sync iterable",
    ]);
  }
};

const stringify = function (records, opts = {}) {
  assert_sync_records(records);
  const data = [];
  const [err, options] = normalize_options(opts);
  if (err !== undefined) throw err;
  const state = {
    stop: false,
  };
  // Information
  const info = {
    records: 0,
  };
  const api = stringifier(options, state, info);
  for (const record of records) {
    const err = api.__transform(record, function (record) {
      data.push(record);
    });
    if (err !== undefined) throw err;
  }
  if (data.length === 0) {
    api.bom((d) => {
      data.push(d);
    });
    const err = api.headers((headers) => {
      data.push(headers);
    });
    if (err !== undefined) throw err;
  }
  return data.join("");
};

export { stringify };
