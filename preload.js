const { contextBridge, ipcRenderer } = require('electron');

// 暴露一个安全的 API 给渲染进程
contextBridge.exposeInMainWorld('broadcastAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  selectDevice: (deviceAddress) => ipcRenderer.invoke('state:selectDevice', deviceAddress),
  selectChannel: (channelUri) => ipcRenderer.invoke('state:selectChannel', channelUri),
  startCast: () => ipcRenderer.invoke('cast:start'),
  retrySearch: () => ipcRenderer.invoke('search:retry'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  updateM3u8Url: (m3u8Url) => ipcRenderer.invoke('config:updateM3u8Url', m3u8Url),
  onStateUpdate: (callback) => {
    ipcRenderer.on('state:update', (_event, newState) => {
      callback(newState);
    });
  },
  onCastResult: (callback) => {
    ipcRenderer.on('cast:result', (_event, result) => {
      callback(result);
    });
  },
});


