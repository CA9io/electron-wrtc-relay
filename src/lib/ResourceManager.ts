"use strict"
import {OPTS} from "../index";
import {ipcMain, BrowserWindow} from "electron"
import {getRelayWindow} from "./RelayWindow";

const debugFactory = require('debug');
const debug = debugFactory('electron-webrtc-relay:ResourceManager')

export default class ResourceManager {
    private opts: OPTS
    private maxWindows = 1;
    private windowIDtoStatsMap: Map<string, { window: BrowserWindow, handler: number }> = new Map()
    private referenceToWindowMap: Map<string, string> = new Map()
    private rollingCounter = {i: 0, length: 0};
    private internalWindowCounter = 0;
    private internalWindowQueueBuffer = 0;

    constructor(opts: OPTS, onReady: () => void) {
        this.opts = opts;
        if (typeof this.opts.maxWindows === "undefined") this.opts.maxWindows = 1;
        this.maxWindows = this.opts.maxWindows;
        if (this.opts.debug) debug.enabled = true;

        this.registerListener();
        this.openWindow(onReady)
    }

    private openWindow(onReady?: () => void): boolean {
        debug("trying to create window")
        this.internalWindowQueueBuffer += 15;
        if (this.internalWindowCounter >= this.maxWindows) return false;
        const newWindowID = this.internalWindowCounter.toString()
        this.internalWindowCounter++;
        debug(`creating window: ${newWindowID}`)
        const newWindow = new BrowserWindow({
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

        if (this.opts.debug) newWindow.webContents.openDevTools();
        newWindow.webContents.setWebRTCIPHandlingPolicy(typeof this.opts.webrtcPolicy === "string" ? this.opts.webrtcPolicy : "default")
        const file = 'data:text/html;charset=UTF-8,' + encodeURIComponent(getRelayWindow(typeof this.opts.preload === "string", typeof this.opts.debug !== "undefined" && this.opts.debug));
        newWindow.loadURL(
            file
        );

        newWindow.on("ready-to-show", () => {
            newWindow.webContents.send("WRTCRelayData", {
                id: "relayInit",
                code: `window.windowID = ${newWindowID}
                       window.conns = {}`
            })
            this.windowIDtoStatsMap.set(newWindowID, {handler: 0, window: newWindow})
            this.rollingCounter.length++;
            this.internalWindowQueueBuffer -= 15;
            if(typeof onReady === "function") onReady();
        })

        return true;
    }

    private registerListener() {
        ipcMain.on("WRTCRelayStats", (event, args) => {
            try {
                if (!this.windowIDtoStatsMap.has(args.id.toString())) {
                    debug(`Resource Manager can not find stats of window: ${args.id}`)
                    return;
                }

                const stat = this.windowIDtoStatsMap.get(args.id.toString());

                if (typeof stat === "undefined") return;
                stat.handler = args.handler
                debug(`webrtc window: ${args.id} has ${args.handler} open handler`)
            } catch (e) {
                debug(e)
            }
        })

        ipcMain.on("WRTCRelayClose", (event, args) => {
            try {
                this.referenceToWindowMap.delete(args.id.toString())
            } catch (e) {
                debug(e)
            }
        })
    }

    private getStringID() {
        return this.rollingCounter.i.toString()
    }

    eval(reference: string, id: string, code: string) {
        // first check if reference is already assigned to a window
        if (this.referenceToWindowMap.has(reference) && this.windowIDtoStatsMap.has((this.referenceToWindowMap.get(reference) as string))) {
            debug(`window with id: ${this.referenceToWindowMap.get(reference)} handling reference: ${reference}`)
            // window already dealing with a reference, send it to this window
            this.windowIDtoStatsMap.get((this.referenceToWindowMap.get(reference) as string))?.window.webContents.send("WRTCRelayData", {
                id,
                code
            })
            return;
        }

        this.rollingCounter.i++;
        if (this.rollingCounter.i >= this.rollingCounter.length) this.rollingCounter.i = 0;

        if (!this.windowIDtoStatsMap.has(this.getStringID())) {
            debug(`window with id: ${this.rollingCounter.i} does not exist`)
            return;
        }

        // if less than 300 handlers just rotate around all windows and assign in order
        if ((this?.windowIDtoStatsMap?.get(this.getStringID())?.handler as number) < 300 + this.internalWindowQueueBuffer) {
            debug(`window with id: ${this.getStringID()} handling new reference: ${reference}`)
            this?.windowIDtoStatsMap?.get(this.getStringID())?.window.webContents.send("WRTCRelayData", {id, code})
            this.referenceToWindowMap.set(reference, this.getStringID());
            return;
        }

        let lowestQueue: undefined | { window: BrowserWindow, handler: number, id: string };
        this.windowIDtoStatsMap.forEach((value, key) => {
            if (typeof lowestQueue === "undefined" || value.handler < lowestQueue.handler) lowestQueue = {
                handler: value.handler,
                window: value.window,
                id: key
            }
        })

        if (typeof lowestQueue === "undefined") {
            debug("failed to find lowestQueue")
            return;
        }
        if (lowestQueue.handler > 250 + this.internalWindowQueueBuffer) this.openWindow()

        lowestQueue.window.webContents.send("WRTCRelayData", {id, code})
        this.referenceToWindowMap.set(reference, lowestQueue.id);

        debug(`window with id, selected by enumeration: ${lowestQueue.id} handling new reference: ${reference}`)
    }
}