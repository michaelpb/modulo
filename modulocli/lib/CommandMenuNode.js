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

function statusBar(shoutyWord, finishedFiles, generateCount) {
    const maxCount = 24;
    const charCent = Math.round((finishedFiles / generateCount) * maxCount);
    const perCent = Math.round((finishedFiles / generateCount) * 100);
    const statusBar = '%'.repeat(charCent) + ' '.repeat(maxCount - charCent);
    const str = TERM.MAGENTA_FG + shoutyWord + TERM.RESET +
                    '  |' + statusBar + '|' + TERM.RESET + ` ${perCent}%`;
    if (lastStatusBar !== str) {
        console.log(str);
    }
    lastStatusBar = str;
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

    generate(config, modulo, callback) {
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
            log(`|%| - - Skip ${inputFile}`);
            callback();
        } else if (action === GENERATE) {
            log(`|%| - - Generate ${inputFile} -> ${outputFile}`);
            // Get file while assigning prefix to be input directory
            const src = inputFile.replace(config.input, '');
            modulo.fetchPrefix = config.input;
            modulo.fetchFile(src)
                .then(response => response.text())
                .then(text => doGenerate(config, modulo, text, outputFile, callback));
        } else if (action === COPY) {
            log(`|%| - - Copy ${inputFile} -> ${outputFile}`);
            copyIfDifferent(inputFile, outputFile, callback);
        } else {
            modulo.assert(false, `Invalid "action" (from CustomFunc?): ${action}`);
        }
    }

    build(config, modulo, allowEmpty=false) {
        // NOTE: build is synchronous
        // TODO: Watch out, key order might not be stable, affect hash
        const {preloadQueue, fetchQ} = modulo;
        const preloadData = Object.assign({}, preloadQueue.data, fetchQ.data);
        const dataStr = JSON.stringify(preloadData);
        if (!allowEmpty) {
            modulo.assert(dataStr !== '{}', `No components (none loaded?)`);
        }
        const hash = modulo.utils.hash(dataStr);
        const {input, output, verbose, buildversion} = config;
        if (verbose) {
            console.log(` \`> - - Compiled: ${hash}`);
        }

        // Build the output path
        const d = new Date();
        const versiondate = `${d.getYear()}.${(d.getMonth() + 1)}`
        const filePathCtx = {input, output, versiondate, buildversion, hash};
        /*
        let buildOutputTmpl = new modulo.templating.MTL(config.buildOutput);
        const buildOutput = buildOutputTmpl.render(filePathCtx);
        // TODO: Switch defaultOptions to use {{ }} style templating
        */
        let {buildOutput} = config;
        buildOutput = buildOutput.replace('$input', input);
        buildOutput = buildOutput.replace('$output', output);
        buildOutput = buildOutput.replace('$versiondate', versiondate);
        buildOutput = buildOutput.replace('$buildversion', buildversion);
        buildOutput = buildOutput.replace('$hash', hash);

        // Build the output string
        const source = modulo.SOURCE_CODE;
        const buildCtx = Object.assign(filePathCtx,
            {source, dataStr, fetchQ, preloadData: preloadQueue.data});
        const str = modulo.buildTemplate.render(buildCtx);
        /*
        let str = `// modulocli build ${hash}\n`;
        str += modulo.SOURCE_CODE;
        str += '\n// // // //\n';
        str += `Modulo.fetchQ = ` + dataStr;
        str += '\n;\n'
        for (const [path, text] of Object.entries(preloadQueue.data)) {
            const escapedText = JSON.stringify(text);
            str += `\nModulo.globalLoader.loadString(${escapedText});\n`;
        }
        str += '\nModulo.defineAll();\n'
        */
        if (verbose) {
            const length = str.length;
            console.log(`|%| - - Saving to ${buildOutput} (${length} chars)`);
        }

        mkdirToContain(buildOutput);
        fs.writeFileSync(buildOutput, str, {encoding: 'utf8'});
        console.log(`|%| - - Successful build: ${buildOutput}`);
    }

    buildpreload(config, modulo) {
        const buildOutput = config.buildPreload;
        const preloadBuildConf = Object.assign({}, config, {buildOutput});
        this.build(preloadBuildConf, modulo);
    }

    ssg(config, modulo, callback) {
        // Does a full generate across a directory
        const {verbose, input, output} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

        // Build preload first
        const _buildConf = val => Object.assign({}, config, {buildOutput: val})
        log(`Building preload bundle: ${config.buildPreload}`);
        this.build(_buildConf(config.buildPreload), modulo, true); // empty = ok

        // Build output bundle only after SSG'ing the rest of the site
        const buildOutputBundle = () => {
            log(`Building output bundle (using path ${config.ssgBuildOutput})`);
            this.build(_buildConf(config.ssgBuildOutput), modulo, true); // empty = ok
            callback();
        }

        // Now, synchronously walk through input and apply generate command
        const filenames = walkSync(input, config);
        const generateCount = filenames.length;
        console.log('|%| - - SSG started, total files detected: ' + generateCount)
        let finishedFiles = 0;
        for (const inputFile of filenames) {
            const outputFile = output + inputFile.slice(input.length);
            const genConf = Object.assign({}, config, {inputFile, outputFile});
            this.generate(genConf, modulo, () => {
                finishedFiles++;
                statusBar('GENERATE', finishedFiles, generateCount);
                if (finishedFiles >= generateCount) {
                    log(`GENERATE step complete, ${finishedFiles} files examined!`);
                    buildOutputBundle(callback);
                }
            });
        }
    }

    watch(config, modulo) {
        this.ssg(); // do a full build across all
        const nodeWatch = require('node-watch');
        const {isSkip, isCopyOnly, isGenerate, verbose, input, output} = config;
        const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
        const shouldSkip = new RegExp(isSkip, 'i');
        log(`Skipping all that match: ${shouldSkip}`);

        const filter = (f, skip) => (shouldSkip.test(f) ? skip : true);
        const watchConf = {recursive: true, filter};
        this.watcher = nodeWatch(input, watchConf, (evt, inputFile) => {
            log(`CHANGE DETECTED IN ${inputFile}`);
            //const outputFile = inputFile.replace(config.input, config.output);
            const outputFile = output + inputFile.slice(input.length); // better
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
        this.watcher.on('ready', () => log(`Watching: ${config.input}`));
        this.watcher.on('error', err => log(`Watch Error: ${err}`));
        process.on('SIGINT', () => this.watcher.close());
    }

    serve(config, modulo) {
        const {port, host, serverApp, serverAppPath} = config;
        console.log(`Preparing to lisen on http://${host}:${port}`);
        const appPath = serverApp || serverAppPath;
        try {
            this.app = require(appPath);
        } catch {
            console.log(`|%| - - (No app found at ${appPath})`);
        }

        if (!this.app) {
            const express = require('express');
            this.app = express();
            this.app.use(express.json());
            function logger(req, res, next) {
                console.log(req.method, req.url);
                next();
            }
            this.app.use(logger);
            // TODO: Add in "/$username/" style wildcard matches, auto .html
            //       prefixing, etc before static. Behavior is simple:
            //       $username becomes Modulo.route.username for any generates
            //       within this dir (or something)
            //this.app.use(this.wildcardPatchMiddleware);
        }
        this.app.use(express.static(config.output))
        console.log(`|%| - - Serving: ${config.output})`);
        this.app.listen(port, host, () => {
            console.log(`|%| - - Listening on http://${host}:${port}`);
        });
        this.watch(); // watch for changes & copy as well
    }

}

module.exports = CommandMenuNode;
