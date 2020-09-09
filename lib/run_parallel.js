// const Executors = require('worker_threads')
// const { DynamicPool } = require('node-worker-threads-pool')

/*
  ** IMPORTANT **

  Javascript does not require the usage of multiple threads to perform any sc2 API call.
  This class is written for the sake performing tests on the alternative method of using
  promises instead.

  This class will be used in all tests that stem from code where threads are used in the original python source code, however this class is not used in any actual code that performs sc2 API calls or is otherwise used for this project.
*/

function partial(args) {
  let func
  for (let i = 0; i < args.length; i++) {
    const f = args[i]
    if (typeof f === 'function') {
      func = f
      args.splice(i, 1)
      break
    }
  }
  return () => func(...args)
}

class Executor {
  constructor(funcs) {
    this.funcs = funcs
    const self = this
    this.wait = new Promise((res, rej) => {
      self.resolve = res
      self.reject = rej
    })
    this._wait = Promise.all(funcs.map((f) => {
      try { //eslint-disable-line
        return f()
      } catch (err) {
        // return Promise.reject(err)
        throw err
      }
    }))
    this._wait.then((results) => self.resolve(results))
    this._wait.catch((err) => self.reject(err))
  }
}

class RunParallel {
  //Run all funcs in promises.//

  constructor(timeout = null) {
    this._timeout = timeout || (2 * 1000) // default 2 seconds
    this._executor = null
    this._workers = 0
  }

  run(funcs) {
    /*Run a set of functions asynchronously, returning their results.

    Make sure any function you pass exits with a reasonable timeout. If it
    doesn't return within the timeout or the result is ignored due an exception
    in a separate thread it will continue to stick around until it finishes,
    including blocking process exit.

    Args:
      funcs: An iterable of functions or iterable of args to functools.partial.

    Returns:
      A list of return values with the values matching the order in funcs.

    Raises:
      Propagates the first exception encountered in one of the functions.
    */
    funcs = funcs.map((f) => (typeof f === 'function' ? f : partial(f)))
    if (this._executor) {
      this.shutdown()
    }
    this._workers = funcs.length
    this._executor = new Executor(funcs)
    this._timeoutId = setTimeout(() => {
      this._executor.reject(`One or more requests have expired after waiting ${this.timeout} miliseconds`)
    }, this._timeout)
    this._executor.wait.then(() => {
      clearTimeout(this._timeoutId)
    })
    return this._executor.wait
  }

  shutdown() {
    if (!this._executor) {
      return
    }
    this._executor.reject('shutdown')
    this._executor = null
    this._workers = 0
    clearTimeout(this._timeoutId)
  }
}

module.exports = {
  RunParallel,
}
