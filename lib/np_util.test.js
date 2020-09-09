const path = require('path') //eslint-disable-line
const np_util = require(path.resolve(__dirname, './np_util.js'))
const np = require(path.resolve(__dirname, './numpy.js'))
// Tests for np_util_iter.js.

describe('np_util_iter.js', () => {
  describe('  NpUtilTest', () => {
    test('testSummarizeArrayNoDiff1D', () => {
      var no_diff_1d = [[1, 2, 3, 4], [1, 2, 3, 4], ""]
      const a = no_diff_1d[0]
      const b = no_diff_1d[1]
      const result = np_util.summarize_array_diffs(a, b)
      expect(result).toBe(no_diff_1d[2])
    })
    test('testSummarizeArrayNoDiff2D', () => {
      var no_diff_2d = [[[1, 2], [3, 4]], [[1, 2], [3, 4]], ""]
      const a = no_diff_2d[0]
      const b = no_diff_2d[1]
      const result = np_util.summarize_array_diffs(a, b)
      expect(result).toBe(no_diff_2d[2])
    })
    test('testSummarizeArrayDiff1d', () => {
      var diff_1d = [[1, 2, 3, 4], [1, 3, 2, 4], "2 element(s) changed - [1]: 2 -> 3; [2]: 3 -> 2"]
      const a = diff_1d[0]
      const b = diff_1d[1]
      const result = np_util.summarize_array_diffs(a, b)
      expect(result).toBe(diff_1d[2])
    })
    test('testSummarizeArrayDiff2d', () => {
      var diff_2d = [[[1, 2], [3, 4]], [[1, 3], [2, 4]], "2 element(s) changed - [0][1]: 2 -> 3; [1][0]: 3 -> 2"]
      const a = diff_2d[0]
      const b = diff_2d[1]
      const result = np_util.summarize_array_diffs(a, b)
      expect(result).toBe(diff_2d[2])
    })
  })

  describe('  NpUtilTestTF', () => {
    test('testSummarizeArrayNoDiff1D', async () => {
      var no_diff_1d = [[1, 2, 3, 4], [1, 2, 3, 4], ""]
      const a = np.array(no_diff_1d[0])
      const b = np.array(no_diff_1d[1])
      const result = await np_util.summarize_array_diffs_tf(a, b)
      expect(result).toBe(no_diff_1d[2])
    })
    test('testSummarizeArrayNoDiff2D', async () => {
      var no_diff_2d = [[[1, 2], [3, 4]], [[1, 2], [3, 4]], ""]
      const a = np.array(no_diff_2d[0])
      const b = np.array(no_diff_2d[1])
      const result = await np_util.summarize_array_diffs_tf(a, b)
      expect(result).toBe(no_diff_2d[2])
    })
    test('testSummarizeArrayDiff1d', async () => {
      var diff_1d = [[1, 2, 3, 4], [1, 3, 2, 4], "2 element(s) changed - [1]: 2 -> 3; [2]: 3 -> 2"]
      const a = np.array(diff_1d[0])
      const b = np.array(diff_1d[1])
      const result = await np_util.summarize_array_diffs_tf(a, b)
      expect(result).toBe(diff_1d[2])
    })
    test('testSummarizeArrayDiff2d', async () => {
      var diff_2d = [[[1, 2], [3, 4]], [[1, 3], [2, 4]], "2 element(s) changed - [0][1]: 2 -> 3; [1][0]: 3 -> 2"]
      const a = np.array(diff_2d[0])
      const b = np.array(diff_2d[1])
      const result = await np_util.summarize_array_diffs_tf(a, b)
      expect(result).toBe(diff_2d[2])
    })
  })
})
