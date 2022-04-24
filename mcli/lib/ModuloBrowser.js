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
        const runSettings = {} ; ///

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

            return new Promise((resolve, reject) => {
                Modulo.cmd.bundle(); // XXX hardcoded, should get from runSettings
                Modulo.fetchQ.wait(() => {
                    resolve(artifacts);
                });
            });
        }, runSettings);

        // XXX this logic should be handled in generate.js
        let html = '';
        let buildArtifacts = [];
        for (const info of artifacts) {
            if (info.filename.endsWith('.html')) {
                html = info.text;
            } else {
                buildArtifacts.push(info);
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
