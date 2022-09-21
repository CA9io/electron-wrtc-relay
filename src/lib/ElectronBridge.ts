'use strict'
import {OPTS} from "../index";
import ResourceManager from "./ResourceManager";

const { ipcMain } = require('electron');
const debugFactory = require('debug');

// @ts-ignore
const EventEmitter = require('events');
// @ts-ignore
const debug = debugFactory('electron-webrtc-relay:Bridge')

module.exports = class Bridge extends EventEmitter {
  i = 0
  queue : {id: string, code: string, reference: string}[] = []
  ready = false
  closing = false
  opts : OPTS = {debug: false}
  private resourceManager : ResourceManager | undefined = undefined;

  constructor (opts : OPTS) {
    super()
    if(typeof opts === "undefined") opts = {debug: false}
    this.opts = opts;
    if(opts.debug) debug.enabled = true;
  }

  private _debug(msg : string){
    if(!this.opts.debug) return;
    debug(msg)
  }

  init(){
    this._debug(`Initializing Relay: ${JSON.stringify(this.opts)}`)
    this.resourceManager = new ResourceManager(this.opts, () => {
      debug("Bridge ready")
      this.ready = true;
      this._queue()
    });

    ipcMain.on("WRTCRelayData", (event, message) => {
      if (typeof message !== 'object') return
      debug(`Received: ${JSON.stringify(message)}`)
      this.emit(message[0], message[1])
    })
  }

  _queue(){
    this.queue.forEach((obj) => {
      if(this.resourceManager) this.resourceManager.eval(obj.reference, obj.id, obj.code)
    })
    this.queue = []
  }

  eval(reference: string, code : string, opts : any = {}, cb: (err: null | Error, res?: any) => void){
    const inactive = !this.ready

    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    this._debug(`opts: ${JSON.stringify(opts)} eval: ${JSON.stringify(code)}, BrowserWindow active: ${!inactive}`)

    const id = (this.i++).toString(36)

    this.once(id, (res : any) => {
      let err : any = null
      if (res.err) {
        err = new Error(
          `Error evaluating "${code}" ` + `${res.err}`
        )
        err.original = res.err
      }
      if (cb) {
        if (err) return cb(err)
        return cb(null, res.res)
      }
      if (err) console.error(err)//this.emit('error', err)
    })

    if(inactive){
      this.queue.push({id, code, reference})
      return;
    }

    if(this.resourceManager) this.resourceManager.eval(reference, id, code)
  }

  close(){

  }
}