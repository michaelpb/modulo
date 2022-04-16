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
            if (this._genApp && this._serverGen) {
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
        const puppeteer = require('puppeteer');
        return new Promise((resolve, reject) => {
            if (this._browser) {
                return resolve();
            }
            (async () => {
                this._browser = await puppeteer.launch();
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

        const doBundle = command === 'build' || command === 'all';
        const doBuild = command === 'build' || command === 'all' || !command;
        const doRender = command === 'render' || command === 'all' || !command;
        // TODO: Change doBundle to be default setting (null)
        //const doBundle = command === 'bundle' || command === 'all' || !command;
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

        await page.goto(url, { waitUntil: 'networkidle0' });

        const buildFiles = await page.evaluate((runSettings) => {
            if (typeof Modulo === 'undefined') {
                return []; // Don't attempt any Modulo-specific actions
            }
            //const { doBuild, doBundle, doRender } = runSettings;
            var doBuild = true; // hardcoding for now
            var doRender = true;
            var doBundle = false;
            const buildFiles = [];
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
                    // TODO: Have a better way to know if included in build,
                    // e.g. an attribute
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
            return buildFiles;
        }, runSettings);

        // console.log(url, buildFiles.map(({ filename }) => filename));

        const html = await page.evaluate(() => {
            return document.documentElement.innerHTML;
        });
        return [ html, buildFiles ];
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
