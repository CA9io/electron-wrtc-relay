<h1 align="center"><b>Electron Webrtc Relay</b></h1>

<p align="center">
<a href="https://ca9.io" target="_blank">
    <img width="150" height="150" src="https://cdn.ca9.io/branding/logo/windows11/Square150x150Logo.scale-200.png">
</a>
</p>

<p align="center">
	<a href="https://www.npmjs.com/package/@ca9io/electron-webrtc-relay"><img src="https://img.shields.io/npm/v/@ca9io/electron-webrtc-relay.svg?logo=Npm"></a>
	<a href="https://discord.ca9.io"><img src="https://img.shields.io/discord/673169081704120334?label=discord&style=flat&color=5a66f6&logo=Discord"></a>
	<a href="https://twitter.com/ca9_io"><img src="https://img.shields.io/badge/twitter-follow_us-1d9bf0.svg?style=flat&logo=Twitter"></a>
	<a href="https://www.linkedin.com/company/ca9/"><img src="https://img.shields.io/badge/linkedin-connect-0a66c2.svg?style=flat&logo=Linkedin"></a>
    <a href="https://merch.ca9.io"><img src="https://img.shields.io/badge/merch-support_us-red.svg?style=flat&logo=Spreadshirt"></a>
</p>

Use **WebRTC** in the **Main Process** in your **Electron** project.

WebRTC is a powerful web API that lets browsers make peer-to-peer connections, and has already been
deployed in [many popular browsers](http://caniuse.com/#feat=rtcpeerconnection). It may sometimes be
useful to let Node.js programs use WebRTC, e.g. in [`webtorrent-hybrid`](https://github.com/feross/webtorrent-hybrid). However, the modules for WebRTC in Node ([`node-webrtc`](https://github.com/js-platform/node-webrtc) and [`node-rtc-peer-connection`](https://github.com/nickdesaulniers/node-rtc-peer-connection)) are either hard to install, broken, or incomplete.

<hr/>

**This module started as a fork of [electron-webrtc](https://www.npmjs.com/package/electron-webrtc) but removed the broken, unsafe and old electron dependencies of electron-eval and implemented some pending pull requests.**
<hr/>

## Status

This module is compatible with [`simple-peer`](https://github.com/feross/simple-peer) and passes its tests [compatible but tests need an update ;)].

`electron-webrtc-relay` is intended for use with RTCDataChannels, so the MediaStream API is not supported.

## Usage

`npm install @ca9io/electron-webrtc-relay`

```js
// call exported function to create Electron process
var wrtc = require("@ca9io/electron-webrtc-relay")({
  debug: false, //(optional) defaults to false
  preload: string, //(optional) absolute path to your preload script. Using secure context if active (TODO: add example implementation)
  webrtcPolicy:  "default" | "default_public_interface_only" | "default_public_and_private_interfaces" | "disable_non_proxied_udp" // (optional) default: "default". Read More: https://support.brave.com/hc/en-us/articles/360017989132-How-do-I-change-my-Privacy-Settings-#webrtc
});

// IMPORTANT: WHEN YOUR APP IS LOADED CALL
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

Calling the function exported by this module will create a new hidden Electron Window.

An optional `opts` object may contain specific options.

The object returned by this function has the same API as the [`node-webrtc`](https://github.com/js-platform/node-webrtc) package.

Any errors that occur when communicating with the Electron daemon will be emitted by the `wrtc` object (`wrtc.on('error', ...)`).

#### `wrtc.init()`

Tells the relay to start a Browser window. It is important that you call this once.

#### `wrtc.close()`

Frees some resources.

### Events

#### - `error`

Emitted by `RTCPeerConnection` or `RTCDataChannel` when `daemon.eval()` evaluates code that throws an internal error.
## Related Modules

- [`node-webrtc`](https://github.com/js-platform/node-webrtc)
- [`node-rtc-peer-connection`](https://github.com/nickdesaulniers/node-rtc-peer-connection)
- [`electron-eval`](https://github.com/mappum/electron-eval) (reference for the Bridge implementation)
