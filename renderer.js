// 简单的渲染进程脚本，操作 DOM 显示设备和频道列表

const deviceSelect = document.getElementById('deviceSelect');
const channelGallery = document.getElementById('channelGallery');
const castButton = document.getElementById('castButton');
const refreshDeviceButton = document.getElementById('refreshDeviceButton');
const refreshChannelButton = document.getElementById('refreshChannelButton');
const statusText = document.getElementById('statusText');
const previewVideo = document.getElementById('previewVideo');
const speedButton = document.getElementById('speedButton');
const speedText = document.getElementById('speedText');
const sourceSelect = document.getElementById('sourceSelect');
const manageSourceButton = document.getElementById('manageSourceButton');
const channelSearch = document.getElementById('channelSearch');
const sortBySpeedButton = document.getElementById('sortBySpeedButton');

// Real-time stats elements
const statLatency = document.getElementById('statLatency');
const statBitrate = document.getElementById('statBitrate');
const statResolution = document.getElementById('statResolution');
const statDownload = document.getElementById('statDownload');

// 源管理弹窗元素
const sourceModal = document.getElementById('sourceModal');
const closeSourceModal = document.getElementById('closeSourceModal');
const sourceList = document.getElementById('sourceList');
const newSourceName = document.getElementById('newSourceName');
const newSourceUrl = document.getElementById('newSourceUrl');
const addSourceButton = document.getElementById('addSourceButton');

let currentState = {
  devices: [],
  channels: [],
  selectedDevice: null,
  selectedChannel: null,
};
let currentConfig = {
  sources: [],
  currentSourceId: null,
};
let searchKeyword = '';
let speedCache = new Map(); // 缓存测速结果
let isSortedBySpeed = false; // 是否按速度排序

// 渲染源选择下拉框
function renderSourceSelect() {
  if (!sourceSelect) return;
  sourceSelect.innerHTML = '';
  currentConfig.sources.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === currentConfig.currentSourceId) {
      opt.selected = true;
    }
    sourceSelect.appendChild(opt);
  });
}

// 渲染源管理弹窗列表
function renderSourceList() {
  if (!sourceList) return;
  sourceList.innerHTML = '';
  currentConfig.sources.forEach((s) => {
    const item = document.createElement('div');
    item.className =
      'flex items-center justify-between p-2 rounded-lg border border-slate-700 bg-slate-800/50';

    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';
    const name = document.createElement('div');
    name.className = 'text-xs font-medium text-slate-200 truncate';
    name.textContent = s.name;
    const url = document.createElement('div');
    url.className = 'text-[10px] text-slate-500 truncate';
    url.textContent = s.url;
    info.appendChild(name);
    info.appendChild(url);

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 ml-2';

    // 当前源标记
    if (s.id === currentConfig.currentSourceId) {
      const current = document.createElement('span');
      current.className = 'text-[10px] text-emerald-400 px-1';
      current.textContent = '当前';
      actions.appendChild(current);
    }

    // 删除按钮（至少保留一个）
    if (currentConfig.sources.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className =
        'text-[10px] text-rose-400 hover:text-rose-300 px-2 py-1 transition';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', async () => {
        await window.broadcastAPI.removeSource(s.id);
        // 刷新配置
        const config = await window.broadcastAPI.getConfig();
        currentConfig = config;
        renderSourceSelect();
        renderSourceList();
      });
      actions.appendChild(delBtn);
    }

    item.appendChild(info);
    item.appendChild(actions);
    sourceList.appendChild(item);
  });
}

// 打开弹窗
function openSourceModal() {
  if (sourceModal) {
    sourceModal.classList.remove('hidden');
    sourceModal.classList.add('flex');
    renderSourceList();
  }
}

// 关闭弹窗
function closeSourceModalFn() {
  if (sourceModal) {
    sourceModal.classList.add('hidden');
    sourceModal.classList.remove('flex');
  }
}

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

  // 渲染频道 Gallery（支持搜索过滤）
  renderChannelGallery();
}

function renderChannelGallery() {
  const state = currentState;
  channelGallery.innerHTML = '';

  if (!state.channels || state.channels.length === 0) {
    const empty = document.createElement('div');
    empty.className =
      'col-span-2 text-[12px] text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded-xl';
    empty.textContent = '正在加载频道列表...';
    channelGallery.appendChild(empty);
    return;
  }

  // 过滤频道（搜索tvgName和title）
  let filteredChannels = searchKeyword
    ? state.channels.filter((c) => {
        const searchLower = searchKeyword.toLowerCase();
        const nameMatch = (c.tvgName || '').toLowerCase().includes(searchLower);
        const titleMatch = c.title.toLowerCase().includes(searchLower);
        return nameMatch || titleMatch;
      })
    : [...state.channels];

  if (filteredChannels.length === 0) {
    const empty = document.createElement('div');
    empty.className =
      'col-span-2 text-[12px] text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded-xl';
    empty.textContent = '未找到匹配的频道';
    channelGallery.appendChild(empty);
    return;
  }

  // 按速度排序
  if (isSortedBySpeed) {
    filteredChannels.sort((a, b) => {
      const speedA = speedCache.get(a.uri);
      const speedB = speedCache.get(b.uri);
      const getMs = (s) => {
        if (!s || s === '测速中...' || s === '等待测速') return Infinity;
        const match = s.match(/(\d+)ms/);
        return match ? parseInt(match[1]) : Infinity;
      };
      return getMs(speedA) - getMs(speedB);
    });
  }

  // 检查是否有任何频道有图标
  const hasAnyIcon = filteredChannels.some(c => c.icon);
  // 根据是否有图标设置网格列数
  channelGallery.className = hasAnyIcon
    ? 'grid grid-cols-1 gap-2 flex-1 overflow-y-auto pr-1 min-h-0'
    : 'grid grid-cols-2 gap-2 flex-1 overflow-y-auto pr-1 min-h-0';

  filteredChannels.forEach((c) => {
    const isSelected =
      state.selectedChannel && state.selectedChannel.uri === c.uri;
    const card = document.createElement('button');
    card.type = 'button';

    // 有图标时一行一个，横向布局；无图标时一行两个，纵向布局
    if (hasAnyIcon) {
      card.className =
        'group flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-xs transition ' +
        (isSelected
          ? 'border-emerald-400/80 bg-emerald-900/20 text-emerald-100 shadow shadow-emerald-500/30'
          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800/80 hover:border-slate-500');
    } else {
      card.className =
        'group flex flex-col items-start justify-center rounded-xl border px-3 py-2 text-left text-xs transition ' +
        (isSelected
          ? 'border-emerald-400/80 bg-emerald-900/20 text-emerald-100 shadow shadow-emerald-500/30'
          : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800/80 hover:border-slate-500');
    }

    // 图标（仅当有图标时显示）
    if (c.icon) {
      const iconEl = document.createElement('img');
      iconEl.className = 'w-10 h-10 rounded object-cover flex-shrink-0 bg-slate-800';
      iconEl.src = c.icon;
      iconEl.onerror = () => {
        iconEl.style.display = 'none';
      };
      card.appendChild(iconEl);
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'flex-1 min-w-0';

    const titleEl = document.createElement('div');
    titleEl.className = 'truncate font-medium';
    // GUI优先展示tvgName，如果没有则使用title
    titleEl.textContent = c.tvgName || c.title;

    // 第二行：优先展示地区和类目，都没有则展示URL
    const metaEl = document.createElement('div');
    metaEl.className =
      'mt-0.5 text-[10px] text-slate-500 group-hover:text-slate-400 truncate';

    const hasMeta = c.country || c.group;
    if (hasMeta) {
      const parts = [];
      if (c.country) parts.push(c.country);
      if (c.group) parts.push(c.group);
      metaEl.textContent = parts.join(' · ');
    } else {
      metaEl.textContent = c.uri;
    }

    // 测速结果显示区域
    const speedEl = document.createElement('div');
    speedEl.className = 'mt-0.5 text-[10px] speed-indicator';
    speedEl.dataset.uri = c.uri;

    const cachedSpeed = speedCache.get(c.uri);
    if (cachedSpeed) {
      speedEl.textContent = cachedSpeed;
      const match = cachedSpeed.match(/(\d+)ms/);
      if (match) {
        const ms = parseInt(match[1]);
        speedEl.className +=
          ms < 300 ? ' text-emerald-400' : ms < 800 ? ' text-amber-400' : ' text-rose-400';
      } else {
        speedEl.className += ' text-slate-400';
      }
    } else {
      speedEl.textContent = '等待测速';
      speedEl.className += ' text-slate-500';
    }

    contentEl.appendChild(titleEl);
    contentEl.appendChild(metaEl);
    contentEl.appendChild(speedEl);
    card.appendChild(contentEl);

    // 点击选择频道
    card.addEventListener('click', () => {
      window.broadcastAPI.selectChannel(c.uri);
      startPreview(c);
      testChannelSpeed(c);
    });

    channelGallery.appendChild(card);
  });

  const deviceName = state.selectedDevice ? state.selectedDevice.name : '未选择';
  const channelName = state.selectedChannel
    ? state.selectedChannel.title
    : '未选择';
  statusText.textContent = `当前设备: ${deviceName} | 当前频道: ${channelName}`;
}

// 批量预测速
async function preTestAllChannels() {
  if (!currentState.channels || currentState.channels.length === 0) return;

  const channels = currentState.channels;
  statusText.textContent = `开始预测速 ${channels.length} 个频道...`;

  // 提高并发到 30 个，只测时延不会占用太多资源
  const concurrency = 30;
  let tested = 0;

  // 单个频道测速，带超时控制
  async function testOneChannel(ch) {
    if (speedCache.has(ch.uri)) {
      tested++;
      return;
    }

    // 3秒超时控制
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
    );

    try {
      await Promise.race([
        new Promise((resolve) => {
          quickTestSpeed(ch, (result) => {
            speedCache.set(ch.uri, result);
            tested++;
            // 更新对应卡片的显示
            const speedEl = document.querySelector(
              `[data-uri="${CSS.escape(ch.uri)}"]`
            );
            if (speedEl) {
              speedEl.textContent = result;
              const match = result.match(/(\d+)ms/);
              if (match) {
                const ms = parseInt(match[1]);
                speedEl.className =
                  'mt-1 text-[10px] speed-indicator ' +
                  (ms < 300
                    ? 'text-emerald-400'
                    : ms < 800
                    ? 'text-amber-400'
                    : 'text-rose-400');
              }
            }
            resolve();
          });
        }),
        timeoutPromise,
      ]);
    } catch (e) {
      // 超时或失败
      speedCache.set(ch.uri, '超时');
      tested++;
      const speedEl = document.querySelector(
        `[data-uri="${CSS.escape(ch.uri)}"]`
      );
      if (speedEl) {
        speedEl.textContent = '超时';
        speedEl.className = 'mt-1 text-[10px] speed-indicator text-slate-500';
      }
    }

    // 每 10 个更新一次状态栏
    if (tested % 10 === 0 || tested === channels.length) {
      statusText.textContent = `预测速中... ${tested}/${channels.length}`;
    }
  }

  // 分批处理，但不用 await Promise.all 阻塞
  for (let i = 0; i < channels.length; i += concurrency) {
    const batch = channels.slice(i, i + concurrency);
    // 并发执行，但不等待全部完成，超时的会自动标记
    batch.forEach((ch) => testOneChannel(ch));
    // 小延迟让出主线程
    await new Promise((r) => setTimeout(r, 50));
  }

  // 等待所有测速完成（最多等 3 秒，超过 3 秒的延迟没法看）
  let waitCount = 0;
  while (tested < channels.length && waitCount < 30) {
    await new Promise((r) => setTimeout(r, 100));
    waitCount++;
  }

  // 标记未完成的为超时
  channels.forEach((ch) => {
    if (!speedCache.has(ch.uri)) {
      speedCache.set(ch.uri, '超时');
      const speedEl = document.querySelector(
        `[data-uri="${CSS.escape(ch.uri)}"]`
      );
      if (speedEl) {
        speedEl.textContent = '超时';
        speedEl.className = 'mt-1 text-[10px] speed-indicator text-slate-500';
      }
    }
  });

  statusText.textContent = `测速完成，可按速度排序`;
}

// Update real-time stats display
function updateStats(stats) {
  if (stats.latency !== undefined) {
    statLatency.textContent = stats.latency + 'ms';
  }
  if (stats.bitrate !== undefined) {
    statBitrate.textContent = stats.bitrate + ' Mbps';
  }
  if (stats.resolution !== undefined) {
    statResolution.textContent = stats.resolution;
  }
  if (stats.download !== undefined) {
    statDownload.textContent = stats.download + ' MB/s';
  }
}

function clearStats() {
  statLatency.textContent = '-';
  statBitrate.textContent = '-';
  statResolution.textContent = '-';
  statDownload.textContent = '-';
}

// Start preview with hls.js and real-time stats
async function startPreview(channel) {
  if (!channel) return;

  const url = channel.uri;
  clearStats();
  statusText.textContent = `正在加载: ${channel.tvgName || channel.title}...`;

  try {
    // Clean up existing hls instance
    if (window.__hlsInstance) {
      window.__hlsInstance.destroy();
      window.__hlsInstance = null;
    }

    // Reset video element
    previewVideo.pause();
    previewVideo.removeAttribute('src');
    previewVideo.load();

    // Use hls.js for HLS playback
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 5,
        backBufferLength: 30,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 2,
        manifestLoadingTimeOut: 10000,
        levelLoadingTimeOut: 10000,
      });
      window.__hlsInstance = hls;

      // Track download stats
      let lastLoadedBytes = 0;
      let lastLoadTime = performance.now();

      hls.on(window.Hls.Events.FRAG_LOADED, (event, data) => {
        const now = performance.now();
        const fragLoaded = data.frag.stats.loaded;
        const fragDuration = (now - lastLoadTime) / 1000;

        // Calculate speed based on this fragment's size and load time
        if (fragDuration > 0 && fragLoaded > 0) {
          const bytesPerSecond = fragLoaded / fragDuration;
          const mbps = (bytesPerSecond * 8 / 1000000).toFixed(1);
          const mbs = (bytesPerSecond / 1000000).toFixed(1);
          updateStats({ download: mbs, bitrate: mbps });
        }

        lastLoadedBytes += fragLoaded;
        lastLoadTime = now;
      });

      // Track level/quality changes
      hls.on(window.Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        if (level) {
          const resolution = level.width + 'x' + level.height;
          updateStats({ resolution });
        }
      });

      // Track buffer latency (time from live edge)
      setInterval(() => {
        if (hls && previewVideo) {
          // Get current playback position vs live edge
          const currentTime = previewVideo.currentTime;
          const bufferedEnd = hls.liveSyncPosition || currentTime;

          if (bufferedEnd && currentTime) {
            const bufferLatency = ((bufferedEnd - currentTime) * 1000).toFixed(0);
            updateStats({ latency: bufferLatency });
          }
        }
      }, 1000);

      // Handle errors
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch(data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              statusText.textContent = '网络错误，正在恢复...';
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              statusText.textContent = '媒体错误，正在恢复...';
              hls.recoverMediaError();
              break;
            default:
              statusText.textContent = `错误: ${data.details}`;
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(previewVideo);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        // Get initial resolution
        const level = hls.levels[hls.currentLevel];
        if (level) {
          updateStats({ resolution: level.width + 'x' + level.height });
        }

        previewVideo.play().then(() => {
          statusText.textContent = `正在播放: ${channel.tvgName || channel.title}`;
        }).catch((err) => {
          statusText.textContent = `播放失败: ${err.message}`;
        });
      });
      return;
    }

    // Fallback to native
    previewVideo.src = url;
    await previewVideo.play();
    statusText.textContent = `正在播放: ${channel.tvgName || channel.title}`;
  } catch (e) {
    statusText.textContent = `预览失败: ${e.message || e}`;
    console.error('Preview error:', e);
  }
}

// 快速测速，只测时延（HEAD请求）
async function quickTestSpeed(channel, callback) {
  const url = channel.uri;
  try {
    const start = performance.now();
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const latencyMs = (performance.now() - start).toFixed(0);

    if (!response.ok) {
      callback('无法连接');
      return;
    }

    if (latencyMs < 300) {
      callback(`${latencyMs}ms ⚡`);
    } else if (latencyMs < 800) {
      callback(`${latencyMs}ms ✓`);
    } else {
      callback(`${latencyMs}ms ⚠`);
    }
  } catch (e) {
    callback('超时');
  }
}

async function testChannelSpeed(channel) {
  const ch = channel || currentState.selectedChannel;
  if (!ch) {
    speedText.textContent = '请先选择频道';
    return;
  }

  const url = ch.uri;
  speedText.textContent = '正在测速...';

  try {
    // Measure latency only - this is what matters for channel switching
    const start = performance.now();
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const latencyMs = (performance.now() - start).toFixed(0);

    if (!response.ok) {
      speedText.textContent = `测速失败: HTTP ${response.status}`;
      return;
    }

    // Show latency with quality indicator
    let quality = '';
    if (latencyMs < 100) {
      quality = '极佳';
    } else if (latencyMs < 300) {
      quality = '良好';
    } else if (latencyMs < 800) {
      quality = '一般';
    } else {
      quality = '较差';
    }

    speedText.textContent = `延迟: ${latencyMs}ms (${quality})`;
  } catch (e) {
    speedText.textContent = `测速失败: ${e.message || e}`;
  }
}

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
  if (!window.broadcastAPI) {
    // 预加载失败时的降级提示
    statusText.textContent = '预加载脚本加载失败，请检查 Electron 配置';
    return;
  }

  const [initialState, config] = await Promise.all([
    window.broadcastAPI.getState(),
    window.broadcastAPI.getConfig(),
  ]);

  // 保存初始频道数量用于判断是否需要自动测速
  const initialChannelCount = initialState.channels?.length || 0;

  renderState(initialState);

  // 加载配置
  if (config && config.sources) {
    currentConfig = config;
    renderSourceSelect();
  }

  // 如果初始就有频道，立即开始预测速
  if (initialChannelCount > 0) {
    setTimeout(() => preTestAllChannels(), 500);
  }

  window.broadcastAPI.onStateUpdate((newState) => {
    const hadChannels = currentState.channels && currentState.channels.length > 0;
    renderState(newState);
    // 如果频道列表刚加载完成（从无到有），自动开始预测速
    if (!hadChannels && newState.channels && newState.channels.length > 0) {
      setTimeout(() => preTestAllChannels(), 500);
    }
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

// 刷新 DLNA 设备
refreshDeviceButton.addEventListener('click', () => {
  window.broadcastAPI.refreshDevices();
  statusText.textContent = '正在搜索 DLNA 设备...';
});

// 刷新频道列表
refreshChannelButton.addEventListener('click', () => {
  window.broadcastAPI.refreshChannels();
  statusText.textContent = '正在重新加载频道列表...';
});

speedButton.addEventListener('click', () => {
  testChannelSpeed();
});

// 频道搜索功能
if (channelSearch) {
  channelSearch.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    renderChannelGallery();
  });
}

// 按速度排序
if (sortBySpeedButton) {
  sortBySpeedButton.addEventListener('click', () => {
    isSortedBySpeed = !isSortedBySpeed;
    sortBySpeedButton.textContent = isSortedBySpeed ? '速度排序 ↑' : '速度排序 ↓';
    renderChannelGallery();
  });
}

// 源选择切换
if (sourceSelect) {
  sourceSelect.addEventListener('change', async (e) => {
    const sourceId = e.target.value;
    if (sourceId && sourceId !== currentConfig.currentSourceId) {
      statusText.textContent = '正在切换信号源...';
      await window.broadcastAPI.switchSource(sourceId);
      currentConfig.currentSourceId = sourceId;
      renderSourceSelect();
    }
  });
}

// 打开源管理弹窗
if (manageSourceButton) {
  manageSourceButton.addEventListener('click', openSourceModal);
}

// 关闭源管理弹窗
if (closeSourceModal) {
  closeSourceModal.addEventListener('click', closeSourceModalFn);
}

// 点击弹窗背景关闭
if (sourceModal) {
  sourceModal.addEventListener('click', (e) => {
    if (e.target === sourceModal) {
      closeSourceModalFn();
    }
  });
}

// 添加新源
if (addSourceButton) {
  addSourceButton.addEventListener('click', async () => {
    const name = newSourceName.value.trim();
    const url = newSourceUrl.value.trim();
    if (!name || !url) {
      statusText.textContent = '请输入信号源名称和地址';
      return;
    }
    const result = await window.broadcastAPI.addSource({ name, url });
    if (result.success) {
      // 刷新配置
      const config = await window.broadcastAPI.getConfig();
      currentConfig = config;
      renderSourceSelect();
      renderSourceList();
      // 清空输入
      newSourceName.value = '';
      newSourceUrl.value = '';
      statusText.textContent = '信号源已添加';
    } else {
      statusText.textContent = result.error || '添加失败';
    }
  });
}


