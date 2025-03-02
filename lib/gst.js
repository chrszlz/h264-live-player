
"use strict";

const spawn = require('child_process').spawn;
const merge = require('mout/object/merge');

const Server = require('./_server');


class GSTServer extends Server {

  constructor(server, opts) {
    super(server, merge({
      fps: 30,
      width: 960,
      height: 540,
    }, opts));
  }

  get_feed() {
    const gstProcess = spawn('gst-launch-1.0', [
      '-q',
      'videotestsrc', 'pattern=ball', 'is-live=true',
      '!',
      'x264enc', 'speed-preset=ultrafast', `key-int-max=${this.options.fps}`, 'bitrate=2500',
      '!',
      `video/x-h264,width=${this.options.width},height=${this.options.height},framerate=${this.options.fps}/1,profile=baseline`,
      '!',
      'h264parse',
      '!',
      'video/x-h264,stream-format=byte-stream',
      '!',
      'fdsink'
    ]);

    gstProcess.stderr.on('data', (data) => {
      console.log('GStreamer:', data.toString());
    });

    gstProcess.on('error', (error) => {
      console.error('GStreamer process error:', error);
    });

    gstProcess.on('exit', (code, signal) => {
      console.log(`GStreamer process exited with code ${code} and signal ${signal}`);
    });

    console.log('GStreamer pipeline created');
    return gstProcess.stdout;
  }

};

module.exports = GSTServer;
