const flags = require('flags')

flags.defineBoolean('m', false, 'use this file as a module or eval it')

flags.parse()
if (flags.get('m')) {
  console.log('a module!')
  module.exports = {
    m: true
  }
} else {
  console.log('not a module!')
}
// // print process.argv
// process.argv.forEach(function (val, index) {
//   console.log(index + ': ' + val);
// })
