/*

Next steps:

  1. Merge the ComponentFactory into the CPartDef
  2. Cleanup, e.g. merge CPartDef with Modul2
  3. Write adaptors until we can run tests again
  4. Write tests for new config system
  5. Gradually reactor with tests running (possibly write more tests as well)
  6. Identify points of CPart and/or middleware code insertion, and with the
  help of the new config system refactor further and finalize "config / load /
  factory" lifecycle names
*/

/*
  Everything without a name (or Name e.g. -name):
      - Singular
      - .Content gets concatenated, attrs merged
      - goes into this.config.lowercasecpartname
  Everything with a name (or Name e.g. -name):
      - Plural
      - Loads individually
      - goes into this.config.UpperCaseCPartName.MyNameGoesHere
      - Named CParts can hold other CParts (e.g. Component, Library)
      - Then, all CParts are instantiated (CParts), OR registered for instantation (Components)

E.G:

<Component> // No name
    <State> // Creates default state for all subsequent Components
    </State>
</Component>

<Component name="Thing"> // With name, becomes Factory type
</Component>

---------------------------------------------

- Library idea: "name" vs "namespace": "name='modlib'" is a human-readable
  internal name that gets rewritten into a hash after (as opposed to namespace,
  which defaults to null and thus gets a hash as a default, but will never be
  rewritten)
*/

class DataPropCPartBase {
    dataPropMount({ el, value, attrName, rawName }) { // element, 
        const { get, set } = Modulo.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
            el.dataPropsAttributeNames = {};
        }
        const isVar = /^[a-z]/i.test(value) && !Modulo.INVALID_WORDS.has(value);
        //const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        const renderObj = this.config;
        const val = isVar ? get(renderObj, value) : JSON.parse(value);
        set(el.dataProps, attrName, val); // set according to path given
        el.dataPropsAttributeNames[rawName] = attrName;
    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }
}

class CPartDef {
    constructor(partialPartConf, config) {
        this.config = Modulo.utils.deepClone(config);
        if (partialPartConf.tagName) {
            partialPartConf = this.loadPartialConfigFromNode(partialPartConf);
        }
        const { Type, Name } = partialPartConf;
        this.partConf = this.config[Type] = Object.assign(
            {},
            this.config[Type],
            Type in this.config.modulo.factories ? this.config.modulo.factories[Type][Name] : {},
            partialPartConf,
        );
        this.children = []; // children CParts
    }

    loadDependencies(callback) {
        // TODO Clean up
        const src = this.partConf.Src || this.partConf.src;
        if (src) {
            //Modulo.fetchQ.enqueue(this.partConf.Src, callback, basePath);
            Modulo.fetchQ.enqueue(src, (text, label, src) => {
                this.partConf.Content = text;
                callback();
            });
        } else {
            callback();
        }
    }

    loadPartialConfigFromNode(node) {
        const partType = String(Modulo.utils.getNodeCPartName(node, this.config));
        const config = Modulo.utils.mergeAttrs(node, this.config[partType]);
        const content = node.tagName === 'SCRIPT' ? node.textContent : node.innerHTML;
        config.Content = (config.Content || '') + content; // concatenate
        config.Type = partType; // Ensure Type is set as well
        return config;
    }

    runFactoryLifecycle() {
        const baseRenderObj = {};
        for (let { partConf } of this.children) {
            const { Type } = partConf;
            const cpCls = this.config.modulo.cparts[Type];

            /// XXX
            // mock nonsense -v
            this.loader = { localNameMap: { }, namespace: 'x' };
            this.fullName = `${this.loader.namespace}-${name}`;
            this.name = this.config.component.name;
            Modulo.factoryInstances = {};
            /////

            const data = cpCls.factoryCallback(partConfToData(partConf), this, baseRenderObj) || partConf;
            baseRenderObj[Type] = data; // TODO: flatten baseRenderObj with config
        }
        const cpCls = this.config.modulo.cparts[this.partConf.Type];
        baseRenderObj[this.partConf.Type] = this.partConf;
        const data = cpCls.factoryCallback(baseRenderObj, this) || this.partConf;
        baseRenderObj[this.partConf.Type] = data; // refactor
        return baseRenderObj;
    }
}

class Modul2 extends DataPropCPartBase {
    constructor(config, baseConfig = null) {
        super();
        this.dataPropLoad = this.dataPropMount.bind(this); // duplicate for Load
        this.config = Modulo.utils.deepClone(baseConfig || Modul2.defaults);
        this.children = [];
        if (typeof config === 'string') { // String of HTML to load
            this.loadChildrenNodes(this.loadString(config), this.config, this);
        } else if (config && config.nodeType && config.innerHTML) { // DOM node
            this.loadChildrenNodes(this.loadString(config.innerHTML), this.config, this);
        } else {
            // TODO: Add "deepCloneMerge", and do that with config if obj
            Modulo.assert(!config, 'Invalid config, must be string or node')
        }
    }

    loadChildrenNodes(node, config, parentConf) {
        const nodes = node.content ? node.content.childNodes : node.children;
        for (const node of nodes) {
            const name = Modulo.utils.getNodeCPartName(node, config);
            if (!name) {
                continue;
            }
            const conf = new CPartDef(node, config);
            parentConf.children.push(conf);
            conf.loadDependencies(() => {
                const { isContainer, isFactory } = config.modulo.cparts[name];
                if (isContainer) {
                    const subNodes = this.loadString(conf.partConf.Content || '');
                    this.loadChildrenNodes(subNodes, conf.config, conf); // use silo'ed config to load
                }

                Modulo.fetchQ.wait(() => {
                    if (!isFactory) { return; }
                    // TODO: hacky adaptor
                    const name = conf.partConf.Name || conf.partConf.name; // TODO?
                    conf.runFactoryLifecycle();
                });
            });
        }
    }

    loadString(text) {
        this.reconciler = new Modulo.reconcilers.ModRec({
            directives: { 'modulo.dataPropLoad': this },
            directiveShortcuts: [ [ /:$/, 'modulo.dataProp' ] ],
        });
        return this.reconciler.loadString(text, {});
    }

    onReady(callback) {
        this.onReadyCallback = callback;
    }

    register(path, value) {
        const { get, set } = Modulo.utils;
        const existing = get(this.config, value);
        if (existing && Array.isArray(existing)) {
            existing.push(value);
        } else {
            set(this.config, path, value);
        }
    }
}

const partConfToData = (pc) => {
    // TODO: loadConfigCallback default should be in base, for now an adaptor to old load style
    const dependencies = pc.Src || pc.src;
    const content = pc.Content;
    const attrs = pc;
    return { dependencies, content, attrs };
};

Modulo.utils.deepClone = obj => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    var clone = new obj.constructor();
    for(var key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = Modulo.utils.deepClone(obj[key]);
        }
    }
    return clone;
};


Modul2.defaults = {
    template: {},
    component: {},
    staticdata: {},
    state: {},
    style: {},
    modulo: {
        cparts: {
            modulo: Modul2,
            library: class Librar2 { },
            template: Modulo.cparts.template,
            script: Modulo.cparts.script,
            component: Modulo.cparts.component,
            state: Modulo.cparts.state,
            staticdata: Modulo.cparts.staticdata,
            style: Modulo.cparts.style,
            props: Modulo.cparts.props,
        },
        factories: {
            component: {},
            library: {},
            modulo: {},
        },
    },
};

Modul2.defaults.modulo.cparts.library.isContainer = true;
Modul2.defaults.modulo.cparts.component.isContainer = true;
Modul2.defaults.modulo.cparts.modulo.isContainer = true;
Modul2.defaults.modulo.cparts.component.isFactory = true;


const hackBuildCParts = function (childrenLoadObj, element) {
    // This function does the heavy lifting of actually constructing a
    // component, and is invoked when the component is mounted to the page.
    element.cparts = { element }; // Include "element", for lifecycle method
    element.cpartSpares = {}; // no need to include, since only 1 element

    // Loop through the parsed array of objects that define the Component
    // Parts for this component, checking for errors.
    for (const [name, partOptions] of childrenLoadObj) {
        Modulo.assert(name in Modulo.cparts, `Unknown cPart: ${name}`);
        if (!(name in element.cpartSpares)) {
            element.cpartSpares[name] = [];
        }
        console.log('this is stuff', name, partOptions);
        const instance = new Modulo.cparts[name](element, partOptions);
        element.cpartSpares[name].push(instance);
        element.cparts[name] = instance;
    }
}

Modul2.defaults.modulo.cparts.component.factoryCallback = function (baseRenderObj, def) {
      // Register the Custom Web Component with the browser

      const name = def.partConf.Name || def.partConf.name; // maybe rm lower name
      const namespace = def.partConf.namespace || 'x';
      const fullName = namespace + '-' + name; // TODO fix

      const data = {};
      const loader = { localNameMap: { }, namespace: 'x' }; // HACK loader adapter

      const hackFactoryAdaptor = { fullName, baseRenderObj, loader, name }

      // TODO: Use meta programming:
      // Build the Component into a class with a name, using a function asset,
      // so it's built into the build! That way it shows as having that class
      // when debugging. Invoking the function should create and register the
      // class. Possibly could be helpful with deduping fetchQ in builds?

      // Create the class that the browser will use to actually instantiate
      // each Modulo Element (e.g. Component)
      let id = 1;
      data.elementClass = class CustomElement extends Modulo.Elemen2 {
          factory() {
              hackFactoryAdaptor.buildCParts = (element) => {
                  const childrenLoadObj = def.children.map(({ partConf }) => [ partConf.Type, partConfToData(partConf) ]);
                  const cData = partConfToData(def.partConf);
                  cData.attrs.uniqueId = ++id;
                  cData.attrs.directiveShortcuts = [
                      [ /^@/, 'component.event' ],
                      [ /:$/, 'component.dataProp' ],
                  ];
                  childrenLoadObj.unshift([ 'component',  cData]); // Add "self" as CPart
                  hackBuildCParts(childrenLoadObj, element);
              }
              return hackFactoryAdaptor;
          }
      };

      // TODO: This is actually the "biggest" try-catch, catching defining a
      // new component. Need to work on better error messages here.
      try {
          console.log('registering ', fullName, data.elementClass);
          Modulo.globals.customElements.define(fullName.toLowerCase(), data.elementClass);
      } catch (err) {
          console.log(`Component ${fullName} failed to define`, err);
      }
      return data;
};

window.modul2 = new Modul2();


Modulo.defineAll = function testMod2() {
    const query = 'template[modulo-embed],modulo';
    for (const elem of Modulo.globals.document.querySelectorAll(query)) {
        //window.modul2.configure(elem);
        //window.modul2.runLoadLifecycle();
        window.modul2 = new Modul2(elem);
        //console.log(window.modul2.config, window.modul2.partConf);
    }
}

Modulo.utils.getNodeCPartName = (node, config) => {
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
    if (!(cPartName in config.modulo.cparts)) {
        console.error('Modulo.Loader: Unknown CPart def:', cPartName);
        return null;
    }
    return cPartName;
}


/// ELEMENT and COMPONENT code getting ported

Modulo.Elemen2 = class ModuloElemen2 extends HTMLElement {
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

        if (Modulo.isBackend) { // TODO rm
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


Modulo.cparts.component = class Component extends DataPropCPartBase {
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
        opts.uniqueId = ++factory.id;
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
        console.log('rec opts', opts);
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
        Modulo.assert(func, `No function found for ${rawName} ${value}`);
        if (!el.moduloEvents) {
            el.moduloEvents = {};
        }
        const listen = ev => {
            ev.preventDefault();
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
        const { get, set } = Modulo.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
            el.dataPropsAttributeNames = {};
        }
        const isVar = /^[a-z]/i.test(value) && !Modulo.INVALID_WORDS.has(value);
        const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        const val = isVar ? get(renderObj, value) : JSON.parse(value);
        set(el.dataProps, attrName, val); // set according to path given
        el.dataPropsAttributeNames[rawName] = attrName;
    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }
}


