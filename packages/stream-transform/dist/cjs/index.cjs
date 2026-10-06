'use strict';

var stream = require('stream');
var util = require('util');

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
  const readable = new stream.Readable({
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

/*
Stream Transform

Please look at the project documentation for
additional information.
*/


const Transformer = function (options = {}, handler) {
  this.options = options;
  if (options.consume === undefined || options.consume === null) {
    this.options.consume = false;
  }
  this.options.objectMode = true;
  if (options.parallel === undefined || options.parallel === null) {
    this.options.parallel = 100;
  }
  if (options.params === undefined || options.params === null) {
    options.params = null;
  }
  this.handler = handler;
  stream.Transform.call(this, this.options);
  this.state = {
    running: 0,
    started: 0,
    finished: 0,
    paused: false,
  };
  return this;
};

util.inherits(Transformer, stream.Transform);

Transformer.prototype._transform = function (chunk, _, cb) {
  this.state.started++;
  this.state.running++;
  // Accept additional chunks to be processed in parallel
  if (!this.state.paused && this.state.running < this.options.parallel) {
    cb();
    cb = null; // Cancel further callback execution
  }
  try {
    let l = this.handler.length;
    if (this.options.params !== null) {
      l--;
    }
    if (l === 1) {
      // sync
      const result = this.handler.call(this, chunk, this.options.params);
      if (result && result.then) {
        result.then((result) => {
          this.__done(null, [result], cb);
        });
        result.catch((err) => {
          this.__done(err);
        });
      } else {
        this.__done(null, [result], cb);
      }
    } else if (l === 2) {
      // async
      const callback = (err, ...chunks) => this.__done(err, chunks, cb);
      this.handler.call(this, chunk, callback, this.options.params);
    } else {
      throw Error("Invalid handler arguments");
    }
    return false;
  } catch (err) {
    this.__done(err);
  }
};
Transformer.prototype._flush = function (cb) {
  if (this.state.running === 0) {
    cb();
  } else {
    this._ending = function () {
      cb();
    };
  }
};
Transformer.prototype.__done = function (err, chunks, cb) {
  this.state.running--;
  if (err) {
    return this.destroy(err);
    // return this.emit('error', err);
  }
  this.state.finished++;
  for (let chunk of chunks) {
    if (typeof chunk === "number") {
      chunk = `${chunk}`;
    }
    // We dont push empty string
    // See https://nodejs.org/api/stream.html#stream_readable_push
    if (chunk !== undefined && chunk !== null && chunk !== "") {
      this.state.paused = !this.push(chunk);
    }
  }
  // Chunk has been processed
  if (cb) {
    cb();
  }
  if (this._ending && this.state.running === 0) {
    this._ending();
  }
};
const transform = function () {
  let options = {};
  let callback, handler, records;
  for (let i = 0; i < arguments.length; i++) {
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
      if (handler && i === arguments.length - 1) {
        callback = argument;
      } else {
        handler = argument;
      }
    } else if (type !== "null") {
      throw new Error(
        `Invalid Arguments: got ${JSON.stringify(argument)} at position ${i}`,
      );
    }
  }
  const transformer = new Transformer(options, handler);
  let error = false;
  if (records) {
    let writer;
    if (Array.isArray(records)) {
      // Preserve the historical eager-write behavior for arrays
      writer = function () {
        for (const record of records) {
          if (error) break;
          transformer.write(record);
        }
        transformer.end();
      };
    } else {
      // Generators and async iterables are pulled on demand with backpressure
      writer = function () {
        pump(records, transformer);
      };
    }
    // Support Deno, Rollup doesn't provide a shim for setImmediate
    if (typeof setImmediate === "function") {
      setImmediate(writer);
    } else {
      setTimeout(writer, 0);
    }
  }
  if (callback || options.consume) {
    const result = [];
    transformer.on("readable", function () {
      let record;
      while ((record = transformer.read()) !== null) {
        if (callback) {
          result.push(record);
        }
      }
    });
    transformer.on("error", function (err) {
      error = true;
      if (callback) callback(err);
    });
    transformer.on("end", function () {
      if (callback && !error) callback(null, result);
    });
  }
  return transformer;
};

exports.Transformer = Transformer;
exports.transform = transform;
