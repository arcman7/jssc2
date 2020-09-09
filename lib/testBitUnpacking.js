function unpackbits1a(uint8data) {
  const results = new Uint8Array(8 * uint8data.length)
  let byte;
  let offset;
  for (let i = 0|0, n = uint8data.length; i < n; i++) {
    byte = uint8data[i]
    offset = ((8|0) * i); // The "|0" on this line cut's the time almost in half!
    results[offset++] = (byte & ((1|0) << (7|0)))>>7|0;
    results[offset++] = (byte & ((1|0) << (6|0)))>>6|0;
    results[offset++] = (byte & ((1|0) << (5|0)))>>5|0;
    results[offset++] = (byte & ((1|0) << (4|0)))>>4|0;
    results[offset++] = (byte & ((1|0) << (3|0)))>>3|0;
    results[offset++] = (byte & ((1|0) << (2|0)))>>2|0;
    results[offset++] = (byte & ((1|0) << (1|0)))>>1|0;
    results[offset++] = (byte & (1|0));
  }
  return results
}

function unpackbits(uint8data) {
  const results = new Uint8Array(8 * uint8data.length)
  let byte
  let offset
  for (let i = 0; i < uint8data.length; i++) {
    byte = uint8data[i]
    offset = 8 * i
    results[offset + 7] = ((byte & (1 << 0)) >> 0)
    results[offset + 6] = ((byte & (1 << 1)) >> 1)
    results[offset + 5] = ((byte & (1 << 2)) >> 2)
    results[offset + 4] = ((byte & (1 << 3)) >> 3)
    results[offset + 3] = ((byte & (1 << 4)) >> 4)
    results[offset + 2] = ((byte & (1 << 5)) >> 5)
    results[offset + 1] = ((byte & (1 << 6)) >> 6)
    results[offset + 0] = ((byte & (1 << 7)) >> 7)
  }
  return results
}


function unpackbitsToShape1(uint8data, shape = [1, 1]) {
  var data = unpackbits(uint8data)
  const dims = [shape[0] | 0, shape[1] | 0]
  const result = new Array(dims[0])
  let temp
  const width =  0 | dims[1]
  for (let i = 0 | 0; i < dims[0]; i++) {
    temp = new Array(dims[1])
    for (let j = 0| 0; j < dims[1]; j++) {
      temp[j] = data[uint8data[i * width + j]]
    }
    result[i] = temp
  }
  return result
}

function unpackbitsToShape2(uint8data, shape = [1, 1]) {
  var data = unpackbits(uint8data)
  const dims = [shape[0] | 0, shape[1] | 0]
  const result = new Array(dims[0])
  const width = dims[1]
  let offset
  for (let i = 0 | 0; i < dims[0]; i++) {
    offset = (width * i)
    result[i] = data.slice(offset, offset + width)
  }
  return result
}

function unpackbitsToShape3(uint8data, shape = [1, 1]) {
  const dims = [0 | shape[0], 0 | shape[1]]
  const result = new Array(dims[0])
  let position = 0 | 0
  const smallCount = 0 | (uint8data.length % dims[0])
  const bigCount = 0 | (uint8data.length - smallCount)
  const bigByteChunk = 0 | (bigCount / dims[0])
  const bigBitWidth = 0 | 8 * bigByteChunk
  const smallByteChunk = 0 | (smallCount / dims[0])
  const smallBitWidth = 0 | 8 * smallByteChunk
  if (smallCount) {
    let big
    let small
    let odd
    let temp
    for (let i = 0 | 0; i < dims[0]; i++) {
      temp = new Uint8Array(dims[1])
      odd = i % 2
      big = unpackbits(uint8data.subarray(position, position + bigByteChunk))
      position += bigByteChunk
      if (odd) {
        temp.set(small.subarray(smallBitWidth, 8), 0)
        temp.set(big, smallBitWidth)
        result[i] = temp
      } else {
        temp.set(big, 0)
        small = unpackbits(uint8data.subarray(position, position + 1))
        position++
        temp.set(small.subarray(0, smallBitWidth), bigBitWidth)
        result[i] = temp
      }
    }
    return result
  }
  for (let i = 0 | 0; i < dims[0]; i++) {
    // console.log('unpacking: ', uint8data.subarray(position, position + bigByteChunk))
    result[i] = unpackbits(uint8data.subarray(position, position + bigByteChunk))
    position += bigByteChunk
  }
  return result
}

var tf = require('@tensorflow/tfjs')
tf = require('@tensorflow/tfjs-node')
function unpackBitsToShapeTensorflow(uint8data, shape) {
  return tf.tensor(unpackbits(uint8data), shape, 'int32')
}

var test64by64 = new Uint8Array(512)
for (let i = 0; i < test64by64.length; i++) {
  test64by64[ i ] = Math.floor(256 * Math.random());
}
var test84by84 = new Uint8Array(882)
for (let i = 0; i < test84by84.length; i++) {
  test84by84[ i ] = Math.floor(256 * Math.random());
}
var test100by100 = new Uint8Array(1250)
for (let i = 0; i < test100by100.length; i++) {
  test100by100[ i ] = Math.floor(256 * Math.random());
}

function assert(condition, errMsg) {
  if (!condition) {
    console.error(errMsg)
  }
}

console.log('********* 64 x 64 *********\n\n')
console.log('Starting unpackbits1a.');
console.time('u1a');
var foo = unpackbits1a(test64by64);
console.timeEnd('u1a');
console.log('Finished unpackbits1a.');
console.log('Starting "unpackbits"');
console.time('u-orig');
foo = unpackbits(test64by64);
console.timeEnd('u-orig');
console.log('Finished unpackbits.');


console.log('Starting "unpackbitsToShape1"');
console.time('u1');
foo = unpackbitsToShape1(test64by64, [64, 64])
console.timeEnd('u1');
assert(
  foo.length === 64 && foo[0].length === 64,
  'foo.length === 64 && foo[0].length === 64'
)
console.log('Finished unpackbitsToShape1.');


console.log('Starting "unpackbitsToShape2"');
console.time('u2');
foo = unpackbitsToShape2(test64by64, [64, 64])
console.timeEnd('u2');
assert(
  foo.length === 64 && foo[0].length === 64,
  'foo.length === 64 && foo[0].length === 64'
)
console.log('Finished unpackbitsToShape2.');

console.log('Starting "unpackbitsToShape3"');
console.time('u3');
foo = unpackbitsToShape3(test64by64, [64, 64])
console.timeEnd('u3');
assert(
  foo.length === 64 && foo[0].length === 64,
  'foo.length === 64 && foo[0].length === 64'
)
console.log('Finished unpackbitsToShape3.');

foo = unpackBitsToShapeTensorflow(test64by64, [64, 64])
console.log('\nStarting "unpackBitsToShapeTensorflow"')
console.time('u-tensor')
foo = unpackBitsToShapeTensorflow(test64by64, [64, 64])
console.timeEnd('u-tensor')
console.log('Finished unpackBitsToShapeTensorflow.');


console.log('\n\n********* 84 x 84 *********\n\n')
console.log('Starting unpackbits1a.');
console.time('u1a');
foo = unpackbits1a(test84by84);
console.timeEnd('u1a');
console.log('Finished unpackbits1a.');
console.log('Starting "unpackbits"');
console.time('u-orig');
foo = unpackbits(test84by84);
console.timeEnd('u-orig');
console.log('Finished unpackbits.');


console.log('Starting "unpackbitsToShape1"');
console.time('u1');
foo = unpackbitsToShape1(test84by84, [84, 84])
console.timeEnd('u1');
assert(
  foo.length === 84 && foo[0].length === 84,
  'foo.length === 84 && foo[0].length === 84'
)
console.log('Finished unpackbitsToShape1.');


console.log('Starting "unpackbitsToShape2"');
console.time('u2');
foo = unpackbitsToShape2(test84by84, [84, 84])
console.timeEnd('u2');
assert(
  foo.length === 84 && foo[0].length === 84,
  'foo.length === 84 && foo[0].length === 84'
)
console.log('Finished unpackbitsToShape2.');

console.log('Starting "unpackbitsToShape3"');
console.time('u3');
foo = unpackbitsToShape3(test84by84, [84, 84])
console.timeEnd('u3');
assert(
  foo.length === 84 && foo[0].length === 84,
  'foo.length === 84 && foo[0].length === 84'
)
console.log('Finished unpackbitsToShape3.');

console.log('\nStarting "unpackBitsToShapeTensorflow"')
console.time('u-tensor')
foo = unpackBitsToShapeTensorflow(test84by84, [84, 84])
console.timeEnd('u-tensor')
console.log('Finished unpackBitsToShapeTensorflow.');


console.log('\n\n********* 100 x 100 *********\n\n')
console.log('Starting unpackbits1a.');
console.time('u1a');
foo = unpackbits1a(test100by100);
console.timeEnd('u1a');
console.log('Finished unpackbits1a.');
console.log('Starting "unpackbits"');
console.time('u-orig');
foo = unpackbits(test100by100);
console.timeEnd('u-orig');
console.log('Finished unpackbits.');


console.log('Starting "unpackbitsToShape1"');
console.time('u1');
foo = unpackbitsToShape1(test100by100, [100, 100])
console.timeEnd('u1');
assert(
  foo.length === 100 && foo[0].length === 100,
  'foo.length === 100 && foo[0].length === 100'
)
console.log('Finished unpackbitsToShape1.');


console.log('Starting "unpackbitsToShape2"');
console.time('u2');
foo = unpackbitsToShape2(test100by100, [100, 100])
console.timeEnd('u2');
assert(
  foo.length === 100 && foo[0].length === 100,
  'foo.length === 100 && foo[0].length === 100'
)
console.log('Finished unpackbitsToShape2.');

console.log('Starting "unpackbitsToShape3"');
console.time('u3');
foo = unpackbitsToShape3(test100by100, [100, 100])
console.timeEnd('u3');
assert(
  foo.length === 100 && foo[0].length === 100,
  'foo.length === 100 && foo[0].length === 100'
)
console.log('Finished unpackbitsToShape3.');

console.log('\nStarting "unpackBitsToShapeTensorflow"')
console.time('u-tensor')
foo = unpackBitsToShapeTensorflow(test100by100, [100, 100])
console.timeEnd('u-tensor')
console.log('Finished unpackBitsToShapeTensorflow.');


console.log('\n\n=================== array equals [broadcast ele] ===================\n\n');
(async () => {
  async function xy_locs(mask) {
    // Javascript: Assuming mask is an array of bools
    // Mask should be a set of bools from comparison with a feature layer.//
    return (await tf.whereAsync(mask)).arraySync()//.map(([x, y]) => new point.Point(x, y))
  }
  console.log('********* 64 x 64 *********\n\n')
  foo = unpackbitsToShape2(test64by64, [64, 64])
  console.time('js')
  var _xy_locs = [] //eslint-disable-line
  foo.forEach((row, y) => {
    row.forEach((colVal, x) => {
      if (colVal === 1) {
        _xy_locs.push([x, y])
      }
    })
  })
  console.timeEnd('js')
  assert(_xy_locs[0].length === 2, 'xy_locs[0].length === 2')
  _xy_locs.forEach(([x, y]) => {
    assert(foo[y][x] === 1, `foo[y][x] === 1, got: ${foo[y][x]}`)
  })

  foo = unpackBitsToShapeTensorflow(test64by64, [64, 64]);
  _xy_locs = await xy_locs(foo.equal([1]))
  console.time('tf')
  _xy_locs = await xy_locs(foo.equal([1]))
  console.timeEnd('tf')
  foo = foo.arraySync()
  _xy_locs.forEach(([x, y]) => {
    assert(foo[x][y] == 1, `foo[x][y] === 1, got: ${foo[x][y]}`)
  })


  console.log('\n\n********* 84 x 84 *********\n\n')
  foo = unpackbitsToShape2(test84by84, [84, 84])
  console.time('js')
  var _xy_locs = [] //eslint-disable-line
  foo.forEach((row, y) => {
    row.forEach((colVal, x) => {
      if (colVal === 1) {
        _xy_locs.push([x, y])
      }
    })
  })
  console.timeEnd('js')
  assert(_xy_locs[0].length === 2, 'xy_locs[0].length === 2')
  _xy_locs.forEach(([x, y]) => {
    assert(foo[y][x] === 1, `foo[y][x] === 1, got: ${foo[y][x]}`)
  })

  foo = unpackBitsToShapeTensorflow(test84by84, [84, 84]);
  console.time('tf')
  _xy_locs = await xy_locs(foo.equal([1]))
  console.timeEnd('tf')
  foo = foo.arraySync()
  _xy_locs.forEach(([x, y]) => {
    assert(foo[x][y] == 1, `foo[x][y] === 1, got: ${foo[x][y]}`)
  })

  console.log('\n\n********* 100 x 100 *********\n\n')
  foo = unpackbitsToShape2(test100by100, [100, 100])
  console.time('js')
  var _xy_locs = [] //eslint-disable-line
  foo.forEach((row, y) => {
    row.forEach((colVal, x) => {
      if (colVal === 1) {
        _xy_locs.push([x, y])
      }
    })
  })
  console.timeEnd('js')
  assert(_xy_locs[0].length === 2, 'xy_locs[0].length === 2')
  _xy_locs.forEach(([x, y]) => {
    assert(foo[y][x] === 1, `foo[y][x] === 1, got: ${foo[y][x]}`)
  })

  foo = unpackBitsToShapeTensorflow(test100by100, [100, 100]);
  console.time('tf')
  _xy_locs = await xy_locs(foo.equal([1]))
  console.timeEnd('tf')
  foo = foo.arraySync()
  _xy_locs.forEach(([x, y]) => {
    assert(foo[x][y] == 1, `foo[x][y] === 1, got: ${foo[x][y]}`)
  })
})()
