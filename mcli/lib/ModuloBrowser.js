// This is a simpler rewrite of ModuloNode, using Pupeteer

const fs = require('fs');
const path = require('path');

class ModuloVM {
    constructor(config) {
        this.config = config;
        this.absoluteRoot = path.resolve(this.config.input);
        this.port = process.env.MODULO_BROWSER_E2E_PORT || 6627;
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
            this._app.use(express.static(this.absoluteRoot));
            this._server = this._app.listen(this.port, () => {
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
            const html = await this.runAsync(htmlPath);
            callback(html);
        })();
    }

    async runAsync(htmlPath) {
        const waitUntil = 'networkidle0';
        await this._startExpress();
        await this._startBrowser();
        const page = await this._browser.newPage();
        await page.goto(this.getURL(htmlPath), { waitUntil });
        await page.evaluate(() => {
            // Scan document for modulo elements, attaching modulo-original-html as needed
            for (const elem of document.querySelectorAll('*')) {
                if (!elem.isModulo) {
                    continue;
                }
                if (elem.originalHTML !== elem.innerHTML) {
                    elem.setAttribute('modulo-original-html', elem.originalHTML);
                }
            }
        });
        const html = await page.evaluate(() => {
            return document.documentElement.innerHTML;
        });
        return html;
    }

    close(callback) {
        (async () => {
            if (this._server) {
                this._server.close();
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
/*
await page.waitFor(2000);
await page.waitForFunction(() => {
    console.log('setting timeout!');
    setTimeout(() => {
      console.log('waiting for fetchq!');
      Modulo.fetchQ.wait(() => {
          document.body.classList.add('modulo-finished-loading');
      });
    }, 1);
});
await page.waitForSelector('body.modulo-finished-loading');
*/
module.exports = ModuloVM;
