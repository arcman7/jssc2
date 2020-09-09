// let tf = require('@tensorflow/tfjs-node') //eslint-disable-line
let tf = require('@tensorflow/tfjs') //eslint-disable-line

if (typeof window === 'undefined') {
  const tf_wasm_module = require('@tensorflow/tfjs-backend-wasm') //eslint-disable-line
  const path = require('path') //eslint-disable-line
  tf_wasm_module.setWasmPath(path.resolve(
    '..',
    '..',
    '..',
    'node_modules',
    '@tensorflow',
    'tfjs-backend-wasm',
    'dist',
    'tfjs-backend-wasm.wasm'
  ))
} else {
  tf.wasm.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm')
}

let features
let colors
if (typeof window === 'undefined') {
  features = require('./features.js') //eslint-disable-line
  colors = require('./colors.js') //eslint-disable-line
} else {
  features = require('/features.js') //eslint-disable-line
  colors = require('/colors.js') //eslint-disable-line
}
/** Vanilla JS Helper Methods **/
//eslint-disable-next-line
Array.prototype.mul = function (n) {
  if (Array.isArray(n)) {
    return [this[0] * n[0], this[1] * n[1], this[2] * n[2]]
  }
  return [this[0] * n, this[1] * n, this[2] * n]
}
//eslint-disable-next-line
Array.prototype.add = function (n) {
  if (Array.isArray(n)) {
    return [this[0] + n[0], this[1] + n[1], this[2] + n[2]]
  }
  return [this[0] + n, this[1] + n, this[2] + n]
}
// used on arrays
function clip(a, a_min, a_max) {
  let n
  for (let i = 0; i < a.length; i++) {
    n = a[i]
    if (n < a_min) {
      a[i] = a_min
    } else if (n > a_max) {
      a[i] = a_max
    }
  }
}
// used on tensors
function clipByValue(x, min, max) {
  const minT = tf.fill(x.shape, min, x.dtype)
  const maxT = tf.fill(x.shape, max, x.dtype)
  return x.where(x.greaterEqual(min), minT).where(x.lessEqual(max), maxT)
}

function sw(cb, record) {
  return function time_callback() {
    const start = sw.performance.now()
    let end
    let tempResult = cb(...arguments) //eslint-disable-line
    if (tempResult instanceof Promise) {
      return tempResult.then((results) => {
        end = sw.performance.now()
        if (record) {
          record.push(end - start)
        } else {
          console.log(`sw: ${cb.name} - ${end - start} ms`)
        }
        return results
      })
    }
    end = sw.performance.now()
    if (record) {
      record.push(end - start)
    } else {
      console.log(`sw: ${cb.name} - ${end - start} ms`)
    }
    return tempResult
  }
}

function averageRunTime(cb, argDetails, n = 25) {
  function average() {
    const times = []
    const origPush = times.push.bind(times)
    times.push = (ele) => {
      origPush(ele)
      if (times.length >= n) {
        const total = times.reduce((accum, curr) => accum + curr)
        console.log(`${cb.name} average runtime - ${(total / n).toFixed(2)} ms`)
      }
    }
    const func = sw(cb, times)
    for (let i = 0; i < n; i++) {
      func(...arguments) //eslint-disable-line
    }
  }
  return average
}

function feature_color(feature, data) {
  if (feature.scale) {
    clip(data, 0, feature.scale - 1)
  }
  const palette = feature.palette
  const bytes = Array(data.length)
  let color
  for (let i = 0; i < data.length; i++) {
    if (data[i]) {
      color = palette[data[i]]
      bytes[i] = [color[0] | 0, color[1] | 0, color[2] | 0]
    } else {
      bytes[i] = [0, 0, 0]
    }
  }
  return bytes
}

if (typeof window === 'undefined') {
  const { performance } = require('perf_hooks') //eslint-disable-line
  sw.performance = performance
} else {
  sw.performance = window.performance
}

let draw_base_map_tf = function(data) {
  //Draw the base map.//
  const hmap_feature = features.SCREEN_FEATURES.height_map
  let hmap = data//hmap_feature.unpack(this._obs.getObservation())
  // console.log('A0')
  // if (!tf.any(tf.cast(hmap, 'bool'))) {
  hmap = hmap.add(100)
  // }
  // console.log('A1')
  const hmap_color = hmap_feature.color(tf.cast(hmap, 'int32'), true)
  // console.log('A1.B')

  let out = hmap_color.mul(0.6)
  // console.log('A2')
  const creep_feature = features.SCREEN_FEATURES.creep
  const creep = data //creep_feature.unpack(this._obs.getObservation())
  const creep_mask = creep.greater(0)
  // console.log('A3')
  const creep_color = creep_feature.color(creep, true)
  let temp1 = out.where(creep_mask, out.mul(0.4))
  let temp2 = creep_color.where(creep_mask, creep_color.mul(0.6))
  out = out.where(creep_mask, temp1.add(temp2))

  const power_feature = features.SCREEN_FEATURES.power
  const power = data //power_feature.unpack(this._obs.getObservation())
  const power_mask = power.greater(0)
  const power_color = power_feature.color(power, true)
  temp1 = out.where(power_mask, out.mul(0.7))
  temp2 = power_color.where(power_mask, power_color.mul(0.3))
  out = out.where(power_mask, temp1.add(temp2))

  if (true) {
    const player_rel_feature = features.SCREEN_FEATURES.player_relative
    const player_rel = data //player_rel_feature.unpack(this._obs.getObservation())
    const player_rel_mask = player_rel.greater(0)
    const player_rel_color = player_rel_feature.color(player_rel, true)
    out = out.where(player_rel_mask, player_rel_color)
  }

  // const visibility = data //features.SCREEN_FEATURES.visibility_map.unpack(this._obs.getObservation())
  const visibility = clipByValue(data, 0, 2)
  const visibility_fade = tf.tensor([[0.5, 0.5, 0.5], [0.75, 0.75, 0.75], [1, 1, 1]])
  //out *= visibility_fade[visibility]
  const indicies = tf.cast(visibility, 'int32')
  // console.log(indicies)
  out = out.mul(visibility_fade.gather(indicies))
  return out
}
// draw_base_map_tf = sw(draw_base_map_tf)
draw_base_map_tf = averageRunTime(draw_base_map_tf)

let draw_base_map_vanilla = function(data) {
  //Draw the base map.//
  const hmap_feature = features.SCREEN_FEATURES.height_map
  const hmap = data
  // console.log(data)
  let any = false
  for (let i = 0; i < hmap.length; i++) {
    if (hmap[i]) {
      any = true
      break
    }
  }
  if (any) {
    for (let i = 0; i < hmap.length; i++) {
      hmap[i] += 100
    }
  }
  // const hmap_color = hmap_feature.color(hmap)
  const hmap_color = feature_color(hmap_feature, hmap)
  const out = Array(hmap_color.length)
  for (let i = 0; i < out.length; i++) {
    out[i] = hmap_color[i].mul(0.6)
  }

  const creep_feature = features.SCREEN_FEATURES.creep
  const creep = data
  const creep_mask = Array(creep.length)
  for (let i = 0; i < creep.length; i++) {
    creep_mask[i] = Boolean(creep[i])
  }
  const creep_color = feature_color(creep_feature, creep)
  // let temp1 = out.where(creep_mask, out.mul(0.4))
  // let temp2 = creep_color.where(creep_mask, creep_color.mul(0.6))
  // out = out.where(creep_mask, temp1.add(temp2))
  let temp1 = Array(out.length)
  for (let i = 0; i < temp1.length; i++) {
    temp1[i] = creep_mask[i] ? out[i] : out[i].mul(0.4)
  }
  let temp2 = Array(creep_color.length)
  for (let i = 0; i < temp1.length; i++) {
    temp2[i] = creep_mask[i] ? creep_color[i] : creep_color[i].mul(0.6)
  }
  for (let i = 0; i < temp1.length; i++) {
    out[i] = creep_mask[i] ? out[i] : temp1[i].add(temp2[i])
  }

  const power_feature = features.SCREEN_FEATURES.power
  const power = data
  const power_mask = Array(data.length)
  for (let i = 0; i < power_mask.length; i++) {
    power_mask[i] = Boolean(power[i])
  }
  const power_color = feature_color(power_feature, power)
  temp1 = Array(out.length)
  for (let i = 0; i < temp1.length; i++) {
    if (!out[i].mul) {
      console.log('out: ')
      console.log(out.slice(i - 50, i + 50))
      console.log('out[', i, ']:  ', out[i])
    }
    temp1[i] = power_mask[i] ? out[i] : out[i].mul(0.7)
  }
  temp2 = Array(power_color.length)
  for (let i = 0; i < temp1.length; i++) {
    temp2[i] = power_mask[i] ? power_color[i] : power_color[i].mul(0.3)
  }
  for (let i = 0; i < temp1.length; i++) {
    out[i] = power_mask[i] ? out[i] : temp1[i].add(temp2[i])
  }

  if (true) {
    const player_rel_feature = features.SCREEN_FEATURES.player_relative
    const player_rel = data
    const player_rel_mask = Array(player_rel.length)
    for (let i = 0; i < player_rel.length; i++) {
      player_rel_mask[i] = Boolean(player_rel[i])
    }
    const player_rel_color = feature_color(player_rel_feature, player_rel)
    for (let i = 0; i < out.length; i++) {
      out[i] = player_rel_mask[i] ? out[i] : player_rel_color[i]
    }
  }

  clip(data, 0, 2)
  const visibility = data
  const visibility_fade = [[0.5, 0.5, 0.5], [0.75, 0.75, 0.75], [1, 1, 1]]
  let tempVal
  for (let i = 0; i < out.length; i++) {
    tempVal = visibility_fade[visibility[i]]
    out[i] = [out[i] * tempVal[0], out[i] * tempVal[1], out[i] * tempVal[2]]
  }
  return out
}
draw_base_map_vanilla = averageRunTime(draw_base_map_vanilla)

function getTestData(size = 2, asTensor = true, Type = Uint8Array) {
  console.log('\n')
  console.log('getting data, size - ', size)
  const arr = new Type(size)
  for (let i = 0; i < size; i++) {
    arr[i] = Math.floor(255 * Math.random())
  }
  if (!asTensor) {
    return arr
  }
  return tf.tensor(arr, undefined, 'int32')//'float32')
}

function runTests() {
  let testData

  // // 2 ^ 1
  // testData = getTestData(2 ** 1)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 1, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 2
  // testData = getTestData(2 ** 2)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 2, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 3
  // testData = getTestData(2 ** 3)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 3, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 4
  // testData = getTestData(2 ** 4)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 4, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 5
  // testData = getTestData(2 ** 5)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 5, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 6
  // testData = getTestData(2 ** 6)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 6, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 7
  // testData = getTestData(2 ** 7)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 7, false)
  // draw_base_map_vanilla(testData)

  // // 2 ^ 8
  // testData = getTestData(2 ** 8)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 8)
  // // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 8, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 9
  // testData = getTestData(2 ** 9)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 9, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 10
  // testData = getTestData(2 ** 10)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 10)
  // // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 10, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 11
  // testData = getTestData(2 ** 11)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 11)
  // // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 11, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 12
  // testData = getTestData(2 ** 12)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 12)
  // // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 12, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 13
  // testData = getTestData(2 ** 13)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 13)
  // // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 13, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 14
  // testData = getTestData(2 ** 14)
  // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 14) 
  // // draw_base_map_tf(testData)
  // // testData = getTestData(2 ** 14, false)
  // // draw_base_map_vanilla(testData)

  // // 2 ^ 15
  // testData = getTestData(2 ** 15)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 15)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 15, false)
  // draw_base_map_vanilla(testData)

  // 2 ^ 16
  testData = getTestData(2 ** 16)
  draw_base_map_tf(testData)
  // testData = getTestData(2 ** 16)
  // draw_base_map_tf(testData)
  // testData = getTestData(2 ** 16, false)
  // draw_base_map_vanilla(testData)
}

tf.setBackend('wasm').then(runTests)
