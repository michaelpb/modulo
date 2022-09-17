
// NOTE: Might not be able to complete this until the new CPartDef stuff is
// finished (would have easier Modulo silo'ing?)

// ModuloVM
Modulo.utils.ModuloVM = class ModuloVM {
    constructor() {
        this.init();
    }

    init() {
        const Modulo = {};
        const HTMLElement = this.makeHTMLElementClass();
        const customElements = this.makeCustomElements();
        const document = new HTMLElement({ nodeType: 1, tagName: 'html' });
        document.createElement = tagName => new HTMLElement(tagName);
        this.window = { document, HTMLElement, Modulo, customElements };
        Object.assign(this, this.window); // Expose window properties at top as well
    }

    makeCustomElements() {
        const elemClasses = {};//[name, elemClass] = 
        const elemClassesLC = {};
        return {
            elemClasses,
            elemClassesLC,
            define: (name, elemClass) => {
                console.log('defining!', name, elemClass);
                elemClasses[name] = elemClass;
                elemClassesLC[name.toLowerCase()] = elemClass;
            }
        };
    }

    makeHTMLElementClass() {
        class DOMNode {
            constructor(opts) {
                this.nodeType = 3; // default as text node
                this.textContent = '';
                if (opts.nodeType) {
                    Object.assign(this, opts);
                }
            }
        }

        class AttrNode {
            constructor(opts) {
                if ('value' in opts) {
                    Object.assign(this, opts);
                }
            }
            cloneNode() {
                return new AttrNode(this);
            }
        }

        class HTMLElement extends DOMNode {
            constructor(opts) {
                super(opts);
                if (typeof this.childNodes === 'undefined') {
                    this.childNodes = [];
                    this._attributeNames = [];
                    this._attributeValues = {};
                }
            }

            get children() {
                return this.childNodes.filter(({ nodeType }) => (nodeType === 1));
            }

            getAttributeNames() {
                return this._attributeNames;
            }

            getAttribute(name) {
                return this._attributeValues[name];
            }

            _makeAttributeString() {
                let s = '';
                const { escapeText } = Modulo.utils;
                for (const attrName of this.attributeNames) {
                    s += attrName;
                    const value = this._attributeValues[attrName];
                    if (value) {
                        s += '=' + (/^\w+$/.test(value) ? value :
                                    '"' + escapeText(value) + '"');
                    }
                    s += ' ';
                }
                return s.trim(); // remove space at end
            }

            setAttributeNode(node) {
                this.setAttribute(node.name, node.value);
            }

            getAttributeNode(name) {
                return new AttrNode({ name, value: this._attributeValues[name] });
            }

            hasChildNodes() {
                return this.childNodes.length > 0;
            }

            set innerHTML(text) {
                // Parse HTML, starting with very naive tokenizer
                let inTag = false;
                let tagStack = [ this ]; // put self at top of stack
                const tokenized = text.split(/[<>]/g);
                for (const token of tokenized) {
                    const topOfStack = tagStack[ tagStack.length - 1 ];
                    if (inTag === false) {
                        inTag = true; // move to next edge
                        topOfStack.childNodes.push(new DOMNode({ type: 3, textContent: token }));
                    } else if (token.startsWith('/')) {
                        inTag = false; // Closing tag, move to next edge
                        tagStack.pop(); // Pop off top of stack
                    } else {
                        // OPENING tag
                        inTag = false; // move to next edge
                        // const elemClass = this.customElements; // TODO, get class, or HTMLElement as default
                        const opts = this._parseTagOpening(token);
                        const elemClass = HTMLElement; // TODO, get class, or HTMLElement as default
                        tagStack.push(new elemClass(opts));
                    }
                }
            }

            _parseTagOpening(text) {
                const _attributeNames = [];
                const _attributeValues = {};
                const tagName = text.split(' ')[0];
                const attributeStrings = text.split(' ').slice(1);
                for (const attrString of attributeStrings) {
                    const attrName = attrString.split('=')[0];
                    const attrValueRaw = attrString.split('=').slice(1).join('=');
                    const attrValue = attrValueRaw.replace(/(^["']|["']$)/g, '')
                    _attributeNames.push(attrName);
                    _attributeValues[attrName] = attrValue;
                }
                return { _attributeNames, _attributeValues, tagName, nodeType: 1 };
            }

            get innerHTML() {
                let s = '';
                for (const child of this.children) {
                    if (child.nodeType === 3) {  // Text node
                        s += child.textContent;
                    } else {
                        s += child.outerHTML;
                    }
                }
                return s;
            }

            get outerHTML() {
                return (`<${this.tagName}${this._makeAttributeString()}>` +
                        `${this.innerHTML}</${this.tagName}>`);
            }

            querySelector(cssSelector) {
                const results = this.querySelectorAll(cssSelector);
                if (results.length) {
                    return results[0]; // TODO make more efficient
                } else {
                    return null;
                }
            }

            _selectorMatches(cssSelector) {
                const selectors = cssSelector.trim().split(',');
                for (const sel of selectors) {
                    const s = sel.trim();
                    if (s === '*') { return true; }
                    if (s === this.tagName) { return true; }
                    if (s.includes('.')) {
                        const classes = s.split('.');
                        if (classes[0]) {
                            if (classes[0] !== this.tagName) {
                                continue;
                            }
                        }
                        // TODO: implement class list
                    }
                }
                return false;
            }

            querySelectorAll(cssSelector) {
                const results = [];
                for (const node of this.children) {
                    if (node._selectorMatches(cssSelector)) {
                        results.push(node);
                    }
                    // Recurse into subnodes
                    const rec = node.querySelectorAll(cssSelector, stopAtFirst);
                    results.push(...rec);
                }
                return results;
            }
        }

        return HTMLElement;
    }

    loadBundle(onReady) {
        // Loads current page into the VM (using same settings as a bundle)
        Modulo.utils.fetchBundleData(opts => {

            // Build bundled src into JavaScript text
            const buildTemplate = new Modulo.templating.MTL(Modulo.jsBuildTemplate);
            let jsTexts = opts.scriptSources;
            jsTexts.sort((a, b) => { // TODO: Once we have stable builds, no longer needed
                if (a.startsWith("'use strict';")) { return -1; }
                if (b.startsWith("'use strict';")) { return 1; }
                return a < b ? 1 : -1;
            });
            jsTexts.push(...Modulo.assets.getAssets('js'));
            const combinedCtx = Object.assign({ jsTexts }, opts, Modulo);
            const text = buildTemplate.render(combinedCtx);
            console.log('ths is text', text.substr(text.length-100))

            // Run code "within" the "VM" and return Modulo object
            this.Modulo = this.run(text, 'Modulo');
            console.log('Loaded!', this.Modulo);

            if (onReady) {
                this.Modulo.fetchQ.wait(onReady);
            }
        });
    }

    run(text, exportCode = '') {
        const args = [ 'Modulo', 'window', 'document', 'HTMLElement' ];
        const code = `${ text }\n\n return ${ exportCode };`;
        const func = Modulo.assets.registerFunction(args, code);
        return func(this.Modulo, this.window, this.document, this.HTMLElement);
    }
}

/*
Modulo.utils.createTestDocument = function createTestDocument() {
      const doc = {};
      const win = { document: doc };
      // TODO
      win.HTMLElement = Modulo.reconcilers.VirtualDom.makeHTMLElementClass(win);
      document.createElement = tagName => new win.HTMLElement(tagName);
      return doc; // later return win
}
*/

