var s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const dir = require('path') //eslint-disable-line
const image_differencer = require(dir.resolve(__dirname, 'image_differencer.js'))
const proto_diff = require(dir.resolve(__dirname, 'proto_diff.js'))
const { common_pb, sc2api_pb, spatial_pb } = s2clientprotocol
const sc_pb = sc2api_pb

describe('image_differencer.js', () => {
  describe('  ImageDifferencerTest', () => {
    test('testFilteredOut', () => {
      const path = new proto_diff.ProtoPath(['observation', 'actions', 1])
      const result = image_differencer.image_differencer(path, null, null)
      expect(result).toBeNull()
    })

    test('testFilteredIn', () => {
      const a = new sc_pb.ResponseObservation()
      const observation = new sc_pb.Observation()
      const feature_layer_data_a = new spatial_pb.ObservationFeatureLayer()
      const renders_a = new spatial_pb.FeatureLayers()
      const height_map_a = new common_pb.ImageData()
      height_map_a.setBitsPerPixel(32)
      const size_a = new common_pb.Size2DI()
      size_a.setX(4)
      size_a.setY(4)
      height_map_a.setSize(size_a)
      const data_1 = new Uint32Array([0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1])
      const data_a = new Uint8Array(data_1.buffer)
      height_map_a.setData(data_a)
      renders_a.setHeightMap(height_map_a)
      feature_layer_data_a.setRenders(renders_a)
      observation.setFeatureLayerData(feature_layer_data_a)
      a.setObservation(observation)

      const b = new sc_pb.ResponseObservation()
      const observation_b = new sc_pb.Observation()
      const feature_layer_data_b = new spatial_pb.ObservationFeatureLayer()
      const renders_b = new spatial_pb.FeatureLayers()
      const height_map_b = new common_pb.ImageData()
      height_map_b.setBitsPerPixel(32)
      const size_b = new common_pb.Size2DI()
      size_b.setX(4)
      size_b.setY(4)
      height_map_b.setSize(size_b)
      const data_2 = new Uint32Array([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0])
      const data_b = new Uint8Array(data_2.buffer)
      height_map_b.setData(data_b)
      renders_b.setHeightMap(height_map_b)
      feature_layer_data_b.setRenders(renders_b)
      observation_b.setFeatureLayerData(feature_layer_data_b)
      b.setObservation(observation_b)

      const path = new proto_diff.ProtoPath(['observation', 'feature_layer_data', 'renders', 'height_map', 'data'])
      const result = image_differencer.image_differencer(path, a, b)
      expect(result).toBe('3 element(s) changed - [1][0]: 1 -> 0; [1][1]: 0 -> 1; [3][3]: 1 -> 0')
    })
  })
})
