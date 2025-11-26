// 简单的渲染进程脚本，操作 DOM 显示设备和频道列表

const deviceSelect = document.getElementById('deviceSelect');
const channelGallery = document.getElementById('channelGallery');
const castButton = document.getElementById('castButton');
const retryButton = document.getElementById('retryButton');
const statusText = document.getElementById('statusText');
const previewVideo = document.getElementById('previewVideo');
const previewButton = document.getElementById('previewButton');
const speedButton = document.getElementById('speedButton');
const speedText = document.getElementById('speedText');
const m3u8Input = document.getElementById('m3u8Input');
const m3u8SaveButton = document.getElementById('m3u8SaveButton');

let currentState = {
  devices: [],
  channels: [],
  selectedDevice: null,
  selectedChannel: null,
};
let currentConfig = {
  m3u8Url: '',
};

function renderState(state) {
  currentState = state;

  // 渲染设备列表
  deviceSelect.innerHTML = '';
  if (!state.devices || state.devices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '正在搜索 DLNA 设备...';
    deviceSelect.appendChild(opt);
    deviceSelect.disabled = true;
  } else {
    deviceSelect.disabled = false;
    state.devices.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.address;
      opt.textContent = d.name;
      if (state.selectedDevice && state.selectedDevice.address === d.address) {
        opt.selected = true;
      }
      deviceSelect.appendChild(opt);
    });
  }

  // 渲染频道 Gallery
  channelGallery.innerHTML = '';
  if (!state.channels || state.channels.length === 0) {
    const empty = document.createElement('div');
    empty.className =
      'col-span-2 text-[12px] text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded-xl';
    empty.textContent = '正在加载频道列表...';
    channelGallery.appendChild(empty);
  } else {
    state.channels.forEach((c) => {
      const isSelected =
        state.selectedChannel && state.selectedChannel.uri === c.uri;
      const card = document.createElement('button');
      card.type = 'button';
      card.className =
        'group flex flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-xs transition ' +
        (isSelected
          ? 'border-emerald-400/80 bg-emerald-900/20 text-emerald-100 shadow shadow-emerald-500/30'
          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800/80 hover:border-slate-500');
      const titleEl = document.createElement('div');
      titleEl.className = 'truncate w-full';
      titleEl.textContent = c.title;
      const uriEl = document.createElement('div');
      uriEl.className =
        'mt-0.5 text-[10px] text-slate-500 group-hover:text-slate-400 truncate w-full';
      uriEl.textContent = c.uri;
      card.appendChild(titleEl);
      card.appendChild(uriEl);
      card.addEventListener('click', () => {
        window.broadcastAPI.selectChannel(c.uri);
        // 右侧选择频道后，左侧自动预览并测速
        previewCurrentChannel(c);
        testChannelSpeed(c);
      });
      channelGallery.appendChild(card);
    });
  }

  const deviceName = state.selectedDevice ? state.selectedDevice.name : '未选择';
  const channelName = state.selectedChannel
    ? state.selectedChannel.title
    : '未选择';
  statusText.textContent = `当前设备: ${deviceName} | 当前频道: ${channelName}`;
}

async function previewCurrentChannel(channel) {
  const ch = channel || currentState.selectedChannel;
  if (!ch) {
    statusText.textContent = '请先选择频道再预览';
    return;
  }

  const url = ch.uri;

  try {
    // 如果浏览器原生支持 HLS（macOS Safari 内核）
    if (previewVideo.canPlayType('application/vnd.apple.mpegurl')) {
      previewVideo.src = url;
      await previewVideo.play();
      statusText.textContent = `正在本机预览：${ch.title}`;
      return;
    }

    // 使用 hls.js 适配更多环境
    if (window.Hls && window.Hls.isSupported()) {
      if (window.__hlsInstance) {
        window.__hlsInstance.destroy();
      }
      const hls = new window.Hls();
      window.__hlsInstance = hls;
      hls.loadSource(url);
      hls.attachMedia(previewVideo);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        previewVideo
          .play()
          .then(() => {
            statusText.textContent = `正在本机预览：${ch.title}`;
          })
          .catch((err) => {
            statusText.textContent = `预览播放失败：${err.message || err}`;
          });
      });
      return;
    }

    statusText.textContent = '当前环境不支持 HLS 预览';
  } catch (e) {
    statusText.textContent = `预览失败：${e.message || e}`;
  }
}

async function testChannelSpeed(channel) {
  const ch = channel || currentState.selectedChannel;
  if (!ch) {
    speedText.textContent = '请先选择频道再测速';
    return;
  }

  const url = ch.uri;
  speedText.textContent = '正在测速中...';

  try {
    const start = performance.now();
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });

    if (!response.ok || !response.body) {
      speedText.textContent = `测速失败：HTTP ${response.status}`;
      return;
    }

    const reader = response.body.getReader();
    let received = 0;
    const maxBytes = 3 * 1024 * 1024; // 最多读取 3MB 估算带宽

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received >= maxBytes) {
        try {
          await reader.cancel();
        } catch (_) {
          // ignore
        }
        break;
      }
    }

    const durationSeconds = (performance.now() - start) / 1000;
    if (durationSeconds === 0) {
      speedText.textContent = '测速数据不足';
      return;
    }

    const mbps = (received * 8) / (1024 * 1024 * durationSeconds);
    speedText.textContent = `约 ${mbps.toFixed(2)} Mbps（基于 ${(
      received /
      (1024 * 1024)
    ).toFixed(2)} MB / ${durationSeconds.toFixed(2)} s）`;
  } catch (e) {
    speedText.textContent = `测速失败：${e.message || e}`;
  }
}

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
  if (!window.broadcastAPI) {
    // 预加载失败时的降级提示
    statusText.textContent = '预加载脚本未加载成功，请检查 Electron 配置。';
    return;
  }

  const [initialState, config] = await Promise.all([
    window.broadcastAPI.getState(),
    window.broadcastAPI.getConfig(),
  ]);
  renderState(initialState);
  if (config && config.m3u8Url && m3u8Input) {
    currentConfig = config;
    m3u8Input.value = config.m3u8Url;
  }

  window.broadcastAPI.onStateUpdate((newState) => {
    renderState(newState);
  });

  window.broadcastAPI.onCastResult((result) => {
    if (result.ok) {
      statusText.textContent = result.message;
    } else {
      statusText.textContent = result.message || '投屏失败';
    }
  });
});

deviceSelect.addEventListener('change', (e) => {
  const value = e.target.value;
  if (!value) return;
  window.broadcastAPI.selectDevice(value);
});

castButton.addEventListener('click', () => {
  window.broadcastAPI.startCast();
});

retryButton.addEventListener('click', () => {
  window.broadcastAPI.retrySearch();
  statusText.textContent = '正在重新搜索设备并刷新频道列表...';
});

previewButton.addEventListener('click', () => {
  previewCurrentChannel();
});

speedButton.addEventListener('click', () => {
  testChannelSpeed();
});

if (m3u8SaveButton && m3u8Input) {
  m3u8SaveButton.addEventListener('click', async () => {
    const newUrl = m3u8Input.value.trim();
    if (!newUrl) {
      statusText.textContent = 'm3u8 地址不能为空';
      return;
    }
    await window.broadcastAPI.updateM3u8Url(newUrl);
    statusText.textContent = '已更新 m3u8 配置并重新加载频道';
  });
}


