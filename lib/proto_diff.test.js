const s2clientprotocol = require('s2clientprotocol')
const dir = require('path')
const proto_diff = require(dir.resolve(__dirname, './proto_diff.js'))
const { sc2api_pb, score_pb } = s2clientprotocol
const sc_pb = sc2api_pb

// Tests for proto_diff.js
describe('proto_diff.js', () => {
  describe('  ProtoPathTest', () => {
    test('testCreationFromList', () => {
      const result = new proto_diff.ProtoPath(['observation', 'actions'])
      expect(result.toString()).toBe('observation.actions')
    })

    test('testCreationFromGenerator', () => {
      const str = 'abc'
      const a = []
      for (let i = 0; i < str.length; i++) {
        a.push(str[i])
      }
      const result = new proto_diff.ProtoPath(a)
      expect(result.toString()).toBe('a.b.c')
    })

    test('testStringRepr', () => {
      const result = new proto_diff.ProtoPath(['observation', 'actions', 1, 'target'])
      expect(result.toString()).toBe('observation.actions[1].target')
    })

    test('testOrdering', () => {
      const a = new proto_diff.ProtoPath(['observation', 'actions', 1, 'target'])
      const b = new proto_diff.ProtoPath(['observation', 'actions', 1, 'game_loop'])
      const c = new proto_diff.ProtoPath(['observation', 'actions', 1])
      const d = new proto_diff.ProtoPath(['observation'])
      expect(b < a).toBe(true)
      expect(c < a).toBe(true)
      expect(c > d).toBe(true)
    })

    test('testEquals', () => {
      const a = new proto_diff.ProtoPath(['observation', 'actions', 1])
      const b = new proto_diff.ProtoPath(['observation', 'actions', 1])
      expect(a.toString()).toBe(b.toString())
      expect(a.__hash__()).toBe(b.__hash__())
    })

    test('testNotEqual', () => {
      const a = new proto_diff.ProtoPath(['observation', 'actions', 1])
      const b = new proto_diff.ProtoPath(['observation', 'actions', 2])
      expect(a.toString()).not.toBe(b.toString())
      expect(a.__hash__()).not.toBe(b.__hash__())
    })

    test('testIndexing', () => {
      const path = new proto_diff.ProtoPath(['observation', 'actions', 1])
      expect(path[0].toString()).toBe('observation')
      expect(path[1].toString()).toBe('actions')
      expect(path[path.length - 2]).toBe('actions')
      expect(path[path.length - 1]).toBe(1)
    })

    test('testGetField', () => {
      var proto = new sc_pb.ResponseObservation()
      var observation = new sc_pb.Observation()
      observation.setGameLoop(1)
      observation.setAlertsList([sc_pb.Alert.ALERTERROR])
      proto.setObservation(observation)
      const game_loop = new proto_diff.ProtoPath(['observation', 'game_loop'])
      const alert = new proto_diff.ProtoPath(['observation', 'alerts', 0])
      expect(game_loop.get_field(proto)).toBe(1)
      expect(alert.get_field(proto)).toBe(sc_pb.Alert.ALERTERROR)
      const test = new proto_diff.ProtoPath(game_loop._path.slice(0, game_loop._path.length - 1))
      expect(test.get_field(proto)).toBe(observation)
    })

    test('testWithAnonymousArrayIndices', () => {
      const a = new proto_diff.ProtoPath(['observation', 'actions'])
      const b = new proto_diff.ProtoPath(['observation', 'actions', 1])
      const c = new proto_diff.ProtoPath(['observation', 'actions', 2])
      expect(a.toString()).toBe('observation.actions')
      expect(b.with_anonymous_array_indices().toString()).toBe('observation.actions[*]')
      expect(b.with_anonymous_array_indices().toString()).toBe(c.with_anonymous_array_indices().toString())
    })
  })

  function _alert_formatter(path, proto_a, proto_b) {
    const field_a = path.get_field(proto_a)
    let a
    let b
    if (path[path.length - 2] == 'alertsList') {
      const field_b = path.get_field(proto_b)
      Object.keys(sc_pb.Alert).forEach((k) => {
        if (sc_pb.Alert[k] == field_a) {
          a = k
        } else if (sc_pb.Alert[k] == field_b) {
          b = k
        }
      })
      return `${a} -> ${b}`
    }
  }

  describe('  ProtoDiffTest', () => {
    test('testNoDiffs', () => {
      var a = new sc_pb.ResponseObservation()
      var b = new sc_pb.ResponseObservation()
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).toBeNull()
    })

    test('testAddedField', () => {
      var a = new sc_pb.ResponseObservation()
      var b = new sc_pb.ResponseObservation()
      var observation = new sc_pb.Observation()
      observation.setGameLoop(1)
      b.setObservation(observation)
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.added.length).toBe(1)
      expect(diff.added[0].toString()).toBe('observation')
      expect(diff.added).toMatchObject(diff.all_diffs())
      expect(diff.report()).toBe('Added observation.')
    })

    test('testAddedFields', () => {
      var a = new sc_pb.ResponseObservation()
      var observation1 = new sc_pb.Observation()
      var b = new sc_pb.ResponseObservation()
      var observation2 = new sc_pb.Observation()
      observation1.setAlertsList([sc_pb.Alert.ALERTERROR])
      a.setObservation(observation1)
      observation2.setAlertsList([sc_pb.Alert.ALERTERROR, sc_pb.Alert.MERGECOMPLETE])
      b.setObservation(observation2)
      b.setPlayerResultList([new sc_pb.PlayerResult()])
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.added.length).toBe(2)
      expect(diff.added[0].toString()).toBe('observation.alertsList')
      expect(diff.added[1].toString()).toBe('playerResultList')
      expect(diff.added).toMatchObject(diff.all_diffs())
      expect(diff.report()).toBe('Added observation.alertsList.\nAdded playerResultList.')
    })

    test('testRemovedField', () => {
      var a = new sc_pb.ResponseObservation()
      var observation1 = new sc_pb.Observation()
      var b = new sc_pb.ResponseObservation()
      var observation2 = new sc_pb.Observation()
      observation1.setGameLoop(1)
      a.setObservation(observation1)
      b.setObservation(observation2)
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.removed.length).toBe(1)
      expect(diff.removed[0].toString()).toBe('observation.gameLoop')
      expect(diff.removed).toMatchObject(diff.all_diffs())
      expect(diff.report()).toBe('Removed observation.gameLoop.')
    })

    test('testRemovedFields', () => {
      var a = new sc_pb.ResponseObservation()
      var observation1 = new sc_pb.Observation()
      var b = new sc_pb.ResponseObservation()
      var observation2 = new sc_pb.Observation()
      observation1.setGameLoop(1)
      observation1.setScore(new score_pb.Score())
      observation1.setAlertsList([sc_pb.Alert.ALERTERROR, sc_pb.MERGECOMPLETE])
      a.setObservation(observation1)
      observation2.setAlertsList([sc_pb.Alert.ALERTERROR])
      b.setObservation(observation2)
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.removed.length).toBe(3)
      expect(diff.removed[0].toString()).toBe('observation.alertsList')
      expect(diff.removed[1].toString()).toBe('observation.gameLoop')
      expect(diff.removed[2].toString()).toBe('observation.score')
      expect(diff.removed).toMatchObject(diff.all_diffs())
      expect(diff.report()).toBe('Removed observation.alertsList.\nRemoved observation.gameLoop.\nRemoved observation.score.')
    })

    test('testChangedField', () => {
      var a = new sc_pb.ResponseObservation()
      var observation1 = new sc_pb.Observation()
      var b = new sc_pb.ResponseObservation()
      var observation2 = new sc_pb.Observation()
      observation1.setGameLoop(1)
      observation2.setGameLoop(2)
      a.setObservation(observation1)
      b.setObservation(observation2)
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.changed.length).toBe(1)
      expect(diff.changed[0].toString()).toBe('observation.gameLoop')
      expect(diff.changed).toMatchObject(diff.all_diffs())
      expect(diff.report()).toBe('Changed observation.gameLoop: 1 -> 2.')
    })

    test('testChangedFields', () => {
      var a = new sc_pb.ResponseObservation()
      var observation1 = new sc_pb.Observation()
      var b = new sc_pb.ResponseObservation()
      var observation2 = new sc_pb.Observation()
      observation1.setGameLoop(1)
      observation1.setAlertsList([sc_pb.Alert.ALERTERROR, sc_pb.Alert.LARVAHATCHED])
      a.setObservation(observation1)
      observation2.setGameLoop(2)
      observation2.setAlertsList([sc_pb.Alert.ALERTERROR, sc_pb.Alert.MERGECOMPLETE])
      b.setObservation(observation2)
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.changed.length).toBe(2)
      expect(diff.changed[0].toString()).toBe('observation.alertsList[1]')
      expect(diff.changed[1].toString()).toBe('observation.gameLoop')
      expect(diff.changed).toMatchObject(diff.all_diffs())
      expect(diff.report()).toBe('Changed observation.alertsList[1]: 7 -> 8.\nChanged observation.gameLoop: 1 -> 2.')
      expect(diff.report([_alert_formatter])).toBe('Changed observation.alertsList[1]: LARVAHATCHED -> MERGECOMPLETE.\nChanged observation.gameLoop: 1 -> 2.')
    })

    test('testTruncation', () => {
      var a = new sc_pb.ResponseObservation()
      var observation1 = new sc_pb.Observation()
      var b = new sc_pb.ResponseObservation()
      var observation2 = new sc_pb.Observation()
      observation1.setGameLoop(1)
      observation1.setAlertsList([sc_pb.Alert.ALERTERROR, sc_pb.Alert.LARVAHATCHED])
      a.setObservation(observation1)
      observation2.setGameLoop(2)
      observation2.setAlertsList([sc_pb.Alert.ALERTERROR, sc_pb.Alert.MERGECOMPLETE])
      b.setObservation(observation2)
      const diff = proto_diff.compute_diff(a, b)
      expect(diff).not.toBeNull()
      expect(diff.report([_alert_formatter], 9)).toBe('Changed observation.alertsList[1]: LARVAH....\nChanged observation.gameLoop: 1 -> 2.')
      expect(diff.report([_alert_formatter], -1)).toBe('Changed observation.alertsList[1]: ....\nChanged observation.gameLoop: ... -> ....')
    })
  })
})
