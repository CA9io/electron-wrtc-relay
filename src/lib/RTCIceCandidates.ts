'use strict'

module.exports = class RTCIceCandidate {
    private candidate : any;
    private sdpMid : any;
    private sdpMLineIndex: any;
    constructor (obj) {
        this.candidate = obj.candidate
        this.sdpMid = obj.sdpMid
        this.sdpMLineIndex = obj.sdpMLineIndex
    }
}
