// This is a simpler rewrite of ModuloNode, using Pupeteer

const fs = require('fs');
const path = require('path');

class ModuloVM {
    constructor(config) {
        this.config = config;
        this.absoluteRoot = path.resolve(this.config.input);
        const { verbose } = config
        this.log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
    }

    _startExpress(callback) {
        return new Promise((resolve, reject) => {
            if (this._app) {
                return resolve();
            }
            const express = require('express');
            this._app = express();
            this._app.use(express.logger());
            this._app.use(express.static(this.absoluteRoot));
            this._app = process.env.MODULO_BROWSER_E2E_PORT || 6627;
            app.listen(port, () => {
                this.log('Modulo Browser - static server at: ' + port);
                resolve();
            });
        });
    }

    run(htmlPath, callback) {
        const puppeteer = require('puppeteer');
        (async () => {
            await this._startExpress();
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto(htmlPath);
            await page.screenshot({ path: 'testing.png' });
            await browser.close();
            callback();
        })();
    }
}

module.exports = ModuloVM;
