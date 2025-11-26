const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const MediaRendererClient = require('upnp-mediarenderer-client');
// electron-store 从 v10 开始是 ESM 默认导出，这里通过 .default 获取构造函数
const Store = require('electron-store').default;

const UpnpSearcher = require('./component/dlna/SSDPSearcher');
const M3U8Client = require('./component/playlist/M3U8Fetcher');

let mainWindow = null;
const store = new Store({
  defaults: {
    m3u8Url: 'https://live.fanmingming.com/tv/m3u/global.m3u',
  },
});

// 状态数据在主进程里维护
const state = {
  devices: [],
  channels: [],
  selectedDevice: null,
  selectedChannel: null,
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 预览外部 m3u8/HLS 流时，可能会遇到跨域限制，这里关闭 webSecurity 以便预览
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 发送最新状态到渲染进程
function broadcastState() {
  if (!mainWindow) return;
  mainWindow.webContents.send('state:update', {
    devices: state.devices,
    channels: state.channels,
    selectedDevice: state.selectedDevice,
    selectedChannel: state.selectedChannel,
  });
}

// 初始化 DLNA 搜索和频道拉取
function initBackend() {
  // 搜索 DLNA 设备
  const upnpSearcher = new UpnpSearcher((deviceInfo) => {
    if (state.devices.find((d) => d.address === deviceInfo.address)) {
      return;
    }
    state.devices.push(deviceInfo);
    // 如果还没有选中设备，自动选中第一个发现的设备，避免用户忘记选择导致无法投屏
    if (!state.selectedDevice) {
      state.selectedDevice = deviceInfo;
    }
    broadcastState();
  });
  upnpSearcher.doSearch();

  // 拉取频道列表（使用可配置的 m3u8 URL）
  const m3uUrl = store.get('m3u8Url');
  const m3u8Client = new M3U8Client(m3uUrl);
  m3u8Client.fetch((channels) => {
    state.channels = channels || [];
    broadcastState();
  });
}

// 处理投屏
function startCast() {
  const { selectedDevice, selectedChannel } = state;
  if (!selectedDevice || !selectedChannel) {
    if (mainWindow) {
      mainWindow.webContents.send('cast:result', {
        ok: false,
        message: '请先选择投屏设备和频道，再点击开始投屏',
      });
    }
    return;
  }

  // 调试日志：确认已经拿到的投屏信息
  console.log('[DLNA] startCast', {
    device: selectedDevice && selectedDevice.name,
    address: selectedDevice && selectedDevice.address,
    channel: selectedChannel && selectedChannel.title,
    uri: selectedChannel && selectedChannel.uri,
  });

  const client = new MediaRendererClient(selectedDevice.address);
  client.load(selectedChannel.uri, {}, (err) => {
    if (err) {
      if (mainWindow) {
        mainWindow.webContents.send('cast:result', {
          ok: false,
          message: `投屏失败: ${err.message || err}`,
        });
      }
      return;
    }
    client.play();
    if (mainWindow) {
      mainWindow.webContents.send('cast:result', {
        ok: true,
        message: `正在投屏到 ${selectedDevice.name}: ${selectedChannel.title}`,
      });
    }
  });
}

// IPC 通信
function setupIpc() {
  // 渲染进程请求当前状态
  ipcMain.handle('state:get', () => {
    return {
      devices: state.devices,
      channels: state.channels,
      selectedDevice: state.selectedDevice,
      selectedChannel: state.selectedChannel,
    };
  });

  ipcMain.handle('state:selectDevice', (_event, deviceAddress) => {
    state.selectedDevice = state.devices.find((d) => d.address === deviceAddress) || null;
    broadcastState();
  });

  ipcMain.handle('state:selectChannel', (_event, channelUri) => {
    state.selectedChannel = state.channels.find((c) => c.uri === channelUri) || null;
    broadcastState();
  });

  ipcMain.handle('cast:start', () => {
    startCast();
  });

  ipcMain.handle('search:retry', () => {
    // 简单做法：重新初始化一次搜索和频道拉取
    state.devices = [];
    state.channels = [];
    state.selectedDevice = null;
    state.selectedChannel = null;
    broadcastState();
    initBackend();
  });

  // 配置相关：获取当前配置
  ipcMain.handle('config:get', () => {
    return {
      m3u8Url: store.get('m3u8Url'),
    };
  });

  // 更新 m3u8 URL 配置并重新加载频道列表
  ipcMain.handle('config:updateM3u8Url', (_event, newUrl) => {
    if (typeof newUrl === 'string' && newUrl.trim().length > 0) {
      store.set('m3u8Url', newUrl.trim());
      // 只刷新频道列表，不清空设备
      state.channels = [];
      state.selectedChannel = null;
      broadcastState();
      const m3u8Client = new M3U8Client(newUrl.trim());
      m3u8Client.fetch((channels) => {
        state.channels = channels || [];
        broadcastState();
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  initBackend();
  setupIpc();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 直接退出应用，避免关闭窗口后进程仍然常驻
  app.quit();
});


