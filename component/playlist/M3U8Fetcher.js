const https = require('https');
const m3u8Parser = require('m3u8-parser')

const M3U8_PAIR_REG = /^([^:]+)=\s*(")?(.*)(")?$/;

class M3U8Client {

    constructor(path){
        this.path = path;
    }
    

    fetch(callBack){
        https.get(this.path, (res) => {
            let m3u8Content = ''
            res.on('data', (chunk)=> {m3u8Content += chunk})
            res.on('end', ()=>{
                let parser = new m3u8Parser.Parser();
                parser.push(m3u8Content)
                parser.end();
                if(!parser.manifest){
                    return;
                }
                let allChannel = []
                parser.manifest.segments.forEach((entry=>{
                    let title = entry.title;
                    if(!title){
                        return;
                    }
                    let titleSplit = title.split(' ')
                    let titleMap = new Map();
                    titleSplit.forEach(entry => {
                        if(entry.indexOf('=') == -1){
                            return;
                        }
                        let entryPart = entry.split('=');
                        titleMap.set(entryPart[0], entryPart[1])
                    })
                    let titleName = titleMap.get('tvg-name')
                    if(!titleName){
                        titleName = titleMap.get('tvg-id')
                    }
                    if(!titleName){
                        titleName = titleMap.get('group-title')
                    }
                    if(!titleName){
                        titleName = '未知频道'
                    }
                    titleName = titleName.replace(/"/g,'')
                    allChannel.push({title: titleName, uri: entry.uri})
                }))
                if(callBack){
                    callBack(allChannel)
                }
            })
        });
    }
}

module.exports = M3U8Client