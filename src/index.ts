import {EventEmitter} from "events"

const Bridge = require('./lib/ElectronBridge')

export type OPTS = { debug?: boolean, preload?: string, webrtcPolicy?: "default" | "default_public_interface_only" | "default_public_and_private_interfaces" | "disable_non_proxied_udp" }

export interface BRIDGE extends EventEmitter {
    init: () => void;
    eval: (code: string, opts?: any, cb?: (err: null | Error, res?: any) => void) => void;
    close: () => void;
    closing: boolean;
    ready: boolean;
}

module.exports = function (opts: OPTS) {
    const bridge: BRIDGE = new Bridge(opts)
    const wrtc = new EventEmitter()

    return Object.assign(wrtc, {
        close: bridge.close.bind(bridge),
        electronDaemon: bridge,
        init: bridge.init.bind(bridge),
        RTCPeerConnection: require('./wrtc/RTCPeerConnection.js')(bridge, wrtc),
        RTCSessionDescription: require('./wrtc/RTCSessionDescription.js'),
        RTCIceCandidate: require('./wrtc/RTCIceCandidate.js'),
        RTCDataChannel: require('./wrtc/RTCDataChannel.js')(bridge, wrtc)
    })
}
