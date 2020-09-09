/*eslint-disable*/
var Enum = require('python-enum')
var pythonUtils = require('./pythonUtils.js')

var { isinstance } = pythonUtils
/*
   var foo = named_array.NamedNumpyArray([1, 3, 6], ["a", "b", "c"])
              col   
  dimension    0     
     a         1        
     b         3
     c         6

  usage: foo.a => 1, foo.b => 3, foo.c => 6

  var bar = named_array.NamedNumpyArray([[1, 3], [6, 8]], [["a", "b"], None])
              col   col
  dimension    0     1
     a (0)     1     3 
     b (1)     6     8

  usage: bar.a => [1,3], bar.a[0] => 1, bar.a[1] => 3
  usage: bar.b => [6,8], bar.b[0] => 6, bar.b[1] => 8
    
  var baz = named_array.NamedNumpyArray([[1, 3], [6, 8]], [None, ["a", "b"]])
  
              col           col       
  dimension    a             b
  None (0)     1             3
  None (1)     6             8

  usage: bar[0] => [1,3], bar[0].a => 1, bar[0].a => 3
  usage: bar[1] => [6,8], bar[0].b => 6, bar[1].b => 8
*/
// function permutations(arr) {
//   if (arr.length === 0) {
//     return []
//   }
//   var eles = arr.concat([])
//   var results = [[eles.shift()]] 
//   while (eles.length) {
//     const currLetter = eles.shift()
//     let tmpResults = []
//     results.forEach(result => {
//       let rIdx = 0
//       while (rIdx <= result.length) {
//           const tmp = [...result]
//           tmp.splice(rIdx, 0, currLetter)
//           tmpResults.push(tmp)
//           rIdx++
//       }
//     })
//     results = tmpResults
//   }
//   return results
//   .map(combosArray => combosArray)
//   .filter((el, idx, self) => (self.indexOf(el) === idx))
// }
// function assign(values, name, keyPathArray) {
//   let value = values
//   // console.log('assign\n\t value: ', value, '\n\tname: ', name, '\n\tkeyPathArray: ', keyPathArray)
//   let parent
//   while (keyPathArray.length) {
//     if (keyPathArray.length === 1) {
//       parent = value
//     }
//     value = value[keyPathArray.shift()]
//   }
//   // console.log('parent: ', parent)
//   // console.log('value: ', value)
//   parent[name] = value
// }
// function unpack(values, names, nameIndex = 0, keyPathArray = []) {
//   // console.log('nameIndex: ' + nameIndex + '\nkeyPathArray: ' + JSON.stringify(keyPathArray))
//   //sanitize input
//   if (isinstance(names, Enum.EnumMeta)) {
//     names = names.member_names_
//   } else if (names.contructor && names.constructor._fields) {
//     names = names.constructor._fields
//   } else if (!Array.isArray(names)) {
//     names = Object.keys(names)
//   }
//   const nameList = names[nameIndex]
//   // console.log('nameList: ', nameList)
//   if (nameList === null || nameList === undefined) {
//     return
//   }
//   nameList.forEach((name, index) => {
//     assign(values, name, keyPathArray.concat(index))
//     unpack(values, names, nameIndex + 1, keyPathArray.concat(index))
//   })
// }

function assign(values, name, keyPathArray) {
  let value = values
  let parent
  let index
  let lookUpIndex
  if (name === null) {
    return
  }
  while (keyPathArray.length) {
    if (keyPathArray.length === 1) {
      parent = value
    }
    index = keyPathArray.shift()
    lookUpIndex = index
    value = value[index]
  }
  Object.defineProperty(parent, name, {
    get: function() { return parent[lookUpIndex] },
    set: function(val) { parent[lookUpIndex] = val; return val }
  })
}
function unpack(values, names, nameIndex = 0, keyPathArray = []) {
  //sanitize input
  if (isinstance(names, Enum.EnumMeta)) {
    names = names.member_names_
  } else if (names.contructor && names.constructor._fields) {
    names = names.constructor._fields
  } else if (!Array.isArray(names)) {
    names = Object.keys(names)
  }
  let nameList = names[nameIndex]
  if (nameList === undefined) {
    return
  }
  if (nameList === null) {
    nameList = names
  }
  if (typeof nameList === 'string') {
    nameList = names
  } else if (nameList.constructor && nameList.constructor._fields) {
    nameList = nameList.constructor._fields
  } else if (isinstance(nameList, Enum.EnumMeta)) {
    nameList = nameList.member_names_
  }
  try {
    nameList.forEach((name, index) => {
      assign(values, name, keyPathArray.concat(index))
      unpack(values, names, nameIndex + 1, keyPathArray.concat(index))
    })
  } catch (err) {
    console.log('nameList: ', nameList, ' nameIndex: ', nameIndex, '\nerr: ', err)
  }
}
var values = [[[[0, 1], [2, 3]], [[4, 5], [6, 7]]],
         [[[8, 9], [10, 11]], [[12, 13], [14, 15]]]]
var names = [["a", "b"], ["c", "d"], ["e", "f"], ["g", "h"]]
unpack(values, names)

console.log(values.a)
console.log(values.b)
console.log(values.a.c)
console.log(values.b.c)
console.log(values.a.d)
console.log(values.b.d)
console.log(values.a.c.e)
console.log(values.b.c.e)
console.log(values.a.c.f)
console.log(values.b.c.f)
console.log(values.a.c.e.g)
console.log(values.b.c.e.g)
console.log(values.a.c.e.h)
console.log(values.b.c.e.h)
console.log(values.a.c.f.g)
console.log(values.b.c.f.g)
console.log(values.a.c.f.h)
console.log(values.b.c.f.h)



// var named_array = require('./named_array.js');

// var values = [1, 3, 6];
// var names = ['a', 'b', 'c'];
// var a = named_array.NamedNumpyArray(values, names);
console.log('here')
var v = [[1, 3], [6, 8]]
unpack(v, [null, ['a', 'b']])
console.log(v)
console.log(v[0].a)
// var a = named_array.NamedNumpyArray([[1, 3], [6, 8]], [null, ['a', 'b']])
// for (var i in a) { console.log(i) }

// a.a = 10
// console.log(a.a)





// function assign(values, name, keyPathArray) {
//   let value = values
//   let parent
//   while (keyPathArray.length) {
//     if (keyPathArray.length === 1) {
//       parent = value
//     }
//     value = value[keyPathArray.shift()]
//   }
//   parent[name] = value
// }
// function unpack(values, names, nameIndex = 0, keyPathArray = []) {
//   //sanitize input
//   if (names.contructor && names.constructor._fields) {
//     names = names.constructor._fields
//   } else if (!Array.isArray(names)) {
//     names = Object.keys(names)
//   }
//   const nameList = names[nameIndex]
//   if (nameList === null || nameList === undefined) {
//     return
//   }
//   nameList.forEach((name, index) => {
//     assign(values, name, keyPathArray.concat(index))
//     unpack(values, names, nameIndex + 1, keyPathArray.concat(index))
//   })
// }
// class Test extends Array {// extends np.ndarray:
//   constructor(values, names) {
//     super(...values)
//     const obj = values

//     // Validate names!
//     const index_names = []
    
//     const copy = values.map((e) => e)
//     obj._named_array_values = copy
//     // Finally convert to a NamedNumpyArray.
//     obj._index_names = index_names // [{name: index}, ...], dict per dimension.
//     unpack(this, names)
//   }

//   valueAt() {
//     let value = this
//     let args = arguments //eslint-disable-line
//     if (Array.isArray(args[0])) {
//       args = args[0]
//     }
//     if (args[0]._named_array_values) {
//       args = args[0]._named_array_values
//     }
//     for (let i = 0; i < args.length; i++) {
//       value = value[args[i]]
//     }
//     return value
//   }
// }




/*
[1, 2, 3] "foo"
[1, 2, 3] ["foo", "bar", "baz"]
[[1], [2], [3]], ["foo", "bar", "baz"]
*/

// function traverse(arr, previousIndexs, cb) {
//   if (!Array.isArray(arr)) {
//     cb(arr, previousIndexs)
//     return
//   }
//   arr.forEach((ele, index) => {
//     if (Array.isArray(ele)) {
//       traverse(ele, previousIndexs.concat(index), cb)
//     } else {
//       cb(ele, previousIndexs.concat(index))
//     }
//   })
// }


// function test(values, names) {
//   const obj = {}
//   function assign(name, keyPathArray)  {
//     let cur = values
//     while (keyPathArray.length) {
//       cur = values[keyPathArray.shift()]
//     }
//     obj[name] = cur
//   }
//   traverse(names, [], assign)
//   console.log(obj)
//   return obj
// }

// test([1,2,3], 'foo')
// test([1,2,3], ['foo', 'bar', 'baz'])
// test([[1],[2],[3]], ['foo', 'bar', 'baz'])
// test([[1],[2],[3]], [ [ 'a', 'b', 'c' ] ])