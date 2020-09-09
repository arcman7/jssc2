const path = require('path') //eslint-disable-line
const run_parallel = require(path.resolve(__dirname, './run_parallel.js'))

class Barrier {
  constructor(n) {
    this.n = n
    this.count = 0
    this._pending = []
    this.wait = this.wait.bind(this)
  }

  wait() {
    const me = this.count
    this.count += 1
    const prom = new Promise((resolve) => {
      this._pending.push(() => resolve(me))
    })
    if (this.count < this.n) {
      return prom
    }
    this.count = 0
    this._pending.forEach((resolveFunc) => resolveFunc())
    return prom
  }
}
const bMsg = 'Test function: bad. Ignore this error message.'
function bad() {
  throw new Error(bMsg)
}

describe('run_parallel.js:', () => {
  describe('  RunParallelTest:', () => {
    test('test_returns_expected_values', async () => {
      const pool = new run_parallel.RunParallel()
      let out = await pool.run([Number])
      expect(out).toMatchObject([0])
      out = await pool.run([() => 1, () => 2, () => 'asdf', () => ({ 1: 2 })])
      expect(out).toMatchObject([1, 2, 'asdf', { 1: 2 }])
    })
    test('test_run_in_parallel', async () => {
      const b = new Barrier(3)
      const pool = new run_parallel.RunParallel()
      const out = await pool.run([b.wait, b.wait, b.wait])
      expect(out).toMatchObject([0, 1, 2])
    })
    test('test_avoids_deadlock', async () => {
      const b = new Barrier(2)
      const pool = new run_parallel.RunParallel()
      try {
        await pool.run([Number, b.wait, bad])
        throw new Error('expected to throw')
      } catch (err) {
        expect(err.message).toBe(bMsg)
      }
    })
    test('test_exception', async () => {
      const pool = new run_parallel.RunParallel()
      const out = await pool.run([() => 1, () => new Error('Test error: Ignore this error message.')])
      expect(out[0]).toBe(1)
      expect(out[1] instanceof Error).toBe(true)
      try {
        await pool.run([bad])
        throw new Error('expected to throw')
      } catch (err) {
        expect(err.message).toBe(bMsg)
      }
      try {
        await pool.run([Number, bad])
        throw new Error('expected to throw')
      } catch (err) {
        expect(err.message).toBe(bMsg)
      }
    })
    test('test_partial', async () => {
      const pool = new run_parallel.RunParallel()
      const out = await pool.run([0, 1, 2, 3, 4].map((i) => [Math.max, 0, i - 2]))
      expect(out).toMatchObject([0, 0, 0, 1, 2])
    })
  })
})
