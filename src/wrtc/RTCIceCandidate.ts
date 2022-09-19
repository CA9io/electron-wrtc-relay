'use strict'

module.exports = class RTCIceCandidate {
    candidate: any
    sdpMid: any
    sdpMLineIndex: any

    constructor(obj: { candidate: any; sdpMid: any; sdpMLineIndex: any }) {
        this.candidate = obj.candidate
        this.sdpMid = obj.sdpMid
        this.sdpMLineIndex = obj.sdpMLineIndex
    }
}
