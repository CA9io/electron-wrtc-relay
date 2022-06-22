import {App, BrowserWindow, ipcMain} from "electron";
import EventEmitter from "events";
import Relay from "./relay";
import json from "ndjson"

export default class Daemon extends EventEmitter{
    private relay: Relay = null
    private timeout : number = 10000
    private queue : any[] = []
    private ready : boolean = false;
    private closing : boolean = false;
    private i : number = 0;
    private child = null
    private keepaliveInterval
    private opts : any = {}
    constructor(opts: {app: App, timeout?: number, nodeIPC?: boolean}) {
        super()
        if(typeof opts?.app === "undefined") return;
        this.relay = new Relay(opts.app)
        if(typeof opts.timeout === "number") this.timeout = opts.timeout;
        if (opts.nodeIPC == null && process.platform !== 'linux') {
            opts.nodeIPC = true
        }
        this.opts = opts
        this._startElectron(opts)
    }

    eval(code, opts:any = {}, cb){
        if (typeof opts === 'function') {
            cb = opts
            opts = {}
        }
        var id = (this.i++).toString(36)
        this.once(id, (res) => {
            let err = null;
            if (res.err) {
                let target = opts.mainProcess ? 'main process' : 'window'
                err = new Error(`Error evaluating "${code}" ` +
                    `in "${target}": ${res.err}`)
                err.original = res.err
            }
            if (cb) {
                if (err) return cb(err)
                return cb(null, res.res)
            }
            if (err) this.emit('error', err)
        })
        if (!this.ready) return this.queue.push([ code, opts, cb ])
        this.child.send({ id, opts, code })
    }
    keepalive(){
        this.child.send(0)
    }
    error(err){
        this.emit('error', err)
        this.close()
    }
    close(signal?){
        if (this.closing) return
        this.closing = true
        if (this.child) {
            this.child.kill(signal)
        }
        this.eval = (code, opts = {}, cb) => {
            if (typeof opts === 'function') {
                cb = opts
                opts = {}
            }
            var error = new Error('Daemon already closed')
            if (cb) {
                return cb(error)
            }
            this.emit('error', error)
        }
        clearInterval(this.keepaliveInterval)
    }
    _startElectron(cb){
        var env = {}
        var exitStderr = ''
        var electronOpts : any = { env }
        if (this.opts.nodeIPC) electronOpts.stdio = [ 'ipc' ]
        this.child = spawn(opts.electron || electron, [ opts.daemonMain ], electronOpts)
        this.child.on('close', (code) => {
            if (this.closing) return
            var err = `electron-eval error: Electron process exited with code ${code}`
            if (exitStderr) err += `.\nStderr:\n${exitStderr}`
            this.error(new Error(err))
        })
        this.child.on('error', (err) => this.error(err))
        this.child.stderr.on('data', (data) => {
            exitStderr += `${data.toString()}${exitStderr ? '\n' : ''}`
        })

        process.on('exit', () => this.child.kill())

        if (!opts.nodeIPC) this._startIPC()

        this.child.once('message', (data) => {
            this.keepaliveInterval = setInterval(this.keepalive.bind(this), opts.timeout / 2)
            this.keepaliveInterval.unref()
            this.child.send(opts)
            this.child.once('message', (data) => {
                this.child.on('message', (message) => this.emit(message[0], message[1]))
                this.ready = true
                this.queue.forEach((item) => this.eval(...item))
                this.queue = null
                this.emit('ready')
                this.keepalive()
            })
        })
    }
    _startIPC(){
        var stdin = json.serialize()
        stdin.on('error', (err) => this.error(err))
        stdin.pipe(this.child.stdin)

        var stdout = json.parse()
        stdout.on('error', (err) => this.error(err))
        this.child.stdout.pipe(stdout)

        this.child.send = (data) => stdin.write(data)
        stdout.on('data', (data) => this.child.emit('message', data))
    }
}

