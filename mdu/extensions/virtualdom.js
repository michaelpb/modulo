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

// Thanks to Jason Miller for greatly inspiring this parser code
// // https://github.com/developit/htmlParser/blob/master/src/htmlParser.js
Modulo.virtualdom.regexps = {
    // TODO: Swap out CDATA parser for SCRIPT, since we don't need to parse
    // CDATA, but we do need to parse SCRIPT which is supposed to be parsed the
    // same way.
    //splitAttrsTokenizer: /([a-z0-9_\:\-]*)\s*?=\s*?(['"]?)(.*?)\2\s+/gim,
    //splitAttrsTokenizer: /\s*([^=\s]+)\s*?=?\s*?(['"]?)(.*?)\2\s+/gim,
    splitAttrsTokenizer: /\s*([^=\s]+)\s*(=?)(['"]?)/gim,
    domParserTokenizer: /(?:<(\/?)([a-zA-Z][a-zA-Z0-9\:]*)(?:\s([^>]*?))?((?:\s*\/)?)>|(<\!\-\-)([\s\S]*?)(\-\->)|(<\!\[CDATA\[)([\s\S]*?)(\]\]>))/gm,
};

Modulo.virtualdom.selfClosing = new Set([ 'area', 'base', 'br', 'col',
                  'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link',
                  'meta', 'param', 'source', 'track', 'wbr' ]);

Modulo.virtualdom.parse = function parse(parentElem, text) {
    const { splitAttrsTokenizer, domParserTokenizer } = Modulo.virtualdom.regexps;
    const { ownerDocument } = parentElem;
    const { HTMLElement } = Modulo.virtualdom;
    let elemClassesLC = {};
    if (ownerDocument.moduloVmParent.customElements) {
        elemClassesLC = ownerDocument.moduloVmParent.customElements.elemClassesLC;
    }

    const tagStack = [ parentElem ]; // put self at top of stack

    let lastMatchEnd = 0;
    let topOfStack = parentElem;
    let skipParsing = null;

    // If there's leading text, create a TextNode with that as content
    const checkAndPushLeadingText = (node, index) => {
        const textContent = text.slice(lastMatchEnd, index);
        if (textContent) { // Add object for TextNode if any text matches
            node.childNodes.push({ nodeType: 3, textContent });
        }
    };

    for (const match of text.matchAll(domParserTokenizer)) {
        // TODO: Refactor this, there's low hanging fruit
        const topOfStack = tagStack[ tagStack.length - 1 ];
        if (skipParsing !== null) {
            topOfStack._unparsedContent += text.slice(lastMatchEnd, match.index);
        } else {
            checkAndPushLeadingText(topOfStack, match.index); // Handle leading text
        }

        lastMatchEnd = match.index + match[0].length;

        if (skipParsing !== null) {
           if (match[1] === '/' && match[2].toLowerCase() === skipParsing) {
                skipParsing = null; // Found the end, "turn of" skipUntil
                tagStack.pop(); // And finally pop off element
            } else {
                topOfStack._unparsedContent += match[0]; // add text
            }

        } else if (match[5]) { // COMMENT - In this implementation, discard text
            topOfStack.childNodes.push(new HTMLElement({ nodeType: 8 }));

        } else if (match[1] === '/') { // CLOSE - Pop parent tag
            tagStack.pop();

        } else { // OPEN - construct new element
            const tagLC = match[2].toLowerCase();
            const elem = tagLC.includes('-') && (tagLC in elemClassesLC) ?
                        new elemClassesLC[tagLC]() :
                        ownerDocument.createElement(tagLC);
            elem._setAttrString(match[3]);
            if (elem._isSelfClosing(topOfStack)) {
                tagStack.pop();
                tagStack[ tagStack.length - 1 ].push(elem);
            } else {
                topOfStack.childNodes.push(elem);
            }
            tagStack.push(elem);
            skipParsing = elem._getSkipParsingUntil();
        }
    }
    checkAndPushLeadingText(parentElem, text.length); // Handle trailing text
}


Modulo.virtualdom.HTMLElement = class HTMLElement extends Modulo.virtualdom.Element {
    constructor(opts) {
        super(Object.assign({
            childNodes: [],
            parentNode: null,
            nodeType: 1,
            _parentIndex: -1,
            _textContent: '',
            _unparsedContent: '',
            _attributeNames: [],
            _attributeValues: {},
        }, opts));
        if (this.tagName) { // Store tagnames in all-caps
            this.tagName = this.tagName.toUpperCase();
        }
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.chidNodes.splice(this._parentIndex, 1);
            this.parentNode = null;
            this._parentIndex = -1;
        }
    }

    append(...items) {
        for (const item of items) {
            if (item.remove) {
                item.remove(); // try removing, in case has parentNode
            }
            item.parentNode = this;
            item._parentIndex = this.childNodes.length;
            this.childNodes.push(item);
        }
    }

    appendChild(...items) {
        this.append(...items);
    }

    isEqualNode(other) {
        // TODO: See if storing outerHTML hashed is a cheap speedup for isEqualNode
        return this.outerHTML === other.outerHTML;
    }

    get firstChild() {
        return this.childNodes.length > 0 ? this.childNodes[0] : null;
    }

    get nextSibling() {
        if ((this._parentIndex + 1) >= this.parentNode.childNodes.length) {
            return null;
        }
        return childNodes[this._parentIndex + 1];
    }

    get previousSibling() {
        if (this._parentIndex <= 0) {
            return null;
        }
        return this.parentNode.childNodes[this._parentIndex - 1];
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

    hasAttribute(name) {
        return name in this._attributeValues;
    }

    _makeAttributeString() {
        let s = '';
        const { escapeText } = Modulo.templating.MTL.prototype;
        // TODO: Add single quotes for JSON strings for canonical formatting
        const attrVal = v => /^[\w\.]+$/.test(v) ? v : `"${ escapeText(v) }"`;
        for (const attrName of this._attributeNames) {
            const value = this._attributeValues[attrName];
            s += ' ' + attrName + (value ? '=' + attrVal(value) : '');
        }
        return s;
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
        this.childNodes = []; // clear contents
        Modulo.virtualdom.parse(this, text);
    }

    _setAttrString(text) {
        const nextToken = regexp => { // Simple parser, consumes until regexp
            const match = text.match(regexp) || { 0: '', index: text.length };
            const leadingText = text.substr(0, match.index); // Get previous
            text = text.substr(match.index + match[0].length); // Consume text
            return [ leadingText, match ]; // Return previous text and match
        };
        while (text) { // Stop when text is empty ('' is falsy)
            const [ name, match ] = nextToken(/\s*([= ])\s*(['"]?)/);
            this._attributeNames.push(name); // Add to attr names list
            this._attributeValues[name] = !match[1] ? '' : // Attribute only
                nextToken(match[2] ? match[2] : ' ')[0]; // Quote or space delim
        }
    }

    _isSelfClosing(potentialParent) {
        return false;
        // Broken logic below:
        const lc = this._lcName;
        return Modulo.virtualdom.selfClosing.has(lc) && lc === potentialParent.tagName;
    }

    _getSkipParsingUntil() {
        const lc = this._lcName;
        return (lc === 'template' || lc === 'script') ? lc : null;
    }

    get _lcName() {
        return (this.tagName || '').toLowerCase();
    }

    get _moduloTagName() {
        const lc = this._lcName;
        if (lc in Modulo.cparts) {
            return Modulo.cparts[lc].name;
        }
        return lc;
    }

    get innerHTML() {
        /*
        if (this._unparsedContent) {
            return this._unparsedContent;
        }
        */
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
        if (!this.tagName) { // (Comment behavior)
            return ''; // TODO: Create proper class hierarchy to solve this
        }
        return (`<${ this._moduloTagName }${ this._makeAttributeString() }>` +
                `${ this.innerHTML }</${ this._moduloTagName }>`);
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
        for (const node of this.children) { // loop through element nodes
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
            document.HTMLElement = HTMLElement;
            document.documentElement = document; // not sure if i need this
            return document;
        };
        const document = createHTMLDocument('modulovm');
        const HTMLElement = document.HTMLElement;
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
            //console.log('ths is text', text.substr(text.length-100))

            // Run code "within" the "VM" and return Modulo object
            this.Modulo = this.run(text, 'Modulo');
            //console.log('Loaded!', this.Modulo);

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

