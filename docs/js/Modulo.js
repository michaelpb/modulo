'use strict';
// # Note
// Earlier versions of Modulo.js's source code were written with "literate
// programming". Most of this documentation has been deleted, but will be
// rewritten in this style once the public API is settled. Until then, the code
// is a mess, riddled with TODO's, not "literate" and thus merely aspires to
// much better comments, formatting, lower complexity, etc.

if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
if (typeof Modulo === 'undefined') {
    var Modulo = {}; // TODO: have it instantiate a Modulo instance instead
}

Object.assign(Modulo, {
    globals: { HTMLElement }, // globals is window in Browser, an obj in Node.js
    reconcilers: {}, // used later, for custom DOM Reconciler classes
    cparts: {}, // used later, for custom CPart classes
    templating: {}, // used later, for custom Templating languages
});

Modulo.defineAll = function defineAll() { // NEEDS REFACTOR after config stack
    Modulo.fetchQ.wait(() => {
        const query = 'template[modulo-embed],modulo';
        for (const elem of Modulo.globals.document.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            Modulo.globalLoader.loadString(elem.innerHTML);
        }
    });
};

Modulo.ComponentPart = class ComponentPart {
    static getAttrDefaults(node, loader) {
        return {};
    }

    static loadCallback(node, loader) {
        const defaults = this.getAttrDefaults(node, loader);
        const attrs = Modulo.utils.mergeAttrs(node, defaults);
        // TODO is this still useful? --v
        const content = node.tagName.startsWith('TE') ? node.innerHTML
                                                      : node.textContent;
        return { attrs, content, dependencies: attrs.src || null };
    }

    static loadedCallback(data, content) {
        data.content = (data.content || '') + (content || '');
    }

    static factoryCallback() {}

    getDirectives() {
        return [];
    }

    constructor(element, options) {
        this.element = element;
        this.content = options.content;
        this.attrs = options.attrs;
    }
}

Modulo.Loader = class Loader {
    constructor(element = null, options = { attrs: {} }) {
        if (element === null) {
            // LEGACY constructor interface
            this.element = element;
            this.content = options.content;
            this.attrs = options.attrs;
            this.src = this.attrs.src;
        } else {
            throw new Error('Not supported yet')
        }

        this.config = {};
        //this.config = Object.freeze(Object.assign({}, Modulo));

        // TODO: Do some sort of "fork" of cparts Object to allow CPart namespacing
        this.cparts = Modulo.cparts;

        // TODO: "Namespace", should be "global-namespace"?
        // If loader.namespace = null, cause defaulting to hash.
        this.namespace = this.attrs.namespace;
        this.localNameMap = {};
        this.hash = 'zerohash'; // the hash of an unloaded loader
    }

    _stringToDom(text) {
        const { cleanWord } = Modulo.utils;
        // TODO: Refactor duped / hacky / messy code
        const tmp_Cmp = new this.cparts.component({}, {});
        tmp_Cmp.dataPropLoad = tmp_Cmp.dataPropMount;
        const rec = new Modulo.reconcilers.ModRec({
            directives: { 'config.dataPropLoad': tmp_Cmp },
            directiveShortcuts: [ [ /:$/, 'config.dataProp' ] ],
        });

        // TODO refactor this as well, make it a configurable thing on CParts
        const replaceTags = [ 'Template' ]; // Object.keys(this.cparts)
        const reText = replaceTags.map(tag => `</?${tag}[\\s>]`).join('|');
        const tagRegExp = RegExp(reText, 'g');
        const changeToScript = tagText => tagText.startsWith('</') ? '</script>'
            : ('<script type="modulo/' + cleanWord(tagText) + '"' +
                tagText[tagText.length - 1]);
        const scriptifiedText = text.replace(tagRegExp, changeToScript);
        //const elem = rec.loadString(text, {});

        const elem = rec.loadString(scriptifiedText, {});
        return elem;  // <-- NOTE: _stringToDom is used in TestSuite
    }

    loadString(text, newSrc = null) {
        Modulo.assert(text, 'Text must be a non-empty string, not', text)
        if (newSrc) {
            this.src = newSrc;
        }
        //this.data = this.loadFromDOMElement(Modulo.utils.makeDiv(text));
        const elem = this._stringToDom(text);
        this.loadFromDOMElement(elem);
        this.hash = Modulo.utils.hash(this.hash + text); // update hash
    }

    loadFromDOMElement(elem) {
        const array = [];
        const nodes = elem.content ? elem.content.childNodes : elem.children;
        for (const node of nodes) {
            const cPartName = this.getNodeCPartName(node);
            if (!cPartName) {
                continue;
            }
            const cpartClass = this.cparts[cPartName];
            const data = cpartClass.loadCallback(node, this, array);
            array.push([ cPartName, data ]);

            if (data.dependencies) {
                // Ensure any CPart dependencies are loaded (relative to src)
                const basePath = Modulo.utils.resolvePath(this.src, '..');
                const loadCb = cpartClass.loadedCallback.bind(cpartClass);
                const cb = (text, label, src) => loadCb(data, text, label, this, src);
                Modulo.fetchQ.enqueue(data.dependencies, cb, basePath);
            }

            if (cpartClass.childrenLoadedCallback) { // a factory type
                data.children = this.loadFromDOMElement(node);
                const cb = cpartClass.childrenLoadedCallback.bind(cpartClass);

                // Wait for enqueued loads (side-effect of loadFromDOMElement)
                Modulo.fetchQ.wait(() => cb(data.children, this, data));
            }
        }
        return array;
    }

    // ## Loader.getNodeCPartName
    // Helper function that determines the CPart name from a DOM node.
    getNodeCPartName(node) {
        const { tagName, nodeType, textContent } = node;

        // node.nodeType equals 1 if the node is a DOM element (as opposed to
        // text, or comment). Ignore comments, tolerate empty text nodes, but
        // warn on others (since those are typically syntax mistakes).
        if (nodeType !== 1) {
            // Text nodes, comment nodes, etc
            if (nodeType === 3 && textContent && textContent.trim()) {
                console.error('Modulo.Loader: Unexpected text:', textContent);
            }
            return null;
        }

        // Determine the name: The tag name, or the type attribute in the case
        // of the alt script-tag syntax (eg `<script type="modulo/Template">`)
        let cPartName = tagName.toLowerCase(); // rm this, once its cparts.Template // TODO
        const splitType = (node.getAttribute('type') || '').split('/');
        if (splitType[0] && splitType[0].toLowerCase() === 'modulo') {
            cPartName = splitType[1];
            cPartName = cPartName.toLowerCase(); // rm this, once its cparts.Template // TODO
        }
        if (!(cPartName in this.cparts)) {
            console.error('Modulo.Loader: Unknown CPart def:', tagName);
            return null;
        }
        return cPartName;
    }
}

Modulo.cparts.load = class Load extends Modulo.ComponentPart {
    static loadedCallback(data, content, label, loader, src) {
        const attrs = Object.assign({ namespace: 'x' }, data.attrs, { src });
        data.loader = new Modulo.Loader(null, { attrs });
        data.loader.config = Object.assign({}, loader.config);
        // Maybe instead (allow use of attrs):
        //data.loader.config = Object.assign({}, loader.config, data.attrs);
        data.loader.loadString(content);
    }

    initializedCallback(renderObj) {
        this.localNameMap = this.element.factory().loader.localNameMap;
    }

    transformTagLoad({ el }) {
        // dead code, but can come to life
        const newTag = this.localNameMap[el.tagName.toLowerCase()];
        if (newTag) {
            Modulo.utils.transformTag(el, newTag);
        }
    }
}

Modulo.cparts.library = Modulo.cparts.load; // ALIAS, as we transition to Library nomenclature

Modulo.ComponentFactory = class ComponentFactory {
    constructor(loader, name, childrenLoadObj) {
        this.loader = loader;
        this.config = this.loader.config;
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;

        this.isModule = this.loader.namespace === name; // if name = namespace
        Modulo.ComponentFactory.registerInstance(this);

        this.componentClass = this.createClass();
        this.childrenLoadObj = childrenLoadObj;
        this.baseRenderObj = this.runFactoryLifecycle(this.childrenLoadObj);
    }

    runFactoryLifecycle(cPartOpts) {
        const baseRenderObj = {};
        for (let [ cPartName, data ] of cPartOpts) {
            const cpCls = Modulo.cparts[cPartName];
            data = cpCls.factoryCallback(data, this, baseRenderObj) || data;
            baseRenderObj[cPartName] = data;
        }
        return baseRenderObj;
    }

    createClass() {
        // Create the class that the browser will use to actually instantiate
        // each Modulo Element (e.g. Component)
        const { fullName } = this;
        return class CustomElement extends Modulo.Element {
            factory() {
                /* Gets current registered component factory (for hot-reloading) */
                return Modulo.factoryInstances[fullName];
            }
        };
    }

    buildCParts(element) {
        // This function does the heavy lifting of actually constructing a
        // component, and is invoked when the component is mounted to the page.
        element.cparts = { element }; // Include "element", for lifecycle method
        element.cpartSpares = {}; // no need to include, since only 1 element

        // Loop through the parsed array of objects that define the Component
        // Parts for this component, checking for errors.
        for (const [name, partOptions] of this.childrenLoadObj) {
            Modulo.assert(name in Modulo.cparts, `Unknown cPart: ${name}`);
            if (!(name in element.cpartSpares)) {
                element.cpartSpares[name] = [];
            }
            const instance = new Modulo.cparts[name](element, partOptions);
            element.cpartSpares[name].push(instance);
            element.cparts[name] = instance;
        }
    }

    createTestElement() {
        const element = new this.componentClass();
        delete element.cparts.testsuite; // for testing, never include testsuite
        element.connectedCallback(); // ensure this is called
        return element;
    }

    doTestRerender(elem, testInfo) {
        elem.rerender(); // presently no other steps
    }

    register() {
        // Register the Custom Web Component with the browser
        const tagName = this.fullName.toLowerCase();

        // TODO: This is actually the "biggest" try-catch, catching defining a
        // new component. Need to work on better error messages here.
        try {
            //console.log('registering ', tagName, this.componentClass);
            Modulo.globals.customElements.define(tagName, this.componentClass);
        } catch (err) {
            console.log('Modulo: Error with new component:', err);
        }
    }

    static registerInstance(instance) {
        // Keep a central location of all component factories defined.
        if (!Modulo.factoryInstances) {
            Modulo.factoryInstances = {};
        }
        Modulo.factoryInstances[instance.fullName] = instance;

        const lcName = instance.name.toLowerCase();
        if (instance.isModule) {
            // TODO: Dead-ish feature: not sure how useful this is, or if only
            // "local" modules are typically used. Ideally this should be based
            // on local module names / localNameMap, not global namespaces.
            if (!Modulo.modules) {
                Modulo.modules = {};
            }
            Modulo.modules[lcName] = instance.baseRenderObj;
        } else {
            // "Register" local name with loader, and instance in general
            // TODO: Have localNameMap propagate up, as long as there is no
            // "namespace" attribute (namespace rename is TBD). That way,
            // localNameMap "dumps" into the upper one.
            instance.loader.localNameMap[lcName] = instance.fullName;
        }
    }
}

Modulo.Element = class ModuloElement extends HTMLElement {
    constructor() {
        super();
        this.initialize();
    }

    getDirectives() {
        return []; // TODO: after moving more into Factory, maybe remove, and also remove from lifecycle?
    }

    initialize() {
        this.cparts = {};
        this.isMounted = false;
        this.isModulo = true;
        this.originalHTML = null;
        this.originalChildren = [];
        this.fullName = this.factory().fullName;
        this.initRenderObj = Object.assign({}, this.factory().baseRenderObj);
    }

    setupCParts() {
        this.factory().buildCParts(this);
    }

    rerender(original = null) {
        if (original) { // TODO: this logic needs refactor
            if (this.originalHTML === null) {
                this.originalHTML = original.innerHTML;
            }
            this.originalChildren = Array.from(original.hasChildNodes() ?
                                               original.childNodes : []);
        }
        this.lifecycle([ 'prepare', 'render', 'reconcile', 'update' ]);
    }

    lifecycle(lifecycleNames, rObj={}) {
        this.renderObj = Object.assign({}, rObj, this.getCurrentRenderObj());
        for (const lc of lifecycleNames) {
            for (const [ cpartName, cPart ] of Object.entries(this.cparts)) {
                const method = cPart[lc + 'Callback'];
                if (method) {
                    const result = method.call(cPart, this.renderObj);
                    if (result) {
                        this.renderObj[cpartName] = result;
                    }
                }
            }
        }
        //this.renderObj = null; // ?rendering is over, set to null
    }

    getCurrentRenderObj() {
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }

    connectedCallback() {
        if (this.isMounted) {
            return; // TODO: possibly just return?
        }

        if (Modulo.isBackend) {
            this.parsedCallback(); // ensure synchronous
        } else {
            // TODO Consider putting all async into single queue / loop
            setTimeout(this.parsedCallback.bind(this), 0);
        }
    }

    parsedCallback() {
        let original = this;
        if (this.hasAttribute('modulo-original-html')) {
            original = Modulo.utils.makeDiv(this.getAttribute('modulo-original-html'));
        }
        this.setupCParts();
        this.lifecycle([ 'initialized' ]);
        this.rerender(original); // render and re-mount it's own childNodes

        // XXX - TODO: Needs refactor, should do this somewhere else:
        if (this.hasAttribute('modulo-original-html')) {
            const { reconciler } = this.cparts.component;
            reconciler.patch = reconciler.applyPatch; // Apply patches immediately
            reconciler.patchAndDescendants(this, 'Mount');
            reconciler.patch = reconciler.pushPatch;
        }
        // XXX --------------------------
        this.isMounted = true;
    }
}

Modulo.FactoryCPart = class FactoryCPart extends Modulo.ComponentPart {
    static childrenLoadedCallback(childrenLoadObj, loader, data) {
        const partName = this.name.toLowerCase(); // "this" refers to the class
        let name = partName === 'module' ? loader.namespace : data.attrs.name;
        if (data.attrs.hackname) {
            name = data.attrs.hackname;
        }
        //childrenLoadObj.push([partName, data]);
        childrenLoadObj.unshift([ partName, data ]); // Add "self" as CPart
        Modulo.fetchQ.wait(() => { // Wait for all dependencies to finish resolving
            const factory = new Modulo.ComponentFactory(loader, name, childrenLoadObj);
            factory.register();
        });
    }
}

Modulo.cparts.config = class Config extends Modulo.ComponentPart {
    static loadCallback(node, loader, array) {
        loader.config = Modulo.utils.mergeAttrs(node, loader.config);
        return Modulo.ComponentPart.loadCallback(node, loader, array);
    }
    static factoryCallback(opts, factory, loadObj) {
        return factory.loader.config;
    }
}

Modulo.cparts.module = class Module extends Modulo.FactoryCPart { }

Modulo.cparts.component = class Component extends Modulo.FactoryCPart {
    static getAttrDefaults() {
        return {
            mode: 'regular',
            rerender: 'event',
            engine: 'ModRec',
        };
    }

    static factoryCallback(opts, factory, loadObj) {
        opts.directiveShortcuts = [
            [ /^@/, 'component.event' ],
            [ /:$/, 'component.dataProp' ],
        ];
    }

    headTagLoad({ el }) {
        //el.remove();
        // DAED CODE
        this.element.ownerDocument.head.append(el); // move to head
    }

    metaTagLoad({ el }) {
        // TODO: Refactor the following
        this.element.ownerDocument.head.append(el); // move to head
    }

    linkTagLoad({ el }) {
        // TODO: Refactor the following
        this.element.ownerDocument.head.append(el); // move to head
    }

    titleTagLoad({ el }) {
        // TODO: Refactor the following
        this.element.ownerDocument.head.append(el); // move to head
    }

    scriptTagLoad({ el }) {
        const newScript = el.ownerDocument.createElement('script');
        newScript.src = el.src; // TODO: Possibly copy other attrs?
        el.remove(); // delete old element
        this.element.ownerDocument.head.append(newScript);
    }

    initializedCallback(renderObj) {
        this.localNameMap = this.element.factory().loader.localNameMap;
        this.mode = this.attrs.mode || 'regular'; // TODO rm and check tests
        if (this.mode === 'shadow') {
            this.element.attachShadow({ mode: 'open' });
        }
        this.newReconciler(this.element.initRenderObj.component);
    }

    getDirectives() {
        const dirs = [
            'component.dataPropMount',
            'component.dataPropUnmount',
            'component.eventMount',
            'component.eventUnmount',
            //'component.childrenLoad',
            'component.slotLoad',
        ];
        if (this.attrs.mode === 'vanish-into-document') {
            dirs.push('link', 'title', 'meta', 'script');
        }
        if (this.attrs.mode !== 'shadow') {
            // TODO: clean up Load callbacks, either eliminate slotLoad (and
            // discontinue [component.slot]) in favor of only slotTagLoad, or
            // refactor somehow
            dirs.push('slot');
            this.slotTagLoad = this.slotLoad.bind(this);
        }
        return dirs;
    }

    newReconciler({ directiveShortcuts }) {
        const opts = { directiveShortcuts, directives: [] };
        for (const cPart of Object.values(this.element.cparts)) {
            for (const directiveName of cPart.getDirectives()) {
                opts.directives[directiveName] = cPart;
            }
        }
        this.reconciler = new Modulo.reconcilers[this.attrs.engine](opts);
    }

    prepareCallback() {
        const { originalHTML } = this.element;
        return { originalHTML, innerHTML: null, patches: null };
    }

    reconcileCallback(renderObj) {
        let { innerHTML, patches, root } = renderObj.component;
        if (innerHTML !== null) {

            // XXX ----------------
            // HACK for vanish-into-document to preserve Modulo stuff
            if (this.mode === 'vanish-into-document') {
                const dE = this.element.ownerDocument.documentElement;
                const elems = dE.querySelectorAll('template[modulo-embed],modulo');
                this.element.ownerDocument.head.append(...Array.from(elems));
            }
            // XXX ----------------


            if (this.mode === 'regular' || this.mode === 'vanish') {
                root = this.element; // default, use element as root
            } else if (this.mode === 'shadow') {
                root = this.element.shadowRoot;
            } else if (this.mode === 'vanish-into-document') {
                root = this.element.ownerDocument.body; // render into body
            } else {
                Modulo.assert(this.mode === 'custom-root', 'Err:', this.mode);
            }
            patches = this.reconciler.reconcile(root, innerHTML || '', this.localNameMap);// rm last arg
        }
        return { patches, innerHTML }; // TODO remove innerHTML from here
    }

    updateCallback(renderObj) {
        const { patches, innerHTML } = renderObj.component;
        if (patches) {
            this.reconciler.applyPatches(patches);
        }

        if (!this.element.isMounted && (this.mode === 'vanish' ||
                                        this.mode === 'vanish-into-document')) {
            // First time initialized, and is one of the vanish modes
            this.element.replaceWith(...this.element.childNodes); // Replace self
            this.element.remove(); // TODO: rm when fully tested
        }
    }

    handleEvent(func, payload, ev) {
        this.element.lifecycle([ 'event' ]);
        const { value } = (ev.target || {}); // Get value if is <INPUT>, etc
        func.call(null, payload === undefined ? value : payload, ev);
        this.element.lifecycle([ 'eventCleanup' ]); // todo: should this go below rerender()?
        if (this.attrs.rerender !== 'manual') {
            this.element.rerender(); // always rerender after events
        }
    }

    slotLoad({ el, value }) {
        let chosenSlot = value || el.getAttribute('name') || null;
        const getSlot = c => c.getAttribute ? (c.getAttribute('slot') || null) : null;
        let childs = this.element.originalChildren;
        childs = childs.filter(child => getSlot(child) === chosenSlot);

        if (!el.moduloSlotHasLoaded) { // clear innerHTML if this is first load
            el.innerHTML = '';
            el.moduloSlotHasLoaded = true;
        }
        el.append(...childs);
    }

    eventMount({ el, value, attrName, rawName }) {
        // Note: attrName becomes "event name"
        // TODO: Make it @click.payload, and then have this see if '.' exists
        // in attrName and attach as payload if so
        const { resolveDataProp } = Modulo.utils;
        const get = (key, key2) => resolveDataProp(key, el, key2 && get(key2));
        const func = get(attrName);
        Modulo.assert(func, `Bad @${attrName} event: ${value} is falsy`);
        if (!el.moduloEvents) {
            el.moduloEvents = {};
        }
        const listen = ev => {
            const payload = get(attrName + '.payload', 'payload');
            const currentFunction = resolveDataProp(attrName, el);
            this.handleEvent(currentFunction, payload, ev);
        };
        el.moduloEvents[attrName] = listen;
        el.addEventListener(attrName, listen);
    }

    eventUnmount({ el, attrName }) {
        el.removeEventListener(attrName, el.moduloEvents[attrName]);
        // Modulo.assert(el.moduloEvents[attrName], 'Invalid unmount');
        delete el.moduloEvents[attrName];
    }

    dataPropMount({ el, value, attrName, rawName }) { // element, 
        const { get } = Modulo.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
            el.dataPropsAttributeNames = {};
        }
        const isVar = /^[a-z]/i.test(value) && !Modulo.INVALID_WORDS.has(value);
        const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        const val = isVar ? get(renderObj, value) : JSON.parse(value);
        el.dataProps[attrName] = val;
        el.dataPropsAttributeNames[rawName] = attrName;

        /*
        //const renderObj = isVar ? (obj || element.getCurrentRenderObj()) : {}; // not sure why I was doing it this way?
        // TODO: Refactor this:
        const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        const val = isVar ? get(renderObj, value) : JSON.parse(value);
        //needs work for dataObj support (e.g. building objs with '.' syntax)
        const index = attrName.lastIndexOf('.') + 1;
        const key = attrName.slice(index);
        const path = attrName.slice(0, index);
        const dataObj = index > 0 ? get(el.dataProps, path) : el.dataProps;
        dataObj[key] = typeof val === 'function' ? val.bind(dataObj) : val;
        */

    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }
}

Modulo.cparts.props = class Props extends Modulo.ComponentPart {
    static factoryCallback({ attrs }, { componentClass }, renderObj) {
        /* untested / daedcode ---v */
        componentClass.observedAttributes = Object.keys(attrs);
    }
    initializedCallback(renderObj) {
        const props = {};
        const { resolveDataProp } = Modulo.utils;
        for (const [ propName, def ] of Object.entries(this.attrs)) {
            props[propName] = resolveDataProp(propName, this.element, def);
            // TODO: Implement type-checked, and required
        }
        return props;
    }
    prepareCallback(renderObj) {
        const props = {};
        const { resolveDataProp } = Modulo.utils;
        for (const [ propName, def ] of Object.entries(this.attrs)) {
            props[propName] = resolveDataProp(propName, this.element, def);
            // TODO: Implement type-checked, and required
        }
        return props;
    }
}

Modulo.cparts.testsuite = class TestSuite extends Modulo.ComponentPart {
    static factoryCallback() {
        //console.count('Ignored test-suite');
        return {}; // wipe contents
    }
}

Modulo.cparts.style = class Style extends Modulo.ComponentPart {
    static factoryCallback({ content }, { loader, name }, loadObj) {
        if (loadObj.component.attrs.mode === 'shadow') {
            return;
        }
        const { prefixAllSelectors } = Modulo.cparts.style;
        content = prefixAllSelectors(loader.namespace, name, content);
        Modulo.assets.registerStylesheet(content);
    }

    initializedCallback(renderObj) {
        const { component, style } = renderObj;
        if (component.attrs && component.attrs.mode === 'shadow') { // TODO Finish
            console.log('Shadow styling!');
            const style = Modulo.globals.document.createElement('style');
            style.setAttribute('modulo-ignore', 'true');
            style.textContent = style.content;// `<style modulo-ignore>${style.content}</style>`;
            this.element.shadowRoot.append(style);
        }
    }

    static prefixAllSelectors(namespace, name, text='') {
        // TODO - Refactor this into a helper (has old tests that can be resurrected)
        const fullName = `${namespace}-${name}`;
        let content = text.replace(/\*\/.*?\*\//ig, ''); // strip comments

        // To prefix the selectors, we loop through them, with this RegExp that
        // looks for { chars
        content = content.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/gi, selector => {
            selector = selector.trim();
            if (selector.startsWith('@') || selector.startsWith(fullName)
                  || selector.startsWith('from') || selector.startsWith('to')) {
                // TODO: Make a regexp to check if matches other keyframe
                // stuff, 90% etc
                // Skip, is @media or @keyframes, or already prefixed
                return selector;
            }

            // Upgrade the ":host" pseudoselector to be the full name (since
            // this is not a Shadow DOM style-sheet)
            selector = selector.replace(new RegExp(/:host(\([^)]*\))?/, 'g'), hostClause => {
                // TODO: this needs thorough testing
                const notBare = (hostClause && hostClause !== ':host');
                return fullName + (notBare ? `:is(${hostClause})` : '');
            });

            // If it is not prefixed at this point, then be sure to prefix
            if (!selector.startsWith(fullName)) {
                selector = `${fullName} ${selector}`;
            }
            return selector;
        });
        return content;
    }
}


Modulo.cparts.template = class Template extends Modulo.ComponentPart {
    /*
    static factoryCallback(opts, factory, loadObj) {
        // TODO: Delete this after we are done with directive-based expansion
        const tagPref = '$1' + factory.loader.namespace + '-';
        const content = (opts.content || '').replace(/(<\/?)my-/ig, tagPref);
        return { content };
    }
    */

    static factoryCallback(partOptions, factory, renderObj) {
        const engineClass = Modulo.templating[partOptions.attrs.engine || 'MTL'];
        const opts = Object.assign({}, partOptions.attrs, {
            makeFunc: (a, b) => Modulo.assets.registerFunction(a, b),
        });
        partOptions.instance = new engineClass(partOptions.content, opts);
    }

    constructor(element, options) {
        super(element, options);
        if (!options.instance) { // TODO: Remove, needed for tests
            Modulo.cparts.template.factoryCallback(options);
        }
        this.instance = options.instance;
    }

    prepareCallback(renderObj) {
        // Exposes templates in render context, so stuff like
        // "|renderas:template.row" works
        // (todo: untested, needs unit testing, iirc?)
        const obj = {};
        for (const template of this.element.cpartSpares.template) {
            obj[template.attrs.name || 'regular'] = template;
            //obj[template.name || 'regular'] = template;
        }
        return obj;
    }

    renderCallback(renderObj) {
        renderObj.component.innerHTML = this.instance.render(renderObj);
    }
}


Modulo.cparts.script = class Script extends Modulo.ComponentPart {
    static factoryCallback(partOptions, factory, renderObj) {
        const code = partOptions.content || '';
        const localVars = Object.keys(renderObj);
        localVars.push('element'); // add in element as a local var
        localVars.push('cparts'); // give access to CParts JS interface
        const ns = factory.loader.namespace;
        const moduleFac = Modulo.factoryInstances[`{ns}-{ns}`];
        const module = moduleFac ? moduleFac.baseRenderObj : null;

        // Combine localVars + fixed args into allArgs
        const args = [ 'Modulo', 'factory', 'module' ];
        const allArgs = args.concat(localVars.filter(n => !args.includes(n)));
        const opts = { exports: 'script' };
        const func = Modulo.assets.registerFunction(allArgs, code, opts);

        // Now, actually run code in Script tag to do factory method
        const results = func.call(null, Modulo, factory, module);
        if (results.factoryCallback) {
            //this.prepLocalVars(renderObj); // ?
            results.factoryCallback(partOptions, factory, renderObj);
        }
        results.localVars = localVars;
        return results;
    }

    getDirectives() { // TODO: refactor / rm
        const { script } = this.element.initRenderObj;
        const isCbRegex = /(Unmount|Mount)$/;
        return Object.keys(script)
            .filter(key => key.match(isCbRegex))
            .map(key => `script.${key}`);
    }

    cb(func) {
        // DEAD CODE (but used in documentation...)
        const renderObj = this.element.getCurrentRenderObj();
        return (...args) => {
            this.prepLocalVars(renderObj);
            func(...args);
            //this.clearLocalVariables(renderObj); // should do, set to "Invalid wrapped"
        };
    }

    constructor(element, options) {
        super(element, options);

        // Attach callbacks from script to this, to hook into lifecycle.
        const { script } = element.initRenderObj;
        const isCbRegex = /(Unmount|Mount|Callback)$/;
        const cbs = Object.keys(script).filter(key => key.match(isCbRegex));
        cbs.push('initializedCallback', 'eventCallback'); // always CBs for these
        for (const cbName of cbs) {
            this[cbName] = (arg) => {
                // NOTE: renderObj is passed in for Callback, but not Mount
                const renderObj = this.element.getCurrentRenderObj();
                this.prepLocalVars(renderObj); // always prep (for event CB)
                if (cbName in script) { // if it's specified in script
                    Object.assign(renderObj.script, script[cbName](arg));
                }
            };
        }
        /*
        const originalScript = Object.assign({}, script);
        this[cbName] = script[cbName] = (renderObj => {
            this.prepLocalVars(renderObj);
            if (cbName in originalScript) {
                originalScript[cbName](renderObj);
            }
        });
        */
    }

    // ## cparts.Script: prepLocalVars
    // To allow for local variables access to APIs provided by other CParts,
    // sets local variables equal to the data returned by their callbacks.
    // This is important: It's what enables us to avoid using the "this"
    // context, since the current element is set before any custom code is run.
    prepLocalVars(renderObj) {
        if (!renderObj.script) {
            console.error('ERROR: Script CPart missing from renderObj:', renderObj);
            return false;
        }
        const {setLocalVariable, localVars} = renderObj.script;
        setLocalVariable('element', this.element);
        setLocalVariable('cparts', this.element.cparts);
        for (const localVar of localVars) {
            if (localVar in renderObj) {
                setLocalVariable(localVar, renderObj[localVar]);
            }
        }
    }
}

Modulo.cparts.state = class State extends Modulo.ComponentPart {
    getDirectives() {
        return [ 'state.bindMount', 'state.bindUnmount' ];
    }

    initializedCallback(renderObj) {
        this.boundElements = {};
        if (!this.data) {
            // Initialize with deep copy of attributes
            // TODO: Need to do proper deep-copy... is this okay?
            // this.data = JSON.parse(JSON.stringify(this.attrs));
            let { attrs } = this;
            if (attrs.attrs) { // TODO: Hack code here, not sure why its like this
                attrs = attrs.attrs;
            }
            this.data = Object.assign({}, attrs);
        }
        //console.log('thsi is data', this.data);
        return this.data;
    }

    bindMount({ el, attrName, value }) {
        const { assert } = Modulo;
        const name = el.getAttribute('name') || attrName;
        assert(name in this.data, `[state.bind]: key "${name}" not in state`);
        assert(!this.boundElements[name], `[state.bind]: Duplicate "${name}"`);
        const listen = () => {
            // TODO: redo
            let { value, type, checked } = el;
            if (type && type === 'checkbox') {
                value === !!checked;
            }
            this.set(name, value);
        };
        const isText = el.tagName === 'TEXTAREA' || el.type === 'text';
        const evName = value ? value : (isText ? 'keyup' : 'change');
        this.boundElements[name] = [ el, evName, listen ];
        el.value = this.data[name];
        el.addEventListener(evName, listen);
    }

    bindUnmount({ el, attrName }) {
        const name = el.getAttribute('name') || attrName;
        const [ el2, evName, listen ] = this.boundElements[name];
        delete this.boundElements[name];
        el2.removeEventListener(evName, listen);
    }

    reloadCallback(oldPart) {
        // DEAD CODE: Used for hot-reloading: Merge data with oldPart's data
        this.data = Object.assign({}, oldPart.data, this.data, oldPart.data);
    }

    set(name, value) {
        this.data[name] = value;
        this.element.rerender();
    }

    eventCallback() {
        this._oldData = Object.assign({}, this.data);
    }

    eventCleanupCallback() {
        for (const name of Object.keys(this.data)) {
            Modulo.assert(name in this._oldData, `There is no "state.${name}"`);
            const val = this.data[name];
            if (name in this.boundElements && val !== this._oldData[name]) {
                const [el, listen, evName] = this.boundElements[name];
                if (el.type === 'checkbox') {
                    el.checked = !!val;
                } else {
                    el.value = val;
                }
            }
        }
        this._oldData = null;
    }
}

// ModuloTemplate
Modulo.templating.MTL = class ModuloTemplateLanguage {
    constructor(text, options) {
        Object.assign(this, Modulo.templating.defaultOptions, options);
        this.compiledCode = this.compile(text);
        if (!this.renderFunc) {
            this.renderFunc = this.makeFunc([ 'CTX', 'G' ], this.compiledCode);
        }
    }

    tokenizeText(text) {
        // Join all modeTokens with | (OR in regex).
        // Replace space with wildcard capture.
        const re = '(' + this.modeTokens.join('|(').replace(/ +/g, ')(.+?)');
        return text.split(RegExp(re)).filter(token => token !== undefined);
    }

    compile(text) {
        // const { truncate, trim, escapejs } = this.defaultFilters;
        // const prepComment = token => truncate(escapejs(trim(token)), 80);
        this.stack = []; // Template tag stack
        this.output = 'var OUT=[];\n'; // Variable used to accumulate code
        let mode = 'text'; // Start in text mode
        for (const token of this.tokenizeText(text)) {
            if (mode) { // if in a "mode" (text or token), then call mode func
                const result = this.modes[mode](token, this, this.stack);
                if (result) { // Mode generated text output, add to code
                    const comment = JSON.stringify(token.trim());
                    this.output += `${result} // ${ comment }\n`;
                }
            }
            // FSM for mode: ('text' -> null) (null -> token) (* -> 'text')
            mode = (mode === 'text') ? null : (mode ? 'text' : token);
        }
        this.output += '\nreturn OUT.join("");'
        return this.output;
    }

    render(renderObj) {
        return this.renderFunc(Object.assign({ renderObj }, renderObj), this);
    }

    parseExpr(text) {
        // TODO: Store a list of variables / paths, so there can be warnings or
        // errors when variables are unspecified
        const filters = text.split('|');
        let results = this.parseVal(filters.shift()); // Get left-most val
        for (const [fName, arg] of filters.map(s => s.trim().split(':'))) {
            const argList = arg ? ',' + this.parseVal(arg) : '';
            results = `G.filters["${fName}"](${results}${argList})`;
        }
        return results;
    }

    parseCondExpr(string) {
        // This RegExp splits around the tokens, with spaces added
        const regExpText = ` (${this.opTokens.split(',').join('|')}) `;
        //console.log(string.split(RegExp(regExpText)));
        return string.split(RegExp(regExpText));
    }

    parseVal(string) {
        // Parses string literals, de-escaping as needed, numbers, and context
        // variables
        const { cleanWord } = Modulo.utils;
        const s = string.trim();
        if (s.match(/^('.*'|".*")$/)) { // String literal
            return JSON.stringify(s.substr(1, s.length - 2));
        }
        return s.match(/^\d+$/) ? s : `CTX.${cleanWord(s)}`
    }

    escapeHTML(text) {
        if (text && text.safe) {
            return text;
        }
        return (text + '').replace(/&/g, '&amp;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
    }
}
Modulo.Template = Modulo.templating.MTL; // Alias

Modulo.templating.defaultOptions = {
    modeTokens: ['{% %}', '{{ }}', '{# #}'],
    //opTokens: '==,>,<,>=,<=,!=,not in,is not,is,in,not,and,or',
    opTokens: '==,>,<,>=,<=,!=,not in,is not,is,in,not,gt,lt',
    makeFunc: (argList, text) => new Function(argList.join(','), text),
    opAliases: {
        '==': 'X === Y',
        'is': 'X === Y',
        'gt': 'X > Y',
        'lt': 'X < Y',
        'is not': 'X !== Y',
        //'and': 'X && Y',
        //'or': 'X || Y',
        'not': '!(Y)',
        // TODO: Consider patterns like this to avoid excess reapplication of filters:
        // (x = X, y = Y).includes ? y.includes(x) : (x in y)
        'in': '(Y).includes ? (Y).includes(X) : (X in Y)',
        'not in': '!((Y).includes ? (Y).includes(X) : (X in Y))',
    },
};

Modulo.templating.defaultOptions.modes = {
    '{%': (text, tmplt, stack) => {
        const tTag = text.trim().split(' ')[0];
        const tagFunc = tmplt.tags[tTag];
        if (stack.length && tTag === stack[stack.length - 1].close) {
            return stack.pop().end; // Closing tag, return it's end code
        } else if (!tagFunc) { // Undefined template tag
            throw new Error(`Unknown template tag "${tTag}": ${text}`);
        } // Normal opening tag
        const result = tagFunc(text.slice(tTag.length + 1), tmplt);
        if (result.end) { // Not self-closing, push to stack
            stack.push({ close: `end${tTag}`, ...result });
        }
        return result.start || result;
    },
    '{#': (text, tmplt) => false, // falsy values are ignored
    '{{': (text, tmplt) => `OUT.push(G.escapeHTML(${tmplt.parseExpr(text)}));`,
    text: (text, tmplt) => text && `OUT.push(${JSON.stringify(text)});`,
};

Modulo.templating.defaultOptions.filters = (function () {
    //const { get } = Modulo.utils; // TODO, fix this code duplciation
    function get(obj, key) {
        return obj[key];
    }

    function sorted(obj, arg) {
        if (!obj) {
            return obj;
        }
        // TODO Refactor or remove?
        if (Array.isArray(obj)) {// && (!obj.length || typeof obj[0] !== 'object')) {
            return obj.sort();
        } else {
            const keys = Array.from(Object.keys(obj)).sort(); // Loop through sorted
            return keys.map(k => [k, obj[k]]);
        }
    }

    // TODO: Once we get unit tests for build, replace jsobj with actual loop
    // in build template (and just backtick escape as filter).
    function jsobj(obj, arg) {
        let s = '{\n';
        for (const [key, value] of sorted(obj)) {
            s += '  ' + JSON.stringify(key) + ': ';
            if (typeof value === 'string') {
                s += '// (' + value.split('\n').length + ' lines)\n`';
                s += value.replace(/\\/g , '\\\\')
                          .replace(/`/g, '\\`').replace(/\$/g, '\\$');
                s += '`,// (ends: ' + key + ') \n\n';
            } else {
                s += JSON.stringify(value, null, 4) + ',\n';
            }
        }
        return s + '}';
    }
    const safe = s => Object.assign(new String(s), {safe: true});

    //trim: s => s.trim(), // TODO: improve interface to be more useful
    //invoke: (s, arg) => s(arg),
    //getAttribute: (s, arg) => s.getAttribute(arg),

    // Idea: Generalized "matches" filter that gets registered like such:
    //     defaultOptions.filters.matches = {name: //ig}
    // Then we could configure "named" RegExps in Script that get used in
    // template

    const filters = {
        add: (s, arg) => s + arg,
        allow: (s, arg) => arg.split(',').includes(s) ? s : '',
        camelcase: s => s.replace(/-([a-z])/g, g => g[1].toUpperCase()),
        capfirst: s => s.charAt(0).toUpperCase() + s.slice(1),
        concat: (s, arg) => s.concat ? s.concat(arg) : s + arg,
        //combine: (s, arg) => s.concat ? s.concat(arg) : Object.assign(s, arg),
        default: (s, arg) => s || arg,
        divisibleby: (s, arg) => ((s * 1) % (arg * 1)) === 0,
        escapejs: s => JSON.stringify(String(s)).replace(/(^"|"$)/g, ''),
        first: s => s[0],
        join: (s, arg) => s.join(arg === undefined ? ", " : arg),
        json: (s, arg) => JSON.stringify(s, null, arg || undefined),
        last: s => s[s.length - 1],
        length: s => s.length !== undefined ? s.length : Object.keys(s).length,
        lower: s => s.toLowerCase(),
        number: (s) => Number(s),
        pluralize: (s, arg) => (arg.split(',')[(s === 1) * 1]) || '',
        subtract: (s, arg) => s - arg,
        truncate: (s, arg) => ((s.length > arg*1) ? (s.substr(0, arg-1) + '…') : s),
        renderas: (rCtx, template) => safe(template.instance.render(rCtx)),
        reversed: s => Array.from(s).reverse(),
        upper: s => s.toUpperCase(),
    };
    const { values, keys, entries } = Object;
    const extra = { get, jsobj, safe, sorted, values, keys, entries };
    return Object.assign(filters, extra);
})();

Modulo.templating.defaultOptions.tags = {
    'if': (text, tmplt) => {
        // Limit to 3 (L/O/R)
        const [lHand, op, rHand] = tmplt.parseCondExpr(text);
        const condStructure = !op ? 'X' : tmplt.opAliases[op] || `X ${op} Y`;
        const condition = condStructure.replace(/([XY])/g,
            (k, m) => tmplt.parseExpr(m === 'X' ? lHand : rHand));
        const start = `if (${condition}) {`;
        return {start, end: '}'};
    },
    'else': () => '} else {',
    'elif': (s, tmplt) => '} else ' + tmplt.tags['if'](s, tmplt).start,
    'comment': () => ({ start: "/*", end: "*/"}),
    'for': (text, tmplt) => {
        // Make variable name be based on nested-ness of tag stack
        const { cleanWord } = Modulo.utils;
        const arrName = 'ARR' + tmplt.stack.length;
        const [ varExp, arrExp ] = text.split(' in ');
        let start = `var ${arrName}=${tmplt.parseExpr(arrExp)};`;
        // TODO: Upgrade to of (after good testing), since probably no need to
        // support for..in
        start += `for (var KEY in ${arrName}) {`;
        const [keyVar, valVar] = varExp.split(',').map(cleanWord);
        if (valVar) {
            start += `CTX.${keyVar}=KEY;`;
        }
        start += `CTX.${valVar ? valVar : varExp}=${arrName}[KEY];`;
        return {start, end: '}'};
    },
    'empty': (text, {stack}) => {
        // Make variable name be based on nested-ness of tag stack
        const varName = 'G.FORLOOP_NOT_EMPTY' + stack.length;
        const oldEndCode = stack.pop().end; // get rid of dangling for
        const start = `${varName}=true; ${oldEndCode} if (!${varName}) {`;
        const end = `}${varName} = false;`;
        return {start, end, close: 'endfor'};
    },
};


// TODO: 
//  - Then, re-implement [component.key] and [component.ignore] as TagLoad
//  - Possibly: Use this to then do granular patches (directiveMount etc)
Modulo.reconcilers.DOMCursor = class DOMCursor {
    constructor(parentNode, parentRival) {
        this.initialize(parentNode, parentRival);
        this.instanceStack = [];
    }

    initialize(parentNode, parentRival) {
        this.parentNode = parentNode;
        this.nextChild = parentNode.firstChild;
        this.nextRival = parentRival.firstChild;
        this.keyedChildren = {};
        this.keyedRivals = {};
        this.keyedChildrenArr = null;
        this.keyedRivalsArr = null;
    }

    saveToStack() {
        // TODO: Once we finalize this class, write "_.pick" helper
        const { nextChild, nextRival, keyedChildren, keyedRivals,
                parentNode, keyedChildrenArr, keyedRivalsArr } = this;
        const instance = { nextChild, nextRival, keyedChildren, keyedRivals,
                parentNode, keyedChildrenArr, keyedRivalsArr };
        this.instanceStack.push(instance);
    }

    loadFromStack() {
        const stack = this.instanceStack;
        return stack.length > 0 && Object.assign(this, stack.pop());
    }

    hasNext() {
        if (this.nextChild || this.nextRival) {
            return true; // Is pointing at another node
        }

        // Convert objects into arrays so we can pop
        if (!this.keyedChildrenArr) {
            this.keyedChildrenArr = Object.values(this.keyedChildren);
        }
        if (!this.keyedRivalsArr) {
            this.keyedRivalsArr = Object.values(this.keyedRivals);
        }

        if (this.keyedRivalsArr.length || this.keyedChildrenArr.length) {
            return true; // We have queued up nodes from keyed values
        }

        return this.loadFromStack() && this.hasNext();
    }

    next() {
        let child = this.nextChild;
        let rival = this.nextRival;
        if (!child && !rival) { // reached the end
            if (!this.keyedRivalsArr) {
                return [null, null];
            }
            // There were excess keyed rivals OR children, pop()
            return this.keyedRivalsArr.length ?
                  [ null, this.keyedRivalsArr.pop() ] :
                  [ this.keyedChildrenArr.pop(), null ];
        }

        // Handle keys
        this.nextChild = child ? child.nextSibling : null;
        this.nextRival = rival ? rival.nextSibling : null;

        let matchedRival = this.getMatchedNode(child, this.keyedChildren, this.keyedRivals);
        let matchedChild = this.getMatchedNode(rival, this.keyedRivals, this.keyedChildren);
        // TODO refactor this
        if (matchedRival === false) {
            // Child has a key, but does not match rival, so SKIP on child
            child = this.nextChild;
            this.nextChild = child ? child.nextSibling : null;
        } else if (matchedChild === false) {
            // Rival has a key, but does not match child, so SKIP on rival
            rival = this.nextRival;
            this.nextRival = rival ? rival.nextSibling : null;
        }
        const keyWasFound = matchedRival !== null || matchedChild !== null;
        const matchFound = matchedChild !== child && keyWasFound;
        if (matchFound && matchedChild) {
            // Rival matches, but not with child. Swap in child.
            this.nextChild = child;
            child = matchedChild;
        }

        if (matchFound && matchedRival) {
            // Child matches, but not with rival. Swap in rival.
            Modulo.assert(matchedRival !== rival, 'Dupe!'); // (We know this due to ordering)
            this.nextRival = rival;
            rival = matchedRival;
        }

        return [ child, rival ];
    }

    getMatchedNode(elem, keyedElems, keyedOthers) {
        // IDEA: Rewrite keying elements with this trick: - Use LoadTag
        // directive, removed keyed rival from DOM
        /// - Issue: Cursor is scoped per "layer", and non-recursive reconcile
        //    not created yet, so reconciler will need to keep keyed elements
        /// - Solution: Finish non-recursive reconciler
        const key = elem && elem.getAttribute && elem.getAttribute('key');
        if (!key) {
            return null;
        }
        if (key in keyedOthers) {
            const matched = keyedOthers[key];
            delete keyedOthers[key];
            return matched;
        } else {
            if (key in keyedElems) {
                console.error('MODULO WARNING: Duplicate key:', key);
            }
            keyedElems[key] = elem;
            return false;
        }
    }

}

Modulo.reconcilers.ModRec = class ModuloReconciler {
    constructor(opts) {
        // TODO: Refactor this, perhaps with some general "opts with defaults"
        // helper functions.
        opts = opts || {};
        this.shouldNotDescend = !!opts.doNotDescend;
        this.directives = opts.directives || {};
        this.tagTransforms = opts.tagTransforms;
        this.directiveShortcuts = opts.directiveShortcuts || [];
        if (this.directiveShortcuts.length === 0) { // XXX horrible HACK
          //console.error('this.directiveShortcuts.length === 0');
          /*
            this.directiveShortcuts = [
                [ /^@/, 'component.event' ],
                [ /:$/, 'component.dataProp' ],
            ];
          */
        }
        this.patch = this.pushPatch;
    }

    loadString(rivalHTML, tagTransforms) {
        this.patches = [];
        const rival = Modulo.utils.makeDiv(rivalHTML, true);
        const transforms = Object.assign({}, this.tagTransforms, tagTransforms);
        this.applyLoadDirectives(rival, transforms);
        return rival;
    }

    reconcile(node, rival, tagTransforms) {
        // TODO: should normalize <!DOCTYPE html>
        if (typeof rival === 'string') {
            rival = this.loadString(rival, tagTransforms);
        }
        this.reconcileChildren(node, rival);
        this.cleanRecDirectiveMarks(node);
        return this.patches;
    }

    applyLoadDirectives(elem, tagTransforms) {
        this.patch = this.applyPatch; // Apply patches immediately
        for (const node of elem.querySelectorAll('*')) {
            // legacy -v, TODO rm
            const newTag = tagTransforms[node.tagName.toLowerCase()];
            //console.log('this is tagTransforms', tagTransforms);
            if (newTag) {
                Modulo.utils.transformTag(node, newTag);
            }
            ///////

            const lowerName = node.tagName.toLowerCase();
            if (lowerName in this.directives) {
                this.patchDirectives(node, `[${lowerName}]`, 'TagLoad');
            }

            for (const rawName of node.getAttributeNames()) {
                // Apply load-time directive patches
                this.patchDirectives(node, rawName, 'Load');
            }
        }
        this.markRecDirectives(elem); // TODO rm
        this.patch = this.pushPatch;
    }

    markRecDirectives(elem) {
        // TODO remove this after we reimplement [component.ignore]
        // Mark all children of modulo-ignore with mm-ignore
        for (const node of elem.querySelectorAll('[modulo-ignore] *')) {
            // TODO: Very important: also mark to ignore children that are
            // custom!
            node.setAttribute('mm-ignore', 'mm-ignore');
        }

        // TODO: hacky / leaky solution to attach like this
        //for (const rivalChild of elem.querySelectorAll('*')) {
        //    rivalChild.moduloDirectiveContext = this.directives;
        //}
    }

    cleanRecDirectiveMarks(elem) {
        // Remove all mm-ignores
        for (const node of elem.querySelectorAll('[mm-ignore]')) {
            node.removeAttribute('mm-ignore');
        }
    }

    applyPatches(patches) {
        patches.forEach(patch => this.applyPatch.apply(this, patch));
    }

    reconcileChildren(childParent, rivalParent) {
        // Nonstandard nomenclature: "The rival" is the node we wish to match
        const cursor = new Modulo.reconcilers.DOMCursor(childParent, rivalParent);
        while (cursor.hasNext()) {
            const [ child, rival ] = cursor.next();

            // Does this node to be swapped out? Swap if exist but mismatched
            const needReplace = child && rival && (
                child.nodeType !== rival.nodeType ||
                child.nodeName !== rival.nodeName
            );

            if ((child && !rival) || needReplace) { // we have more rival, delete child
                this.patchAndDescendants(child, 'Unmount');
                this.patch(cursor.parentNode, 'removeChild', child);
            }

            if (needReplace) { // do swap with insertBefore
                this.patch(cursor.parentNode, 'insertBefore', rival, child.nextSibling);
                this.patchAndDescendants(rival, 'Mount');
            }

            if (!child && rival) { // we have less than rival, take rival
                this.patch(cursor.parentNode, 'appendChild', rival);
                this.patchAndDescendants(rival, 'Mount');
            }

            if (child && rival && !needReplace) {
                // Both exist and are of same type, let's reconcile nodes

                if (child.nodeType !== 1) { // text or comment node
                    if (child.nodeValue !== rival.nodeValue) { // update
                        this.patch(child, 'node-value', rival.nodeValue);
                    }
                } else if (!child.isEqualNode(rival)) { // sync if not equal
                    this.reconcileAttributes(child, rival);

                    if (rival.hasAttribute('modulo-ignore')) {
                        //console.log('Skipping ignored node');
                    } else if (child.isModulo) { // is a Modulo component
                        // TODO: Instead of having one big "rerender" patch,
                        // maybe run a "rerender" right away, but collect
                        // patches, then insert in the patch list here?
                        this.patch(child, 'rerender', rival);
                    } else if (!this.shouldNotDescend) {
                        cursor.saveToStack();
                        cursor.initialize(child, rival);
                    }
                }
            }
        }
    }

    pushPatch(node, method, arg, arg2 = null) {
        this.patches.push([ node, method, arg, arg2 ]);
    }

    applyPatch(node, method, arg, arg2) { // take that, rule of 3!
        if (method === 'node-value') {
            node.nodeValue = arg;
        } else if (method === 'insertBefore') {
            node.insertBefore(arg, arg2); // Needs 2 arguments
        } else if (method.startsWith('directive-')) {
            // TODO: Possibly, remove 'directive-' prefix
            method = method.substr('directive-'.length);
            node[method].call(node, arg); // invoke method
        } else {
            node[method].call(node, arg); // invoke method
        }
    }

    patchDirectives(el, rawName, suffix, copyFromEl = null) {
        const foundDirectives = Modulo.utils.parseDirectives(rawName, this.directiveShortcuts);
        if (!foundDirectives || foundDirectives.length === 0) {
            return;
        }

        const value = (copyFromEl || el).getAttribute(rawName); // Get value
        for (const directive of foundDirectives) {
            const dName = directive.directiveName; // e.g. "state.bind", "link"
            const fullName = dName + suffix; // e.g. "state.bindMount"

            // Hacky: Check if this elem has a different moduloDirectiveContext than expected
            //const directives = (copyFromEl || el).moduloDirectiveContext || this.directives;
            //if (el.moduloDirectiveContext) {
            //    console.log('el.moduloDirectiveContext', el.moduloDirectiveContext);
            //}
            const { directives } = this;

            const thisContext = directives[dName] || directives[fullName];
            if (thisContext) { // If a directive matches...
                const methodName = fullName.split('.')[1] || fullName;
                Object.assign(directive, { value, el });
                this.patch(thisContext, 'directive-' + methodName, directive);
            }
        }
    }

    reconcileAttributes(node, rival) {
        const myAttrs = new Set(node ? node.getAttributeNames() : []);
        const rivalAttributes = new Set(rival.getAttributeNames());

        // Check for new and changed attributes
        for (const rawName of rivalAttributes) {
            const attr = rival.getAttributeNode(rawName);
            if (myAttrs.has(rawName) && node.getAttribute(rawName) === attr.value) {
                continue; // Already matches, on to next
            }

            if (myAttrs.has(rawName)) { // If exists, trigger Unmount first
                this.patchDirectives(node, rawName, 'Unmount');
            }
            // Set attribute node, and then Mount based on rival value
            this.patch(node, 'setAttributeNode', attr.cloneNode(true));
            this.patchDirectives(node, rawName, 'Mount', rival);
        }

        // Check for old attributes that were removed
        for (const rawName of myAttrs) {
            if (!rivalAttributes.has(rawName)) {
                this.patchDirectives(node, rawName, 'Unmount');
                this.patch(node, 'removeAttribute', rawName);
            }
        }
    }

    patchAndDescendants(parentNode, actionSuffix) {
        if (parentNode.nodeType !== 1) { // cannot have descendants
            return;
        }
        let nodes = [ parentNode ]; // also, patch self (but last)
        if (!this.shouldNotDescend) {
            nodes = Array.from(parentNode.querySelectorAll('*')).concat(nodes);
        }
        for (let rival of nodes) { // loop through nodes to patch
            if (rival.hasAttribute('mm-ignore')) {
                // Skip any marked to ignore
                continue;
            }

            for (const rawName of rival.getAttributeNames()) {
                // Loop through each attribute patching foundDirectives as necessary
                this.patchDirectives(rival, rawName, actionSuffix);
            }
        }
    }
}


Modulo.utils = class utils {
    static mergeAttrs(elem, defaults) {
        // TODO: Write unit tests for this
        const { camelcase } = Modulo.templating.defaultOptions.filters;
        const obj = Object.assign({}, defaults);
        const dataPropNames = elem.dataPropsAttributeNames || false;
        for (const name of elem.getAttributeNames()) {
            const dataPropKey = dataPropNames && dataPropNames[name];
            if (dataPropKey) {
                obj[camelcase(dataPropKey)] = elem.dataProps[dataPropKey];
            } else {
                obj[camelcase(name)] = elem.getAttribute(name);
            }
        }
        return obj;
    }

    static resolveDataProp(key, elem, defaultVal) {
        if (elem.dataProps && key in elem.dataProps) {
            return elem.dataProps[key];
        }
        return elem.hasAttribute(key) ? elem.getAttribute(key) : defaultVal;
    }

    static makeDiv(html, inFrag=false) {
        /* TODO: Have an options for doing <script  / etc preprocessing here:
          <state -> <script type="modulo/state"
          <\s*(state|props|template)([\s>]) -> <script type="modulo/\1"\2
          </(state|props|template)> -> </script>*/
        const div = Modulo.globals.document.createElement('div');
        div.innerHTML = html;
        /*
        if (inFrag) { // TODO: Don't think there's a reason for frags, actually
            const frag = new Modulo.globals.DocumentFragment();
            frag.appendChild(div);
        }
        */
        return div;
    }

    static normalize(html) {
        // Normalize space to ' ' & trim around tags
        return html.replace(/\s+/g, ' ').replace(/(^|>)\s*(<|$)/g, '$1$2').trim();
    }

    static saveFileAs(filename, text) {
        const doc = Modulo.globals.document;
        const element = doc.createElement('a');
        const enc = encodeURIComponent(text); // TODO silo in globals
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + enc);
        element.setAttribute('download', filename);
        doc.body.appendChild(element);
        element.click();
        doc.body.removeChild(element);
        return `./${filename}`; // by default, return local path
    }

    static loadNodeData(node) {
        // DEAD CODE
        //const {parseAttrs} = Modulo.utils;
        const {tagName, dataProps} = node;
        const attrs = Object.assign(/*parseAttrs(node), */dataProps);
        const {name} = attrs;
        let type = tagName.toLowerCase();
        const splitType = (node.getAttribute('type') || '').split('/');
        const content = tagName === 'SCRIPT' ? node.textContent : node.innerHTML;
        if (splitType[0] && splitType[0].toLowerCase() === 'modulo') {
            type = splitType[1];
        }
        return {attrs, type, name, content};
    }

    static get(obj, key) {
        return key.split('.').reduce((o, name) => o[name], obj);
    }

    static dirname(path) {
        return (path || '').match(/.*\//);
    }

    static resolvePath(workingDir, relPath) {
        if (!workingDir) {
            console.log('Warning: Blank workingDir:', workingDir);
        }
        if (relPath.toLowerCase().startsWith('http')) {
            return relPath; // already absolute
        }
        workingDir = workingDir || '';
        // Similar to Node's path.resolve()
        const combinedPath = workingDir + '/' + relPath;
        const newPath = [];
        for (const pathPart of combinedPath.split('/')) {
            if (pathPart === '..') {
                newPath.pop();
            } else if (pathPart === '.') {
                // No-op
            } else if (pathPart.trim()) {
                newPath.push(pathPart);
            }
        }
        const prefix = workingDir.startsWith('/') ? '/' : '';
        return prefix + newPath.join('/').replace(RegExp('//', 'g'), '/');
    }

    static hash(str) {
        // Simple, insecure, "hashCode()" implementation. Returns base32 hash
        let h = 0;
        for(let i = 0; i < str.length; i++) {
            //h = ((h << 5 - h) + str.charCodeAt(i)) | 0;
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return (h || 0).toString(32).replace(/-/g, 'x');
    }

    static cleanWord(text) {
        return (text + '').replace(/[^a-zA-Z0-9$_\.]/g, '') || '';
    }

    static transformTag(n1, tag2) {
        // Transforms given element n1 into an identical n2 with given tag2
        const n2 = Modulo.globals.document.createElement(tag2);
        n2.append(...(n1.childNodes || []));
        for (const name of n1.getAttributeNames()) {
            n2.setAttributeNode(n1.getAttributeNode(name).cloneNode(true));
        }
        return n1.replaceWith(n2) || n2;
    }

    static rpartition(s, seperator) {
        // DEAD CODE
        const index = s.lastIndexOf(separator) + 1;
        return [s.slice(0, index - 1), s.slice(index)];
        //return [index ? s.slice(0, index - 1) : s, s.slice(index)];
    }

    static parseDirectives(rawName, directiveShortcuts) { //, foundDirectives) {
        if (/^[a-z0-9-]$/i.test(rawName)) {
            return null; // if alpha-only, stop right away
            // TODO: If we ever support key= as a shortcut, this
            // will break
        }

        // "Expand" shortcuts into their full versions
        let name = rawName;
        for (const [regexp, directive] of directiveShortcuts) {
            if (rawName.match(regexp)) {
                name = `[${directive}]` + name.replace(regexp, '');
            }
        }
        if (!name.startsWith('[')) {
            return null; // There are no directives, regular attribute, skip
        }

        // There are directives... time to resolve them
        const { cleanWord } = Modulo.utils;
        const arr = [];
        const attrName = cleanWord((name.match(/\][^\]]+$/) || [ '' ])[0]);
        for (const directiveName of name.split(']').map(cleanWord)) {
            // Skip the bare name itself, and filter for valid directives
            if (directiveName !== attrName) {// && directiveName in directives) {
                arr.push({ attrName, rawName, directiveName, name })
            }
        }
        return arr;
    }

    static getBuiltHTML(opts) {
        // Scan document for modulo elements, attaching modulo-original-html=""
        // as needed, or clearing
        const doc = Modulo.globals.document;
        for (const elem of doc.querySelectorAll('*')) {
            if (elem.hasAttribute('modulo-asset')) {
                elem.remove();
            } else if (elem.isModulo && elem.originalHTML !== elem.innerHTML) {
                elem.setAttribute('modulo-original-html', elem.originalHTML);
            }
        }
        const linkProps = { rel: 'stylesheet', href: opts.cssFilePath };
        doc.head.append(Object.assign(doc.createElement('link'), linkProps));
        const scriptProps = { src: opts.jsFilePath };
        doc.body.append(Object.assign(doc.createElement('script'), scriptProps));
        return '<!DOCTYPE HTML><html>' + doc.documentElement.innerHTML + '</html>';
    }

    static fetchBundleData(callback) {
        const query = 'script[src*=".js"],link[rel=stylesheet],' +
                      'template[modulo-embed],modulo';
        const scriptSources = [];
        const cssSources = [];
        const embeddedSources = [];
        for (const elem of Modulo.globals.document.querySelectorAll(query)) {
            elem.setAttribute('modulo-asset', 'y'); // Mark as an "asset", to rm
            if (elem.tagName === 'TEMPLATE' || elem.tagName === 'MODULO') {
                embeddedSources.push(elem.innerHTML);
            } else {
                Modulo.fetchQ.enqueue(elem.src, data => {
                    delete Modulo.fetchQ.data[elem.src]; // clear cached data
                    const arr = elem.tagName === 'SCRIPT' ? scriptSources : cssSources;
                    arr.push(data);
                });
            }
        }
        const opts = { scriptSources, cssSources, embeddedSources, type: 'bundle' };
        Modulo.fetchQ.wait(() => callback(opts));
        return embeddedSources; // could be used for loadString in defineAll?
    }
}

Modulo.FetchQueue = class FetchQueue {
    constructor() {
        this.queue = {};
        this.data = {};
        this.waitCallbacks = [];
    }

    enqueue(fetchObj, callback, basePath = null) {
        this.basePath = basePath ? basePath : this.basePath;
        fetchObj = typeof fetchObj === 'string' ? { fetchObj } : fetchObj;
        for (let [ label, src ] of Object.entries(fetchObj)) {
            this._enqueue(src, label, callback);
        }
    }

    _enqueue(src, label, callback) {
        if (this.basePath && !this.basePath.endsWith('/')) {
            // <-- TODO rm & straighten this stuff out
            this.basePath = this.basePath + '/'; // make sure trails '/'
        }
        src = Modulo.utils.resolvePath(this.basePath || '', src);
        if (src in this.data) {
            callback(this.data[src], label, src); // Synchronous route
        } else if (!(src in this.queue)) {
            this.queue[src] = [callback];
            // TODO: Think about if cache:no-store
            Modulo.globals.fetch(src, { cache: 'no-store' })
                .then(response => response.text())
                .then(text => this.receiveData(text, label, src))
                // v- uncomment after switch to new BE
                //.catch(err => console.error('Modulo Load ERR', src, err));
        } else {
            this.queue[src].push(callback); // add to end of src queue
        }
    }

    receiveData(text, label, src) {
        this.data[src] = text; // load data
        this.queue[src].forEach(func => func(text, label, src));
        delete this.queue[src]; // remove queue
        this.checkWait();
    }

    wait(callback) {
        this.waitCallbacks.push(callback); // add to end of queue
        this.checkWait(); // attempt to consume wait queue
    }

    checkWait() {
        if (Object.keys(this.queue).length === 0) {
            while (this.waitCallbacks.length > 0) {
                this.waitCallbacks.shift()(); // clear while invoking
            }
        }
    }
}

Modulo.INVALID_WORDS = new Set((`
    break case catch class const continue debugger default delete do else
    enum export extends finally for if implements import in instanceof
    interface new null package private protected public return static super
    switch throw try typeof var let void  while with await async true false
`).split(/\s+/ig));

Modulo.assert = function assert(value, ...info) {
    if (!value) {
        console.error(...info);
        throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
    }
}

Modulo.AssetManager = class AssetManager {
    constructor () {
        this.functions = {};
        this.stylesheets = {};
        this.rawAssets = { js: {}, css: {} };
    }

    getAssets(type, extra = null) {
        // Get an array of assets of the given type, in a stable ordering
        return (extra || []).concat(Object.values(this.rawAssets[type]).sort());
    }

    registerFunction(params, text, opts = {}) {
        const hash = this.getHash(params, text);
        if (!(hash in this.functions)) {
            const funcText = this.wrapFunctionText(params, text, opts);
            this.rawAssets.js[hash] = funcText; // "use strict" only in tag
            this.appendToHead('script', '"use strict";\n' + funcText);
        }
        return this.functions[hash];
    }

    registerStylesheet(text) {
        const hash = Modulo.utils.hash(text);
        if (!(hash in this.stylesheets)) {
            this.stylesheets[hash] = true;
            this.rawAssets.css[hash] = text;
            this.appendToHead('style', text);
        }
    }

    getSymbolsAsObjectAssignment(contents) {
        const regexpG = /function\s+(\w+)/g;
        const regexp2 = /function\s+(\w+)/; // hack, refactor
        const matches = contents.match(regexpG) || [];
        return matches.map(s => s.match(regexp2)[1])
            .filter(s => s && !Modulo.INVALID_WORDS.has(s))
            .map(s => `"${s}": typeof ${s} !== "undefined" ? ${s} : undefined,\n`)
            .join('');
    }

    wrapFunctionText(params, text, opts = {}) {
        let prefix = `Modulo.assets.functions["${this.getHash(params, text)}"]`;
        prefix += `= function ${ opts.funcName || ''}(${ params.join(', ') }){`;
        let suffix = '};'
        if (opts.exports) {
            const symbolsString = this.getSymbolsAsObjectAssignment(text);
            const localVarsIfs = params.map(n => `if (name === '${n}') ${n} = value;`).join(' ');
            prefix += `var ${ opts.exports } = { exports: {} };  `;
            prefix += `function __set(name, value) { ${ localVarsIfs } }`;
            suffix = `return { ${symbolsString} setLocalVariable: __set, exports: ${ opts.exports }.exports}\n};`;
        }
        return `${prefix}\n${text}\n${suffix}`;
    }

    getHash(params, text) {
        return Modulo.utils.hash(params.join(',') + '|' + text);
    }

    appendToHead(tagName, codeStr) {
        const doc = Modulo.globals.document;
        const elem = doc.createElement(tagName);
        elem.setAttribute('modulo-asset', 'y'); // Mark as an "asset"
        if (doc.head === null) {
            // TODO: NOTE: this is still broken, can still trigger before head
            // is created!
            setTimeout(() => doc.head.append(elem), 0);
        } else {
            doc.head.append(elem);
        }
        if (Modulo.isBackend && tagName === 'script') {
            codeStr = codeStr.replace('Modulo.assets.', 'this.'); // replace 1st
            eval(codeStr, this); // TODO Fix this, limitation of JSDOM
        } else {
            elem.textContent = codeStr; // Blocking, causes eval
        }
    }
}

Modulo.jsBuildTemplate = `{% for jsText in jsTexts %}{{ jsText|safe }}{% endfor %}
Modulo.fetchQ.data = {{ fetchQ.data|jsobj|safe }};
{% for text in embeddedSources %}
    Modulo.globalLoader.loadString("{{ text|escapejs|safe }}");
{% endfor %}`;

Modulo.CommandMenu = class CommandMenu {
    static setup() {
        Modulo.cmd = new Modulo.CommandMenu();
        Modulo.globals.m = Modulo.cmd;
    }

    build(opts = {}) {
        opts.type = opts.type || 'build';
        opts.cssFilePath = this.buildcss(opts);
        opts.jsFilePath = this.buildjs(opts);
        const fp = this.buildhtml(opts);
        document.body.innerHTML = `<h1>${ opts.type } : ${ fp }</h1>`;
    }

    bundle() {
        Modulo.utils.fetchBundleData(opts => this.build(opts));
    }

    buildcss(opts = {}) {
        const { saveFileAs, hash } = Modulo.utils;
        const text = Modulo.assets.getAssets('css', opts.cssSources).join('');
        return saveFileAs(`modulo-${ opts.type }-${ hash(text) }.css`, text);
    }

    buildjs(opts = {}) {
        const { saveFileAs, hash } = Modulo.utils;
        const buildTemplate = new Modulo.templating.MTL(Modulo.jsBuildTemplate);
        const jsTexts = Modulo.assets.getAssets('js', opts.scriptSources);
        const text = buildTemplate.render(Object.assign({ jsTexts }, opts, Modulo));
        return saveFileAs(`modulo-${ opts.type }-${ hash(text) }.js`, text);
    }

    buildhtml(opts = {}) {
        const { saveFileAs, getBuiltHTML } = Modulo.utils;
        const filename = window.location.pathname.split('/').pop();
        return saveFileAs(filename, getBuiltHTML(opts));
    }
}

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    Modulo.globals = window;
}
if (!Modulo.fetchQ) { // TODO: Replace this once "new Modulo({})" is ready
    Modulo.fetchQ = new Modulo.FetchQueue();
    Modulo.assets = new Modulo.AssetManager();
    Modulo.globalLoader = new Modulo.Loader(null, { attrs: { namespace: 'x', src: '/' } });
    Modulo.CommandMenu.setup();
}

// End of Modulo.js source code. Below is the latest Modulo project:
// ------------------------------------------------------------------
