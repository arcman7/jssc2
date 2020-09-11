// Run SC2 to play a game or a replay.
const path = require('path')
const flags = require('flags')
const s2clientprotocol = require('s2clientprotocol')
const maps = require(path.resolve(__dirname, '..', 'maps'))
const run_configs = require(path.resolve(__dirname, '..', 'run_configs'))
const sc2_env = require(path.resolve(__dirname, '..', 'env', 'sc2_env.js'))
const point_flag = require(path.resolve(__dirname, '..', 'lib', 'point_flag.js'))
const renderer_human = require(path.resolve(__dirname, '..', 'lib', 'renderer_human.js'))
const replay = require(path.resolve(__dirname, '..', 'lib', 'replay.js'))
const stopwatch = require(path.resolve(__dirname, '..', 'lib', 'stopwatch.js'))
const sc_pb = s2clientprotocol.sc2api_pb

flags.defineBoolean("render", true, "Whether to render with pygame.")
flags.defineBoolean("realtime", false, "Whether to run in realtime mode.")
flags.defineBoolean("full_screen", false, "Whether to run full screen.")

flags.defineNumber("fps", 22.4, "Frames per second to run the game.")
flags.defineInteger("step_mul", 1, "Game steps per observation.")
flags.defineBoolean("render_sync", false, "Turn on sync rendering.")
point_flag.DEFINE_point("feature_screen_size", "84", "Resolution for screen feature layers.")
point_flag.DEFINE_point("feature_minimap_size", "64", "Resolution for minimap feature layers.")
flags.defineInteger("feature_camera_width", 24, "Width of the feature layer camera.")
point_flag.DEFINE_point("rgb_screen_size", "256,192", "Resolution for rendered screen.")
point_flag.DEFINE_point("rgb_minimap_size", "128", "Resolution for rendered minimap.")
point_flag.DEFINE_point("window_size", "640,480", "Screen size if not full screen.")
flags.defineString("video", null, "Path to render a video of observations.")

flags.defineInteger("max_game_steps", 0, "Total game steps to run.")
flags.defineInteger("max_episode_steps", 0, "Total game steps per episode.")

flags.defineString("user_name", getpass.getuser(), "Name of the human player for replays.")
flags.DEFINE_enum("user_race", "random", sc2_env.Race.member_names_, "User's race.")
flags.DEFINE_enum("bot_race", "random", sc2_env.Race.member_names_, "AI race.")
flags.DEFINE_enum("difficulty", "very_easy", sc2_env.Difficulty.member_names_, "Bot's strength.")
flags.DEFINE_enum("bot_build", "random", sc2_env.BotBuild.member_names_, "Bot's build strategy.")
flags.defineBoolean("disable_fog", false, "Disable fog of war.")
flags.defineInteger("observed_player", 1, "Which player to observe.")

flags.defineBoolean("profile", false, "Whether to turn on code profiling.")
flags.defineBoolean("trace", false, "Whether to trace the code execution.")

flags.defineBoolean("save_replay", true, "Whether to save a replay at the end.")

flags.defineString("map", null, "Name of a map to use to play.")
flags.defineBoolean("battle_net_map", false, "Use the battle.net map version.")

flags.defineString("map_path", null, "Override the map for this replay.")
flags.defineString("replay", null, "Name of a replay to show.")

function main(unused_argv) {
  // Run SC2 to play a game or a replay.
  if (flags.get('trace')) {
    stopwatch.sw.trace()
  } else if (flags.get(profile)) {
    stopwatch.sw.enable()
  }

  if ((flags.get('map') && flags.get('replay')) || (!flags.get('map') && !flags.get('replay'))) {
    process.exit('')
  }
}

function entry_point() {

}

module.exports = {
  main,
  entry_point,
}
