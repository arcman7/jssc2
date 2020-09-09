const path = require('path') //eslint-disable-line
const point = require(path.resolve(__dirname, './point.js'))
const pythonUtils = require(path.resolve(__dirname, './pythonUtils.js'))

const { assert, isinstance, NotImplementedError } = pythonUtils

class Transform {
  fwd_dist() {//eslint-disable-line
    throw NotImplementedError()
  }

  fwd_pt() {//eslint-disable-line
    throw NotImplementedError()
  }

  back_dist() {//eslint-disable-line
    throw NotImplementedError()
  }

  back_pt() {//eslint-disable-line
    throw NotImplementedError()
  }
}

class Linear extends Transform {
  constructor(scale = null, offset = null) {
    //object was passed in
    // { scale: scale, offset: offset }
    if (!(scale instanceof point.Point)) {
      if (scale && scale.offset) {
        offset = scale.offset
        scale = scale.scale || null
      }
    }
    super()
    if (scale == null || scale == undefined) {
      this.scale = new point.Point(1, 1)
    } else if (isinstance(scale, Number)) {
      this.scale = new point.Point(scale, scale)
    } else {
      this.scale = scale
    }
    assert(this.scale.x !== 0 && this.scale.y !== 0, ' new Linear.scale.x !== 0 && new Linear.scale.y !== 0')
    this.offset = offset || new point.Point(0, 0)
  }

  fwd_dist(dist) {
    return dist * this.scale.x
  }

  fwd_pt(pt) {
    return pt.mul(this.scale).add(this.offset)
  }

  back_dist(dist) {
    return dist / this.scale.x
  }

  back_pt(pt) {
    pt = pt.sub(this.offset).div(this.scale)
    return pt
  }

  toString() {
    return `Linear(scale = ${this.scale}, offset = ${this.offset})`
  }
}

class Chain extends Transform {
  constructor() {
    super(arguments) //eslint-disable-line
    this.transforms = Array.from(arguments) //eslint-disable-line
  }

  fwd_dist(dist) {
    for (let i = 0; i < this.transforms.length; i++) {
      const transform = this.transforms[i]
      dist = transform.fwd_dist(dist)
    }
    return dist
  }

  fwd_pt(pt) {
    for (let i = 0; i < this.transforms.length; i++) {
      const transform = this.transforms[i]
      pt = transform.fwd_pt(pt)
    }
    return pt
  }

  back_dist(dist) {
    for (let i = this.transforms.length - 1; i >= 0; i--) {
      const transform = this.transforms[i]
      dist = transform.back_dist(dist)
    }
    return dist
  }

  back_pt(pt) {
    for (let i = this.transforms.length - 1; i >= 0; i--) {
      const transform = this.transforms[i]
      pt = transform.back_pt(pt)
    }
    return pt
  }

  toString() {
    return `Chain(${this.transforms})`
  }
}

class PixelToCoord extends Transform {
  //Take a point within a pixel and use the tl, or tl to pixel center.
  fwd_dist(dist) { //eslint-disable-line
    return dist
  }

  fwd_pt(pt) { //eslint-disable-line
    return pt.floor()
  }

  back_dist(dist) { //eslint-disable-line
    return dist
  }

  back_pt(pt) { //eslint-disable-line
    return pt.floor().add(0.5)
  }

  toString() { //eslint-disable-line
    return 'PixelToCoord()'
  }
}

module.exports = {
  Chain,
  Linear,
  PixelToCoord,
  Transform,
}
