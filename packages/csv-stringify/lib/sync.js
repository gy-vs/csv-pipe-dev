import { stringifier } from "./api/index.js";
import { normalize_options } from "./api/normalize_options.js";
import { is_async_iterable, is_sync_iterable } from "./utils/is_records.js";

const stringify = function (records, opts = {}) {
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
