// WIP, mostly incomplete

// NOTE: Might not be able to complete this until the new CPartDef stuff is
// finished (would have easier Modulo silo'ing?)

if (!Modulo.virtualdom) Modulo.virtualdom = {};

Modulo.virtualdom.Element = class Element {
    constructor(opts) {
        if (opts.nodeType) {
            Object.assign(this, opts);
        } else {
            this.nodeType = 3; // default as text node
            this._textContent = opts || '';
        }
    }
}

Modulo.virtualdom.Attr = class Attr {
    constructor(opts) {
        if ('value' in opts) {
            Object.assign(this, opts);
        }
    }
    cloneNode() {
        return new Modulo.virtualdom.Attr(this);
    }
}

Modulo.virtualdom.parse = function parse(parentElem, text) {
    // TODO: Move parser to separate function, and clean up
    // Parse HTML, starting with very naive tokenizer

    // TODO: Pass in ownerDocument instead
    const { Element } = Modulo.virtualdom;
    //const { HTMLElement, customElements } = parentElem.ownerDocument.moduloVmParent;
    const { customElements } = parentElem.ownerDocument.moduloVmParent;

    let inTag = false;
    let skipParsingUntil = null;
    let tagStack = [ parentElem ]; // put self at top of stack

    const tokenized = text.split(/[<>]/g);
    for (const token of tokenized) {
        const topOfStack = tagStack[ tagStack.length - 1 ];
        if (skipParsingUntil) {
            if (token.toLowerCase() === skipParsingUntil.toLowerCase()) {
                skipParsingUntil = null; // Found the end, "turn of" skipUntil
                tagStack.pop(); // And finally pop off element
            } else {
                topOfStack._unparsedContent += token;
            }
            continue;
        }

        if (inTag === false) { // In text
            //console.log('TEXT:', token);
            inTag = true; // move to next edge
            topOfStack.childNodes.push(new Element(token));
        } else if (token.startsWith('!--')) {
            // Comment, for now comment nodes are ignored
            inTag = false; // Closing tag, move to next edge
        } else if (token.startsWith('/')) {
            //console.log('CLOSE:', token);
            inTag = false; // Closing tag, move to next edge
            tagStack.pop(); // Pop off top of stack
        } else {
            //console.log('OPEN:', token);
            // OPENING tag
            inTag = false; // move to next edge
            let elemClass = parentElem.ownerDocument.moduloVmParent.HTMLElement;
            //let elemClass = HTMLElement;
            const opts = parentElem._parseTagOpening(token);
            let elem;
            if (opts.tagName.includes('-')) {
                const lc = opts.tagName.toLowerCase();
                if (lc in customElements.elemClassesLC) { // if it exists
                    elemClass = customElements.elemClassesLC[lc];
                    elem = new elemClass(opts)
                } else {
                    console.log('Unknown customElement:', opts.tagName);
                }
            }

            if (!elem) {
                elem = parentElem.ownerDocument.createElement(opts.tagName);
                Object.assign(elem, opts);
            }
            if (elem._shouldSkipParsing) {
                skipParsingUntil = '/' + elem.tagName;
            }
            topOfStack.childNodes.push(elem);
            tagStack.push(elem);
        }
    }

}

Modulo.virtualdom.HTMLElement = class HTMLElement extends Modulo.virtualdom.Element {
    constructor(opts) {
        super(Object.assign({
            childNodes: [],
            parentNode: null,
            //nextSibling: null, // Might be a faster way that just keeps track
            //previousSibling: null,
            nodeType: 1,
            _textContent: '',
            _unparsedContent: '',
            _attributeNames: [],
            _attributeValues: {},
        }, opts));
    }

    append(...items) {
        for (const item of items) {
            item.parentNode = this;
            item._parentIndex = this.childNodes.length;
            this.childNodes.push(item);
        }
    }

    appendChild(...items) {
        this.append(...items);
    }

    get nextSibling() {
        const { childNodes} = this.parentNode;
        if ((this._parentIndex + 1) >= childNodes.length) {
            return null;
        }
        return childNodes[this._parentIndex + 1];
    }

    get previousSibling() {
        if (this._parentIndex > 0) {
            return null;
        }
        return this.parentNode[this._parentIndex - 1];
    }

    get content() {
        if ('_content' in this) {
            return this._content;
        }
        if (!this.tagName || this.tagName.toLowerCase() !== 'template') {
            return undefined;
        }
        this._content = this.ownerDocument.createElement('contentnode');
        this._content.innerHTML = this._unparsedContent;
        this._unparsedContent = '';
        return this._content;
    }

    get textContent() {
        if (this.nodeType === 3) {  // Text node, return directly
            return this._textContent;
        } else if (!this.tagName) {
            return undefined;
        } else if (this.tagName.toLowerCase() === 'script') {
            return this._unparsedContent || this._textContent; // just send content as well
        } else { // Another type, combine all children
            return this.childNodes.map(c => c.textContent).join('');
        }
    }

    set textContent(value) {
        this.innerHTML = '';
        this._textContent = value;
        this._unparsedContent = '';
        if (this.tagName && this.tagName.toLowerCase() === 'script') {
            // If it's a script, evaluate immediately
            this.ownerDocument.moduloVmParent.run(this._textContent);
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

    setAttribute(name, value) {
        this._attributeValues[name] = value;
        if (!this._attributeNames.includes(name)) {
            this._attributeNames.push(name);
        }
    }

    _makeAttributeString() {
        let s = '';
        const { escapeText } = Modulo.templating.MTL.prototype;
        for (const attrName of this._attributeNames) {
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
        const { Attr } = Modulo.virtualdom;
        return new Attr({ name, value: this._attributeValues[name] });
    }

    hasChildNodes() {
        return this.childNodes.length > 0;
    }

    set innerHTML(text) {
        const { parse } = Modulo.virtualdom;
        this.childNodes = []; // clear contents
        parse(this, text);
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

    get _shouldSkipParsing() {
        if (!this.tagName) {
            return undefined;
        }
        const lc = this.tagName.toLowerCase();
        return lc && (lc === 'template' || lc === 'script');
    }

    get innerHTML() {
        if (this._unparsedContent) {
            return this._unparsedContent;
        }
        const { escapeText } = Modulo.templating.MTL.prototype;
        let s = '';
        for (const child of this.childNodes) {
            if (child.nodeType === 3) {  // Text node
                s += escapeText(child.textContent);
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
            const rec = node.querySelectorAll(cssSelector);
            results.push(...rec);
        }
        return results;
    }
}


// ModuloVM
Modulo.virtualdom.ModuloVM = class ModuloVM {
    constructor() {
        this.init(Modulo.virtualdom);
    }

    init(virtualdom) {
        const Modulo = {};
        const customElements = this.makeCustomElements();
        const createHTMLDocument = title => {
            const document = new virtualdom.HTMLElement({ nodeType: 1, tagName: 'html' });

            // Define "Enhanced" HTMLElement, which has ownerDocument built-in
            class HTMLElement extends virtualdom.HTMLElement {
                get ownerDocument () {
                    return document;
                }
            }

            document.moduloVmParent = this; // include back reference
            document.createElement = tagName => new HTMLElement({ nodeType: 1, tagName });
            document.head = document.createElement('head');
            document.body = document.createElement('body');
            const titleNode = document.createElement('title');
            titleNode.textContent = title;
            document.head.append(titleNode);
            document.implementation = { createHTMLDocument };
            document.documentElement = document; // not sure if i need this
            return document;
        };
        const document = createHTMLDocument('modulovm');
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
                //console.log('defining!', name, elemClass);
                elemClasses[name] = elemClass;
                elemClassesLC[name.toLowerCase()] = elemClass;
            }
        };
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
      document.createElement = tagName => new win.HTMLElement(tagName);
      return doc; // later return win
}
*/

