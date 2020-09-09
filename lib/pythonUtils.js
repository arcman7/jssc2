const os = require('os') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const { common_pb, raw_pb, spatial_pb, ui_pb } = s2clientprotocol

/*eslint-disable no-use-before-define*/

class ABCMeta {
  static get abstractMethods() { return [] }

  constructor() {
    const abstractMethods = this.constructor.abstractMethods
    function NotImplementedError(message) {
      this.name = "NotImplementedError"
      this.message = (message || "")
    }
    NotImplementedError.prototype = Error.prototype
    Object.keys(abstractMethods).forEach((key) => {
      const methodName = abstractMethods[key]
      /* keeping this comment for inheritance blocking in the future */
      // if (!this.constructor.prototype.hasOwnProperty(methodName) || typeof this.constructor.prototype[methodName] !== 'function') {
      //   throw new NotImplementedError(methodName)
      // }
      if (typeof this.constructor.prototype[methodName] !== 'function') {
        throw new NotImplementedError(methodName)
      }
    })
  }
}

function any(iterable) {
  for (let index = 0; index < iterable.length; index++) {
    if (iterable[index]) return true
  }
  return false
}

function arrayCompare(a, b, sameOrder = false) {
  if (sameOrder) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false
      }
    }
    return true
  }
  const aSeen = {}
  const bSeen = {}
  for (let i = 0; i < a.length; i++) {
    aSeen[a[i]] = true
    bSeen[b[i]] = true
  }
  for (let i = 0; i < a.length; i++) {
    if (!(aSeen[a[i]] && bSeen[a[i]])) {
      return false
    }
  }
  return true
}

function arrayDtype(array) {
  if (array.length == null) {
    return typeof (array)
  }
  return arrayDtype(array[0])
}

function arrayShape(arr, zeroFirst) {
  if (arr.length > 1) {
    zeroFirst = true
  }
  if (typeof arr[0] == 'object') {
    zeroFirst = false
  }
  if (arr.shape) {
    return arr.shape
  }
  const shape = []
  let keepGoing = true
  if (!Array.isArray(arr)) {
    throw new Error('@param arr must be an array. Got: ' + arr)
  }
  if (zeroFirst && !Array.isArray(arr[0])) {
    shape.push(0)
  }
  while (keepGoing) {
    shape.push(arr.length)
    arr = arr[0]
    keepGoing = Array.isArray(arr)
  }
  return shape
}

function arraySub(a, b) {
  // This function operates subtraction with 1D or 2d array
  const result = []
  const c = []
  if (a.length === 0) {
    if (b.length === 0) {
      return []
    }
    return b
  }
  if (a[0].length === undefined) {
    for (let i = 0; i < a.length; i++) {
      result.push(a[i] - b[i])
    }
  } else {
    for (let row = 0; row < a.length; row++) {
      for (let col = 0; col < a[0].length; col++) {
        c.push(a[row][col] - b[row][col])
      }
    }
    while (c.length) { result.push(c.splice(0, a[0].length)) }
  }
  return result
}

function assert(cond, errMsg) {
  if (cond === false) {
    throw new Error(errMsg)
  }
}

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

function compareKey(a, b, key) {
  if (Array.isArray(a)) {
    return arrayCompare(a, b)
  }
  return a[key] === b[key]
}

function compareAIF(a, b) {
  assert(compareKey(a, b, 'feature_dimensions'), "compareKey(a, b, 'feature_dimensions'")
  assert(compareKey(a, b, 'rgb_dimensions'), "compareKey(a, b, 'rgb_dimensions')")
  assert(compareKey(a, b, 'raw_resolution'), "compareKey(a, b, 'raw_resolution')")
  assert(compareKey(a, b, 'action_space'), "compareKey(a, b, 'action_space')")
  assert(compareKey(a, b, 'camera_width_world_units'), "compareKey(a, b, 'camera_width_world_units')")
  assert(compareKey(a, b, 'use_feature_units'), "compareKey(a, b, 'use_feature_units')")
  assert(compareKey(a, b, 'use_raw_units'), "compareKey(a, b, 'use_raw_units')")
  assert(compareKey(a, b, 'use_raw_actions'), "compareKey(a, b, 'use_raw_actions')")
  assert(compareKey(a, b, 'max_raw_actions'), "compareKey(a, b, 'max_raw_actions')")
  assert(compareKey(a, b, 'max_selected_units'), "compareKey(a, b, 'max_selected_units')")
  assert(compareKey(a, b, 'use_unit_counts'), "compareKey(a, b, 'use_unit_counts')")
  assert(compareKey(a, b, 'use_camera_position'), "compareKey(a, b, 'use_camera_position')")
  assert(compareKey(a, b, 'show_cloaked'), "compareKey(a, b, 'show_cloaked')")
  assert(compareKey(a, b, 'show_burrowed_shadows'), "compareKey(a, b, 'show_burrowed_shadows')")
  assert(compareKey(a, b, 'show_placeholders'), "compareKey(a, b, 'show_placeholders')")
  assert(compareKey(a, b, 'hide_specific_actions'), "compareKey(a, b, 'hide_specific_actions')")
  assert(compareKey(a, b, 'action_delay_fn'), "compareKey(a, b, 'action_delay_fn')")
  assert(compareKey(a, b, 'send_observation_proto'), "compareKey(a, b, 'send_observation_proto')")
  assert(compareKey(a, b, 'crop_to_playable_area'), "compareKey(a, b, 'crop_to_playable_area')")
  assert(compareKey(a, b, 'raw_crop_to_playable_area'), "compareKey(a, b, 'raw_crop_to_playable_area')")
  assert(compareKey(a, b, 'allow_cheating_layers'), "compareKey(a, b, 'allow_cheating_layers')")
  assert(compareKey(a, b, 'add_cargo_to_units'), "compareKey(a, b, 'add_cargo_to_units')")
}

function compareObsSpec(a, b) {
  assert(compareKey(a, b, "action_result"))
  assert(compareKey(a, b, "alerts"))
  assert(compareKey(a, b, "build_queue"))
  assert(compareKey(a, b, "cargo"))
  assert(compareKey(a, b, "cargo_slots_available"))
  assert(compareKey(a, b, "control_groups"))
  assert(compareKey(a, b, "game_loop"))
  assert(compareKey(a, b, "last_actions"))
  assert(compareKey(a, b, "map_name"))
  assert(compareKey(a, b, "multi_select"))
  assert(compareKey(a, b, "player"))
  assert(compareKey(a, b, "production_queue"))
  assert(compareKey(a, b, "score_cumulative"))
  assert(compareKey(a, b, "score_by_category"))
  assert(compareKey(a, b, "score_by_vital"))
  assert(compareKey(a, b, "single_select"))
}

function eq(a, b) {
  if (a.__eq__) {
    return a.__eq__(b)
  }
  if (b.__eq__) {
    return b.__eq__(a)
  }
  return a === b
}

function expanduser(path) {
  const homedir = os.homedir()
  path = path.replace(/~user/g, homedir)
  path = path.replace(/~/g, homedir)
  path = path.replace(/\\/g, '/')
  return path
}

//eslint-disable-next-line
Array.prototype.extend = function(array) {
  for (let i = 0; i < array.length; i++) {
    this.push(array[i])
  }
}
//eslint-disable-next-line
Object.defineProperty(Array.prototype, 'extend', {
  value: Array.prototype.extend,
  iterable: false,
  enumerable: false,
})

function getArgNames(func) {
  // First match everything inside the function argument parens.
  const args = func.toString().match(/function\s.*?\(([^)]*)\)/)[1]

  // Split the arguments string into an array comma delimited.
  return args.split(',').map(function(arg) {
    // Ensure no inline comments are parsed and trim the whitespace.
    return arg.replace(/\/\*.*\*\//, '').trim()
  }).filter(function(arg) {
    // Ensure no undefined values are added.
    return arg
  })
}
function getArgsArray(func, kwargs) {
  if (getArgsArray.argSignatures[func.name]) {
    return getArgsArray.argSignatures[func.name].map((argName) => kwargs[argName])
  }
  getArgsArray.argSignatures[func.name] = getArgNames(func)
  return getArgsArray.argSignatures[func.name].map((argName) => kwargs[argName])
}
getArgsArray.argSignatures = {}
getArgsArray.getArgNames = getArgNames
//eslint-disable-next-line
String.prototype.splitlines = function() {
  return this.split(/\r?\n/)
}

function getImageData(unit8data, [width, height], rgb = true, color, palette) {
  const multiplier = 1
  const bytes = new Uint8ClampedArray(width * height * 4);
  const a = Math.round(255);

  if (rgb) {
    for (let i = 0; i < height * width; ++i) {
      const r = unit8data[i * 3] * multiplier;
      const g = unit8data[i * 3 + 1] * multiplier;
      const b = unit8data[i * 3 + 2] * multiplier;
      const j = i * 4;
      // start craft 2 api appears to be switching the red and blue channels
      bytes[j + 0] = b | 0;
      bytes[j + 1] = g | 0;
      bytes[j + 2] = r | 0;
      bytes[j + 3] = a;
    }
  } else if (palette) {
    for (let i = 0; i < height * width; ++i) {
      const j = i * 4;
      if (unit8data[i]) {
        color = palette[unit8data[i]]
        bytes[j + 0] = color[0] | 0;
        bytes[j + 1] = color[1] | 0;
        bytes[j + 2] = color[2] | 0;
        bytes[j + 3] = a;
      } else {
        bytes[j + 0] = 0;
        bytes[j + 1] = 0;
        bytes[j + 2] = 0;
        bytes[j + 3] = a;
      }
    }
  } else if (color) {
    for (let i = 0; i < height * width; ++i) {
      const j = i * 4;
      if (unit8data[i]) {
        bytes[j + 0] = color[0] | 0;
        bytes[j + 1] = color[1] | 0;
        bytes[j + 2] = color[2] | 0;
        bytes[j + 3] = a;
      } else {
        bytes[j + 0] = 0;
        bytes[j + 1] = 0;
        bytes[j + 2] = 0;
        bytes[j + 3] = a;
      }
    }
  } else {
    for (let i = 0; i < height * width; ++i) {
      const r = unit8data[i] * multiplier;
      const g = r
      const b = r
      const j = i * 4;
      bytes[j + 0] = r | 0;
      bytes[j + 1] = g | 0;
      bytes[j + 2] = b | 0;
      bytes[j + 3] = a;
    }
  }

  return new ImageData(bytes, width, height);
}

function hashCode(str) {
// https://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
  var hash = 0;
  if (str.length == 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash; // Convert to 32bit integer
  }
  return hash;
}

function getattr(proto, key) {
  if (proto[`get${snakeToPascal(key)}`]) {
    return proto[`get${snakeToPascal(key)}`]()
  }
  if (proto[`get${snakeToPascal(key)}List`]) {
    return proto[`get${snakeToPascal(key)}List`]()
  }
  return null
}

//eslint-disable-next-line
String.prototype.ljust = function(length, char = ' ') {
  const fill = []
  while (fill.length + this.length < length) {
    fill[fill.length] = char;
  }
  return this + fill.join('');
}
//eslint-disable-next-line
String.prototype.rjust = function(length, char = ' ') {
  const fill = []
  while (fill.length + this.length < length) {
    fill[fill.length] = char;
  }
  return fill.join('') + this;
}

function int(numOrStr) {
  return Math.floor(numOrStr)
}

//eslint-disable-next-line
String.prototype.lpad = function(length, char = ' ') {
  const fill = Array(length);
  for (let i = 0; i < length; i++) {
    fill[i] = char;
  }
  return this + fill.join('');
}
//eslint-disable-next-line
String.prototype.rpad = function(length, char = ' ') {
  const fill = Array(length);
  for (let i = 0; i < length; i++) {
    fill[i] = char;
  }
  return fill.join('') + this;
}
//eslint-disable-next-line
String.prototype.center = function(space, char) {
  const usedSpace = Math.floor(space / 2)
  return this.padStart(this.length + usedSpace, char) + ''.padStart(usedSpace, char)
}
function isinstance(a, compare) {
  const keys = Object.keys(compare);
  if (Array.isArray(compare) && keys.length) {
    for (let i = 0; i < keys.length; i++) {
      if (isinstance(a, compare[keys[i]])) {
        return true
      }
    }
    return false
  }
  if (compare === Number) {
    return Number(a) === a
  }
  if (compare === Boolean) {
    return Boolean(a) === a
  }
  if (compare === String) {
    return String(a) === a
  }
  return a instanceof compare;
}

function isObject(a) {
  return a === Object(a)
}

function iter(container) {
  if (container.__iter__) {
    return container.__iter__()
  }
  if (len(container)) {
    return Object.keys(container).map((key) => container[key])
  }
  throw new Error('ValueError: Cannont iterate over non-iterable')
}

function len(container) {
  if (container.__len__) {
    return container.__len__()
  }
  return Object.keys(container).length;
}

function map(func, collection) {
  function clone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    const copy = obj.constructor();
    for (let attr in obj) {//eslint-disable-line
      if (obj.hasOwnProperty(attr)) {
        copy[attr] = obj[attr];
      }
    }
    return copy;
  }
  const copy = clone(collection)
  Object.keys(copy).forEach((key) => {
    collection[key] = func(collection[key])
  })
}

function namedtuple(name, fields) {
  let consArgs = '';
  fields.forEach((field, i) => {
    consArgs += i < fields.length - 1 ? `${field}, ` : `${field}`;
  });
  const classStr = `const _fields = ${JSON.stringify(fields)}; return class ${name} extends Array {
  static get classname() { return '${name}' }
  static get _fields() { return ${JSON.stringify(fields)} }
  constructor(${consArgs}) {
    const usedArgs = []
    if (typeof arguments[0] === 'object' && arguments.length === 1 && _fields.length > 1) {
      const kwargs = arguments[0]
      _fields.forEach((field, index) => {
        usedArgs[index] = kwargs[field]
      })
      super(...usedArgs)
    } else {
      _fields.forEach((field, index) => {
        usedArgs[index] = arguments[index]
      })
      super(...usedArgs)
    }
  }
  static _make(kwargs) {
    return new this.prototype.constructor(kwargs);
  }
  _replace(kwargs) {
    this.constructor._fields.forEach((field) => {
        kwargs[field] = kwargs[field] || this[field];
    });
    return this.constructor._make(kwargs);
  }
  __reduce__() {
    return [this.constructor, this.constructor._fields.map((field) => this[field])];
  }
${fields.map((field, index) => { //eslint-disable-line
    return `  get ${field}() {\n    return this[${index}]\n  }\n  set ${field}(val) {\n    this[${index}] = val; return val\n  }`
  }).join('\n')}
}`;
  return Function(classStr)() //eslint-disable-line
}

function NotImplementedError(message) {
  ///<summary>The error thrown when the given function isn't implemented.</summary>
  const sender = (new Error) //eslint-disable-line
    .stack
    .split('\n')[2]
    .replace(' at ', '');

  this.message = `The method ${sender} isn't implemented.`;

  // Append the message if given.
  if (message) {
    this.message += ` Message: "${message}".`;
  }

  let str = this.message;

  while (str.indexOf('  ') > -1) {
    str = str.replace('  ', ' ');
  }

  this.message = str;
}

function nonZero(arr) {
  // This function outputs a array of indices of nonzero elements
  const indices = []
  if (arr[0].length == undefined) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] !== 0) {
        indices.push(i)
      }
    }
  } else {
    const shape = [arr.length, arr[0].length]
    for (let row = 0; row < shape[0]; row++) {
      for (let col = 0; col < shape[1]; col++) {
        if (arr[row][col] !== 0) {
          indices.push([row, col])
        }
      }
    }
  }
  return indices
}

function randomChoice(arr) {
  // This function does not support "size" of output shape.
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSample(arr, size) {
  var shuffled = arr.slice(0)
  let i = arr.length
  let temp
  let index
  while (i--) {
    index = Math.floor((i + 1) * Math.random())
    temp = shuffled[index]
    shuffled[index] = shuffled[i]
    shuffled[i] = temp
  }
  return shuffled.slice(0, size)
}

function randomUniform(min, max) {
  return Math.random() * (max - min) + min
}

randomUniform.int = function (min, max) {
  return Math.round(randomUniform(min, max))
}

async function sequentialTaskQueue(tasks) {
  const results = []
  const reducer = (promiseChain, currentTask) => { //eslint-disable-line
    return promiseChain.then((result) => {
      if (result) {
        results.push(result)
      }
      return currentTask()
    })
  }
  await tasks.reduce(reducer, Promise.resolve())
  return results
}

function setattr(proto, key, value) {
  if (Array.isArray(value) && proto[`set${snakeToPascal(key)}List`]) {
    proto[`set${snakeToPascal(key)}List`](value)
  } else if (proto[`set${snakeToPascal(key)}`]) {
    proto[`set${snakeToPascal(key)}`](value)
  } else {
    console.error(`Failed to find setter method for field "${key}"\n using "set${snakeToPascal(key)}" or "set${snakeToPascal(key)}List"\n on proto:\n`, proto.toObject())
    throw new Error(`Failed to find setter method for field "${key}" on proto.`)
  }
}

function setUpProtoAction(action, name) {
  if (name === 'no_op') {
    return action
  }
  if (name === 'move_camera') {
    const actionSpatial = new spatial_pb.ActionSpatial()
    const camMove = new spatial_pb.ActionSpatialCameraMove()
    camMove.setCenterMinimap(new common_pb.PointI())
    actionSpatial.setCameraMove(camMove)
    action.setActionFeatureLayer(actionSpatial)
    action.setActionRender(actionSpatial)
    return action
  }
  if (name === 'select_point') {
    const actionSpatial = new spatial_pb.ActionSpatial()
    const unitSelectionPoint = new spatial_pb.ActionSpatialUnitSelectionPoint()
    unitSelectionPoint.setSelectionScreenCoord(new common_pb.PointI())
    actionSpatial.setUnitSelectionPoint(unitSelectionPoint)
    action.setActionFeatureLayer(actionSpatial)
    action.setActionRender(actionSpatial)
    return action
  }
  if (name === 'select_rect') {
    const actionSpatial = new spatial_pb.ActionSpatial()
    const unitSelectionRect = new spatial_pb.ActionSpatialUnitSelectionRect()
    // unitSelectionRect.addSelectionScreenCoord(new common_pb.RectangleI())
    actionSpatial.setUnitSelectionRect(unitSelectionRect)
    action.setActionFeatureLayer(actionSpatial)
    action.setActionRender(actionSpatial)
    return action
  }
  if (name === 'select_idle_worker') {
    const actionUI = new ui_pb.ActionUI()
    const selectIdleWorker = new ui_pb.ActionSelectIdleWorker()
    actionUI.setSelectIdleWorker(selectIdleWorker)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'select_army') {
    const actionUI = new ui_pb.ActionUI()
    const selectArmy = new ui_pb.ActionSelectArmy()
    actionUI.setSelectArmy(selectArmy)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'select_warp_gates') {
    const actionUI = new ui_pb.ActionUI()
    const selectWarpGates = new ui_pb.ActionSelectWarpGates()
    actionUI.setSelectWarpGates(selectWarpGates)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'select_larva') {
    const actionUI = new ui_pb.ActionUI()
    // const selectLarva = new ui_pb.ActionSelectLarva()
    // actionUI.setSelectLarva(selectLarva)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'select_unit') {
    const actionUI = new ui_pb.ActionUI()
    const multiPanel = new ui_pb.ActionMultiPanel()
    actionUI.setMultiPanel(multiPanel)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'select_control_group' || name === 'control_group') {
    const actionUI = new ui_pb.ActionUI()
    const controlGroup = new ui_pb.ActionControlGroup()
    actionUI.setControlGroup(controlGroup)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'unload') {
    const actionUI = new ui_pb.ActionUI()
    const cargoPanel = new ui_pb.ActionCargoPanelUnload()
    actionUI.setCargoPanel(cargoPanel)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'build_queue') {
    const actionUI = new ui_pb.ActionUI()
    const productionPanel = new ui_pb.ActionProductionPanelRemoveFromQueue()
    actionUI.setProductionPanel(productionPanel)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'cmd_quick') {
    const unitCommand = new spatial_pb.ActionSpatialUnitCommand()
    const actionSpatial = new spatial_pb.ActionSpatial()
    actionSpatial.setUnitCommand(unitCommand)
    action.setActionFeatureLayer(actionSpatial)
    action.setActionRender(actionSpatial)
    return action
  }
  if (name === 'cmd_screen') {
    const unitCommand = new spatial_pb.ActionSpatialUnitCommand()
    unitCommand.setTargetScreenCoord(new common_pb.PointI())
    const actionSpatial = new spatial_pb.ActionSpatial()
    actionSpatial.setUnitCommand(unitCommand)
    action.setActionFeatureLayer(actionSpatial)
    action.setActionRender(actionSpatial)
    return action
  }
  if (name === 'cmd_minimap') {
    const unitCommand = new spatial_pb.ActionSpatialUnitCommand()
    unitCommand.setTargetMinimapCoord(new common_pb.PointI())
    const actionSpatial = new spatial_pb.ActionSpatial()
    actionSpatial.setUnitCommand(unitCommand)
    action.setActionFeatureLayer(actionSpatial)
    action.setActionRender(actionSpatial)
    return action
  }
  if (name === 'autocast') {
    const actionUI = new ui_pb.ActionUI()
    const toggleAutocast = new ui_pb.ActionToggleAutocast()
    actionUI.setToggleAutocast(toggleAutocast)
    action.setActionUi(actionUI)
    return action
  }
  if (name === 'raw_no_op') {
    return action
  }
  if (name === 'raw_move_camera') {
    const actionRaw = new raw_pb.ActionRaw()
    const camMove = new raw_pb.ActionRawCameraMove()
    camMove.setCenterWorldSpace(new common_pb.Point())
    actionRaw.setCameraMove(camMove)
    action.setActionRaw(actionRaw)
    return action
  }
  if (name === 'raw_cmd') {
    const actionRaw = new raw_pb.ActionRaw()
    const unitCommand = new raw_pb.ActionRawUnitCommand()
    actionRaw.setUnitCommand(unitCommand)
    action.setActionRaw(actionRaw)
    return action
  }
  if (name === 'raw_cmd_pt') {
    const actionRaw = new raw_pb.ActionRaw()
    const unitCommand = new raw_pb.ActionRawUnitCommand()
    unitCommand.setTargetWorldSpacePos(new common_pb.Point2D())
    actionRaw.setUnitCommand(unitCommand)
    action.setActionRaw(actionRaw)
    return action
  }
  if (name === 'raw_cmd_unit') {
    const actionRaw = new raw_pb.ActionRaw()
    const unitCommand = new raw_pb.ActionRawUnitCommand()
    actionRaw.setUnitCommand(unitCommand)
    action.setActionRaw(actionRaw)
    return action
  }
  if (name === 'raw_autocast') {
    const actionRaw = new raw_pb.ActionRaw()
    const toggleAutocast = new raw_pb.ActionRawCameraMove()
    actionRaw.setToggleAutocast(toggleAutocast)
    action.setActionRaw(actionRaw)
    return action
  }
}

const snakeToCamel = (str) => {
  if (!str.match('_')) {
    return str
  }
  return str
    .toLowerCase().replace(/([-_][a-z])/g, (group) => group
      .toUpperCase()
      .replace('-', '')
      .replace('_', ''))
}

function snakeToPascal(str) {
  const usedStr = snakeToCamel(str)
  return usedStr[0].toUpperCase() + usedStr.slice(1, usedStr.length)
}

function sum(collection) {
  let total = 0
  Object.keys(collection).forEach((key) => {
    total += collection[key]
  })
  return total
}

class DefaultDict {
  constructor(DefaultInit) {
    return new Proxy({}, {
      //eslint-disable-next-line
      get: (target, name) => {
        if (name in target) {
          return target[name]
        }
        if (typeof DefaultInit === 'function') {
          target[name] = new DefaultInit().valueOf()
        } else {
          target[name] = DefaultInit
        }
        return target[name]
      },
    })
  }
}

function unpackbits(uint8data) {
  if (Number.isInteger(uint8data)) {
    uint8data = Uint8Array.from([uint8data])
  }
  if (uint8data instanceof Array) {
    uint8data = Uint8Array.from(uint8data)
  }
  const results = new Uint8Array(8 * uint8data.length)
  let byte
  let offset
  for (let i = 0; i < uint8data.length; i++) {
    byte = uint8data[i]
    offset = (8 * i)
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

function unpackbitsToShape(uint8data, shape = [1, 1]) {
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

class ValueError extends Error {
  /*
  The error thrown when an invalid argument is passed.
  */
  constructor(value) {
    super(value)
    const sender = (new Error) //eslint-disable-line
      .stack
      .split('\n')[2]
      .replace(' at ', '');

    this.message = `The argument from ${sender} is an invalid arugment.`;

    // Append the message if given.
    if (value) {
      this.message += ` Invalid argument: "${value}".`;
    }

    let str = this.message;

    while (str.indexOf('  ') > -1) {
      str = str.replace('  ', ' ');
    }

    this.message = str;
  }
}
function withPython(withInterface, callback) {
  if (!withInterface.__enter__ || !withInterface.__exit__) {
    throw new Error('ValueError: withInterface must define a __enter__ and __exit__ method')
  }
  let tempResult = withInterface.__enter__.call(withInterface)
  tempResult = callback(tempResult)
  if (tempResult instanceof Promise) {
    tempResult.then(() => withInterface.__exit__.call(withInterface))
  } else {
    withInterface.__exit__.call(withInterface)
  }
  return tempResult
}
async function withPythonAsync(pendingWithInterface, callback) {
  const withInterface = await pendingWithInterface
  if (!withInterface.__enter__ || !withInterface.__exit__) {
    throw new Error('ValueError: withInterface must define a __enter__ and __exit__ method')
  }
  let tempResult = withInterface.__enter__.call(withInterface)
  tempResult = await callback(tempResult)
  await withInterface.__exit__.call(withInterface)
  return tempResult
}

// tensor flow version of xy_locs is twice as slow
// async function xy_locs(mask) {
//   // Javascript: Assuming mask is an array of bools
//   // Mask should be a set of bools from comparison with a feature layer.//
//   return (await np.whereAsync(mask)).arraySync().map(([x, y]) => new point.Point(x, y))
// }
function xy_locs(grid, compare) {
  /**
  * Mask is defined implicity as the result of comparison between
    grid elements and the compare object.
  * The booleans from comparison with a feature layer
    are used to dermine when to store x,y locations.
  */
  const result = []
  let colVal
  let row
  for (let y = 0; y < grid.length; y++) {
    row = grid[y]
    for (let x = 0; x < row.length; x++) {
      colVal = row[x]
      if (colVal == compare) {
        result.push([x, y])
      }
    }
  }
  return result
}

/**
 From:
 https://gist.github.com/tregusti/0b37804798a7634bc49c#gistcomment-2193237

 * @summary A error thrown when a method is defined but not implemented (yet).
 * @param {any} message An additional message for the error.
 */
function zip() {
  var args = [].slice.call(arguments); //eslint-disable-line
  var shortest = args.length === 0 ? [] : args.reduce(function(a, b) {
    return a.length < b.length ? a : b
  });

  return shortest.map(function(_, i) {
    return args.map(function(array) { return array[i] })
  });
}

module.exports = {
  ABCMeta,
  any,
  arrayCompare,
  arrayDtype,
  arrayShape,
  arraySub,
  assert,
  clip,
  compareObsSpec,
  compareAIF,
  DefaultDict,
  eq,
  expanduser,
  getArgsArray,
  getattr,
  getImageData,
  hashCode,
  int,
  iter,
  isinstance,
  isObject,
  len,
  map,
  namedtuple,
  NotImplementedError,
  nonZero,
  randomChoice,
  randomSample,
  randomUniform,
  sequentialTaskQueue,
  setattr,
  setUpProtoAction,
  snakeToCamel,
  snakeToPascal,
  String,
  sum,
  unpackbits,
  unpackbitsToShape,
  ValueError,
  withPython,
  withPythonAsync,
  xy_locs,
  zip,
}
