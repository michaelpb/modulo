const fs = require('fs');
const path = require('path');

const ModuloVM = require('./lib/ModuloVM');
const ModuloBrowser = require('./lib/ModuloBrowser');
const { ACTIONS, TERM, walkSync, findConfig, parseArgs, getAction, logStatusBar } = require('./lib/cliUtils');

const defaultConfig = require('./lib/defaultConfig');

let modulo = null;

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
    return config;
}


function doCommand(cliConfig, args) {
    let { command, positional, flags } = args;

    // Console log command right away, before loading anything
    console.log(TERM.LOGOLINE, command, TERM.RESET);

    // Configure (blocking)
    const config = getConfig(cliConfig, flags);
    const { verbose } = config
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

    let skipFlags = undefined;
    if (!command) {
        command = 'help';
        skipFlags = true;
    }


    /*
    if (!(command in modulo.commands) || 'h' in args.flags || 'help' in args.flags) {
        command = 'help';
    }
    */

    // For now, just doing a hardcoded SSG, until we refactor the old CLI code
    // to the new structure
    hackPrerender(config);
}

async function hackPrerender(config) {
    modBrowser = new ModuloBrowser(config);
    const files = walkSync(config.input, config);
    let count = 0;
    let copiesNeeded = 0;
    for (const file of files) {
        console.log('loading file', file);
        const relPath = path.relative(config.input, file);

        const action = getAction(file, config);
        if (action === ACTIONS.SKIP) {
            console.log('skipping:', file);
        } else if (action === ACTIONS.COPY) {
            console.log('copying:', file);
        } else if (action === ACTIONS.CUSTOM) {
            console.log('custom:', file);
        } else if (action === ACTIONS.GENERATE) {
            console.log('generate:', file);
            const html = await modBrowser.runAsync(file);
            const output = path.resolve(config.output, relPath);
            await fs.fsPromises.writeFile(output, html);
        }
        logStatusBar('HCKBLD', count, files.length);
        count++;
        /*
        break;
        */
    }
    modBrowser.close();

    /*
    if (positional.length > 1) {
        throw new Error('Only 1 file at a time for now')
    }
    const vm = new ModuloVM(config);
    vm.run(positional[0], () => {
        //console.log('this is innerHTML', vm.document.innerHTML);
    });
    */

}

let modBrowser = null;

function main(argv, shiftFirst=false) {
    const args = parseArgs(argv, shiftFirst);
    process.on('SIGINT', () => {
        /*
        if (modulo.commands._watcher) {
            modulo.commands._watcher.close(); // stop node-watch
        }
        if (modulo.commands._server) {
            modulo.commands._server.close(); // stop express #1
        }
        if (modulo.commands._serverSrc) {
            modulo.commands._serverSrc.close(); // stop express #2
        }
        */
        if (modBrowser) {
            modBrowser.close(() => process.exit(0));
        } else {
            process.exit(0);
        }
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

