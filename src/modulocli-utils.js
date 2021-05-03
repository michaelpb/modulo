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

function loadModuloDocument(path, html) {
    const includeRequire = true;
    /*
      Very hacky function to load Modulo and mock set it up with a path to
      a given HTML file. The JSDOM document is returned.
    */
    return setupModulo(path, false, html);

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

    function setupModulo(path = null, includeDebugger = false, html = '') {
        let Modulo;
        if (includeDebugger) {
            Modulo = require('./ModuloDebugger.js');
        } else {
            Modulo = require('./Modulo.js');
        }

        let htmlCode = html;
        if (html === '') {
            htmlCode = fs.readFileSync(path, 'utf-8');
        }

        const dom = new JSDOM(htmlCode);
        if (includeRequire) {
            Modulo.require = require; // for ssg
        }
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
                            /*
                            fs.readFile(fullPath, 'utf-8', (err, data) => {
                                if (err) {
                                    console.error('ERROR', err);
                                    return;
                                }
                                for (const func of Modulo.globals.mockModifyFile) {
                                    data = func(fullPath, data);
                                }
                                callback(data);
                            });
                            */
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
    let results = [];
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

function mkdirToContain(path) {
    const pathPrefix = path.slice(0, path.lastIndexOf('/'));
    const mkdirOpts = {
        mode: 0o777,
        recursive: true,
    };
    fs.mkdirSync(pathPrefix, mkdirOpts);
}

function copyIfDifferent(inputPath, outputPath, callback) {
    fs.stat(inputPath, (err1, inputStats) => fs.stat(outputPath,
        (err2, outputStats) => {
            let shouldCopy = false;
            if (err1 || err2 || !inputStats || !outputStats) {
                shouldCopy = true; // if doesn't exist or inaccessible
            } else if (inputStats.size !== outputStats.size) {
                shouldCopy = true;
            } else if (String(inputStats.mtime) !== String(outputStats.mtime)) {
                shouldCopy = true;
            }

            if (shouldCopy) {
                fs.copyFile(inputPath, outputPath, () => {
                    // Copy over mtime to new file
                    fs.utimes(outputPath, inputStats.atime, inputStats.mtime, (err) => {
                        if (err) {
                            console.error('ERROR', err);
                        } else if (callback) {
                            callback();
                        }
                    });
                });
            }
        })
    );
}

function renderModuloHtml(inputPath, outputPath, callback) {
    fs.readFile(inputPath, (err, inputContents) => {
        if (err) {
            console.error('ERROR', err);
            return;
        }
        const {document} = loadModuloDocument(inputPath, inputContents);
        const html = document.documentElement.innerHTML;
        fs.writeFile(outputPath, html, {encoding: 'utf8'}, err => {
            if (err) {
                console.error('ERROR', err);
            } else if (callback) {
                callback();
            }
        });
    });
}

module.exports = {
    assert,
    checkArgs,
    copyIfDifferent,
    mkdirToContain,
    parseArgs,
    renderModuloHtml,
    walkSync,
}
