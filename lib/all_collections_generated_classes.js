function getClass(name, fields) { //eslint-disable-line
  let consLogic = '';
  let consArgs = '{';
  fields.forEach((field, i) => {
    consArgs += i < fields.length - 1 ? `${field}, ` : `${field}}`;
    consLogic += i < fields.length - 1 ? `this.${field} = ${field};\n\t\t\t` : `this.${field} = ${field};`;
  });
  const classStr = `class ${name} {
      static get classname { return '${name}' };
      static get _fields() { return ${JSON.stringify(fields)} };
      constructor(${consArgs}) {
          ${consLogic}
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
  }`;
  console.log(classStr);
}

class ArgumentType {
  static get classname() { return 'ArgumentType' }

  static get _fields() { return ['id', 'name', 'sizes', 'fn', 'values', 'count'] }

  constructor(kwargs, id, name, sizes, fn, values, count) {
    if (kwargs) {
      var { id, name, sizes, fn, values, count } = kwargs;
    }
    this.id = id
    this.name = name;
    this.sizes = sizes;
    this.fn = fn;
    this.values = values;
    this.count = count;
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
}

class Arguments {
  static get classname() { return 'Arguments' }

  static get _fields() { return ['screen', 'minimap', 'screen2', 'queued', 'control_group_act', 'control_group_id', 'select_point_act', 'select_add', 'select_unit_act', 'select_unit_id', 'select_worker', 'build_queue_id', 'unload_id'] }

  constructor(kwargs, screen, minimap, screen2, queued, control_group_act, control_group_id, select_point_act, select_add, select_unit_act, select_unit_id, select_worker, build_queue_id, unload_id) {
    if (kwargs) {
      var { screen, minimap, screen2, queued, control_group_act, control_group_id, select_point_act, select_add, select_unit_act, select_unit_id, select_worker, build_queue_id, unload_id } = kwargs;
      this.screen = screen;
      this.minimap = minimap;
      this.screen2 = screen2;
      this.queued = queued;
      this.control_group_act = control_group_act;
      this.control_group_id = control_group_id;
      this.select_point_act = select_point_act;
      this.select_add = select_add;
      this.select_unit_act = select_unit_act;
      this.select_unit_id = select_unit_id;
      this.select_worker = select_worker;
      this.build_queue_id = build_queue_id;
      this.unload_id = unload_id;
      return
    }
    this.screen = screen;
    this.minimap = minimap;
    this.screen2 = screen2;
    this.queued = queued;
    this.control_group_act = control_group_act;
    this.control_group_id = control_group_id;
    this.select_point_act = select_point_act;
    this.select_add = select_add;
    this.select_unit_act = select_unit_act;
    this.select_unit_id = select_unit_id;
    this.select_worker = select_worker;
    this.build_queue_id = build_queue_id;
    this.unload_id = unload_id;
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
}

class RawArguments {
  static get classname() { return 'RawArguments' }

  static get _fields() { return ["world", "queued", "unit_tags", "target_unit_tag"] }

  constructor(kwargs, world, queued, unit_tags, target_unit_tag) {
    if (kwargs) {
      var { world, queued, unit_tags, target_unit_tag } = kwargs
      this.world = world;
      this.queued = queued;
      this.unit_tags = unit_tags;
      this.target_unit_tag = target_unit_tag;
      return
    }
    this.world = world;
    this.queued = queued;
    this.unit_tags = unit_tags;
    this.target_unit_tag = target_unit_tag;
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
}

class Function {
  static get classname() { return 'Function' }

  static get _fields() { return ["id", "name", "ability_id", "general_id", "function_type", "args", "avail_fn", "raw"] }

  constructor({ id, name, ability_id, general_id, function_type, args, avail_fn, raw }) {
    this.id = id;
    this.name = name;
    this.ability_id = ability_id;
    this.general_id = general_id;
    this.function_type = function_type;
    this.args = args || [];
    this.avail_fn = avail_fn;
    this.raw = raw;
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
}

class FunctionCall {
  static get classname() { return 'FunctionCall' }

  static get _fields() { return ['function', 'arguments'] }

  constructor(kwargs) {
    // console.log('FunctionCall constructor: arguments: ', kwargs.arguments)
    this.function = kwargs.function;
    this.arguments = kwargs.arguments;
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
}

class ValidActions {
  static get classname() { return 'ValidActions' }

  static get _fields() { return ["types", "functions"] }

  constructor(types, functions) {
    this.types = types;
    this.functions = functions;
  }

  static _make(types, functions) {
    return new this.prototype.constructor(types, functions);
  }

  _replace(kwargs) {
    if (Array.isArray(kwargs)) {
      const [types, functions] = kwargs
    } else {
      const { types, functions } = kwargs
    }
    return this.constructor._make(types, functions)
  }

  __reduce__() {
    return [this.constructor, this.constructor._fields.map((field) => this[field])];
  }
}

class Color {
  static get classname() { return 'Color' }

  static get _fields() { return ["r", "g", "b"] }

  constructor({ r, g, b }) {
    this.r = r;
    this.g = g;
    this.b = b;
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
}

class Point {
  static get classname() { return 'Point' }

  static get _fields() { return ["x", "y"] }

  constructor({ x, y }) {
    this.x = x;
    this.y = y;
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
}
class Rect {
  static get classname() { return 'Rect' }

  static get _fields() { return ["t", "l", "b", "r"] }

  constructor({ t, l, b, r }) {
    this.t = t;
    this.l = l;
    this.b = b;
    this.r = r;
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
}
class Feature {
  static get classname() { return 'Feature' }

  static get _fields() { return ["index", "name", "layer_set", "full_name", "scale", "type", "palette", "clip"] }

  constructor({ index, name, layer_set, full_name, scale, type, palette, clip }) {
    this.index = index;
    this.name = name;
    this.layer_set = layer_set;
    this.full_name = full_name;
    this.scale = scale;
    this.type = type;
    this.palette = palette;
    this.clip = clip;
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
}
class ScreenFeatures {
  static get classname() { return 'ScreenFeatures' }

  static get _fields() { return ["height_map", "visibility_map", "creep", "power", "player_id", "player_relative", "unit_type", "selected", "unit_hit_points", "unit_hit_points_ratio", "unit_energy", "unit_energy_ratio", "unit_shields", "unit_shields_ratio", "unit_density", "unit_density_aa", "effects", "hallucinations", "cloaked", "blip", "buffs", "buff_duration", "active", "build_progress", "pathable", "buildable", "placeholder"] }

  constructor({ height_map, visibility_map, creep, power, player_id, player_relative, unit_type, selected, unit_hit_points, unit_hit_points_ratio, unit_energy, unit_energy_ratio, unit_shields, unit_shields_ratio, unit_density, unit_density_aa, effects, hallucinations, cloaked, blip, buffs, buff_duration, active, build_progress, pathable, buildable, placeholder }) {
    this.height_map = height_map;
    this.visibility_map = visibility_map;
    this.creep = creep;
    this.power = power;
    this.player_id = player_id;
    this.player_relative = player_relative;
    this.unit_type = unit_type;
    this.selected = selected;
    this.unit_hit_points = unit_hit_points;
    this.unit_hit_points_ratio = unit_hit_points_ratio;
    this.unit_energy = unit_energy;
    this.unit_energy_ratio = unit_energy_ratio;
    this.unit_shields = unit_shields;
    this.unit_shields_ratio = unit_shields_ratio;
    this.unit_density = unit_density;
    this.unit_density_aa = unit_density_aa;
    this.effects = effects;
    this.hallucinations = hallucinations;
    this.cloaked = cloaked;
    this.blip = blip;
    this.buffs = buffs;
    this.buff_duration = buff_duration;
    this.active = active;
    this.build_progress = build_progress;
    this.pathable = pathable;
    this.buildable = buildable;
    this.placeholder = placeholder;
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
}
class MinimapFeatures {
  static get classname() { return 'MinimapFeatures' }

  static get _fields() { return ["height_map", "visibility_map", "creep", "camera", "player_id", "player_relative", "selected", "unit_type", "alerts", "pathable", "buildable"] }

  constructor({ height_map, visibility_map, creep, camera, player_id, player_relative, selected, unit_type, alerts, pathable, buildable }) {
    this.height_map = height_map;
    this.visibility_map = visibility_map;
    this.creep = creep;
    this.camera = camera;
    this.player_id = player_id;
    this.player_relative = player_relative;
    this.selected = selected;
    this.unit_type = unit_type;
    this.alerts = alerts;
    this.pathable = pathable;
    this.buildable = buildable;
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
}

module.exports = {
  ArgumentType,
  Arguments,
  RawArguments,
  Function,
  FunctionCall,
  ValidActions,
  Color,
  Point,
  Rect,
  Feature,
  ScreenFeatures,
  MinimapFeatures,
}
