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
    //Modulo.globals.customElements.define('mod-load', Modulo.DOMLoader);

    // Then, looks for embedded modulo components, found in <template modulo>
    // tags or <script type="modulo/embed" tags>. For each of these, it loads
    // their contents into a global loader with namespace 'x'.
    const attrs = { namespace: 'x', src: '/' };
    Modulo.globalLoader = new Modulo.Loader(null, { attrs });

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

        // TODO: loader.namespace defaulting to hash
        this.namespace = this.attrs.namespace;
        this.factoryData = [];
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
        if (newSrc) {
            this.src = newSrc;
        }
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
        const {fullName} = this;
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
        this.originalHTML = this.innerHTML;
        this.originalChildren = Array.from(this.hasChildNodes() ? this.childNodes : []);
        this.fullName = this.factory().fullName;
        this.initRenderObj = Object.assign({}, this.factory().baseRenderObj);
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
        this.lifecycle(['prepare', 'render', 'update', 'updated']);
    }

    lifecycle(lifecycleNames, rObj={}) {
        this.renderObj = Object.assign({}, rObj, this.getCurrentRenderObj());
        for (const lc of lifecycleNames) {
            for (const cName of Object.keys(this.cparts)) {
                this._invokeCPart(cName, lc + 'Callback');
            }
        }
        //this.renderObj = null; // ?rendering is over, set to null
    }

    getCurrentRenderObj() {
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }

    _invokeCPart(cpartName, methodirectiveName, dirMountArg) {
        const argument = dirMountArg || this.renderObj;
        const splitKey = cpartName.split('.');
        if (splitKey.length === 2) {         // "state.bind"
            cpartName = splitKey[0];         // "state.
            methodirectiveName = splitKey[1] + methodirectiveName; // .bindMount"
        }
        const method = this.cparts[cpartName][methodirectiveName];
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

Modulo.directiveShortcuts = [[/^@/, 'component.event'],
                             [/:$/, 'component.dataProp']];

Modulo.FactoryCPart = class FactoryCPart extends Modulo.ComponentPart {
    static childrenLoadedCallback(childrenLoadObj, loader, data) {
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
        return { innerHTML: null, patches: null };
    }

    updateCallback(renderObj) {
        let { innerHTML, patches } = renderObj.component;
        if (innerHTML !== null) {
            if (!this.reconciler) {
                // XXX (Delete this, only needed for SSG)
                const { engine = 'ModRec' } = this.attrs;
                this.reconciler = new Modulo.reconcilers[engine]({ makePatchSet: true });
            }
            patches = this.reconciler.reconcile(this.element, innerHTML || '');
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
        // XXX Broken..?
        el.append(...this.element.originalChildren);
        el.setAttribute('modulo-ignore', 'modulo-ignore');
    }

    childrenUnmount({el}) {
        el.innerHTML = '';
        el.removeAttribute('modulo-ignore');
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
    initializedCallback(renderObj) {
        this.rawDefaults = renderObj.state.attrs || {};
        this.boundElements = {};
        if (!this.data) {
            this.data = Modulo.utils.simplifyResolvedLiterals(this.rawDefaults);
        }
        return this.data;
    }

    bindMount({el, attrName, value}) {
        const { assert } = Modulo;
        const name = el.getAttribute('name') || attrName;
        assert(name in this.data, `[state.bind]: key "${name}" not in state`);
        assert(!this.boundElements[name], `[state.bind]: Duplicate "${name}"`);
        const listen = () => {
            // TODO: redo
            let {value, type, checked} = el;
            if (type && type === 'checkbox') {
                value === !!checked;
            }
            this.set(name, value);
        };
        const isText = el.tagName === 'TEXTAREA' || el.type === 'text';
        const evName = value ? value : (isText ? 'keyup' : 'change');
        this.boundElements[name] = [el, evName, listen];
        el.value = this.data[name];
        el.addEventListener(evName, listen);
    }

    bindUnmount({el, attrName}) {
        const name = el.getAttribute('name') || attrName;
        const [el2, evName, listen] = this.boundElements[name];
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
        let results = this.parseVal(filters.shift());
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
        renderas: (rCtx, template) => safe(template.instance.render(rCtx)),
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
        this.tagTransforms = tagTransforms || {};
        this.reconcileChildren(node, Modulo.utils.makeDiv(rivalHTML, true));
        if (!this.shouldNotApplyPatches) {
            this.applyPatches(this.patches);
        }
        return this.patches;
    }

    applyPatches(patches) {
        patches.forEach(patch => this.applyPatch.apply(this, patch));
    }

    reconcileChildren(node, rivalParent) {
        // Nonstandard nomenclature: "The rival" is the node we wish to match

        // TODO: NOTE: Currently does not respect ANY resolver directives,
        // including key=
        let child = node.firstChild;
        let rival = rivalParent.firstChild;
        while (child || rival) {
            rival = this.rivalTransform(rival);

            /*
            if (rival && rival.hasAttribute && rival.hasAttribute('modulo-ignore')) {
                console.log('skipping modulo-ignore (rival)');
                rival = rival ? rival.nextSibling : null;
            }
            if (child && child.hasAttribute && child.hasAttribute('modulo-ignore')) {
                console.log('skipping modulo-ignore (child)');
                child = child ? child.nextSibling : null;
            }
            */

            // Does this node to be swapped out? Swap if exist but mismatched
            const needReplace = child && rival && (
                child.nodeType !== rival.nodeType ||
                child.nodeName !== rival.nodeName
            );

            if (!rival || needReplace) { // we have more rival, delete child
                this.patchAndDescendants(child, 'Unmount');
                this.patch(node, 'removeChild', child);
            }

            if (needReplace) { // do swap with insertBefore
                // TODO will this cause an error with "swap" if its last one?
                this.patch(node, 'insertBefore', rival, child.nextSibling);
                this.patchAndDescendants(rival, 'Mount');
            }

            if (!child) { // we have less than rival, take rival
                this.patch(node, 'appendChild', rival);
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
                    if (!this.shouldNotDescend) {
                        this.reconcileChildren(child, rival);
                    }
                }
            }
            // Walk through DOM trees in parallel BFS, on to next sibling(s)!
            child = child ? child.nextSibling : null;
            rival = rival ? rival.nextSibling : null;
        }
    }

    rivalTransform(rival, parentNode) {
        if (!rival || rival.nodeType !== 1) {
            return rival; // Leave falsy & text values untouched
        }
        if (parentNode && rival === parentNode) {
            return rival; // Second time encountering top-level node, do nothing
        }
        const tag = rival.tagName.toLowerCase();
        let result = rival;
        if (tag in this.tagTransforms) {
            result = this.tagTransforms[tag](rival);
        }
        if (rival && rival.hasAttribute('modulo-ignore')) {
            result = null;
        }
        return result || (parentNode ? null : rival.nextSibling);
    }

    patch(node, method, arg, arg2=null) {
        this.patches.push([node, method, arg, arg2]);
    }

    applyPatch(node, method, arg, arg2) { // take that, rule of 3!
        if (method === 'node-value') {
            node.nodeValue = arg;
        } else if (method === 'insertBefore') {
            node.insertBefore(arg, arg2); // Needs 2 arguments
        //} else if (method === 'removeChild') {
        //    console.log('this is removeChild, arg2', node, arg);
        } else {
            /*if (method === 'removeChild') {
                if (arg.textContent.trim().startsWith('Once you have included Modulo')) {
                    console.log('before removeChild', node, arg);
                }
            }*/
            node[method].call(node, arg); // invoke method
        }
    }

    patchDirectives(el, rawName, suffix) {
        const directives = Modulo.utils.parseDirectives(rawName);
        if (directives) {
            const value = el.getAttribute(rawName);
            for (const directive of directives) {
                Object.assign(directive, { value, el });
                this.patch(this.elementCtx, 'directive' + suffix, directive);
            }
        }
    }

    reconcileAttributes(node, rival) {
        const myAttrs = new Set(node ? node.getAttributeNames() : []);
        const rivalAttributes = new Set(rival.getAttributeNames());
        for (const rawName of rivalAttributes) {
            const attr = rival.getAttributeNode(rawName);
            if (myAttrs.has(rawName) && node.getAttribute(rawName) === attr.value) {
                continue; // Already matches, on to next
            }
            const suffix = myAttrs.has(rawName) ? 'Change' : 'Mount';
            this.patchDirectives(rival, rawName, suffix);
            this.patch(node, 'setAttributeNode', attr.cloneNode(true));
        }

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
            rival = this.rivalTransform(rival, parentNode);
            if (!rival) {
                continue;
            }

            for (const rawName of rival.getAttributeNames()) {
                // Loop through each attribute patching directives as necessary
                this.patchDirectives(rival, rawName, actionSuffix);
            }

            // For now, the callbacks will just be functions
            //if (tag in this.tagTransforms) { // TODO: this doesnt work... should think directives?
            //this.patch(this.element, 'tagTransform', this.tagTransform[tag]);
            //}
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
        // Similar to Node's path.resolve()
        // stackoverflow.com/questions/62507149/
        return (workingDir + '/' + relPath).split('/')
                   .reduce((a, v) => {
                     if (v === '.'); // do nothing
                     else if (v === '..') a.pop();
                     else a.push(v);
                     return a;
                   }, []);
    }
                   /*
        if (relPath.startsWith('/')) {
            console.log('Warning: Relpath isnt relative', relPath);
        }
        const results = [];
        for (const pathPart of .split('/')) {
            if (pathPart === '..') {
                results.pop()
            } else if (pathPart[0] !== '.') {
                results.push(pathPart);
            }
        }
        // TODO: Refactor this
        const prefix = workingDir && workingDir.startsWith('/') ? '/' : '';
        // Join and remove doubled slashes
        return prefix + results.join('/').replace(RegExp('//', 'g'), '/');
    }
    */

    static hash(str) {
        // Simple, insecure, hashing function, returns base32 hash
        let h = 0;
        for(let i = 0; i < str.length; i++) {
            h = Math.imul(31, h) + str.charCodeAt(i) | 0;
        }
        return (h || 0).toString(32);
    }

    static cleanWord(text) {
        return (text + '').replace(/[^a-zA-Z0-9$_\.]/g, '') || '';
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
        const attrName = cleanWord((name.match(/\][^\]]+$/) || [''])[0]);
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
        for (let [label, src] of Object.entries(fetchObj)) {
            this._enqueue(src, label, callback);
        }
    }

    _enqueue(src, label, callback) {
        if (this.basePath && !this.basePath.endsWith('/')) {
            // <-- TODO rm & straighten this stuff out
            this.basePath = this.basePath + '/'; // make sure trails '/'
        }
        //console.log('ENQUEUEING (1)', this.basePath, src);
        src = Modulo.utils.resolvePath(this.basePath || '', src);
        //console.log('ENQUEUEING (2)', this.basePath, src);
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
Modulo.fetchQ.basePath = {{ path|escapejs|safe }};
Modulo.globalLoader.loadString(Modulo.fetchQ.data[Modulo.fetchQ.basePath]);
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
    //Modulo.ROOT_PATH = document.location.url;
}

// And that's the end of the Modulo source code story. This means it's where
// your own Modulo story begins!

// No, really, your story will begin right here. When Modulo is compiled,
// whatever code exists below this point is user-created code.

// So... keep on reading for the latest Modulo project:
// ------------------------------------------------------------------
