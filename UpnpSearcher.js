var dgram = require('dgram');
var http = require('http');

// UPNP 组播配置地址
const BROADCAST_ADDR = '239.255.255.250';
const BROADCAST_PORT = 1900;

// 搜索字符串
const M_SEARCH = 'M-SEARCH * HTTP/1.1\r\nHost: ' + BROADCAST_ADDR + ':' + BROADCAST_PORT + '\r\nMan: "ssdp:discover"\r\nST: %st\r\nMX: 3\r\n\r\n';

const SSDP_HEADER_REGEX = /^([^:]+):\s*(.*)$/;

class UpnpSearcher {

    constructor() {
        this.udpSocket = dgram.createSocket('udp4');
        this.udpSocket.bind(9001, () => {
            this.udpSocket.addMembership(BROADCAST_ADDR)
        })
        this.udpSocket.on('message', (message, remoteInfo) => {
            this.handleResponse(message, remoteInfo)
        });
        this.addrList = []
    }

    getStatusCode(res) {
        let lines = res.split('\r\n');
        let type = lines.shift().split(' ');
        return parseInt(type[1], 10);
    }

    getHeaders(res) {
        var lines = res.split('\r\n');
    
        var headers = {};
    
        lines.forEach(function (line) {
            if (line.length) {
                var pairs = line.match(SSDP_HEADER_REGEX);
                if (pairs) headers[pairs[1].toUpperCase()] = pairs[2]; 
            }
        });
    
        return headers
    }
    

    handleResponse(message, remoteInfo) {
        let response = message.toString();
        if (this.getStatusCode(response) !== 200) return;
        let headers = this.getHeaders(response);
        let addr = headers['LOCATION'];
        if(this.addrList.indexOf(addr) > -1){
            return;
        }
        this.addrList.push(addr)
        http.get(addr, (res) => {
            let xmlData = ''
            res.on('data', (chunk)=> xmlData += chunk)
            res.on('end', ()=>{
                let friendlyName = xmlData.match(/<friendlyName>(.+?)<\/friendlyName>/);
                if (!friendlyName) return;
                let friendlyNameStr = friendlyName[1];
                if(this.onDeviceCallBack){
                    this.onDeviceCallBack({name:friendlyNameStr, address: headers['LOCATION']}) 
                }
            })
        });
    }

    doSearch(onDeviceCallBack){
        let searchParam = 'urn:schemas-upnp-org:device:MediaRenderer:1';
        let message = Buffer.from(M_SEARCH.replace('%st', searchParam), 'ascii');
        this.udpSocket.send(message, 0, message.length, BROADCAST_PORT, BROADCAST_ADDR, ()=>{return undefined})
        this.onDeviceCallBack = onDeviceCallBack;
    }

}

module.exports = UpnpSearcher