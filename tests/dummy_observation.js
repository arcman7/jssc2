const path = require('path') //eslint-disable-line
const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const features = require(path.resolve(__dirname, '..', 'lib', 'features.js'))
const np = require(path.resolve(__dirname, '..', 'lib', 'numpy.js'))
const pythonUtils = require(path.resolve(__dirname, '..', 'lib', 'pythonUtils.js'))

const { common_pb, raw_pb, sc2api_pb, score_pb, ui_pb } = s2clientprotocol
const sc_pb = sc2api_pb
const { snakeToPascal, } = pythonUtils

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
function getattr(proto, key) {
  if (!proto[`get${snakeToPascal(key)}`]) {
    return
  }
  return proto[`get${snakeToPascal(key)}`]()
}

class Unit {
  constructor({
    unit_type, // see lib/units.js
    player_relative, // features.PlayerRelative,
    health,
    shields = 0,
    energy = 0,
    transport_slots_taken = 0,
    build_progress = 1.0
  }) {
    this.unit_type = unit_type
    this.player_relative = player_relative
    this.health = health
    this.shields = shields
    this.energy = energy
    this.transport_slots_taken = transport_slots_taken
    this.build_progress = build_progress
  }

  fill(unit_proto) {
    //Fill a proto unit data object from this Unit.//
    unit_proto.setUnitType(this.unit_type.val)
    unit_proto.setPlayerRelative(this.player_relative.val)
    unit_proto.setHealth(this.health)
    unit_proto.setShields(this.shields)
    unit_proto.setEnergy(this.energy)
    unit_proto.setTransportSlotsTaken(this.transport_slots_taken)
    unit_proto.setBuildProgress(this.build_progress)
  }

  as_array() {
    //Return the unit represented as a numpy array.//
    return np.array([
      this.unit_type,
      this.player_relative,
      this.health,
      this.shields,
      this.energy,
      this.transport_slots_taken,
      Math.floor(this.build_progress * 100)
    ])
  }

  as_dict() {
    return this
  }
}

class FeatureUnit {
  constructor({
    unit_type, // see lib/units
    alliance, // features.PlayerRelative,
    owner, // 1-15, 16=neutral
    pos, // common_pb.Point,
    radius,
    health,
    health_max,
    is_on_screen,
    shield = 0,
    shield_max = 0,
    energy = 0,
    energy_max = 0,
    cargo_space_taken = 0,
    cargo_space_max = 0,
    build_progress = 1.0,
    facing = 0.0,
    display_type = raw_pb.DisplayType.VISIBLE, // raw_pb.DisplayType
    cloak = raw_pb.CloakState.NOTCLOAKED, // raw_pb.CloakState
    is_selected = false,
    is_blip = false,
    is_powered = true,
    mineral_contents = 0,
    vespene_contents = 0,
    assigned_harvesters = 0,
    ideal_harvesters = 0,
    weapon_cooldown = 0.0
  }) {
    this.unit_type = unit_type
    this.alliance = alliance
    this.owner = owner
    this.pos = pos
    this.radius = radius
    this.health = health
    this.health_max = health_max
    this.is_on_screen = is_on_screen
    this.shield = shield
    this.shield_max = shield_max
    this.energy = energy
    this.energy_max = energy_max
    this.cargo_space_taken = cargo_space_taken
    this.cargo_space_max = cargo_space_max
    this.build_progress = build_progress
    this.facing = facing
    this.display_type = display_type
    this.cloak = cloak
    this.is_selected = is_selected
    this.is_blip = is_blip
    this.is_powered = is_powered
    this.mineral_contents = mineral_contents
    this.vespene_contents = vespene_contents
    this.assigned_harvesters = assigned_harvesters
    this.ideal_harvesters = ideal_harvesters
    this.weapon_cooldown = weapon_cooldown
  }

  as_dict() {
    return this
  }

  fill(proto_unit) {
    setattr(proto_unit, 'unit_type', this.unit_type)
    setattr(proto_unit, 'alliance', this.alliance)
    setattr(proto_unit, 'owner', this.owner)
    setattr(proto_unit, 'pos', this.pos)
    setattr(proto_unit, 'radius', this.radius)
    setattr(proto_unit, 'health', this.health)
    setattr(proto_unit, 'health_max', this.health_max)
    setattr(proto_unit, 'is_on_screen', this.is_on_screen)
    setattr(proto_unit, 'shield', this.shield)
    setattr(proto_unit, 'shield_max', this.shield_max)
    setattr(proto_unit, 'energy', this.energy)
    setattr(proto_unit, 'energy_max', this.energy_max)
    setattr(proto_unit, 'cargo_space_taken', this.cargo_space_taken)
    setattr(proto_unit, 'cargo_space_max', this.cargo_space_max)
    setattr(proto_unit, 'build_progress', this.build_progress)
    setattr(proto_unit, 'facing', this.facing)
    setattr(proto_unit, 'display_type', this.display_type)
    setattr(proto_unit, 'cloak', this.cloak)
    setattr(proto_unit, 'is_selected', this.is_selected)
    setattr(proto_unit, 'is_blip', this.is_blip)
    setattr(proto_unit, 'is_powered', this.is_powered)
    setattr(proto_unit, 'mineral_contents', this.mineral_contents)
    setattr(proto_unit, 'vespene_contents', this.vespene_contents)
    setattr(proto_unit, 'assigned_harvesters', this.assigned_harvesters)
    setattr(proto_unit, 'ideal_harvesters', this.ideal_harvesters)
    setattr(proto_unit, 'weapon_cooldown', this.weapon_cooldown)
  }
}

class Builder {
  //For test code - build a dummy ResponseObservation proto.//

  constructor(obs_spec) {
    this._game_loop = 1
    this._player_common = new sc_pb.PlayerCommon()
    const pc = this._player_common
    pc.setPlayerId(1)
    pc.setMinerals(20)
    pc.setVespene(50)
    pc.setFoodCap(36)
    pc.setFoodUsed(21)
    pc.setFoodArmy(6)
    pc.setFoodWorkers(15)
    pc.setIdleWorkerCount(2)
    pc.setArmyCount(6)
    pc.setWarpGateCount(0)
    pc.setLarvaCount(0)

    this._score = 300
    this._score_details = new score_pb.ScoreDetails()
    const sc = this._score_details
    sc.setIdleProductionTime(0)
    sc.setIdleWorkerTime(0)
    sc.setTotalValueUnits(190)
    sc.setTotalValueStructures(230)
    sc.setKilledValueUnits(0)
    sc.setKilledValueStructures(0)
    sc.setCollectedMinerals(2130)
    sc.setCollectedVespene(560)
    sc.setCollectionRateMinerals(50)
    sc.setCollectionRateVespene(20)
    sc.setSpentMinerals(2000)
    sc.setSpentVespene(500)

    // javascript required
    sc.setFoodUsed(new sc_pb.CategoryScoreDetails())
    sc.setKilledMinerals(new sc_pb.CategoryScoreDetails())
    sc.setKilledVespene(new sc_pb.CategoryScoreDetails())
    sc.setLostMinerals(new sc_pb.CategoryScoreDetails())
    sc.setLostVespene(new sc_pb.CategoryScoreDetails())
    sc.setFriendlyFireMinerals(new sc_pb.CategoryScoreDetails())
    sc.setFriendlyFireVespene(new sc_pb.CategoryScoreDetails())
    sc.setUsedMinerals(new sc_pb.CategoryScoreDetails())
    sc.setUsedVespene(new sc_pb.CategoryScoreDetails())
    sc.setTotalUsedMinerals(new sc_pb.CategoryScoreDetails())
    sc.setTotalUsedVespene(new sc_pb.CategoryScoreDetails())
    sc.setTotalDamageDealt(new sc_pb.VitalScoreDetails())
    sc.setTotalDamageTaken(new sc_pb.VitalScoreDetails())
    sc.setTotalHealed(new sc_pb.VitalScoreDetails())

    this._obs_spec = obs_spec
    this._single_select = null
    this._multi_select = null
    this._build_queue = null
    this._production = null
    this._featureUnits = null
  }

  game_loop(game_loop) {
    this._game_loop = game_loop
    return this
  }

  player_common(/*{
    player_id = null,
    minerals = null,
    vespene = null,
    food_cap = null,
    food_used = null,
    food_army = null,
    food_workers = null,
    idle_worker_count = null,
    army_count = null,
    warp_gate_count = null,
    larva_count = null
  }*/kwargs
  ) {
    //Update some or all of the fields in the PlayerCommon data.//

    Object.keys(kwargs).forEach((key) => {
      const value = kwargs[key]
      setattr(this._player_common, key, value || null)
    })
    return this
  }

  score(score) {
    this._score = score
    return this
  }

  score_details(/*{
    idle_production_time = null,
    idle_worker_time = null,
    total_value_units = null,
    total_value_structures = null,
    killed_value_units = null,
    killed_value_structures = null,
    collected_minerals = null,
    collected_vespene = null,
    collection_rate_minerals = null,
    collection_rate_vespene = null,
    spent_minerals = null,
    spent_vespene = null,
  }*/kwargs
  ) {
    //Update some or all of the fields in the ScoreDetails data.//

    const args = kwargs
    Object.keys(args).forEach((key) => {
      const value = args[key]
      setattr(this._score_details, key, value)
    })
    return this
  }

  //eslint-disable-next-line
  score_by_category({ entry_name, none, army, economy, technology, upgrade }) {
    const field = getattr(this._score_details, entry_name);
    if (!field) {
      console.error(' entry_name: ', entry_name, '\n', this._score_details.toObject());
    }
    ['none', 'army', 'economy', 'technology', 'upgrade'].forEach((key) => {
      setattr(field, key, arguments[0][key]) //eslint-disable-line
    })
  }

  //eslint-disable-next-line
  score_by_vital({ entry_name, life, shields, energy }) {
    const field = getattr(this._score_details, entry_name);
    if (!field) {
      console.error(' entry_name: ', entry_name, '\n', this._score_details.toObject());
    }
    ['life', 'shields', 'energy'].forEach((key) => {
      setattr(field, key, arguments[0][key]) //eslint-disable-line
    })
  }

  single_select(unit) {
    this._single_select = unit
    return this
  }

  multi_select(units) {
    this._multi_select = units
    return this
  }

  build_queue(build_queue, production = null) {
    this._build_queue = build_queue
    this._production = production
    return this
  }

  feature_units(feature_units) {
    this._feature_units = feature_units
    return this
  }

  build() {
    //Builds and returns a proto ResponseObservation.//
    const response_observation = new sc_pb.ResponseObservation()
    const obs = new sc_pb.Observation()

    obs.setRawData(new sc_pb.ObservationRaw()) // javascript required
    obs.getRawData().setPlayer(new raw_pb.PlayerRaw())
    obs.getRawData().getPlayer().setCamera(new raw_pb.Point())
    obs.setGameLoop(this._game_loop)
    obs.setPlayerCommon(this._player_common.clone())

    const ability = new sc_pb.AvailableAbility()
    ability.setAbilityId(1)
    ability.setRequiresPoint(true) // Smart
    obs.addAbilities(ability)

    const score = new sc_pb.Score()
    score.setScore(this._score)
    score.setScoreDetails(this._score_details.clone())
    obs.setScore(score)

    function fill(image_data, size, bits) { //side effects only on image_data
      image_data.setBitsPerPixel(bits)
      const size2D = new common_pb.Size2DI()
      size2D.setY(size[0])
      size2D.setX(size[1])
      image_data.setSize(size2D)
      // unsafe way that uses unitialized memory:
      // image_data.setData(new Buffer(Math.ceil((size[0] * size[1] * bits) / 8)))
      //Buffer.alloc(size, fill, encoding):
      const n = Math.ceil((size[0] * size[1] * bits) / 8)
      // testing out what happens when we initialize with garbage bytes
      image_data.setData(Buffer.alloc(n, 'ff', 'hex'))
    }

    obs.setFeatureLayerData(new sc_pb.ObservationFeatureLayer())
    const rendersProto = new sc_pb.FeatureLayers()
    Object.keys(rendersProto.toObject()).forEach((field) => {
      setattr(rendersProto, field, new sc_pb.ImageData())
    })
    obs.getFeatureLayerData().setRenders(rendersProto)
    const minimapRendersProto = new sc_pb.FeatureLayersMinimap()
    Object.keys(minimapRendersProto.toObject()).forEach((field) => {
      setattr(minimapRendersProto, field, new sc_pb.ImageData())
    })
    obs.getFeatureLayerData().setMinimapRenders(minimapRendersProto)
    if (this._obs_spec.hasOwnProperty('feature_screen')) {
      features.SCREEN_FEATURES.forEach((feature) => {
        const renders = obs.getFeatureLayerData().getRenders()
        const imageData = getattr(renders, feature.name) || getattr(renders, feature.name + '_list')
        if (!imageData) {
          console.error(renders.toObject())
          throw new Error(`Failed to get ${feature.name} from:`, renders.toObject())
        }
        fill(imageData, this._obs_spec['feature_screen'].slice(1), 8)
      })
    }

    if (this._obs_spec.hasOwnProperty('feature_minimap')) {
      features.MINIMAP_FEATURES.forEach((feature) => {
        const renders = obs.getFeatureLayerData().getMinimapRenders()
        const imageData = getattr(renders, feature.name) || getattr(renders, feature.name + '_list')
        if (!imageData) {
          console.error(`Failed to find getter methods for field "${feature.name}" on\n`, renders.toObject())
          throw new Error(`Failed to get ${feature.name} from proto.`)
        }
        fill(imageData, this._obs_spec['feature_minimap'].slice(1), 8)
      })
    }

    obs.setRenderData(new sc_pb.ObservationRender())

    if (this._obs_spec.hasOwnProperty('rgb_screen')) {
      obs.getRenderData().setMap(new sc_pb.ImageData())
      fill(obs.getRenderData().getMap(), this._obs_spec['rgb_screen'].slice(0, 2), 24)
    }

    if (this._obs_spec.hasOwnProperty('rgb_minimap')) {
      obs.getRenderData().setMinimap(new sc_pb.ImageData())
      fill(obs.getRenderData().getMinimap(), this._obs_spec['rgb_minimap'].slice(0, 2), 24)
    }

    obs.setUiData(new sc_pb.ObservationUI())

    if (this._single_select) {
      obs.getUiData().setSingle(new sc_pb.SinglePanel())
      obs.getUiData().getSingle().setUnit(new ui_pb.UnitInfo())
      this._single_select.fill(obs.getUiData().getSingle().getUnit())
    }

    if (this._multi_select) {
      obs.getUiData().setMulti(new sc_pb.MultiPanel())
      this._multi_select.forEach((unit) => {
        const unitProto = new ui_pb.UnitInfo()
        unit.fill(unitProto)
        obs.getUiData().getMulti().addUnits(unitProto)
      })
    }


    if (this._build_queue) {
      obs.getUiData().setProduction(new ui_pb.ProductionPanel())
      this._build_queue.forEach((unit) => {
        const protoUnit = new ui_pb.UnitInfo()
        unit.fill(protoUnit)
        obs.getUiData().getProduction().addBuildQueue(protoUnit)
      })
    }

    if (this._production) {
      if (!obs.getUiData().hasProduction()) {
        obs.getUiData().setProduction(new ui_pb.ProductionPanel())
      }
      this._production.forEach((item) => {
        const itemProto = new ui_pb.BuildItem()
        itemProto.setAbilityId(item.ability_id)
        itemProto.setBuildProgress(item.build_progress)
        obs.getUiData().getProduction().addProductionQueue(itemProto)
      })
    }

    if (this._feature_units) {
      for (let i = 0; i < this._feature_units.length; i++) {
        const feature_unit = this._feature_units[i]
        const unitProto = new raw_pb.Unit()
        feature_unit.fill(unitProto)
        obs.getRawData().addUnits(unitProto)
      }
    }

    response_observation.setObservation(obs)
    return response_observation
  }
}
module.exports = {
  Builder,
  FeatureUnit,
  getattr,
  setattr,
  Unit,
}
