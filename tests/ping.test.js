const path = require('path') //eslint-disable-line
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const utils = require(path.resolve(__dirname, './utils.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))
const portspicker = require(path.resolve(__dirname, '..', 'lib', 'portspicker.js'))

const { assert, sequentialTaskQueue, withPython } = pythonUtils

//Benchmark the ping rate of SC2.//
async function test_ping() {
  const testState = new utils.TestCase()
  testState.setUp()
  const port = (await portspicker.pick_unused_ports(1))[0]
  const sc_process = await run_configs.get().start({ want_rgb: false, port, passedSw: stopwatch.sw })
  const controller = sc_process._controller

  const count = 100

  testState._sc2_procs = [sc_process]
  testState._controllers = [controller]
  await withPython(stopwatch.sw('first'), controller.ping)

  const tasks = []
  for (let i = 0; i < count; i++) {
    tasks.push(() => controller.ping())
  }

  await sequentialTaskQueue(tasks)
  await controller.quit()
  await sc_process.close()
  assert(stopwatch.sw.times['ping'].num === count, 'sc_process._sw.times["ping"].num === count')
  testState.tearDown()
}

test_ping()
