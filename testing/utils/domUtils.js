const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');

// Very simple mocked web-components define
function webComponentsUpgrade(dom, el, cls) {
    // Manually "upgrading" the JSDOM element with the webcomponent
    console.log('mock upgrading', el);
    const instance = new cls();
    const allProps = Reflect.ownKeys(Reflect.getPrototypeOf(instance))
        .concat(Reflect.ownKeys(instance));
    for (const key of allProps) {
        if (instance[key] instanceof Function) {
            el[key] = instance[key].bind(el);
        } else {
            el[key] = instance[key];
        }
    }
    if (el.connectedCallback) {
        console.log('connected callback!');
        el.connectedCallback();
    }
}

function setupModulo(path = null) {
    const Modulo = require('../../src/Modulo');
    const htmlCode = path ? fs.readFileSync(path, 'utf-8') : '';
    const dom = new JSDOM(htmlCode);
    Modulo.document = dom.window.document; // for easier testing
    Modulo.globals.window =  dom.window;
    Modulo.globals.document =  dom.window.document;
    Modulo.globals.DocumentFragment =  dom.window.DocumentFragment;
    Modulo.globals.mockRegistered = [];
    Modulo.globals.mockMounted = [];
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

