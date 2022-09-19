'use strict'

module.exports = class RTCSessionDescription {
    type
    sdp

    constructor(obj: { type: any; sdp: any }) {
        this.type = obj.type
        this.sdp = obj.sdp
    }

    toJSON() {
        return this
    }
}
