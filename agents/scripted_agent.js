const path = require('path') //eslint-disable-line
const base_agent = require(path.resolve(__dirname, './base_agent.js'))
const actions = require(path.resolve(__dirname, '..', 'lib', './actions.js'))
const features = require(path.resolve(__dirname, '..', 'lib', './features.js'))
const numpy = require(path.resolve(__dirname, '..', 'lib', './numpy.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', './pythonUtils.js'))
const { xy_locs } = pythonUtils
const FUNCTIONS = actions.FUNCTIONS
const RAW_FUNCTIONS = actions.RAW_FUNCTIONS

const _PLAYER_SELF = features.PlayerRelative.SELF
const _PLAYER_NEUTRAL = features.PlayerRelative.NEUTRAL //beacon/minerals
const _PLAYER_ENEMY = features.PlayerRelative.ENEMY

class MoveToBeacon extends base_agent.BaseAgent {
// An agent specifically for solving the MoveToBeacon map.//
  step(obs) {
    super.step(obs)
    if (obs.observation.available_actions.includes(FUNCTIONS.Move_screen.id)) {
      const player_relative = obs.observation.feature_screen.player_relative
      const beacon = xy_locs(player_relative, _PLAYER_NEUTRAL)
      if (!beacon) {
        return FUNCTIONS.no_op()
      }
      const axis = 0
      const beacon_center = numpy.round(numpy.mean(beacon, axis))
      return FUNCTIONS.Move_screen('now', beacon_center)
    }
    return FUNCTIONS.select_army('select')
  }
}

class CollectMineralShards extends base_agent.BaseAgent {
// An agent specifically for solving the CollectMineralShards map. //

  step(obs) {
    super.step(obs)
    if (obs.observation.available_actions.includes(FUNCTIONS.Move_screen.id)) {
      const player_relative = obs.observation.feature_screen.player_relative
      const minerals = xy_locs(player_relative, _PLAYER_NEUTRAL)
      if (!minerals) {
        return FUNCTIONS.no_op()
      }
      const marines = xy_locs(player_relative, _PLAYER_SELF)
      let axis = 0
      const marine_xy = numpy.round(numpy.mean(marines, axis)) //Average location.
      axis = 1
      const distances = numpy.norm(numpy.tensor(minerals).sub(marine_xy), 'euclidean', axis)
      const closest_mineral_xy = minerals[numpy.argMin(distances).arraySync()]
      return FUNCTIONS.Move_screen('now', closest_mineral_xy)
    }
    return FUNCTIONS.select_army('select')
  }
}

class CollectMineralShardsFeatureUnits extends base_agent.BaseAgent {
/*
  An agent for solving the CollectMineralShards map with feature units.

  Controls the two marines independently:
  - select marine
  - move to nearest mineral shard that wasn't the previous target
  - swap marine and repeat
*/
  setup(obs_spec, action_spec) {
    super.setup(obs_spec, action_spec)
    if (!(obs_spec.hasOwnProperty('feature_units'))) {
      throw new Error('This agent requires the feature_units observation.')
    }
  }

  reset() {
    super.reset()
    this._marine_selected = false
    this._previous_mineral_xy = [-1, -1]
  }

  step(obs) {
    super.step(obs)
    const marines = []
    obs.observation.feature_units.forEach((unit) => {
      if (unit.alliance == _PLAYER_SELF) {
        marines.push(unit)
      }
    })
    if (!marines.length) {
      return FUNCTIONS.no_op()
    }

    let marine_unit = marines[0]
    marines.forEach((m) => {
      if (m.is_selected === this._marine_selected) {
        marine_unit = m
      }
    })
    const marine_xy = [marine_unit.x, marine_unit.y]
    if (!marine_unit.is_selected) {
      //Nothing selected or the wrong marine is selected.
      this._marine_selected = true
      return FUNCTIONS.select_point('select', marine_xy)
    }
    if (obs.observation.available_actions.includes(FUNCTIONS.Move_screen.id)) {
      //Find and move to the nearest mineral.
      let minerals = []
      obs.observation.feature_units.forEach((unit) => {
        if (unit.alliance == _PLAYER_NEUTRAL) {
          minerals.push([unit.x, unit.y])
        }
      })

      if (minerals.includes(this._previous_mineral_xy)) {
        //Don't go for the same mineral shard as other marine.
        minerals = minerals.filter((mineral) => mineral[0] !== this._previous_mineral_xy[0] && mineral[1] !== this._previous_mineral_xy[1])
      }

      if (minerals.length) {
        //Find the closest.
        const axis = 1
        const distances = numpy.norm(numpy.tensor(minerals).sub(marine_xy), 'euclidean', axis)
        const closest_mineral_xy = minerals[numpy.argMin(distances).arraySync()]
        //Swap to the other marine.
        this._marine_selected = false
        this._previous_mineral_xy = closest_mineral_xy
        return FUNCTIONS.Move_screen('now', closest_mineral_xy)
      }
    }
    return FUNCTIONS.no_op()
  }
}

class CollectMineralShardsRaw extends base_agent.BaseAgent {
  /*An agent for solving CollectMineralShards with raw units and actions.

  Controls the two marines independently:
  - move to nearest mineral shard that wasn't the previous target
  - swap marine and repeat
  */
  setup(obs_spec, action_spec) {
    super.setup(obs_spec, action_spec)
    if (!(obs_spec.hasOwnProperty('raw_units'))) {
      throw new Error('This agent requires the raw_units observation.')
    }
  }

  reset() {
    super.reset()
    this._last_marine = null
    this._previous_mineral_xy = [-1, -1]
  }

  step(obs) {
    super.step(obs)
    const marines = []
    obs.observation.raw_units.forEach((unit) => {
      if (unit.alliance == _PLAYER_SELF) {
        marines.push(unit)
      }
    })
    if (!marines.length) {
      return RAW_FUNCTIONS.no_op()
    }
    let marine_unit = marines[0]
    marines.forEach((m) => {
      if (m.tag !== this._last_marine) {
        marine_unit = m
      }
    })
    const marine_xy = [marine_unit.x, marine_unit.y]
    const minerals = []
    obs.observation.raw_units.forEach((unit) => {
      if (unit.alliance == _PLAYER_NEUTRAL) {
        if (this._previous_mineral_xy) {
          // Don't go for the same mineral shard as other marine
          if (unit.x === this._previous_mineral_xy[0] && unit.y === this._previous_mineral_xy[1]) {
            return
          }
        }
        minerals.push([unit.x, unit.y])
      }
    })
    if (minerals.length) {
      //Find the closest.
      const axis = 1
      const distances = numpy.norm(numpy.tensor(minerals).sub(marine_xy), 'euclidean', axis)
      const closest_mineral_xy = minerals[numpy.argMin(distances).arraySync()]

      this._last_marine = marine_unit.tag
      this._previous_mineral_xy = closest_mineral_xy
      return RAW_FUNCTIONS.Move_pt('now', marine_unit.tag, closest_mineral_xy)
    }
    return RAW_FUNCTIONS.no_op()
  }
}

class DefeatRoaches extends base_agent.BaseAgent {
  //An agent specifically for solving the DefeatRoaches map.//

  step(obs) {
    super.step(obs)
    if (obs.observation.available_actions.includes(FUNCTIONS.Attack_screen.id)) {
      const player_relative = obs.observation.feature_screen.player_relative
      const roaches = xy_locs(player_relative, _PLAYER_ENEMY)
      if (!roaches.length) {
        return FUNCTIONS.no_op()
      }
      //Find the roach with max y coord.
      const temp = []
      for (let i = 0; i < roaches.length; i++) {
        temp.push(roaches[i][1])
      }
      const target = roaches[numpy.argMax(temp).arraySync()]
      return FUNCTIONS.Attack_screen('now', target)
    }
    if (obs.observation.available_actions.includes(FUNCTIONS.select_army.id)) {
      return FUNCTIONS.select_army('select')
    }
    return FUNCTIONS.no_op()
  }
}

class DefeatRoachesRaw extends base_agent.BaseAgent {
/*An agent specifically for solving DefeatRoaches using raw actions.*/
  setup(obs_spec, action_spec) {
    super.setup(obs_spec, action_spec)
    if (!(obs_spec.hasOwnProperty('raw_units'))) {
      throw new Error('This agent requires the raw_units observation')
    }
  }

  step(obs) {
    super.step(obs)
    const marines = []
    obs.observation.raw_units.forEach((unit) => {
      if (unit.alliance == _PLAYER_SELF) {
        marines.push(unit.tag)
      }
    })
    const roaches = []
    obs.observation.raw_units.forEach((unit) => {
      if (unit.alliance == _PLAYER_ENEMY) {
        roaches.push(unit)
      }
    })

    if (marines.length && roaches.length) {
      //Find the roach with max y coord.
      const target = roaches.sort((r1, r2) => r2.y - r1.y)[0].tag
      return RAW_FUNCTIONS.Attack_unit('now', marines, target)
    }
    return FUNCTIONS.no_op()
  }
}

module.exports = {
  CollectMineralShards,
  CollectMineralShardsFeatureUnits,
  CollectMineralShardsRaw,
  DefeatRoaches,
  DefeatRoachesRaw,
  MoveToBeacon,
}
