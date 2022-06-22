import {App} from "electron"
import Daemon from "./src/daemon"
var EventEmitter = require('events').EventEmitter

// hand over app
module.exports = function (opts: {app: App}) {
    var daemon = new Daemon(opts)
    var wrtc = new EventEmitter()

    return Object.assign(wrtc, {
        //close: daemon.close.bind(daemon),
        electronDaemon: daemon,
        RTCPeerConnection: require('./src/RTCPeerConnection.js')(daemon, wrtc),
        RTCSessionDescription: require('./src/RTCSessionDescription.js'),
        RTCIceCandidate: require('./src/RTCIceCandidate.js'),
        RTCDataChannel: require('./src/RTCDataChannel.js')
    })
}
