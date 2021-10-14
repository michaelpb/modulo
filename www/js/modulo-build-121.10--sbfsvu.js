// modulo build -sbfsvu
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
    if (!Modulo.fetchQ) {
        Modulo.fetchQ = new Modulo.FetchQueue();
    }
    Modulo.globals.customElements.define('mod-load', Modulo.DOMLoader);

    // Then, looks for embedded modulo components, found in <template modulo>
    // tags or <script type="modulo/embed" tags>. For each of these, it loads
    // their contents into a global loader with namespace 'x'.
    const opts = {options: {namespace: 'x'}};
    Modulo.globalLoader = new Modulo.Loader(null, opts);

    const query = 'template[modulo-embed],script[type="modulo/embed"]';
    for (const embedElem of Modulo.globals.document.querySelectorAll(query)) {
        // TODO: Should be elem.content if tag===TEMPLATE
        Modulo.globalLoader.loadString(embedElem.innerHTML);
    }
    Modulo.CommandMenu.setup();
    Modulo.fetchQ.wait(() => {
        for (const embedElem of Modulo.globals.document.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            Modulo.globalLoader.loadString(embedElem.innerHTML);
        }
    });
};

Modulo.DOMLoader = class DOMLoader extends HTMLElement {
    // TODO: Delete DOMLoader
    // The Web Components specifies the use of a "connectedCallback" function.
    // In this case, this function will be invoked as soon as the DOM is loaded
    // with a `<mod-load>` tag in it.
    connectedCallback() {
        if (this.loader) {
            console.log('Error: Duplicate connected?', this.loader.attrs);
        } else {
            this.initialize();
        }
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
        Modulo.assert(this.src, 'Loader: Invalid src= attribute:', this.src);
        Modulo.assert(this.namespace, 'Loader: Invalid namespace= attribute:', this.namespace);

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
        if (this.src) {
            Modulo.fetchQ.basePath = this.src;
        }
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

        // TODO: Rewrite this to be just a normal cpart load, with "hasSubParts = true"
        const attrs = Modulo.utils.parseAttrs(elem);
        attrs.name = attrs.modComponent || attrs.name;

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

        // Everything gets implicit Component CPart -v
        const loadObj = {component: [{options: attrs}]};

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
                Modulo.fetchQ.enqueue(data.dependencies, cb);
            }
        }
        return [attrs.name, array || loadObj];
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

        // TODO: This is actually the "biggest" try-catch. When I work on err
        // messages, this might be the spot (e.g. use other try-catches further
        // down, that annotate the Error with extra info that then gets nicely
        // formatted here).
        try {
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

        // HACK delete
        if (!this.originalHTML && this.innerHTML) {
            this.originalHTML = this.innerHTML;
        }
        // HACK delete
        this.setupCParts();
        this.lifecycle(['initialized'])
        this.rerender();
        this.isMounted = true;
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

    for (const rawName of el.getAttributeNames()) {
        // todo: optimize skipping most elements or attributes, e.g. "if
        // alpha and dashes, skip"
        let name = rawName;

        // Skip: This element and descendants should be ignored
        if (rawName === 'modulo-ignore') {
            //console.log('skipping over', el);
            return;
        }

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
        // TODO: Add code here to check for reattach children
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
        if (!this.element.isMounted) { // First time initialized
            const mode = this.attrs ? (this.attrs.mode || 'default') : 'default';
            if (mode === 'vanish' || mode === 'vanish-as-document') {
                // TODO: switch with slightly cleaner "vanish-into-document"
                // which 1) looks for body, copies to body, then 2) looks for
                // head, copies to head
                const oldHead = this.element.querySelector('head');
                const oldBody = this.element.querySelector('body');
                const realHead = Modulo.globals.document.querySelector('head');
                const realBody = Modulo.globals.document.querySelector('body');
                if (mode === 'vanish-as-document') {
                    const newHTML = this.element.innerHTML;
                    for (const oldScr of this.element.querySelectorAll('script')) {
                        // TODO: should copy over all attributes, eg async
                        const newScript = Modulo.globals.document.createElement('script');
                        newScript.src = oldScr.src;
                        oldScr.remove(); // delete old element & move to head
                        Modulo.globals.document.head.appendChild(newScript);
                    }
                    Modulo.globals.document.children[0].innerHTML = newHTML;
                }

                // TODO: finish this hack
                // Hack to prevent nondeterministic bug with exact ordering,
                // remove after finishing correct mounting / dom resolution
                // ordering
                const nodes = Array.from(this.element.querySelectorAll('*'));
                if (nodes.length > 0) {
                    for (const elem of nodes) {
                        if (typeof elem === 'string') {
                            continue;
                        }
                        const attrs = Modulo.utils.parseAttrs(elem);
                        for (const name of elem.getAttributeNames()) {
                            if (name === '[component.children]') {
                                elem.innerHTML = this.element.originalHTML;
                            }
                        }
                    }
                }

                this.element.replaceWith(...this.element.childNodes); // Delete self
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
        // IDEA: Have value be querySelector, eg [component.children]="div"
        //console.log('getting childrenMount', this.element);
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
        const cName = loadObj.component[0].options.name;
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
        // Idea: Use Template interface for Style transformers (so that MTL
        // could be used in a pinch well). Eg if ('transform' in options) { Transfomer().render(renderObj) }
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
        const cName = loadObj.component[0].options.name;
        // TODO: Move prefixing to factoryCallback (?)
        data.content = Modulo.cparts.style.prefixAllSelectors(
                          loader.namespace, cName, data.content);
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
        const regexpG = /function\s+(\w+)/g;
        const regexp2 = /function\s+(\w+)/; // hack, refactor
        const matches = contents.match(regexpG) || [];
        return matches.map(s => s.match(regexp2)[1])
            .map(s => `"${s}": typeof ${s} !== "undefined" ? ${s} : undefined,\n`)
            .join('');
    }

    static wrapJavaScriptContext(contents, localVars) {
        // TODO: Generalized wrapping idea:
        //   - Split by word, get ALL symbols, filter out invalid ones, and
        //   then do a "typeof ? :" loop in the return value. Then, assign all
        //   functions to script, and all other values to script.exports.
        // (Also: Need to check for reserved words in capture group:
        // filter away things like "// function for games")
        // (which generates a syntax error with "typeof for")
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
                //console.log("this is localVars", localVars);
                //console.log("this is localVars", localVar, renderObj[localVar]);
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

Modulo.templating.defaultOptions.filters = (function () {
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

    const filters = {
        upper: s => s.toUpperCase(),
        lower: s => s.toLowerCase(),
        escapejs: s => JSON.stringify(s),
        first: s => s[0],
        last: s => s[s.length - 1],
        length: s => s.length,
        //trim: s => s.trim(), // TODO: improve interface to be more useful
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

        //Object.assign(new String(
        //                ), {safe: true}),
        renderas: (renderCtx, template) => safe(template.instance.render(renderCtx)),
    };
    return Object.assign(filters, {jsobj, safe});
})();

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
        // Simple, insecure, hashing function, returns base32 hash
        let h = 0;
        for(let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return (h || 0).toString(32);
    }
}

Modulo.FetchQueue = class FetchQueue {
    constructor() {
        this.queue = {};
        this.data = {};
        this.waitCallbacks = [];
        this.finallyCallbacks = [];
    }
    enqueue(queueObj, callback) {
        queueObj = typeof queueObj === 'string' ? {':)': queueObj} : queueObj;
        for (let [label, src] of Object.entries(queueObj)) {
            // TODO remove! ------------------------------------v
            if (src.startsWith('.') && this.basePath && this.basePath !== 'null') {
                src = src.replace('.', Modulo.utils.dirname(this.basePath));
                src = src.replace(/\/\//, '/'); // remove double slashes
            }
            if (src in this.data) {
                callback(this.data[src], label);
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
        // v--dead code?
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

        // v--dead code?
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

// TODO: Probably should do this on an onload event or similar
//Modulo.globals.onload = () => Modulo.defineAll();
Modulo.buildTemplate = new Modulo.templating.MTL(`// modulo build {{ hash }}
{{ source|safe }};\n
Modulo.defineAll();
Modulo.fetchQ.data = {{ allData|jsobj|safe }};
{% for path, text in preloadData %}
//  Preloading page: {{ path|escapejs|safe }} {# Simulates loading page #}
Modulo.fetchQ.basePath = {{ path|escapejs|safe }};
Modulo.globalLoader.loadString(Modulo.fetchQ.data[Modulo.fetchQ.basePath]);
{% endfor %}`);

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

// And that's the end of the Modulo source code story. This means it's where
// your own Modulo story begins!

// No, really, your story will begin right here. When Modulo is compiled,
// whatever code exists below this point is user-created code.

// So... keep on reading for the latest Modulo project:
// ------------------------------------------------------------------
;

Modulo.defineAll();
Modulo.fetchQ.data = {
  "/components/layouts.html": // (117 lines)
`<component name="Page" mode="vanish-as-document">
    <props
        navbar
        docbarselected 
        pagetitle
    ></props>

    <template src="./layouts/base.html"></template>

    <script>
        function initializedCallback() {
            if (Modulo.isBackend) {
                //Modulo.ssgStore.navbar = module.script.getGlobalInfo();
                //Object.assign(script.exports, Modulo.ssgStore.navbar);
                const info = module.script.getGlobalInfo();
                Object.assign(script.exports, info);
                // Store results in DOM for FE JS
                element.setAttribute('script-exports', JSON.stringify(script.exports));
            } else if (element.getAttribute('script-exports')) {
                // FE JS, retrieve from DOM
                const dataStr = element.getAttribute('script-exports');
                Object.assign(script.exports, JSON.parse(dataStr));
            } else {
                console.log('Warning: Couldnt get global info');
            }
        }
    </script>
</component>


<!--<script src="/components/layouts/globalUtils.js"></script>-->
<module>
    <script>
        let txt;

        function sloccount() {
            if (!txt) {
                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
            }
            return Modulo.require('sloc')(txt, 'js').source;
        }

        function checksum() {
            if (!txt) {
                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
            }
            const CryptoJS = Modulo.require("crypto-js");
            const hash = CryptoJS['SHA384'](txt);
            return hash.toString(CryptoJS.enc.Base64);
            //const shaObj = new jsSHA("SHA-384", "TEXT", { encoding: "UTF8" });

            //shaObj.update(txt);
            //const hash = shaObj.getHash("B64");
            //return hash;
        }

        function getGlobalInfo() {
            /*
            // Only do once to speed up SSG
            //console.log('this is Modulo', Object.keys(Modulo));
            if (!Modulo.ssgStore.versionInfo) {
                const bytes = Modulo.require('fs').readFileSync('./package.json');
                const data = JSON.parse(bytes);
                Modulo.ssgStore.versionInfo = {
                    version: data.version,
                    sloc: sloccount(),
                    checksum: checksum(),
                };
            }
            return Modulo.ssgStore.versionInfo;
            */
            return {};
        }

        // https://stackoverflow.com/questions/400212/
        const {document, navigator} = Modulo.globals;
        function fallbackCopyTextToClipboard(text) {
            console.count('fallbackCopyTextToClipboard');
            var textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                var msg = successful ? 'successful' : 'unsuccessful';
                //console.log('Fallback: Copying text command was ' + msg);
            } catch (err) {
                //console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
        }

        function copyTextToClipboard(text) {
            if (!navigator.clipboard) {
                fallbackCopyTextToClipboard(text);
                return;
            }
            navigator.clipboard.writeText(text).then(function() {
                //console.log('Async: Copying to clipboard was successful!');
            }, function(err) {
                console.error('Async: Could not copy text: ', err);
            });
        }
    </script>

</module>

`,// (ends: /components/layouts.html) 

  "/components/layouts/base.html": // (64 lines)
`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf8" />
    <title>{{ props.pagetitle }} - modulojs.org</title>
    <link rel="stylesheet" href="/js/codemirror_5.63.0/codemirror_bundled.css" />
    <link rel="stylesheet" href="/css/style.css" />
    <link rel="icon" type="image/png" href="/img/mono_logo.png" />
    <script src="/js/codemirror_5.63.0/codemirror_bundled.js"></script>

    <!-- TODO: Switch to <module><load> style syntax -->
    <mod-load src="/components/modulowebsite.html" namespace="mws"></mod-load>
    <mod-load src="/components/examplelib.html" namespace="eg"></mod-load>
</head>
<body>

<nav class="Navbar">
    <a href="/index.html"><img src="/img/mono_logo.png" style="height:70px" alt="Modulo" /></a>
    <ul>
        <li>
            <a href="/index.html#about" {% if props.navbar == "about" %}class="Navbar--selected"{% endif %}>About</a>
        </li>
        <li>
            <a href="/start.html" {% if props.navbar == "start" %}class="Navbar--selected"{% endif %}>Start</a>
        </li>
        <li>
            <a href="/docs/" {% if props.navbar == "docs" %}class="Navbar--selected"{% endif %}>Docs</a>
        </li>
    </ul>

    <div class="Navbar-rightInfo">
        v: {{ script.exports.version }}<br />
        SLOC: {{ script.exports.sloc }} lines<br />
        <a href="https://github.com/michaelpb/modulo/">github</a> | 
        <a href="https://npmjs.com/michaelpb/modulo/">npm</a> 
    </div>
</nav>

{% if props.docbarselected %}
    <main class="Main Main--fluid Main--withSidebar">
        <aside class="TitleAside TitleAside--navBar" >
            <h3><span alt="Lower-case delta">%</span></h3>
            <nav class="TitleAside-navigation">
                <h3>Documentation</h3>
                <mws-DocSidebar path="{{ props.docbarselected }}"></mws-DocSidebar>
            </nav>
        </aside>
        <aside style="border: none" [component.children]>
        </aside>
    </main>
{% else %}
    <main [component.children] class="Main">
    </main>
{% endif %}

<footer>
    <main>
        (C) 2021 - Michael Bethencourt - Documentation under LGPL 3.0
    </main>
</footer>

</body>
</html>
`,// (ends: /components/layouts/base.html) 

  "/components/modulowebsite.html": // (471 lines)
`<component name="Section">
    <props
        name
    ></props>
    <template>
        <a class="secanchor"
          title="Click to focus on this section."
          id="{{ props.name }}"
          name="{{ props.name }}"
          href="#{{ props.name }}">#</a>
        <h2 [component.children]></h2>
    </template>
    <style>
        Section {
            position: relative;
        }
        h2 {
            font-weight: bold;
            color: var(--highlight-color);
            margin-bottom: 0;
        }
        a.secanchor {
            padding-top: 100px;
            color: var(--highlight-color);
            opacity: 0.3;
            display: block;
        }
        Section:hover .Section-helper {
            opacity: 1.0;
        }
    </style>
</component>



<component name="Demo">
    <props
        text
        demotype
        fromlibrary
    ></props>
    <template src="./modulowebsite/demo.html"></template>

    <state
        tabs:='[]'
        selected:=null
        preview=""
        text=""
        nscounter:=1
        showpreview:=false
        showclipboard:=false
        fullscreen:=false
    ></state>
    <script src="./modulowebsite/demo.js"></script>
    <style src="./modulowebsite/demo.css"> </style>

</component>




<component name="DocSidebar">

<props
    path
    showall
></props>

<template>
<ul>
    {% for linkGroup in script.exports.menu %}
        <li class="
            {% if linkGroup.children %}
                {% if linkGroup.active %}gactive{% else %}ginactive{% endif %}
            {% endif %}
            "><a href="{{ linkGroup.filename }}">{{ linkGroup.label }}</a>
            {% if linkGroup.active %}
                {% if linkGroup.children %}
                    <ul>
                    {% for childLink in linkGroup.children %}
                        <li><a
                          href="{{ linkGroup.filename }}#{{ childLink.hash }}"
                            >{{ childLink.label }}</a>
                        {% if props.showall %}
                            {% if childLink.keywords.length gt 0 %}
                                <span style="margin-left: 10px; color: #aaa">(<em>Topics: {{ childLink.keywords|join:', ' }}</em>)</span>
                            {% endif %}
                        {% endif %}
                        </li>
                    {% endfor %}
                    </ul>
                {% endif %}
            {% endif %}
        </li>
    {% endfor %}


    <!--
    <li>
        Other resources:

        <ul>
            <li>
                <a href="/docs/faq.html">FAQ</a>
            <li title="Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.">
                Literate Source*<br /><em>* Coming soon!</em>
            </li>
        </ul>

    </li>
    -->
    <!--<a href="/literate/src/Modulo.html">Literate source</a>-->
</ul>
</template>

<script>
    function _child(label, hash, keywords=[]) {
        if (!hash) {
            hash = label.toLowerCase()
        }
        return {label, hash, keywords};
    }
    let componentTexts;
    try {
        componentTexts = Modulo.factoryInstances['eg-eg'].baseRenderObj.script.exports.componentTexts;
    } catch {
        console.log('couldnt get componentTexts');
        componentTexts = {};
    }
    script.exports.menu = [
        {
            label: 'Table of Contents',
            filename: '/docs/',
        },

        {
            label: 'Tutorial',
            filename: '/docs/tutorial.html',
            children: [
                _child('Part 1: Components, CParts, Loaders', 'part1', ['cdn', 'module-embed']),
                _child('Part 2: Props and Templating', 'part2', ['cparts', 'props', 'basic templating']),
                _child('Part 3: State and Script', 'part3', ['state', 'basic scripting']),
            ],
        },

        {
            label: 'CParts',
            filename: '/docs/cparts.html',
            children: [
                _child('Component'),
                _child('Props'),
                _child('Template'),
                _child('State'),
                _child('Script'),
                _child('Style'),
                _child('Custom CParts API', 'custom'),
            ],
        },

        {
            label: 'Templating',
            filename: '/docs/templating.html',
            children: [
                _child('Templates', null, ['templating philosophy', 'templating overview']),
                _child('Variables', null, ['variable syntax', 'variable sources', 'cparts as variables']),
                _child('Filters', null, ['filter syntax', 'example filters']),
                _child('Tags', null, ['template-tag syntax', 'example use of templatetags']),
                _child('Comments', null, ['syntax', 'inline comments', 'block comments']),
                _child('Escaping', null, ['escaping HTML', 'safe filter', 'XSS injection protection']),
            ],
        },

        {
            label: 'Testing & Debugging',
            filename: '/docs/testing.html',
            children: [
                _child('Debugger'),
                _child('Test Suites'),
                _child('Test Setup'),
                _child('Assertions'),
            ],
        },
        {
            label: 'Lifecycle & Directives',
            filename: '/docs/directives.html',
            children: [
                _child('Lifecycle', 'lifecycle',
                    ['lifestyle phases', 'lifestyle phase groups',
                     'load', 'factory', 'prepare', 'initialized',
                     'render', 'update', 'updated',
                     'event', 'eventCleanup', 'hooking into lifecycle',
                     'lifecycle callbacks', 'script tag callbacks']),
                _child('renderObj', 'renderobj',
                    ['renderObj', 'baseRenderObj', 'loadObj',
                     'dependency injection', 'middleware']),
                _child('Directives', 'directives',
                    ['built-in directives', 'directive shortcuts',
                     'custom directives', 'refs', 'accessing dom',
                     'escape hatch', 'mount callback', 'unmount callback']),
                //_child('Built-in directives', 'builtin'),
            ],
        },

        {
            label: 'Template Reference',
            filename: '/docs/templating-reference.html',
            children: [
                _child('Built-in Filters', 'filters'),
                _child('Built-in Template Tags', 'tags'),
                _child('Custom Filters', 'customfilters'),
                _child('Custom Template Tags', 'customtags'),
            ],
        },

        {
            label: 'Example Library',
            filename: '/docs/example-library.html',
            children: Object.keys(componentTexts).map(name => _child(name)),
        },

        {
            label: 'Project Info',
            filename: '/docs/project-info.html',
            children: [
                _child('FAQ', 'faq'),
                _child('Framework Design Philosophy', 'philosophy'),
            ],
        },
    ];

    function initializedCallback() {
        const {isBackend, ssgCurrentOutputPath} = Modulo;
        let path = props.path;
        console.log('this is path', path);
        for (const groupObj of script.exports.menu) {
            if (props.showall) {
                groupObj.active = true;
            }
            if (groupObj.filename && path && groupObj.filename.endsWith(path)) {
                groupObj.active = true;
            }
        }
    }
</script>

<style>
  li {
      margin-left: 20px;
  }
  /*
  li.ginactive > ul::before,
  li.gactive > ul::before {
      content: ' - ';
      background: var(--highlight-color);
      color: white;
      text-decoration: none;
  }
  */
  li.ginactive > a::before {
      content: '+ ';
  }
</style>

</component>



<component name="CodeExample">
    <template>
        <div class="split">
            <div
            style="height: {{ props.vsize|number|default:170|add:2 }}px;"
            modulo-ignore>
                <textarea [script.codemirror]>
                </textarea>
            </div>

            <div>
                <div class="toolbar">
                    <h2>Preview</h2>
                    <button @click:=script.run>Run &#10227;</button>
                </div>
                <div [script.previewspot] class="preview-wrapper">
                    <div modulo-ignore></div>
                </div>
                {% if props.showtag %}
                    {% if props.preview %}
                        <div class="toolbar">
                            <h2>Tag</h2>
                            <code>{{ props.preview }}</code>
                        </div>
                    {% endif %}
                {% endif %}
            </div>
        </div>
    </template>

    <style>
        .toolbar {
            display: flex;
            justify-content: space-between;
        }
        .toolbar > button {
            border: 2px solid black;
            border-top-width: 1px;
            border-bottom-width: 3px;
            border-radius: 3px;
            background: white;
            font-weight: lighter;
            text-transform: uppercase;
        }
        .toolbar > button:active {
            border-top-width: 3px;
            border-bottom-width: 1px;
        }
        .toolbar > button:hover {
            box-shadow: 0 0 2px var(--highlight-color); /* extremely subtle shadow */
        }
        .split > div:last-child {
            padding: 5px;
            background: whiteSmoke;
        }
        .split > div:first-child{
            border: 1px solid black;
            /*overflow-y: scroll;*/
        }

        .preview-wrapper {
            margin-top: 4px;
            padding: 5px;
            padding-left: 20px;
            padding-right: 20px;
            border: 1px solid black;
        }

        .split > div > textarea {
            width: 100%;
            min-height: 10px;
        }
        .split {
            display: grid;
            grid-template-columns: 2fr 1fr;
        }
        @media (max-width: 992px) {
            .split { display: block; }
        }
    </style>

    <props
        text
        extraprops
        vsize
        textsrc
        cname
    ></props>

    <state 
        nscounter:=1
        preview=''
    ></state>
    <script>
        let egTexts = null;
        try {
            if ('eg-eg' in Modulo.factoryInstances) {
                egTexts = Modulo.factoryInstances['eg-eg']
                    .baseRenderObj.script.exports.componentTexts;
            }
        } catch {
            console.log('couldnt get egTexts');
        }

        let exCounter = 0; // global variable
        //console.log('gettin script tagged');
        /* Configure loader: */
        function initializedCallback() {
            //console.log('hey i am getting initialized wow');
            //console.log('initialized callback', element.innerHTML);
            if (Modulo.isBackend) {
                let html;
                if (egTexts && props.cname) {
                    Modulo.assert(props.cname in egTexts, \`\${props.cname} not found\`);
                    html = egTexts[props.cname];
                } else {
                    html = (element.innerHTML || '').trim();
                    html = html.replace(/([\\w\\[\\]\\._-]+):="(\\w+)"/, '\$1:=\$2'); // clean up due to DOM
                }

                if (props.textsrc) {
                    const html = Modulo.require('fs')
                        .readFileSync('./docs-src/' + props.textsrc, 'utf8');
                    element.setAttribute('text', html);
                } else if (html && !element.getAttribute('text')) {
                    element.setAttribute('text', html);
                }
            }
        }

        function previewspotMount({el}) {
            element.previewSpot = el.firstElementChild;
            run(); // mount after first render
        }

        function codemirrorMount({el}) {
            if (Modulo.globals.CodeMirror) {
                //console.log('this is props', props);
                // TODO: Debug this, should not use textarea, should not need
                // extra refreshes or anything
                const cm = CodeMirror.fromTextArea(el, {
                    lineNumbers: true,
                    mode: 'django',
                    theme: 'eclipse',
                    indentUnit: 4,
                });
                element.codeMirrorEditor = cm;
                window.cm = cm;

                const height = props.vsize ? Number(props.vsize) : 170;
                cm.setValue('');
                cm.setSize(null, height);
                cm.refresh();

                let text = props.text.trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                cm.setValue(text);
                setTimeout(() => {
                    cm.setValue(text);
                    cm.setSize(null, height);
                    cm.refresh();
                }, 1);
                el.setAttribute('modulo-ignore', 'y');
            } else {
                //console.log('Code mirror not found'); // probably SSG
            }
        }

        function run() {
            if (!Modulo.globals.CodeMirror) {
                return;
            }
            exCounter++;
            //console.log('There are ', exCounter, ' examples on this page. Gee!')
            const namespace = \`e\${exCounter}g\${state.nscounter}\`; // TODO: later do hot reloading using same loader
            state.nscounter++;
            const loadOpts = {src: '', namespace};
            const loader = new Modulo.Loader(null, {options: loadOpts});
            const tagName = 'Example';
            let text = element.codeMirrorEditor.getValue();
            text = \`<template mod-component="\${tagName}">\${text}</template>\`;
            //console.log('Creating component from text:', text)
            loader.loadString(text);
            const tag = \`\${namespace}-\${tagName}\`;
            let extraPropsStr = '';
            /*
            const extraProps =  props.extraprops ? JSON.parse(props.extraprops) : {};
            for (const [key, value] of Object.entries(extraProps)) {
                const escValue = value.replace(/"/g, , '&quot;');
                extraPropsStr += \` \${key}="\${escValue}"\`;
            }
            */

            const preview = \`<\${tag}\${extraPropsStr}></\${tag}>\`;
            element.previewSpot.innerHTML = preview;
            //state.preview = preview;
            //document.querySelector('#previewSpot').innerHTML = preview;
            //console.log('adding preview', preview);
        }
    </script>
</component>


`,// (ends: /components/modulowebsite.html) 

  "/components/examplelib.html": // (563 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        const myText = Modulo.fetchQ.data[factory.loader.src];
        const componentTexts = {};
        if (myText) {
            let name = '';
            let currentComponent = '';
            for (const line of myText.split('\\n')) {
                if (line.startsWith('</component>')) {
                    componentTexts[name] = currentComponent;
                    currentComponent = '';
                    name = null;
                } else if (line.startsWith('<component')) {
                    name = line.split(' name="')[1].split('"')[0];
                } else if (name) {
                    currentComponent += line + '\\n';
                }
            }
        }
        script.exports.componentTexts = componentTexts;
    </script>
</module>



<component name="Hello">

<template>
    <button @click:=script.countUp>Hello {{ state.num }}</button>
</template>
<state num:=42
></state>
<script>
    function countUp() {
        state.num++;
    }
</script>
</component>




<component name="Simple">

<template>
    Components can use <strong>any</strong> number
    of <em title="Component Parts">CParts</em>.
</template>
<style>
    em { color: darkblue; }
    * { text-decoration: underline; }
</style>
</component>




<component name="ToDo">
<template>
<ol>
    {% for item in state.list %}
        <li>{{ item }}</li>
    {% endfor %}
    <li>
        <input [state.bind] name="text" />
        <button @click:=script.addItem>Add</button>
    </li>
</ol>
</template>

<state
    list:=&#39;["Milk", "Bread", "Candy"]&#39;
    text="Beer"
></state>

<script>
    function addItem() {
        state.list.push(state.text); // add to list
        state.text = ""; // clear input
    }
</script>
</component>

<component name="API">
<template>
<p>{{ state.name }} | {{ state.location }}</p>
<p>{{ state.bio }}</p>
<a href="https://github.com/{{ state.search }}/" target="_blank">
    {% if state.search %}github.com/{{ state.search }}/{% endif %}
</a>
<input [state.bind] name="search"
    placeholder="Type GitHub username" />
<button @click:=script.fetchGitHub>Get Info</button>
</template>

<state
    search=""
    name=""
    location=""
    bio=""
></state>

<script>
    function fetchGitHub() {
        fetch(\`https://api.github.com/users/\${state.search}\`)
            .then(response => response.json())
            .then(githubCallback);
    }
    function githubCallback(apiData) {
        state.name = apiData.name;
        state.location = apiData.location;
        state.bio = apiData.bio;
        element.rerender();
    }
</script>
</component>





<component name="SearchBox">
<template>
<p>Start typing a book name to see "search as you type" (e.g. try &ldquo;the
lord of the rings&rdquo;)</p>

<input [state.bind] name="search" @keyup:=script.typingCallback />

<div class="results {% if state.search.length gt 0 %}visible{% endif %}">
    <div class="results-container">
        {% if state.loading %}
            <img style="margin-top: 30px"
                src="{{ script.exports.loadingGif  }}" alt="loading" />
        {% else %}
            {% for result in state.results %}
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/{{ result.cover_i }}-S.jpg" />
                    <label>{{ result.title }}</label>
                </div>
            {% empty %}
                <p>No books found.</p>
            {% endfor %}
        {% endif %}
    </div>
</div>
</template>

<state
    search=""
    results:=[]
    loading:=false
></state>

<script>
    // Because this variable is created "loose" in the script tag, it becomes a
    // static variable global to all instances of this class (though,
    // thankfully, not global in general -- it's still in an "IFFE")
    // (If we had wanted individual components to be debounced, we'd have
    // needed to attach it to state)
    let _globalDebounceTimeout = null;
    function _globalDebounce(func) {
        if (_globalDebounceTimeout) {
            clearTimeout(_globalDebounceTimeout);
        }
        _globalDebounceTimeout = setTimeout(func, 500);
    }

    function typingCallback() {
        state.loading = true;
        const apiBase = 'http://openlibrary.org/search.json'
        const search = \`q=\${state.search}\`;
        const opts = 'limit=6&fields=title,author_name,cover_i';
        const url = \`\${apiBase}?\${search}&\${opts}\`;
        _globalDebounce(() => {
            fetch(url)
                .then(response => response.json())
                .then(dataBackCallback);
        });
    }

    function dataBackCallback(data) {
        state.results = data.docs;
        state.loading = false;
        element.rerender();
    }

    // Puting this long URL down here to declutter
    script.exports.loadingGif = ('https://cdnjs.cloudflare.com/ajax/libs/' +
                                 'semantic-ui/0.16.1/images/loader-large.gif');
</script>

<style>
    SearchBox {
        position: relative;
        display: block;
        width: 300px;
    }
    input {
        padding: 8px;
        background: coral;
        color: white;
        width: 200px;
        border: none;
    }
    input::after {
        content: '\\1F50E';
    }
    .results-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }
    .results {
        position: absolute;
        height: 0;
        width: 0;
        overflow: hidden;
        display: block;
        border: 2px solid coral;
        border-radius: 0 0 20px 20px;
        transition: height 2s;
        z-index: 1;
        background: white;
    }
    .results.visible {
        height: 200px;
        width: 200px;
    }
    .result {
        padding: 10px;
        width: 80px;
        position: relative;
    }
    .result label {
        position: absolute;
        width: 80px;
        background: rgba(255, 255, 255, 0.5);
        font-size: 0.7rem;
        top: 0;
        left: 0;
    }
</style>


</component>






<component name="PrimeSieve">
<!-- Demos mouseover, template filters, template control flow,
     and static script exports -->
<template>
  <div class="grid">
    {% for i in script.exports.range %}
      <div @mouseover:=script.setNum
        class="
            {# If-statements to check divisibility in template: #}
            {% if state.number == i %}number{% endif %}
            {% if state.number lt i %}hidden{% else %}
              {% if state.number|divisibleby:i %}whole{% endif %}
            {% endif %}
        ">{{ i }}</div>
    {% endfor %}
  </div>
</template>

<state
    number:=64
></state>

<script>
    // Getting big a range of numbers in JS. Use "script.exports"
    // to export this as a one-time global constant.
    // (Hint: Curious how it calculates prime? See CSS!)
    script.exports.range = 
        Array.from({length: 63}, (x, i) => i + 2);
    function setNum(ev) {
        state.number = Number(ev.target.textContent);
    }
</script>

<style>
.grid {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    color: #ccc;
    font-weight: bold;
    width: 100%;
    margin: -5px;
}
.grid > div {
    border: 1px solid #ccc;
    cursor: crosshair;
    transition: 0.2s;
}
div.whole {
    color: white;
    background: #B90183;
}
div.hidden {
    background: #ccc;
    color: #ccc;
}

/* Color green and add asterisk */
div.number { background: green; }
div.number::after { content: "*"; }
/* Check for whole factors (an adjacent div.whole).
   If found, then hide asterisk and green. */
div.whole ~ div.number { background: #B90183; }
div.whole ~ div.number::after { opacity: 0; }
</style>
</component>





<component name="MemoryGame">
<!-- A much more complicated example application -->
<template>
{% if not state.cards.length %}
    <h3>The Symbolic Memory Game</h3>
    <p>Choose your difficulty:</p>
    <button @click:=script.setup click.payload=8>2x4</button>
    <button @click:=script.setup click.payload=16>4x4</button>
    <button @click:=script.setup click.payload=36>6x6</button>
{% else %}
    <div class="board
        {% if state.cards.length > 16 %}hard{% endif %}">
    {# Loop through each card in the "deck" (state.cards) #}
    {% for card in state.cards %}
        {# Using "key=" to speed up DOM reconciler #}
        <div key="c{{ card.id }}"
            class="card
            {% if state.revealed|includes:card.id %}
                flipped
            {% endif %}
            "
            style="
            {% if state.win %}
                animation: flipping 0.5s infinite alternate;
                animation-delay: {{ card.id }}.{{ card.id }}s;
            {% endif %}
            "
            @click:=script.flip
            click.payload="{{ card.id }}">
            {% if state.revealed|includes:card.id %}
                {{ card.symbol }}
            {% endif %}
        </div>
    {% endfor %}
    </div>
    <p style="{% if state.failedflip %}
                color: red{% endif %}">
        {{ state.message }}</p>
{% endif %}
</template>

<state
    message="Good luck!"
    win:=false
    cards:=[]
    revealed:=[]
    lastflipped:=null
    failedflip:=null
></state>

<script>
const symbolsStr = "%!@#=?&+~÷≠∑µ‰∂Δƒσ"; // 16 options
function setup(ev, payload) {
    const count = Number(payload);
    let symbols = symbolsStr.substr(0, count/2).split("");
    symbols = symbols.concat(symbols); // duplicate cards
    let id = 0;
    while (id < count) {
        const index = Math.floor(Math.random()
                                    * symbols.length);
        const symbol = symbols.splice(index, 1)[0];
        state.cards.push({symbol, id});
        id++;
    }
}

function failedFlipCallback(ev) {
    // Remove both from revealed array & set to null
    state.revealed = state.revealed.filter(
            id => id !== state.failedflip
                    && id !== state.lastflipped);
    state.failedflip = null;
    state.lastflipped = null;
    state.message = "";
    element.rerender();
}

function flip(ev, id) {
    if (state.failedflip !== null) {
        return;
    }
    id = Number(id);
    if (state.revealed.includes(id)) {
        return; // double click
    } else if (state.lastflipped === null) {
        state.lastflipped = id;
        state.revealed.push(id);
    } else {
        state.revealed.push(id);
        const {symbol} = state.cards[id];
        const lastCard = state.cards[state.lastflipped];
        if (symbol === lastCard.symbol) {
            // Successful match! Check for win.
            const {revealed, cards} = state;
            if (revealed.length === cards.length) {
                state.message = "You win!";
                state.win = true;
            } else {
                state.message = "Nice match!";
            }
            state.lastflipped = null;
        } else {
            state.message = "No match.";
            state.failedflip = id;
            setTimeout(failedFlipCallback, 1000);
        }
    }
}
</script>

<style>
h3 {
    background: #B90183;
    border-radius: 8px;
    text-align: center;
    color: white;
    font-weight: bold;
}
.board {
    display: grid;
    grid-template-rows: repeat(4, 1fr);
    grid-template-columns: repeat(4, 1fr);
    grid-gap: 2px;
    width: 100%;
    height: 150px;
    width: 150px;
}
.board.hard {
    grid-gap: 1px;
    grid-template-rows: repeat(6, 1fr);
    grid-template-columns: repeat(6, 1fr);
}
.board > .card {
    background: #B90183;
    border: 2px solid black;
    border-radius: 1px;
    cursor: pointer;
    text-align: center;
    min-height: 15px;
    transition: background 0.3s, transform 0.3s;
    transform: scaleX(-1);
    padding-top: 2px;
    color: #B90183;
}
.board.hard > .card {
    border: none !important;
    padding: 0;
}
.board > .card.flipped {
    background: #FFFFFF;
    border: 2px solid #B90183;
    transform: scaleX(1);
}

@keyframes flipping {
    from { transform: scaleX(-1.1); background: #B90183; }
    to {   transform: scaleX(1.0);  background: #FFFFFF; }
}
</style>
</component>










<component name="MiniExcel">
<!-- This example is unfinished, sorry! -->

<template>
    <table>
        {% for row in state.data %}
            <tr>
                {% for col in row %}
                    <td>{{ col }}</td>
                {% endfor %}
            </tr>
        {% endfor %}
    </table>
</template>

<state
    data:='[[""]]'
/><state>

<script>
    console.log('factory for miniexcel');
/*
    console.log('factory for miniexcel');
    function initalizedCallback(renderObj) {
        console.log('getting initialized', renderObj);
        state.data = [
            ['', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['', '', '', '', '', ''],
        ];
    }
*/
</script>

</component>














<component name="AccessingLoader">

<template>
    <button @button>Click me and look in Dev Console</strong>
</template>
<script>
    // console.log(module); // 
    function onClick() {
        // Examine this object. See how script tag exports
        // are actually already available? This allows for
        // cross-component dependencies.
        console.log('This is module:', module);
    }
</script>

</component>

<!-- idea: Conways game of life? -->

`,// (ends: /components/examplelib.html) 

  "/components/modulowebsite/demo.html": // (71 lines)
`<div class="demo-wrapper
        {% if state.showpreview %}     demo-wrapper__minipreview{% endif %}
        {% if state.showclipboard %}   demo-wrapper__clipboard  {% endif %}
        {% if state.fullscreen %}      demo-wrapper__fullscreen {% endif %}
        {% if state.tabs.length == 1 %}demo-wrapper__notabs     {% endif %}
    ">
    {% if state.tabs.length gt 1 %}
        <nav class="TabNav">
            <ul>
                {% for tab in state.tabs %}
                    <li class="TabNav-title
                        {% if tab.title == state.selected %}
                            TabNav-title--selected
                        {% endif %}
                    "><a @click:=script.selectTab
                            payload="{{ tab.title }}"
                        >{{ tab.title }}</a></li>
                {% endfor %}
            </ul>
        </nav>
    {% endif %}

    <div class="editor-toolbar">
        <p style="font-size: 11px; width: 120px; margin-right: 10px; text-align: right;
                    {% if not state.fullscreen %} display: none; {% endif %}">
            <em>Note: This is meant for exploring features. Your work will not be saved.</em>
        </p>

        {% if state.showclipboard %}
            <button class="m-Btn m-Btn--sm m-Btn--faded"
                    title="Copy this code" @click:=script.doCopy>
                Copy <span alt="Clipboard">&#128203;</span>
            </button>
        {% endif %}

        {% if state.showpreview %}
            <button class="m-Btn"
                    title="Toggle full screen view of code" @click:=script.doFullscreen>
                {% if state.fullscreen %}
                    <span alt="Shrink">↙</span>
                {% else %}
                    <span alt="Go Full Screen">⤧</span>
                {% endif %}
            </button>
            &nbsp;
            <button class="m-Btn"
                    title="Run a preview of this code" @click:=script.doRun>
                Run <span alt="Refresh">&#10227;</span>
            </button>
        {% endif %}

    </div>

    <div class="side-by-side-panes">
        <div class="editor-wrapper">
            <div modulo-ignore>
            </div>
        </div>

        {% if state.showpreview %}
            <div class="editor-minipreview">
                <div modulo-ignore>
                    {{ state.preview|safe }}
                </div>
            </div>
        {% endif %}

    </div>
</div>

`,// (ends: /components/modulowebsite/demo.html) 

  "/components/modulowebsite/demo.js": // (229 lines)
`let componentTexts = null;
let exCounter = 0; // global variable

try {
    componentTexts = Modulo.factoryInstances['eg-eg']
            .baseRenderObj.script.exports.componentTexts;
} catch {
    console.log('couldnt get componentTexts');
    componentTexts = null;
}

function codemirrorMount({el}) {
    console.log('attempting to moutn cm');
    const demoType = props.demotype || 'snippet';
    _setupCodemirror(el, demoType, element, state);
}

function _setupCodemirror(el, demoType, myElement, myState) {
    let expBackoff = 10;
    const mountCM = () => {
        // TODO: hack, allow JS deps or figure out loader or something
        if (!Modulo.globals.CodeMirror) {
            expBackoff *= 2;
            setTimeout(mountCM, expBackoff); // poll again
            return;
        }

        let readOnly = false;
        let lineNumbers = true;
        if (demoType === 'snippet') {
            readOnly = true;
            lineNumbers = false;
        }

        const conf = {
            value: myState.text,
            mode: 'django',
            theme: 'eclipse',
            indentUnit: 4,
            readOnly,
            lineNumbers,
        };

        if (demoType === 'snippet') {
            myState.showclipboard = true;
        } else if (demoType === 'minipreview') {
            myState.showpreview = true;
        }

        const cm = Modulo.globals.CodeMirror(el, conf);
        myElement.codeMirrorEditor = cm;
        cm.refresh()
        //myElement.rerender();
    };
    const {isBackend} = Modulo;
    if (!isBackend) {
        // TODO: Ugly hack, need better tools for working with legacy
        setTimeout(mountCM, expBackoff);
    }
}

function selectTab(ev, newTitle) {
    if (!element.codeMirrorEditor) {
        return; // not ready yet
    }
    const currentTitle = state.selected;
    state.selected = newTitle;
    for (const tab of state.tabs) {
        if (tab.title === currentTitle) { // save text back to state
            tab.text = element.codeMirrorEditor.getValue();
        } else if (tab.title === newTitle) {
            state.text = tab.text;
        }
    }
    element.codeMirrorEditor.setValue(state.text);
    doRun();
}

function doCopy() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (!mod || !mod.script || !mod.script.copyTextToClipboard) {
        console.log('no mod!');
    } else {
        mod.script.copyTextToClipboard(state.text);
    }
}

function initializedCallback({el}) {
    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            throw new Error('Couldnt load:', props.fromlibrary)
        }

        const componentNames = props.fromlibrary.split(',');
        for (const title of componentNames) {
            if (title in componentTexts) {
                text = componentTexts[title].trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                state.tabs.push({text, title});
            } else {
                throw new Error('invalid fromlibrary:', title)
            }
        }
    } else if (props.text) {
        text = props.text.trim();
        state.tabs.push({title: 'Example', text});
    }

    const demoType = props.demotype || 'snippet';
    if (demoType === 'snippet') {
        state.showclipboard = true;
    } else if (demoType === 'minipreview') {
        state.showpreview = true;
    }

    state.text = state.tabs[0].text; // load first

    state.selected = state.tabs[0].title; // set first as tab title
    setupShaChecksum();
    if (demoType === 'minipreview') {
        doRun();
    }

    const myElem = element;
    const myState = state;
    const {isBackend} = Modulo;
    if (!isBackend) {
        setTimeout(() => {
            const div = myElem.querySelector('.editor-wrapper > div');
            _setupCodemirror(div, demoType, myElem, myState);
        }, 0); // put on queue
    }
}

function setupShaChecksum() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (Modulo.isBackend && state && state.text.includes('\$modulojs_sha384_checksum\$')) {
        if (!mod || !mod.script || !mod.script.getVersionInfo) {
            console.log('no mod!');
        } else {
            const info = mod.script.getVersionInfo();
            const checksum = info.checksum || '';
            state.text = state.text.replace('\$modulojs_sha384_checksum\$', checksum)
            element.setAttribute('text', state.text);
        }
    }
}

function doRun() {
    exCounter++;
    //console.log('There are ', exCounter, ' examples on this page. Gee!')
    const namespace = \`e\${exCounter}g\${state.nscounter}\`; // TODO: later do hot reloading using same loader
    state.nscounter++;
    const loadOpts = {src: '', namespace};
    const tagName = 'Example';

    if (element.codeMirrorEditor) {
        state.text = element.codeMirrorEditor.getValue(); // make sure most up-to-date
    }
    let componentDef = state.text;
    componentDef = \`<component name="\${tagName}">\\n\${componentDef}\\n</component>\`;
    const loader = new Modulo.Loader(null, {options: loadOpts});
    loader.loadString(componentDef);
    const fullname = \`\${namespace}-\${tagName}\`;
    const factory = Modulo.factoryInstances[fullname];
    state.preview = \`<\${fullname}></\${fullname}>\`;

    // Hacky way to mount, required due to buggy dom resolver
    const {isBackend} = Modulo;
    if (!isBackend) {
        setTimeout(() => {
            const div = element.querySelector('.editor-minipreview > div');
            div.innerHTML = state.preview;
        }, 0);
    }
}

function countUp() {
    // TODO: Remove this when resolution context bug is fixed so that children
    // no longer can reference parents
    console.log('PROBLEM: Child event bubbling to parent!');
}

function doFullscreen() {
    document.body.scrollTop = document.documentElement.scrollTop = 0;
    if (state.fullscreen) {
        state.fullscreen = false;
        document.querySelector('html').style.overflow = "auto";
        if (element.codeMirrorEditor) {
            element.codeMirrorEditor.refresh()
        }
    } else {
        state.fullscreen = true;
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        // TODO: way to share variables in CSS
        if (vw > 768) {
              document.querySelector('html').style.overflow = "hidden";
              if (element.codeMirrorEditor) {
                  element.codeMirrorEditor.refresh()
              }
        }
    }
    if (element.codeMirrorEditor) {
        //element.codeMirrorEditor.refresh()
    }
}

/*
function previewspotMount({el}) {
    element.previewSpot = el;
    if (!element.isMounted) {
        doRun(); // mount after first render
    }
}
*/

/*
const component = factory.createTestElement();
component.remove()
console.log(component);
element.previewSpot.innerHTML = '';
element.previewSpot.appendChild(component);
*/

`,// (ends: /components/modulowebsite/demo.js) 

  "/components/modulowebsite/demo.css": // (260 lines)
`.demo-wrapper.demo-wrapper__minipreview .CodeMirror {
    height: 200px;
}

.demo-wrapper.demo-wrapper__clipboard .CodeMirror {
    height: auto;
}

.demo-wrapper.demo-wrapper__clipboard .CodeMirror * {
    font-family: monospace;
    font-size: 1rem;
}

.demo-wrapper.demo-wrapper__minipreview .CodeMirror * {
    font-family: monospace;
    font-size: 14px;
}

.demo-wrapper.demo-wrapper__fullscreen .CodeMirror {
    height: 87vh;
}
.demo-wrapper.demo-wrapper__fullscreen .CodeMirror * {
    font-family: monospace;
    font-size: 16px;
}

.demo-wrapper {
    position: relative;
    display: block;
    width: 100%;
}

.Main--fluid  .demo-wrapper.demo-wrapper__minipreview   {
    /* Make look better in Docs */
    max-width: 900px;
}

.demo-wrapper.demo-wrapper__fullscreen {
    position: absolute;
    display: block;
    width: 100vw;
    height: 100vh;
    z-index: 100;
    top: 0;
    left: 0;
    box-sizing: border-box;
    padding: 20px;
    background: white;
}

/* No tabs sitch: */
.demo-wrapper__notabs .editor-minipreview {
    margin-top: 40px;
    margin-left: 5px;
    border: 1px solid #999;
    height: 160px;
}

.demo-wrapper__fullscreen.demo-wrapper__notabs .editor-minipreview {
    margin-top: 65px;
}

.editor-toolbar {
    position: absolute;
    z-index: 3;
    display: flex;
    width: auto;
    /*right: -70px;*/
    right: 30px;
    top: 0;
    height: 35px;
    padding: 2px;
    border: #ddd 1px solid;
}



.demo-wrapper__fullscreen .editor-toolbar {
    height: 60px;
    padding: 10px;
}


.demo-wrapper__minipreview  .editor-wrapper {
    width: 78%;
    border: 1px solid black;
}
.Main--fluid  .demo-wrapper__minipreview  .editor-wrapper {
}

.demo-wrapper.demo-wrapper__clipboard .editor-wrapper {
    border: 1px dotted #ddd;
    width: 100%;
}

.demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {
    border: 5px solid black;
    border-radius: 1px 8px 1px 8px;
    border-bottom-width: 1px;
    border-right-width: 1px;
}

.editor-minipreview {
    border: 1px solid black;
    border-radius: 1px;
    background: #eee;
    padding: 5px;
    border-left: none;
    width: 200px;
    height: 200px;
    overflow-y: auto;
}

.demo-wrapper__fullscreen .editor-minipreview {
    width: 30vw;
    height: auto;
    border: 1px solid black;
    margin: 20px;
    padding: 30px;
    border: 5px solid black;
    border-radius: 1px 8px 1px 8px;
    border-bottom-width: 1px;
    border-right-width: 1px;
}

.side-by-side-panes {
    display: flex;
    justify-content: space-between;
}

.TabNav {
    /*border-bottom: 1px dotted var(--highlight-color);*/
    width: 100%;
}


.TabNav > ul {
    width: 100%;
    display: flex;
}

.TabNav-title {
    border: 2px solid black;
    border-top-width: 4px;
    /*border-bottom-width: 0;*/
    margin-bottom: -2px;
    border-radius: 8px 8px 0 0;
    background: white;
    min-width: 10%;
    box-shadow: 0 0 0 0 var(--highlight-color);
    transition: box-shadow 0.3s,
                border-color 0.2s;
}

.TabNav-title a,
.TabNav-title a:visited,
.TabNav-title a:active {
    text-decoration: none;
    color: black;
    display: block;
    padding: 5px;
    font-weight: bold;
    cursor: pointer;
    font-size: 1.1rem;
}

.TabNav-title:hover {
    border-color: var(--highlight-color);
}

.TabNav-title--selected {
    border-color: var(--highlight-color);
    background: var(--highlight-color);
    box-shadow: 0 0 0 8px var(--highlight-color);
    border-radius: 8px 8px 8px 8px;
}
.TabNav-title--selected a {
    color: white !important;
}


@media (max-width: 992px) {
    .TabNav > ul {
        flex-wrap: wrap;
        justify-content: flex-start;
    }
}
@media (max-width: 768px) {
    .TabNav-title {
        padding: 7px;
    }
}



@media (max-width: 768px) {
    .demo-wrapper.demo-wrapper__fullscreen {
        position: relative;
        display: block;
        width: 100vw;
        height: auto;
        z-index: 1;
    }
}


@media (max-width: 768px) {
    .editor-toolbar {
        position: static;
        padding: 10px;
        margin: 20px;
        height: 60px;
        font-size: 1.1rem;
    }
    .demo-wrapper__fullscreen .editor-toolbar {
        margin: 5px;
        height: 60px;
        padding: 5px;
        display: flex;
        justify-content: flex-end;
    }
}


@media (max-width: 768px) {
    .side-by-side-panes {
        display: block;
    }
}

@media (max-width: 768px) {
    .editor-minipreview {
        width: 100%;
    }
    .demo-wrapper__fullscreen .editor-minipreview {
        width: 90%;
    }
}


@media (min-width: 768px) {
    .demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {
        height: auto;
        width: 70vw;
        min-height: 87vh;
    }
}


@media (max-width: 768px) {
    .editor-wrapper {
        width: 100%;
        border: 1px solid black;
    }
    .demo-wrapper__fullscreen .editor-wrapper {
        width: 100%;
    }
}

`,// (ends: /components/modulowebsite/demo.css) 

};

//  Preloading page: "/components/layouts.html" 
Modulo.fetchQ.basePath = "/components/layouts.html";
Modulo.globalLoader.loadString(Modulo.fetchQ.data[Modulo.fetchQ.basePath]);
