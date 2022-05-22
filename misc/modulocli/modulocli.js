const fs = require('fs');
const path = require('path');

const Modulo = require('./lib/ModuloNode');
const cliutils = require('./lib/utils');

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
    // Allow -p, -a, and -v as short-flags from CLI (but not conf):
    const shortFlags = {port: flags.p, host: flags.a, verbose: flags.v};

    const pushKey = { preload: true };

    // Finally, generate the config "stack", with items at the end taking
    // precedent over items at the top.
    const runtimeConfig = [envFlags, shortFlags, flags];
    const config = Object.assign({}, defaultConfig, cliConfig);
    for (const key of Object.keys(defaultConfig)) {
        for (const conf of runtimeConfig) {
            if (key in conf && conf[key] !== undefined) {
                if (key in pushKey) {
                    if (!Array.isArray(conf[key])) {
                        conf[key] = [conf[key]]; // ensure in arr
                    }
                    config[key].push(...conf[key]); // extend list
                } else {
                    config[key] = conf[key];
                }
            }
        }
    }

    // TODO: With this implementation, defaultConfig must include all flags
    // before preload. Later, allow preload (eg of CParts, or management cmds)
    // to add new flags.  Expose registerDefaultConfig interface to preloaded
    // files, and then do a 2nd getConfig step after.
    return config;
}


function doCommand(cliConfig, args) {
    let {command, positional, flags} = args;

    // Console log command right away, before loading anything
    console.log(cliutils.TERM.LOGOLINE, command, cliutils.TERM.RESET);

    // Configure (blocking)
    const config = getConfig(cliConfig, flags);
    const {verbose} = config
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
    const { preload, testAllowPreload, tests } = config;
    if (command === 'test') {
        if (!testAllowPreload && preload) {
            preload.length = 0; // A bizarre but efficient way to empty an array
        }
    }
    preload.push(...(positional || [])); // add in positional args to the full preload

    modulo = Modulo.getOrCreate(config, 'preload');
    modulo.defineAll(); // do any initial defines, get globalLoader
    for (let filePath of preload) {
        let workingDir = null;
        if (filePath === '-') {
            throw new Error('STDIN unsupported: not implemented yet');
            filePath = 0; // Load from stdin, which has FD=0
        } else {
            workingDir = path.resolve(filePath, '../');
            filePath = path.basename(filePath);
        }

        modulo.fetchQ.enqueue(filePath, source => {
            log(`Preloading Modulo document ${filePath}`);
            modulo.loadText(source, workingDir + '/' + filePath);
            //console.log('...this is filepath', filePath );
            modulo.globalLoader.loadString(source, workingDir + '/' + filePath);
        }, workingDir);
    }

    // Wait for all promises to resolve (similar to allSettled, except will
    // wait for future ones as well)
    modulo.fetchQ.wait(() => {
        /*
        // Ensure fetchQ gets loaded as components as well
        for (const [path, data] of Object.entries(modulo.fetchQ.data)) {
            console.log('queue after path:', path);
            modulo.globalLoader.loadString(data);
        }
        modulo.defineAll(); // do any more defines
        */

        modulo.resolveCustomComponents(config.ssgRenderDepth, () => {
            let skipFlags = undefined;
            if (!command) {
                command = 'help';
                skipFlags = true;
            }
            if (!(command in modulo.commands) || 'h' in args.flags || 'help' in args.flags) {
                command = 'help';
            }
            modulo.fetchQ.wait(() => {
                modulo.commands[command](config, modulo, skipFlags);
            });
        });
    })
}

function main(argv, shiftFirst=false) {
    const args = cliutils.parseArgs(argv, shiftFirst);
    process.on('SIGINT', () => {
        if (modulo.commands._watcher) {
            modulo.commands._watcher.close(); // stop node-watch
        }
        if (modulo.commands._server) {
            modulo.commands._server.close(); // stop express #1
        }
        if (modulo.commands._serverSrc) {
            modulo.commands._serverSrc.close(); // stop express #2
        }
        process.exit(0);
    });
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

/*
// Previously, waited for "stabilized" HTML
//lastHTML = currentHTML;
//currentHTML = this.getHTML();
for (const el of Object.values(
this.customElements[instance.fullName] = el;
//const domNodes = this.doc.querySelector('
*/
