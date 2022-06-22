export default class RTCIceCandidate{
     candidate : any
     sdpMid : any
     sdpMLineIndex : any
     constructor(obj : any) {
          this.candidate = obj.candidate
          this.sdpMid = obj.sdpMid
          this.sdpMLineIndex = obj.sdpMLineIndex
     }
}