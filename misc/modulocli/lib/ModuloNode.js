// First, require baseModulo
const baseModulo = require('./BaseModulo');
const { customElementsUpgrade } = require('./DomAdapter');
// Then bring in CommandMenu & TestSuite
const CommandMenuNode = require('./CommandMenuNode');
const TestSuite = require('../mdu/cparts/TestSuite.js');

let jsdomParseHTML;
try {
    const { JSDOM } = require('jsdom');
    jsdomParseHTML = html => new JSDOM(html);
} catch (err) {
    console.log('Warning: Could not load JSDOM', err);
}

let linkedomParseHTML;
try {
    linkedomParseHTML = require('linkedom').parseHTML;
} catch (err) {
    console.log('Warning: Could not load linkedom', err);
}

// Get test suite functions
const fs = require('fs');
const pathlib = require('path');
const utils = require('./utils');
const { webComponentsUpgrade, patchWindow } = require('./jsdomUtils');

const allModuloInstances = {};

class ModuloNode {
    constructor() {
        this.clearAll();
        this.loadText('');
    }

    static getOrCreate(config, instanceKey) {
        // XXX super hacky
        let modulo;
        let data = null;
        let facs = null;
        let preloadQueue = null;
        for (const moddy of Object.values(allModuloInstances)) {
            if (!data && moddy.fetchQ && moddy.fetchQ.data) {
                data = moddy.fetchQ.data;
            }
            if (!facs && moddy.factoryInstances) {
                facs = moddy.factoryInstances;
            }
            if (!preloadQueue && moddy.preloadQueue) {
                preloadQueue = moddy.preloadQueue;
            }
        }

        if (instanceKey in allModuloInstances) {
            modulo = allModuloInstances[instanceKey];
        } else {
            modulo = new ModuloNode()
            allModuloInstances[instanceKey] = modulo;
        }

        if (baseModulo.fetchQ && data) {
            baseModulo.fetchQ.data = data; // XXX HACK
        }
        if (facs) {
            baseModulo.factoryInstances = facs; // XXX HACK
            modulo.factoryInstances = facs; // XXX HACK
        }
        if (preloadQueue) {
            modulo.preloadQueue = preloadQueue; // XXX HACK
        }

        if (config) {
            if (config.domEngine === 'jsdom') {
                modulo.assert(jsdomParseHTML, 'Could not import linkedom');
                baseModulo.backendDOM = jsdomParseHTML;
            } else if (config.domEngine === 'linkedom') {
                modulo.assert(linkedomParseHTML, 'Could not import linkedom');
                baseModulo.backendDOM = linkedomParseHTML;
            } else {
                baseModulo.backendDOM = jsdomParseHTML;
                console.log('ERROR: Invalid domEngine (jsdom, linkedom): ' + config.domEngine);
            }
        }
        modulo.patchModulo(baseModulo, config);
        return modulo;
    }

    clearAll(config) {
        baseModulo.factoryInstances = {};
        this.patchModulo(baseModulo, config);
        const { defineAll } = this;
        Object.assign(this, baseModulo, this); // in conflicts, "this" wins
        delete this.moduloNode; // prevent ugly ref loop
        this.doc = null;
        //this.allDoms = [];
        this.defineAll = defineAll.bind(this); // ensure bound
        this.baseModulo = baseModulo;
        if (this.fetchQ) {
            this.fetchQ.data = {};
        }
    }

    loadText(text, basePath=null) {
        if (!this.backendDOM) {
            this.backendDOM = jsdomParseHTML;
            console.log('Warning: failsafe defaulting to JSDOM');
        }
        this.jsdom = this.backendDOM(text);
        //this.allDoms.push(this.jsdom);
        patchWindow(this.jsdom.window);

        this.globals.document = this.jsdom.window.document;
        this.globals.Event = this.jsdom.window.Event;
        this.globals.DocumentFragment =  this.jsdom.window.DocumentFragment;
        this.doc = this.globals.document; // easier property
        if (this.fetchQ) {
            // Set the current basePath so that any fetches caused by render
            // will be relative to this file
            if (!basePath) {
                basePath = process.cwd(); // TODO rm this??
            }
            this.fetchQ.basePath = basePath;
        }
    }

    getHTML() {
        return this.doc.documentElement.innerHTML;
    }

    ssgPostProcessCallback(config, html, outPath) {
        if (!/^<!doctype html>/i.test(html)) {
            // Ensure all documents start with doctype
            html = '<!DOCTYPE HTML>\n' + html;
        }

        const scriptTagRe = /<script \s*src="\/?m.js">\s*<\/script>/i;
        if (scriptTagRe.test(html)) {
            // Remove the Preload script tag
            html = html.replace(scriptTagRe, '');
        }

        const emptyHeadRe = /<head><\/head>/i;
        if (emptyHeadRe.test(html)) {
            // TODO: Remove spurious empty head tags
        }

        if (outPath) {
            outPath = outPath.replace(config.output, ''); // remove output dir
            // (NOTE: This relies on JavaScript's replace being singular)

            let newScript = `<script src="${outPath}"></script>`;

            // XXX HACK XXX
            // XXX HACK XXX
            newScript = '<script src="/js/codemirror_5.63.0/codemirror_bundled.js"></script>' + newScript;
            // XXX HACK XXX
            // XXX HACK XXX

            const closingHead = /<\/head>/i;
            const closingBody = /<\/body>/i;
            if (closingBody.test(html)) {
                html = html.replace(closingBody, newScript + '</body>');
            } else if (closingHead.test(html)) {
                html = html.replace(closingHead, newScript + '</head>');
            } else {
                console.log('WARNING: ModuloNode/ssgPostProcessCallback',
                            'No </body> or </head> tag found, still',
                            'carrying out scirpt injection:', newScript);
                html = html + newScript;
            }


            //console.log('Adding in script:', newScript);
        }
        return html;
    }

    patchModulo(m, config) {
        m.isBackend = true;
        m.moduloNode = this;
        m.globals.fetch = this.fetchFile.bind(this);
        m.assert = this.assert.bind(this);
        const define = this.defineCustomElement.bind(this);
        m.globals.customElements = { define };
        // TODO -v should clean this up? Probably replace with JSDOM HTMLElement impl
        m.globals.HTMLElement.prototype.getAttribute = a => 'XYZYX getAttribute plcholder hack';
        m.globals.HTMLElement.prototype.hasChildNodes = a => false; // HACK
        m.ComponentFactory = ComponentFactoryNode;
        m.CommandMenu = CommandMenuNode;
        m.cparts.testsuite = TestSuite;

        /*
        if (!m.utils.oldResolve) {
            m.utils.oldResolve = m.utils.resolvePath;
        }
        m.utils.resolvePath = (baseDir, relDir) => {
            const a = m.utils.oldResolve(baseDir, relDir);
            const b = pathlib.resolve(baseDir, relDir);
            if (a !== b) {
                console.log('----------')
                console.log('basesDir', baseDir);
                console.log('relDir', relDir);
                console.log('vanilla resolve', a);
                console.log('node pathlib resolve', b);
                console.log('----------')
            }
            return b;
        };
        */

        //const element = new this.element.factory.createTestElement();
        let {rootPath, inputFile, outputFile} = (config || {});
        // TODO: to finish compatibility, add null replacer here
        if (inputFile) {
            utils.patchModuloWithSSGFeatures(m, inputFile, null, outputFile);
        }

        if (this.backendDOM === linkedomParseHTML) {
            // Patch linkedom specific features
            const {
                window, document, customElements, HTMLElement, Event,
                CustomEvent
            } = this.jsdom;
            const patchedVersions = {
                window, document, customElements, HTMLElement, Event,
            };
            Object.assign(m.globals, patchedVersions);
        }
    }

    fetchFile(src, opts) {
        // Similar interface to window.fetch, except using fs.readFile

        ///////////////////////////////////////////////////////////////////
        if (src.startsWith('http')) { // 2022-05 hack to get tests running
            console.log("(Legacy) Modulo JSDOM ERROR, cannot resolve absolute URL: src=", src);
            return new Promise((resolve, reject) => {
                const data = '{}';
                const text = () => new Promise(r => r(data));
                const json = () => new Promise(r => r(JSON.parse(data)))
                resolve({ text, json });
            });
        }
        ///////////////////////////////////////////////////////////////////

        // TODO: This "prefix" stuff is a complete mess and has many bugs (e.g.
        // can't have nested dirs with same name as prefix!) and needs to be
        // rewritten so that there is simple, predictable, and similar behavior
        // in browser vs CLI: E.g., ALWAYS silo to www-src or something similar
        if (this.fetchPrefix && !src.includes(this.fetchPrefix)) {
            src = this.fetchPrefix + '/' + src;
        }

        if (src.includes('components/components')) { // TODO delete this
            src = src.replace('components/components', 'components');
        }

        return new Promise((resolve, reject) => {
            fs.readFile(src, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                // support either text or json modes
                const text = () => new Promise(r => r(data));
                const json = () => new Promise(r => r(JSON.parse(data)))
                resolve({ text, json });
            });
        });
    }

    fetchFile2(src) {
        // TODO: See if fetchFile2 is better for any reason
        if (this.fetchPrefix) {
            src = this.fetchPrefix + '/' + src;
        }

        const readFilePromise = (isJson) => new Promise((resolve, reject) =>
              fs.readFile(src, 'utf8', (err, data) => {
                  if (err) {
                      reject(err);
                  } else {
                      if (isJson) {
                          data = JSON.parse(data);
                      }
                      resolve(data);
                  }
              }));

        return new Promise((resolve, reject) => {
            // support either text or json modes
            const text = () => readFilePromise(false);
            const json = () => readFilePromise(true);
            resolve({ text, json });
        });
    }

    assert(value, ...info) {
        if (!value) {
            console.error('Modulo Error:')
            console.error(...info)
            process.exit(1);
        }
    }

    defineCustomElement(name, cls) {
        const elements = this.doc.querySelectorAll(name);
        for (const el of elements) {
            if (el.hasAttribute('modulo-backend-skip')) {
                continue;
            }
            const instance = new cls();
            webComponentsUpgrade(el, instance);
        }
    }

    resolveCustomComponents(maxDepth, callback, tries=0) {
        this.assert(maxDepth, 'ssgRenderDepth/maxDepth is falsy');
        tries++;
        if (tries > maxDepth) {
            // Base case 1:  Prevent infinite recursion: Could be caused by
            // components being too nested (in which case ssgRenderDepth should
            // be increased) or by non-deterministic components (in which case
            // they should be deterministic!)
            console.log(`WARNING: Hit limit: ssgRenderDepth=${maxDepth}`);
            return callback();
        }
        const {factoryInstances} = this;
        this.assert(factoryInstances, 'factoryInstances is falsy');
        this.assert(factoryInstances === baseModulo.factoryInstances,
              'factoryInstances is not the same as baseModulo');

        const findFac = (elem) => {
            const lowerTag = (elem.tagName || '').toLowerCase();
            for (const factory of Object.values(factoryInstances)) {
                if (lowerTag === factory.fullName.toLowerCase()) {
                    return factory;
                }
            }
        }

        // Loop through every element in the HTML, looking to mount them
        //          (TODO: Remove, when mod-load is removed)----------v
        const sel = (Object.keys(factoryInstances).join(',') || 'X') + ',mod-load';
        const allModElems = this.doc.querySelectorAll(sel);
        let allMounted = true;
        // TODO: needs work here, should isolate the mod-load upgrade somewhere
        // else and simplify the rest of the logic with defineComponent above
        for (const el of allModElems) {
            if (el.isMounted) {
                continue; // all good! TODO: Would it hurt to rerender here?
            }
            allMounted = false;
            const factory = findFac(el);
            let instance;
            if (factory) {
                instance = new factory.componentClass();
            } else if (el.tagName === 'MOD-LOAD') { // TODO: delete after deleting mod-load
                instance = new this.DOMLoader();
            } else {
                new Error('Could not find factory for:', el)
            }
            webComponentsUpgrade(el, instance);

            // XXX HACK -------v
            el.setAttribute('modulo-innerhtml', el.originalHTML || '');
        }


        // Wait for any further files to be fetched
        this.fetchQ.wait(() => {
            if (allMounted) {
                // Base Case #2: Didn't encounter any that need mounting: Stop
                callback();
            } else {
                // Recursive Case: There were more to mount: Keep on trying
                this.resolveCustomComponents(maxDepth, callback, tries);
            }
        });
    }

    defineAll(config) {
        baseModulo.defineAll(config); // do normal behavior

        if (!baseModulo.fetchQ) {
            baseModulo.fetchQ = new Modulo.FetchQueue();
            baseModulo.assets = new Modulo.AssetManager();
        }
        if (!baseModulo.globalLoader) {
            baseModulo.globalLoader = new Modulo.Loader(null, { attrs: { namespace: 'x', src: '/' } });
        }
        baseModulo.CommandMenu.setup();

        // ensure both share same fetchQ
        this.fetchQ = baseModulo.fetchQ;
        this.globalLoader = baseModulo.globalLoader;

        // get rid of cruft after defineAll
        this.globals.m = null; // remove 'm' shortcut
        this.commands = baseModulo.cmd; // copy commands
        baseModulo.cmd = null; // remove internal cmd
    }
}

class ComponentFactoryNode extends baseModulo.ComponentFactory {
    createTestElement() {

        const instance = new this.componentClass();
        //this.testDom = new JSDOM(`<${this.fullName}></${this.fullName}>`);
        this.testDom = baseModulo.backendDOM(`<${this.fullName}></${this.fullName}>`);
        this.testDoc = this.testDom.window.document;
        const el = this.testDoc.querySelector(this.fullName);
        webComponentsUpgrade(el, instance); // ensure has minimum webcomponent API
        delete el.cparts.testsuite; // for testing, never include testsuite
        return el; // Finally, return the upgraded element
    }

    doTestRerender(originalElement, testInfo) {
        super.doTestRerender(originalElement, testInfo); // do default behavior
        const { factoryInstances } = baseModulo;
        customElementsUpgrade(originalElement, factoryInstances);
    }
}

ModuloNode.baseModulo = baseModulo; // gives access to imports

module.exports = ModuloNode;
