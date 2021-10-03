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

if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
var Modulo = {
    globals: {HTMLElement}, // globals is window in Browser, an obj in Node.js
    reconcilers: {}, // used later, for custom DOM Reconciler classes
    cparts: {}, // used later, for custom CPart classes
    templating: {}, // used later, for custom Templating languages
};

// ## Code standards
// - SLOC limit: 1000 lines
// - Line limit: 80 chars
// - Indentation: 4 spaces



// ## Quick definitions:
// * Component - A discrete, re-usable bit of code, typically used to show a
//   graphical UI element (eg a button, or a rich-text area). Components can
//   also use other components (eg a form).
// * ComponentPart, or CPart - Each component consists of a "bag" or "bundle"
//   of CParts, each CPart being a "pluggable" module that supplies different
// * functionality for that component.
// * customElement - The term used for a custom HTML5 web component
// * Modulo.globals - Identical to "window", helps keep unit-tests simpler

// ## Lifecycle ToC:

// ### Group 1: Preparation
// These happen once per component definition (in the case of `load` and
// `factory`), or once per component usage (in the case of `initialized`)

// * `load` - the stage of parsing a code file (eg static analysis). Note that
//            if a Modulo-based project is compiled into a single JS file, this
//            `load` happens BEFORE, and thus gets "baked-in".
// * `factory` - any one-time, global set-up for a component (e.g. compiling the template)
// * `initialized` - happens once, every time a component is used (mounted) on the page

// ### Group 2: Rendering
// These get repeated every time a component is rendered or rendered.
// * `prepare` - Gather data needed before rendering (e.g. gather variables for
// template)
// * `render` - Use the Template to render HTML code
// * `update` - Updates the DOM to reflect the newly generated HTML code, while
//    applying directives. Each directive gets it's own set of lifecycle
//    methods, like eventMount and eventUnmount.
// * `updated` - Perform any clean-up tasks after DOM update

// ### Group 3: Directives
// * `event` & `eventCleanup` - Handle @click or @keyup events
// * `resolve` - Handle resolving value set with =:


// ## Modulo.defineAll()
// Our Modulo journey begins with `Modulo.defineAll()`, the function invoked to
// "activate" all of Modulo by defining the "mod-load" web component. This
// constructs a Loader object for every `<mod-load ...>` tag it encounters.
Modulo.defineAll = function defineAll() {
    Modulo.globals.customElements.define('mod-load', Modulo.Loader);

    // Then, looks for embedded modulo components, found in <template modulo>
    // tags or <script type="modulo/embed" tags>. For each of these, it loads
    // their contents into a global loader with namespace 'x'.
    Modulo.globalLoader = new Modulo.Loader();
    Modulo.globalLoader.namespace = 'x';
    Modulo.globalLoader.loadModules(Modulo.globals.document);
};

// # Modulo.Loader
// Once registered by `defineAll()`, the `Modulo.Loader` will do the rest of
// the heavy lifting of fetching & registering Modulo components.
Modulo.Loader = class Loader extends HTMLElement {

    // ## Loader: connectedCallback()

    // The Web Components specifies the use of a "connectedCallback" function.
    // In this case, this function will be invoked as soon as the DOM is loaded
    // with a `<mod-load>` tag in it.
    connectedCallback() {
        this.src = this.getAttribute('src');
        this.namespace = this.getAttribute('namespace');
        Modulo.assert(this.src, 'Loader: Invalid or missing src= attribute');
        Modulo.assert(this.namespace, 'Loader: Invalid or missing namespace= attribute');

        this.cacheKey = `Modulo.Loader:cache:${this.namespace}:${this.src}`;
        const cachedData = Modulo.globals.localStorage.getItem(this.cacheKey);

        // TODO: Finish cache feature, maybe fold into hot reload, eg it always
        // first loads from cache, then it tries hotreloading from origin.
        // This would make "never-cache" less important, but "always-cache"
        // would be useful and be the inverse.
        const skipCache = true || this.hasAttribute('never-cache') || Modulo.require;
        if (!skipCache && cachedData && cachedData.length > 2) {
            for (const [name, loadObj] of JSON.parse(cachedData)) {
                this.defineComponent(name, loadObj);
            }
        } else {
            /* 
                if (this.getAttribute('reload')) {
                    setInterval(this.doFetch, 2000);
                }
            */
            this.doFetch();
        }
    }

    loadModules(elem) {
        this.mod = {};
        const mod = elem.querySelector('module');
        if (mod) {
            const [modName, modLoadObj] = this.loadFromDOMElement(mod);
            this.mod = modLoadObj;
            this.modFactory = this.defineComponent(this.namespace, modLoadObj);
        }
        const query = 'template[modulo-embed],script[type="modulo/embed"]';
        for (const embeddedModule of elem.querySelectorAll(query)) {
            this.loadString(embeddedModule.innerHTML);
        }
    }

    doFetch() {
        // After initializing data, send a new request to the URL specified by
        // the src attribute. When the response is received, load the text as a
        // Modulo component module definition.
        Modulo.globals.fetch(this.src)
            .then(response => response.text())
            .then(text => this.loadString(text))
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
        this.loadModules(div); // In case we are just loading an embedded component

        if (!this.factoryData) {
            this.factoryData = [];
        }
        for (const tag of div.querySelectorAll('[mod-component],component')) {
            const [name, loadObj] = this.loadFromDOMElement(tag);
            this.factoryData.push([name, loadObj]);
            this.defineComponent(name, loadObj);
        }
        const serialized = JSON.stringify(this.factoryData);
        Modulo.globals.localStorage.setItem(this.cacheKey, serialized);
    }

    // ## Loader: loadFromDOMElement
    // Create a ComponentFactory instance from a given `<component>` definition.
    loadFromDOMElement(elem) {
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
            const {loadCallback} = Modulo.cparts[cPartName];
            loadObj[cPartName].push(loadCallback(node, this, loadObj));
        }
        return [name, loadObj];
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
        let children = elem.content ? elem.content.childNodes : elem.children;
        return Array.from(children)
            .map(node => ({node, cPartName: this.getNodeCPartName(node)}))
            .filter(obj => obj.cPartName);

        /* TODO: rewrite this */
        const arr = [];
        for (const node of elem.content.childNodes) {
            const cPartName = this.getNodeCPartName(node);
            if (cPartName) {
                arr.push({node, cPartName});
            }
        }
        return arr;
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
    constructor(loader, name, options) {
        this.loader = loader;
        this.options = options;
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;
        Modulo.ComponentFactory.registerInstance(this);
        this.componentClass = this.createClass();
        this.baseRenderObj = this.runFactoryLifecycle(options);
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
    //     script: {text: '"use static"\nvar state;\nfunction inpCh(....etc)'},
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
                if (name in element.cparts) {
                    element.cpartSpares[name].push(instance);
                }
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
        this.isMounted = false;
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
                if (!this.renderObj) {
                    console.log('lolwut - renderobj is falsy', this.renderObj);
                    break;
                }

                // TODO: clean this up, renderObj should never "just"
                // be cPart, should be the whole cparts.* being bare
                // name OOP, vs cparts.*  being factory-defined
                if (!(cPartName in this.renderObj)) {
                    //this.renderObj[cPartName] = cPart;
                }
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

    resolveAttributeName(name) {
        if (this.hasAttribute(name)) {
            return name;
        } else if (this.hasAttribute(name + ':')) {
            return name + ':';
        }
        return null;
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
        if (!this.isMounted && !('template' in this.cparts)) {
            // TODO: Make 'template' not hardcoded here, as well as
            // Component's updateCallback. OR do attrs?
        }
        this.isMounted = true;
    }
}

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
            Modulo.assert(setUp || tearDown, `Unknown directive: "${dName}"`);
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

Modulo.ComponentPart = class ComponentPart {
    static loadCallback(node, loader, loadObj) {
        const options = Modulo.utils.parseAttrs(node);
        const content = node.tagName === 'TEMPLATE' ? node.innerHTML
                                                    : node.textContent;
        return {options, content};
    }

    static factoryCallback() {}

    constructor(element, options) {
        this.component = element; // TODO: Remove
        this.element = element;
        this.options = options.options;
        this.content = options.content;
    }
}

Modulo.cparts.component = class Component extends Modulo.ComponentPart {
    prepareCallback() {
        // TODO shouldn't have to do this ---v
        return {
            eventMount: this.eventMount.bind(this),
            eventUnmount: this.eventUnmount.bind(this),
            resolveMount: this.resolveMount.bind(this),
            resolveUnmount: this.resolveUnmount.bind(this),
            childrenMount: this.childrenMount.bind(this),
            childrenUnmount: this.childrenUnmount.bind(this),
        };
    }

    updateCallback(renderObj) {
        const {element} = this;
        if (renderObj.template) {
            let newContents = renderObj.template.renderedOutput || '';
            element.reconcile(element, newContents);
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
            const payload = getAttr(`${attrName}.payload`, el.value);
            //console.log('this is payload', `${attrName}.payload`, payload);
            this.handleEvent(func, ev, payload);
        };
        info.listener = listener;
        el.addEventListener(attrName, listener);
    }

    eventUnmount({attrName, listener}) {
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

    copyMount({el}) {
        // dead code?
        // change to "this.element"
        for (const attr of this.element.getAttributeNames()) {
            el.setAttribute(attr, this.element.getAttribute(attr));
        }
        /*
        const props = {};
        for (let propName of Object.keys(this.options)) {
            propName = propName.replace(/:$/, ''); // normalize
            let attrName = this.element.resolveAttributeName(propName);
            if (!attrName) {
                console.error('Prop', propName, 'is required for', this.element.tagName);
                continue;
            }
            let value = this.element.getAttribute(attrName);
            if (attrName.endsWith(':')) {
                attrName = attrName.slice(0, -1); // trim ':'
                value = this.element.moduloRenderContext.resolveValue(value);
            }
            props[propName] = value;
        }
        */
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

/*
Modulo.cparts.attributes = class Attributes extends Modulo.ComponentPart {
    initializedCallback() {
        for (let [name, value] of Object.entries(this.options)) {
            if (name.includes('.')) {
                name = '[' + nae
            }
            this.element.setAttribute(name, value);
        }
    }
}
*/

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
        let {content, options} = super.loadCallback(node, loader, loadObj);
        const {name} = loadObj.component[0];
        content = Modulo.cparts.style.prefixAllSelectors(loader.namespace, name, content);
        return {options, content};
    }
}


Modulo.cparts.template = class Template extends Modulo.ComponentPart {
    static factoryCallback(opts, factory, renderObj) {
        const {loader} = factory;
        const tagPref = '$1' + loader.namespace + '-';
        const content = (opts.content || '').replace(/(<\/?)my-/ig, tagPref);
        const engineName = opts.engine || 'MTL';
        const instance = new Modulo.templating[engineName](content, opts);
        return {compiledTemplate: ctx => instance.render(ctx)};
    }
    renderCallback(renderObj) {
        const compiledTemplate = renderObj.template.compiledTemplate;
        const context = renderObj;
        const result = compiledTemplate(context);
        if (result.includes('undefined')) {
            /* console.log('undefined me', renderObj); */
        }
        return {renderedOutput: result, compiledTemplate};
    }
}


Modulo.cparts.script = class Script extends Modulo.ComponentPart {
    static getSymbolsAsObjectAssignment(contents) {
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

        // TODO: Rename script to script to be consistent with event-time lifecycle
        return `
            'use strict';
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
        const wrappedJS = this.wrapJavaScriptContext(code, localVars);
        const results = (new Function('Modulo,factory', wrappedJS)).call(null, Modulo, factory);
        results.localVars = localVars;
        return results;
    }

    constructor(element, options) {
        super(element, options);

        // Attach callbacks from script to this, to hook into lifecycle.
        const {script} = element.initRenderObj;
        const cbs = Object.keys(script)
            .filter(key => key.endsWith('Callback') || key.endsWith('Mount'));
        cbs.push('initializedCallback', 'eventCallback'); // always CBs for these
        for (const cbName of cbs) {
            this[cbName] = renderObj => {
                this.prepLocalVars(renderObj);
                if (cbName in script) {
                    script[cbName](renderObj);
                }
            };
        }
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
        const func = () => this.set(name, el.value);
        // eventually customizable, eg [state.bind]mouseover=mouseY (event
        // name, el property name, and/or state propery name etc)
        const evName = 'keyup';
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
                    el.value = this.data[name];
                }
            }
        }
        this._oldData = null;
    }
}

// ModuloTemplate
Modulo.templating.MTL = class ModuloTemplateLanguage {
    constructor(text, options = {}) {
        Object.assign(this, Modulo.templating.defaultOptions, options);
        this.opAliases['not in'] = `!(${this.opAliases['in']})`;
        this.renderFunc = this.compile(text);
    }

    tokenizeText(text) {
        const re = '(' + this.modeTokens.join('|(').replace(/ +/g, ')(.+?)');
        return text.split(RegExp(re)).filter(token => token !== undefined);
    }

    compile(text) {
        this.stack = []; // Template tag stack
        let output = 'var OUT=[];';
        let mode = 'text'; // Start in text mode
        for (const token of this.tokenizeText(text)) {
            if (mode) {
                const result = this.modes[mode](token, this, this.stack);
                output += result || '';
            }
            mode = (mode === 'text') ? null : (mode ? 'text' : token);
        }
        // console.log('this is the rsulting template code', output.replace(/([;\}\{])/g, '$1\n'));
        return new Function('CTX,G', output + ';return OUT.join("");');
    }

    render(renderContext) {
        return this.renderFunc(Object.assign({}, renderContext), this);
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
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
Modulo.Template = Modulo.templating.MTL; // Alias

Modulo.templating.defaultOptions = {
    modeTokens: ['{% %}', '{{ }}', '{# #}'],
    //opTokens: '==,>,<,>=,<=,!=,not in,is not,is,in,not,and,or',
    opTokens: '==,>,<,>=,<=,!=,not in,is not,is,in,not',
    opAliases: {
        '==': 'X === Y',
        'is': 'X === Y',
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
    pluralize: (s, arg) => arg.split(',')[(s === 1) * 1],
    add: (s, arg) => s + arg,
    subtract: (s, arg) => s - arg,
    default: (s, arg) => s || arg,
    //invoke: (s, arg) => s(arg),
    //getAttribute: (s, arg) => s.getAttribute(arg),
    get: (s, arg) => s[arg],
    includes: (s, arg) => s.includes(arg),
    divisibleby: (s, arg) => ((s * 1) % (arg * 1)) === 0,
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

// SetDomReconciler ------------------
Modulo.reconcilers.InnerHtml = class InnerHtmlReconciler {
    reconcile(element, newHTML) {
        element.innerHTML = newHTML;
        // TODO, add in directives stuff, move elsewhere
    }
}
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

    static get(obj, key) {
        return key.split('.').reduce((o, name) => o[name], obj);
    }
}

Modulo.assert = function assert(value, ...info) {
    if (!value) {
        console.error(...info);
        throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
    }
}
/*
# HACKY FUNCTIONS
Pls ignore all
*/
function getGetAttr(element) {
    // HACK
    if (element.getAttr) {
        return element.getAttr;
    } else {
        return (...args) => element.getAttribute(...args);
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
