let componentTexts = null;
let exCounter = 0; // global variable

try {
    componentTexts = Modulo.factoryInstances['eg-eg']
            .baseRenderObj.script.exports.componentTexts;
} catch {
    console.log('couldnt get componentTexts');
    componentTexts = null;
}

const CODE_EDITOR_TABS = [
    {title: 'Code'},
    {title: 'Editor'},
]

function codemirrorMount({el}) {
    const demoType = props.demotype || 'snippet';
    const myElement = element;
    const myState = state;
    let expBackoff = 10;
    const mountCM = () => {
        // TODO: hack, allow JS deps or figure out loader or something
        if (!Modulo.globals.CodeMirror) {
            expBackoff *= 2;
            setTimeout(mountCM, expBackoff); // poll again
            return;
        }


        let readOnly = false;
        let lineNumbers = true;
        if (demoType === 'snippet') {
            readOnly = true;
            lineNumbers = false;
        }

        const conf = {
            value: state.text,
            mode: 'django',
            theme: 'eclipse',
            indentUnit: 4,
            readOnly,
            lineNumbers,
        };

        if (demoType === 'snippet') {
            myState.showclipboard = true;
        } else if (demoType === 'minipreview') {
            myState.showpreview = true;
        } else if (demoType === 'tabpreview') {
            myState.tabs = CODE_EDITOR_TABS;
        }

        const cm = Modulo.globals.CodeMirror(el, conf);
        myElement.codeMirrorEditor = cm;
        myElement.rerender();
    };
    // TODO: Ugly hack, need better tools for working with legacy
    setTimeout(mountCM, expBackoff);
}

function selectTab(ev, newTitle) {
    const currentTitle = state.selected;
    state.selected = newTitle;
    for (const tab of state.tabs) {
        if (tab.title === currentTitle) { // save text back to state
            tab.text = element.codeMirrorEditor.getValue();
        } else if (tab.title === newTitle) {
            state.text = tab.text;
            console.log('setting value!');
        }
    }
    element.codeMirrorEditor.setValue(state.text);
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
                text = text.replace(/&#39;/g, "'"); // correct double escape
                state.tabs.push({text, title});
            } else {
                throw new Error('invalid fromlibrary:', title)
            }
        }
    } else if (props.text) {
        text = props.text.trim();
    }

    const demoType = props.demotype || 'snippet';
    if (demoType === 'snippet') {
        state.showclipboard = true;
    } else if (demoType === 'minipreview') {
        state.showpreview = true;
    }

    state.text = state.tabs[0].text; // load first

    if (demoType === 'tabpreview') {
        state.tabs = CODE_EDITOR_TABS;
    }

    state.selected = state.tabs[0].title; // set first as tab title
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

function doRun() {
    exCounter++;
    //console.log('There are ', exCounter, ' examples on this page. Gee!')
    const namespace = `e${exCounter}g${state.nscounter}`; // TODO: later do hot reloading using same loader
    state.nscounter++;
    const loadOpts = {src: '', namespace};
    const tagName = 'Example';
    let {text} = state;
    text = `<component name="${tagName}">${text}</template>`;
    const loader = new Modulo.Loader(null, {options: loadOpts});
    loader.loadString(text);
    const fullname = `${namespace}-${tagName}`;
    //const factory = Modulo.factoryInstances[fullname];
    const preview = `<${fullname}></${fullname}>`;
    state.preview = preview;
}

/*
function previewspotMount({el}) {
    element.previewSpot = el;
    if (!element.isMounted) {
        doRun(); // mount after first render
    }
}
*/

/*
const component = factory.createTestElement();
component.remove()
console.log(component);
element.previewSpot.innerHTML = '';
element.previewSpot.appendChild(component);
*/

