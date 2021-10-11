const baseModulo = require('./BaseModulo');
const CommandMenuNode = require('./CommandMenuNode');
const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');
const utils = require('./utils');

class ModuloNode {
    constructor() {
        this.clearAll();
        this.loadText('');
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

    loadText(text) {
        this.jsdom = new JSDOM(text);
        this.allDoms.push(this.jsdom);
        this.globals.document = this.jsdom.window.document;
        this.globals.DocumentFragment =  this.jsdom.window.DocumentFragment;
        this.doc = this.globals.document; // easier property
    }

    getHTML() {
        return this.doc.documentElement.innerHTML;
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

        //const element = new this.element.factory.createTestElement();
        let {inputFile, outputFile} = (config || {});
        // TODO: to finish compatibility, add null replacer here
        if (inputFile) {
            utils.patchModuloWithSSGFeatures(m, inputFile, null, outputFile);
        }
    }

    fetchFile(src) {
        // Similar interface to window.fetch, except using fs.readFile
        if (this.fetchPrefix) {
            src = this.fetchPrefix + '/' + src;
        }
        return new Promise((resolve, reject) => {
            fs.readFile(src, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                // support either text or json modes
                const text = () => new Promise(r => r(data));
                const json = () => new Promise(r => r(JSON.parse(data)))
                resolve({text, json});
            });
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
        /*
        console.log('defineCustomElement was called');
        if (name === 'mod-load') {
            console.log('ready to define mod-laod', name, cls);
        }
        */
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
        tries++;
        if (tries > maxDepth) {
            // Base case 1:  Prevent infinite recursion:
            // Could be caused by components being too nested (in which case ssgRenderDepth should be increased)
            // non-deterministic components (in which case they should become deterministic!)
            console.log(`WARNING: Hit limit: ssgRenderDepth=${maxDepth}`);
            return callback();
        }

        const findFac = (elem) => {
            const lowerTag = (elem.tagName || '').toLowerCase();
            for (const factory of Object.values(this.factoryInstances)) {
                if (lowerTag === factory.fullName.toLowerCase()) {
                    return factory;
                }
            }
        }

        // Loop through every element in the HTML, looking to mount them
        //          (TODO: Remove, when mod-load is removed)----------v
        const sel = Object.keys(this.factoryInstances).join(',') + ',mod-load';
        const allModElems = this.doc.querySelectorAll(sel);
        let allMounted = true;
        // TODO: needs work here, should isolate the mod-load upgrade
        // somewhere else and simplify the rest of the logic with defineComponent above
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

    defineAll() {
        baseModulo.defineAll(); // do normal behavior

        // ensure both share same fetchQ
        this.fetchQ = baseModulo.fetchQ;

        // get rid of cruft after defineAll
        this.globals.m = null; // remove 'm' shortcut
        this.commands = baseModulo.cmd; // copy commands
        baseModulo.cmd = null; // remove internal cmd
    }
}

class ComponentFactoryNode extends baseModulo.ComponentFactory {
    createTestElement() {
        const instance = new this.componentClass();
        const elemTag = `<${this.fullName}></${this.fullName}>`;
        const html = `<div>${elemTag}</div>`;
        this.testDom = new JSDOM(html);
        this.testDoc = this.testDom.window.document;
        const el = this.testDoc.querySelector(this.fullName);
        webComponentsUpgrade(el, instance); // ensure has minimum webcomponent API
        delete el.cparts.testsuite; // for testing, never include testsuite
        el.connectedCallback(); // ensure this is called, as its now connected
        return el; // Finally, return the upgraded element
    }
}

// Very simple hacky way to do mocked web-components define
function webComponentsUpgrade(el, instance) {

    // Both MOD-LOADER and ModuloElement have
    // "initialize" property, so anything we
    // upgrade will have that.
    const secondTime = Boolean(el.initialize);

    // Manually "upgrading" the JSDOM element with the webcomponent
    const protos = [instance, Reflect.getPrototypeOf(instance)];
    if (!el.tagName.startsWith('MOD-')) { // TODO: verify that this is deletable after mod-load is deleted
        // Only add in prototype of ModuloElement if necessary
        protos.push(Reflect.getPrototypeOf(protos[1]));
    }
    protos.reverse(); // apply in reverse order so last "wins"

    // Get every prototype key
    const allKeys = [];
    for (const proto of protos) {
        allKeys.push(...Reflect.ownKeys(proto));
    }

    // Loop through binding functions to element
    for (const key of allKeys) {
        if (instance[key] instanceof Function) {
            el[key] = instance[key].bind(el);
        } else {
            el[key] = instance[key];
        }
    }

    if (!secondTime) {
        // "Re-initialize" so we get innerHTML etc
        if (el.initialize) { // Is a modulo Element
            el.initialize();
        }
        if (el.connectedCallback) {
            el.connectedCallback();
        }
    }
}

ModuloNode.baseModulo = baseModulo; // gives access to imports

module.exports = ModuloNode;
