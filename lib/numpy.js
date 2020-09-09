// let tf = require('@tensorflow/tfjs') //eslint-disable-line
let tf = require('@tensorflow/tfjs-node') //eslint-disable-line
const foo = tf.tensor([1])
const TensorMeta = foo.constructor // currently unknown where else to get this value
/*eslint-disable prefer-rest-params*/
module.exports = {
  absolute: tf.abs,
  abs: tf.abs,
  any: (tensor) => {
    if (tensor.dtype !== 'bool') {
      return tf.any(tf.cast(tensor, 'bool'))
    }
    return tf.any(tensor)
  },
  arange() {
    if (arguments.length === 1) {
      return tf.range(0, arguments[0])
    }
    return tf.range(...arguments)
  },
  // array: tf.tensor,
  array(arr) { return arr },
  argMin: tf.argMin,
  argMax: tf.argMax,
  buffer: tf.buffer,
  // clipByValue(x, min, max) {
  //   const minT = tf.zerosLike(x).add(tf.tensor([min], undefined, x.dtype))
  //   const maxT = tf.zerosLike(x).add(tf.tensor([max], undefined, x.dtype))
  //   return x.where(x.greaterEqual(min), minT).where(x.lessEqual(max), maxT)
  // },
  clipByValue(x, min, max) {
    const minT = tf.fill(x.shape, min, x.dtype)
    const maxT = tf.fill(x.shape, max, x.dtype)
    return x.where(x.greaterEqual(min), minT).where(x.lessEqual(max), maxT)
  },
  cumsum() {
    return tf.cumsum(...arguments).dataSync() //eslint-disable-line
  },
  gather: tf.gather,
  getValueAt(arr, index) {
    if (arr instanceof TensorMeta) {
      arr = arr.arraySync()
    }
    if (Number.isInteger(index)) {
      return arr[index]
    }
    let curVal = arr
    for (let i = 0; i < index.length; i++) {
      curVal = curVal[index[i]]
    }
    return curVal
  },
  getCol(tensor, col) {
    const temp = tf.transpose(tensor)
    return temp.slice(col, 1)
  },
  greater: tf.greater,
  greaterEqual: tf.greaterEqual,
  less: tf.less,
  mean: tf.mean,
  mod: tf.mod,
  ndarray: tf.tensor,
  norm: tf.norm,
  ones: tf.ones,
  round: tf.round,
  range: tf.range,
  stack: tf.stack,
  tensor: tf.tensor,
  TensorMeta, // used for type checking
  transpose: tf.transpose,
  where: tf.where,
  whereAsync: tf.whereAsync,
  util: tf.util,
  zeros: tf.zeros,
  zip(tensorA, tensorB) {
    if (Array.isArray(tensorA)) {
      tensorA = tf.tensor(tensorA)
    }
    if (Array.isArray(tensorB)) {
      tensorA = tf.tensor(tensorB)
    }
    return tf.transpose(tf.stack([tensorA, tensorB]))
  },
  // dtypes
  int8: Int8Array,
  int16: Int16Array,
  int32: Int32Array,
  uint8: Uint8Array,
  uint16: Uint16Array,
  uint32: Uint32Array,
  float32: Float32Array,
  float64: Float64Array,
  // node utility functions
  node: tf.node,
  tf,
}
