import {App, BrowserWindow, ipcMain} from "electron";
import path from "path";
import json from "ndjson"

export default class Relay{
    private app : App = null
    private window: BrowserWindow = null
    private options: any
    private timeout

    constructor(app : App) {
        this.app = app;
        this.init()
    }

    private init(){
        if (typeof process.send !== 'function') {
            var stdin = json.parse()
            process.stdin.pipe(stdin)

            var stdout = json.serialize()
            stdout.pipe(process.stdout)

            //@ts-ignore TODO: add correct types
            process.send = function (data) {
                stdout.write(data)
            }
            stdin.on('data', function (data) {
                //@ts-ignore TODO: add correct types
                process.emit('message', data)
            })
        }

        process.once('message', this.main)
        process.send('starting')
    }

    private main(opts: any){
        this.options = opts;
        this.resetTimeout()

        ipcMain.on("data", (e, data) => {
            process.send(data)
        })

        if(this.app.isReady()) this.createWindow()
        else this.app.once("ready", () => {this.createWindow()})
    }

    private createWindow(){
        //TODO: check webPreferences. Can we deactivate some features?
        this.window = new BrowserWindow({
            title: 'WRTC Relay',
            height: 1,
            width: 1,
            backgroundColor: '#171b21',
            show: false,
            autoHideMenuBar: false,
            transparent: true,
            frame: false,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                nodeIntegrationInWorker: true,
                nodeIntegrationInSubFrames: true,
                devTools: process.env.NODE_ENV !== 'production',
            },
            icon: path.join(this.app.getAppPath(), 'public/icons/icon.png'),
        });

        //TODO: check path
        this.window.loadURL(path.join("./src", "renderer", 'index.html'));

        this.window.webContents.on("did-finish-load", () => {
            process.on("message", this.onMessage);
            process.send("ready");
        })
        this.window.once("close", () => {
            //@ts-ignore TODO: check error
            process.removeListener("message", this.onMessage)
            this.window = null
        })
    }

    private onMessage(message: { opts: { mainProcess: any; }; code: string; id: any; }){
        this.resetTimeout()
        if (typeof message !== 'object') return
        if (message.opts.mainProcess) {
            let res
            let err
            try {
                //TODO: check if that can be somehow improved
                res = eval(message.code) // eslint-disable-line
            } catch (e) {
                err = e.stack
            }
            process.send([ message.id, { res: res, err: err } ])
        } else {
            if (this.window) this.window.webContents.send('data', message)
        }
    }

    private resetTimeout(){
        if(this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            //TODO: check if this is correct in our usecase, just remove the window?
            process.exit(2)
        }, this.options.timeout)
    }
}