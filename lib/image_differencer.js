const s2clientprotocol = require('s2clientprotocol') //eslint-disable-line
const dirpath = require('path') //eslint-disable-line
const features = require(dirpath.resolve(__dirname, './features.js'))
const np_util = require(dirpath.resolve(__dirname, './np_util.js'))
const proto_diff = require(dirpath.resolve(__dirname, './proto_diff.js'))
const { common_pb } = s2clientprotocol
// Compare the observations from multiple binaries.

function image_differencer(path, proto_a, proto_b) {
  // proto_diff differencer for PySC2 image data.
  if (path[path.length - 1] == 'data' && path.length >= 2) {
    const image_data_path = new proto_diff.ProtoPath(path.slice(0, path.length - 1))
    const image_data_a = image_data_path.get_field(proto_a)
    if (image_data_a instanceof common_pb.ImageData) {
      const image_data_b = image_data_path.get_field(proto_b)
      const image_a = features.Feature.unpack_layer(image_data_a).arraySync()
      const image_b = features.Feature.unpack_layer(image_data_b).arraySync()
      return np_util.summarize_array_diffs(image_a, image_b)
    }
  }
  return null
}

module.exports = {
  image_differencer
}
