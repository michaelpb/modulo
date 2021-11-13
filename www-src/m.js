// modulo build -lqiohl
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
    //Modulo.globals.customElements.define('mod-load', Modulo.DOMLoader);

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
    static loadCallback(node, loader) {
        // TODO refactor TEMPLATe etc to be
        // less hardcoded, more configured on a cpart basis
        const attrs = Modulo.utils.mergeAttrs(node);
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

        // TODO: "Namespace", should be "global-namespace"?
        // If loader.namespace = null, cause defaulting to hash.
        this.namespace = this.attrs.namespace;
        this.localNameMap = {};
        this.hash = 'zerohash'; // the hash of an unloaded loader
    }

    // factoryCallback() could be the new connectdCallback for <module><load>
    // syntax!
    doFetch(element, attrs) {
        Modulo.assert(this.src, 'Loader: Invalid src= attribute:', this.src);
        Modulo.assert(this.namespace, 'Loader: Invalid namespace= attribute:', this.namespace);

        // After initializing data, send a new request to the URL specified by
        // the src attribute. When the response is received, load the text as a
        // Modulo component module definition.
        Modulo.fetchQ.enqueue(this.src, text => this.loadString(text));
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
            const cpartClass = Modulo.cparts[cPartName]
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
        const {tagName, nodeType, textContent} = node;

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
        if (!(cPartName in Modulo.cparts)) {
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
        for (let [cPartName, data] of cPartOpts) {
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
        element.cparts = {element}; // Include "element", for lifecycle methods
        element.cpartSpares = {}; // no need to include, since only 1 element

        // It loops through the parsed array of objects that define the
        // Component Parts for this component, checking for errors.
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

        // TODO: This is actually the "biggest" try-catch. When I work on err
        // messages, this might be the spot (e.g. use other try-catches further
        // down, that annotate the Error with extra info that then gets nicely
        // formatted here).
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
            // TODO: Dead-ish feature: not Sure how useful this is, or if only
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

// TODO: Abstract away all cpart logic into CPartCollection which is "owned" by
// whichever CPart is the parent CPart. Element becomes a thin helper for
// Component.

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

    directiveMount(args) {
        // TODO: Add a check to ensure one of Mount, Unmount or Change exists
        args.element = this;
        this._invokeCPart(args.directiveName, 'Mount', args);
    }
    directiveUnmount(args) {
        args.element = this;
        this._invokeCPart(args.directiveName, 'Unmount', args);
    }
    directiveChange(args) {
        args.element = this;
        this._invokeCPart(args.directiveName, 'Change', args);
    }

    rerender() {
        // IDEA: Render-path micro-optimization idea:
        // - Push prebound func to list, to "pre-compute" render loop
        // - .rerender() thus is just looping through list of funcs running each
        this.lifecycle(['prepare', 'render', 'update', 'updated']);
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
        // HACK delete
        if (!this.isMounted) { // or is necessary?
            this.originalHTML = this.innerHTML;
            this.originalChildren = Array.from(this.hasChildNodes() ? this.childNodes : []);
            //console.log('getting original chidlren', this.originalHTML, this.originalChildren);
        }
        // HACK delete

        this.setupCParts();
        this.lifecycle(['initialized'])
        this.rerender();
        this.isMounted = true;
    }
}

Modulo.directiveShortcuts = [[/^@/, 'component.event'],
                             [/:$/, 'component.dataProp']];

                             // TODO delete this--v ? maybe not the best way?
Modulo.directiveUniques = { 'component.children': true }; // DEAD CODE - TODO: Autogenerate key from this?

Modulo.FactoryCPart = class FactoryCPart extends Modulo.ComponentPart {
    static childrenLoadedCallback(childrenLoadObj, loader, data) {
        //console.log('children loaded callback', childrenLoadObj);
        const partName = this.name.toLowerCase();
        let name = partName === 'module' ? loader.namespace : data.attrs.name;
        if (data.attrs.hackname) {
            name = data.attrs.hackname;
        }
        childrenLoadObj.push([partName, data]); // Add "myself" in as component data
        Modulo.fetchQ.wait(() => { // Wait for all dependencies to finish resolving
            const factory = new Modulo.ComponentFactory(loader, name, childrenLoadObj);
            factory.register();
        });
    }
}

Modulo.cparts.module = class Module extends Modulo.FactoryCPart { }

Modulo.cparts.component = class Component extends Modulo.FactoryCPart {
    initializedCallback(renderObj) {
        const { engine = 'ModRec' } = this.attrs;
        this.reconciler = new Modulo.reconcilers[engine]({ makePatchSet: true });
    }

    prepareCallback() {
        const { originalHTML } = this.element;
        return { originalHTML, innerHTML: null, patches: null };
    }

    updateCallback(renderObj) {
        let { innerHTML, patches } = renderObj.component;
        if (innerHTML !== null) {
            if (!this.reconciler) {
                // XXX (Delete this, only needed for SSG)
                const { engine = 'ModRec' } = this.attrs;
                this.reconciler = new Modulo.reconcilers[engine]({ makePatchSet: true });
            }
            const { localNameMap } = this.element.factory().loader;
            patches = this.reconciler.reconcile(this.element, innerHTML || '', localNameMap);
        }
        return { patches, innerHTML }; // TODO remove innerHTML from here
    }

    updatedCallback(renderObj) {
        const { patches, innerHTML } = renderObj.component;
        if (patches) {
            /*
            if (innerHTML.includes('class="TitleAside')) {
                // TODO: rm, this is for debugging "vanish" and "children" interactions
                console.log('-----------------------------')
                const s = 'const elementIH = `' +
                      this.element.innerHTML.replace(/`/g, '\`') + '`;\n' +
                      'const componentIH = `' +
                      innerHTML.replace(/`/g, '\`') + '`;\n';
                console.log(s);
                console.log('-----------------------------')
            }
            */
            this.reconciler.applyPatches(patches);
        }

        if (!this.element.isMounted) { // First time initialized
            const mode = this.attrs ? (this.attrs.mode || 'default') : 'default';
            if (mode === 'vanish' || mode === 'vanish-allow-script') {
                // TODO: switch with slightly cleaner "vanish-into-document"
                // which 1) looks for body, copies to body, then 2) looks for
                // head, copies to head
                if (mode === 'vanish-allow-script') {
                    for (const oldScr of this.element.querySelectorAll('script')) {
                        // TODO: should copy over all attributes, eg async
                        const newScript = Modulo.globals.document.createElement('script');
                        newScript.src = oldScr.src;
                        oldScr.remove(); // delete old element & move to head
                        Modulo.globals.document.head.appendChild(newScript);
                    }
                }

                this.element.replaceWith(...this.element.childNodes); // Delete self
            }
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

    childrenMount({el}) {
        // IDEA: Have value be querySelector, eg [component.children]="div"
        el.append(...this.element.originalChildren);
        //el.setAttribute('modulo-ignore', 'modulo-ignore');
    }

    childrenUnmount({el}) {
        el.innerHTML = '';
        //console.log('childrenUnmount!', el);
        //el.removeAttribute('modulo-ignore');
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

    eventUnmount({el, attrName}) {
        const listen = el.moduloEvents[attrName];
        el.removeEventListener(attrName, listen);
        delete el.moduloEvents[attrName];
    }

    dataPropMount({el, value, attrName, element}) {
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
    static factoryCallback({attrs}, {componentClass}, renderObj) {
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
        const {prefixAllSelectors} = Modulo.cparts.style;
        const {document} = Modulo.globals;
        const {loader, name, fullName} = factory;
        content = prefixAllSelectors(loader.namespace, name, content);
        const id = `${fullName}_style`;
        let elem = document.getElementById(id);
        if (!elem) {
            elem = document.createElement('style');
            elem.id = id;
            document.head.append(elem)
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
            obj[template.name || 'default'] = template;
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
        let output = 'var OUT=[];'; // Variable used to accumulate code
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
        // TODO:  Fix this, this is actually broken
        //'in': 'typeof Y[X] !== "undefined" || Y.indexOf && Y.indexOf(X) != -1',
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
            stack.push({close: `end${tTag}`, ...result});
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
    //stripcomments: s => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''),
    // {% for rowData in table %}
    //    {{ rowData|renderas:template.row }}
    // {% endfor %}
    // Idea: Generalized "matches" filter that gets registered like such:
    //     defaultOptions.filters.matches = {name: //ig}
    // Then we could configure "named" RegExps in Script that get used in
    // template

    const filters = {
        add: (s, arg) => s + arg,
        // color|allow:"red,blue"|default:"blue"
        allow: (s, arg) => arg.split(',').includes(s) ? s : '',
        capfirst: s => s.charAt(0).toUpperCase() + s.slice(1),
        concat: (s, arg) => s.concat ? s.concat(arg) : s + arg,
        default: (s, arg) => s || arg,
        divisibleby: (s, arg) => ((s * 1) % (arg * 1)) === 0,
        escapejs: s => JSON.stringify(String(s)).replace(/(^"|"$)/g, ''),
        first: s => s[0],
        join: (s, arg) => s.join(arg),
        json: (s, arg) => JSON.stringify(s, null, arg || undefined),
        last: s => s[s.length - 1],
        length: s => s.length,
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
        // TODO: for arbitrary expressions, loop here, don't limit to 3 (L/O/R)
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


        // TODO: New idea for how to refactor reconciler directives, and clean
        // up this mess, while allowing another level to "slice" into:
        //  - Then, implement [component.key] and [component.ignore]
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
        this.parentNodeQueue.push([parentNode, parentRival]);
    }

    popDescent() {
        // DEADCODE
        if (this.parentNodeQueue.length < 1) {
            return false;
        }
        const result = this.parentNodeQueue.shift();
        console.log('this is reuslt', result);
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
        if (!this.nextChild && !this.nextRival) {
            if (!this.keyedRivalsArr) {
                return [null, null];
            }
            return this.keyedRivalsArr.length ?
                  [null, this.keyedRivalsArr.pop()] :
                  [this.keyedChildrenArr.pop(), null];
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
        // Discontinue this?
        this.shouldNotApplyPatches = opts && opts.makePatchSet;
        this.shouldNotDescend = opts && opts.doNotDescend;
        this.elementCtx = opts ? opts.elementCtx : undefined;
    }

    reconcile(node, rivalHTML, tagTransforms) {
        // Note: Always attempts to reconcile (even on first mount), in case
        // it's been pre-rendered
        // TODO: should normalize <!DOCTYPE html>
        this.patches = [];
        if (!this.elementCtx) {
            this.elementCtx = node; // element context
        }
        const rival = Modulo.utils.makeDiv(rivalHTML, true);
        this.applyTagTransforms(rival, tagTransforms);
        this.markRecDirectives(rival);
        this.reconcileChildren(node, rival);
        this.cleanRecDirectiveMarks(node);
        if (!this.shouldNotApplyPatches) {
            this.applyPatches(this.patches);
        }
        return this.patches;
    }

    applyTagTransforms(elem, tagTransforms) {
        const sel = Object.keys(tagTransforms || { X: 0 }).join(',');
        for (const node of elem.querySelectorAll(sel)) {
            const newTag = tagTransforms[node.tagName.toLowerCase()];
            if (newTag) {
                Modulo.utils.transformTag(node, newTag);
            }
        }
    }

    markRecDirectives(elem) {
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
                //cursor.pushDescent(child, rival);
                this.reconcileChildren(child, rival);
            }
        }
    }

    patch(node, method, arg, arg2 = null) {
        this.patches.push([node, method, arg, arg2]);
    }

    applyPatch(node, method, arg, arg2) { // take that, rule of 3!
        if (method === 'node-value') {
            node.nodeValue = arg;
        } else if (method === 'insertBefore') {
            node.insertBefore(arg, arg2); // Needs 2 arguments
        } else {
            node[method].call(node, arg); // invoke method
        }
    }

    patchDirectives(el, rawName, suffix) {
        const callbackName = 'directive' + suffix;
        const directives = Modulo.utils.parseDirectives(rawName);
        if (directives) {
            const value = el.getAttribute(rawName);
            for (const directive of directives) {
                Object.assign(directive, { value, el,  callbackName});
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
        let nodes = [parentNode]; // also, patch self (but last)
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

    static mergeAttrs(elem) {
        const {parseAttrs} = Modulo.utils;
        return Object.assign(parseAttrs(elem), elem.dataProps || {});
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

    static parseDirectives(rawName) {
        if (/^[a-z0-9-]$/i.test(rawName)) {
            return null; // if alpha-only, stop right away
        }

        // "Expand" shortcuts into their full versions
        let name = rawName;
        for (const [regexp, directive] of Modulo.directiveShortcuts) {
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
            if (directiveName !== attrName) { // Skip the bare name itself
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
;

Modulo.defineAll();
Modulo.fetchQ.data = {
  "/components/layouts.html": // (125 lines)
`<load src="./examplelib.html" namespace="eg"></load>
<load src="./embeddedexampleslib.html" namespace="docseg"></load>

<!-- NOTE: Need to put modulowebsite.html last due to peer dependencies with
     above -->
<load src="./modulowebsite.html" namespace="mws"></load>


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
            // Only do once to speed up SSG
            //console.log('this is Modulo', Object.keys(Modulo));
            if (!Modulo.isBackend) {
                return;
            }
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

<component name="Page" mode="vanish-allow-script">
    <props
        navbar
        docbarselected 
        pagetitle
    ></props>

    <template src="./layouts/base.html"></template>

    <script>
        function initializedCallback() {
            console.log('this is module', module);
            if (Modulo.isBackend && module) {
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

`,// (ends: /components/layouts.html) 

  "/components/examplelib.html": // (622 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        const mySrc = '/components/examplelib.html';
        const myText = Modulo.fetchQ.data[mySrc];
        const componentTexts = {};
        if (myText) {
            let name = '';
            let currentComponent = '';
            let inTestSuite = false;
            for (const line of myText.split('\\n')) {
                if (line.startsWith('</component>')) {
                    componentTexts[name] = currentComponent;
                    currentComponent = '';
                    name = null;
                } else if (line.startsWith('<component')) {
                    name = line.split(' name="')[1].split('"')[0];
                } else if (line.startsWith('<testsuite')) {
                    inTestSuite = true;
                } else if (line.includes('</testsuite>')) {
                    inTestSuite = false;
                } else if (name && !inTestSuite) {
                    currentComponent += line + '\\n';
                }
            }
        }
        script.exports.componentTexts = componentTexts;
    </script>
</module>

<!--
/*} else if (sName === 'style') {
    console.log('this is content', data.content);
    const content = data.content.replace(/\\*\\/.*?\\*\\//ig, '');
    // To prefix the selectors, we loop through them,
    // with this RegExp that looks for { chars
    content.replace(/([^\\r\\n,{}]+)(,(?=[^}]*{)|\\s*{)/gi, (selector, data) => {
        console.log('selector', selector);
        console.log('data', data);
    });*/
-->

<component name="Hello">

<template>
    <button @click:=script.countUp>Hello {{ state.num }}</button>
</template>
<state
    num:=42
></state>
<script>
    function countUp() {
        state.num++;
    }
</script>

<testsuite
    src="./examplelib-tests/Hello-tests.html"
></testsuite>

</component>




<component name="Simple">

<template>
    Components can use any number of <strong>CParts</strong>.
    Here we use only <em>Style</em> and <em>Template</em>.
</template>

<style>
    em { color: darkgreen; }
    * { text-decoration: underline; }
</style>

<testsuite>
    <test name="Initially renders">
        <template>
            Components can use any number of <strong>CParts</strong>.
            Here we use only <em>Style</em> and <em>Template</em>.
        </template>
    </test>
</testsuite>

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
    list:='["Milk", "Bread", "Candy"]'
    text="Beer"
></state>

<script>
    function addItem() {
        state.list.push(state.text); // add to list
        state.text = ""; // clear input
    }
</script>

<testsuite
    src="./examplelib-tests/ToDo-tests.html"
></testsuite>

</component>

<!--list:=&#39;["Milk", "Bread", "Candy"]&#39;-->


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

<testsuite
    src="./examplelib-tests/API-tests.html"
></testsuite>

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
    // needed to attach it to state in the initializedCallback)
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

<testsuite
    src="./examplelib-tests/SearchBox-tests.html"
></testsuite>

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
    function setNum(payload, ev) {
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
   If found, then hide asterisk and green */
div.whole ~ div.number { background: #B90183; }
div.whole ~ div.number::after { opacity: 0; }
</style>

<testsuite
    src="./examplelib-tests/PrimeSieve-tests.html"
></testsuite>

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
        {# Use "key=" to speed up DOM reconciler #}
        <div key="c{{ card.id }}"
            class="card
            {% if card.id in state.revealed %}
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
            {% if card.id in state.revealed %}
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
function setup(payload) {
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

function failedFlipCallback() {
    // Remove both from revealed array & set to null
    state.revealed = state.revealed.filter(
            id => id !== state.failedflip
                    && id !== state.lastflipped);
    state.failedflip = null;
    state.lastflipped = null;
    state.message = "";
    element.rerender();
}

function flip(id) {
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

<testsuite
    src="./examplelib-tests/MemoryGame-tests.html"
></testsuite>

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

  "/components/embeddedexampleslib.html": // (369 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        let myText = Modulo.fetchQ.data['/components/embeddedexampleslib.html'];
        //console.log('this si keys', Object.keys(Modulo.fetchQ.data));
        //console.log('this si myText', myText);
        const componentTexts = {};
        if (!myText) {
            console.error('ERROR: Could not load own text :(');
            myText = '';
        }
        let name = '';
        let currentComponent = '';
        let inTestSuite = false;
        for (const line of myText.split('\\n')) {
            if (line.startsWith('</component>')) {
                componentTexts[name] = currentComponent;
                currentComponent = '';
                name = null;
            } else if (line.startsWith('<component')) {
                name = line.split(' name="')[1].split('"')[0];
            } else if (line.startsWith('<testsuite')) {
                inTestSuite = true;
            } else if (line.includes('</testsuite>')) {
                inTestSuite = false;
            } else if (name && !inTestSuite) {
                currentComponent += line + '\\n';
            }
        }
        script.exports.componentTexts = componentTexts;
    </script>
</module>



<component name="Templating_1">
<template>
<p>There are <em>{{ state.count }}
  {{ state.count|pluralize:"articles,article" }}</em>
  on {{ script.exports.title }}.</p>

{# Show the articles #}
{% for article in state.articles %}
    <h4 style="color: blue">{{ article.headline|upper }}</h4>
    {% if article.tease %}
      <p>{{ article.tease|truncate:30 }}</p>
    {% endif %}
{% endfor %}
</template>

<!-- The data below was used to render the template above -->
<state
    count:=42
    articles:='[
      {"headline": "Modulo released!",
       "tease": "The most exciting news of the century."},
      {"headline": "Can JS be fun again?"},
      {"headline": "MTL considered harmful",
       "tease": "Why constructing JS is risky business."}
    ]'
></state>
<script>
    script.exports.title = "ModuloNews";
</script>

<testsuite
    src="./examplelib-tests/Templating_1-tests.html"
></testsuite>

</component>



<component name="Templating_Comments">
<template>
    <h1>hello {# greeting #}</h1>
    {% comment %}
      {% if a %}<div>{{ b }}</div>{% endif %}
      <h3>{{ state.items|first }}</h3>
    {% endcomment %}
    <p>Below the greeting...</p>
</template>

<testsuite>
    <test name="Hides comments">
        <template>
            <h1>hello </h1>
            <p>Below the greeting...</p>
        </template>
    </test>
</testsuite>

</component>



<component name="Templating_Escaping">
<template>
<p>User "<em>{{ state.username }}</em>" sent a message:</p>
<div class="msgcontent">
    {{ state.content|safe }}
</div>
</template>

<state
    username="Little <Bobby> <Drop> &tables"
    content='
        I <i>love</i> the classic <a target="_blank"
        href="https://xkcd.com/327/">xkcd #327</a> on
        the risk of trusting <b>user inputted data</b>
    '
></state>
<style>
    .msgcontent {
        background: #999;
        padding: 10px;
        margin: 10px;
    }
</style>

<testsuite>
    <test name="Escapes HTML, safe works">
        <template>
            <p>User "<em>Little &lt;Bobby&gt; &lt;Drop&gt;
            &amp;tables</em>" sent a message:</p>
            <div class="msgcontent"> I <i>love</i> the classic <a
            target="_blank" href="https://xkcd.com/327/">xkcd #327</a> on
            the risk of trusting <b>user inputted data</b></div>
        </template>
    </test>
</testsuite>

</component>



<component name="Tutorial_P1">
<template>
Hello <strong>Modulo</strong> World!
<p class="neat">Any HTML can be here!</p>
</template>
<style>
/* ...and any CSS here! */
strong {
    color: blue;
}
.neat {
    font-variant: small-caps;
}
:host { /* styles the entire component */
    display: inline-block;
    background-color: cornsilk;
    padding: 5px;
    box-shadow: 10px 10px 0 0 turquoise;
}
</style>

<testsuite>
    <test name="renders as expected">
        <template>
            Hello <strong>Modulo</strong> World!
            <p class="neat">Any HTML can be here!</p>
        </template>
    </test>
</testsuite>


</component>


<component name="Tutorial_P2">
<template>
    <p>Trying out the button...</p>
    <x-ExampleBtn
        label="Button Example"
        shape="square"
    ></x-ExampleBtn>

    <p>Another button...</p>
    <x-ExampleBtn
        label="Example 2: Rounded"
        shape="round"
    ></x-ExampleBtn>
</template>

<testsuite>
    <test name="renders as expected">
        <template string-count=1>
            <p>Trying out the button...</p>
        </template>
        <!-- Unfortunately can't test the following... -->
        <!--
        <template>
            <button class="my-btn my-btn__square">
                Button Example
            </button>
        </template>
        <template>
            <button class="my-btn my-btn__round">
                Rounded is Great Too
            </button>
        </template>
        -->
    </test>
</testsuite>
</component>


<component name="Tutorial_P2_filters_demo">
<template>
    <p>Trying out the button...</p>
    <x-ExampleBtn
        label="Button Example"
        shape="square"
    ></x-ExampleBtn>

    <p>Another button...</p>
    <x-ExampleBtn
        label="Example 2: Rounded"
        shape="round"
    ></x-ExampleBtn>
</template>

<testsuite>
    <test name="renders as expected">
        <template string-count=1>
            <p>Trying out the button...</p>
        </template>
    </test>
</testsuite>


</component>



<!-- ................................ -->
<!-- . Tutorial - Part 3 ............ -->
<!-- ................................ -->

<component name="Tutorial_P3_state_demo">
<template>
<p>Nonsense poem:</p> <pre>
Professor {{ state.verb|capfirst }} who
{{ state.verb }}ed a {{ state.noun }},
taught {{ state.verb }}ing in
the City of {{ state.noun|capfirst }},
to {{ state.count }} {{ state.noun }}s.
</pre>
</template>

<state
    verb="toot"
    noun="kazoo"
    count="two"
></state>

<style>
    :host {
        font-size: 0.8rem;
    }
</style>

<testsuite>
    <test>
        <template>
            <p>Nonsense poem:</p>
            <pre>Professor Toot who tooted a kazoo, taught tooting in the City
            of Kazoo, to two kazoos. </pre>
        </template>
    </test>
</testsuite>

</component>


<component name="Tutorial_P3_state_bind">
<template>

<div>
    <label>Username:
        <input [state.bind] name="username" /></label>
    <label>Color ("green" or "blue"):
        <input [state.bind] name="color" /></label>
    <label>Opacity: <input [state.bind]
        name="opacity"
        type="number" min="0" max="1" step="0.1" /></label>

    <h5 style="
            opacity: {{ state.opacity }};
            color: {{ state.color|allow:'green,blue'|default:'red' }};
        ">
        {{ state.username|lower }}
    </h5>
</div>

</template>

<state
    opacity="0.5"
    color="blue"
    username="Testing_Username"
></state>

<testsuite
    src="./examplelib-tests/Tutorial_P3_state_bind-tests.html"
></testsuite>

</component>






<!-- ++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->
<!-- ++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->

<!-- The remaining components are only being used for adding more tests for
examples to the Modulo framework, not as a examples themselves -->
<!-- TODO: Remove, and move to tests/ -->
<component name="TestBtn">
    <props
        myclicky
        mytexty
    ></props>
    <template>
        <button @click:=props.myclicky>{{ props.mytexty }}</button>
    </template>
</component>

<component name="CompositionTests">
<props b></props>
<template name="comptest2">
    <x-TestBtn
        mytexty="Test text"
        myclicky:=script.gotClickies
    >should be IGNORED</x-TestBtn>
    <p>state.a: {{ state.a }}</p>
</template>

<template name="comptest1">
    Testing
    <x-Tutorial_P1></x-Tutorial_P1>
    <x-Templating_Escaping></x-Templating_Escaping>
</template>


<!-- just add some random stuff here -->
<state
    a:=1
></state>

<script>
    function gotClickies() {
        state.a = 1337;
    }
</script>

<testsuite
    skip
    src="./examplelib-tests/CompositionTests-tests.html"
></testsuite>

</component>



`,// (ends: /components/embeddedexampleslib.html) 

  "/components/modulowebsite.html": // (485 lines)
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
        <h2>{{ component.originalHTML|safe }}</h2>
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
    <!-- TODO: Refactor the following to take variable length props instead of 2, 3, etc-->
    <props
        text
        text2
        text3
        ttitle
        ttitle2
        ttitle3
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
    {% for linkGroup in state.menu %}
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
                          href="{% if childLink.filepath %}{{ childLink.filepath }}{% else %}{{ linkGroup.filename }}#{{ childLink.hash }}{% endif %}"
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

<state
  menu
></state>

<script>
    function _child(label, hash, keywords=[], filepath=null) {
        if (!hash) {
            hash = label.toLowerCase()
        }
        if (hash.endsWith('.html') && filepath === null) {
            filepath = hash;
        }
        return {label, hash, keywords, filepath};
    }
    let componentTexts;
    try {
        //console.log('this is', Object.keys(Modulo.factoryInstances));
        //console.log('this is', Modulo.factoryInstances);
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
            filename: '/docs/tutorial_part1.html',
            children: [
                _child('Part 1: Components, CParts, and Loading', '/docs/tutorial_part1.html', ['cdn', 'module-embed', 'components', 'cparts', 'template', 'style', 'html & css']),
                _child('Part 2: Props, Templating, and Building', '/docs/tutorial_part2.html', ['props', 'template variables', 'template filters', 'modulo console command', 'build', 'hash']),
                _child('Part 3: State, Directives, and Scripting', '/docs/tutorial_part3.html', ['state', 'directives', 'data props', 'state.bind', 'data types', 'events', 'basic scripting']),
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
                _child('Built-in Template Tags', 'tags'),
                _child('Built-in Filters', 'filters'),
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
        const { path, showall } = props;
        state.menu = script.exports.menu.map(o => Object.assign({}, o)); // dupe
        for (const groupObj of state.menu) {
            if (showall) {
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

  "/components/layouts/base.html": // (69 lines)
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
    <!--
    <mod-load src="/components/modulowebsite.html" namespace="mws"></mod-load>
    <mod-load src="/components/examplelib.html" namespace="eg"></mod-load>
    <mod-load src="/components/embeddedexampleslib.html" namespace="docseg"></mod-load>
    -->
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
        <aside style="border: none">
            {{ component.originalHTML|safe }}
        </aside>
    </main>
{% else %}
    <main class="Main">
        {{ component.originalHTML|safe }}
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

  "/components/examplelib-tests/Hello-tests.html": // (42 lines)
`<test name="Renders with different numbers">
    <script name="Ensure state is initialized">
        assert: state.num === 42
    </script>

    <template name="Ensure initial render is correct">
        <button @click:="script.countUp">Hello 42</button>
    </template>

    <state num:=100></state>
    <template name="Ensure modifying state shows new content">
        <button @click:="script.countUp">Hello 100</button>
    </template>

    <script name="Ensure count up function increments">
        script.countUp();
        assert: state.num === 101
    </script>

    <template name="Ensure re-render">
        <button @click:="script.countUp">Hello 101</button>
    </template>

    <script name="Ensure click calls count up">
        element.querySelector('button').click()
        assert: state.num === 102
    </script>

    <template name="Ensure re-render 2">
        <button @click:="script.countUp">Hello 102</button>
    </template>

    <script name="Ensure 2nd click still works (using event: macro)">
        event: click button
    </script>

    <template name="Ensure re-render 3">
        <button @click:="script.countUp">Hello 103</button>
    </template>
</test>

`,// (ends: /components/examplelib-tests/Hello-tests.html) 

  "/components/examplelib-tests/ToDo-tests.html": // (29 lines)
`<test name="Basic functionality">

    <template name="Ensure initial render is correct" test-values>
        <ol>
            <li>Milk</li><li>Bread</li><li>Candy</li>
            <li>
                <input [state.bind] name="text" value="Beer" />
                <button @click:="script.addItem">Add</button>
            </li>
        </ol>
    </template>

    <script>
        event: click button
        assert: state.list.length === 4
    </script>

    <template name="Ensure render after adding is fine" test-values>
        <ol>
            <li>Milk</li><li>Bread</li><li>Candy</li><li>Beer</li>
            <li>
                <input [state.bind] name="text" value="" />
                <button @click:="script.addItem">Add</button>
            </li>
        </ol>
    </template>
</test>

`,// (ends: /components/examplelib-tests/ToDo-tests.html) 

  "/components/examplelib-tests/API-tests.html": // (43 lines)
`<test name="renders with search data">

    <template name="Ensure initial render is correct">
        <p> | </p>
        <p></p>
        <a href="https://github.com//" target="_blank"></a>
        <input [state.bind] name="search"
            placeholder="Type GitHub username" />
        <button @click:="script.fetchGitHub">Get Info</button>
    </template>

    <state search="michaelpb"></state>
    <template name="Ensure state from search box renders" test-values>
        <p> | </p>
        <p></p>
        <a href="https://github.com/michaelpb/" target="_blank">
          github.com/michaelpb/
        </a>
        <input [state.bind] name="search" value="michaelpb"
            placeholder="Type GitHub username" />
        <button @click:=script.fetchGitHub>Get Info</button>
    </template>

    <script>
        const name = 'a b c'
        const location = 'd e f'
        const bio = 'h i j'
        script.githubCallback({name, location, bio})
    </script>
    <template name="Ensure callback shows data in expected spots" test-values>
        <p>a b c | d e f</p>
        <p>h i j</p>
        <a href="https://github.com/michaelpb/" target="_blank">
          github.com/michaelpb/
        </a>
        <input [state.bind] name="search" value="michaelpb"
            placeholder="Type GitHub username" />
        <button @click:=script.fetchGitHub>Get Info</button>
    </template>

</test>

`,// (ends: /components/examplelib-tests/API-tests.html) 

  "/components/examplelib-tests/SearchBox-tests.html": // (119 lines)
`<test name="Renders based on state">
    <template name="Ensure initial render is correct" test-values>
        <p>Start typing a book name to see "search as you type"
        (e.g. try “the lord of the rings”)</p>
        <input
            [state.bind]
            name="search"
            value=""
            @keyup:=script.typingCallback />
        <div class="results ">
            <div class="results-container">
                <p>No books found.</p>
            </div>
        </div>
    </template>
    <state
        search="the lord of the rings"
        loading:=true
    ></state>

    <template name="Shows loading when typing" test-values>
        <p>Start typing a book name to see "search as you type"
        (e.g. try “the lord of the rings”)</p>
        <input
            [state.bind]
            name="search"
            value="the lord of the rings"
            @keyup:=script.typingCallback />
        <div class="results visible">
            <div class="results-container">
                <img style="margin-top: 30px"
                    src="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/0.16.1/images/loader-large.gif"
                    alt="loading" />
            </div>
        </div>
    </template>

    <script name="load test data">
        const fakeApiData ={
            "numFound": 487,
            "start": 0,
            "numFoundExact": true,
            "docs": [
                {
                    "title": "The Lord of the Rings",
                    "cover_i": 9255566,
                    "author_name": [ "J.R.R. Tolkien" ]
                },
                {
                    "title": "The Fellowship of the Ring",
                    "cover_i": 8474036,
                    "author_name": [ "J.R.R. Tolkien" ]
                },
                {
                    "title": "The Lord of the Rings Trilogy (Lord of the Rings)",
                    "cover_i": 528867
                },
                {
                    "title": "Lord of the Rings",
                    "cover_i": 1454705,
                    "author_name": [ "Cedco Publishing" ]
                },
                {
                    "title": "Lord of the Rings",
                    "cover_i": 2111453,
                    "author_name": [ "Ernest Mathijs" ]
                },
                {
                    "title": "Lords of the ring",
                    "author_name": [ "Harry Lansdown", "Alex Spillius" ]
                }
            ],
            "num_found": 487,
            "q": "the lord of the rings",
            "offset": null
        }
        script.dataBackCallback(fakeApiData)
    </script>

    <script name="ensure no longer loading">
        assert: state.loading === false
    </script>

    <template name="ensure rerender is as expected">
        <p>Start typing a book name to see "search as you type" (e.g. try “the lord of the rings”)</p>
        <input [state.bind]="" name="search" @keyup:="script.typingCallback">
        <div class="results visible">
            <div class="results-container">
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/9255566-S.jpg">
                    <label>The Lord of the Rings</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/8474036-S.jpg">
                    <label>The Fellowship of the Ring</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/528867-S.jpg">
                    <label>The Lord of the Rings Trilogy (Lord of the Rings)</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/1454705-S.jpg">
                    <label>Lord of the Rings</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/2111453-S.jpg">
                    <label>Lord of the Rings</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/undefined-S.jpg">
                    <label>Lords of the ring</label>
                </div>
            </div>
        </div>
    </template>
</test>


`,// (ends: /components/examplelib-tests/SearchBox-tests.html) 

  "/components/examplelib-tests/PrimeSieve-tests.html": // (37 lines)
`<test name="renders with search data">
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" whole ">2</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" number whole ">64</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" ">3</div>
    </template>

    <script>
        // 20 is effectively 21 (since starts at 2)
        event: mouseover div:nth-child(20)
    </script>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" whole ">3</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" whole ">7</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" number whole ">21</div>
    </template>

    <script>
        // 46 is effectively 47 (since starts at 2)
        event: mouseover div:nth-child(46)
    </script>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" number whole ">47</div>
    </template>

    <template name="Ensure only one whole number (since prime)"
        string-count=1>whole</template>
</test>
`,// (ends: /components/examplelib-tests/PrimeSieve-tests.html) 

  "/components/examplelib-tests/MemoryGame-tests.html": // (152 lines)
`<test name="starts a game">
    <template name="Ensure initial render is correct">
        <h3>The Symbolic Memory Game</h3>
        <p>Choose your difficulty:</p>
        <button @click:=script.setup click.payload=8>2x4</button>
        <button @click:=script.setup click.payload=16>4x4</button>
        <button @click:=script.setup click.payload=36>6x6</button>
    </template>

    <!-- Ensure starting conditions are as expected -->
    <script> assert: state.cards.length === 0 </script>
    <script> assert: state.revealed.length === 0 </script>
    <script> assert: state.message === "Good luck!" </script>
    <script> assert: state.win === false </script>
    <script> assert: state.lastflipped === null </script>

    <script name="Click the first button">
        event: click button:first-of-type
    </script>

    <script name="Ensure the state consists of expected symbols (sort to ignore order)">
        const symbols = state.cards.map(({symbol}) => symbol);
        symbols.sort();
        const expected = ["!", "!", "#", "#", "%", "%", "@", "@"];
        assert: JSON.stringify(symbols) === JSON.stringify(expected);
    </script>

    <script name="Ensure the state consists of expected IDs (sort to ignore order)">
        const ids = state.cards.map(({id}) => id);
        ids.sort();
        const expected = [0, 1, 2, 3, 4, 5, 6, 7];
        assert: JSON.stringify(ids) === JSON.stringify(expected);
    </script>

    <template name="Check tiles" string-count=8>
          class="card "
          style=" "
          @click:="script.flip"
    </template>
</test>

<test name="renders board and handles flips">
    <state
        message="Good luck!"
        cards:='[
          {"id": 0, "symbol": "A"},
          {"id": 1, "symbol": "A"},
          {"id": 2, "symbol": "B"},
          {"id": 3, "symbol": "B"},
          {"id": 4, "symbol": "C"},
          {"id": 5, "symbol": "C"},
          {"id": 6, "symbol": "D"},
          {"id": 7, "symbol": "D"}
        ]'
        revealed:='[]'
        lastflipped:=null
        failedflip:=null
    ></state>
    <template name="Ensure board render is correct">
        <div class="board ">
            <div key="c0" class="card " style=" " @click:="script.flip" click.payload="0"></div>
            <div key="c1" class="card " style=" " @click:="script.flip" click.payload="1"></div>
            <div key="c2" class="card " style=" " @click:="script.flip" click.payload="2"></div>
            <div key="c3" class="card " style=" " @click:="script.flip" click.payload="3"></div>
            <div key="c4" class="card " style=" " @click:="script.flip" click.payload="4"></div>
            <div key="c5" class="card " style=" " @click:="script.flip" click.payload="5"></div>
            <div key="c6" class="card " style=" " @click:="script.flip" click.payload="6"></div>
            <div key="c7" class="card " style=" " @click:="script.flip" click.payload="7"></div>
        </div>
        <p style=""> Good luck!</p>
    </template>

    <script>
      event: click div.card:nth-of-type(1)
    </script>

    <template name="Check that first tile was revealed" string-count=1>
        <div key="c0"
            class="card flipped "
            style=" "
            @click:=script.flip
            click.payload="0"> A </div>
    </template>

    <template name="Check that 7 other tiles are not revealed" string-count=7>
          class="card "
          style=" "
          @click:="script.flip"
    </template>
    <script> assert: state.revealed.length === 1 </script>

    <script name="Ensure nice match is shown">
      event: click div.card:nth-of-type(2)
      assert: state.message === "Nice match!"
    </script>
    <script> assert: state.revealed.length === 2 </script>

    <template name="Check that 6 other tiles are not revealed" string-count=6>
          class="card "
          style=" "
          @click:="script.flip"
    </template>
</test>

<test name="Renders winning condition">
    <state
        message="Good luck!"
        cards:='[
            {"id": 0, "symbol": "A"},
            {"id": 1, "symbol": "A"},
            {"id": 2, "symbol": "B"},
            {"id": 3, "symbol": "B"},
            {"id": 4, "symbol": "C"},
            {"id": 5, "symbol": "C"},
            {"id": 6, "symbol": "D"},
            {"id": 7, "symbol": "D"}
        ]'
        revealed:='[]'
        lastflipped:=null
        failedflip:=null
    ></state>
    <script name="When all cards are flipped, winning message is shown">
        // "Reveal" all cards
        script.flip(7);
        script.flip(6);
        script.flip(5);
        script.flip(4);
        script.flip(3);
        script.flip(2);
        script.flip(1);
        script.flip(0);
        assert: state.message === "You win!"
    </script>

    <template name="Reveals cards (A)" string-count=2>A</template>
    <template name="Reveals cards (B)" string-count=2>B</template>
    <template name="Reveals cards (C)" string-count=2>C</template>
    <template name="Reveals cards (D)" string-count=2>D</template>

    <template name="Show win message" string-count=1>
        <p style=""> You win!</p>
    </template>
    <template name="Show flipping animation" string-count=8>
        animation: flipping 0.5s infinite alternate;
    </template>

    <template name="Nothing unflipped" string-count=0>
          class="card "
    </template>
</test>

`,// (ends: /components/examplelib-tests/MemoryGame-tests.html) 

  "/components/examplelib-tests/Templating_1-tests.html": // (12 lines)
`<test name="Renders initially as expected">
    <template>
        <p>There are <em>42 articles</em> on ModuloNews.</p>
        <h4 style="color: blue">MODULO RELEASED!</h4>
        <p>The most exciting news of the…</p>
        <h4 style="color: blue">CAN JS BE FUN AGAIN?</h4>
        <h4 style="color: blue">MTL CONSIDERED HARMFUL</h4>
        <p>Why constructing JS is risky …</p>
    </template>
</test>

`,// (ends: /components/examplelib-tests/Templating_1-tests.html) 

  "/components/examplelib-tests/Tutorial_P3_state_bind-tests.html": // (47 lines)
`<test name="Behaves as expected">
    <template name="Ensure initial inputs are bound so render is as expected" test-values>
        <div>
            <input [state.bind] name="username" value="Testing_Username" />
            <label>Color: <input [state.bind] name="color" value="blue" />
                (valid options "green" or "blue")</label>
            <input [state.bind]
                name="opacity"
                type="number" min="0" max="1" step="0.1" value="0.5" />
            <h5 style="
                    opacity: 0.5;
                    color: blue;
                ">
                testing_username
            </h5>
        </div>
    </template>

    <script>
        element.querySelector('input[name="username"]').value = 'tEsT2'
        event: keyup input[name="username"]
    </script>

    <script>
        element.querySelector('input[name="color"]').value = 'green'
        event: keyup input[name="color"]
    </script>

    <template name="Ensure changing inputs with state.bind causes updated rendering" test-values>
        <div>
            <input [state.bind] name="username" value="tEsT2" />
            <label>Color: <input [state.bind] name="color" value="green" />
                (valid options "green" or "blue")</label>
            <input [state.bind]
                name="opacity"
                type="number" min="0" max="1" step="0.1" value="0.5" />
            <h5 style="
                    opacity: 0.5;
                    color: green;
                ">
                test2
            </h5>
        </div>
    </template>
</test>

`,// (ends: /components/examplelib-tests/Tutorial_P3_state_bind-tests.html) 

  "/components/examplelib-tests/CompositionTests-tests.html": // (70 lines)
`
<!-- Due to bug with the test runner or testing framework, including this
test will cause other tests to fail, but running it separately it succeeds. -->
<test name="Misc sub-components correctly render">
    <script>
        element.cparts.template =
            element.cpartSpares.template
                .find(({attrs}) => attrs.name === 'comptest1')
        assert: element.cparts.template
    </script>

    <template>
        Testing
        <x-Tutorial_P1>
            Hello <strong>Modulo</strong> World!
            <p class="neat">Any HTML can be here!</p>
        </x-Tutorial_P1>
        <x-templating_escaping>
            <p>User "<em>Little &lt;Bobby&gt; &lt;Drop&gt;
            &amp;tables</em>" sent a message:</p>
            <div class="msgcontent">
                I <i>love</i> the classic <a target="_blank"
                href="https://xkcd.com/327/">xkcd #327</a> on
                the risk of trusting <b>user inputted data</b>
            </div>
        </x-templating_escaping>
    </template>
</test>


<test name="Button sub-component behavior">
    <script>
        element.cparts.template =
            element.cpartSpares.template
                .find(({attrs}) => attrs.name === 'comptest2')
    </script>

    <!--
    <template name="Renders">
        <x-TestBtn mytexty="Test text" myclicky:=script.gotClickies>
            <button @click:=props.myclicky>Test text</button>
        </x-TestBtn>
        <p>state.a: 1</p>
    </template>
    -->

    <script>
        event: click button
        assert: state.a === 1337
    </script>

    <!--
    <template name="Renders after click">
        <x-TestBtn mytexty="Test text" myclicky:=script.gotClickies>
            <button @click:=props.myclicky>Test text</button>
        </x-TestBtn>
        <p>state.a: 1337</p>
    </template>

    <template name="Shouldn't show subcomp children" string-count=0>
        IGNORED
    </template>

    -->
</test>




`,// (ends: /components/examplelib-tests/CompositionTests-tests.html) 

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
                    <span alt="Shrink">&swarr;</span>
                {% else %}
                    <span alt="Go Full Screen">&nearr;</span>
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

  "/components/modulowebsite/demo.js": // (275 lines)
`let componentTexts = null;
let componentTexts2 = null;
let exCounter = 0; // global variable

function _setupGlobalVariables() {
    // TODO: Refactor this, obvs
    // Get text from the two example component libraries
    //console.log('this is registered Modulo instances', Object.keys(Modulo.factoryInstances));
    try {
        componentTexts = Modulo.factoryInstances['eg-eg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts:', err);
        componentTexts = null;
    }

    try {
        componentTexts2 = Modulo.factoryInstances['docseg-docseg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts2:', err);
        componentTexts2 = null;
    }

    if (componentTexts) {
        componentTexts = Object.assign({}, componentTexts, componentTexts2);
    }
}

function codemirrorMount({ el }) {
    const demoType = props.demotype || 'snippet';
    _setupCodemirror(el, demoType, element, state);
}

function _setupCodemirror(el, demoType, myElement, myState) {
    //console.log('_setupCodemirror DISABLED'); return; ///////////////////
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

        if (!myElement.codeMirrorEditor) {
            myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
        }
        myElement.codeMirrorEditor.refresh()
        //myElement.rerender();
    };
    const {isBackend} = Modulo;
    if (!isBackend) {
        // TODO: Ugly hack, need better tools for working with legacy
        setTimeout(mountCM, expBackoff);
    }
}

function selectTab(newTitle) {
    //console.log('tab getting selected!', newTitle);
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

function initializedCallback({ el }) {
    if (componentTexts === null) {
        _setupGlobalVariables();
    }

    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            componentTexts = false;
            throw new Error('Couldnt load:', props.fromlibrary)
        }

        const componentNames = props.fromlibrary.split(',');
        for (const title of componentNames) {
            if (title in componentTexts) {
                text = componentTexts[title].trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                state.tabs.push({ text, title });
            } else {
                console.error('invalid fromlibrary:', title);
                console.log(componentTexts);
                return;
            }
        }
    } else if (props.text) {
        let title = props.ttitle || 'Example';
        text = props.text.trim();
        state.tabs.push({title, text});
        // hack -v
        if (props.text2) {
            title = props.ttitle2 || 'Example';
            text = props.text2.trim();
            state.tabs.push({title, text});
        }
        if (props.text3) {
            title = props.ttitle3 || 'Example';
            text = props.text3.trim();
            state.tabs.push({title, text});
        }
    }

    const demoType = props.demotype || 'snippet';
    if (demoType === 'snippet') {
        state.showclipboard = true;
    } else if (demoType === 'minipreview') {
        state.showpreview = true;
    }

    state.text = state.tabs[0].text; // load first

    state.selected = state.tabs[0].title; // set first as tab title
    //setupShaChecksum();
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
     return; ///////////////////
    console.log('setupShaChecksum DISABLED'); return; ///////////////////

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
    const attrs = { src: '', namespace };
    const tagName = 'Example';

    if (element.codeMirrorEditor) {
        state.text = element.codeMirrorEditor.getValue(); // make sure most up-to-date
    }
    let componentDef = state.text;
    componentDef = \`<component name="\${tagName}">\\n\${componentDef}\\n</component>\`;
    const loader = new Modulo.Loader(null, { attrs } );
    loader.loadString(componentDef);
    const fullname = \`\${namespace}-\${tagName}\`;
    const factory = Modulo.factoryInstances[fullname];
    state.preview = \`<\${fullname}></\${fullname}>\`;

    // Hacky way to mount, required due to buggy dom resolver
    const {isBackend} = Modulo;
    if (!isBackend) {
        setTimeout(() => {
            const div = element.querySelector('.editor-minipreview > div');
            if (div) {
                div.innerHTML = state.preview;
            } else {
                console.log('warning, cant update minipreview', div);
            }
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
function previewspotMount({ el }) {
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

  "/components/modulowebsite/demo.css": // (267 lines)
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
.Main--fluid  .demo-wrapper.demo-wrapper__minipreview.demo-wrapper__fullscreen  {
    /* ...except if full screen */
    max-width: 100vw;
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
.editor-minipreview > div > * > input {
  max-width: 175px;
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

//  Preloading page: /components/layouts.html 
Modulo.globalLoader.loadString(Modulo.fetchQ.data["/components/layouts.html"],
                               "/components/layouts.html");
