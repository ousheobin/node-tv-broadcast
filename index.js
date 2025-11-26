#!/usr/bin/env node

var MediaRendererClient = require('upnp-mediarenderer-client');
var UpnpSearcher = require('./component/dlna/SSDPSearcher')
const inquirer = require("inquirer");
const M3U8Client = require('./component/playlist/M3U8Fetcher')

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
    inquirer.prompt([
        {
            type: 'rawlist',
            name: 'operation',
            message: '亲，请选择操作~',
            choices: ['选频道', '投屏'],
        }]).then((answers) => {
            if (answers.operation === '投屏') {
                selectRemoteRender();
            } else if (answers.operation === '选频道') {
                selectChannel();
            } else {
                showMainMenu();
            }
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

let m3U8Client = new M3U8Client('https://live.fanmingming.com/tv/m3u/global.m3u');
m3U8Client.fetch((channel) => { allChannel = channel })

showMainMenu();


