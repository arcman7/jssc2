//A memoization decorator.//

class Memodict {
  //A memoization decorator dict.//
  construction(func) {
    this.name = func.name
    this.func = func
    return new Proxy({}, {
      //eslint-disable-next-line
      get: (target, args) => {
        if (args in target) {
          return target[args]
        }
        target[args] = func(args)
        return target[args]
      },
    })
  }
}

function memoize(func) {
  //Memoization decorator.//
  return new Memodict(func)
}

module.exports = {
  memoize,
}
