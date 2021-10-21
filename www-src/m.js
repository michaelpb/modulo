// modulo build -t7gr4j
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
    const opts = { attrs: { namespace: 'x' } };
    Modulo.globalLoader = new Modulo.Loader(null, opts);

    Modulo.CommandMenu.setup();
    Modulo.fetchQ.wait(() => {
        const query = 'template[modulo-embed],modulo';
        for (const embedElem of Modulo.globals.document.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            Modulo.globalLoader.loadString(embedElem.innerHTML);
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
Modulo.Loader = class Loader extends Modulo.ComponentPart {
    // ## Loader: connectedCallback()
    constructor(element=null, options={attrs: {}}, parentLoader=null) {
        super(element, options);
        this.src = this.attrs.src;
        this.fullSrc = this.attrs.src;
        if (parentLoader && parentLoader.fullSrc) {
            let src = this.fullSrc; // todo refactor this
            src = src.replace('.', Modulo.utils.dirname(parentLoader.fullSrc));
            src = src.replace(/\/\//, '/'); // remove double slashes
            this.fullSrc = src;
        }

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
    loadString(text) {
        /* TODO - Maybe use DOMParser here instead */
        /* TODO - Recurse into other sub-loaders, applying namespace */
        /* TODO: Do <script  / etc preprocessing here:
          <state -> <script type="modulo/state"
          <\s*(state|props|template)([\s>]) -> <script type="modulo/\1"\2
          </(state|props|template)> -> </script>*/
        /*if (this.src) {
            // not sure how useful this is
            Modulo.fetchQ.basePath = this.src;
        }*/
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

            if (data.dependencies) { // load cpart dependencies
                const cb = cpartClass.loadedCallback.bind(cpartClass);
                Modulo.fetchQ.enqueue(data.dependencies,
                    (text, label) => cb(data, text, label, this));
            }

            if (cpartClass.childrenLoadedCallback) { // a factory type
                data.children = this.loadFromDOMElement(node);
                const cb = cpartClass.childrenLoadedCallback.bind(cpartClass);
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
    static loadedCallback(data, content, label, loader) {
        // idea: make namespace ALWAYS required, no default? 'x' is only for local/global?
        data.attrs.namespace = data.attrs.namespace || 'x';
        data.loader = new Modulo.Loader(null, {attrs: data.attrs}, loader);
        if (data.loader.fullSrc && !Modulo.isBackend) {
            // not sure how useful this is
            Modulo.fetchQ.basePath = data.loader.fullSrc;
        }
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
        this._invokeCPart(args.dName, 'Mount', args);
    }
    directiveUnmount(args) {
        this._invokeCPart(args.dName, 'Unmount', args);
    }
    directiveChange(args) {
        this._invokeCPart(args.dName, 'Change', args);
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

    _invokeCPart(cpartName, methodName, dirMountArg) {
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
        const {engine = 'ModRec'} = this.attrs;
        this.reconciler = new Modulo.reconcilers[engine]({makePatchSet: true});
    }

    prepareCallback() {
        return { innerHTML: null, patches: null };
    }

    updateCallback(renderObj) {
        let { innerHTML, patches } = renderObj.component;
        if (innerHTML !== null) {
            if (!this.reconciler) {
                // XXX (Delete this, only needed for SSG)
                const {engine = 'ModRec'} = this.attrs;
                this.reconciler = new Modulo.reconcilers[engine]({makePatchSet: true});
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
        this.element.lifecycle(['event'], {_eventFunction: func});
        const { value } = (ev.target || {}); // Get value if is <INPUT>, etc
        func.call(null, payload === undefined ? value : payload, ev);
        this.element.lifecycle(['eventCleanup']); // todo: should this go below rerender()?
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
        this.instance = new engineClass(this.content, this.attrs);
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
        renderas: (renderCtx, template) => safe(template.instance.render(renderCtx)),
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
        // TODO: remove <!DOCTYPE html>
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

    patchDirectives(elem, rawName, suffix) {
        const directives = Modulo.utils.parseDirectives(this.elementCtx, elem, rawName);
        if (directives) {
            for (const directive of directives) {
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

    static parseDirectives(element, el, rawName) {
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
        const value = el.getAttribute(rawName);
        const attrName = cleanWord((name.match(/\][^\]]+$/) || [''])[0]);
        for (const dName of name.split(']').map(cleanWord)) {
            if (dName !== attrName) { // Skip the bare name itself
                arr.push({el, value, attrName, rawName, dName, element, name})
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
    enqueue(fetchObj, callback) {
        fetchObj = typeof fetchObj === 'string' ? { fetchObj } : fetchObj;
        for (let [label, src] of Object.entries(fetchObj)) {
            this._enqueue(src, label, callback);
        }
    }

    _enqueue(src, label, callback) {
        // TODO remove! ------------------------------------v
        if (src.startsWith('.') && this.basePath && this.basePath !== 'null') {
            src = src.replace('.', Modulo.utils.dirname(this.basePath));
            src = src.replace(/\/\//, '/'); // remove double slashes
        }
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

// And that's the end of the Modulo source code story. This means it's where
// your own Modulo story begins!

// No, really, your story will begin right here. When Modulo is compiled,
// whatever code exists below this point is user-created code.

// So... keep on reading for the latest Modulo project:
// ------------------------------------------------------------------
;

Modulo.defineAll();
Modulo.fetchQ.data = {
  "/components/layouts.html": // (122 lines)
`<load src="./modulowebsite.html" namespace="mws"></load>
<load src="./examplelib.html" namespace="eg"></load>
<load src="./embeddedexampleslib.html" namespace="docseg"></load>


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

  "/components/modulowebsite.html": // (472 lines)
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

  "/components/examplelib.html": // (618 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        const myText = Modulo.fetchQ.data[factory.loader.src];
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
<state num:=42
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
    Components can use <strong>any</strong> number
    of <em title="Component Parts">CParts</em>.
</template>
<style>
    em { color: darkblue; }
    * { text-decoration: underline; }
</style>

<testsuite>
    <test name="Initially renders">
        <template>
            Components can use <strong>any</strong> number
            of <em title="Component Parts">CParts</em>.
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

  "/components/embeddedexampleslib.html": // (241 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        const myText = Modulo.fetchQ.data[factory.loader.src];
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

<!-- NOTE / TODO: These are duplicated, present in docs as well. (Should
dedupe and use fromlibrary in docs, and allow fromlibrary to get from here
as well) -->

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










<!-- ++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->
<!-- ++++++++++++++++++++++++++++++++++++++++++++++++++++++ -->

<!-- The remaining components are only being used for adding more tests for
the Modulo framework, not as an example -->
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



<component name="ReconcilerTester">

<testsuite
    src="./examplelib-tests/ReconcilerTester-tests.html"
></testsuite>

</component>



<component name="ReconcilerTester2">

<testsuite
    src="./examplelib-tests/ReconcilerTester-bigtests.html"
></testsuite>

</component>


`,// (ends: /components/embeddedexampleslib.html) 

  "/components/layouts/base.html": // (67 lines)
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
        <aside style="border: none" [component.children]>
        </aside>
    </main>
{% else %}
    <main class="Main" [component.children] >
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

  "/components/modulowebsite/demo.js": // (243 lines)
`let componentTexts = null;
let componentTexts2 = null;
let exCounter = 0; // global variable

console.log('thsi si modulowebsite/demo.js');

// Get text from the two example component libraries
try {
    componentTexts = Modulo.factoryInstances['eg-eg']
            .baseRenderObj.script.exports.componentTexts;
    componentTexts2 = Modulo.factoryInstances['docseg-docseg']
            .baseRenderObj.script.exports.componentTexts;
} catch (err) {
    console.log('couldnt get componentTexts:', err);
    componentTexts = null;
    componentTexts2 = null;
}

if (componentTexts) {
    componentTexts = Object.assign({}, componentTexts, componentTexts2);
}

function codemirrorMount({el}) {
    const demoType = props.demotype || 'snippet';
    _setupCodemirror(el, demoType, element, state);
}

function _setupCodemirror(el, demoType, myElement, myState) {
    console.log('_setupCodemirror disabled'); return; ///////////////////
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
                console.error('invalid fromlibrary:', title)
                return;
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
    console.log('setupShaChecksum disabled'); return; ///////////////////

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

  "/components/examplelib-tests/ReconcilerTester-tests.html": // (537 lines)
`<test name="ensure ModRec and MTL are defined">
    <script>
        Modulo.utils.makeMockElement = function reconcile (html)  {
            const {makeDiv} = Modulo.utils;
            const mockElement = makeDiv(html);
            mockElement.applyDirectives = () => {}; // dummy
            mockElement.resolveValue = () => () => {}; // dummy(2)
            mockElement.directiveMount = () => {}; // dummy
            mockElement.directiveUnmount = () => {}; // dummy
            mockElement.directiveChange = () => {}; // dummy
            return mockElement;
        }
        Modulo.utils.getRecPatches = function reconcile (oldHTML, newHTML)  {
            const {makeDiv} = Modulo.utils;
            const mockElement = Modulo.utils.makeMockElement(oldHTML);
            const modRec = new ModRec({makePatchSet: true});
            modRec.reconcile(mockElement, newHTML);
            return modRec.patches;
        };

        Modulo.utils.transformDOMCheck = function reconcile (oldHTML, newHTML, expectedDirCount)  {
            if (newHTML === undefined) { // single argument given
                newHTML = oldHTML;
                oldHTML = '';
            }
            const {makeDiv} = Modulo.utils;
            const mockElement = Modulo.utils.makeMockElement(oldHTML);
            //const modRec = new ModRec({makePatchSet: true});
            const modRec = new ModRec({makePatchSet: false});
            modRec.reconcile(mockElement, newHTML);

            let dirCount;
            if (expectedDirCount !== undefined) {
                dirCount = modRec.patches.filter(p => p[1].startsWith('directive')).length;
            }
            //modRec.patches.map(patch => modRec.applyPatch.apply(modRec, patch));
            const genInner = makeDiv(mockElement.innerHTML).innerHTML;
            const correctInner = makeDiv(newHTML).innerHTML;
            const match = genInner === correctInner;
            if (!match) {
                console.log('-------------------------')
                console.log('Error: no match');
                console.log('Was naively wishing for:');
                console.log(correctInner);
                console.log('but instead got:');
                console.log(genInner);
                console.log('-------------------------')
                const {pToString} = Modulo.utils;
                console.log('- Examine the following:')
                console.log(pToString(modRec.patches));
                console.log('-------------------------')
            } else {
                //console.log('match', genInner, correctInner);
            }

            if (expectedDirCount !== dirCount) {
                /*console.log('DIRECTIVE NOT MATCH:',
                  modRec.patches.filter(p => p[1].startsWith('directive')));*/
                console.log('DIRECTIVE NOT MATCH:', dirCount, 'actual', expectedDirCount, 'expected');
            }
            return match && expectedDirCount === dirCount;
        };

        Modulo.utils.patchStringify = function patchStringify (patch)  {
            const [node, method, arg1] = patch;
            return \`<\${node.nodeType} \${node.nodeName}> \${method}("\${arg1}") </\${node.nodeType}>\`
        };

        Modulo.utils.pToString = function patchStringify (patches)  {
            return patches.map(Modulo.utils.patchStringify).join('\\n')
        };

        Modulo.utils.anchorInTheDeep = function anchorITD (html)  {
            return \`
                <div>
                    <div id="main"><p>A<p><p>B</p></div>
                    <div class="other section">
                      <p>A<p><p>B</p>
                    </div>
                    <footer><a href="#">\${html}</a></footer>
                </div>
            \`;
        };

        const {ModRec} = Modulo.reconcilers;
        assert: ModRec
    </script>
    <script>
        const {MTL} = Modulo.templating;
        assert: MTL
    </script>
</test>

<test name="Patches get generated as expected">
    <script name="Text node is updated correctly">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p>Test2</p>');
        const expected = '<3 #text> node-value("Test2") </3>';
        assert: patches.length === 1 && patchStringify(patches[0]) === expected;
    </script>

    <script name="Text node is appending correctly">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p>Test</p> Stuff');
        const expected = '<1 DIV> appendChild("[object Text]") </1>';
        assert: patches.length === 1 && patchStringify(patches[0]) === expected;
    </script>

    <script name="Adds single attribute">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p id="stuff">Test</p>');
        const expected = '<1 P> setAttributeNode("[object Attr]") </1>';
        assert: patches.length === 1 && patchStringify(patches[0]) === expected;
    </script>

    <script name="Changes a single attribute">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<p id="stuff">Test</p>', '<p id="s t u f f">Test</p>');
        const expected = '<1 P> setAttributeNode("[object Attr]") </1>';
        assert: patches.length === 1 && patchStringify(patches[0]) === expected;
    </script>

    <script name="Deletes a single attribute">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<p id="stuff">Test</p>', '<p>Test</p>');
        const expected = '<1 P> removeAttribute("id") </1>';
        assert: patches.length === 1 && patchStringify(patches[0]) === expected;
    </script>

    <script name="Appends an element">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p>Test</p><p>Test 2</p>');
        const expected = '<1 DIV> appendChild("[object HTMLParagraphElement]") </1>';
        assert: patches.length === 1 && patchStringify(patches[0]) === expected;
    </script>

    <script name="Mounts a directive">
        const {getRecPatches, pToString} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p [test.dir]a=b>Test</p>');
        const expected = '<1 DIV> directiveMount("[object Object]") </1>\\n' +
                          '<1 P> setAttributeNode("[object Attr]") </1>'; 
        assert: patches.length === 2 && pToString(patches) === expected;
    </script>

    <script name="Mounts multiple directives">
        const {getRecPatches, pToString} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p [test2.dir2][test.dir]a=b>Test</p>');
        const expected = '<1 DIV> directiveMount("[object Object]") </1>\\n' +
                          '<1 DIV> directiveMount("[object Object]") </1>\\n' +
                          '<1 P> setAttributeNode("[object Attr]") </1>'; 
        assert: patches.length === 3 && pToString(patches) === expected;
    </script>

    <script name="Supports a directive shortcut">
        const {getRecPatches, pToString} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p @click=clickytarget>Test</p>');
        const expected = '<1 DIV> directiveMount("[object Object]") </1>\\n' +
                          '<1 P> setAttributeNode("[object Attr]") </1>'; 
        assert: patches.length === 2 && pToString(patches) === expected;
    </script>

    <script name="Supports multiple directive shortcuts">
        const {getRecPatches, pToString} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p @click:=clickytarget>Test</p>');
        const expected = '<1 DIV> directiveMount("[object Object]") </1>\\n' +
                          '<1 DIV> directiveMount("[object Object]") </1>\\n' +
                          '<1 P> setAttributeNode("[object Attr]") </1>'; 
        assert: patches.length === 3 && pToString(patches) === expected;
    </script>

    <script name="Ignores spurious directive shortcuts">
        const {getRecPatches, pToString} = Modulo.utils;
        const patches = getRecPatches('<p>Test</p>', '<p %%%click=notarealclick>Test</p>');
        const expected = '<1 P> setAttributeNode("[object Attr]") </1>'; 
        assert: patches.length === 1 && pToString(patches) === expected;
    </script>

    <script name="Correctly generates no patches (1)">
        const {getRecPatches, patchStringify} = Modulo.utils;
        const patches = getRecPatches('<P   >Test</p >', '<p>Test</p>');
        assert: patches.length === 0
    </script>


    <script name="Correctly generates no patches (2)">
        const {getRecPatches, patchStringify} = Modulo.utils;

        // TODO: Think of ways to "fuzz" test it by running large HTML
        // files through it to themselves, and forcing it to descend (not
        // use isSameNode).
        const str = \`
            <div>abc<!-- hm --></div> <!--<p></p>--> <div a="asdf">def</div>
            <div v="asdf">hij<p></p><p></p>nm</div> <div>jkl</div> zxcvb
            <p>bnm</p> &amp; <!-- okay --><li>i<li>ii<li>iii
        \`;
        const patches = getRecPatches(str, str);
        assert: patches.length === 0
    </script>

    <script name="Correctly generates no patches (3)">
        const {getRecPatches, patchStringify, anchorInTheDeep} = Modulo.utils;
        const str = anchorInTheDeep('  <I  a=b c=d>o\\nk</i> ');
        const patches = getRecPatches(str, str);
        assert: patches.length === 0
    </script>

    <script name="Generates no patches when fuzz testing against loaded files">
        const {getRecPatches, pToString} = Modulo.utils;
        let msg = '';
        let inequalCount = 0;
        for (const [key, value] of Object.entries(Modulo.fetchQ.data)) {
            msg += \`Doing \${key} ---\\n\`;
            let patches = getRecPatches(value, value);

            /*
            // NOTE: It will / should generate directives patches since this is first mount
            // Should uncomment and ensure correct logic
            if (value.includes(':=') || /\\s@\\w+/.test(value)) {
                if (patches.length < 1) {
                    inequalCount++;
                    msg += \`\${key} FAILURE Expected directive mounts: --- \${pToString(patches)}\\n\`;
                }
            }
            */
            patches = patches.filter(patch => !patch[1].startsWith('directive'));
            if (patches.length > 0) {
                inequalCount++;
                msg += \`\${key} FAILURE --- \${pToString(patches)}\\n\`;
            }
        }
        //console.log(msg);
        assert: inequalCount === 0
    </script>
</test>

<test name="Patches generated in DOM contexts">
    <script name="Finds deep patchs as well as shallow patches">
        const {getRecPatches, patchStringify, anchorInTheDeep} = Modulo.utils;
        const str1 = '<main></main>';
        const str2 = '<main class="test">stuff</main><div novalue>other</div>';
        const str1deep = anchorInTheDeep(str1);
        const str2deep = anchorInTheDeep(str2);
        const patches1 = getRecPatches(str1, str2);
        const patches2 = getRecPatches(str1deep, str2deep);
        const patches3 = getRecPatches(anchorInTheDeep(''), str2deep);
        const patches4 = getRecPatches('', str2);
        element.patches1 = patches1.map(patchStringify).join('\\n');
        element.patches2 = patches2.map(patchStringify).join('\\n');
        element.patches3 = patches3.map(patchStringify).join('\\n');
        element.patches4 = patches4.map(patchStringify).join('\\n');
        assert: element.patches1 && element.patches2
                  && element.patches3 && element.patches4;
    </script>

    <script name="which generated different patches due to A vs DIV">
        const {patches1, patches2} = element;
        assert: patches1 !== patches2
    </script>

    <script name="but if A vs DIV is corrected then it generates same">
        const {patches1, patches2} = element;
        const correctedPatches2 = patches2.replace('A>', 'DIV>')
        //console.log(patches1, '\\n\\n\\n--\\n\\n\\n----\\n\\n\\n',correctedPatches2);
        assert: patches1 === correctedPatches2 
    </script>

    <script name="and nothing to something is same no matter dom ctx (1)">
        const {patches3, patches4} = element;
        //console.log(patches3, '\\n\\n\\n--\\n\\n\\n----\\n\\n\\n', patches4);
        assert: patches3 !== patches4 // because of A vs DIV
    </script>

    <script name="and nothing to something is same no matter dom ctx (2)">
        const {patches3, patches4} = element;
        //console.log(patches3, '\\n\\n\\n--\\n\\n\\n----\\n\\n\\n', patches4);
        assert: patches3.replace(/A>/g, 'DIV>') === patches4;
    </script>

</test>


<test name="Applying patches">
    <script name="Generates single patch for single-rooted tree (1)">
        const {getRecPatches, pToString} = Modulo.utils;
        element.targetStr = \`<div><p id="example1">Hello patching world!</p>
                    <p class="example2">Testing <em>nested</em> levels</p></div>\`;
        // Should be length 1 since it's 1 node and has no directives
        element.patches = getRecPatches('', element.targetStr);
        //console.log('this is element', element.patches[0][0], element.patches[0][0].innerHTML);
        assert: element.patches
                && element.patches.length === 1
                && element.patches[0][0].tagName === 'DIV'
    </script>

    <script name="Patches apply (1)">
        const {makeMockElement, pToString} = Modulo.utils;
        const {ModRec} = Modulo.reconcilers;
        const {patches, targetStr} = element;
        const mr = new ModRec({makePatchSet: true});
        mr.elementCtx = patches[0][0]; // get element out of 0th
        patches.map(patch => mr.applyPatch.apply(mr, patch))
        let results = mr.elementCtx.innerHTML.trim();
        assert: results === targetStr.trim();
    </script>

    <script name="Generates single patch for single-rooted tree (2)">
        const {ModRec} = Modulo.reconcilers;
        const {makeDiv, makeMockElement, pToString, anchorInTheDeep} = Modulo.utils;
        element.targetStr2 = anchorInTheDeep(
                    \`<div><p id="example1">Hello patching world!</p>
                    <p class="example2">Testing <em>nested</em> levels</p></div>\`);

        const mockElement = makeMockElement(anchorInTheDeep(''));
        const modRec = new ModRec({makePatchSet: true});
        modRec.reconcile(mockElement, element.targetStr2);
        element.patches2 = modRec.patches;
        element.mockElement = modRec.elementCtx; // ensure has element interface
        // Should be length 1 since it's 1 node and has no directives
        assert: element.patches2
                && element.patches2.length === 1
                && element.patches2[0][0].tagName === 'A'
    </script>

    <script name="Patches apply (2)">
        const {makeMockElement, pToString} = Modulo.utils;
        const {ModRec} = Modulo.reconcilers;
        const {patches2, targetStr2, mockElement} = element;
        const mr = new ModRec({makePatchSet: true});
        mr.elementCtx = patches2[0][0]; // get element out of 0th
        patches2.map(patch => mr.applyPatch.apply(mr, patch))

        // Ensure results are the same (normalized by wrapping in DOM element)
        let results = mockElement.innerHTML;
        const target = makeMockElement(targetStr2).innerHTML;
        assert: results === target
    </script>

</test>

<test name="Applying patches for accurate DOM">
    <script name="Works on adjacent items">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck('<p>Adjacent</p><p>Items</p>');
    </script>

    <script name="Works on nested items">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck('<div>Nested<div>Items</div></div>');
    </script>

    <script name="Adds attribute">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div>Text</div>',
            '<div stuff="true">Text</div>',
        );
    </script>

    <script name="Deletes attribute">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div stuff="true">Text</div>',
            '<div>Text</div>',
        );
    </script>

    <script name="Changes value of attribute">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div stuff="true">Text</div>',
            '<div stuff="false">Text</div>',
        );
    </script>

    <script name="Adds attribute with others">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div stuff="true">Text</div>',
            '<div stuff="true" id="false">Text</div>',
        );
    </script>

    <script name="Handles nested elements">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div>Text<div>Nested</div></div>',
            '<div>Nested<div>Text</div></div>',
        );
    </script>

    <script name="Handles nested elements (with P-tags behavior)">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<p>Text<p>Nested</p></p>',
            '<p>Nested<p>Text</p></p>',
        );
    </script>

    <script name="Updates nested elements">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<p>Text<!--test comment --></p>',
            '<p>Nested<p>Text</p></p>',
        );
    </script>

    <script name="Does complicated attribute and child manipulations">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div stuff="true">Text<div stuff="false">Nested</div></div>',
            '<div stuff="verdad" id="nope">Nested<div stuff="mentira" id="falsa">Text</div></div>',
        );
    </script>

    <script name="Collects new directives">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div>txt</div>',
            '<div [directive.syntax]>txt</div>',
            1,
        );
    </script>

    <script name="Removes old directives">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div [directive.syntax]>txt</div>',
            '<div>txt</div>',
            1,
        );
    </script>

    <script name="Modifies existing directive">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div [my.dir]test=3>txt</div>',
            '<div [my.dir]test=4>txt</div>',
            1,
        );
    </script>

    <script name="Handles directive removal and change">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
            '<div [my.dir]test=4>txt<p [other.dir]=okay>p</p></div>',
            '<div [my.dir]test=5>txt<p >p</p></div>',
            2,
        );
    </script>

    <script name="Registers multiple directives">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck('', \`
            <button @click:="script.countUp">Hello 101</button>
        \`,  2);
    </script>

    <script name="Ignores untouched directives">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(\`
                <button @click:="script.countUp">Hello 101</button>
            \`,\`
                <button @click:="script.countUp">Hello 102</button>
            \`,  0);
    </script>

    <script name="Simple complete replacement (1)">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
              '<h3>Abc</h3><p>cdef</p><abc-Fake></abc-Fake>',
              '<div></div><p style=""></p>',
              0,
        );
    </script>

    <script name="Simple complete replacement (2)">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(
              '<h3>Abc</h3><p [test.thing]style="">cdef</p><abc-Fake></abc-Fake>',
              '<div>jkl;</div><p [test.thing]style=""></p><def-Fake></def-Fake>',
              0,
        );
    </script>

    <script name="Complicated complete replacement (from memory demo)">
        const {transformDOMCheck} = Modulo.utils;
        assert: transformDOMCheck(\`
                <h3>The Symbolic Memory Game</h3>
                <p>Choose your difficulty:</p>
                <button @click:="script.setup" click.payload="8">2x4</button>
                <button @click:="script.setup" click.payload="16">4x4</button>
                <button @click:="script.setup" click.payload="36">6x6</button>
            \`,\`
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
            \`,  22); // (8 * 2 = 16 mounts) + (3 * 2 = 6 unmounts)
    </script>
</test>

<test name="Supporting interactions with directives">

    <script name="Complete page replacement with children">
        const {transformDOMCheck} = Modulo.utils;
        const componentIH = \`<!DOCTYPE html>
            <html>
            <head><title></title></head>
            <body>
                <main class="Main">
                    <aside class="TitleAside" >
                    </aside>
                    <aside style="border: none" [component.children]>
                    </aside>
                </main>
            </body>
            </html>
        \`;
        const elementIH = \`
            <h1>A</h1> <p>A</p> <p>A</p> <p>B</p> <p>B</p> <p>A</p> <h1>A</h1>
            <p>C</p> <p>A</p> <div>A</div> <p>A</p> <p>A</p> <p>A</p> <p>A</p>
            <h1>A</h1> <p>A</p> <p>A</p> <p>A</p> <p>A</p> <p>123</p> <p>B</p>
            <p>A</p> <p>B</p> <p>123</p> <p>A</p> <p>B</p> <p>B</p> <p>A</p>
            <p>A</p> <p>B</p> <p>A</p> <p>123</p> <p>B</p> <p>B</p>
        \`;
        assert: transformDOMCheck(componentIH, elementIH);
    </script>

</test>
`,// (ends: /components/examplelib-tests/ReconcilerTester-tests.html) 

  "/components/examplelib-tests/ReconcilerTester-bigtests.html": // (576 lines)
`<test name="Successfully sets up mocks and testing data">
    <script>
        Modulo.utils.makeMockElement = function reconcile (html)  {
            const {makeDiv} = Modulo.utils;
            const mockElement = makeDiv(html);
            mockElement.applyDirectives = () => {}; // dummy
            mockElement.resolveValue = () => () => {}; // dummy(2)
            mockElement.directiveMount = () => {}; // dummy
            mockElement.directiveUnmount = () => {}; // dummy
            mockElement.directiveChange = () => {}; // dummy
            return mockElement;
        }

        Modulo.utils.transformDOMCheck = function reconcile (oldHTML, newHTML, expectedDirCount)  {
            if (newHTML === undefined) { // single argument given
                newHTML = oldHTML;
                oldHTML = '';
            }
            const {makeDiv} = Modulo.utils;
            const mockElement = Modulo.utils.makeMockElement(oldHTML);
            //const modRec = new ModRec({makePatchSet: true});
            const modRec = new ModRec({makePatchSet: false});
            const patches = modRec.reconcile(mockElement, newHTML);

            let dirCount;
            if (expectedDirCount !== undefined) {
                dirCount = patches.filter(p => p[1].startsWith('directive')).length;
            }
            const genInner = makeDiv(mockElement.innerHTML).innerHTML;
            const correctInner = makeDiv(newHTML).innerHTML;
            const match = genInner === correctInner;
            if (!match) {
                console.log('-------------------------')
                console.log('Error: no match');
                console.log('Was naively wishing for:');
                console.log(correctInner);
                console.log('but instead got:');
                console.log(genInner);
                console.log('-------------------------')
            } else {
                //console.log('match', genInner, correctInner);
            }

            if (expectedDirCount !== dirCount) {
                /*console.log('DIRECTIVE NOT MATCH:',
                  patches.filter(p => p[1].startsWith('directive')));*/
                console.log('DIRECTIVE NOT MATCH:', dirCount, 'actual', expectedDirCount, 'expected');
            }
            return match && expectedDirCount === dirCount;
        };
Modulo.utils.elementIH = \`
<h1>Tutorial</h1>

<blockquote> <p><strong>Prerequisites:</strong> Part 1 and Part 2 of this
tutorial requires a prerequisite knowledge of HTML &amp; CSS only.  Part 3
requires familiarity with JavaScript. Familiarity with React, Vue, or similar
frameworks is helpful, but not required.</p></blockquote>

<h1>The Modulo Tutorial</h1>
<p>Welcome to the Modulo tutorial. By following this short tutorial, you can
learn how to use Modulo in your own projects.</p>
<p><strong>Ready to dive in to Web Component development with
Modulo?</strong></p>


<mws-section name="part1">Part 1: Components, CParts, Loaders</mws-section>

<h3>Including Modulo</h3>
<p>The first step is to include the Modulo.js file. You can do this one of
2 ways:</p>
<ol>
    <li>Using a script tag to directly link to a CDN</li>
    <li>Downloading the Modulo.js and including it with a script tag, e.g.
    <code>&lt;script src="/js/Modulo.js"&gt;</code>
</li></ol>

<p>Then, Modulo needs to be explicitly activated. Somewhere before the closing body tag of your HTML file, you should activate Modulo with the following code:
    <code>&lt;script&gt;Modulo.defineAll();&lt;script&gt;</code>
</p>


<blockquote>
    <p><strong>Why use "components"?</strong> Have you ever repeated the
    same HTML, CSS, and/or JavaScript while writing a website or or web
    app? <em>Components</em> let you store repeated code in one place. Once
    defined, components can be re-used everywhere, saving developer time
    and reducing mistakes. Furthermore, within teams, components libraries
    improve collaboration between developers./p>
</blockquote>

<h3>Defining your first component</h3>

<p>Once you have included Modulo and activated it, you can define your
first <em>custom component</em>. Right now, we'll do that all in one file,
although soon we'll learn how to split your components into a separate
file, which is the preferred way.</p>


<p><strong>Component definitions</strong> start with a "component"
opening tag in the format of
<code>&lt;component&nbsp;name="HelloWorld"&gt;</code>. Modulo will scan a
document for these tags, defining components for each one it encounters.
Every component definition must specify a name, conventionally in
<code>UpperCamelCase</code>. This is just a convention when writing code:
Technically HTML tag names are all case insensitive, and so while inspecting
the DOM, browsers may display them in <code>all-lowercase</code>.</p>

<p>Once defined, you can use a component by referring to it's name as
though it were a plain HTML tag like &lt;div&gt;. Components can go
anywhere that plain HTML tags can go, and can be styled with CSS the same
way as well. Unlike plain HTML tags, you must use a dash (<code>-</code>)
when referring to a component. This is a rule of the HTML5 Custom
Components standard, which Modulo is based upon.</p>

<p>Modulo's default behavior is to prefix custom components with an
<code>x-</code>. So, if a component is defined like
<code>&lt;component&nbsp;name="HelloWorld"&gt;</code>, then it can be
referenced elsewhere like
<code>&lt;x-HelloWorld&gt;&lt;/x-HelloWorld&gt;</code>.</p>

<p>Finally, one more thing: When defining custom components in an HTML
document, you can't put them scattered everywhere. You have to keep them in one
place.  Specifically, to keep things neater, Modulo searches for component
definitions only within a <code>modulo-embed</code> HTML template tag:
<code>&lt;template modulo-embed&gt;</code></p>

<p>To quickly summarize: Components are reusable bits of HTML, JS, and CSS
code, and must be defined within a tag like
<code>&lt;component&nbsp;name="HelloWorld"&gt;</code>, and then this definition
can be embedded in an HTML page within a tag like
<code>&lt;template&nbsp;modulo-embed&gt;</code>.</p>

<p><strong>Okay, enough talk, let's actually try this out!</strong></p>


<section class="Tutorial-tryit">
    <h4>Try it now</h4>
    <ol>
        <li>Open up an HTML file in your preferred text editor. It's okay
        to start from scratch, or use an existing project.</li>
        <li>Copy &amp; paste in the following code:

<mws-demo text="
<!-- Define a custom component -->
<template is=&quot;modulo-embed&quot;>
    <component name=&quot;HelloWorld&quot;>
        <template>
            Hello <strong>Modulo</strong> World!
        </template>
    </component>
</template>
<!-- Reuse it anywhere, just like any other HTML tag -->
<x-HelloWorld></x-HelloWorld>
<p>In a P tag: <x-HelloWorld></x-HelloWorld></p>
<!-- Finally, include a Modulo CDN link &amp; activate (at the bottom) -->
"></mws-demo>
</li>
        <li>Ensure that the HTML file is opened in your preferred, modern web
        browser (such as Firefox or Chrome) as well.</li>
        <li>Refresh your web browser to view the results.</li>
    </ol>
</section>

<h3>Introducing: Component Parts</h3>

<p>The central concept to Modulo is that of <em>Component Parts</em>.
Because it is so central, saying <em>Component Parts</em> over and over
gets tiresome, so it's typically shortened to <em>CParts</em>.</p>

<blockquote> <p><strong>CParts: The Musical</strong> Think of CParts like the cast and
crew of a musical. Each are assigned to a different task?some are
more flashy and visible, others being stage-hands working behind the
scenes?but they all work together to put on the same
show!</p></blockquote>

<p>All component definitions consist of some number of CParts.  Thus, a
component definition is really just a collection of CPart definitions.
"Under the hood" of your component, each CPart will have a different role
to contribute to the functionality of your component.</p>

<!--<p> When a component definition is later instantiated (i.e., when that
component is used on the page), Modulo will in turn instantiate (i.e.
create an instance of) a CPart for each of the CPart definitions contained
in the component definition.</p>-->

<p>The first two CParts:</p>
<ol>
    <li>
        <strong>Template</strong> - <code>&lt;template&gt;</code>
        <p>Templates are where you put any arbitrary HTML code that you
        want your component to contain. For now, we'll just include some
        unchanging HTML. Later, we'll learn how to use "templating
        language" to control what HTML is produced in what
        circumstance.</p>
    </li>

    <li>

        <blockquote> <p><strong>Where to put CSS</strong> Instead of a
        Style CPart, you can always link a global CSS file the regular way
        to style your components.  However, many developers prefer the
        simplicity of keeping everything in one place, e.g. the CSS with
        the component definition that it styles.</p></blockquote>

        <strong>Style</strong> - <code>&lt;style&gt;</code>
        <p>Just like the <code>&lt;style&gt;</code> tag in HTML, the
        <strong>Style</strong> CPart allows us to write CSS for our
        component. CSS written here will be automatically prefixed so that
        it will only apply to your component and any HTML generated by the
        Template CPart.
        </p>

    </li>
</ol>

<p>Throughout Modulo documentation, there are little code editors, like below.
These allow you to immediately practice new concepts learned. For simplicity,
the top and bottom of the component definition code is omitted.  Instead, these
sample code editors only focus on the CPart definitions within.</p>

<section class="Tutorial-tryit">
    <h4>Try it now</h4>
    <p>Edit the CPart definitions on the left and click RUN to see the results
    on the right!</p>

    <ol>
        <li>Practice modifying the <strong>Template</strong> CPart
        (<code>&lt;template&gt;</code>) to see how that affects the
        output</li>
        <li>Practice modifying the <strong>Style</strong> CPart
        (<code>&lt;style&gt;</code>) to add or modify CSS</li>
        <li>Practice incorporating these CParts into your own components on
        a real page by copying the code here and pasting it within your
        component definition (that is, the one that you created in the
        previous part of this tutorial)<p></p>
    </li></ol>
    <mws-demo demotype="minipreview" fromlibrary="Tutorial_P1"></mws-demo>
</section>


<h3>Modulo Loader</h3>

<p>Up until now, we have practiced with a component embedded on the same
page that it is used. This is not recommended. Instead, you should put your
components in a separate file, and then use the
<code>&lt;modulo-load&gt;</code> tag to import your components into every
HTML file that needs them.</p>


<blockquote> <p><strong>Why use modulo-load?</strong>
Think of the <code>&lt;modulo-load&gt;</code> tag as being analogous to the
<code>&lt;link&gt;</code> tag, which lets multiple HTML files share the
same CSS. The same rationale applies here: Components are "write once, use
everywhere", so the way we get access to them "everywhere" is by
<em>loading</em> them into each file that needs to use them.  Another
reason: <code>&lt;modulo-load&gt;</code> smooths over certain browser
limitations.</p>
</blockquote>

<p>Loader tags look like the following:</p>

<pre>&lt;modulo-load
    src="./components/my-stuff.html"
    namespace="coolstuff"&gt;
&lt;/modulo-load&gt;
</pre>

<p>Let's break this down:</p>
<ul>

    <li>
        <code>src="./components/my-stuff.html"</code>
        <p>The <code>src</code> attribute specifies the source of the
        component library file. This file can be anywhere that is
        accessible to your web-browser or web-server. Ideally, it should be
        in the same place as your CSS and static media files, such as a
        <code>static/</code> directory, or whatever the equivalent is for
        your set-up.</p>
        <p>The component library itself (<code>my-stuff.html</code> in this
        example) should consist of an HTML file filled with
        <code>&lt;component&gt;</code> definitions.</p>
    </li>

    <li>

        <blockquote>
        <p><strong>Why use namespaces?</strong>
        Namespaces allow different component library files to have
        conflicting component names. This is especially useful when using
        third-party component libraries or while working in a big team:
        That way, if both you and another developer define a component with
        some common name (eg <code>name="Button"</code>), there won't be a
        conflict as long as you load each into different namespaces.</p>
        </blockquote>

        <code>namespace="coolstuff"</code>
        <p>The <code>namespace</code> attribute specifies the
        <em>namespace prefix</em>, which is combined with a dash and the
        component name in order to create the component's <em>full
        name</em>. </p>
        <p><strong>Example:</strong> If <code>my-stuff.html</code> has a component
        defined like <code>&lt;component name="MyThing"&gt;</code>
        imported with <code>namespace="coolstuff"</code>, then the
        resulting full name would be <code>coolstuff-MyThing</code>, and
        we'd use the component like<br>
        <code>&lt;coolstuff-MyThing&gt;&lt;/coolstuff-MyThing&gt;</code>.</p>
    </li>


    <li><strong>Where to put it:</strong> Loaders can go anywhere. For
    neatness, consider putting them either within the
    <code>&lt;head&gt;</code> tag, or near the <code>&lt;/body&gt;</code>
    closing tag.</li>
</ul>


<section class="Tutorial-tryit">
    <h4>Try it now</h4>
    <p>It's time to "promote" your beginner embedded component into a
    full-fledged loaded component!</p>
    <ol>
        <li>Optional: Create a new "components" directory to house your
        component library files.</li>
        <li>Create a new file for your component library within your
        components directory (or elsewhere). You could call it, for
        example, <code>my-component-lib.html</code></li>
        <li>Copy your existing <code>HelloWorld</code> component definition
        from your main HTML file into this new file, and then delete it
        from your main HTML file</li>
        <li>Add a <code>modulo-load</code> tag to your main HTML file. It
        should have the <code>src=</code> attribute pointing toward a
        relative path to your new component library file, and namespace can
        be <code>lib</code>.  For example, if you named everything based on
        the above suggestions, it would look like this:
<pre>&lt;modulo-load src="./components/my-component-lib.html"
            namespace="lib"&gt;&lt;/modulo-load&gt;
</pre></li>

        <li>Finally, update your component usage to now use the new
        namespace (instead of the "x" default namespace placeholder):
<pre>&lt;lib-HelloWorld&gt;&lt;/lib-HelloWorld&gt;
&lt;p&gt;In a P tag: &lt;lib-HelloWorld&gt;&lt;/lib-HelloWorld&gt;&lt;/p&gt;
</pre></li>
        <li>Refresh the web browser to view the results. If done correctly,
        nothing should change. To confirm it's working, try editing your
        component in the library file and refresh to see the results.</li>
    </ol>
    <p><strong>Bonus Challenge:</strong>
    Try practicing with multiple "main HTML" files sharing the same
    component library. Also, practice changing the namespace, or see if you
    can cause (and fix using the namespace attribute) a naming conflict
    with two components.</p>
</section>


<h3>Part 1: Summary</h3>

<p>In this tutorial, we learned what a <em>Component</em> is, and how to
define one, about what <em>CParts</em> are, and two important CParts
(<em>Template</em>, for HTML, and <em>Style</em>, for CSS), and finally how
to keep our components in a component library and then load that library
into different HTML files. At this point, you can already start getting
useful results from using Modulo, since even without JavaScript usage we
are already defining simple components that can help us re-use HTML code
between different pages.</p>


<h4>Key terms</h4>

<ul>
<li> <strong>Component</strong> - A discrete, re-usable bit of code, typically used to show a
graphical UI element (eg a button, or a rich-text area). Components can also
use other components (eg a form component might contain both of the above as
child components).  Every component is defined as a collection of CParts (e.g.
HTML <em>Template</em>, or <em>Style</em> tag).</li>
<li>ComponentPart, or <strong>CPart</strong> - Each component consists of a
"bag" or "bundle" of CParts, each CPart being a "pluggable" module that
supplies different functionality for that component.</li>
<li><strong>customElement</strong> - The term used for a custom HTML5 web
component, which is the underlying technology that Modulo is a thin wrapper
over. They all have dashes (<code>-</code>) in the name.</li>
</ul>



<p>In the subsequent tutorials we will go deeper: Explore the full
capabilities of Templates, allow flexible and composable components with
Props CPart, create custom behavior with Script CParts,  and finally create
forms and interactive, changing components with the State CPart.</p>




<mws-section name="part2">Part 2: Props and Templating</mws-section>

<blockquote> <p><strong>Why use Props?</strong>
Components are "write once, use everywhere". That is to say, you only need to
define a component once to use it throughout your pages. However, sometimes you
want each instance of a component to have different content or modified
behavior. This is where <em>Props</em> come into play: They allow you to
customize differences in content or behavior between multiple uses of the same
component.</p>
</blockquote>


<h3>CPart: Props</h3>

<p>The <em>Props</em> CPart defines the <em>properties</em> that can be
customized about a component. It allows for options or other data to be
"passed" to a component instance, in order to distinguish that instance from
other ones. For example, a button component might have <em>Props</em> that
specify its text, or which shape variation.</p>


<section class="Tutorial-tryit">
    <h4>Try it now</h4>
    <p>Context: The <code>&lt;tutorial-Button&gt;</code> component has already
    been defined for you. It was defined to accept two <em>props</em>:
    <code>label</code>, and <code>shape</code>. We'll cover how it was defined
    to use these <em>props</em> later on. For now, practice using the
    button.</p>

    <ol>
        <li>Examine the code below. See how the code uses the
        <code>tutorial-Button</code> component?</li>
    </ol>


<mws-demo text="
<template>
Hello <strong>Modulo</strong> World!
<p class=&quot;neat&quot;>Any HTML can be here!</p>
</template>
<style>
/* ...and any CSS here! */
strong {
    color: blue;
}
.neat {
    font-variant: small-caps;
}
</style>
">
</mws-demo>
</section>


<mws-demo text="
<template>
    <p>Trying out the button...</p>
    <tutorial-Button
        label=&quot;Button Example&quot;
        shape=&quot;square&quot;
    ></tutorial-Button>

    <p>Another button...</p>
    <tutorial-Button
        label=&quot;Rounded is Great Too&quot;
        shape=&quot;rounded&quot;
    ></tutorial-Button>
</template>
">
</mws-demo>



<mws-demo text="
<component name=&quot;Button&quot;>
    <props
        label
        shape
    ></props>
    <template>
        <button class=&quot;my-btn my-btn_{{ props.shape }}&quot;>
            {{ props.label }}
        </button>
    </template>
</component>
"></mws-demo>





<mws-section name="part3">Part 3: State and Script</mws-section>

coming soon!

\`;

Modulo.utils.componentIH = \`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf8" />
    <title>Tutorial - modulojs.org</title>
    <link rel="stylesheet" href="/js/codemirror_5.63.0/codemirror_bundled.css" />
    <link rel="stylesheet" href="/css/style.css" />
    <link rel="icon" type="image/png" href="/img/mono_logo.png" />
    <disabled-script src="/js/codemirror_5.63.0/codemirror_bundled.js"></disabled-script>

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
            <a href="/index.html#about" >About</a>
        </li>
        <li>
            <a href="/start.html" >Start</a>
        </li>
        <li>
            <a href="/docs/" class="Navbar--selected">Docs</a>
        </li>
    </ul>

    <div class="Navbar-rightInfo">
        v: undefined<br />
        SLOC: undefined lines<br />
        <a href="https://github.com/michaelpb/modulo/">github</a> | 
        <a href="https://npmjs.com/michaelpb/modulo/">npm</a> 
    </div>
</nav>


    <main class="Main Main--fluid Main--withSidebar">
        <aside class="TitleAside TitleAside--navBar" >
            <h3><span alt="Lower-case delta">%</span></h3>
            <nav class="TitleAside-navigation">
                <h3>Documentation</h3>
                <mws-DocSidebar path="tutorial.html"></mws-DocSidebar>
            </nav>
        </aside>
        <aside style="border: none" [component.children]>
        </aside>
    </main>


<footer>
    <main>
        (C) 2021 - Michael Bethencourt - Documentation under LGPL 3.0
    </main>
</footer>

</body>
</html>
\`;



        const {ModRec} = Modulo.reconcilers;

        assert: ModRec && Modulo.utils.elementIH;
    </script>
</test>


<test name="Supporting interactions with directives">
    <script name="Complete page replacement with children (1)">
        const {transformDOMCheck, elementIH, componentIH} = Modulo.utils;
        assert: transformDOMCheck(elementIH, componentIH, 1);
    </script>

    <script name="Complete page replacement with children (2)">
        const {transformDOMCheck, elementIH, componentIH} = Modulo.utils;
        assert: transformDOMCheck(componentIH, elementIH, 1);
    </script>
</test>

`,// (ends: /components/examplelib-tests/ReconcilerTester-bigtests.html) 

};

//  Preloading page: "/components/layouts.html" 
Modulo.fetchQ.basePath = "/components/layouts.html";
Modulo.globalLoader.loadString(Modulo.fetchQ.data[Modulo.fetchQ.basePath]);
