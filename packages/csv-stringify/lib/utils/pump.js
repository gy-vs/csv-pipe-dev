// Pump a sync or async iterable into a writable stream.
//
// Records are pulled only when the destination can accept them, so the source
// (e.g. a database cursor) never buffers the whole dataset in memory. When the
// destination errors or is destroyed before the source is exhausted, the
// iterable is closed with `return`, mirroring a `break` statement inside a
// `for await ... of` loop so underlying resources can be released.

const observe = function (promise) {
  // Observe rejections of promises lost by `Promise.race`.
  promise.then(
    () => {},
    () => {},
  );
  return promise;
};

const pump = async function (destination, source) {
  const is_async = source[Symbol.asyncIterator] !== undefined;
  const iterator = is_async
    ? source[Symbol.asyncIterator]()
    : source[Symbol.iterator]();
  // Mirrors IteratorClose: `return` is absent for one-shot iterators.
  const close = async function () {
    if (typeof iterator.return === "function") {
      try {
        await iterator.return();
      } catch (err) {
        return err;
      }
    }
  };
  const wait_drain_or_close = function () {
    return new Promise((resolve) => {
      const on_drain = function () {
        destination.removeListener("close", on_close);
        resolve();
      };
      const on_close = function () {
        destination.removeListener("drain", on_drain);
        resolve();
      };
      destination.once("drain", on_drain);
      destination.once("close", on_close);
    });
  };
  try {
    while (true) {
      if (destination.destroyed) {
        await close();
        return;
      }
      let result;
      if (is_async) {
        const next = iterator.next();
        let on_close;
        const closed = new Promise((resolve) => {
          on_close = () => resolve(true);
          destination.once("close", on_close);
        });
        const winner = await Promise.race([
          next.then(
            (result) => ({ result }),
            (err) => ({ err }),
          ),
          closed.then(() => ({ closed: true })),
        ]);
        destination.removeListener("close", on_close);
        if ("closed" in winner) {
          observe(next);
          await close();
          return;
        }
        if ("err" in winner) {
          throw winner.err;
        }
        result = winner.result;
      } else {
        result = iterator.next();
      }
      if (result.done === true) {
        break;
      }
      if (!destination.write(result.value)) {
        await wait_drain_or_close();
      }
    }
  } catch (err) {
    // The source threw or rejected while iterating; close it first, as a
    // `for await ... of` loop would, then propagate the error downstream.
    const close_err = await close();
    if (!destination.destroyed) {
      destination.destroy(close_err ?? err);
    }
    return;
  }
  if (!destination.destroyed) {
    destination.end();
  }
};

export { pump };
