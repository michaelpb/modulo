'use strict';
/*
           %
         MODULO

  Welcome to the Modulo.js source code.

  Unlike most code files, this one is arranged in a very deliberate way. It's
  arranged in a top-down manner, reflecting the lifecycle of a Modulo
  component, such that the earlier and more important code is at the top, and
  later and less important code is at the bottom. Thus, it is written like a
  linear "story" of how Modulo works. Modulo employs "literate programming", or
  interweaving Markdown-formatted comments on to tell this story, and using a
  tool to extract all these comments for easy reading (if you are viewing this
  as an HTML file, what you are reading right now!). Excluding this
  documentation you are reading now, the Modulo source code remains under 1000
  lines of code.

  Quick definitions:
    - Component - A discrete, re-usable bit of code, typically used to show a
      graphical UI element (eg a button, or a rich-text area). Components can
      also use other components (eg a form).
    - ComponentPart, or CPart - Each component consists of a "bag" or "bundle"
      of CParts, each CPart being a "pluggable" module that supplies different
      functionality for that component.
    - customElement - The term used for a custom HTML5 web component
    - Modulo.globals - Identical to "window", helps keep unit-tests simpler
*/

// tl;dr: Modulo.globals is the same thing as "window"
if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
var globals = {HTMLElement};
var Modulo = {globals};

/*
# Modulo.defineAll()

Our Modulo journey begins with `Modulo.defineAll()`, the function invoked to
"activate" all of Modulo by defining the "mod-load" web component. This
constructs a Loader object for every `<mod-load ...>` tag it encounters.
*/
Modulo.defineAll = function defineAll() {
    Modulo.globals.customElements.define('mod-load', Modulo.Loader);
};

/*
# Modulo.Loader

Once registered by defineAll(), the Modulo.Loader will do the rest of the heavy
lifting of fetching & registering Modulo components.
*/
Modulo.Loader = class Loader extends HTMLElement {
    /*
    # Modulo.Loader.connectedCallback()

    The web components specifies the definition of a "connectedCallback"
    function. In this case, this function will be invoked as soon as the DOM is
    loaded with a `<mod-load>` tag in it.

    The function initializes starting data & sends a new request to the URL
    specified by the src attribute. When the response is received, it loads the
    text as a Modulo component module definition.
    */
    connectedCallback() {
        this.src = this.getAttribute('src');
        this.initialize(this.getAttribute('namespace'), Modulo.utils.parseAttrs(this));
        // TODO: Check if already loaded via a global / static serialized obj
        Modulo.globals.fetch(this.src)
            .then(response => response.text())
            .then(text => this.loadString(text));
    }

    /*
    ## Loader.loadString

    The main loading method. This will take a string with the source code to a
    module as an argument and loop through all `<component ...>` style
    definitions. Then, it uses `Loader.loadFromDOMElement` to create a
    `ComponentFactory` instance for each component definition.
    */
    loadString(text, alsoRegister=true) {
        // TODO - Maybe use DOMParser here instead
        const frag = new Modulo.globals.DocumentFragment();
        const div = Modulo.globals.document.createElement('div');
        div.innerHTML = text;
        frag.append(div);
        const results = [];
        for (const tag of div.querySelectorAll('[mod-component],component')) {
            const componentFactory = this.loadFromDOMElement(tag);
            results.push(componentFactory);
            if (alsoRegister) {
                componentFactory.register();
            }
        }
        return results;
    }

    /*
    ## Loader.loadFromDOMElement

    Create a ComponentFactory instance from a given `<component>` definition.
    */
    loadFromDOMElement(elem) {
        /*
          ### Step 1: Config

          Get any custom component configuration (e.g. attributes `name=` or
          `extends=`)
        */
        // Get any custom component configuration (e.g. `name=` or `extends=`)
        const attrs = Modulo.utils.parseAttrs(elem);
        const name = attrs.modComponent || attrs.name;
        /*
        // Untested
        const extend = attrs['extends'];
        if (extend) {
            for (const [name, data] of this.componentFactoryData) {
                // TODO: Change this.componentFactoryData to be a map
                // Also, refactor this mess in general
                if (name === extend) {
                    for (const key of Object.keys(data)) {
                        loadingObj[name] = [data[key]];
                    }
                }
            }
        }
        */

        /*
          ### Step 2: Set-up `loadingObj`

          Modulo often uses plain objects to "pass around" during the lifecycle
          of each component. At this stage, we set up `loadingObj`.

          At the end of this method, the loadingObj will be populated with a
          complete, parsed, component definition -- enough information to
          instantiate a "factory" for this component -- in the following structure:

                loadingObj = {
                    template: [...], // array of parsed objects for "Template" CPart
                    state: [...], // array of parsed objects for "State" CPart
                    ...etc
                }
        */
        const loadingObj = {};
        loadingObj.component = [{name}]; // Everything gets implicit Component CPart

        /*
          ### Step 3: define CParts

          Loop through each CPart DOM definition within the component (e.g.
          `<state>`), invoking the `loadCallback` on each definition (e.g.
          `Modulo.cparts.State.loadCallback` will get invoked for each
          `<state>`). This `loadCallback` in turn will do any pre-processing
          necessary to transform the attributes of the DOM element into the
          data necessary to define this CPart.
        */
        for (const {cPartName, node} of this.getCPartNamesFromDOM(elem)) {
            const cPart = Modulo.cparts.get(cPartName);
            const results = cPart.loadCallback(node, this, loadingObj);

            // Multiple parts of the same type, push onto array
            if (cPart.name in loadingObj) {
                loadingObj[cPart.name].push(results);
            } else {
                loadingObj[cPart.name] = [results];
            }
        }

        this.componentFactoryData.push([name, loadingObj]);
        return this.defineComponent(name, loadingObj);
    }

    /*
      ## Loader.defineComponent

      Helper function that constructs a new ComponentFactory for a component,
      based on a loadingObj data structure.
    */
    defineComponent(name, loadingObj) {
        const factory = new Modulo.ComponentFactory(this, name, loadingObj);
        if (Modulo.globals.defineComponentCallback) {
            Modulo.globals.defineComponentCallback(factory); // TODO rm when possible
        }
        return factory;
    }

    /*
      ## Loader.getNodeCPartName

      Helper function that determines the CPart name from a DOM node.
    */
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
        if (!(Modulo.cparts.has(cPartName))) {
            console.error('Unknown CPart in component def:', tagName);
            return null;
        }
        return cPartName;
    }

    /*
      ## Loader.getCPartNamesFromDOM

      Helper function that loops through a component definitions children,
      generating an array of objects containing the node and CPart name.
    */
    getCPartNamesFromDOM(elem) {
        return Array.from(elem.content.childNodes)
            .map(node => ({node, cPartName: this.getNodeCPartName(node)}))
            .filter(obj => obj.cPartName);
    }


    /*
    ## Loader: constructor, initialize

    Constructor functions to get initial / default data set-up.
    */
    constructor(...args) {
        super();
        this.initialize.apply(this, args);
    }

    initialize(namespace, options, factoryData=null) {
        this.namespace = namespace;
        this.customizedSettings = options;
        this.settings = Object.assign({}, options);
        this.componentFactoryData = factoryData || [];
        this.loadAll();
    }

    /*
    ## Loader: loadAll, serialize

    Utility functions used for serializing / deserializing a set of Modulo
    component definition.
    */
    loadAll() {
        for (const [name, options] of this.componentFactoryData) {
            this.defineComponent(name, options);
        }
    }

    serialize() {
        // Note: Will probably rewrite thsi when working on "modulo-cli build"
        const arg0 = JSON.stringify(this.namespace);
        const arg1 = JSON.stringify(this.customizedSettings);
        const arg2 = JSON.stringify(this.componentFactoryData);
        return `new Modulo.Loader(${arg0}, ${arg1}, ${arg2});`;
    }
}

/*
# Modulo.ComponentFactory

Now that we have traversed the jungle of loading Modulo component definitions,
what happens next? Well, for each component is defined, a ComponentFactory
instance is created. This class enables instantiating and setting up components
whenever they are encountered on an HTML page.

In Modulo, each component definition can be thought of as a collection of CPart
configurations. Thus, the ComponentFactory stores the configuration of the
CParts.
*/
Modulo.ComponentFactory = class ComponentFactory {

    /*
    ## ComponentFactory constructor

    When a ComponentFactory gets constructed (that is, by the Loader), it in
    turn sets up expected properties, and then invokes its methods createClass
    and runFactoryLifeCycle explained next.
    */
    constructor(loader, name, options) {
        Modulo.assert(name, 'Name must be given.');
        this.loader = loader;
        this.options = options;
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;
        Modulo.ComponentFactory.registerInstance(this);
        this.componentClass = this.createClass();
        this.runFactoryLifecycle(options);
    }

    /*
    ## ComponentFactory: Factory lifecycle

    This "factory" lifecycle is a special lifecycle for any global or one-time
    setup, after component definitions are loaded, but before before any
    components are constructed. Examples: the Style CPart uses this stage to
    set up global CSS, the Template CPart uses this to compile the template,
    and the Script CPart will actually wrap the script-tag & invoke it now.

    Like every other "lifecycle" in Modulo, it passes around a "renderObj"
    called baseRenderObj. After this method, this baseRenderObj is not
    modified, but instead gets copied into every other renderObj to form, as
    the name implies, the "base" of future renderObj.

    In total, this method loops through all the CPart names, finding each
    relevant CPart Classes, and then invoking each CPart static method
    "factoryCallback", which is what does the necessary preprocessing. If there
    are multiples of the same CPart, then whichever appears last will overwrite
    and/or merge data with the previous ones.  However, that particular
    behavior can be controlled from within each CPart factoryCallback itself.

    At the end of this method, baseRenderObj will look like this:

    ```javascript
    this.baseRenderObj = {
        script: {text: '"use static"\nvar state;\nfunction onReload(....etc)'},
        template: {compiledTemplate: function () { ...etc... }},
        (...etc...)
    }
    ```
    */
    runFactoryLifecycle(cPartOpts) {
        this.baseRenderObj = {};
        for (const [partName, partOptionsArr] of Object.entries(cPartOpts)) {
            const cPart = Modulo.cparts.get(partName);
            let data = {};
            for (data of partOptionsArr) {
                data = cPart.factoryCallback(data, this, this.baseRenderObj) || data;
            }
            this.baseRenderObj[cPart.name] = data;
        }
    }

    /*
    ## ComponentFactory: createClass

    Finally, we are ready to create the class that the browser will use to
    actually instantiate each Component.

    At this stage, we set up the reconciliation engine, since that's a
    component-wide option, create a "back reference" to the factory from the
    component, and then return a brand-new class definition.
    */
    createClass() {
        const {fullName} = this;
        const {reconciliationEngine = 'setdom'} = this.options;
        const reconcile = Modulo.adapters.reconciliation[reconciliationEngine]();
        return class CustomElement extends Modulo.Element {
            get factory() {
                // Gets current registered component factory (for hot-reloading)
                return Modulo.ComponentFactory.instances.get(fullName);
            }
            get reconcile() { return reconcile; }
        };
    }

    /*
    ## ComponentFactory: getCParts, register, instances & registerInstance

    These are minor helper functions. The first rearranges the options data,
    the second registers with window.customElements, and the third keeps a
    central location for every ComponentFactory instance.
    */
    getCParts() {
        const results = [];
        for (const [partName, partOptionsArr] of Object.entries(this.options)) {
            for (const partOptions of partOptionsArr) {
                const cPart = Modulo.cparts.get(partName);
                Modulo.assert(cPart, `Unknown cPart: ${partName}`);
                results.push({cPart, partOptions});
            }
        }
        return results;
    }
    register() {
        const tagName = this.fullName.toLowerCase();
        Modulo.globals.customElements.define(tagName, this.componentClass);
    }
    static instances = new Map();
    static registerInstance(instance) {
        Modulo.ComponentFactory.instances.set(instance.fullName, instance);
    }
}

Modulo.Element = class ModuloElement extends HTMLElement {
    constructor() {
        super();
        this.componentParts = [];
        //console.log('this is this', this);
        //console.log('this is this', this.getAttribute);
        this.originalHTML = this.innerHTML;

        this.originalChildren = [];
        if (this.hasChildNodes()) {
            const dupedChildren = Array.from(this.childNodes); // necessary
            for (const child of dupedChildren) {
                this.originalChildren.push(this.removeChild(child));
            }
        }
        this.initialize();
    }

    initialize() {
        this.name = 'element'; // Used by lifecycle // TODO: Replace with lifecycleName
        this.fullName = this.factory.fullName;
        this.isMounted = false;
        this.isModuloElement = true; // used when finding parent
        this.initRenderObj = Object.assign({}, this.factory.baseRenderObj);
        // this.initRenderObj = new Modulo.TaggedObjectMap(this.factory.baseRenderObj);
        // this.cparts = new Modulo.TaggedObjectMap();
    }

    constructParts(isReload=false) {
        const oldCParts = isReload ? this.componentParts : [];
        this.componentParts = [this]; // Include self, to hook into lifecycle
        for (const {cPart, partOptions} of this.factory.getCParts()) {
            const instance = new cPart(this, partOptions);
            this.componentParts.push(instance);

            if (instance.reloadCallback) {
                // Trigger any custom reloading code
                const oldPart = oldCParts.find(({name}) => name === cPart.name);
                if (oldPart) {
                    instance.reloadCallback(oldPart);
                }
            }
        }
    }

    getPart(searchName) {
        // TODO: Maybe should refactor this? Shouldn't be used much...
        return this.componentParts.find(({name}) => name === searchName);
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

    lifecycle(lifecycleNames) {
        // NEW CODE: This is a quick re-implementation of lifecycle
        this.renderObj = Object.assign({}, this.getCurrentRenderObj());
        // todo: maybe sort cparts ahead of time based on lifecycles?
        for (const lcName of lifecycleNames) {
            for (const cPart of this.componentParts) {
                const method = cPart[lcName + 'Callback'];
                if (!this.renderObj) {
                    console.log('lolwut - renderobj is falsy', this.renderObj);
                    break;
                }
                if (!(cPart.name in this.renderObj)) {
                    this.renderObj[cPart.name] = cPart;
                }
                if (method) {
                    const results = method.call(cPart, this.renderObj);
                    if (results) {
                        this.renderObj[cPart.name] = results;
                    }
                }
            }
        }
        // TODO: should probably be nulling this after
        //this.renderObj = null; // rendering is over, set to null
    }

    getCurrentRenderObj() {
        //console.log('this is initRenderObj', this.initRenderObj);
        //console.log('this is renderObj', this.renderObj);
        //console.log('this is eventRenderObj', this.eventRenderObj);
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }

    resolveValue(key) {
        const rObj = this.getCurrentRenderObj();
        const hackName = this.factory.name;
        //console.log(`   ${hackName} -- GET   ${key}`, rObj);
        const result = key.split('.').reduce((o, name) => o[name], rObj);
        //console.log(`   ${hackName} -- VALUE ${key} <<${result}>>`);
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
        // Note: For testability, constructParts is invoked on first mount,
        // before initialize.  This is so the hacky "fake-upgrade" for custom
        // components works for the automated tests. Logically, it should
        // probably be invoked in the constructor.
        this.constructParts();
        this.lifecycle(['initialized'])
        this.rerender();
        this.isMounted = true;
    }
}

Modulo.collectDirectives = function collectDirectives(component, el, arr) {
    if (!arr) {
        arr = []; // HACK for testability
    }
    // TODO: for "pre-load" directives, possibly just pass in "Loader" as
    // "component" so we can have load-time directives
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

Modulo.cparts = new Map();
Modulo.directiveShortcuts = new Map();
Modulo.directiveShortcuts.set(/^@/, 'component.event');
Modulo.directiveShortcuts.set(/:$/, 'component.resolve');
//Modulo.directiveShortcuts.set(/\.$/, 'json'); // idea for JSON literals

Modulo.adapters = {
    templating: {
        ModuloTemplate: () => text => ctx => new Modulo.Template(text).render(ctx),
    },
    reconciliation: {
        none: () => (component, html) => {
            component.innerHTML = html;
        },
        setdom: () => {
            // TODO: Maybe, move into function, so instantiate each time??
            return (component, html) => {
                const reconciler = new Modulo.SetDomReconciler();
                reconciler.reconcile(component, html);
            };
        },
        morphdom: () => {
            Modulo.assert(Modulo.globals.morphdom, 'morphdom is not loaded at window.morphdom');
            const {morphdom} = Modulo.globals;
            const opts = {
                getNodeKey: el => el.getAttribute && el.getAttribute('key'),
                onBeforeElChildrenUpdated: (fromEl, toEl) => {
                    // TODO: Possibly add directives here-ish
                    return !toEl.tagName.includes('-');
                },
                childrenOnly: true,
            };
            return (component, html) => {
                if (!component.isMounted) {
                    component.innerHTML = html;
                } else {
                    morphdom(component, `<div>${html}</div>`, opts);
                }
            };
        },
    },
};


Modulo.ComponentPart = class ComponentPart {
    static loadCallback(node, loader, loadingObj) {
        const options = Modulo.utils.parseAttrs(node);
        const content = node.tagName === 'TEMPLATE' ? node.innerHTML
                                                    : node.textContent;
        return {options, content};
    }

    static factoryCallback() {}

    constructor(component, options) {
        this.component = component; // TODO: Change to this.element
        this.options = options.options;
        this.content = options.content;
    }

    get name() {
        return this.constructor.name;
    }
}

Modulo.parts = {};
Modulo.parts.Component = class Component extends Modulo.ComponentPart {
    static name = 'component';
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
        const {component} = this;
        let newContents = (renderObj.template || {}).renderedOutput || '';
        component.reconcile(component, newContents);
    }

    handleEvent(func, ev, payload) {
        this.component.lifecycle(['event']);
        func.call(null, ev, payload); // todo: bind to array.push etc, or get autobinding in resolveValue
        this.component.lifecycle(['eventCleanup']);
    }

    childrenMount({el}) {
        el.append(...this.component.originalChildren);
        this.component.originalChildren = [];
    }

    childrenUnmount() {
        this.component.innerHTML = '';
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
Modulo.cparts.set('component', Modulo.parts.Component);

Modulo.parts.Props = class Props extends Modulo.ComponentPart {
    static name = 'props';
    static factoryCallback({options}, {componentClass}, renderObj) {
        // untested / daedcode ---v
        componentClass.observedAttributes = Object.keys(options);
    }

    copyMount({el}) {
        // dead code?
        // change to "this.element"
        for (const attr of this.component.getAttributeNames()) {
            el.setAttribute(attr, this.component.getAttribute(attr));
        }
        /*
        const props = {};
        for (let propName of Object.keys(this.options)) {
            propName = propName.replace(/:$/, ''); // normalize
            let attrName = this.component.resolveAttributeName(propName);
            if (!attrName) {
                console.error('Prop', propName, 'is required for', this.component.tagName);
                continue;
            }
            let value = this.component.getAttribute(attrName);
            if (attrName.endsWith(':')) {
                attrName = attrName.slice(0, -1); // trim ':'
                value = this.component.moduloRenderContext.resolveValue(value);
            }
            props[propName] = value;
        }
        */
    }

    initializedCallback(renderObj) {
        const props = {};
        const getAttr = getGetAttr(this.component);
        for (let propName of Object.keys(this.options)) {
            propName = propName.replace(/:$/, ''); // TODO, make func to normalize directives
            props[propName] = getAttr(propName);
        }
        //console.log('this is props', props);
        return props;
    }
}
Modulo.cparts.set('props', Modulo.parts.Props);

Modulo.parts.Style = class Style extends Modulo.ComponentPart {
    static name = 'style';
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
        content = content.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/gi, selector => {
            selector = selector.trim();
            if (selector.startsWith('@') || selector.startsWith(fullName)) {
                // Skip, is @media or @keyframes, or already prefixed
                return selector;
            }
            selector = selector.replace(new RegExp(name, 'ig'), fullName);
            if (!selector.startsWith(fullName)) {
                selector = `${fullName} ${selector}`;
            }
            return selector;
        });
        return content;
    }

    static loadCallback(node, loader, loadingObj) {
        let {content, options} = super.loadCallback(node, loader, loadingObj);
        const {name} = loadingObj.component[0];
        content = Modulo.parts.Style.prefixAllSelectors(loader.namespace, name, content);
        return {options, content};
    }
}
Modulo.cparts.set('style', Modulo.parts.Style);


Modulo.parts.Template = class Template extends Modulo.ComponentPart {
    static name = 'template';
    static factoryCallback(opts, factory, renderObj) {
        const {loader} = factory;
        const tagPref = '$1' + loader.namespace + '-';
        const content = (opts.content || '').replace(/(<\/?)my-/ig, tagPref);
        const {templatingEngine = 'ModuloTemplate'} = (renderObj.template || {}).options || {};
        const templateCompiler = Modulo.adapters.templating[templatingEngine]();
        const compiledTemplate = templateCompiler(content, opts);
        return {compiledTemplate};
    }
    renderCallback(renderObj) {
        const compiledTemplate = renderObj.template.compiledTemplate;
        const context = renderObj;
        const result = compiledTemplate(context);
        if (result.includes('undefined')) {
            console.log('undefined me', renderObj);
        }
        return {renderedOutput: result, compiledTemplate};
    }
}
Modulo.cparts.set('template', Modulo.parts.Template);


Modulo.parts.Script = class Script extends Modulo.ComponentPart {
    static name = 'script';

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
        const localVarsIfs = localVars.map(n => `if (name === '${n}') ${n} = value;`).join('\n');
        return `
            'use strict';
            var ${localVarsLet};
            var module = {exports: {}};
            function __set(name, value) { ${localVarsIfs} }
            ${contents}
            return { ${symbolsString} setLocalVariable: __set, exports: module.exports};
        `;
    }

    static factoryCallback(partOptions, factory, renderObj) {
        const code = partOptions.content || '';
        const localVars = Object.keys(renderObj);
        localVars.push('element'); // add in element as a local var
        localVars.push('parent'); // add in access to previous versions of renderObj // TODO: finish, currently dead code
        const wrappedJS = this.wrapJavaScriptContext(code, localVars);
        return (new Function('Modulo', wrappedJS)).call(null, Modulo);
    }

    initializedCallback(renderObj) {
        // Make sure that the local variables are all properly set
        const {setLocalVariable} = renderObj.script;
        for (const part of this.component.componentParts) {
            setLocalVariable(part.name, part);
        }
        setLocalVariable('element', this.component);
    }

    eventCallback(renderObj) {
        this.initializedCallback(renderObj);
    }
}
Modulo.cparts.set('script', Modulo.parts.Script);

Modulo.parts.State = class State extends Modulo.ComponentPart {
    static name = 'state';
    static debugGhost = true;
    get debugGhost() { return true; }
    initializedCallback(renderObj) {
        //console.log('initialized callback (1)', this.data);
        this.rawDefaults = renderObj.state.options || {};
        //console.log('initialized callback (2)', renderObj);
        this.boundElements = {};
        if (!this.data) {
            this.data = Modulo.utils.simplifyResolvedLiterals(this.rawDefaults);
        }
        //console.log('initialized callback (3)', this.data);
    }

    bindMount({el}) {
        el.getAttr = el.getAttr || el.getAttribute;
        const name = el.getAttr('name');
        Modulo.assert(name in this.data, `[state.bind]: "${name}" not in state`);
        const func = () => this.set(name, el.value);
        const evName = 'keyup'; // eventually customizable
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

    prepareCallback(renderObj) {
        // console.log('this is data', this.data);
        this.initializedCallback(renderObj); // TODO remove this, should not have to
        this.data.bindMount = this.bindMount.bind(this);// Ugh hack
        this.data.bindUnmount = this.bindUnmount.bind(this);// Ugh hack
        return this.data;
    }

    reloadCallback(oldPart) {
        this.data = Object.assign({}, oldPart.data, this.data, oldPart.data);
    }

    eventCallback() {
        this._oldData = Object.assign({}, this.data);
        Object.assign(this, this.data);
    }

    eventCleanupCallback() {
        for (const name of Object.keys(this.data)) {
            if (!(name in this._oldData)) {
                // clean up extra
                delete this.data[name];
                // this.set(name, null);
            } else if (this[name] !== this.data[name]) {
                this.set(name, this[name]); // update
            }
        }
        this.component.rerender(); // HACK
        // ToDo: Clean this up, maybe have data be what's returned for
        // prepareEventCallback, just like with prepareCallback?
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        const data = {[key]: value};
        if (this.boundElements[key]) {
            const [el, func, evName] = this.boundElements[key];
            el.value = value;
        }
        this.data = Object.assign({}, this.data, data);
        this.component.rerender();
        if (this.ghostElem) {
            // update ghost element with change
            if (typeof value !== 'string') {
                value = JSON.stringify(value);
                key += ':';
            }
            this.ghostElem.setAttribute(key, value);
        }
    }

}
Modulo.cparts.set('state', Modulo.parts.State);

// ModuloTemplate
const defaultOptions = {
    modeTokens: ['{% %}', '{{ }}', '{# #}'],
    opTokens: '==,>,<,>=,<=,!=,not in,is not,is,in,not',
    opAliases: {
        'is': 'X === Y',
        'is not': 'X !== Y',
        'not': '!(Y)',
        'in': 'typeof Y[X] !== "undefined" || Y.indexOf && Y.indexOf(X) != -1',
    },
};

defaultOptions.modes = {
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

defaultOptions.filters = {
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
    divisibleby: (s, arg) => ((s * 1) % (arg * 1)) === 0,
};

defaultOptions.tags = {
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

Modulo.Template = class Template {
    constructor(text, options = {}) {
        Object.assign(this, defaultOptions, options);
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

// ModuloDomReconcile

// setDOM ------------------
Modulo.SetDomReconciler = class SetDomReconciler {
    constructor() {
        this.KEY = 'key'
        this.IGNORE = 'modulo-ignore'
        this.CHECKSUM = 'modulo-checksum'
        this.KEY_PREFIX = '_set-dom-'
        this.mockBody = Modulo.globals.document.implementation.createHTMLDocument('').body;
    }

    reconcile(component, newHTML) {
        this.componentContext = component;
        if (!component.isMounted) {
            component.innerHTML = newHTML;
            this.findAndApplyDirectives(component);
        } else {
            this.mockBody.innerHTML = `<div>${newHTML}</div>`;
            this.setChildNodes(component, this.mockBody.firstChild);
        }
        this.componentContext = null;
    }

    findAndApplyDirectives(element) {
        const directives = [];
        for (const child of element.children) {
            Modulo.collectDirectives(this.componentContext, child, directives);
        }
        this.componentContext.applyDirectives(directives);
    }

    /**
    * @private
    * @description
    * Updates a specific htmlNode and does whatever it takes to convert it to another one.
    *
    * @param {Node} oldNode - The previous HTMLNode.
    * @param {Node} newNode - The updated HTMLNode.
    */
    setNode(oldNode, newNode) {
        if (oldNode.nodeType !== newNode.nodeType || oldNode.nodeName !== newNode.nodeName) {
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
                value = JSON.parse(value);
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

function getFirstModuloAncestor(elem) {
    // Walk up tree to first DOM node that is a modulo component
    const node = elem.parentNode;
    return !node ? null : (
        node.isModuloElement ? node : getFirstModuloAncestor(node)
    );
}

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    globals = window;
}
Modulo.globals = globals;
