var EventEmitter = require('events').EventEmitter
const Bridge = require("./src/ElectronBridge")

module.exports = function (opts) {
  var bridge = new Bridge(opts)
  var wrtc = new EventEmitter()

  return Object.assign(wrtc, {
    close: bridge.close.bind(bridge),
    electronDaemon: bridge,
    init: bridge.init.bind(bridge),
    RTCPeerConnection: require('./src/RTCPeerConnection.js')(bridge, wrtc),
    RTCSessionDescription: require('./src/RTCSessionDescription.js'),
    RTCIceCandidate: require('./src/RTCIceCandidate.js'),
    RTCDataChannel: require('./src/RTCDataChannel.js')(bridge, wrtc)
  })
}
