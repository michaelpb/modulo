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

function copyIfDifferent(inputPath, outputPath, callback) {
    ifDifferent(inputPath, outputPath, (inputStats) => {
        mkdirToContain(outputPath);
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
    }, callback);
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
    //console.log('loadModuloDocument', inputPath, outputPath, rootPath);
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

function walkSync(basePath, config) {
    const {isSkip, verbose} = config;
    let results = [];
    const bareFileNames = fs.readdirSync(basePath);
    const regexp = new RegExp(isSkip);
    for (const baseName of bareFileNames) {
        file = basePath + '/' + baseName;
        if (regexp.test(baseName)) {
            if (verbose) {
                console.log('        (Skipping: ', file, ')');
            }
            continue;
        }
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkSync(file, config));
        } else {
            results.push(file);
        }
    }
    return results;
}

function doSSG(inputFile, outputFile) {
    mkdirToContain(outputFile);
    renderModuloHtml(rootPath, inputFile, outputFile, (subPaths, inputContents) => {
        console.log('RENDERED:', inputFile, '->', outputFile);
        if (subPaths) {
            console.log('         ', Array.from(inputFile.length).join(' '),
                        `-> NOTE: ${subPaths.length} subpaths`);
            for (const newFilePath of subPaths) {
                mkdirToContain(newFilePath);
                renderModuloHtmlForSubpath(rootPath,
                        inputContents, inputFile, newFilePath, () => {
                    console.log('RENDERED SUB-PATH:', inputFile, '->', newFilePath);
                });
            }
        }
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

function doGenerate(config, modulo, text, outputFile, callback) {
    // TODO: Clean up subpaths, probably remove
    const {
        newGlobalsBeforeGenerate,
        clearBeforeGenerate,
        verbose,
        inputFile,
    } = config;
    modulo.fetchPrefix = config.input;
    if (newGlobalsBeforeGenerate) {
        // TODO force reload Modulo.js & run main('generate', ...)
        throw new Error('newGlobalsBeforeGenerate: Not implemented yet');
    } else {
        //modulo.fetchQ.data = {}; // TODO: Need to figure out best times to clear
        if (clearBeforeGenerate) { // TODO: try with this disabled
            throw new Error('clearBeforeGenerate: Not implemented yet');
            modulo.clearAll(config);
        }
    }

    //modulo.fetchQ.data = {}; // Maybe do received callback here?
    modulo.loadText(text, inputFile);
    modulo.defineAll(config);

    modulo.fetchQ.wait(() => {

        modulo.resolveCustomComponents(config.ssgRenderDepth, () => {
            let html = modulo.getHTML();
            modulo.assert(html, 'Generate results cannot be falsy');

            mkdirToContain(outputFile); // todo, make async (?)
            fs.writeFile(outputFile, html, {encoding: 'utf8'}, err => {
                if (err) {
                    if (config.fail) {
                        throw err;
                    }
                    console.error('Modulo - writeFile ERROR: ', err);
                    console.error('(fail with --fail)');
                }
                callback();
                return;
                // DEAD CODE
                const {ssgSubPaths} = modulo.baseModulo; // TODO: Remove this, after <Docs> done
                if (verbose) {
                    const s = '' + ssgSubPaths;
                    console.log(`|%|  Document resolved; Subpaths: ${s}`);
                }
                if (ssgSubPaths && ssgSubPaths.length > 0) {
                    console.log(`   '-> Rendering subpaths: ${ssgSubPaths.length}`);
                    for (const subpath of ssgSubPaths) {
                        patchModuloWithSSGFeatures(modulo.baseModulo, inputFile, subpath, outputFile);
                        modulo.ssgSubPaths = null;
                        doGenerate(config, modulo, text, subpath);
                    }
                }
            });
        });
    });
}


module.exports = {
    assert,
    checkArgs,
    ifDifferent,
    copyIfDifferent,
    mkdirToContain,
    parseArgs,
    renderModuloHtml,
    renderModuloHtmlForSubpath,
    patchModuloWithSSGFeatures,
    TERM,
    doGenerate,
    walkSync,
}
