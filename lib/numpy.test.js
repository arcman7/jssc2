const path = require('path');
const np = require(path.resolve(__dirname, './numpy.js'))

describe('numpy:', () => {
  test('cumsum', () => {
    const a = [1, 2, 3, 4]
    const b = np.cumsum(a)
    // b should look like [1, 3, 6, 10]
    expect(b.length).toBe(4)
    expect(b[0]).toBe(1)
    expect(b[1]).toBe(3)
    expect(b[2]).toBe(6)
    expect(b[3]).toBe(10)
  })
  test('arange', () => {
    let a = np.arange(5)
    expect(a.size).toBe(5)
    a = a.dataSync()
    expect(a[0]).toBe(0)
    expect(a[1]).toBe(1)
    expect(a[2]).toBe(2)
    expect(a[3]).toBe(3)
    expect(a[4]).toBe(4)
    a = np.arange(0, 5)
    expect(a.size).toBe(5)
    a = a.dataSync()
    expect(a[0]).toBe(0)
    expect(a[1]).toBe(1)
    expect(a[2]).toBe(2)
    expect(a[3]).toBe(3)
    expect(a[4]).toBe(4)
  })
  test('zeros', () => {
    let a = np.zeros([5])
    expect(a.size).toBe(5)
    a = a.dataSync()
    expect(a[0]).toBe(0)
    expect(a[1]).toBe(0)
    expect(a[2]).toBe(0)
    expect(a[3]).toBe(0)
    expect(a[4]).toBe(0)
    a = np.zeros([2, 2])
    expect(a.size).toBe(4)
    a = a.arraySync()
    expect(a[0][0]).toBe(0)
    expect(a[1][0]).toBe(0)
    expect(a[0][1]).toBe(0)
    expect(a[1][1]).toBe(0)
  })
  test('absolute (abs)', () => {
    const a = np.tensor([-1, 0.5, -0.5, 1])
    let b = np.abs(a)
    expect(a.size).toBe(4)
    expect(b.size).toBe(a.size)
    b = b.arraySync()
    expect(b[0]).toBe(1)
    expect(b[1]).toBe(0.5)
    expect(b[2]).toBe(0.5)
    expect(b[3]).toBe(1)
  })
  test('getCol', () => {
    const a = np.tensor([[1, 2, 3], [1, 2, 3], [1, 2, 3]])
    let b = np.getCol(a, 0)
    b = b.arraySync()[0]

    expect(b.length).toBe(3)
    expect(b[0]).toBe(1)
    expect(b[1]).toBe(1)
    expect(b[2]).toBe(1)

    b = np.getCol(a, 1)
    b = b.arraySync()[0]
    expect(b[0]).toBe(2)
    expect(b[1]).toBe(2)
    expect(b[2]).toBe(2)

    b = np.getCol(a, 2)
    b = b.arraySync()[0]
    expect(b[0]).toBe(3)
    expect(b[1]).toBe(3)
    expect(b[2]).toBe(3)
  })
})
