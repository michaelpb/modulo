const baseModulo = require('./BaseModulo');
const {TERM, copyIfDifferent, doGenerate, mkdirToContain, walkSync} = require('./utils');
const util = require('util');
const path = require('path');
const fs = require('fs');

const inspect = Symbol.for('nodejs.util.inspect.custom');

const CUSTOM = 'CUSTOM';
const SKIP = 'SKIP';
const GENERATE = 'GENERATE';
const COPY = 'COPY';

let lastStatusBar = '';

/*
// TODO: Generalize /improve global lock to prevent simultaneous SSG
// builds
const filesToDelete = [outputFile];

// TODO #2: Set files to "readonly" after writing to prevent
// accidentally opening  outpput instead of input
// TODO: Generalize a "dependency" backwards to allow generate and
// delete to do partial builds
if (outputFile in (this.fileDependencies || {})) {
    filesToDelete.extend(this.fileDependencies[outputFile]);
}
for (const depPath of filesToDelete) {
}
*/
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

function _removeKeyPrefix(data, prefix1, prefix2) {
    // take that, rule of 3! this is only 2, so iz gud code
    const newObj = {};
    for (let [key, value] of Object.entries(data)) {
        if (key.startsWith(prefix1)) {
            key = key.substr(prefix1.length);
        } else if (key.startsWith(prefix2)) {
            key = key.substr(prefix2.length);
        }
        newObj[key] = value;
    }
    return newObj;
}

function _getModuloMiddleware(config, express) {
    let {
        serverAutoFixSlashes,
        serverAutoFixExtensions,
        serverSetNoCache,
        verbose,
    } = config;
    const log = msg => verbose ? console.log(`|%| - - SERVER: ${msg}`) : null;
    if (serverAutoFixExtensions === true) {
        serverAutoFixExtensions = ['html'];
    }
    const staticSettings = {
        maxAge: 0,
        redirect: serverAutoFixSlashes,
        extensions: serverAutoFixExtensions,
    };
    const staticMiddleware = express.static(config.output, staticSettings);
    log(`Express Static middleware options: ${staticSettings}`);
    return (req, res, next) => {
        if (serverSetNoCache) {
            res.set('Cache-Control', 'no-store');
        }
        log(`${req.method} ${req.url}`);
        staticMiddleware(req, res, next);

        // TODO: Add in "/$username/" style wildcard matches, auto .html
        //       prefixing, etc before static. Behavior is simple:
        //       $username becomes Modulo.route.username for any generates
        //       within this dir (or something similar)
        //this._app.use(this.wildcardPatchMiddleware);
    };
}


class CommandMenuNode extends baseModulo.CommandMenu {
    _getCmds() {
        // not elegant -v
        const properties = Object.getOwnPropertyNames(this.__proto__).concat(
            Object.getOwnPropertyNames(this.__proto__.__proto__))
        // (because of use of proto, there are dupes, need to use set to dedupe)
        const uniqueProps = new Set(properties.filter(name =>
            (!name.startsWith('_') && name !== 'constructor')));
        const list = Array.from(uniqueProps);
        list.sort(); // keep alphabetical
        return list;
    }

    help(config, modulo, skipFlags=false) {
        let prefix = 'm.';
        if (!this._repl) {
            prefix = '';
            console.log('Usage:   modulocli CMD [preload(s)] [--flag(s)]\n');
            console.log('Example: modulocli ssg --input ./src/ --output ./public/\n');
        }
        console.log('Available commands:');
        for (const key of this._getCmds()) {
            console.log(TERM.BRIGHT, `    ${prefix}${key}`, TERM.RESET);
        }

        if (this._repl || skipFlags) {
            if (skipFlags) {
                console.log('\nHint: Try "modulocli help" for help on flags\n');
            }
            return; // do not show flag help during repl
        }

        console.log('\n\nAvailable flags & their defaults:');
        const defaultConfigSrc = fs.readFileSync(__dirname + '/defaultConfig.js', 'utf8');
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

    [inspect]() {
        let cmdList = this._getCmds().join(', ');
        if (this._repl) {
            if (cmdList.length > 70) {
                cmdList = cmdList.slice(0, 70) + '...';
            }
            return '    \'> - - ' + cmdList;
        } else {
            return `Modulo.CommandMenuNode<${cmdList}>`;
        }
    }

    shell(config, modulo) {
        const repl = require('repl');
        console.log(TERM.LOGO, 'Modulo Node.js REPL activated. Type m to see commands.');
        this._repl = repl.start('[%] ', process.stdin);

        // TODO: Loop through "m." and replace with wrapped getters, that
        // auto-include config and modulo args

        // REPL requires you to make globals read-only, as such:
        const _ro = value => ({value, configurable: false, enmerable: true});
        Object.defineProperty(this._repl.context, 'modulo', _ro(modulo));
        Object.defineProperty(this._repl.context, 'config', _ro(config));
        Object.defineProperty(this._repl.context, 'm', _ro(this));
    }

    _matchGenerateAction(config, modulo, inputFile) {
        const {isGenerate, isSkip, isCopyOnly, isCustomFilter} = config;
        if (isCustomFilter && isCustomFilter(inputFile)) {
            return CUSTOM;  // isCustomFilter is a function checked against entire path
        }

        // Skip the preload artifact, since that gets post-processed
        // away anyway
        if (this._isPreloadBuild(modulo, config, inputFile)) {
            return SKIP;
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

    generate(config, preloadModulo, finalCallback) {
        const callback = () => {
            if (finalCallback) {
                finalCallback(action);
            }
        }
        const {inputFile, outputFile, verbose, isCustomFunc} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

        const ModuloNode = require('./ModuloNode'); // TODO HACK, fix after refactor
        const modulo = ModuloNode.getOrCreate(config, inputFile);

        // Generate a single file
        let action = this._matchGenerateAction(config, modulo, inputFile);
        if (action === CUSTOM) {
            if (verbose) {
                console.log(`|%| - - Custom ${inputFile}`);
            }
            action = isCustomFunc(config, modulo);
            if (!action) {
                return;
            }
        }

        if (action === SKIP) {
            log(`Skip ${inputFile}`);
            callback();
        } else if (action === GENERATE) {
            log(`Generate ${inputFile} -> ${outputFile}`);
            // Get file while assigning prefix to be input directory
            const src = inputFile.replace(config.input, '');
            modulo.fetchPrefix = config.input;
            modulo.fetchFile(src)
                .then(response => response.text())
                .then(text => doGenerate(config, modulo, text, outputFile, callback));
        } else if (action === COPY) {
            log(`Copy ${inputFile} -> ${outputFile}`);
            copyIfDifferent(inputFile, outputFile, callback);
        } else {
            modulo.assert(false, `Invalid "action" (from CustomFunc?): ${action}`);
        }
    }

    build(config, modulo, allowEmpty=false, justBuildPath=false) {
        // NOTE: build is synchronous
        // TODO: Watch out, key order might not be stable, affect hash
        const {preloadQueue, fetchQ} = modulo;
        const preloadData = _removeKeyPrefix(preloadQueue.data, config.input);
        const fetchData = _removeKeyPrefix(fetchQ.data, config.input);
        const allData = Object.assign({}, preloadData, fetchData);
        const dataStr = JSON.stringify(allData);

        if (!allowEmpty) {
            modulo.assert(dataStr !== '{}', `No components (none loaded?)`);
        }
        const hash = modulo.utils.hash(dataStr);
        const {input, output, verbose, buildOutput} = config;
        if (verbose) {
            console.log(` \`> - - Compiled: ${hash}`);
        }

        const d = new Date();
        const versiondate = `${d.getYear()}.${(d.getMonth() + 1)}`
        const filePathCtx = {input, output, versiondate, hash};
        const buildOutputTmpl = new modulo.templating.MTL(buildOutput);
        const targetPath = buildOutputTmpl.render(filePathCtx).trim();
        if (justBuildPath) {
            return targetPath;
        }

        // Build the output string
        const source = modulo.SOURCE_CODE;
        const newCtx = {source, dataStr, fetchData, preloadData, allData};
        const buildCtx = Object.assign(filePathCtx, newCtx);
        const str = modulo.buildTemplate.render(buildCtx);
        if (verbose) {
            const length = str.length;
            console.log(`|%| - - Saving to ${targetPath} (${length} chars)`);
        }

        mkdirToContain(targetPath);
        fs.writeFileSync(targetPath, str, {encoding: 'utf8'});
        console.log(`|%| - - Successful build: ${targetPath}`);
        return targetPath;
    }

    buildpreload(config, modulo) {
        const buildOutput = config.buildPreload;
        const preloadBuildConf = Object.assign({}, config, {buildOutput});
        this._preloadBuildPath = this.build(preloadBuildConf, modulo);
    }

    _ssgPostProcess(outPath, config, modulo, callback) {
        callback = callback || (() => null); // default NOOP
        const {inputFile, outputFile, verbose} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

        log(`Postprocessing ${outputFile}`);
        // Get file while clearing any prefix
        modulo.fetchPrefix = null; // clear prefix (we are accessing output)
        modulo.fetchFile(outputFile)
            .then(response => response.text())
            .then(text => {
                log(`Postprocessing ${outputFile}`);
                const newText = modulo.ssgPostProcessCallback(config, text, outPath);
                if (newText.trim() === text.trim()) {
                    // no change, don't write
                    log(`Postprocess: Write-back skipped for ${outputFile}`);
                    callback();
                    return;
                }
                log(`Postprocess: Write-back needed, writing ${outputFile}`);
                fs.writeFile(outputFile, newText, {encoding: 'utf8'}, (err) => {
                    log(`Postprocess: Write-back successful for ${outputFile}`);
                    modulo.assert(!err, 'postprocessing error', err);
                    callback();
                });
            });
    }

    ssg(config, modulo, finalCallback) {
        const callback = () => {
            this._ssgBuildInProgress = false;
            log('Releasing SSG build lock.');
            if (finalCallback) {
                finalCallback();
            }
        }
        // Does a full generate across a directory
        const {verbose, input, output} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
        if (this._ssgBuildInProgress) {
            log('SSG Build already in progress, not doing another.');
            return;
        }
        this._ssgBuildInProgress = true;

        // Build preload first
        const _buildConf = val => Object.assign({}, config, {buildOutput: val})
        log(`Building preload bundle: ${config.buildPreload}`);
        this.build(_buildConf(config.buildPreload), modulo, true); // empty = ok

        // Build output bundle only after SSG'ing the rest of the site
        const buildOutputBundle = (ppFiles) => {
            // Prepare for the final build -- calculate hash, filename, etc
            const conf = _buildConf(config.ssgBuildOutput);
            const outPath = this.build(conf, modulo, true, true); // justPath=true
            modulo.assert(outPath, 'Invalid path for output bundle:', outPath);
            log(`Building output bundle (using path ${outPath})`);

            // Now, actually do the final build
            this.build(conf, modulo, true); // empty = ok

            // Finally, do postprocessing
            log(`Beginning postprocessing (${ppFiles.length} file(s) may need it)`);
            let ppCount = 0;
            for (const outputFile of ppFiles) {
                const ppConf = Object.assign({}, config, {outputFile});
                this._ssgPostProcess(outPath, ppConf, modulo, () => {
                    ppCount++;
                    if (verbose) {
                        logStatusBar('POSTPROCESS', ppCount, ppFiles.length);
                    }
                    if (ppCount >= ppFiles.length) {
                        callback(); // this is the last step, so callback
                    }
                });
            }
        }

        // Now, synchronously walk through input and apply generate command
        const filenames = walkSync(input, config);
        const generateCount = filenames.length;
        console.log('|%| - - SSG started, total files detected: ' + generateCount)

        let finishedFiles = 0;
        const postProcessFiles = [];
        for (const inputFile of filenames) {
            const outputFile = output + inputFile.slice(input.length);
            const genConf = Object.assign({}, config, {inputFile, outputFile});
            this.generate(genConf, modulo, (action) => {
                finishedFiles++;
                if (action === GENERATE) {
                    postProcessFiles.push(outputFile);
                }
                logStatusBar('GENERATE', finishedFiles, generateCount);
                if (finishedFiles >= generateCount) {
                    log(`GENERATE step complete, ${finishedFiles} files examined!`);
                    buildOutputBundle(postProcessFiles);
                }
            });
        }
    }

    _isPreloadBuild(modulo, config, inputFile) {
        if (!this._preloadBuildPath) {
            const conf = Object.assign({}, config, {buildOutput: config.buildPreload});
            this._preloadBuildPath = this.build(conf, modulo, true, true); // justPath=true
        }
        return inputFile === this._preloadBuildPath;
    }

    watch(config, modulo, callback) {
        // Start each watch with an SSG
        this.ssg(config, modulo, () => this._watch(config, modulo, callback));
    }
    _watch(config, modulo, callback) {
        callback = callback || (() => null); // default NOOP
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

        const nodeWatch = require('node-watch');
        const {isSkip, isCopyOnly, isGenerate, verbose, input, output} = config;
        const shouldSkip = new RegExp(isSkip, 'i');
        log(`Skipping all that match: ${shouldSkip}`);

        const filter = (f, skip) => (shouldSkip.test(f) ? skip : true);
        const watchConf = {recursive: true, filter};

        this._watcher = nodeWatch(input, watchConf, (evt, inputFile) => {
            log(`CHANGE DETECTED IN ${inputFile}`);
            //const outputFile = inputFile.replace(config.input, config.output);
            const outputFile = output + inputFile.slice(input.length); // better

            if (this._ssgBuildInProgress) {
                log(`Build lock detected, ignoring change`);
            }


            modulo.fetchQ.data = {}; // always clear fetchQ data to prevent caching
            if (evt == 'update') {
                // on create or modify
                const conf = Object.assign({}, config, {inputFile, outputFile});
                modulo.assert(!config.watchAllowPartialBuilds, 'watchAllowPartialBuilds not implemented yet');
                if (config.watchAllowPartialBuilds) {
                    log(`Doing partial build ${inputFile} (config.watchAllowPartialBuilds=true)`);
                    this.generate(conf, modulo);
                } else {
                    const action = this._matchGenerateAction(config, modulo, inputFile);
                    if (action === SKIP) {
                        log(`Skipping full build (${inputFile} is skippable)`);
                    } else {
                        log(`Doing full build  (config.watchAllowPartialBuilds=false)`);
                        this.ssg(config, modulo);
                    }

                }
            } else if (evt == 'remove') {
                // on delete
                modulo.assert(inputFile.startsWith(output)); // prevent mistakes
                modulo.assert(!config.watchAllowDeletions, 'watchPerformDeletions not implemented yet');
                if (config.watchPerformDeletions) {
                    log(`Deleting ${inputFile} (config.watchAllowDeletions=true)`);
                    fs.unlink(inputFile);
                } else {
                    log(`Not deleting ${inputFile} (config.watchAllowDeletions=false)`);
                }
            }
        });

        // Add some verbose logging
        this._watcher.on('error', err => log(`Watch Error: ${err}`));
        log(`Starting watch of: ${config.input}`);
        this._watcher.on('ready', callback);
    }

    servesrc(config, modulo) {
          const port = Number(config.port) + 1;
          const output = config.input; // serve src, not output
          const _serveConf = Object.assign({}, config, {port, output})
          this._serve(_serveConf, modulo, true);
    }

    serve(config, modulo) {
        // Start each serve with a watch
        this.watch(config, modulo, () => this._serve(config, modulo));
    }
    _serve(config, modulo, isSrcServe=false) {
        const {port, host, verbose, serverApp, serverAppPath, serverFramework} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
        log(`Preparing to lisen on http://${host}:${port}`);
        const appPath = serverApp || serverAppPath;
        try {
            this._app = require(appPath);
        } catch {
            log(`No app found at ${appPath}`);
            this._app = null;
        }

        log(`Loading server framework: ${serverFramework}`);
        const express = require(serverFramework);
        if (!this._app) {
            log(`Instantiating new ${serverFramework} app (as Modulo.commands._app)`);
            this._app = express();
            this._app.use(express.json());
            // Disable cache headers, etag
            this._app.set('etag', false);
            this._app.disable('view cache');
        }

        this._app.use(_getModuloMiddleware(config, express));

        const _server = this._app.listen(port, host, () => {
            console.log('|%|--------------');
            console.log(`|%| - - Serving "${config.output}" on http://${host}:${port}`);
            if (isSrcServe) {
                console.log(`|%| - - (source server)`);
            } else {
                this.servesrc(config, modulo);
            }
            console.log('|%|--------------');
        });

        if (isSrcServe){
            this._serverSrc = _server;
        } else {
            this._server = _server;
        }
    }

    test(config, modulo, isSrcServe=false) {
        let discovered = [];
        let soloMode = false;
        let skippedCount = 0;
        for (const factory of Object.values(modulo.factoryInstances)) {
            //console.log('factory', factory.fullName);
            const { testsuite } = factory.baseRenderObj;
            if (!testsuite) {
                continue;
            }
            if ('skip' in testsuite.attrs) {
                skippedCount++;
                continue;
            }
            if ('solo' in testsuite.attrs) {
                soloMode = true;
            }
            discovered.push([factory, testsuite]);
        }
        if (soloMode) {
            discovered = discovered.filter(([fac, {attrs}]) => 'solo' in attrs);
        }

        if (discovered.length === 0) {
            console.warn('WARNING: No test suites discovered')
        }
        console.log('[%]', discovered.length + ' test suites found');
        const { runTests } = modulo.cparts.testsuite;
        let success = 0;
        let failure = 0;
        let omission = 0;
        const failedComponents = [];

        for (const [ factory, testsuite ] of discovered) {
            const info = ' ' + (testsuite.name || '');
            console.group('[%]', 'TestSuite: ' + factory.fullName + info);
            const [ successes, failures ] = runTests(testsuite, factory)
            if (failures) {
                failedComponents.push(factory.fullName);
            }
            success += successes;
            failure += failures;
            if (!successes && !failures) {
                console.log('[%]', 'TestSuite omission: no assertions');
                omission++; // no assertions = 1 omission failure
            }
            console.groupEnd();
        }

        if (skippedCount > 0) {
            console.log(TERM.YELLOW_FG, 'SKIPPED', TERM.RESET, skippedCount,
                        'TestSuite(s) skipped');
        }

        if (config.testLog) {
            let testLogData;
            try {
                const testLogFile = fs.readFileSync(config.testLogPath, 'utf8');
                testLogData = JSON.parse(testLogFile);
            } catch (err) {
                console.log('omission: Could not open test log file', err);
                omission++;
            }
            if (testLogData) {
                const highscore = testLogData.highscore;
                const total = failure + success;
                if (total < highscore) {
                    console.log('[!] omission: ', total, 'assertion(s) ran');
                    console.log('[!] (while ', highscore, 'assertion(s) ran previously)');
                    console.log('[!] (delete ', config.testLogPath, 'to reset)');
                    omission++;
                }
            } else {
                let data;
                try {
                    data = JSON.stringify({ highscore: failure + success });
                    fs.writeFileSync(config.testLogPath, data);
                } catch (err) {
                    console.log('omission: Could not write to test log file', data, err);
                    omission++;
                }
            }
        }

        if (!failure && !omission && success) {
            console.log(TERM.GREEN_FG, 'OK', TERM.RESET,
                        `${success} assertions passed`);
            process.exit(0);
        } else {
            console.log('SUCCESSES:', success, 'assertions passed');
            if (ommisions) {
                console.log('OMISSIONS:', omissions, 'empty test suites or ' +
                            'expected assertions');
            }
            console.log(TERM.RED_FG, 'FAILURE ', TERM.RESET, failure,
              'assertions failed\n Failing components:', failedComponents);
            process.exit(1);
        }
    }
}

module.exports = CommandMenuNode;
