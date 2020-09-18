const path = require('path')
const stopwatch = require(path.resolve(__dirname, 'stopwatch.js'))
const sw = stopwatch.sw

class BuildStrings {
  constructor() {
    this.grow = sw.decorate(this.grow.bind(this))
    this.count = 0
  }

  grow() {
    this.count ++
    return Array(100000).fill('a')
  }
}

const bs = new BuildStrings()
// for (let i = 0; i < 10000; i++) {
//   bs.grow()
// }

const timer = setInterval(() => {
  bs.grow()
}, 10)

setTimeout(() => {
  clearInterval(timer)
  console.log('bs.count: ', bs.count)
}, 20000)