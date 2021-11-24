'use strict';

// # Introduction
// Welcome to the Modulo.js source code.

// ## Note
// Earlier versions of Modulo.js's source code were written with literate
// programming (an explanation is contained in the next comment paragraph).
// Most of this documentation has been deleted, but will be rewritten once the
// public API is settled. Until then, the code is riddled with TODO's: It's not
// "literate" and aspires to much better comments, formatting, complexity, etc.

// ## Literate
// Unlike most code files, this one is arranged in a very deliberate way. It's
// arranged in a top-down manner, reflecting the "lifecycle" of a Modulo
// component, such that the earlier and more important code is at the top, and
// later and less important code is at the bottom. You can read it like a
// linear "story" of how Modulo works. Modulo employs [literate
// programming](https://en.wikipedia.org/wiki/Literate_programming), or
// interweaving Markdown-formatted comments on to tell this story, and uses a
// tool (docco) to extract all these comments for easy reading.

if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}

var Modulo = {
    globals: { HTMLElement }, // globals is window in Browser, an obj in Node.js
    reconcilers: {}, // used later, for custom DOM Reconciler classes
    cparts: {}, // used later, for custom CPart classes
    templating: {}, // used later, for custom Templating languages
};


// ## Modulo.defineAll()
// Our Modulo journey begins with `Modulo.defineAll()`, the function invoked to
// "activate" all of Modulo by defining the "mod-load" web component. This
// constructs a Loader object for every `<mod-load ...>` tag it encounters.
Modulo.defineAll = function defineAll() {
    if (!Modulo.fetchQ) {
        Modulo.fetchQ = new Modulo.FetchQueue();
    }

    // Then, looks for embedded modulo components, found in <template modulo>
    // tags or <script type="modulo/embed" tags>. For each of these, it loads
    // their contents into a global loader with namespace 'x'.
    const attrs = { namespace: 'x', src: '/' };
    if (!Modulo.globalLoader) {
        Modulo.globalLoader = new Modulo.Loader(null, { attrs });
    }

    Modulo.CommandMenu.setup();
    Modulo.fetchQ.wait(() => {
        const query = 'template[modulo-embed],modulo,m-module';
        for (const elem of Modulo.globals.document.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            Modulo.globalLoader.loadString(elem.innerHTML);
        }
    });
};

/*
Modulo.DOMLoader = class DOMLoader extends HTMLElement {
    // TODO: Delete DOMLoader
    // The Web Components specifies the use of a "connectedCallback" function.
    // In this case, this function will be invoked as soon as the DOM is loaded
    // with a `<mod-load>` tag in it.
    connectedCallback() {
        if (this.loader) {
            console.log('Error: Duplicate connected?', this.loader.attrs);
            //this.loader.doFetch();
        } else {
            this.initialize();
        }
    }
    initialize() {
        const src = this.getAttribute('src');
        const namespace = this.getAttribute('namespace');
        const opts = {attrs: {namespace, src}};
        this.loader = new Modulo.Loader(null, opts);
        this.loader.doFetch();
    }
}
*/

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
        return {attrs, content, dependencies: attrs.src || null};
    }

    static loadedCallback(data, content) {
        data.content = (data.content || '') + (content || '');
    }

    static factoryCallback() {}

    constructor(element, options) {
        this.element = element;
        this.content = options.content;
        this.attrs = options.attrs;
    }
}

// # Modulo.Loader
// Once registered by `defineAll()`, the `Modulo.Loader` will do the rest of
// the heavy lifting of fetching & registering Modulo components.
Modulo.Loader = class Loader extends Modulo.ComponentPart { // todo, remove component part extension, unused
    // ## Loader: connectedCallback()
    constructor(element = null, options = { attrs: {} }, parentLoader = null) {
        super(element, options);
        this.src = this.attrs.src;

        // TODO: Do some sort of "fork" of cparts Object to allow CPart namespacing
        this.cparts = Modulo.cparts;

        // TODO: "Namespace", should be "global-namespace"?
        // If loader.namespace = null, cause defaulting to hash.
        this.namespace = this.attrs.namespace;
        this.localNameMap = {};
        this.hash = 'zerohash'; // the hash of an unloaded loader
    }

    // ## Loader: loadString
    // The main loading method. This will take a string with the source code to
    // a module as an argument and loop through all `<component ...>` style
    // definitions. Then, it uses `Loader.loadFromDOMElement` to create a
    // `ComponentFactory` instance for each component definition.
    loadString(text, newSrc = null) {
        Modulo.assert(text, 'Text must be a non-empty string, not', text)
        if (newSrc) {
            this.src = newSrc;
        }
        //this.data = this.loadFromDOMElement(Modulo.utils.makeDiv(text));
        this.data = this.loadFromDOMElement(Modulo.utils.makeDiv(text, true));
        this.hash = Modulo.utils.hash(this.hash + text); // update hash
    }

    // ## Loader: loadFromDOMElement
    // Create a ComponentFactory instance from a given `<component>` definition.
    loadFromDOMElement(elem) {

        // ### define CParts
        // Loop through each CPart DOM definition within the component (e.g.
        // `<state>`), invoking the `loadCallback` on each definition (e.g.
        // `Modulo.cparts.state.loadCallback` will get invoked for each
        // `<state>`). This `loadCallback` in turn will do any pre-processing
        // necessary to transform the attributes of the DOM element into the
        // data necessary to define this CPart.
        const array = [];
        const nodes = elem.content ? elem.content.childNodes : elem.children;
        for (const node of nodes) {
            const cPartName = this.getNodeCPartName(node);
            if (!cPartName) {
                continue;
            }
            const cpartClass = this.cparts[cPartName];
            const data = cpartClass.loadCallback(node, this, array);
            array.push([cPartName, data]);

            if (data.dependencies) {
                // Ensure any CPart dependencies are loaded (relative to src)
                const basePath = Modulo.utils.resolvePath(this.src, '..');
                //console.log('this is basePath', basePath);
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
        // of the alt script-tag syntax (eg `<script type="modulo/template">`)
        let cPartName = tagName.toLowerCase();
        const splitType = (node.getAttribute('type') || '').split('/');
        if (splitType[0] && splitType[0].toLowerCase() === 'modulo') {
            cPartName = splitType[1];
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
        // idea: make namespace ALWAYS required, no default? 'x' is only for local/global?
        const attrs = Object.assign({ namespace: 'x' }, data.attrs, { src });
        data.loader = new Modulo.Loader(null, { attrs }, loader);
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

// # Modulo.ComponentFactory

// Now that we have traversed the jungle of loading Modulo component
// definitions, what happens next? Well, for each component that is defined, a
// ComponentFactory instance is created. This class handles instantiating and
// setting up Modulo components whenever they are encountered on an HTML page.

// In Modulo, every component definition consists of a collection of CPart
// configurations. Thus, the ComponentFactory stores the configuration of the
// CParts.
Modulo.ComponentFactory = class ComponentFactory {

    // ## ComponentFactory constructor
    // When a ComponentFactory gets constructed (that is, by the Loader), it in
    // turn sets up expected properties, and then invokes its methods
    // createClass and runFactoryLifeCycle explained next.
    constructor(loader, name, childrenLoadObj) {
        this.loader = loader;
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;

        this.isModule = this.loader.namespace === name; // if name = namespace
        Modulo.ComponentFactory.registerInstance(this);

        this.componentClass = this.createClass();
        this.childrenLoadObj = childrenLoadObj;
        //console.log('this is childrenLoadObj', childrenLoadObj.map(([a, b]) => a));
        this.baseRenderObj = this.runFactoryLifecycle(this.childrenLoadObj);
    }

    // ## ComponentFactory: Factory lifecycle

    // This "factory" lifecycle is a special lifecycle for any global or
    // one-time setup, after component definitions are loaded, but before
    // before any components are constructed. Examples: the Style CPart uses
    // this stage to set up global CSS, the Template CPart uses this to compile
    // the template, and the Script CPart will actually wrap the script-tag &
    // invoke it now.

    // Like every other "lifecycle" in Modulo, it passes around a "renderObj"
    // called baseRenderObj. After this method, this baseRenderObj is not
    // modified, but instead gets copied into every other renderObj to form, as
    // the name implies, the "base" of future renderObj.

    // In total, this method loops through all the CPart names, finding each
    // relevant CPart Classes, and then invoking each CPart static method
    // "factoryCallback", which is what does the necessary preprocessing. If
    // there are multiples of the same CPart, then whichever appears last will
    // overwrite and/or merge data with the previous ones.  However, that
    // particular behavior can be controlled from within each CPart
    // factoryCallback itself.

    // At the end of this method, baseRenderObj will look like this:

    // ```javascript
    // this.baseRenderObj = {
    //     script: {text: '"use strict"\nvar state;\nfunction inpCh(....etc)'},
    //     template: {compiledTemplate: function () { ...etc... }},
    //     (...etc...)
    // }
    // ```
    runFactoryLifecycle(cPartOpts) {
        const baseRenderObj = {};
        for (let [ cPartName, data ] of cPartOpts) {
            const cpCls = Modulo.cparts[cPartName];
            data = cpCls.factoryCallback(data, this, baseRenderObj) || data;
            baseRenderObj[cPartName] = data;
        }
        return baseRenderObj;
    }

    // ## ComponentFactory: createClass
    // Finally, we are ready to create the class that the browser will use to
    // actually instantiate each Component, with a "back reference" to the fac.
    createClass() {
        const { fullName } = this;
        return class CustomElement extends Modulo.Element {
            factory() {
                /* Gets current registered component factory (for hot-reloading) */
                return Modulo.factoryInstances[fullName];
            }
        };
    }

    // ## ComponentFactory: buildCParts
    // This function does the heavy lifting of actually constructing a
    // component, and is invoked when the component is mounted to the page.
    buildCParts(element) {
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

    // ## ComponentFactory: register & registerInstance
    // These are minor helper functions. The first registers with the browser,
    // the second keeps a central location of all component factories defined.
    register() {
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

    initialize() {
        this.cparts = {};
        this.isMounted = false;
        this.originalHTML = null;
        this.originalChildren = [];
        this.fullName = this.factory().fullName;
        this.initRenderObj = Object.assign({}, this.factory().baseRenderObj);
        /*
        if (this.fullName === 'x-Page') {
            console.log('x page');
            console.log('getting initialized!', this.originalHTML);
            console.log('getting initialized!', this.originalChildren, this);
            debugger;
        }
        */
    }

    setupCParts() {
        this.factory().buildCParts(this);
    }

    rerender() {
        this.lifecycle([ 'prepare', 'render', 'update', 'updated' ]);
    }

    lifecycle(lifecycleNames, rObj={}) {
        this.renderObj = Object.assign({}, rObj, this.getCurrentRenderObj());
        for (const lc of lifecycleNames) {
            for (const cName of Object.keys(this.cparts)) {
                this._invokeCPart(cName, lc + 'Callback');
            }
            if (Modulo.breakpoints && (lc in Modulo.breakpoints ||
                    (this.fullName + '|' + lc) in Modulo.breakpoints)) {
                // DEADCODE, finish or delete
                debugger;
            }
        }
        //this.renderObj = null; // ?rendering is over, set to null
    }

    getCurrentRenderObj() {
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }

    _invokeCPart(cpartName, methodName, dirMountArg) {
        // Two valid invocation styles:
        //  _invokeCPart('state.bind', 'Mount', {...})
        //  _invokeCPart('state', 'bindMount')
        const argument = dirMountArg || this.renderObj;
        const splitKey = cpartName.split('.');
        if (splitKey.length === 2) {         // "state.bind"
            cpartName = splitKey[0];         // "state.
            methodName = splitKey[1] + methodName; // .bindMount"
        }
        const method = this.cparts[cpartName][methodName];
        let result;
        if (method) {
            result = method.call(this.cparts[cpartName], argument);
        }
        if (!dirMountArg && result) {
            this.renderObj[cpartName] = result;
        }
        return result;
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
        // HACKy code here
        if (this.hasAttribute('modulo-innerhtml')) { // "modulo-innerhtml" pseudo-directive
            // TODO: Broken SSG-only code: Need to instead move to "template"
            // tag in head with a unique ID to squirrel away resulting DOM, or
            // something similar (and SSG should delete all directives in
            // resulting innerHTML so it forces attachment of them)
            this.originalHTML = this.getAttribute('modulo-innerhtml');
        } else if (!this.isMounted) {
            this.originalHTML = this.innerHTML;
            this.originalChildren = Array.from(this.hasChildNodes() ? this.childNodes : []);
            //console.log('getting original chidlren', this.originalHTML, this.originalChildren);
        }
        // /HACK

        this.setupCParts();
        this.lifecycle([ 'initialized' ])
        this.rerender();
        this.isMounted = true;
    }
}

Modulo.FactoryCPart = class FactoryCPart extends Modulo.ComponentPart {
    static childrenLoadedCallback(childrenLoadObj, loader, data) {
        //console.log('children loaded callback', childrenLoadObj);
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
        // Note: Some of this might go into general config stuff.
        // Also, needs refactor when we get attr defaults.
        const EVENT = 'component.event';
        const DATA_PROP = 'component.dataProp';
        const HEAD = 'component.head';
        const directiveShortcuts = [ [ /^@/, EVENT ], [ /:$/, DATA_PROP ] ];
        const directives = [ DATA_PROP, EVENT, 'component.children' ];
        const tagDirectives = opts.attrs.mode === 'vanish-into-document' ? {
            link: HEAD,
            title: HEAD,
            meta: HEAD,
            // slot: 'component.children',
            script: 'component.script',
        } : { };
        return { directives, directiveShortcuts, tagDirectives };
    }

    headTagLoad({ el }) {
        //el.remove();
        this.element.ownerDocument.head.append(el); // move to head
    }

    scriptTagLoad({ el }) {
        const newScript = Modulo.globals.document.createElement('script');
        newScript.src = el.src; // TODO: Possibly copy other attrs?
        el.remove(); // delete old element
        this.element.ownerDocument.head.append(newScript);
    }

    /* Reconciler ElementCtx interface: */
    /* TODO: Can I refactor into above, e.g. generate a this.elementCtx = {
    ** directiveLoad: () => ... } as a factory step? */
    directiveTagLoad(args) {
        args.element = this.element;
        this.element._invokeCPart(args.directiveName, 'TagLoad', args);
    }

    directiveLoad(args) {
        //console.log('directive load');
        args.element = this.element;
        this.element._invokeCPart(args.directiveName, 'Load', args);
    }

    directiveMount(args) {
        args.element = this.element;
        this.element._invokeCPart(args.directiveName, 'Mount', args);
    }

    directiveUnmount(args) {
        args.element = this.element;
        this.element._invokeCPart(args.directiveName, 'Unmount', args);
    }

    directiveChange(args) {
        args.element = this.element;
        this.element._invokeCPart(args.directiveName, 'Change', args);
    }

    initializedCallback(renderObj) {
        this.localNameMap = this.element.factory().loader.localNameMap;
        this.mode = this.attrs.mode || 'regular'; // TODO rm and check tests
        if (this.mode === 'shadow') {
            this.element.attachShadow({ mode: 'open' });
        }
        this.newReconciler(renderObj.component);
    }

    newReconciler({ directives, directiveShortcuts, tagDirectives }) {
        this.reconciler = new Modulo.reconcilers[this.attrs.engine]({
            directives,
            directiveShortcuts,
            tagDirectives,
            makePatchSet: true,
            elementCtx: this,
        });
    }

    prepareCallback() {
        const { originalHTML } = this.element;
        return { originalHTML, innerHTML: null, patches: null };
    }

    updateCallback(renderObj) {
        let { innerHTML, patches, root } = renderObj.component;
        if (innerHTML !== null) {

            if (!this.reconciler) { // XXX (Delete this, only needed for SSG)
                this.newModRec(renderObj);
            }

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

    updatedCallback(renderObj) {
        const { patches, innerHTML } = renderObj.component;
        if (patches) {
            this.reconciler.applyPatches(patches);
        }

        if (!this.element.isMounted && (this.mode === 'vanish' ||
                                        this.mode === 'vanish-into-document')) {
            // First time initialized, and is one of the vanish modes
            this.element.replaceWith(...this.element.childNodes); // Replace self
            this.element.remove();
            //console.log('removing!', this.element);
        }
    }

    handleEvent(func, payload, ev) {
        this.element.lifecycle([ 'event' ], { _eventFunction: func });
        const { value } = (ev.target || {}); // Get value if is <INPUT>, etc
        func.call(null, payload === undefined ? value : payload, ev);
        this.element.lifecycle([ 'eventCleanup' ]); // todo: should this go below rerender()?
        if (this.attrs.rerender !== 'manual') {
            this.element.rerender(); // always rerender after events
        }
    }

    childrenLoad({ el, value }) {
        let chosenSlot = value || el.getAttribute('name') || null;
        const getSlot = c => c.getAttribute ? (c.getAttribute('slot') || null) : null;
        let childs = this.element.originalChildren;
        childs = childs.filter(child => getSlot(child) === chosenSlot);
        el.append(...childs);
    }

    eventMount({el, value, attrName, rawName}) {
        // TODO: Make it @click.payload, and then have this see if '.' exists
        // in attrName and attach as payload if so
        const { resolveDataProp } = Modulo.utils;
        const get = (key, key2) => resolveDataProp(key, el, key2 && get(key2));
        const func = get(attrName);
        Modulo.assert(func, `Bad @${attrName} event: ${value} is falsy`);
        if (!el.moduloEvents) {
            el.moduloEvents = {};
        }
        const plName = attrName + '.payload';
        const listen = ev => this.handleEvent(func, get(plName, 'payload'), ev);
        el.moduloEvents[value] = listen;
        el.addEventListener(attrName, listen);
    }

    eventChange(info) {
        // TODO: test this, or replace Change with Unmount -> Mount as default
        this.eventUnmount(info);
        this.eventMount(info);
    }

    eventUnmount({ el, attrName }) {
        const listen = el.moduloEvents[attrName];
        el.removeEventListener(attrName, listen);
        delete el.moduloEvents[attrName];
    }

    dataPropMount({ el, value, attrName, element }) {
        const { get } = Modulo.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
        }
        const val = get(element.getCurrentRenderObj(), value);
        const index = attrName.lastIndexOf('.') + 1;
        const key = attrName.slice(index);
        const path = attrName.slice(0, index);
        const dataObj = index > 0 ? get(el.dataProps, path) : el.dataProps;
        dataObj[key] = typeof val === 'function' ? val.bind(dataObj) : val;
    }
    dataPropUnmount({el, attrName}) {
        delete el.dataProps[attrName];
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
        for (let [propName, def] of Object.entries(this.attrs)) {
            propName = propName.replace(/:$/, ''); // TODO, make func to normalize directives
            props[propName] = resolveDataProp(propName, this.element, def);
        }
        return props;
    }
}

Modulo.cparts.testsuite = class TestSuite extends Modulo.ComponentPart {
    static factoryCallback() {
        console.count('Ignored test-suite');
        return {}; // wipe contents
    }
}

Modulo.cparts.style = class Style extends Modulo.ComponentPart {
    static factoryCallback({content}, factory, renderObj) {
        const { prefixAllSelectors } = Modulo.cparts.style;
        const { loader, name, fullName } = factory;
        const doc = Modulo.globals.document;
        content = prefixAllSelectors(loader.namespace, name, content);
        const id = `${fullName}_Modulo_Style`;
        let elem = doc.getElementById(id);
        if (!elem) {
            elem = doc.createElement('style');
            elem.id = id;
            if (doc.head === null) {
                // NOTE: this is still broken, can still trigger
                // before head is created!
                setTimeout(() => doc.head.append(elem), 0);
            } else {
                doc.head.append(elem);
            }
        }
        elem.textContent = content;
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
    static factoryCallback(opts, factory, loadObj) {
        // TODO: Delete this after we are done with directive-based expansion
        const tagPref = '$1' + factory.loader.namespace + '-';
        return {content: (opts.content || '').replace(/(<\/?)my-/ig, tagPref)};
    }

    constructor(element, options) {
        super(element, options);
        const engineClass = Modulo.templating[this.attrs.engine || 'MTL'];
        // TODO: Do not put here! Move to factoryCallback, since otherwise
        // it will compile every time (unless we cache templates)
        this.instance = new engineClass(this.content, this.attrs);
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
    static getSymbolsAsObjectAssignment(contents) {
        const regexpG = /function\s+(\w+)/g;
        const regexp2 = /function\s+(\w+)/; // hack, refactor
        const matches = contents.match(regexpG) || [];
        return matches.map(s => s.match(regexp2)[1])
            .filter(s => s && !Modulo.INVALID_WORDS.has(s))
            .map(s => `"${s}": typeof ${s} !== "undefined" ? ${s} : undefined,\n`)
            .join('');
    }

    static wrapJavaScriptContext(contents, localVars) {
        const symbolsString = this.getSymbolsAsObjectAssignment(contents);
        const localVarsLet = localVars.join(',') || 'noLocalVars=true';
        const localVarsIfs = localVars
          .map(n => `if (name === '${n}') ${n} = value;`).join('\n');


        return `'use strict';
            var ${localVarsLet};
            var script = { exports: {} };
            function __set(name, value) { ${localVarsIfs} }
            ${contents}
            return { ${symbolsString} setLocalVariable: __set, exports: script.exports};
        `;
    }

    static factoryCallback(partOptions, factory, renderObj) {
        // TODO: Much better idea:
        // Put into IFFE (with same arguments as here) and then put into script
        // tag into page.  Only do "just in time, e.g. before first time
        // mounting this on this page. Just like with style.  That way we'll
        // get full traceback, etc. Would maybe increase speed by preloading
        // scripts too.
        const code = partOptions.content || '';
        const localVars = Object.keys(renderObj);
        localVars.push('element'); // add in element as a local var
        localVars.push('cparts');
        // TODO: shouldn't use "this" in static (?)
        const wrappedJS = this.wrapJavaScriptContext(code, localVars);
        const ns = factory.loader.namespace;
        const moduleFac = Modulo.factoryInstances[`{ns}-{ns}`];
        const module = moduleFac ? moduleFac.baseRenderObj : null;
        const results = (new Function('Modulo, factory, module', wrappedJS))
                           .call(null, Modulo, factory, module);
        if (results.factoryCallback) {
            //this.prepLocalVars(renderObj); // ?
            results.factoryCallback(partOptions, factory, renderObj);
        }
        results.localVars = localVars;
        return results;
    }

    cb(func) {
        const renderObj = this.element.getCurrentRenderObj();
        return (...args) => {
            this.prepLocalVars(renderObj);
            func(...args);
            //this.clearLocalVariablesj(renderObj);
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
                if (cbName in script) { // if we also have this
                    script[cbName](arg);
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
    static factoryCallback(partOptions, factory, loadObj) {
        if (loadObj.component) {
            loadObj.component.directives.push('state.bind');
        }
    }

    initializedCallback(renderObj) {
        this.rawDefaults = renderObj.state.attrs || {};
        this.boundElements = {};
        if (!this.data) {
            this.data = Modulo.utils.simplifyResolvedLiterals(this.rawDefaults);
        }
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

Modulo.cparts.store = class Store extends Modulo.cparts.state {
    initializedCallback(renderObj) {
        const cls = Modulo.cparts.store;
        if (!('boundElements' in cls)) {
            cls.storeData = {};
            cls.boundElements = {};
        }
        super.initializedCallback(renderObj);

        if (!(this.attrs.slice in cls.storeData)) {
            cls.storeData[this.attrs.slice] = {};
            cls.boundElements[this.attrs.slice] = {};
        }
        this.data = cls.storeData[this.attrs.slice];
        // TODO: Make boundElements support Many to One (probably for state,
        // why not) so that if one component changes Store, all components
        // change Store.
        this.boundElements = cls.boundElements[this.attrs.slice];
    }
}

// ModuloTemplate
Modulo.templating.MTL = class ModuloTemplateLanguage {
    constructor(text, options) {
        Object.assign(this, Modulo.templating.defaultOptions, options);
        // this.opAliases['not in'] = `!(${this.opAliases['in']})`;
        this.renderFunc = this.compile(text);
    }

    tokenizeText(text) {
        // Join all modeTokens with | (OR in regex).
        // Replace space with wildcard capture.
        const re = '(' + this.modeTokens.join('|(').replace(/ +/g, ')(.+?)');
        return text.split(RegExp(re)).filter(token => token !== undefined);
    }

    compile(text) {
        this.stack = []; // Template tag stack
        this.output = 'var OUT=[];'; // Variable used to accumulate code
        let mode = 'text'; // Start in text mode
        for (const token of this.tokenizeText(text)) {
            if (mode) { // if in a "mode" (text or token), then call mode func
                const result = this.modes[mode](token, this, this.stack);
                this.output += result || '';
            }
            // FSM for mode: ('text' -> null) (null -> token) (* -> 'text')
            mode = (mode === 'text') ? null : (mode ? 'text' : token);
        }
        // console.log('this is the rsulting template code', this.output.replace(/([;\}\{])/g, '$1\n'));
        return new Function('CTX,G', this.output + ';return OUT.join("");');
    }

    render(renderObj) {
        return this.renderFunc(Object.assign({renderObj}, renderObj), this);
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
    opAliases: {
        '==': 'X === Y',
        'is': 'X === Y',
        'gt': 'X > Y',
        'lt': 'X < Y',
        'is not': 'X !== Y',
        //'and': 'X && Y',
        //'or': 'X || Y',
        'not': '!(Y)',
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
    '{#': (text, tmplt) => {},
    '{{': (text, tmplt) => `OUT.push(G.escapeHTML(${tmplt.parseExpr(text)}));`,
    text: (text, tmplt) => text && `OUT.push(${JSON.stringify(text)});`,
};

Modulo.templating.defaultOptions.filters = (function () {
    //const { get } = Modulo.utils; // TODO, fix this code duplciation
    function get(obj, key) {
        return obj[key];
    }

    // TODO: Once we get unit tests for build, replace jsobj with actual loop
    // in build template (and just backtick escape as filter). Make sure keys
    // are alphabetical (stable).
    function jsobj(obj, arg) {
        let s = '{\n';
        for (const [key, value] of Object.entries(obj)) {
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
    // Idea: Could move more utils here, e.g. style:
    // stripcomments: s => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''),

    // Idea: Generalized "matches" filter that gets registered like such:
    //     defaultOptions.filters.matches = {name: //ig}
    // Then we could configure "named" RegExps in Script that get used in
    // template

    const filters = {
        add: (s, arg) => s + arg,
        allow: (s, arg) => arg.split(',').includes(s) ? s : '',
        capfirst: s => s.charAt(0).toUpperCase() + s.slice(1),
        concat: (s, arg) => s.concat ? s.concat(arg) : s + arg,
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
        pluralize: (s, arg) => arg.split(',')[(s === 1) * 1],
        subtract: (s, arg) => s - arg,
        truncate: (s, arg) => ((s.length > arg*1) ? (s.substr(0, arg-1) + '…') : s),
        renderas: (rCtx, template) => safe(template.instance.render(rCtx)),
        reversed: s => Array.from(s).reverse(),
        upper: s => s.toUpperCase(),
    };
    return Object.assign(filters, { get, jsobj, safe });
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
    'and': (text, tmplt) => {
        // Another idea: Use "while ()" for "if", then use "break LABEL;" for "and"
        // tmplt.output[tmplt.output.length - 1].replace(') {', ' && ' + condition + ') {')
        return '';
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
        // TODO: Upgrade to of (after good testing), since probably
        // no need to support for..in
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
    /*
    // Should complete, very useful template tag: Basically the ... splat
    // operator.
    'attrs': (text, tmplt) {
        const expr = tmplt.parseExpr(text);
        return {start: `G.OUT.push(Modulo.utils.escapeAttrs(${expr}));`};
    },
    */
};


// TODO: 
//  - Then, re-implement [component.key] and [component.ignore] as TagLoad
//  - Possibly: Use this to then do granular patches (directiveMount etc)
Modulo.reconcilers.Cursor = class Cursor {
    constructor(parentNode, parentRival) {
        this.initialize(parentNode, parentRival);
    }
    initialize(parentNode, parentRival) {
        this.nextChild = parentNode.firstChild;
        this.nextRival = parentRival.firstChild;
        this.keyedChildren = {};
        this.keyedRivals = {};
        this.parentNodeQueue = [];
        this.keyedChildrenArr = null;
        this.keyedRivalsArr = null;
    }

    pushDescent(parentNode, parentRival) {
        // DEADCODE
        // (see note on BFS vs DFS)
        this.parentNodeQueue.push([parentNode, parentRival]);
    }

    popDescent() {
        // DEADCODE
        if (this.parentNodeQueue.length < 1) {
            return false;
        }
        const result = this.parentNodeQueue.shift();
        //console.log('this is reuslt', result);
        this.initialize(...result);
        return true;
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
        // DEADCODE -v
        return this.popDescent();
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
        const matchFound = matchedChild !== child && keyWasFound
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
        this.makePatchSet = !!opts.makePatchSet;
        this.shouldNotDescend = !!opts.doNotDescend;
        this.elementCtx = opts.elementCtx;
        this.tagTransforms = opts.tagTransforms;

        // New configs --- TODO remove this once ModRec tests are
        // refactored
        const EVENT = 'component.event';
        const DATA_PROP = 'component.dataProp';
        const defDirShort = [ [ /^@/, EVENT ], [ /:$/, DATA_PROP ] ];
        const defDir = [ DATA_PROP, EVENT, 'component.children' ];
        this.directives = opts.directives || defDir;
        this.tagDirectives = opts.tagDirectives || {};
        this.directiveShortcuts = opts.directiveShortcuts || defDirShort;
        Modulo.assert(this.directiveShortcuts, 'must have shortcuts');
    }

    loadString(rivalHTML, tagTransforms) {
        this.patches = [];
        const rival = Modulo.utils.makeDiv(rivalHTML, true);
        const transforms = Object.assign({}, this.tagTransforms, tagTransforms);
        this.applyLoadDirectives(rival, transforms);
        if (this.patches.length) { // Were patches found?
            this.applyPatches(this.patches); // They were, apply...
            this.patches = []; // ...and clear.
        }
        return rival;
    }

    reconcile(node, rival, tagTransforms) {
        // Note: Always attempts to reconcile (even on first mount), in case
        // it's been pre-rendered
        // TODO: should normalize <!DOCTYPE html>
        if (!this.elementCtx) {
            this.elementCtx = node; // element context
        }
        if (typeof rival === 'string') {
            rival = this.loadString(rival, tagTransforms);
        }
        this.reconcileChildren(node, rival);
        this.cleanRecDirectiveMarks(node);
        if (!this.makePatchSet) { // should ONLY makePatchSet
            this.applyPatches(this.patches);
        }
        return this.patches;
    }

    applyLoadDirectives(elem, tagTransforms) {
        //const sel = Object.keys(tagTransforms).join(',');
        //for (const node of elem.querySelectorAll(sel || 'X')) {
        this._oldPatch = this.patch;
        this.patch = this.applyPatch; // Apply patches immediately
        for (const node of elem.querySelectorAll('*')) {
            // legacy -v, TODO rm
            const newTag = tagTransforms[node.tagName.toLowerCase()];
            if (newTag) {
                Modulo.utils.transformTag(node, newTag);
            }
            ///////

            const dName = this.tagDirectives[node.tagName.toLowerCase()];
            if (dName) {
                this.patchDirectives(node, `[${dName}]${node.tagName}`, 'TagLoad');
            }
            for (const rawName of node.getAttributeNames()) {
                // Apply load-time directive patches
                this.patchDirectives(node, rawName, 'Load');
            }
        }
        this.markRecDirectives(elem); // TODO rm
        this.patch = this._oldPatch;
    }

    markRecDirectives(elem) {
        // TODO remove this after we reimplement [component.ignore]
        // Mark all children of modulo-ignore with mm-ignore
        for (const node of elem.querySelectorAll('[modulo-ignore] *')) {
            // TODO: Very important: also mark to ignore children that are
            // custom!
            node.setAttribute('mm-ignore', 'mm-ignore');
        }
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

    reconcileChildren(node, rivalParent) {
        // Nonstandard nomenclature: "The rival" is the node we wish to match
        const cursor = new Modulo.reconcilers.Cursor(node, rivalParent);
        while (cursor.hasNext()) {
            const [ child, rival ] = cursor.next();

            // Does this node to be swapped out? Swap if exist but mismatched
            const needReplace = child && rival && (
                child.nodeType !== rival.nodeType ||
                child.nodeName !== rival.nodeName
            );

            if ((child && !rival) || needReplace) { // we have more rival, delete child
                this.patchAndDescendants(child, 'Unmount');
                this.patch(node, 'removeChild', child);
            }

            if (needReplace) { // do swap with insertBefore
                this.patch(node, 'insertBefore', rival, child.nextSibling);
                this.patchAndDescendants(rival, 'Mount');
            }

            if (!child && rival) { // we have less than rival, take rival
                this.patch(node, 'appendChild', rival);
                this.patchAndDescendants(rival, 'Mount');
            }

            if (child && rival && !needReplace) {
                // Both exist and are of same type, let's reconcile nodes
                this.reconcileMatchedNodes(child, rival, cursor);
            }
        }
    }

    reconcileMatchedNodes(child, rival, cursor) {
        if (child.nodeType !== 1) { // text or comment node
            if (child.nodeValue !== rival.nodeValue) { // update
                this.patch(child, 'node-value', rival.nodeValue);
            }
        } else if (!child.isEqualNode(rival)) { // sync if not equal
            this.reconcileAttributes(child, rival);
            if (rival.hasAttribute('modulo-ignore')) {
                //console.log('Skipping ignored node');
            } else if (!this.shouldNotDescend) {
                // NOTE: Cannot do pushDescent (which would be BFS, then) since
                // presently only works with DFS, for some reason.
                // EASIEST SOLUTION: Create a new "descend()"
                // that does the inverse: push current settings
                // onto queue, but start new settings
                //cursor.pushDescent(child, rival);
                this.reconcileChildren(child, rival);
            }
        }
    }

    patch(node, method, arg, arg2 = null) {
        this.patches.push([ node, method, arg, arg2 ]);
    }

    applyPatch(node, method, arg, arg2) { // take that, rule of 3!
        if (method === 'node-value') {
            node.nodeValue = arg;
        } else if (method === 'insertBefore') {
            node.insertBefore(arg, arg2); // Needs 2 arguments
        } else {
            /*
            if (!(method in node)) {
                console.error('Invalid Patchset: ', node, 'has no', method);
            } else {
            }
            */
            node[method].call(node, arg); // invoke method
        }
    }

    patchDirectives(el, rawName, suffix) {
        const callbackName = 'directive' + suffix;
        const directives = Modulo.utils.parseDirectives(rawName, this.directiveShortcuts);
        if (directives) {
            const value = el.getAttribute(rawName);
            for (const directive of directives) {
                Object.assign(directive, { value, el, callbackName });
                this.patch(this.elementCtx, callbackName, directive);
                //const result = this.elementCtx.directiveCallback(directive, suffix);
                //if (result) {
                //    this.patch(this.elementCtx, callbackName, directive);
                //}
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
            const suffix = myAttrs.has(rawName) ? 'Change' : 'Mount';
            this.patchDirectives(rival, rawName, suffix);
            this.patch(node, 'setAttributeNode', attr.cloneNode(true));
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
                // Loop through each attribute patching directives as necessary
                this.patchDirectives(rival, rawName, actionSuffix);
            }
        }
    }
}


Modulo.utils = class utils {
    static simplifyResolvedLiterals(attrs) {
        // TODO: rm, this will be obsolte once dataProps is done to load stage
        const obj = {};
        for (let [name, value] of Object.entries(attrs)) {
            name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
            if (name.endsWith(':')) {
                name = name.slice(0, -1); // slice out colon
                Modulo.assert(value.trim(), `Invalid literal: ${name}="${value}"`);
                value = JSON.parse(value.trim());
            }
            obj[name] = value;
        }
        return obj;
    }

    static mergeAttrs(elem, defaults) {
        const attrs = Modulo.utils.parseAttrs(elem);
        return Object.assign(defaults, attrs, elem.dataProps || {});
    }

    static parseAttrs(elem) {
        const obj = {};
        for (let name of elem.getAttributeNames()) {
            const value = elem.getAttribute(name);
            name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
            obj[name] = value;
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
        if (inFrag) { // TODO: Don't think there's a reason for frags, actually
            const frag = new Modulo.globals.DocumentFragment();
            frag.appendChild(div);
        }
        return div;
    }

    static normalize(html) {
        // Normalize space to ' ' & trim around tags
        return html.replace(/\s+/g, ' ').replace(/(^|>)\s*(<|$)/g, '$1$2').trim();
    }

    static loadNodeData(node) {
        // DEAD CODE
        const {parseAttrs} = Modulo.utils;
        const {tagName, dataProps} = node;
        const attrs = Object.assign(parseAttrs(node), dataProps);
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
        workingDir = workingDir || '';
        // Similar to Node's path.resolve()
        const combinedPath = workingDir + '/' + relPath;
        const newPath = [];
        for (const pathPart of combinedPath.split('/')) {
            //console.log('this is path part', pathPart);
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
        // Simple, insecure, hashing function, returns base32 hash
        let h = 0;
        let hashChunks = [];
        for(let i = 0; i < str.length; i++) {
            /*
            if (i % (str.length / hashChunkSize) === 0) {
                hashChunks.push(h); // for hashChunkSize count chunks
                h = 0;
            }
            */
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return (h || 0).toString(32);
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

    static parseDirectives(rawName, directiveShortcuts) { //, directives) {
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
}

Modulo.FetchQueue = class FetchQueue {
    constructor() {
        this.queue = {};
        this.data = {};
        this.waitCallbacks = [];
        this.finallyCallbacks = [];
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
            callback(this.data[src], label); // Synchronous route
        } else if (!(src in this.queue)) {
            this.queue[src] = [callback];
            // TODO: Think about if cache:no-store
            Modulo.globals.fetch(src, {cache: 'no-store'})
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
    break case  catch class  const continue debugger default delete  do  else
    enum  export extends finally  for if implements  import  in instanceof
    interface new null  package  private protected  public return static  super
    switch throw  try typeof var  void  while with await async
`).split());

//Modulo.RESERVED_WORDS = ['true', 'false', 'this'] // ? void

Modulo.assert = function assert(value, ...info) {
    if (!value) {
        console.error(...info);
        throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
    }
}

// TODO: Probably should do this on an onload event or similar
//Modulo.globals.onload = () => Modulo.defineAll();
Modulo.buildTemplate = new Modulo.templating.MTL(`// modulo build {{ hash }}
{{ source|safe }};\n
Modulo.defineAll();
Modulo.fetchQ.data = {{ fetchData|jsobj|safe }};
{% for path in preload %}
//  Preloading page: {{ path|escapejs|safe }} {# Loads content in global #}
Modulo.globalLoader.loadString(Modulo.fetchQ.data["{{ path|escapejs|safe }}"],
                               "{{ path|escapejs|safe }}");
{% endfor %}`);

Modulo.CommandMenu = class CommandMenu {
    static setup() {
        Modulo.cmd = new Modulo.CommandMenu();
        Modulo.globals.m = Modulo.cmd;
    }
    target(elem) {
        if (!this.targeted) {
            this.targeted = [];
        }
        this.targeted.push([elem.factory.fullName, elem.instanceId, elem]);
    }
    build() {
        const {document, console} = Modulo.globals;
        console.group('BUILD');
        const {src} = document.querySelector('script[src*="/Modulo.js"]');
        const {fetchQ} = Modulo;
        fetchQ.enqueue(src, source => {
            //const js = Modulo.buildTemplate.render({hash, fetchQ, source});
            // TODO: finish, offer to download, also build CSS
        });
    }
}

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    Modulo.globals = window;
}

// End of Modulo.js source code. Below is the latest Modulo project:
// ------------------------------------------------------------------
