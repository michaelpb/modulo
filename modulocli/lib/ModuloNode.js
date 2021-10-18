// First, require baseModulo
const baseModulo = require('./BaseModulo');
// Then bring in CommandMenu & TestSuite
const CommandMenuNode = require('./CommandMenuNode');
const TestSuite = require('../../src/TestSuite.js');

// Get test suite functions
const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');
const utils = require('./utils');
const {webComponentsUpgrade, patchWindow} = require('./jsdomUtils');

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
        modulo.patchModulo(baseModulo, config);
        return modulo;
    }

    clearAll(config) {
        baseModulo.factoryInstances = {};
        this.patchModulo(baseModulo, config);
        const {defineAll} = this;
        Object.assign(this, baseModulo, this); // in conflicts, "this" wins
        delete this.moduloNode; // prevent ugly ref loop
        this.doc = null;
        this.allDoms = [];
        this.defineAll = defineAll.bind(this); // ensure bound
        this.baseModulo = baseModulo;
        if (this.fetchQ) {
            this.fetchQ.data = {};
        }
    }

    loadText(text, basePath=null) {
        this.jsdom = new JSDOM(text);
        this.allDoms.push(this.jsdom);
        patchWindow(this.jsdom.window);

        this.globals.document = this.jsdom.window.document;
        this.globals.Event = this.jsdom.window.Event;
        this.globals.DocumentFragment =  this.jsdom.window.DocumentFragment;
        this.doc = this.globals.document; // easier property
        if (this.fetchQ) {
            // Set the current basePath so that any fetches caused by render
            // will be relative to this file
            if (!basePath) {
                basePath = null;
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
            newScript = '<script src="/js/codemirror_5.63.0/codemirror_bundled.js"></script>' + newScript;

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
        m.globals.customElements = {define};
        // TODO -v should clean this up? Probably replace with JSDOM HTMLElement impl
        m.globals.HTMLElement.prototype.getAttribute = a => 'XYZYX getAttribute plcholder hack';
        m.globals.HTMLElement.prototype.hasChildNodes = a => false; // HACK
        m.ComponentFactory = ComponentFactoryNode;
        m.CommandMenu = CommandMenuNode;
        m.cparts.testsuite = TestSuite;

        //const element = new this.element.factory.createTestElement();
        let {inputFile, outputFile} = (config || {});
        // TODO: to finish compatibility, add null replacer here
        if (inputFile) {
            utils.patchModuloWithSSGFeatures(m, inputFile, null, outputFile);
        }
    }

    fetchFile(src, opts) {
        // Similar interface to window.fetch, except using fs.readFile
        if (this.fetchPrefix) {
            src = this.fetchPrefix + '/' + src;
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
                resolve({text, json});
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
            resolve({text, json});
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
            // Base case 1:  Prevent infinite recursion:
            // Could be caused by components being too nested (in which case
            // ssgRenderDepth should be increased) or by non-deterministic
            // components (in which case they should be deterministic!)
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
                throw new Error('Could not find factory for:', el)
            }
            webComponentsUpgrade(el, instance);
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
        this.testDom = new JSDOM(`<${this.fullName}></${this.fullName}>`);
        this.testDoc = this.testDom.window.document;
        const el = this.testDoc.querySelector(this.fullName);
        webComponentsUpgrade(el, instance); // ensure has minimum webcomponent API
        delete el.cparts.testsuite; // for testing, never include testsuite
        return el; // Finally, return the upgraded element
    }

    doTestRerender(originalElement, testInfo) {
        super.doTestRerender(originalElement, testInfo); // do default behavior
        // Now, check for any component children and ensure those get
        // upgraded as well
        // NOTE: Not sure how this will play with namespaces in the future
        // TODO: Refactor with above resolution code, after DOMRec rewrite
        let allMounted = false;
        let retries = 15; // Test render recursion depth
        let factory;
        const { factoryInstances } = baseModulo;
        while (!allMounted && (--retries > 0)) {
            const sel = (Object.keys(factoryInstances).join(',') || 'X');
            const allModElems = originalElement.querySelectorAll(sel);
            allMounted = true;
            for (const elem of allModElems) {
                if (elem.isMounted) {
                    continue;
                }
                allMounted = false;
                const lowerTag = (elem.tagName || '').toLowerCase();
                for (factory of Object.values(factoryInstances)) {
                    if (lowerTag === factory.fullName.toLowerCase()) {
                        break;
                    }
                }
                baseModulo.assert(factory, 'no fac for:', lowerTag);
                /*
                console.log('lower tag:', lowerTag);
                if (lowerTag === 'x-testbtn') {
                    console.log('------------------------------------')
                    console.log('PRE UPGRADE', originalElement.innerHTML);
                    console.log('------------------------------------')
                }
                */
                webComponentsUpgrade(elem, new factory.componentClass());
            }
        }
    }
}

ModuloNode.baseModulo = baseModulo; // gives access to imports

module.exports = ModuloNode;
