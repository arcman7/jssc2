const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path //eslint-disable-line
const ffmpeg = require('fluent-ffmpeg') //eslint-disable-line
ffmpeg.setFfmpegPath(ffmpegPath)


function onError(err, stdout, stderr) {
  console.error('Cannot process video: ' + err.message)
}

class VideoWriter {
  //Write a video based on a numpy array.//

  constructor(filename, frame_wrate, logging = true) {
    this.logging = logging
    this.timemark = null
    this.command = ffmpeg()
    this.command
      .on('end', this.onEnd.bind(this))
      .on('progress', this.onProgress.bind(this))
      .on('error', onError)
      // .input(filename)
      .inputFPS(frame_wrate)
      .output(filename)
      .outputFPS(frame_wrate)
      // .run()
  }

  add(frame) {
    //Add a frame to the video based on a numpy array.//
    this.writeFrame(frame)
  }

  close() { //eslint-disable-line
    //
  }

  writeFrame(frame) {
    this.command.input(frame).run()
  }

  onProgress(progress) {
    if (progress.timemark != this.timemark) {
      this.timemark = progress.timemark
    }
    if (this.logging) {
      console.info('Time mark: ' + this.timemark + "...")
    }
  }

  onEnd() {
    if (this.logging) {
      console.info('Finished processing')
    }
  }
}

module.exports = {
  VideoWriter,
}
