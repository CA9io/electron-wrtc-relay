# electron-webrtc-relay

[![npm version](https://img.shields.io/npm/v/@ca9io/electron-webrtc.svg)](https://www.npmjs.com/package/@ca9io/electron-eval)

Use WebRTC in the main process in your electron project.

WebRTC is a powerful web API that lets browsers make peer-to-peer connections, and has already been
deployed in [many popular browsers](http://caniuse.com/#feat=rtcpeerconnection). It may sometimes be
useful to let Node.js programs use WebRTC, e.g. in [`webtorrent-hybrid`](https://github.com/feross/webtorrent-hybrid). However, the modules for WebRTC in Node ([`node-webrtc`](https://github.com/js-platform/node-webrtc) and [`node-rtc-peer-connection`](https://github.com/nickdesaulniers/node-rtc-peer-connection)) are either hard to install, broken, or incomplete.

This module started as a fork of [electron-webrtc](https://www.npmjs.com/package/electron-webrtc) but removed the broken, unsafe and old electron dependencies of electron-eval and implemented some pending pull requests.
## Status

This module is compatible with [`simple-peer`](https://github.com/feross/simple-peer) and passes its tests.

`electron-webrtc-relay` is intended for use with RTCDataChannels, so the MediaStream API is not supported.

## Usage

`npm install @ca9io/electron-webrtc-relay`

```js
// call exported function to create Electron process
var wrtc = require("@ca9io/electron-webrtc-relay")({
  debug: false, //(optional) defaults to false
  preload: string //(optional) absolute path to your preload script. Using secure context if active (TODO: add example implementation)
});

// WHEN YOUR APP IS LOADED CALL
wrtc.init()

// handle errors that may occur when trying to communicate with Electron
wrtc.on("error", function (err) {
  console.log(err);
});

// uses the same API as the `wrtc` package
var pc = new wrtc.RTCPeerConnection(config);

// compatible with `simple-peer`
var peer = new SimplePeer({
  initiator: true,
  wrtc: wrtc,
});

// listen for errors
wrtc.on("error", function (err, source) {
  console.error(err);
});
```

### Methods

#### `var wrtc = require('@ca9io/electron-webrtc-relay')([opts])`

Calling the function exported by this module will create a new hidden Electron process. It is recommended to only create one, since Electron uses a lot of resources.

An optional `opts` object may contain specific options.

The object returned by this function has the same API as the [`node-webrtc`](https://github.com/js-platform/node-webrtc) package.

Any errors that occur when communicating with the Electron daemon will be emitted by the `wrtc` object (`wrtc.on('error', ...)`).

#### `wrtc.close()`

Closes the Electron process and releases its resources. You may not need to do this since the Electron process will close automatically after the Node process terminates.

### Events

#### - `error`

Emitted by `RTCPeerConnection` or `RTCDataChannel` when `daemon.eval()` evaluates code that throws an internal error.
## Related Modules

- [`node-webrtc`](https://github.com/js-platform/node-webrtc)
- [`node-rtc-peer-connection`](https://github.com/nickdesaulniers/node-rtc-peer-connection)
- [`electron-eval`](https://github.com/mappum/electron-eval) (reference for the Bridge implementation)
