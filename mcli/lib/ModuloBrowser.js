// This is a simpler rewrite of ModuloNode, using Pupeteer

const fs = require('fs');
const path = require('path');

class ModuloBrowser {
    constructor(config) {
        this.config = config;
        this.absoluteRoot = path.resolve(this.config.input);
        this.port = process.env.MODULO_BROWSER_E2E_PORT || 6627;
        const { verbose } = config
        this.log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
        this.dependencyGraph = {};
    }

    _startExpress(callback) {
        return new Promise((resolve, reject) => {
            if (this._genApp) {
                return resolve();
            }
            const express = require('express');
            this._genApp = express();
            this._genApp.use(express.static(this.absoluteRoot));
            this._serverGen = this._genApp.listen(this.port, () => {
                this.log('Modulo Browser - static server at: ' + this.port);
                resolve();
            });
        });
    }

    _startBrowser() {
        // TODO: refactor
        const { browserBackend, browserBackendVisible, verbose } = this.config;
        const puppeteer = require(browserBackend);
        const pConfig = {
            headless: !browserBackendVisible,
            dumpio: verbose, // Too verbose? (It's the browser process's)
        };
        return new Promise((resolve, reject) => {
            if (this._browser) {
                return resolve();
            }
            (async () => {
                this._browser = await puppeteer.launch(pConfig);
                resolve();
            })();
        });
    }

    getURL(filepath) {
        const absPath = path.resolve(filepath);
        const relPath = path.relative(this.absoluteRoot, absPath);
        return `http://127.0.0.1:${this.port}/${relPath}`;
    }

    run(htmlPath, callback) {
        (async () => {
            await this._startExpress();
            await this._startBrowser();
            const res = await this.runAsync(htmlPath);
            callback(res);
        })();
    }

    getDependencies(htmlPath) {
        const url = this.getURL(htmlPath);
        return Object.keys(this.dependencyGraph[url] || {})
    }

    async runAsync(htmlPath, command = null) {
        const url = this.getURL(htmlPath);

        let doBundle = command === 'build' || command === 'all';
        let doBuild = command === 'build' || command === 'all' || !command;
        let doRender = command === 'render' || command === 'all' || !command;
        //const doBundle = command === 'bundle' || command === 'all' || !command;
        doBuild = true; // XXX hardcoding for now
        doRender = true; // XXX
        doBundle = false; // XXX
        const runSettings = { doBuild, doBundle, doRender };

        await this._startExpress(); // setup stuff
        await this._startBrowser();

        const page = await this._browser.newPage();

        page.on('response', (response) => {
            // Keep track of all requests, and then save relation in dependencyGraph
            const request = response.request();
            const reqUrl = request.url();
            if (!(reqUrl in this.dependencyGraph)) {
                this.dependencyGraph[reqUrl] = {};
            }
            this.dependencyGraph[reqUrl][url] = true;
        });

        const { verbose } = this.config;
        page.on('console', message => {
            const code = message.type().substr(0, 3).toUpperCase();
            if (verbose || code === 'ERR') {
                console.log(`|%| BROWSER ${code} |%| ${message.text()}`);
            }
        });


        await page.goto(url, { waitUntil: 'networkidle0' });

        /*
        const { buildFiles } = await page.evaluate(runSettings => {
            let { doBuild, doBundle, doRender } = runSettings;
            const buildFiles = [];
            const results = [];

            if (typeof Modulo === 'undefined') {
                return { buildFiles }; // Don't attempt any Modulo-specific actions
            }

            Modulo.utils.saveFileAs = (filename, text) => {
                buildFiles.push({ filename, text });
            };
            if (doBuild) {
                Modulo.cmd.build(); // Do CSS / JS build
            }
            if (doBundle) {
                Modulo.cmd.bundle(); // Do CSS / JS bundle
            }

            if (doRender) {
                // Delete all script tags and style tags
                const toDelete = 'script,style,link';
                for (const elem of document.querySelectorAll(toDelete)) {
                    const includedInBuild = elem.tagName === 'STYLE' || (
                        elem.tagName === 'SCRIPT' && !elem.hasAttribute('src'));
                    if (doBundle || (doBuild && includedInBuild)) {
                        elem.remove(); // always remove
                    }
                }

                // Scan document for modulo elements, attaching
                // modulo-original-html="" as needed
                for (const elem of document.querySelectorAll('*')) {
                    if (!elem.isModulo) {
                        continue;
                    }
                    if (elem.originalHTML !== elem.innerHTML) {
                        elem.setAttribute('modulo-original-html', elem.originalHTML);
                    }
                }
            }
            return { buildFiles };
        }, runSettings);

        const html = await page.evaluate(() => {
            return document.documentElement.innerHTML;
        });
        */

        // TODO: Refactor -v
        const artifacts = await page.evaluate(runSettings => {
            const artifacts = [];
            if (typeof Modulo === 'undefined') {
                return artifacts; // Don't attempt any Modulo-specific actions
            }
            // Patch saveFileAs to just add to artifacts array
            Modulo.utils.saveFileAs = (filename, text) => {
                artifacts.push({ filename, text });
                if (filename.endsWith('.js') || filename.endsWith('.css')) {
                    // XXX hardcoded, should get from runSettings
                    return '/_modulo/' + filename;
                } else {
                    return './' + filename;
                }
            };
            Modulo.cmd.bundle(); // XXX hardcoded, should get from runSettings
            return artifacts;
        }, runSettings);

        // XXX this logic should be handled in generate.js
        let html = '';
        let buildArtifacts = [];
        for (const info of artifacts) {
            if (info.filepath.endsWith('.html')) {
                html = info.text;
            } else {
                buildArtifacts.append(info);
            }
        }
        return [ html, buildArtifacts ];
    }

    close(callback) {
        (async () => {
            if (this._serverGen) {
                this._serverGen.close();
            }
            if (this._serverSrc) { // HACK, these should be attached & closed elsewhere
                this._serverSrc.close();
            }
            if (this._serverSsg) { // HACK, these should be attached & closed elsewhere
                this._serverSsg.close();
            }
            if (this._browser) {
                await this._browser.close();
            }
            if (callback) {
                callback();
            }
        })();
    }
}

module.exports = ModuloBrowser;
