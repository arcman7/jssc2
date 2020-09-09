const path = require('path') //eslint-disable-line
const stopwatch = require(path.resolve(__dirname, './stopwatch.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))

const { withPython } = pythonUtils

function ham_dist(str1, str2) {
  //Hamming distance. Count the number of differences between str1 and str2.//
  if (str1.length !== str2.length) {
    throw new Error(`AssersionError: ${str1.length} !== ${str2.length}`)
  }
  const n = str1.length
  let sum = 0
  for (let i = 0; i < n; i++) {
    if (str1[i] !== str2[i]) {
      sum += 1
    }
  }
  return sum
}

const jsConv = 1000

describe('stopwatch.js:', () => {
  describe('StatTest:', () => {
    let stat
    beforeEach(() => {
      stat = new stopwatch.Stat()
    })
    test('Range', () => {
      stat.add(1)
      stat.add(5)
      stat.add(3)
      expect(stat.num).toBe(3)
      expect(stat.sum).toBe(9)
      expect(stat.min).toBe(1)
      expect(stat.max).toBe(5)
      expect(stat.avg).toBe(3)
    })
    test('Parse (used by toString())', () => {
      stat.add(1)
      stat.add(3)
      const out = stat.toString()
      expect(out).toBe("sum: 4.0000, avg: 2.0000, dev: 1.0000, min: 1.0000, max: 3.0000, num: 2")
      expect(ham_dist(out, stopwatch.Stat.parse(out).toString()) < 5).toBe(true)
    })
  })
  describe('StopwatchTest', () => {
    let sw
    beforeEach(() => {
      sw = new stopwatch.StopWatch()
    })
    afterEach(() => {
      delete process.env['SC2_NO_STOPWATCH']
    })
    test('StopWatch', async () => {
      sw = new stopwatch.StopWatch(true, false, true)
      const perf_hooks = sw._perf_hooks_mock
      perf_hooks.return_val = 0
      withPython(sw('one'), () => { perf_hooks.return_val += 0.002 * jsConv })
      withPython(sw('one'), () => { perf_hooks.return_val += 0.004 * jsConv })
      withPython(sw('two'), () => {
        withPython(sw('three'), () => {
          perf_hooks.return_val += 0.006 * jsConv
        })
      })
      let four = function() {
        perf_hooks.return_val += 0.004 * jsConv
      }
      four = sw.decorate(four)
      four()
      const fv = sw.decorate("five")
      let foo = function () {
        perf_hooks.return_val += 0.005 * jsConv
      }
      foo = fv(foo)
      foo()
      const out = sw.toString()
      // The names should be in sorted order.
      let names = out.splitlines().map((l) => l.trim())
      names = names.slice(1, names.length - 1)
        .map((l) => l.split(' ')[0])
      expect(names.join(', ')).toBe('five, four, one, two, two.three')
      const one_line = out.splitlines()
        .map((line) => line.match(/\S+/g))[3]
      expect(one_line[5] < one_line[6]).toBe(true) // min < max
      expect(one_line[7]).toBe('2') // num
      // Can't test the rest since they'll be flaky.

      // Allow a few small rounding errors for the round trip.
      const val = stopwatch.StopWatch.parse(out)
      const round_trip = (val).toString()
      expect(ham_dist(out, round_trip) < 15).toBe(true)
    })
    test('Divide zero', () => {
      sw = new stopwatch.StopWatch(true, false, true)
      const perf_hooks = sw._perf_hooks_mock
      perf_hooks.return_val = 0
      withPython(sw('zero'), () => {})
      // Just make sure this doesn't have a divide by 0 for when the total is 0.
      expect(sw.toString().includes('zero')).toBe(false)
    })
    test('Decorator disabled', () => {
      process.env['SC2_NO_STOPWATCH'] = true
      expect(sw.decorate(Math.round)).toBe(Math.round)
      expect(sw.decorate('name')(Math.round)).toBe(Math.round)
    })
    test('Decorator enabled', () => {
      expect(sw.decorate(Math.round)).not.toBe(Math.round)
      expect(sw.decorate('name')(Math.round)).not.toBe(Math.round)
    })
    test('Speed', () => {
      const count = 100
      function run() {
        for (let _ = 0; _ < count; _++) {
          withPython(sw('name'), () => {})
        }
      }

      for (let _ = 0; _ < 10; _++) {
        sw.enable()
        withPython(sw('enabled'), run)

        sw.trace()
        withPython(sw('trace'), run)

        sw.enable()
        //eslint-disable-next-line
        withPython(sw('disabled'), () => { sw.disable(); run() })
      }
      // No asserts. Succeed but print the timings.
      console.log(sw.toString())
    })
  })
})
