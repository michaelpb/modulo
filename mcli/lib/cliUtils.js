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

async function ifDifferentAsync(inputPath, outputPath) {
    let inputStats = null;
    let outputStats = null;
    let shouldCopy = false;
    try {
        outputStats = await fs.promises.stat(outputPath);
        inputStats = await fs.promises.stat(inputPath);
    } catch { }

    if (!inputStats || !outputStats) {
        shouldCopy = true; // if doesn't exist or inaccessible
    } else if (String(inputStats.mtime) !== String(outputStats.mtime)) {
        shouldCopy = true;
    }
    return [ shouldCopy, inputStats ];
}


async function copyIfDifferentAsync(inputPath, outputPath) {
    const [ shouldCopy, inputStats ] = await ifDifferentAsync(inputPath, outputPath);
    if (!shouldCopy) {
        return false;
    }
    mkdirToContain(outputPath);
    await fs.promises.copyFile(inputPath, outputPath);
    // Copy over mtime to new file
    if (inputStats) {
        await fs.promises.utimes(outputPath, inputStats.atime, inputStats.mtime);
    }
    return true;
}


const CONFIG_PATH = process.env.MODULO_CONFIG || './modulo.json';

function findConfig(args, callback) {
    if ('config' in args.flags) {
        if (args.flags.config === 'default') {
            callback({}, args);
            return;
        }

        fs.readFile(args.flags.config, 'utf8', (data, err) => {
            if (err) {
                console.log('Could not read path:', args.flags.config);
                throw err;
            }

            callback(JSON.parse(data), args);
        });
        return;
    }

    fs.readFile(CONFIG_PATH, 'utf8', (err1, data1) => {
        if (err1) {
            fs.readFile('./package.json', (err2, data2) => {
                if (err2) {
                    callback({}, args);
                } else {
                    const jsonData = JSON.parse(data2);
                    callback(jsonData.modulo || {}, args);
                }
            });
        } else {
            callback(JSON.parse(data1), args);
        }
    });
}


function walkSync(basePath, config) {
    const { isSkip, verbose } = config;
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

let lastStatusBar = '';

function logStatusBar(shoutyWord, finishedFiles, generateCount, maxCount=8) {
    const charCent = Math.round((finishedFiles / generateCount) * maxCount);
    const perCent = Math.round((finishedFiles / generateCount) * 100);
    const statusBar = '%'.repeat(charCent) + ' '.repeat(maxCount - charCent);
    const str = TERM.MAGENTA_FG + shoutyWord + TERM.RESET +
                    '  |' + statusBar + '|' + TERM.RESET + ` ${perCent}%`;
    if (lastStatusBar !== statusBar) { // never repeat the bars
        console.log(str);
    }
    lastStatusBar = statusBar;
}

const CUSTOM = 'CUSTOM';
const SKIP = 'SKIP';
const GENERATE = 'GENERATE';
const COPY = 'COPY';

const ACTIONS = { CUSTOM, SKIP, GENERATE, COPY };

function getAction(inputFile, config) {
    const { isGenerate, isSkip, isCopyOnly, isCustomFilter } = config;
    if (isCustomFilter && isCustomFilter(inputFile)) {
        return CUSTOM;  // isCustomFilter is a function checked against entire path
    }

    const check = (re, part) => (new RegExp(re, 'i').test(part));
    const contains = re => inputFile.split('/').find(part => check(re, part));
    if (contains(isSkip)) { // isSkip is applied to every path part
        return SKIP;
    }
    if (contains(isCopyOnly)) { // isCopyOnly is also applied to every path part
        return COPY;
    }


    if (check(isGenerate, inputFile)) { // isGenerate is applied to entire path
        return GENERATE;
    }
    return COPY; // default (i.e. copy every file from input -> output)
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
    ACTIONS,
    TERM,
    assert,
    ifDifferent,
    copyIfDifferent,
    copyIfDifferentAsync,
    mkdirToContain,
    parseArgs,
    findConfig,
    getAction,
    walkSync,
    logStatusBar,
}
