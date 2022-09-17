let txt;

function sloccount() {
    if (!txt) {
        txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
    }
    return Modulo.require('sloc')(txt, 'js').source;
}

function checksum() {
    if (!txt) {
        txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
    }
    const CryptoJS = Modulo.require("crypto-js");
    const hash = CryptoJS['SHA384'](txt);
    return hash.toString(CryptoJS.enc.Base64);
    //const shaObj = new jsSHA("SHA-384", "TEXT", { encoding: "UTF8" });

    //shaObj.update(txt);
    //const hash = shaObj.getHash("B64");
    //return hash;
}

function getVersionInfo() {
    // Only do once to speed up SSG
    //console.log('this is Modulo', Object.keys(Modulo));
    if (!Modulo.ssgStore.versionInfo) {
        const bytes = Modulo.require('fs').readFileSync('./package.json');
        const data = JSON.parse(bytes);
        Modulo.ssgStore.versionInfo = {
            version: data.version,
            sloc: sloccount(),
            checksum: checksum(),
        };
    }
    return Modulo.ssgStore.versionInfo;
}

// https://stackoverflow.com/questions/400212/
const {document, navigator} = Modulo.globals;
function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function() {
        console.log('Async: Copying to clipboard was successful!');
    }, function(err) {
        console.error('Async: Could not copy text: ', err);
    });
}
