'use strict'
const { BrowserWindow } = require("electron")
const { ipcMain } = require('electron');
const debugFactory = require('debug');
const EventEmitter = require('events');
const debug = debugFactory('electron-webrtc-relay:Bridge')

const loadView = (preload, debug) => {
  return (`
   <!DOCTYPE html>
    <html>
      <head></head>
      <body>
      <p>WRTC Relay</p>
        <script>

          const ipcRenderer = ${preload ? "window.ipcRenderer" : "require('electron').ipcRenderer"}           
          require = null;
          window.require = null;
          
          ${debug ? 'console.log("initializing browser " + typeof ipcRenderer)' : ""}

          send = window.send = function (event, message) {
            ipcRenderer.send('WRTCRelayData', [ event, message ])
          }
        
          ipcRenderer.on('WRTCRelayData', function (e, message) {
            ${debug ? 'console.groupCollapsed(message.id)' : ""}
            ${debug ? 'console.dir(message)' : ""}
            
            var err
            try {
              var res = eval(message.code)
              ${debug ? 'console.info(typeof res)' : ""}
              ${debug ? 'console.log(res)' : ""}
            } catch (e) {
              err = e.message
              ${debug ? 'console.error(e)' : ""}
            }
            ${debug ? 'console.groupEnd()' : ""}
            window.send(message.id, { res: res, err: err })
          })
        </script>
      </body>
    </html>
  `)
}

module.exports = class Bridge extends EventEmitter {
  BrowserWindow = null;
  i = 0
  queue = []
  ready = false
  closing = false

  opts = {}
  constructor (opts) {
    super()
    if(typeof opts === "undefined") opts = {debug: false}
    this.opts = opts;
    if(opts.debug) debug.enabled = true;
  }

  _debug(msg){
    if(!this.opts.debug) return;
    debug(msg)
  }

  init(){
    this._debug(`Initializing Relay: ${JSON.stringify(this.opts)}`)

    this.BrowserWindow = new BrowserWindow({
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

    if(this.opts.debug) this.BrowserWindow.webContents.openDevTools();
    var file = 'data:text/html;charset=UTF-8,' + encodeURIComponent(loadView(typeof this.opts.preload === "string", this.opts.debug));
    this.BrowserWindow.loadURL(
      file
    );

    this.BrowserWindow.once('ready-to-show', () => {
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
      this.BrowserWindow.webContents.send("WRTCRelayData", obj)
    })
  }

  eval(code, opts = {}, cb){
    const inactive = this.BrowserWindow === null || !this.ready

    if (typeof opts === 'function') {
      cb = opts
      opts = {}
    }
    this._debug(`opts: ${JSON.stringify(opts)} eval: ${JSON.stringify(code)}, BrowserWindow active: ${!inactive}`)

    const id = (this.i++).toString(36)

    this.once(id, (res) => {
      let err = null
      if (res.err) {
        const target = opts.mainProcess ? 'main process' : 'window'
        err = new Error(
          `Error evaluating "${code}" ` + `in "${target}": ${res.err}`
        )
        err.original = res.err
      }
      if (cb) {
        if (err) return cb(err)
        return cb(null, res.res)
      }
      if (err) this.emit('error', err)
    })

    if(inactive){
      this.queue.push({id, code})
      return;
    }

    this.BrowserWindow.webContents.send("WRTCRelayData", { id, code })
  }

  close(){

  }
}