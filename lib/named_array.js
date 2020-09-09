//Named numpy arrays for easier access to the observation data.

/*
https://docs.scipy.org/doc/numpy/user/basics.rec.html are not enough since they
actually change the type and don't interoperate well with tensorflow.
*/

const path = require('path') //eslint-disable-line
const Enum = require('python-enum') //eslint-disable-line
const np = require(path.resolve(__dirname, './numpy.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))
const { isinstance } = pythonUtils

Array.prototype.valueAt = function valueAt() { //eslint-disable-line
  let value = this
  let args = arguments //eslint-disable-line
  if (args[0] === null) {
    return this.getProxy(this)
  }
  if (args[0]._named_array_values) {
    args[0] = args[0]._named_array_values
  }
  if (Array.isArray(args[0])) {
    args = args[0]
    const results = []
    args.forEach((ind) => {
      results.push(this[ind])
    })
    return this.getProxy(results, true)
  }
  for (let i = 0; i < args.length; i++) {
    value = value[args[i]]
  }
  return value
}
Array.prototype.where = function where(conditionFunc, start = this._named_array_values, results = [], init = true) { //eslint-disable-line
  start.forEach((ele, index) => {
    if (Array.isArray(ele)) {
      const temp = this.where(conditionFunc, ele, results, false)
      results.concat(temp)
      // results = results.concat(this.where(conditionFunc, ele, results, false))
      return
    }
    if (conditionFunc(ele, index)) {
      results.push(ele)
    }
  })
  if (init === false) {
    return results
  }
  return this.getProxy(results, true)
}

function unpack(values, names, fullNamesList, nameListIndex = 0) {
  //sanitize input
  if (names === null) {
    names = []
  } else if (isinstance(names, Enum.EnumMeta)) {
    names = names.member_names_
  } else if (names.constructor && names.constructor._fields) {
    names = names.constructor._fields
  } else if (names._fields) {
    names = names._fields
  } else if (!Array.isArray(names)) {
    names = Object.keys(names)
  }

  values.forEach((ele, i) => {
    const name = names[i]
    if (name === undefined) {
      // do nothing
    } else {
      Object.defineProperty(values, name, {
        get: function() { return values[i] },
        set: function(val) { values[i] = val; return val || true }
      })
    }

    if (ele && ele.length) {
      const index = nameListIndex + 1
      unpack(ele, fullNamesList[index], fullNamesList, index)
    }
  })
}

class NamedDict {
  // A dict where you can use `d["element"]` or `d.element`.//
  constructor(kwargs) {
    if (!kwargs) {
      return
    }
    Object.keys(kwargs).forEach((key) => {
      this[key] = kwargs[key]
    })
  }
}
class NamedNumpyArray extends Array {// extends np.ndarray:
  /*A subclass of ndarray that lets you give names to indices.

  This is a normal ndarray in the sense that you can always index by numbers and
  slices, though elipses don't work. Also, all elements have the same type,
  unlike a record array.

  Names should be a list of names per dimension in the ndarray shape. The names
  should be a list or tuple of strings, a namedtuple class (with names taken
  from _fields), or an IntEnum. Alternatively if you don't want to give a name
  to a particular dimension, use None. If your array only has one dimension, the
  second level of list can be skipped.

    Jihan & Ryan - Documentation notes:

     var foo = named_array.NamedNumpyArray([1, 3, 6], ["a", "b", "c"])
                col
    dimension    0
       a         1
       b         3
       c         6

    usage: foo.a => 1, foo.b => 3, foo.c => 6

      bar = named_array.NamedNumpyArray([[1, 3], [6, 8]], [["a", "b"], None])
                col   col
    dimension    0     1
       a (0)     1     3
       b (1)     6     8

    usage: bar.a => [1,3], bar.a[0] => 1, bar.a[1] => 3
    usage: bar.b => [6,8], bar.b[0] => 6, bar.b[1] => 8

     baz = named_array.NamedNumpyArray([[1, 3], [6, 8]], [None, ["a", "b"]])

                col           col
    dimension    a             b
    None (0)     1             3
    None (1)     6             8

    usage: bar[0] => [1,3], bar[0].a => 1, bar[0].a => 3
    usage: bar[1] => [6,8], bar[0].b => 6, bar[1].b => 8

  Look at the tests for more examples including using enums and named tuples.
  */
  constructor(values, names) {
    let tensor
    if (values instanceof np.TensorMeta) {
      tensor = values
      values = values.arraySync()
    } else {
      tensor = np.tensor(values)
    }
    super(...values)
    if (isinstance(names, Enum.EnumMeta)) {
      names = names.member_names_
    } else if (names._fields) {
      names = names._fields
    } else if (names.contructor && names.constructor._fields) {
      names = names.constructor._fields
    } else if (!Array.isArray(names)) {
      names = Object.keys(names)
    }
    this.__pickleArgs = [values, names]
    this.tensor = tensor
    this.shape = this.tensor.shape
    if (this.shape.length === 0) {
      throw new Error('ValueError: Scalar arrays are unsupported')
    }
    if (this.shape.length === 1) {
      if (this.shape[0] === 0 && names && names[0] === null) {
        // Support arrays of length 0.
        names = [null]
        // Allow just a single dimension if the array is also single dimension.
      } else if (names.length > 1) {
        names = [names]
      }
    }
    // Validate names!
    if (!isinstance(names, Array) || names.length !== this.shape.length) {
      throw new Error(`ValueError: Names must be a list of length equal to the array shape: ${names.length} != ${this.shape.length}.`)
    }
    let only_none = this.shape[0] > 0
    Object.keys(names).forEach((key, i) => {
      let o = names[key]
      if (o === null) {
        // skip
      } else {
        only_none = false
        if (isinstance(o, Enum.EnumMeta)) {
          o.member_names_.forEach((n, j) => {
            if (j != o[n]) {
              throw new Error('ValueError: Enum has holes or doesn\'t start from 0.')
            }
          })
          o = o.member_names_
        } else if (o._fields) {
          o = o._fields
        } else if (o.constructor && o.constructor._fields) {
          o = o.constructor._fields
        } else if (isinstance(o, Array)) {
          o.forEach((n) => {
            if (typeof (n) !== 'string') {
              throw new Error(`ValueError: Bad name, must be a list of strings not: ${JSON.stringify(o)}`)
            }
          })
        } else {
          console.error(o)
          throw new Error('Bad names. Must be None, a list of strings, a namedtuple, or Intenum.')
        }
        if (this.shape[i] !== o.length) {
          throw new Error(`ValueError: Wrong number of names in dimension ${i}. Got ${o.length}, expected ${this.shape[i]}.`)
        }
      }
    })

    if (only_none) {
      throw new Error('No names given. Use a normal numpy.ndarray instead.')
    }
    const copy = values.map((e) => e)
    this._named_array_values = copy
    // Finally convert to a NamedNumpyArray
    const nameListIndex = 0
    unpack(this, names[nameListIndex], names, nameListIndex)
  }

  valueAt() {
    let value = this
    let args = arguments //eslint-disable-line
    if (args[0] === null) {
      return this.getProxy(this)
    }
    if (args[0]._named_array_values) {
      args[0] = args[0]._named_array_values
    }
    if (Array.isArray(args[0])) {
      args = args[0]
      const results = []
      args.forEach((ind) => {
        results.push(this[ind])
      })
      return this.getProxy(results, true)
    }
    for (let i = 0; i < args.length; i++) {
      value = value[args[i]]
    }
    return value
  }

  where(conditionFunc, start = this._named_array_values, results = [], init = true) {
    start.forEach((ele, index) => {
      if (Array.isArray(ele)) {
        const temp = this.where(conditionFunc, ele, results, false)
        results.concat(temp)
        // NOTE: below will NOT wor
        // results = results.concat(this.where(conditionFunc, ele, results, false))
        return
      }
      if (conditionFunc(ele, index)) {
        results.push(ele)
      }
    })
    if (init === false) {
      return results
    }
    return this.getProxy(results, true)
  }

  slice() {
    return this.getProxy(this._named_array_values.slice(...arguments), true) //eslint-disable-line
  }

  getProxy() { //eslint-disable-line
    return arguments //eslint-disable-line
  }

  pickle() {
    return JSON.stringify(this.__pickleArgs)
  }
}

function getNamedNumpyArray(values, names) {
  let returnVal
  function getProxy(thing, override) {
    return new Proxy(thing, {
      get: (target, name) => {
        if (name === Symbol.iterator) {
          return target[Symbol.iterator].bind(target)
        }
        if (name === '_named_array_values') {
          return target._named_array_values
        }
        if (name === 'length') {
          return target[name]
        }
        let val
        if (typeof name === 'string' && Number.isInteger(Number(name))) {
          name = Number(name)
          if (name >= 0) {
            val = target[name]
          } else {
            val = target[target.length + name]
          }
          // gather
        } else if (name === 'undefined' || name === 'null') {
          val = [target]
        } else if (override) {
          val = returnVal[name]
        } else {
          val = target[name]
        }
        if (Array.isArray(val)) {
          return getProxy(val)
        }
        return val
      },
      set(target, key, value) {
        target[key] = value
        return value || true
      },
      getOwnPropertyDescriptor: function(target, key) {
        const notEnumerable = {
          'extends': true,
          '_named_array_values': true,
          'shape': true,
          '__pickleArgs': true,
          'tensor': true,
          'getProxy': true,
        }
        if (key === 'length') {
          return Object.getOwnPropertyDescriptor(target, key)
        }
        if (notEnumerable[key]) {
          return { value: this.get(target, key), enumerable: false, configurable: true }
        }
        return Object.getOwnPropertyDescriptor(target, key)
      }
    })
  }
  const obj = new NamedNumpyArray(values, names) //eslint-disable-line
  obj.getProxy = getProxy
  returnVal = getProxy(obj)
  return returnVal
}
module.exports = {
  NamedDict,
  NamedNumpyArray: getNamedNumpyArray,
}
