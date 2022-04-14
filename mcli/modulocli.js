const ModuloVM = require('./lib/ModuloVM'); // HappyDOM-based
const ModuloBrowser = require('./lib/ModuloBrowser'); // Puppeteer-based
const { TERM, findConfig, parseArgs } = require('./lib/cliUtils');

const defaultConfig = require('./lib/defaultConfig');
const cliCommands = require('./cliCommands');

let moduloWrapper = null;

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
    if (!(command in cliCommands) || 'h' in args.flags || 'help' in args.flags) {
        if (command) {
            console.log(`Warning: Showing help, since ${command} was not found`);
        }
        command = 'help';
    }
    console.log(TERM.LOGOLINE, command, TERM.RESET);

    // Configure (blocking)
    const config = getConfig(cliConfig, flags);

    // Then start a browser, and hand it off to the command
    moduloWrapper = new ModuloBrowser(config);
    cliCommands[command](moduloWrapper, config, args);
}


function main(argv, shiftFirst=false) {
    const args = parseArgs(argv, shiftFirst);
    process.on('SIGINT', () => {
        if (moduloWrapper) {
            moduloWrapper.close(() => process.exit(0));
        } else {
            process.exit(0);
        }
    });
    findConfig(args, doCommand);
}

if (require.main === module) {
    main(process.argv, true);
}

module.exports = {
    doCommand,
    main,
};

