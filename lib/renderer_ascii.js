const path = require('path')
const units = require(path.resolve(__dirname,'./units.js'))
// Give a crude ascii rendering of the feature_screen.

function get_printable_unit_types() {
  // Generate the list of printable unit type characters.
  let types = {}
  types[units.Protoss.Assimilator] = 'a'
  types[units.Protoss.Probe] = 'p'
  types[units.Protoss.Stalker] = 's'
  types[units.Terran.SCV] = 's'
  types[units.Terran.Marine] = 'm'
  types[units.Terran.SupplyDepot] = 'D'
  types[units.Terran.SupplyDepotLowered] ='D'
  types[Number(units.Protoss.Assimilator)] = 'a'
  types[Number(units.Protoss.Probe)] = 'p'
  types[Number(units.Protoss.Stalker)] = 's'
  types[Number(units.Terran.SCV)] = 's'
  types[Number(units.Terran.Marine)] = 'm'
  types[Number(units.Terran.SupplyDepot)] = 'D'
  types[Number(units.Terran.SupplyDepotLowered)] = 'D'

  const substrings = {
    'MineralField' : '$',
    'VespeneGeyser': '&',
    'Collapsible': '@',
    'Debris': '@',
    'Destructible': '@',
    'Rock': '@',
  }

  Object.keys(units.Neutral.member_names_).forEach((k) => {
    const name = units.Neutral.member_names_[k]
    const unit_type = units.Neutral[name]
    Object.keys(substrings).forEach((substring) => {
      const char = substrings[substring]
      if (name.includes(substring)) {
        types[unit_type] = char
      }
    })
  })

  const races = [units.Protoss, units.Terran, units.Zerg]
  for (let i = 0; i < races.length; i++) {
    const race = races[i]
    Object.keys(race.member_names_).forEach((k) => {
      const name = race.member_names_[k]
      const unit_type = race[name]
      Object.keys(types).forEach((type) => {
        if (!type.includes(name)) {
          types[unit_type] = name[0]
        }
      })
    })
  }

const _printable_unit_types = get_printable_unit_types()

const VISIBILITY = '#+.' // Fogged, seen, visible.
const PLAYER_RELATIVE = '.SANE' // self, allied, neutral, enemy.

function _summary(obs, view, width) {
  // Give a crude ascii rendering of feature_screen.
  const s = ` ${view}: p${obs.player.player_id}; step: ${obs.game_loop[0]}; money: ${obs.player.minerals}, ${obs.player.vespene}; food: ${obs.player.food_used}/${obs.player.food_cap}`
  const s_line = s.padStart(Math.max(s.length + 6, width), '-')
  s_line = s_line.padEnd(Math.max(s.length + 6, width), '-') 
  return s_line
}

function screen(obs) {
  // Give a crude ascii rendering of feature_screen.
  const unit_type = obs.feature_screen.unit_type
  const selected = obs.feature_screen.selected
  const visibility = obs.feature_screen.visibility_map
  const [max_y, max_x] = unit_type.shape
  const out = _summary(obs, 'screen', max_y * 2) + '\n'
  for (let y = 0; y < max_y; y++) {
    let started = false
    for (let x = 0; x < max_x; x++) {
      const s = selected[y][x]
      const u = unit_type[y][x]
      const v = visibility[y][x]
      if (started && !s) {
        out += ')'
      } else if (!started && s) {
        out += '('
      } else {
        out += ''
      } if (u) {
        Object.keys(_printable_unit_types).forEach((key) => {
          if (key.includes(String(u))) {
            return out += _printable_unit_types[key]
          }
        })
      } else {
        out += VISIBILITY[v]
      }
      started = s
    }
    if (started) {
      out += ')'
    }
    out += '\n'
  }
  return out
}

function minimap(obs) {
  // Give a crude ascii rendering of feature_minimap.
  const player  = obs.feature_minimap.PLAYER_RELATIVE
  const selected = obs.feature_minimap.selected
  const visibility = obs.feature_minimap.visibility_map
  [max_y, max_x] = visibility.shape
  const out = _summary(obs, 'minimap', max_y * 2) + '\n'
  for (let y = 0; y < max_y; y++) {
    let started = false
    for (let x = 0; x < max_x; x++) {
      const s = selected[y][x]
      const p = player[y][x]
      const v = visibility[y][x]
      if (started && !s) {
        out += ')'
      } else if (!started && s) {
        out += '('
      } else {
        out += ''
      } if (v) {
        out += PLAYER_RELATIVE[p]
      } else {
        out += VISIBILITY[v]
      }
      started = s
    }
    if (started) {
      out += ')'
    }
    out += '\n'
  }
  return out
}

module.exports = {
  get_printable_unit_types,
  _summary,
  screen,
  minimap,
}
