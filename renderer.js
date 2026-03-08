// Renderer script: manipulate DOM to display devices and channels

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
const settingsButton = document.getElementById('settingsButton');

// Real-time stats elements
const statLatency = document.getElementById('statLatency');
const statBitrate = document.getElementById('statBitrate');
const statResolution = document.getElementById('statResolution');
const statDownload = document.getElementById('statDownload');

// Source management modal elements
const sourceModal = document.getElementById('sourceModal');
const closeSourceModal = document.getElementById('closeSourceModal');
const sourceList = document.getElementById('sourceList');
const newSourceName = document.getElementById('newSourceName');
const newSourceUrl = document.getElementById('newSourceUrl');
const addSourceButton = document.getElementById('addSourceButton');

// Settings modal elements
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const langOptions = document.querySelectorAll('.lang-option');

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
let speedCache = new Map(); // Cache speed test results
let isSortedBySpeed = false; // Whether sorted by speed

// Channel status state - independent of language
let channelStatusState = {
  type: 'idle', // idle, loading, playing, error, casting
  message: '',
  channelName: '',
  deviceName: ''
};

// Update channel status display (language independent)
function updateChannelStatus(type, message, channelName, deviceName) {
  channelStatusState.type = type;
  if (message) channelStatusState.message = message;
  if (channelName) channelStatusState.channelName = channelName;
  if (deviceName) channelStatusState.deviceName = deviceName;

  const parts = [];
  if (channelStatusState.deviceName) {
    parts.push(`Device: ${channelStatusState.deviceName}`);
  }
  if (channelStatusState.channelName) {
    parts.push(`Channel: ${channelStatusState.channelName}`);
  }

  let statusMsg = '';
  switch(channelStatusState.type) {
    case 'loading':
      statusMsg = channelStatusState.message || 'Loading...';
      break;
    case 'playing':
      statusMsg = channelStatusState.message || `Playing: ${channelStatusState.channelName}`;
      break;
    case 'error':
      statusMsg = channelStatusState.message || 'Error';
      break;
    case 'casting':
      statusMsg = channelStatusState.message || 'Casting...';
      break;
    default:
      statusMsg = channelStatusState.message || 'Ready';
  }

  if (parts.length > 0) {
    statusText.textContent = `${parts.join(' | ')} - ${statusMsg}`;
  } else {
    statusText.textContent = statusMsg;
  }
}

// Render source select dropdown
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

// Render source management modal list
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

    // Current source indicator
    if (s.id === currentConfig.currentSourceId) {
      const current = document.createElement('span');
      current.className = 'text-[10px] text-emerald-400 px-1';
      current.textContent = 'Current';
      actions.appendChild(current);
    }

    // Delete button (keep at least one)
    if (currentConfig.sources.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className =
        'text-[10px] text-rose-400 hover:text-rose-300 px-2 py-1 transition';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', async () => {
        await window.broadcastAPI.removeSource(s.id);
        // Refresh config
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

// Open modal
function openSourceModal() {
  if (sourceModal) {
    sourceModal.classList.remove('hidden');
    sourceModal.classList.add('flex');
    renderSourceList();
  }
}

// Close modal
function closeSourceModalFn() {
  if (sourceModal) {
    sourceModal.classList.add('hidden');
    sourceModal.classList.remove('flex');
  }
}

function renderState(state) {
  currentState = state;

  // Render device list
  deviceSelect.innerHTML = '';
  if (!state.devices || state.devices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Searching DLNA devices...';
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

  // Render channel gallery (with search filter)
  renderChannelGallery();
}

function renderChannelGallery() {
  const state = currentState;
  channelGallery.innerHTML = '';

  if (!state.channels || state.channels.length === 0) {
    const empty = document.createElement('div');
    empty.className =
      'col-span-2 text-[12px] text-slate-500 py-4 text-center border border-dashed border-slate-700 rounded-xl';
    empty.textContent = 'Loading channels...';
    channelGallery.appendChild(empty);
    return;
  }

  // Filter channels (search tvgName and title)
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
    empty.textContent = 'No channels found';
    channelGallery.appendChild(empty);
    return;
  }

  // Sort by speed
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

  // Check if any channel has icon
  const hasAnyIcon = filteredChannels.some(c => c.icon);
  // Set grid columns based on icon presence
  channelGallery.className = hasAnyIcon
    ? 'grid grid-cols-1 gap-2 flex-1 overflow-y-auto pr-1 min-h-0'
    : 'grid grid-cols-2 gap-2 flex-1 overflow-y-auto pr-1 min-h-0';

  filteredChannels.forEach((c) => {
    const isSelected =
      state.selectedChannel && state.selectedChannel.uri === c.uri;
    const card = document.createElement('button');
    card.type = 'button';

    // Horizontal layout with icon, vertical without
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

    // Icon (only when available)
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
    // GUI shows tvgName first, fallback to title
    titleEl.textContent = c.tvgName || c.title;

    // Second line: show country and group, fallback to URL
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

    // Speed test result area
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

    // Click to select channel
    card.addEventListener('click', () => {
      window.broadcastAPI.selectChannel(c.uri);
      startPreview(c);
      testChannelSpeed(c);
    });

    channelGallery.appendChild(card);
  });

  const deviceName = state.selectedDevice ? state.selectedDevice.name : '';
  const channelName = state.selectedChannel ? state.selectedChannel.title : '';
  updateChannelStatus(channelStatusState.type, channelStatusState.message, channelName, deviceName);
}

// Batch pre-test all channels
async function preTestAllChannels() {
  if (!currentState.channels || currentState.channels.length === 0) return;

  const channels = currentState.channels;
  statusText.textContent = `Starting speed test for ${channels.length} channels...`;

  // Increase concurrency to 30, latency test doesn't consume much resource
  const concurrency = 30;
  let tested = 0;

  // Single channel speed test with timeout
  async function testOneChannel(ch) {
    if (speedCache.has(ch.uri)) {
      tested++;
      return;
    }

    // 3 second timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000)
    );

    try {
      await Promise.race([
        new Promise((resolve) => {
          quickTestSpeed(ch, (result) => {
            speedCache.set(ch.uri, result);
            tested++;
            // Update card display
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
      // Timeout or failure
      speedCache.set(ch.uri, 'Timeout');
      tested++;
      const speedEl = document.querySelector(
        `[data-uri="${CSS.escape(ch.uri)}"]`
      );
      if (speedEl) {
        speedEl.textContent = 'Timeout';
        speedEl.className = 'mt-1 text-[10px] speed-indicator text-slate-500';
      }
    }

    // Update status every 10 channels
    if (tested % 10 === 0 || tested === channels.length) {
      statusText.textContent = `Testing... ${tested}/${channels.length}`;
    }
  }

  // Process in batches without blocking with await Promise.all
  for (let i = 0; i < channels.length; i += concurrency) {
    const batch = channels.slice(i, i + concurrency);
    // Execute concurrently without waiting, timeouts will be auto-marked
    batch.forEach((ch) => testOneChannel(ch));
    // Small delay to yield main thread
    await new Promise((r) => setTimeout(r, 50));
  }

  // Wait for all tests to complete (max 3 seconds, latency > 3s is unusable)
  let waitCount = 0;
  while (tested < channels.length && waitCount < 30) {
    await new Promise((r) => setTimeout(r, 100));
    waitCount++;
  }

  // Mark unfinished as timeout
  channels.forEach((ch) => {
    if (!speedCache.has(ch.uri)) {
      speedCache.set(ch.uri, 'Timeout');
      const speedEl = document.querySelector(
        `[data-uri="${CSS.escape(ch.uri)}"]`
      );
      if (speedEl) {
        speedEl.textContent = 'Timeout';
        speedEl.className = 'mt-1 text-[10px] speed-indicator text-slate-500';
      }
    }
  });

  statusText.textContent = `Speed test complete, can sort by speed`;
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

  try {
    // Clean up existing hls instance
    if (window.__hlsInstance) {
      window.__hlsInstance.destroy();
      window.__hlsInstance = null;
    }

    // Reset video element - wait for any pending play/pause to complete
    if (previewVideo.src) {
      previewVideo.pause();
      previewVideo.removeAttribute('src');
      previewVideo.load();
      // Small delay to let the browser process the cleanup
      await new Promise(r => setTimeout(r, 50));
    }

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
        if (level && level.width > 0 && level.height > 0) {
          const resolution = level.width + 'x' + level.height;
          updateStats({ resolution });
        }
      });

      // Track buffer latency with moving average
      const latencySamples = [];
      const maxSamples = 5;
      let lastCurrentTime = 0;
      let stallCount = 0;

      setInterval(() => {
        if (hls && previewVideo) {
          const currentTime = previewVideo.currentTime;
          const buffered = previewVideo.buffered;

          // Detect stall - time not advancing but not paused
          if (!previewVideo.paused && currentTime === lastCurrentTime && currentTime > 0) {
            stallCount++;
            if (stallCount > 3) {
              console.warn('[HLS] Playback stalled, attempting recovery');
              hls.recoverMediaError();
              stallCount = 0;
            }
          } else {
            stallCount = 0;
          }
          lastCurrentTime = currentTime;

          // Check for weird timestamp (live stream timestamp issue)
          if (currentTime > 1000000) {
            // Reset to live edge if timestamp is unreasonable (> 11 days)
            console.warn('[HLS] Weird timestamp detected:', currentTime);
            if (hls.liveSyncPosition) {
              previewVideo.currentTime = hls.liveSyncPosition;
            }
          }

          if (buffered && buffered.length > 0 && currentTime > 0) {
            // Find the buffer range that contains currentTime
            let bufferedEnd = 0;
            for (let i = 0; i < buffered.length; i++) {
              if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
                bufferedEnd = buffered.end(i);
                break;
              }
            }

            // Only calculate if we found valid buffer range
            if (bufferedEnd > currentTime) {
              const latencyMs = (bufferedEnd - currentTime) * 1000;

              // Add to samples
              latencySamples.push(latencyMs);
              if (latencySamples.length > maxSamples) {
                latencySamples.shift();
              }

              // Calculate moving average
              const avgLatency = latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length;
              updateStats({ latency: Math.max(0, avgLatency).toFixed(0) });
            }
          }
        }
      }, 1000);

      // Handle errors with detailed descriptions
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch(data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              {
                let errorDetail = '';
                switch(data.details) {
                  case window.Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
                    errorDetail = 'Manifest load failed';
                    break;
                  case window.Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
                    errorDetail = 'Manifest load timeout';
                    break;
                  case window.Hls.ErrorDetails.FRAG_LOAD_ERROR:
                    errorDetail = 'Fragment load failed';
                    break;
                  case window.Hls.ErrorDetails.FRAG_LOAD_TIMEOUT:
                    errorDetail = 'Fragment load timeout';
                    break;
                  case window.Hls.ErrorDetails.LEVEL_LOAD_ERROR:
                    errorDetail = 'Level load failed';
                    break;
                  case window.Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT:
                    errorDetail = 'Level load timeout';
                    break;
                  case window.Hls.ErrorDetails.LEVEL_PARSING_ERROR:
                    errorDetail = 'Level parsing failed';
                    break;
                  default:
                    errorDetail = data.details || 'Network error';
                }
                updateChannelStatus('error', `${errorDetail}, retrying...`);
                // Try to recover by switching to next level or reloading
                if (hls.levels && hls.levels.length > 1) {
                  const nextLevel = (hls.currentLevel + 1) % hls.levels.length;
                  hls.currentLevel = nextLevel;
                }
                hls.startLoad();
              }
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              // Only show error if not already playing smoothly
              if (previewVideo.paused || previewVideo.readyState < 3) {
                // Ignore non-fatal codec compatibility warnings during playback
                if (data.details !== 'manifestIncompatibleCodecsError' || !hasStarted) {
                  updateChannelStatus('error', `Media error (${data.details}), recovering...`);
                }
              }
              hls.recoverMediaError();
              break;
            default:
              updateChannelStatus('error', `Error: ${data.details}`);
              hls.destroy();
              break;
          }
        }
      });

      hls.loadSource(url);
      hls.attachMedia(previewVideo);

      let hasStarted = false;

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        // Get initial resolution
        const level = hls.levels[hls.currentLevel];
        if (level && level.width > 0 && level.height > 0) {
          updateStats({ resolution: level.width + 'x' + level.height });
        }

        // Use canplay event instead of direct play() to avoid interruption
        if (!hasStarted) {
          hasStarted = true;
          const playWhenReady = () => {
            const playPromise = previewVideo.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                updateChannelStatus('playing', '', channel.tvgName || channel.title);
              }).catch((err) => {
                // Ignore interruption errors from rapid channel switching
                if (err.name !== 'AbortError') {
                  console.error('Play error:', err);
                  updateChannelStatus('error', `Play failed: ${err.message}`);
                }
              });
            }
          };

          // If already can play, start immediately
          if (previewVideo.readyState >= 3) {
            playWhenReady();
          } else {
            // Wait for canplay event
            previewVideo.addEventListener('canplay', playWhenReady, { once: true });
          }
        }
      });

      return;
    }

    // Fallback to native
    try {
      previewVideo.src = url;
      await previewVideo.play();
      statusText.textContent = `${i18n.t('playing')}: ${channel.tvgName || channel.title}`;
    } catch (e) {
      statusText.textContent = `${i18n.t('previewFailed')}: ${e.message || e}`;
      console.error('Preview error:', e);
    }
  } catch (e) {
    statusText.textContent = `${i18n.t('previewFailed')}: ${e.message || e}`;
    console.error('Preview error:', e);
  }
}

// Quick speed test, only measure latency (HEAD request)
async function quickTestSpeed(channel, callback) {
  const url = channel.uri;
  try {
    const start = performance.now();
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const latencyMs = (performance.now() - start).toFixed(0);

    if (!response.ok) {
      callback('Unreachable');
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
    callback('Timeout');
  }
}

async function testChannelSpeed(channel) {
  const ch = channel || currentState.selectedChannel;
  if (!ch) {
    speedText.textContent = 'Please select a channel first';
    return;
  }

  const url = ch.uri;
  speedText.textContent = 'Testing...';

  try {
    // Measure latency only - this is what matters for channel switching
    const start = performance.now();
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const latencyMs = (performance.now() - start).toFixed(0);

    if (!response.ok) {
      speedText.textContent = `Test failed: HTTP ${response.status}`;
      return;
    }

    // Show latency with quality indicator
    let quality = '';
    if (latencyMs < 100) {
      quality = 'Excellent';
    } else if (latencyMs < 300) {
      quality = 'Good';
    } else if (latencyMs < 800) {
      quality = 'Fair';
    } else {
      quality = 'Poor';
    }

    speedText.textContent = `Latency: ${latencyMs}ms (${quality})`;
  } catch (e) {
    speedText.textContent = `Test failed: ${e.message || e}`;
  }
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  if (!window.broadcastAPI) {
    // Fallback when preload script fails
    updateChannelStatus('error', 'Preload script failed to load, check Electron config');
    return;
  }

  const [initialState, config] = await Promise.all([
    window.broadcastAPI.getState(),
    window.broadcastAPI.getConfig(),
  ]);

  // Save initial channel count to determine if auto speed test is needed
  const initialChannelCount = initialState.channels?.length || 0;

  renderState(initialState);

  // Load config
  if (config && config.sources) {
    currentConfig = config;
    renderSourceSelect();
  }

  // If channels exist initially, start pre-test immediately
  if (initialChannelCount > 0) {
    setTimeout(() => preTestAllChannels(), 500);
  }

  window.broadcastAPI.onStateUpdate((newState) => {
    const hadChannels = currentState.channels && currentState.channels.length > 0;
    renderState(newState);
    // Auto start pre-test when channels load (from none to some)
    if (!hadChannels && newState.channels && newState.channels.length > 0) {
      setTimeout(() => preTestAllChannels(), 500);
    }
  });

  window.broadcastAPI.onCastResult((result) => {
    if (result.ok) {
      updateChannelStatus('casting', result.message);
    } else {
      updateChannelStatus('error', result.message || 'Cast failed');
    }
  });
});

deviceSelect.addEventListener('change', (e) => {
  const value = e.target.value;
  if (!value) return;
  window.broadcastAPI.selectDevice(value);
});

castButton.addEventListener('click', () => {
  // Visual feedback
  castButton.classList.add('opacity-50', 'scale-95');
  setTimeout(() => {
    castButton.classList.remove('opacity-50', 'scale-95');
  }, 150);

  // Update status to show casting is starting
  updateChannelStatus('casting', 'Starting cast...');

  window.broadcastAPI.startCast().catch((err) => {
    console.error('Cast failed:', err);
    updateChannelStatus('error', `Cast failed: ${err.message || err}`);
  });
});

// Refresh DLNA devices
refreshDeviceButton.addEventListener('click', () => {
  window.broadcastAPI.refreshDevices();
  updateChannelStatus('idle', 'Searching DLNA devices...');
});

// Refresh channel list
refreshChannelButton.addEventListener('click', () => {
  window.broadcastAPI.refreshChannels();
  updateChannelStatus('idle', 'Reloading channels...');
});

speedButton.addEventListener('click', () => {
  testChannelSpeed();
});

// Channel search
if (channelSearch) {
  channelSearch.addEventListener('input', (e) => {
    searchKeyword = e.target.value.trim();
    renderChannelGallery();
  });
}

// Sort by speed
if (sortBySpeedButton) {
  sortBySpeedButton.addEventListener('click', () => {
    isSortedBySpeed = !isSortedBySpeed;
    sortBySpeedButton.textContent = isSortedBySpeed ? '速度排序 ↑' : '速度排序 ↓';
    renderChannelGallery();
  });
}

// Source selection change
if (sourceSelect) {
  sourceSelect.addEventListener('change', async (e) => {
    const sourceId = e.target.value;
    if (sourceId && sourceId !== currentConfig.currentSourceId) {
      updateChannelStatus('idle', 'Switching source...');
      await window.broadcastAPI.switchSource(sourceId);
      currentConfig.currentSourceId = sourceId;
      renderSourceSelect();
    }
  });
}

// Open source management modal
if (manageSourceButton) {
  manageSourceButton.addEventListener('click', openSourceModal);
}

// Close source management modal
if (closeSourceModal) {
  closeSourceModal.addEventListener('click', closeSourceModalFn);
}

// Click modal background to close
if (sourceModal) {
  sourceModal.addEventListener('click', (e) => {
    if (e.target === sourceModal) {
      closeSourceModalFn();
    }
  });
}

// Add new source
if (addSourceButton) {
  addSourceButton.addEventListener('click', async () => {
    const name = newSourceName.value.trim();
    const url = newSourceUrl.value.trim();
    if (!name || !url) {
      updateChannelStatus('error', 'Please enter source name and URL');
      return;
    }
    const result = await window.broadcastAPI.addSource({ name, url });
    if (result.success) {
      // Refresh config
      const config = await window.broadcastAPI.getConfig();
      currentConfig = config;
      renderSourceSelect();
      renderSourceList();
      // Clear input
      newSourceName.value = '';
      newSourceUrl.value = '';
      updateChannelStatus('idle', 'Source added');
    } else {
      updateChannelStatus('error', result.error || 'Add failed');
    }
  });
}

// ========== i18n Internationalization Support ==========

// Update all page text
function updatePageText() {
  // Update elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = i18n.t(key);
    }
  });

  // Update elements with data-i18n-title attribute
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = i18n.t(key);
    }
  });

  // Update placeholder
  if (channelSearch) {
    channelSearch.placeholder = i18n.t('searchChannels');
  }

  // Update dynamic content
  updateLanguageSelection();
}

// Update language selection state
function updateLanguageSelection() {
  const currentLang = i18n.getLang();
  langOptions.forEach(btn => {
    const lang = btn.getAttribute('data-lang');
    const checkIcon = btn.querySelector('.check-icon');
    if (lang === currentLang) {
      btn.classList.add('border-sky-500', 'bg-sky-900/20');
      checkIcon.classList.remove('hidden');
    } else {
      btn.classList.remove('border-sky-500', 'bg-sky-900/20');
      checkIcon.classList.add('hidden');
    }
  });
}

// Settings page events
if (settingsButton) {
  settingsButton.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('flex');
    updateLanguageSelection();
  });
}

if (closeSettingsModal) {
  closeSettingsModal.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    settingsModal.classList.remove('flex');
  });
}

// Click outside modal to close
if (settingsModal) {
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.add('hidden');
      settingsModal.classList.remove('flex');
    }
  });
}

// Language switch
langOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-lang');
    if (i18n.setLang(lang)) {
      updatePageText();
      // Language change doesn't affect channel status
      // Just refresh the display with current state
      updateChannelStatus(channelStatusState.type, channelStatusState.message);
    }
  });
});

// Initialize page text
window.addEventListener('DOMContentLoaded', () => {
  updatePageText();
});


