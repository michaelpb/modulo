const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');
const {DOMParser} = require('xmldom');

const ssgStore = {};

function exitErr(message) {
    console.warn(message);
    process.exit(1);
}

function assert(value, ...info) {
    if (!value) {
        exitErr(`ERROR: ${Array.from(info).join(' ')}`);
    }
}

function parseArgs(argArray, shiftFirst=true) {
    if (shiftFirst) {
        argArray.shift(); // always get rid of first argument
    }
    if (argArray[0].endsWith('.js') || argArray[0].endsWith('modulocli')) {
        argArray.shift(); // shift again, if necessary
    }
    const flags = {};

    /*
    const confPath = process.env.MODCLI_CONF || './modulocli.json';
    let stat = null;
    try {
      const stat = fs.statSync(confPath); // throws Error if not found
    } catch {}

    if (stat && !stat.isDirectory()) {
        const jsonText = fs.readFileSync(confPath, 'utf-8');
        flags = JSON.parse(jsonText);
    }
    */

    const args = {flags, positional: [], command: null};
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

const readFileSyncCache = {};
function cachedReadFileSync(fullPath) {
    if (!(fullPath in readFileSyncCache)) {
        readFileSyncCache[fullPath] = fs.readFileSync(fullPath, 'utf-8');
    }
    return readFileSyncCache[fullPath];
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

function patchModuloWithSSGFeatures(Modulo, path, subpath, outputPath) {
    Modulo.isBackend = true;
    Modulo.require = require;
    Modulo.ssgStore = ssgStore;

    Modulo.ssgCurrentPath = path.replace('//', '/'); // remove accidental double slashes
    Modulo.ssgCurrentOutputPath = outputPath.replace('//', '/'); // remove accidental double slashes
    Modulo.ssgCurrentSubPath = subpath ? subpath.replace('//', '/') : null; // remove accidental double slashes

    Modulo.ssgSubPaths = null;
    Modulo.ssgRegisterSubPath = function (newFilePath) {
        if (!Modulo.ssgSubPaths) {
            Modulo.ssgSubPaths = [];
        }
        Modulo.ssgSubPaths.push(newFilePath);
    }

    /*
    // Reconsider these features. Only include in core modulo if has space
    const {factoryCallback} = Modulo.cparts.script;
    Modulo.cparts.script.factoryCallback = (partOptions, factory, renderObj) => {
        const results = factoryCallback(partOptions, factory, renderObj);
        const {exports} = results;
        if (exports) {
            element.setAttribute('script-exports', JSON.stringify(exports));
        }
        return results;
    };
    */
}

function loadModuloDocument(path, html, subpath=null, rootPath=null, outputPath=null) {
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

        // Get every prototype key
        const allKeys = [];
        for (const proto of protos) {
            allKeys.push(...Reflect.ownKeys(proto));
        }

        // Loop through binding functions to element
        for (const key of allKeys) {
            if (instance[key] instanceof Function) {
                el[key] = instance[key].bind(el);
            } else {
                el[key] = instance[key];
            }
        }

        // "Re-initialize" so we get innerHTML etc
        if (el.lifecycle) { // Is a modulo Element
            el.initialize();
        }

        if (el.connectedCallback && !secondTime) {
            // console.log('connected callback for:', el.tagName);
            //setTimeout(() => {
            //}, 0);
            el.connectedCallback();
        }
    }

    function makeMockStorage() {
        const map = new Map();
        map.getItem = map.get.bind(map);
        map.setItem = map.set.bind(map);
        return map;
    }

    function setupModulo(path = null, includeDebugger = false, html = '') {
        let Modulo;
        if (includeDebugger) {
            Modulo = require('../src/ModuloDebugger.js');
        } else {
            Modulo = require('../src/Modulo.js');
        }

        let htmlCode = html;
        if (html === '') {
            htmlCode = fs.readFileSync(path, 'utf-8');
        }

        const dom = new JSDOM(htmlCode);
        if (includeRequire) {
            patchModuloWithSSGFeatures(Modulo, path, subpath, outputPath);
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
        Modulo.globals.localStorage = makeMockStorage();
        Modulo.globals.sessionStorage = makeMockStorage();

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
            // TODO: Eventually just implement a backend version of FetchQueue
            // (FetchQueueNode) that uses fs.readFile instead of fetch
            const rootDir = rootPath || pathlib.dirname(path);
            const fullPath = pathlib.join(rootDir, url);
            //console.log('this is rootDir', rootDir, url, fullPath);
            const response = {
                text: () => {},
                // later, can add "json" that just sets a var
            };
            return {
                then: callback => {
                    callback(response);
                    return {
                        then: callback => {
                            //let data = fs.readFileSync(fullPath, 'utf-8');
                            let data = cachedReadFileSync(fullPath);
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
                    if (el.hasAttribute('modulo-ssg-skip')) {
                        continue;
                    }
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
        // $mypath/ -- eventually use for backend
        if (baseName.startsWith('_') || baseName.startsWith('.') ||
                                        baseName.startsWith('$')) {
            console.log('(Skipping: ', file, ')');
            continue;
        }
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

function ifDifferent(inputPath, outputPath, callbackSuccess, cbFailure) {
    fs.stat(inputPath, (err1, inputStats) => fs.stat(outputPath, (err2, outputStats) => {
        let shouldCopy = false;
        if (err1 || err2 || !inputStats || !outputStats) {
            shouldCopy = true; // if doesn't exist or inaccessible
        } else if (String(inputStats.mtime) !== String(outputStats.mtime)) {
            shouldCopy = true;
        }
        if (shouldCopy) {
            callbackSuccess(inputStats, outputStats);
        } else if (cbFailure) {
            cbFailure(inputStats, outputStats);
        }
        /*else if (inputStats.size !== outputStats.size) { shouldCopy = true; }*/
    }));
}

function copyIfDifferentDeadCode(inputPath, outputPath, callback) {
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

function copyIfDifferent(inputPath, outputPath, callback) {
    ifDifferent(inputPath, outputPath, (inputStats) => {
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
    });
}

function renderModuloHtml(rootPath, inputPath, outputPath, callback) {
    fs.readFile(inputPath, (err, inputContents) => {
        if (err) {
            console.error('ERROR', err);
            return;
        }

        const Modulo = loadModuloDocument(inputPath, inputContents, null, rootPath, outputPath);
        const {document, ssgSubPaths} = Modulo;
        let html = document.documentElement.innerHTML;
        if (!html.toUpperCase().startsWith('<!DOCTYPE HTML>')) {
            // generating "quirks mode" document, do not want
            html = '<!DOCTYPE HTML>' + html;
        }
        fs.writeFile(outputPath, html, {encoding: 'utf8'}, err => {
            if (err) {
                console.error('ERROR', err);
            } else if (callback) {
                callback(ssgSubPaths, inputContents);
            }
        });
    });
}

function renderModuloHtmlForSubpath(rootPath, inputContents, inputPath, outputPath, callback) {
    console.log('loadModuloDocument', inputPath, outputPath, rootPath);
    const {document} = loadModuloDocument(inputPath, inputContents, outputPath, rootPath, outputPath);
    let html = document.documentElement.innerHTML;
    if (!html.toUpperCase().startsWith('<!DOCTYPE HTML>')) {
        // generating "quirks mode" document, do not want
        html = '<!DOCTYPE HTML>' + html;
    }
    fs.writeFile(outputPath, html, {encoding: 'utf8'}, err => {
        if (err) { console.error('ERROR', err);
        } else if (callback) { callback(); }
    });
}


const TERM = {
    MAGENTA_BG: '\x1b[45m',

    BLACK_FG: '\x1b[30m',
    MAGENTA_FG: '\x1b[35m',
    RED_FG: '\x1b[31m',
    GREEN_FG: '\x1b[32m',
    YELLOW_FG: '\x1b[33m',
    BLUE_FG: '\x1b[34m',

    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    UNDERSCORE: '\x1b[4m',
};
TERM.LOGO = TERM.MAGENTA_FG + '[%]' + TERM.RESET;
TERM.LOGOLINE = TERM.MAGENTA_FG + '[%]' + TERM.RESET + TERM.UNDERSCORE;

module.exports = {
    assert,
    checkArgs,
    ifDifferent,
    copyIfDifferent,
    mkdirToContain,
    parseArgs,
    renderModuloHtml,
    renderModuloHtmlForSubpath,
    walkSync,
    patchModuloWithSSGFeatures,
    TERM,
}
