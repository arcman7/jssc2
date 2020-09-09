const path = require('path') //eslint-disable-line
// import pickle
const Enum = require('python-enum') //eslint-disable-line
const named_array = require(path.resolve(__dirname, './named_array.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))
const { namedtuple } = pythonUtils

function arrayEqual(a, b) {
  a.forEach((ele, i) => {
    try {
      expect(ele).toEqual(b[i])
    } catch (err) {
      // console.log('a: ', a, '\nb: ', b)
    }
  })
}
//Tests for lib.named_array.//
describe('named_array:', () => {
  test('  test_named_dict', () => {
    const a = new named_array.NamedDict({ a: 2, b: [1, 2] })
    expect(a['a']).toBe(a.a)
    expect(a['b']).toBe(a.b)
    expect(a['a']).not.toBe(a.b)
    a.c = 3
    expect(a['c']).toBe(3)
  })
  const TestEnum = Enum.IntEnum('TestEnum', {
    a: 0,
    b: 1,
    c: 2,
  })
  const BadEnum = Enum.IntEnum('BadEnum', {
    a: 1,
    b: 2,
    c: 3,
  })

  class TestNamedTuple extends namedtuple('TestNamedTuple', ['a', 'b', 'c']) {}

  test('  test_bad_names', () => {
    class BadNamedTuple extends namedtuple('BadNamedTuple', ['a', 'b']) {}
    const values = [1, 3, 6]
    const badNames = [
      null,
      [null],
      ['a'],
      ['a', 'b', 'c', 'd'],
      [[1, 'b', 3]],
      [BadEnum],
      [BadNamedTuple],
      [{ 'a': 0, 'b': 1, 'c': 2 }],
    ]
    badNames.forEach((badName) => {
      expect(() => named_array.NamedNumpyArray(values, badName)).toThrow(Error)
    })
  })
  test('  test_single_dimension:', () => {
    const values = [1, 3, 6]
    const singleNames = [
      ['list', ['a', 'b', 'c']],
      ['tuple', ['a', 'b', 'c']],
      ['list2', [['a', 'b', 'c']]],
      ['tuple2', [['a', 'b', 'c']]],
      ['list_tuple', [['a', 'b', 'c']]],
      ['named_tuple', TestNamedTuple],
      ['named_tuple2', [TestNamedTuple]],
      ['int_enum', TestEnum],
      ['int_enum2', [TestEnum]],
    ]
    singleNames.forEach((pair, i) => { //eslint-disable-line
      const [_, names] = pair //eslint-disable-line
      const a = named_array.NamedNumpyArray(values, names)
      const rawVals = [1, 3, 6]
      expect(a[0]).toBe(1)
      expect(a[1]).toBe(3)
      expect(a[2]).toBe(6)
      expect(a[2]).toBe(6)
      expect(a.a).toBe(1)
      expect(a.b).toBe(3)
      expect(a.c).toBe(6) // 7
      expect(a.d).toBe(undefined)
      expect(a['a']).toBe(1)
      expect(a['b']).toBe(3)
      expect(a['c']).toBe(6)
      expect(a['d']).toBe(undefined)
      // New axis = None
      // expect(a).toEqual([1, 3, 6])
      arrayEqual([1, 3, 6], a)
      // expect(a[np.newaxis], [[1, 3, 6]])
      // expect([[1, 3, 6]]).toEqual(a[null])
      // console.log([[1, 3, 6]], a[null])
      arrayEqual([[1, 3, 6]], a[null])
      // console.log([values], a[null])
      arrayEqual([rawVals], a[null])
      // expect(a[:, null], [[1], [3], [6]])
      // expect(a[null, :, null], [[[1], [3], [6]]])
      // expect(a[null, a % 3 == 0, null], [[[3], [6]]])
      // expect(a[null][null]).toEqual([[[1, 3, 6]]])
      arrayEqual([[rawVals]], a[null][null])
      arrayEqual(rawVals, a[null][0])
      // expect(a[null, 0], 1)
      // expect(a[null, 'a'], 1)
      expect(a[null][0].a).toBe(1)
      // expect(a[null][0, 'b'], 3)

      // range slicing
      // expect(a.slice(0, 2)).toEqual([1, 3])
      // expect(a.slice(1, 3)).toEqual([3, 6])
      arrayEqual(a.slice(0, 2), [1, 3])
      arrayEqual(a.slice(1, 3), [3, 6])
      // expect(a[0:2:], [1, 3])
      // expect(a[0:2:1], [1, 3])
      // expect(a[::2], [1, 6])
      // expect(a[::-1], [6, 3, 1])
      expect(a.slice(1, 3)[0]).toBe(3)
      expect(a.slice(1, 3).b).toBe(3)
      expect(a.slice(1, 3).c).toBe(6)

      // list slicing
      arrayEqual(a.valueAt([0, 0]), [1, 1])
      arrayEqual(a.valueAt([0, 1]), [1, 3])
      arrayEqual(a.valueAt([1, 0]), [3, 1])
      arrayEqual(a.valueAt([1, 2]), [3, 6])
      // expect(a[np.array([0, 2])]).toEqual([1, 6])
      const inds = named_array.NamedNumpyArray([0, 2], ['a', 'b'])
      // expect(a.valueAt(inds)).toEqual([1, 6])
      arrayEqual(a.valueAt(inds), [1, 6])
      expect(a.valueAt([1, 2]).b).toBe(3)
      expect(a.valueAt([2, 0]).c).toBe(6)

      a[1] = 4
      expect(a[1]).toBe(4)
      expect(a.b).toBe(4)
      expect(a['b']).toBe(4)

      // a[1:2] = 2
      // expect(a[1], 2)
      // expect(a.b).toBe(2)
      // expect(a['b']).toBe(2)

      // a[[1]] = 3
      // expect(a[1], 3)
      // expect(a.b, 3)
      // expect(a['b'], 3)

      a.b = 5
      expect(a[1]).toBe(5)
      expect(a.b).toBe(5)
      expect(a['b']).toBe(5)
    })
  })
  test('  test_empty_array:', () => {
    expect(() => named_array.NamedNumpyArray([], [null, ['a', 'b']])).not.toThrow(Error)
    // Must be the right length.
    expect(() => named_array.NamedNumpyArray([], ['a', 'b'])).toThrow(Error)
    // Returning an empty slice is not supported, and it's not clear how or
    // even if it should be supported.
    expect(() => named_array.NamedNumpyArray([], [['a', 'b'], null])).toThrow(Error)
    // Scalar arrays are unsupported.
    expect(() => named_array.NamedNumpyArray(1, [])).toThrow(Error)
  })
  test('  test_named_array_multi_first:', () => {
    const a = named_array.NamedNumpyArray([[1, 3], [6, 8]], [['a', 'b'], null])
    arrayEqual([1, 3], a.a)
    arrayEqual(a[1], [6, 8])
    arrayEqual(a['b'], [6, 8])
    // arrayEqual(a[::-1], [[6, 8], [1, 3]])
    // arrayEqual(a[::-1][::-1], [[1, 3], [6, 8]])
    // arrayEqual(a[::-1, ::-1], [[8, 6], [3, 1]])
    // arrayEqual(a[::-1][0], [6, 8])
    // arrayEqual(a[::-1, 0], [6, 1])
    // arrayEqual(a[::-1, 1], [8, 3])
    // arrayEqual(a[::-1].a, [1, 3])
    // arrayEqual(a[::-1].a[0], 1)
    // arrayEqual(a[::-1].b, [6, 8])
    arrayEqual(a.valueAt([0, 0]), [[1, 3], [1, 3]])
    expect(a.valueAt(0, 1)).toBe(3)
    expect(a.valueAt(0, 1)).toBe(3)
    expect(a.valueAt('a', 0)).toBe(1)
    expect(a.valueAt('b', 0)).toBe(6)
    expect(a.valueAt('b', 1)).toBe(8)
    expect(a.a[0]).toBe(1)
    arrayEqual(a.where((n) => n > 2), [3, 6, 8])
    arrayEqual(a.where((n) => n % 3 === 0), [3, 6])
    expect(a[0].a).toBe(undefined)
    // New axis = None
    arrayEqual([[1, 3], [6, 8]], a)
    // arrayEqual(a[np.newaxis], [[[1, 3], [6, 8]]])
    arrayEqual([[[1, 3], [6, 8]]], a[null])
    arrayEqual([[[1, 3], [6, 8]]], a[null].slice(0, 2))
    arrayEqual([[1, 3]], a.valueAt(null, 'a'))
    // arrayEqual(a[:, null], [[[1, 3]], [[6, 8]]])
    // arrayEqual(a[None, :, None], [[[[1, 3]], [[6, 8]]]])
    // arrayEqual(a[None, 0, None], [[[1, 3]]])
    // arrayEqual(a[None, 'a', None], [[[1, 3]]])
    arrayEqual(a[null][null], [[[[1, 3], [6, 8]]]])
    arrayEqual(a[null][0], [[1, 3], [6, 8]])
    arrayEqual(a[null][0].a, [1, 3])
    expect(a[null][0].a[0]).toBe(1)
    expect(a[null].valueAt(0, 'b', 1)).toBe(8)
  })
  test('  test_named_array_multi_second', () => {
    const a = named_array.NamedNumpyArray([[1, 3], [6, 8]], [null, ['a', 'b']])
    arrayEqual([1, 3], a[0])
    expect(a.valueAt(0, 1)).toBe(3)
    expect(a.valueAt(0, 'a')).toBe(1)
    expect(a.valueAt(0, 'b')).toBe(3)
    expect(a.valueAt(1, 'b')).toBe(8)
    expect(a[0].a).toBe(1)
    arrayEqual([3, 6, 8], a.where((n) => n > 2))
    arrayEqual([3, 6], a.where((n) => n % 3 == 0))
    // arrayEqual(a.valueAt(None, :, 'a'), [[1, 6]])
  })
  test('  test_slicing', () => {
    let a = named_array.NamedNumpyArray([1, 2, 3, 4, 5], 'abcde'.split(''))
    arrayEqual([1, 2, 3, 4, 5], a.slice(0))
    arrayEqual([2, 4], a.where((n) => n % 2 === 0))
    expect(a.where((n) => n % 2 === 0).b).toBe(2)
    a = named_array.NamedNumpyArray(
      [
        [[[0, 1], [2, 3]], [[4, 5], [6, 7]]],
        [[[8, 9], [10, 11]], [[12, 13], [14, 15]]]
      ],
      [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']]
    )
    expect(a.a.c.e.g).toBe(0)
    expect(a.b.c.f.g).toBe(10)
    expect(a.b.d.f.h).toBe(15)
    // arrayEqual(a[0, ..., 0], [[0, 2], [4, 6]])
    // arrayEqual(a[0, ..., 1], [[1, 3], [5, 7]])
    // arrayEqual(a[0, 0, ..., 1], [1, 3])
    // arrayEqual(a[0, ..., 1, 1], [3, 7])
    // arrayEqual(a[..., 1, 1], [[3, 7], [11, 15]])
    // arrayEqual(a[1, 0, ...], [[8, 9], [10, 11]])

    // arrayEqual(a["a", ..., "g"], [[0, 2], [4, 6]])
    // arrayEqual(a["a", ...], [[[0, 1], [2, 3]], [[4, 5], [6, 7]]])
    // arrayEqual(a[..., "g"], [[[0, 2], [4, 6]], [[8, 10], [12, 14]]])
    // arrayEqual(a["a", "c"], [[0, 1], [2, 3]])
    // arrayEqual(a["a", ...].c, [[0, 1], [2, 3]])
    // arrayEqual(a["a", ..., "g"].c, [0, 2])
  })
  test('  test_pickle', () => {
    const arr = named_array.NamedNumpyArray([1, 3, 6], ['a', 'b', 'c'])
    const pickled = arr.pickle()
    const unpickled = named_array.NamedNumpyArray(...JSON.parse(pickled))
    arrayEqual([1, 3, 6], arr)
    arrayEqual([1, 3, 6], unpickled)
    console.warn('Definitely need better pickling and pickling tests here')
  })
  test('  test_large_list_enum_properties', () => {
    const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const numbers2 = numbers.map((n) => n * 2)
    const numbers3 = numbers.map((n) => n * 3)
    const numbers4 = numbers.map((n) => n * 4)
    const Letters = Enum.IntEnum('Letters', {
      a: 0,
      b: 1,
      c: 2,
      d: 3,
      e: 4,
      f: 5,
      g: 6,
      h: 7,
      i: 8,
      j: 9,
      k: 10,
    })
    let arr = named_array.NamedNumpyArray([numbers, numbers2, numbers3, numbers4], [null, Letters])
    for (let index = 1; index <= 4; index++) {
      try {
        expect(arr[index - 1].a).toBe(index * 0)
        expect(arr[index - 1].b).toBe(index * 1)
        expect(arr[index - 1].c).toBe(index * 2)
        expect(arr[index - 1].d).toBe(index * 3)
        expect(arr[index - 1].e).toBe(index * 4)
        expect(arr[index - 1].f).toBe(index * 5)
        expect(arr[index - 1].g).toBe(index * 6)
        expect(arr[index - 1].h).toBe(index * 7)
        expect(arr[index - 1].i).toBe(index * 8)
        expect(arr[index - 1].j).toBe(index * 9)
        expect(arr[index - 1].k).toBe(index * 10)
      } catch (err) {
        console.error(`index = ${index}`)
        throw err
      }
    }

    const ABCD = Enum.IntEnum('ABCD', {
      'A': 0,
      'B': 1,
      'C': 2,
      'D': 3,
    })

    arr = named_array.NamedNumpyArray([[numbers], [numbers2], [numbers3], [numbers4]], [ABCD, null, null])
    expect(arr.A[0]).toMatchObject(numbers)
    expect(arr.B[0]).toMatchObject(numbers2)
    expect(arr.C[0]).toMatchObject(numbers3)
    expect(arr.D[0]).toMatchObject(numbers4)
  })
})
