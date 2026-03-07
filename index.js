#!/usr/bin/env node

var MediaRendererClient = require('upnp-mediarenderer-client');
var UpnpSearcher = require('./component/dlna/SSDPSearcher')
const inquirer = require("inquirer");
const M3U8Client = require('./component/playlist/M3U8Fetcher')
const fs = require('fs');
const path = require('path');
const os = require('os');

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
      return { ...defaultConfig, ...config };
    }
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

let appConfig = loadConfig();

// 获取当前启用的 m3u8 URL
function getCurrentM3u8Url() {
  const currentSource = appConfig.sources.find(
    (s) => s.id === appConfig.currentSourceId && s.enabled
  );
  return currentSource ? currentSource.url : appConfig.sources[0]?.url;
}

// 添加源
function addSource(name, url) {
  const newSource = {
    id: Date.now().toString(),
    name: name,
    url: url,
    enabled: true,
  };
  appConfig.sources.push(newSource);
  saveConfig(appConfig);
  return newSource;
}

// 删除源
function removeSource(sourceId) {
  if (appConfig.sources.length <= 1) {
    console.log('至少保留一个源');
    return false;
  }
  appConfig.sources = appConfig.sources.filter((s) => s.id !== sourceId);
  if (appConfig.currentSourceId === sourceId) {
    appConfig.currentSourceId = appConfig.sources[0]?.id;
  }
  saveConfig(appConfig);
  return true;
}

// 切换源
function switchSource(sourceId) {
  const source = appConfig.sources.find((s) => s.id === sourceId);
  if (source) {
    appConfig.currentSourceId = sourceId;
    saveConfig(appConfig);
    return source;
  }
  return null;
}

let allDLNARender = []
let allChannel = []
let selectedChannel = null;
let selectedRemoter = null;

function showMainMenu() {
    // console.clear();
    if(!allChannel || allChannel.length == 0){
        console.log('[频道数据] 搜索频道中')
    }
    if (selectedRemoter) {
        console.log(`当前投屏设备: ${selectedRemoter.name}`)
    }
    if (selectedChannel) {
        console.log(`当前频道: ${selectedChannel.title}`)
    }
    // 显示当前源
    const currentSource = appConfig.sources.find(s => s.id === appConfig.currentSourceId);
    console.log(`当前源: ${currentSource?.name || '未选择'}`);

    inquirer.prompt([
        {
            type: 'rawlist',
            name: 'operation',
            message: '亲，请选择操作~',
            choices: ['选频道', '投屏', '管理m3u8源'],
        }]).then((answers) => {
            if (answers.operation === '投屏') {
                selectRemoteRender();
            } else if (answers.operation === '选频道') {
                selectChannel();
            } else if (answers.operation === '管理m3u8源') {
                manageSources();
            } else {
                showMainMenu();
            }
        });
}

// 管理 m3u8 源
function manageSources() {
    console.clear();
    console.log('=== m3u8 源管理 ===');
    if (appConfig.sources.length === 0) {
        console.log('当前没有配置任何源');
    } else {
        console.log('当前源列表:');
        appConfig.sources.forEach((s, idx) => {
            const marker = s.id === appConfig.currentSourceId ? ' [当前]' : '';
            console.log(`  ${idx + 1}. ${s.name}${marker}`);
          console.log(`     URL: ${s.url}`);
        });
    }

    const choices = ['添加源', '返回主菜单'];
    if (appConfig.sources.length > 0) {
        choices.unshift('切换源', '删除源');
    }

    inquirer.prompt([
        {
            type: 'rawlist',
            name: 'action',
            message: '请选择操作:',
            choices: choices,
        }
    ]).then((answers) => {
        if (answers.action === '切换源') {
            selectSource();
        } else if (answers.action === '添加源') {
            addSourcePrompt();
        } else if (answers.action === '删除源') {
            removeSourcePrompt();
        } else {
            showMainMenu();
        }
    });
}

// 选择源
function selectSource() {
    const choices = appConfig.sources.map((s) => ({
        name: `${s.name} (${s.url})`,
        value: s.id,
    }));

    inquirer.prompt([
        {
            type: 'rawlist',
            name: 'sourceId',
            message: '选择要使用的源:',
            choices: choices.concat([{ name: '取消', value: null }]),
        }
    ]).then((answers) => {
        if (answers.sourceId) {
            const source = switchSource(answers.sourceId);
            if (source) {
                console.log(`已切换到源: ${source.name}`);
                console.log('正在加载频道数据...');
                // 重新加载频道
                allChannel = [];
                let m3U8Client = new M3U8Client(source.url);
                m3U8Client.fetch((channel) => { allChannel = channel });
            }
        }
        setTimeout(manageSources, 1500);
    });
}

// 添加源
function addSourcePrompt() {
    inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: '输入源名称:',
        },
        {
            type: 'input',
            name: 'url',
            message: '输入 m3u8 URL:',
        }
    ]).then((answers) => {
        if (answers.name && answers.url) {
            const source = addSource(answers.name, answers.url);
            console.log(`已添加源: ${source.name}`);
            // 自动切换到新源并加载频道
            switchSource(source.id);
            allChannel = [];
            let m3U8Client = new M3U8Client(source.url);
            m3U8Client.fetch((channel) => { allChannel = channel });
            console.log('正在加载频道数据...');
        }
        setTimeout(manageSources, 1500);
    });
}

// 删除源
function removeSourcePrompt() {
    const choices = appConfig.sources.map((s) => ({
        name: s.name,
        value: s.id,
    }));

    inquirer.prompt([
        {
            type: 'rawlist',
            name: 'sourceId',
            message: '选择要删除的源:',
            choices: choices.concat([{ name: '取消', value: null }]),
        }
    ]).then((answers) => {
        if (answers.sourceId) {
            if (removeSource(answers.sourceId)) {
                console.log('源已删除');
            }
        }
        setTimeout(manageSources, 1000);
    });
}

function selectRemoteRender() {
    console.clear();
    if (!allDLNARender || allDLNARender.length == 0) {
        inquirer.prompt([{
            type: 'confirm',
            name: 'retry',
            message: '搜索中... 还没找到可投屏设备, 重试一下吗?',
            default: false,
            transformer: (answer) => (answer ? '👍' : '👎'),
        }]).then((answers) => {
            if (answers.retry) {
                selectRemoteRender();
            } else {
                showMainMenu()
            }
        })
        return;
    }
    let choices = allDLNARender.map((value) => {
        return {
            name: value.name,
            value
        }
    });
    inquirer.prompt([{
        type: 'rawlist',
        name: 'selectedRemoter',
        message: '请选择需要投屏的目标设备',
        choices
    }]).then((answers) => {
        selectedRemoter = answers.selectedRemoter;
        play();
    })
}

function selectChannel() {
    console.clear();
    // 检查是否有源
    if (appConfig.sources.length === 0) {
        inquirer.prompt([{
            type: 'confirm',
            name: 'addSource',
            message: '还没有配置 m3u8 源，是否现在添加?',
            default: true,
        }]).then((answers) => {
            if (answers.addSource) {
                manageSources();
            } else {
                showMainMenu();
            }
        });
        return;
    }
    if (!allChannel || allChannel.length == 0) {
        inquirer.prompt([{
            type: 'confirm',
            name: 'retry',
            message: '搜索中... 还没拉取到频道数据, 重试一下吗?',
            default: false,
            transformer: (answer) => (answer ? '👍' : '👎'),
        }]).then((answers) => {
            if (answers.retry) {
                selectChannel();
            } else {
                showMainMenu()
            }
        })
        return;
    }
    let choices = allChannel.map((value) => {
        return {
            name: value.title,
            value
        }
    });
    inquirer.prompt([{
        type: 'rawlist',
        name: 'selectedChannel',
        message: '亲要看哪个频道呢',
        choices
    }]).then((answers) => {
        selectedChannel = answers.selectedChannel;
        play();
    })
}

function play(){
    if (selectedRemoter && selectedChannel) {
        let client = new MediaRendererClient(selectedRemoter.address);
        client.load(selectedChannel.uri, {}, function (err, result) {
            if (err) throw err;
            console.log('正在投屏到 ...' + selectedChannel.uri);
            setTimeout(()=>{showMainMenu()}, 3000);
        });
        client.play();
    }else{
        showMainMenu();
    }
}

let upnpSearcher = new UpnpSearcher((deviceInfo) => {
    allDLNARender.push(deviceInfo)
})
upnpSearcher.doSearch()

// 使用当前配置的 m3u8 URL（如果有）
const currentUrl = getCurrentM3u8Url();
if (currentUrl) {
    let m3U8Client = new M3U8Client(currentUrl);
    m3U8Client.fetch((channel) => { allChannel = channel })
}

showMainMenu();


