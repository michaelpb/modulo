let componentTexts = null;
let componentTexts2 = null;
let exCounter = 0; // global variable

//console.log('this is demo.js');

function _setupGlobalVariables() {
    // TODO: Refactor this, obvs
    // Get text from the two example component libraries
    //console.log('this is registered Modulo instances', Object.keys(Modulo.factoryInstances));
    try {
        componentTexts = Modulo.factoryInstances['eg-eg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts:', err);
        componentTexts = null;
    }

    try {
        componentTexts2 = Modulo.factoryInstances['docseg-docseg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts2:', err);
        componentTexts2 = null;
    }

    if (componentTexts) {
        componentTexts = Object.assign({}, componentTexts, componentTexts2);
    }
}

function tmpGetDirectives() {
    return [ 'script.codemirror' ];
}

function codemirrorMount({ el }) {
    //console.log('codeMirrorMount', { el });
    el.innerHTML = ''; // clear inner HTML before mounting
    const demoType = props.demotype || 'snippet';
    //_setupCodemirror(el, demoType, element, state);
    _setupCodemirrorSync(el, demoType, element, state);
}

function _setupCodemirrorSync(el, demoType, myElement, myState) {
      let readOnly = false;
      let lineNumbers = true;
      if (demoType === 'snippet') {
          readOnly = true;
          lineNumbers = false;
      }

      const conf = {
          value: myState.text,
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
      }

      if (!myElement.codeMirrorEditor) {
          myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
      }
      myElement.codeMirrorEditor.refresh()
}

function _setupCodemirror(el, demoType, myElement, myState) {
    //console.log('_setupCodemirror DISABLED'); return; ///////////////////
    let expBackoff = 10;
    //console.log('this is codemirror', Modulo.globals.CodeMirror);
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
            value: myState.text,
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
        }

        if (!myElement.codeMirrorEditor) {
            myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
        }
        myElement.codeMirrorEditor.refresh()
        //myElement.rerender();
    };
    mountCM();
    return;
    const {isBackend} = Modulo;
    if (!isBackend) {
        // TODO: Ugly hack, need better tools for working with legacy
        setTimeout(mountCM, expBackoff);
    }
}

function selectTab(newTitle) {
    //console.log('tab getting selected!', newTitle);
    if (!element.codeMirrorEditor) {
        return; // not ready yet
    }
    const currentTitle = state.selected;
    state.selected = newTitle;
    for (const tab of state.tabs) {
        if (tab.title === currentTitle) { // save text back to state
            tab.text = element.codeMirrorEditor.getValue();
        } else if (tab.title === newTitle) {
            state.text = tab.text;
        }
    }
    element.codeMirrorEditor.setValue(state.text);
    doRun();
}

function doCopy() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (!mod || !mod.script || !mod.script.copyTextToClipboard) {
        console.log('no mod!');
    } else {
        mod.script.copyTextToClipboard(state.text);
    }
}

function initializedCallback() {
    console.log('initializedCallback');
    if (componentTexts === null) {
        _setupGlobalVariables();
    }

    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            componentTexts = false;
            throw new Error('Couldnt load:', props.fromlibrary)
        }

        const componentNames = props.fromlibrary.split(',');
        for (const title of componentNames) {
            if (title in componentTexts) {
                text = componentTexts[title].trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                state.tabs.push({ text, title });
            } else {
                console.error('invalid fromlibrary:', title);
                console.log(componentTexts);
                return;
            }
        }
    } else if (props.text) {
        let title = props.ttitle || 'Example';
        text = props.text.trim();
        state.tabs.push({title, text});
        // hack -v
        if (props.text2) {
            title = props.ttitle2 || 'Example';
            text = props.text2.trim();
            state.tabs.push({title, text});
        }
        if (props.text3) {
            title = props.ttitle3 || 'Example';
            text = props.text3.trim();
            state.tabs.push({title, text});
        }
        //console.log('this is props', props);
    }

    const demoType = props.demotype || 'snippet';
    if (demoType === 'snippet') {
        state.showclipboard = true;
    } else if (demoType === 'minipreview') {
        state.showpreview = true;
    }

    state.text = state.tabs[0].text; // load first

    state.selected = state.tabs[0].title; // set first as tab title
    //setupShaChecksum();
    if (demoType === 'minipreview') {
        doRun();
    }

    const myElem = element;
    const myState = state;
    const {isBackend} = Modulo;
    return;
    if (!isBackend) {
        setTimeout(() => {
            const div = myElem.querySelector('.editor-wrapper > div');
            _setupCodemirror(div, demoType, myElem, myState);
        }, 0); // put on queue
    }
}

function doRun() {
    exCounter++;
    console.log('There are ', exCounter, ' examples on this page. Gee!')
    const namespace = `e${exCounter}g${state.nscounter}`; // TODO: later do hot reloading using same loader
    state.nscounter++;
    const attrs = { src: '', namespace };
    const tagName = 'Example';

    if (element.codeMirrorEditor) {
        state.text = element.codeMirrorEditor.getValue(); // make sure most up-to-date
    }
    let componentDef = state.text;
    componentDef = `<component name="${tagName}">\n${componentDef}\n</component>`;
    const loader = new Modulo.Loader(null, { attrs } );
    loader.loadString(componentDef);
    const fullname = `${namespace}-${tagName}`;
    const factory = Modulo.factoryInstances[fullname];
    state.preview = `<${fullname}></${fullname}>`;

    // Hacky way to mount, required due to buggy dom resolver
    const {isBackend} = Modulo;
    if (!isBackend) {
        setTimeout(() => {
            const div = element.querySelector('.editor-minipreview > div');
            if (div) {
                div.innerHTML = state.preview;
            } else {
                console.log('warning, cant update minipreview', div);
            }
        }, 0);
    }
}

function countUp() {
    // TODO: Remove this when resolution context bug is fixed so that children
    // no longer can reference parents
    console.count('PROBLEM: Child event bubbling to parent!');
}

function doFullscreen() {
    document.body.scrollTop = document.documentElement.scrollTop = 0;
    if (state.fullscreen) {
        state.fullscreen = false;
        document.querySelector('html').style.overflow = "auto";
        if (element.codeMirrorEditor) {
            element.codeMirrorEditor.refresh()
        }
    } else {
        state.fullscreen = true;
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        // TODO: way to share variables in CSS
        if (vw > 768) {
              document.querySelector('html').style.overflow = "hidden";
              if (element.codeMirrorEditor) {
                  element.codeMirrorEditor.refresh()
              }
        }
    }
    if (element.codeMirrorEditor) {
        //element.codeMirrorEditor.refresh()
    }
}

/*
function previewspotMount({ el }) {
    element.previewSpot = el;
    if (!element.isMounted) {
        doRun(); // mount after first render
    }
}


function setupShaChecksum() {
    console.log('setupShaChecksum DISABLED'); return; ///////////////////

    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (Modulo.isBackend && state && state.text.includes('$modulojs_sha384_checksum$')) {
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
*/

/*
const component = factory.createTestElement();
component.remove()
console.log(component);
element.previewSpot.innerHTML = '';
element.previewSpot.appendChild(component);
*/

