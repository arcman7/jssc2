const path = require('path') //eslint-disable-line
const lib = require(path.resolve(__dirname, './lib.js'))
/*eslint-disable class-methods-use-this*/
class MiniGame extends lib.Map {
  get directory() { return MiniGame.directory }

  get download() { return MiniGame.download }

  get players() { return MiniGame.players }

  get score_index() { return MiniGame.score_index }

  get game_steps_per_episode() { return MiniGame.game_steps_per_episode }

  get step_mul() { return MiniGame.step_mul }
}
MiniGame.directory = 'mini_games'
MiniGame.download = 'https://github.com/deepmind/pysc2#get-the-maps'
MiniGame.players = 1
MiniGame.score_index = 0
MiniGame.game_steps_per_episode = 0
MiniGame.step_mul = 8
MiniGame._subclasses = []

lib.Map._subclasses.push(MiniGame)

const mini_games = [
  'BuildMarines', // 900s
  'CollectMineralsAndGas', // 420s
  'CollectMineralShards', // 120s
  'DefeatRoaches', // 120s
  'DefeatZerglingsAndBanelings', // 120s
  'FindAndDefeatZerglings', // 180s
  'MoveToBeacon', // 120s
]

const modExports = {
  MiniGame,
  mini_games,
}

mini_games.forEach((name) => {
  modExports[name] = class extends MiniGame {
    static get filename() { return name }

    get filename() { return name } //eslint-disable-line

    static get name() { return name }
  }
  lib.Map._subclasses.push(modExports[name])
  MiniGame._subclasses.push(modExports[name])
})

module.exports = modExports
