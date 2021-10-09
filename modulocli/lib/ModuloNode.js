const baseModulo = require('./BaseModulo');
const CommandMenuNode = require('./CommandMenuNode');
const fs = require('fs');
const pathlib = require('path');
const {JSDOM} = require('jsdom');
//const utils = require('./utils');

class ModuloNode {
    constructor() {
        this.clearAll();
    }

    loadText(text) {
        this.jsdom = new JSDOM(text);
        this.allDoms.push(this.jsdom);
        this.globals.document = this.jsdom.window.document;
        this.globals.DocumentFragment =  this.jsdom.window.DocumentFragment;
        this.doc = this.globals.document; // easier property
    }

    getHTML() {
        return this.jsdom.window.document.innerHTML;
    }

    patchModulo(m) {
        m.isBackend = true;
        m.moduloNode = this;
        m.globals.fetch = this.fetchFile.bind(this);
        const define = this.defineCustomElement.bind(this);
        m.globals.customElements = {define};
        // TODO -v should clean this up? Probably replace with JSDOM HTMLElement impl
        m.globals.HTMLElement.prototype.getAttribute = a => 'XYZYX getAttribute plcholder hack';
        m.globals.HTMLElement.prototype.hasChildNodes = a => false; // HACK
        m.ComponentFactory = ComponentFactoryNode;
        m.CommandMenu = CommandMenuNode;
        //const element = new this.element.factory.createTestElement();
    }

    fetchFile(src) {
        // Similar interface to window.fetch, except using fs.readFile
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

    defineAll(config) {
        const {verbose} = config;
        if (!this.doc) {
            if (verbose) {
                console.warn('Modulo Warning: No preloaded document(s) specified');
            }
            baseModulo.CommandMenu.setup(); // just do command setup
            const fetchQ = new this.FetchQueue();
            baseModulo.fetchQ = fetchQ;
            this.fetchQ = fetchQ;
        } else {
            baseModulo.defineAll(); // do normal behavior
        }
        this.globals.m = null; // remove 'm' shortcut
        this.commands = baseModulo.cmd; // copy commands
        //delete this.commands.target; // frontend only
        //delete this.commands.clear; // frontend only
        // Target works in CLI too, will show text of element matching
        // selector, in repl mode!
        baseModulo.cmd = null; // remove internal cmd
    }

    clearAll() {
        baseModulo.factoryInstances = {};
        this.patchModulo(baseModulo);
        const {defineAll} = this;
        Object.assign(this, baseModulo, this); // in conflicts, "this" wins
        delete this.moduloNode; // prevent ugly ref loop
        this.doc = null;
        this.allDoms = [];
        this.defineAll = defineAll.bind(this); // ensure bound
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
function webComponentsUpgrade(el, instance, secondTime=false) {
    // Manually "upgrading" the JSDOM element with the webcomponent
    const protos = [instance, Reflect.getPrototypeOf(instance)];
    if (!el.tagName.startsWith('MOD-')) { // TODO: verify that this is deletable after mod-load is deleted
        protos.push(Reflect.getPrototypeOf(protos[1]));
    }
    protos.reverse();

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
    // "Re-initialize" so we get innerHTML etc
    if (el.lifecycle) { // Is a modulo Element
        el.initialize();
    }
    if (el.connectedCallback && !secondTime) {
        el.connectedCallback();
    }
}

ModuloNode.baseModulo = baseModulo; // gives access to imports

module.exports = ModuloNode;
