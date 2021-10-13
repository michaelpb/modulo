let componentTexts = null;

try {
    componentTexts = Modulo.factoryInstances['eg-eg']
            .baseRenderObj.script.exports.componentTexts;
} catch {
    console.log('couldnt get componentTexts');
    componentTexts = null;
}

function codemirrorMount({el}) {
    const demoType = props.demotype || 'snippet';
    const myElement = element;
    let expBackoff = 10;
    const mountCM = () => {
        // TODO: hack, allow JS deps or figure out loader or something
        if (!Modulo.globals.CodeMirror) {
            expBackoff *= 2;
            setTimeout(mountCM, expBackoff); // poll again
            return;
        }

        const readOnly = demoType === 'snippet';
        const conf = {
            value: state.text,
            mode: 'django',
            theme: 'eclipse',
            indentUnit: 4,
            readOnly,
        };

        const cm = Modulo.globals.CodeMirror(el, conf);
        myElement.codeMirrorEditor = cm;
    };
    // TODO: Ugly hack, need better tools for working with legacy
    setTimeout(mountCM, expBackoff);
}

function selectTab(ev, newTitle) {
    const currentTitle = state.title;
    state.selected = newTitle;
    for (const tab of Object.entries(state.tabs)) {
        const {title, text} =tab;
        if (title === currentTitle) { // save text back to state
            tab.text = element.codeMirrorEditor.getValue();
        } else if (title === newTitle) {
            state.text = tab.text;
            console.log('setting value!');
            element.codeMirrorEditor.setValue(tab.text);
        }
    }
}

function doCopy() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (!mod || !mod.script || !mod.script.copyTextToClipboard) {
        console.log('no mod!');
    } else {
        mod.script.copyTextToClipboard(props.text);
    }
}

function initializedCallback({el}) {
    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            throw new Error('Couldnt load:', props.fromlibrary)
        }

        const componentNames = props.fromlibrary.split(',');
        for (const title of componentNames) {
            if (title in componentTexts) {
                text = componentTexts[title].trim();
                state.tabs.push({text, title});
            } else {
                throw new Error('invalid fromlibrary:', title)
            }
        }
    } else if (props.text) {
        text = props.text.trim();
    }
    state.text = state.tabs[0].text; // load first
    setupShaChecksum();
}

function setupShaChecksum() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (Modulo.isBackend && state.text.includes('$modulojs_sha384_checksum$')) {
        if (!mod || !mod.script || !mod.script.getVersionInfo) {
            console.log('no mod!');
        } else {
            const info = mod.script.getVersionInfo();
            const checksum = info.checksum || '';
            state.text = state.text.replace('$modulojs_sha384_checksum$', checksum)
            element.setAttribute('text', state.text);
        }
    }
}
