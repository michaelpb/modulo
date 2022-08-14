/*
    NEXT STEPS for Modulo:

    // BUG is visible on http://localhost:3334/_misc/mod3_tests.html
    // TestSuite.js http://localhost:3334/_misc/mod3_tests.html
            /// ISSUE IS HERE: Duplicating Template contents if not commented
            //out, due to inflexible CPart Tag partialConf loading 

            const templates = stepArray.filter(({ Type }) => Type === 'template')
            console.log('this is stepArray', JSON.stringify(templates));
            if (templates[0] && templates[1] && templates[0].Content === templates[1].Content) {
                throw new Error('Duplicate template');
            }
            ////////////////////




    // (PREVIOUS BUG NOTE - Might still be relevant, or taken care of by above)
    // The initRenderObj = r.HACK is broken, getting the last set one.
    // Should just rewrite / fix this hack.
  
    0. (DONE) Keep on iterating on: http://localhost:3334/demos/tests/ until it
    runs at all
    1. Incorporate "simple test suite" that was used with Mod3 before, and get
    running in new environ
    2. Fix Library -- current CPart code doesn't work at all
    3. One by one incorporate Libraries of the old unit tests. Will need to
    punt + totally rewrite some parts (e.g. things that read in their own
    fetchQ, maybe..?)
    4. Work on static build of site / etc
    5. Finish updating documentation, polish docs, finish misc articles, then
    release alpha!
*/

/*
  Misc lifecycle refactor idea:
  Modulo lifecycles:
  - configure - outputs data structure
  - asset - sets up asset manager
          - component - definition functions['..'] & script tag in head
          - script, staticdata - factory functions['..'] & script tag in head
          - style - styles['..'] & stylesheet tag in head
          - props, state - none
  - define
      - invokes component definition function
  Component lifecycles:
  - factory
      - invokes script definition function

*/

const LEGACY = []; // XXX
window.LEG = LEGACY;

// Avoid overwriting other Modulo versions / instances
window.ModuloPrevious = window.Modulo;
window.moduloPrevious = window.modulo;

window.Modulo = class Modulo {
    constructor(parentModulo = null, registryKeys = null) {
        window._moduloID = this.id = (window._moduloID || 0) + 1; // Global ID
        if (parentModulo) {
            this.parentModulo = parentModulo;

            const { deepClone, cloneStub } = modulo.registry.utils;
            this.config = deepClone(parentModulo.config, parentModulo);
            this.registry = deepClone(parentModulo.registry, parentModulo);
            this.factories = cloneStub(parentModulo.factories); // keep private

            this.assets = parentModulo.assetManager;
            this.globals = parentModulo.globals;
        } else {
            this.config = {};
            this.factories = {};
            this.registry = Object.fromEntries(registryKeys.map(cat => [ cat, {} ] ));
        }
    }

    static moduloClone(modulo, other) {
        return modulo; // Never clone Modulos to prevent reference loops
    }

    createAll(type, confArray) {
        const obj = {};
        for (const conf of confArray) {
            /// ///////////////
            // TODO Hax, remove and debug
            conf.Type = conf.Type[0].toUpperCase() + conf.Type.slice(1);
            if (conf.Type === 'Staticdata') { conf.Type = 'StaticData'; }
            if (conf.Type === 'Testsuite') { conf.Type = 'TestSuite'; }
            /// ///////////////
            obj[conf.RenderObj] = this.create(type, conf.Type, conf);
        }
        return obj;
    }

    create(type, name, conf = null) {
        type = (`${type}s` in this.registry) ? `${type}s` : type; // plural / singular
        //if (typeof this.registry[type][name] !== 'function') { debugger; } // XXX
        const instance = new this.registry[type][name](modulo, conf);
        conf.Instance = instance;
        return instance;
    }

    register(type, cls, defaults = undefined) {
        type = (`${type}s` in this.registry) ? `${type}s` : type; // plural / singular
        this.assert(type in this.registry, 'Unknown registration type:', type);
        this.registry[type][cls.name] = cls;

        if (type === 'commands') { // Attach globally to 'm' alias
            window.m = window.m || {};
            window.m[name] = () => cls(this);
        }

        if (cls.name[0].toUpperCase() === cls.name[0]) { // is CapFirst
            const conf = Object.assign({ Type: cls.name }, cls.defaults, defaults);
            this.config[cls.name.toLowerCase()] = conf;
            this.factories[cls.name.toLowerCase()] = {};

            // Global / core utility class getting registered
            if (type === 'core') {
                // TODO: Implement differently, like { fetchQ: utils.FetchQueue } or something
                const lowerName = cls.name[0].toLowerCase() + cls.name.slice(1);
                this[lowerName] = new cls(this);
                this.assets = this.assetManager;
            }
        }
        if (type === 'cparts') { // CParts get loaded from DOM
            this.registry.dom[cls.name.toLowerCase()] = cls;
            this.config[cls.name.toLowerCase()].RenderObj = cls.name.toLowerCase();
        }
    }

    loadFromDOM(elem, parentFactoryName = '', skipConf = false) {
        const partialConfs = [];
        for (const node of elem.children) {
            const type = this.getNodeModuloType(node);
            if (!type) {
                continue;
            }

            // TODO: Low hanging fruit to refactor type / name logic here
            const partialConf = this.loadPartialConfigFromNode(node);
            if (!partialConf.Name && 'name' in partialConf) { // TODO: Remove in final refac
                partialConf.Name = partialConf.name;
            }

            let name = partialConf.Name;
            if (parentFactoryName) {
                name = parentFactoryName + '_' + (name || 'default');
                partialConf.Parent = parentFactoryName;
            }
            if (name) {
                const facs = this.factories[type];
                partialConf.Name = name; // ensure Name field is updated
                if (!(name in facs)) {
                    facs[name] = partialConf;
                } else {
                    console.error('WARNING:', type, 'already has a', name);
                    facs[name] = Object.assign(facs[name], partialConf);
                }
            } else {
                this.config[type] = partialConf;
            }
            // XXX Fixes stuff!? -v
            // partialConfs.push(Object.assign({}, partialConf));
            partialConfs.push(Object.assign({}, partialConf));//
        }

        // Then, run configure callback
        if (!skipConf) { // TODO: move this somewhere else, eg "loadAndDefine"
            this.repeatLifecycle(this.registry.cparts, 'configure', () => {
                //console.log('CONFIGURE FINISHED', elem);
                modulo.runLifecycle(modulo.registry.cparts, 'define');
                //console.log('DEFINE FINISHED', elem);
            });
        }
        return partialConfs;
    }

    loadString(text, parentFactoryName = null, shouldSkip = true) {
        const tmp_Cmp = new modulo.registry.cparts.Component({}, {}, modulo);
        tmp_Cmp.dataPropLoad = tmp_Cmp.dataPropMount; // XXX
        this.reconciler = modulo.create('engine', 'Reconciler', {
            directives: { 'modulo.dataPropLoad': tmp_Cmp }, // TODO: Change to "this", + resolve to conf stuff
            directiveShortcuts: [ [ /:$/, 'modulo.dataProp' ] ],
        });
        const div = this.reconciler.loadString(text, {});
        const result = this.loadFromDOM(div, parentFactoryName, shouldSkip);
        return result
    }

    squashFactories() {
        return; // XXX ??? For some reason, this overwrites the default
        // configurations on top of the factory configs (instead of the other
        // way around). Currently disabling, until its clear if it was
        // necessary.
        for (const [ type, facs ] of Object.entries(this.factories)) {
            for (const [ name, conf ] of Object.entries(facs)) {
                facs[name] = Object.assign(conf, this.config[type], conf);
            }
        }
    }

    getLifecyclePatches(lcObj, lifecycleName, skipFacs = false) {
        // todo: Make it lifecycleNames (plural)
        const patches = [];
        const methodName = lifecycleName + 'Callback';
        for (const [ typeUpper, obj ] of Object.entries(lcObj)) {
            if (!(methodName in obj)) {
                continue; // Skip if obj has not registered callback
            }
            const type = typeUpper.toLowerCase();
            patches.push([ obj, methodName, this.config[type] ]);
            if (skipFacs) { continue; } // TODO refactor
            const facs = this.factories[type] || {};
            for (const name of Object.keys(facs)) { // Also invoke factories
                patches.push([ obj, methodName, facs[name] ]);
            }
        }
        return patches;
    }

    getFactoryLifecyclePatches(lcObj, lifecycleName) {
        // todo: refactor with top
        const patches = [];
        const methodName = lifecycleName + 'Callback';
        for (const [ typeUpper, obj ] of Object.entries(lcObj)) {
            if (!(methodName in obj)) {
                continue; // Skip if obj has not registered callback
            }
            const type = typeUpper.toLowerCase();
            const facs = this.factories[type] || {};
            for (const name of Object.keys(facs)) { // Also invoke factories
                patches.push([ obj, methodName, facs[name] ]);
            }
        }
        return patches;
    }

    applyPatches(patches, collectObj = null) {
        for (const [ obj, methodName, conf ] of patches) {
            if (!conf.Type) { // TODO remove this
                console.log('WARNING: Invalid  conf: ', conf);
                continue;
            }
            const result = obj[methodName].call(obj, collectObj || this, conf);
            if (collectObj && result && conf.RenderObj) {
                collectObj[conf.RenderObj] = result;
            }
        }
    }

    runLifecycle(lcObj, lifecycleName) {
        this.squashFactories(); // Ensure factories are squashed with config // TODO: Possibly only squash once?
        const patches = this.getLifecyclePatches(lcObj, lifecycleName);
        this.applyPatches(patches);
    }

    repeatLifecycle(lcObj, lcName, cb) {
        if (!this._repeatTries) {
            this._repeatTries = 0;
        }
        this.assert(this._repeatTries++ < 10, `Max repeat: ${lcName}`);
        this.runLifecycle(lcObj, lcName);
        this.runLifecycle(lcObj, lcName); // TODO: Need to fix this, after Src etc is standardized
        //this.runLifecycle(lcObj, lcName);
        this.fetchQueue.enqueueAll(() => this.repeatLifecycle(lcObj, lcName, cb));
        if (Object.keys(this.fetchQueue.queue).length === 0) {
            delete this._repeatTries;
            cb();
        }
    }

    getNodeModuloType(node) {
        const { tagName, nodeType, textContent } = node;

        // node.nodeType equals 1 if the node is a DOM element (as opposed to
        // text, or comment). Ignore comments, tolerate empty text nodes, but
        // warn on others (since those are typically syntax mistakes).
        if (nodeType !== 1) {
            // Text nodes, comment nodes, etc
            if (nodeType === 3 && textContent && textContent.trim()) {
                console.error('Modulo: Unexpected text:', textContent);
            }
            return null;
        }

        // LEGACY --------------------------------------
        // Determine the name: The tag name, or the type attribute in the case
        // of the alt script-tag syntax (eg `<script type="modulo/Template">`)
        let cPartName = tagName.toLowerCase();
        const splitType = (node.getAttribute('type') || '').split('/');
        if (splitType[0] && splitType[0].toLowerCase() === 'modulo') {
            cPartName = splitType[1];
            cPartName = cPartName.toLowerCase();
        }
        // /LEGACY --------------------------------------

        for (const attrUnknownCase of node.getAttributeNames()) {
            const attr = attrUnknownCase.toLowerCase()
            if (attr in this.registry.dom && !node.getAttribute(attr)) {
                cPartName = attr;
                break;
            }
        }
        if (!(cPartName in this.registry.dom)) {
            console.error('Unknown Modulo def:', cPartName);
            return null;
        }
        return cPartName;
    }

    loadPartialConfigFromNode(node) {
        const { mergeAttrs } = this.registry.utils;
        const partType = this.getNodeModuloType(node);
        const config = mergeAttrs(node, this.config[partType]);
        const content = node.tagName === 'SCRIPT' ? node.textContent : node.innerHTML;
        config.Content = (config.Content || '') + content; // concatenate
        config.Type = partType; // Ensure Type is set as well
        if (config.Type in config && !config[config.Type]) {
            delete config[config.Type]; // Remove attribute name used as type
        }
        return config;
    }

    applyPreprocessor(conf, keys) {
        for (const key of keys) {
            if (key in conf) {
                const value = conf[key];
                delete conf[key];
                this.registry.confPreprocessors[key.toLowerCase()](this, conf, value);
                return;
            }
        }
    }

    assert(value, ...info) {
        if (!value) {
            console.error(...info);
            throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`);
        }
    }
}

// TODO: Move to conf
Modulo.INVALID_WORDS = new Set((`
    break case catch class const continue debugger default delete do else enum
    export extends finally for if implements import in instanceof interface new
    null package private protected public return static super switch throw try
    typeof var let void  while with await async true false
`).split(/\s+/ig));

// Create a new modulo instance to be the global default instance
var modulo = new Modulo(null, [
    'cparts', 'dom', 'utils', 'library', 'core', 'engines', 'commands',
    'templateFilters', 'templateTags', 'directives', 'directiveShortcuts',
    'loadDirectives', 'loadDirectiveShortcuts', 'confPreprocessors',
]);

modulo.register('confPreprocessor', function src (modulo, conf, value) {
    modulo.fetchQueue.enqueue(value, text => {
        conf.Content = (text || '') + (conf.Content || '');
    });
});

modulo.register('confPreprocessor', function content (modulo, conf, value) {
    conf.Children = modulo.loadString(value, conf.Name ? conf.Name : null);
    conf.Hash = modulo.registry.utils.hash(value);
});

modulo.register('cpart', class Component {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src', 'Content' ]);
    }

    static defineCallback(modulo, conf) {
        const { Content, Name, Children } = conf;
        const { stripWord } = modulo.registry.utils;
        if (!Children) {
            return;
        }
        ///* XXX */ console.log('Is it already broken?', JSON.stringify(conf.Children[2]));
        delete conf.Children;
        const cpartTypes = Children.map(({ Type }) => Type);
        const className = stripWord(Name);
        const code = `
            const r = {};
            class ${ className } extends modulo.registry.utils.BaseElement {
                constructor() {
super();
const { deepClone } = modulo.registry.utils;
this.moduloComponentConf = ${ JSON.stringify(conf, null, 1) };
this.moduloChildrenData = ${ JSON.stringify(Children, null, 1) };
this.modulo = modulo;

// NOTE: Currently run factory MULTIPLE TIMES
// TODO: Refactor //
const hackCParts = Object.assign({}, modulo.registry.dom, modulo.registry.cparts);
const cpartClasses = modulo.registry.utils.keyFilter(hackCParts, ${ JSON.stringify(cpartTypes) });
//modulo.repeatLifecycle(cpartClasses, 'factoryLoad', () => {});
//modulo.runLifecycle(cpartClasses, 'factory');
modulo.applyPatches(modulo.getFactoryLifecyclePatches(cpartClasses, 'factory'));
this.initRenderObj = window.facHack;
delete window.facHack;

                }
            }

            modulo.globals.customElements.define(tagName, ${ className });
            LEGACY.push("Registered: ${ className } as " + tagName);
            return ${ className };
            ////////////////////
        `;
        const args = [ 'tagName', 'modulo' ];
        const func = modulo.assets.registerFunction(args, code);
        const { library } = modulo.config;
        const namespace = conf.namespace || library.Name || library.name || 'x';
        conf.Hash = func.hash;
        conf.TagName = (conf.TagName || (namespace + '-' + Name)).toLowerCase();
        conf.namespace = namespace; // ensure updated (todo remove when defaults)
        func(conf.TagName, modulo);
    }

    static factoryCallback(modulo, conf) {
        return; // TODO
        conf.directiveShortcuts = [
            [ /^@/, 'component.event' ],
            [ /:$/, 'component.dataProp' ],
        ];
        conf.uniqueId = ++factory.id;
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
        /*
        this.localNameMap = this.element.factory().loader.localNameMap; // TODO: Fix
        this.mode = this.attrs.mode || 'regular';
        if (this.mode === 'shadow') {
            this.element.attachShadow({ mode: 'open' });
        }
        */
        this.mode = 'regular';
        const opts = { directiveShortcuts: [], directives: [] };
        for (const cPart of Object.values(this.element.cparts)) {
            for (const directiveName of cPart.getDirectives()) {
                opts.directives[directiveName] = cPart;
            }
        }
        this.reconciler = modulo.create('engine', 'Reconciler', opts);
    }

    getDirectives() {
        const dirs = [
            'component.dataPropMount',
            'component.dataPropUnmount',
            'component.eventMount',
            'component.eventUnmount',
            'component.slotLoad',
        ];
        const vanishTags = [ 'link', 'title', 'meta', 'script' ];
        if (this.attrs.mode === 'vanish-into-document') {
            dirs.push(...vanishTags);
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
                this.modulo.assert(this.mode === 'custom-root', 'Err:', this.mode);
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
        const { resolveDataProp } = this.modulo.registry.utils;
        const get = (key, key2) => resolveDataProp(key, el, key2 && get(key2));
        const func = get(attrName);
        this.modulo.assert(func, `No function found for ${rawName} ${value}`);
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
        const { get, set } = modulo.registry.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
            el.dataPropsAttributeNames = {};
        }
        const isVar = /^[a-z]/i.test(value) && !Modulo.INVALID_WORDS.has(value);
        const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        let val = isVar ? get(renderObj, value) : JSON.parse(value);
        /* XXX */ if (attrName === 'click' && !val) { val = ()=> console.log('XXX ERROR: (DEBUGGING Wrong Script Tag) click is undefined'); }
        //modulo.assert(val !== undefined, 'Error: Cannot assign value "undefined" to dataProp')
        set(el.dataProps, attrName, val); // set according to path given
        el.dataPropsAttributeNames[rawName] = attrName;
        ///* XXX */ if (attrName === 'click') { console.log('XXX click', el, value, val); }
    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }
}, { mode: 'regular', rerender: 'event', engine: 'Reconciler' });

modulo.register('cpart', class Modulo {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src', 'Content' ]);
    }
});

//                v- Later put somewhere more appropriate
modulo.register('util', Modulo);

modulo.register('cpart', class Library {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src', 'Content' ]);
        let { Content, Src, Hash, src, Name, name, namespace } = conf;
        const { hash } = modulo.registry.utils;
        const regName = (Name || name || namespace || 'x').toLowerCase();
        if (Hash) {
            delete conf.Content; // Prevent repeat
            delete conf.Hash; // Prevent repeat
            let libName = regName;
            if (libName === 'x') { // TODO fix this stuff, default to FN?
                libName = 'm-' + conf.Hash;
            }
            let libraryModulo = modulo.registry.library[libName];
            if (!libraryModulo) { // No existing library, fork into new one
                libraryModulo = new modulo.registry.utils.Modulo(modulo);
                libraryModulo.name = libName; // ".name" is for register()
                modulo.register('library', libraryModulo);
            }
            const oldConf = libraryModulo.config.library || {};
            libraryModulo.config.library = Object.assign(oldConf, conf);
            libraryModulo.loadString(Content);
            libraryModulo.runLifecycle(libraryModulo.registry.cparts, 'configure');
            conf.RegName = regName; // Ensure RegName is set on conf as well
            conf.LibName = libName; // ditto
        }
    }
    static defineCallback(modulo, conf) {
        if (conf.LibName) {
            delete conf.LibName; // idempotent
            const library = modulo.registry.library[conf.LibName];
            library.runLifecycle(library.registry.cparts, 'define');
        }
    }
});

modulo.register('util', function keyFilter (obj, func) {
    const keys = func.call ? Object.keys(obj).filter(func) : func;
    return Object.fromEntries(keys.map(key => [ key, obj[key] ]));
});

modulo.register('util', function cloneStub (obj, stubFunc = null) {
    const clone = {};
    stubFunc = stubFunc || (() => ({}));
    for (const key of Object.keys(obj)) {
        clone[key] = stubFunc(obj);
    }
    return clone;
});

// TODO: pass in modulo more consistently
modulo.register('util', function deepClone (obj, modulo) {
    if (obj === null || typeof obj !== 'object' || (obj.exec && obj.test)) {
        return obj;
    }

    const { constructor } = obj;
    if (constructor.moduloClone) {
        // Use a custom modulo-specific cloning function
        return constructor.moduloClone(modulo, obj);
    }
    const clone = new constructor();
    const { deepClone } = modulo.registry.utils;
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = deepClone(obj[key], modulo);
        }
    }
    return clone;
});

modulo.register('util', function resolveDataProp (key, elem, defaultVal) {
    if (elem.dataProps && key in elem.dataProps) {
        return elem.dataProps[key];
    }
    return elem.hasAttribute(key) ? elem.getAttribute(key) : defaultVal;
});

/*
modulo.register('util', function subObject (obj, array) {
    return Object.fromEntries(array.map(key => [ key, obj[key] ])); // TODO: rm
});
*/

modulo.register('util', function cleanWord (text) {
    // todo: should merge with stripWord ? See if "strip" functionality is enough
    return (text + '').replace(/[^a-zA-Z0-9$_\.]/g, '') || '';
});

modulo.register('util', function stripWord (text) {
    return text.replace(/^[^a-zA-Z0-9$_\.]/, '')
               .replace(/[^a-zA-Z0-9$_\.]$/, '');
});


modulo.register('util', function mergeAttrs (elem, defaults) {
    // TODO: Write unit tests for this
    const camelcase = s => s.replace(/-([a-z])/g, g => g[1].toUpperCase());
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
});

modulo.register('util', function hash (str) {
    // Simple, insecure, "hashCode()" implementation. Returns base32 hash
    let h = 0;
    for(let i = 0; i < str.length; i++) {
        //h = ((h << 5 - h) + str.charCodeAt(i)) | 0;
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return (h || 0).toString(32).replace(/-/g, 'x');
});

modulo.register('util', function makeDiv(html) {
    /* TODO: Have an options for doing <script  / etc preprocessing here:
      <state -> <script type="modulo/state"
      <\s*(state|props|template)([\s>]) -> <script type="modulo/\1"\2
      </(state|props|template)> -> </script>*/
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
});


modulo.register('util', function normalize(html) {
    // Normalize space to ' ' & trim around tags
    return html.replace(/\s+/g, ' ').replace(/(^|>)\s*(<|$)/g, '$1$2').trim();
});

modulo.register('util', function saveFileAs(filename, text) {
    const doc = Modulo.globals.document;
    const element = doc.createElement('a');
    const enc = encodeURIComponent(text); // TODO silo in globals
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + enc);
    element.setAttribute('download', filename);
    doc.body.appendChild(element);
    element.click();
    doc.body.removeChild(element);
    return `./${filename}`; // by default, return local path
});

modulo.register('util', function get(obj, key) {
    // TODO:  It's get that should autobind functions!!
    return key.split('.').reduce((o, name) => o[name], obj);
});

modulo.register('util', function set(obj, keyPath, val, ctx = null) {
    const index = keyPath.lastIndexOf('.') + 1; // 0 if not found
    const key = keyPath.slice(index);
    const path = keyPath.slice(0, index - 1); // exclude .
    //const dataObj = index ? Modulo.utils.get(obj, path) : obj;
    const dataObj = index ? modulo.registry.utils.get(obj, path) : obj;
    dataObj[key] = val;// typeof val === 'function' ? val.bind(ctx) : val;
});

modulo.register('util', function dirname(path) {
    return (path || '').match(/.*\//);
});

modulo.register('util', function resolvePath(workingDir, relPath) {
    // TODO: Fix, refactor
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
});


modulo.register('util', function prefixAllSelectors(namespace, name, text='') {
    // NOTE - has old tests that can be resurrected
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

        // Upgrade the ":host" pseudo-element to be the full name (since
        // this is not a Shadow DOM style-sheet)
        selector = selector.replace(new RegExp(/:host(\([^)]*\))?/, 'g'), hostClause => {
            // TODO: this needs more thorough testing
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
});


// TODO: Since CPart will eventually have no base class, merge this
// with the Component CPart:
modulo.register('util', class BaseElement extends HTMLElement {
    constructor() {
        super();
        this.initialize();
    }

    initialize() {
        this.cparts = {};
        this.isMounted = false;
        this.isModulo = true;
        this.originalHTML = null;
        this.originalChildren = [];
        //this.fullName = this.factory().fullName;
        //this.initRenderObj = Object.assign({}, this.baseRenderObj);
        //console.log('this is initRenderObj', this.initRenderObj);
    }

    rerender(original = null) {
        /*
        if (original) { // TODO: this logic needs refactor
            if (this.originalHTML === null) {
                this.originalHTML = original.innerHTML;
            }
            this.originalChildren = Array.from(original.hasChildNodes() ?
                                               original.childNodes : []);
        }
        */
        this.lifecycle([ 'prepare', 'render', 'reconcile', 'update' ]);
    }

    lifecycle(lifecycleNames, rObj={}) {
        this.renderObj = Object.assign({}, rObj, this.getCurrentRenderObj());
        for (const lc of lifecycleNames) {
            const patches = this.modulo.getLifecyclePatches(this.cparts, lc, true);
            this.modulo.applyPatches(patches, this.renderObj);
        }
        //this.renderObj = null; // ?rendering is over, set to null
    }

    getCurrentRenderObj() {
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }

    connectedCallback() {
        if (!this.isMounted) {
            setTimeout(() => this.parsedCallback(), 0);
        }
    }

    parsedCallback() {
        let original = this;
        /*
        if (this.hasAttribute('modulo-original-html')) {
            original = modulo.registry.utils.makeDiv(this.getAttribute('modulo-original-html'));
        }
        */
        this.moduloChildrenData.unshift(this.moduloComponentConf); // Add in the Component def itself
        this.cparts = this.modulo.createAll('cparts', this.moduloChildrenData);
        this.legacySetupCParts();
        this.lifecycle([ 'initialized' ]);
        this.rerender(original); // render and re-mount it's own childNodes

        /*
        // (todo) Needs refactor, should do this somewhere else:
        if (this.hasAttribute('modulo-original-html')) {
            const { reconciler } = this.cparts.component;
            reconciler.patch = reconciler.applyPatch; // Apply patches immediately
            reconciler.patchAndDescendants(this, 'Mount');
            reconciler.patch = reconciler.pushPatch;
        }
        */
        this.isMounted = true;
    }

    legacySetupCParts() {
        for (const conf of this.moduloChildrenData) {
            /// TODO HAX
            const instance = this.cparts[conf.RenderObj];
            const isLower = key => key[0].toLowerCase() === key[0];
            instance.element = this;
            instance.modulo = this.modulo;
            instance.conf = conf;
            instance.attrs = modulo.registry.utils.keyFilter(conf, isLower);
            /// HAX
        }
        //this.cpartSpares = {};
        //const hackCParts = Object.assign({}, this.modulo.registry.dom, this.modulo.registry.cparts);
    }
});

modulo.register('core', class AssetManager {
    constructor (modulo) {
        this.modulo = modulo;
        this.functions = {};
        this.stylesheets = {};
        this.rawAssets = { js: {}, css: {} };
    }

    getAssets(type, extra = null) {
        // Get an array of assets of the given type, in a stable ordering
        // TODO: This is incorrect: It needs to be ordered like it was in the
        // original document. Sorting will cause JS / CSS files to be loaded in
        // wrong order:
        return (extra || []).concat(Object.values(this.rawAssets[type]).sort());
    }

    registerFunction(params, text, opts = {}) {
        // Checks if text IS the hash, in which case use that, otherwise gen hash
        const hash = text in this.functions ? text : this.getHash(params, text);
        if (!(hash in this.functions)) {
            const funcText = this.wrapFunctionText(params, text, opts, hash);
            this.rawAssets.js[hash] = funcText; // "use strict" only in tag
            this.appendToHead('script', '"use strict";\n' + funcText);
            this.functions[hash].hash = hash;
        }
        return this.functions[hash];
    }

    registerStylesheet(text) {
        const hash = this.modulo.registry.utils.hash(text);
        if (!(hash in this.stylesheets)) {
            this.stylesheets[hash] = true;
            this.rawAssets.css[hash] = text;
            this.appendToHead('style', text);
        }
    }

    getSymbolsAsObjectAssignment(contents) {
        const regexpG = /(function|class)\s+(\w+)/g;
        const regexp2 = /(function|class)\s+(\w+)/; // hack, refactor
        const matches = contents.match(regexpG) || [];
        return matches.map(s => s.match(regexp2)[2])
            .filter(s => s && !Modulo.INVALID_WORDS.has(s))
            .map(s => `"${s}": typeof ${s} !== "undefined" ? ${s} : undefined,\n`)
            .join('');
    }

    wrapFunctionText(params, text, opts = {}, hash = null) {
        // TODO: e.g. change public API to this, make opts & hash required
        let prefix = `modulo.assets.functions["${hash || this.getHash(params, text)}"]`;
        prefix += `= function ${ opts.funcName || ''}(${ params.join(', ') }){`;
        let suffix = '};'
        if (opts.exports) {
            const symbolsString = this.getSymbolsAsObjectAssignment(text);
            // TODO test: params = params.filter(text.includes.bind(text)); // Slight optimization
            const localVarsIfs = params.map(n => `if (name === '${n}') ${n} = value;`).join(' ');
            prefix += `var ${ opts.exports } = { exports: {} };  `;
            prefix += `function __set(name, value) { ${ localVarsIfs } }`;
            suffix = `return { ${symbolsString} setLocalVariable: __set, exports: ${ opts.exports }.exports}\n};`;
        }
        return `${prefix}\n${text}\n${suffix}`;
    }

    getHash(params, text) {
        const { hash } = this.modulo.registry.utils;
        return hash(params.join(',') + '|' + text);
    }

    appendToHead(tagName, codeStr) {
        const doc = this.modulo.globals.document;
        const elem = doc.createElement(tagName);
        elem.setAttribute('modulo-asset', 'y'); // Mark as an "asset"
        if (doc.head === null) {
            // TODO: NOTE: this is still broken, can still trigger before head
            // is created!
            setTimeout(() => doc.head.append(elem), 0);
        } else {
            doc.head.append(elem);
        }
        elem.textContent = codeStr; // Blocking, causes eval
    }
});

modulo.register('core', class FetchQueue {
    constructor(modulo) {
        this.modulo = modulo;
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

        // TODO: FIX THIS ---v
        //src = this.modulo.registry.utils.resolvePath(this.basePath || '', src);
        src = (this.basePath || '') + src;

        if (src in this.data) {
            callback(this.data[src], label, src); // Synchronous route
        } else if (!(src in this.queue)) {
            this.queue[src] = [ callback ];
            // TODO: Think about if we want to keep cache:no-store
            //console.log('FETCH', src);
            this.modulo.globals.fetch(src, { cache: 'no-store' })
                .then(response => response.text())
                .then(text => this.receiveData(text, label, src))
                //.catch(err => console.error('Modulo Load ERR', src, err));
        } else {
            this.queue[src].push(callback); // add to end of src queue
        }
    }

    receiveData(text, label, src) {
        this.data[src] = text; // load data
        const queue = this.queue[src];
        delete this.queue[src]; // delete queue
        queue.forEach(func => func(text, label, src));
        this.checkWait();
    }

    enqueueAll(callback) {
        const allQueues = Array.from(Object.values(this.queue));
        let callbackCount = 0;
        for (const queue of allQueues) {
            queue.push(() => {
                callbackCount++;
                //console.log('callbackCount', callbackCount, callbackCount >= allQueues.length);
                if (callbackCount >= allQueues.length) {
                    callback();
                }
            });
        }
    }

    wait(callback) {
        //console.log({ wait: Object.keys(this.queue).length === 0 }, Object.keys(this.queue));
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
});


modulo.register('cpart', class Props {
    getDirectives() {  LEGACY.push('props.getDirectives'); return []; }

    initializedCallback(renderObj) {
        const props = {};
        const { resolveDataProp } = modulo.registry.utils;
        for (const [ propName, def ] of Object.entries(this.attrs)) {
            props[propName] = resolveDataProp(propName, this.element, def);
            // TODO: Implement type-checked, and required
        }
        return props;
    }

    prepareCallback(renderObj) {
        /* TODO: Remove after observedAttributes is implemented, e.g.:
          static legacy_factoryCallback({ attrs }, { componentClass }, renderObj) {
              //componentClass.observedAttributes = Object.keys(attrs);
          }
        */
        return this.initializedCallback(renderObj);
    }
});


modulo.register('cpart', class Style {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src' ]);
    }

    getDirectives() {  LEGACY.push('style.getDirectives'); return []; }

    static factoryCallback(modulo, conf) {
        /*
        //if (loadObj.component.attrs.mode === 'shadow') { // TODO finish
        //    return;
        //}
        */
        let { Content, Parent } = conf;
        if (!Content) {
            return;
        }
        if (Parent && (Parent in modulo.factories.component)) {
            const { namespace, mode, Name } = modulo.factories.component[Parent];
            if (mode === 'regular') { // TODO finish
                const { prefixAllSelectors } = modulo.registry.utils;
                Content = prefixAllSelectors(namespace, Name, Content);
            }
        }
        modulo.assets.registerStylesheet(Content);
    }

    initializedCallback(renderObj) {
        const { component, style } = renderObj;
        if (component && component.attrs && component.attrs.mode === 'shadow') { // TODO Finish
            console.log('Shadow styling!');
            const style = Modulo.globals.document.createElement('style');
            style.setAttribute('modulo-ignore', 'true');
            style.textContent = style.content;// `<style modulo-ignore>${style.content}</style>`;
            this.element.shadowRoot.append(style);
        }
    }
});


modulo.register('cpart', class Template {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src' ]);
    }
    getDirectives() {  LEGACY.push('template.getDirectives'); return []; }

    static factoryCallback(modulo, conf) {
        if (!conf.Content) {
            console.error('No Template Content specified.', conf);
            return; // TODO: Make this never happen
        }
        modulo.create('engine', 'Templater', conf);
    }

    constructor(modulo, conf) {
        if (conf && !conf.Instance) { // TODO: Remove, needed for tests
            modulo.create('engine', 'Templater', conf);
        }
        /* XXX */ if (conf.Instance && conf.Instance.Instance) { console.error('Peculiar: conf.Instance.Instance', conf.Instance); conf.Instance = conf.Instance.Instance }
        this.Instance = conf.Instance;
    }

    prepareCallback(renderObj) {
        // Exposes templates in render context, so stuff like
        // "|renderas:template.row" works
        return;// (todo: remove when render context is stabilized)
        const obj = {};
        for (const template of this.element.cpartSpares.template) {
            obj[template.attrs.name || 'regular'] = template;
            //obj[template.name || 'regular'] = template;
        }
        return obj;
    }

    renderCallback(renderObj) {
        if (!renderObj.component)renderObj.component={};// XXX fix
        /* XXX */ if (!this.Instance || !this.Instance.render) { console.error('!this.Instance', this.Instance); this.modulo.create('engine', 'Templater', this.Instance); } else {
        renderObj.component.innerHTML = this.Instance.render(renderObj);
        /* XXX */ }
    }
});

modulo.register('cpart', class StaticData {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src' ]);
    }
    static factoryCallback(modulo, conf) {
        if (!conf.Content) {
            console.error('No StaticData Content specified.', conf);
            return; // TODO: Make this never happen
        }
        //const defTransform = s => `return ${s.trim()};`;
        //(s => `return ${JSON.stringify(JSON.parse(s))}`);
        //const transform = conf.attrs.transform || defTransform;
        let code = (conf.Content || '').trim();
        code = `return ${ code };`;
        const data = modulo.assets.registerFunction([], code)();
        Object.assign(conf, data);

        // HACK ----------------------------------
        if (!window.facHack){ window.facHack = {}; }
        window.facHack[conf.Type.toLowerCase()] = conf;
    }

    getDirectives() { console.count("getDirectives"); return []; } // XXX
});

modulo.register('cpart', class Script {
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src' ]);
    }

    static factoryCallback(modulo, conf) {
        const code = conf.Content || ''; // TODO: trim whitespace?
        const localVars = Object.keys(modulo.registry.dom);// TODO fix...
        localVars.push('element'); // add in element as a local var
        localVars.push('cparts'); // give access to CParts JS interface

        // Combine localVars + fixed args into allArgs
        const args = [ 'modulo', 'require' ];
        const allArgs = args.concat(localVars.filter(n => !args.includes(n)));
        const opts = { exports: 'script' };
        //console.log('SCRIPT TAG factoryCallback - REGSITERING', code);
        const func = modulo.assets.registerFunction(allArgs, code, opts);

        // Now, actually run code in Script tag to do factory method
        const results = func.call(null, modulo, this.require);
        results.localVars = localVars;
        modulo.assert(!('factoryCallback' in results), 'factoryCallback LEGACY');

        // HACK ----------------------------------
        if (!window.facHack){ window.facHack = {}; }
        window.facHack[conf.Type.toLowerCase()] = results;
    }

    getDirectives() {
        LEGACY.push('script.getDirectives');
        let { script } = this.element.initRenderObj;
        const isCbRegex = /(Unmount|Mount)$/;
        if (!script) { script = {}; } // TODO XXX
        return Object.keys(script)
            .filter(key => key.match(isCbRegex))
            .map(key => `script.${key}`);
    }

    cb(func) {
        // DEAD-ish CODE (used in documentation, needs replacement...)
        const renderObj = this.element.getCurrentRenderObj();
        return (...args) => {
            this.prepLocalVars(renderObj);
            func(...args);
            //this.clearLocalVariables(renderObj); // should do, set to "Invalid wrapped"
        };
    }

    constructor(modulo, conf) {
        //let { script } = element.initRenderObj;
        let script = conf;
        //console.log('this is script', conf);
        // Attach callbacks from script to this, to hook into lifecycle.
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

    // ## AssetManager: prepLocalVars
    // To allow for local variables access to APIs provided by other CParts,
    // sets local variables equal to the data returned by their callbacks.
    // This is important: It's what enables us to avoid using the "this"
    // context, since the current element is set before any custom code is run.
    prepLocalVars(renderObj) {
        if (!renderObj.script) {
            console.error('ERROR: Script CPart missing from renderObj:', renderObj);
            return false;
        }
        const { setLocalVariable, localVars } = renderObj.script;
        setLocalVariable('element', this.element);
        setLocalVariable('cparts', this.element.cparts);
        for (const localVar of localVars) {
            if (localVar in renderObj) {
                setLocalVariable(localVar, renderObj[localVar]);
            }
        }
    }
});

modulo.register('cpart', class State {
    getDirectives() {
        LEGACY.push('state.getDirectives');
        return [ 'state.bindMount', 'state.bindUnmount' ];
    }

    initializedCallback(renderObj) {
        if (!this.data) {
            // Initialize with deep copy of attributes
            let { attrs } = this;
            if (attrs && attrs.attrs) { // TODO: Hack code here, not sure why its like this
                attrs = attrs.attrs;
            }
            this.data = Object.assign({}, attrs);
            // TODO: Need to do proper deep-copy... is this okay?
            this.data = JSON.parse(JSON.stringify(this.data));
        }

        this.boundElements = {}; // initialize
        return this.data;
    }

    bindMount({ el, attrName, value }) {
        // TODO: BUG: This should be attrName || el.getATtribute('name') (todo:
        // write failing tests, then flip and see green)
        const name = el.getAttribute('name') || attrName;
        const val = modulo.registry.utils.get(this.data, name);
        this.modulo.assert(val !== undefined, `state.bind "${name}" is undefined`);
        const listen = () => {
            // TODO: Refactor this function + propagate to be more consistent +
            // extendable with types / conversions -- MAYBE even just attach it
            // as stateChangeCallback!
            let { value, type, checked, tagName } = el;
            if (type && type === 'checkbox') {
                value = !!checked;
            } else if (type && (type === 'range' || type === 'number')) {
                value = Number(value); // ensure ranges & numbers get evaled
            }
            this.set(name, value, el);
        };
        const isText = el.tagName === 'TEXTAREA' || el.type === 'text';
        const evName = value ? value : (isText ? 'keyup' : 'change');
        //assert(!this.boundElements[name], `[state.bind]: Duplicate "${name}"`);

        if (!(name in this.boundElements)) {
            this.boundElements[name] = [];
        }
        this.boundElements[name].push([ el, evName, listen ]);
        el.addEventListener(evName, listen); // todo: make optional, e.g. to support cparts?
        this.propagate(name, val); // trigger initial assignment(s)
    }

    bindUnmount({ el, attrName }) {
        const name = el.getAttribute('name') || attrName;
        const remainingBound = [];
        if (!(name in this.boundElements)) { // XXX HACK
            console.log('Modulo ERROR: Could not unbind', name);
            return;
        }
        for (const row of this.boundElements[name]) {
            if (row[0] === el) {
                row[0].removeEventListener(row[1], row[2]);
            } else {
                remainingBound.push(row);
            }
        }
        this.boundElements[name] = remainingBound;
    }

    set(name, value, originalEl) {
        /* if (valueOrEv.target) { this.data[valueOrEv.target.name] = name; } else { } if ((name in this.boundElements) && this.boundElements[name].length > 1) { } */
        modulo.registry.utils.set(this.data, name, value);
        this.propagate(name, value, originalEl);
        this.element.rerender();
    }

    eventCallback() {
        this._oldData = Object.assign({}, this.data);
    }

    propagate(name, val, originalEl = null) {
        for (const [ el, evName, cb ] of (this.boundElements[name] || [])) {
            if (originalEl && el === originalEl) {
                continue; // don't propagate to self
            }
            if (el.stateChangedCallback) {
                el.stateChangedCallback(name, val, originalEl);
            } else if (el.type === 'checkbox') {
                el.checked = !!val; // ensure is bool
            } else {
                el.value = val;
            }
        }
    }

    eventCleanupCallback() {
        // TODO: Instead, should JUST do _oldData with each key from boundElements, and thus more efficiently loop through
        for (const name of Object.keys(this.data)) {
            this.modulo.assert(name in this._oldData, `There is no "state.${name}"`);
            const val = this.data[name];
            if (name in this.boundElements && val !== this._oldData[name]) {
                this.propagate(name, val);
            }
        }
        this._oldData = null;
    }
});


/* Implementation of Modulo Templating Language */
modulo.register('engine', class Templater {
    constructor(modulo, conf) {
        this.makeFunc = (a, b) => modulo.assets.registerFunction(a, b);
        this.setup(conf.Content, conf); // TODO, refactor
    }

    setup(text, options) {
        Object.assign(this, modulo.config.templater, options);
        this.filters = Object.assign({}, modulo.registry.templateFilters, this.filters);
        this.tags = Object.assign({}, modulo.registry.templateTags, this.tags);
        if (text) {
            this.compiledCode = this.compile(text);
            const unclosed = this.stack.map(({ close }) => close).join(', ');
            modulo.assert(!unclosed, `Unclosed tags: ${ unclosed }`); // TODO: use global!
        }
        if (!this.renderFunc) {
            this.renderFunc = this.makeFunc([ 'CTX', 'G' ], this.compiledCode);
        }
    }

    static moduloClone(modulo, other) {
        // Possible idea: Return a serializable array as args for new()
        return new this('', other);
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
        return string.split(RegExp(regExpText));
    }

    parseVal(string) {
        // Parses string literals, de-escaping as needed, numbers, and context
        // variables
        const { cleanWord } = modulo.registry.utils;
        const s = string.trim();
        if (s.match(/^('.*'|".*")$/)) { // String literal
            return JSON.stringify(s.substr(1, s.length - 2));
        }
        return s.match(/^\d+$/) ? s : `CTX.${cleanWord(s)}`
    }

    /*
    nextMode(mode, token) {
        // Dead code, might be useful for extension
        return (mode === 'text') ? null : (mode ? 'text' : token);
    }
    */

    escapeText(text) {
        if (text && text.safe) {
            return text;
        }
        return (text + '').replace(/&/g, '&amp;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
    }
}, {
    modeTokens: ['{% %}', '{{ }}', '{# #}'],
    opTokens: '==,>,<,>=,<=,!=,not in,is not,is,in,not,gt,lt',
    makeFunc: (argList, text) => new Function(argList.join(','), text),
    opAliases: {
        '==': 'X === Y',
        'is': 'X === Y',
        'gt': 'X > Y',
        'lt': 'X < Y',
        'is not': 'X !== Y',
        'not': '!(Y)',
        'in': '(Y).includes ? (Y).includes(X) : (X in Y)',
        'not in': '!((Y).includes ? (Y).includes(X) : (X in Y))',
    },
});

// TODO: Consider patterns like this to avoid excess reapplication of
// filters:
// (x = X, y = Y).includes ? y.includes(x) : (x in y)

modulo.config.templater.modes = {
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
    '{{': (text, tmplt) => `OUT.push(G.escapeText(${tmplt.parseExpr(text)}));`,
    text: (text, tmplt) => text && `OUT.push(${JSON.stringify(text)});`,
};

modulo.config.templater.filters = (function () {
    //const { get } = modulo.registry.utils; // TODO, fix this code duplciation
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
        dividedinto: (s, arg) => Math.ceil((s * 1) / (arg * 1)),
        escapejs: s => JSON.stringify(String(s)).replace(/(^"|"$)/g, ''),
        first: s => s[0],
        join: (s, arg) => s.join(arg === undefined ? ", " : arg),
        json: (s, arg) => JSON.stringify(s, null, arg || undefined),
        last: s => s[s.length - 1],
        length: s => s.length !== undefined ? s.length : Object.keys(s).length,
        lower: s => s.toLowerCase(),
        multiply: (s, arg) => (s * 1) * (arg * 1),
        number: (s) => Number(s),
        pluralize: (s, arg) => (arg.split(',')[(s === 1) * 1]) || '',
        subtract: (s, arg) => s - arg,
        truncate: (s, arg) => ((s.length > arg*1) ? (s.substr(0, arg-1) + '…') : s),
        type: s => s === null ? 'null' : (Array.isArray(s) ? 'array' : typeof s),
        renderas: (rCtx, template) => safe(template.Instance.render(rCtx)),
        reversed: s => Array.from(s).reverse(),
        upper: s => s.toUpperCase(),
    };
    const { values, keys, entries } = Object;
    const extra = { get, jsobj, safe, sorted, values, keys, entries };
    return Object.assign(filters, extra);
})();

modulo.config.templater.tags = {
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
        const { cleanWord } = modulo.registry.utils;
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
modulo.register('engine', class DOMCursor {
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
            this.modulo.assert(matchedRival !== rival, 'Dupe!'); // (We know this due to ordering)
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
});

modulo.register('engine', class Reconciler {
    constructor(modulo, conf) {
        this.constructor_old(conf);
    }
    constructor_old(opts) {
        opts = opts || {};
        this.shouldNotDescend = !!opts.doNotDescend;
        this.directives = opts.directives || {};
        this.tagTransforms = opts.tagTransforms;
        this.directiveShortcuts = opts.directiveShortcuts || [];
        if (this.directiveShortcuts.length === 0) { // XXX horrible HACK
            console.error('this.directiveShortcuts.length === 0');
            this.directiveShortcuts = [
                [ /^@/, 'component.event' ],
                [ /:$/, 'component.dataProp' ],
            ];
        }
        this.patch = this.pushPatch;
        this.patches = [];
    }

    parseDirectives(rawName, directiveShortcuts) { //, foundDirectives) {
        if (/^[a-z0-9-]$/i.test(rawName)) {
            return null; // if alpha-only, stop right away
            // TODO: If we ever support key= as a shortcut, this will break
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
        const { cleanWord, stripWord } = modulo.registry.utils; // TODO global modulo
        const arr = [];
        const attrName = stripWord((name.match(/\][^\]]+$/) || [ '' ])[0]);
        for (const directiveName of name.split(']').map(cleanWord)) {
            // Skip the bare name itself, and filter for valid directives
            if (directiveName !== attrName) {// && directiveName in directives) {
                arr.push({ attrName, rawName, directiveName, name })
            }
        }
        return arr;
    }

    loadString(rivalHTML, tagTransforms) {
        this.patches = [];
        const rival = modulo.registry.utils.makeDiv(rivalHTML);
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
                modulo.registry.utils.transformTag(node, newTag);
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
        const cursor = new modulo.registry.engines.DOMCursor(childParent, rivalParent);

        //console.log('Reconciling (1):', childParent.outerHTML);
        //console.log('Reconciling (2):', rivalParent.outerHTML);

        while (cursor.hasNext()) {
            const [ child, rival ] = cursor.next();

            //console.log('NEXT', child, rival, cursor.hasNext());
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

                //console.log('NODE', child.isEqualNode(rival), child.innerHTML, rival.innerHTML);
                if (child.nodeType !== 1) { // text or comment node
                    if (child.nodeValue !== rival.nodeValue) { // update
                        this.patch(child, 'node-value', rival.nodeValue);
                    }
                } else if (!child.isEqualNode(rival)) { // sync if not equal
                    //console.log('NOT EQUAL', child, rival);
                    this.reconcileAttributes(child, rival);

                    if (rival.hasAttribute('modulo-ignore')) {
                        //console.log('Skipping ignored node');
                    } else if (child.isModulo) { // is a Modulo component
                        // TODO: Instead of having one big "rerender" patch,
                        // maybe run a "rerender" right away, but collect
                        // patches, then insert in the patch list here?
                        // Could have renderObj = { component: renderContextRenderObj ... }
                        // And maybe even then dataProps resolve like:
                        // renderObj.component.renderContextRenderObj || renderObj;
                        // OR: Maybe even a simple way to reuse renderObj?
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
        //if (!node || !node[method]) { console.error('NO NODE:', node, method, arg, arg2) } // XXX
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
        const foundDirectives = this.parseDirectives(rawName, this.directiveShortcuts);
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
});


/*
//////////////////////////////////////////////////////
// LEGACY ADAPTORS BELOW--- //////////////////////////
if ((window.ModuloPrevious && window.ModuloPrevious.defineAll) || window.doDefineAll) {
    Modulo.ComponentPart = class ComponentPart {
        // Legacy CPart interface
        static getAttrDefaults(node, loader) { return {}; }
        static factoryCallback(modulo, conf) {
            if (!this.legacy_factoryCallback) { return; }
            if (!window.facHack){ window.facHack = {}; }
            class mock {};
            mock.modulo = modulo;
            window.facHack[conf.Type.toLowerCase()] = conf;
            const data = (this.legacy_factoryCallback(conf, mock, window.facHack) || conf);
            window.facHack[conf.Type.toLowerCase()] = data;
        }
        getDirectives() { return []; }
        constructor(element, options, modulo) {
            const isLower = key => key[0].toLowerCase() === key[0];
            const attrs = modulo.registry.utils.keyFilter(options, isLower);
            this.element = element;
            this.content = options.Content;
            this.attrs = attrs;
            this.modulo = modulo;
        }
    }
    Modulo.defineAll = () => {
        console.count('LEGACY: defineAll');
        // OVERRIDE Modulo class to point to legacy modulo
        window.Modulo = window.ModuloPrevious;

        // Copy over legacy cpart definition system
        for (const type of [ 'cparts', 'utils' ]) {
            const reg = window.Modulo[type];
            for (const key of Object.keys(reg)) {
                if (!(key in modulo.registry[type]) &&
                      !(key in modulo.registry.dom)) {
                    console.log('LEGACY: Patching', type, key)
                    const cls = reg[key];
                    if (!cls.name) {
                        cls.name = key;
                    }
                    modulo.register(type, cls);
                    //delete reg[key];
                }
            }
        }
        Modulo.defineAll2();
    }
    Modulo.defineAll2 = () => {
        modulo.globals = window;

        const query = 'template[modulo-embed],modulo';
        for (const elem of document.querySelectorAll(query)) {
            modulo.loadString(elem.innerHTML, null, false);
        }
        modulo.fetchQueue.wait(() => {
            Modulo.factoryInstances = {};
        });
    };
} else 
*/

if (typeof document !== undefined && document.head) { // Browser environ
    Modulo.globals = window; // TODO, remove?
    modulo.globals = window;
    modulo.loadFromDOM(document.head);
    console.log('%c%', 'font-size: 30px; line-height: 0.7; padding: 5px; border: 3px solid black;', (new (class COMMANDS________________ {
        get test() { return modulo.registry.commands.test(modulo) }
        get build() { return modulo.registry.commands.build(modulo) }
        get bundle() { return modulo.registry.commands.bundle(modulo) }
    })));
    //})).__proto__); // TODO: .__proto__ is better in firefox, saves one click, without is better in chrome
    //Misc command idea:
    // - Allow adding something like: ?modulo-runcommand=test

} else if (typeof exports !== undefined) { // Node.js / silo'ed script
    exports = { Modulo, modulo };
}
