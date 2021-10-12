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
    // take that, rule of 3!
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

    help() {
        let prefix = 'm.';
        if (!this.repl) {
            prefix = '';
            console.log('Usage: modulocli CMD [preload(s)] [--flag(s)]');
            console.log('Example: modulocli serve\n');
        }
        console.log('Available commands: (CMD)');
        for (const key of this._getCmds()) {
            console.log(`    ${prefix}${key}`);
        }
        console.log('\nFor full documentation, visit:    https://modulojs.org', "\n")
    }

    [inspect]() {
        let cmdList = this._getCmds().join(', ');
        if (this.repl) {
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
        console.log(TERM.LOGO, 'Node REPL activated. Type m to see commands.');
        this.repl = repl.start('[%] ', process.stdin);

        // TODO: Loop through "m." and replace with wrapped getters, that give
        // modulo context

        // REPL requires you to make globals read-only, as such:
        const _ro = value => ({value, configurable: false, enmerable: true});
        Object.defineProperty(this.repl.context, 'modulo', _ro(modulo));
        Object.defineProperty(this.repl.context, 'm', _ro(this));
    }

    _matchGenerateAction(config, inputFile) {
        const {isGenerate, isSkip, isCopyOnly, isCustomFilter} = config;
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

    generate(config, modulo, finalCallback) {
        const callback = () => {
            if (finalCallback) {
                finalCallback(action);
            }
        }
        const {inputFile, outputFile, verbose, isCustomFunc} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

        // Generate a single file
        let action = this._matchGenerateAction(config, inputFile);
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
    }

    buildpreload(config, modulo) {
        const buildOutput = config.buildPreload;
        const preloadBuildConf = Object.assign({}, config, {buildOutput});
        this.build(preloadBuildConf, modulo);
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

    ssg(config, modulo, callback) {
        // Does a full generate across a directory
        const {verbose, input, output} = config;
        callback = callback || (() => null); // default NOOP
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

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

    watch(config, modulo, callback) {
        // Start each watch with an SSG
        this.ssg(config, modulo, () => this._watch(config, modulo, callback));
    }
    _watch(config, modulo, callback) {
        const nodeWatch = require('node-watch');
        const {isSkip, isCopyOnly, isGenerate, verbose, input, output} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
        const shouldSkip = new RegExp(isSkip, 'i');
        log(`Skipping all that match: ${shouldSkip}`);

        const filter = (f, skip) => (shouldSkip.test(f) ? skip : true);
        const watchConf = {recursive: true, filter};
        this._watcher = nodeWatch(input, watchConf, (evt, inputFile) => {
            log(`CHANGE DETECTED IN ${inputFile}`);
            //const outputFile = inputFile.replace(config.input, config.output);
            const outputFile = output + inputFile.slice(input.length); // better

            modulo.fetchQ.data = {}; // always clear fetchQ data to prevent caching
            if (evt == 'update') {
                // on create or modify
                const conf = Object.assign({}, config, {inputFile, outputFile});
                this.generate(conf, modulo);
            } else if (evt == 'remove') {
                // on delete
                const filesToDelete = [outputFile];
                /*
                // TODO: Generalize this "dependency" backwards to generate as well
                if (outputFile in (this.fileDependencies || {})) {
                    filesToDelete.extend(this.fileDependencies[outputFile]);
                }
                */
                for (const depPath of filesToDelete) {
                    modulo.assert(depPath.startsWith(output)); // prevent mistakes
                    log(`Deleting ${depPath}`);
                    //fs.unlink(depPath);
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

        log(`Loading server framework ${serverFramework}`);
        const express = require(serverFramework);
        if (!this._app) {
            log(`Instantiating new ${serverFramework} app (as Modulo.commands._app)`);
            this._app = express();
            this._app.use(express.json());
            function logger(req, res, next) {
                log(`${req.method} ${req.url}`);
                next();
            }
            this._app.use(logger);

            // Disable cache headers, etag
            this._app.use((req, res, next) => {
              this._app.set('etag', false);
              this._app.disable('view cache');
              res.set('Cache-Control', 'no-store')
              next()
            });

            // TODO: Add in "/$username/" style wildcard matches, auto .html
            //       prefixing, etc before static. Behavior is simple:
            //       $username becomes Modulo.route.username for any generates
            //       within this dir (or something)
            //this._app.use(this.wildcardPatchMiddleware);
        }

        let {serverAutoFixSlashes, serverAutoFixExtensions} = config;
        if (serverAutoFixExtensions === true) {
            serverAutoFixExtensions = ['html'];
        }
        const staticSettings = {
            maxAge: 0,
            redirect: serverAutoFixSlashes,
            extensions: serverAutoFixExtensions,
        };
        const staticMiddleware = express.static(config.output, staticSettings);
        this._app.use(staticMiddleware);

        log(`Serving: ${config.output} (${staticSettings})`);

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

}

module.exports = CommandMenuNode;
