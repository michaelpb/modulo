const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');

// Very simple hacky way to do mocked web-components define
function webComponentsUpgrade(dom, el, cls) {
    // Manually "upgrading" the JSDOM element with the webcomponent
    const instance = new cls();
    const protos = [instance, Reflect.getPrototypeOf(instance)];
    if (!el.tagName.startsWith('MOD-')) {
        protos.push(Reflect.getPrototypeOf(protos[1]));
    }
    protos.reverse();
    const allKeys = [];
    for (const proto of protos) {
        allKeys.push(...Reflect.ownKeys(proto));
    }
    // console.log(el.tagName, 'this is all props', allKeys);
    for (const key of allKeys) {
        if (instance[key] instanceof Function) {
            el[key] = instance[key].bind(el);
        } else {
            el[key] = instance[key];
        }
    }
    if (el.connectedCallback) {
        // console.log('connected callback for:', el.tagName);
        //setTimeout(() => {
        //}, 0);
        el.connectedCallback();
    }
}

function clearRequireCache(searchPath) {
    const path = pathlib.resolve(__dirname, searchPath);
    delete require.cache[path];
}

function setupModulo(path = null, includeDebugger = false) {
    let Modulo;
    clearRequireCache('../../src/Modulo.js');
    clearRequireCache('../../src/ModuloDebugger.js');
    if (includeDebugger) {
        Modulo = require('../../src/ModuloDebugger.js');
    } else {
        Modulo = require('../../src/Modulo.js');
    }
    const htmlCode = path ? fs.readFileSync(path, 'utf-8') : '';
    const dom = new JSDOM(htmlCode);
    Modulo.document = dom.window.document; // for easier testing
    Modulo.globals.window =  dom.window;
    Modulo.globals.document =  dom.window.document;
    Modulo.globals.DocumentFragment =  dom.window.DocumentFragment;
    Modulo.globals.mockRegistered = [];
    Modulo.globals.mockMounted = [];
    Modulo.globals.mockTimeouts = [];
    const {mockTimeouts} = Modulo.globals;
    const mockTOPush = (func, time) => mockTimeouts.push({func, time});
    Modulo.globals.setTimeout = mockTOPush;
    Modulo.globals.setInterval = mockTOPush;
    Modulo.globals.MutationObserver = class {
        observe(el) {
            const {setAttribute} = el;
            el.setAttribute = (...args) => {
                //console.log('fake set attribute happening!', args);
                setAttribute.apply(el, args);
                el.attributeMutated();
            };
        }
    };
    Modulo.globals.fetch = url => {
        // Faked version of fetch
        const rootDir = pathlib.dirname(path);
        const fullPath = pathlib.join(rootDir, url);
        const response = {
            text: () => {},
            // later, can add "json" that just sets a var
        };
        return {
            then: callback => {
                callback(response);
                return {
                    then: callback => {
                        const data = fs.readFileSync(fullPath, 'utf-8');
                        callback(data);
                    }
                };
            },
        }
    };
    Modulo.globals.customElements = {
        define: (name, cls) => {
            const elements = dom.window.document.querySelectorAll(name);
            for (const el of elements) {
                webComponentsUpgrade(dom, el, cls);
                Modulo.globals.mockMounted.push({el, cls});
                //setTimeout(() => {
                //}, 0);
            }
            Modulo.globals.mockRegistered.push({name, cls});
        },
    };
    if (path) {
        Modulo.defineAll();
    }
    return Modulo;
}

const strip = string =>
    string.replace(/\s+/g, ' ').trim();

module.exports = {
    setupModulo,
    strip,
}

