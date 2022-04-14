const fs = require('fs');
const path = require('path');

const {
    ACTIONS,
    TERM,
    walkSync,
    getAction,
    logStatusBar,
    copyIfDifferentAsync,
    copyAsync,
    ifDifferentAsync,
    mirrorMTimesAsync,
    mkdirToContain,
} = require('./lib/cliUtils');

function hackPostprocess(html) {
    // TODO: Remove in favor of a consistent treatment, once m.bundle() is done
    if (!/^<!doctype html>/i.test(html)) {
        // Ensure all documents start with doctype
        html = '<!DOCTYPE HTML>\n' + html;
    }

    // Inject hacky script after loading Modulo.js
    html = html.replace('<script src="/js/Modulo.js"></script>', `
        <meta charset="utf8" />
        <script src="/js/Modulo.js"></script>
        <script>
        if (!Modulo.fetchQ) {
            Modulo.fetchQ = new Modulo.FetchQueue();
            Modulo.assets = new Modulo.AssetManager();
        }
        window.onload = () => {
            Modulo.fetchQ.wait(() => {
                Modulo.defineAll();
            });
        };
        </script>
    `);
    return html;
}

async function doGenerate(moduloWrapper, config) {
    const { inputFile, outputFile, verbose, force } = config;
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
    const action = getAction(inputFile, config);
    const inputRelPath = path.relative('.', inputFile);
    const outputRelPath = path.relative('.', outputFile);
    if (action === ACTIONS.SKIP) {
        log('SKIPPING ' + inputRelPath);
        return false;
    }

    if (!force) {
        const isDifferent = await ifDifferentAsync(inputFile, outputFile);
        if (!isDifferent) {
            log('(SAME)   ' + inputRelPath + ' -> ' + outputRelPath);
            return false;
        }
    }

    // Not skipping, doing COPY, CUSTOM, or GENERATE
    if (action === ACTIONS.COPY) {
        log('COPY     ' + inputRelPath + ' -> ' + outputRelPath);
        try {
            await fs.promises.chmod(outputFile, 0777); // unlock, if exists
        } catch {
            log('Could not unlock ' + outputFile);
        }
        await fs.promises.copyFile(inputFile, outputFile);
    } else if (action === ACTIONS.CUSTOM) {
        log('CUSTOM   ' + inputRelPath + ' -> ' + outputRelPath);
        throw new Error('Custom inputFile generators not implemented');
    } else if (action === ACTIONS.GENERATE) {
        log('GENERATE ' + inputRelPath + ' -> ' + outputRelPath);
        let html = await moduloWrapper.runAsync(inputFile);
        html = hackPostprocess(html);
        mkdirToContain(outputFile);
        try {
            await fs.promises.chmod(outputFile, 0777); // unlock, if exists
        } catch {
            log('Could not unlock ' + outputFile);
        }
        await fs.promises.writeFile(outputFile, html, 'utf8');
    } else {
        throw new Error('Invalid action');
    }

    await mirrorMTimesAsync(inputFile, outputFile);
    return true;
}

async function generate(moduloWrapper, config) {
    const { input, inputFile, output, verbose, generateCheckDeps } = config;
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

    // Calculate relative outputFile to inputFile
    const relPath = path.relative(input, inputFile);
    const outputFile = path.resolve(output, relPath);

    // Prep conf and then do generate action
    const conf = Object.assign({}, config, { outputFile });
    const didGenerate = await doGenerate(moduloWrapper, conf);
    if (!generateCheckDeps || !didGenerate) {
        return;
    }

    // Now check for dependencies, and regenerate those
    const deps = moduloWrapper.getDependencies;
    log(`GENERATE: Found ${deps.length} dependencies for ${inputFile}`);
    for (const outputRelPath of deps) {
        const outputFile = path.resolve(output, outputRelPath);
        const conf = Object.assign({}, config, { outputFile });
        await doGenerate(moduloWrapper, conf);
    }
}

async function fullssg(moduloWrapper, config) {
    const files = walkSync(config.input, config);
    let count = 0;
    for (const inputFile of files) {
        const extra = { inputFile, generateCheckDeps: false };
        const conf = Object.assign({}, config, extra);
        await generate(moduloWrapper, conf);
        logStatusBar('FULLSSG', count, files.length);
        count++;
    }
    moduloWrapper.close();
}

async function watch(moduloWrapper, config) {
    await fullssg(moduloWrapper, config);
    await doWatch(moduloWrapper, config);
}

async function doWatch(moduloWrapper, config) {
    const {isSkip, isCopyOnly, isGenerate, verbose, input, output} = config;
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
    const nodeWatch = require('node-watch');

    const shouldSkip = new RegExp(isSkip, 'i');
    log(`Skipping all that match: ${shouldSkip}`);

    const filter = (f, skip) => (shouldSkip.test(f) ? skip : true);
    const watchConf = { recursive: true, filter };

    let _fileLocks = {};
    const watcher = nodeWatch(input, watchConf, (evt, inputFile) => {
        if (_fileLocks[inputFile]) { // not sure if necessary
            log(`${evt} detected in ${inputFile}, but already rebuilding`);
            return;
        } else {
            log(`${evt} detected in ${inputFile}`);
        }

        if (evt === 'update') {
            // on create or modify
            const conf = Object.assign({}, config, { inputFile });
            _fileLocks[inputFile] = true;
            generate(moduloWrapper, conf)
              .then(() => {
                  _fileLocks[inputFile] = false;
              });
        } else if (evt === 'remove') {
            // on delete
            console.log('Would be deleting: ')
            // fs.unlink(inputFile);
        }
    });

    // Add some verbose logging
    watcher.on('error', err => log(`Watch Error: ${err}`));
    log(`Starting watch of: ${config.input}`);
    //watcher.on('ready', callback);
}


function help(moduloWrapper, config, args) {
    let { command, flags } = args;
    console.log('Usage:   modulocli CMD [--flag(s)]\n');
    console.log('Example: modulocli ssg --input ./src/ --output ./public/\n');
    console.log('Available commands:');
    for (const key of Object.keys(module.exports)) {
        console.log(TERM.BRIGHT, `    ${key}`, TERM.RESET);
    }

    if (!('help' !== command || 'h' in args.flags || 'help' in args.flags)) {
        if (skipFlags) {
            console.log('\nHint: Try "modulocli help" for help on flags\n');
        }
        return; // do not show flag help during error invocation
    }

    console.log('\n\nAvailable flags & their defaults:');
    const defaultConfigSrc = fs.readFileSync(__dirname + '/lib/defaultConfig.js', 'utf8');
    let inHelp = false;
    for (let line of defaultConfigSrc.split('\n')) {
        if (line.includes('(STARTHELP)')) {
            inHelp = true;
        } else if (line.includes('(ENDHELP)')) {
            inHelp = false;
        } else if (inHelp) {
            if (line.trim().startsWith('/')) {
                const indent = '        ';
                line = line.replace(/^\s*\/\//, indent);
            } else if (line.includes(':')) {
                const indent = '    --';
                line = line.replace(/^\s*/, indent);
                line = line.replace(/:\s*['"]?/, '=');
                line = line.replace(/['"]?,\s*$/, '');
                line = `${TERM.BRIGHT}${line}${TERM.RESET}`;
            }
            console.log(line);
        }
    }

    console.log('\n\nAll above settings can be specified in one of 3 places:')
    console.log('    1) ./modulo.json    (path can be changed with MODULO_CONF env var)')
    console.log('    2) ./package.json   (will look under a "modulo" key)')
    console.log('    3) As a CLI flag    (using above "--ouput=/docs" style syntax)')
    console.log('For the greatest control, specify a JSON file (1 or 2)')

    console.log('\nFull documentation is on the World Wide Web:    https://modulojs.org', "\n")
}

module.exports = {
    help,
    fullssg,
    watch,
    generate,
}
