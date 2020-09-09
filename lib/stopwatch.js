const path = require('path') //eslint-disable-line

/*A stopwatch to check how much time is used by bits of code.*/

const { performance } = require('perf_hooks') //eslint-disable-line
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))

const { DefaultDict, withPython, zip } = pythonUtils
// String = pythonUtils.String //eslint-disable-line
// Array = pythonUtils.Array //eslint-disable-line
const msToS = 1 / 1000
const usedVal = { val: 0 }
const perf_hooks_mock = {
  usedVal,
  useRealish: false,
  set return_val(val) {
    usedVal.val = val
  },
  get return_val() {
    return usedVal.val
  },
  performance: {
    now() {
      if (perf_hooks_mock.useRealish) {
        return Date.now()
      }
      return usedVal.val
    },
  },
}

class Stat {
  static get _fields() { return ["num", "min", "max", "sum", "sum_sq"] }

  constructor() {
    this.reset()
  }

  reset() {
    this.num = 0
    this.min = 1000000000
    this.max = 0
    this.sum = 0
    this.sum_sq = 0
  }

  add(val) {
    this.num += 1
    if (this.min > val) {
      this.min = val
    }
    if (this.max < val) {
      this.max = val
    }
    this.sum += val
    this.sum_sq += (val ** 2)
  }

  get avg() {
    if (this.num === 0) {
      return 0
    }
    return this.sum / this.num
  }

  get dev() {
    //Standard deviation.//
    if (this.num === 0) {
      return 0
    }
    return Math.sqrt(Math.max(0, (this.sum_sq / this.num) - ((this.sum / this.num) ** 2)))
  }

  merge(other) {
    this.num += other.num
    this.min = Math.min(this.min, other.min)
    this.max = Math.max(this.max, other.max)
    this.sum += other.sum
    this.sum_sq += other.sum_sq
  }

  static build(summation, average, standard_deviation, minimum, maximum, number) {
    const stat = new this.prototype.constructor()
    if (number > 0) {
      stat.num = number
      stat.min = minimum
      stat.max = maximum
      stat.sum = summation
      stat.sum_sq = number * ((standard_deviation ** 2) + (average ** 2))
    }
    return stat
  }

  static parse(s) {
    if (s === 'num=0') {
      return new this.prototype.constructor()
    } //eslint-disable-next-line
    const parts = s.split(', ').map((p) => {
      return Number(p.split(':')[1])
    })
    return Stat.build(...parts)
  }

  toString() {
    if (this.num === 0) {
      return 'num=0'
    }
    return `sum: ${this.sum.toFixed(4)}, avg: ${this.avg.toFixed(4)}, dev: ${this.dev.toFixed(4)}, min: ${this.min.toFixed(4)}, max: ${this.max.toFixed(4)}, num: ${this.num}`
  }
}

class StopWatchContext {
  //Time an individual call.//
  static get _fields() { return ['_sw', '_start'] }

  constructor(stopwatch, name, mock_time = false) {
    this._sw = stopwatch
    this._sw.push(name)
    this.__enter__ = this.__enter__.bind(this)
    this.__exit__ = this.__exit__.bind(this)
    if (mock_time) {
      this.performance = perf_hooks_mock.performance
      // NOTE: Jest will define a window object
    } else if (typeof window === 'undefined') {
      // this.performance = performance
      this.performance = Date
    } else {
      // this.performance = window.performance
      this.performance = Date
    }
  }

  // performance.now() => measured in milliseconds.
  __enter__() {
    this._start = this.performance.now()
  }

  __exit__() {
    // this._sw.add(this._sw.pop(), (this.performance.now() * msToS) - this._start)
    this._sw.add(this._sw.pop(), (this.performance.now() - this._start) * msToS)
  }
}

class TracingStopWatchContext extends StopWatchContext {
  //Time an individual call, but also output all the enter/exit calls.//
  constructor(stopwatch, name, mock_time = false) {
    super(stopwatch, name, mock_time)
    this.__enter__ = this.__enter__.bind(this)
    this.__exit__ = this.__exit__.bind(this)
  }

  __enter__() {
    super.__enter__()
    this._log(`>>> ${this._sw.cur_stack()}`)
  }

  __exit__() {
    this._log(`<<< ${this._sw.cur_stack()} ${(this.performance.now() - this._start).toFixed(6)} secs`)
    super.__exit__()
  }

  //eslint-disable-next-line
  _log(s) {
    process.stderr.write(s + '\n')
  }
}

class FakeStopWatchContext {
  constructor() {} //eslint-disable-line

  __enter__() {} //eslint-disable-line

  __exit__() {} //eslint-disable-line
}

const fake_context = new FakeStopWatchContext()

let StopWatchRef

class StopWatch {
  /*A context manager that tracks call count and latency, and other stats.

  Usage:
      sw = stopwatch.Stopwatch()
      with sw("foo"):
        foo()
      with sw("bar"):
        bar()
      @sw.decorate
      def func():
        pass
      func()
      print(sw)
  */
  static get _fields() { return ['_times', '_local', '_factory'] }

  static _make(kwargs) {
    return new this.prototype.constructor(kwargs);
  }

  constructor(enabled = true, trace = false, mock_time = false) {
    this._times = new DefaultDict(Stat)
    // we dont need to declare anything as being local to the context
    // of the thread since by default node js worker threads are local
    this._local = {}
    if (trace) {
      this.trace()
    } else if (enabled) {
      this.enable()
    } else {
      this.disable()
    }
    const self = this
    function stopwatchProxy(name) {
      return self.__call__(name)
    }
    ['disable', 'enable', 'trace', 'custom', 'decorate', 'push', 'pop', 'cur_stack', 'clear', 'add', 'merge', 'str', 'toString'].forEach((methodName) => {
      stopwatchProxy[methodName] = this[methodName].bind(this)
    })
    Object.defineProperty(stopwatchProxy, 'times', {
      get() {
        return self._times
      }
    })
    stopwatchProxy._times = this._times
    stopwatchProxy.parse = this.constructor.parse
    stopwatchProxy.instanceRef = this
    this._mock_time = mock_time
    if (this._mock_time) {
      stopwatchProxy._perf_hooks_mock = perf_hooks_mock
    }
    this._funcProxy = stopwatchProxy
    return stopwatchProxy
  }

  disable() {
    this._factory = () => fake_context
  }

  enable() {
    this._factory = (name) => new StopWatchContext(this, name, this._mock_time)
  }

  trace() {
    this._factory = (name) => new TracingStopWatchContext(this, name, this._mock_time)
  }

  custom(factory) {
    this._factory = factory
  }

  __call__(name) {
    return this._factory(name)
  }

  decorate(name_or_func) {
    /*Decorate a function/method to check its timings.

    To use the function's name:
      @sw.decorate
      def func():
        pass

    To name it explicitly:
      @sw.decorate("name")
      def random_func_name():
        pass

    Args:
      name_or_func: the name or the function to decorate.

    Returns:
      If a name is passed, returns this as a decorator, otherwise returns the
      decorated function.
    */
    if (process.env['SC2_NO_STOPWATCH']) {
      return typeof (name_or_func) === 'function' ? name_or_func : (func) => func
    }
    const self = this
    function decorator(name, func) {
      function _stopwatch() {
        return withPython(self.__call__(name), () => { //eslint-disable-line
          return func(...arguments) //eslint-disable-line
        })
      }
      return _stopwatch
    }
    if (typeof (name_or_func) === 'function') {
      return decorator(name_or_func.name.replace('bound ', ''), name_or_func)
    }
    return (func) => decorator(name_or_func, func)
  }

  push(name) {
    try {
      this._local.stack.push(name)
    } catch (err) {
      this._local.stack = [name]
    }
  }

  pop() {
    const stack = this._local.stack
    const ret = stack.join('.')
    stack.pop()
    return ret
  }

  cur_stack() {
    return this._local.stack.join('.')
  }

  clear() {
    this._times = new DefaultDict(Stat)// this._times.clear()
    this._funcProxy._times = this._times
  }

  add(name, duration) {
    this._times[name].add(duration)
  }

  get times() {
    return this._times
  }

  merge(other) {
    let value
    Object.keys(other.times).forEach((key) => {
      value = other[key]
      if (!value) {
        return
      }
      this._times[key].merge(value)
    })
  }

  static parse(s) {
    //Parse the output below to create a new StopWatch.//
    const stopwatch = new StopWatchRef()
    s.splitlines().forEach((line) => {
      if (line.trim()) {
        const parts = line.match(/\S+/g)
        const name = parts[0]
        if (name !== '%') { // ie not the header line
          const rest = parts.slice(2, parts.length).map((v) => Number(v))
          stopwatch.times[parts[0]].merge(Stat.build(...rest))
        }
      }
    })
    return stopwatch
  }

  str(threshold = 0.1) {
    //Return a string representation of the timings.//
    if (!this._times) {
      return ''
    }
    let cur
    const total = Object.keys(this._times).reduce((acc, key) => {
      cur = this._times[key]
      return !(key.includes('.')) ? cur.sum + acc : acc
    }, 0)
    const table = [['', '% total', 'sum', 'avg', 'dev', 'min', 'max', 'num']]
    let percent
    let v
    Object.keys(this._times).sort().forEach((key) => {
      v = this._times[key]
      percent = (100 * v.sum) / (total || 1)
      if (percent > threshold) {
        table.push([
          key,
          percent.toFixed(2),
          v.sum.toFixed(4),
          v.avg.toFixed(4),
          v.dev.toFixed(4),
          v.min.toFixed(4),
          v.max.toFixed(4),
          String(v.num)
        ])
      }
    })
    let col
    const col_widths = []
    const nCol = table[0].length
    for (let colIndex = 0; colIndex < nCol; colIndex++) {
      col = []
      table.forEach((row) => {//eslint-disable-line
        col.push(row[colIndex].length)
      })
      col_widths[colIndex] = Math.max(...col)
    }
    let out = ''
    let val
    let width
    table.forEach((row) => {
      //eslint-disable-next-line
      out += '  ' + row[0].ljust(col_widths[0]) + '  '
      out += zip(row.slice(1), col_widths.slice(1))
        .map((zipPair) => {
          val = zipPair[0]
          width = zipPair[1]
          return val.rjust(width)
        }).join('  ')
      out += '\n'
    })
    return out
  }

  toString() {
    return this.str()
  }
}
StopWatchRef = StopWatch

// Global stopwatch is disabled by default to not incur the performance hit if
// it's not wanted.
const sw = new StopWatch(false)

module.exports = {
  Stat,
  StopWatchContext,
  TracingStopWatchContext,
  FakeStopWatchContext,
  fake_context,
  StopWatch,
  StopWatchRef,
  sw,
}
