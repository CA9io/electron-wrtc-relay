export const getRelayWindow = (preload: boolean, debug: boolean) => {
    return (`
   <!DOCTYPE html>
    <html>
      <head></head>
      <body>
      <p>WRTC Relay</p>
        <script>
          // region GLOBALS and INIT
          // maximum amount of open WebRTC handlers, after that queue
          const MAXMESSAGES = 475;
          
          // Counter for GC
          let i = 1;

          const queue = []
          const ipcRenderer = ${preload ? "window.ipcRenderer" : "require('electron').ipcRenderer"}           
          require = null;
          window.require = null;
          // endregion
          
          // region UTILS
          send = window.send = function (event, message) {
            ipcRenderer.send('WRTCRelayData', [ event, message ])
          }
          
          function handlersAtLimit(){
            return typeof conns === "object" && Object.keys(conns).length >= MAXMESSAGES
          }
          
          function workMessage(message){
             let err
             let res 
              try {
                res = eval(message.code)
              } catch (e) {
                err = e.message
                ${debug ? 'console.error(e)' : ""}
              }
              window.send(message.id, { res: res, err: err })
          }
          
          function invokeGC(){
            console.log(i++);
           
            if (!(i % 5)) {
              // try to invoke GC on each 5ish iteration
              // https://bugs.chromium.org/p/chromium/issues/detail?id=825576 Garbage Collection not deleting closed WebRTC messages
              queueMicrotask(() => { 
                if(typeof conns === "object"){
                  ${debug ? 'console.log("gcing all conns: " + Object.keys(conns).length)' : ""}
                  Object.keys(conns).forEach((id) => {
                    let tmpPC = conns[id]
                    if(tmpPC?.signalingState === "closed"){
                      tmpPC = null;
                      conns[id] = null;
                      delete conns[id];
                    }
                  })
                }
                let img = document.createElement("img");
                img.src = window.URL.createObjectURL(new Blob([new ArrayBuffer(5e+7)])); // 50Mo or less or more depending as you wish to force/invoke GC cycle run
                img.onerror = function() {
                  window.URL.revokeObjectURL(this.src);
                  img = null
                }
              })
            }
          }
          // endregion
          
          ${debug ? 'console.log("initializing browser " + typeof ipcRenderer)' : ""}

          // region MAIN LOGIC
          function workQueue(){
            if(queue.length === 0) return;
            if(handlersAtLimit()) return;
            
            // Fixed Queue Overflow
            let message = queue.shift()
            workMessage(message)
          }
          setInterval(workQueue, 50);
        
          ipcRenderer.on('WRTCRelayData', function (e, message) {  
            if(handlersAtLimit()) {
              queue.push(message)
              return;
            }
            workMessage(message)
          })
          // endregion
        </script>
      </body>
    </html>
  `)
}
