const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('companion', {
  getStats: () => ipcRenderer.invoke('stats:get'),
  chat: (msg) => ipcRenderer.invoke('chat:send', msg),
  speak: (text) => ipcRenderer.invoke('tts:speak', text),
  getConfig: () => ipcRenderer.invoke('config:get'),
  close: () => ipcRenderer.send('win:close'),
  minimize: () => ipcRenderer.send('win:min'),
});
