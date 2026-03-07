const { contextBridge, ipcRenderer } = require('electron');

// 暴露一个安全的 API 给渲染进程
contextBridge.exposeInMainWorld('broadcastAPI', {
  getState: () => ipcRenderer.invoke('state:get'),
  selectDevice: (deviceAddress) => ipcRenderer.invoke('state:selectDevice', deviceAddress),
  selectChannel: (channelUri) => ipcRenderer.invoke('state:selectChannel', channelUri),
  startCast: () => ipcRenderer.invoke('cast:start'),
  retrySearch: () => ipcRenderer.invoke('search:retry'),
  refreshDevices: () => ipcRenderer.invoke('devices:refresh'),
  refreshChannels: () => ipcRenderer.invoke('channels:refresh'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  addSource: (source) => ipcRenderer.invoke('config:addSource', source),
  removeSource: (sourceId) => ipcRenderer.invoke('config:removeSource', sourceId),
  switchSource: (sourceId) => ipcRenderer.invoke('config:switchSource', sourceId),
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


