'use strict'
import { BrowserWindow } from "electron"
import {OPTS} from "../index";
import {getRelayWindow} from "./RelayWindow";

const { ipcMain } = require('electron');
const debugFactory = require('debug');

// @ts-ignore
const EventEmitter = require('events');
// @ts-ignore
const debug = debugFactory('electron-webrtc-relay:Bridge')

interface RelayError extends Error {
  original: string;
}


module.exports = class Bridge extends EventEmitter {
  RelayWindow : BrowserWindow | undefined;
  i = 0
  queue : {id: string, code: string}[] = []
  ready = false
  closing = false
  opts : OPTS = {debug: false}

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

    this.RelayWindow = new BrowserWindow({
      title: 'WRTC Relay',
      width: this.opts.debug ? 900 : 0,
      height: this.opts.debug ? 750 : 0,
      transparent: !this.opts.debug,
      frame: this.opts.debug,
      alwaysOnTop: false,
      skipTaskbar: true,
      center: true,
      show: true,
      webPreferences: {
        nodeIntegration: typeof this.opts.preload === "string" ? false : true,
        contextIsolation: typeof this.opts.preload === "string" ? true : false,
        webSecurity: true,
        preload: typeof this.opts.preload === "string" ? this.opts.preload : "",
        devTools: this.opts.debug ? true : false,
      },
    });

    if(this.opts.debug) this.RelayWindow.webContents.openDevTools();
    this.RelayWindow.webContents.setWebRTCIPHandlingPolicy(typeof this.opts.webrtcPolicy === "string"? this.opts.webrtcPolicy : "default")
    const file = 'data:text/html;charset=UTF-8,' + encodeURIComponent(getRelayWindow(typeof this.opts.preload === "string", typeof this.opts.debug !== "undefined" && this.opts.debug));
    this.RelayWindow.loadURL(
      file
    );

    this.RelayWindow.once('ready-to-show', () => {
      this.ready = true;
      ipcMain.on("WRTCRelayData", (event, message) => {
        if (typeof message !== 'object') return
        debug(`Received: ${JSON.stringify(message)}`)
        this.emit(message[0], message[1])
      })
      this._queue()
    });
  }

  _queue(){
    this.queue.forEach((obj) => {
      this.RelayWindow?.webContents.send("WRTCRelayData", obj)
    })
  }

  eval(code : string, opts : any = {}, cb: (err: null | Error, res?: any) => void){
    const inactive = this.RelayWindow === null || !this.ready

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
      this.queue.push({id, code})
      return;
    }

    this.RelayWindow?.webContents.send("WRTCRelayData", { id, code })
  }

  close(){

  }
}