const Modulo = require('./lib/ModuloNode');
const cliutils = require('./lib/utils');
const fs = require('fs');
const defaultConfig = require('./lib/defaultConfig');

let modulo = null;

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

function getConfig(cliConfig, flags) {
    // Using PORT is so it "does the right thing" on herokulike platforms
    const envFlags = {port: process.env.PORT};
    envFlags.host = envFlags.port ? '0.0.0.0' : undefined;
    const shortFlags = {port: flags.p, host: flags.a, verbose: flags.v};

    // Finally, generate the config "stack", with items at the end taking
    // precedent over items at the top.
    return Object.assign(
        {},
        defaultConfig,
        cliConfig,
        envFlags,
        shortFlags,
        flags,
    );
}


function doCommand(cliConfig, args) {
    modulo = new Modulo();
    let {command, positional, flags} = args;

    const config = getConfig(cliConfig, flags);
    const preloadFiles = (cliConfig.preload || []).concat(positional || []);
    modulo.preloadQueue = new modulo.FetchQueue();
    for (let filePath of preloadFiles) {
        if (filePath === '-') {
            filePath = 0; // load from stdin, which has FD=0
        }
        modulo.preloadQueue.enqueue(filePath, source => {
            modulo.loadText(source);
        });
    }

    modulo.preloadQueue.wait(() => {
        //modulo.loadText(require('./lib/testdata').TEST_HTML);
        modulo.defineAll(config);

        if (!command) {
            command = 'help';
        }
        if (!(command in modulo.commands) || 'h' in args.flags || 'help' in args.flags) {
            command = 'help';
        }
        console.log(cliutils.TERM.LOGOLINE, command, cliutils.TERM.RESET);
        modulo.fetchQ.wait(() => {
            modulo.commands[command](config, modulo);
        });
    })
}

function main(argv, shiftFirst=false) {
    const args = cliutils.parseArgs(argv, shiftFirst);
    findConfig(args, doCommand);
}

function getModuloInstance() {
    return modulo;
}

if (require.main === module) {
    main(process.argv, true);
}

module.exports = {
    doCommand,
    findConfig,
    getModuloInstance,
    main,
};

