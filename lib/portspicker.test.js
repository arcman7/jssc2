const path = require('path') //eslint-disable-line
const portspicker = require(path.resolve(__dirname, './portspicker.js'))

describe('portspicker.js: ', () => {
  describe('  PortsTest', () => {
    test('testNonContiguousReservation', async () => {
      let setsReserved = []
      for (let i = 1; i < 11; i++) {
        setsReserved.push(portspicker.pick_unused_ports(i))
      }
      setsReserved = await Promise.all(setsReserved)
      setsReserved.forEach((reserved, num_ports) => {
        expect(reserved.length).toBe(num_ports + 1)
      })
      expect(setsReserved.length).toBe(10)
    })
    test('testContiguousReservation', async () => {
      const setsReserved = []
      function getTasks() {
        const task0 = function() {
          return portspicker.pick_contiguous_unused_ports(2).then((ports) => {
            setsReserved.push(ports)
          })
        }
        const task1 = function() {
          return portspicker.pick_contiguous_unused_ports(3).then((ports) => {
            setsReserved.push(ports)
          })
        }
        const task2 = function() {
          return portspicker.pick_contiguous_unused_ports(4).then((ports) => {
            setsReserved.push(ports)
          })
        }
        const task3 = function() {
          return portspicker.pick_contiguous_unused_ports(5).then((ports) => {
            setsReserved.push(ports)
          })
        }
        return [
          task0,
          task1,
          task2,
          task3,
        ]
      }
      const reducer = (promiseChain, currentTask) => { //eslint-disable-line
        return promiseChain.then(currentTask);
      }
      const tasks = getTasks();
      await tasks.reduce(reducer, Promise.resolve())
      setsReserved.forEach((reserved, num_ports) => {
        expect(reserved.length).toBe(num_ports + 2)
      })
      expect(setsReserved.length).toBe(4)
    })
    test('testInvalidReservation', async() => {
      try {
        await portspicker.pick_unused_ports(0)
        throw new Error('expected to throw')
      } catch (err) {
        //test passes
      }
    })
    test('testInvalidContiguousReservation', async() => {
      try {
        await portspicker.pick_contiguous_unused_ports(0)
        throw new Error('expected to throw')
      } catch (err) {
        //test passes
      }
    })
  })
})
