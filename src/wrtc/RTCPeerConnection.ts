'use strict'
import {EventEmitter} from "events";
import {BRIDGE} from "../index";
import crypto from "crypto";

const debug = require('debug')('RTCPC')

module.exports = function (bridge: BRIDGE, wrtc: EventEmitter) {
    const RTCDataChannel = require('./RTCDataChannel.js')(bridge, wrtc)

    let i = 0

    return class RTCPeerConnection extends EventEmitter {
        private _id: string
        private _dataChannels: Map<any, any>
        private _offer: any;
        private _answer: any;
        iceConnectionState: string;
        iceGatheringState: string;
        localDescription: any;
        peerIdentity: { catch: (err: Error) => void };
        remoteDescription: any;
        signalingState: string;

        constructor(opts: any) {
            super()
            if (bridge.closing) {
                throw new Error('Cannot create RTCPeerConnection, the electron-webrtc daemon has been closed')
            }
            this._id = (i++).toString(36)
            this._dataChannels = new Map()
            this._offer = null
            this._answer = null
            this.iceConnectionState = 'new'
            this.iceGatheringState = 'new'
            this.localDescription = null
            this.peerIdentity = {
                catch: (err) => {
                    console.error(err)
                }
            } // TODO: update this
            this.remoteDescription = null
            this.signalingState = 'stable'
            bridge.on(`pc:${this._id}`, this.onMessage.bind(this))
            bridge.eval(JSON.stringify(this._id), `
        (function () {
          var pc = conns[${JSON.stringify(this._id)}] = new webkitRTCPeerConnection(${JSON.stringify(opts)})
          pc.dataChannels = {}
          var id = 'pc:' + ${JSON.stringify(this._id)}
          pc.onaddstream = function (e) {
            // TODO: send MediaStream info
            send(id, { type: 'addstream' })
          }
          pc.ondatachannel = function (e) {
            pc.dataChannels[e.channel.id] = e.channel
            var channel = {}
            for (var key in e.channel) {
              if (typeof e.channel[key] === 'function' || e.channel[key] == null) continue
              channel[key] = e.channel[key]
            }
            // Queues messages that have been recieved before the message listener has been added
            e.channel.msgQueue = []
            e.channel.onmessage = function (eMsg) {
              e.channel.msgQueue.push(eMsg)
            }
            send(id, {
              type: 'datachannel',
              channel: channel
            })
          }
          pc.onicecandidate = function (e) {
            var event = {}
            if (e.candidate) {
              event.candidate = {
                candidate: e.candidate.candidate,
                sdpMid: e.candidate.sdpMid,
                sdpMLineIndex: e.candidate.sdpMLineIndex
              }
            }
            var offer, answer
            function sendEvent () {
              send(id, {
                type: 'icecandidate',
                event: event,
                iceGatheringState: pc.iceGatheringState,
                // offer: offer ? offer.toJSON() : null //is already an object?
                offer: offer ? offer : null
              })
            }
            pc.createOffer(function (o) {
              offer = o
              sendEvent()
            }, function () {
              offer = false
              sendEvent()
            })
          }
          pc.oniceconnectionstatechange = function (e) {
            send(id, { type: 'iceconnectionstatechange', iceConnectionState: pc.iceConnectionState })
          }
          pc.onidentityresult = function (e) {
            send(id, { type: 'identityresult', event: {
              assertion: e.assertion
            }})
          }
          pc.onidpassertionerror = function (e) {
            send(id, {
              type: 'idpassertionerror',
              event: {
                idp: e.idp,
                loginUrl: e.loginUrl,
                protocol: e.protocol,
              }
            })
          }
          pc.onidpvalidationerror = function (e) {
            send(id, {
              type: 'idpvalidationerror',
              event: {
                idp: e.idp,
                loginUrl: e.loginUrl,
                protocol: e.protocol,
              }
            })
          }
          pc.onnegotiationneeded = function (e) {
            send(id, { type: 'negotiationneeded' })
          }
          pc.onremovestream = function (e) {
            send(id, {
              type: 'removestream',
              event: { id: e.stream.id }
            })
          }
          pc.onsignalingstatechange = function (e) {
            send(id, {
              type: 'signalingstatechange',
              signalingState: pc.signalingState
            })
          }
          
          invokeGC()
        })()
      `, (err: Error) => {
                if (err) wrtc.emit('error', err, this)
            })
        }

        onMessage(message: any) {
            // @ts-ignore
            const handler = this['on' + message.type]
            const event = message.event || {}

            debug(this._id + '<<', message.type, message, !!handler)

            // TODO: create classes for different event types?

            switch (message.type) {
                case 'addstream':
                    // TODO: create MediaStream wrapper
                    // TODO: index MediaStream by id
                    // TODO: create event
                    break

                case 'datachannel':
                    message.channel._pcId = this._id
                    event.channel = new RTCDataChannel(message.channel)
                    this._dataChannels.set(event.channel.id, event.channel)
                    break

                case 'icecandidate':
                    this.iceGatheringState = message.iceGatheringState
                    if (message.offer) {
                        this._offer = Object.assign(this._offer || {}, message.offer)
                    }
                    break

                case 'iceconnectionstatechange':
                    this.iceConnectionState = message.iceConnectionState
                    break

                case 'removestream':
                    // TODO: fetch MediaStream by id
                    // TODO: create event
                    break

                case 'signalingstatechange':
                    this.signalingState = message.signalingState
                    break
            }

            this.emit(message.type, event)
            if (handler) handler(event)
        }

        createDataChannel(label: any, options: any) {
            const dc = new RTCDataChannel(this._id, label, options)
            dc.once('init', () => this._dataChannels.set(dc.id, dc))
            return dc
        }

        // fix - https://github.com/mappum/electron-webrtc/pull/91/commits/ab2b35aeda147eafa536ebf676f0ec9da58d0e12
        _getCreateArgs(cb: any, errCb: any, options: any) {
            if (cb && errCb) return { // old API
                cb: cb,
                errCb: errCb,
                options: options
            };
            else return { // new Promise API
                options: cb
            }
        }

        createOffer(p1: any, p2: any, p3: any) {
            let {cb, errCb, options} = this._getCreateArgs(p1, p2, p3);
            if (this._offer) {
                if (cb) cb(this._offer)
                Promise.resolve(this._offer);
            }
            // fix - https://github.com/mappum/electron-webrtc/pull/91/commits/ab2b35aeda147eafa536ebf676f0ec9da58d0e12
            // if (this._offer) return cb(this._offer)
            return this._callRemote(
                'createOffer',
                `onSuccess, onFailure, ${JSON.stringify(options)}`,
                (offer: any) => {
                    this._offer = offer
                    // fix - https://github.com/mappum/electron-webrtc/pull/91/commits/ab2b35aeda147eafa536ebf676f0ec9da58d0e12
                    //cb(offer)
                    if (cb) cb(offer)
                }, errCb
            )
        }

        createAnswer(p1: any, p2: any, p3: any) {
            // fix - https://github.com/mappum/electron-webrtc/pull/91/commits/ab2b35aeda147eafa536ebf676f0ec9da58d0e12
            let {cb, errCb, options} = this._getCreateArgs(p1, p2, p3);
            if (this._answer) {
                if (cb) cb(this._answer)
                Promise.resolve(this._answer)
            }
            //if (this._answer) return cb(this._answer)
            return this._callRemote(
                'createAnswer',
                `onSuccess, onFailure, ${JSON.stringify(options)}`,
                (answer: any) => {
                    this._answer = answer
                    if (cb) cb(answer)
                }, errCb
            )
        }

        setLocalDescription(desc: any, cb: any, errCb: any) {
            this.localDescription = desc
            return this._callRemote(
                'setLocalDescription',
                `new RTCSessionDescription(${JSON.stringify(desc)}), onSuccess, onFailure`,
                cb, errCb)
        }

        setRemoteDescription(desc: any, cb: any, errCb: any) {
            this.remoteDescription = desc
            return this._callRemote(
                'setRemoteDescription',
                `new RTCSessionDescription(${JSON.stringify(desc)}), onSuccess, onFailure`,
                cb, errCb)
        }

        addIceCandidate(candidate: any, cb: any, errCb: any) {
            return this._callRemote(
                'addIceCandidate',
                `new RTCIceCandidate(${JSON.stringify(candidate)}), onSuccess, onFailure`,
                cb, errCb)
        }

        close() {
            this._eval(`
        if (pc && pc.signalingState !== 'closed') pc.close()
        pc = null
      `)
        }

        getStats(cb: any) {
            this._callRemote('getStats', `
        function (res) {
          res = res.result()
          var output = res.map(function (res) {
            var item = {
              id: res.id,
              timestamp: res.timestamp,
              type: res.type,
              stats: {}
            }
            res.names().forEach(function (name) {
              item.stats[name] = res.stat(name)
            })
            return item
          })
          onSuccess(output)
        }
      `, (res: any) => {
                for (let item of res) {
                    let stats = item.stats
                    delete item.stats
                    item.names = () => Object.keys(stats)
                    item.stat = (name: string | number) => stats[name]
                }
                cb({result: () => res})
            })
        }

        _eval(code: string, cb?: any, errCb?: any) {
            let _resolve: (value: unknown) => void
            let _reject: (reason?: any) => void
            const promise = new Promise((resolve, reject) => {
                _resolve = resolve
                _reject = reject
            });
            const reqId = crypto.randomBytes(16).toString("hex");
            bridge.once(reqId, (res) => {
                if (res.err) {
                    if (errCb) errCb(res.err)
                    _reject(res.err)
                } else {
                    if (cb) cb(res.res)
                    _resolve(res.res)
                }
            })
            bridge.eval(JSON.stringify(this._id),`
        (function () {
          var id = ${JSON.stringify(this._id)}
          var reqId = ${JSON.stringify(reqId)}
          var pc = conns[id]
          var onSuccess = function (res) {
            send(reqId, { res: res && res.toJSON ? res.toJSON() : res })
          }
          var onFailure = function (err) {
            send(reqId, { err: err })
          }
          ${code}
        })()
      `, (err: Error) => {
                if (err) wrtc.emit('error', err, this)
            })
            return promise
        }

        _callRemote(name: string, args?: any, cb?: any, errCb?: any) {
            return this._eval(`pc.${name}(${args || ''})`, cb, errCb)
        }
        
        addEventListener = this.addListener
    }
}
