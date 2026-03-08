const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const http = require('http');
const MediaRendererClient = require('upnp-mediarenderer-client');

const UpnpSearcher = require('./component/dlna/SSDPSearcher');
const M3U8Client = require('./component/playlist/M3U8Fetcher');

let mainWindow = null;

// 配置文件路径 ~/.tvbBoardcast/settings.json
const configDir = path.join(os.homedir(), '.tvbBoardcast');
const configFile = path.join(configDir, 'settings.json');

// 默认配置（无默认源）
const defaultConfig = {
  sources: [],
  currentSourceId: null,
};

// 读取配置
function loadConfig() {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf-8');
      const config = JSON.parse(data);
      // 合并默认配置
      return { ...defaultConfig, ...config };
    }
    // 首次运行，创建默认配置
    saveConfig(defaultConfig);
    return defaultConfig;
  } catch (e) {
    console.error('读取配置失败:', e);
    return defaultConfig;
  }
}

// 保存配置
function saveConfig(config) {
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('保存配置失败:', e);
    return false;
  }
}

// 全局配置对象
let appConfig = loadConfig();

// 获取当前启用的 m3u8 URL
function getCurrentM3u8Url() {
  const currentSource = appConfig.sources.find(
    (s) => s.id === appConfig.currentSourceId && s.enabled
  );
  return currentSource ? currentSource.url : appConfig.sources[0]?.url;
}

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
    minWidth: 800,
    minHeight: 500,
    resizable: true,
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

  // 拉取频道列表（使用当前选中的 m3u8 URL）
  const m3uUrl = getCurrentM3u8Url();
  if (m3uUrl) {
    const m3u8Client = new M3U8Client(m3uUrl);
    m3u8Client.fetch((channels) => {
      state.channels = channels || [];
      broadcastState();
    });
  }
}

// 解析 URL 重定向链，获取最终 URL
function resolveRedirectUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const followRedirect = (currentUrl, redirectsLeft) => {
      if (redirectsLeft <= 0) {
        resolve(currentUrl);
        return;
      }

      const isHttps = currentUrl.startsWith('https');
      const client = isHttps ? https : http;

      const options = new URL(currentUrl);
      options.method = 'HEAD';
      options.timeout = 10000;

      const req = client.request(options, (res) => {
        // Handle redirect (3xx status OR any status with location header)
        if (res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          console.log(`[Redirect] ${currentUrl} (${res.statusCode}) -> ${redirectUrl}`);
          followRedirect(redirectUrl, redirectsLeft - 1);
        } else {
          resolve(currentUrl);
        }
      });

      req.on('error', (err) => {
        console.error('[Redirect] Error:', err.message);
        resolve(currentUrl); // Return original URL on error
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(currentUrl);
      });

      req.end();
    };

    followRedirect(url, maxRedirects);
  });
}

// Handle casting
async function startCast() {
  const { selectedDevice, selectedChannel } = state;
  if (!selectedDevice || !selectedChannel) {
    const message = 'Please select device and channel first';
    if (mainWindow) {
      mainWindow.webContents.send('cast:result', {
        ok: false,
        message,
      });
    }
    return { ok: false, message };
  }

  // Resolve redirect to get final URL
  const originalUrl = selectedChannel.uri;
  let finalUrl = originalUrl;

  try {
    finalUrl = await resolveRedirectUrl(originalUrl);
    console.log('[DLNA] Resolved URL:', originalUrl, '->', finalUrl);
  } catch (err) {
    console.error('[DLNA] Failed to resolve redirect:', err);
    // Continue with original URL
  }

  // Debug log
  console.log('[DLNA] startCast', {
    device: selectedDevice && selectedDevice.name,
    address: selectedDevice && selectedDevice.address,
    channel: selectedChannel && selectedChannel.title,
    originalUri: originalUrl,
    finalUri: finalUrl,
  });

  return new Promise((resolve) => {
    const client = new MediaRendererClient(selectedDevice.address);
    client.load(finalUrl, {}, (err) => {
      if (err) {
        const message = `Cast failed: ${err.message || err}`;
        console.error('[DLNA] Cast error:', err);
        if (mainWindow) {
          mainWindow.webContents.send('cast:result', {
            ok: false,
            message,
          });
        }
        resolve({ ok: false, message });
        return;
      }
      client.play();
      const message = `Casting to ${selectedDevice.name}: ${selectedChannel.title}`;
      if (mainWindow) {
        mainWindow.webContents.send('cast:result', {
          ok: true,
          message,
        });
      }
      resolve({ ok: true, message });
    });
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

  ipcMain.handle('cast:start', async () => {
    await startCast();
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

  // 单独刷新 DLNA 设备
  ipcMain.handle('devices:refresh', () => {
    state.devices = [];
    state.selectedDevice = null;
    broadcastState();
    // 重新搜索设备
    const upnpSearcher = new UpnpSearcher((deviceInfo) => {
      if (state.devices.find((d) => d.address === deviceInfo.address)) {
        return;
      }
      state.devices.push(deviceInfo);
      if (!state.selectedDevice) {
        state.selectedDevice = deviceInfo;
      }
      broadcastState();
    });
    upnpSearcher.doSearch();
  });

  // 单独刷新频道列表
  ipcMain.handle('channels:refresh', () => {
    state.channels = [];
    state.selectedChannel = null;
    broadcastState();
    // 重新拉取频道
    const m3uUrl = getCurrentM3u8Url();
    if (m3uUrl) {
      const m3u8Client = new M3U8Client(m3uUrl);
      m3u8Client.fetch((channels) => {
        state.channels = channels || [];
        broadcastState();
      });
    }
  });

  // 配置相关：获取当前配置
  ipcMain.handle('config:get', () => {
    return {
      sources: appConfig.sources,
      currentSourceId: appConfig.currentSourceId,
    };
  });

  // 添加 m3u8 源
  ipcMain.handle('config:addSource', (_event, source) => {
    if (source && source.name && source.url) {
      const newSource = {
        id: Date.now().toString(),
        name: source.name,
        url: source.url,
        enabled: true,
      };
      appConfig.sources.push(newSource);
      saveConfig(appConfig);
      return { success: true, source: newSource };
    }
    return { success: false, error: '参数无效' };
  });

  // 删除 m3u8 源
  ipcMain.handle('config:removeSource', (_event, sourceId) => {
    if (appConfig.sources.length <= 1) {
      return { success: false, error: '至少保留一个源' };
    }
    appConfig.sources = appConfig.sources.filter((s) => s.id !== sourceId);
    // 如果删除的是当前选中的，切换到第一个
    if (appConfig.currentSourceId === sourceId) {
      appConfig.currentSourceId = appConfig.sources[0]?.id;
    }
    saveConfig(appConfig);
    return { success: true };
  });

  // 切换当前源
  ipcMain.handle('config:switchSource', (_event, sourceId) => {
    const source = appConfig.sources.find((s) => s.id === sourceId);
    if (source) {
      appConfig.currentSourceId = sourceId;
      saveConfig(appConfig);
      // 刷新频道列表
      state.channels = [];
      state.selectedChannel = null;
      broadcastState();
      const m3u8Client = new M3U8Client(source.url);
      m3u8Client.fetch((channels) => {
        state.channels = channels || [];
        broadcastState();
      });
      return { success: true };
    }
    return { success: false, error: '源不存在' };
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


