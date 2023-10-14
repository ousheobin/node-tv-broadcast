const SSDPConst = require('./SSDPConst')

function addNewLine(str, newLine){
    return str += newLine + '\r\n';
}

function buildCommandHeader(command){
    let header = '';
    header = addNewLine(header, 'M-SEARCH * HTTP/1.1');
    header = addNewLine(header, `Host: ${SSDPConst.BROADCAST_ADDR}:${SSDPConst.BROADCAST_PORT}`);
    header = addNewLine(header, `MAN: "ssdp:discover"`);
    header = addNewLine(header, `ST: ${command}`);
    header = addNewLine(header, `MX: 3`);
    return header + '\r\n';
}

module.exports = {buildCommandHeader}