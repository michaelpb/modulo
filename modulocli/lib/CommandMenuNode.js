const baseModulo = require('./BaseModulo');
const {TERM, copyIfDifferent, doGenerate} = require('./utils');
const util = require('util');
const path = require('path');

const inspect = Symbol.for('nodejs.util.inspect.custom');

const CUSTOM = 'CUSTOM';
const SKIP = 'SKIP';
const GENERATE = 'GENERATE';
const COPY = 'COPY';

class CommandMenuNode extends baseModulo.CommandMenu {
    _getCmds() {
        // not elegant -v
        const properties = Object.getOwnPropertyNames(this.__proto__).concat(
            Object.getOwnPropertyNames(this.__proto__.__proto__))
        const list = properties.filter(name =>
            (!name.startsWith('_') && name !== 'constructor'));
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

    generate(config, modulo) {
        const {inputFile, outputFile, verbose, isCustomFunc} = config;
        // Generate a single file
        /*
        let filename = path.basename(inputFile);
        if (isCustomFilter && isCustomFilter(filename)) {
            filename = isCustomFunc(filename);
        }

        let shouldSkip = false;
        let pathPart;
        const check = regexp => (new RegExp(regexp, 'i').test(pathPart));
        for (pathPart of inputFile.split('/')) {
            if (check(isSkip)) {
                return true;
            }
        }

        const check = regexp => (new RegExp(regexp, 'i').test(filename));
        const allowGenerate = !(new RegExp(isCopyOnly, 'i').test(inputFile));
        */
        let action = this._matchGenerateAction(config, inputFile);
        if (action === CUSTOM) {
            if (verbose) {
                console.log(` \`> - - Custom ${inputFile}`);
            }
            action = isCustomFunc(config, modulo);
            if (!action) {
                return;
            }
        }

        if (action === SKIP) {
            console.log(` \`> - - Skip ${inputFile}`);
        } else if (action === GENERATE) {
            console.log(` \`> - - Generate ${inputFile} -> ${outputFile}`);
            // Get file while assigning prefix to be input directory
            const src = inputFile.replace(config.input, '');
            modulo.fetchPrefix = config.input;
            modulo.fetchFile(src)
                .then(response => response.text())
                .then(text => doGenerate(config, modulo, text, outputFile));

        }

        /*
        if (check(isSkip)) {
            console.log(` \`> - - Skip ${inputFile}`);
        } else if (check(isGenerate) && allowGenerate) {

            // Get file while assigning prefix to be input directory
            const src = inputFile.replace(config.input, '');
            modulo.fetchPrefix = config.input;
            modulo.fetchFile(src)
                .then(response => response.text())
                .then(text => doGenerate(config, modulo, text, outputFile));
        } else {
            console.log(` \`> - - Copy ${inputFile} -> ${outputFile}`);
            copyIfDifferent(inputFile, outputFile);
        }
        */
    }

    ssg(config, modulo) {
        // Does a full generate across a directory
    }

    watch(config, modulo) {
        this.ssg(); // do a full build across all
        const nodeWatch = require('node-watch');
        const {isSkip, isCopyOnly, isGenerate, verbose} = config;
        const log = msg => verbose ? console.log(` '> - - ${msg}`) : null;
        const shouldSkip = new RegExp(isSkip, 'i');
        log(`Skipping all that match: ${shouldSkip}`);

        const filter = (f, skip) => (shouldSkip.test(f) ? skip : true);
        const watchConf = {recursive: true, filter};
        this.watcher = nodeWatch(config.input, watchConf, (evt, inputFile) => {
            log(`CHANGE DETECTED IN ${inputFile}`);
            const outputFile = inputFile.replace(config.input, config.output);
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
                    modulo.assert(depPath.startsWith(config.output)); // prevent mistakes
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
            console.log(` '> - - (No app found at ${appPath})`);
        }

        if (!this.app) {
            const express = require('express');
            this.app = express();
            this.app.use(express.json());
            function logger(req, res, next) {
                console.log(req.method, req.url);
                next();
            }
            app.use(logger);
        }
        app.use(express.static(config.output))
        console.log(` '> - - Serving: ${config.output})`);
        app.listen(port, host, () => {
            console.log(` '> - - Listening on http://${host}:${port}`);
        });
        this.watch(); // watch for changes & copy as well
        //this.repl();
    }

}

module.exports = CommandMenuNode;
