// i18n 多语言配置
const i18n = {
  // 当前语言
  currentLang: localStorage.getItem('lang') || 'zh',

  // 语言配置
  locales: {
    zh: {
      name: '简体中文',
      // 通用
      appName: 'TV Broadcast',
      // 标题栏
      title: 'TV Broadcast',
      subtitle: '选择 DLNA 设备和频道，一键投屏到电视',
      // 按钮
      refresh: '刷新',
      refreshDevice: '刷新设备',
      refreshChannel: '刷新频道',
      cast: '投屏',
      settings: '设置',
      search: '搜索',
      test: '测速',
      sortBySpeed: '速度排序',
      manage: '管理',
      add: '添加',
      close: '关闭',
      save: '保存',
      // 标签
      status: '状态',
      latency: '延迟',
      bitrate: '码率',
      resolution: '分辨率',
      download: '下载',
      connectionLatency: '连接延迟',
      channelList: '频道列表',
      m3uSource: 'M3U 源',
      signalSource: '信号源',
      channelPreview: '频道预览',
      hlsStats: 'HLS 实时统计',
      // 提示
      clickToSelect: '点击卡片预览频道，可按速度排序',
      searchChannels: '搜索频道...',
      loading: '初始化中...',
      loadingChannels: '正在加载频道列表...',
      noChannels: '未找到匹配的频道',
      waiting: '等待测速',
      timeout: '超时',
      speedTestComplete: '测速完成，可按速度排序',
      // 质量评级
      excellent: '极佳',
      good: '良好',
      fair: '一般',
      poor: '较差',
      // 错误
      networkError: '网络错误，正在恢复...',
      mediaError: '媒体错误，正在恢复...',
      playFailed: '播放失败',
      previewFailed: '预览失败',
      testFailed: '测速失败',
      selectDeviceAndChannel: '请先选择设备和频道',
      // 设置
      language: '语言',
      languageChanged: '语言已切换',
      enterSourceInfo: '请输入信号源名称和地址',
      sourceAdded: '信号源已添加',
      addFailed: '添加失败',
      manageSource: '管理信号源',
      addSource: '添加信号源',
      buffering: '缓冲中',
      loadComplete: '加载完成',
      playing: '正在播放',
    },
    en: {
      name: 'English',
      appName: 'TV Broadcast',
      title: 'TV Broadcast',
      subtitle: 'Select DLNA device and channel, cast to TV with one click',
      refresh: 'Refresh',
      refreshDevice: 'Refresh Devices',
      refreshChannel: 'Refresh Channels',
      cast: 'Cast',
      settings: 'Settings',
      search: 'Search',
      test: 'Test',
      sortBySpeed: 'Sort by Speed',
      manage: 'Manage',
      add: 'Add',
      close: 'Close',
      save: 'Save',
      status: 'Status',
      latency: 'Latency',
      bitrate: 'Bitrate',
      resolution: 'Resolution',
      download: 'Download',
      connectionLatency: 'Connection Latency',
      channelList: 'Channel List',
      m3uSource: 'M3U Source',
      signalSource: 'Signal Source',
      channelPreview: 'Channel Preview',
      hlsStats: 'HLS Stats',
      clickToSelect: 'Click card to preview, sort by speed',
      searchChannels: 'Search channels...',
      loading: 'Initializing...',
      loadingChannels: 'Loading channels...',
      noChannels: 'No channels found',
      waiting: 'Waiting',
      timeout: 'Timeout',
      speedTestComplete: 'Speed test complete',
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      networkError: 'Network error, recovering...',
      mediaError: 'Media error, recovering...',
      playFailed: 'Play failed',
      previewFailed: 'Preview failed',
      testFailed: 'Test failed',
      selectDeviceAndChannel: 'Please select device and channel first',
      language: 'Language',
      languageChanged: 'Language changed',
      enterSourceInfo: 'Please enter source name and URL',
      sourceAdded: 'Source added',
      addFailed: 'Add failed',
      manageSource: 'Manage Sources',
      addSource: 'Add Source',
      buffering: 'Buffering',
      loadComplete: 'Load complete',
      playing: 'Playing',
    },
    zh_TW: {
      name: '繁體中文',
      appName: 'TV Broadcast',
      title: 'TV Broadcast',
      subtitle: '選擇 DLNA 裝置和頻道，一鍵投屏到電視',
      refresh: '重新整理',
      refreshDevice: '重新整理裝置',
      refreshChannel: '重新整理頻道',
      cast: '投屏',
      settings: '設定',
      search: '搜尋',
      test: '測速',
      sortBySpeed: '速度排序',
      manage: '管理',
      add: '新增',
      close: '關閉',
      save: '儲存',
      status: '狀態',
      latency: '延遲',
      bitrate: '碼率',
      resolution: '分辨率',
      download: '下載',
      connectionLatency: '連線延遲',
      channelList: '頻道列表',
      m3uSource: 'M3U 來源',
      signalSource: '訊號來源',
      channelPreview: '頻道預覽',
      hlsStats: 'HLS 即時統計',
      clickToSelect: '點撃卡片預覽頻道，可按速度排序',
      searchChannels: '搜尋頻道...',
      loading: '初始化中...',
      loadingChannels: '正在載入頻道列表...',
      noChannels: '未找到符合的頻道',
      waiting: '等待測速',
      timeout: '逾時',
      speedTestComplete: '測速完成，可按速度排序',
      excellent: '極佳',
      good: '良好',
      fair: '一般',
      poor: '較差',
      networkError: '網路錯誤，正在恢復...',
      mediaError: '媒體錯誤，正在恢復...',
      playFailed: '播放失敗',
      previewFailed: '預覽失敗',
      testFailed: '測速失敗',
      selectDeviceAndChannel: '請先選擇裝置和頻道',
      language: '語言',
      languageChanged: '語言已切換',
      enterSourceInfo: '請輸入訊號源名稱和地址',
      sourceAdded: '訊號源已新增',
      addFailed: '新增失敗',
      manageSource: '管理訊號源',
      addSource: '新增訊號源',
      buffering: '緩衝中',
      loadComplete: '載入完成',
      playing: '正在播放',
    },
  },

  // 获取翻译
  t(key) {
    const locale = this.locales[this.currentLang];
    return locale[key] || key;
  },

  // 切换语言
  setLang(lang) {
    if (this.locales[lang]) {
      this.currentLang = lang;
      localStorage.setItem('lang', lang);
      document.documentElement.lang = lang === 'zh_TW' ? 'zh-TW' : lang;
      return true;
    }
    return false;
  },

  // 获取当前语言
  getLang() {
    return this.currentLang;
  },

  // 获取所有语言列表
  getLanguages() {
    return Object.entries(this.locales).map(([code, locale]) => ({
      code,
      name: locale.name,
    }));
  },
};

// 全局访问
window.i18n = i18n;
