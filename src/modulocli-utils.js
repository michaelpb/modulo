const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');
const {DOMParser} = require('xmldom');

function exitErr(message) {
    console.warn(message);
    process.exit(1);
}

function assert(value, ...info) {
    if (!value) {
        exitErr(`ERROR: ${Array.from(info).join(' ')}`);
    }
}

function parseArgs(argArray) {
    argArray.shift(); // always get rid of first argument
    if (argArray[0].endsWith('modulocli.js')) {
        argArray.shift(); // shift again, if necessary
    }
    const args = {flags: {}, positional: [], command: null};
    let currentFlag = null;
    for (const arg of argArray) {
        if (arg.startsWith('-')) {
            if (currentFlag) {
                args.flags[currentFlag] = true;
            }
            if (arg.startsWith('--')) {
                currentFlag = arg.slice(2);

                if (arg.includes('=')) {
                    const [name, value] = arg.split('=');
                    currentFlag = null;
                    args.flags[name] = value;
                }
            } else {
                currentFlag = null;
                for (const singleChar of arg.split('')) {
                    args.flags[singleChar] = true;
                }
            }
        } else if (currentFlag) {
            args.flags[currentFlag] = arg;
            currentFlag = null;
        } else if (args.command === null) {
            args.command = arg;
        } else {
            args.positional.push(arg);
        }
    }
    return args;
}

function checkArgs(args, commands) {
    // presently no-op
    const options = Object.keys(commands).join(' or ');
    const cmd = Array.from(process.argv).join(' ');
    if (args.command) {
        if (!(args.command in commands)) {
            exitErr(`Unknown: '${args.command}' (Expected: ${options})`);
        }
    } else {
        exitErr(`Usage: ${cmd} [${options}]`);
    }
}

function loadModuloDocument(path) {
    /*
      Very hacky function to load Modulo and mock set it up with a path to
      a given HTML file. The JSDOM document is returned.
    */
    return setupModulo(path);

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
        if (includeDebugger) {
            Modulo = require('./ModuloDebugger.js');
        } else {
            Modulo = require('./Modulo.js');
        }
        const htmlCode = path ? fs.readFileSync(path, 'utf-8') : html;
        const dom = new JSDOM(htmlCode);
        Modulo.document = dom.window.document; // for easier testing
        Modulo.globals.DOMParser = DOMParser;
        Modulo.globals.HTMLElement.prototype.getAttribute = a => 'XYZYX getAttribute plcholder hack';
        Modulo.globals.HTMLElement.prototype.hasChildNodes = a => false; // HACK
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
}

function walkSync(basePath) {
    const results = [];
    const bareFileNames = fs.readdirSync(basePath);
    for (const baseName of bareFileNames) {
        file = basePath + '/' + baseName;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkSync(file));
        } else {
            results.push(file);
        }
    }
    return results;
}

module.exports = {
  assert,
  checkArgs,
  parseArgs,
  walkSync,
}
