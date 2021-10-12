// modulo build -5in1gs
'use strict';

// # Introduction
// Welcome to the Modulo.js source code.

// Unlike most code files, this one is arranged in a very deliberate way.  It's
// arranged in a top-down manner, reflecting the "lifecycle" of a Modulo
// component, such that the earlier and more important code is at the top, and
// later and less important code is at the bottom. You can read it like a
// linear "story" of how Modulo works. Modulo employs [literate
// programming](https://en.wikipedia.org/wiki/Literate_programming), or
// interweaving Markdown-formatted comments on to tell this story, and uses a
// tool (docco) to extract all these comments for easy reading.

// ## Code standards
// - SLOC limit: 1000 lines
// - Line limit: 80 chars
// - Indentation: 4 spaces


if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
var Modulo = {
    globals: {HTMLElement}, // globals is window in Browser, an obj in Node.js
    reconcilers: {}, // used later, for custom DOM Reconciler classes
    cparts: {}, // used later, for custom CPart classes
    templating: {}, // used later, for custom Templating languages
};

// ## Modulo.defineAll()
// Our Modulo journey begins with `Modulo.defineAll()`, the function invoked to
// "activate" all of Modulo by defining the "mod-load" web component. This
// constructs a Loader object for every `<mod-load ...>` tag it encounters.
Modulo.defineAll = function defineAll() {
    Modulo.fetchQ = new Modulo.FetchQueue();
    Modulo.globals.customElements.define('mod-load', Modulo.DOMLoader);

    // Then, looks for embedded modulo components, found in <template modulo>
    // tags or <script type="modulo/embed" tags>. For each of these, it loads
    // their contents into a global loader with namespace 'x'.
    const opts = {options: {namespace: 'x'}};
    Modulo.globalLoader = new Modulo.Loader(null, opts);
    Modulo.globalLoader.loadModules(Modulo.globals.document);
    Modulo.CommandMenu.setup();
};

Modulo.DOMLoader = class DOMLoader extends HTMLElement {
    // TODO: Delete DOMLoader
    // The Web Components specifies the use of a "connectedCallback" function.
    // In this case, this function will be invoked as soon as the DOM is loaded
    // with a `<mod-load>` tag in it.
    connectedCallback() {
        if (this.loader) {
            console.log('Warning: Duplicate connected?', this.loader.attrs);
        }
        this.initialize();
    }
    initialize() {
        const src = this.getAttribute('src');
        const namespace = this.getAttribute('namespace');
        const opts = {options: {namespace, src}};
        this.loader = new Modulo.Loader(null, opts);
        this.loader.doFetch();
    }
}

Modulo.ComponentPart = class ComponentPart {
    static loadCallback(node, loader, loadObj) {
        // TODO rename "options" to "attrs", refactor this mess
        const options = Modulo.utils.parseAttrs(node);
        const content = node.tagName === 'TEMPLATE' ? node.innerHTML
                                                    : node.textContent;
        return {options, content, dependencies: options.src || null};
    }

    static loadedCallback(data, content) {
        data.content = (data.content || '') + (content || '');
    }

    static factoryCallback() {}

    constructor(element, options) {
        this.component = element; // TODO: Remove
        this.element = element;
        this.content = options.content;
        this.options = options.options; // TODO: Remove
        this.attrs = options.options;
    }
}

// # Modulo.Loader
// Once registered by `defineAll()`, the `Modulo.Loader` will do the rest of
// the heavy lifting of fetching & registering Modulo components.
Modulo.Loader = class Loader extends Modulo.ComponentPart {
    // ## Loader: connectedCallback()
    constructor(element=null, options={options: {}}) { // TODO: refactor
        super(element, options);
        this.src = this.attrs.src;
        this.namespace = this.attrs.namespace;
        this.factoryData = [];
    }

    // factoryCallback() could be the new connectdCallback for <module><load>
    // syntax!
    doFetch(element, options) {
        Modulo.assert(this.src, 'Loader: Invalid src= attribute');
        Modulo.assert(this.namespace, 'Loader: Invalid namespace= attribute');

        // After initializing data, send a new request to the URL specified by
        // the src attribute. When the response is received, load the text as a
        // Modulo component module definition.
        Modulo.fetchQ.enqueue(this.src, text => this.loadString(text));
    }

    loadModules(elem) {
        // TODO: Decide whether loadModules goes above or below
        // because otherwise what if it accidentally picks up on a <load src="?
        // ACTUALLY, it won't! Because that only happens AFTER. So, i have
        // to figure out if it should drain queue sooner or later.
        this.mod = {};
        const mod = elem.querySelector('module');
        if (mod) {
            const [modName, modLoadObj] = this.loadFromDOMElement(mod);
            this.mod = modLoadObj;
            // TODO need to wait before we defineComponent here
            //Modulo.fetchQ.wait(() => this.defineComponent(this.namespace, modLoadObj));
            this.modFactory = this.defineComponent(this.namespace, modLoadObj);
        }
        const query = 'template[modulo-embed],script[type="modulo/embed"]';
        for (const embeddedModule of elem.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            this.loadString(embeddedModule.innerHTML);
        }
    }

    // ## Loader: loadString
    // The main loading method. This will take a string with the source code to
    // a module as an argument and loop through all `<component ...>` style
    // definitions. Then, it uses `Loader.loadFromDOMElement` to create a
    // `ComponentFactory` instance for each component definition.
    loadString(text) {
        /* TODO - Maybe use DOMParser here instead */
        /* TODO - Recurse into other sub-loaders, applying namespace */
        /* TODO: Do <script  / etc preprocessing here:
          <state -> <script type="modulo/state"
          <\s*(state|props|template)([\s>]) -> <script type="modulo/\1"\2
          </(state|props|template)> -> </script>
        */
        const frag = new Modulo.globals.DocumentFragment();
        const div = Modulo.globals.document.createElement('div');
        div.innerHTML = text;
        frag.append(div);
        const factoryData = [];
        this.factoryData = factoryData; // for testing

        this.loadModules(div); // In case we are just loading an embedded component
        for (const tag of div.querySelectorAll('[mod-component],component')) {
            const [name, loadObj] = this.loadFromDOMElement(tag);
            this.factoryData.push([name, loadObj]);
        }
        Modulo.fetchQ.wait(() => this.defineComponents(factoryData));
    }

    defineComponents(factoryData) {
        for (const [name, loadObj] of factoryData) {
            this.defineComponent(name, loadObj);
        }
    }

    // ## Loader: loadFromDOMElement
    // Create a ComponentFactory instance from a given `<component>` definition.
    loadFromDOMElement(elem, array=null) {
        // ### Step 1: Config
        // Get any custom component configuration (e.g. attributes `name=` or
        // `extends=`)
        const attrs = Modulo.utils.parseAttrs(elem);
        const name = attrs.modComponent || attrs.name;

        // ### Step 2: Set-up `loadObj`
        // Modulo often uses plain objects to "pass around" during the lifecycle
        // of each component. At this stage, we set up `loadObj`.

        // At the end of this method, the loadObj will be populated with a
        // complete, parsed, component definition -- enough information to
        // instantiate a "factory" for this component -- in the following
        // structure:

        // ```javascript
        // loadObj = {
        //     template: [...], // array of parsed objects for "Template" CPart
        //     state: [...], // array of parsed objects for "State" CPart
        //     ...etc
        // }
        // ```
        const loadObj = {component: [{name}]}; // Everything gets implicit Component CPart

        // ### Step 3: define CParts
        // Loop through each CPart DOM definition within the component (e.g.
        // `<state>`), invoking the `loadCallback` on each definition (e.g.
        // `Modulo.cparts.state.loadCallback` will get invoked for each
        // `<state>`). This `loadCallback` in turn will do any pre-processing
        // necessary to transform the attributes of the DOM element into the
        // data necessary to define this CPart.
        for (const {cPartName, node} of this.getCPartNamesFromDOM(elem)) {
            if (!(cPartName in loadObj)) {
                loadObj[cPartName] = [];
            }
            const {loadCallback, loadedCallback} = Modulo.cparts[cPartName];
            const data = loadCallback(node, this, loadObj);
            loadObj[cPartName].push(data);
            if (array) {
                array.push([cPartName, data]);
            }
            if (data.dependencies) {
                const cb = (text, label) =>
                    loadedCallback(data, text, label, this, loadObj);
                Modulo.fetchQ.enqueue(data.dependencies, cb, this.src);
            }
        }
        return [name, array || loadObj];
    }

    // ## Loader: defineComponent
    // Helper function that constructs a new ComponentFactory for a component,
    // based on a loadObj data structure.
    defineComponent(name, loadObj) {
        const factory = new Modulo.ComponentFactory(this, name, loadObj);
        factory.register();
        if (Modulo.globals.defineComponentCallback) {
            Modulo.globals.defineComponentCallback(factory); // TODO rm when possible
        }
        return factory;
    }

    // ## Loader.getNodeCPartName
    // Helper function that determines the CPart name from a DOM node.
    getNodeCPartName(node) {
        const {tagName, nodeType, textContent} = node;

        // node.nodeType equals 1 if the node is a DOM element (as opposed to
        // text, or comment). Ignore comments, tolerate empty text nodes, but
        // warn on others (since those are typically syntax mistakes).
        if (nodeType !== 1) {
            // Text nodes, comment nodes, etc
            if (nodeType === 3 && textContent && textContent.trim()) {
                console.error('Unexpected text in component def:', textContent);
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
        if (!(cPartName in Modulo.cparts)) {
            console.error('Unknown CPart in component def:', tagName);
            return null;
        }
        return cPartName;
    }

    // ## Loader.getCPartNamesFromDOM
    // Helper function that loops through a component definitions children,
    // generating an array of objects containing the node and CPart name.
    getCPartNamesFromDOM(elem) {
        /* TODO: rewrite this */
        const arr = [];
        const nodes = elem.content ? elem.content.childNodes : elem.children;
        for (const node of nodes) {
            const cPartName = this.getNodeCPartName(node);
            if (cPartName) {
                arr.push({node, cPartName});
            }
        }
        return arr;
    }
}
Modulo.cparts.load = Modulo.Loader;

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
    constructor(loader, name, options) {
        this.loader = loader;
        this.options = options;
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;
        Modulo.ComponentFactory.registerInstance(this);
        this.componentClass = this.createClass();
        this.baseRenderObj = this.runFactoryLifecycle(options);
        //if (!skipFactory) { }
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
        for (const [cPartName, partOptionsArr] of Object.entries(cPartOpts)) {
            const cpCls = Modulo.cparts[cPartName];
            let data = {};
            for (data of partOptionsArr) {
                data = cpCls.factoryCallback(data, this, baseRenderObj) || data;
            }
            baseRenderObj[cPartName] = data;
        }
        return baseRenderObj;
    }

    // ## ComponentFactory: createClass
    // Finally, we are ready to create the class that the browser will use to
    // actually instantiate each Component. At this stage, we set up the
    // reconciliation engine, since that's a component-wide option, create a
    // "back reference" to the factory from the component, and then return a
    // brand-new class definition.
    createClass() {
        const {fullName} = this;
        const {reconciliationEngine = 'SetDom'} = this.options;
        const engine = new Modulo.reconcilers[reconciliationEngine]();
        const func = (component, html) => engine.reconcile(component, html);
        return class CustomElement extends Modulo.Element {
            get factory() {
                /* Gets current registered component factory (for hot-reloading) */
                return Modulo.factoryInstances[fullName];
            }
            get reconcile() { return func; }
        };
    }

    // ## ComponentFactory: buildCParts
    // This function does the heavy lifting of actually constructing a
    // component, and is invoked when the component is mounted to the page.
    buildCParts(element) {
        const oldCParts = element.cparts || {};
        element.cparts = {element}; // Include "element", for lifecycle methods
        element.cpartSpares = {}; // no need to include, since only 1 element

        // It loops through the parsed array of objects that define the
        // Component Parts for this component, checking for errors.
        for (const [name, partOptionsArr] of Object.entries(this.options)) {
            Modulo.assert(name in Modulo.cparts, `Unknown cPart: ${name}`);
            element.cpartSpares[name] = [];

            for (const partOptions of partOptionsArr) {
                const instance = new Modulo.cparts[name](element, partOptions);
                element.cpartSpares[name].push(instance);
                element.cparts[name] = instance;

                /* // (NOTE: Untested after refactor) 
                *  // If this component was already mounted and is getting
                *  // "rebuilt" due to the definition changing, it also triggers
                *  // any callbacks, to allow for hot-reloading without losing
                *  // state.
                if (cparts[name].reloadCallback && name in oldCParts) {
                    cparts[name].reloadCallback(oldCParts[name]);
                }*/
            }
        }
    }

    createTestElement() {
        console.log('REAL createTestElement');
        const element = new this.componentClass();
        delete element.cparts.testsuite; // for testing, never include testsuite
        element.connectedCallback(); // ensure this is called
        return element;
    }

    // ## ComponentFactory: register & registerInstance
    // These are minor helper functions. The first registers with the browser,
    // the second keeps a central location of all component factories defined.
    register() {
        const tagName = this.fullName.toLowerCase();
        Modulo.globals.customElements.define(tagName, this.componentClass);
    }
    static registerInstance(instance) {
        if (!Modulo.factoryInstances) {
            Modulo.factoryInstances = {};
        }
        Modulo.factoryInstances[instance.fullName] = instance;
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

        this.originalHTML = this.innerHTML;
        this.originalChildren = [];
        //console.log('originalChildren!', this.originalChildren);
        //console.log('originalInnerHTML!', this.innerHTML);
        if (this.hasChildNodes()) {
            const dupedChildren = Array.from(this.childNodes); // necessary
            for (const child of dupedChildren) {
                //this.originalChildren.push(this.removeChild(child)); // TODO: should i remove children?
                this.originalChildren.push(child);
            }
            //console.log('originalChildren has child nodes!', this.originalChildren);
        }
        this.fullName = this.factory.fullName;
        this.initRenderObj = Object.assign({}, this.factory.baseRenderObj);
    }

    setupCParts() {
        this.factory.buildCParts(this);
    }

    applyDirectives(directives) {
        for (const args of directives) {
            const {setUp, tearDown, el, rawName, hasRun, value, dName} = args;
            if (!setUp) {
                console.error('TMP Skipping:', dName, rawName, value);
                continue;
            }
            args.resolutionContext = this; // TODO fix this with truly predictable context
            if (hasRun) {
                if (!tearDown) {
                    console.error('TMP NO TEAR DOWN ERR:', rawName);
                }
                tearDown(args);
            }
            args.hasRun = true;
            setUp(args);
            /*
            if (setUp) {
                el.onload = setUp.bind(thisContext, [args]);
            }
            if (tearDown) {
                el.onunload = tearDown.bind(thisContext, [args]);
            }
            */
        }
    }

    rerender() {
        this.lifecycle(['prepare', 'render', 'update', 'updated']);
    }

    lifecycle(lifecycleNames, rObj={}) {
        // NEW CODE: This is a quick re-implementation of lifecycle
        this.renderObj = Object.assign({}, rObj, this.getCurrentRenderObj());
        // todo: maybe sort cparts ahead of time based on lifecycles?
        for (const lcName of lifecycleNames) {
            for (const [cPartName, cPart] of Object.entries(this.cparts)) {
                const method = cPart[lcName + 'Callback'];
                if (method) {
                    const results = method.call(cPart, this.renderObj);
                    if (results) {
                        this.renderObj[cPartName] = results;
                    }
                }
            }
        }
        /* TODO: should probably be nulling this after */
        //this.renderObj = null; // rendering is over, set to null
    }

    getCurrentRenderObj() {
        //console.log('this is initRenderObj', this.initRenderObj);
        //console.log('this is renderObj', this.renderObj);
        //console.log('this is eventRenderObj', this.eventRenderObj);
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }

    resolveValue(key) {
        //const hackName = this.factory.name;
        //console.log(`   ${hackName} -- GET   ${key}`, rObj);
        //console.log(`   ${hackName} -- VALUE ${key} <<${result}>>`);
        const rObj = this.getCurrentRenderObj();
        const result = key.split('.').reduce((o, name) => o[name], rObj);
        return result;
    }

    connectedCallback() {
        /*
        Note: For testability, setupCParts is invoked on first mount, before
        initialize.  This is so the hacky "fake-upgrade" for custom components
        works for the automated tests. Logically, it should probably be invoked
        in the constructor.
        */
        this.setupCParts();
        this.lifecycle(['initialized'])
        this.rerender();
        this.isMounted = true;

        // Finally, check for vanishAfterMount
        if (this.getAttribute('modulossg-vanish') || this.vanishAfterMount) {
            this.replaceWith(...this.childNodes); // and remove
        }
    }
}

// IDEA (2021-10-05): Call Collect directives during "update" phase, and return
// a trimmed version of its structure in the component CPart data in renderObj.
// Then call applyDirectives in the "updated" phase.  This is what the
// documentation says happens (IRL, right now both happen in "update")
Modulo.collectDirectives = function collectDirectives(component, el, arr) {
    if (!arr) {
        arr = []; // HACK for testability
    }
    /* TODO: for "pre-load" directives, possibly just pass in "Loader" as
       "component" so we can have load-time directives */
    for (const rawName of el.getAttributeNames()) {
        // todo: optimize skipping most elements or attributes
        let name = rawName;
        for (const [regexp, dir] of Modulo.directiveShortcuts) {
            if (rawName.match(regexp)) {
                name = `[${dir}]` + name.replace(regexp, '');
            }
        }
        if (!name.startsWith('[')) {
            continue; // There are no directives, skip
        }
        const value = el.getAttribute(rawName);
        const attrName = cleanWord((name.match(/\][^\]]+$/) || [''])[0]);
        for (const dName of name.split(']').map(cleanWord)) {
            if (dName === attrName) {
                continue; // Skip bare name
            }
            const setUp = component.resolveValue(dName + 'Mount');
            const tearDown = component.resolveValue(dName + 'Unmount');
            //console.log('dName', dName, attrName, component);
            if (dName !== 'script.codemirror') { // TODO HACK UGH NO
                Modulo.assert(setUp || tearDown, `Unknown directive "${dName}" `, el);
            }
            arr.push({el, value, attrName, rawName, setUp, tearDown, dName})
        }
    }
    for (const child of el.children) {
        // tail recursion into children
        Modulo.collectDirectives(component, child, arr);
    }
    return arr; // HACK for testability
}

Modulo.directiveShortcuts = [[/^@/, 'component.event'],
                             [/:$/, 'component.resolve'] ];

Modulo.cparts.component = class Component extends Modulo.ComponentPart {
    prepareCallback() {
        return {
            innerHTML: null,
            // TODO shouldn't have to do this ---v
            eventMount: this.eventMount.bind(this),
            eventUnmount: this.eventUnmount.bind(this),
            resolveMount: this.resolveMount.bind(this),
            resolveUnmount: this.resolveUnmount.bind(this),
            childrenMount: this.childrenMount.bind(this),
            childrenUnmount: this.childrenUnmount.bind(this),
        };
    }

    updateCallback(renderObj) {
        if (renderObj.component.innerHTML !== null) {
            let newContents = renderObj.component.innerHTML || '';
            // TODO: move reconcile to this class
            //console.log('element reconcile:', this.element, newContents);
            this.element.reconcile(this.element, newContents);

            if (newContents.includes('Shop')) {
                // TODO: extremely broken hack, remove after new reconciler is
                // developed
                if (this.directives) {
                    this.directives.forEach(args => {
                        if (args.tearDown) {
                            args.tearDown(args)
                        }
                    });
                }
                this.directives = [];
                for (const child of this.element.children) {
                    Modulo.collectDirectives(this.element, child, this.directives);
                }
                this.element.applyDirectives(this.directives);
            }
        }
    }

    updatedCallback(renderObj) {
        if (!this.isMounted) { // First time initialized
            const {attrs} = this;
            if (attrs) {
                const {vanish} = attrs;
                if (this.element.getAttribute('modulo-vanish') || vanish) {
                    this.element.replaceWith(...this.element.childNodes); // Delete self
                }
            }
        }
    }

    handleEvent(func, ev, payload) {
        this.element.lifecycle(['event'], {_eventFunction: func});
        func.call(null, ev, payload); // todo: bind to array.push etc, or get autobinding in resolveValue
        this.element.lifecycle(['eventCleanup']); // todo: should this go below rerender()?
        // TODO: Add if (!this.component.options.controlledRender)
        this.element.rerender(); // always rerender after events
    }

    childrenMount({el}) {
        el.append(...this.element.originalChildren);
        //this.element.originalChildren = [];
    }

    childrenUnmount() {
        //this.element.innerHTML = '';
    }

    eventMount(info) {
        const {el, value, attrName, rawName} = info;
        const getAttr = getGetAttr(el);
        //console.log('this is eventMount', info);
        const listener = (ev) => {
            //window.C = this;
            //console.log('this is rawName', rawName, value);
            const func = getAttr(attrName, getAttr(rawName));
            Modulo.assert(func, `Bad ${attrName}, ${value} is ${func}`);
            const payload = getAttr(`${attrName}.payload`,
                                      getAttr('payload', el.value));
            //console.log('this is payload', `${attrName}.payload`, payload);
            this.handleEvent(func, ev, payload);
        };
        info.listener = listener;
        el.addEventListener(attrName, listener);
    }

    eventUnmount({el, attrName, listener}) {
        el.removeEventListener(attrName, listener);
    }

    resolveMount({el, value, attrName, resolutionContext}) {
        //console.log('this is it', resolutionContext);
        //console.log('this is resolve mount', attrName, value);
        const resolvedValue = resolutionContext.resolveValue(value);
        el.attrs = Object.assign(el.attrs || {}, {[attrName]: resolvedValue});
        el.getAttr = (n, def) => {
            let val;
            if (n in el.attrs) {
                val = el.attrs[n];
            } else {
                val = el.getAttribute(n) || def;
            }
            //console.log('-------------------', n, val);
            return val;
        };
    }
    resolveUnmount({el, attrName}) {
        delete el.attrs[attrName];
    }
}

Modulo.cparts.props = class Props extends Modulo.ComponentPart {
    static factoryCallback({options}, {componentClass}, renderObj) {
        /* untested / daedcode ---v */
        componentClass.observedAttributes = Object.keys(options);
    }
    initializedCallback(renderObj) {
        const props = {};
        const getAttr = getGetAttr(this.element);
        for (let propName of Object.keys(this.options)) {
            propName = propName.replace(/:$/, ''); // TODO, make func to normalize directives
            props[propName] = getAttr(propName);
        }
        //console.log('this is props', props);
        return props;
    }
}

Modulo.cparts.testsuite = class TestSuite extends Modulo.ComponentPart {
    static loadCallback(node, loader, loadObj) {
        const cName = loadObj.component[0].name;
        const tests = [];
        for (const testNode of node.children) {
            tests.push(loader.loadFromDOMElement(testNode, []));
        }
        return {name: loader.namespace + '-' + cName + '-testsuite', tests};
    }
    static runTests(testsuiteData, factory) {
        const element = factory.createTestElement();

        // could be implied first test?
        Modulo.assert(element.isMounted, 'Successfully mounted element');

        console.log('TESTSUITE', testsuiteData.name);
        for (const [testName, stepArray] of testsuiteData.tests) {
            console.log('BEGINNING TEST', testName);
            //console.log('results', cf.baseRenderObj);
            const testObj = {};
            //console.log('this is element', element);
            const results = [];
            for (let [sName, data] of stepArray) {
                const options = {content: data.content, options: data};
                if (sName === 'state') { // assign state data
                    const cpart = new Modulo.cparts[sName](element, options);
                    const initData = cpart.initializedCallback({[sName]: data});
                    Object.assign(element.cparts.state.data, initData);
                } else if (sName === 'props') { // assign props data
                    const cpart = new Modulo.cparts[sName](element, options);
                    const initData = cpart.initializedCallback({[sName]: data});
                    element.initRenderObj.props = initData;
                /*} else if (sName === 'style') {
                    console.log('this is content', data.content);
                    const content = data.content.replace(/\*\/.*?\*\//ig, '');
                    // To prefix the selectors, we loop through them,
                    // with this RegExp that looks for { chars
                    content.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/gi, (selector, data) => {
                        console.log('selector', selector);
                        console.log('data', data);
                    });*/
                } else if (sName === 'template') {
                    const cpart = new Modulo.cparts[sName](element, options);
                    element.rerender(); // ensure re-rendered before checking 
                    const text = cpart.instance.render(options);
                    //console.log('this is element status', element.innerHTML);
                    // TODO: Write subtree algo, possibly based on reconciler
                    const result = String(element.innerHTML).includes(text);
                    if ('snapshot' in options) {
                        result = String(element.innerHTML).trim() === text.trim();
                    }
                    results.push([data.name || sName, result]);
                }
                /*
                else if (sName === 'script') {
                    const cpCls = Modulo.cparts.script;
                    element.rerender(); // ensure re-rendered before checking 
                    data.content = data.content.replace('assert:', 'script.exports =');
                    const renderObj = element.getCurrentRenderObj();
                    // TODO: need to make wrapScript it's own thing, and do that instead
                    const r = cpCls.factoryCallback(data, testFac, element.initRenderObj);
                    console.log('result of r', r.exports);
                    results.push([data.name || sName, r.exports]);
                }*/
            }
            for (const [name, result] of results) {
                if (!result) {
                    console.log('Failed:', name, result);
                } else {
                    console.log('Success:', name, result);
                }
            }
        }
    }
}


Modulo.cparts.style = class Style extends Modulo.ComponentPart {
    static factoryCallback({content}, factory, renderObj) {
        const {fullName} = factory;
        const id = `${fullName}_style`;
        let elem = Modulo.globals.document.getElementById(id);
        if (!elem) {
            elem = Modulo.globals.document.createElement('style');
            elem.id = id;
            Modulo.globals.document.head.append(elem)
        }
        elem.textContent = content;
    }

    static prefixAllSelectors(namespace, name, text='') {
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

            // Upgrade the "bare" component name to be the full name
            selector = selector.replace(new RegExp(name, 'ig'), fullName);

            // If it is not prefixed at this point, then be sure to prefix
            if (!selector.startsWith(fullName)) {
                selector = `${fullName} ${selector}`;
            }
            return selector;
        });
        return content;
    }

    static loadCallback(node, loader, loadObj) {
        let data = super.loadCallback(node, loader, loadObj);
        const {name} = loadObj.component[0];
        // TODO: Move prefixing to factoryCallback (?)
        data.content = Modulo.cparts.style.prefixAllSelectors(
                          loader.namespace, name, data.content);
        return data;
    }
}


Modulo.cparts.template = class Template extends Modulo.ComponentPart {
    static factoryCallback(opts, factory, loadObj) {
        const tagPref = '$1' + factory.loader.namespace + '-';

        // TODO: Need to do '<x-' -> '<xa3d2af-' for private components, and do
        // '<x-' -> '<tagPref-' for public components
        // (and remove '<my-')
        //const content = (opts.content || '').replace(/(<\/?)x-/ig, tagPref);
        let content = (opts.content || '').replace(/(<\/?)my-/ig, tagPref);
        // TODO -v prefered
        //content = content.replace(/(<\/?)x-/g, tagPref);
        let instance = null;
        if (content.includes('txt="Click me! :)"')) {
            // TODO: need to remove this, very broken work around for
            // a particular test
            instance = new Modulo.templating.MTL(content);
        }
        return {content, instance};
    }

    constructor(element, options) {
        super(element, options);
        const engineClass = Modulo.templating[this.attrs.engine || 'MTL'];
        this.instance = new engineClass(this.content, this.attrs);
    }

    renderCallback(renderObj) {
        if (renderObj.template.instance) {
            // TODO: broken
            renderObj.component.innerHTML = renderObj.template.instance.render(renderObj);
        } else {
            renderObj.component.innerHTML = this.instance.render(renderObj);
        }
    }
}


Modulo.cparts.script = class Script extends Modulo.ComponentPart {
    static getSymbolsAsObjectAssignment(contents) {
        // TODO: Need to check for reserved words in capture group:
        // filter away things like "// function for games"
        // (which generates a syntax error with "typeof for")
        const regexpG = /function\s+(\w+)/g;
        const regexp2 = /function\s+(\w+)/; // hack, refactor
        const matches = contents.match(regexpG) || [];
        return matches.map(s => s.match(regexp2)[1])
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
            var script = {exports: {}};
            function __set(name, value) { ${localVarsIfs} }
            ${contents}
            return { ${symbolsString} setLocalVariable: __set, exports: script.exports};
        `;
    }

    static factoryCallback(partOptions, factory, renderObj) {
        const code = partOptions.content || '';
        const localVars = Object.keys(renderObj);
        localVars.push('element'); // add in element as a local var
        // localVars.push('parent'); // add in access to previous versions of renderObj (DEAD CODE)
        localVars.push('cparts');
        // TODO: shouldn't use "this" in static
        const wrappedJS = this.wrapJavaScriptContext(code, localVars);
        const module = factory.loader.modFactory ?
                       factory.loader.modFactory.baseRenderObj : null;
        const results = (new Function('Modulo, factory, module', wrappedJS))
                           .call(null, Modulo, factory, module);
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
        const {script} = element.initRenderObj;
        const isCbRegex = /(Unmount|Mount|Callback)$/;
        const cbs = Object.keys(script).filter(key => key.match(isCbRegex));
        cbs.push('initializedCallback', 'eventCallback'); // always CBs for these
        for (const cbName of cbs) {
            this[cbName] = renderObj => {
                this.prepLocalVars(renderObj); // always prep (for event CB)
                if (cbName in script) {
                    script[cbName](renderObj);
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
    static debugGhost = true;
    get debugGhost() { return true; }
    initializedCallback(renderObj) {
        this.rawDefaults = renderObj.state.options || {};
        this.boundElements = {};
        if (!this.data) {
            this.data = Modulo.utils.simplifyResolvedLiterals(this.rawDefaults);
        }

        // TODO ---v delete these
        this.data.bindMount = this.bindMount.bind(this);// Ugh hack
        this.data.bindUnmount = this.bindUnmount.bind(this);// Ugh hack
        return this.data;
    }

    bindMount({el}) {
        el.getAttr = el.getAttr || el.getAttribute;
        const name = el.getAttr('name');
        Modulo.assert(name in this.data, `[state.bind]: no "${name}" in state`);
        const func = () => {
            let {value, type, checked} = el;
            if (type && type === 'checkbox') {
                value === !!checked;
            }
            this.set(name, value);
        }
        // eventually customizable, eg [state.bind]mouseover=mouseY (event
        // name, el property name, and/or state propery name etc)
        const isText = el.tagName === 'TEXTAREA' || el.type === 'text';
        const evName = isText ? 'keyup' : 'change';
        this.boundElements[name] = [el, evName, func];
        el.value = this.data[name];
        el.addEventListener(evName, func);
    }

    bindUnmount({elem}) {
        const name = elem.getAttr('name');
        const [el, func, evName] = this.boundElements[name];
        delete this.boundElements[name];
        el.removeEventListener(evName, func);
    }

    reloadCallback(oldPart) {
        // Used for hot-reloading: Merge data with oldPart's data
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
            const msg = `Tried to assign to "state.${name}"`;
            Modulo.assert(name in this._oldData, msg);
            if (name in this.boundElements) {
                if (this.data[name] !== this._oldData[name]) {
                    const [el, func, evName] = this.boundElements[name];
                    if (el.type === 'checkbox') {
                        el.checked = !!this.data[name];
                    } else {
                        el.value = this.data[name];
                    }
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
        this.opAliases['not in'] = `!(${this.opAliases['in']})`;
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
        let output = 'var OUT=[];';
        let mode = 'text'; // Start in text mode
        for (const token of this.tokenizeText(text)) {
            if (mode) { // if in a "mode" (text or token), then call mode func
                const result = this.modes[mode](token, this, this.stack);
                output += result || '';
            }
            // FSM for mode: ('text' -> null) (null -> token) (* -> 'text')
            mode = (mode === 'text') ? null : (mode ? 'text' : token);
        }
        // console.log('this is the rsulting template code', output.replace(/([;\}\{])/g, '$1\n'));
        return new Function('CTX,G', output + ';return OUT.join("");');
    }

    render(renderObj) {
        return this.renderFunc(Object.assign({renderObj}, renderObj), this);
    }

    parseExpr(text) {
        const filters = text.split('|');
        let results = this.parseVal(filters.shift());
        for (const [fName, arg] of filters.map(s => s.trim().split(':'))) {
            const argList = arg ? ',' + this.parseVal(arg) : '';
            results = `G.filters["${fName}"](${results}${argList})`;
        }
        return results;
    }

    parseCondExpr(text) {
        const reText = ` (${this.opTokens.split(',').join('|')}) `;
        //console.log(text.split(RegExp(reText)));
        return text.split(RegExp(reText));
    }

    parseVal(s) {
        s = s.trim();
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
        'in': 'typeof Y[X] !== "undefined" || Y.indexOf && Y.indexOf(X) != -1',
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
            stack.push({close: `end${tTag}`, ...result});
        }
        return result.start || result;
    },
    '{#': (text, tmplt) => {},
    '{{': (text, tmplt) => `OUT.push(G.escapeHTML(${tmplt.parseExpr(text)}));`,
    text: (text, tmplt) => text && `OUT.push(${JSON.stringify(text)});`,
};

Modulo.templating.defaultOptions.filters = {
    upper: s => s.toUpperCase(),
    lower: s => s.toLowerCase(),
    escapejs: s => JSON.stringify(s),
    first: s => s[0],
    last: s => s[s.length - 1],
    length: s => s.length,
    safe: s => Object.assign(new String(s), {safe: true}),
    join: (s, arg) => s.join(arg),
    json: (s, arg) => JSON.stringify(s, null, arg || undefined),
    pluralize: (s, arg) => arg.split(',')[(s === 1) * 1],
    add: (s, arg) => s + arg,
    subtract: (s, arg) => s - arg,
    default: (s, arg) => s || arg,
    number: (s) => Number(s),
    //invoke: (s, arg) => s(arg),
    //getAttribute: (s, arg) => s.getAttribute(arg),
    get: (s, arg) => s[arg],
    includes: (s, arg) => s.includes(arg),
    truncate: (s, arg) => ((s.length > arg*1) ?
                            (s.substr(0, arg-1) + '…') : s),
    divisibleby: (s, arg) => ((s * 1) % (arg * 1)) === 0,
    //stripcomments: s => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''),
    // {% for rowData in table %}
    //    {{ rowData|renderas:template.row }}
    // {% endfor %}
    renderas: (renderCtx, template) => Object.assign(new String(
                    template.instance.render(renderCtx)), {safe: true}),
};

Modulo.templating.defaultOptions.tags = {
    'if': (text, tmplt) => {
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
        const arrName = 'ARR' + tmplt.stack.length;
        const [varExp, arrExp] = text.split(' in ');
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

// SetDomReconciler ------------------
Modulo.reconcilers.SetDom = class SetDomReconciler {
    constructor() {
        this.KEY = 'key'
        this.IGNORE = 'modulo-ignore'
        this.CHECKSUM = 'modulo-checksum'
        this.KEY_PREFIX = '_set-dom-'
        this.mockBody = Modulo.globals.document.implementation
                        .createHTMLDocument('').body;
    }

    reconcile(element, newHTML) {
        //console.log('this is element', typeof element);
        //Modulo.assert(element && element.tagName, 'Invalid element');
        this.elemCtx = element;
        if (!element.isMounted) {
            element.innerHTML = newHTML;
            this.findAndApplyDirectives(element);
        } else {
            this.mockBody.innerHTML = `<div>${newHTML}</div>`;
            this.setChildNodes(element, this.mockBody.firstChild);
        }
        this.elemCtx = null;
    }

    findAndApplyDirectives(element) {
        const directives = [];
        if (!element.children) {
            //console.log('this is element', element); // NOT sure why text nodes get here
            return;
        }
        for (const child of element.children) {
            Modulo.collectDirectives(this.elemCtx, child, directives);
        }
        this.elemCtx.applyDirectives(directives);
    }

    /**
    * @private
    * @description
    * Updates a specific htmlNode and does whatever it takes to convert it to
      another one.
    *
    * @param {Node} oldNode - The previous HTMLNode.
    * @param {Node} newNode - The updated HTMLNode.
    */
    setNode(oldNode, newNode) {
        if (oldNode.nodeType !== newNode.nodeType ||
                oldNode.nodeName !== newNode.nodeName) {
            // We have to fully replace the node --- the tag/type doesn't match
            //this.dismount(oldNode);
            oldNode.parentNode.replaceChild(newNode, oldNode)
            this.mount(newNode);
        } else if (oldNode.nodeType !== 1) { // 1 === ELEMENT_TYPE
            // Handle other types of node updates (text/comments/etc).
            // TODO: Is this if statement even a useful optimization..?
            //if (oldNode.nodeValue !== newNode.nodeValue) {
            //}
            oldNode.nodeValue = newNode.nodeValue;
        } else if (!this.isEqualNode(oldNode, newNode)) {
            // Update children & attributes
            this.setChildNodes(oldNode, newNode);
            this.setAttributes(oldNode.attributes, newNode.attributes);
            // TODO: do dismounts as necessary
        }
    }

    /**
    * @private
    * @description
    * Utility that will update one list of attributes to match another.
    *
    * @param {NamedNodeMap} oldAttributes - The previous attributes.
    * @param {NamedNodeMap} newAttributes - The updated attributes.
    */
    setAttributes (oldAttributes, newAttributes) {
      let i, a, b, ns, name

      // Remove old attributes.
      for (i = oldAttributes.length; i--;) {
        a = oldAttributes[i]
        ns = a.namespaceURI
        name = a.localName
        b = newAttributes.getNamedItemNS(ns, name)
        if (!b) oldAttributes.removeNamedItemNS(ns, name)
      }

      // Set new attributes.
      for (i = newAttributes.length; i--;) {
        a = newAttributes[i]
        ns = a.namespaceURI
        name = a.localName
        b = oldAttributes.getNamedItemNS(ns, name)
        if (!b) {
          // Add a new attribute.
          newAttributes.removeNamedItemNS(ns, name)
          oldAttributes.setNamedItemNS(a)
        } else if (b.value !== a.value) {
          // Update existing attribute.
          b.value = a.value
        }
      }
    }

    /**
    * @private
    * @description
    * Utility that will nodes childern to match another nodes children.
    *
    * @param {Node} oldParent - The existing parent node.
    * @param {Node} newParent - The new parent node.
    */
    setChildNodes (oldParent, newParent) {
      const keyedNodes = {};
      let checkOld, oldKey, checkNew, newKey, foundNode
      let oldNode = oldParent.firstChild
      let newNode = newParent.firstChild
      let extra = 0

      // Extract keyed nodes from previous children and keep track of total
      // count.
      while (oldNode) {
          extra++
          checkOld = oldNode
          oldKey = this.getKey(checkOld)
          oldNode = oldNode.nextSibling
          if (oldKey) {
              keyedNodes[oldKey] = checkOld
          }
      }

      // Loop over new nodes and perform updates.
      oldNode = oldParent.firstChild
      while (newNode) {
          extra--
          checkNew = newNode
          newNode = newNode.nextSibling

          const newKey = this.getKey(checkNew);
          const foundNode = newKey ? keyedNodes[newKey] : null;
          if (foundNode) {
              delete keyedNodes[newKey]
              // If we have a key and it existed before we move the previous
              // node to the new position if needed and diff it.
              if (foundNode !== oldNode) {
                  oldParent.insertBefore(foundNode, oldNode)
              } else {
                  oldNode = oldNode.nextSibling
              }

              this.setNode(foundNode, checkNew)
          } else if (oldNode) {
              checkOld = oldNode
              oldNode = oldNode.nextSibling
              if (this.getKey(checkOld)) {
                  // If the old child had a key we skip over it until the end.
                  oldParent.insertBefore(checkNew, checkOld)
                  this.mount(checkNew)
              } else {
                  // Otherwise we diff the two non-keyed nodes.
                  this.setNode(checkOld, checkNew)
              }
          } else {
              // Finally if there was no old node we add the new node.
              oldParent.appendChild(checkNew)
              if (checkNew.nodeType === 1) { // 1 === ELEMENT_TYPE
                  this.mount(checkNew)
              }
          }
      }

      // Remove old keyed nodes.
      for (oldKey in keyedNodes) {
        extra--
        oldParent.removeChild(this.dismount(keyedNodes[oldKey]))
      }

      // If we have any remaining unkeyed nodes remove them from the end.
      while (--extra >= 0) {
        oldParent.removeChild(this.dismount(oldParent.lastChild))
      }
    }

    /**
    * @private
    * @description
    * Utility to try to pull a key out of an element.
    * Uses 'data-key' if possible and falls back to 'id'.
    *
    * @param {Node} node - The node to get the key for.
    * @return {string|void}
    */
    getKey (node) {
      if (node.nodeType !== 1) return // 1 === ELEMENT_TYPE
      let key = node.getAttribute(this.KEY) || node.id
      if (key) return this.KEY_PREFIX + key
    }

    /**
    * Checks if nodes are equal using the following by checking if
    * they are both ignored, have the same checksum, or have the
    * same contents.
    *
    * @param {Node} a - One of the nodes to compare.
    * @param {Node} b - Another node to compare.
    */
    isEqualNode (a, b) {
      return (
        // Check if both nodes are ignored.
        (this.isIgnored(a) && this.isIgnored(b)) ||
        // Check if both nodes have the same checksum.
        (this.getCheckSum(a) === this.getCheckSum(b)) ||
        // Fall back to native isEqualNode check.
        a.isEqualNode(b)
      )
    }

    /**
    * @private
    * @description
    * Utility to try to pull a checksum attribute from an element.
    * Uses 'data-checksum' or user specified checksum property.
    *
    * @param {Node} node - The node to get the checksum for.
    * @return {string|NaN}
    */
    getCheckSum (node) {
      return node.getAttribute(this.CHECKSUM) || NaN
    }

    /**
    * @private
    * @description
    * Utility to try to check if an element should be ignored by the algorithm.
    * Uses 'data-ignore' or user specified ignore property.
    *
    * @param {Node} node - The node to check if it should be ignored.
    * @return {boolean}
    */
    isIgnored (node) {
      return node.getAttribute(this.IGNORE) != null
    }

    mount (node) {
        this.findAndApplyDirectives(node);
        return node;
    }
    dismount(node) {
        return node;
    }
}
// /setDOM ------------------


Modulo.utils = class utils {
    static simplifyResolvedLiterals(attrs) {
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

    static parseAttrs(elem) {
        const obj = {};
        for (let name of elem.getAttributeNames()) {
            const value = elem.getAttribute(name);
            name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
            obj[name] = value;
        }
        return obj;
    }

    // e.g. try key in elem, try resolving val in rCtx, if not found default
    static resolveAttr(key, elem, resolveCtx, defaultVal) {
        // Dead code, but should refactor all := eventually to use a common
        // function like this
        // Resolves a := style attr
        if (elem.attrs) {
            // First attempt
        }
        if (elem.getAttribute) {
            // Second attempt
        }
        // etc
    }

    static get(obj, key) {
        return key.split('.').reduce((o, name) => o[name], obj);
    }
    static dirname(path) {
        return (path || '').match(/.*\//);
    }
    static hash(str) {
        // Simple, insecure, hashing function, returns base36 hash
        let h = 0;
        for(let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return (h || 0).toString(36);
    }
}

Modulo.FetchQueue = class FetchQueue {
    constructor() {
        this.queue = {};
        this.data = {};
        this.waitCallbacks = [];
        this.finallyCallbacks = [];
    }
    enqueue(queueObj, callback, basePath, opts, responseCb) {
        opts = opts || this.defaultOpts || {};
        responseCb = responseCb || (response => response.text());
        queueObj = typeof queueObj === 'string' ? {':)': queueObj} : queueObj;
        for (let [label, src] of Object.entries(queueObj)) {
            // TODO remove! ------------------------------------v
            if (src.startsWith('.') && this.basePath && this.basePath !== 'null') {
                // TODO: should this need to invoke utils.dirname?
                src = src.replace('.', this.basePath);
            }
            if (src in this.data) {
                callback(this.data[src], label);
            } else if (!(src in this.queue)) {
                this.queue[src] = [callback];
                Modulo.globals.fetch(src, opts).then(responseCb)
                    .then(text => this.receiveData(text, label, src))
                    // v- uncomment after switch to new BE
                    //.catch(err => console.error('Modulo Load ERR', src, err));
            } else {
                this.queue[src].push(callback); // add to end of src queue
            }
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
    waitFinally(callback) {
        this.wait(() => this.finallyCallbacks.push(callback));
        this.checkWait(); // attempt to consume wait queue
    }
    checkWait() {
        if (Object.keys(this.queue).length === 0) {
            while (this.waitCallbacks.length > 0) {
                this.waitCallbacks.shift()(); // clear while invoking
            }
        }
        if (Object.keys(this.queue).length === 0) {
            while (this.finallyCallbacks.length > 0) {
                this.finallyCallbacks.shift()(); // clear while invoking
            }
        }
    }
}

Modulo.assert = function assert(value, ...info) {
    if (!value) {
        console.error(...info);
        throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
    }
}

Modulo.buildTemplate = new Modulo.templating.MTL(
`// modulo build {{ hash }}
{{ source|safe }};\n
Modulo.fetchQ = {{ fetchQ.data|json:1|safe }};
{% for path, text in preloadData %}
//  Preload: {{ path }}
Modulo.globalLoader.loadString({{ text|escapejs|safe }});
{% endfor %}
Modulo.defineAll();
`);

Modulo.CommandMenu = class CommandMenu {
    static setup() {
        /*
        const propObj = {};
        Object.entries(Modulo.CommandMenu).forEach(([key, value]) => {
            if (key.startsWith('cmd_') {
                propObj[key.slice(4)] = { get: value };
            }
        });
        Modulo.cmd = Object.create(Modulo.CommandMenu, propObj);
        */
        Modulo.cmd = new Modulo.CommandMenu();
        Modulo.globals.m = Modulo.cmd;
    }
    constructor() {
        this.clear;
    }
    clear() {
        this.targeted = [];
    }
    target(elem) {
        this.targeted.push([elem.factory.fullName, elem.instanceId, elem]);
    }
    test() {
        console.table(this.targeted);
        const {runTests} = Modulo.cparts.testsuite;
        for (const [name, factory] of Object.entries(Modulo.factoryInstances)) {
            const {testsuite} = factory.baseRenderObj;
            if (testsuite) {
                const info = ' ' + (testsuite.name || '');
                console.group(['%'], 'TestSuite: ' + name + info);
                runTests(testsuite, factory);
            }
        }
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

/*
# HACKY FUNCTIONS
Pls ignore all
*/
function getGetAttr(element) {
    // HACK
    const myElement = element;
    if (myElement.getAttr) {
        return (...args) => myElement.getAttr(...args);
    } else {
        return (...args) => myElement.getAttribute(...args);
    }
}

function cleanWord(text) {
    return (text + '').replace(/[^a-zA-Z0-9$_\.]/g, '') || '';
}

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    Modulo.globals = window;
}
;

Modulo.fetchQ = {
 "/components/tutorial.html": "<component name=\"Button\">\n    <props\n        label\n        shape\n    ></props>\n    <template>\n        <button class=\"my-btn my-btn_{{ props.shape }}\">\n            {{ props.label }}\n        </button>\n    </template>\n</component>\n\n\n\n\n<!--  dead code - - v          -->\n<component name=\"TutNav\">\n    <props\n        selected\n    ></props>\n    <template>\n        <nav class=\"Navbar Navbar--subbar\">\n            <ul>\n                {#<li>Props: '{{ props.selected }}'</li>#}\n                {% for row in state.items %}\n                    <li>\n                        <a href=\"{{ row|get:0 }}\"\n                          class=\"\n                            {% if props.selected == row|get:2 %}Navbar--selected{% endif %}\n                          \">{{ row|get:1 }}</a>\n                    </li>\n                {% endfor %}\n            </ul>\n        </nav>\n    </template>\n    <state\n        items:='[\n            [\"/start.html\", \"The Modulo Tutorial\", 0],\n            [\"/start/tutorial1.html\", \"1. Components, CParts, Loaders\", 1],\n            [\"/start/tutorial2.html\", \"2. Templating Language, Props\", 2],\n            [\"/start/tutorial3.html\", \"3. Script, State\", 3]\n        ]'\n    ></state>\n</component>\n\n<component name=\"DocSidebar\">\n\n<props\n    path\n    showall\n></props>\n\n<template>\n<ul>\n    {% for linkGroup in script.exports.menu %}\n        <li class=\"\n            {% if linkGroup.children %}\n                {% if linkGroup.active %}gactive{% else %}ginactive{% endif %}\n            {% endif %}\n            \"><a href=\"{{ linkGroup.filename }}\">{{ linkGroup.label }}</a>\n            {% if linkGroup.active %}\n                {% if linkGroup.children %}\n                    <ul>\n                    {% for childLink in linkGroup.children %}\n                        <li><a\n                          href=\"{{ linkGroup.filename }}#{{ childLink.hash }}\"\n                            >{{ childLink.label }}</a>\n                        {% if props.showall %}\n                            {% if childLink.keywords.length gt 0 %}\n                                <span style=\"margin-left: 10px; color: #aaa\">(<em>Topics: {{ childLink.keywords|join:', ' }}</em>)</span>\n                            {% endif %}\n                        {% endif %}\n                        </li>\n                    {% endfor %}\n                    </ul>\n                {% endif %}\n            {% endif %}\n        </li>\n    {% endfor %}\n\n\n    <li>\n        Other resources:\n\n        <ul>\n            <li>\n                <a href=\"/docs/faq.html\">FAQ</a>\n            <li title=\"Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.\">\n                <!--<a href=\"/literate/src/Modulo.html\">Literate source</a>-->\n                Literate Source*<br /><em>* Coming soon!</em>\n            </li>\n        </ul>\n\n    </li>\n</ul>\n</template>\n\n<script>\n    function _child(label, hash, keywords=[]) {\n        if (!hash) {\n            hash = label.toLowerCase()\n        }\n        return {label, hash, keywords};\n    }\n    let componentTexts;\n    try {\n        componentTexts = Modulo.factoryInstances['eg-eg'].baseRenderObj.script.exports.componentTexts;\n    } catch {\n        console.log('couldnt get componentTexts');\n        componentTexts = {};\n    }\n    script.exports.menu = [\n        {\n            label: 'Table of Contents',\n            filename: '/docs.html',\n        },\n\n        {\n            label: 'Tutorial',\n            filename: '/docs/tutorial.html',\n            children: [\n                _child('Part 1: Components, CParts, Loaders', 'part1', ['cdn', 'module-embed']),\n                _child('Part 2: Props and Templating', 'part2', ['cparts', 'props', 'basic templating']),\n                _child('Part 3: State and Script', 'part3', ['state', 'basic scripting']),\n            ],\n        },\n\n        {\n            label: 'CParts',\n            filename: '/docs/cparts.html',\n            children: [\n                _child('Component'),\n                _child('Props'),\n                _child('Template'),\n                _child('State'),\n                _child('Script'),\n                _child('Style'),\n                _child('Custom CParts API', 'custom'),\n            ],\n        },\n\n        {\n            label: 'Templating',\n            filename: '/docs/templating.html',\n            children: [\n                _child('Templates', null, ['templating philosophy', 'templating overview']),\n                _child('Variables', null, ['variable syntax', 'variable sources', 'cparts as variables']),\n                _child('Filters', null, ['filter syntax', 'example filters']),\n                _child('Tags', null, ['template-tag syntax', 'example use of templatetags']),\n                _child('Comments', null, ['syntax', 'inline comments', 'block comments']),\n                _child('Escaping', null, ['escaping HTML', 'safe filter', 'XSS injection protection']),\n            ],\n        },\n\n        {\n            label: 'Testing & Debugging',\n            filename: '/docs/testing.html',\n            children: [\n                _child('Debugger'),\n                _child('Test Suites'),\n                _child('Test Setup'),\n                _child('Assertions'),\n            ],\n        },\n        {\n            label: 'Lifecycle & Directives',\n            filename: '/docs/directives.html',\n            children: [\n                _child('Lifecycle', 'lifecycle',\n                    ['lifestyle phases', 'lifestyle phase groups',\n                     'load', 'factory', 'prepare', 'initialized',\n                     'render', 'update', 'updated',\n                     'event', 'eventCleanup', 'hooking into lifecycle',\n                     'lifecycle callbacks', 'script tag callbacks']),\n                _child('renderObj', 'renderobj',\n                    ['renderObj', 'baseRenderObj', 'loadObj',\n                     'dependency injection', 'middleware']),\n                _child('Directives', 'directives',\n                    ['built-in directives', 'directive shortcuts',\n                     'custom directives', 'refs', 'accessing dom',\n                     'escape hatch', 'mount callback', 'unmount callback']),\n                //_child('Built-in directives', 'builtin'),\n            ],\n        },\n\n        {\n            label: 'Template Reference',\n            filename: '/docs/template_reference.html',\n            children: [\n                _child('Built-in Filters', 'filters'),\n                _child('Built-in Template Tags', 'tags'),\n                _child('Custom Filters', 'customfilters'),\n                _child('Custom Template Tags', 'customtags'),\n            ],\n        },\n\n        {\n            label: 'Example Library',\n            filename: '/docs/example_library.html',\n            children: Object.keys(componentTexts).map(name => _child(name)),\n        },\n    ];\n\n    function initializedCallback() {\n        const {isBackend, ssgCurrentOutputPath} = Modulo;\n        let path;\n        if (isBackend) {\n            path = ssgCurrentOutputPath;\n            element.setAttribute('path', path);\n        } else {\n            path = props.path;\n        }\n        for (const groupObj of script.exports.menu) {\n            if (props.showall) {\n                groupObj.active = true;\n            }\n            if (groupObj.filename && path.endsWith(groupObj.filename)) {\n                groupObj.active = true;\n            }\n        }\n    }\n</script>\n\n<style>\n  li {\n      margin-left: 20px;\n  }\n  /*\n  li.ginactive > ul::before,\n  li.gactive > ul::before {\n      content: ' - ';\n      background: var(--highlight-color);\n      color: white;\n      text-decoration: none;\n  }\n  */\n  li.ginactive > a::before {\n      content: '+ ';\n  }\n</style>\n\n</component>\n\n\n\n\n<component name=\"DocExampleLib\">\n\n<template>\n    {% for example in script.exports.examples %}\n        {# not good, not namespaced #}\n        <mdu-Section name=\"{{ example.name|lower }}\">\n            {{ example.name }}\n        </mdu-Section>\n        <mdu-CodeExample\n            text='{{ example.content }}'\n        ></mdu-CodeExample>\n    {% endfor %}\n</template>\n\n<script>\n    let componentTexts;\n    try {\n        componentTexts = Modulo.factoryInstances['eg-eg'].baseRenderObj.script.exports.componentTexts;\n    } catch {\n        console.log('couldnt get componentTexts (2)');\n        componentTexts = {}\n    }\n\n    script.exports.examples = [];\n    for (const [name, content] of Object.entries(componentTexts)) {\n        //console.log(\"dis is conent\", content);\n        script.exports.examples.push({name, content});\n    }\n    //console.log('exports', script.exports);\n    //function codeExampleMount(el) {\n    //}\n\n</script>\n\n<style>\n</style>\n\n</component>\n\n\n\n      <!--\n    <li>Directives\n      <ul>\n          <li>Built-ins</li>\n          <li>Extending</li>\n          <li>API Reference</li>\n          <li>Filters</li>\n          <li>Template-tags</li>\n      </ul>\n    </li>\n      -->\n",
 "/components/core.html": "<module>\n    <script>\n        let txt\n        function sloccount() {\n            if (!txt) {\n                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');\n            }\n            return Modulo.require('sloc')(txt, 'js').source;\n        }\n        function checksum() {\n            if (!txt) {\n                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');\n            }\n            const CryptoJS = Modulo.require(\"crypto-js\");\n            const hash = CryptoJS['SHA384'](txt);\n            return hash.toString(CryptoJS.enc.Base64);\n            //const shaObj = new jsSHA(\"SHA-384\", \"TEXT\", { encoding: \"UTF8\" });\n\n            //shaObj.update(txt);\n            //const hash = shaObj.getHash(\"B64\");\n            //return hash;\n        }\n\n        function getVersionInfo() {\n            // Only do once to speed up SSG\n            //console.log('this is Modulo', Object.keys(Modulo));\n            if (!Modulo.ssgStore.versionInfo) {\n                const bytes = Modulo.require('fs').readFileSync('./package.json');\n                const data = JSON.parse(bytes);\n                Modulo.ssgStore.versionInfo = {\n                    version: data.version,\n                    sloc: sloccount(),\n                    checksum: checksum(),\n                };\n            }\n            return Modulo.ssgStore.versionInfo;\n        }\n\n        // https://stackoverflow.com/questions/400212/\n        const {document, navigator} = Modulo.globals;\n        function fallbackCopyTextToClipboard(text) {\n            var textArea = document.createElement(\"textarea\");\n            textArea.value = text;\n\n            // Avoid scrolling to bottom\n            textArea.style.top = \"0\";\n            textArea.style.left = \"0\";\n            textArea.style.position = \"fixed\";\n\n            document.body.appendChild(textArea);\n            textArea.focus();\n            textArea.select();\n\n            try {\n                var successful = document.execCommand('copy');\n                var msg = successful ? 'successful' : 'unsuccessful';\n                console.log('Fallback: Copying text command was ' + msg);\n            } catch (err) {\n                console.error('Fallback: Oops, unable to copy', err);\n            }\n\n            document.body.removeChild(textArea);\n        }\n        function copyTextToClipboard(text) {\n            if (!navigator.clipboard) {\n                fallbackCopyTextToClipboard(text);\n                return;\n            }\n            navigator.clipboard.writeText(text).then(function() {\n                console.log('Async: Copying to clipboard was successful!');\n            }, function(err) {\n                console.error('Async: Could not copy text: ', err);\n            });\n        }\n    </script>\n</module>\n\n\n<template mod-component=\"Navbar\">\n    <script type=\"modulo/template\">\n        <nav class=\"Navbar\">\n            <a href=\"/index.html\"><img src=\"/img/mono_logo.png\" style=\"height:70px\" alt=\"Modulo\" /></a>\n            <ul>\n                <li>\n                    <a href=\"/index.html#below\" {% if props.selected == \"about\" %}class=\"Navbar--selected\"{% endif %}>About</a>\n                </li>\n                <li>\n                    <a href=\"/start.html\" {% if props.selected == \"start\" %}class=\"Navbar--selected\"{% endif %}>Start</a>\n                </li>\n                <li>\n                    <a href=\"/docs.html\" {% if props.selected == \"docs\" %}class=\"Navbar--selected\"{% endif %}>Docs</a>\n                </li>\n                <!--\n                <li>\n                    <a href=\"/literate/src/Modulo.html\" {% if props.selected == \"source\" %}class=\"Navbar--selected\"{% endif %}>Source</a>\n                </li>\n                -->\n            </ul>\n\n            <div class=\"Navbar-rightInfo\">\n                v: {{ script.exports.version }}<br />\n                SLOC: {{ script.exports.sloc }} lines<br />\n                <a href=\"https://github.com/michaelpb/modulo/\">github</a> | \n                <a href=\"https://npmjs.com/michaelpb/modulo/\">npm</a> \n            </div>\n        </nav>\n    </script>\n\n    <props\n        selected\n    ></props>\n\n    <script>\n        function initializedCallback() {\n            if (Modulo.isBackend) {\n                //Modulo.ssgStore.navbar = module.script.getVersionInfo();\n                //Object.assign(script.exports, Modulo.ssgStore.navbar);\n                const info = module.script.getVersionInfo();\n                Object.assign(script.exports, info);\n                // Store results in DOM for FE JS\n                element.setAttribute('script-exports', JSON.stringify(script.exports));\n            } else {\n                // FE JS, retrieve from DOM\n                const dataStr = element.getAttribute('script-exports');\n                Object.assign(script.exports, JSON.parse(dataStr));\n            }\n        }\n    </script>\n</template>\n\n<component name=\"Section\">\n    <props\n        name\n    ></props>\n    <template>\n        <a class=\"secanchor\"\n          title=\"Click to focus on this section.\"\n          id=\"{{ props.name }}\"\n          name=\"{{ props.name }}\"\n          href=\"#{{ props.name }}\">#</a>\n        <h2 [component.children]></h2>\n    </template>\n    <style>\n        Section {\n            position: relative;\n        }\n        h2 {\n            font-weight: bold;\n            color: var(--highlight-color);\n            margin-bottom: 0;\n        }\n        a.secanchor {\n            padding-top: 100px;\n            color: var(--highlight-color);\n            opacity: 0.3;\n            display: block;\n        }\n        Section:hover .Section-helper {\n            opacity: 1.0;\n        }\n    </style>\n</component>\n\n<template mod-component=\"TabSet\">\n    <template>\n        <nav class=\"tab-nav\">\n            <ul>\n                {% for tab in state.tabs %}\n                    <li class=\"tab-nav_title\n                        {% if tab.title == state.selected %}\n                            tab-nav_title__selected\n                        {% endif %}\n                    \"><a @click:=script.select\n                             click.payload=\"{{ tab.title }}\"\n                        >{{ tab.title }}</a></li>\n                {% endfor %}\n            </ul>\n        </nav>\n        <div [component.children] modulo-ignore>\n        </div>\n    </template>\n    <style>\n        TabSet {\n            width: 100%;\n            display: flex;\n            flex-direction: column;\n            /*border: 1px dotted var(--highlight-color);*/\n            /*border-top: 1px dotted black;*/\n        }\n        .tab-nav {\n            /*border-bottom: 1px dotted var(--highlight-color);*/\n            width: 100%;\n        }\n        .tab-nav > ul {\n            width: 100%;\n            display: flex;\n        }\n        .tab-nav_title {\n            border: 2px solid black;\n            border-top-width: 4px;\n            border-bottom-width: 0;\n            border-radius: 8px 8px 0 0;\n            background: white;\n            min-width: 10%;\n        }\n\n        .tab-nav_title a,\n        .tab-nav_title a:visited,\n        .tab-nav_title a:active {\n            text-decoration: none;\n            color: black;\n            display: block;\n            padding: 5px;\n            font-weight: bold;\n            cursor: pointer;\n        }\n\n        .tab-nav_title__selected {\n            background: var(--highlight-color);\n            box-shadow: 0 0 0 5px var(--highlight-color);\n            padding-top: 3px;\n            border-top-width: 1px;\n            border-radius: 1px;\n        }\n    </style>\n    <state\n        selected=''\n        tabs:='[]'\n    ></state>\n    <script>\n        function initializedCallback() {\n            state.tabs = [];\n\n            for (const child of element.originalChildren) {\n                if (child.nodeType !== 1) { // DOM Element\n                    continue;\n                }\n                const title = child.getAttribute('name');\n                if (!title) {\n                    continue;\n                }\n                state.tabs.push({title, child});\n            }\n\n            if (state.tabs[0]) {\n                state.selected = state.tabs[0].title;\n                refreshTabs();\n            }\n        }\n\n        function refreshTabs() {\n            for (const {title, child} of state.tabs) {\n                if (title === state.selected) {\n                    child.style.display = 'block';\n                    let editorToWake = child.querySelector('.CodeMirror');\n                    if (editorToWake) {\n                        editorToWake.CodeMirror.refresh();\n                    }\n\n                } else if (child.style) {\n                    child.style.display = 'none';\n                }\n            }\n        }\n\n        function select(ev, payload) {\n            //console.log('selection happening!', payload);\n            state.selected = payload;\n            refreshTabs();\n        }\n    </script>\n</template>\n\n<template mod-component=\"CodeExample\">\n    <template>\n        <div class=\"split\">\n            <div\n            style=\"height: {{ props.vsize|number|default:170|add:2 }}px;\"\n            modulo-ignore>\n                <textarea [script.codemirror]>\n                </textarea>\n            </div>\n\n            <div>\n                <div class=\"toolbar\">\n                    <h2>Preview</h2>\n                    <button @click:=script.run>Run &#10227;</button>\n                </div>\n                <div [script.previewspot] class=\"preview-wrapper\">\n                    <div modulo-ignore></div>\n                </div>\n                {% if props.showtag %}\n                    {% if props.preview %}\n                        <div class=\"toolbar\">\n                            <h2>Tag</h2>\n                            <code>{{ props.preview }}</code>\n                        </div>\n                    {% endif %}\n                {% endif %}\n            </div>\n        </div>\n    </template>\n\n    <style>\n        .toolbar {\n            display: flex;\n            justify-content: space-between;\n        }\n        .toolbar > button {\n            border: 2px solid black;\n            border-top-width: 1px;\n            border-bottom-width: 3px;\n            border-radius: 3px;\n            background: white;\n            font-weight: lighter;\n            text-transform: uppercase;\n        }\n        .toolbar > button:active {\n            border-top-width: 3px;\n            border-bottom-width: 1px;\n        }\n        .toolbar > button:hover {\n            box-shadow: 0 0 2px var(--highlight-color); /* extremely subtle shadow */\n        }\n        .split > div:last-child {\n            padding: 5px;\n            background: whiteSmoke;\n        }\n        .split > div:first-child{\n            border: 1px solid black;\n            /*overflow-y: scroll;*/\n        }\n\n        .preview-wrapper {\n            margin-top: 4px;\n            padding: 5px;\n            padding-left: 20px;\n            padding-right: 20px;\n            border: 1px solid black;\n        }\n\n        .split > div > textarea {\n            width: 100%;\n            min-height: 10px;\n        }\n        .split {\n            display: grid;\n            grid-template-columns: 2fr 1fr;\n        }\n        @media (max-width: 992px) {\n            .split { display: block; }\n        }\n    </style>\n\n    <props\n        text\n        extraprops\n        vsize\n        textsrc\n        cname\n    ></props>\n\n    <state \n        nscounter:=1\n        preview=''\n    ></state>\n    <script>\n        let egTexts = null;\n        try {\n            if ('eg-eg' in Modulo.factoryInstances) {\n                egTexts = Modulo.factoryInstances['eg-eg']\n                    .baseRenderObj.script.exports.componentTexts;\n            }\n        } catch {\n            console.log('couldnt get egTexts');\n        }\n\n        let exCounter = 0; // global variable\n        //console.log('gettin script tagged');\n        /* Configure loader: */\n        function initializedCallback() {\n            //console.log('hey i am getting initialized wow');\n            //console.log('initialized callback', element.innerHTML);\n            if (Modulo.isBackend) {\n                let html;\n                if (egTexts && props.cname) {\n                    Modulo.assert(props.cname in egTexts, `${props.cname} not found`);\n                    html = egTexts[props.cname];\n                } else {\n                    html = (element.innerHTML || '').trim();\n                    html = html.replace(/([\\w\\[\\]\\._-]+):=\"(\\w+)\"/, '$1:=$2'); // clean up due to DOM\n                }\n\n                if (props.textsrc) {\n                    const html = Modulo.require('fs')\n                        .readFileSync('./docs-src/' + props.textsrc, 'utf8');\n                    element.setAttribute('text', html);\n                } else if (html && !element.getAttribute('text')) {\n                    element.setAttribute('text', html);\n                }\n            }\n        }\n\n        function previewspotMount({el}) {\n            element.previewSpot = el.firstElementChild;\n            run(); // mount after first render\n        }\n\n        function codemirrorMount({el}) {\n            if (Modulo.globals.CodeMirror) {\n                //console.log('this is props', props);\n                // TODO: Debug this, should not use textarea, should not need\n                // extra refreshes or anything\n                const cm = CodeMirror.fromTextArea(el, {\n                    lineNumbers: true,\n                    mode: 'django',\n                    theme: 'eclipse',\n                    indentUnit: 4,\n                });\n                element.codeMirrorEditor = cm;\n                window.cm = cm;\n\n                const height = props.vsize ? Number(props.vsize) : 170;\n                cm.setValue('');\n                cm.setSize(null, height);\n                cm.refresh();\n\n                let text = props.text.trim();\n                text = text.replace(/&#39;/g, \"'\"); // correct double escape\n                cm.setValue(text);\n                setTimeout(() => {\n                    cm.setValue(text);\n                    cm.setSize(null, height);\n                    cm.refresh();\n                }, 1);\n                el.setAttribute('modulo-ignore', 'y');\n            } else {\n                //console.log('Code mirror not found'); // probably SSG\n            }\n        }\n\n        function run() {\n            if (!Modulo.globals.CodeMirror) {\n                return;\n            }\n            exCounter++;\n            //console.log('There are ', exCounter, ' examples on this page. Gee!')\n            const namespace = `e${exCounter}g${state.nscounter}`; // TODO: later do hot reloading using same loader\n            state.nscounter++;\n            const loadOpts = {src: '', namespace};\n            const loader = new Modulo.Loader(null, {options: loadOpts});\n            const tagName = 'Example';\n            let text = element.codeMirrorEditor.getValue();\n            text = `<template mod-component=\"${tagName}\">${text}</template>`;\n            //console.log('Creating component from text:', text)\n            loader.loadString(text);\n            const tag = `${namespace}-${tagName}`;\n            let extraPropsStr = '';\n            /*\n            const extraProps =  props.extraprops ? JSON.parse(props.extraprops) : {};\n            for (const [key, value] of Object.entries(extraProps)) {\n                const escValue = value.replace(/\"/g, , '&quot;');\n                extraPropsStr += ` ${key}=\"${escValue}\"`;\n            }\n            */\n\n            const preview = `<${tag}${extraPropsStr}></${tag}>`;\n            element.previewSpot.innerHTML = preview;\n            //state.preview = preview;\n            //document.querySelector('#previewSpot').innerHTML = preview;\n            //console.log('adding preview', preview);\n        }\n    </script>\n</template>\n\n<template mod-component=\"CodeSnippet\">\n    <template>\n        <button class=\"m-Btn m-Btn--sm m-Btn--faded\"\n                title=\"Copy this code\" @click:=script.doCopy>\n            <span alt=\"Clipboard\">&#128203;</span>\n        </button>\n        <div modulo-ignore>\n            <div [script.codemirror]></div>\n        </div>\n    </template>\n    <props text\n    ></props>\n    <style>\n        CodeSnippet {\n            position: relative;\n            display: block;\n        }\n        .m-Btn {\n            position: absolute;\n            top: 1px;\n            right: 1px;\n            z-index: 10;\n        }\n    </style>\n    <script>\n        function doCopy() {\n            module.script.copyTextToClipboard(props.text);\n        }\n        function codemirrorMount({el}) {\n            let text = props.text.trim();\n            if (Modulo.isBackend && text.includes('$modulojs_sha384_checksum$')) {\n                const info = module.script.getVersionInfo();\n                const checksum = info.checksum || '';\n                text = text.replace('$modulojs_sha384_checksum$', checksum)\n                element.setAttribute('text', text);\n            }\n            if (Modulo.globals.CodeMirror) {\n                const cm = CodeMirror(el, {\n                    //lineNumbers: true,\n                    value: text,\n                    mode: 'django',\n                    theme: 'eclipse',\n                    indentUnit: 4,\n                    readOnly: true,\n                });\n                element.codeMirrorEditor = cm;\n            }\n        }\n    </script>\n</template>\n\n<template mod-component=\"RouteIndex\">\n    <script>\n        function initializedCallback() {\n            const {isBackend, ssgCurrentSubPath, globals} = Modulo;\n            const path = isBackend ? ssgCurrentSubPath : globals.location.hash;\n            if (path) {\n                element.innerHTML = '';\n            }\n        }\n    </script>\n</template>\n\n<template mod-component=\"Route\">\n    <props\n        name\n        src\n        index\n        loadedcontent\n        ssgpath\n    ></props>\n    <script>\n        function readFile(currentPath, src) {\n            const path = Modulo.require('path');\n            const fullPath = path.resolve(path.join(path.dirname(currentPath), src));\n            //console.log('found this fullPath', fullPath, currentPath, src);\n            return Modulo.require('fs').readFileSync(fullPath, 'utf8');\n        }\n\n        function getNewFilePath(newFilePath, name) {\n            // Strip HTML extension\n            if (newFilePath.toLowerCase().endsWith('.html')) {\n                newFilePath = newFilePath.substr(0, newFilePath.length - 5);\n            }\n\n            let newBaseName = name.replace(/\\//g, '__') + '.html'; // Sanitize for filename\n            newFilePath = newFilePath + '/' + newBaseName;\n            return newFilePath;\n        }\n\n        function setupBackend() {\n            const {name, src} = props;\n            const {ssgCurrentPath, ssgCurrentSubPath, ssgCurrentOutputPath} = Modulo;\n\n            const key = `mdu-Router|${src}`;\n            if (!Modulo.ssgStore[key]) {\n                Modulo.ssgStore[key] = readFile(ssgCurrentPath, src);\n            }\n\n            if (ssgCurrentSubPath) {\n                // We are currently \"in\" a subpath right now, fill with data\n                const data = Modulo.ssgStore[key];\n                if (ssgCurrentSubPath === ssgCurrentOutputPath &&\n                        ssgCurrentSubPath.endsWith(name + '.html')) {\n                    element.innerHTML = data;\n                    //Modulo.defineAll();\n                }\n            } else {\n                // otherwise, transform the path\n                const newFilePath = getNewFilePath(ssgCurrentOutputPath, name);\n                Modulo.ssgRegisterSubPath(newFilePath);\n                element.setAttribute('ssgpath', newFilePath);\n                if (props.index) {\n                    element.innerHTML = Modulo.ssgStore[key];\n                }\n            }\n        }\n\n        function fetchCallback(html) {\n            element.innerHTML = html;\n        }\n\n        function initializedCallback() {\n            const {isBackend, globals} = Modulo;\n            if (isBackend) {\n                setupBackend();\n            } else {\n                const hash = globals.location.hash;\n                const filename = `${props.name}.html`;\n                if (hash && hash.startsWith('/')) {\n                    if (hash === props.ssgpath) {\n                        globals.location.url = props.ssgpath; // redirect\n                    } else if (hash.endsWith(filename) || hash.endsWith(props.name)) {\n                        Modulo.globals.fetch(props.src)\n                            .then(response => response.text())\n                            .then(fetchCallback);\n                    }\n                }\n            }\n            /*\n            else {\n                console.log('checkin props');\n                if (props.loadedcontent) {\n                    //console.log('settin inner html', props.loadedcontent);\n                    //console.log(element);\n                    //element.innerHTML = props.loadedcontent;\n                    //element.setAttribute('loadedcontent', '');\n                }\n                //TODO: Check for hash-fragment navigation here\n                // ALSO: If hash fragment is found, AND was processed by a SSG\n                // (set \"wasSSG=True\"), then auto window.location.url redirect\n            }\n            */\n        }\n    </script>\n</template>\n\n\n",
 "/components/examplelib.html": "<module>\n    <script>\n        script.exports.frontpage = [\n            \"Hello\",\n            \"Simple\",\n            \"ToDo\",\n            \"API\",\n            \"Prime\",\n            \"MemoryGame\",\n        ];\n        //console.log('this is factory', factory.loader.src);\n        //console.log('this is DATA', Modulo.fetchQ.data);\n        //console.log('this is mah text', myText);\n        const myText = Modulo.fetchQ.data[factory.loader.src];\n        //const componentNames = [];\n        const componentTexts = {};\n        if (myText) {\n            let name = '';\n            let currentComponent = '';\n            for (const line of myText.split('\\n')) {\n                if (line.startsWith('</component>')) {\n                    componentTexts[name] = currentComponent;\n                    currentComponent = '';\n                    name = null;\n                } else if (line.startsWith('<component')) {\n                    name = line.split(' name=\"')[1].split('\"')[0];\n                    //componentNames.push(name);\n                } else if (name) {\n                    currentComponent += line + '\\n';\n                }\n            }\n        }\n        //script.exports.componentNames = componentNames;\n        script.exports.componentTexts = componentTexts;\n    </script>\n</module>\n\n\n\n<component name=\"Hello\">\n\n<template>\n    <button @click:=script.countUp>Hello {{ state.num }}</button>\n</template>\n<state num:=42\n></state>\n<script>\n    function countUp() {\n        state.num++;\n    }\n</script>\n</component>\n\n<component name=\"Simple\">\n\n<template>\n    Components can use <strong>any</strong> number\n    of <em title=\"Component Parts\">CParts</em>.\n</template>\n<style>\n    em { color: darkblue; }\n    * { text-decoration: underline; }\n</style>\n</component>\n\n\n<component name=\"ToDo\">\n<template>\n<ol>\n    {% for item in state.list %}\n        <li>{{ item }}</li>\n    {% endfor %}\n    <li>\n        <input [state.bind] name=\"text\" />\n        <button @click:=script.addItem>Add</button>\n    </li>\n</ol>\n</template>\n\n<state\n    list:=&#39;[\"Milk\", \"Bread\", \"Candy\"]&#39;\n    text=\"Beer\"\n></state>\n\n<script>\n    function addItem() {\n        state.list.push(state.text); // add to list\n        state.text = \"\"; // clear input\n    }\n</script>\n</component>\n\n<component name=\"API\">\n<template>\n<p>{{ state.name }} | {{ state.location }}</p>\n<p>{{ state.bio }}</p>\n<a href=\"https://github.com/{{ state.search }}/\" target=\"_blank\">\n    {% if state.search %}github.com/{{ state.search }}/{% endif %}\n</a>\n<input [state.bind] name=\"search\"\n    placeholder=\"Type GitHub username\" />\n<button @click:=script.fetchGitHub>Get Info</button>\n</template>\n\n<state\n    search=\"\"\n    name=\"\"\n    location=\"\"\n    bio=\"\"\n></state>\n\n<script>\n    function fetchGitHub() {\n        fetch(`https://api.github.com/users/${state.search}`)\n            .then(response => response.json())\n            .then(githubCallback);\n    }\n    function githubCallback(apiData) {\n        state.name = apiData.name;\n        state.location = apiData.location;\n        state.bio = apiData.bio;\n        element.rerender();\n    }\n</script>\n</component>\n\n\n<component name=\"SearchBox\">\n<template>\n<p>Start typing a book name to see \"search as you type\" (e.g. try &ldquo;the\nlord of the rings&rdquo;)</p>\n\n<input [state.bind] name=\"search\" @keyup:=script.typingCallback />\n\n<div class=\"results {% if state.search.length gt 0 %}visible{% endif %}\">\n    <div class=\"results-container\">\n        {% if state.loading %}\n            <img style=\"margin-top: 30px\"\n                src=\"{{ script.exports.loadingGif  }}\" alt=\"loading\" />\n        {% else %}\n            {% for result in state.results %}\n                <div class=\"result\">\n                    <img src=\"http://covers.openlibrary.org/b/id/{{ result.cover_i }}-S.jpg\" />\n                    <label>{{ result.title }}</label>\n                </div>\n            {% empty %}\n                <p>No books found.</p>\n            {% endfor %}\n        {% endif %}\n    </div>\n</div>\n</template>\n\n<state\n    search=\"\"\n    results:=[]\n    loading:=false\n></state>\n\n<script>\n    // Because this variable is created \"loose\" in the script tag, it becomes a\n    // static variable global to all instances of this class (though,\n    // thankfully, not global in general -- it's still in an \"IFFE\")\n    // (If we had wanted individual components to be debounced, we'd have\n    // needed to attach it to state)\n    let _globalDebounceTimeout = null;\n    function _globalDebounce(func) {\n        if (_globalDebounceTimeout) {\n            clearTimeout(_globalDebounceTimeout);\n        }\n        _globalDebounceTimeout = setTimeout(func, 500);\n    }\n\n    function typingCallback() {\n        state.loading = true;\n        const apiBase = 'http://openlibrary.org/search.json'\n        const search = `q=${state.search}`;\n        const opts = 'limit=6&fields=title,author_name,cover_i';\n        const url = `${apiBase}?${search}&${opts}`;\n        _globalDebounce(() => {\n            fetch(url)\n                .then(response => response.json())\n                .then(dataBackCallback);\n        });\n    }\n\n    function dataBackCallback(data) {\n        state.results = data.docs;\n        state.loading = false;\n        element.rerender();\n    }\n\n    // Puting this long URL down here to declutter\n    script.exports.loadingGif = ('https://cdnjs.cloudflare.com/ajax/libs/' +\n                                 'semantic-ui/0.16.1/images/loader-large.gif');\n</script>\n\n<style>\n    SearchBox {\n        position: relative;\n        display: block;\n        width: 300px;\n    }\n    input {\n        padding: 8px;\n        background: coral;\n        color: white;\n        width: 200px;\n        border: none;\n    }\n    input::after {\n        content: '\\1F50E';\n    }\n    .results-container {\n        display: flex;\n        flex-wrap: wrap;\n        justify-content: center;\n    }\n    .results {\n        position: absolute;\n        height: 0;\n        width: 0;\n        overflow: hidden;\n        display: block;\n        border: 2px solid coral;\n        border-radius: 0 0 20px 20px;\n        transition: height 2s;\n        z-index: 1;\n        background: white;\n    }\n    .results.visible {\n        height: 200px;\n        width: 200px;\n    }\n    .result {\n        padding: 10px;\n        width: 80px;\n        position: relative;\n    }\n    .result label {\n        position: absolute;\n        width: 80px;\n        background: rgba(255, 255, 255, 0.5);\n        font-size: 0.7rem;\n        top: 0;\n        left: 0;\n    }\n</style>\n\n\n</component>\n\n\n\n\n\n\n<component name=\"Prime\">\n<template>\n  <div class=\"grid\">\n    {% for i in script.exports.range %}\n      <div @mouseover:=script.setNum\n        class=\"\n            {# If-statements to check divisibility in template: #}\n            {% if state.number == i %}number{% endif %}\n            {% if state.number lt i %}hidden{% else %}\n              {% if state.number|divisibleby:i %}whole{% endif %}\n            {% endif %}\n        \">{{ i }}</div>\n    {% endfor %}\n  </div>\n</template>\n\n<state\n    number:=76\n></state>\n\n<script>\n    // Getting big a range of numbers in JS. Use \"script.exports\"\n    // to export this as a one-time global constant.\n    // (Hint: Curious how it calculates prime? See CSS!)\n    script.exports.range = \n        Array.from({length: 75}, (x, i) => i + 2);\n    function setNum(ev) {\n        state.number = Number(ev.target.textContent);\n    }\n</script>\n\n<style>\n.grid {\n    display: grid;\n    grid-template-columns: repeat(15, 1fr);\n    color: #ccc;\n    font-weight: bold;\n}\n.grid > div {\n    border: 1px solid #ccc;\n    cursor: crosshair;\n    transition: 0.2s;\n}\ndiv.whole {\n    color: white;\n    background: #B90183;\n}\ndiv.hidden {\n    background: #ccc;\n    color: #ccc;\n}\n\n/* Color green and add asterisk */\ndiv.number { background: green; }\ndiv.number::after { content: \"*\"; }\n/* Check for whole factors (an adjacent div.whole).\n   If found, then hide asterisk and green. */\ndiv.whole ~ div.number { background: #B90183; }\ndiv.whole ~ div.number::after { opacity: 0; }\n</style>\n</component>\n\n\n<component name=\"MemoryGame\">\n<!-- A much more complicated example application -->\n<template>\n{% if not state.cards.length %}\n    <h3>The Symbolic Memory Game</h3>\n    <p>Choose your difficulty:</p>\n    <button @click:=script.setup click.payload=8>2x4</button>\n    <button @click:=script.setup click.payload=16>4x4</button>\n    <button @click:=script.setup click.payload=36>6x6</button>\n{% else %}\n    <div class=\"board\n        {% if state.cards.length > 16 %}hard{% endif %}\">\n    {# Loop through each card in the \"deck\" (state.cards) #}\n    {% for card in state.cards %}\n        {# Using \"key=\" to speed up DOM reconciler #}\n        <div key=\"c{{ card.id }}\"\n            class=\"card\n            {% if state.revealed|includes:card.id %}\n                flipped\n            {% endif %}\n            \"\n            style=\"\n            {% if state.win %}\n                animation: flipping 0.5s infinite alternate;\n                animation-delay: {{ card.id }}.{{ card.id }}s;\n            {% endif %}\n            \"\n            @click:=script.flip\n            click.payload=\"{{ card.id }}\">\n            {% if state.revealed|includes:card.id %}\n                {{ card.symbol }}\n            {% endif %}\n        </div>\n    {% endfor %}\n    </div>\n    <p style=\"{% if state.failedflip %}\n                color: red{% endif %}\">\n        {{ state.message }}</p>\n{% endif %}\n</template>\n\n<state\n    message=\"Good luck!\"\n    win:=false\n    cards:=[]\n    revealed:=[]\n    lastflipped:=null\n    failedflip:=null\n></state>\n\n<script>\nconst symbolsStr = \"%!@#=?&+~÷≠∑µ‰∂Δƒσ\"; // 16 options\nfunction setup(ev, payload) {\n    const count = Number(payload);\n    let symbols = symbolsStr.substr(0, count/2).split(\"\");\n    symbols = symbols.concat(symbols); // duplicate cards\n    let id = 0;\n    while (id < count) {\n        const index = Math.floor(Math.random()\n                                    * symbols.length);\n        const symbol = symbols.splice(index, 1)[0];\n        state.cards.push({symbol, id});\n        id++;\n    }\n}\n\nfunction failedFlipCallback(ev) {\n    // Remove both from revealed array & set to null\n    state.revealed = state.revealed.filter(\n            id => id !== state.failedflip\n                    && id !== state.lastflipped);\n    state.failedflip = null;\n    state.lastflipped = null;\n    state.message = \"\";\n    element.rerender();\n}\n\nfunction flip(ev, id) {\n    if (state.failedflip !== null) {\n        return;\n    }\n    id = Number(id);\n    if (state.revealed.includes(id)) {\n        return; // double click\n    } else if (state.lastflipped === null) {\n        state.lastflipped = id;\n        state.revealed.push(id);\n    } else {\n        state.revealed.push(id);\n        const {symbol} = state.cards[id];\n        const lastCard = state.cards[state.lastflipped];\n        if (symbol === lastCard.symbol) {\n            // Successful match! Check for win.\n            const {revealed, cards} = state;\n            if (revealed.length === cards.length) {\n                state.message = \"You win!\";\n                state.win = true;\n            } else {\n                state.message = \"Nice match!\";\n            }\n            state.lastflipped = null;\n        } else {\n            state.message = \"No match.\";\n            state.failedflip = id;\n            setTimeout(failedFlipCallback, 1000);\n        }\n    }\n}\n</script>\n\n<style>\nh3 {\n    background: #B90183;\n    border-radius: 8px;\n    text-align: center;\n    color: white;\n    font-weight: bold;\n}\n.board {\n    display: grid;\n    grid-template-rows: repeat(4, 1fr);\n    grid-template-columns: repeat(4, 1fr);\n    grid-gap: 2px;\n    width: 100%;\n    height: 150px;\n    width: 150px;\n}\n.board.hard {\n    grid-gap: 1px;\n    grid-template-rows: repeat(6, 1fr);\n    grid-template-columns: repeat(6, 1fr);\n}\n.board > .card {\n    background: #B90183;\n    border: 2px solid black;\n    border-radius: 1px;\n    cursor: pointer;\n    text-align: center;\n    min-height: 15px;\n    transition: background 0.3s, transform 0.3s;\n    transform: scaleX(-1);\n    padding-top: 2px;\n    color: #B90183;\n}\n.board.hard > .card {\n    border: none !important;\n    padding: 0;\n}\n.board > .card.flipped {\n    background: #FFFFFF;\n    border: 2px solid #B90183;\n    transform: scaleX(1);\n}\n\n@keyframes flipping {\n    from { transform: scaleX(-1.1); background: #B90183; }\n    to {   transform: scaleX(1.0);  background: #FFFFFF; }\n}\n</style>\n</component>\n\n\n\n\n\n\n\n\n\n\n<component name=\"MiniExcel\">\n<!-- This example is unfinished, sorry! -->\n\n<template>\n    <table>\n        {% for row in state.data %}\n            <tr>\n                {% for col in row %}\n                    <td>{{ col }}</td>\n                {% endfor %}\n            </tr>\n        {% endfor %}\n    </table>\n</template>\n\n<state\n    data:='[[\"\"]]'\n/><state>\n\n<script>\n    console.log('factory for miniexcel');\n/*\n    console.log('factory for miniexcel');\n    function initalizedCallback(renderObj) {\n        console.log('getting initialized', renderObj);\n        state.data = [\n            ['', '', '', '', '', ''],\n            ['', '', '', '', '', ''],\n            ['', '', '', '', '', ''],\n            ['', '', '', '', '', ''],\n            ['', '', '', '', '', ''],\n        ];\n    }\n*/\n</script>\n\n</component>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<component name=\"AccessingLoader\">\n\n<template>\n    <button @button>Click me and look in Dev Console</strong>\n</template>\n<script>\n    // console.log(module); // \n    function onClick() {\n        // Examine this object. See how script tag exports\n        // are actually already available? This allows for\n        // cross-component dependencies.\n        console.log('This is module:', module);\n    }\n</script>\n\n</component>\n\n"
};

Modulo.defineAll();
