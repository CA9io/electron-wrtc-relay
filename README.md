## Electron WRTC Relay

merge and refactor of the projects:

- https://github.com/mappum/electron-eval
- https://github.com/mappum/electron-webrtc

The goal is to create a versatile relay for WebRTC in electron projects that need WebRTC in their main process.

Options right now are the wrtc package which has problems on certain platforms like MacOS and is quite big in size and
factoring your code in a way where you have tons of ipc calls between your renderer and main process (manual work). 

WRTC Relay should be a drop in alternative with low footprint.

... TBD
    