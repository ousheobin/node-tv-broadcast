const dgram = require('dgram');
const http = require('http');
const xml2js = require('xml2js')
const SSDPConst = require('./SSDPConst')
const SearchHeaderBuilder = require('./SearchHeaderBuilder');

// 搜索字符串
const SSDP_HEADER_REGEX = /^([^:]+):\s*(.*)$/;

class UpnpSearcher {

    constructor(onDeviceCallBack) {
        this.udpSocket = dgram.createSocket('udp4');
        this.udpSocket.bind(9001, () => {
            this.udpSocket.addMembership(SSDPConst.BROADCAST_ADDR)
        })
        this.udpSocket.on('message', (message, remoteInfo) => {
            this.handleResponse(message, remoteInfo)
        });
        this.addrList = []
        this.onDeviceCallBack = onDeviceCallBack;
    }

    getStatusCode(res) {
        let lines = res.split('\r\n');
        let type = lines.shift().split(' ');
        return parseInt(type[1], 10);
    }

    getHeaders(res) {
        let allHeaderLines = res.split('\r\n');
        var headers = {};
        allHeaderLines.forEach((line)=>{
            if (line && line.length && SSDP_HEADER_REGEX.test(line) ) {
                var pairs = line.match(SSDP_HEADER_REGEX);
                headers[pairs[1].toUpperCase()] = pairs[2]; 
            }
        });
        return headers
    }
    

    handleResponse(message, remoteInfo) {
        let response = message.toString();
        if (this.getStatusCode(response) !== 200) {
            return;
        }
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
                const parser = new xml2js.Parser();
                parser.parseString(xmlData, (err, res)=>{
                    if(err || !res || !res.root.device){
                        return;
                    }
                    let friendlyName = res.root.device[0].friendlyName;
                    if (!friendlyName){
                        return;
                    }
                    if(this.onDeviceCallBack){
                        this.onDeviceCallBack({name:friendlyName[0], address: headers['LOCATION']}) 
                    }
                })
            })
        });
    }

    doSearch(){
        let searchParam = 'urn:schemas-upnp-org:device:MediaRenderer:1';
        let message = Buffer.from(SearchHeaderBuilder.buildCommandHeader(searchParam), 'ascii');
        this.udpSocket.send(message, 0, message.length, SSDPConst.BROADCAST_PORT, SSDPConst.BROADCAST_ADDR, (error, bytes)=>{return undefined})
    }

}

module.exports = UpnpSearcher