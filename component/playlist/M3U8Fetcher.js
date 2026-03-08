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
                debugger
                let allChannel = []
                parser.manifest.segments.forEach((entry=>{
                    // The m3u8-parser library parses EXTINF into title field
                    // Format in title: tvg-name="xxx" tvg-logo="xxx",Display Name
                    let titleField = entry.title || '';

                    // Split by comma to separate attributes from display name
                    const commaIndex = titleField.indexOf(',');
                    let attrPart = '';
                    let displayName = titleField;

                    if (commaIndex !== -1) {
                        attrPart = titleField.substring(0, commaIndex);
                        displayName = titleField.substring(commaIndex + 1).trim();
                    }

                    // Parse attributes: tvg-name="value" format
                    const attrMap = new Map();
                    const attrRegex = /(\w[-\w]*)="([^"]*)"/g;
                    let match;
                    while ((match = attrRegex.exec(attrPart)) !== null) {
                        attrMap.set(match[1], match[2]);
                    }

                    // Extract attributes
                    const tvgName = attrMap.get('tvg-name');
                    const tvgId = attrMap.get('tvg-id');
                    const tvgCountry = attrMap.get('tvg-country');
                    const tvgLanguage = attrMap.get('tvg-language');
                    const tvgLogo = attrMap.get('tvg-logo');
                    const groupTitle = attrMap.get('group-title');

                    // Determine channel title
                    let titleName = displayName || tvgName || tvgId || groupTitle || 'Unknown';

                    allChannel.push({
                        title: titleName,
                        uri: entry.uri,
                        icon: tvgLogo || null,
                        tvgName: tvgName || null,
                        tvgId: tvgId || null,
                        country: tvgCountry || null,
                        language: tvgLanguage || null,
                        group: groupTitle || null
                    })
                }))
                if(callBack){
                    callBack(allChannel)
                }
            })
        });
    }
}

module.exports = M3U8Client