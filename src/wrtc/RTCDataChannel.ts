'use strict'
import {BRIDGE} from "../index";
import {EventEmitter} from "events";

const debug = require('debug')('RTCDC')

module.exports = function (bridge: BRIDGE, wrtc: EventEmitter) {
    return class RTCDataChannel extends EventEmitter {
        private _pcId: any;
        private label: any;
        ordered: any;
        protocol: string = "";
        id: any;
        stream: any;
        readyState: any;
        bufferedAmount: any;
        private _bufferedAmountLowThreshold: any;
        private _binaryType: any
        maxPacketLifeType: any;
        maxRetransmits: any;
        negotiated: any;
        reliable: any;

        constructor(pcId: any, label: any, opts: any) {
            super()
            if (typeof pcId === 'object') {
                // wrap existing remote RTCDataChannel
                this._wrap(pcId)
            } else {
                // create new remote RTCDataChannel
                this._create(pcId, label, opts)
            }
        }

        _create(pcId: any, label: any, opts: { reliable?: any }) {
            opts = opts || {}
            this._pcId = pcId
            this.label = label
            this.ordered = null
            this.protocol = ''
            this.id = this.stream = null
            this.readyState = 'connecting'
            this.bufferedAmount = 0
            this._bufferedAmountLowThreshold = 0
            this._binaryType = 'blob'
            this.maxPacketLifeType = null
            this.maxRetransmits = null
            this.negotiated = false
            this.reliable = typeof opts.reliable === 'boolean' ? opts.reliable : true
            this.on('error', (err: any) => wrtc.emit('error', err, this))
            bridge.eval(JSON.stringify(pcId),`
        var pc = conns[${JSON.stringify(pcId)}]
        var dc = pc.createDataChannel(
          ${JSON.stringify(label)}, ${JSON.stringify(opts)})
        pc.dataChannels[dc.id] = dc
        // Queues messages that have been recieved before the message listener has been added
        dc.msgQueue = []
        dc.onmessage = function (eMsg) {
          dc.msgQueue.push(eMsg)
        }
        dc.id
      `, (err: any, id: any) => {
                if (err) return console.error(err) // this.emit('error', err)
                this.id = this.stream = id
                this._registerListeners()
                this.emit('init')
            })
        }

        _wrap(init: { [x: string]: any }) {
            for (let k in init) {
                // @ts-ignore
                this[k] = init[k]
            }
            this.stream = this.id
            this._registerListeners()
            this.on('error', (err: any) => wrtc.emit('error', err, this))
        }

        _registerListeners(cb?: any) {
            bridge.on(`dc:${this._pcId}:${this.id}`, this.onMessage.bind(this))
            this._eval(`
        var id = 'dc:' + ${JSON.stringify(this._pcId)} + ':' + dc.id
        dc.onopen = function () {
          send(id, {
            type: 'open',
            state: {
              ordered: dc.ordered,
              protocol: dc.protocol,
              maxPacketLifeType: dc.maxPacketLifeType,
              maxRetransmits: dc.maxRetransmits,
              negotiated: dc.negotiated,
              reliable: dc.reliable
            }
          })
        }
        dc.onmessage = function (e) {
          send(id, {
            type: 'message',
            event: {
              data: e.data instanceof ArrayBuffer ? arrayBufferToBase64(e.data) : e.data,
              origin: e.origin
            },
            dataType: e.data instanceof ArrayBuffer ? 'binary' : 'string'
          })
        }
        dc.onbufferedamountlow = function () {
          send(id, { type: 'bufferedamountlow' })
        }
        dc.onclose = function () {
          delete pc.dataChannels[dc.id]
          send(id, { type: 'close' })
        }
        dc.onerror = function () {
          send(id, { type: 'error' })
        }
        if (dc.readyState === 'open') dc.onopen()
        for (var i = 0; i < dc.msgQueue.length; i++) {
          dc.onmessage(dc.msgQueue[i])
        }
        dc.msgQueue = null
      `, cb || ((err: any) => {
                if (err) console.error(err) // this.emit('error', err)
            }))
        }

        onMessage(message: { type: string; event: any; dataType: string }) {
            // @ts-ignore
            const handler = this['on' + message.type]
            const event = message.event || {}

            debug('<<', this.id, message.type, message, !!handler)

            // TODO: create classes for different event types?

            switch (message.type) {
                case 'open':
                    this.readyState = 'open'
                    break

                case 'message':
                    if (message.dataType === 'binary') {
                        const b = new Buffer(event.data, 'base64')
                        event.data = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
                    }
                    break

                case 'close':
                    this.readyState = 'closed'
                    break
            }
            this.emit(message.type, event)
            if (handler) handler(event)
        }

        close() {
            this.readyState = 'closing'
            this._eval('if (dc) dc.close()', (err: any) => {
                if (err) console.error(err) //this.emit('error', err)
            })
        }

        send(data: string | Buffer) {
            let convert = ''
            if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
                data = toBuffer(data)
            }
            if (data instanceof Buffer) {
                data = data.toString('base64')
                convert = 'data = base64ToArrayBuffer(data)'
            }
            this._eval(`
        if (dc.readyState === 'open') {
          var data = ${JSON.stringify(data)}
          ${convert}
          dc.send(data)
        }
        dc.bufferedAmount
      `, (err: any, bufferedAmount: any) => {
                if (err) return console.error(err) // this.emit('error', err)
                this.bufferedAmount = bufferedAmount
            })
        }

        _eval(code: string, cb?: any) {
            if (typeof this._pcId === "undefined") return
            return bridge.eval(JSON.stringify(this._pcId), `
        var pc = conns[${JSON.stringify(this._pcId)}]
        var dc = pc.dataChannels[${JSON.stringify(this.id)}]
      ` + code, cb || ((err: Error) => {
                if (err) console.error(err)//this.emit('error', err)
            }))
        }

        _setProp(name: string, value: any): any {
            if (this.id == null) {
                return this.once('init', () => this._setProp(name, value))
            }
            return this._eval(`dc["${name}"] = ${JSON.stringify(value)}`)
        }

        get bufferedAmountLowThreshold() {
            return this._bufferedAmountLowThreshold
        }

        set bufferedAmountLowThreshold(value) {
            this._bufferedAmountLowThreshold = value
            this._setProp('bufferedAmountLowThreshold', value)
        }

        get binaryType() {
            return this._binaryType
        }

        set binaryType(value) {
            this._binaryType = value
            this._setProp('binaryType', value)
        }
    }
}

function toBuffer(ab: any) {
    const buffer = new Buffer(ab.byteLength)
    const view = new Uint8Array(ab)
    for (let i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i]
    }
    return buffer
}
