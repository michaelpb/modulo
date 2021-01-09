const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');

// Very simple hacky way to do mocked web-components define
function webComponentsUpgrade(dom, el, cls, secondTime=false) {
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
    if (el.connectedCallback && !secondTime) {
        // console.log('connected callback for:', el.tagName);
        //setTimeout(() => {
        //}, 0);
        el.connectedCallback();
    }
}

function clearRequireCache(searchPath) {
    const path = pathlib.resolve(__dirname, searchPath);
    delete require.cache[path];
    // Just clear anyhting with Modulo
    for (const key of Object.keys(require.cache)) {
        if (key.includes('Modulo')) {
            // console.log('this is key', key);
            delete require.cache[key];
        }
    }
    //require.cache = {};
}

function setupModulo(path = null, includeDebugger = false, html = '') {
    let Modulo;
    clearRequireCache('../../src/Modulo.js');
    clearRequireCache('../../src/ModuloDebugger.js');
    if (includeDebugger) {
        Modulo = require('../../src/ModuloDebugger.js');
    } else {
        Modulo = require('../../src/Modulo.js');
    }
    const htmlCode = path ? fs.readFileSync(path, 'utf-8') : html;
    const dom = new JSDOM(htmlCode);
    Modulo.document = dom.window.document; // for easier testing
    Modulo.globals.window =  dom.window;
    Modulo.globals.document =  dom.window.document;
    Modulo.globals.mockConsole = [];
    const {mockConsole} = Modulo.globals;
    Modulo.globals.console = {log: mockConsole.push.bind(mockConsole)};
    Modulo.globals.DocumentFragment =  dom.window.DocumentFragment;
    Modulo.globals.mockRegistered = [];
    Modulo.globals.mockMounted = [];
    Modulo.globals.mockTimeouts = [];
    const {mockTimeouts} = Modulo.globals;
    const mockTOPush = (func, time) => mockTimeouts.push({func, time});
    Modulo.globals.setTimeout = mockTOPush;
    Modulo.globals.setInterval = mockTOPush;

    Modulo.globals.mockModifyFile = [];

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
                        let data = fs.readFileSync(fullPath, 'utf-8');
                        for (const func of Modulo.globals.mockModifyFile) {
                            data = func(fullPath, data);
                        }
                        callback(data);
                    }
                };
            },
        }
    };

    if (includeDebugger) {
        // monkey patch a call to refresh
        Modulo.globals.defineComponentCallback = (factory) => {
            for (const {el, cls} of Modulo.globals.mockMounted) {
                //webComponentsUpgrade(dom, el, cls, true);
                if (!cls.toString().includes('CustomComponent extends Modulo.Element')) {
                    continue;
                }
                const instance = new cls();
                if (instance.fullName !== factory.fullName) {
                    continue;
                }
                el.factory = factory; // update factory
            }
        };
    }

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

