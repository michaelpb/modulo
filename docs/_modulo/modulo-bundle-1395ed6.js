const LEGACY = []; // XXX
window.LEG = LEGACY;

// Avoid overwriting other Modulo versions / instances
window.ModuloPrevious = window.Modulo;
window.moduloPrevious = window.modulo;

window.Modulo = class Modulo {
    constructor(parentModulo = null, registryKeys = null) {
        // Note: parentModulo arg is being used by mws/Demo.js
        window._moduloID = this.id = (window._moduloID || 0) + 1; // Global ID

        this.defs = {};
        this.parentDefs = {};

        if (parentModulo) {
            this.parentModulo = parentModulo;

            const { deepClone, cloneStub } = modulo.registry.utils;
            this.config = deepClone(parentModulo.config, parentModulo);
            this.registry = deepClone(parentModulo.registry, parentModulo);

            this.assets = parentModulo.assetManager;
            this.globals = parentModulo.globals;
        } else {
            this.config = {};
            this.registry = Object.fromEntries(registryKeys.map(cat => [ cat, {} ] ));
        }
    }

    static moduloClone(modulo, other) {
        return modulo; // Never clone Modulos to prevent reference loops
    }

    create(type, name, conf = null) {
        type = (`${type}s` in this.registry) ? `${type}s` : type; // plural / singular
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
            window.m[cls.name] = () => cls(this);
        }

        if (cls.name[0].toUpperCase() === cls.name[0]) { // is CapFirst
            const conf = Object.assign({ Type: cls.name }, cls.defaults, defaults);
            this.config[cls.name.toLowerCase()] = conf;

            // Global / core utility class getting registered
            if (type === 'core') {
                // TODO: Implement differently, like { fetchQ: utils.FetchQueue
                // } or something, since right now it doesn't even get cloned.
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

    loadFromDOM(elem, parentName = null, quietErrors = false) {
        const partialConfs = [];
        const X = 'x';
        const isModulo = node => this.getNodeModuloType(node, quietErrors);
        for (const node of Array.from(elem.children).filter(isModulo)) {
            const conf = this.loadPartialConfigFromNode(node);
            conf.Parent = conf.Parent || parentName;
            conf.DefName = conf.Name || null; // -name only, null otherwise
            conf.Name = conf.Name || conf.name || X; // name or -name or 'x'
            const parentNS = conf.Parent || X; // Cast falsy to 'x'
            this.defs[parentNS] = this.defs[parentNS] || []; // Prep empty arr
            this.defs[parentNS].push(conf); // Push to Namespace
            partialConfs.push(conf);
            conf.FullName = parentNS + '_' + conf.Name;
        }
        return partialConfs;
    }

    setupParents() {
        for (const [ namespace, confArray ] of Object.entries(this.defs)) {
            for (const conf of confArray) {
                this.parentDefs[conf.FullName] = conf;
            }
        }
    }

    preprocessAndDefine() {
        this.repeatConfigurePreprocessors(() => {
            // XXX TODO: remove nu nonsense
            this.setupParents(); // Ensure sync'ed up
            const nupatches = this.getNuLifecyclePatches(this.registry.cparts, 'prebuild');
            this.applyPatches(nupatches);
            const nupatches2 = this.getNuLifecyclePatches(this.registry.cparts, 'define');
            this.applyPatches(nupatches2);
        });
    }

    loadString(text, parentFactoryName = null) {
        const tmp_Cmp = new modulo.registry.cparts.Component({}, {}, modulo);
        tmp_Cmp.dataPropLoad = tmp_Cmp.dataPropMount; // XXX
        this.reconciler = modulo.create('engine', 'Reconciler', {
            directives: { 'modulo.dataPropLoad': tmp_Cmp }, // TODO: Change to "this", + resolve to conf stuff
            directiveShortcuts: [ [ /:$/, 'modulo.dataProp' ] ],
        });
        const div = this.reconciler.loadString(text, {});
        const result = this.loadFromDOM(div, parentFactoryName);
        return result;
    }

    getNuLifecyclePatches(lcObj, lifecycleName, searchNamespace = null, hackSNS = null) {
        // todo: Make it lifecycleNames (plural)
        const patches = [];
        const methodName = lifecycleName + 'Callback';
        const foundNS = [];
        for (const [ namespace, confArray ] of Object.entries(this.defs)) {
            // TODO refactor searchNamespace & hackSNS away somehow
            if (searchNamespace) {
                if (searchNamespace !== namespace && hackSNS !== namespace) {
                    continue;
                } else {
                    foundNS.push(namespace);
                }
            }
            for (const conf of confArray) {
                if (conf.Type in lcObj && methodName in lcObj[conf.Type]) {
                    patches.push([ lcObj[conf.Type], methodName, conf ]);
                }
            }
        }
        if (searchNamespace && !foundNS.length) {
            console.log('NS HACK SEARCH ERROR:', this.defs, searchNamespace, hackSNS, JSON.stringify(foundNS));
        }
        return patches;
    }

    patchesFromConfArray(lcObj, lifecycleName, confArray) {
        // TODO refactor into above
        const patches = [];
        const methodName = lifecycleName + 'Callback';
        for (const conf of confArray) {
            if (conf.Type in lcObj && methodName in lcObj[conf.Type]) {
                patches.push([ lcObj[conf.Type], methodName, conf ]);
            }
        }
        return patches;
    }

    getConfArray(searchNamespace, hackSNS) {
        const found = [];
        for (const [ namespace, confArray ] of Object.entries(this.defs)) {
            // TODO ugghhh searchNamespace & hackSNS away somehow
            if (searchNamespace === namespace || hackSNS === namespace) {
                found.push(...confArray);
            }
        }
        return found;
    }

    getLifecyclePatches(lcObj, lifecycleName) {
        // todo: Make it lifecycleNames (plural)
        const patches = [];
        const methodName = lifecycleName + 'Callback';
        for (const [ typeUpper, obj ] of Object.entries(lcObj)) {
            if (!(methodName in obj)) {
                continue; // Skip if obj has not registered callback
            }
            const type = typeUpper.toLowerCase();
            patches.push([ obj, methodName, this.config[type] ]);
        }
        return patches;
    }

    applyPatches(patches, collectObj = null) {
        for (const [ obj, methodName, conf ] of patches) {
            const result = obj[methodName].call(obj, collectObj || this, conf, this);
            if (collectObj && result && conf.RenderObj) {
                collectObj[conf.RenderObj] = result;
            }
        }
    }

    repeatConfigurePreprocessors(cb) {
        if (!this._repeatTries) {
            this._repeatTries = 0;
        }
        //this.assert(this._repeatTries++ < 50, `Max repeat: ${lcName}`);
        let changed = true; // Run at least once
        while (changed) {
            changed = false;
            for (const [ namespace, confArray ] of Object.entries(this.defs)) {
                for (const conf of confArray) {
                    const preprocessors = conf.ConfPreprocessors || [ 'Src' ];
                    changed = changed || this.applyPreprocessor(conf, preprocessors);
                }
            }
        }

        if (Object.keys(this.fetchQueue.queue).length === 0) {
            delete this._repeatTries;
            cb(); // Synchronous path
        } else {
            this.fetchQueue.enqueueAll(
              () => this.repeatConfigurePreprocessors(cb));
        }
    }

    getNodeModuloType(node, quietErrors = false) {
        const { tagName, nodeType, textContent } = node;
        const err = msg => quietErrors || console.error('Modulo Load:', msg);

        // node.nodeType equals 1 if the node is a DOM element (as opposed to
        // text, or comment). Ignore comments, tolerate empty text nodes, but
        // warn on others (since those are typically syntax mistakes).
        if (nodeType !== 1) {
            // Text nodes, comment nodes, etc
            if (nodeType === 3 && textContent && textContent.trim()) {
                err(`Unexpected text found near definitions: ${textContent}`);
            }
            return null;
        }

        let cPartName = tagName.toLowerCase();
        if (cPartName in { cpart: 1, script: 1, template: 1, style: 1 }) {
            for (const attrUnknownCase of node.getAttributeNames()) {
                const attr = attrUnknownCase.toLowerCase();
                if (attr in this.registry.dom && !node.getAttribute(attr)) {
                    cPartName = attr;
                    //break;
                }
                break; // should always be first?
            }
        }
        if (!(cPartName in this.registry.dom)) {
            if (cPartName === 'testsuite') { /* XXX HACK */ return null;}
            err(`${ cPartName }. CParts: ${ Object.keys(this.registry.dom) }`);
            return null;
        }
        return cPartName;
    }

    loadPartialConfigFromNode(node) {
        const { mergeAttrs } = this.registry.utils;
        const partTypeLC = this.getNodeModuloType(node); // Lowercase
        const config = mergeAttrs(node, this.config[partTypeLC]);
        config.Content = node.tagName === 'SCRIPT' ? node.textContent : node.innerHTML;
        if (partTypeLC in config && !config[partTypeLC]) {
            delete config[partTypeLC]; // Remove attribute name used as type
        }
        return config;
    }

    applyPreprocessor(conf, preprocessorNames) {
        for (const name of preprocessorNames) {
            if (name in conf) {
                const value = conf[name];
                delete conf[name];
                this.registry.confPreprocessors[name.toLowerCase()](this, conf, value);
                return true;
            }
        }
        return false;
    }

    setupCParts(element, confArray) {
        // TODO: Maybe move to initialized callback!?
        for (const conf of confArray) {
            const instance = element.cparts[conf.RenderObj];
            instance.element = element;
            instance.modulo = element.modulo;
            instance.conf = conf;
            instance.attrs = element.modulo.registry.utils.keyFilter(conf, isLower);
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
    modulo.loadString(value, conf.FullName);
    conf.Hash = modulo.registry.utils.hash(value);
});

modulo.register('cpart', class Component {
    static prebuildCallback(modulo, conf) {
        const { FullName, Hash, Name, Parent } = conf;
        const { stripWord } = modulo.registry.utils;
        const Children = modulo.defs[FullName];
        if (!Children || Children.length === 0) {
            console.warn('Empty component specified:', FullName);
            return;
        }
        conf.namespace = conf.namespace || conf.Parent || 'x'; // TODO Make this more logical once Library etc is done
        conf.TagName = (conf.TagName || `${ conf.namespace }-${ Name }`).toLowerCase();

        const cpartNameString = Children.map(({ Type }) => Type).join(', ');
        let unrolledFactoryMethods = 'const initRenderObj = {};';
        let unrolledCPartSetup = 'this.cparts = {};';
        let i = 0;
        while (i < Children.length) {
            const conf = Children[i];
            const { Type } = conf;
            unrolledCPartSetup += `\nthis.cparts.${ conf.RenderObj } = new ${ conf.Type }();`
            if (!('factoryCallback' in modulo.registry.cparts[conf.Type])) {
                i++;
                continue;
            }
            const fn = `initRenderObj.${ conf.RenderObj } = ${ conf.Type }.factoryCallback`;
            const expr = `${ fn }(initRenderObj, confArray[${ i }], modulo)`;
            unrolledFactoryMethods += '\n    ' + expr + ';';
            i++;
        }
        // TODO: When refactoring, reincoroprate the new unrolled style,
        // probably into constructor() instead of parsedCallback
        /*
                new__parsedCallback() {
                    ${ unrolledCPartSetup }
                    modulo.setupCParts(this, confArray);
                }
        */
        const code = (`
            const { ${ cpartNameString } } = modulo.registry.cparts;
            const confArray = modulo.defs['${ FullName }'];
            ${ unrolledFactoryMethods }
            class ${ Name } extends modulo.registry.utils.BaseElement {
                constructor() {
                    super();
                    this.modulo = modulo;
                    this.defHash = '${ Hash }';
                    this.initRenderObj = initRenderObj;
                    this.moduloChildrenData = confArray;
                    this.moduloComponentConf = modulo.parentDefs['${ FullName }'];
                }
            }
            modulo.globals.customElements.define(tagName, ${ Name });
            //console.log("Registered: ${ Name } as " + tagName);
            return ${ Name };
        `).replace(/\n {8}/g, "\n");
        conf.FuncDefHash = modulo.assets.getHash([ 'tagName', 'modulo' ], code);
        modulo.assets.registerFunction([ 'tagName', 'modulo' ], code);
    }

    static defineCallback(modulo, conf) {
        const { FullName, FuncDefHash } = conf;
        const { stripWord } = modulo.registry.utils;
        const { library } = modulo.config;
        //const defsCode = `currentModulo.defs['${ FullName }'] = ` + JSON.stringify(conf, null, 1);
        //const defsCode = `currentModulo.parentDefs['${ FullName }'] = ` + JSON.stringify(conf, null, 1);
        const exCode = `currentModulo.assets.functions['${ FuncDefHash }']`;
        modulo.assets.runInline(`${ exCode }('${ conf.TagName }', currentModulo);\n`);
    }

    /*
    static factoryCallback(modulo, conf) {
        conf.directiveShortcuts = [
            [ /^@/, 'component.event' ],
            [ /:$/, 'component.dataProp' ],
        ];
        conf.uniqueId = ++factory.id;
    }
    */

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
        this.mode =this.attrs.mode || 'regular';
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
        /* XXX */ if (attrName === 'click' && !val) { val = ()=> console.log('XXX ERROR: (DEBUGGING Wrong Script Tag) click is undefined', renderObj); }
        //modulo.assert(val !== undefined, 'Error: Cannot assign value "undefined" to dataProp')
        set(el.dataProps, attrName, val); // set according to path given
        el.dataPropsAttributeNames[rawName] = attrName;
        ///* XXX */ if (attrName === 'click') { console.log('XXX click', el, value, val); }
    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }
}, { mode: 'regular', rerender: 'event', engine: 'Reconciler', ConfPreprocessors: [ 'Src', 'Content' ] });

modulo.register('cpart', class Modulo {
}, { ConfPreprocessors: [ 'Src', 'Content' ] });

//                v- Later put somewhere more appropriate
//modulo.register('util', Modulo);

modulo.register('cpart', class Library {
    /*
    static configureCallback(modulo, conf) {
        modulo.applyPreprocessor(conf, [ 'Src', 'Content' ]);
        let { Content, Src, Hash, src, Name, name, namespace } = conf;
        //const { hash } = modulo.registry.utils;
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
            console.log('Does this even work??')
            delete conf.LibName; // idempotent
            const library = modulo.registry.library[conf.LibName];
            library.runLifecycle(library.registry.cparts, 'define');
        }
    }
    */
}, { ConfPreprocessors: [ 'Src', 'Content' ] });

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
        if (this.hasAttribute('modulo-original-html')) {
            original = modulo.registry.utils.makeDiv(this.getAttribute('modulo-original-html'));
        }
        this.legacySetupCParts();
        this.lifecycle([ 'initialized' ]);
        this.rerender(original); // render and re-mount it's own childNodes
        // TODO - Needs refactor, should do this somewhere else:
        if (this.hasAttribute('modulo-original-html')) {
            const { reconciler } = this.cparts.component;
            reconciler.patch = reconciler.applyPatch; // Apply patches immediately
            reconciler.patchAndDescendants(this, 'Mount');
            reconciler.patch = reconciler.pushPatch;
        }
        this.isMounted = true;
    }

    legacySetupCParts() {
        this.cparts = {};
        const fullData = Array.from(this.moduloChildrenData);
        fullData.unshift(this.moduloComponentConf); // Add in the Component def itself
        const { cparts } = this.modulo.registry;
        const isLower = key => key[0].toLowerCase() === key[0];
        for (const conf of fullData) {
            const partObj = this.initRenderObj[conf.RenderObj];
            const instance = new cparts[conf.Type](this.modulo, conf, this);
            // TODO: Decide on this interface, and maybe restore "modulo.create" as part of this
            instance.element = this;
            instance.modulo = this.modulo;
            instance.conf = conf;
            instance.attrs = this.modulo.registry.utils.keyFilter(conf, isLower);
            this.cparts[conf.RenderObj] = instance;
        }
    }
});

modulo.register('core', class AssetManager {
    constructor (modulo) {
        this.modulo = modulo;
        this.functions = {};
        this.stylesheets = {};
        // TODO: rawAssets and rawAssetsArray are both likely dead code!
        this.rawAssets = { js: {}, css: {} };
        this.rawAssetsArray = { js: [], css: [] };
    }

    build(ext, opts, prefix = '') {
        const { saveFileAs, hash } = this.modulo.registry.utils;
        const text = prefix + modulo.assets.rawAssetsArray[ext].join('\n');
        return saveFileAs(`modulo-${ opts.type }-${ hash(text) }.${ ext }`, text);
    }

    registerFunction(params, text, opts = {}) {
        // Checks if text IS the hash, in which case use that, otherwise gen hash
        const hash = text in this.functions ? text : this.getHash(params, text);
        if (!(hash in this.functions)) {
            const funcText = this.wrapFunctionText(params, text, opts, hash);
            this.runInline(funcText);
            /*
            this.rawAssets.js[hash] = funcText; // "use strict" only in tag
            window.currentModulo = this.modulo; // Ensure stays silo'ed in current
            this.appendToHead('script', '"use strict";\n' + funcText);
            */
            this.modulo.assert(hash in this.functions, `Func ${hash} did not register`);
            this.functions[hash].hash = hash;
        }
        return this.functions[hash];
    }

    registerStylesheet(text) {
        const hash = this.modulo.registry.utils.hash(text);
        if (!(hash in this.stylesheets)) {
            this.stylesheets[hash] = true;
            this.rawAssets.css[hash] = text;
            this.rawAssetsArray.css.push(text);
            this.appendToHead('style', text);
        }
    }

    runInline(funcText) {
        const hash = this.modulo.registry.utils.hash(funcText);
        if (!(hash in this.rawAssets.js)) {
            this.rawAssets.js[hash] = funcText; // "use strict" only in tag
            this.rawAssetsArray.js.push(funcText);
        }
        window.currentModulo = this.modulo; // Ensure stays silo'ed in current
        // TODO: Make functions named, e.g. function x_Button_Template () etc,
        // so stack traces / debugger looks better
        this.appendToHead('script', '"use strict";\n' + funcText);
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
        //let prefix = `modulo.assets.functions["${hash || this.getHash(params, text)}"]`;
        let prefix = `currentModulo.assets.functions["${hash || this.getHash(params, text)}"]`;
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
        elem.setAttribute('modulo-asset', 'y'); // Mark as an "asset" (TODO: Maybe change to hash?)
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
        // NOTE: There is a bug with this vs enqueueAll, specifically if we are
        // already in a wait callback, it can end up triggering the next one
        // immediately
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
          static factoryCallback({ attrs }, { componentClass }, renderObj) {
              //componentClass.observedAttributes = Object.keys(attrs);
          }
        */
        return this.initializedCallback(renderObj);
    }
});


modulo.register('cpart', class Style {
    getDirectives() {  LEGACY.push('style.getDirectives'); return []; }

    static prebuildCallback(modulo, conf) {

        /*
        //if (loadObj.component.attrs.mode === 'shadow') { // TODO finish
        //    return;
        //}
        */
        let { Content, Parent } = conf;
        if (!Content) {
            return;
        }
        if (Parent) {
            let { namespace, mode, Name } = modulo.parentDefs[Parent];
            // XXX HAX, conf is a big tangled mess
            if (Name.startsWith('x_')) {
                Name = Name.replace('x_', '');
                if (!namespace) {
                    namespace = 'x';
                }
            }
            if (Name.startsWith(namespace)) {
                Name = Name.replace(namespace + '_', '');
                conf.Name = Name;
            }
            // XXX unHAX, conf is a big tangled mess
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
    getDirectives() {  LEGACY.push('template.getDirectives'); return []; }

    static prebuildCallback(modulo, conf) {
        // TODO:  Possibly could refactor the hashing / engine system into
        // Preprocessors, shared by Template (Templater), Component
        // (Reconciler), and maybe even Script (something that wraps and
        // exposes, e.g.  ScriptContainer) and StaticData (DataProcessor)
        modulo.assert(conf.Content, 'No Template Content specified.');
        const instance = new modulo.registry.engines.Templater(modulo, conf);
        conf.Hash = instance.Hash;
        delete conf.Content;
    }

    initializedCallback(modulo, conf) {
        const { Templater } = this.modulo.registry.engines;
        this.templater = new Templater(this.modulo, this.conf);
    }

    /*
    prepareCallback(renderObj) {
        // Exposes templates in render context, so stuff like
        // "|renderas:template.row" works
        const obj = {};
        for (const template of this.element.cpartSpares.template) {
            obj[template.attrs.name || 'regular'] = template;
            //obj[template.name || 'regular'] = template;
        }
        return obj;
    }
    */

    renderCallback(renderObj) {
        if (!renderObj.component)renderObj.component={};// XXX fix
        renderObj.component.innerHTML = this.templater.render(renderObj);
    }
});

modulo.register('cpart', class StaticData {
    static prebuildCallback(modulo, conf) {
        // TODO put into conf, make default to JSON, and make CSV actually
        // correct + instantly useful (e.g. separate headers, parse quotes)
        const transforms = {
            csv: s => JSON.stringify(s.split('\n').map(line => line.split(','))),
            js: s => s,
            json: s => JSON.stringify(JSON.parse(s)),
            txt: s => JSON.stringify(s),
        };
        const transform = transforms[conf.type || 'js'];
        const code = 'return ' + transform((conf.Content || '').trim()) + ';';
        delete conf.Content;
        conf.Hash = modulo.assets.getHash([], code);
        modulo.assets.registerFunction([], code);
        // TODO: Maybe evaluate and attach directly to conf here?
    }

    static factoryCallback(renderObj, conf, modulo) {
        // Now, actually run code in Script tag to do factory method
        return modulo.assets.functions[conf.Hash]();
    }

    getDirectives() { LEGACY.push("staticdata.getDirectives"); return []; } // XXX
});

modulo.register('cpart', class Script {
    static prebuildCallback(modulo, conf) {
        const code = conf.Content || ''; // TODO: trim whitespace?
        delete conf.Content;
        let localVars = Object.keys(modulo.registry.dom);// TODO fix...
        localVars.push('element'); // add in element as a local var
        localVars.push('cparts'); // give access to CParts JS interface

        // Combine localVars + fixed args into allArgs
        const args = [ 'modulo', 'require' ];
        let allArgs = args.concat(localVars.filter(n => !args.includes(n)));

        const opts = { exports: 'script' };
        if (!conf.Parent) {
            // TODO Confirm this works
            if (!code.includes('CodeMirror, copyright (c)')) { // CodeMirror Source
                console.log('WARNING: Hardcoded PARENTLESS code.'); // XXX
            }
            localVars = [];
            allArgs = [ 'modulo' ];
            delete opts.exports;
        }

        const func = modulo.assets.registerFunction(allArgs, code, opts);
        conf.Hash = modulo.assets.getHash(allArgs, code);
        conf.localVars = localVars;
    }

    static defineCallback(modulo, conf) {
        // XXX -- HAX
        if (!conf.Parent || conf.Parent === 'x_x') {
            const exCode = `currentModulo.assets.functions['${ conf.Hash }']`
            // TODO: Refactor:
            // NOTE: Uses "window" as "this." context for better compat
            modulo.assets.runInline(`${ exCode }.call(window, currentModulo);\n`);
            // currentModulo.registry.cparts.Script.require);\n`);
            delete conf.Hash; // prevent getting run again
        }
    }

    static factoryCallback(renderObj, conf, modulo) {
        const { Content, Hash, localVars } = conf;
        const func = modulo.assets.functions[Hash];
        // Now, actually run code in Script tag to do factory method
        //const results = func.call(null, modulo, this.require || null);
        const results = func.call(null, modulo, this.require || null);
        if (results) {
            results.localVars = localVars;
            modulo.assert(!('factoryCallback' in results), 'factoryCallback LEGACY');
            return results;
        } else {
            modulo.assert(!conf.Parent, 'Falsy return for parented Script');
            return {};
        }
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

    initializedCallback(renderObj) {
        let { script } = renderObj;
        //let script = conf;
        // Attach callbacks from script to this, to hook into lifecycle.
        const isCbRegex = /(Unmount|Mount|Callback)$/;
        const cbs = Object.keys(script).filter(key => key.match(isCbRegex));
        //cbs.push('initializedCallback', 'eventCallback'); // always CBs for these
        cbs.push('eventCallback'); // always CBs for these
        for (const cbName of cbs) {
            if (cbName === 'initializedCallback') { // XXX refactor
                continue;
            }
            this[cbName] = (arg) => {
                // NOTE: renderObj is passed in for Callback, but not Mount
                const renderObj = this.element.getCurrentRenderObj();
                this.prepLocalVars(renderObj); // always prep (for event CB)
                if (cbName in script) { // if it's specified in script
                    Object.assign(renderObj.script, script[cbName](arg));
                }
            };
        }
        if (script.initializedCallback) {
            this.prepLocalVars(renderObj); // always prep (for event CB)
            Object.assign(script.exports, script.initializedCallback(renderObj));
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

    // ## prepLocalVars
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
        if (setLocalVariable) { // (For autoexport:=false, there is no setLocalVar)
            setLocalVariable('element', this.element);
            setLocalVariable('cparts', this.element.cparts);
            // TODO: Remove 'localVars' from configure script, clutters up build
            for (const localVar of localVars) {
                if (localVar in renderObj) {
                    setLocalVariable(localVar, renderObj[localVar]);
                }
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
        // TODO: Instead, should JUST do _lastPropagated (isntead of _oldData)
        // with each key from boundElements, and thus more efficiently loop
        // through
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
        this.modulo = modulo;
        this.setup(conf.Content, conf); // TODO, refactor
    }

    setup(text, conf) {
        Object.assign(this, modulo.config.templater, conf);
        this.filters = Object.assign({}, modulo.registry.templateFilters, this.filters);
        this.tags = Object.assign({}, modulo.registry.templateTags, this.tags);
        if (this.Hash) {
            this.renderFunc = modulo.assets.functions[this.Hash];
        } else {
            this.compiledCode = this.compile(text);
            const unclosed = this.stack.map(({ close }) => close).join(', ');
            this.modulo.assert(!unclosed, `Unclosed tags: ${ unclosed }`);
            this.Hash = modulo.assets.getHash([ 'CTX', 'G' ], this.compiledCode);
            this.renderFunc = modulo.assets.registerFunction([ 'CTX', 'G' ], this.compiledCode);
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
        // const prepComment = token => truncate(escapejs(trim(token)), 80);
        const { normalize } = modulo.registry.utils;
        this.stack = []; // Template tag stack
        this.output = 'var OUT=[];\n'; // Variable used to accumulate code
        let mode = 'text'; // Start in text mode
        for (const token of this.tokenizeText(text)) {
            if (mode) { // if in a "mode" (text or token), then call mode func
                const result = this.modes[mode](token, this, this.stack);
                if (result) { // Mode generated text output, add to code
                    const comment = JSON.stringify(normalize(token).trim()); // TODO: maybe collapse all ws?
                    this.output += `  ${result} // ${ comment }\n`;
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
        // TODO: Support this-style-variable being turned to thisStyleVariable
        const filters = text.split('|');
        let results = this.parseVal(filters.shift()); // Get left-most val
        for (const [ fName, arg ] of filters.map(s => s.trim().split(':'))) {
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
        join: (s, arg) => (s || []).join(arg === undefined ? ", " : arg),
        json: (s, arg) => JSON.stringify(s, null, arg || undefined),
        last: s => s[s.length - 1],
        length: s => s.length !== undefined ? s.length : Object.keys(s).length,
        lower: s => s.toLowerCase(),
        multiply: (s, arg) => (s * 1) * (arg * 1),
        number: (s) => Number(s),
        pluralize: (s, arg) => (arg.split(',')[(s === 1) * 1]) || '',
        subtract: (s, arg) => s - arg,
        truncate: (s, arg) => ((s && s.length > arg*1) ? (s.substr(0, arg-1) + '…') : s),
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
            LEGACY.push('this.directiveShortcuts.length === 0')
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


modulo.register('util', function fetchBundleData(modulo, callback) {
    const query = 'script[src],link[rel=stylesheet]';
    const data = [];
    const elems = Array.from(modulo.globals.document.querySelectorAll(query));
    for (const elem of elems) {
        const dataItem = {
            src: elem.src || elem.href,
            type: elem.tagName === 'SCRIPT' ? 'js' : 'css',
            content: null,
        };
        // TODO: Add support for inline script tags..?
        data.push(dataItem);
        modulo.fetchQueue.enqueue(dataItem.src, text => {
            delete modulo.fetchQueue.data[dataItem.src]; // clear cached data
            dataItem.content = text;
        });
        elem.remove();
    }
    console.log('this is dataItems', data);
    modulo.fetchQueue.enqueueAll(() => callback(data));
});


modulo.register('command', function build (modulo, opts = {}) {
    const { buildhtml } = modulo.registry.commands;
    opts.type = opts.bundle ? 'bundle' : 'build';
    const pre = { js: [], css: [] }; // Prefixed content
    for (const bundle of (opts.bundle || [])) { // Loop through bundle data
        pre[bundle.type].push(bundle.content);
    }
    pre.js.push('var currentModulo = new Modulo(modulo);'); // Fork modulo
    pre.js.push('currentModulo.defs = ' + JSON.stringify(modulo.defs, null, 1) + ';');
    pre.js.push('currentModulo.parentDefs = ' + JSON.stringify(modulo.parentDefs, null, 1) + ';');
    opts.jsFilePath = modulo.assets.build('js', opts, pre.js.join('\n'));
    opts.cssFilePath = modulo.assets.build('css', opts, pre.css.join('\n'));
    opts.htmlFilePath = buildhtml(modulo, opts);
    document.body.innerHTML = `<h1><a href="?mod-cmd=${opts.type}">&#10227;
        ${ opts.type }</a>: ${ opts.htmlFilePath }</h1>`;
    if (opts.callback) {
        opts.callback();
    }
});

modulo.register('command', function bundle (modulo, opts = {}) {
    const { build } = modulo.registry.commands;
    const { fetchBundleData } = modulo.registry.utils;
    fetchBundleData(modulo, bundle => build(modulo, Object.assign({ bundle }, opts)));
});

modulo.register('util', function getBuiltHTML(modulo, opts = {}) {
    // Scan document for modulo elements, attaching modulo-original-html=""
    // as needed, and clearing link / script tags that have been bundled
    const doc = modulo.globals.document;
    const bundledTags = { script: 1, link: 1, style: 1 }; // TODO: Move to conf?
    for (const elem of doc.querySelectorAll('*')) {
        // TODO: As we are bundling together, create a src/href/etc collection
        // to the compare against instead?
        if (elem.tagName.toLowerCase() in bundledTags) {
            if (elem.hasAttribute('modulo-asset') || opts.bundle) {
                elem.remove(); // TODO: Maybe remove bundle logic here, since we remove when bundling?
            }
        } else if (elem.isModulo && elem.originalHTML !== elem.innerHTML) {
            elem.setAttribute('modulo-original-html', elem.originalHTML);
        }
    }
    const linkProps = { rel: 'stylesheet', href: opts.cssFilePath };
    doc.head.append(Object.assign(doc.createElement('link'), linkProps));
    const scriptProps = { src: opts.jsFilePath };
    doc.body.append(Object.assign(doc.createElement('script'), scriptProps));
    return '<!DOCTYPE HTML><html>' + doc.documentElement.innerHTML + '</html>';
});

modulo.register('command', function buildhtml(modulo, opts = {}) {
    const { saveFileAs, getBuiltHTML } = modulo.registry.utils;
    const filename = window.location.pathname.split('/').pop();
    return saveFileAs(filename, getBuiltHTML(modulo, opts));
});


if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => modulo.fetchQueue.wait(() => {
        // TODO: Better way to know if in built-version browser environ
        const isProduction = document.querySelector(
            'script[src*="modulo-build"],script[src*="modulo-bundle"]');
        if (isProduction) {
            return;
        }
        const cmd = new URLSearchParams(window.location.search).get('mod-cmd');
        // TODO: disable commands for built version somehow, as a safety
        // precaution -- maybe another if statement down here, so this is
        // "dev-mode", and there's "node-mode" and finally "build-mode"?
        if (cmd) {
            modulo.registry.commands[cmd](modulo);
        } else {
            // TODO: Make these link to ?mod-cmd=...
            // and maybe a-tag / button to "force-refresh" after every command
            // (e.g. [ build ] ./start.html)
            const font = 'font-size: 30px; line-height: 0.7; padding: 5px; border: 3px solid black;';
            console.log('%c%', font, (new (class COMMANDS {
                get test() { window.location.href += '?mod-cmd=test' }
                get build() { window.location.href += '?mod-cmd=build' }
                get bundle() { window.location.href += '?mod-cmd=bundle' }
            })));
            //})).__proto__); // TODO: .__proto__ is better in firefox, saves one click, without is better in chrome
            /*
            const cmds = Object.keys(modulo.registry.commands);
            new Function(`console.log('%c%', '${ font }, (new (class COMMANDS {
                ${ cmds.map(cmd => `get ${ cmd } () {
                    return modulo.registry.commands.test(modulo)
                }
            `)
            */
        }
    }));
}

if (typeof document !== 'undefined' && document.head) { // Browser environ
    Modulo.globals = window; // TODO, remove?
    modulo.globals = window;
    window.hackCoreModulo = new Modulo(modulo); // XXX
    // TODO - Not sure advantages of running preprocess blocking vs not
    modulo.loadFromDOM(document.head, null, true);
    modulo.preprocessAndDefine();
} else if (typeof exports !== 'undefined') { // Node.js / silo'ed script
    exports = { Modulo, modulo };
}

var currentModulo = new Modulo(modulo);
currentModulo.defs = {
 "x": [
  {
   "Type": "Modulo",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "modulo",
   "src": "/js/Modulo.js",
   "Parent": null,
   "DefName": null,
   "Name": "x",
   "FullName": "x_x",
   "Hash": "pkpi46",
   "cachedComponentDefs": {
    "/libraries/eg.html": {
     "Hello": "\n<Template>\n    <button @click:=script.countUp>Hello {{ state.num }}</button>\n</Template>\n<State\n    num:=42\n></State>\n<Script>\n    function countUp() {\n        state.num++;\n    }\n</Script>\n\n\n",
     "Simple": "\n<Template>\n    Components can use any number of <strong>CParts</strong>.\n    Here we use only <em>Style</em> and <em>Template</em>.\n</Template>\n\n<Style>\n    em { color: darkgreen; }\n    * { text-decoration: underline; }\n</Style>\n\n\n",
     "ToDo": "<Template>\n<ol>\n    {% for item in state.list %}\n        <li>{{ item }}</li>\n    {% endfor %}\n    <li>\n        <input [state.bind] name=\"text\" />\n        <button @click:=script.addItem>Add</button>\n    </li>\n</ol>\n</Template>\n\n<State\n    list:='[\"Milk\", \"Bread\", \"Candy\"]'\n    text=\"Beer\"\n></State>\n\n<Script>\n    function addItem() {\n        state.list.push(state.text); // add to list\n        state.text = \"\"; // clear input\n    }\n</Script>\n\n\n",
     "JSON": "<!-- Use StaticData CPart to include JSON from an API or file -->\n<Template>\n    <strong>Name:</strong> {{ staticdata.name }} <br />\n    <strong>Site:</strong> {{ staticdata.homepage }} <br />\n    <strong>Tags:</strong> {{ staticdata.topics|join }}\n</Template>\n<StaticData\n    -src=\"https://api.github.com/repos/michaelpb/modulo\"\n></StaticData>\n",
     "JSONArray": "<!-- Use StaticData CPart to include JSON from an API or file.\nYou can use it for arrays as well. Note that it is \"bundled\"\nas static data in with JS, so it does not refresh. -->\n<Template>\n  {% for post in staticdata %}\n    <p>{% if post.completed %}&starf;{% else %}&star;{% endif %}\n        {{ post.title|truncate:15 }}</p>\n  {% endfor %}\n</Template>\n<StaticData\n    -src=\"https://jsonplaceholder.typicode.com/todos\"\n></StaticData>\n",
     "API": "<Template>\n<p>{{ state.name }} | {{ state.location }}</p>\n<p>{{ state.bio }}</p>\n<a href=\"https://github.com/{{ state.search }}/\" target=\"_blank\">\n    {% if state.search %}github.com/{{ state.search }}/{% endif %}\n</a>\n<input [state.bind] name=\"search\"\n    placeholder=\"Type GitHub username\" />\n<button @click:=script.fetchGitHub>Get Info</button>\n</Template>\n\n<State\n    search=\"\"\n    name=\"\"\n    location=\"\"\n    bio=\"\"\n></State>\n\n<Script>\n    function fetchGitHub() {\n        fetch(`https://api.github.com/users/${state.search}`)\n            .then(response => response.json())\n            .then(githubCallback);\n    }\n    function githubCallback(apiData) {\n        state.name = apiData.name;\n        state.location = apiData.location;\n        state.bio = apiData.bio;\n        element.rerender();\n    }\n</Script>\n\n\n",
     "ColorSelector": "<Template>\n    <div style=\"float: right\">\n        <p><label>Hue:<br />\n            <input [state.bind] name=\"hue\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" />\n        </label></p>\n        <p><label>Saturation: <br />\n            <input [state.bind] name=\"sat\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n        <p><label>Luminosity:<br />\n            <input [state.bind] name=\"lum\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n    </div>\n    <div style=\"\n        width: 80px; height: 80px;\n        background: hsl({{ state.hue }}, {{ state.sat }}%, {{ state.lum }}%)\">\n    </div>\n</Template>\n<State\n    hue:=130\n    sat:=50\n    lum:=50\n></State>\n",
     "SearchBox": "<!-- A \"type as you go\" search box implementation,\nan example of more complicated HTML and JS behavior -->\n<Template>\n<p>Type a book name for \"search as you type\"\n(e.g. try &ldquo;the lord of the rings&rdquo;)</p>\n\n<input [state.bind] name=\"search\"\n  @keyup:=script.typingCallback />\n\n<div class=\"results {% if state.search.length gt 0 %}\n                      visible {% endif %}\">\n  <div class=\"results-container\">\n    {% if state.loading %}\n      <img src=\"{{ staticdata.gif }}\" alt=\"loading\" />\n    {% else %}\n      {% for result in state.results %}\n        <div class=\"result\">\n          <img\n            src=\"{{ staticdata.cover|add:result.cover_i }}-S.jpg\"\n          /> <label>{{ result.title }}</label>\n        </div>\n      {% empty %}\n        <p>No books found.</p>\n      {% endfor %}\n    {% endif %}\n  </div>\n</div>\n</Template>\n\n<State\n    search=\"\"\n    results:=[]\n    loading:=false\n></State>\n\n<!-- Puting long URLs down here to declutter -->\n<StaticData>\n{\n  apiBase: 'https://openlibrary.org/search.json',\n  cover: 'https://covers.openlibrary.org/b/id/',\n  gif: 'https://cdnjs.cloudflare.com/ajax/libs/' +\n    'semantic-ui/0.16.1/images/loader-large.gif'\n}\n</StaticData>\n\n<Script>\n    function typingCallback() {\n        state.loading = true;\n        const search = `q=${state.search}`;\n        const opts = 'limit=6&fields=title,author_name,cover_i';\n        const url = `${staticdata.apiBase}?${search}&${opts}`;\n        _globalDebounce(() => {\n            fetch(url)\n                .then(response => response.json())\n                .then(dataBackCallback);\n        });\n    }\n\n    function dataBackCallback(data) {\n        state.results = data.docs;\n        state.loading = false;\n        element.rerender();\n    }\n\n    let _globalDebounceTimeout = null;\n    function _globalDebounce(func) {\n        if (_globalDebounceTimeout) {\n            clearTimeout(_globalDebounceTimeout);\n        }\n        _globalDebounceTimeout = setTimeout(func, 500);\n    }\n</Script>\n\n<Style>\n    input {\n        width: 100%;\n    }\n    .results-container {\n        display: flex;\n        flex-wrap: wrap;\n        justify-content: center;\n    }\n    .results-container > img { margin-top 30px; }\n    .results {\n        position: absolute;\n        height: 0;\n        width: 0;\n        overflow: hidden;\n        display: block;\n        border: 2px solid #B90183;\n        border-radius: 0 0 20px 20px;\n        transition: height 0.2s;\n        z-index: 20;\n        background: white;\n    }\n    .results.visible {\n        height: 200px;\n        width: 200px;\n    }\n    .result {\n        padding: 10px;\n        width: 80px;\n        position: relative;\n    }\n    .result label {\n        position: absolute;\n        width: 80px;\n        background: rgba(255, 255, 255, 0.5);\n        font-size: 0.7rem;\n        top: 0;\n        left: 0;\n    }\n</Style>\n\n\n",
     "DateNumberPicker": "<Template>\n    <p>ISO: <tt>{{ state.year }}-{{ state.month }}-{{ state.day }}</tt></p>\n    {% for part in state.ordering %}\n        <label>\n            {{ state|get:part }}\n            <div>\n                <button @click:=script.next payload=\"{{ part }}\">&uarr;</button>\n                <button @click:=script.previous payload=\"{{ part }}\">&darr;</button>\n            </div>\n        </label>\n    {% endfor %}\n</Template>\n\n<State\n    day:=1\n    month:=1\n    year:=2022\n    ordering:='[\"year\", \"month\", \"day\"]'\n></State>\n\n<Script>\n    function isValid({ year, month, day }) {\n        month--; // Months are zero indexed\n        const d = new Date(year, month, day);\n        return d.getMonth() === month && d.getDate() === day && d.getFullYear() === year;\n    }\n    function next(part) {\n        state[part]++;\n        if (!isValid(state)) { // undo if not valid\n            state[part]--;\n        }\n    }\n    function previous(part) {\n        state[part]--;\n        if (!isValid(state)) { // undo if not valid\n            state[part]++;\n        }\n    }\n</Script>\n\n<Style>\n    :host {\n        border: 1px solid black;\n        padding: 10px;\n        margin: 10px;\n        margin-left: 0;\n        display: flex;\n        flex-wrap: wrap;\n        font-weight: bold;\n    }\n    div {\n        float: right;\n    }\n    label {\n        display: block;\n        width: 100%;\n    }\n</Style>\n",
     "FlexibleForm": "<!-- Here, we have a form that's easy to update. If this gets used more\nthan a couple times, it could be turned into a reusable component where\nthe \"ordering\" and initial values get set via Props. -->\n<Template>\n    <form>\n        {% for field in state.fields %}\n            <div class=\"field-pair\">\n                <label for=\"{{ field }}_{{ component.uniqueId }}\">\n                    <strong>{{ field|capfirst }}:</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type=\"{% if state|get:field|type == 'string' %}text{% else %}checkbox{% endif %}\"\n                    name=\"{{ field }}\"\n                    id=\"{{ field }}_{{ component.uniqueId }}\"\n                />\n            </div>\n        {% endfor %}\n    </form>\n</Template>\n\n<State\n    name=\"Spartacus\"\n    topic=\"On the treatment of Thracian gladiators\"\n    subscribe:=true\n    private:=false\n    comment=\"So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.\"\n    fields:='[\"name\", \"topic\", \"comment\", \"private\", \"subscribe\"]'\n></State>\n",
     "FlexibleFormWithAPI": "<!-- Combining the code from the previous exercise, we can interact with\nAPIs. Here we use a Typicode's placeholder API to make posts -->\n<Template>\n    <form>\n        {% for field in state.fields %}\n            <div class=\"field-pair\">\n                <label for=\"{{ field }}_{{ component.uniqueId }}\">\n                    <strong>{{ field|capfirst }}:</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type='{% if state|get:field|type == \"number\" %}number{% else %}text{% endif %}'\n                    name=\"{{ field }}\"\n                    id=\"{{ field }}_{{ component.uniqueId }}\"\n                />\n            </div>\n        {% endfor %}\n        <button @click:=script.submit>Post comment</button>\n        <hr />\n\n        {% for post in state.posts|reversed %}\n            <p>\n                {{ post.userId }}:\n                <strong>{{ post.title|truncate:15 }}</strong>\n                {{ post.body|truncate:18 }}\n            </p>\n        {% endfor %}\n    </form>\n</Template>\n\n<State\n    user:=1337\n    topic=\"On the treatment of Thracian gladiators\"\n    comment=\"So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.\"\n    fields:='[\"user\", \"topic\", \"comment\"]'\n    posts:='[]'\n></State>\n\n<Script>\n    const URL = 'https://jsonplaceholder.typicode.com/posts';\n    const fakedPosts = [];\n    const headers = [];\n\n    function initializedCallback() {\n        refresh(); // Refresh on first load\n    }\n\n    function refresh() {\n        fetch(URL).then(r => r.json()).then(data => {\n            // Since Typicode API doesn't save it's POST\n            // data, we'll have manually fake it here\n            state.posts = data.concat(fakedPosts);\n            element.rerender();\n        });\n    }\n\n    function submit() {\n        // Rename the state variables to be what the API suggests\n        const postData = {\n              userId: state.user,\n              title: state.topic,\n              body: state.comment,\n        };\n        state.topic = ''; // clear the comment & topic text\n        state.comment = '';\n        fakedPosts.push(postData); // Required for refresh()\n\n        // Send the POST request with fetch, then refresh after\n        const opts = {\n            method: 'POST',\n            body: JSON.stringify(postData),\n            headers: { 'Content-type': 'application/json; charset=UTF-8' },\n        };\n        fetch(URL, opts).then(r => r.json()).then(refresh);\n    }\n</Script>\n\n",
     "Components": "<!-- Once defined, Modulo web components can be used like HTML.\nDemoModal and DemoChart are already defined. Try using below! -->\n<Template>\n\n<x-DemoChart\n    data:='[1, 2, 3, 5, 8]'\n></x-DemoChart>\n\n<x-DemoModal button=\"Nicholas Cage\" title=\"Biography\">\n    <p>Prolific Hollywood actor</p>\n    <img src=\"https://www.placecage.com/640/360\" />\n</x-DemoModal>\n\n<x-DemoModal button=\"Tommy Wiseau\" title=\"Further Data\">\n    <p>Actor, director, and acclaimed fashion designer</p>\n    <x-DemoChart data:='[50, 13, 94]' ></x-DemoChart>\n</x-DemoModal>\n\n</Template>\n\n",
     "OscillatingGraph": "<Template>\n\n    <!-- Note that even with custom components, core properties like \"style\"\n        are available, making CSS variables a handy way of specifying style\n        overrides. -->\n    <x-DemoChart\n        data:=state.data\n        animated:=true\n        style=\"\n            --align: center;\n            --speed: {{ state.anim }};\n        \"\n    ></x-DemoChart>\n\n    <p>\n        {% if not state.playing %}\n            <button @click:=script.play alt=\"Play\">&#x25B6;  tick: {{ state.tick }}</button>\n        {% else %}\n            <button @click:=script.pause alt=\"Pause\">&#x2016;  tick: {{ state.tick }}</button>\n        {% endif %}\n    </p>\n\n    {% for name in script.exports.properties %}\n        <label>{{ name|capfirst }}:\n            <input [state.bind]\n                name=\"{{ name }}\"\n                type=\"range\"\n                min=\"1\" max=\"20\" step=\"1\" />\n        </label>\n    {% endfor %}\n</Template>\n\n<State\n    playing:=false\n    speed:=10\n    easing=\"linear\"\n    align=\"flex-end\"\n    tick:=1\n    width:=10\n    anim:=10\n    speed:=10\n    pulse:=1\n    offset:=1\n    data:=[]\n></State>\n<Script>\n    let timeout = null;\n    script.exports.properties = [\"anim\", \"speed\", \"width\", \"pulse\"];//, \"offset\"];\n    function play() {\n        state.playing = true;\n        nextTick();\n    }\n    function pause() {\n        state.playing = false;\n    }\n    function setEasing(payload) {\n        state.easing = payload;\n    }\n\n    function nextTick() {\n        if (timeout) {\n            clearTimeout(timeout);\n        }\n        const el = element;\n        timeout = setTimeout(() => {\n            el.rerender();\n        }, 2000 / state.speed);\n    }\n\n    function updateCallback() {\n        if (state.playing) {\n            while (state.data.length <= state.width) {\n                state.tick++;\n                state.data.push(Math.sin(state.tick / state.pulse) + 1); // add to right\n            }\n            state.data.shift(); // remove one from left\n            nextTick();\n        }\n    }\n</Script>\n<Style>\n    input {\n        width: 50px;\n    }\n</Style>\n",
     "PrimeSieve": "<!-- Demos mouseover, template filters, template control flow,\n     and static script exports -->\n<Template>\n  <div class=\"grid\">\n    {% for i in script.exports.range %}\n      <div @mouseover:=script.setNum\n        class=\"\n            {# If-statements to check divisibility in template: #}\n            {% if state.number == i %}number{% endif %}\n            {% if state.number lt i %}hidden{% else %}\n              {% if state.number|divisibleby:i %}whole{% endif %}\n            {% endif %}\n        \">{{ i }}</div>\n    {% endfor %}\n  </div>\n</Template>\n\n<State\n    number:=64\n></State>\n\n<Script>\n    // Getting big a range of numbers in JS. Use \"script.exports\"\n    // to export this as a one-time global constant.\n    // (Hint: Curious how it calculates prime? See CSS!)\n    script.exports.range = \n        Array.from({length: 63}, (x, i) => i + 2);\n    function setNum(payload, ev) {\n        state.number = Number(ev.target.textContent);\n    }\n</Script>\n\n<Style>\n.grid {\n    display: grid;\n    grid-template-columns: repeat(9, 1fr);\n    color: #ccc;\n    font-weight: bold;\n    width: 100%;\n    margin: -5px;\n}\n.grid > div {\n    border: 1px solid #ccc;\n    cursor: crosshair;\n    transition: 0.2s;\n}\ndiv.whole {\n    color: white;\n    background: #B90183;\n}\ndiv.hidden {\n    background: #ccc;\n    color: #ccc;\n}\n\n/* Color green and add asterisk */\ndiv.number { background: green; }\ndiv.number::after { content: \"*\"; }\n/* Check for whole factors (an adjacent div.whole).\n   If found, then hide asterisk and green */\ndiv.whole ~ div.number { background: #B90183; }\ndiv.whole ~ div.number::after { opacity: 0; }\n</Style>\n\n\n",
     "MemoryGame": "<!-- A much more complicated example application -->\n<Template>\n{% if not state.cards.length %}\n    <h3>The Symbolic Memory Game</h3>\n    <p>Choose your difficulty:</p>\n    <button @click:=script.setup click.payload=8>2x4</button>\n    <button @click:=script.setup click.payload=16>4x4</button>\n    <button @click:=script.setup click.payload=36>6x6</button>\n{% else %}\n    <div class=\"board\n        {% if state.cards.length > 16 %}hard{% endif %}\">\n    {# Loop through each card in the \"deck\" (state.cards) #}\n    {% for card in state.cards %}\n        {# Use \"key=\" to speed up DOM reconciler #}\n        <div key=\"c{{ card.id }}\"\n            class=\"card\n            {% if card.id in state.revealed %}\n                flipped\n            {% endif %}\n            \"\n            style=\"\n            {% if state.win %}\n                animation: flipping 0.5s infinite alternate;\n                animation-delay: {{ card.id }}.{{ card.id }}s;\n            {% endif %}\n            \"\n            @click:=script.flip\n            click.payload=\"{{ card.id }}\">\n            {% if card.id in state.revealed %}\n                {{ card.symbol }}\n            {% endif %}\n        </div>\n    {% endfor %}\n    </div>\n    <p style=\"{% if state.failedflip %}\n                color: red{% endif %}\">\n        {{ state.message }}</p>\n{% endif %}\n</Template>\n\n<State\n    message=\"Good luck!\"\n    win:=false\n    cards:=[]\n    revealed:=[]\n    lastflipped:=null\n    failedflip:=null\n></State>\n\n<Script>\nconst symbolsStr = \"%!@#=?&+~÷≠∑µ‰∂Δƒσ\"; // 16 options\nfunction setup(payload) {\n    const count = Number(payload);\n    let symbols = symbolsStr.substr(0, count/2).split(\"\");\n    symbols = symbols.concat(symbols); // duplicate cards\n    let id = 0;\n    while (id < count) {\n        const index = Math.floor(Math.random()\n                                    * symbols.length);\n        const symbol = symbols.splice(index, 1)[0];\n        state.cards.push({symbol, id});\n        id++;\n    }\n}\n\nfunction failedFlipCallback() {\n    // Remove both from revealed array & set to null\n    state.revealed = state.revealed.filter(\n            id => id !== state.failedflip\n                    && id !== state.lastflipped);\n    state.failedflip = null;\n    state.lastflipped = null;\n    state.message = \"\";\n    element.rerender();\n}\n\nfunction flip(id) {\n    if (state.failedflip !== null) {\n        return;\n    }\n    id = Number(id);\n    if (state.revealed.includes(id)) {\n        return; // double click\n    } else if (state.lastflipped === null) {\n        state.lastflipped = id;\n        state.revealed.push(id);\n    } else {\n        state.revealed.push(id);\n        const {symbol} = state.cards[id];\n        const lastCard = state.cards[state.lastflipped];\n        if (symbol === lastCard.symbol) {\n            // Successful match! Check for win.\n            const {revealed, cards} = state;\n            if (revealed.length === cards.length) {\n                state.message = \"You win!\";\n                state.win = true;\n            } else {\n                state.message = \"Nice match!\";\n            }\n            state.lastflipped = null;\n        } else {\n            state.message = \"No match.\";\n            state.failedflip = id;\n            setTimeout(failedFlipCallback, 1000);\n        }\n    }\n}\n</Script>\n\n<Style>\nh3 {\n    background: #B90183;\n    border-radius: 8px;\n    text-align: center;\n    color: white;\n    font-weight: bold;\n}\n.board {\n    display: grid;\n    grid-template-rows: repeat(4, 1fr);\n    grid-template-columns: repeat(4, 1fr);\n    grid-gap: 2px;\n    width: 100%;\n    height: 150px;\n    width: 150px;\n}\n.board.hard {\n    grid-gap: 1px;\n    grid-template-rows: repeat(6, 1fr);\n    grid-template-columns: repeat(6, 1fr);\n}\n.board > .card {\n    background: #B90183;\n    border: 2px solid black;\n    border-radius: 1px;\n    cursor: pointer;\n    text-align: center;\n    min-height: 15px;\n    transition: background 0.3s, transform 0.3s;\n    transform: scaleX(-1);\n    padding-top: 2px;\n    color: #B90183;\n}\n.board.hard > .card {\n    border: none !important;\n    padding: 0;\n}\n.board > .card.flipped {\n    background: #FFFFFF;\n    border: 2px solid #B90183;\n    transform: scaleX(1);\n}\n\n@keyframes flipping {\n    from { transform: scaleX(-1.1); background: #B90183; }\n    to {   transform: scaleX(1.0);  background: #FFFFFF; }\n}\n</Style>\n\n\n",
     "ConwayGameOfLife": "<Template>\n  <div class=\"grid\">\n    {% for i in script.exports.range %}\n        {% for j in script.exports.range %}\n          <div\n            @click:=script.toggle\n            payload:='[ {{ i }}, {{ j }} ]'\n            style=\"{% if state.cells|get:i %}\n                {% if state.cells|get:i|get:j %}\n                    background: #B90183;\n                {% endif %}\n            {% endif %}\"\n           ></div>\n        {% endfor %}\n    {% endfor %}\n  </div>\n  <div class=\"controls\">\n    {% if not state.playing %}\n        <button @click:=script.play alt=\"Play\">&#x25B6;</button>\n    {% else %}\n        <button @click:=script.pause alt=\"Pause\">&#x2016;</button>\n    {% endif %}\n\n    <button @click:=script.randomize alt=\"Randomize\">RND</button>\n    <button @click:=script.clear alt=\"Randomize\">CLR</button>\n    <label>Spd: <input [state.bind]\n        name=\"speed\"\n        type=\"number\" min=\"1\" max=\"10\" step=\"1\" /></label>\n  </div>\n</Template>\n\n<State\n    playing:=false\n    speed:=3\n    cells:='{\n        \"12\": { \"10\": true, \"11\": true, \"12\": true },\n        \"11\": { \"12\": true },\n        \"10\": { \"11\": true }\n    }'\n></State>\n\n<Script>\n    function toggle([ i, j ]) {\n        if (!state.cells[i]) {\n            state.cells[i] = {};\n        }\n        state.cells[i][j] = !state.cells[i][j];\n    }\n\n    function play() {\n        state.playing = true;\n        setTimeout(() => {\n            if (state.playing) {\n                updateNextFrame();\n                element.rerender(); // manually rerender\n                play(); // cue next frame\n            }\n        }, 2000 / state.speed);\n    }\n\n    function pause() {\n        state.playing = false;\n    }\n\n    function clear() {\n        state.cells = {};\n    }\n\n    function randomize() {\n        for (const i of script.exports.range) {\n            for (const j of script.exports.range) {\n                if (!state.cells[i]) {\n                    state.cells[i] = {};\n                }\n                state.cells[i][j] = (Math.random() > 0.5);\n            }\n        }\n    }\n\n    // Helper function for getting a cell from data\n    const get = (i, j) => !!(state.cells[i] && state.cells[i][j]);\n    function updateNextFrame() {\n        const nextData = {};\n        for (const i of script.exports.range) {\n            for (const j of script.exports.range) {\n                if (!nextData[i]) {\n                    nextData[i] = {};\n                }\n                const count = countNeighbors(i, j);\n                nextData[i][j] = get(i, j) ?\n                    (count === 2 || count === 3) : // stays alive\n                    (count === 3); // comes alive\n            }\n        }\n        state.cells = nextData;\n    }\n\n    function countNeighbors(i, j) {\n        const neighbors = [get(i - 1, j), get(i - 1, j - 1), get(i, j - 1),\n                get(i + 1, j), get(i + 1, j + 1), get(i, j + 1),\n                get(i + 1, j - 1), get(i - 1, j + 1)];\n        return neighbors.filter(v => v).length;\n    }\n    script.exports.range = Array.from({length: 24}, (x, i) => i);\n</Script>\n\n<Style>\n    :host {\n        display: flex;\n    }\n    .grid {\n        display: grid;\n        grid-template-columns: repeat(24, 5px);\n        margin: -2px;\n        grid-gap: 1px;\n    }\n    .grid > div {\n        background: white;\n        width: 5px;\n        height: 5px;\n    }\n    input, button {\n        width: 40px;\n    }\n</Style>\n\n"
    },
    "/libraries/docseg.html": {
     "Templating_1": "<Template>\n<p>There are <em>{{ state.count }}\n  {{ state.count|pluralize:\"articles,article\" }}</em>\n  on {{ script.exports.title }}.</p>\n\n{# Show the articles #}\n{% for article in state.articles %}\n    <h4 style=\"color: blue\">{{ article.headline|upper }}</h4>\n    {% if article.tease %}\n      <p>{{ article.tease|truncate:30 }}</p>\n    {% endif %}\n{% endfor %}\n</Template>\n\n<!-- The data below was used to render the template above -->\n<State\n    count:=42\n    articles:='[\n      {\"headline\": \"Modulo released!\",\n       \"tease\": \"The most exciting news of the century.\"},\n      {\"headline\": \"Can JS be fun again?\"},\n      {\"headline\": \"MTL considered harmful\",\n       \"tease\": \"Why constructing JS is risky business.\"}\n    ]'\n></State>\n<Script>\n    script.exports.title = \"ModuloNews\";\n</Script>\n\n\n",
     "Templating_PrepareCallback": "<Template>\n    <input name=\"perc\" [state.bind] />% of\n    <input name=\"total\" [state.bind] />\n    is: {{ script.calcResult }}\n</Template>\n\n<State\n    perc:=50\n    total:=30\n></State>\n\n<Script>\n    function prepareCallback() {\n        const calcResult = (state.perc / 100) * state.total;\n        return { calcResult };\n    }\n</Script>\n\n<Style>\n    input { display: inline; width: 25px }\n</Style>\n\n\n",
     "Templating_Comments": "<Template>\n    <h1>hello {# greeting #}</h1>\n    {% comment %}\n      {% if a %}<div>{{ b }}</div>{% endif %}\n      <h3>{{ state.items|first }}</h3>\n    {% endcomment %}\n    <p>Below the greeting...</p>\n</Template>\n\n\n",
     "Templating_Escaping": "<Template>\n<p>User \"<em>{{ state.username }}</em>\" sent a message:</p>\n<div class=\"msgcontent\">\n    {{ state.content|safe }}\n</div>\n</Template>\n\n<State\n    username=\"Little <Bobby> <Drop> &tables\"\n    content='\n        I <i>love</i> the classic <a target=\"_blank\"\n        href=\"https://xkcd.com/327/\">xkcd #327</a> on\n        the risk of trusting <b>user inputted data</b>\n    '\n></State>\n<Style>\n    .msgcontent {\n        background: #999;\n        padding: 10px;\n        margin: 10px;\n    }\n</Style>\n\n\n",
     "Tutorial_P1": "<Template>\nHello <strong>Modulo</strong> World!\n<p class=\"neat\">Any HTML can be here!</p>\n</Template>\n<Style>\n/* ...and any CSS here! */\nstrong {\n    color: blue;\n}\n.neat {\n    font-variant: small-caps;\n}\n:host { /* styles the entire component */\n    display: inline-block;\n    background-color: cornsilk;\n    padding: 5px;\n    box-shadow: 10px 10px 0 0 turquoise;\n}\n</Style>\n\n\n\n",
     "Tutorial_P2": "<Template>\n    <p>Trying out the button...</p>\n    <x-ExampleBtn\n        label=\"Button Example\"\n        shape=\"square\"\n    ></x-ExampleBtn>\n\n    <p>Another button...</p>\n    <x-ExampleBtn\n        label=\"Example 2: Rounded\"\n        shape=\"round\"\n    ></x-ExampleBtn>\n</Template>\n\n",
     "Tutorial_P2_filters_demo": "<Template>\n    <p>Trying out the button...</p>\n    <x-ExampleBtn\n        label=\"Button Example\"\n        shape=\"square\"\n    ></x-ExampleBtn>\n\n    <p>Another button...</p>\n    <x-ExampleBtn\n        label=\"Example 2: Rounded\"\n        shape=\"round\"\n    ></x-ExampleBtn>\n</Template>\n\n\n\n",
     "Tutorial_P3_state_demo": "<Template>\n<p>Nonsense poem:</p> <pre>\nProfessor {{ state.verb|capfirst }} who\n{{ state.verb }}ed a {{ state.noun }},\ntaught {{ state.verb }}ing in\nthe City of {{ state.noun|capfirst }},\nto {{ state.count }} {{ state.noun }}s.\n</pre>\n</Template>\n\n<State\n    verb=\"toot\"\n    noun=\"kazoo\"\n    count=\"two\"\n></State>\n\n<Style>\n    :host {\n        font-size: 0.8rem;\n    }\n</Style>\n\n\n",
     "Tutorial_P3_state_bind": "<Template>\n\n<div>\n    <label>Username:\n        <input [state.bind] name=\"username\" /></label>\n    <label>Color (\"green\" or \"blue\"):\n        <input [state.bind] name=\"color\" /></label>\n    <label>Opacity: <input [state.bind]\n        name=\"opacity\"\n        type=\"number\" min=\"0\" max=\"1\" step=\"0.1\" /></label>\n\n    <h5 style=\"\n            opacity: {{ state.opacity }};\n            color: {{ state.color|allow:'green,blue'|default:'red' }};\n        \">\n        {{ state.username|lower }}\n    </h5>\n</div>\n\n</Template>\n\n<State\n    opacity=\"0.5\"\n    color=\"blue\"\n    username=\"Testing_Username\"\n></State>\n\n\n"
    }
   }
  }
 ],
 "x_x": [
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Library",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "library",
   "Name": "x",
   "Parent": "x_x",
   "DefName": "x",
   "FullName": "x_x_x",
   "Hash": "x1ldrcnf"
  },
  {
   "Type": "Library",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "library",
   "Name": "mws",
   "Parent": "x_x",
   "DefName": "mws",
   "FullName": "x_x_mws",
   "Hash": "x55gtu7"
  },
  {
   "Type": "Library",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "library",
   "Name": "docseg",
   "Parent": "x_x",
   "DefName": "docseg",
   "FullName": "x_x_docseg",
   "Hash": "xs9953o"
  },
  {
   "Type": "Library",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "library",
   "Name": "eg",
   "Parent": "x_x",
   "DefName": "eg",
   "FullName": "x_x_eg",
   "Hash": "69vqt9"
  }
 ],
 "x_x_x": [
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "x",
   "name": "DemoModal",
   "Parent": "x_x_x",
   "DefName": null,
   "Name": "DemoModal",
   "FullName": "x_x_x_DemoModal",
   "Hash": "1rpq1pk",
   "TagName": "x-demomodal",
   "FuncDefHash": "x829hs9"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "name": "DemoChart",
   "Parent": "x_x_x",
   "DefName": null,
   "Name": "DemoChart",
   "FullName": "x_x_x_DemoChart",
   "Hash": "x1sgecs4",
   "namespace": "x_x_x",
   "TagName": "x_x_x-demochart",
   "FuncDefHash": "j6jhe5"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "x",
   "name": "ExampleBtn",
   "Parent": "x_x_x",
   "DefName": null,
   "Name": "ExampleBtn",
   "FullName": "x_x_x_ExampleBtn",
   "Hash": "i2kvpp",
   "TagName": "x-examplebtn",
   "FuncDefHash": "u4j43f"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "x",
   "name": "DemoSelector",
   "Parent": "x_x_x",
   "DefName": null,
   "Name": "DemoSelector",
   "FullName": "x_x_x_DemoSelector",
   "Hash": "ripjvb",
   "TagName": "x-demoselector",
   "FuncDefHash": "x1jemelq"
  }
 ],
 "x_x_mws": [
  {
   "Type": "Component",
   "mode": "vanish-into-document",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "mws",
   "name": "Page",
   "Parent": "x_x_mws",
   "DefName": null,
   "Name": "Page",
   "FullName": "x_x_mws_Page",
   "Hash": "1apn7pv",
   "TagName": "mws-page",
   "FuncDefHash": "rbuqe3"
  },
  {
   "Type": "Component",
   "mode": "vanish",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "mws",
   "name": "DevLogNav",
   "Parent": "x_x_mws",
   "DefName": null,
   "Name": "DevLogNav",
   "FullName": "x_x_mws_DevLogNav",
   "Hash": "hdrs3f",
   "TagName": "mws-devlognav",
   "FuncDefHash": "x1ek8a23"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "mws",
   "name": "DocSidebar",
   "Parent": "x_x_mws",
   "DefName": null,
   "Name": "DocSidebar",
   "FullName": "x_x_mws_DocSidebar",
   "Hash": "15strma",
   "TagName": "mws-docsidebar",
   "FuncDefHash": "xlb2rd4"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "mws",
   "name": "Demo",
   "Parent": "x_x_mws",
   "DefName": null,
   "Name": "Demo",
   "FullName": "x_x_mws_Demo",
   "Hash": "1jolobd",
   "TagName": "mws-demo",
   "FuncDefHash": "xae74iu"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "mws",
   "name": "AllExamples",
   "Parent": "x_x_mws",
   "DefName": null,
   "Name": "AllExamples",
   "FullName": "x_x_mws_AllExamples",
   "Hash": "x3m56c2",
   "TagName": "mws-allexamples",
   "FuncDefHash": "xescvna"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "mws",
   "name": "Section",
   "Parent": "x_x_mws",
   "DefName": null,
   "Name": "Section",
   "FullName": "x_x_mws_Section",
   "Hash": "x1d1j0ca",
   "TagName": "mws-section",
   "FuncDefHash": "x2s8nar"
  }
 ],
 "x_x_docseg": [
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Templating_1",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Templating_1",
   "FullName": "x_x_docseg_Templating_1",
   "Hash": "g1ev96",
   "TagName": "docseg-templating_1",
   "FuncDefHash": "x1s5o68b"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Templating_PrepareCallback",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Templating_PrepareCallback",
   "FullName": "x_x_docseg_Templating_PrepareCallback",
   "Hash": "x1u7tsfu",
   "TagName": "docseg-templating_preparecallback",
   "FuncDefHash": "x1ut59dd"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Templating_Comments",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Templating_Comments",
   "FullName": "x_x_docseg_Templating_Comments",
   "Hash": "l7svrm",
   "TagName": "docseg-templating_comments",
   "FuncDefHash": "1hpjg9n"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Templating_Escaping",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Templating_Escaping",
   "FullName": "x_x_docseg_Templating_Escaping",
   "Hash": "x1ehsatd",
   "TagName": "docseg-templating_escaping",
   "FuncDefHash": "xfvvd04"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Tutorial_P1",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Tutorial_P1",
   "FullName": "x_x_docseg_Tutorial_P1",
   "Hash": "x51qst3",
   "TagName": "docseg-tutorial_p1",
   "FuncDefHash": "1tlgcio"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Tutorial_P2",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Tutorial_P2",
   "FullName": "x_x_docseg_Tutorial_P2",
   "Hash": "1uj7p64",
   "TagName": "docseg-tutorial_p2",
   "FuncDefHash": "xi6k4ld"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Tutorial_P2_filters_demo",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Tutorial_P2_filters_demo",
   "FullName": "x_x_docseg_Tutorial_P2_filters_demo",
   "Hash": "t0upt6",
   "TagName": "docseg-tutorial_p2_filters_demo",
   "FuncDefHash": "x1dbdrel"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Tutorial_P3_state_demo",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Tutorial_P3_state_demo",
   "FullName": "x_x_docseg_Tutorial_P3_state_demo",
   "Hash": "1oig15e",
   "TagName": "docseg-tutorial_p3_state_demo",
   "FuncDefHash": "xflbnij"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "docseg",
   "name": "Tutorial_P3_state_bind",
   "Parent": "x_x_docseg",
   "DefName": null,
   "Name": "Tutorial_P3_state_bind",
   "FullName": "x_x_docseg_Tutorial_P3_state_bind",
   "Hash": "ngpccm",
   "TagName": "docseg-tutorial_p3_state_bind",
   "FuncDefHash": "x14n2s57"
  }
 ],
 "x_x_eg": [
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "Hello",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "Hello",
   "FullName": "x_x_eg_Hello",
   "Hash": "1icoagp",
   "TagName": "eg-hello",
   "FuncDefHash": "1sp05hb"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "Simple",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "Simple",
   "FullName": "x_x_eg_Simple",
   "Hash": "xlo7cf3",
   "TagName": "eg-simple",
   "FuncDefHash": "12v9omt"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "ToDo",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "ToDo",
   "FullName": "x_x_eg_ToDo",
   "Hash": "1k33iqb",
   "TagName": "eg-todo",
   "FuncDefHash": "x1i4hc01"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "JSON",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "JSON",
   "FullName": "x_x_eg_JSON",
   "Hash": "x11tjlh2",
   "TagName": "eg-json",
   "FuncDefHash": "xqrkh3q"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "JSONArray",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "JSONArray",
   "FullName": "x_x_eg_JSONArray",
   "Hash": "xcql4f2",
   "TagName": "eg-jsonarray",
   "FuncDefHash": "x1asnbs6"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "API",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "API",
   "FullName": "x_x_eg_API",
   "Hash": "x1at59fc",
   "TagName": "eg-api",
   "FuncDefHash": "x1edl05g"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "ColorSelector",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "ColorSelector",
   "FullName": "x_x_eg_ColorSelector",
   "Hash": "6riop6",
   "TagName": "eg-colorselector",
   "FuncDefHash": "khu4dj"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "SearchBox",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "SearchBox",
   "FullName": "x_x_eg_SearchBox",
   "Hash": "ljc2i4",
   "TagName": "eg-searchbox",
   "FuncDefHash": "q0bbc"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "DateNumberPicker",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "DateNumberPicker",
   "FullName": "x_x_eg_DateNumberPicker",
   "Hash": "1i6hhtf",
   "TagName": "eg-datenumberpicker",
   "FuncDefHash": "x3ue3jq"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "FlexibleForm",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "FlexibleForm",
   "FullName": "x_x_eg_FlexibleForm",
   "Hash": "x4vivet",
   "TagName": "eg-flexibleform",
   "FuncDefHash": "x1lvrjsl"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "FlexibleFormWithAPI",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "FlexibleFormWithAPI",
   "FullName": "x_x_eg_FlexibleFormWithAPI",
   "Hash": "x1sg84mj",
   "TagName": "eg-flexibleformwithapi",
   "FuncDefHash": "x1gjb161"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "Components",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "Components",
   "FullName": "x_x_eg_Components",
   "Hash": "xeg9s6i",
   "TagName": "eg-components",
   "FuncDefHash": "x573nef"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "OscillatingGraph",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "OscillatingGraph",
   "FullName": "x_x_eg_OscillatingGraph",
   "Hash": "ugu6po",
   "TagName": "eg-oscillatinggraph",
   "FuncDefHash": "dib48s"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "PrimeSieve",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "PrimeSieve",
   "FullName": "x_x_eg_PrimeSieve",
   "Hash": "1b9a0ql",
   "TagName": "eg-primesieve",
   "FuncDefHash": "1f849r0"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "MemoryGame",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "MemoryGame",
   "FullName": "x_x_eg_MemoryGame",
   "Hash": "14schu5",
   "TagName": "eg-memorygame",
   "FuncDefHash": "1n2i9fj"
  },
  {
   "Type": "Component",
   "mode": "regular",
   "rerender": "event",
   "engine": "Reconciler",
   "ConfPreprocessors": [
    "Src",
    "Content"
   ],
   "RenderObj": "component",
   "namespace": "eg",
   "name": "ConwayGameOfLife",
   "Parent": "x_x_eg",
   "DefName": null,
   "Name": "ConwayGameOfLife",
   "FullName": "x_x_eg_ConwayGameOfLife",
   "Hash": "x1ketdcf",
   "TagName": "eg-conwaygameoflife",
   "FuncDefHash": "86fv1g"
  }
 ],
 "x_x_x_DemoModal": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "button": "",
   "title": "",
   "Content": "",
   "Parent": "x_x_x_DemoModal",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoModal_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_x_DemoModal",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoModal_x",
   "Hash": "1pdamd5"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "visible": false,
   "Content": "",
   "Parent": "x_x_x_DemoModal",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoModal_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_x_DemoModal",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoModal_x",
   "Hash": "16849hb",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n        .modal-backdrop {\n            position: fixed;\n            top: 0;\n            left: 0;\n            height: 100vh;\n            width: 100vw;\n        }\n        .modal-backdrop {\n            background: rgba(0, 0, 0, 0.5);\n            z-index: 11;\n        }\n        .modal-body {\n            --w: 400px;\n            width: var(--w);\n            position: fixed;\n            z-index: 12;\n            left: calc(50vw - (var(--w) / 2));\n            display: block;\n            background: white;\n            border: 7px solid black;\n            border-radius: 7px;\n            padding: 50px;\n            transition: top 1s;\n        }\n        .modal-body > h2 {\n            border-bottom: 3px solid black;\n            color: black;\n            background-color: #b90183;\n            font-weight: bold;\n            padding: 10px;\n            border-top: 0;\n            margin: -50px;\n            margin-bottom: 50px;\n            color: white;\n            /* A perspective-style drop shadow, plus 1px outline */\n            text-shadow:\n                3px 3px 0 #000,\n                2px 2px 0 #000,\n              -1px -1px 0 #000,\n                1px -1px 0 #000,\n                -1px 1px 0 #000,\n                1px 1px 0 #000;\n        }\n        .modal-body > h2 button {\n            font-size: 25px;\n            float: right;\n            width: 50px;\n        }\n\n        button {\n            font-size: 13px;\n            font-weight: bold;\n            padding: 5px;\n            border-radius: 1px 5px 1px 7px;\n            color: black;\n            border: 1px solid grey;\n            box-shadow: inset -2px -3px 1px 1px hsla(0,0%,39.2%,.3);\n            cursor: default;\n            margin-top: 0px;\n            padding-bottom: 3px;\n            background-color: white;\n            margin-bottom: 4px;\n            transition: margin 0.2s,\n                        padding 0.2s,\n                        background 0.3s,\n                        box-shadow 0.2s;\n        }\n        button:active {\n            box-shadow: inset 2px 3px 1px 1px hsla(0,0%,39.2%,.3);\n            margin-top: 3px;\n            padding-bottom: 0;\n        }\n        button:hover {\n            background-color: rgba(162, 228, 184);\n        }\n    ",
   "Parent": "x_x_x_DemoModal",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoModal_x"
  }
 ],
 "x_x_x_DemoChart": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "data": "",
   "animated": "",
   "Content": "",
   "Parent": "x_x_x_DemoChart",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoChart_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_x_DemoChart",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoChart_x",
   "Hash": "1k78eap"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_x_DemoChart",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoChart_x",
   "Hash": "3hrifc",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n        .chart-container {\n            border: 1px solid black;\n            height: 100px;\n            width: 100px;\n            display: flex;\n            align-items: flex-end;\n        }\n        .chart-container > div {\n            box-sizing: border-box;\n            background-color: #b90183;\n            background-color: white;\n            border: 1px solid grey;\n            width: 30px;\n            border-radius: 1px 5px 1px 5px;\n            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);\n            margin-top: -5px;\n        }\n\n        .chart-container.animated > div {\n            transition: height calc(var(--speed, 10) * 0.1s) var(--easing, linear);\n        }\n        .chart-container > div:first-of-type {\n            margin-left: -4px;\n        }\n        .chart-container > div:hover {\n            background-color: #b90183;\n        }\n        label {\n            display: inline-block;\n        }\n    ",
   "Parent": "x_x_x_DemoChart",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoChart_x"
  }
 ],
 "x_x_x_ExampleBtn": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "label": "",
   "shape": "",
   "Content": "",
   "Parent": "x_x_x_ExampleBtn",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_ExampleBtn_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_x_ExampleBtn",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_ExampleBtn_x",
   "Hash": "xdq8aqd"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n        .my-btn {\n            display: inline-block;\n            box-sizing: border-box;\n            font-family: sans-serif;\n            border: 1px solid gray;\n            transition: 0.1s;\n            box-shadow:\n                inset -3px -3px\n                1px 1px rgba(100, 100, 100, 0.3);\n            border-radius: 1px 8px 1px 8px;\n            cursor: default;\n            text-align: center;\n            padding: 3px;\n            padding-right: 5px;\n            padding-bottom: 5px;\n            height: 30px;\n            background: turquoise;\n            font-weight: bold;\n        }\n\n        .my-btn:active {\n            box-shadow: inset 3px 3px 1px 1px rgba(100, 100, 100, 0.3);\n        }\n        .my-btn__square {\n            border-radius: 1px 8px 1px 8px;\n        }\n        .my-btn__round {\n            border-radius: 150px;\n        }\n    ",
   "Parent": "x_x_x_ExampleBtn",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_ExampleBtn_x"
  }
 ],
 "x_x_x_DemoSelector": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "onchange": "",
   "options": "",
   "name": "",
   "Content": "",
   "Parent": "x_x_x_DemoSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoSelector_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_x_DemoSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoSelector_x",
   "Hash": "xaqkmi6"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "value": "",
   "Content": "",
   "Parent": "x_x_x_DemoSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoSelector_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_x_DemoSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoSelector_x",
   "Hash": "x17kp43e",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n        label {\n            font-size: 13px;\n            font-weight: bold;\n            border-radius: 1px 5px 1px 5px;\n            background:  #b90183;\n            color: black;\n            border: 1px solid grey;\n            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);\n            cursor: default;\n            margin-top: 0px;\n            padding: 5px;\n            background-color: white;\n            margin-bottom: 4px;\n            margin-left: 3px;\n        }\n        input:checked + label {\n            box-shadow: inset 5px 5px 1px 1px hsla(0,0%,39.2%,.3);\n            margin-top: 5px;\n        }\n    ",
   "Parent": "x_x_x_DemoSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_x_DemoSelector_x"
  }
 ],
 "x_x_mws_Page": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "navbar": "",
   "docbarselected": "",
   "pagetitle": "",
   "Content": "",
   "Parent": "x_x_mws_Page",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Page_x"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": ":root {\n    --highlight-color: #B90183;\n}\n\ncode {\n  font-family: monospace;\n  border-bottom: 1px dotted var(--highlight-color);\n}\n\nhtml {\n  box-sizing: border-box;\n  font-size: 16px;\n  line-height: 1.5;\n  font-family: sans-serif;\n  /*font-family: serif;*/\n  overflow-y: scroll;\n}\n\n*, *:before, *:after {\n  box-sizing: inherit;\n}\n\nbody, h1, h2, h3, h4, h5, h6, p, ol, ul {\n  margin: 0;\n  padding: 0;\n  font-weight: normal;\n}\n\nol, ul {\n  list-style: none;\n}\n\nimg {\n  max-width: 100%;\n  height: auto;\n}\n\n.m-Btn,\n.m-Btn:visited,\n.m-Btn:active,\n.m-Btn:hover {\n    display: inline-block;\n    border: 2px solid black;\n    border-top-width: 1px;\n    border-bottom-width: 3px;\n    border-radius: 3px;\n    background: white;\n    font-weight: lighter;\n    text-transform: uppercase;\n    font-size: 1.1rem;\n    color: black;\n    padding: 5px;\n    text-decoration: none;\n    margin-top: 2px;\n}\n\n.m-Btn.m-Btn--sm,\n.m-Btn.m-Btn--sm:hover {\n    font-size: 0.95rem;\n    border-bottom-width: 2px;\n    padding: 2px;\n}\n\n.m-Btn--faded {\n    opacity: 0.3;\n    transition: opacity 0.2s;\n}\n.m-Btn--faded:hover {\n    opacity: 1.0;\n}\n\n.m-Btn:active {\n    border-top-width: 3px;\n    border-bottom-width: 1px;\n}\n\n.m-Btn:hover {\n    box-shadow: 0 0 2px var(--highlight-color); /* extremely subtle shadow */\n}\n\nnav.Navbar {\n    padding-top: 10px;\n    background: white;\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: sticky;\n    top: 0;\n    z-index: 7; /* code mirror scrollbars are 6 */\n    height: 100px;\n}\n\nnav.Navbar--docs {\n  /*\n  height: 50px;\n  padding-top: 0;\n  border-top: 1px dotted black;\n  top: 100px !important;\n  position: fixed !important;\n  width: 100%;\n  */\n}\n\nnav.Navbar ul {\n    max-width: 800px;\n    display: flex;\n    justify-content: center;\n    align-items: baseline;\n}\n\nnav.Navbar li {\n    margin-left: 50px;\n}\n\nnav.Navbar li a {\n    font-size: 30px;\n    text-transform: uppercase;\n    color: black;\n}\n\nnav.Navbar--subbar li a {\n    text-transform: none;\n    font-size: 20px;\n    text-decoration: none;\n    font-weight: bold;\n    line-height: 0.9;\n    text-align: left;\n}\n\nnav.Navbar li a.Navbar--selected {\n    text-decoration: overline underline;\n}\n\nnav.Navbar--subbar li a.Navbar--selected {\n    text-decoration: none;\n    color: #B90183;\n}\n\nnav.Navbar .Navbar-rightInfo {\n    font-size: 12px;\n    text-align: left;\n    margin-left: 40px;\n    /*border: 1px solid black;*/\n    padding: 5px;\n}\n\n.Main {\n    max-width: 820px;\n    margin: auto;\n    clear: both;\n    box-sizing: border-box;\n}\n\n.Main--fluid {\n    width: 98%;\n    padding-left: 20px;\n    padding-right: 20px;\n    max-width: 100vw;\n}\n\nsection.SideBySide {\n    display: flex;\n}\n\nsection.SideBySide aside strong {\n    color: #B90183;\n}\n\nsection.SideBySide aside h3 {\n    font-size: 30px;\n}\n\nsection.SideBySide aside h3 span {\n    font-size: 80px;\n    font-weight: bold;\n    color: #B90183;\n}\n\nsection.SideBySide aside.TitleAside {\n    text-align: right;\n}\nsection.SideBySide aside.TitleAside a {\n    font-size: 18px;\n}\n\n\n.TitleAside-navigation {\n  position: sticky;\n  top: 100px;\n  left: 0px;\n}\n\n.TitleAside--navBar nav {\n  text-align: left;\n}\n\n@media (max-width: 992px) {\n    .TitleAside--navBar {\n        position: static;\n        width: 100%;\n    }\n}\n\n\naside {\n    border: 1px solid black;\n    margin-right: 10px;\n    padding: 20px;\n    margin-bottom: 10px;\n    margin-top: 30px;\n}\naside:last-of-type {\n    margin-right: 0;\n}\n\n\n\na {\n    color: #000;\n}\na:visited {\n    color: #666;\n}\n\n@media (max-width: 992px) {\n    nav.Navbar li {\n        font-size: 24px;\n        margin-left: 20px;\n    }\n    nav.Navbar ul {\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n}\n\n\nnav.Navbar {\n    padding-top: 10px;\n    background: white;\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    position: sticky;\n    top: 0;\n    z-index: 7;\n    /*box-shadow: 0 50px 50px 2px rgba(255, 255, 255, 1);*/\n    border-bottom: 1px solid black;\n}\n\nnav.Navbar ul {\n    max-width: 800px;\n    display: flex;\n    justify-content: center;\n}\n\n\ndiv.IndexWrapper {\n    min-height: calc(100vh - 100px);\n}\n\ndiv.IndexWrapper mws-Demo {\n  margin-top: 10px;\n}\n\n@media (min-height: 768px) {\n    div.IndexWrapper mws-Demo {\n        margin-top: 100px;\n    }\n}\n\ndiv.Tagline {\n    text-align: center;\n}\ndiv.Tagline ul {\n    width: 500px;\n    margin: auto;\n}\n\ndiv.Tagline ul > li {\n    text-align: left;\n    list-style-type: '>>   ';\n}\n@media (min-height: 768px) {\n    div.Tagline ul {\n        margin-top: 50px;\n        width: 560px;\n    }\n    div.Tagline ul > li {\n        font-size: 1.3rem;\n    }\n}\n\nh1.Tagline-title {\n    text-align: center;\n    font-size: 50px;\n    line-height: 1.0;\n    /*font-weight: lighter;*/\n    font-weight: 800; /* heavy if possible */\n    letter-spacing: 10px;\n    /*color: black;*/\n    /*color: var(--highlight-color);*/\n    text-shadow: 0 0 1px var(--highlight-color); /* extremely subtle shadow */\n    -webkit-text-stroke-width: 1px;\n    -webkit-text-stroke-color: black;\n    color: black;\n}\n\n.Tagline-logoimg {\n    height: 100px;\n}\n@media (min-height: 768px) {\n    .Tagline-logoimg { height: 150px; }\n}\n\nh1.Tagline-logo {\n    text-align: center;\n    font-size: 200px;\n    line-height: 1.0;\n    /*text-shadow: 0 0 27px var(--highlight-color);*/\n    /*text-shadow: 0 0 5px #000;*/\n    text-shadow: 0 0 2px var(--highlight-color); /* extremely subtle shadow */\n    -webkit-text-stroke-width: 1px;\n    -webkit-text-stroke-color: black;\n    color: black;\n    background: white;\n    font-weight: 300; /* lightest if possible */\n}\n\nmain {\n    max-width: 800px;\n    margin: auto;\n}\n\nmain.give-left-padding > :not(.TitleAside) {\n    margin-left: 300px;\n}\n\nsection {\n    display: flex;\n}\n\naside {\n    border: 1px solid black;\n    margin-right: 10px;\n    padding: 20px;\n    margin-bottom: 10px;\n    margin-top: 30px;\n}\naside:last-of-type {\n    margin-right: 0;\n}\n\n\na {\n    color: #000;\n}\na:visited {\n    color: #666;\n}\n\n.Main p {\n    margin-top: 5px;\n    margin-bottom: 20px;\n}\n\n.Main p:last-of-type {\n    margin-bottom: 0;\n}\n\n.Main ul li {\n    list-style: disc;\n    margin-left: 40px;\n}\n\n.Main nav:not(.TitleAside-navigation) ul li {\n    list-style: none;\n    margin-left: 0;\n}\n\n.Main .InfoBox {\n    border: 1px solid var(--highlight-color);\n    padding: 20px;\n    display: block;\n    position: relative;\n    clear: both;\n    font-size: 0.95rem;\n}\n\n.Main hr {\n    border: 1px solid #888;\n    width: 80%;\n}\n\n.Main .InfoBox > h2 {\n    color: var(--highlight-color);\n    font-weight: bold;\n    text-transform: uppercase;\n    font-size: 1.1rem;\n    margin-top: -10px;\n    letter-spacing: 1px;\n}\n\n.Main > h2,\n.Main > * > h2,\n.Main > * > * > h2 {\n    /*border-top: 1px solid #888;*/\n    /*padding-top: 10px;*/\n    width: 80%;\n    /*margin-top: 20px;*/\n    font-weight: bold;\n    font-size: 1.6rem;\n}\n\n.Main h3 {\n    font-weight: bold;\n    font-size: 1.3rem;\n    margin-top: 10px;\n}\n.Main h4 {\n    font-weight: bold;\n    font-size: 1.1rem;\n    margin-top: 5px;\n}\n\n/* Adding some top margin for the top-level h3/h4s */\n.Main > * > h3 {\n    margin-top: 40px;\n}\n.Main > * > h4 {\n    margin-top: 20px;\n}\n.Main > * > mws-Demo:not(:last-child) > .demo-wrapper {\n    margin-bottom: 60px;\n}\n\n.Main blockquote {\n    max-width: 30%;\n    float: right;\n    border: 1px solid black;\n    border-radius: 10px;\n    padding: 10px;\n    margin: 10px;\n    line-height: 1.3;\n    font-size: 0.98rem;\n}\n@media (max-width: 992px) {\n    .Main blockquote {\n        max-width: none;\n        float: none;\n        clear: both;\n    }\n}\n\n.Main blockquote > p {\n    margin-top: 5px;\n    margin-bottom: 0;\n}\n.Main blockquote > p:first-child {\n    margin-top: 0;\n}\n\n.Main blockquote strong {\n    color: var(--highlight-color);\n    font-size: 1.1rem;\n}\n\n.Main blockquote strong:first-child::before {\n    content: '%   ';\n}\n\n.Tutorial-tryit::before {\n    content: '';\n}\n.Tutorial-tryit {\n    border: 1px solid var(--highlight-color);\n    padding: 20px;\n    display: block;\n    position: relative;\n    clear: both;\n}\n\n.DemoPanels {\n    display: flex;\n}\n\n.DemoPanels > li {\n    display: block;\n    width: 200px;\n    height: 200px;\n    border: 3px solid black;\n    border-radius: 2px;\n    padding: 5px;\n    margin: 5px;\n    position: relative;\n}\n\n.DemoPanels li a {\n    text-align: center;\n    font-size: 20px;\n}\n.DemoPanels li a::after {\n    content: '\\300B';\n}\n\n.DemoPanels li a:hover {\n    color: var(--highlight-color);\n}\n.DemoPanels > li:hover {\n    border-color: var(--highlight-color);\n}\n\n.DemoPanels li a::before {\n    content: ' ';\n    position: absolute;\n    display: block;\n    top: 0;\n    left: 0;\n    width: 100%;\n    height: 100%;\n    z-index: 1;\n}\n\n.Tutorial-tryit h4 {\n    color: var(--highlight-color);\n    font-weight: bold;\n    text-transform: uppercase;\n    font-size: 22px;\n    margin-top: -10px;\n    letter-spacing: 1px;\n}\n\n.Main ol > li {\n    list-style: decimal;\n    margin-left: 40px;\n}\n\n.Main--withSidebar {\n    display: grid;\n    grid-template-columns: 350px 1fr;\n}\n\n\n\n@media (max-width: 992px) {\n    .Main { display: block; }\n}\n\n@media (max-width: 992px) {\n    nav.Navbar li {\n        font-size: 24px;\n        margin-left: 20px;\n    }\n    nav.Navbar ul {\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n\n    div.Tagline {\n        padding: 5px;\n    }\n    nav.Navbar .Navbar-rightInfo {\n        padding: 2px;\n        margin-left: 10px;\n    }\n\n}\n\nfooter {\n    color: #aaa;\n    padding: 20px;\n    margin-top: 50px;\n    text-align: center;\n}\n\n",
   "Parent": "x_x_mws_Page",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Page_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_mws_Page",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Page_x",
   "Hash": "x1t2vqnu"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_mws_Page",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Page_x",
   "Hash": "x1rrhpdc",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  }
 ],
 "x_x_mws_DevLogNav": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "fn": "",
   "Content": "",
   "Parent": "x_x_mws_DevLogNav",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DevLogNav_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_mws_DevLogNav",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DevLogNav_x",
   "Hash": "x1kedq0o"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "data": [
    [
     "2022-03",
     "Next steps for alpha"
    ],
    [
     "2021-09",
     "Thoughts on design"
    ],
    [
     "2021-01",
     "FAQ"
    ]
   ],
   "Content": "",
   "Parent": "x_x_mws_DevLogNav",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DevLogNav_x"
  }
 ],
 "x_x_mws_DocSidebar": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "path": "",
   "showall": "",
   "Content": "",
   "Parent": "x_x_mws_DocSidebar",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DocSidebar_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_mws_DocSidebar",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DocSidebar_x",
   "Hash": "15rm5nh"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "menu": [],
   "Content": "",
   "Parent": "x_x_mws_DocSidebar",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DocSidebar_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_mws_DocSidebar",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DocSidebar_x",
   "Hash": "3ia7ql",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "li {\n    margin-left: 50px;\n}\n/*\nli.ginactive > ul::before,\nli.gactive > ul::before {\n    content: ' - ';\n    background: var(--highlight-color);\n    color: white;\n    text-decoration: none;\n}\n*/\nli.ginactive > a::before {\n    content: '+ ';\n}\n\n",
   "Parent": "x_x_mws_DocSidebar",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_DocSidebar_x"
  }
 ],
 "x_x_mws_Demo": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "text": "",
   "text2": "",
   "text3": "",
   "ttitle": "",
   "ttitle2": "",
   "ttitle3": "",
   "demotype": "",
   "fromlibrary": "",
   "Content": "",
   "Parent": "x_x_mws_Demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Demo_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_mws_Demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Demo_x",
   "Hash": "t08jf1"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "tabs": [],
   "selected": null,
   "preview": "",
   "text": "",
   "nscounter": 1,
   "showpreview": false,
   "showclipboard": false,
   "fullscreen": false,
   "Content": "",
   "Parent": "x_x_mws_Demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Demo_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_mws_Demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Demo_x",
   "Hash": "xrkkgea",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": ".demo-wrapper.demo-wrapper__minipreview .CodeMirror {\n    height: 200px;\n}\n\n.demo-wrapper.demo-wrapper__clipboard .CodeMirror {\n    height: auto;\n}\n\n.demo-wrapper.demo-wrapper__clipboard .CodeMirror * {\n    font-family: monospace;\n    font-size: 1rem;\n}\n\n.demo-wrapper.demo-wrapper__minipreview .CodeMirror * {\n    font-family: monospace;\n    font-size: 14px;\n}\n\n.demo-wrapper.demo-wrapper__fullscreen .CodeMirror {\n    height: 87vh;\n}\n.demo-wrapper.demo-wrapper__fullscreen .CodeMirror * {\n    font-family: monospace;\n    font-size: 16px;\n}\n\n.CodeMirror span.cm-string-2 {\n    color: black !important;\n}\n\n.demo-wrapper {\n    position: relative;\n    display: block;\n    width: 100%;\n}\n\n.Main--fluid  .demo-wrapper.demo-wrapper__minipreview   {\n    /* Make look better in Docs */\n    max-width: 900px;\n}\n.Main--fluid  .demo-wrapper.demo-wrapper__minipreview.demo-wrapper__fullscreen  {\n    /* ...except if full screen */\n    max-width: 100vw;\n}\n\n.demo-wrapper.demo-wrapper__fullscreen {\n    position: absolute;\n    display: block;\n    width: 100vw;\n    height: 100vh;\n    z-index: 100;\n    top: 0;\n    left: 0;\n    box-sizing: border-box;\n    padding: 20px;\n    background: white;\n}\n\n/* No tabs sitch: */\n.demo-wrapper__notabs .editor-minipreview {\n    margin-top: 40px;\n    margin-left: 5px;\n    border: 1px solid #999;\n    height: 160px;\n}\n\n.demo-wrapper__fullscreen.demo-wrapper__notabs .editor-minipreview {\n    margin-top: 65px;\n}\n\n.editor-toolbar {\n    position: absolute;\n    z-index: 3;\n    display: flex;\n    width: auto;\n    /*right: -70px;*/\n    right: 30px;\n    top: 0;\n    height: 35px;\n    padding: 2px;\n    border: #ddd 1px solid;\n}\n\n\n\n.demo-wrapper__fullscreen .editor-toolbar {\n    height: 60px;\n    padding: 10px;\n}\n\n\n.demo-wrapper__minipreview  .editor-wrapper {\n    width: 78%;\n    border: 1px solid black;\n}\n.Main--fluid  .demo-wrapper__minipreview  .editor-wrapper {\n}\n\n.demo-wrapper.demo-wrapper__clipboard .editor-wrapper {\n    border: 1px dotted #ddd;\n    width: 100%;\n}\n\n.demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {\n    border: 5px solid black;\n    border-radius: 1px 8px 1px 8px;\n    border-bottom-width: 1px;\n    border-right-width: 1px;\n}\n\n.editor-minipreview {\n    border: 1px solid black;\n    border-radius: 1px;\n    background: #eee;\n    padding: 5px;\n    border-left: none;\n    width: 200px;\n    height: 200px;\n    overflow-y: auto;\n}\n.editor-minipreview > div > * > input {\n  max-width: 175px;\n}\n\n.demo-wrapper__fullscreen .editor-minipreview {\n    width: 30vw;\n    height: auto;\n    border: 1px solid black;\n    margin: 20px;\n    padding: 30px;\n    border: 5px solid black;\n    border-radius: 1px 8px 1px 8px;\n    border-bottom-width: 1px;\n    border-right-width: 1px;\n}\n\n.side-by-side-panes {\n    display: flex;\n    justify-content: space-between;\n}\n\n.TabNav {\n    /*border-bottom: 1px dotted var(--highlight-color);*/\n    width: 100%;\n}\n\n\n.TabNav > ul {\n    width: 100%;\n    display: flex;\n}\n\n.TabNav-title {\n    border: 2px solid black;\n    border-top-width: 4px;\n    /*border-bottom-width: 0;*/\n    margin-bottom: -2px;\n    border-radius: 8px 8px 0 0;\n    background: white;\n    min-width: 50px;\n    box-shadow: 0 0 0 0 var(--highlight-color);\n    transition: box-shadow 0.3s,\n                border-color 0.2s;\n}\n\n.TabNav-title a,\n.TabNav-title a:visited,\n.TabNav-title a:active {\n    text-decoration: none;\n    color: black;\n    display: block;\n    padding: 5px;\n    font-weight: bold;\n    cursor: pointer;\n    font-size: 1.1rem;\n}\n\n.TabNav-title:hover {\n    border-color: var(--highlight-color);\n}\n\n.TabNav-title--selected {\n    border-color: var(--highlight-color);\n    background: var(--highlight-color);\n    box-shadow: 0 0 0 8px var(--highlight-color);\n    border-radius: 8px 8px 8px 8px;\n}\n.TabNav-title--selected a {\n    color: white !important;\n}\n\n\n@media (max-width: 992px) {\n    .TabNav > ul {\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n}\n@media (max-width: 768px) {\n    .TabNav-title {\n        padding: 7px;\n    }\n}\n\n\n\n@media (max-width: 768px) {\n    .demo-wrapper.demo-wrapper__fullscreen {\n        position: relative;\n        display: block;\n        width: 100vw;\n        height: auto;\n        z-index: 1;\n    }\n}\n\n\n@media (max-width: 768px) {\n    .editor-toolbar {\n        position: static;\n        padding: 10px;\n        margin: 20px;\n        height: 60px;\n        font-size: 1.1rem;\n    }\n    .demo-wrapper__fullscreen .editor-toolbar {\n        margin: 5px;\n        height: 60px;\n        padding: 5px;\n        display: flex;\n        justify-content: flex-end;\n    }\n}\n\n\n@media (max-width: 768px) {\n    .side-by-side-panes {\n        display: block;\n    }\n}\n\n@media (max-width: 768px) {\n    .editor-minipreview {\n        width: 100%;\n    }\n    .demo-wrapper__fullscreen .editor-minipreview {\n        width: 90%;\n    }\n}\n\n\n@media (min-width: 768px) {\n    .demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {\n        height: auto;\n        width: 70vw;\n        min-height: 87vh;\n    }\n}\n\n\n@media (max-width: 768px) {\n    .editor-wrapper {\n        width: 100%;\n        border: 1px solid black;\n    }\n    .demo-wrapper__fullscreen .editor-wrapper {\n        width: 100%;\n    }\n}\n\n",
   "Parent": "x_x_mws_Demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Demo_x"
  }
 ],
 "x_x_mws_AllExamples": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_mws_AllExamples",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_AllExamples_x",
   "Hash": "x1c705ik"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "selected": "",
   "examples": [],
   "Content": "",
   "Parent": "x_x_mws_AllExamples",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_AllExamples_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_mws_AllExamples",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_AllExamples_x",
   "Hash": "xrgjiia",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": ":host {\n    --colcount: 5;\n    display: grid;\n    grid-template-columns: repeat(var(--colcount), 1fr);\n}\n:host > .Example {\n    border: 1px solid black;\n    border-radius: 2px;\n    padding: 10px;\n    margin: 10px;\n    min-height: 200px;\n    background: #ddd;\n    position: relative;\n    margin-top: 50px;\n}\n.Example-wrapper {\n    height: 200px;\n    overflow-y: auto;\n}\n\n:host > .Example.expanded {\n    background: transparent;\n    grid-column: 1 / span var(--colcount);\n}\n\n:host > .Example .tool-button {\n    position: absolute;\n    top: -30px;\n    height: 30px;\n    right: 0px;\n    min-width: 80px;\n    border-radius: 10px 10px 0 0;\n    /*border-bottom: none;*/\n    background: #ddd;\n}\n:host > .Example .tool-button:hover {\n    cursor: pointer;\n    text-decoration: underline;\n}\n\n@media (max-width: 1550px) {\n    :host {\n        --colcount: 4;\n    }\n}\n@media (max-width: 1250px) {\n    :host {\n        --colcount: 3;\n    }\n}\n\n@media (max-width: 1160px) {\n    :host {\n        --colcount: 2;\n    }\n}\n\n@media (max-width: 768px) {\n    :host {\n        --colcount: 1;\n    }\n}\n\n",
   "Parent": "x_x_mws_AllExamples",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_AllExamples_x"
  }
 ],
 "x_x_mws_Section": [
  {
   "Type": "Props",
   "RenderObj": "props",
   "name": "",
   "Content": "",
   "Parent": "x_x_mws_Section",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Section_x"
  },
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_mws_Section",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Section_x",
   "Hash": "1cod1g0"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n        :host {\n            position: relative;\n        }\n        h2 {\n            font-weight: bold;\n            color: var(--highlight-color);\n            margin-bottom: 0;\n        }\n        a.secanchor {\n            padding-top: 100px;\n            color: var(--highlight-color);\n            opacity: 0.3;\n            display: block;\n        }\n        :host:hover .Section-helper {\n            opacity: 1.0;\n        }\n    ",
   "Parent": "x_x_mws_Section",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_mws_Section_x"
  }
 ],
 "x_x_docseg_Templating_1": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Templating_1",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_1_x",
   "Hash": "x1g66lrh"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "count": 42,
   "articles": [
    {
     "headline": "Modulo released!",
     "tease": "The most exciting news of the century."
    },
    {
     "headline": "Can JS be fun again?"
    },
    {
     "headline": "MTL considered harmful",
     "tease": "Why constructing JS is risky business."
    }
   ],
   "Content": "",
   "Parent": "x_x_docseg_Templating_1",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_1_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_docseg_Templating_1",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_1_x",
   "Hash": "154ld2",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  }
 ],
 "x_x_docseg_Templating_PrepareCallback": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Templating_PrepareCallback",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_PrepareCallback_x",
   "Hash": "1ccdre"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "perc": 50,
   "total": 30,
   "Content": "",
   "Parent": "x_x_docseg_Templating_PrepareCallback",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_PrepareCallback_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_docseg_Templating_PrepareCallback",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_PrepareCallback_x",
   "Hash": "tv174n",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    input { display: inline; width: 25px }\n",
   "Parent": "x_x_docseg_Templating_PrepareCallback",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_PrepareCallback_x"
  }
 ],
 "x_x_docseg_Templating_Comments": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Templating_Comments",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_Comments_x",
   "Hash": "1gic6ht"
  }
 ],
 "x_x_docseg_Templating_Escaping": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Templating_Escaping",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_Escaping_x",
   "Hash": "xmc3bve"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "username": "Little <Bobby> <Drop> &tables",
   "content": "\n        I <i>love</i> the classic <a target=\"_blank\"\n        href=\"https://xkcd.com/327/\">xkcd #327</a> on\n        the risk of trusting <b>user inputted data</b>\n    ",
   "Content": "",
   "Parent": "x_x_docseg_Templating_Escaping",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_Escaping_x"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    .msgcontent {\n        background: #999;\n        padding: 10px;\n        margin: 10px;\n    }\n",
   "Parent": "x_x_docseg_Templating_Escaping",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Templating_Escaping_x"
  }
 ],
 "x_x_docseg_Tutorial_P1": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Tutorial_P1",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P1_x",
   "Hash": "9cf1vf"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n/* ...and any CSS here! */\nstrong {\n    color: blue;\n}\n.neat {\n    font-variant: small-caps;\n}\n:host { /* styles the entire component */\n    display: inline-block;\n    background-color: cornsilk;\n    padding: 5px;\n    box-shadow: 10px 10px 0 0 turquoise;\n}\n",
   "Parent": "x_x_docseg_Tutorial_P1",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P1_x"
  }
 ],
 "x_x_docseg_Tutorial_P2": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Tutorial_P2",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P2_x",
   "Hash": "x35mjmh"
  }
 ],
 "x_x_docseg_Tutorial_P2_filters_demo": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Tutorial_P2_filters_demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P2_filters_demo_x",
   "Hash": "x35mjmh"
  }
 ],
 "x_x_docseg_Tutorial_P3_state_demo": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Tutorial_P3_state_demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P3_state_demo_x",
   "Hash": "9cmo7s"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "verb": "toot",
   "noun": "kazoo",
   "count": "two",
   "Content": "",
   "Parent": "x_x_docseg_Tutorial_P3_state_demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P3_state_demo_x"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    :host {\n        font-size: 0.8rem;\n    }\n",
   "Parent": "x_x_docseg_Tutorial_P3_state_demo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P3_state_demo_x"
  }
 ],
 "x_x_docseg_Tutorial_P3_state_bind": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_docseg_Tutorial_P3_state_bind",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P3_state_bind_x",
   "Hash": "x1qjabln"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "opacity": "0.5",
   "color": "blue",
   "username": "Testing_Username",
   "Content": "",
   "Parent": "x_x_docseg_Tutorial_P3_state_bind",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_docseg_Tutorial_P3_state_bind_x"
  }
 ],
 "x_x_eg_Hello": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_Hello",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_Hello_x",
   "Hash": "16vtia4"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "num": 42,
   "Content": "",
   "Parent": "x_x_eg_Hello",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_Hello_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_Hello",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_Hello_x",
   "Hash": "1ug4oiq",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  }
 ],
 "x_x_eg_Simple": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_Simple",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_Simple_x",
   "Hash": "gq8383"
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    em { color: darkgreen; }\n    * { text-decoration: underline; }\n",
   "Parent": "x_x_eg_Simple",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_Simple_x"
  }
 ],
 "x_x_eg_ToDo": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_ToDo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ToDo_x",
   "Hash": "x14e0noe"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "list": [
    "Milk",
    "Bread",
    "Candy"
   ],
   "text": "Beer",
   "Content": "",
   "Parent": "x_x_eg_ToDo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ToDo_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_ToDo",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ToDo_x",
   "Hash": "x8ktit0",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  }
 ],
 "x_x_eg_JSON": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_JSON",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_JSON_x",
   "Hash": "xa6nq8n"
  },
  {
   "Type": "StaticData",
   "RenderObj": "staticdata",
   "Parent": "x_x_eg_JSON",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_JSON_x",
   "Hash": "1sejui7"
  }
 ],
 "x_x_eg_JSONArray": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_JSONArray",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_JSONArray_x",
   "Hash": "xmphgsn"
  },
  {
   "Type": "StaticData",
   "RenderObj": "staticdata",
   "Parent": "x_x_eg_JSONArray",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_JSONArray_x",
   "Hash": "16lf05u"
  }
 ],
 "x_x_eg_API": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_API",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_API_x",
   "Hash": "xoos95m"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "search": "",
   "name": "",
   "location": "",
   "bio": "",
   "Content": "",
   "Parent": "x_x_eg_API",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_API_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_API",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_API_x",
   "Hash": "397k54",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  }
 ],
 "x_x_eg_ColorSelector": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_ColorSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ColorSelector_x",
   "Hash": "1op6kq6"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "hue": 130,
   "sat": 50,
   "lum": 50,
   "Content": "",
   "Parent": "x_x_eg_ColorSelector",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ColorSelector_x"
  }
 ],
 "x_x_eg_SearchBox": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_SearchBox",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_SearchBox_x",
   "Hash": "e3c95l"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "search": "",
   "results": [],
   "loading": false,
   "Content": "",
   "Parent": "x_x_eg_SearchBox",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_SearchBox_x"
  },
  {
   "Type": "StaticData",
   "RenderObj": "staticdata",
   "Parent": "x_x_eg_SearchBox",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_SearchBox_x",
   "Hash": "4amukg"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_SearchBox",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_SearchBox_x",
   "Hash": "1qe3kff",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    input {\n        width: 100%;\n    }\n    .results-container {\n        display: flex;\n        flex-wrap: wrap;\n        justify-content: center;\n    }\n    .results-container > img { margin-top 30px; }\n    .results {\n        position: absolute;\n        height: 0;\n        width: 0;\n        overflow: hidden;\n        display: block;\n        border: 2px solid #B90183;\n        border-radius: 0 0 20px 20px;\n        transition: height 0.2s;\n        z-index: 20;\n        background: white;\n    }\n    .results.visible {\n        height: 200px;\n        width: 200px;\n    }\n    .result {\n        padding: 10px;\n        width: 80px;\n        position: relative;\n    }\n    .result label {\n        position: absolute;\n        width: 80px;\n        background: rgba(255, 255, 255, 0.5);\n        font-size: 0.7rem;\n        top: 0;\n        left: 0;\n    }\n",
   "Parent": "x_x_eg_SearchBox",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_SearchBox_x"
  }
 ],
 "x_x_eg_DateNumberPicker": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_DateNumberPicker",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_DateNumberPicker_x",
   "Hash": "1u62nuj"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "day": 1,
   "month": 1,
   "year": 2022,
   "ordering": [
    "year",
    "month",
    "day"
   ],
   "Content": "",
   "Parent": "x_x_eg_DateNumberPicker",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_DateNumberPicker_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_DateNumberPicker",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_DateNumberPicker_x",
   "Hash": "xeva47l",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    :host {\n        border: 1px solid black;\n        padding: 10px;\n        margin: 10px;\n        margin-left: 0;\n        display: flex;\n        flex-wrap: wrap;\n        font-weight: bold;\n    }\n    div {\n        float: right;\n    }\n    label {\n        display: block;\n        width: 100%;\n    }\n",
   "Parent": "x_x_eg_DateNumberPicker",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_DateNumberPicker_x"
  }
 ],
 "x_x_eg_FlexibleForm": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_FlexibleForm",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_FlexibleForm_x",
   "Hash": "1ssp5sa"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "name": "Spartacus",
   "topic": "On the treatment of Thracian gladiators",
   "subscribe": true,
   "private": false,
   "comment": "So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.",
   "fields": [
    "name",
    "topic",
    "comment",
    "private",
    "subscribe"
   ],
   "Content": "",
   "Parent": "x_x_eg_FlexibleForm",
   "DefName": null,
   "Name": "Spartacus",
   "FullName": "x_x_eg_FlexibleForm_Spartacus"
  }
 ],
 "x_x_eg_FlexibleFormWithAPI": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_FlexibleFormWithAPI",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_FlexibleFormWithAPI_x",
   "Hash": "x110d077"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "user": 1337,
   "topic": "On the treatment of Thracian gladiators",
   "comment": "So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.",
   "fields": [
    "user",
    "topic",
    "comment"
   ],
   "posts": [],
   "Content": "",
   "Parent": "x_x_eg_FlexibleFormWithAPI",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_FlexibleFormWithAPI_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_FlexibleFormWithAPI",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_FlexibleFormWithAPI_x",
   "Hash": "1qroh1a",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  }
 ],
 "x_x_eg_Components": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_Components",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_Components_x",
   "Hash": "gukocp"
  }
 ],
 "x_x_eg_OscillatingGraph": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_OscillatingGraph",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_OscillatingGraph_x",
   "Hash": "xe5l02u"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "playing": false,
   "speed": 10,
   "easing": "linear",
   "align": "flex-end",
   "tick": 1,
   "width": 10,
   "anim": 10,
   "pulse": 1,
   "offset": 1,
   "data": [],
   "Content": "",
   "Parent": "x_x_eg_OscillatingGraph",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_OscillatingGraph_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_OscillatingGraph",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_OscillatingGraph_x",
   "Hash": "x1qkh8eg",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    input {\n        width: 50px;\n    }\n",
   "Parent": "x_x_eg_OscillatingGraph",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_OscillatingGraph_x"
  }
 ],
 "x_x_eg_PrimeSieve": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_PrimeSieve",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_PrimeSieve_x",
   "Hash": "f34ecp"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "number": 64,
   "Content": "",
   "Parent": "x_x_eg_PrimeSieve",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_PrimeSieve_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_PrimeSieve",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_PrimeSieve_x",
   "Hash": "x2f9ogu",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n.grid {\n    display: grid;\n    grid-template-columns: repeat(9, 1fr);\n    color: #ccc;\n    font-weight: bold;\n    width: 100%;\n    margin: -5px;\n}\n.grid > div {\n    border: 1px solid #ccc;\n    cursor: crosshair;\n    transition: 0.2s;\n}\ndiv.whole {\n    color: white;\n    background: #B90183;\n}\ndiv.hidden {\n    background: #ccc;\n    color: #ccc;\n}\n\n/* Color green and add asterisk */\ndiv.number { background: green; }\ndiv.number::after { content: \"*\"; }\n/* Check for whole factors (an adjacent div.whole).\n   If found, then hide asterisk and green */\ndiv.whole ~ div.number { background: #B90183; }\ndiv.whole ~ div.number::after { opacity: 0; }\n",
   "Parent": "x_x_eg_PrimeSieve",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_PrimeSieve_x"
  }
 ],
 "x_x_eg_MemoryGame": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_MemoryGame",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_MemoryGame_x",
   "Hash": "x1qhooen"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "message": "Good luck!",
   "win": false,
   "cards": [],
   "revealed": [],
   "lastflipped": null,
   "failedflip": null,
   "Content": "",
   "Parent": "x_x_eg_MemoryGame",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_MemoryGame_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_MemoryGame",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_MemoryGame_x",
   "Hash": "x1b55hag",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\nh3 {\n    background: #B90183;\n    border-radius: 8px;\n    text-align: center;\n    color: white;\n    font-weight: bold;\n}\n.board {\n    display: grid;\n    grid-template-rows: repeat(4, 1fr);\n    grid-template-columns: repeat(4, 1fr);\n    grid-gap: 2px;\n    width: 100%;\n    height: 150px;\n    width: 150px;\n}\n.board.hard {\n    grid-gap: 1px;\n    grid-template-rows: repeat(6, 1fr);\n    grid-template-columns: repeat(6, 1fr);\n}\n.board > .card {\n    background: #B90183;\n    border: 2px solid black;\n    border-radius: 1px;\n    cursor: pointer;\n    text-align: center;\n    min-height: 15px;\n    transition: background 0.3s, transform 0.3s;\n    transform: scaleX(-1);\n    padding-top: 2px;\n    color: #B90183;\n}\n.board.hard > .card {\n    border: none !important;\n    padding: 0;\n}\n.board > .card.flipped {\n    background: #FFFFFF;\n    border: 2px solid #B90183;\n    transform: scaleX(1);\n}\n\n@keyframes flipping {\n    from { transform: scaleX(-1.1); background: #B90183; }\n    to {   transform: scaleX(1.0);  background: #FFFFFF; }\n}\n",
   "Parent": "x_x_eg_MemoryGame",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_MemoryGame_x"
  }
 ],
 "x_x_eg_ConwayGameOfLife": [
  {
   "Type": "Template",
   "RenderObj": "template",
   "Parent": "x_x_eg_ConwayGameOfLife",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ConwayGameOfLife_x",
   "Hash": "xic9cvd"
  },
  {
   "Type": "State",
   "RenderObj": "state",
   "playing": false,
   "speed": 3,
   "cells": {
    "10": {
     "11": true
    },
    "11": {
     "12": true
    },
    "12": {
     "10": true,
     "11": true,
     "12": true
    }
   },
   "Content": "",
   "Parent": "x_x_eg_ConwayGameOfLife",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ConwayGameOfLife_x"
  },
  {
   "Type": "Script",
   "RenderObj": "script",
   "Parent": "x_x_eg_ConwayGameOfLife",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ConwayGameOfLife_x",
   "Hash": "xmcdh86",
   "localVars": [
    "component",
    "modulo",
    "library",
    "props",
    "style",
    "template",
    "staticdata",
    "script",
    "state",
    "element",
    "cparts"
   ]
  },
  {
   "Type": "Style",
   "RenderObj": "style",
   "Content": "\n    :host {\n        display: flex;\n    }\n    .grid {\n        display: grid;\n        grid-template-columns: repeat(24, 5px);\n        margin: -2px;\n        grid-gap: 1px;\n    }\n    .grid > div {\n        background: white;\n        width: 5px;\n        height: 5px;\n    }\n    input, button {\n        width: 40px;\n    }\n",
   "Parent": "x_x_eg_ConwayGameOfLife",
   "DefName": null,
   "Name": "x",
   "FullName": "x_x_eg_ConwayGameOfLife_x"
  }
 ]
};
currentModulo.parentDefs = {
 "x_x": {
  "Type": "Modulo",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "modulo",
  "src": "/js/Modulo.js",
  "Parent": null,
  "DefName": null,
  "Name": "x",
  "FullName": "x_x",
  "Hash": "pkpi46",
  "cachedComponentDefs": {
   "/libraries/eg.html": {
    "Hello": "\n<Template>\n    <button @click:=script.countUp>Hello {{ state.num }}</button>\n</Template>\n<State\n    num:=42\n></State>\n<Script>\n    function countUp() {\n        state.num++;\n    }\n</Script>\n\n\n",
    "Simple": "\n<Template>\n    Components can use any number of <strong>CParts</strong>.\n    Here we use only <em>Style</em> and <em>Template</em>.\n</Template>\n\n<Style>\n    em { color: darkgreen; }\n    * { text-decoration: underline; }\n</Style>\n\n\n",
    "ToDo": "<Template>\n<ol>\n    {% for item in state.list %}\n        <li>{{ item }}</li>\n    {% endfor %}\n    <li>\n        <input [state.bind] name=\"text\" />\n        <button @click:=script.addItem>Add</button>\n    </li>\n</ol>\n</Template>\n\n<State\n    list:='[\"Milk\", \"Bread\", \"Candy\"]'\n    text=\"Beer\"\n></State>\n\n<Script>\n    function addItem() {\n        state.list.push(state.text); // add to list\n        state.text = \"\"; // clear input\n    }\n</Script>\n\n\n",
    "JSON": "<!-- Use StaticData CPart to include JSON from an API or file -->\n<Template>\n    <strong>Name:</strong> {{ staticdata.name }} <br />\n    <strong>Site:</strong> {{ staticdata.homepage }} <br />\n    <strong>Tags:</strong> {{ staticdata.topics|join }}\n</Template>\n<StaticData\n    -src=\"https://api.github.com/repos/michaelpb/modulo\"\n></StaticData>\n",
    "JSONArray": "<!-- Use StaticData CPart to include JSON from an API or file.\nYou can use it for arrays as well. Note that it is \"bundled\"\nas static data in with JS, so it does not refresh. -->\n<Template>\n  {% for post in staticdata %}\n    <p>{% if post.completed %}&starf;{% else %}&star;{% endif %}\n        {{ post.title|truncate:15 }}</p>\n  {% endfor %}\n</Template>\n<StaticData\n    -src=\"https://jsonplaceholder.typicode.com/todos\"\n></StaticData>\n",
    "API": "<Template>\n<p>{{ state.name }} | {{ state.location }}</p>\n<p>{{ state.bio }}</p>\n<a href=\"https://github.com/{{ state.search }}/\" target=\"_blank\">\n    {% if state.search %}github.com/{{ state.search }}/{% endif %}\n</a>\n<input [state.bind] name=\"search\"\n    placeholder=\"Type GitHub username\" />\n<button @click:=script.fetchGitHub>Get Info</button>\n</Template>\n\n<State\n    search=\"\"\n    name=\"\"\n    location=\"\"\n    bio=\"\"\n></State>\n\n<Script>\n    function fetchGitHub() {\n        fetch(`https://api.github.com/users/${state.search}`)\n            .then(response => response.json())\n            .then(githubCallback);\n    }\n    function githubCallback(apiData) {\n        state.name = apiData.name;\n        state.location = apiData.location;\n        state.bio = apiData.bio;\n        element.rerender();\n    }\n</Script>\n\n\n",
    "ColorSelector": "<Template>\n    <div style=\"float: right\">\n        <p><label>Hue:<br />\n            <input [state.bind] name=\"hue\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" />\n        </label></p>\n        <p><label>Saturation: <br />\n            <input [state.bind] name=\"sat\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n        <p><label>Luminosity:<br />\n            <input [state.bind] name=\"lum\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n    </div>\n    <div style=\"\n        width: 80px; height: 80px;\n        background: hsl({{ state.hue }}, {{ state.sat }}%, {{ state.lum }}%)\">\n    </div>\n</Template>\n<State\n    hue:=130\n    sat:=50\n    lum:=50\n></State>\n",
    "SearchBox": "<!-- A \"type as you go\" search box implementation,\nan example of more complicated HTML and JS behavior -->\n<Template>\n<p>Type a book name for \"search as you type\"\n(e.g. try &ldquo;the lord of the rings&rdquo;)</p>\n\n<input [state.bind] name=\"search\"\n  @keyup:=script.typingCallback />\n\n<div class=\"results {% if state.search.length gt 0 %}\n                      visible {% endif %}\">\n  <div class=\"results-container\">\n    {% if state.loading %}\n      <img src=\"{{ staticdata.gif }}\" alt=\"loading\" />\n    {% else %}\n      {% for result in state.results %}\n        <div class=\"result\">\n          <img\n            src=\"{{ staticdata.cover|add:result.cover_i }}-S.jpg\"\n          /> <label>{{ result.title }}</label>\n        </div>\n      {% empty %}\n        <p>No books found.</p>\n      {% endfor %}\n    {% endif %}\n  </div>\n</div>\n</Template>\n\n<State\n    search=\"\"\n    results:=[]\n    loading:=false\n></State>\n\n<!-- Puting long URLs down here to declutter -->\n<StaticData>\n{\n  apiBase: 'https://openlibrary.org/search.json',\n  cover: 'https://covers.openlibrary.org/b/id/',\n  gif: 'https://cdnjs.cloudflare.com/ajax/libs/' +\n    'semantic-ui/0.16.1/images/loader-large.gif'\n}\n</StaticData>\n\n<Script>\n    function typingCallback() {\n        state.loading = true;\n        const search = `q=${state.search}`;\n        const opts = 'limit=6&fields=title,author_name,cover_i';\n        const url = `${staticdata.apiBase}?${search}&${opts}`;\n        _globalDebounce(() => {\n            fetch(url)\n                .then(response => response.json())\n                .then(dataBackCallback);\n        });\n    }\n\n    function dataBackCallback(data) {\n        state.results = data.docs;\n        state.loading = false;\n        element.rerender();\n    }\n\n    let _globalDebounceTimeout = null;\n    function _globalDebounce(func) {\n        if (_globalDebounceTimeout) {\n            clearTimeout(_globalDebounceTimeout);\n        }\n        _globalDebounceTimeout = setTimeout(func, 500);\n    }\n</Script>\n\n<Style>\n    input {\n        width: 100%;\n    }\n    .results-container {\n        display: flex;\n        flex-wrap: wrap;\n        justify-content: center;\n    }\n    .results-container > img { margin-top 30px; }\n    .results {\n        position: absolute;\n        height: 0;\n        width: 0;\n        overflow: hidden;\n        display: block;\n        border: 2px solid #B90183;\n        border-radius: 0 0 20px 20px;\n        transition: height 0.2s;\n        z-index: 20;\n        background: white;\n    }\n    .results.visible {\n        height: 200px;\n        width: 200px;\n    }\n    .result {\n        padding: 10px;\n        width: 80px;\n        position: relative;\n    }\n    .result label {\n        position: absolute;\n        width: 80px;\n        background: rgba(255, 255, 255, 0.5);\n        font-size: 0.7rem;\n        top: 0;\n        left: 0;\n    }\n</Style>\n\n\n",
    "DateNumberPicker": "<Template>\n    <p>ISO: <tt>{{ state.year }}-{{ state.month }}-{{ state.day }}</tt></p>\n    {% for part in state.ordering %}\n        <label>\n            {{ state|get:part }}\n            <div>\n                <button @click:=script.next payload=\"{{ part }}\">&uarr;</button>\n                <button @click:=script.previous payload=\"{{ part }}\">&darr;</button>\n            </div>\n        </label>\n    {% endfor %}\n</Template>\n\n<State\n    day:=1\n    month:=1\n    year:=2022\n    ordering:='[\"year\", \"month\", \"day\"]'\n></State>\n\n<Script>\n    function isValid({ year, month, day }) {\n        month--; // Months are zero indexed\n        const d = new Date(year, month, day);\n        return d.getMonth() === month && d.getDate() === day && d.getFullYear() === year;\n    }\n    function next(part) {\n        state[part]++;\n        if (!isValid(state)) { // undo if not valid\n            state[part]--;\n        }\n    }\n    function previous(part) {\n        state[part]--;\n        if (!isValid(state)) { // undo if not valid\n            state[part]++;\n        }\n    }\n</Script>\n\n<Style>\n    :host {\n        border: 1px solid black;\n        padding: 10px;\n        margin: 10px;\n        margin-left: 0;\n        display: flex;\n        flex-wrap: wrap;\n        font-weight: bold;\n    }\n    div {\n        float: right;\n    }\n    label {\n        display: block;\n        width: 100%;\n    }\n</Style>\n",
    "FlexibleForm": "<!-- Here, we have a form that's easy to update. If this gets used more\nthan a couple times, it could be turned into a reusable component where\nthe \"ordering\" and initial values get set via Props. -->\n<Template>\n    <form>\n        {% for field in state.fields %}\n            <div class=\"field-pair\">\n                <label for=\"{{ field }}_{{ component.uniqueId }}\">\n                    <strong>{{ field|capfirst }}:</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type=\"{% if state|get:field|type == 'string' %}text{% else %}checkbox{% endif %}\"\n                    name=\"{{ field }}\"\n                    id=\"{{ field }}_{{ component.uniqueId }}\"\n                />\n            </div>\n        {% endfor %}\n    </form>\n</Template>\n\n<State\n    name=\"Spartacus\"\n    topic=\"On the treatment of Thracian gladiators\"\n    subscribe:=true\n    private:=false\n    comment=\"So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.\"\n    fields:='[\"name\", \"topic\", \"comment\", \"private\", \"subscribe\"]'\n></State>\n",
    "FlexibleFormWithAPI": "<!-- Combining the code from the previous exercise, we can interact with\nAPIs. Here we use a Typicode's placeholder API to make posts -->\n<Template>\n    <form>\n        {% for field in state.fields %}\n            <div class=\"field-pair\">\n                <label for=\"{{ field }}_{{ component.uniqueId }}\">\n                    <strong>{{ field|capfirst }}:</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type='{% if state|get:field|type == \"number\" %}number{% else %}text{% endif %}'\n                    name=\"{{ field }}\"\n                    id=\"{{ field }}_{{ component.uniqueId }}\"\n                />\n            </div>\n        {% endfor %}\n        <button @click:=script.submit>Post comment</button>\n        <hr />\n\n        {% for post in state.posts|reversed %}\n            <p>\n                {{ post.userId }}:\n                <strong>{{ post.title|truncate:15 }}</strong>\n                {{ post.body|truncate:18 }}\n            </p>\n        {% endfor %}\n    </form>\n</Template>\n\n<State\n    user:=1337\n    topic=\"On the treatment of Thracian gladiators\"\n    comment=\"So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.\"\n    fields:='[\"user\", \"topic\", \"comment\"]'\n    posts:='[]'\n></State>\n\n<Script>\n    const URL = 'https://jsonplaceholder.typicode.com/posts';\n    const fakedPosts = [];\n    const headers = [];\n\n    function initializedCallback() {\n        refresh(); // Refresh on first load\n    }\n\n    function refresh() {\n        fetch(URL).then(r => r.json()).then(data => {\n            // Since Typicode API doesn't save it's POST\n            // data, we'll have manually fake it here\n            state.posts = data.concat(fakedPosts);\n            element.rerender();\n        });\n    }\n\n    function submit() {\n        // Rename the state variables to be what the API suggests\n        const postData = {\n              userId: state.user,\n              title: state.topic,\n              body: state.comment,\n        };\n        state.topic = ''; // clear the comment & topic text\n        state.comment = '';\n        fakedPosts.push(postData); // Required for refresh()\n\n        // Send the POST request with fetch, then refresh after\n        const opts = {\n            method: 'POST',\n            body: JSON.stringify(postData),\n            headers: { 'Content-type': 'application/json; charset=UTF-8' },\n        };\n        fetch(URL, opts).then(r => r.json()).then(refresh);\n    }\n</Script>\n\n",
    "Components": "<!-- Once defined, Modulo web components can be used like HTML.\nDemoModal and DemoChart are already defined. Try using below! -->\n<Template>\n\n<x-DemoChart\n    data:='[1, 2, 3, 5, 8]'\n></x-DemoChart>\n\n<x-DemoModal button=\"Nicholas Cage\" title=\"Biography\">\n    <p>Prolific Hollywood actor</p>\n    <img src=\"https://www.placecage.com/640/360\" />\n</x-DemoModal>\n\n<x-DemoModal button=\"Tommy Wiseau\" title=\"Further Data\">\n    <p>Actor, director, and acclaimed fashion designer</p>\n    <x-DemoChart data:='[50, 13, 94]' ></x-DemoChart>\n</x-DemoModal>\n\n</Template>\n\n",
    "OscillatingGraph": "<Template>\n\n    <!-- Note that even with custom components, core properties like \"style\"\n        are available, making CSS variables a handy way of specifying style\n        overrides. -->\n    <x-DemoChart\n        data:=state.data\n        animated:=true\n        style=\"\n            --align: center;\n            --speed: {{ state.anim }};\n        \"\n    ></x-DemoChart>\n\n    <p>\n        {% if not state.playing %}\n            <button @click:=script.play alt=\"Play\">&#x25B6;  tick: {{ state.tick }}</button>\n        {% else %}\n            <button @click:=script.pause alt=\"Pause\">&#x2016;  tick: {{ state.tick }}</button>\n        {% endif %}\n    </p>\n\n    {% for name in script.exports.properties %}\n        <label>{{ name|capfirst }}:\n            <input [state.bind]\n                name=\"{{ name }}\"\n                type=\"range\"\n                min=\"1\" max=\"20\" step=\"1\" />\n        </label>\n    {% endfor %}\n</Template>\n\n<State\n    playing:=false\n    speed:=10\n    easing=\"linear\"\n    align=\"flex-end\"\n    tick:=1\n    width:=10\n    anim:=10\n    speed:=10\n    pulse:=1\n    offset:=1\n    data:=[]\n></State>\n<Script>\n    let timeout = null;\n    script.exports.properties = [\"anim\", \"speed\", \"width\", \"pulse\"];//, \"offset\"];\n    function play() {\n        state.playing = true;\n        nextTick();\n    }\n    function pause() {\n        state.playing = false;\n    }\n    function setEasing(payload) {\n        state.easing = payload;\n    }\n\n    function nextTick() {\n        if (timeout) {\n            clearTimeout(timeout);\n        }\n        const el = element;\n        timeout = setTimeout(() => {\n            el.rerender();\n        }, 2000 / state.speed);\n    }\n\n    function updateCallback() {\n        if (state.playing) {\n            while (state.data.length <= state.width) {\n                state.tick++;\n                state.data.push(Math.sin(state.tick / state.pulse) + 1); // add to right\n            }\n            state.data.shift(); // remove one from left\n            nextTick();\n        }\n    }\n</Script>\n<Style>\n    input {\n        width: 50px;\n    }\n</Style>\n",
    "PrimeSieve": "<!-- Demos mouseover, template filters, template control flow,\n     and static script exports -->\n<Template>\n  <div class=\"grid\">\n    {% for i in script.exports.range %}\n      <div @mouseover:=script.setNum\n        class=\"\n            {# If-statements to check divisibility in template: #}\n            {% if state.number == i %}number{% endif %}\n            {% if state.number lt i %}hidden{% else %}\n              {% if state.number|divisibleby:i %}whole{% endif %}\n            {% endif %}\n        \">{{ i }}</div>\n    {% endfor %}\n  </div>\n</Template>\n\n<State\n    number:=64\n></State>\n\n<Script>\n    // Getting big a range of numbers in JS. Use \"script.exports\"\n    // to export this as a one-time global constant.\n    // (Hint: Curious how it calculates prime? See CSS!)\n    script.exports.range = \n        Array.from({length: 63}, (x, i) => i + 2);\n    function setNum(payload, ev) {\n        state.number = Number(ev.target.textContent);\n    }\n</Script>\n\n<Style>\n.grid {\n    display: grid;\n    grid-template-columns: repeat(9, 1fr);\n    color: #ccc;\n    font-weight: bold;\n    width: 100%;\n    margin: -5px;\n}\n.grid > div {\n    border: 1px solid #ccc;\n    cursor: crosshair;\n    transition: 0.2s;\n}\ndiv.whole {\n    color: white;\n    background: #B90183;\n}\ndiv.hidden {\n    background: #ccc;\n    color: #ccc;\n}\n\n/* Color green and add asterisk */\ndiv.number { background: green; }\ndiv.number::after { content: \"*\"; }\n/* Check for whole factors (an adjacent div.whole).\n   If found, then hide asterisk and green */\ndiv.whole ~ div.number { background: #B90183; }\ndiv.whole ~ div.number::after { opacity: 0; }\n</Style>\n\n\n",
    "MemoryGame": "<!-- A much more complicated example application -->\n<Template>\n{% if not state.cards.length %}\n    <h3>The Symbolic Memory Game</h3>\n    <p>Choose your difficulty:</p>\n    <button @click:=script.setup click.payload=8>2x4</button>\n    <button @click:=script.setup click.payload=16>4x4</button>\n    <button @click:=script.setup click.payload=36>6x6</button>\n{% else %}\n    <div class=\"board\n        {% if state.cards.length > 16 %}hard{% endif %}\">\n    {# Loop through each card in the \"deck\" (state.cards) #}\n    {% for card in state.cards %}\n        {# Use \"key=\" to speed up DOM reconciler #}\n        <div key=\"c{{ card.id }}\"\n            class=\"card\n            {% if card.id in state.revealed %}\n                flipped\n            {% endif %}\n            \"\n            style=\"\n            {% if state.win %}\n                animation: flipping 0.5s infinite alternate;\n                animation-delay: {{ card.id }}.{{ card.id }}s;\n            {% endif %}\n            \"\n            @click:=script.flip\n            click.payload=\"{{ card.id }}\">\n            {% if card.id in state.revealed %}\n                {{ card.symbol }}\n            {% endif %}\n        </div>\n    {% endfor %}\n    </div>\n    <p style=\"{% if state.failedflip %}\n                color: red{% endif %}\">\n        {{ state.message }}</p>\n{% endif %}\n</Template>\n\n<State\n    message=\"Good luck!\"\n    win:=false\n    cards:=[]\n    revealed:=[]\n    lastflipped:=null\n    failedflip:=null\n></State>\n\n<Script>\nconst symbolsStr = \"%!@#=?&+~÷≠∑µ‰∂Δƒσ\"; // 16 options\nfunction setup(payload) {\n    const count = Number(payload);\n    let symbols = symbolsStr.substr(0, count/2).split(\"\");\n    symbols = symbols.concat(symbols); // duplicate cards\n    let id = 0;\n    while (id < count) {\n        const index = Math.floor(Math.random()\n                                    * symbols.length);\n        const symbol = symbols.splice(index, 1)[0];\n        state.cards.push({symbol, id});\n        id++;\n    }\n}\n\nfunction failedFlipCallback() {\n    // Remove both from revealed array & set to null\n    state.revealed = state.revealed.filter(\n            id => id !== state.failedflip\n                    && id !== state.lastflipped);\n    state.failedflip = null;\n    state.lastflipped = null;\n    state.message = \"\";\n    element.rerender();\n}\n\nfunction flip(id) {\n    if (state.failedflip !== null) {\n        return;\n    }\n    id = Number(id);\n    if (state.revealed.includes(id)) {\n        return; // double click\n    } else if (state.lastflipped === null) {\n        state.lastflipped = id;\n        state.revealed.push(id);\n    } else {\n        state.revealed.push(id);\n        const {symbol} = state.cards[id];\n        const lastCard = state.cards[state.lastflipped];\n        if (symbol === lastCard.symbol) {\n            // Successful match! Check for win.\n            const {revealed, cards} = state;\n            if (revealed.length === cards.length) {\n                state.message = \"You win!\";\n                state.win = true;\n            } else {\n                state.message = \"Nice match!\";\n            }\n            state.lastflipped = null;\n        } else {\n            state.message = \"No match.\";\n            state.failedflip = id;\n            setTimeout(failedFlipCallback, 1000);\n        }\n    }\n}\n</Script>\n\n<Style>\nh3 {\n    background: #B90183;\n    border-radius: 8px;\n    text-align: center;\n    color: white;\n    font-weight: bold;\n}\n.board {\n    display: grid;\n    grid-template-rows: repeat(4, 1fr);\n    grid-template-columns: repeat(4, 1fr);\n    grid-gap: 2px;\n    width: 100%;\n    height: 150px;\n    width: 150px;\n}\n.board.hard {\n    grid-gap: 1px;\n    grid-template-rows: repeat(6, 1fr);\n    grid-template-columns: repeat(6, 1fr);\n}\n.board > .card {\n    background: #B90183;\n    border: 2px solid black;\n    border-radius: 1px;\n    cursor: pointer;\n    text-align: center;\n    min-height: 15px;\n    transition: background 0.3s, transform 0.3s;\n    transform: scaleX(-1);\n    padding-top: 2px;\n    color: #B90183;\n}\n.board.hard > .card {\n    border: none !important;\n    padding: 0;\n}\n.board > .card.flipped {\n    background: #FFFFFF;\n    border: 2px solid #B90183;\n    transform: scaleX(1);\n}\n\n@keyframes flipping {\n    from { transform: scaleX(-1.1); background: #B90183; }\n    to {   transform: scaleX(1.0);  background: #FFFFFF; }\n}\n</Style>\n\n\n",
    "ConwayGameOfLife": "<Template>\n  <div class=\"grid\">\n    {% for i in script.exports.range %}\n        {% for j in script.exports.range %}\n          <div\n            @click:=script.toggle\n            payload:='[ {{ i }}, {{ j }} ]'\n            style=\"{% if state.cells|get:i %}\n                {% if state.cells|get:i|get:j %}\n                    background: #B90183;\n                {% endif %}\n            {% endif %}\"\n           ></div>\n        {% endfor %}\n    {% endfor %}\n  </div>\n  <div class=\"controls\">\n    {% if not state.playing %}\n        <button @click:=script.play alt=\"Play\">&#x25B6;</button>\n    {% else %}\n        <button @click:=script.pause alt=\"Pause\">&#x2016;</button>\n    {% endif %}\n\n    <button @click:=script.randomize alt=\"Randomize\">RND</button>\n    <button @click:=script.clear alt=\"Randomize\">CLR</button>\n    <label>Spd: <input [state.bind]\n        name=\"speed\"\n        type=\"number\" min=\"1\" max=\"10\" step=\"1\" /></label>\n  </div>\n</Template>\n\n<State\n    playing:=false\n    speed:=3\n    cells:='{\n        \"12\": { \"10\": true, \"11\": true, \"12\": true },\n        \"11\": { \"12\": true },\n        \"10\": { \"11\": true }\n    }'\n></State>\n\n<Script>\n    function toggle([ i, j ]) {\n        if (!state.cells[i]) {\n            state.cells[i] = {};\n        }\n        state.cells[i][j] = !state.cells[i][j];\n    }\n\n    function play() {\n        state.playing = true;\n        setTimeout(() => {\n            if (state.playing) {\n                updateNextFrame();\n                element.rerender(); // manually rerender\n                play(); // cue next frame\n            }\n        }, 2000 / state.speed);\n    }\n\n    function pause() {\n        state.playing = false;\n    }\n\n    function clear() {\n        state.cells = {};\n    }\n\n    function randomize() {\n        for (const i of script.exports.range) {\n            for (const j of script.exports.range) {\n                if (!state.cells[i]) {\n                    state.cells[i] = {};\n                }\n                state.cells[i][j] = (Math.random() > 0.5);\n            }\n        }\n    }\n\n    // Helper function for getting a cell from data\n    const get = (i, j) => !!(state.cells[i] && state.cells[i][j]);\n    function updateNextFrame() {\n        const nextData = {};\n        for (const i of script.exports.range) {\n            for (const j of script.exports.range) {\n                if (!nextData[i]) {\n                    nextData[i] = {};\n                }\n                const count = countNeighbors(i, j);\n                nextData[i][j] = get(i, j) ?\n                    (count === 2 || count === 3) : // stays alive\n                    (count === 3); // comes alive\n            }\n        }\n        state.cells = nextData;\n    }\n\n    function countNeighbors(i, j) {\n        const neighbors = [get(i - 1, j), get(i - 1, j - 1), get(i, j - 1),\n                get(i + 1, j), get(i + 1, j + 1), get(i, j + 1),\n                get(i + 1, j - 1), get(i - 1, j + 1)];\n        return neighbors.filter(v => v).length;\n    }\n    script.exports.range = Array.from({length: 24}, (x, i) => i);\n</Script>\n\n<Style>\n    :host {\n        display: flex;\n    }\n    .grid {\n        display: grid;\n        grid-template-columns: repeat(24, 5px);\n        margin: -2px;\n        grid-gap: 1px;\n    }\n    .grid > div {\n        background: white;\n        width: 5px;\n        height: 5px;\n    }\n    input, button {\n        width: 40px;\n    }\n</Style>\n\n"
   },
   "/libraries/docseg.html": {
    "Templating_1": "<Template>\n<p>There are <em>{{ state.count }}\n  {{ state.count|pluralize:\"articles,article\" }}</em>\n  on {{ script.exports.title }}.</p>\n\n{# Show the articles #}\n{% for article in state.articles %}\n    <h4 style=\"color: blue\">{{ article.headline|upper }}</h4>\n    {% if article.tease %}\n      <p>{{ article.tease|truncate:30 }}</p>\n    {% endif %}\n{% endfor %}\n</Template>\n\n<!-- The data below was used to render the template above -->\n<State\n    count:=42\n    articles:='[\n      {\"headline\": \"Modulo released!\",\n       \"tease\": \"The most exciting news of the century.\"},\n      {\"headline\": \"Can JS be fun again?\"},\n      {\"headline\": \"MTL considered harmful\",\n       \"tease\": \"Why constructing JS is risky business.\"}\n    ]'\n></State>\n<Script>\n    script.exports.title = \"ModuloNews\";\n</Script>\n\n\n",
    "Templating_PrepareCallback": "<Template>\n    <input name=\"perc\" [state.bind] />% of\n    <input name=\"total\" [state.bind] />\n    is: {{ script.calcResult }}\n</Template>\n\n<State\n    perc:=50\n    total:=30\n></State>\n\n<Script>\n    function prepareCallback() {\n        const calcResult = (state.perc / 100) * state.total;\n        return { calcResult };\n    }\n</Script>\n\n<Style>\n    input { display: inline; width: 25px }\n</Style>\n\n\n",
    "Templating_Comments": "<Template>\n    <h1>hello {# greeting #}</h1>\n    {% comment %}\n      {% if a %}<div>{{ b }}</div>{% endif %}\n      <h3>{{ state.items|first }}</h3>\n    {% endcomment %}\n    <p>Below the greeting...</p>\n</Template>\n\n\n",
    "Templating_Escaping": "<Template>\n<p>User \"<em>{{ state.username }}</em>\" sent a message:</p>\n<div class=\"msgcontent\">\n    {{ state.content|safe }}\n</div>\n</Template>\n\n<State\n    username=\"Little <Bobby> <Drop> &tables\"\n    content='\n        I <i>love</i> the classic <a target=\"_blank\"\n        href=\"https://xkcd.com/327/\">xkcd #327</a> on\n        the risk of trusting <b>user inputted data</b>\n    '\n></State>\n<Style>\n    .msgcontent {\n        background: #999;\n        padding: 10px;\n        margin: 10px;\n    }\n</Style>\n\n\n",
    "Tutorial_P1": "<Template>\nHello <strong>Modulo</strong> World!\n<p class=\"neat\">Any HTML can be here!</p>\n</Template>\n<Style>\n/* ...and any CSS here! */\nstrong {\n    color: blue;\n}\n.neat {\n    font-variant: small-caps;\n}\n:host { /* styles the entire component */\n    display: inline-block;\n    background-color: cornsilk;\n    padding: 5px;\n    box-shadow: 10px 10px 0 0 turquoise;\n}\n</Style>\n\n\n\n",
    "Tutorial_P2": "<Template>\n    <p>Trying out the button...</p>\n    <x-ExampleBtn\n        label=\"Button Example\"\n        shape=\"square\"\n    ></x-ExampleBtn>\n\n    <p>Another button...</p>\n    <x-ExampleBtn\n        label=\"Example 2: Rounded\"\n        shape=\"round\"\n    ></x-ExampleBtn>\n</Template>\n\n",
    "Tutorial_P2_filters_demo": "<Template>\n    <p>Trying out the button...</p>\n    <x-ExampleBtn\n        label=\"Button Example\"\n        shape=\"square\"\n    ></x-ExampleBtn>\n\n    <p>Another button...</p>\n    <x-ExampleBtn\n        label=\"Example 2: Rounded\"\n        shape=\"round\"\n    ></x-ExampleBtn>\n</Template>\n\n\n\n",
    "Tutorial_P3_state_demo": "<Template>\n<p>Nonsense poem:</p> <pre>\nProfessor {{ state.verb|capfirst }} who\n{{ state.verb }}ed a {{ state.noun }},\ntaught {{ state.verb }}ing in\nthe City of {{ state.noun|capfirst }},\nto {{ state.count }} {{ state.noun }}s.\n</pre>\n</Template>\n\n<State\n    verb=\"toot\"\n    noun=\"kazoo\"\n    count=\"two\"\n></State>\n\n<Style>\n    :host {\n        font-size: 0.8rem;\n    }\n</Style>\n\n\n",
    "Tutorial_P3_state_bind": "<Template>\n\n<div>\n    <label>Username:\n        <input [state.bind] name=\"username\" /></label>\n    <label>Color (\"green\" or \"blue\"):\n        <input [state.bind] name=\"color\" /></label>\n    <label>Opacity: <input [state.bind]\n        name=\"opacity\"\n        type=\"number\" min=\"0\" max=\"1\" step=\"0.1\" /></label>\n\n    <h5 style=\"\n            opacity: {{ state.opacity }};\n            color: {{ state.color|allow:'green,blue'|default:'red' }};\n        \">\n        {{ state.username|lower }}\n    </h5>\n</div>\n\n</Template>\n\n<State\n    opacity=\"0.5\"\n    color=\"blue\"\n    username=\"Testing_Username\"\n></State>\n\n\n"
   }
  }
 },
 "x_x_x": {
  "Type": "Library",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "library",
  "Name": "x",
  "Parent": "x_x",
  "DefName": "x",
  "FullName": "x_x_x",
  "Hash": "x1ldrcnf"
 },
 "x_x_mws": {
  "Type": "Library",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "library",
  "Name": "mws",
  "Parent": "x_x",
  "DefName": "mws",
  "FullName": "x_x_mws",
  "Hash": "x55gtu7"
 },
 "x_x_docseg": {
  "Type": "Library",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "library",
  "Name": "docseg",
  "Parent": "x_x",
  "DefName": "docseg",
  "FullName": "x_x_docseg",
  "Hash": "xs9953o"
 },
 "x_x_eg": {
  "Type": "Library",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "library",
  "Name": "eg",
  "Parent": "x_x",
  "DefName": "eg",
  "FullName": "x_x_eg",
  "Hash": "69vqt9"
 },
 "x_x_x_DemoModal": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "x",
  "name": "DemoModal",
  "Parent": "x_x_x",
  "DefName": null,
  "Name": "DemoModal",
  "FullName": "x_x_x_DemoModal",
  "Hash": "1rpq1pk",
  "TagName": "x-demomodal",
  "FuncDefHash": "x829hs9"
 },
 "x_x_x_DemoChart": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "name": "DemoChart",
  "Parent": "x_x_x",
  "DefName": null,
  "Name": "DemoChart",
  "FullName": "x_x_x_DemoChart",
  "Hash": "x1sgecs4",
  "namespace": "x_x_x",
  "TagName": "x_x_x-demochart",
  "FuncDefHash": "j6jhe5"
 },
 "x_x_x_ExampleBtn": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "x",
  "name": "ExampleBtn",
  "Parent": "x_x_x",
  "DefName": null,
  "Name": "ExampleBtn",
  "FullName": "x_x_x_ExampleBtn",
  "Hash": "i2kvpp",
  "TagName": "x-examplebtn",
  "FuncDefHash": "u4j43f"
 },
 "x_x_x_DemoSelector": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "x",
  "name": "DemoSelector",
  "Parent": "x_x_x",
  "DefName": null,
  "Name": "DemoSelector",
  "FullName": "x_x_x_DemoSelector",
  "Hash": "ripjvb",
  "TagName": "x-demoselector",
  "FuncDefHash": "x1jemelq"
 },
 "x_x_mws_Page": {
  "Type": "Component",
  "mode": "vanish-into-document",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "mws",
  "name": "Page",
  "Parent": "x_x_mws",
  "DefName": null,
  "Name": "Page",
  "FullName": "x_x_mws_Page",
  "Hash": "1apn7pv",
  "TagName": "mws-page",
  "FuncDefHash": "rbuqe3"
 },
 "x_x_mws_DevLogNav": {
  "Type": "Component",
  "mode": "vanish",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "mws",
  "name": "DevLogNav",
  "Parent": "x_x_mws",
  "DefName": null,
  "Name": "DevLogNav",
  "FullName": "x_x_mws_DevLogNav",
  "Hash": "hdrs3f",
  "TagName": "mws-devlognav",
  "FuncDefHash": "x1ek8a23"
 },
 "x_x_mws_DocSidebar": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "mws",
  "name": "DocSidebar",
  "Parent": "x_x_mws",
  "DefName": null,
  "Name": "DocSidebar",
  "FullName": "x_x_mws_DocSidebar",
  "Hash": "15strma",
  "TagName": "mws-docsidebar",
  "FuncDefHash": "xlb2rd4"
 },
 "x_x_mws_Demo": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "mws",
  "name": "Demo",
  "Parent": "x_x_mws",
  "DefName": null,
  "Name": "Demo",
  "FullName": "x_x_mws_Demo",
  "Hash": "1jolobd",
  "TagName": "mws-demo",
  "FuncDefHash": "xae74iu"
 },
 "x_x_mws_AllExamples": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "mws",
  "name": "AllExamples",
  "Parent": "x_x_mws",
  "DefName": null,
  "Name": "AllExamples",
  "FullName": "x_x_mws_AllExamples",
  "Hash": "x3m56c2",
  "TagName": "mws-allexamples",
  "FuncDefHash": "xescvna"
 },
 "x_x_mws_Section": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "mws",
  "name": "Section",
  "Parent": "x_x_mws",
  "DefName": null,
  "Name": "Section",
  "FullName": "x_x_mws_Section",
  "Hash": "x1d1j0ca",
  "TagName": "mws-section",
  "FuncDefHash": "x2s8nar"
 },
 "x_x_docseg_Templating_1": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Templating_1",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Templating_1",
  "FullName": "x_x_docseg_Templating_1",
  "Hash": "g1ev96",
  "TagName": "docseg-templating_1",
  "FuncDefHash": "x1s5o68b"
 },
 "x_x_docseg_Templating_PrepareCallback": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Templating_PrepareCallback",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Templating_PrepareCallback",
  "FullName": "x_x_docseg_Templating_PrepareCallback",
  "Hash": "x1u7tsfu",
  "TagName": "docseg-templating_preparecallback",
  "FuncDefHash": "x1ut59dd"
 },
 "x_x_docseg_Templating_Comments": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Templating_Comments",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Templating_Comments",
  "FullName": "x_x_docseg_Templating_Comments",
  "Hash": "l7svrm",
  "TagName": "docseg-templating_comments",
  "FuncDefHash": "1hpjg9n"
 },
 "x_x_docseg_Templating_Escaping": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Templating_Escaping",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Templating_Escaping",
  "FullName": "x_x_docseg_Templating_Escaping",
  "Hash": "x1ehsatd",
  "TagName": "docseg-templating_escaping",
  "FuncDefHash": "xfvvd04"
 },
 "x_x_docseg_Tutorial_P1": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Tutorial_P1",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Tutorial_P1",
  "FullName": "x_x_docseg_Tutorial_P1",
  "Hash": "x51qst3",
  "TagName": "docseg-tutorial_p1",
  "FuncDefHash": "1tlgcio"
 },
 "x_x_docseg_Tutorial_P2": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Tutorial_P2",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Tutorial_P2",
  "FullName": "x_x_docseg_Tutorial_P2",
  "Hash": "1uj7p64",
  "TagName": "docseg-tutorial_p2",
  "FuncDefHash": "xi6k4ld"
 },
 "x_x_docseg_Tutorial_P2_filters_demo": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Tutorial_P2_filters_demo",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Tutorial_P2_filters_demo",
  "FullName": "x_x_docseg_Tutorial_P2_filters_demo",
  "Hash": "t0upt6",
  "TagName": "docseg-tutorial_p2_filters_demo",
  "FuncDefHash": "x1dbdrel"
 },
 "x_x_docseg_Tutorial_P3_state_demo": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Tutorial_P3_state_demo",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Tutorial_P3_state_demo",
  "FullName": "x_x_docseg_Tutorial_P3_state_demo",
  "Hash": "1oig15e",
  "TagName": "docseg-tutorial_p3_state_demo",
  "FuncDefHash": "xflbnij"
 },
 "x_x_docseg_Tutorial_P3_state_bind": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "docseg",
  "name": "Tutorial_P3_state_bind",
  "Parent": "x_x_docseg",
  "DefName": null,
  "Name": "Tutorial_P3_state_bind",
  "FullName": "x_x_docseg_Tutorial_P3_state_bind",
  "Hash": "ngpccm",
  "TagName": "docseg-tutorial_p3_state_bind",
  "FuncDefHash": "x14n2s57"
 },
 "x_x_eg_Hello": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "Hello",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "Hello",
  "FullName": "x_x_eg_Hello",
  "Hash": "1icoagp",
  "TagName": "eg-hello",
  "FuncDefHash": "1sp05hb"
 },
 "x_x_eg_Simple": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "Simple",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "Simple",
  "FullName": "x_x_eg_Simple",
  "Hash": "xlo7cf3",
  "TagName": "eg-simple",
  "FuncDefHash": "12v9omt"
 },
 "x_x_eg_ToDo": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "ToDo",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "ToDo",
  "FullName": "x_x_eg_ToDo",
  "Hash": "1k33iqb",
  "TagName": "eg-todo",
  "FuncDefHash": "x1i4hc01"
 },
 "x_x_eg_JSON": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "JSON",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "JSON",
  "FullName": "x_x_eg_JSON",
  "Hash": "x11tjlh2",
  "TagName": "eg-json",
  "FuncDefHash": "xqrkh3q"
 },
 "x_x_eg_JSONArray": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "JSONArray",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "JSONArray",
  "FullName": "x_x_eg_JSONArray",
  "Hash": "xcql4f2",
  "TagName": "eg-jsonarray",
  "FuncDefHash": "x1asnbs6"
 },
 "x_x_eg_API": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "API",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "API",
  "FullName": "x_x_eg_API",
  "Hash": "x1at59fc",
  "TagName": "eg-api",
  "FuncDefHash": "x1edl05g"
 },
 "x_x_eg_ColorSelector": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "ColorSelector",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "ColorSelector",
  "FullName": "x_x_eg_ColorSelector",
  "Hash": "6riop6",
  "TagName": "eg-colorselector",
  "FuncDefHash": "khu4dj"
 },
 "x_x_eg_SearchBox": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "SearchBox",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "SearchBox",
  "FullName": "x_x_eg_SearchBox",
  "Hash": "ljc2i4",
  "TagName": "eg-searchbox",
  "FuncDefHash": "q0bbc"
 },
 "x_x_eg_DateNumberPicker": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "DateNumberPicker",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "DateNumberPicker",
  "FullName": "x_x_eg_DateNumberPicker",
  "Hash": "1i6hhtf",
  "TagName": "eg-datenumberpicker",
  "FuncDefHash": "x3ue3jq"
 },
 "x_x_eg_FlexibleForm": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "FlexibleForm",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "FlexibleForm",
  "FullName": "x_x_eg_FlexibleForm",
  "Hash": "x4vivet",
  "TagName": "eg-flexibleform",
  "FuncDefHash": "x1lvrjsl"
 },
 "x_x_eg_FlexibleFormWithAPI": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "FlexibleFormWithAPI",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "FlexibleFormWithAPI",
  "FullName": "x_x_eg_FlexibleFormWithAPI",
  "Hash": "x1sg84mj",
  "TagName": "eg-flexibleformwithapi",
  "FuncDefHash": "x1gjb161"
 },
 "x_x_eg_Components": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "Components",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "Components",
  "FullName": "x_x_eg_Components",
  "Hash": "xeg9s6i",
  "TagName": "eg-components",
  "FuncDefHash": "x573nef"
 },
 "x_x_eg_OscillatingGraph": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "OscillatingGraph",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "OscillatingGraph",
  "FullName": "x_x_eg_OscillatingGraph",
  "Hash": "ugu6po",
  "TagName": "eg-oscillatinggraph",
  "FuncDefHash": "dib48s"
 },
 "x_x_eg_PrimeSieve": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "PrimeSieve",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "PrimeSieve",
  "FullName": "x_x_eg_PrimeSieve",
  "Hash": "1b9a0ql",
  "TagName": "eg-primesieve",
  "FuncDefHash": "1f849r0"
 },
 "x_x_eg_MemoryGame": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "MemoryGame",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "MemoryGame",
  "FullName": "x_x_eg_MemoryGame",
  "Hash": "14schu5",
  "TagName": "eg-memorygame",
  "FuncDefHash": "1n2i9fj"
 },
 "x_x_eg_ConwayGameOfLife": {
  "Type": "Component",
  "mode": "regular",
  "rerender": "event",
  "engine": "Reconciler",
  "ConfPreprocessors": [
   "Src",
   "Content"
  ],
  "RenderObj": "component",
  "namespace": "eg",
  "name": "ConwayGameOfLife",
  "Parent": "x_x_eg",
  "DefName": null,
  "Name": "ConwayGameOfLife",
  "FullName": "x_x_eg_ConwayGameOfLife",
  "Hash": "x1ketdcf",
  "TagName": "eg-conwaygameoflife",
  "FuncDefHash": "86fv1g"
 },
 "x_x_x_DemoModal_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n        .modal-backdrop {\n            position: fixed;\n            top: 0;\n            left: 0;\n            height: 100vh;\n            width: 100vw;\n        }\n        .modal-backdrop {\n            background: rgba(0, 0, 0, 0.5);\n            z-index: 11;\n        }\n        .modal-body {\n            --w: 400px;\n            width: var(--w);\n            position: fixed;\n            z-index: 12;\n            left: calc(50vw - (var(--w) / 2));\n            display: block;\n            background: white;\n            border: 7px solid black;\n            border-radius: 7px;\n            padding: 50px;\n            transition: top 1s;\n        }\n        .modal-body > h2 {\n            border-bottom: 3px solid black;\n            color: black;\n            background-color: #b90183;\n            font-weight: bold;\n            padding: 10px;\n            border-top: 0;\n            margin: -50px;\n            margin-bottom: 50px;\n            color: white;\n            /* A perspective-style drop shadow, plus 1px outline */\n            text-shadow:\n                3px 3px 0 #000,\n                2px 2px 0 #000,\n              -1px -1px 0 #000,\n                1px -1px 0 #000,\n                -1px 1px 0 #000,\n                1px 1px 0 #000;\n        }\n        .modal-body > h2 button {\n            font-size: 25px;\n            float: right;\n            width: 50px;\n        }\n\n        button {\n            font-size: 13px;\n            font-weight: bold;\n            padding: 5px;\n            border-radius: 1px 5px 1px 7px;\n            color: black;\n            border: 1px solid grey;\n            box-shadow: inset -2px -3px 1px 1px hsla(0,0%,39.2%,.3);\n            cursor: default;\n            margin-top: 0px;\n            padding-bottom: 3px;\n            background-color: white;\n            margin-bottom: 4px;\n            transition: margin 0.2s,\n                        padding 0.2s,\n                        background 0.3s,\n                        box-shadow 0.2s;\n        }\n        button:active {\n            box-shadow: inset 2px 3px 1px 1px hsla(0,0%,39.2%,.3);\n            margin-top: 3px;\n            padding-bottom: 0;\n        }\n        button:hover {\n            background-color: rgba(162, 228, 184);\n        }\n    ",
  "Parent": "x_x_x_DemoModal",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_x_DemoModal_x"
 },
 "x_x_x_DemoChart_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n        .chart-container {\n            border: 1px solid black;\n            height: 100px;\n            width: 100px;\n            display: flex;\n            align-items: flex-end;\n        }\n        .chart-container > div {\n            box-sizing: border-box;\n            background-color: #b90183;\n            background-color: white;\n            border: 1px solid grey;\n            width: 30px;\n            border-radius: 1px 5px 1px 5px;\n            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);\n            margin-top: -5px;\n        }\n\n        .chart-container.animated > div {\n            transition: height calc(var(--speed, 10) * 0.1s) var(--easing, linear);\n        }\n        .chart-container > div:first-of-type {\n            margin-left: -4px;\n        }\n        .chart-container > div:hover {\n            background-color: #b90183;\n        }\n        label {\n            display: inline-block;\n        }\n    ",
  "Parent": "x_x_x_DemoChart",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_x_DemoChart_x"
 },
 "x_x_x_ExampleBtn_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n        .my-btn {\n            display: inline-block;\n            box-sizing: border-box;\n            font-family: sans-serif;\n            border: 1px solid gray;\n            transition: 0.1s;\n            box-shadow:\n                inset -3px -3px\n                1px 1px rgba(100, 100, 100, 0.3);\n            border-radius: 1px 8px 1px 8px;\n            cursor: default;\n            text-align: center;\n            padding: 3px;\n            padding-right: 5px;\n            padding-bottom: 5px;\n            height: 30px;\n            background: turquoise;\n            font-weight: bold;\n        }\n\n        .my-btn:active {\n            box-shadow: inset 3px 3px 1px 1px rgba(100, 100, 100, 0.3);\n        }\n        .my-btn__square {\n            border-radius: 1px 8px 1px 8px;\n        }\n        .my-btn__round {\n            border-radius: 150px;\n        }\n    ",
  "Parent": "x_x_x_ExampleBtn",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_x_ExampleBtn_x"
 },
 "x_x_x_DemoSelector_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n        label {\n            font-size: 13px;\n            font-weight: bold;\n            border-radius: 1px 5px 1px 5px;\n            background:  #b90183;\n            color: black;\n            border: 1px solid grey;\n            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);\n            cursor: default;\n            margin-top: 0px;\n            padding: 5px;\n            background-color: white;\n            margin-bottom: 4px;\n            margin-left: 3px;\n        }\n        input:checked + label {\n            box-shadow: inset 5px 5px 1px 1px hsla(0,0%,39.2%,.3);\n            margin-top: 5px;\n        }\n    ",
  "Parent": "x_x_x_DemoSelector",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_x_DemoSelector_x"
 },
 "x_x_mws_Page_x": {
  "Type": "Script",
  "RenderObj": "script",
  "Parent": "x_x_mws_Page",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_mws_Page_x",
  "Hash": "x1rrhpdc",
  "localVars": [
   "component",
   "modulo",
   "library",
   "props",
   "style",
   "template",
   "staticdata",
   "script",
   "state",
   "element",
   "cparts"
  ]
 },
 "x_x_mws_DevLogNav_x": {
  "Type": "State",
  "RenderObj": "state",
  "data": [
   [
    "2022-03",
    "Next steps for alpha"
   ],
   [
    "2021-09",
    "Thoughts on design"
   ],
   [
    "2021-01",
    "FAQ"
   ]
  ],
  "Content": "",
  "Parent": "x_x_mws_DevLogNav",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_mws_DevLogNav_x"
 },
 "x_x_mws_DocSidebar_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "li {\n    margin-left: 50px;\n}\n/*\nli.ginactive > ul::before,\nli.gactive > ul::before {\n    content: ' - ';\n    background: var(--highlight-color);\n    color: white;\n    text-decoration: none;\n}\n*/\nli.ginactive > a::before {\n    content: '+ ';\n}\n\n",
  "Parent": "x_x_mws_DocSidebar",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_mws_DocSidebar_x"
 },
 "x_x_mws_Demo_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": ".demo-wrapper.demo-wrapper__minipreview .CodeMirror {\n    height: 200px;\n}\n\n.demo-wrapper.demo-wrapper__clipboard .CodeMirror {\n    height: auto;\n}\n\n.demo-wrapper.demo-wrapper__clipboard .CodeMirror * {\n    font-family: monospace;\n    font-size: 1rem;\n}\n\n.demo-wrapper.demo-wrapper__minipreview .CodeMirror * {\n    font-family: monospace;\n    font-size: 14px;\n}\n\n.demo-wrapper.demo-wrapper__fullscreen .CodeMirror {\n    height: 87vh;\n}\n.demo-wrapper.demo-wrapper__fullscreen .CodeMirror * {\n    font-family: monospace;\n    font-size: 16px;\n}\n\n.CodeMirror span.cm-string-2 {\n    color: black !important;\n}\n\n.demo-wrapper {\n    position: relative;\n    display: block;\n    width: 100%;\n}\n\n.Main--fluid  .demo-wrapper.demo-wrapper__minipreview   {\n    /* Make look better in Docs */\n    max-width: 900px;\n}\n.Main--fluid  .demo-wrapper.demo-wrapper__minipreview.demo-wrapper__fullscreen  {\n    /* ...except if full screen */\n    max-width: 100vw;\n}\n\n.demo-wrapper.demo-wrapper__fullscreen {\n    position: absolute;\n    display: block;\n    width: 100vw;\n    height: 100vh;\n    z-index: 100;\n    top: 0;\n    left: 0;\n    box-sizing: border-box;\n    padding: 20px;\n    background: white;\n}\n\n/* No tabs sitch: */\n.demo-wrapper__notabs .editor-minipreview {\n    margin-top: 40px;\n    margin-left: 5px;\n    border: 1px solid #999;\n    height: 160px;\n}\n\n.demo-wrapper__fullscreen.demo-wrapper__notabs .editor-minipreview {\n    margin-top: 65px;\n}\n\n.editor-toolbar {\n    position: absolute;\n    z-index: 3;\n    display: flex;\n    width: auto;\n    /*right: -70px;*/\n    right: 30px;\n    top: 0;\n    height: 35px;\n    padding: 2px;\n    border: #ddd 1px solid;\n}\n\n\n\n.demo-wrapper__fullscreen .editor-toolbar {\n    height: 60px;\n    padding: 10px;\n}\n\n\n.demo-wrapper__minipreview  .editor-wrapper {\n    width: 78%;\n    border: 1px solid black;\n}\n.Main--fluid  .demo-wrapper__minipreview  .editor-wrapper {\n}\n\n.demo-wrapper.demo-wrapper__clipboard .editor-wrapper {\n    border: 1px dotted #ddd;\n    width: 100%;\n}\n\n.demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {\n    border: 5px solid black;\n    border-radius: 1px 8px 1px 8px;\n    border-bottom-width: 1px;\n    border-right-width: 1px;\n}\n\n.editor-minipreview {\n    border: 1px solid black;\n    border-radius: 1px;\n    background: #eee;\n    padding: 5px;\n    border-left: none;\n    width: 200px;\n    height: 200px;\n    overflow-y: auto;\n}\n.editor-minipreview > div > * > input {\n  max-width: 175px;\n}\n\n.demo-wrapper__fullscreen .editor-minipreview {\n    width: 30vw;\n    height: auto;\n    border: 1px solid black;\n    margin: 20px;\n    padding: 30px;\n    border: 5px solid black;\n    border-radius: 1px 8px 1px 8px;\n    border-bottom-width: 1px;\n    border-right-width: 1px;\n}\n\n.side-by-side-panes {\n    display: flex;\n    justify-content: space-between;\n}\n\n.TabNav {\n    /*border-bottom: 1px dotted var(--highlight-color);*/\n    width: 100%;\n}\n\n\n.TabNav > ul {\n    width: 100%;\n    display: flex;\n}\n\n.TabNav-title {\n    border: 2px solid black;\n    border-top-width: 4px;\n    /*border-bottom-width: 0;*/\n    margin-bottom: -2px;\n    border-radius: 8px 8px 0 0;\n    background: white;\n    min-width: 50px;\n    box-shadow: 0 0 0 0 var(--highlight-color);\n    transition: box-shadow 0.3s,\n                border-color 0.2s;\n}\n\n.TabNav-title a,\n.TabNav-title a:visited,\n.TabNav-title a:active {\n    text-decoration: none;\n    color: black;\n    display: block;\n    padding: 5px;\n    font-weight: bold;\n    cursor: pointer;\n    font-size: 1.1rem;\n}\n\n.TabNav-title:hover {\n    border-color: var(--highlight-color);\n}\n\n.TabNav-title--selected {\n    border-color: var(--highlight-color);\n    background: var(--highlight-color);\n    box-shadow: 0 0 0 8px var(--highlight-color);\n    border-radius: 8px 8px 8px 8px;\n}\n.TabNav-title--selected a {\n    color: white !important;\n}\n\n\n@media (max-width: 992px) {\n    .TabNav > ul {\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n}\n@media (max-width: 768px) {\n    .TabNav-title {\n        padding: 7px;\n    }\n}\n\n\n\n@media (max-width: 768px) {\n    .demo-wrapper.demo-wrapper__fullscreen {\n        position: relative;\n        display: block;\n        width: 100vw;\n        height: auto;\n        z-index: 1;\n    }\n}\n\n\n@media (max-width: 768px) {\n    .editor-toolbar {\n        position: static;\n        padding: 10px;\n        margin: 20px;\n        height: 60px;\n        font-size: 1.1rem;\n    }\n    .demo-wrapper__fullscreen .editor-toolbar {\n        margin: 5px;\n        height: 60px;\n        padding: 5px;\n        display: flex;\n        justify-content: flex-end;\n    }\n}\n\n\n@media (max-width: 768px) {\n    .side-by-side-panes {\n        display: block;\n    }\n}\n\n@media (max-width: 768px) {\n    .editor-minipreview {\n        width: 100%;\n    }\n    .demo-wrapper__fullscreen .editor-minipreview {\n        width: 90%;\n    }\n}\n\n\n@media (min-width: 768px) {\n    .demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {\n        height: auto;\n        width: 70vw;\n        min-height: 87vh;\n    }\n}\n\n\n@media (max-width: 768px) {\n    .editor-wrapper {\n        width: 100%;\n        border: 1px solid black;\n    }\n    .demo-wrapper__fullscreen .editor-wrapper {\n        width: 100%;\n    }\n}\n\n",
  "Parent": "x_x_mws_Demo",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_mws_Demo_x"
 },
 "x_x_mws_AllExamples_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": ":host {\n    --colcount: 5;\n    display: grid;\n    grid-template-columns: repeat(var(--colcount), 1fr);\n}\n:host > .Example {\n    border: 1px solid black;\n    border-radius: 2px;\n    padding: 10px;\n    margin: 10px;\n    min-height: 200px;\n    background: #ddd;\n    position: relative;\n    margin-top: 50px;\n}\n.Example-wrapper {\n    height: 200px;\n    overflow-y: auto;\n}\n\n:host > .Example.expanded {\n    background: transparent;\n    grid-column: 1 / span var(--colcount);\n}\n\n:host > .Example .tool-button {\n    position: absolute;\n    top: -30px;\n    height: 30px;\n    right: 0px;\n    min-width: 80px;\n    border-radius: 10px 10px 0 0;\n    /*border-bottom: none;*/\n    background: #ddd;\n}\n:host > .Example .tool-button:hover {\n    cursor: pointer;\n    text-decoration: underline;\n}\n\n@media (max-width: 1550px) {\n    :host {\n        --colcount: 4;\n    }\n}\n@media (max-width: 1250px) {\n    :host {\n        --colcount: 3;\n    }\n}\n\n@media (max-width: 1160px) {\n    :host {\n        --colcount: 2;\n    }\n}\n\n@media (max-width: 768px) {\n    :host {\n        --colcount: 1;\n    }\n}\n\n",
  "Parent": "x_x_mws_AllExamples",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_mws_AllExamples_x"
 },
 "x_x_mws_Section_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n        :host {\n            position: relative;\n        }\n        h2 {\n            font-weight: bold;\n            color: var(--highlight-color);\n            margin-bottom: 0;\n        }\n        a.secanchor {\n            padding-top: 100px;\n            color: var(--highlight-color);\n            opacity: 0.3;\n            display: block;\n        }\n        :host:hover .Section-helper {\n            opacity: 1.0;\n        }\n    ",
  "Parent": "x_x_mws_Section",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_mws_Section_x"
 },
 "x_x_docseg_Templating_1_x": {
  "Type": "Script",
  "RenderObj": "script",
  "Parent": "x_x_docseg_Templating_1",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Templating_1_x",
  "Hash": "154ld2",
  "localVars": [
   "component",
   "modulo",
   "library",
   "props",
   "style",
   "template",
   "staticdata",
   "script",
   "state",
   "element",
   "cparts"
  ]
 },
 "x_x_docseg_Templating_PrepareCallback_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    input { display: inline; width: 25px }\n",
  "Parent": "x_x_docseg_Templating_PrepareCallback",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Templating_PrepareCallback_x"
 },
 "x_x_docseg_Templating_Comments_x": {
  "Type": "Template",
  "RenderObj": "template",
  "Parent": "x_x_docseg_Templating_Comments",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Templating_Comments_x",
  "Hash": "1gic6ht"
 },
 "x_x_docseg_Templating_Escaping_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    .msgcontent {\n        background: #999;\n        padding: 10px;\n        margin: 10px;\n    }\n",
  "Parent": "x_x_docseg_Templating_Escaping",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Templating_Escaping_x"
 },
 "x_x_docseg_Tutorial_P1_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n/* ...and any CSS here! */\nstrong {\n    color: blue;\n}\n.neat {\n    font-variant: small-caps;\n}\n:host { /* styles the entire component */\n    display: inline-block;\n    background-color: cornsilk;\n    padding: 5px;\n    box-shadow: 10px 10px 0 0 turquoise;\n}\n",
  "Parent": "x_x_docseg_Tutorial_P1",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Tutorial_P1_x"
 },
 "x_x_docseg_Tutorial_P2_x": {
  "Type": "Template",
  "RenderObj": "template",
  "Parent": "x_x_docseg_Tutorial_P2",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Tutorial_P2_x",
  "Hash": "x35mjmh"
 },
 "x_x_docseg_Tutorial_P2_filters_demo_x": {
  "Type": "Template",
  "RenderObj": "template",
  "Parent": "x_x_docseg_Tutorial_P2_filters_demo",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Tutorial_P2_filters_demo_x",
  "Hash": "x35mjmh"
 },
 "x_x_docseg_Tutorial_P3_state_demo_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    :host {\n        font-size: 0.8rem;\n    }\n",
  "Parent": "x_x_docseg_Tutorial_P3_state_demo",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Tutorial_P3_state_demo_x"
 },
 "x_x_docseg_Tutorial_P3_state_bind_x": {
  "Type": "State",
  "RenderObj": "state",
  "opacity": "0.5",
  "color": "blue",
  "username": "Testing_Username",
  "Content": "",
  "Parent": "x_x_docseg_Tutorial_P3_state_bind",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_docseg_Tutorial_P3_state_bind_x"
 },
 "x_x_eg_Hello_x": {
  "Type": "Script",
  "RenderObj": "script",
  "Parent": "x_x_eg_Hello",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_Hello_x",
  "Hash": "1ug4oiq",
  "localVars": [
   "component",
   "modulo",
   "library",
   "props",
   "style",
   "template",
   "staticdata",
   "script",
   "state",
   "element",
   "cparts"
  ]
 },
 "x_x_eg_Simple_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    em { color: darkgreen; }\n    * { text-decoration: underline; }\n",
  "Parent": "x_x_eg_Simple",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_Simple_x"
 },
 "x_x_eg_ToDo_x": {
  "Type": "Script",
  "RenderObj": "script",
  "Parent": "x_x_eg_ToDo",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_ToDo_x",
  "Hash": "x8ktit0",
  "localVars": [
   "component",
   "modulo",
   "library",
   "props",
   "style",
   "template",
   "staticdata",
   "script",
   "state",
   "element",
   "cparts"
  ]
 },
 "x_x_eg_JSON_x": {
  "Type": "StaticData",
  "RenderObj": "staticdata",
  "Parent": "x_x_eg_JSON",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_JSON_x",
  "Hash": "1sejui7"
 },
 "x_x_eg_JSONArray_x": {
  "Type": "StaticData",
  "RenderObj": "staticdata",
  "Parent": "x_x_eg_JSONArray",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_JSONArray_x",
  "Hash": "16lf05u"
 },
 "x_x_eg_API_x": {
  "Type": "Script",
  "RenderObj": "script",
  "Parent": "x_x_eg_API",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_API_x",
  "Hash": "397k54",
  "localVars": [
   "component",
   "modulo",
   "library",
   "props",
   "style",
   "template",
   "staticdata",
   "script",
   "state",
   "element",
   "cparts"
  ]
 },
 "x_x_eg_ColorSelector_x": {
  "Type": "State",
  "RenderObj": "state",
  "hue": 130,
  "sat": 50,
  "lum": 50,
  "Content": "",
  "Parent": "x_x_eg_ColorSelector",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_ColorSelector_x"
 },
 "x_x_eg_SearchBox_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    input {\n        width: 100%;\n    }\n    .results-container {\n        display: flex;\n        flex-wrap: wrap;\n        justify-content: center;\n    }\n    .results-container > img { margin-top 30px; }\n    .results {\n        position: absolute;\n        height: 0;\n        width: 0;\n        overflow: hidden;\n        display: block;\n        border: 2px solid #B90183;\n        border-radius: 0 0 20px 20px;\n        transition: height 0.2s;\n        z-index: 20;\n        background: white;\n    }\n    .results.visible {\n        height: 200px;\n        width: 200px;\n    }\n    .result {\n        padding: 10px;\n        width: 80px;\n        position: relative;\n    }\n    .result label {\n        position: absolute;\n        width: 80px;\n        background: rgba(255, 255, 255, 0.5);\n        font-size: 0.7rem;\n        top: 0;\n        left: 0;\n    }\n",
  "Parent": "x_x_eg_SearchBox",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_SearchBox_x"
 },
 "x_x_eg_DateNumberPicker_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    :host {\n        border: 1px solid black;\n        padding: 10px;\n        margin: 10px;\n        margin-left: 0;\n        display: flex;\n        flex-wrap: wrap;\n        font-weight: bold;\n    }\n    div {\n        float: right;\n    }\n    label {\n        display: block;\n        width: 100%;\n    }\n",
  "Parent": "x_x_eg_DateNumberPicker",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_DateNumberPicker_x"
 },
 "x_x_eg_FlexibleForm_x": {
  "Type": "Template",
  "RenderObj": "template",
  "Parent": "x_x_eg_FlexibleForm",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_FlexibleForm_x",
  "Hash": "1ssp5sa"
 },
 "x_x_eg_FlexibleForm_Spartacus": {
  "Type": "State",
  "RenderObj": "state",
  "name": "Spartacus",
  "topic": "On the treatment of Thracian gladiators",
  "subscribe": true,
  "private": false,
  "comment": "So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink.",
  "fields": [
   "name",
   "topic",
   "comment",
   "private",
   "subscribe"
  ],
  "Content": "",
  "Parent": "x_x_eg_FlexibleForm",
  "DefName": null,
  "Name": "Spartacus",
  "FullName": "x_x_eg_FlexibleForm_Spartacus"
 },
 "x_x_eg_FlexibleFormWithAPI_x": {
  "Type": "Script",
  "RenderObj": "script",
  "Parent": "x_x_eg_FlexibleFormWithAPI",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_FlexibleFormWithAPI_x",
  "Hash": "1qroh1a",
  "localVars": [
   "component",
   "modulo",
   "library",
   "props",
   "style",
   "template",
   "staticdata",
   "script",
   "state",
   "element",
   "cparts"
  ]
 },
 "x_x_eg_Components_x": {
  "Type": "Template",
  "RenderObj": "template",
  "Parent": "x_x_eg_Components",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_Components_x",
  "Hash": "gukocp"
 },
 "x_x_eg_OscillatingGraph_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    input {\n        width: 50px;\n    }\n",
  "Parent": "x_x_eg_OscillatingGraph",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_OscillatingGraph_x"
 },
 "x_x_eg_PrimeSieve_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n.grid {\n    display: grid;\n    grid-template-columns: repeat(9, 1fr);\n    color: #ccc;\n    font-weight: bold;\n    width: 100%;\n    margin: -5px;\n}\n.grid > div {\n    border: 1px solid #ccc;\n    cursor: crosshair;\n    transition: 0.2s;\n}\ndiv.whole {\n    color: white;\n    background: #B90183;\n}\ndiv.hidden {\n    background: #ccc;\n    color: #ccc;\n}\n\n/* Color green and add asterisk */\ndiv.number { background: green; }\ndiv.number::after { content: \"*\"; }\n/* Check for whole factors (an adjacent div.whole).\n   If found, then hide asterisk and green */\ndiv.whole ~ div.number { background: #B90183; }\ndiv.whole ~ div.number::after { opacity: 0; }\n",
  "Parent": "x_x_eg_PrimeSieve",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_PrimeSieve_x"
 },
 "x_x_eg_MemoryGame_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\nh3 {\n    background: #B90183;\n    border-radius: 8px;\n    text-align: center;\n    color: white;\n    font-weight: bold;\n}\n.board {\n    display: grid;\n    grid-template-rows: repeat(4, 1fr);\n    grid-template-columns: repeat(4, 1fr);\n    grid-gap: 2px;\n    width: 100%;\n    height: 150px;\n    width: 150px;\n}\n.board.hard {\n    grid-gap: 1px;\n    grid-template-rows: repeat(6, 1fr);\n    grid-template-columns: repeat(6, 1fr);\n}\n.board > .card {\n    background: #B90183;\n    border: 2px solid black;\n    border-radius: 1px;\n    cursor: pointer;\n    text-align: center;\n    min-height: 15px;\n    transition: background 0.3s, transform 0.3s;\n    transform: scaleX(-1);\n    padding-top: 2px;\n    color: #B90183;\n}\n.board.hard > .card {\n    border: none !important;\n    padding: 0;\n}\n.board > .card.flipped {\n    background: #FFFFFF;\n    border: 2px solid #B90183;\n    transform: scaleX(1);\n}\n\n@keyframes flipping {\n    from { transform: scaleX(-1.1); background: #B90183; }\n    to {   transform: scaleX(1.0);  background: #FFFFFF; }\n}\n",
  "Parent": "x_x_eg_MemoryGame",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_MemoryGame_x"
 },
 "x_x_eg_ConwayGameOfLife_x": {
  "Type": "Style",
  "RenderObj": "style",
  "Content": "\n    :host {\n        display: flex;\n    }\n    .grid {\n        display: grid;\n        grid-template-columns: repeat(24, 5px);\n        margin: -2px;\n        grid-gap: 1px;\n    }\n    .grid > div {\n        background: white;\n        width: 5px;\n        height: 5px;\n    }\n    input, button {\n        width: 40px;\n    }\n",
  "Parent": "x_x_eg_ConwayGameOfLife",
  "DefName": null,
  "Name": "x",
  "FullName": "x_x_eg_ConwayGameOfLife_x"
 }
};currentModulo.assets.functions["xpq350q"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

// This is CodeMirror (https://codemirror.net), a code editor
// implemented in JavaScript on top of the browser's DOM.
//
// You can find some technical background for some of the code below
// at http://marijnhaverbeke.nl/blog/#cm-internals .

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.CodeMirror = factory());
}(this, (function () { 'use strict';

  // Kludges for bugs and behavior differences that can't be feature
  // detected are enabled based on userAgent etc sniffing.
  var userAgent = navigator.userAgent;
  var platform = navigator.platform;

  var gecko = /gecko\/\d/i.test(userAgent);
  var ie_upto10 = /MSIE \d/.test(userAgent);
  var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent);
  var edge = /Edge\/(\d+)/.exec(userAgent);
  var ie = ie_upto10 || ie_11up || edge;
  var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : +(edge || ie_11up)[1]);
  var webkit = !edge && /WebKit\//.test(userAgent);
  var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent);
  var chrome = !edge && /Chrome\//.test(userAgent);
  var presto = /Opera\//.test(userAgent);
  var safari = /Apple Computer/.test(navigator.vendor);
  var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent);
  var phantom = /PhantomJS/.test(userAgent);

  var ios = safari && (/Mobile\/\w+/.test(userAgent) || navigator.maxTouchPoints > 2);
  var android = /Android/.test(userAgent);
  // This is woefully incomplete. Suggestions for alternative methods welcome.
  var mobile = ios || android || /webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent);
  var mac = ios || /Mac/.test(platform);
  var chromeOS = /\bCrOS\b/.test(userAgent);
  var windows = /win/i.test(platform);

  var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/);
  if (presto_version) { presto_version = Number(presto_version[1]); }
  if (presto_version && presto_version >= 15) { presto = false; webkit = true; }
  // Some browsers use the wrong event properties to signal cmd/ctrl on OS X
  var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11));
  var captureRightClick = gecko || (ie && ie_version >= 9);

  function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }

  var rmClass = function(node, cls) {
    var current = node.className;
    var match = classTest(cls).exec(current);
    if (match) {
      var after = current.slice(match.index + match[0].length);
      node.className = current.slice(0, match.index) + (after ? match[1] + after : "");
    }
  };

  function removeChildren(e) {
    for (var count = e.childNodes.length; count > 0; --count)
      { e.removeChild(e.firstChild); }
    return e
  }

  function removeChildrenAndAdd(parent, e) {
    return removeChildren(parent).appendChild(e)
  }

  function elt(tag, content, className, style) {
    var e = document.createElement(tag);
    if (className) { e.className = className; }
    if (style) { e.style.cssText = style; }
    if (typeof content == "string") { e.appendChild(document.createTextNode(content)); }
    else if (content) { for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]); } }
    return e
  }
  // wrapper for elt, which removes the elt from the accessibility tree
  function eltP(tag, content, className, style) {
    var e = elt(tag, content, className, style);
    e.setAttribute("role", "presentation");
    return e
  }

  var range;
  if (document.createRange) { range = function(node, start, end, endNode) {
    var r = document.createRange();
    r.setEnd(endNode || node, end);
    r.setStart(node, start);
    return r
  }; }
  else { range = function(node, start, end) {
    var r = document.body.createTextRange();
    try { r.moveToElementText(node.parentNode); }
    catch(e) { return r }
    r.collapse(true);
    r.moveEnd("character", end);
    r.moveStart("character", start);
    return r
  }; }

  function contains(parent, child) {
    if (child.nodeType == 3) // Android browser always returns false when child is a textnode
      { child = child.parentNode; }
    if (parent.contains)
      { return parent.contains(child) }
    do {
      if (child.nodeType == 11) { child = child.host; }
      if (child == parent) { return true }
    } while (child = child.parentNode)
  }

  function activeElt() {
    // IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
    // IE < 10 will throw when accessed while the page is loading or in an iframe.
    // IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
    var activeElement;
    try {
      activeElement = document.activeElement;
    } catch(e) {
      activeElement = document.body || null;
    }
    while (activeElement && activeElement.shadowRoot && activeElement.shadowRoot.activeElement)
      { activeElement = activeElement.shadowRoot.activeElement; }
    return activeElement
  }

  function addClass(node, cls) {
    var current = node.className;
    if (!classTest(cls).test(current)) { node.className += (current ? " " : "") + cls; }
  }
  function joinClasses(a, b) {
    var as = a.split(" ");
    for (var i = 0; i < as.length; i++)
      { if (as[i] && !classTest(as[i]).test(b)) { b += " " + as[i]; } }
    return b
  }

  var selectInput = function(node) { node.select(); };
  if (ios) // Mobile Safari apparently has a bug where select() is broken.
    { selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length; }; }
  else if (ie) // Suppress mysterious IE10 errors
    { selectInput = function(node) { try { node.select(); } catch(_e) {} }; }

  function bind(f) {
    var args = Array.prototype.slice.call(arguments, 1);
    return function(){return f.apply(null, args)}
  }

  function copyObj(obj, target, overwrite) {
    if (!target) { target = {}; }
    for (var prop in obj)
      { if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
        { target[prop] = obj[prop]; } }
    return target
  }

  // Counts the column offset in a string, taking tabs into account.
  // Used mostly to find indentation.
  function countColumn(string, end, tabSize, startIndex, startValue) {
    if (end == null) {
      end = string.search(/[^\s\u00a0]/);
      if (end == -1) { end = string.length; }
    }
    for (var i = startIndex || 0, n = startValue || 0;;) {
      var nextTab = string.indexOf("\t", i);
      if (nextTab < 0 || nextTab >= end)
        { return n + (end - i) }
      n += nextTab - i;
      n += tabSize - (n % tabSize);
      i = nextTab + 1;
    }
  }

  var Delayed = function() {
    this.id = null;
    this.f = null;
    this.time = 0;
    this.handler = bind(this.onTimeout, this);
  };
  Delayed.prototype.onTimeout = function (self) {
    self.id = 0;
    if (self.time <= +new Date) {
      self.f();
    } else {
      setTimeout(self.handler, self.time - +new Date);
    }
  };
  Delayed.prototype.set = function (ms, f) {
    this.f = f;
    var time = +new Date + ms;
    if (!this.id || time < this.time) {
      clearTimeout(this.id);
      this.id = setTimeout(this.handler, ms);
      this.time = time;
    }
  };

  function indexOf(array, elt) {
    for (var i = 0; i < array.length; ++i)
      { if (array[i] == elt) { return i } }
    return -1
  }

  // Number of pixels added to scroller and sizer to hide scrollbar
  var scrollerGap = 50;

  // Returned or thrown by various protocols to signal 'I'm not
  // handling this'.
  var Pass = {toString: function(){return "CodeMirror.Pass"}};

  // Reused option objects for setSelection & friends
  var sel_dontScroll = {scroll: false}, sel_mouse = {origin: "*mouse"}, sel_move = {origin: "+move"};

  // The inverse of countColumn -- find the offset that corresponds to
  // a particular column.
  function findColumn(string, goal, tabSize) {
    for (var pos = 0, col = 0;;) {
      var nextTab = string.indexOf("\t", pos);
      if (nextTab == -1) { nextTab = string.length; }
      var skipped = nextTab - pos;
      if (nextTab == string.length || col + skipped >= goal)
        { return pos + Math.min(skipped, goal - col) }
      col += nextTab - pos;
      col += tabSize - (col % tabSize);
      pos = nextTab + 1;
      if (col >= goal) { return pos }
    }
  }

  var spaceStrs = [""];
  function spaceStr(n) {
    while (spaceStrs.length <= n)
      { spaceStrs.push(lst(spaceStrs) + " "); }
    return spaceStrs[n]
  }

  function lst(arr) { return arr[arr.length-1] }

  function map(array, f) {
    var out = [];
    for (var i = 0; i < array.length; i++) { out[i] = f(array[i], i); }
    return out
  }

  function insertSorted(array, value, score) {
    var pos = 0, priority = score(value);
    while (pos < array.length && score(array[pos]) <= priority) { pos++; }
    array.splice(pos, 0, value);
  }

  function nothing() {}

  function createObj(base, props) {
    var inst;
    if (Object.create) {
      inst = Object.create(base);
    } else {
      nothing.prototype = base;
      inst = new nothing();
    }
    if (props) { copyObj(props, inst); }
    return inst
  }

  var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;
  function isWordCharBasic(ch) {
    return /\w/.test(ch) || ch > "\x80" &&
      (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
  }
  function isWordChar(ch, helper) {
    if (!helper) { return isWordCharBasic(ch) }
    if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) { return true }
    return helper.test(ch)
  }

  function isEmpty(obj) {
    for (var n in obj) { if (obj.hasOwnProperty(n) && obj[n]) { return false } }
    return true
  }

  // Extending unicode characters. A series of a non-extending char +
  // any number of extending chars is treated as a single unit as far
  // as editing and measuring is concerned. This is not fully correct,
  // since some scripts/fonts/browsers also treat other configurations
  // of code points as a group.
  var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;
  function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }

  // Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
  function skipExtendingChars(str, pos, dir) {
    while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) { pos += dir; }
    return pos
  }

  // Returns the value from the range [`from`; `to`] that satisfies
  // `pred` and is closest to `from`. Assumes that at least `to`
  // satisfies `pred`. Supports `from` being greater than `to`.
  function findFirst(pred, from, to) {
    // At any point we are certain `to` satisfies `pred`, don't know
    // whether `from` does.
    var dir = from > to ? -1 : 1;
    for (;;) {
      if (from == to) { return from }
      var midF = (from + to) / 2, mid = dir < 0 ? Math.ceil(midF) : Math.floor(midF);
      if (mid == from) { return pred(mid) ? from : to }
      if (pred(mid)) { to = mid; }
      else { from = mid + dir; }
    }
  }

  // BIDI HELPERS

  function iterateBidiSections(order, from, to, f) {
    if (!order) { return f(from, to, "ltr", 0) }
    var found = false;
    for (var i = 0; i < order.length; ++i) {
      var part = order[i];
      if (part.from < to && part.to > from || from == to && part.to == from) {
        f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr", i);
        found = true;
      }
    }
    if (!found) { f(from, to, "ltr"); }
  }

  var bidiOther = null;
  function getBidiPartAt(order, ch, sticky) {
    var found;
    bidiOther = null;
    for (var i = 0; i < order.length; ++i) {
      var cur = order[i];
      if (cur.from < ch && cur.to > ch) { return i }
      if (cur.to == ch) {
        if (cur.from != cur.to && sticky == "before") { found = i; }
        else { bidiOther = i; }
      }
      if (cur.from == ch) {
        if (cur.from != cur.to && sticky != "before") { found = i; }
        else { bidiOther = i; }
      }
    }
    return found != null ? found : bidiOther
  }

  // Bidirectional ordering algorithm
  // See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
  // that this (partially) implements.

  // One-char codes used for character types:
  // L (L):   Left-to-Right
  // R (R):   Right-to-Left
  // r (AL):  Right-to-Left Arabic
  // 1 (EN):  European Number
  // + (ES):  European Number Separator
  // % (ET):  European Number Terminator
  // n (AN):  Arabic Number
  // , (CS):  Common Number Separator
  // m (NSM): Non-Spacing Mark
  // b (BN):  Boundary Neutral
  // s (B):   Paragraph Separator
  // t (S):   Segment Separator
  // w (WS):  Whitespace
  // N (ON):  Other Neutrals

  // Returns null if characters are ordered as they appear
  // (left-to-right), or an array of sections ({from, to, level}
  // objects) in the order in which they occur visually.
  var bidiOrdering = (function() {
    // Character types for codepoints 0 to 0xff
    var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN";
    // Character types for codepoints 0x600 to 0x6f9
    var arabicTypes = "nnnnnnNNr%%r,rNNmmmmmmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmmmnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmnNmmmmmmrrmmNmmmmrr1111111111";
    function charType(code) {
      if (code <= 0xf7) { return lowTypes.charAt(code) }
      else if (0x590 <= code && code <= 0x5f4) { return "R" }
      else if (0x600 <= code && code <= 0x6f9) { return arabicTypes.charAt(code - 0x600) }
      else if (0x6ee <= code && code <= 0x8ac) { return "r" }
      else if (0x2000 <= code && code <= 0x200b) { return "w" }
      else if (code == 0x200c) { return "b" }
      else { return "L" }
    }

    var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/;
    var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/;

    function BidiSpan(level, from, to) {
      this.level = level;
      this.from = from; this.to = to;
    }

    return function(str, direction) {
      var outerType = direction == "ltr" ? "L" : "R";

      if (str.length == 0 || direction == "ltr" && !bidiRE.test(str)) { return false }
      var len = str.length, types = [];
      for (var i = 0; i < len; ++i)
        { types.push(charType(str.charCodeAt(i))); }

      // W1. Examine each non-spacing mark (NSM) in the level run, and
      // change the type of the NSM to the type of the previous
      // character. If the NSM is at the start of the level run, it will
      // get the type of sor.
      for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
        var type = types[i$1];
        if (type == "m") { types[i$1] = prev; }
        else { prev = type; }
      }

      // W2. Search backwards from each instance of a European number
      // until the first strong type (R, L, AL, or sor) is found. If an
      // AL is found, change the type of the European number to Arabic
      // number.
      // W3. Change all ALs to R.
      for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
        var type$1 = types[i$2];
        if (type$1 == "1" && cur == "r") { types[i$2] = "n"; }
        else if (isStrong.test(type$1)) { cur = type$1; if (type$1 == "r") { types[i$2] = "R"; } }
      }

      // W4. A single European separator between two European numbers
      // changes to a European number. A single common separator between
      // two numbers of the same type changes to that type.
      for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
        var type$2 = types[i$3];
        if (type$2 == "+" && prev$1 == "1" && types[i$3+1] == "1") { types[i$3] = "1"; }
        else if (type$2 == "," && prev$1 == types[i$3+1] &&
                 (prev$1 == "1" || prev$1 == "n")) { types[i$3] = prev$1; }
        prev$1 = type$2;
      }

      // W5. A sequence of European terminators adjacent to European
      // numbers changes to all European numbers.
      // W6. Otherwise, separators and terminators change to Other
      // Neutral.
      for (var i$4 = 0; i$4 < len; ++i$4) {
        var type$3 = types[i$4];
        if (type$3 == ",") { types[i$4] = "N"; }
        else if (type$3 == "%") {
          var end = (void 0);
          for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}
          var replace = (i$4 && types[i$4-1] == "!") || (end < len && types[end] == "1") ? "1" : "N";
          for (var j = i$4; j < end; ++j) { types[j] = replace; }
          i$4 = end - 1;
        }
      }

      // W7. Search backwards from each instance of a European number
      // until the first strong type (R, L, or sor) is found. If an L is
      // found, then change the type of the European number to L.
      for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
        var type$4 = types[i$5];
        if (cur$1 == "L" && type$4 == "1") { types[i$5] = "L"; }
        else if (isStrong.test(type$4)) { cur$1 = type$4; }
      }

      // N1. A sequence of neutrals takes the direction of the
      // surrounding strong text if the text on both sides has the same
      // direction. European and Arabic numbers act as if they were R in
      // terms of their influence on neutrals. Start-of-level-run (sor)
      // and end-of-level-run (eor) are used at level run boundaries.
      // N2. Any remaining neutrals take the embedding direction.
      for (var i$6 = 0; i$6 < len; ++i$6) {
        if (isNeutral.test(types[i$6])) {
          var end$1 = (void 0);
          for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}
          var before = (i$6 ? types[i$6-1] : outerType) == "L";
          var after = (end$1 < len ? types[end$1] : outerType) == "L";
          var replace$1 = before == after ? (before ? "L" : "R") : outerType;
          for (var j$1 = i$6; j$1 < end$1; ++j$1) { types[j$1] = replace$1; }
          i$6 = end$1 - 1;
        }
      }

      // Here we depart from the documented algorithm, in order to avoid
      // building up an actual levels array. Since there are only three
      // levels (0, 1, 2) in an implementation that doesn't take
      // explicit embedding into account, we can build up the order on
      // the fly, without following the level-based algorithm.
      var order = [], m;
      for (var i$7 = 0; i$7 < len;) {
        if (countsAsLeft.test(types[i$7])) {
          var start = i$7;
          for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}
          order.push(new BidiSpan(0, start, i$7));
        } else {
          var pos = i$7, at = order.length, isRTL = direction == "rtl" ? 1 : 0;
          for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}
          for (var j$2 = pos; j$2 < i$7;) {
            if (countsAsNum.test(types[j$2])) {
              if (pos < j$2) { order.splice(at, 0, new BidiSpan(1, pos, j$2)); at += isRTL; }
              var nstart = j$2;
              for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}
              order.splice(at, 0, new BidiSpan(2, nstart, j$2));
              at += isRTL;
              pos = j$2;
            } else { ++j$2; }
          }
          if (pos < i$7) { order.splice(at, 0, new BidiSpan(1, pos, i$7)); }
        }
      }
      if (direction == "ltr") {
        if (order[0].level == 1 && (m = str.match(/^\s+/))) {
          order[0].from = m[0].length;
          order.unshift(new BidiSpan(0, 0, m[0].length));
        }
        if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
          lst(order).to -= m[0].length;
          order.push(new BidiSpan(0, len - m[0].length, len));
        }
      }

      return direction == "rtl" ? order.reverse() : order
    }
  })();

  // Get the bidi ordering for the given line (and cache it). Returns
  // false for lines that are fully left-to-right, and an array of
  // BidiSpan objects otherwise.
  function getOrder(line, direction) {
    var order = line.order;
    if (order == null) { order = line.order = bidiOrdering(line.text, direction); }
    return order
  }

  // EVENT HANDLING

  // Lightweight event framework. on/off also work on DOM nodes,
  // registering native DOM handlers.

  var noHandlers = [];

  var on = function(emitter, type, f) {
    if (emitter.addEventListener) {
      emitter.addEventListener(type, f, false);
    } else if (emitter.attachEvent) {
      emitter.attachEvent("on" + type, f);
    } else {
      var map = emitter._handlers || (emitter._handlers = {});
      map[type] = (map[type] || noHandlers).concat(f);
    }
  };

  function getHandlers(emitter, type) {
    return emitter._handlers && emitter._handlers[type] || noHandlers
  }

  function off(emitter, type, f) {
    if (emitter.removeEventListener) {
      emitter.removeEventListener(type, f, false);
    } else if (emitter.detachEvent) {
      emitter.detachEvent("on" + type, f);
    } else {
      var map = emitter._handlers, arr = map && map[type];
      if (arr) {
        var index = indexOf(arr, f);
        if (index > -1)
          { map[type] = arr.slice(0, index).concat(arr.slice(index + 1)); }
      }
    }
  }

  function signal(emitter, type /*, values...*/) {
    var handlers = getHandlers(emitter, type);
    if (!handlers.length) { return }
    var args = Array.prototype.slice.call(arguments, 2);
    for (var i = 0; i < handlers.length; ++i) { handlers[i].apply(null, args); }
  }

  // The DOM events that CodeMirror handles can be overridden by
  // registering a (non-DOM) handler on the editor for the event name,
  // and preventDefault-ing the event in that handler.
  function signalDOMEvent(cm, e, override) {
    if (typeof e == "string")
      { e = {type: e, preventDefault: function() { this.defaultPrevented = true; }}; }
    signal(cm, override || e.type, cm, e);
    return e_defaultPrevented(e) || e.codemirrorIgnore
  }

  function signalCursorActivity(cm) {
    var arr = cm._handlers && cm._handlers.cursorActivity;
    if (!arr) { return }
    var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = []);
    for (var i = 0; i < arr.length; ++i) { if (indexOf(set, arr[i]) == -1)
      { set.push(arr[i]); } }
  }

  function hasHandler(emitter, type) {
    return getHandlers(emitter, type).length > 0
  }

  // Add on and off methods to a constructor's prototype, to make
  // registering events on such objects more convenient.
  function eventMixin(ctor) {
    ctor.prototype.on = function(type, f) {on(this, type, f);};
    ctor.prototype.off = function(type, f) {off(this, type, f);};
  }

  // Due to the fact that we still support jurassic IE versions, some
  // compatibility wrappers are needed.

  function e_preventDefault(e) {
    if (e.preventDefault) { e.preventDefault(); }
    else { e.returnValue = false; }
  }
  function e_stopPropagation(e) {
    if (e.stopPropagation) { e.stopPropagation(); }
    else { e.cancelBubble = true; }
  }
  function e_defaultPrevented(e) {
    return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false
  }
  function e_stop(e) {e_preventDefault(e); e_stopPropagation(e);}

  function e_target(e) {return e.target || e.srcElement}
  function e_button(e) {
    var b = e.which;
    if (b == null) {
      if (e.button & 1) { b = 1; }
      else if (e.button & 2) { b = 3; }
      else if (e.button & 4) { b = 2; }
    }
    if (mac && e.ctrlKey && b == 1) { b = 3; }
    return b
  }

  // Detect drag-and-drop
  var dragAndDrop = function() {
    // There is *some* kind of drag-and-drop support in IE6-8, but I
    // couldn't get it to work yet.
    if (ie && ie_version < 9) { return false }
    var div = elt('div');
    return "draggable" in div || "dragDrop" in div
  }();

  var zwspSupported;
  function zeroWidthElement(measure) {
    if (zwspSupported == null) {
      var test = elt("span", "\u200b");
      removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]));
      if (measure.firstChild.offsetHeight != 0)
        { zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8); }
    }
    var node = zwspSupported ? elt("span", "\u200b") :
      elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px");
    node.setAttribute("cm-text", "");
    return node
  }

  // Feature-detect IE's crummy client rect reporting for bidi text
  var badBidiRects;
  function hasBadBidiRects(measure) {
    if (badBidiRects != null) { return badBidiRects }
    var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"));
    var r0 = range(txt, 0, 1).getBoundingClientRect();
    var r1 = range(txt, 1, 2).getBoundingClientRect();
    removeChildren(measure);
    if (!r0 || r0.left == r0.right) { return false } // Safari returns null in some cases (#2780)
    return badBidiRects = (r1.right - r0.right < 3)
  }

  // See if "".split is the broken IE version, if so, provide an
  // alternative way to split lines.
  var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
    var pos = 0, result = [], l = string.length;
    while (pos <= l) {
      var nl = string.indexOf("\n", pos);
      if (nl == -1) { nl = string.length; }
      var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
      var rt = line.indexOf("\r");
      if (rt != -1) {
        result.push(line.slice(0, rt));
        pos += rt + 1;
      } else {
        result.push(line);
        pos = nl + 1;
      }
    }
    return result
  } : function (string) { return string.split(/\r\n?|\n/); };

  var hasSelection = window.getSelection ? function (te) {
    try { return te.selectionStart != te.selectionEnd }
    catch(e) { return false }
  } : function (te) {
    var range;
    try {range = te.ownerDocument.selection.createRange();}
    catch(e) {}
    if (!range || range.parentElement() != te) { return false }
    return range.compareEndPoints("StartToEnd", range) != 0
  };

  var hasCopyEvent = (function () {
    var e = elt("div");
    if ("oncopy" in e) { return true }
    e.setAttribute("oncopy", "return;");
    return typeof e.oncopy == "function"
  })();

  var badZoomedRects = null;
  function hasBadZoomedRects(measure) {
    if (badZoomedRects != null) { return badZoomedRects }
    var node = removeChildrenAndAdd(measure, elt("span", "x"));
    var normal = node.getBoundingClientRect();
    var fromRange = range(node, 0, 1).getBoundingClientRect();
    return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1
  }

  // Known modes, by name and by MIME
  var modes = {}, mimeModes = {};

  // Extra arguments are stored as the mode's dependencies, which is
  // used by (legacy) mechanisms like loadmode.js to automatically
  // load a mode. (Preferred mechanism is the require/define calls.)
  function defineMode(name, mode) {
    if (arguments.length > 2)
      { mode.dependencies = Array.prototype.slice.call(arguments, 2); }
    modes[name] = mode;
  }

  function defineMIME(mime, spec) {
    mimeModes[mime] = spec;
  }

  // Given a MIME type, a {name, ...options} config object, or a name
  // string, return a mode config object.
  function resolveMode(spec) {
    if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
      spec = mimeModes[spec];
    } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
      var found = mimeModes[spec.name];
      if (typeof found == "string") { found = {name: found}; }
      spec = createObj(found, spec);
      spec.name = found.name;
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
      return resolveMode("application/xml")
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
      return resolveMode("application/json")
    }
    if (typeof spec == "string") { return {name: spec} }
    else { return spec || {name: "null"} }
  }

  // Given a mode spec (anything that resolveMode accepts), find and
  // initialize an actual mode object.
  function getMode(options, spec) {
    spec = resolveMode(spec);
    var mfactory = modes[spec.name];
    if (!mfactory) { return getMode(options, "text/plain") }
    var modeObj = mfactory(options, spec);
    if (modeExtensions.hasOwnProperty(spec.name)) {
      var exts = modeExtensions[spec.name];
      for (var prop in exts) {
        if (!exts.hasOwnProperty(prop)) { continue }
        if (modeObj.hasOwnProperty(prop)) { modeObj["_" + prop] = modeObj[prop]; }
        modeObj[prop] = exts[prop];
      }
    }
    modeObj.name = spec.name;
    if (spec.helperType) { modeObj.helperType = spec.helperType; }
    if (spec.modeProps) { for (var prop$1 in spec.modeProps)
      { modeObj[prop$1] = spec.modeProps[prop$1]; } }

    return modeObj
  }

  // This can be used to attach properties to mode objects from
  // outside the actual mode definition.
  var modeExtensions = {};
  function extendMode(mode, properties) {
    var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
    copyObj(properties, exts);
  }

  function copyState(mode, state) {
    if (state === true) { return state }
    if (mode.copyState) { return mode.copyState(state) }
    var nstate = {};
    for (var n in state) {
      var val = state[n];
      if (val instanceof Array) { val = val.concat([]); }
      nstate[n] = val;
    }
    return nstate
  }

  // Given a mode and a state (for that mode), find the inner mode and
  // state at the position that the state refers to.
  function innerMode(mode, state) {
    var info;
    while (mode.innerMode) {
      info = mode.innerMode(state);
      if (!info || info.mode == mode) { break }
      state = info.state;
      mode = info.mode;
    }
    return info || {mode: mode, state: state}
  }

  function startState(mode, a1, a2) {
    return mode.startState ? mode.startState(a1, a2) : true
  }

  // STRING STREAM

  // Fed to the mode parsers, provides helper functions to make
  // parsers more succinct.

  var StringStream = function(string, tabSize, lineOracle) {
    this.pos = this.start = 0;
    this.string = string;
    this.tabSize = tabSize || 8;
    this.lastColumnPos = this.lastColumnValue = 0;
    this.lineStart = 0;
    this.lineOracle = lineOracle;
  };

  StringStream.prototype.eol = function () {return this.pos >= this.string.length};
  StringStream.prototype.sol = function () {return this.pos == this.lineStart};
  StringStream.prototype.peek = function () {return this.string.charAt(this.pos) || undefined};
  StringStream.prototype.next = function () {
    if (this.pos < this.string.length)
      { return this.string.charAt(this.pos++) }
  };
  StringStream.prototype.eat = function (match) {
    var ch = this.string.charAt(this.pos);
    var ok;
    if (typeof match == "string") { ok = ch == match; }
    else { ok = ch && (match.test ? match.test(ch) : match(ch)); }
    if (ok) {++this.pos; return ch}
  };
  StringStream.prototype.eatWhile = function (match) {
    var start = this.pos;
    while (this.eat(match)){}
    return this.pos > start
  };
  StringStream.prototype.eatSpace = function () {
    var start = this.pos;
    while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this.pos; }
    return this.pos > start
  };
  StringStream.prototype.skipToEnd = function () {this.pos = this.string.length;};
  StringStream.prototype.skipTo = function (ch) {
    var found = this.string.indexOf(ch, this.pos);
    if (found > -1) {this.pos = found; return true}
  };
  StringStream.prototype.backUp = function (n) {this.pos -= n;};
  StringStream.prototype.column = function () {
    if (this.lastColumnPos < this.start) {
      this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue);
      this.lastColumnPos = this.start;
    }
    return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
  };
  StringStream.prototype.indentation = function () {
    return countColumn(this.string, null, this.tabSize) -
      (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
  };
  StringStream.prototype.match = function (pattern, consume, caseInsensitive) {
    if (typeof pattern == "string") {
      var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; };
      var substr = this.string.substr(this.pos, pattern.length);
      if (cased(substr) == cased(pattern)) {
        if (consume !== false) { this.pos += pattern.length; }
        return true
      }
    } else {
      var match = this.string.slice(this.pos).match(pattern);
      if (match && match.index > 0) { return null }
      if (match && consume !== false) { this.pos += match[0].length; }
      return match
    }
  };
  StringStream.prototype.current = function (){return this.string.slice(this.start, this.pos)};
  StringStream.prototype.hideFirstChars = function (n, inner) {
    this.lineStart += n;
    try { return inner() }
    finally { this.lineStart -= n; }
  };
  StringStream.prototype.lookAhead = function (n) {
    var oracle = this.lineOracle;
    return oracle && oracle.lookAhead(n)
  };
  StringStream.prototype.baseToken = function () {
    var oracle = this.lineOracle;
    return oracle && oracle.baseToken(this.pos)
  };

  // Find the line object corresponding to the given line number.
  function getLine(doc, n) {
    n -= doc.first;
    if (n < 0 || n >= doc.size) { throw new Error("There is no line " + (n + doc.first) + " in the document.") }
    var chunk = doc;
    while (!chunk.lines) {
      for (var i = 0;; ++i) {
        var child = chunk.children[i], sz = child.chunkSize();
        if (n < sz) { chunk = child; break }
        n -= sz;
      }
    }
    return chunk.lines[n]
  }

  // Get the part of a document between two positions, as an array of
  // strings.
  function getBetween(doc, start, end) {
    var out = [], n = start.line;
    doc.iter(start.line, end.line + 1, function (line) {
      var text = line.text;
      if (n == end.line) { text = text.slice(0, end.ch); }
      if (n == start.line) { text = text.slice(start.ch); }
      out.push(text);
      ++n;
    });
    return out
  }
  // Get the lines between from and to, as array of strings.
  function getLines(doc, from, to) {
    var out = [];
    doc.iter(from, to, function (line) { out.push(line.text); }); // iter aborts when callback returns truthy value
    return out
  }

  // Update the height of a line, propagating the height change
  // upwards to parent nodes.
  function updateLineHeight(line, height) {
    var diff = height - line.height;
    if (diff) { for (var n = line; n; n = n.parent) { n.height += diff; } }
  }

  // Given a line object, find its line number by walking up through
  // its parent links.
  function lineNo(line) {
    if (line.parent == null) { return null }
    var cur = line.parent, no = indexOf(cur.lines, line);
    for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
      for (var i = 0;; ++i) {
        if (chunk.children[i] == cur) { break }
        no += chunk.children[i].chunkSize();
      }
    }
    return no + cur.first
  }

  // Find the line at the given vertical position, using the height
  // information in the document tree.
  function lineAtHeight(chunk, h) {
    var n = chunk.first;
    outer: do {
      for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
        var child = chunk.children[i$1], ch = child.height;
        if (h < ch) { chunk = child; continue outer }
        h -= ch;
        n += child.chunkSize();
      }
      return n
    } while (!chunk.lines)
    var i = 0;
    for (; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i], lh = line.height;
      if (h < lh) { break }
      h -= lh;
    }
    return n + i
  }

  function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size}

  function lineNumberFor(options, i) {
    return String(options.lineNumberFormatter(i + options.firstLineNumber))
  }

  // A Pos instance represents a position within the text.
  function Pos(line, ch, sticky) {
    if ( sticky === void 0 ) sticky = null;

    if (!(this instanceof Pos)) { return new Pos(line, ch, sticky) }
    this.line = line;
    this.ch = ch;
    this.sticky = sticky;
  }

  // Compare two positions, return 0 if they are the same, a negative
  // number when a is less, and a positive number otherwise.
  function cmp(a, b) { return a.line - b.line || a.ch - b.ch }

  function equalCursorPos(a, b) { return a.sticky == b.sticky && cmp(a, b) == 0 }

  function copyPos(x) {return Pos(x.line, x.ch)}
  function maxPos(a, b) { return cmp(a, b) < 0 ? b : a }
  function minPos(a, b) { return cmp(a, b) < 0 ? a : b }

  // Most of the external API clips given positions to make sure they
  // actually exist within the document.
  function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1))}
  function clipPos(doc, pos) {
    if (pos.line < doc.first) { return Pos(doc.first, 0) }
    var last = doc.first + doc.size - 1;
    if (pos.line > last) { return Pos(last, getLine(doc, last).text.length) }
    return clipToLen(pos, getLine(doc, pos.line).text.length)
  }
  function clipToLen(pos, linelen) {
    var ch = pos.ch;
    if (ch == null || ch > linelen) { return Pos(pos.line, linelen) }
    else if (ch < 0) { return Pos(pos.line, 0) }
    else { return pos }
  }
  function clipPosArray(doc, array) {
    var out = [];
    for (var i = 0; i < array.length; i++) { out[i] = clipPos(doc, array[i]); }
    return out
  }

  var SavedContext = function(state, lookAhead) {
    this.state = state;
    this.lookAhead = lookAhead;
  };

  var Context = function(doc, state, line, lookAhead) {
    this.state = state;
    this.doc = doc;
    this.line = line;
    this.maxLookAhead = lookAhead || 0;
    this.baseTokens = null;
    this.baseTokenPos = 1;
  };

  Context.prototype.lookAhead = function (n) {
    var line = this.doc.getLine(this.line + n);
    if (line != null && n > this.maxLookAhead) { this.maxLookAhead = n; }
    return line
  };

  Context.prototype.baseToken = function (n) {
    if (!this.baseTokens) { return null }
    while (this.baseTokens[this.baseTokenPos] <= n)
      { this.baseTokenPos += 2; }
    var type = this.baseTokens[this.baseTokenPos + 1];
    return {type: type && type.replace(/( |^)overlay .*/, ""),
            size: this.baseTokens[this.baseTokenPos] - n}
  };

  Context.prototype.nextLine = function () {
    this.line++;
    if (this.maxLookAhead > 0) { this.maxLookAhead--; }
  };

  Context.fromSaved = function (doc, saved, line) {
    if (saved instanceof SavedContext)
      { return new Context(doc, copyState(doc.mode, saved.state), line, saved.lookAhead) }
    else
      { return new Context(doc, copyState(doc.mode, saved), line) }
  };

  Context.prototype.save = function (copy) {
    var state = copy !== false ? copyState(this.doc.mode, this.state) : this.state;
    return this.maxLookAhead > 0 ? new SavedContext(state, this.maxLookAhead) : state
  };


  // Compute a style array (an array starting with a mode generation
  // -- for invalidation -- followed by pairs of end positions and
  // style strings), which is used to highlight the tokens on the
  // line.
  function highlightLine(cm, line, context, forceToEnd) {
    // A styles array always starts with a number identifying the
    // mode/overlays that it is based on (for easy invalidation).
    var st = [cm.state.modeGen], lineClasses = {};
    // Compute the base array of styles
    runMode(cm, line.text, cm.doc.mode, context, function (end, style) { return st.push(end, style); },
            lineClasses, forceToEnd);
    var state = context.state;

    // Run overlays, adjust style array.
    var loop = function ( o ) {
      context.baseTokens = st;
      var overlay = cm.state.overlays[o], i = 1, at = 0;
      context.state = true;
      runMode(cm, line.text, overlay.mode, context, function (end, style) {
        var start = i;
        // Ensure there's a token end at the current position, and that i points at it
        while (at < end) {
          var i_end = st[i];
          if (i_end > end)
            { st.splice(i, 1, end, st[i+1], i_end); }
          i += 2;
          at = Math.min(end, i_end);
        }
        if (!style) { return }
        if (overlay.opaque) {
          st.splice(start, i - start, end, "overlay " + style);
          i = start + 2;
        } else {
          for (; start < i; start += 2) {
            var cur = st[start+1];
            st[start+1] = (cur ? cur + " " : "") + "overlay " + style;
          }
        }
      }, lineClasses);
      context.state = state;
      context.baseTokens = null;
      context.baseTokenPos = 1;
    };

    for (var o = 0; o < cm.state.overlays.length; ++o) loop( o );

    return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null}
  }

  function getLineStyles(cm, line, updateFrontier) {
    if (!line.styles || line.styles[0] != cm.state.modeGen) {
      var context = getContextBefore(cm, lineNo(line));
      var resetState = line.text.length > cm.options.maxHighlightLength && copyState(cm.doc.mode, context.state);
      var result = highlightLine(cm, line, context);
      if (resetState) { context.state = resetState; }
      line.stateAfter = context.save(!resetState);
      line.styles = result.styles;
      if (result.classes) { line.styleClasses = result.classes; }
      else if (line.styleClasses) { line.styleClasses = null; }
      if (updateFrontier === cm.doc.highlightFrontier)
        { cm.doc.modeFrontier = Math.max(cm.doc.modeFrontier, ++cm.doc.highlightFrontier); }
    }
    return line.styles
  }

  function getContextBefore(cm, n, precise) {
    var doc = cm.doc, display = cm.display;
    if (!doc.mode.startState) { return new Context(doc, true, n) }
    var start = findStartLine(cm, n, precise);
    var saved = start > doc.first && getLine(doc, start - 1).stateAfter;
    var context = saved ? Context.fromSaved(doc, saved, start) : new Context(doc, startState(doc.mode), start);

    doc.iter(start, n, function (line) {
      processLine(cm, line.text, context);
      var pos = context.line;
      line.stateAfter = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo ? context.save() : null;
      context.nextLine();
    });
    if (precise) { doc.modeFrontier = context.line; }
    return context
  }

  // Lightweight form of highlight -- proceed over this line and
  // update state, but don't save a style array. Used for lines that
  // aren't currently visible.
  function processLine(cm, text, context, startAt) {
    var mode = cm.doc.mode;
    var stream = new StringStream(text, cm.options.tabSize, context);
    stream.start = stream.pos = startAt || 0;
    if (text == "") { callBlankLine(mode, context.state); }
    while (!stream.eol()) {
      readToken(mode, stream, context.state);
      stream.start = stream.pos;
    }
  }

  function callBlankLine(mode, state) {
    if (mode.blankLine) { return mode.blankLine(state) }
    if (!mode.innerMode) { return }
    var inner = innerMode(mode, state);
    if (inner.mode.blankLine) { return inner.mode.blankLine(inner.state) }
  }

  function readToken(mode, stream, state, inner) {
    for (var i = 0; i < 10; i++) {
      if (inner) { inner[0] = innerMode(mode, state).mode; }
      var style = mode.token(stream, state);
      if (stream.pos > stream.start) { return style }
    }
    throw new Error("Mode " + mode.name + " failed to advance stream.")
  }

  var Token = function(stream, type, state) {
    this.start = stream.start; this.end = stream.pos;
    this.string = stream.current();
    this.type = type || null;
    this.state = state;
  };

  // Utility for getTokenAt and getLineTokens
  function takeToken(cm, pos, precise, asArray) {
    var doc = cm.doc, mode = doc.mode, style;
    pos = clipPos(doc, pos);
    var line = getLine(doc, pos.line), context = getContextBefore(cm, pos.line, precise);
    var stream = new StringStream(line.text, cm.options.tabSize, context), tokens;
    if (asArray) { tokens = []; }
    while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
      stream.start = stream.pos;
      style = readToken(mode, stream, context.state);
      if (asArray) { tokens.push(new Token(stream, style, copyState(doc.mode, context.state))); }
    }
    return asArray ? tokens : new Token(stream, style, context.state)
  }

  function extractLineClasses(type, output) {
    if (type) { for (;;) {
      var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/);
      if (!lineClass) { break }
      type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length);
      var prop = lineClass[1] ? "bgClass" : "textClass";
      if (output[prop] == null)
        { output[prop] = lineClass[2]; }
      else if (!(new RegExp("(?:^|\\s)" + lineClass[2] + "(?:$|\\s)")).test(output[prop]))
        { output[prop] += " " + lineClass[2]; }
    } }
    return type
  }

  // Run the given mode's parser over a line, calling f for each token.
  function runMode(cm, text, mode, context, f, lineClasses, forceToEnd) {
    var flattenSpans = mode.flattenSpans;
    if (flattenSpans == null) { flattenSpans = cm.options.flattenSpans; }
    var curStart = 0, curStyle = null;
    var stream = new StringStream(text, cm.options.tabSize, context), style;
    var inner = cm.options.addModeClass && [null];
    if (text == "") { extractLineClasses(callBlankLine(mode, context.state), lineClasses); }
    while (!stream.eol()) {
      if (stream.pos > cm.options.maxHighlightLength) {
        flattenSpans = false;
        if (forceToEnd) { processLine(cm, text, context, stream.pos); }
        stream.pos = text.length;
        style = null;
      } else {
        style = extractLineClasses(readToken(mode, stream, context.state, inner), lineClasses);
      }
      if (inner) {
        var mName = inner[0].name;
        if (mName) { style = "m-" + (style ? mName + " " + style : mName); }
      }
      if (!flattenSpans || curStyle != style) {
        while (curStart < stream.start) {
          curStart = Math.min(stream.start, curStart + 5000);
          f(curStart, curStyle);
        }
        curStyle = style;
      }
      stream.start = stream.pos;
    }
    while (curStart < stream.pos) {
      // Webkit seems to refuse to render text nodes longer than 57444
      // characters, and returns inaccurate measurements in nodes
      // starting around 5000 chars.
      var pos = Math.min(stream.pos, curStart + 5000);
      f(pos, curStyle);
      curStart = pos;
    }
  }

  // Finds the line to start with when starting a parse. Tries to
  // find a line with a stateAfter, so that it can start with a
  // valid state. If that fails, it returns the line with the
  // smallest indentation, which tends to need the least context to
  // parse correctly.
  function findStartLine(cm, n, precise) {
    var minindent, minline, doc = cm.doc;
    var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100);
    for (var search = n; search > lim; --search) {
      if (search <= doc.first) { return doc.first }
      var line = getLine(doc, search - 1), after = line.stateAfter;
      if (after && (!precise || search + (after instanceof SavedContext ? after.lookAhead : 0) <= doc.modeFrontier))
        { return search }
      var indented = countColumn(line.text, null, cm.options.tabSize);
      if (minline == null || minindent > indented) {
        minline = search - 1;
        minindent = indented;
      }
    }
    return minline
  }

  function retreatFrontier(doc, n) {
    doc.modeFrontier = Math.min(doc.modeFrontier, n);
    if (doc.highlightFrontier < n - 10) { return }
    var start = doc.first;
    for (var line = n - 1; line > start; line--) {
      var saved = getLine(doc, line).stateAfter;
      // change is on 3
      // state on line 1 looked ahead 2 -- so saw 3
      // test 1 + 2 < 3 should cover this
      if (saved && (!(saved instanceof SavedContext) || line + saved.lookAhead < n)) {
        start = line + 1;
        break
      }
    }
    doc.highlightFrontier = Math.min(doc.highlightFrontier, start);
  }

  // Optimize some code when these features are not used.
  var sawReadOnlySpans = false, sawCollapsedSpans = false;

  function seeReadOnlySpans() {
    sawReadOnlySpans = true;
  }

  function seeCollapsedSpans() {
    sawCollapsedSpans = true;
  }

  // TEXTMARKER SPANS

  function MarkedSpan(marker, from, to) {
    this.marker = marker;
    this.from = from; this.to = to;
  }

  // Search an array of spans for a span matching the given marker.
  function getMarkedSpanFor(spans, marker) {
    if (spans) { for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      if (span.marker == marker) { return span }
    } }
  }

  // Remove a span from an array, returning undefined if no spans are
  // left (we don't store arrays for lines without spans).
  function removeMarkedSpan(spans, span) {
    var r;
    for (var i = 0; i < spans.length; ++i)
      { if (spans[i] != span) { (r || (r = [])).push(spans[i]); } }
    return r
  }

  // Add a span to a line.
  function addMarkedSpan(line, span, op) {
    var inThisOp = op && window.WeakSet && (op.markedSpans || (op.markedSpans = new WeakSet));
    if (inThisOp && inThisOp.has(line.markedSpans)) {
      line.markedSpans.push(span);
    } else {
      line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span];
      if (inThisOp) { inThisOp.add(line.markedSpans); }
    }
    span.marker.attachLine(line);
  }

  // Used for the algorithm that adjusts markers for a change in the
  // document. These functions cut an array of spans at a given
  // character position, returning an array of remaining chunks (or
  // undefined if nothing remains).
  function markedSpansBefore(old, startCh, isInsert) {
    var nw;
    if (old) { for (var i = 0; i < old.length; ++i) {
      var span = old[i], marker = span.marker;
      var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
      if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
        var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh)
        ;(nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to));
      }
    } }
    return nw
  }
  function markedSpansAfter(old, endCh, isInsert) {
    var nw;
    if (old) { for (var i = 0; i < old.length; ++i) {
      var span = old[i], marker = span.marker;
      var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
      if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
        var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh)
        ;(nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
                                              span.to == null ? null : span.to - endCh));
      }
    } }
    return nw
  }

  // Given a change object, compute the new set of marker spans that
  // cover the line in which the change took place. Removes spans
  // entirely within the change, reconnects spans belonging to the
  // same marker that appear on both sides of the change, and cuts off
  // spans partially within the change. Returns an array of span
  // arrays with one element for each line in (after) the change.
  function stretchSpansOverChange(doc, change) {
    if (change.full) { return null }
    var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans;
    var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans;
    if (!oldFirst && !oldLast) { return null }

    var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0;
    // Get the spans that 'stick out' on both sides
    var first = markedSpansBefore(oldFirst, startCh, isInsert);
    var last = markedSpansAfter(oldLast, endCh, isInsert);

    // Next, merge those two ends
    var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0);
    if (first) {
      // Fix up .to properties of first
      for (var i = 0; i < first.length; ++i) {
        var span = first[i];
        if (span.to == null) {
          var found = getMarkedSpanFor(last, span.marker);
          if (!found) { span.to = startCh; }
          else if (sameLine) { span.to = found.to == null ? null : found.to + offset; }
        }
      }
    }
    if (last) {
      // Fix up .from in last (or move them into first in case of sameLine)
      for (var i$1 = 0; i$1 < last.length; ++i$1) {
        var span$1 = last[i$1];
        if (span$1.to != null) { span$1.to += offset; }
        if (span$1.from == null) {
          var found$1 = getMarkedSpanFor(first, span$1.marker);
          if (!found$1) {
            span$1.from = offset;
            if (sameLine) { (first || (first = [])).push(span$1); }
          }
        } else {
          span$1.from += offset;
          if (sameLine) { (first || (first = [])).push(span$1); }
        }
      }
    }
    // Make sure we didn't create any zero-length spans
    if (first) { first = clearEmptySpans(first); }
    if (last && last != first) { last = clearEmptySpans(last); }

    var newMarkers = [first];
    if (!sameLine) {
      // Fill gap with whole-line-spans
      var gap = change.text.length - 2, gapMarkers;
      if (gap > 0 && first)
        { for (var i$2 = 0; i$2 < first.length; ++i$2)
          { if (first[i$2].to == null)
            { (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null)); } } }
      for (var i$3 = 0; i$3 < gap; ++i$3)
        { newMarkers.push(gapMarkers); }
      newMarkers.push(last);
    }
    return newMarkers
  }

  // Remove spans that are empty and don't have a clearWhenEmpty
  // option of false.
  function clearEmptySpans(spans) {
    for (var i = 0; i < spans.length; ++i) {
      var span = spans[i];
      if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
        { spans.splice(i--, 1); }
    }
    if (!spans.length) { return null }
    return spans
  }

  // Used to 'clip' out readOnly ranges when making a change.
  function removeReadOnlyRanges(doc, from, to) {
    var markers = null;
    doc.iter(from.line, to.line + 1, function (line) {
      if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
        var mark = line.markedSpans[i].marker;
        if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
          { (markers || (markers = [])).push(mark); }
      } }
    });
    if (!markers) { return null }
    var parts = [{from: from, to: to}];
    for (var i = 0; i < markers.length; ++i) {
      var mk = markers[i], m = mk.find(0);
      for (var j = 0; j < parts.length; ++j) {
        var p = parts[j];
        if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) { continue }
        var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to);
        if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
          { newParts.push({from: p.from, to: m.from}); }
        if (dto > 0 || !mk.inclusiveRight && !dto)
          { newParts.push({from: m.to, to: p.to}); }
        parts.splice.apply(parts, newParts);
        j += newParts.length - 3;
      }
    }
    return parts
  }

  // Connect or disconnect spans from a line.
  function detachMarkedSpans(line) {
    var spans = line.markedSpans;
    if (!spans) { return }
    for (var i = 0; i < spans.length; ++i)
      { spans[i].marker.detachLine(line); }
    line.markedSpans = null;
  }
  function attachMarkedSpans(line, spans) {
    if (!spans) { return }
    for (var i = 0; i < spans.length; ++i)
      { spans[i].marker.attachLine(line); }
    line.markedSpans = spans;
  }

  // Helpers used when computing which overlapping collapsed span
  // counts as the larger one.
  function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0 }
  function extraRight(marker) { return marker.inclusiveRight ? 1 : 0 }

  // Returns a number indicating which of two overlapping collapsed
  // spans is larger (and thus includes the other). Falls back to
  // comparing ids when the spans cover exactly the same range.
  function compareCollapsedMarkers(a, b) {
    var lenDiff = a.lines.length - b.lines.length;
    if (lenDiff != 0) { return lenDiff }
    var aPos = a.find(), bPos = b.find();
    var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b);
    if (fromCmp) { return -fromCmp }
    var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b);
    if (toCmp) { return toCmp }
    return b.id - a.id
  }

  // Find out whether a line ends or starts in a collapsed span. If
  // so, return the marker for that span.
  function collapsedSpanAtSide(line, start) {
    var sps = sawCollapsedSpans && line.markedSpans, found;
    if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
      sp = sps[i];
      if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
          (!found || compareCollapsedMarkers(found, sp.marker) < 0))
        { found = sp.marker; }
    } }
    return found
  }
  function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true) }
  function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false) }

  function collapsedSpanAround(line, ch) {
    var sps = sawCollapsedSpans && line.markedSpans, found;
    if (sps) { for (var i = 0; i < sps.length; ++i) {
      var sp = sps[i];
      if (sp.marker.collapsed && (sp.from == null || sp.from < ch) && (sp.to == null || sp.to > ch) &&
          (!found || compareCollapsedMarkers(found, sp.marker) < 0)) { found = sp.marker; }
    } }
    return found
  }

  // Test whether there exists a collapsed span that partially
  // overlaps (covers the start or end, but not both) of a new span.
  // Such overlap is not allowed.
  function conflictingCollapsedRange(doc, lineNo, from, to, marker) {
    var line = getLine(doc, lineNo);
    var sps = sawCollapsedSpans && line.markedSpans;
    if (sps) { for (var i = 0; i < sps.length; ++i) {
      var sp = sps[i];
      if (!sp.marker.collapsed) { continue }
      var found = sp.marker.find(0);
      var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker);
      var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker);
      if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) { continue }
      if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) ||
          fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0))
        { return true }
    } }
  }

  // A visual line is a line as drawn on the screen. Folding, for
  // example, can cause multiple logical lines to appear on the same
  // visual line. This finds the start of the visual line that the
  // given line is part of (usually that is the line itself).
  function visualLine(line) {
    var merged;
    while (merged = collapsedSpanAtStart(line))
      { line = merged.find(-1, true).line; }
    return line
  }

  function visualLineEnd(line) {
    var merged;
    while (merged = collapsedSpanAtEnd(line))
      { line = merged.find(1, true).line; }
    return line
  }

  // Returns an array of logical lines that continue the visual line
  // started by the argument, or undefined if there are no such lines.
  function visualLineContinued(line) {
    var merged, lines;
    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line
      ;(lines || (lines = [])).push(line);
    }
    return lines
  }

  // Get the line number of the start of the visual line that the
  // given line number is part of.
  function visualLineNo(doc, lineN) {
    var line = getLine(doc, lineN), vis = visualLine(line);
    if (line == vis) { return lineN }
    return lineNo(vis)
  }

  // Get the line number of the start of the next visual line after
  // the given line.
  function visualLineEndNo(doc, lineN) {
    if (lineN > doc.lastLine()) { return lineN }
    var line = getLine(doc, lineN), merged;
    if (!lineIsHidden(doc, line)) { return lineN }
    while (merged = collapsedSpanAtEnd(line))
      { line = merged.find(1, true).line; }
    return lineNo(line) + 1
  }

  // Compute whether a line is hidden. Lines count as hidden when they
  // are part of a visual line that starts with another line, or when
  // they are entirely covered by collapsed, non-widget span.
  function lineIsHidden(doc, line) {
    var sps = sawCollapsedSpans && line.markedSpans;
    if (sps) { for (var sp = (void 0), i = 0; i < sps.length; ++i) {
      sp = sps[i];
      if (!sp.marker.collapsed) { continue }
      if (sp.from == null) { return true }
      if (sp.marker.widgetNode) { continue }
      if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
        { return true }
    } }
  }
  function lineIsHiddenInner(doc, line, span) {
    if (span.to == null) {
      var end = span.marker.find(1, true);
      return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker))
    }
    if (span.marker.inclusiveRight && span.to == line.text.length)
      { return true }
    for (var sp = (void 0), i = 0; i < line.markedSpans.length; ++i) {
      sp = line.markedSpans[i];
      if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
          (sp.to == null || sp.to != span.from) &&
          (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
          lineIsHiddenInner(doc, line, sp)) { return true }
    }
  }

  // Find the height above the given line.
  function heightAtLine(lineObj) {
    lineObj = visualLine(lineObj);

    var h = 0, chunk = lineObj.parent;
    for (var i = 0; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i];
      if (line == lineObj) { break }
      else { h += line.height; }
    }
    for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
      for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
        var cur = p.children[i$1];
        if (cur == chunk) { break }
        else { h += cur.height; }
      }
    }
    return h
  }

  // Compute the character length of a line, taking into account
  // collapsed ranges (see markText) that might hide parts, and join
  // other lines onto it.
  function lineLength(line) {
    if (line.height == 0) { return 0 }
    var len = line.text.length, merged, cur = line;
    while (merged = collapsedSpanAtStart(cur)) {
      var found = merged.find(0, true);
      cur = found.from.line;
      len += found.from.ch - found.to.ch;
    }
    cur = line;
    while (merged = collapsedSpanAtEnd(cur)) {
      var found$1 = merged.find(0, true);
      len -= cur.text.length - found$1.from.ch;
      cur = found$1.to.line;
      len += cur.text.length - found$1.to.ch;
    }
    return len
  }

  // Find the longest line in the document.
  function findMaxLine(cm) {
    var d = cm.display, doc = cm.doc;
    d.maxLine = getLine(doc, doc.first);
    d.maxLineLength = lineLength(d.maxLine);
    d.maxLineChanged = true;
    doc.iter(function (line) {
      var len = lineLength(line);
      if (len > d.maxLineLength) {
        d.maxLineLength = len;
        d.maxLine = line;
      }
    });
  }

  // LINE DATA STRUCTURE

  // Line objects. These hold state related to a line, including
  // highlighting info (the styles array).
  var Line = function(text, markedSpans, estimateHeight) {
    this.text = text;
    attachMarkedSpans(this, markedSpans);
    this.height = estimateHeight ? estimateHeight(this) : 1;
  };

  Line.prototype.lineNo = function () { return lineNo(this) };
  eventMixin(Line);

  // Change the content (text, markers) of a line. Automatically
  // invalidates cached information and tries to re-estimate the
  // line's height.
  function updateLine(line, text, markedSpans, estimateHeight) {
    line.text = text;
    if (line.stateAfter) { line.stateAfter = null; }
    if (line.styles) { line.styles = null; }
    if (line.order != null) { line.order = null; }
    detachMarkedSpans(line);
    attachMarkedSpans(line, markedSpans);
    var estHeight = estimateHeight ? estimateHeight(line) : 1;
    if (estHeight != line.height) { updateLineHeight(line, estHeight); }
  }

  // Detach a line from the document tree and its markers.
  function cleanUpLine(line) {
    line.parent = null;
    detachMarkedSpans(line);
  }

  // Convert a style as returned by a mode (either null, or a string
  // containing one or more styles) to a CSS style. This is cached,
  // and also looks for line-wide styles.
  var styleToClassCache = {}, styleToClassCacheWithMode = {};
  function interpretTokenStyle(style, options) {
    if (!style || /^\s*$/.test(style)) { return null }
    var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache;
    return cache[style] ||
      (cache[style] = style.replace(/\S+/g, "cm-$&"))
  }

  // Render the DOM representation of the text of a line. Also builds
  // up a 'line map', which points at the DOM nodes that represent
  // specific stretches of text, and is used by the measuring code.
  // The returned object contains the DOM node, this map, and
  // information about line-wide styles that were set by the mode.
  function buildLineContent(cm, lineView) {
    // The padding-right forces the element to have a 'border', which
    // is needed on Webkit to be able to get line-level bounding
    // rectangles for it (in measureChar).
    var content = eltP("span", null, null, webkit ? "padding-right: .1px" : null);
    var builder = {pre: eltP("pre", [content], "CodeMirror-line"), content: content,
                   col: 0, pos: 0, cm: cm,
                   trailingSpace: false,
                   splitSpaces: cm.getOption("lineWrapping")};
    lineView.measure = {};

    // Iterate over the logical lines that make up this visual line.
    for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
      var line = i ? lineView.rest[i - 1] : lineView.line, order = (void 0);
      builder.pos = 0;
      builder.addToken = buildToken;
      // Optionally wire in some hacks into the token-rendering
      // algorithm, to deal with browser quirks.
      if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line, cm.doc.direction)))
        { builder.addToken = buildTokenBadBidi(builder.addToken, order); }
      builder.map = [];
      var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line);
      insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate));
      if (line.styleClasses) {
        if (line.styleClasses.bgClass)
          { builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || ""); }
        if (line.styleClasses.textClass)
          { builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || ""); }
      }

      // Ensure at least a single node is present, for measuring.
      if (builder.map.length == 0)
        { builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure))); }

      // Store the map and a cache object for the current logical line
      if (i == 0) {
        lineView.measure.map = builder.map;
        lineView.measure.cache = {};
      } else {
  (lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map)
        ;(lineView.measure.caches || (lineView.measure.caches = [])).push({});
      }
    }

    // See issue #2901
    if (webkit) {
      var last = builder.content.lastChild;
      if (/\bcm-tab\b/.test(last.className) || (last.querySelector && last.querySelector(".cm-tab")))
        { builder.content.className = "cm-tab-wrap-hack"; }
    }

    signal(cm, "renderLine", cm, lineView.line, builder.pre);
    if (builder.pre.className)
      { builder.textClass = joinClasses(builder.pre.className, builder.textClass || ""); }

    return builder
  }

  function defaultSpecialCharPlaceholder(ch) {
    var token = elt("span", "\u2022", "cm-invalidchar");
    token.title = "\\u" + ch.charCodeAt(0).toString(16);
    token.setAttribute("aria-label", token.title);
    return token
  }

  // Build up the DOM representation for a single token, and add it to
  // the line map. Takes care to render special characters separately.
  function buildToken(builder, text, style, startStyle, endStyle, css, attributes) {
    if (!text) { return }
    var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text;
    var special = builder.cm.state.specialChars, mustWrap = false;
    var content;
    if (!special.test(text)) {
      builder.col += text.length;
      content = document.createTextNode(displayText);
      builder.map.push(builder.pos, builder.pos + text.length, content);
      if (ie && ie_version < 9) { mustWrap = true; }
      builder.pos += text.length;
    } else {
      content = document.createDocumentFragment();
      var pos = 0;
      while (true) {
        special.lastIndex = pos;
        var m = special.exec(text);
        var skipped = m ? m.index - pos : text.length - pos;
        if (skipped) {
          var txt = document.createTextNode(displayText.slice(pos, pos + skipped));
          if (ie && ie_version < 9) { content.appendChild(elt("span", [txt])); }
          else { content.appendChild(txt); }
          builder.map.push(builder.pos, builder.pos + skipped, txt);
          builder.col += skipped;
          builder.pos += skipped;
        }
        if (!m) { break }
        pos += skipped + 1;
        var txt$1 = (void 0);
        if (m[0] == "\t") {
          var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize;
          txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
          txt$1.setAttribute("role", "presentation");
          txt$1.setAttribute("cm-text", "\t");
          builder.col += tabWidth;
        } else if (m[0] == "\r" || m[0] == "\n") {
          txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"));
          txt$1.setAttribute("cm-text", m[0]);
          builder.col += 1;
        } else {
          txt$1 = builder.cm.options.specialCharPlaceholder(m[0]);
          txt$1.setAttribute("cm-text", m[0]);
          if (ie && ie_version < 9) { content.appendChild(elt("span", [txt$1])); }
          else { content.appendChild(txt$1); }
          builder.col += 1;
        }
        builder.map.push(builder.pos, builder.pos + 1, txt$1);
        builder.pos++;
      }
    }
    builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32;
    if (style || startStyle || endStyle || mustWrap || css || attributes) {
      var fullStyle = style || "";
      if (startStyle) { fullStyle += startStyle; }
      if (endStyle) { fullStyle += endStyle; }
      var token = elt("span", [content], fullStyle, css);
      if (attributes) {
        for (var attr in attributes) { if (attributes.hasOwnProperty(attr) && attr != "style" && attr != "class")
          { token.setAttribute(attr, attributes[attr]); } }
      }
      return builder.content.appendChild(token)
    }
    builder.content.appendChild(content);
  }

  // Change some spaces to NBSP to prevent the browser from collapsing
  // trailing spaces at the end of a line when rendering text (issue #1362).
  function splitSpaces(text, trailingBefore) {
    if (text.length > 1 && !/  /.test(text)) { return text }
    var spaceBefore = trailingBefore, result = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32))
        { ch = "\u00a0"; }
      result += ch;
      spaceBefore = ch == " ";
    }
    return result
  }

  // Work around nonsense dimensions being reported for stretches of
  // right-to-left text.
  function buildTokenBadBidi(inner, order) {
    return function (builder, text, style, startStyle, endStyle, css, attributes) {
      style = style ? style + " cm-force-border" : "cm-force-border";
      var start = builder.pos, end = start + text.length;
      for (;;) {
        // Find the part that overlaps with the start of this text
        var part = (void 0);
        for (var i = 0; i < order.length; i++) {
          part = order[i];
          if (part.to > start && part.from <= start) { break }
        }
        if (part.to >= end) { return inner(builder, text, style, startStyle, endStyle, css, attributes) }
        inner(builder, text.slice(0, part.to - start), style, startStyle, null, css, attributes);
        startStyle = null;
        text = text.slice(part.to - start);
        start = part.to;
      }
    }
  }

  function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
    var widget = !ignoreWidget && marker.widgetNode;
    if (widget) { builder.map.push(builder.pos, builder.pos + size, widget); }
    if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
      if (!widget)
        { widget = builder.content.appendChild(document.createElement("span")); }
      widget.setAttribute("cm-marker", marker.id);
    }
    if (widget) {
      builder.cm.display.input.setUneditable(widget);
      builder.content.appendChild(widget);
    }
    builder.pos += size;
    builder.trailingSpace = false;
  }

  // Outputs a number of spans to make up a line, taking highlighting
  // and marked text into account.
  function insertLineContent(line, builder, styles) {
    var spans = line.markedSpans, allText = line.text, at = 0;
    if (!spans) {
      for (var i$1 = 1; i$1 < styles.length; i$1+=2)
        { builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1+1], builder.cm.options)); }
      return
    }

    var len = allText.length, pos = 0, i = 1, text = "", style, css;
    var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, collapsed, attributes;
    for (;;) {
      if (nextChange == pos) { // Update current marker set
        spanStyle = spanEndStyle = spanStartStyle = css = "";
        attributes = null;
        collapsed = null; nextChange = Infinity;
        var foundBookmarks = [], endStyles = (void 0);
        for (var j = 0; j < spans.length; ++j) {
          var sp = spans[j], m = sp.marker;
          if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
            foundBookmarks.push(m);
          } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
            if (sp.to != null && sp.to != pos && nextChange > sp.to) {
              nextChange = sp.to;
              spanEndStyle = "";
            }
            if (m.className) { spanStyle += " " + m.className; }
            if (m.css) { css = (css ? css + ";" : "") + m.css; }
            if (m.startStyle && sp.from == pos) { spanStartStyle += " " + m.startStyle; }
            if (m.endStyle && sp.to == nextChange) { (endStyles || (endStyles = [])).push(m.endStyle, sp.to); }
            // support for the old title property
            // https://github.com/codemirror/CodeMirror/pull/5673
            if (m.title) { (attributes || (attributes = {})).title = m.title; }
            if (m.attributes) {
              for (var attr in m.attributes)
                { (attributes || (attributes = {}))[attr] = m.attributes[attr]; }
            }
            if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
              { collapsed = sp; }
          } else if (sp.from > pos && nextChange > sp.from) {
            nextChange = sp.from;
          }
        }
        if (endStyles) { for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2)
          { if (endStyles[j$1 + 1] == nextChange) { spanEndStyle += " " + endStyles[j$1]; } } }

        if (!collapsed || collapsed.from == pos) { for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2)
          { buildCollapsedSpan(builder, 0, foundBookmarks[j$2]); } }
        if (collapsed && (collapsed.from || 0) == pos) {
          buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
                             collapsed.marker, collapsed.from == null);
          if (collapsed.to == null) { return }
          if (collapsed.to == pos) { collapsed = false; }
        }
      }
      if (pos >= len) { break }

      var upto = Math.min(len, nextChange);
      while (true) {
        if (text) {
          var end = pos + text.length;
          if (!collapsed) {
            var tokenText = end > upto ? text.slice(0, upto - pos) : text;
            builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                             spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", css, attributes);
          }
          if (end >= upto) {text = text.slice(upto - pos); pos = upto; break}
          pos = end;
          spanStartStyle = "";
        }
        text = allText.slice(at, at = styles[i++]);
        style = interpretTokenStyle(styles[i++], builder.cm.options);
      }
    }
  }


  // These objects are used to represent the visible (currently drawn)
  // part of the document. A LineView may correspond to multiple
  // logical lines, if those are connected by collapsed ranges.
  function LineView(doc, line, lineN) {
    // The starting line
    this.line = line;
    // Continuing lines, if any
    this.rest = visualLineContinued(line);
    // Number of logical lines in this visual line
    this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1;
    this.node = this.text = null;
    this.hidden = lineIsHidden(doc, line);
  }

  // Create a range of LineView objects for the given lines.
  function buildViewArray(cm, from, to) {
    var array = [], nextPos;
    for (var pos = from; pos < to; pos = nextPos) {
      var view = new LineView(cm.doc, getLine(cm.doc, pos), pos);
      nextPos = pos + view.size;
      array.push(view);
    }
    return array
  }

  var operationGroup = null;

  function pushOperation(op) {
    if (operationGroup) {
      operationGroup.ops.push(op);
    } else {
      op.ownsGroup = operationGroup = {
        ops: [op],
        delayedCallbacks: []
      };
    }
  }

  function fireCallbacksForOps(group) {
    // Calls delayed callbacks and cursorActivity handlers until no
    // new ones appear
    var callbacks = group.delayedCallbacks, i = 0;
    do {
      for (; i < callbacks.length; i++)
        { callbacks[i].call(null); }
      for (var j = 0; j < group.ops.length; j++) {
        var op = group.ops[j];
        if (op.cursorActivityHandlers)
          { while (op.cursorActivityCalled < op.cursorActivityHandlers.length)
            { op.cursorActivityHandlers[op.cursorActivityCalled++].call(null, op.cm); } }
      }
    } while (i < callbacks.length)
  }

  function finishOperation(op, endCb) {
    var group = op.ownsGroup;
    if (!group) { return }

    try { fireCallbacksForOps(group); }
    finally {
      operationGroup = null;
      endCb(group);
    }
  }

  var orphanDelayedCallbacks = null;

  // Often, we want to signal events at a point where we are in the
  // middle of some work, but don't want the handler to start calling
  // other methods on the editor, which might be in an inconsistent
  // state or simply not expect any other events to happen.
  // signalLater looks whether there are any handlers, and schedules
  // them to be executed when the last operation ends, or, if no
  // operation is active, when a timeout fires.
  function signalLater(emitter, type /*, values...*/) {
    var arr = getHandlers(emitter, type);
    if (!arr.length) { return }
    var args = Array.prototype.slice.call(arguments, 2), list;
    if (operationGroup) {
      list = operationGroup.delayedCallbacks;
    } else if (orphanDelayedCallbacks) {
      list = orphanDelayedCallbacks;
    } else {
      list = orphanDelayedCallbacks = [];
      setTimeout(fireOrphanDelayed, 0);
    }
    var loop = function ( i ) {
      list.push(function () { return arr[i].apply(null, args); });
    };

    for (var i = 0; i < arr.length; ++i)
      loop( i );
  }

  function fireOrphanDelayed() {
    var delayed = orphanDelayedCallbacks;
    orphanDelayedCallbacks = null;
    for (var i = 0; i < delayed.length; ++i) { delayed[i](); }
  }

  // When an aspect of a line changes, a string is added to
  // lineView.changes. This updates the relevant part of the line's
  // DOM structure.
  function updateLineForChanges(cm, lineView, lineN, dims) {
    for (var j = 0; j < lineView.changes.length; j++) {
      var type = lineView.changes[j];
      if (type == "text") { updateLineText(cm, lineView); }
      else if (type == "gutter") { updateLineGutter(cm, lineView, lineN, dims); }
      else if (type == "class") { updateLineClasses(cm, lineView); }
      else if (type == "widget") { updateLineWidgets(cm, lineView, dims); }
    }
    lineView.changes = null;
  }

  // Lines with gutter elements, widgets or a background class need to
  // be wrapped, and have the extra elements added to the wrapper div
  function ensureLineWrapped(lineView) {
    if (lineView.node == lineView.text) {
      lineView.node = elt("div", null, null, "position: relative");
      if (lineView.text.parentNode)
        { lineView.text.parentNode.replaceChild(lineView.node, lineView.text); }
      lineView.node.appendChild(lineView.text);
      if (ie && ie_version < 8) { lineView.node.style.zIndex = 2; }
    }
    return lineView.node
  }

  function updateLineBackground(cm, lineView) {
    var cls = lineView.bgClass ? lineView.bgClass + " " + (lineView.line.bgClass || "") : lineView.line.bgClass;
    if (cls) { cls += " CodeMirror-linebackground"; }
    if (lineView.background) {
      if (cls) { lineView.background.className = cls; }
      else { lineView.background.parentNode.removeChild(lineView.background); lineView.background = null; }
    } else if (cls) {
      var wrap = ensureLineWrapped(lineView);
      lineView.background = wrap.insertBefore(elt("div", null, cls), wrap.firstChild);
      cm.display.input.setUneditable(lineView.background);
    }
  }

  // Wrapper around buildLineContent which will reuse the structure
  // in display.externalMeasured when possible.
  function getLineContent(cm, lineView) {
    var ext = cm.display.externalMeasured;
    if (ext && ext.line == lineView.line) {
      cm.display.externalMeasured = null;
      lineView.measure = ext.measure;
      return ext.built
    }
    return buildLineContent(cm, lineView)
  }

  // Redraw the line's text. Interacts with the background and text
  // classes because the mode may output tokens that influence these
  // classes.
  function updateLineText(cm, lineView) {
    var cls = lineView.text.className;
    var built = getLineContent(cm, lineView);
    if (lineView.text == lineView.node) { lineView.node = built.pre; }
    lineView.text.parentNode.replaceChild(built.pre, lineView.text);
    lineView.text = built.pre;
    if (built.bgClass != lineView.bgClass || built.textClass != lineView.textClass) {
      lineView.bgClass = built.bgClass;
      lineView.textClass = built.textClass;
      updateLineClasses(cm, lineView);
    } else if (cls) {
      lineView.text.className = cls;
    }
  }

  function updateLineClasses(cm, lineView) {
    updateLineBackground(cm, lineView);
    if (lineView.line.wrapClass)
      { ensureLineWrapped(lineView).className = lineView.line.wrapClass; }
    else if (lineView.node != lineView.text)
      { lineView.node.className = ""; }
    var textClass = lineView.textClass ? lineView.textClass + " " + (lineView.line.textClass || "") : lineView.line.textClass;
    lineView.text.className = textClass || "";
  }

  function updateLineGutter(cm, lineView, lineN, dims) {
    if (lineView.gutter) {
      lineView.node.removeChild(lineView.gutter);
      lineView.gutter = null;
    }
    if (lineView.gutterBackground) {
      lineView.node.removeChild(lineView.gutterBackground);
      lineView.gutterBackground = null;
    }
    if (lineView.line.gutterClass) {
      var wrap = ensureLineWrapped(lineView);
      lineView.gutterBackground = elt("div", null, "CodeMirror-gutter-background " + lineView.line.gutterClass,
                                      ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px; width: " + (dims.gutterTotalWidth) + "px"));
      cm.display.input.setUneditable(lineView.gutterBackground);
      wrap.insertBefore(lineView.gutterBackground, lineView.text);
    }
    var markers = lineView.line.gutterMarkers;
    if (cm.options.lineNumbers || markers) {
      var wrap$1 = ensureLineWrapped(lineView);
      var gutterWrap = lineView.gutter = elt("div", null, "CodeMirror-gutter-wrapper", ("left: " + (cm.options.fixedGutter ? dims.fixedPos : -dims.gutterTotalWidth) + "px"));
      gutterWrap.setAttribute("aria-hidden", "true");
      cm.display.input.setUneditable(gutterWrap);
      wrap$1.insertBefore(gutterWrap, lineView.text);
      if (lineView.line.gutterClass)
        { gutterWrap.className += " " + lineView.line.gutterClass; }
      if (cm.options.lineNumbers && (!markers || !markers["CodeMirror-linenumbers"]))
        { lineView.lineNumber = gutterWrap.appendChild(
          elt("div", lineNumberFor(cm.options, lineN),
              "CodeMirror-linenumber CodeMirror-gutter-elt",
              ("left: " + (dims.gutterLeft["CodeMirror-linenumbers"]) + "px; width: " + (cm.display.lineNumInnerWidth) + "px"))); }
      if (markers) { for (var k = 0; k < cm.display.gutterSpecs.length; ++k) {
        var id = cm.display.gutterSpecs[k].className, found = markers.hasOwnProperty(id) && markers[id];
        if (found)
          { gutterWrap.appendChild(elt("div", [found], "CodeMirror-gutter-elt",
                                     ("left: " + (dims.gutterLeft[id]) + "px; width: " + (dims.gutterWidth[id]) + "px"))); }
      } }
    }
  }

  function updateLineWidgets(cm, lineView, dims) {
    if (lineView.alignable) { lineView.alignable = null; }
    var isWidget = classTest("CodeMirror-linewidget");
    for (var node = lineView.node.firstChild, next = (void 0); node; node = next) {
      next = node.nextSibling;
      if (isWidget.test(node.className)) { lineView.node.removeChild(node); }
    }
    insertLineWidgets(cm, lineView, dims);
  }

  // Build a line's DOM representation from scratch
  function buildLineElement(cm, lineView, lineN, dims) {
    var built = getLineContent(cm, lineView);
    lineView.text = lineView.node = built.pre;
    if (built.bgClass) { lineView.bgClass = built.bgClass; }
    if (built.textClass) { lineView.textClass = built.textClass; }

    updateLineClasses(cm, lineView);
    updateLineGutter(cm, lineView, lineN, dims);
    insertLineWidgets(cm, lineView, dims);
    return lineView.node
  }

  // A lineView may contain multiple logical lines (when merged by
  // collapsed spans). The widgets for all of them need to be drawn.
  function insertLineWidgets(cm, lineView, dims) {
    insertLineWidgetsFor(cm, lineView.line, lineView, dims, true);
    if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
      { insertLineWidgetsFor(cm, lineView.rest[i], lineView, dims, false); } }
  }

  function insertLineWidgetsFor(cm, line, lineView, dims, allowAbove) {
    if (!line.widgets) { return }
    var wrap = ensureLineWrapped(lineView);
    for (var i = 0, ws = line.widgets; i < ws.length; ++i) {
      var widget = ws[i], node = elt("div", [widget.node], "CodeMirror-linewidget" + (widget.className ? " " + widget.className : ""));
      if (!widget.handleMouseEvents) { node.setAttribute("cm-ignore-events", "true"); }
      positionLineWidget(widget, node, lineView, dims);
      cm.display.input.setUneditable(node);
      if (allowAbove && widget.above)
        { wrap.insertBefore(node, lineView.gutter || lineView.text); }
      else
        { wrap.appendChild(node); }
      signalLater(widget, "redraw");
    }
  }

  function positionLineWidget(widget, node, lineView, dims) {
    if (widget.noHScroll) {
  (lineView.alignable || (lineView.alignable = [])).push(node);
      var width = dims.wrapperWidth;
      node.style.left = dims.fixedPos + "px";
      if (!widget.coverGutter) {
        width -= dims.gutterTotalWidth;
        node.style.paddingLeft = dims.gutterTotalWidth + "px";
      }
      node.style.width = width + "px";
    }
    if (widget.coverGutter) {
      node.style.zIndex = 5;
      node.style.position = "relative";
      if (!widget.noHScroll) { node.style.marginLeft = -dims.gutterTotalWidth + "px"; }
    }
  }

  function widgetHeight(widget) {
    if (widget.height != null) { return widget.height }
    var cm = widget.doc.cm;
    if (!cm) { return 0 }
    if (!contains(document.body, widget.node)) {
      var parentStyle = "position: relative;";
      if (widget.coverGutter)
        { parentStyle += "margin-left: -" + cm.display.gutters.offsetWidth + "px;"; }
      if (widget.noHScroll)
        { parentStyle += "width: " + cm.display.wrapper.clientWidth + "px;"; }
      removeChildrenAndAdd(cm.display.measure, elt("div", [widget.node], null, parentStyle));
    }
    return widget.height = widget.node.parentNode.offsetHeight
  }

  // Return true when the given mouse event happened in a widget
  function eventInWidget(display, e) {
    for (var n = e_target(e); n != display.wrapper; n = n.parentNode) {
      if (!n || (n.nodeType == 1 && n.getAttribute("cm-ignore-events") == "true") ||
          (n.parentNode == display.sizer && n != display.mover))
        { return true }
    }
  }

  // POSITION MEASUREMENT

  function paddingTop(display) {return display.lineSpace.offsetTop}
  function paddingVert(display) {return display.mover.offsetHeight - display.lineSpace.offsetHeight}
  function paddingH(display) {
    if (display.cachedPaddingH) { return display.cachedPaddingH }
    var e = removeChildrenAndAdd(display.measure, elt("pre", "x", "CodeMirror-line-like"));
    var style = window.getComputedStyle ? window.getComputedStyle(e) : e.currentStyle;
    var data = {left: parseInt(style.paddingLeft), right: parseInt(style.paddingRight)};
    if (!isNaN(data.left) && !isNaN(data.right)) { display.cachedPaddingH = data; }
    return data
  }

  function scrollGap(cm) { return scrollerGap - cm.display.nativeBarWidth }
  function displayWidth(cm) {
    return cm.display.scroller.clientWidth - scrollGap(cm) - cm.display.barWidth
  }
  function displayHeight(cm) {
    return cm.display.scroller.clientHeight - scrollGap(cm) - cm.display.barHeight
  }

  // Ensure the lineView.wrapping.heights array is populated. This is
  // an array of bottom offsets for the lines that make up a drawn
  // line. When lineWrapping is on, there might be more than one
  // height.
  function ensureLineHeights(cm, lineView, rect) {
    var wrapping = cm.options.lineWrapping;
    var curWidth = wrapping && displayWidth(cm);
    if (!lineView.measure.heights || wrapping && lineView.measure.width != curWidth) {
      var heights = lineView.measure.heights = [];
      if (wrapping) {
        lineView.measure.width = curWidth;
        var rects = lineView.text.firstChild.getClientRects();
        for (var i = 0; i < rects.length - 1; i++) {
          var cur = rects[i], next = rects[i + 1];
          if (Math.abs(cur.bottom - next.bottom) > 2)
            { heights.push((cur.bottom + next.top) / 2 - rect.top); }
        }
      }
      heights.push(rect.bottom - rect.top);
    }
  }

  // Find a line map (mapping character offsets to text nodes) and a
  // measurement cache for the given line number. (A line view might
  // contain multiple lines when collapsed ranges are present.)
  function mapFromLineView(lineView, line, lineN) {
    if (lineView.line == line)
      { return {map: lineView.measure.map, cache: lineView.measure.cache} }
    for (var i = 0; i < lineView.rest.length; i++)
      { if (lineView.rest[i] == line)
        { return {map: lineView.measure.maps[i], cache: lineView.measure.caches[i]} } }
    for (var i$1 = 0; i$1 < lineView.rest.length; i$1++)
      { if (lineNo(lineView.rest[i$1]) > lineN)
        { return {map: lineView.measure.maps[i$1], cache: lineView.measure.caches[i$1], before: true} } }
  }

  // Render a line into the hidden node display.externalMeasured. Used
  // when measurement is needed for a line that's not in the viewport.
  function updateExternalMeasurement(cm, line) {
    line = visualLine(line);
    var lineN = lineNo(line);
    var view = cm.display.externalMeasured = new LineView(cm.doc, line, lineN);
    view.lineN = lineN;
    var built = view.built = buildLineContent(cm, view);
    view.text = built.pre;
    removeChildrenAndAdd(cm.display.lineMeasure, built.pre);
    return view
  }

  // Get a {top, bottom, left, right} box (in line-local coordinates)
  // for a given character.
  function measureChar(cm, line, ch, bias) {
    return measureCharPrepared(cm, prepareMeasureForLine(cm, line), ch, bias)
  }

  // Find a line view that corresponds to the given line number.
  function findViewForLine(cm, lineN) {
    if (lineN >= cm.display.viewFrom && lineN < cm.display.viewTo)
      { return cm.display.view[findViewIndex(cm, lineN)] }
    var ext = cm.display.externalMeasured;
    if (ext && lineN >= ext.lineN && lineN < ext.lineN + ext.size)
      { return ext }
  }

  // Measurement can be split in two steps, the set-up work that
  // applies to the whole line, and the measurement of the actual
  // character. Functions like coordsChar, that need to do a lot of
  // measurements in a row, can thus ensure that the set-up work is
  // only done once.
  function prepareMeasureForLine(cm, line) {
    var lineN = lineNo(line);
    var view = findViewForLine(cm, lineN);
    if (view && !view.text) {
      view = null;
    } else if (view && view.changes) {
      updateLineForChanges(cm, view, lineN, getDimensions(cm));
      cm.curOp.forceUpdate = true;
    }
    if (!view)
      { view = updateExternalMeasurement(cm, line); }

    var info = mapFromLineView(view, line, lineN);
    return {
      line: line, view: view, rect: null,
      map: info.map, cache: info.cache, before: info.before,
      hasHeights: false
    }
  }

  // Given a prepared measurement object, measures the position of an
  // actual character (or fetches it from the cache).
  function measureCharPrepared(cm, prepared, ch, bias, varHeight) {
    if (prepared.before) { ch = -1; }
    var key = ch + (bias || ""), found;
    if (prepared.cache.hasOwnProperty(key)) {
      found = prepared.cache[key];
    } else {
      if (!prepared.rect)
        { prepared.rect = prepared.view.text.getBoundingClientRect(); }
      if (!prepared.hasHeights) {
        ensureLineHeights(cm, prepared.view, prepared.rect);
        prepared.hasHeights = true;
      }
      found = measureCharInner(cm, prepared, ch, bias);
      if (!found.bogus) { prepared.cache[key] = found; }
    }
    return {left: found.left, right: found.right,
            top: varHeight ? found.rtop : found.top,
            bottom: varHeight ? found.rbottom : found.bottom}
  }

  var nullRect = {left: 0, right: 0, top: 0, bottom: 0};

  function nodeAndOffsetInLineMap(map, ch, bias) {
    var node, start, end, collapse, mStart, mEnd;
    // First, search the line map for the text node corresponding to,
    // or closest to, the target character.
    for (var i = 0; i < map.length; i += 3) {
      mStart = map[i];
      mEnd = map[i + 1];
      if (ch < mStart) {
        start = 0; end = 1;
        collapse = "left";
      } else if (ch < mEnd) {
        start = ch - mStart;
        end = start + 1;
      } else if (i == map.length - 3 || ch == mEnd && map[i + 3] > ch) {
        end = mEnd - mStart;
        start = end - 1;
        if (ch >= mEnd) { collapse = "right"; }
      }
      if (start != null) {
        node = map[i + 2];
        if (mStart == mEnd && bias == (node.insertLeft ? "left" : "right"))
          { collapse = bias; }
        if (bias == "left" && start == 0)
          { while (i && map[i - 2] == map[i - 3] && map[i - 1].insertLeft) {
            node = map[(i -= 3) + 2];
            collapse = "left";
          } }
        if (bias == "right" && start == mEnd - mStart)
          { while (i < map.length - 3 && map[i + 3] == map[i + 4] && !map[i + 5].insertLeft) {
            node = map[(i += 3) + 2];
            collapse = "right";
          } }
        break
      }
    }
    return {node: node, start: start, end: end, collapse: collapse, coverStart: mStart, coverEnd: mEnd}
  }

  function getUsefulRect(rects, bias) {
    var rect = nullRect;
    if (bias == "left") { for (var i = 0; i < rects.length; i++) {
      if ((rect = rects[i]).left != rect.right) { break }
    } } else { for (var i$1 = rects.length - 1; i$1 >= 0; i$1--) {
      if ((rect = rects[i$1]).left != rect.right) { break }
    } }
    return rect
  }

  function measureCharInner(cm, prepared, ch, bias) {
    var place = nodeAndOffsetInLineMap(prepared.map, ch, bias);
    var node = place.node, start = place.start, end = place.end, collapse = place.collapse;

    var rect;
    if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
      for (var i$1 = 0; i$1 < 4; i$1++) { // Retry a maximum of 4 times when nonsense rectangles are returned
        while (start && isExtendingChar(prepared.line.text.charAt(place.coverStart + start))) { --start; }
        while (place.coverStart + end < place.coverEnd && isExtendingChar(prepared.line.text.charAt(place.coverStart + end))) { ++end; }
        if (ie && ie_version < 9 && start == 0 && end == place.coverEnd - place.coverStart)
          { rect = node.parentNode.getBoundingClientRect(); }
        else
          { rect = getUsefulRect(range(node, start, end).getClientRects(), bias); }
        if (rect.left || rect.right || start == 0) { break }
        end = start;
        start = start - 1;
        collapse = "right";
      }
      if (ie && ie_version < 11) { rect = maybeUpdateRectForZooming(cm.display.measure, rect); }
    } else { // If it is a widget, simply get the box for the whole widget.
      if (start > 0) { collapse = bias = "right"; }
      var rects;
      if (cm.options.lineWrapping && (rects = node.getClientRects()).length > 1)
        { rect = rects[bias == "right" ? rects.length - 1 : 0]; }
      else
        { rect = node.getBoundingClientRect(); }
    }
    if (ie && ie_version < 9 && !start && (!rect || !rect.left && !rect.right)) {
      var rSpan = node.parentNode.getClientRects()[0];
      if (rSpan)
        { rect = {left: rSpan.left, right: rSpan.left + charWidth(cm.display), top: rSpan.top, bottom: rSpan.bottom}; }
      else
        { rect = nullRect; }
    }

    var rtop = rect.top - prepared.rect.top, rbot = rect.bottom - prepared.rect.top;
    var mid = (rtop + rbot) / 2;
    var heights = prepared.view.measure.heights;
    var i = 0;
    for (; i < heights.length - 1; i++)
      { if (mid < heights[i]) { break } }
    var top = i ? heights[i - 1] : 0, bot = heights[i];
    var result = {left: (collapse == "right" ? rect.right : rect.left) - prepared.rect.left,
                  right: (collapse == "left" ? rect.left : rect.right) - prepared.rect.left,
                  top: top, bottom: bot};
    if (!rect.left && !rect.right) { result.bogus = true; }
    if (!cm.options.singleCursorHeightPerLine) { result.rtop = rtop; result.rbottom = rbot; }

    return result
  }

  // Work around problem with bounding client rects on ranges being
  // returned incorrectly when zoomed on IE10 and below.
  function maybeUpdateRectForZooming(measure, rect) {
    if (!window.screen || screen.logicalXDPI == null ||
        screen.logicalXDPI == screen.deviceXDPI || !hasBadZoomedRects(measure))
      { return rect }
    var scaleX = screen.logicalXDPI / screen.deviceXDPI;
    var scaleY = screen.logicalYDPI / screen.deviceYDPI;
    return {left: rect.left * scaleX, right: rect.right * scaleX,
            top: rect.top * scaleY, bottom: rect.bottom * scaleY}
  }

  function clearLineMeasurementCacheFor(lineView) {
    if (lineView.measure) {
      lineView.measure.cache = {};
      lineView.measure.heights = null;
      if (lineView.rest) { for (var i = 0; i < lineView.rest.length; i++)
        { lineView.measure.caches[i] = {}; } }
    }
  }

  function clearLineMeasurementCache(cm) {
    cm.display.externalMeasure = null;
    removeChildren(cm.display.lineMeasure);
    for (var i = 0; i < cm.display.view.length; i++)
      { clearLineMeasurementCacheFor(cm.display.view[i]); }
  }

  function clearCaches(cm) {
    clearLineMeasurementCache(cm);
    cm.display.cachedCharWidth = cm.display.cachedTextHeight = cm.display.cachedPaddingH = null;
    if (!cm.options.lineWrapping) { cm.display.maxLineChanged = true; }
    cm.display.lineNumChars = null;
  }

  function pageScrollX() {
    // Work around https://bugs.chromium.org/p/chromium/issues/detail?id=489206
    // which causes page_Offset and bounding client rects to use
    // different reference viewports and invalidate our calculations.
    if (chrome && android) { return -(document.body.getBoundingClientRect().left - parseInt(getComputedStyle(document.body).marginLeft)) }
    return window.pageXOffset || (document.documentElement || document.body).scrollLeft
  }
  function pageScrollY() {
    if (chrome && android) { return -(document.body.getBoundingClientRect().top - parseInt(getComputedStyle(document.body).marginTop)) }
    return window.pageYOffset || (document.documentElement || document.body).scrollTop
  }

  function widgetTopHeight(lineObj) {
    var height = 0;
    if (lineObj.widgets) { for (var i = 0; i < lineObj.widgets.length; ++i) { if (lineObj.widgets[i].above)
      { height += widgetHeight(lineObj.widgets[i]); } } }
    return height
  }

  // Converts a {top, bottom, left, right} box from line-local
  // coordinates into another coordinate system. Context may be one of
  // "line", "div" (display.lineDiv), "local"./null (editor), "window",
  // or "page".
  function intoCoordSystem(cm, lineObj, rect, context, includeWidgets) {
    if (!includeWidgets) {
      var height = widgetTopHeight(lineObj);
      rect.top += height; rect.bottom += height;
    }
    if (context == "line") { return rect }
    if (!context) { context = "local"; }
    var yOff = heightAtLine(lineObj);
    if (context == "local") { yOff += paddingTop(cm.display); }
    else { yOff -= cm.display.viewOffset; }
    if (context == "page" || context == "window") {
      var lOff = cm.display.lineSpace.getBoundingClientRect();
      yOff += lOff.top + (context == "window" ? 0 : pageScrollY());
      var xOff = lOff.left + (context == "window" ? 0 : pageScrollX());
      rect.left += xOff; rect.right += xOff;
    }
    rect.top += yOff; rect.bottom += yOff;
    return rect
  }

  // Coverts a box from "div" coords to another coordinate system.
  // Context may be "window", "page", "div", or "local"./null.
  function fromCoordSystem(cm, coords, context) {
    if (context == "div") { return coords }
    var left = coords.left, top = coords.top;
    // First move into "page" coordinate system
    if (context == "page") {
      left -= pageScrollX();
      top -= pageScrollY();
    } else if (context == "local" || !context) {
      var localBox = cm.display.sizer.getBoundingClientRect();
      left += localBox.left;
      top += localBox.top;
    }

    var lineSpaceBox = cm.display.lineSpace.getBoundingClientRect();
    return {left: left - lineSpaceBox.left, top: top - lineSpaceBox.top}
  }

  function charCoords(cm, pos, context, lineObj, bias) {
    if (!lineObj) { lineObj = getLine(cm.doc, pos.line); }
    return intoCoordSystem(cm, lineObj, measureChar(cm, lineObj, pos.ch, bias), context)
  }

  // Returns a box for a given cursor position, which may have an
  // 'other' property containing the position of the secondary cursor
  // on a bidi boundary.
  // A cursor Pos(line, char, "before") is on the same visual line as `char - 1`
  // and after `char - 1` in writing order of `char - 1`
  // A cursor Pos(line, char, "after") is on the same visual line as `char`
  // and before `char` in writing order of `char`
  // Examples (upper-case letters are RTL, lower-case are LTR):
  //     Pos(0, 1, ...)
  //     before   after
  // ab     a|b     a|b
  // aB     a|B     aB|
  // Ab     |Ab     A|b
  // AB     B|A     B|A
  // Every position after the last character on a line is considered to stick
  // to the last character on the line.
  function cursorCoords(cm, pos, context, lineObj, preparedMeasure, varHeight) {
    lineObj = lineObj || getLine(cm.doc, pos.line);
    if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
    function get(ch, right) {
      var m = measureCharPrepared(cm, preparedMeasure, ch, right ? "right" : "left", varHeight);
      if (right) { m.left = m.right; } else { m.right = m.left; }
      return intoCoordSystem(cm, lineObj, m, context)
    }
    var order = getOrder(lineObj, cm.doc.direction), ch = pos.ch, sticky = pos.sticky;
    if (ch >= lineObj.text.length) {
      ch = lineObj.text.length;
      sticky = "before";
    } else if (ch <= 0) {
      ch = 0;
      sticky = "after";
    }
    if (!order) { return get(sticky == "before" ? ch - 1 : ch, sticky == "before") }

    function getBidi(ch, partPos, invert) {
      var part = order[partPos], right = part.level == 1;
      return get(invert ? ch - 1 : ch, right != invert)
    }
    var partPos = getBidiPartAt(order, ch, sticky);
    var other = bidiOther;
    var val = getBidi(ch, partPos, sticky == "before");
    if (other != null) { val.other = getBidi(ch, other, sticky != "before"); }
    return val
  }

  // Used to cheaply estimate the coordinates for a position. Used for
  // intermediate scroll updates.
  function estimateCoords(cm, pos) {
    var left = 0;
    pos = clipPos(cm.doc, pos);
    if (!cm.options.lineWrapping) { left = charWidth(cm.display) * pos.ch; }
    var lineObj = getLine(cm.doc, pos.line);
    var top = heightAtLine(lineObj) + paddingTop(cm.display);
    return {left: left, right: left, top: top, bottom: top + lineObj.height}
  }

  // Positions returned by coordsChar contain some extra information.
  // xRel is the relative x position of the input coordinates compared
  // to the found position (so xRel > 0 means the coordinates are to
  // the right of the character position, for example). When outside
  // is true, that means the coordinates lie outside the line's
  // vertical range.
  function PosWithInfo(line, ch, sticky, outside, xRel) {
    var pos = Pos(line, ch, sticky);
    pos.xRel = xRel;
    if (outside) { pos.outside = outside; }
    return pos
  }

  // Compute the character position closest to the given coordinates.
  // Input must be lineSpace-local ("div" coordinate system).
  function coordsChar(cm, x, y) {
    var doc = cm.doc;
    y += cm.display.viewOffset;
    if (y < 0) { return PosWithInfo(doc.first, 0, null, -1, -1) }
    var lineN = lineAtHeight(doc, y), last = doc.first + doc.size - 1;
    if (lineN > last)
      { return PosWithInfo(doc.first + doc.size - 1, getLine(doc, last).text.length, null, 1, 1) }
    if (x < 0) { x = 0; }

    var lineObj = getLine(doc, lineN);
    for (;;) {
      var found = coordsCharInner(cm, lineObj, lineN, x, y);
      var collapsed = collapsedSpanAround(lineObj, found.ch + (found.xRel > 0 || found.outside > 0 ? 1 : 0));
      if (!collapsed) { return found }
      var rangeEnd = collapsed.find(1);
      if (rangeEnd.line == lineN) { return rangeEnd }
      lineObj = getLine(doc, lineN = rangeEnd.line);
    }
  }

  function wrappedLineExtent(cm, lineObj, preparedMeasure, y) {
    y -= widgetTopHeight(lineObj);
    var end = lineObj.text.length;
    var begin = findFirst(function (ch) { return measureCharPrepared(cm, preparedMeasure, ch - 1).bottom <= y; }, end, 0);
    end = findFirst(function (ch) { return measureCharPrepared(cm, preparedMeasure, ch).top > y; }, begin, end);
    return {begin: begin, end: end}
  }

  function wrappedLineExtentChar(cm, lineObj, preparedMeasure, target) {
    if (!preparedMeasure) { preparedMeasure = prepareMeasureForLine(cm, lineObj); }
    var targetTop = intoCoordSystem(cm, lineObj, measureCharPrepared(cm, preparedMeasure, target), "line").top;
    return wrappedLineExtent(cm, lineObj, preparedMeasure, targetTop)
  }

  // Returns true if the given side of a box is after the given
  // coordinates, in top-to-bottom, left-to-right order.
  function boxIsAfter(box, x, y, left) {
    return box.bottom <= y ? false : box.top > y ? true : (left ? box.left : box.right) > x
  }

  function coordsCharInner(cm, lineObj, lineNo, x, y) {
    // Move y into line-local coordinate space
    y -= heightAtLine(lineObj);
    var preparedMeasure = prepareMeasureForLine(cm, lineObj);
    // When directly calling `measureCharPrepared`, we have to adjust
    // for the widgets at this line.
    var widgetHeight = widgetTopHeight(lineObj);
    var begin = 0, end = lineObj.text.length, ltr = true;

    var order = getOrder(lineObj, cm.doc.direction);
    // If the line isn't plain left-to-right text, first figure out
    // which bidi section the coordinates fall into.
    if (order) {
      var part = (cm.options.lineWrapping ? coordsBidiPartWrapped : coordsBidiPart)
                   (cm, lineObj, lineNo, preparedMeasure, order, x, y);
      ltr = part.level != 1;
      // The awkward -1 offsets are needed because findFirst (called
      // on these below) will treat its first bound as inclusive,
      // second as exclusive, but we want to actually address the
      // characters in the part's range
      begin = ltr ? part.from : part.to - 1;
      end = ltr ? part.to : part.from - 1;
    }

    // A binary search to find the first character whose bounding box
    // starts after the coordinates. If we run across any whose box wrap
    // the coordinates, store that.
    var chAround = null, boxAround = null;
    var ch = findFirst(function (ch) {
      var box = measureCharPrepared(cm, preparedMeasure, ch);
      box.top += widgetHeight; box.bottom += widgetHeight;
      if (!boxIsAfter(box, x, y, false)) { return false }
      if (box.top <= y && box.left <= x) {
        chAround = ch;
        boxAround = box;
      }
      return true
    }, begin, end);

    var baseX, sticky, outside = false;
    // If a box around the coordinates was found, use that
    if (boxAround) {
      // Distinguish coordinates nearer to the left or right side of the box
      var atLeft = x - boxAround.left < boxAround.right - x, atStart = atLeft == ltr;
      ch = chAround + (atStart ? 0 : 1);
      sticky = atStart ? "after" : "before";
      baseX = atLeft ? boxAround.left : boxAround.right;
    } else {
      // (Adjust for extended bound, if necessary.)
      if (!ltr && (ch == end || ch == begin)) { ch++; }
      // To determine which side to associate with, get the box to the
      // left of the character and compare it's vertical position to the
      // coordinates
      sticky = ch == 0 ? "after" : ch == lineObj.text.length ? "before" :
        (measureCharPrepared(cm, preparedMeasure, ch - (ltr ? 1 : 0)).bottom + widgetHeight <= y) == ltr ?
        "after" : "before";
      // Now get accurate coordinates for this place, in order to get a
      // base X position
      var coords = cursorCoords(cm, Pos(lineNo, ch, sticky), "line", lineObj, preparedMeasure);
      baseX = coords.left;
      outside = y < coords.top ? -1 : y >= coords.bottom ? 1 : 0;
    }

    ch = skipExtendingChars(lineObj.text, ch, 1);
    return PosWithInfo(lineNo, ch, sticky, outside, x - baseX)
  }

  function coordsBidiPart(cm, lineObj, lineNo, preparedMeasure, order, x, y) {
    // Bidi parts are sorted left-to-right, and in a non-line-wrapping
    // situation, we can take this ordering to correspond to the visual
    // ordering. This finds the first part whose end is after the given
    // coordinates.
    var index = findFirst(function (i) {
      var part = order[i], ltr = part.level != 1;
      return boxIsAfter(cursorCoords(cm, Pos(lineNo, ltr ? part.to : part.from, ltr ? "before" : "after"),
                                     "line", lineObj, preparedMeasure), x, y, true)
    }, 0, order.length - 1);
    var part = order[index];
    // If this isn't the first part, the part's start is also after
    // the coordinates, and the coordinates aren't on the same line as
    // that start, move one part back.
    if (index > 0) {
      var ltr = part.level != 1;
      var start = cursorCoords(cm, Pos(lineNo, ltr ? part.from : part.to, ltr ? "after" : "before"),
                               "line", lineObj, preparedMeasure);
      if (boxIsAfter(start, x, y, true) && start.top > y)
        { part = order[index - 1]; }
    }
    return part
  }

  function coordsBidiPartWrapped(cm, lineObj, _lineNo, preparedMeasure, order, x, y) {
    // In a wrapped line, rtl text on wrapping boundaries can do things
    // that don't correspond to the ordering in our `order` array at
    // all, so a binary search doesn't work, and we want to return a
    // part that only spans one line so that the binary search in
    // coordsCharInner is safe. As such, we first find the extent of the
    // wrapped line, and then do a flat search in which we discard any
    // spans that aren't on the line.
    var ref = wrappedLineExtent(cm, lineObj, preparedMeasure, y);
    var begin = ref.begin;
    var end = ref.end;
    if (/\s/.test(lineObj.text.charAt(end - 1))) { end--; }
    var part = null, closestDist = null;
    for (var i = 0; i < order.length; i++) {
      var p = order[i];
      if (p.from >= end || p.to <= begin) { continue }
      var ltr = p.level != 1;
      var endX = measureCharPrepared(cm, preparedMeasure, ltr ? Math.min(end, p.to) - 1 : Math.max(begin, p.from)).right;
      // Weigh against spans ending before this, so that they are only
      // picked if nothing ends after
      var dist = endX < x ? x - endX + 1e9 : endX - x;
      if (!part || closestDist > dist) {
        part = p;
        closestDist = dist;
      }
    }
    if (!part) { part = order[order.length - 1]; }
    // Clip the part to the wrapped line.
    if (part.from < begin) { part = {from: begin, to: part.to, level: part.level}; }
    if (part.to > end) { part = {from: part.from, to: end, level: part.level}; }
    return part
  }

  var measureText;
  // Compute the default text height.
  function textHeight(display) {
    if (display.cachedTextHeight != null) { return display.cachedTextHeight }
    if (measureText == null) {
      measureText = elt("pre", null, "CodeMirror-line-like");
      // Measure a bunch of lines, for browsers that compute
      // fractional heights.
      for (var i = 0; i < 49; ++i) {
        measureText.appendChild(document.createTextNode("x"));
        measureText.appendChild(elt("br"));
      }
      measureText.appendChild(document.createTextNode("x"));
    }
    removeChildrenAndAdd(display.measure, measureText);
    var height = measureText.offsetHeight / 50;
    if (height > 3) { display.cachedTextHeight = height; }
    removeChildren(display.measure);
    return height || 1
  }

  // Compute the default character width.
  function charWidth(display) {
    if (display.cachedCharWidth != null) { return display.cachedCharWidth }
    var anchor = elt("span", "xxxxxxxxxx");
    var pre = elt("pre", [anchor], "CodeMirror-line-like");
    removeChildrenAndAdd(display.measure, pre);
    var rect = anchor.getBoundingClientRect(), width = (rect.right - rect.left) / 10;
    if (width > 2) { display.cachedCharWidth = width; }
    return width || 10
  }

  // Do a bulk-read of the DOM positions and sizes needed to draw the
  // view, so that we don't interleave reading and writing to the DOM.
  function getDimensions(cm) {
    var d = cm.display, left = {}, width = {};
    var gutterLeft = d.gutters.clientLeft;
    for (var n = d.gutters.firstChild, i = 0; n; n = n.nextSibling, ++i) {
      var id = cm.display.gutterSpecs[i].className;
      left[id] = n.offsetLeft + n.clientLeft + gutterLeft;
      width[id] = n.clientWidth;
    }
    return {fixedPos: compensateForHScroll(d),
            gutterTotalWidth: d.gutters.offsetWidth,
            gutterLeft: left,
            gutterWidth: width,
            wrapperWidth: d.wrapper.clientWidth}
  }

  // Computes display.scroller.scrollLeft + display.gutters.offsetWidth,
  // but using getBoundingClientRect to get a sub-pixel-accurate
  // result.
  function compensateForHScroll(display) {
    return display.scroller.getBoundingClientRect().left - display.sizer.getBoundingClientRect().left
  }

  // Returns a function that estimates the height of a line, to use as
  // first approximation until the line becomes visible (and is thus
  // properly measurable).
  function estimateHeight(cm) {
    var th = textHeight(cm.display), wrapping = cm.options.lineWrapping;
    var perLine = wrapping && Math.max(5, cm.display.scroller.clientWidth / charWidth(cm.display) - 3);
    return function (line) {
      if (lineIsHidden(cm.doc, line)) { return 0 }

      var widgetsHeight = 0;
      if (line.widgets) { for (var i = 0; i < line.widgets.length; i++) {
        if (line.widgets[i].height) { widgetsHeight += line.widgets[i].height; }
      } }

      if (wrapping)
        { return widgetsHeight + (Math.ceil(line.text.length / perLine) || 1) * th }
      else
        { return widgetsHeight + th }
    }
  }

  function estimateLineHeights(cm) {
    var doc = cm.doc, est = estimateHeight(cm);
    doc.iter(function (line) {
      var estHeight = est(line);
      if (estHeight != line.height) { updateLineHeight(line, estHeight); }
    });
  }

  // Given a mouse event, find the corresponding position. If liberal
  // is false, it checks whether a gutter or scrollbar was clicked,
  // and returns null if it was. forRect is used by rectangular
  // selections, and tries to estimate a character position even for
  // coordinates beyond the right of the text.
  function posFromMouse(cm, e, liberal, forRect) {
    var display = cm.display;
    if (!liberal && e_target(e).getAttribute("cm-not-content") == "true") { return null }

    var x, y, space = display.lineSpace.getBoundingClientRect();
    // Fails unpredictably on IE[67] when mouse is dragged around quickly.
    try { x = e.clientX - space.left; y = e.clientY - space.top; }
    catch (e$1) { return null }
    var coords = coordsChar(cm, x, y), line;
    if (forRect && coords.xRel > 0 && (line = getLine(cm.doc, coords.line).text).length == coords.ch) {
      var colDiff = countColumn(line, line.length, cm.options.tabSize) - line.length;
      coords = Pos(coords.line, Math.max(0, Math.round((x - paddingH(cm.display).left) / charWidth(cm.display)) - colDiff));
    }
    return coords
  }

  // Find the view element corresponding to a given line. Return null
  // when the line isn't visible.
  function findViewIndex(cm, n) {
    if (n >= cm.display.viewTo) { return null }
    n -= cm.display.viewFrom;
    if (n < 0) { return null }
    var view = cm.display.view;
    for (var i = 0; i < view.length; i++) {
      n -= view[i].size;
      if (n < 0) { return i }
    }
  }

  // Updates the display.view data structure for a given change to the
  // document. From and to are in pre-change coordinates. Lendiff is
  // the amount of lines added or subtracted by the change. This is
  // used for changes that span multiple lines, or change the way
  // lines are divided into visual lines. regLineChange (below)
  // registers single-line changes.
  function regChange(cm, from, to, lendiff) {
    if (from == null) { from = cm.doc.first; }
    if (to == null) { to = cm.doc.first + cm.doc.size; }
    if (!lendiff) { lendiff = 0; }

    var display = cm.display;
    if (lendiff && to < display.viewTo &&
        (display.updateLineNumbers == null || display.updateLineNumbers > from))
      { display.updateLineNumbers = from; }

    cm.curOp.viewChanged = true;

    if (from >= display.viewTo) { // Change after
      if (sawCollapsedSpans && visualLineNo(cm.doc, from) < display.viewTo)
        { resetView(cm); }
    } else if (to <= display.viewFrom) { // Change before
      if (sawCollapsedSpans && visualLineEndNo(cm.doc, to + lendiff) > display.viewFrom) {
        resetView(cm);
      } else {
        display.viewFrom += lendiff;
        display.viewTo += lendiff;
      }
    } else if (from <= display.viewFrom && to >= display.viewTo) { // Full overlap
      resetView(cm);
    } else if (from <= display.viewFrom) { // Top overlap
      var cut = viewCuttingPoint(cm, to, to + lendiff, 1);
      if (cut) {
        display.view = display.view.slice(cut.index);
        display.viewFrom = cut.lineN;
        display.viewTo += lendiff;
      } else {
        resetView(cm);
      }
    } else if (to >= display.viewTo) { // Bottom overlap
      var cut$1 = viewCuttingPoint(cm, from, from, -1);
      if (cut$1) {
        display.view = display.view.slice(0, cut$1.index);
        display.viewTo = cut$1.lineN;
      } else {
        resetView(cm);
      }
    } else { // Gap in the middle
      var cutTop = viewCuttingPoint(cm, from, from, -1);
      var cutBot = viewCuttingPoint(cm, to, to + lendiff, 1);
      if (cutTop && cutBot) {
        display.view = display.view.slice(0, cutTop.index)
          .concat(buildViewArray(cm, cutTop.lineN, cutBot.lineN))
          .concat(display.view.slice(cutBot.index));
        display.viewTo += lendiff;
      } else {
        resetView(cm);
      }
    }

    var ext = display.externalMeasured;
    if (ext) {
      if (to < ext.lineN)
        { ext.lineN += lendiff; }
      else if (from < ext.lineN + ext.size)
        { display.externalMeasured = null; }
    }
  }

  // Register a change to a single line. Type must be one of "text",
  // "gutter", "class", "widget"
  function regLineChange(cm, line, type) {
    cm.curOp.viewChanged = true;
    var display = cm.display, ext = cm.display.externalMeasured;
    if (ext && line >= ext.lineN && line < ext.lineN + ext.size)
      { display.externalMeasured = null; }

    if (line < display.viewFrom || line >= display.viewTo) { return }
    var lineView = display.view[findViewIndex(cm, line)];
    if (lineView.node == null) { return }
    var arr = lineView.changes || (lineView.changes = []);
    if (indexOf(arr, type) == -1) { arr.push(type); }
  }

  // Clear the view.
  function resetView(cm) {
    cm.display.viewFrom = cm.display.viewTo = cm.doc.first;
    cm.display.view = [];
    cm.display.viewOffset = 0;
  }

  function viewCuttingPoint(cm, oldN, newN, dir) {
    var index = findViewIndex(cm, oldN), diff, view = cm.display.view;
    if (!sawCollapsedSpans || newN == cm.doc.first + cm.doc.size)
      { return {index: index, lineN: newN} }
    var n = cm.display.viewFrom;
    for (var i = 0; i < index; i++)
      { n += view[i].size; }
    if (n != oldN) {
      if (dir > 0) {
        if (index == view.length - 1) { return null }
        diff = (n + view[index].size) - oldN;
        index++;
      } else {
        diff = n - oldN;
      }
      oldN += diff; newN += diff;
    }
    while (visualLineNo(cm.doc, newN) != newN) {
      if (index == (dir < 0 ? 0 : view.length - 1)) { return null }
      newN += dir * view[index - (dir < 0 ? 1 : 0)].size;
      index += dir;
    }
    return {index: index, lineN: newN}
  }

  // Force the view to cover a given range, adding empty view element
  // or clipping off existing ones as needed.
  function adjustView(cm, from, to) {
    var display = cm.display, view = display.view;
    if (view.length == 0 || from >= display.viewTo || to <= display.viewFrom) {
      display.view = buildViewArray(cm, from, to);
      display.viewFrom = from;
    } else {
      if (display.viewFrom > from)
        { display.view = buildViewArray(cm, from, display.viewFrom).concat(display.view); }
      else if (display.viewFrom < from)
        { display.view = display.view.slice(findViewIndex(cm, from)); }
      display.viewFrom = from;
      if (display.viewTo < to)
        { display.view = display.view.concat(buildViewArray(cm, display.viewTo, to)); }
      else if (display.viewTo > to)
        { display.view = display.view.slice(0, findViewIndex(cm, to)); }
    }
    display.viewTo = to;
  }

  // Count the number of lines in the view whose DOM representation is
  // out of date (or nonexistent).
  function countDirtyView(cm) {
    var view = cm.display.view, dirty = 0;
    for (var i = 0; i < view.length; i++) {
      var lineView = view[i];
      if (!lineView.hidden && (!lineView.node || lineView.changes)) { ++dirty; }
    }
    return dirty
  }

  function updateSelection(cm) {
    cm.display.input.showSelection(cm.display.input.prepareSelection());
  }

  function prepareSelection(cm, primary) {
    if ( primary === void 0 ) primary = true;

    var doc = cm.doc, result = {};
    var curFragment = result.cursors = document.createDocumentFragment();
    var selFragment = result.selection = document.createDocumentFragment();

    for (var i = 0; i < doc.sel.ranges.length; i++) {
      if (!primary && i == doc.sel.primIndex) { continue }
      var range = doc.sel.ranges[i];
      if (range.from().line >= cm.display.viewTo || range.to().line < cm.display.viewFrom) { continue }
      var collapsed = range.empty();
      if (collapsed || cm.options.showCursorWhenSelecting)
        { drawSelectionCursor(cm, range.head, curFragment); }
      if (!collapsed)
        { drawSelectionRange(cm, range, selFragment); }
    }
    return result
  }

  // Draws a cursor for the given range
  function drawSelectionCursor(cm, head, output) {
    var pos = cursorCoords(cm, head, "div", null, null, !cm.options.singleCursorHeightPerLine);

    var cursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor"));
    cursor.style.left = pos.left + "px";
    cursor.style.top = pos.top + "px";
    cursor.style.height = Math.max(0, pos.bottom - pos.top) * cm.options.cursorHeight + "px";

    if (/\bcm-fat-cursor\b/.test(cm.getWrapperElement().className)) {
      var charPos = charCoords(cm, head, "div", null, null);
      if (charPos.right - charPos.left > 0) {
        cursor.style.width = (charPos.right - charPos.left) + "px";
      }
    }

    if (pos.other) {
      // Secondary cursor, shown when on a 'jump' in bi-directional text
      var otherCursor = output.appendChild(elt("div", "\u00a0", "CodeMirror-cursor CodeMirror-secondarycursor"));
      otherCursor.style.display = "";
      otherCursor.style.left = pos.other.left + "px";
      otherCursor.style.top = pos.other.top + "px";
      otherCursor.style.height = (pos.other.bottom - pos.other.top) * .85 + "px";
    }
  }

  function cmpCoords(a, b) { return a.top - b.top || a.left - b.left }

  // Draws the given range as a highlighted selection
  function drawSelectionRange(cm, range, output) {
    var display = cm.display, doc = cm.doc;
    var fragment = document.createDocumentFragment();
    var padding = paddingH(cm.display), leftSide = padding.left;
    var rightSide = Math.max(display.sizerWidth, displayWidth(cm) - display.sizer.offsetLeft) - padding.right;
    var docLTR = doc.direction == "ltr";

    function add(left, top, width, bottom) {
      if (top < 0) { top = 0; }
      top = Math.round(top);
      bottom = Math.round(bottom);
      fragment.appendChild(elt("div", null, "CodeMirror-selected", ("position: absolute; left: " + left + "px;\n                             top: " + top + "px; width: " + (width == null ? rightSide - left : width) + "px;\n                             height: " + (bottom - top) + "px")));
    }

    function drawForLine(line, fromArg, toArg) {
      var lineObj = getLine(doc, line);
      var lineLen = lineObj.text.length;
      var start, end;
      function coords(ch, bias) {
        return charCoords(cm, Pos(line, ch), "div", lineObj, bias)
      }

      function wrapX(pos, dir, side) {
        var extent = wrappedLineExtentChar(cm, lineObj, null, pos);
        var prop = (dir == "ltr") == (side == "after") ? "left" : "right";
        var ch = side == "after" ? extent.begin : extent.end - (/\s/.test(lineObj.text.charAt(extent.end - 1)) ? 2 : 1);
        return coords(ch, prop)[prop]
      }

      var order = getOrder(lineObj, doc.direction);
      iterateBidiSections(order, fromArg || 0, toArg == null ? lineLen : toArg, function (from, to, dir, i) {
        var ltr = dir == "ltr";
        var fromPos = coords(from, ltr ? "left" : "right");
        var toPos = coords(to - 1, ltr ? "right" : "left");

        var openStart = fromArg == null && from == 0, openEnd = toArg == null && to == lineLen;
        var first = i == 0, last = !order || i == order.length - 1;
        if (toPos.top - fromPos.top <= 3) { // Single line
          var openLeft = (docLTR ? openStart : openEnd) && first;
          var openRight = (docLTR ? openEnd : openStart) && last;
          var left = openLeft ? leftSide : (ltr ? fromPos : toPos).left;
          var right = openRight ? rightSide : (ltr ? toPos : fromPos).right;
          add(left, fromPos.top, right - left, fromPos.bottom);
        } else { // Multiple lines
          var topLeft, topRight, botLeft, botRight;
          if (ltr) {
            topLeft = docLTR && openStart && first ? leftSide : fromPos.left;
            topRight = docLTR ? rightSide : wrapX(from, dir, "before");
            botLeft = docLTR ? leftSide : wrapX(to, dir, "after");
            botRight = docLTR && openEnd && last ? rightSide : toPos.right;
          } else {
            topLeft = !docLTR ? leftSide : wrapX(from, dir, "before");
            topRight = !docLTR && openStart && first ? rightSide : fromPos.right;
            botLeft = !docLTR && openEnd && last ? leftSide : toPos.left;
            botRight = !docLTR ? rightSide : wrapX(to, dir, "after");
          }
          add(topLeft, fromPos.top, topRight - topLeft, fromPos.bottom);
          if (fromPos.bottom < toPos.top) { add(leftSide, fromPos.bottom, null, toPos.top); }
          add(botLeft, toPos.top, botRight - botLeft, toPos.bottom);
        }

        if (!start || cmpCoords(fromPos, start) < 0) { start = fromPos; }
        if (cmpCoords(toPos, start) < 0) { start = toPos; }
        if (!end || cmpCoords(fromPos, end) < 0) { end = fromPos; }
        if (cmpCoords(toPos, end) < 0) { end = toPos; }
      });
      return {start: start, end: end}
    }

    var sFrom = range.from(), sTo = range.to();
    if (sFrom.line == sTo.line) {
      drawForLine(sFrom.line, sFrom.ch, sTo.ch);
    } else {
      var fromLine = getLine(doc, sFrom.line), toLine = getLine(doc, sTo.line);
      var singleVLine = visualLine(fromLine) == visualLine(toLine);
      var leftEnd = drawForLine(sFrom.line, sFrom.ch, singleVLine ? fromLine.text.length + 1 : null).end;
      var rightStart = drawForLine(sTo.line, singleVLine ? 0 : null, sTo.ch).start;
      if (singleVLine) {
        if (leftEnd.top < rightStart.top - 2) {
          add(leftEnd.right, leftEnd.top, null, leftEnd.bottom);
          add(leftSide, rightStart.top, rightStart.left, rightStart.bottom);
        } else {
          add(leftEnd.right, leftEnd.top, rightStart.left - leftEnd.right, leftEnd.bottom);
        }
      }
      if (leftEnd.bottom < rightStart.top)
        { add(leftSide, leftEnd.bottom, null, rightStart.top); }
    }

    output.appendChild(fragment);
  }

  // Cursor-blinking
  function restartBlink(cm) {
    if (!cm.state.focused) { return }
    var display = cm.display;
    clearInterval(display.blinker);
    var on = true;
    display.cursorDiv.style.visibility = "";
    if (cm.options.cursorBlinkRate > 0)
      { display.blinker = setInterval(function () {
        if (!cm.hasFocus()) { onBlur(cm); }
        display.cursorDiv.style.visibility = (on = !on) ? "" : "hidden";
      }, cm.options.cursorBlinkRate); }
    else if (cm.options.cursorBlinkRate < 0)
      { display.cursorDiv.style.visibility = "hidden"; }
  }

  function ensureFocus(cm) {
    if (!cm.hasFocus()) {
      cm.display.input.focus();
      if (!cm.state.focused) { onFocus(cm); }
    }
  }

  function delayBlurEvent(cm) {
    cm.state.delayingBlurEvent = true;
    setTimeout(function () { if (cm.state.delayingBlurEvent) {
      cm.state.delayingBlurEvent = false;
      if (cm.state.focused) { onBlur(cm); }
    } }, 100);
  }

  function onFocus(cm, e) {
    if (cm.state.delayingBlurEvent && !cm.state.draggingText) { cm.state.delayingBlurEvent = false; }

    if (cm.options.readOnly == "nocursor") { return }
    if (!cm.state.focused) {
      signal(cm, "focus", cm, e);
      cm.state.focused = true;
      addClass(cm.display.wrapper, "CodeMirror-focused");
      // This test prevents this from firing when a context
      // menu is closed (since the input reset would kill the
      // select-all detection hack)
      if (!cm.curOp && cm.display.selForContextMenu != cm.doc.sel) {
        cm.display.input.reset();
        if (webkit) { setTimeout(function () { return cm.display.input.reset(true); }, 20); } // Issue #1730
      }
      cm.display.input.receivedFocus();
    }
    restartBlink(cm);
  }
  function onBlur(cm, e) {
    if (cm.state.delayingBlurEvent) { return }

    if (cm.state.focused) {
      signal(cm, "blur", cm, e);
      cm.state.focused = false;
      rmClass(cm.display.wrapper, "CodeMirror-focused");
    }
    clearInterval(cm.display.blinker);
    setTimeout(function () { if (!cm.state.focused) { cm.display.shift = false; } }, 150);
  }

  // Read the actual heights of the rendered lines, and update their
  // stored heights to match.
  function updateHeightsInViewport(cm) {
    var display = cm.display;
    var prevBottom = display.lineDiv.offsetTop;
    var viewTop = Math.max(0, display.scroller.getBoundingClientRect().top);
    var oldHeight = display.lineDiv.getBoundingClientRect().top;
    var mustScroll = 0;
    for (var i = 0; i < display.view.length; i++) {
      var cur = display.view[i], wrapping = cm.options.lineWrapping;
      var height = (void 0), width = 0;
      if (cur.hidden) { continue }
      oldHeight += cur.line.height;
      if (ie && ie_version < 8) {
        var bot = cur.node.offsetTop + cur.node.offsetHeight;
        height = bot - prevBottom;
        prevBottom = bot;
      } else {
        var box = cur.node.getBoundingClientRect();
        height = box.bottom - box.top;
        // Check that lines don't extend past the right of the current
        // editor width
        if (!wrapping && cur.text.firstChild)
          { width = cur.text.firstChild.getBoundingClientRect().right - box.left - 1; }
      }
      var diff = cur.line.height - height;
      if (diff > .005 || diff < -.005) {
        if (oldHeight < viewTop) { mustScroll -= diff; }
        updateLineHeight(cur.line, height);
        updateWidgetHeight(cur.line);
        if (cur.rest) { for (var j = 0; j < cur.rest.length; j++)
          { updateWidgetHeight(cur.rest[j]); } }
      }
      if (width > cm.display.sizerWidth) {
        var chWidth = Math.ceil(width / charWidth(cm.display));
        if (chWidth > cm.display.maxLineLength) {
          cm.display.maxLineLength = chWidth;
          cm.display.maxLine = cur.line;
          cm.display.maxLineChanged = true;
        }
      }
    }
    if (Math.abs(mustScroll) > 2) { display.scroller.scrollTop += mustScroll; }
  }

  // Read and store the height of line widgets associated with the
  // given line.
  function updateWidgetHeight(line) {
    if (line.widgets) { for (var i = 0; i < line.widgets.length; ++i) {
      var w = line.widgets[i], parent = w.node.parentNode;
      if (parent) { w.height = parent.offsetHeight; }
    } }
  }

  // Compute the lines that are visible in a given viewport (defaults
  // the the current scroll position). viewport may contain top,
  // height, and ensure (see op.scrollToPos) properties.
  function visibleLines(display, doc, viewport) {
    var top = viewport && viewport.top != null ? Math.max(0, viewport.top) : display.scroller.scrollTop;
    top = Math.floor(top - paddingTop(display));
    var bottom = viewport && viewport.bottom != null ? viewport.bottom : top + display.wrapper.clientHeight;

    var from = lineAtHeight(doc, top), to = lineAtHeight(doc, bottom);
    // Ensure is a {from: {line, ch}, to: {line, ch}} object, and
    // forces those lines into the viewport (if possible).
    if (viewport && viewport.ensure) {
      var ensureFrom = viewport.ensure.from.line, ensureTo = viewport.ensure.to.line;
      if (ensureFrom < from) {
        from = ensureFrom;
        to = lineAtHeight(doc, heightAtLine(getLine(doc, ensureFrom)) + display.wrapper.clientHeight);
      } else if (Math.min(ensureTo, doc.lastLine()) >= to) {
        from = lineAtHeight(doc, heightAtLine(getLine(doc, ensureTo)) - display.wrapper.clientHeight);
        to = ensureTo;
      }
    }
    return {from: from, to: Math.max(to, from + 1)}
  }

  // SCROLLING THINGS INTO VIEW

  // If an editor sits on the top or bottom of the window, partially
  // scrolled out of view, this ensures that the cursor is visible.
  function maybeScrollWindow(cm, rect) {
    if (signalDOMEvent(cm, "scrollCursorIntoView")) { return }

    var display = cm.display, box = display.sizer.getBoundingClientRect(), doScroll = null;
    if (rect.top + box.top < 0) { doScroll = true; }
    else if (rect.bottom + box.top > (window.innerHeight || document.documentElement.clientHeight)) { doScroll = false; }
    if (doScroll != null && !phantom) {
      var scrollNode = elt("div", "\u200b", null, ("position: absolute;\n                         top: " + (rect.top - display.viewOffset - paddingTop(cm.display)) + "px;\n                         height: " + (rect.bottom - rect.top + scrollGap(cm) + display.barHeight) + "px;\n                         left: " + (rect.left) + "px; width: " + (Math.max(2, rect.right - rect.left)) + "px;"));
      cm.display.lineSpace.appendChild(scrollNode);
      scrollNode.scrollIntoView(doScroll);
      cm.display.lineSpace.removeChild(scrollNode);
    }
  }

  // Scroll a given position into view (immediately), verifying that
  // it actually became visible (as line heights are accurately
  // measured, the position of something may 'drift' during drawing).
  function scrollPosIntoView(cm, pos, end, margin) {
    if (margin == null) { margin = 0; }
    var rect;
    if (!cm.options.lineWrapping && pos == end) {
      // Set pos and end to the cursor positions around the character pos sticks to
      // If pos.sticky == "before", that is around pos.ch - 1, otherwise around pos.ch
      // If pos == Pos(_, 0, "before"), pos and end are unchanged
      end = pos.sticky == "before" ? Pos(pos.line, pos.ch + 1, "before") : pos;
      pos = pos.ch ? Pos(pos.line, pos.sticky == "before" ? pos.ch - 1 : pos.ch, "after") : pos;
    }
    for (var limit = 0; limit < 5; limit++) {
      var changed = false;
      var coords = cursorCoords(cm, pos);
      var endCoords = !end || end == pos ? coords : cursorCoords(cm, end);
      rect = {left: Math.min(coords.left, endCoords.left),
              top: Math.min(coords.top, endCoords.top) - margin,
              right: Math.max(coords.left, endCoords.left),
              bottom: Math.max(coords.bottom, endCoords.bottom) + margin};
      var scrollPos = calculateScrollPos(cm, rect);
      var startTop = cm.doc.scrollTop, startLeft = cm.doc.scrollLeft;
      if (scrollPos.scrollTop != null) {
        updateScrollTop(cm, scrollPos.scrollTop);
        if (Math.abs(cm.doc.scrollTop - startTop) > 1) { changed = true; }
      }
      if (scrollPos.scrollLeft != null) {
        setScrollLeft(cm, scrollPos.scrollLeft);
        if (Math.abs(cm.doc.scrollLeft - startLeft) > 1) { changed = true; }
      }
      if (!changed) { break }
    }
    return rect
  }

  // Scroll a given set of coordinates into view (immediately).
  function scrollIntoView(cm, rect) {
    var scrollPos = calculateScrollPos(cm, rect);
    if (scrollPos.scrollTop != null) { updateScrollTop(cm, scrollPos.scrollTop); }
    if (scrollPos.scrollLeft != null) { setScrollLeft(cm, scrollPos.scrollLeft); }
  }

  // Calculate a new scroll position needed to scroll the given
  // rectangle into view. Returns an object with scrollTop and
  // scrollLeft properties. When these are undefined, the
  // vertical/horizontal position does not need to be adjusted.
  function calculateScrollPos(cm, rect) {
    var display = cm.display, snapMargin = textHeight(cm.display);
    if (rect.top < 0) { rect.top = 0; }
    var screentop = cm.curOp && cm.curOp.scrollTop != null ? cm.curOp.scrollTop : display.scroller.scrollTop;
    var screen = displayHeight(cm), result = {};
    if (rect.bottom - rect.top > screen) { rect.bottom = rect.top + screen; }
    var docBottom = cm.doc.height + paddingVert(display);
    var atTop = rect.top < snapMargin, atBottom = rect.bottom > docBottom - snapMargin;
    if (rect.top < screentop) {
      result.scrollTop = atTop ? 0 : rect.top;
    } else if (rect.bottom > screentop + screen) {
      var newTop = Math.min(rect.top, (atBottom ? docBottom : rect.bottom) - screen);
      if (newTop != screentop) { result.scrollTop = newTop; }
    }

    var gutterSpace = cm.options.fixedGutter ? 0 : display.gutters.offsetWidth;
    var screenleft = cm.curOp && cm.curOp.scrollLeft != null ? cm.curOp.scrollLeft : display.scroller.scrollLeft - gutterSpace;
    var screenw = displayWidth(cm) - display.gutters.offsetWidth;
    var tooWide = rect.right - rect.left > screenw;
    if (tooWide) { rect.right = rect.left + screenw; }
    if (rect.left < 10)
      { result.scrollLeft = 0; }
    else if (rect.left < screenleft)
      { result.scrollLeft = Math.max(0, rect.left + gutterSpace - (tooWide ? 0 : 10)); }
    else if (rect.right > screenw + screenleft - 3)
      { result.scrollLeft = rect.right + (tooWide ? 0 : 10) - screenw; }
    return result
  }

  // Store a relative adjustment to the scroll position in the current
  // operation (to be applied when the operation finishes).
  function addToScrollTop(cm, top) {
    if (top == null) { return }
    resolveScrollToPos(cm);
    cm.curOp.scrollTop = (cm.curOp.scrollTop == null ? cm.doc.scrollTop : cm.curOp.scrollTop) + top;
  }

  // Make sure that at the end of the operation the current cursor is
  // shown.
  function ensureCursorVisible(cm) {
    resolveScrollToPos(cm);
    var cur = cm.getCursor();
    cm.curOp.scrollToPos = {from: cur, to: cur, margin: cm.options.cursorScrollMargin};
  }

  function scrollToCoords(cm, x, y) {
    if (x != null || y != null) { resolveScrollToPos(cm); }
    if (x != null) { cm.curOp.scrollLeft = x; }
    if (y != null) { cm.curOp.scrollTop = y; }
  }

  function scrollToRange(cm, range) {
    resolveScrollToPos(cm);
    cm.curOp.scrollToPos = range;
  }

  // When an operation has its scrollToPos property set, and another
  // scroll action is applied before the end of the operation, this
  // 'simulates' scrolling that position into view in a cheap way, so
  // that the effect of intermediate scroll commands is not ignored.
  function resolveScrollToPos(cm) {
    var range = cm.curOp.scrollToPos;
    if (range) {
      cm.curOp.scrollToPos = null;
      var from = estimateCoords(cm, range.from), to = estimateCoords(cm, range.to);
      scrollToCoordsRange(cm, from, to, range.margin);
    }
  }

  function scrollToCoordsRange(cm, from, to, margin) {
    var sPos = calculateScrollPos(cm, {
      left: Math.min(from.left, to.left),
      top: Math.min(from.top, to.top) - margin,
      right: Math.max(from.right, to.right),
      bottom: Math.max(from.bottom, to.bottom) + margin
    });
    scrollToCoords(cm, sPos.scrollLeft, sPos.scrollTop);
  }

  // Sync the scrollable area and scrollbars, ensure the viewport
  // covers the visible area.
  function updateScrollTop(cm, val) {
    if (Math.abs(cm.doc.scrollTop - val) < 2) { return }
    if (!gecko) { updateDisplaySimple(cm, {top: val}); }
    setScrollTop(cm, val, true);
    if (gecko) { updateDisplaySimple(cm); }
    startWorker(cm, 100);
  }

  function setScrollTop(cm, val, forceScroll) {
    val = Math.max(0, Math.min(cm.display.scroller.scrollHeight - cm.display.scroller.clientHeight, val));
    if (cm.display.scroller.scrollTop == val && !forceScroll) { return }
    cm.doc.scrollTop = val;
    cm.display.scrollbars.setScrollTop(val);
    if (cm.display.scroller.scrollTop != val) { cm.display.scroller.scrollTop = val; }
  }

  // Sync scroller and scrollbar, ensure the gutter elements are
  // aligned.
  function setScrollLeft(cm, val, isScroller, forceScroll) {
    val = Math.max(0, Math.min(val, cm.display.scroller.scrollWidth - cm.display.scroller.clientWidth));
    if ((isScroller ? val == cm.doc.scrollLeft : Math.abs(cm.doc.scrollLeft - val) < 2) && !forceScroll) { return }
    cm.doc.scrollLeft = val;
    alignHorizontally(cm);
    if (cm.display.scroller.scrollLeft != val) { cm.display.scroller.scrollLeft = val; }
    cm.display.scrollbars.setScrollLeft(val);
  }

  // SCROLLBARS

  // Prepare DOM reads needed to update the scrollbars. Done in one
  // shot to minimize update/measure roundtrips.
  function measureForScrollbars(cm) {
    var d = cm.display, gutterW = d.gutters.offsetWidth;
    var docH = Math.round(cm.doc.height + paddingVert(cm.display));
    return {
      clientHeight: d.scroller.clientHeight,
      viewHeight: d.wrapper.clientHeight,
      scrollWidth: d.scroller.scrollWidth, clientWidth: d.scroller.clientWidth,
      viewWidth: d.wrapper.clientWidth,
      barLeft: cm.options.fixedGutter ? gutterW : 0,
      docHeight: docH,
      scrollHeight: docH + scrollGap(cm) + d.barHeight,
      nativeBarWidth: d.nativeBarWidth,
      gutterWidth: gutterW
    }
  }

  var NativeScrollbars = function(place, scroll, cm) {
    this.cm = cm;
    var vert = this.vert = elt("div", [elt("div", null, null, "min-width: 1px")], "CodeMirror-vscrollbar");
    var horiz = this.horiz = elt("div", [elt("div", null, null, "height: 100%; min-height: 1px")], "CodeMirror-hscrollbar");
    vert.tabIndex = horiz.tabIndex = -1;
    place(vert); place(horiz);

    on(vert, "scroll", function () {
      if (vert.clientHeight) { scroll(vert.scrollTop, "vertical"); }
    });
    on(horiz, "scroll", function () {
      if (horiz.clientWidth) { scroll(horiz.scrollLeft, "horizontal"); }
    });

    this.checkedZeroWidth = false;
    // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
    if (ie && ie_version < 8) { this.horiz.style.minHeight = this.vert.style.minWidth = "18px"; }
  };

  NativeScrollbars.prototype.update = function (measure) {
    var needsH = measure.scrollWidth > measure.clientWidth + 1;
    var needsV = measure.scrollHeight > measure.clientHeight + 1;
    var sWidth = measure.nativeBarWidth;

    if (needsV) {
      this.vert.style.display = "block";
      this.vert.style.bottom = needsH ? sWidth + "px" : "0";
      var totalHeight = measure.viewHeight - (needsH ? sWidth : 0);
      // A bug in IE8 can cause this value to be negative, so guard it.
      this.vert.firstChild.style.height =
        Math.max(0, measure.scrollHeight - measure.clientHeight + totalHeight) + "px";
    } else {
      this.vert.style.display = "";
      this.vert.firstChild.style.height = "0";
    }

    if (needsH) {
      this.horiz.style.display = "block";
      this.horiz.style.right = needsV ? sWidth + "px" : "0";
      this.horiz.style.left = measure.barLeft + "px";
      var totalWidth = measure.viewWidth - measure.barLeft - (needsV ? sWidth : 0);
      this.horiz.firstChild.style.width =
        Math.max(0, measure.scrollWidth - measure.clientWidth + totalWidth) + "px";
    } else {
      this.horiz.style.display = "";
      this.horiz.firstChild.style.width = "0";
    }

    if (!this.checkedZeroWidth && measure.clientHeight > 0) {
      if (sWidth == 0) { this.zeroWidthHack(); }
      this.checkedZeroWidth = true;
    }

    return {right: needsV ? sWidth : 0, bottom: needsH ? sWidth : 0}
  };

  NativeScrollbars.prototype.setScrollLeft = function (pos) {
    if (this.horiz.scrollLeft != pos) { this.horiz.scrollLeft = pos; }
    if (this.disableHoriz) { this.enableZeroWidthBar(this.horiz, this.disableHoriz, "horiz"); }
  };

  NativeScrollbars.prototype.setScrollTop = function (pos) {
    if (this.vert.scrollTop != pos) { this.vert.scrollTop = pos; }
    if (this.disableVert) { this.enableZeroWidthBar(this.vert, this.disableVert, "vert"); }
  };

  NativeScrollbars.prototype.zeroWidthHack = function () {
    var w = mac && !mac_geMountainLion ? "12px" : "18px";
    this.horiz.style.height = this.vert.style.width = w;
    this.horiz.style.pointerEvents = this.vert.style.pointerEvents = "none";
    this.disableHoriz = new Delayed;
    this.disableVert = new Delayed;
  };

  NativeScrollbars.prototype.enableZeroWidthBar = function (bar, delay, type) {
    bar.style.pointerEvents = "auto";
    function maybeDisable() {
      // To find out whether the scrollbar is still visible, we
      // check whether the element under the pixel in the bottom
      // right corner of the scrollbar box is the scrollbar box
      // itself (when the bar is still visible) or its filler child
      // (when the bar is hidden). If it is still visible, we keep
      // it enabled, if it's hidden, we disable pointer events.
      var box = bar.getBoundingClientRect();
      var elt = type == "vert" ? document.elementFromPoint(box.right - 1, (box.top + box.bottom) / 2)
          : document.elementFromPoint((box.right + box.left) / 2, box.bottom - 1);
      if (elt != bar) { bar.style.pointerEvents = "none"; }
      else { delay.set(1000, maybeDisable); }
    }
    delay.set(1000, maybeDisable);
  };

  NativeScrollbars.prototype.clear = function () {
    var parent = this.horiz.parentNode;
    parent.removeChild(this.horiz);
    parent.removeChild(this.vert);
  };

  var NullScrollbars = function () {};

  NullScrollbars.prototype.update = function () { return {bottom: 0, right: 0} };
  NullScrollbars.prototype.setScrollLeft = function () {};
  NullScrollbars.prototype.setScrollTop = function () {};
  NullScrollbars.prototype.clear = function () {};

  function updateScrollbars(cm, measure) {
    if (!measure) { measure = measureForScrollbars(cm); }
    var startWidth = cm.display.barWidth, startHeight = cm.display.barHeight;
    updateScrollbarsInner(cm, measure);
    for (var i = 0; i < 4 && startWidth != cm.display.barWidth || startHeight != cm.display.barHeight; i++) {
      if (startWidth != cm.display.barWidth && cm.options.lineWrapping)
        { updateHeightsInViewport(cm); }
      updateScrollbarsInner(cm, measureForScrollbars(cm));
      startWidth = cm.display.barWidth; startHeight = cm.display.barHeight;
    }
  }

  // Re-synchronize the fake scrollbars with the actual size of the
  // content.
  function updateScrollbarsInner(cm, measure) {
    var d = cm.display;
    var sizes = d.scrollbars.update(measure);

    d.sizer.style.paddingRight = (d.barWidth = sizes.right) + "px";
    d.sizer.style.paddingBottom = (d.barHeight = sizes.bottom) + "px";
    d.heightForcer.style.borderBottom = sizes.bottom + "px solid transparent";

    if (sizes.right && sizes.bottom) {
      d.scrollbarFiller.style.display = "block";
      d.scrollbarFiller.style.height = sizes.bottom + "px";
      d.scrollbarFiller.style.width = sizes.right + "px";
    } else { d.scrollbarFiller.style.display = ""; }
    if (sizes.bottom && cm.options.coverGutterNextToScrollbar && cm.options.fixedGutter) {
      d.gutterFiller.style.display = "block";
      d.gutterFiller.style.height = sizes.bottom + "px";
      d.gutterFiller.style.width = measure.gutterWidth + "px";
    } else { d.gutterFiller.style.display = ""; }
  }

  var scrollbarModel = {"native": NativeScrollbars, "null": NullScrollbars};

  function initScrollbars(cm) {
    if (cm.display.scrollbars) {
      cm.display.scrollbars.clear();
      if (cm.display.scrollbars.addClass)
        { rmClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
    }

    cm.display.scrollbars = new scrollbarModel[cm.options.scrollbarStyle](function (node) {
      cm.display.wrapper.insertBefore(node, cm.display.scrollbarFiller);
      // Prevent clicks in the scrollbars from killing focus
      on(node, "mousedown", function () {
        if (cm.state.focused) { setTimeout(function () { return cm.display.input.focus(); }, 0); }
      });
      node.setAttribute("cm-not-content", "true");
    }, function (pos, axis) {
      if (axis == "horizontal") { setScrollLeft(cm, pos); }
      else { updateScrollTop(cm, pos); }
    }, cm);
    if (cm.display.scrollbars.addClass)
      { addClass(cm.display.wrapper, cm.display.scrollbars.addClass); }
  }

  // Operations are used to wrap a series of changes to the editor
  // state in such a way that each change won't have to update the
  // cursor and display (which would be awkward, slow, and
  // error-prone). Instead, display updates are batched and then all
  // combined and executed at once.

  var nextOpId = 0;
  // Start a new operation.
  function startOperation(cm) {
    cm.curOp = {
      cm: cm,
      viewChanged: false,      // Flag that indicates that lines might need to be redrawn
      startHeight: cm.doc.height, // Used to detect need to update scrollbar
      forceUpdate: false,      // Used to force a redraw
      updateInput: 0,       // Whether to reset the input textarea
      typing: false,           // Whether this reset should be careful to leave existing text (for compositing)
      changeObjs: null,        // Accumulated changes, for firing change events
      cursorActivityHandlers: null, // Set of handlers to fire cursorActivity on
      cursorActivityCalled: 0, // Tracks which cursorActivity handlers have been called already
      selectionChanged: false, // Whether the selection needs to be redrawn
      updateMaxLine: false,    // Set when the widest line needs to be determined anew
      scrollLeft: null, scrollTop: null, // Intermediate scroll position, not pushed to DOM yet
      scrollToPos: null,       // Used to scroll to a specific position
      focus: false,
      id: ++nextOpId,          // Unique ID
      markArrays: null         // Used by addMarkedSpan
    };
    pushOperation(cm.curOp);
  }

  // Finish an operation, updating the display and signalling delayed events
  function endOperation(cm) {
    var op = cm.curOp;
    if (op) { finishOperation(op, function (group) {
      for (var i = 0; i < group.ops.length; i++)
        { group.ops[i].cm.curOp = null; }
      endOperations(group);
    }); }
  }

  // The DOM updates done when an operation finishes are batched so
  // that the minimum number of relayouts are required.
  function endOperations(group) {
    var ops = group.ops;
    for (var i = 0; i < ops.length; i++) // Read DOM
      { endOperation_R1(ops[i]); }
    for (var i$1 = 0; i$1 < ops.length; i$1++) // Write DOM (maybe)
      { endOperation_W1(ops[i$1]); }
    for (var i$2 = 0; i$2 < ops.length; i$2++) // Read DOM
      { endOperation_R2(ops[i$2]); }
    for (var i$3 = 0; i$3 < ops.length; i$3++) // Write DOM (maybe)
      { endOperation_W2(ops[i$3]); }
    for (var i$4 = 0; i$4 < ops.length; i$4++) // Read DOM
      { endOperation_finish(ops[i$4]); }
  }

  function endOperation_R1(op) {
    var cm = op.cm, display = cm.display;
    maybeClipScrollbars(cm);
    if (op.updateMaxLine) { findMaxLine(cm); }

    op.mustUpdate = op.viewChanged || op.forceUpdate || op.scrollTop != null ||
      op.scrollToPos && (op.scrollToPos.from.line < display.viewFrom ||
                         op.scrollToPos.to.line >= display.viewTo) ||
      display.maxLineChanged && cm.options.lineWrapping;
    op.update = op.mustUpdate &&
      new DisplayUpdate(cm, op.mustUpdate && {top: op.scrollTop, ensure: op.scrollToPos}, op.forceUpdate);
  }

  function endOperation_W1(op) {
    op.updatedDisplay = op.mustUpdate && updateDisplayIfNeeded(op.cm, op.update);
  }

  function endOperation_R2(op) {
    var cm = op.cm, display = cm.display;
    if (op.updatedDisplay) { updateHeightsInViewport(cm); }

    op.barMeasure = measureForScrollbars(cm);

    // If the max line changed since it was last measured, measure it,
    // and ensure the document's width matches it.
    // updateDisplay_W2 will use these properties to do the actual resizing
    if (display.maxLineChanged && !cm.options.lineWrapping) {
      op.adjustWidthTo = measureChar(cm, display.maxLine, display.maxLine.text.length).left + 3;
      cm.display.sizerWidth = op.adjustWidthTo;
      op.barMeasure.scrollWidth =
        Math.max(display.scroller.clientWidth, display.sizer.offsetLeft + op.adjustWidthTo + scrollGap(cm) + cm.display.barWidth);
      op.maxScrollLeft = Math.max(0, display.sizer.offsetLeft + op.adjustWidthTo - displayWidth(cm));
    }

    if (op.updatedDisplay || op.selectionChanged)
      { op.preparedSelection = display.input.prepareSelection(); }
  }

  function endOperation_W2(op) {
    var cm = op.cm;

    if (op.adjustWidthTo != null) {
      cm.display.sizer.style.minWidth = op.adjustWidthTo + "px";
      if (op.maxScrollLeft < cm.doc.scrollLeft)
        { setScrollLeft(cm, Math.min(cm.display.scroller.scrollLeft, op.maxScrollLeft), true); }
      cm.display.maxLineChanged = false;
    }

    var takeFocus = op.focus && op.focus == activeElt();
    if (op.preparedSelection)
      { cm.display.input.showSelection(op.preparedSelection, takeFocus); }
    if (op.updatedDisplay || op.startHeight != cm.doc.height)
      { updateScrollbars(cm, op.barMeasure); }
    if (op.updatedDisplay)
      { setDocumentHeight(cm, op.barMeasure); }

    if (op.selectionChanged) { restartBlink(cm); }

    if (cm.state.focused && op.updateInput)
      { cm.display.input.reset(op.typing); }
    if (takeFocus) { ensureFocus(op.cm); }
  }

  function endOperation_finish(op) {
    var cm = op.cm, display = cm.display, doc = cm.doc;

    if (op.updatedDisplay) { postUpdateDisplay(cm, op.update); }

    // Abort mouse wheel delta measurement, when scrolling explicitly
    if (display.wheelStartX != null && (op.scrollTop != null || op.scrollLeft != null || op.scrollToPos))
      { display.wheelStartX = display.wheelStartY = null; }

    // Propagate the scroll position to the actual DOM scroller
    if (op.scrollTop != null) { setScrollTop(cm, op.scrollTop, op.forceScroll); }

    if (op.scrollLeft != null) { setScrollLeft(cm, op.scrollLeft, true, true); }
    // If we need to scroll a specific position into view, do so.
    if (op.scrollToPos) {
      var rect = scrollPosIntoView(cm, clipPos(doc, op.scrollToPos.from),
                                   clipPos(doc, op.scrollToPos.to), op.scrollToPos.margin);
      maybeScrollWindow(cm, rect);
    }

    // Fire events for markers that are hidden/unidden by editing or
    // undoing
    var hidden = op.maybeHiddenMarkers, unhidden = op.maybeUnhiddenMarkers;
    if (hidden) { for (var i = 0; i < hidden.length; ++i)
      { if (!hidden[i].lines.length) { signal(hidden[i], "hide"); } } }
    if (unhidden) { for (var i$1 = 0; i$1 < unhidden.length; ++i$1)
      { if (unhidden[i$1].lines.length) { signal(unhidden[i$1], "unhide"); } } }

    if (display.wrapper.offsetHeight)
      { doc.scrollTop = cm.display.scroller.scrollTop; }

    // Fire change events, and delayed event handlers
    if (op.changeObjs)
      { signal(cm, "changes", cm, op.changeObjs); }
    if (op.update)
      { op.update.finish(); }
  }

  // Run the given function in an operation
  function runInOp(cm, f) {
    if (cm.curOp) { return f() }
    startOperation(cm);
    try { return f() }
    finally { endOperation(cm); }
  }
  // Wraps a function in an operation. Returns the wrapped function.
  function operation(cm, f) {
    return function() {
      if (cm.curOp) { return f.apply(cm, arguments) }
      startOperation(cm);
      try { return f.apply(cm, arguments) }
      finally { endOperation(cm); }
    }
  }
  // Used to add methods to editor and doc instances, wrapping them in
  // operations.
  function methodOp(f) {
    return function() {
      if (this.curOp) { return f.apply(this, arguments) }
      startOperation(this);
      try { return f.apply(this, arguments) }
      finally { endOperation(this); }
    }
  }
  function docMethodOp(f) {
    return function() {
      var cm = this.cm;
      if (!cm || cm.curOp) { return f.apply(this, arguments) }
      startOperation(cm);
      try { return f.apply(this, arguments) }
      finally { endOperation(cm); }
    }
  }

  // HIGHLIGHT WORKER

  function startWorker(cm, time) {
    if (cm.doc.highlightFrontier < cm.display.viewTo)
      { cm.state.highlight.set(time, bind(highlightWorker, cm)); }
  }

  function highlightWorker(cm) {
    var doc = cm.doc;
    if (doc.highlightFrontier >= cm.display.viewTo) { return }
    var end = +new Date + cm.options.workTime;
    var context = getContextBefore(cm, doc.highlightFrontier);
    var changedLines = [];

    doc.iter(context.line, Math.min(doc.first + doc.size, cm.display.viewTo + 500), function (line) {
      if (context.line >= cm.display.viewFrom) { // Visible
        var oldStyles = line.styles;
        var resetState = line.text.length > cm.options.maxHighlightLength ? copyState(doc.mode, context.state) : null;
        var highlighted = highlightLine(cm, line, context, true);
        if (resetState) { context.state = resetState; }
        line.styles = highlighted.styles;
        var oldCls = line.styleClasses, newCls = highlighted.classes;
        if (newCls) { line.styleClasses = newCls; }
        else if (oldCls) { line.styleClasses = null; }
        var ischange = !oldStyles || oldStyles.length != line.styles.length ||
          oldCls != newCls && (!oldCls || !newCls || oldCls.bgClass != newCls.bgClass || oldCls.textClass != newCls.textClass);
        for (var i = 0; !ischange && i < oldStyles.length; ++i) { ischange = oldStyles[i] != line.styles[i]; }
        if (ischange) { changedLines.push(context.line); }
        line.stateAfter = context.save();
        context.nextLine();
      } else {
        if (line.text.length <= cm.options.maxHighlightLength)
          { processLine(cm, line.text, context); }
        line.stateAfter = context.line % 5 == 0 ? context.save() : null;
        context.nextLine();
      }
      if (+new Date > end) {
        startWorker(cm, cm.options.workDelay);
        return true
      }
    });
    doc.highlightFrontier = context.line;
    doc.modeFrontier = Math.max(doc.modeFrontier, context.line);
    if (changedLines.length) { runInOp(cm, function () {
      for (var i = 0; i < changedLines.length; i++)
        { regLineChange(cm, changedLines[i], "text"); }
    }); }
  }

  // DISPLAY DRAWING

  var DisplayUpdate = function(cm, viewport, force) {
    var display = cm.display;

    this.viewport = viewport;
    // Store some values that we'll need later (but don't want to force a relayout for)
    this.visible = visibleLines(display, cm.doc, viewport);
    this.editorIsHidden = !display.wrapper.offsetWidth;
    this.wrapperHeight = display.wrapper.clientHeight;
    this.wrapperWidth = display.wrapper.clientWidth;
    this.oldDisplayWidth = displayWidth(cm);
    this.force = force;
    this.dims = getDimensions(cm);
    this.events = [];
  };

  DisplayUpdate.prototype.signal = function (emitter, type) {
    if (hasHandler(emitter, type))
      { this.events.push(arguments); }
  };
  DisplayUpdate.prototype.finish = function () {
    for (var i = 0; i < this.events.length; i++)
      { signal.apply(null, this.events[i]); }
  };

  function maybeClipScrollbars(cm) {
    var display = cm.display;
    if (!display.scrollbarsClipped && display.scroller.offsetWidth) {
      display.nativeBarWidth = display.scroller.offsetWidth - display.scroller.clientWidth;
      display.heightForcer.style.height = scrollGap(cm) + "px";
      display.sizer.style.marginBottom = -display.nativeBarWidth + "px";
      display.sizer.style.borderRightWidth = scrollGap(cm) + "px";
      display.scrollbarsClipped = true;
    }
  }

  function selectionSnapshot(cm) {
    if (cm.hasFocus()) { return null }
    var active = activeElt();
    if (!active || !contains(cm.display.lineDiv, active)) { return null }
    var result = {activeElt: active};
    if (window.getSelection) {
      var sel = window.getSelection();
      if (sel.anchorNode && sel.extend && contains(cm.display.lineDiv, sel.anchorNode)) {
        result.anchorNode = sel.anchorNode;
        result.anchorOffset = sel.anchorOffset;
        result.focusNode = sel.focusNode;
        result.focusOffset = sel.focusOffset;
      }
    }
    return result
  }

  function restoreSelection(snapshot) {
    if (!snapshot || !snapshot.activeElt || snapshot.activeElt == activeElt()) { return }
    snapshot.activeElt.focus();
    if (!/^(INPUT|TEXTAREA)$/.test(snapshot.activeElt.nodeName) &&
        snapshot.anchorNode && contains(document.body, snapshot.anchorNode) && contains(document.body, snapshot.focusNode)) {
      var sel = window.getSelection(), range = document.createRange();
      range.setEnd(snapshot.anchorNode, snapshot.anchorOffset);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      sel.extend(snapshot.focusNode, snapshot.focusOffset);
    }
  }

  // Does the actual updating of the line display. Bails out
  // (returning false) when there is nothing to be done and forced is
  // false.
  function updateDisplayIfNeeded(cm, update) {
    var display = cm.display, doc = cm.doc;

    if (update.editorIsHidden) {
      resetView(cm);
      return false
    }

    // Bail out if the visible area is already rendered and nothing changed.
    if (!update.force &&
        update.visible.from >= display.viewFrom && update.visible.to <= display.viewTo &&
        (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo) &&
        display.renderedView == display.view && countDirtyView(cm) == 0)
      { return false }

    if (maybeUpdateLineNumberWidth(cm)) {
      resetView(cm);
      update.dims = getDimensions(cm);
    }

    // Compute a suitable new viewport (from & to)
    var end = doc.first + doc.size;
    var from = Math.max(update.visible.from - cm.options.viewportMargin, doc.first);
    var to = Math.min(end, update.visible.to + cm.options.viewportMargin);
    if (display.viewFrom < from && from - display.viewFrom < 20) { from = Math.max(doc.first, display.viewFrom); }
    if (display.viewTo > to && display.viewTo - to < 20) { to = Math.min(end, display.viewTo); }
    if (sawCollapsedSpans) {
      from = visualLineNo(cm.doc, from);
      to = visualLineEndNo(cm.doc, to);
    }

    var different = from != display.viewFrom || to != display.viewTo ||
      display.lastWrapHeight != update.wrapperHeight || display.lastWrapWidth != update.wrapperWidth;
    adjustView(cm, from, to);

    display.viewOffset = heightAtLine(getLine(cm.doc, display.viewFrom));
    // Position the mover div to align with the current scroll position
    cm.display.mover.style.top = display.viewOffset + "px";

    var toUpdate = countDirtyView(cm);
    if (!different && toUpdate == 0 && !update.force && display.renderedView == display.view &&
        (display.updateLineNumbers == null || display.updateLineNumbers >= display.viewTo))
      { return false }

    // For big changes, we hide the enclosing element during the
    // update, since that speeds up the operations on most browsers.
    var selSnapshot = selectionSnapshot(cm);
    if (toUpdate > 4) { display.lineDiv.style.display = "none"; }
    patchDisplay(cm, display.updateLineNumbers, update.dims);
    if (toUpdate > 4) { display.lineDiv.style.display = ""; }
    display.renderedView = display.view;
    // There might have been a widget with a focused element that got
    // hidden or updated, if so re-focus it.
    restoreSelection(selSnapshot);

    // Prevent selection and cursors from interfering with the scroll
    // width and height.
    removeChildren(display.cursorDiv);
    removeChildren(display.selectionDiv);
    display.gutters.style.height = display.sizer.style.minHeight = 0;

    if (different) {
      display.lastWrapHeight = update.wrapperHeight;
      display.lastWrapWidth = update.wrapperWidth;
      startWorker(cm, 400);
    }

    display.updateLineNumbers = null;

    return true
  }

  function postUpdateDisplay(cm, update) {
    var viewport = update.viewport;

    for (var first = true;; first = false) {
      if (!first || !cm.options.lineWrapping || update.oldDisplayWidth == displayWidth(cm)) {
        // Clip forced viewport to actual scrollable area.
        if (viewport && viewport.top != null)
          { viewport = {top: Math.min(cm.doc.height + paddingVert(cm.display) - displayHeight(cm), viewport.top)}; }
        // Updated line heights might result in the drawn area not
        // actually covering the viewport. Keep looping until it does.
        update.visible = visibleLines(cm.display, cm.doc, viewport);
        if (update.visible.from >= cm.display.viewFrom && update.visible.to <= cm.display.viewTo)
          { break }
      } else if (first) {
        update.visible = visibleLines(cm.display, cm.doc, viewport);
      }
      if (!updateDisplayIfNeeded(cm, update)) { break }
      updateHeightsInViewport(cm);
      var barMeasure = measureForScrollbars(cm);
      updateSelection(cm);
      updateScrollbars(cm, barMeasure);
      setDocumentHeight(cm, barMeasure);
      update.force = false;
    }

    update.signal(cm, "update", cm);
    if (cm.display.viewFrom != cm.display.reportedViewFrom || cm.display.viewTo != cm.display.reportedViewTo) {
      update.signal(cm, "viewportChange", cm, cm.display.viewFrom, cm.display.viewTo);
      cm.display.reportedViewFrom = cm.display.viewFrom; cm.display.reportedViewTo = cm.display.viewTo;
    }
  }

  function updateDisplaySimple(cm, viewport) {
    var update = new DisplayUpdate(cm, viewport);
    if (updateDisplayIfNeeded(cm, update)) {
      updateHeightsInViewport(cm);
      postUpdateDisplay(cm, update);
      var barMeasure = measureForScrollbars(cm);
      updateSelection(cm);
      updateScrollbars(cm, barMeasure);
      setDocumentHeight(cm, barMeasure);
      update.finish();
    }
  }

  // Sync the actual display DOM structure with display.view, removing
  // nodes for lines that are no longer in view, and creating the ones
  // that are not there yet, and updating the ones that are out of
  // date.
  function patchDisplay(cm, updateNumbersFrom, dims) {
    var display = cm.display, lineNumbers = cm.options.lineNumbers;
    var container = display.lineDiv, cur = container.firstChild;

    function rm(node) {
      var next = node.nextSibling;
      // Works around a throw-scroll bug in OS X Webkit
      if (webkit && mac && cm.display.currentWheelTarget == node)
        { node.style.display = "none"; }
      else
        { node.parentNode.removeChild(node); }
      return next
    }

    var view = display.view, lineN = display.viewFrom;
    // Loop over the elements in the view, syncing cur (the DOM nodes
    // in display.lineDiv) with the view as we go.
    for (var i = 0; i < view.length; i++) {
      var lineView = view[i];
      if (lineView.hidden) ; else if (!lineView.node || lineView.node.parentNode != container) { // Not drawn yet
        var node = buildLineElement(cm, lineView, lineN, dims);
        container.insertBefore(node, cur);
      } else { // Already drawn
        while (cur != lineView.node) { cur = rm(cur); }
        var updateNumber = lineNumbers && updateNumbersFrom != null &&
          updateNumbersFrom <= lineN && lineView.lineNumber;
        if (lineView.changes) {
          if (indexOf(lineView.changes, "gutter") > -1) { updateNumber = false; }
          updateLineForChanges(cm, lineView, lineN, dims);
        }
        if (updateNumber) {
          removeChildren(lineView.lineNumber);
          lineView.lineNumber.appendChild(document.createTextNode(lineNumberFor(cm.options, lineN)));
        }
        cur = lineView.node.nextSibling;
      }
      lineN += lineView.size;
    }
    while (cur) { cur = rm(cur); }
  }

  function updateGutterSpace(display) {
    var width = display.gutters.offsetWidth;
    display.sizer.style.marginLeft = width + "px";
    // Send an event to consumers responding to changes in gutter width.
    signalLater(display, "gutterChanged", display);
  }

  function setDocumentHeight(cm, measure) {
    cm.display.sizer.style.minHeight = measure.docHeight + "px";
    cm.display.heightForcer.style.top = measure.docHeight + "px";
    cm.display.gutters.style.height = (measure.docHeight + cm.display.barHeight + scrollGap(cm)) + "px";
  }

  // Re-align line numbers and gutter marks to compensate for
  // horizontal scrolling.
  function alignHorizontally(cm) {
    var display = cm.display, view = display.view;
    if (!display.alignWidgets && (!display.gutters.firstChild || !cm.options.fixedGutter)) { return }
    var comp = compensateForHScroll(display) - display.scroller.scrollLeft + cm.doc.scrollLeft;
    var gutterW = display.gutters.offsetWidth, left = comp + "px";
    for (var i = 0; i < view.length; i++) { if (!view[i].hidden) {
      if (cm.options.fixedGutter) {
        if (view[i].gutter)
          { view[i].gutter.style.left = left; }
        if (view[i].gutterBackground)
          { view[i].gutterBackground.style.left = left; }
      }
      var align = view[i].alignable;
      if (align) { for (var j = 0; j < align.length; j++)
        { align[j].style.left = left; } }
    } }
    if (cm.options.fixedGutter)
      { display.gutters.style.left = (comp + gutterW) + "px"; }
  }

  // Used to ensure that the line number gutter is still the right
  // size for the current document size. Returns true when an update
  // is needed.
  function maybeUpdateLineNumberWidth(cm) {
    if (!cm.options.lineNumbers) { return false }
    var doc = cm.doc, last = lineNumberFor(cm.options, doc.first + doc.size - 1), display = cm.display;
    if (last.length != display.lineNumChars) {
      var test = display.measure.appendChild(elt("div", [elt("div", last)],
                                                 "CodeMirror-linenumber CodeMirror-gutter-elt"));
      var innerW = test.firstChild.offsetWidth, padding = test.offsetWidth - innerW;
      display.lineGutter.style.width = "";
      display.lineNumInnerWidth = Math.max(innerW, display.lineGutter.offsetWidth - padding) + 1;
      display.lineNumWidth = display.lineNumInnerWidth + padding;
      display.lineNumChars = display.lineNumInnerWidth ? last.length : -1;
      display.lineGutter.style.width = display.lineNumWidth + "px";
      updateGutterSpace(cm.display);
      return true
    }
    return false
  }

  function getGutters(gutters, lineNumbers) {
    var result = [], sawLineNumbers = false;
    for (var i = 0; i < gutters.length; i++) {
      var name = gutters[i], style = null;
      if (typeof name != "string") { style = name.style; name = name.className; }
      if (name == "CodeMirror-linenumbers") {
        if (!lineNumbers) { continue }
        else { sawLineNumbers = true; }
      }
      result.push({className: name, style: style});
    }
    if (lineNumbers && !sawLineNumbers) { result.push({className: "CodeMirror-linenumbers", style: null}); }
    return result
  }

  // Rebuild the gutter elements, ensure the margin to the left of the
  // code matches their width.
  function renderGutters(display) {
    var gutters = display.gutters, specs = display.gutterSpecs;
    removeChildren(gutters);
    display.lineGutter = null;
    for (var i = 0; i < specs.length; ++i) {
      var ref = specs[i];
      var className = ref.className;
      var style = ref.style;
      var gElt = gutters.appendChild(elt("div", null, "CodeMirror-gutter " + className));
      if (style) { gElt.style.cssText = style; }
      if (className == "CodeMirror-linenumbers") {
        display.lineGutter = gElt;
        gElt.style.width = (display.lineNumWidth || 1) + "px";
      }
    }
    gutters.style.display = specs.length ? "" : "none";
    updateGutterSpace(display);
  }

  function updateGutters(cm) {
    renderGutters(cm.display);
    regChange(cm);
    alignHorizontally(cm);
  }

  // The display handles the DOM integration, both for input reading
  // and content drawing. It holds references to DOM nodes and
  // display-related state.

  function Display(place, doc, input, options) {
    var d = this;
    this.input = input;

    // Covers bottom-right square when both scrollbars are present.
    d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler");
    d.scrollbarFiller.setAttribute("cm-not-content", "true");
    // Covers bottom of gutter when coverGutterNextToScrollbar is on
    // and h scrollbar is present.
    d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler");
    d.gutterFiller.setAttribute("cm-not-content", "true");
    // Will contain the actual code, positioned to cover the viewport.
    d.lineDiv = eltP("div", null, "CodeMirror-code");
    // Elements are added to these to represent selection and cursors.
    d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1");
    d.cursorDiv = elt("div", null, "CodeMirror-cursors");
    // A visibility: hidden element used to find the size of things.
    d.measure = elt("div", null, "CodeMirror-measure");
    // When lines outside of the viewport are measured, they are drawn in this.
    d.lineMeasure = elt("div", null, "CodeMirror-measure");
    // Wraps everything that needs to exist inside the vertically-padded coordinate system
    d.lineSpace = eltP("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
                      null, "position: relative; outline: none");
    var lines = eltP("div", [d.lineSpace], "CodeMirror-lines");
    // Moved around its parent to cover visible view.
    d.mover = elt("div", [lines], null, "position: relative");
    // Set to the height of the document, allowing scrolling.
    d.sizer = elt("div", [d.mover], "CodeMirror-sizer");
    d.sizerWidth = null;
    // Behavior of elts with overflow: auto and padding is
    // inconsistent across browsers. This is used to ensure the
    // scrollable area is big enough.
    d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;");
    // Will contain the gutters, if any.
    d.gutters = elt("div", null, "CodeMirror-gutters");
    d.lineGutter = null;
    // Actual scrollable element.
    d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll");
    d.scroller.setAttribute("tabIndex", "-1");
    // The element in which the editor lives.
    d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror");

    // This attribute is respected by automatic translation systems such as Google Translate,
    // and may also be respected by tools used by human translators.
    d.wrapper.setAttribute('translate', 'no');

    // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
    if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0; }
    if (!webkit && !(gecko && mobile)) { d.scroller.draggable = true; }

    if (place) {
      if (place.appendChild) { place.appendChild(d.wrapper); }
      else { place(d.wrapper); }
    }

    // Current rendered range (may be bigger than the view window).
    d.viewFrom = d.viewTo = doc.first;
    d.reportedViewFrom = d.reportedViewTo = doc.first;
    // Information about the rendered lines.
    d.view = [];
    d.renderedView = null;
    // Holds info about a single rendered line when it was rendered
    // for measurement, while not in view.
    d.externalMeasured = null;
    // Empty space (in pixels) above the view
    d.viewOffset = 0;
    d.lastWrapHeight = d.lastWrapWidth = 0;
    d.updateLineNumbers = null;

    d.nativeBarWidth = d.barHeight = d.barWidth = 0;
    d.scrollbarsClipped = false;

    // Used to only resize the line number gutter when necessary (when
    // the amount of lines crosses a boundary that makes its width change)
    d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null;
    // Set to true when a non-horizontal-scrolling line widget is
    // added. As an optimization, line widget aligning is skipped when
    // this is false.
    d.alignWidgets = false;

    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;

    // Tracks the maximum line length so that the horizontal scrollbar
    // can be kept static when scrolling.
    d.maxLine = null;
    d.maxLineLength = 0;
    d.maxLineChanged = false;

    // Used for measuring wheel scrolling granularity
    d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null;

    // True when shift is held down.
    d.shift = false;

    // Used to track whether anything happened since the context menu
    // was opened.
    d.selForContextMenu = null;

    d.activeTouch = null;

    d.gutterSpecs = getGutters(options.gutters, options.lineNumbers);
    renderGutters(d);

    input.init(d);
  }

  // Since the delta values reported on mouse wheel events are
  // unstandardized between browsers and even browser versions, and
  // generally horribly unpredictable, this code starts by measuring
  // the scroll effect that the first few mouse wheel events have,
  // and, from that, detects the way it can convert deltas to pixel
  // offsets afterwards.
  //
  // The reason we want to know the amount a wheel event will scroll
  // is that it gives us a chance to update the display before the
  // actual scrolling happens, reducing flickering.

  var wheelSamples = 0, wheelPixelsPerUnit = null;
  // Fill in a browser-detected starting value on browsers where we
  // know one. These don't have to be accurate -- the result of them
  // being wrong would just be a slight flicker on the first wheel
  // scroll (if it is large enough).
  if (ie) { wheelPixelsPerUnit = -.53; }
  else if (gecko) { wheelPixelsPerUnit = 15; }
  else if (chrome) { wheelPixelsPerUnit = -.7; }
  else if (safari) { wheelPixelsPerUnit = -1/3; }

  function wheelEventDelta(e) {
    var dx = e.wheelDeltaX, dy = e.wheelDeltaY;
    if (dx == null && e.detail && e.axis == e.HORIZONTAL_AXIS) { dx = e.detail; }
    if (dy == null && e.detail && e.axis == e.VERTICAL_AXIS) { dy = e.detail; }
    else if (dy == null) { dy = e.wheelDelta; }
    return {x: dx, y: dy}
  }
  function wheelEventPixels(e) {
    var delta = wheelEventDelta(e);
    delta.x *= wheelPixelsPerUnit;
    delta.y *= wheelPixelsPerUnit;
    return delta
  }

  function onScrollWheel(cm, e) {
    var delta = wheelEventDelta(e), dx = delta.x, dy = delta.y;

    var display = cm.display, scroll = display.scroller;
    // Quit if there's nothing to scroll here
    var canScrollX = scroll.scrollWidth > scroll.clientWidth;
    var canScrollY = scroll.scrollHeight > scroll.clientHeight;
    if (!(dx && canScrollX || dy && canScrollY)) { return }

    // Webkit browsers on OS X abort momentum scrolls when the target
    // of the scroll event is removed from the scrollable element.
    // This hack (see related code in patchDisplay) makes sure the
    // element is kept around.
    if (dy && mac && webkit) {
      outer: for (var cur = e.target, view = display.view; cur != scroll; cur = cur.parentNode) {
        for (var i = 0; i < view.length; i++) {
          if (view[i].node == cur) {
            cm.display.currentWheelTarget = cur;
            break outer
          }
        }
      }
    }

    // On some browsers, horizontal scrolling will cause redraws to
    // happen before the gutter has been realigned, causing it to
    // wriggle around in a most unseemly way. When we have an
    // estimated pixels/delta value, we just handle horizontal
    // scrolling entirely here. It'll be slightly off from native, but
    // better than glitching out.
    if (dx && !gecko && !presto && wheelPixelsPerUnit != null) {
      if (dy && canScrollY)
        { updateScrollTop(cm, Math.max(0, scroll.scrollTop + dy * wheelPixelsPerUnit)); }
      setScrollLeft(cm, Math.max(0, scroll.scrollLeft + dx * wheelPixelsPerUnit));
      // Only prevent default scrolling if vertical scrolling is
      // actually possible. Otherwise, it causes vertical scroll
      // jitter on OSX trackpads when deltaX is small and deltaY
      // is large (issue #3579)
      if (!dy || (dy && canScrollY))
        { e_preventDefault(e); }
      display.wheelStartX = null; // Abort measurement, if in progress
      return
    }

    // 'Project' the visible viewport to cover the area that is being
    // scrolled into view (if we know enough to estimate it).
    if (dy && wheelPixelsPerUnit != null) {
      var pixels = dy * wheelPixelsPerUnit;
      var top = cm.doc.scrollTop, bot = top + display.wrapper.clientHeight;
      if (pixels < 0) { top = Math.max(0, top + pixels - 50); }
      else { bot = Math.min(cm.doc.height, bot + pixels + 50); }
      updateDisplaySimple(cm, {top: top, bottom: bot});
    }

    if (wheelSamples < 20) {
      if (display.wheelStartX == null) {
        display.wheelStartX = scroll.scrollLeft; display.wheelStartY = scroll.scrollTop;
        display.wheelDX = dx; display.wheelDY = dy;
        setTimeout(function () {
          if (display.wheelStartX == null) { return }
          var movedX = scroll.scrollLeft - display.wheelStartX;
          var movedY = scroll.scrollTop - display.wheelStartY;
          var sample = (movedY && display.wheelDY && movedY / display.wheelDY) ||
            (movedX && display.wheelDX && movedX / display.wheelDX);
          display.wheelStartX = display.wheelStartY = null;
          if (!sample) { return }
          wheelPixelsPerUnit = (wheelPixelsPerUnit * wheelSamples + sample) / (wheelSamples + 1);
          ++wheelSamples;
        }, 200);
      } else {
        display.wheelDX += dx; display.wheelDY += dy;
      }
    }
  }

  // Selection objects are immutable. A new one is created every time
  // the selection changes. A selection is one or more non-overlapping
  // (and non-touching) ranges, sorted, and an integer that indicates
  // which one is the primary selection (the one that's scrolled into
  // view, that getCursor returns, etc).
  var Selection = function(ranges, primIndex) {
    this.ranges = ranges;
    this.primIndex = primIndex;
  };

  Selection.prototype.primary = function () { return this.ranges[this.primIndex] };

  Selection.prototype.equals = function (other) {
    if (other == this) { return true }
    if (other.primIndex != this.primIndex || other.ranges.length != this.ranges.length) { return false }
    for (var i = 0; i < this.ranges.length; i++) {
      var here = this.ranges[i], there = other.ranges[i];
      if (!equalCursorPos(here.anchor, there.anchor) || !equalCursorPos(here.head, there.head)) { return false }
    }
    return true
  };

  Selection.prototype.deepCopy = function () {
    var out = [];
    for (var i = 0; i < this.ranges.length; i++)
      { out[i] = new Range(copyPos(this.ranges[i].anchor), copyPos(this.ranges[i].head)); }
    return new Selection(out, this.primIndex)
  };

  Selection.prototype.somethingSelected = function () {
    for (var i = 0; i < this.ranges.length; i++)
      { if (!this.ranges[i].empty()) { return true } }
    return false
  };

  Selection.prototype.contains = function (pos, end) {
    if (!end) { end = pos; }
    for (var i = 0; i < this.ranges.length; i++) {
      var range = this.ranges[i];
      if (cmp(end, range.from()) >= 0 && cmp(pos, range.to()) <= 0)
        { return i }
    }
    return -1
  };

  var Range = function(anchor, head) {
    this.anchor = anchor; this.head = head;
  };

  Range.prototype.from = function () { return minPos(this.anchor, this.head) };
  Range.prototype.to = function () { return maxPos(this.anchor, this.head) };
  Range.prototype.empty = function () { return this.head.line == this.anchor.line && this.head.ch == this.anchor.ch };

  // Take an unsorted, potentially overlapping set of ranges, and
  // build a selection out of it. 'Consumes' ranges array (modifying
  // it).
  function normalizeSelection(cm, ranges, primIndex) {
    var mayTouch = cm && cm.options.selectionsMayTouch;
    var prim = ranges[primIndex];
    ranges.sort(function (a, b) { return cmp(a.from(), b.from()); });
    primIndex = indexOf(ranges, prim);
    for (var i = 1; i < ranges.length; i++) {
      var cur = ranges[i], prev = ranges[i - 1];
      var diff = cmp(prev.to(), cur.from());
      if (mayTouch && !cur.empty() ? diff > 0 : diff >= 0) {
        var from = minPos(prev.from(), cur.from()), to = maxPos(prev.to(), cur.to());
        var inv = prev.empty() ? cur.from() == cur.head : prev.from() == prev.head;
        if (i <= primIndex) { --primIndex; }
        ranges.splice(--i, 2, new Range(inv ? to : from, inv ? from : to));
      }
    }
    return new Selection(ranges, primIndex)
  }

  function simpleSelection(anchor, head) {
    return new Selection([new Range(anchor, head || anchor)], 0)
  }

  // Compute the position of the end of a change (its 'to' property
  // refers to the pre-change end).
  function changeEnd(change) {
    if (!change.text) { return change.to }
    return Pos(change.from.line + change.text.length - 1,
               lst(change.text).length + (change.text.length == 1 ? change.from.ch : 0))
  }

  // Adjust a position to refer to the post-change position of the
  // same text, or the end of the change if the change covers it.
  function adjustForChange(pos, change) {
    if (cmp(pos, change.from) < 0) { return pos }
    if (cmp(pos, change.to) <= 0) { return changeEnd(change) }

    var line = pos.line + change.text.length - (change.to.line - change.from.line) - 1, ch = pos.ch;
    if (pos.line == change.to.line) { ch += changeEnd(change).ch - change.to.ch; }
    return Pos(line, ch)
  }

  function computeSelAfterChange(doc, change) {
    var out = [];
    for (var i = 0; i < doc.sel.ranges.length; i++) {
      var range = doc.sel.ranges[i];
      out.push(new Range(adjustForChange(range.anchor, change),
                         adjustForChange(range.head, change)));
    }
    return normalizeSelection(doc.cm, out, doc.sel.primIndex)
  }

  function offsetPos(pos, old, nw) {
    if (pos.line == old.line)
      { return Pos(nw.line, pos.ch - old.ch + nw.ch) }
    else
      { return Pos(nw.line + (pos.line - old.line), pos.ch) }
  }

  // Used by replaceSelections to allow moving the selection to the
  // start or around the replaced test. Hint may be "start" or "around".
  function computeReplacedSel(doc, changes, hint) {
    var out = [];
    var oldPrev = Pos(doc.first, 0), newPrev = oldPrev;
    for (var i = 0; i < changes.length; i++) {
      var change = changes[i];
      var from = offsetPos(change.from, oldPrev, newPrev);
      var to = offsetPos(changeEnd(change), oldPrev, newPrev);
      oldPrev = change.to;
      newPrev = to;
      if (hint == "around") {
        var range = doc.sel.ranges[i], inv = cmp(range.head, range.anchor) < 0;
        out[i] = new Range(inv ? to : from, inv ? from : to);
      } else {
        out[i] = new Range(from, from);
      }
    }
    return new Selection(out, doc.sel.primIndex)
  }

  // Used to get the editor into a consistent state again when options change.

  function loadMode(cm) {
    cm.doc.mode = getMode(cm.options, cm.doc.modeOption);
    resetModeState(cm);
  }

  function resetModeState(cm) {
    cm.doc.iter(function (line) {
      if (line.stateAfter) { line.stateAfter = null; }
      if (line.styles) { line.styles = null; }
    });
    cm.doc.modeFrontier = cm.doc.highlightFrontier = cm.doc.first;
    startWorker(cm, 100);
    cm.state.modeGen++;
    if (cm.curOp) { regChange(cm); }
  }

  // DOCUMENT DATA STRUCTURE

  // By default, updates that start and end at the beginning of a line
  // are treated specially, in order to make the association of line
  // widgets and marker elements with the text behave more intuitive.
  function isWholeLineUpdate(doc, change) {
    return change.from.ch == 0 && change.to.ch == 0 && lst(change.text) == "" &&
      (!doc.cm || doc.cm.options.wholeLineUpdateBefore)
  }

  // Perform a change on the document data structure.
  function updateDoc(doc, change, markedSpans, estimateHeight) {
    function spansFor(n) {return markedSpans ? markedSpans[n] : null}
    function update(line, text, spans) {
      updateLine(line, text, spans, estimateHeight);
      signalLater(line, "change", line, change);
    }
    function linesFor(start, end) {
      var result = [];
      for (var i = start; i < end; ++i)
        { result.push(new Line(text[i], spansFor(i), estimateHeight)); }
      return result
    }

    var from = change.from, to = change.to, text = change.text;
    var firstLine = getLine(doc, from.line), lastLine = getLine(doc, to.line);
    var lastText = lst(text), lastSpans = spansFor(text.length - 1), nlines = to.line - from.line;

    // Adjust the line structure
    if (change.full) {
      doc.insert(0, linesFor(0, text.length));
      doc.remove(text.length, doc.size - text.length);
    } else if (isWholeLineUpdate(doc, change)) {
      // This is a whole-line replace. Treated specially to make
      // sure line objects move the way they are supposed to.
      var added = linesFor(0, text.length - 1);
      update(lastLine, lastLine.text, lastSpans);
      if (nlines) { doc.remove(from.line, nlines); }
      if (added.length) { doc.insert(from.line, added); }
    } else if (firstLine == lastLine) {
      if (text.length == 1) {
        update(firstLine, firstLine.text.slice(0, from.ch) + lastText + firstLine.text.slice(to.ch), lastSpans);
      } else {
        var added$1 = linesFor(1, text.length - 1);
        added$1.push(new Line(lastText + firstLine.text.slice(to.ch), lastSpans, estimateHeight));
        update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
        doc.insert(from.line + 1, added$1);
      }
    } else if (text.length == 1) {
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0] + lastLine.text.slice(to.ch), spansFor(0));
      doc.remove(from.line + 1, nlines);
    } else {
      update(firstLine, firstLine.text.slice(0, from.ch) + text[0], spansFor(0));
      update(lastLine, lastText + lastLine.text.slice(to.ch), lastSpans);
      var added$2 = linesFor(1, text.length - 1);
      if (nlines > 1) { doc.remove(from.line + 1, nlines - 1); }
      doc.insert(from.line + 1, added$2);
    }

    signalLater(doc, "change", doc, change);
  }

  // Call f for all linked documents.
  function linkedDocs(doc, f, sharedHistOnly) {
    function propagate(doc, skip, sharedHist) {
      if (doc.linked) { for (var i = 0; i < doc.linked.length; ++i) {
        var rel = doc.linked[i];
        if (rel.doc == skip) { continue }
        var shared = sharedHist && rel.sharedHist;
        if (sharedHistOnly && !shared) { continue }
        f(rel.doc, shared);
        propagate(rel.doc, doc, shared);
      } }
    }
    propagate(doc, null, true);
  }

  // Attach a document to an editor.
  function attachDoc(cm, doc) {
    if (doc.cm) { throw new Error("This document is already in use.") }
    cm.doc = doc;
    doc.cm = cm;
    estimateLineHeights(cm);
    loadMode(cm);
    setDirectionClass(cm);
    cm.options.direction = doc.direction;
    if (!cm.options.lineWrapping) { findMaxLine(cm); }
    cm.options.mode = doc.modeOption;
    regChange(cm);
  }

  function setDirectionClass(cm) {
  (cm.doc.direction == "rtl" ? addClass : rmClass)(cm.display.lineDiv, "CodeMirror-rtl");
  }

  function directionChanged(cm) {
    runInOp(cm, function () {
      setDirectionClass(cm);
      regChange(cm);
    });
  }

  function History(prev) {
    // Arrays of change events and selections. Doing something adds an
    // event to done and clears undo. Undoing moves events from done
    // to undone, redoing moves them in the other direction.
    this.done = []; this.undone = [];
    this.undoDepth = prev ? prev.undoDepth : Infinity;
    // Used to track when changes can be merged into a single undo
    // event
    this.lastModTime = this.lastSelTime = 0;
    this.lastOp = this.lastSelOp = null;
    this.lastOrigin = this.lastSelOrigin = null;
    // Used by the isClean() method
    this.generation = this.maxGeneration = prev ? prev.maxGeneration : 1;
  }

  // Create a history change event from an updateDoc-style change
  // object.
  function historyChangeFromChange(doc, change) {
    var histChange = {from: copyPos(change.from), to: changeEnd(change), text: getBetween(doc, change.from, change.to)};
    attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1);
    linkedDocs(doc, function (doc) { return attachLocalSpans(doc, histChange, change.from.line, change.to.line + 1); }, true);
    return histChange
  }

  // Pop all selection events off the end of a history array. Stop at
  // a change event.
  function clearSelectionEvents(array) {
    while (array.length) {
      var last = lst(array);
      if (last.ranges) { array.pop(); }
      else { break }
    }
  }

  // Find the top change event in the history. Pop off selection
  // events that are in the way.
  function lastChangeEvent(hist, force) {
    if (force) {
      clearSelectionEvents(hist.done);
      return lst(hist.done)
    } else if (hist.done.length && !lst(hist.done).ranges) {
      return lst(hist.done)
    } else if (hist.done.length > 1 && !hist.done[hist.done.length - 2].ranges) {
      hist.done.pop();
      return lst(hist.done)
    }
  }

  // Register a change in the history. Merges changes that are within
  // a single operation, or are close together with an origin that
  // allows merging (starting with "+") into a single event.
  function addChangeToHistory(doc, change, selAfter, opId) {
    var hist = doc.history;
    hist.undone.length = 0;
    var time = +new Date, cur;
    var last;

    if ((hist.lastOp == opId ||
         hist.lastOrigin == change.origin && change.origin &&
         ((change.origin.charAt(0) == "+" && hist.lastModTime > time - (doc.cm ? doc.cm.options.historyEventDelay : 500)) ||
          change.origin.charAt(0) == "*")) &&
        (cur = lastChangeEvent(hist, hist.lastOp == opId))) {
      // Merge this change into the last event
      last = lst(cur.changes);
      if (cmp(change.from, change.to) == 0 && cmp(change.from, last.to) == 0) {
        // Optimized case for simple insertion -- don't want to add
        // new changesets for every character typed
        last.to = changeEnd(change);
      } else {
        // Add new sub-event
        cur.changes.push(historyChangeFromChange(doc, change));
      }
    } else {
      // Can not be merged, start a new event.
      var before = lst(hist.done);
      if (!before || !before.ranges)
        { pushSelectionToHistory(doc.sel, hist.done); }
      cur = {changes: [historyChangeFromChange(doc, change)],
             generation: hist.generation};
      hist.done.push(cur);
      while (hist.done.length > hist.undoDepth) {
        hist.done.shift();
        if (!hist.done[0].ranges) { hist.done.shift(); }
      }
    }
    hist.done.push(selAfter);
    hist.generation = ++hist.maxGeneration;
    hist.lastModTime = hist.lastSelTime = time;
    hist.lastOp = hist.lastSelOp = opId;
    hist.lastOrigin = hist.lastSelOrigin = change.origin;

    if (!last) { signal(doc, "historyAdded"); }
  }

  function selectionEventCanBeMerged(doc, origin, prev, sel) {
    var ch = origin.charAt(0);
    return ch == "*" ||
      ch == "+" &&
      prev.ranges.length == sel.ranges.length &&
      prev.somethingSelected() == sel.somethingSelected() &&
      new Date - doc.history.lastSelTime <= (doc.cm ? doc.cm.options.historyEventDelay : 500)
  }

  // Called whenever the selection changes, sets the new selection as
  // the pending selection in the history, and pushes the old pending
  // selection into the 'done' array when it was significantly
  // different (in number of selected ranges, emptiness, or time).
  function addSelectionToHistory(doc, sel, opId, options) {
    var hist = doc.history, origin = options && options.origin;

    // A new event is started when the previous origin does not match
    // the current, or the origins don't allow matching. Origins
    // starting with * are always merged, those starting with + are
    // merged when similar and close together in time.
    if (opId == hist.lastSelOp ||
        (origin && hist.lastSelOrigin == origin &&
         (hist.lastModTime == hist.lastSelTime && hist.lastOrigin == origin ||
          selectionEventCanBeMerged(doc, origin, lst(hist.done), sel))))
      { hist.done[hist.done.length - 1] = sel; }
    else
      { pushSelectionToHistory(sel, hist.done); }

    hist.lastSelTime = +new Date;
    hist.lastSelOrigin = origin;
    hist.lastSelOp = opId;
    if (options && options.clearRedo !== false)
      { clearSelectionEvents(hist.undone); }
  }

  function pushSelectionToHistory(sel, dest) {
    var top = lst(dest);
    if (!(top && top.ranges && top.equals(sel)))
      { dest.push(sel); }
  }

  // Used to store marked span information in the history.
  function attachLocalSpans(doc, change, from, to) {
    var existing = change["spans_" + doc.id], n = 0;
    doc.iter(Math.max(doc.first, from), Math.min(doc.first + doc.size, to), function (line) {
      if (line.markedSpans)
        { (existing || (existing = change["spans_" + doc.id] = {}))[n] = line.markedSpans; }
      ++n;
    });
  }

  // When un/re-doing restores text containing marked spans, those
  // that have been explicitly cleared should not be restored.
  function removeClearedSpans(spans) {
    if (!spans) { return null }
    var out;
    for (var i = 0; i < spans.length; ++i) {
      if (spans[i].marker.explicitlyCleared) { if (!out) { out = spans.slice(0, i); } }
      else if (out) { out.push(spans[i]); }
    }
    return !out ? spans : out.length ? out : null
  }

  // Retrieve and filter the old marked spans stored in a change event.
  function getOldSpans(doc, change) {
    var found = change["spans_" + doc.id];
    if (!found) { return null }
    var nw = [];
    for (var i = 0; i < change.text.length; ++i)
      { nw.push(removeClearedSpans(found[i])); }
    return nw
  }

  // Used for un/re-doing changes from the history. Combines the
  // result of computing the existing spans with the set of spans that
  // existed in the history (so that deleting around a span and then
  // undoing brings back the span).
  function mergeOldSpans(doc, change) {
    var old = getOldSpans(doc, change);
    var stretched = stretchSpansOverChange(doc, change);
    if (!old) { return stretched }
    if (!stretched) { return old }

    for (var i = 0; i < old.length; ++i) {
      var oldCur = old[i], stretchCur = stretched[i];
      if (oldCur && stretchCur) {
        spans: for (var j = 0; j < stretchCur.length; ++j) {
          var span = stretchCur[j];
          for (var k = 0; k < oldCur.length; ++k)
            { if (oldCur[k].marker == span.marker) { continue spans } }
          oldCur.push(span);
        }
      } else if (stretchCur) {
        old[i] = stretchCur;
      }
    }
    return old
  }

  // Used both to provide a JSON-safe object in .getHistory, and, when
  // detaching a document, to split the history in two
  function copyHistoryArray(events, newGroup, instantiateSel) {
    var copy = [];
    for (var i = 0; i < events.length; ++i) {
      var event = events[i];
      if (event.ranges) {
        copy.push(instantiateSel ? Selection.prototype.deepCopy.call(event) : event);
        continue
      }
      var changes = event.changes, newChanges = [];
      copy.push({changes: newChanges});
      for (var j = 0; j < changes.length; ++j) {
        var change = changes[j], m = (void 0);
        newChanges.push({from: change.from, to: change.to, text: change.text});
        if (newGroup) { for (var prop in change) { if (m = prop.match(/^spans_(\d+)$/)) {
          if (indexOf(newGroup, Number(m[1])) > -1) {
            lst(newChanges)[prop] = change[prop];
            delete change[prop];
          }
        } } }
      }
    }
    return copy
  }

  // The 'scroll' parameter given to many of these indicated whether
  // the new cursor position should be scrolled into view after
  // modifying the selection.

  // If shift is held or the extend flag is set, extends a range to
  // include a given position (and optionally a second position).
  // Otherwise, simply returns the range between the given positions.
  // Used for cursor motion and such.
  function extendRange(range, head, other, extend) {
    if (extend) {
      var anchor = range.anchor;
      if (other) {
        var posBefore = cmp(head, anchor) < 0;
        if (posBefore != (cmp(other, anchor) < 0)) {
          anchor = head;
          head = other;
        } else if (posBefore != (cmp(head, other) < 0)) {
          head = other;
        }
      }
      return new Range(anchor, head)
    } else {
      return new Range(other || head, head)
    }
  }

  // Extend the primary selection range, discard the rest.
  function extendSelection(doc, head, other, options, extend) {
    if (extend == null) { extend = doc.cm && (doc.cm.display.shift || doc.extend); }
    setSelection(doc, new Selection([extendRange(doc.sel.primary(), head, other, extend)], 0), options);
  }

  // Extend all selections (pos is an array of selections with length
  // equal the number of selections)
  function extendSelections(doc, heads, options) {
    var out = [];
    var extend = doc.cm && (doc.cm.display.shift || doc.extend);
    for (var i = 0; i < doc.sel.ranges.length; i++)
      { out[i] = extendRange(doc.sel.ranges[i], heads[i], null, extend); }
    var newSel = normalizeSelection(doc.cm, out, doc.sel.primIndex);
    setSelection(doc, newSel, options);
  }

  // Updates a single range in the selection.
  function replaceOneSelection(doc, i, range, options) {
    var ranges = doc.sel.ranges.slice(0);
    ranges[i] = range;
    setSelection(doc, normalizeSelection(doc.cm, ranges, doc.sel.primIndex), options);
  }

  // Reset the selection to a single range.
  function setSimpleSelection(doc, anchor, head, options) {
    setSelection(doc, simpleSelection(anchor, head), options);
  }

  // Give beforeSelectionChange handlers a change to influence a
  // selection update.
  function filterSelectionChange(doc, sel, options) {
    var obj = {
      ranges: sel.ranges,
      update: function(ranges) {
        this.ranges = [];
        for (var i = 0; i < ranges.length; i++)
          { this.ranges[i] = new Range(clipPos(doc, ranges[i].anchor),
                                     clipPos(doc, ranges[i].head)); }
      },
      origin: options && options.origin
    };
    signal(doc, "beforeSelectionChange", doc, obj);
    if (doc.cm) { signal(doc.cm, "beforeSelectionChange", doc.cm, obj); }
    if (obj.ranges != sel.ranges) { return normalizeSelection(doc.cm, obj.ranges, obj.ranges.length - 1) }
    else { return sel }
  }

  function setSelectionReplaceHistory(doc, sel, options) {
    var done = doc.history.done, last = lst(done);
    if (last && last.ranges) {
      done[done.length - 1] = sel;
      setSelectionNoUndo(doc, sel, options);
    } else {
      setSelection(doc, sel, options);
    }
  }

  // Set a new selection.
  function setSelection(doc, sel, options) {
    setSelectionNoUndo(doc, sel, options);
    addSelectionToHistory(doc, doc.sel, doc.cm ? doc.cm.curOp.id : NaN, options);
  }

  function setSelectionNoUndo(doc, sel, options) {
    if (hasHandler(doc, "beforeSelectionChange") || doc.cm && hasHandler(doc.cm, "beforeSelectionChange"))
      { sel = filterSelectionChange(doc, sel, options); }

    var bias = options && options.bias ||
      (cmp(sel.primary().head, doc.sel.primary().head) < 0 ? -1 : 1);
    setSelectionInner(doc, skipAtomicInSelection(doc, sel, bias, true));

    if (!(options && options.scroll === false) && doc.cm && doc.cm.getOption("readOnly") != "nocursor")
      { ensureCursorVisible(doc.cm); }
  }

  function setSelectionInner(doc, sel) {
    if (sel.equals(doc.sel)) { return }

    doc.sel = sel;

    if (doc.cm) {
      doc.cm.curOp.updateInput = 1;
      doc.cm.curOp.selectionChanged = true;
      signalCursorActivity(doc.cm);
    }
    signalLater(doc, "cursorActivity", doc);
  }

  // Verify that the selection does not partially select any atomic
  // marked ranges.
  function reCheckSelection(doc) {
    setSelectionInner(doc, skipAtomicInSelection(doc, doc.sel, null, false));
  }

  // Return a selection that does not partially select any atomic
  // ranges.
  function skipAtomicInSelection(doc, sel, bias, mayClear) {
    var out;
    for (var i = 0; i < sel.ranges.length; i++) {
      var range = sel.ranges[i];
      var old = sel.ranges.length == doc.sel.ranges.length && doc.sel.ranges[i];
      var newAnchor = skipAtomic(doc, range.anchor, old && old.anchor, bias, mayClear);
      var newHead = skipAtomic(doc, range.head, old && old.head, bias, mayClear);
      if (out || newAnchor != range.anchor || newHead != range.head) {
        if (!out) { out = sel.ranges.slice(0, i); }
        out[i] = new Range(newAnchor, newHead);
      }
    }
    return out ? normalizeSelection(doc.cm, out, sel.primIndex) : sel
  }

  function skipAtomicInner(doc, pos, oldPos, dir, mayClear) {
    var line = getLine(doc, pos.line);
    if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
      var sp = line.markedSpans[i], m = sp.marker;

      // Determine if we should prevent the cursor being placed to the left/right of an atomic marker
      // Historically this was determined using the inclusiveLeft/Right option, but the new way to control it
      // is with selectLeft/Right
      var preventCursorLeft = ("selectLeft" in m) ? !m.selectLeft : m.inclusiveLeft;
      var preventCursorRight = ("selectRight" in m) ? !m.selectRight : m.inclusiveRight;

      if ((sp.from == null || (preventCursorLeft ? sp.from <= pos.ch : sp.from < pos.ch)) &&
          (sp.to == null || (preventCursorRight ? sp.to >= pos.ch : sp.to > pos.ch))) {
        if (mayClear) {
          signal(m, "beforeCursorEnter");
          if (m.explicitlyCleared) {
            if (!line.markedSpans) { break }
            else {--i; continue}
          }
        }
        if (!m.atomic) { continue }

        if (oldPos) {
          var near = m.find(dir < 0 ? 1 : -1), diff = (void 0);
          if (dir < 0 ? preventCursorRight : preventCursorLeft)
            { near = movePos(doc, near, -dir, near && near.line == pos.line ? line : null); }
          if (near && near.line == pos.line && (diff = cmp(near, oldPos)) && (dir < 0 ? diff < 0 : diff > 0))
            { return skipAtomicInner(doc, near, pos, dir, mayClear) }
        }

        var far = m.find(dir < 0 ? -1 : 1);
        if (dir < 0 ? preventCursorLeft : preventCursorRight)
          { far = movePos(doc, far, dir, far.line == pos.line ? line : null); }
        return far ? skipAtomicInner(doc, far, pos, dir, mayClear) : null
      }
    } }
    return pos
  }

  // Ensure a given position is not inside an atomic range.
  function skipAtomic(doc, pos, oldPos, bias, mayClear) {
    var dir = bias || 1;
    var found = skipAtomicInner(doc, pos, oldPos, dir, mayClear) ||
        (!mayClear && skipAtomicInner(doc, pos, oldPos, dir, true)) ||
        skipAtomicInner(doc, pos, oldPos, -dir, mayClear) ||
        (!mayClear && skipAtomicInner(doc, pos, oldPos, -dir, true));
    if (!found) {
      doc.cantEdit = true;
      return Pos(doc.first, 0)
    }
    return found
  }

  function movePos(doc, pos, dir, line) {
    if (dir < 0 && pos.ch == 0) {
      if (pos.line > doc.first) { return clipPos(doc, Pos(pos.line - 1)) }
      else { return null }
    } else if (dir > 0 && pos.ch == (line || getLine(doc, pos.line)).text.length) {
      if (pos.line < doc.first + doc.size - 1) { return Pos(pos.line + 1, 0) }
      else { return null }
    } else {
      return new Pos(pos.line, pos.ch + dir)
    }
  }

  function selectAll(cm) {
    cm.setSelection(Pos(cm.firstLine(), 0), Pos(cm.lastLine()), sel_dontScroll);
  }

  // UPDATING

  // Allow "beforeChange" event handlers to influence a change
  function filterChange(doc, change, update) {
    var obj = {
      canceled: false,
      from: change.from,
      to: change.to,
      text: change.text,
      origin: change.origin,
      cancel: function () { return obj.canceled = true; }
    };
    if (update) { obj.update = function (from, to, text, origin) {
      if (from) { obj.from = clipPos(doc, from); }
      if (to) { obj.to = clipPos(doc, to); }
      if (text) { obj.text = text; }
      if (origin !== undefined) { obj.origin = origin; }
    }; }
    signal(doc, "beforeChange", doc, obj);
    if (doc.cm) { signal(doc.cm, "beforeChange", doc.cm, obj); }

    if (obj.canceled) {
      if (doc.cm) { doc.cm.curOp.updateInput = 2; }
      return null
    }
    return {from: obj.from, to: obj.to, text: obj.text, origin: obj.origin}
  }

  // Apply a change to a document, and add it to the document's
  // history, and propagating it to all linked documents.
  function makeChange(doc, change, ignoreReadOnly) {
    if (doc.cm) {
      if (!doc.cm.curOp) { return operation(doc.cm, makeChange)(doc, change, ignoreReadOnly) }
      if (doc.cm.state.suppressEdits) { return }
    }

    if (hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange")) {
      change = filterChange(doc, change, true);
      if (!change) { return }
    }

    // Possibly split or suppress the update based on the presence
    // of read-only spans in its range.
    var split = sawReadOnlySpans && !ignoreReadOnly && removeReadOnlyRanges(doc, change.from, change.to);
    if (split) {
      for (var i = split.length - 1; i >= 0; --i)
        { makeChangeInner(doc, {from: split[i].from, to: split[i].to, text: i ? [""] : change.text, origin: change.origin}); }
    } else {
      makeChangeInner(doc, change);
    }
  }

  function makeChangeInner(doc, change) {
    if (change.text.length == 1 && change.text[0] == "" && cmp(change.from, change.to) == 0) { return }
    var selAfter = computeSelAfterChange(doc, change);
    addChangeToHistory(doc, change, selAfter, doc.cm ? doc.cm.curOp.id : NaN);

    makeChangeSingleDoc(doc, change, selAfter, stretchSpansOverChange(doc, change));
    var rebased = [];

    linkedDocs(doc, function (doc, sharedHist) {
      if (!sharedHist && indexOf(rebased, doc.history) == -1) {
        rebaseHist(doc.history, change);
        rebased.push(doc.history);
      }
      makeChangeSingleDoc(doc, change, null, stretchSpansOverChange(doc, change));
    });
  }

  // Revert a change stored in a document's history.
  function makeChangeFromHistory(doc, type, allowSelectionOnly) {
    var suppress = doc.cm && doc.cm.state.suppressEdits;
    if (suppress && !allowSelectionOnly) { return }

    var hist = doc.history, event, selAfter = doc.sel;
    var source = type == "undo" ? hist.done : hist.undone, dest = type == "undo" ? hist.undone : hist.done;

    // Verify that there is a useable event (so that ctrl-z won't
    // needlessly clear selection events)
    var i = 0;
    for (; i < source.length; i++) {
      event = source[i];
      if (allowSelectionOnly ? event.ranges && !event.equals(doc.sel) : !event.ranges)
        { break }
    }
    if (i == source.length) { return }
    hist.lastOrigin = hist.lastSelOrigin = null;

    for (;;) {
      event = source.pop();
      if (event.ranges) {
        pushSelectionToHistory(event, dest);
        if (allowSelectionOnly && !event.equals(doc.sel)) {
          setSelection(doc, event, {clearRedo: false});
          return
        }
        selAfter = event;
      } else if (suppress) {
        source.push(event);
        return
      } else { break }
    }

    // Build up a reverse change object to add to the opposite history
    // stack (redo when undoing, and vice versa).
    var antiChanges = [];
    pushSelectionToHistory(selAfter, dest);
    dest.push({changes: antiChanges, generation: hist.generation});
    hist.generation = event.generation || ++hist.maxGeneration;

    var filter = hasHandler(doc, "beforeChange") || doc.cm && hasHandler(doc.cm, "beforeChange");

    var loop = function ( i ) {
      var change = event.changes[i];
      change.origin = type;
      if (filter && !filterChange(doc, change, false)) {
        source.length = 0;
        return {}
      }

      antiChanges.push(historyChangeFromChange(doc, change));

      var after = i ? computeSelAfterChange(doc, change) : lst(source);
      makeChangeSingleDoc(doc, change, after, mergeOldSpans(doc, change));
      if (!i && doc.cm) { doc.cm.scrollIntoView({from: change.from, to: changeEnd(change)}); }
      var rebased = [];

      // Propagate to the linked documents
      linkedDocs(doc, function (doc, sharedHist) {
        if (!sharedHist && indexOf(rebased, doc.history) == -1) {
          rebaseHist(doc.history, change);
          rebased.push(doc.history);
        }
        makeChangeSingleDoc(doc, change, null, mergeOldSpans(doc, change));
      });
    };

    for (var i$1 = event.changes.length - 1; i$1 >= 0; --i$1) {
      var returned = loop( i$1 );

      if ( returned ) return returned.v;
    }
  }

  // Sub-views need their line numbers shifted when text is added
  // above or below them in the parent document.
  function shiftDoc(doc, distance) {
    if (distance == 0) { return }
    doc.first += distance;
    doc.sel = new Selection(map(doc.sel.ranges, function (range) { return new Range(
      Pos(range.anchor.line + distance, range.anchor.ch),
      Pos(range.head.line + distance, range.head.ch)
    ); }), doc.sel.primIndex);
    if (doc.cm) {
      regChange(doc.cm, doc.first, doc.first - distance, distance);
      for (var d = doc.cm.display, l = d.viewFrom; l < d.viewTo; l++)
        { regLineChange(doc.cm, l, "gutter"); }
    }
  }

  // More lower-level change function, handling only a single document
  // (not linked ones).
  function makeChangeSingleDoc(doc, change, selAfter, spans) {
    if (doc.cm && !doc.cm.curOp)
      { return operation(doc.cm, makeChangeSingleDoc)(doc, change, selAfter, spans) }

    if (change.to.line < doc.first) {
      shiftDoc(doc, change.text.length - 1 - (change.to.line - change.from.line));
      return
    }
    if (change.from.line > doc.lastLine()) { return }

    // Clip the change to the size of this doc
    if (change.from.line < doc.first) {
      var shift = change.text.length - 1 - (doc.first - change.from.line);
      shiftDoc(doc, shift);
      change = {from: Pos(doc.first, 0), to: Pos(change.to.line + shift, change.to.ch),
                text: [lst(change.text)], origin: change.origin};
    }
    var last = doc.lastLine();
    if (change.to.line > last) {
      change = {from: change.from, to: Pos(last, getLine(doc, last).text.length),
                text: [change.text[0]], origin: change.origin};
    }

    change.removed = getBetween(doc, change.from, change.to);

    if (!selAfter) { selAfter = computeSelAfterChange(doc, change); }
    if (doc.cm) { makeChangeSingleDocInEditor(doc.cm, change, spans); }
    else { updateDoc(doc, change, spans); }
    setSelectionNoUndo(doc, selAfter, sel_dontScroll);

    if (doc.cantEdit && skipAtomic(doc, Pos(doc.firstLine(), 0)))
      { doc.cantEdit = false; }
  }

  // Handle the interaction of a change to a document with the editor
  // that this document is part of.
  function makeChangeSingleDocInEditor(cm, change, spans) {
    var doc = cm.doc, display = cm.display, from = change.from, to = change.to;

    var recomputeMaxLength = false, checkWidthStart = from.line;
    if (!cm.options.lineWrapping) {
      checkWidthStart = lineNo(visualLine(getLine(doc, from.line)));
      doc.iter(checkWidthStart, to.line + 1, function (line) {
        if (line == display.maxLine) {
          recomputeMaxLength = true;
          return true
        }
      });
    }

    if (doc.sel.contains(change.from, change.to) > -1)
      { signalCursorActivity(cm); }

    updateDoc(doc, change, spans, estimateHeight(cm));

    if (!cm.options.lineWrapping) {
      doc.iter(checkWidthStart, from.line + change.text.length, function (line) {
        var len = lineLength(line);
        if (len > display.maxLineLength) {
          display.maxLine = line;
          display.maxLineLength = len;
          display.maxLineChanged = true;
          recomputeMaxLength = false;
        }
      });
      if (recomputeMaxLength) { cm.curOp.updateMaxLine = true; }
    }

    retreatFrontier(doc, from.line);
    startWorker(cm, 400);

    var lendiff = change.text.length - (to.line - from.line) - 1;
    // Remember that these lines changed, for updating the display
    if (change.full)
      { regChange(cm); }
    else if (from.line == to.line && change.text.length == 1 && !isWholeLineUpdate(cm.doc, change))
      { regLineChange(cm, from.line, "text"); }
    else
      { regChange(cm, from.line, to.line + 1, lendiff); }

    var changesHandler = hasHandler(cm, "changes"), changeHandler = hasHandler(cm, "change");
    if (changeHandler || changesHandler) {
      var obj = {
        from: from, to: to,
        text: change.text,
        removed: change.removed,
        origin: change.origin
      };
      if (changeHandler) { signalLater(cm, "change", cm, obj); }
      if (changesHandler) { (cm.curOp.changeObjs || (cm.curOp.changeObjs = [])).push(obj); }
    }
    cm.display.selForContextMenu = null;
  }

  function replaceRange(doc, code, from, to, origin) {
    var assign;

    if (!to) { to = from; }
    if (cmp(to, from) < 0) { (assign = [to, from], from = assign[0], to = assign[1]); }
    if (typeof code == "string") { code = doc.splitLines(code); }
    makeChange(doc, {from: from, to: to, text: code, origin: origin});
  }

  // Rebasing/resetting history to deal with externally-sourced changes

  function rebaseHistSelSingle(pos, from, to, diff) {
    if (to < pos.line) {
      pos.line += diff;
    } else if (from < pos.line) {
      pos.line = from;
      pos.ch = 0;
    }
  }

  // Tries to rebase an array of history events given a change in the
  // document. If the change touches the same lines as the event, the
  // event, and everything 'behind' it, is discarded. If the change is
  // before the event, the event's positions are updated. Uses a
  // copy-on-write scheme for the positions, to avoid having to
  // reallocate them all on every rebase, but also avoid problems with
  // shared position objects being unsafely updated.
  function rebaseHistArray(array, from, to, diff) {
    for (var i = 0; i < array.length; ++i) {
      var sub = array[i], ok = true;
      if (sub.ranges) {
        if (!sub.copied) { sub = array[i] = sub.deepCopy(); sub.copied = true; }
        for (var j = 0; j < sub.ranges.length; j++) {
          rebaseHistSelSingle(sub.ranges[j].anchor, from, to, diff);
          rebaseHistSelSingle(sub.ranges[j].head, from, to, diff);
        }
        continue
      }
      for (var j$1 = 0; j$1 < sub.changes.length; ++j$1) {
        var cur = sub.changes[j$1];
        if (to < cur.from.line) {
          cur.from = Pos(cur.from.line + diff, cur.from.ch);
          cur.to = Pos(cur.to.line + diff, cur.to.ch);
        } else if (from <= cur.to.line) {
          ok = false;
          break
        }
      }
      if (!ok) {
        array.splice(0, i + 1);
        i = 0;
      }
    }
  }

  function rebaseHist(hist, change) {
    var from = change.from.line, to = change.to.line, diff = change.text.length - (to - from) - 1;
    rebaseHistArray(hist.done, from, to, diff);
    rebaseHistArray(hist.undone, from, to, diff);
  }

  // Utility for applying a change to a line by handle or number,
  // returning the number and optionally registering the line as
  // changed.
  function changeLine(doc, handle, changeType, op) {
    var no = handle, line = handle;
    if (typeof handle == "number") { line = getLine(doc, clipLine(doc, handle)); }
    else { no = lineNo(handle); }
    if (no == null) { return null }
    if (op(line, no) && doc.cm) { regLineChange(doc.cm, no, changeType); }
    return line
  }

  // The document is represented as a BTree consisting of leaves, with
  // chunk of lines in them, and branches, with up to ten leaves or
  // other branch nodes below them. The top node is always a branch
  // node, and is the document object itself (meaning it has
  // additional methods and properties).
  //
  // All nodes have parent links. The tree is used both to go from
  // line numbers to line objects, and to go from objects to numbers.
  // It also indexes by height, and is used to convert between height
  // and line object, and to find the total height of the document.
  //
  // See also http://marijnhaverbeke.nl/blog/codemirror-line-tree.html

  function LeafChunk(lines) {
    this.lines = lines;
    this.parent = null;
    var height = 0;
    for (var i = 0; i < lines.length; ++i) {
      lines[i].parent = this;
      height += lines[i].height;
    }
    this.height = height;
  }

  LeafChunk.prototype = {
    chunkSize: function() { return this.lines.length },

    // Remove the n lines at offset 'at'.
    removeInner: function(at, n) {
      for (var i = at, e = at + n; i < e; ++i) {
        var line = this.lines[i];
        this.height -= line.height;
        cleanUpLine(line);
        signalLater(line, "delete");
      }
      this.lines.splice(at, n);
    },

    // Helper used to collapse a small branch into a single leaf.
    collapse: function(lines) {
      lines.push.apply(lines, this.lines);
    },

    // Insert the given array of lines at offset 'at', count them as
    // having the given height.
    insertInner: function(at, lines, height) {
      this.height += height;
      this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
      for (var i = 0; i < lines.length; ++i) { lines[i].parent = this; }
    },

    // Used to iterate over a part of the tree.
    iterN: function(at, n, op) {
      for (var e = at + n; at < e; ++at)
        { if (op(this.lines[at])) { return true } }
    }
  };

  function BranchChunk(children) {
    this.children = children;
    var size = 0, height = 0;
    for (var i = 0; i < children.length; ++i) {
      var ch = children[i];
      size += ch.chunkSize(); height += ch.height;
      ch.parent = this;
    }
    this.size = size;
    this.height = height;
    this.parent = null;
  }

  BranchChunk.prototype = {
    chunkSize: function() { return this.size },

    removeInner: function(at, n) {
      this.size -= n;
      for (var i = 0; i < this.children.length; ++i) {
        var child = this.children[i], sz = child.chunkSize();
        if (at < sz) {
          var rm = Math.min(n, sz - at), oldHeight = child.height;
          child.removeInner(at, rm);
          this.height -= oldHeight - child.height;
          if (sz == rm) { this.children.splice(i--, 1); child.parent = null; }
          if ((n -= rm) == 0) { break }
          at = 0;
        } else { at -= sz; }
      }
      // If the result is smaller than 25 lines, ensure that it is a
      // single leaf node.
      if (this.size - n < 25 &&
          (this.children.length > 1 || !(this.children[0] instanceof LeafChunk))) {
        var lines = [];
        this.collapse(lines);
        this.children = [new LeafChunk(lines)];
        this.children[0].parent = this;
      }
    },

    collapse: function(lines) {
      for (var i = 0; i < this.children.length; ++i) { this.children[i].collapse(lines); }
    },

    insertInner: function(at, lines, height) {
      this.size += lines.length;
      this.height += height;
      for (var i = 0; i < this.children.length; ++i) {
        var child = this.children[i], sz = child.chunkSize();
        if (at <= sz) {
          child.insertInner(at, lines, height);
          if (child.lines && child.lines.length > 50) {
            // To avoid memory thrashing when child.lines is huge (e.g. first view of a large file), it's never spliced.
            // Instead, small slices are taken. They're taken in order because sequential memory accesses are fastest.
            var remaining = child.lines.length % 25 + 25;
            for (var pos = remaining; pos < child.lines.length;) {
              var leaf = new LeafChunk(child.lines.slice(pos, pos += 25));
              child.height -= leaf.height;
              this.children.splice(++i, 0, leaf);
              leaf.parent = this;
            }
            child.lines = child.lines.slice(0, remaining);
            this.maybeSpill();
          }
          break
        }
        at -= sz;
      }
    },

    // When a node has grown, check whether it should be split.
    maybeSpill: function() {
      if (this.children.length <= 10) { return }
      var me = this;
      do {
        var spilled = me.children.splice(me.children.length - 5, 5);
        var sibling = new BranchChunk(spilled);
        if (!me.parent) { // Become the parent node
          var copy = new BranchChunk(me.children);
          copy.parent = me;
          me.children = [copy, sibling];
          me = copy;
       } else {
          me.size -= sibling.size;
          me.height -= sibling.height;
          var myIndex = indexOf(me.parent.children, me);
          me.parent.children.splice(myIndex + 1, 0, sibling);
        }
        sibling.parent = me.parent;
      } while (me.children.length > 10)
      me.parent.maybeSpill();
    },

    iterN: function(at, n, op) {
      for (var i = 0; i < this.children.length; ++i) {
        var child = this.children[i], sz = child.chunkSize();
        if (at < sz) {
          var used = Math.min(n, sz - at);
          if (child.iterN(at, used, op)) { return true }
          if ((n -= used) == 0) { break }
          at = 0;
        } else { at -= sz; }
      }
    }
  };

  // Line widgets are block elements displayed above or below a line.

  var LineWidget = function(doc, node, options) {
    if (options) { for (var opt in options) { if (options.hasOwnProperty(opt))
      { this[opt] = options[opt]; } } }
    this.doc = doc;
    this.node = node;
  };

  LineWidget.prototype.clear = function () {
    var cm = this.doc.cm, ws = this.line.widgets, line = this.line, no = lineNo(line);
    if (no == null || !ws) { return }
    for (var i = 0; i < ws.length; ++i) { if (ws[i] == this) { ws.splice(i--, 1); } }
    if (!ws.length) { line.widgets = null; }
    var height = widgetHeight(this);
    updateLineHeight(line, Math.max(0, line.height - height));
    if (cm) {
      runInOp(cm, function () {
        adjustScrollWhenAboveVisible(cm, line, -height);
        regLineChange(cm, no, "widget");
      });
      signalLater(cm, "lineWidgetCleared", cm, this, no);
    }
  };

  LineWidget.prototype.changed = function () {
      var this$1 = this;

    var oldH = this.height, cm = this.doc.cm, line = this.line;
    this.height = null;
    var diff = widgetHeight(this) - oldH;
    if (!diff) { return }
    if (!lineIsHidden(this.doc, line)) { updateLineHeight(line, line.height + diff); }
    if (cm) {
      runInOp(cm, function () {
        cm.curOp.forceUpdate = true;
        adjustScrollWhenAboveVisible(cm, line, diff);
        signalLater(cm, "lineWidgetChanged", cm, this$1, lineNo(line));
      });
    }
  };
  eventMixin(LineWidget);

  function adjustScrollWhenAboveVisible(cm, line, diff) {
    if (heightAtLine(line) < ((cm.curOp && cm.curOp.scrollTop) || cm.doc.scrollTop))
      { addToScrollTop(cm, diff); }
  }

  function addLineWidget(doc, handle, node, options) {
    var widget = new LineWidget(doc, node, options);
    var cm = doc.cm;
    if (cm && widget.noHScroll) { cm.display.alignWidgets = true; }
    changeLine(doc, handle, "widget", function (line) {
      var widgets = line.widgets || (line.widgets = []);
      if (widget.insertAt == null) { widgets.push(widget); }
      else { widgets.splice(Math.min(widgets.length, Math.max(0, widget.insertAt)), 0, widget); }
      widget.line = line;
      if (cm && !lineIsHidden(doc, line)) {
        var aboveVisible = heightAtLine(line) < doc.scrollTop;
        updateLineHeight(line, line.height + widgetHeight(widget));
        if (aboveVisible) { addToScrollTop(cm, widget.height); }
        cm.curOp.forceUpdate = true;
      }
      return true
    });
    if (cm) { signalLater(cm, "lineWidgetAdded", cm, widget, typeof handle == "number" ? handle : lineNo(handle)); }
    return widget
  }

  // TEXTMARKERS

  // Created with markText and setBookmark methods. A TextMarker is a
  // handle that can be used to clear or find a marked position in the
  // document. Line objects hold arrays (markedSpans) containing
  // {from, to, marker} object pointing to such marker objects, and
  // indicating that such a marker is present on that line. Multiple
  // lines may point to the same marker when it spans across lines.
  // The spans will have null for their from/to properties when the
  // marker continues beyond the start/end of the line. Markers have
  // links back to the lines they currently touch.

  // Collapsed markers have unique ids, in order to be able to order
  // them, which is needed for uniquely determining an outer marker
  // when they overlap (they may nest, but not partially overlap).
  var nextMarkerId = 0;

  var TextMarker = function(doc, type) {
    this.lines = [];
    this.type = type;
    this.doc = doc;
    this.id = ++nextMarkerId;
  };

  // Clear the marker.
  TextMarker.prototype.clear = function () {
    if (this.explicitlyCleared) { return }
    var cm = this.doc.cm, withOp = cm && !cm.curOp;
    if (withOp) { startOperation(cm); }
    if (hasHandler(this, "clear")) {
      var found = this.find();
      if (found) { signalLater(this, "clear", found.from, found.to); }
    }
    var min = null, max = null;
    for (var i = 0; i < this.lines.length; ++i) {
      var line = this.lines[i];
      var span = getMarkedSpanFor(line.markedSpans, this);
      if (cm && !this.collapsed) { regLineChange(cm, lineNo(line), "text"); }
      else if (cm) {
        if (span.to != null) { max = lineNo(line); }
        if (span.from != null) { min = lineNo(line); }
      }
      line.markedSpans = removeMarkedSpan(line.markedSpans, span);
      if (span.from == null && this.collapsed && !lineIsHidden(this.doc, line) && cm)
        { updateLineHeight(line, textHeight(cm.display)); }
    }
    if (cm && this.collapsed && !cm.options.lineWrapping) { for (var i$1 = 0; i$1 < this.lines.length; ++i$1) {
      var visual = visualLine(this.lines[i$1]), len = lineLength(visual);
      if (len > cm.display.maxLineLength) {
        cm.display.maxLine = visual;
        cm.display.maxLineLength = len;
        cm.display.maxLineChanged = true;
      }
    } }

    if (min != null && cm && this.collapsed) { regChange(cm, min, max + 1); }
    this.lines.length = 0;
    this.explicitlyCleared = true;
    if (this.atomic && this.doc.cantEdit) {
      this.doc.cantEdit = false;
      if (cm) { reCheckSelection(cm.doc); }
    }
    if (cm) { signalLater(cm, "markerCleared", cm, this, min, max); }
    if (withOp) { endOperation(cm); }
    if (this.parent) { this.parent.clear(); }
  };

  // Find the position of the marker in the document. Returns a {from,
  // to} object by default. Side can be passed to get a specific side
  // -- 0 (both), -1 (left), or 1 (right). When lineObj is true, the
  // Pos objects returned contain a line object, rather than a line
  // number (used to prevent looking up the same line twice).
  TextMarker.prototype.find = function (side, lineObj) {
    if (side == null && this.type == "bookmark") { side = 1; }
    var from, to;
    for (var i = 0; i < this.lines.length; ++i) {
      var line = this.lines[i];
      var span = getMarkedSpanFor(line.markedSpans, this);
      if (span.from != null) {
        from = Pos(lineObj ? line : lineNo(line), span.from);
        if (side == -1) { return from }
      }
      if (span.to != null) {
        to = Pos(lineObj ? line : lineNo(line), span.to);
        if (side == 1) { return to }
      }
    }
    return from && {from: from, to: to}
  };

  // Signals that the marker's widget changed, and surrounding layout
  // should be recomputed.
  TextMarker.prototype.changed = function () {
      var this$1 = this;

    var pos = this.find(-1, true), widget = this, cm = this.doc.cm;
    if (!pos || !cm) { return }
    runInOp(cm, function () {
      var line = pos.line, lineN = lineNo(pos.line);
      var view = findViewForLine(cm, lineN);
      if (view) {
        clearLineMeasurementCacheFor(view);
        cm.curOp.selectionChanged = cm.curOp.forceUpdate = true;
      }
      cm.curOp.updateMaxLine = true;
      if (!lineIsHidden(widget.doc, line) && widget.height != null) {
        var oldHeight = widget.height;
        widget.height = null;
        var dHeight = widgetHeight(widget) - oldHeight;
        if (dHeight)
          { updateLineHeight(line, line.height + dHeight); }
      }
      signalLater(cm, "markerChanged", cm, this$1);
    });
  };

  TextMarker.prototype.attachLine = function (line) {
    if (!this.lines.length && this.doc.cm) {
      var op = this.doc.cm.curOp;
      if (!op.maybeHiddenMarkers || indexOf(op.maybeHiddenMarkers, this) == -1)
        { (op.maybeUnhiddenMarkers || (op.maybeUnhiddenMarkers = [])).push(this); }
    }
    this.lines.push(line);
  };

  TextMarker.prototype.detachLine = function (line) {
    this.lines.splice(indexOf(this.lines, line), 1);
    if (!this.lines.length && this.doc.cm) {
      var op = this.doc.cm.curOp
      ;(op.maybeHiddenMarkers || (op.maybeHiddenMarkers = [])).push(this);
    }
  };
  eventMixin(TextMarker);

  // Create a marker, wire it up to the right lines, and
  function markText(doc, from, to, options, type) {
    // Shared markers (across linked documents) are handled separately
    // (markTextShared will call out to this again, once per
    // document).
    if (options && options.shared) { return markTextShared(doc, from, to, options, type) }
    // Ensure we are in an operation.
    if (doc.cm && !doc.cm.curOp) { return operation(doc.cm, markText)(doc, from, to, options, type) }

    var marker = new TextMarker(doc, type), diff = cmp(from, to);
    if (options) { copyObj(options, marker, false); }
    // Don't connect empty markers unless clearWhenEmpty is false
    if (diff > 0 || diff == 0 && marker.clearWhenEmpty !== false)
      { return marker }
    if (marker.replacedWith) {
      // Showing up as a widget implies collapsed (widget replaces text)
      marker.collapsed = true;
      marker.widgetNode = eltP("span", [marker.replacedWith], "CodeMirror-widget");
      if (!options.handleMouseEvents) { marker.widgetNode.setAttribute("cm-ignore-events", "true"); }
      if (options.insertLeft) { marker.widgetNode.insertLeft = true; }
    }
    if (marker.collapsed) {
      if (conflictingCollapsedRange(doc, from.line, from, to, marker) ||
          from.line != to.line && conflictingCollapsedRange(doc, to.line, from, to, marker))
        { throw new Error("Inserting collapsed marker partially overlapping an existing one") }
      seeCollapsedSpans();
    }

    if (marker.addToHistory)
      { addChangeToHistory(doc, {from: from, to: to, origin: "markText"}, doc.sel, NaN); }

    var curLine = from.line, cm = doc.cm, updateMaxLine;
    doc.iter(curLine, to.line + 1, function (line) {
      if (cm && marker.collapsed && !cm.options.lineWrapping && visualLine(line) == cm.display.maxLine)
        { updateMaxLine = true; }
      if (marker.collapsed && curLine != from.line) { updateLineHeight(line, 0); }
      addMarkedSpan(line, new MarkedSpan(marker,
                                         curLine == from.line ? from.ch : null,
                                         curLine == to.line ? to.ch : null), doc.cm && doc.cm.curOp);
      ++curLine;
    });
    // lineIsHidden depends on the presence of the spans, so needs a second pass
    if (marker.collapsed) { doc.iter(from.line, to.line + 1, function (line) {
      if (lineIsHidden(doc, line)) { updateLineHeight(line, 0); }
    }); }

    if (marker.clearOnEnter) { on(marker, "beforeCursorEnter", function () { return marker.clear(); }); }

    if (marker.readOnly) {
      seeReadOnlySpans();
      if (doc.history.done.length || doc.history.undone.length)
        { doc.clearHistory(); }
    }
    if (marker.collapsed) {
      marker.id = ++nextMarkerId;
      marker.atomic = true;
    }
    if (cm) {
      // Sync editor state
      if (updateMaxLine) { cm.curOp.updateMaxLine = true; }
      if (marker.collapsed)
        { regChange(cm, from.line, to.line + 1); }
      else if (marker.className || marker.startStyle || marker.endStyle || marker.css ||
               marker.attributes || marker.title)
        { for (var i = from.line; i <= to.line; i++) { regLineChange(cm, i, "text"); } }
      if (marker.atomic) { reCheckSelection(cm.doc); }
      signalLater(cm, "markerAdded", cm, marker);
    }
    return marker
  }

  // SHARED TEXTMARKERS

  // A shared marker spans multiple linked documents. It is
  // implemented as a meta-marker-object controlling multiple normal
  // markers.
  var SharedTextMarker = function(markers, primary) {
    this.markers = markers;
    this.primary = primary;
    for (var i = 0; i < markers.length; ++i)
      { markers[i].parent = this; }
  };

  SharedTextMarker.prototype.clear = function () {
    if (this.explicitlyCleared) { return }
    this.explicitlyCleared = true;
    for (var i = 0; i < this.markers.length; ++i)
      { this.markers[i].clear(); }
    signalLater(this, "clear");
  };

  SharedTextMarker.prototype.find = function (side, lineObj) {
    return this.primary.find(side, lineObj)
  };
  eventMixin(SharedTextMarker);

  function markTextShared(doc, from, to, options, type) {
    options = copyObj(options);
    options.shared = false;
    var markers = [markText(doc, from, to, options, type)], primary = markers[0];
    var widget = options.widgetNode;
    linkedDocs(doc, function (doc) {
      if (widget) { options.widgetNode = widget.cloneNode(true); }
      markers.push(markText(doc, clipPos(doc, from), clipPos(doc, to), options, type));
      for (var i = 0; i < doc.linked.length; ++i)
        { if (doc.linked[i].isParent) { return } }
      primary = lst(markers);
    });
    return new SharedTextMarker(markers, primary)
  }

  function findSharedMarkers(doc) {
    return doc.findMarks(Pos(doc.first, 0), doc.clipPos(Pos(doc.lastLine())), function (m) { return m.parent; })
  }

  function copySharedMarkers(doc, markers) {
    for (var i = 0; i < markers.length; i++) {
      var marker = markers[i], pos = marker.find();
      var mFrom = doc.clipPos(pos.from), mTo = doc.clipPos(pos.to);
      if (cmp(mFrom, mTo)) {
        var subMark = markText(doc, mFrom, mTo, marker.primary, marker.primary.type);
        marker.markers.push(subMark);
        subMark.parent = marker;
      }
    }
  }

  function detachSharedMarkers(markers) {
    var loop = function ( i ) {
      var marker = markers[i], linked = [marker.primary.doc];
      linkedDocs(marker.primary.doc, function (d) { return linked.push(d); });
      for (var j = 0; j < marker.markers.length; j++) {
        var subMarker = marker.markers[j];
        if (indexOf(linked, subMarker.doc) == -1) {
          subMarker.parent = null;
          marker.markers.splice(j--, 1);
        }
      }
    };

    for (var i = 0; i < markers.length; i++) loop( i );
  }

  var nextDocId = 0;
  var Doc = function(text, mode, firstLine, lineSep, direction) {
    if (!(this instanceof Doc)) { return new Doc(text, mode, firstLine, lineSep, direction) }
    if (firstLine == null) { firstLine = 0; }

    BranchChunk.call(this, [new LeafChunk([new Line("", null)])]);
    this.first = firstLine;
    this.scrollTop = this.scrollLeft = 0;
    this.cantEdit = false;
    this.cleanGeneration = 1;
    this.modeFrontier = this.highlightFrontier = firstLine;
    var start = Pos(firstLine, 0);
    this.sel = simpleSelection(start);
    this.history = new History(null);
    this.id = ++nextDocId;
    this.modeOption = mode;
    this.lineSep = lineSep;
    this.direction = (direction == "rtl") ? "rtl" : "ltr";
    this.extend = false;

    if (typeof text == "string") { text = this.splitLines(text); }
    updateDoc(this, {from: start, to: start, text: text});
    setSelection(this, simpleSelection(start), sel_dontScroll);
  };

  Doc.prototype = createObj(BranchChunk.prototype, {
    constructor: Doc,
    // Iterate over the document. Supports two forms -- with only one
    // argument, it calls that for each line in the document. With
    // three, it iterates over the range given by the first two (with
    // the second being non-inclusive).
    iter: function(from, to, op) {
      if (op) { this.iterN(from - this.first, to - from, op); }
      else { this.iterN(this.first, this.first + this.size, from); }
    },

    // Non-public interface for adding and removing lines.
    insert: function(at, lines) {
      var height = 0;
      for (var i = 0; i < lines.length; ++i) { height += lines[i].height; }
      this.insertInner(at - this.first, lines, height);
    },
    remove: function(at, n) { this.removeInner(at - this.first, n); },

    // From here, the methods are part of the public interface. Most
    // are also available from CodeMirror (editor) instances.

    getValue: function(lineSep) {
      var lines = getLines(this, this.first, this.first + this.size);
      if (lineSep === false) { return lines }
      return lines.join(lineSep || this.lineSeparator())
    },
    setValue: docMethodOp(function(code) {
      var top = Pos(this.first, 0), last = this.first + this.size - 1;
      makeChange(this, {from: top, to: Pos(last, getLine(this, last).text.length),
                        text: this.splitLines(code), origin: "setValue", full: true}, true);
      if (this.cm) { scrollToCoords(this.cm, 0, 0); }
      setSelection(this, simpleSelection(top), sel_dontScroll);
    }),
    replaceRange: function(code, from, to, origin) {
      from = clipPos(this, from);
      to = to ? clipPos(this, to) : from;
      replaceRange(this, code, from, to, origin);
    },
    getRange: function(from, to, lineSep) {
      var lines = getBetween(this, clipPos(this, from), clipPos(this, to));
      if (lineSep === false) { return lines }
      if (lineSep === '') { return lines.join('') }
      return lines.join(lineSep || this.lineSeparator())
    },

    getLine: function(line) {var l = this.getLineHandle(line); return l && l.text},

    getLineHandle: function(line) {if (isLine(this, line)) { return getLine(this, line) }},
    getLineNumber: function(line) {return lineNo(line)},

    getLineHandleVisualStart: function(line) {
      if (typeof line == "number") { line = getLine(this, line); }
      return visualLine(line)
    },

    lineCount: function() {return this.size},
    firstLine: function() {return this.first},
    lastLine: function() {return this.first + this.size - 1},

    clipPos: function(pos) {return clipPos(this, pos)},

    getCursor: function(start) {
      var range = this.sel.primary(), pos;
      if (start == null || start == "head") { pos = range.head; }
      else if (start == "anchor") { pos = range.anchor; }
      else if (start == "end" || start == "to" || start === false) { pos = range.to(); }
      else { pos = range.from(); }
      return pos
    },
    listSelections: function() { return this.sel.ranges },
    somethingSelected: function() {return this.sel.somethingSelected()},

    setCursor: docMethodOp(function(line, ch, options) {
      setSimpleSelection(this, clipPos(this, typeof line == "number" ? Pos(line, ch || 0) : line), null, options);
    }),
    setSelection: docMethodOp(function(anchor, head, options) {
      setSimpleSelection(this, clipPos(this, anchor), clipPos(this, head || anchor), options);
    }),
    extendSelection: docMethodOp(function(head, other, options) {
      extendSelection(this, clipPos(this, head), other && clipPos(this, other), options);
    }),
    extendSelections: docMethodOp(function(heads, options) {
      extendSelections(this, clipPosArray(this, heads), options);
    }),
    extendSelectionsBy: docMethodOp(function(f, options) {
      var heads = map(this.sel.ranges, f);
      extendSelections(this, clipPosArray(this, heads), options);
    }),
    setSelections: docMethodOp(function(ranges, primary, options) {
      if (!ranges.length) { return }
      var out = [];
      for (var i = 0; i < ranges.length; i++)
        { out[i] = new Range(clipPos(this, ranges[i].anchor),
                           clipPos(this, ranges[i].head || ranges[i].anchor)); }
      if (primary == null) { primary = Math.min(ranges.length - 1, this.sel.primIndex); }
      setSelection(this, normalizeSelection(this.cm, out, primary), options);
    }),
    addSelection: docMethodOp(function(anchor, head, options) {
      var ranges = this.sel.ranges.slice(0);
      ranges.push(new Range(clipPos(this, anchor), clipPos(this, head || anchor)));
      setSelection(this, normalizeSelection(this.cm, ranges, ranges.length - 1), options);
    }),

    getSelection: function(lineSep) {
      var ranges = this.sel.ranges, lines;
      for (var i = 0; i < ranges.length; i++) {
        var sel = getBetween(this, ranges[i].from(), ranges[i].to());
        lines = lines ? lines.concat(sel) : sel;
      }
      if (lineSep === false) { return lines }
      else { return lines.join(lineSep || this.lineSeparator()) }
    },
    getSelections: function(lineSep) {
      var parts = [], ranges = this.sel.ranges;
      for (var i = 0; i < ranges.length; i++) {
        var sel = getBetween(this, ranges[i].from(), ranges[i].to());
        if (lineSep !== false) { sel = sel.join(lineSep || this.lineSeparator()); }
        parts[i] = sel;
      }
      return parts
    },
    replaceSelection: function(code, collapse, origin) {
      var dup = [];
      for (var i = 0; i < this.sel.ranges.length; i++)
        { dup[i] = code; }
      this.replaceSelections(dup, collapse, origin || "+input");
    },
    replaceSelections: docMethodOp(function(code, collapse, origin) {
      var changes = [], sel = this.sel;
      for (var i = 0; i < sel.ranges.length; i++) {
        var range = sel.ranges[i];
        changes[i] = {from: range.from(), to: range.to(), text: this.splitLines(code[i]), origin: origin};
      }
      var newSel = collapse && collapse != "end" && computeReplacedSel(this, changes, collapse);
      for (var i$1 = changes.length - 1; i$1 >= 0; i$1--)
        { makeChange(this, changes[i$1]); }
      if (newSel) { setSelectionReplaceHistory(this, newSel); }
      else if (this.cm) { ensureCursorVisible(this.cm); }
    }),
    undo: docMethodOp(function() {makeChangeFromHistory(this, "undo");}),
    redo: docMethodOp(function() {makeChangeFromHistory(this, "redo");}),
    undoSelection: docMethodOp(function() {makeChangeFromHistory(this, "undo", true);}),
    redoSelection: docMethodOp(function() {makeChangeFromHistory(this, "redo", true);}),

    setExtending: function(val) {this.extend = val;},
    getExtending: function() {return this.extend},

    historySize: function() {
      var hist = this.history, done = 0, undone = 0;
      for (var i = 0; i < hist.done.length; i++) { if (!hist.done[i].ranges) { ++done; } }
      for (var i$1 = 0; i$1 < hist.undone.length; i$1++) { if (!hist.undone[i$1].ranges) { ++undone; } }
      return {undo: done, redo: undone}
    },
    clearHistory: function() {
      var this$1 = this;

      this.history = new History(this.history);
      linkedDocs(this, function (doc) { return doc.history = this$1.history; }, true);
    },

    markClean: function() {
      this.cleanGeneration = this.changeGeneration(true);
    },
    changeGeneration: function(forceSplit) {
      if (forceSplit)
        { this.history.lastOp = this.history.lastSelOp = this.history.lastOrigin = null; }
      return this.history.generation
    },
    isClean: function (gen) {
      return this.history.generation == (gen || this.cleanGeneration)
    },

    getHistory: function() {
      return {done: copyHistoryArray(this.history.done),
              undone: copyHistoryArray(this.history.undone)}
    },
    setHistory: function(histData) {
      var hist = this.history = new History(this.history);
      hist.done = copyHistoryArray(histData.done.slice(0), null, true);
      hist.undone = copyHistoryArray(histData.undone.slice(0), null, true);
    },

    setGutterMarker: docMethodOp(function(line, gutterID, value) {
      return changeLine(this, line, "gutter", function (line) {
        var markers = line.gutterMarkers || (line.gutterMarkers = {});
        markers[gutterID] = value;
        if (!value && isEmpty(markers)) { line.gutterMarkers = null; }
        return true
      })
    }),

    clearGutter: docMethodOp(function(gutterID) {
      var this$1 = this;

      this.iter(function (line) {
        if (line.gutterMarkers && line.gutterMarkers[gutterID]) {
          changeLine(this$1, line, "gutter", function () {
            line.gutterMarkers[gutterID] = null;
            if (isEmpty(line.gutterMarkers)) { line.gutterMarkers = null; }
            return true
          });
        }
      });
    }),

    lineInfo: function(line) {
      var n;
      if (typeof line == "number") {
        if (!isLine(this, line)) { return null }
        n = line;
        line = getLine(this, line);
        if (!line) { return null }
      } else {
        n = lineNo(line);
        if (n == null) { return null }
      }
      return {line: n, handle: line, text: line.text, gutterMarkers: line.gutterMarkers,
              textClass: line.textClass, bgClass: line.bgClass, wrapClass: line.wrapClass,
              widgets: line.widgets}
    },

    addLineClass: docMethodOp(function(handle, where, cls) {
      return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
        var prop = where == "text" ? "textClass"
                 : where == "background" ? "bgClass"
                 : where == "gutter" ? "gutterClass" : "wrapClass";
        if (!line[prop]) { line[prop] = cls; }
        else if (classTest(cls).test(line[prop])) { return false }
        else { line[prop] += " " + cls; }
        return true
      })
    }),
    removeLineClass: docMethodOp(function(handle, where, cls) {
      return changeLine(this, handle, where == "gutter" ? "gutter" : "class", function (line) {
        var prop = where == "text" ? "textClass"
                 : where == "background" ? "bgClass"
                 : where == "gutter" ? "gutterClass" : "wrapClass";
        var cur = line[prop];
        if (!cur) { return false }
        else if (cls == null) { line[prop] = null; }
        else {
          var found = cur.match(classTest(cls));
          if (!found) { return false }
          var end = found.index + found[0].length;
          line[prop] = cur.slice(0, found.index) + (!found.index || end == cur.length ? "" : " ") + cur.slice(end) || null;
        }
        return true
      })
    }),

    addLineWidget: docMethodOp(function(handle, node, options) {
      return addLineWidget(this, handle, node, options)
    }),
    removeLineWidget: function(widget) { widget.clear(); },

    markText: function(from, to, options) {
      return markText(this, clipPos(this, from), clipPos(this, to), options, options && options.type || "range")
    },
    setBookmark: function(pos, options) {
      var realOpts = {replacedWith: options && (options.nodeType == null ? options.widget : options),
                      insertLeft: options && options.insertLeft,
                      clearWhenEmpty: false, shared: options && options.shared,
                      handleMouseEvents: options && options.handleMouseEvents};
      pos = clipPos(this, pos);
      return markText(this, pos, pos, realOpts, "bookmark")
    },
    findMarksAt: function(pos) {
      pos = clipPos(this, pos);
      var markers = [], spans = getLine(this, pos.line).markedSpans;
      if (spans) { for (var i = 0; i < spans.length; ++i) {
        var span = spans[i];
        if ((span.from == null || span.from <= pos.ch) &&
            (span.to == null || span.to >= pos.ch))
          { markers.push(span.marker.parent || span.marker); }
      } }
      return markers
    },
    findMarks: function(from, to, filter) {
      from = clipPos(this, from); to = clipPos(this, to);
      var found = [], lineNo = from.line;
      this.iter(from.line, to.line + 1, function (line) {
        var spans = line.markedSpans;
        if (spans) { for (var i = 0; i < spans.length; i++) {
          var span = spans[i];
          if (!(span.to != null && lineNo == from.line && from.ch >= span.to ||
                span.from == null && lineNo != from.line ||
                span.from != null && lineNo == to.line && span.from >= to.ch) &&
              (!filter || filter(span.marker)))
            { found.push(span.marker.parent || span.marker); }
        } }
        ++lineNo;
      });
      return found
    },
    getAllMarks: function() {
      var markers = [];
      this.iter(function (line) {
        var sps = line.markedSpans;
        if (sps) { for (var i = 0; i < sps.length; ++i)
          { if (sps[i].from != null) { markers.push(sps[i].marker); } } }
      });
      return markers
    },

    posFromIndex: function(off) {
      var ch, lineNo = this.first, sepSize = this.lineSeparator().length;
      this.iter(function (line) {
        var sz = line.text.length + sepSize;
        if (sz > off) { ch = off; return true }
        off -= sz;
        ++lineNo;
      });
      return clipPos(this, Pos(lineNo, ch))
    },
    indexFromPos: function (coords) {
      coords = clipPos(this, coords);
      var index = coords.ch;
      if (coords.line < this.first || coords.ch < 0) { return 0 }
      var sepSize = this.lineSeparator().length;
      this.iter(this.first, coords.line, function (line) { // iter aborts when callback returns a truthy value
        index += line.text.length + sepSize;
      });
      return index
    },

    copy: function(copyHistory) {
      var doc = new Doc(getLines(this, this.first, this.first + this.size),
                        this.modeOption, this.first, this.lineSep, this.direction);
      doc.scrollTop = this.scrollTop; doc.scrollLeft = this.scrollLeft;
      doc.sel = this.sel;
      doc.extend = false;
      if (copyHistory) {
        doc.history.undoDepth = this.history.undoDepth;
        doc.setHistory(this.getHistory());
      }
      return doc
    },

    linkedDoc: function(options) {
      if (!options) { options = {}; }
      var from = this.first, to = this.first + this.size;
      if (options.from != null && options.from > from) { from = options.from; }
      if (options.to != null && options.to < to) { to = options.to; }
      var copy = new Doc(getLines(this, from, to), options.mode || this.modeOption, from, this.lineSep, this.direction);
      if (options.sharedHist) { copy.history = this.history
      ; }(this.linked || (this.linked = [])).push({doc: copy, sharedHist: options.sharedHist});
      copy.linked = [{doc: this, isParent: true, sharedHist: options.sharedHist}];
      copySharedMarkers(copy, findSharedMarkers(this));
      return copy
    },
    unlinkDoc: function(other) {
      if (other instanceof CodeMirror) { other = other.doc; }
      if (this.linked) { for (var i = 0; i < this.linked.length; ++i) {
        var link = this.linked[i];
        if (link.doc != other) { continue }
        this.linked.splice(i, 1);
        other.unlinkDoc(this);
        detachSharedMarkers(findSharedMarkers(this));
        break
      } }
      // If the histories were shared, split them again
      if (other.history == this.history) {
        var splitIds = [other.id];
        linkedDocs(other, function (doc) { return splitIds.push(doc.id); }, true);
        other.history = new History(null);
        other.history.done = copyHistoryArray(this.history.done, splitIds);
        other.history.undone = copyHistoryArray(this.history.undone, splitIds);
      }
    },
    iterLinkedDocs: function(f) {linkedDocs(this, f);},

    getMode: function() {return this.mode},
    getEditor: function() {return this.cm},

    splitLines: function(str) {
      if (this.lineSep) { return str.split(this.lineSep) }
      return splitLinesAuto(str)
    },
    lineSeparator: function() { return this.lineSep || "\n" },

    setDirection: docMethodOp(function (dir) {
      if (dir != "rtl") { dir = "ltr"; }
      if (dir == this.direction) { return }
      this.direction = dir;
      this.iter(function (line) { return line.order = null; });
      if (this.cm) { directionChanged(this.cm); }
    })
  });

  // Public alias.
  Doc.prototype.eachLine = Doc.prototype.iter;

  // Kludge to work around strange IE behavior where it'll sometimes
  // re-fire a series of drag-related events right after the drop (#1551)
  var lastDrop = 0;

  function onDrop(e) {
    var cm = this;
    clearDragCursor(cm);
    if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e))
      { return }
    e_preventDefault(e);
    if (ie) { lastDrop = +new Date; }
    var pos = posFromMouse(cm, e, true), files = e.dataTransfer.files;
    if (!pos || cm.isReadOnly()) { return }
    // Might be a file drop, in which case we simply extract the text
    // and insert it.
    if (files && files.length && window.FileReader && window.File) {
      var n = files.length, text = Array(n), read = 0;
      var markAsReadAndPasteIfAllFilesAreRead = function () {
        if (++read == n) {
          operation(cm, function () {
            pos = clipPos(cm.doc, pos);
            var change = {from: pos, to: pos,
                          text: cm.doc.splitLines(
                              text.filter(function (t) { return t != null; }).join(cm.doc.lineSeparator())),
                          origin: "paste"};
            makeChange(cm.doc, change);
            setSelectionReplaceHistory(cm.doc, simpleSelection(clipPos(cm.doc, pos), clipPos(cm.doc, changeEnd(change))));
          })();
        }
      };
      var readTextFromFile = function (file, i) {
        if (cm.options.allowDropFileTypes &&
            indexOf(cm.options.allowDropFileTypes, file.type) == -1) {
          markAsReadAndPasteIfAllFilesAreRead();
          return
        }
        var reader = new FileReader;
        reader.onerror = function () { return markAsReadAndPasteIfAllFilesAreRead(); };
        reader.onload = function () {
          var content = reader.result;
          if (/[\x00-\x08\x0e-\x1f]{2}/.test(content)) {
            markAsReadAndPasteIfAllFilesAreRead();
            return
          }
          text[i] = content;
          markAsReadAndPasteIfAllFilesAreRead();
        };
        reader.readAsText(file);
      };
      for (var i = 0; i < files.length; i++) { readTextFromFile(files[i], i); }
    } else { // Normal drop
      // Don't do a replace if the drop happened inside of the selected text.
      if (cm.state.draggingText && cm.doc.sel.contains(pos) > -1) {
        cm.state.draggingText(e);
        // Ensure the editor is re-focused
        setTimeout(function () { return cm.display.input.focus(); }, 20);
        return
      }
      try {
        var text$1 = e.dataTransfer.getData("Text");
        if (text$1) {
          var selected;
          if (cm.state.draggingText && !cm.state.draggingText.copy)
            { selected = cm.listSelections(); }
          setSelectionNoUndo(cm.doc, simpleSelection(pos, pos));
          if (selected) { for (var i$1 = 0; i$1 < selected.length; ++i$1)
            { replaceRange(cm.doc, "", selected[i$1].anchor, selected[i$1].head, "drag"); } }
          cm.replaceSelection(text$1, "around", "paste");
          cm.display.input.focus();
        }
      }
      catch(e$1){}
    }
  }

  function onDragStart(cm, e) {
    if (ie && (!cm.state.draggingText || +new Date - lastDrop < 100)) { e_stop(e); return }
    if (signalDOMEvent(cm, e) || eventInWidget(cm.display, e)) { return }

    e.dataTransfer.setData("Text", cm.getSelection());
    e.dataTransfer.effectAllowed = "copyMove";

    // Use dummy image instead of default browsers image.
    // Recent Safari (~6.0.2) have a tendency to segfault when this happens, so we don't do it there.
    if (e.dataTransfer.setDragImage && !safari) {
      var img = elt("img", null, null, "position: fixed; left: 0; top: 0;");
      img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
      if (presto) {
        img.width = img.height = 1;
        cm.display.wrapper.appendChild(img);
        // Force a relayout, or Opera won't use our image for some obscure reason
        img._top = img.offsetTop;
      }
      e.dataTransfer.setDragImage(img, 0, 0);
      if (presto) { img.parentNode.removeChild(img); }
    }
  }

  function onDragOver(cm, e) {
    var pos = posFromMouse(cm, e);
    if (!pos) { return }
    var frag = document.createDocumentFragment();
    drawSelectionCursor(cm, pos, frag);
    if (!cm.display.dragCursor) {
      cm.display.dragCursor = elt("div", null, "CodeMirror-cursors CodeMirror-dragcursors");
      cm.display.lineSpace.insertBefore(cm.display.dragCursor, cm.display.cursorDiv);
    }
    removeChildrenAndAdd(cm.display.dragCursor, frag);
  }

  function clearDragCursor(cm) {
    if (cm.display.dragCursor) {
      cm.display.lineSpace.removeChild(cm.display.dragCursor);
      cm.display.dragCursor = null;
    }
  }

  // These must be handled carefully, because naively registering a
  // handler for each editor will cause the editors to never be
  // garbage collected.

  function forEachCodeMirror(f) {
    if (!document.getElementsByClassName) { return }
    var byClass = document.getElementsByClassName("CodeMirror"), editors = [];
    for (var i = 0; i < byClass.length; i++) {
      var cm = byClass[i].CodeMirror;
      if (cm) { editors.push(cm); }
    }
    if (editors.length) { editors[0].operation(function () {
      for (var i = 0; i < editors.length; i++) { f(editors[i]); }
    }); }
  }

  var globalsRegistered = false;
  function ensureGlobalHandlers() {
    if (globalsRegistered) { return }
    registerGlobalHandlers();
    globalsRegistered = true;
  }
  function registerGlobalHandlers() {
    // When the window resizes, we need to refresh active editors.
    var resizeTimer;
    on(window, "resize", function () {
      if (resizeTimer == null) { resizeTimer = setTimeout(function () {
        resizeTimer = null;
        forEachCodeMirror(onResize);
      }, 100); }
    });
    // When the window loses focus, we want to show the editor as blurred
    on(window, "blur", function () { return forEachCodeMirror(onBlur); });
  }
  // Called when the window resizes
  function onResize(cm) {
    var d = cm.display;
    // Might be a text scaling operation, clear size caches.
    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null;
    d.scrollbarsClipped = false;
    cm.setSize();
  }

  var keyNames = {
    3: "Pause", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
    19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
    36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
    46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
    106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 145: "ScrollLock",
    173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
    221: "]", 222: "'", 224: "Mod", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
    63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
  };

  // Number keys
  for (var i = 0; i < 10; i++) { keyNames[i + 48] = keyNames[i + 96] = String(i); }
  // Alphabetic keys
  for (var i$1 = 65; i$1 <= 90; i$1++) { keyNames[i$1] = String.fromCharCode(i$1); }
  // Function keys
  for (var i$2 = 1; i$2 <= 12; i$2++) { keyNames[i$2 + 111] = keyNames[i$2 + 63235] = "F" + i$2; }

  var keyMap = {};

  keyMap.basic = {
    "Left": "goCharLeft", "Right": "goCharRight", "Up": "goLineUp", "Down": "goLineDown",
    "End": "goLineEnd", "Home": "goLineStartSmart", "PageUp": "goPageUp", "PageDown": "goPageDown",
    "Delete": "delCharAfter", "Backspace": "delCharBefore", "Shift-Backspace": "delCharBefore",
    "Tab": "defaultTab", "Shift-Tab": "indentAuto",
    "Enter": "newlineAndIndent", "Insert": "toggleOverwrite",
    "Esc": "singleSelection"
  };
  // Note that the save and find-related commands aren't defined by
  // default. User code or addons can define them. Unknown commands
  // are simply ignored.
  keyMap.pcDefault = {
    "Ctrl-A": "selectAll", "Ctrl-D": "deleteLine", "Ctrl-Z": "undo", "Shift-Ctrl-Z": "redo", "Ctrl-Y": "redo",
    "Ctrl-Home": "goDocStart", "Ctrl-End": "goDocEnd", "Ctrl-Up": "goLineUp", "Ctrl-Down": "goLineDown",
    "Ctrl-Left": "goGroupLeft", "Ctrl-Right": "goGroupRight", "Alt-Left": "goLineStart", "Alt-Right": "goLineEnd",
    "Ctrl-Backspace": "delGroupBefore", "Ctrl-Delete": "delGroupAfter", "Ctrl-S": "save", "Ctrl-F": "find",
    "Ctrl-G": "findNext", "Shift-Ctrl-G": "findPrev", "Shift-Ctrl-F": "replace", "Shift-Ctrl-R": "replaceAll",
    "Ctrl-[": "indentLess", "Ctrl-]": "indentMore",
    "Ctrl-U": "undoSelection", "Shift-Ctrl-U": "redoSelection", "Alt-U": "redoSelection",
    "fallthrough": "basic"
  };
  // Very basic readline/emacs-style bindings, which are standard on Mac.
  keyMap.emacsy = {
    "Ctrl-F": "goCharRight", "Ctrl-B": "goCharLeft", "Ctrl-P": "goLineUp", "Ctrl-N": "goLineDown",
    "Ctrl-A": "goLineStart", "Ctrl-E": "goLineEnd", "Ctrl-V": "goPageDown", "Shift-Ctrl-V": "goPageUp",
    "Ctrl-D": "delCharAfter", "Ctrl-H": "delCharBefore", "Alt-Backspace": "delWordBefore", "Ctrl-K": "killLine",
    "Ctrl-T": "transposeChars", "Ctrl-O": "openLine"
  };
  keyMap.macDefault = {
    "Cmd-A": "selectAll", "Cmd-D": "deleteLine", "Cmd-Z": "undo", "Shift-Cmd-Z": "redo", "Cmd-Y": "redo",
    "Cmd-Home": "goDocStart", "Cmd-Up": "goDocStart", "Cmd-End": "goDocEnd", "Cmd-Down": "goDocEnd", "Alt-Left": "goGroupLeft",
    "Alt-Right": "goGroupRight", "Cmd-Left": "goLineLeft", "Cmd-Right": "goLineRight", "Alt-Backspace": "delGroupBefore",
    "Ctrl-Alt-Backspace": "delGroupAfter", "Alt-Delete": "delGroupAfter", "Cmd-S": "save", "Cmd-F": "find",
    "Cmd-G": "findNext", "Shift-Cmd-G": "findPrev", "Cmd-Alt-F": "replace", "Shift-Cmd-Alt-F": "replaceAll",
    "Cmd-[": "indentLess", "Cmd-]": "indentMore", "Cmd-Backspace": "delWrappedLineLeft", "Cmd-Delete": "delWrappedLineRight",
    "Cmd-U": "undoSelection", "Shift-Cmd-U": "redoSelection", "Ctrl-Up": "goDocStart", "Ctrl-Down": "goDocEnd",
    "fallthrough": ["basic", "emacsy"]
  };
  keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;

  // KEYMAP DISPATCH

  function normalizeKeyName(name) {
    var parts = name.split(/-(?!$)/);
    name = parts[parts.length - 1];
    var alt, ctrl, shift, cmd;
    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i];
      if (/^(cmd|meta|m)$/i.test(mod)) { cmd = true; }
      else if (/^a(lt)?$/i.test(mod)) { alt = true; }
      else if (/^(c|ctrl|control)$/i.test(mod)) { ctrl = true; }
      else if (/^s(hift)?$/i.test(mod)) { shift = true; }
      else { throw new Error("Unrecognized modifier name: " + mod) }
    }
    if (alt) { name = "Alt-" + name; }
    if (ctrl) { name = "Ctrl-" + name; }
    if (cmd) { name = "Cmd-" + name; }
    if (shift) { name = "Shift-" + name; }
    return name
  }

  // This is a kludge to keep keymaps mostly working as raw objects
  // (backwards compatibility) while at the same time support features
  // like normalization and multi-stroke key bindings. It compiles a
  // new normalized keymap, and then updates the old object to reflect
  // this.
  function normalizeKeyMap(keymap) {
    var copy = {};
    for (var keyname in keymap) { if (keymap.hasOwnProperty(keyname)) {
      var value = keymap[keyname];
      if (/^(name|fallthrough|(de|at)tach)$/.test(keyname)) { continue }
      if (value == "...") { delete keymap[keyname]; continue }

      var keys = map(keyname.split(" "), normalizeKeyName);
      for (var i = 0; i < keys.length; i++) {
        var val = (void 0), name = (void 0);
        if (i == keys.length - 1) {
          name = keys.join(" ");
          val = value;
        } else {
          name = keys.slice(0, i + 1).join(" ");
          val = "...";
        }
        var prev = copy[name];
        if (!prev) { copy[name] = val; }
        else if (prev != val) { throw new Error("Inconsistent bindings for " + name) }
      }
      delete keymap[keyname];
    } }
    for (var prop in copy) { keymap[prop] = copy[prop]; }
    return keymap
  }

  function lookupKey(key, map, handle, context) {
    map = getKeyMap(map);
    var found = map.call ? map.call(key, context) : map[key];
    if (found === false) { return "nothing" }
    if (found === "...") { return "multi" }
    if (found != null && handle(found)) { return "handled" }

    if (map.fallthrough) {
      if (Object.prototype.toString.call(map.fallthrough) != "[object Array]")
        { return lookupKey(key, map.fallthrough, handle, context) }
      for (var i = 0; i < map.fallthrough.length; i++) {
        var result = lookupKey(key, map.fallthrough[i], handle, context);
        if (result) { return result }
      }
    }
  }

  // Modifier key presses don't count as 'real' key presses for the
  // purpose of keymap fallthrough.
  function isModifierKey(value) {
    var name = typeof value == "string" ? value : keyNames[value.keyCode];
    return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
  }

  function addModifierNames(name, event, noShift) {
    var base = name;
    if (event.altKey && base != "Alt") { name = "Alt-" + name; }
    if ((flipCtrlCmd ? event.metaKey : event.ctrlKey) && base != "Ctrl") { name = "Ctrl-" + name; }
    if ((flipCtrlCmd ? event.ctrlKey : event.metaKey) && base != "Mod") { name = "Cmd-" + name; }
    if (!noShift && event.shiftKey && base != "Shift") { name = "Shift-" + name; }
    return name
  }

  // Look up the name of a key as indicated by an event object.
  function keyName(event, noShift) {
    if (presto && event.keyCode == 34 && event["char"]) { return false }
    var name = keyNames[event.keyCode];
    if (name == null || event.altGraphKey) { return false }
    // Ctrl-ScrollLock has keyCode 3, same as Ctrl-Pause,
    // so we'll use event.code when available (Chrome 48+, FF 38+, Safari 10.1+)
    if (event.keyCode == 3 && event.code) { name = event.code; }
    return addModifierNames(name, event, noShift)
  }

  function getKeyMap(val) {
    return typeof val == "string" ? keyMap[val] : val
  }

  // Helper for deleting text near the selection(s), used to implement
  // backspace, delete, and similar functionality.
  function deleteNearSelection(cm, compute) {
    var ranges = cm.doc.sel.ranges, kill = [];
    // Build up a set of ranges to kill first, merging overlapping
    // ranges.
    for (var i = 0; i < ranges.length; i++) {
      var toKill = compute(ranges[i]);
      while (kill.length && cmp(toKill.from, lst(kill).to) <= 0) {
        var replaced = kill.pop();
        if (cmp(replaced.from, toKill.from) < 0) {
          toKill.from = replaced.from;
          break
        }
      }
      kill.push(toKill);
    }
    // Next, remove those actual ranges.
    runInOp(cm, function () {
      for (var i = kill.length - 1; i >= 0; i--)
        { replaceRange(cm.doc, "", kill[i].from, kill[i].to, "+delete"); }
      ensureCursorVisible(cm);
    });
  }

  function moveCharLogically(line, ch, dir) {
    var target = skipExtendingChars(line.text, ch + dir, dir);
    return target < 0 || target > line.text.length ? null : target
  }

  function moveLogically(line, start, dir) {
    var ch = moveCharLogically(line, start.ch, dir);
    return ch == null ? null : new Pos(start.line, ch, dir < 0 ? "after" : "before")
  }

  function endOfLine(visually, cm, lineObj, lineNo, dir) {
    if (visually) {
      if (cm.doc.direction == "rtl") { dir = -dir; }
      var order = getOrder(lineObj, cm.doc.direction);
      if (order) {
        var part = dir < 0 ? lst(order) : order[0];
        var moveInStorageOrder = (dir < 0) == (part.level == 1);
        var sticky = moveInStorageOrder ? "after" : "before";
        var ch;
        // With a wrapped rtl chunk (possibly spanning multiple bidi parts),
        // it could be that the last bidi part is not on the last visual line,
        // since visual lines contain content order-consecutive chunks.
        // Thus, in rtl, we are looking for the first (content-order) character
        // in the rtl chunk that is on the last line (that is, the same line
        // as the last (content-order) character).
        if (part.level > 0 || cm.doc.direction == "rtl") {
          var prep = prepareMeasureForLine(cm, lineObj);
          ch = dir < 0 ? lineObj.text.length - 1 : 0;
          var targetTop = measureCharPrepared(cm, prep, ch).top;
          ch = findFirst(function (ch) { return measureCharPrepared(cm, prep, ch).top == targetTop; }, (dir < 0) == (part.level == 1) ? part.from : part.to - 1, ch);
          if (sticky == "before") { ch = moveCharLogically(lineObj, ch, 1); }
        } else { ch = dir < 0 ? part.to : part.from; }
        return new Pos(lineNo, ch, sticky)
      }
    }
    return new Pos(lineNo, dir < 0 ? lineObj.text.length : 0, dir < 0 ? "before" : "after")
  }

  function moveVisually(cm, line, start, dir) {
    var bidi = getOrder(line, cm.doc.direction);
    if (!bidi) { return moveLogically(line, start, dir) }
    if (start.ch >= line.text.length) {
      start.ch = line.text.length;
      start.sticky = "before";
    } else if (start.ch <= 0) {
      start.ch = 0;
      start.sticky = "after";
    }
    var partPos = getBidiPartAt(bidi, start.ch, start.sticky), part = bidi[partPos];
    if (cm.doc.direction == "ltr" && part.level % 2 == 0 && (dir > 0 ? part.to > start.ch : part.from < start.ch)) {
      // Case 1: We move within an ltr part in an ltr editor. Even with wrapped lines,
      // nothing interesting happens.
      return moveLogically(line, start, dir)
    }

    var mv = function (pos, dir) { return moveCharLogically(line, pos instanceof Pos ? pos.ch : pos, dir); };
    var prep;
    var getWrappedLineExtent = function (ch) {
      if (!cm.options.lineWrapping) { return {begin: 0, end: line.text.length} }
      prep = prep || prepareMeasureForLine(cm, line);
      return wrappedLineExtentChar(cm, line, prep, ch)
    };
    var wrappedLineExtent = getWrappedLineExtent(start.sticky == "before" ? mv(start, -1) : start.ch);

    if (cm.doc.direction == "rtl" || part.level == 1) {
      var moveInStorageOrder = (part.level == 1) == (dir < 0);
      var ch = mv(start, moveInStorageOrder ? 1 : -1);
      if (ch != null && (!moveInStorageOrder ? ch >= part.from && ch >= wrappedLineExtent.begin : ch <= part.to && ch <= wrappedLineExtent.end)) {
        // Case 2: We move within an rtl part or in an rtl editor on the same visual line
        var sticky = moveInStorageOrder ? "before" : "after";
        return new Pos(start.line, ch, sticky)
      }
    }

    // Case 3: Could not move within this bidi part in this visual line, so leave
    // the current bidi part

    var searchInVisualLine = function (partPos, dir, wrappedLineExtent) {
      var getRes = function (ch, moveInStorageOrder) { return moveInStorageOrder
        ? new Pos(start.line, mv(ch, 1), "before")
        : new Pos(start.line, ch, "after"); };

      for (; partPos >= 0 && partPos < bidi.length; partPos += dir) {
        var part = bidi[partPos];
        var moveInStorageOrder = (dir > 0) == (part.level != 1);
        var ch = moveInStorageOrder ? wrappedLineExtent.begin : mv(wrappedLineExtent.end, -1);
        if (part.from <= ch && ch < part.to) { return getRes(ch, moveInStorageOrder) }
        ch = moveInStorageOrder ? part.from : mv(part.to, -1);
        if (wrappedLineExtent.begin <= ch && ch < wrappedLineExtent.end) { return getRes(ch, moveInStorageOrder) }
      }
    };

    // Case 3a: Look for other bidi parts on the same visual line
    var res = searchInVisualLine(partPos + dir, dir, wrappedLineExtent);
    if (res) { return res }

    // Case 3b: Look for other bidi parts on the next visual line
    var nextCh = dir > 0 ? wrappedLineExtent.end : mv(wrappedLineExtent.begin, -1);
    if (nextCh != null && !(dir > 0 && nextCh == line.text.length)) {
      res = searchInVisualLine(dir > 0 ? 0 : bidi.length - 1, dir, getWrappedLineExtent(nextCh));
      if (res) { return res }
    }

    // Case 4: Nowhere to move
    return null
  }

  // Commands are parameter-less actions that can be performed on an
  // editor, mostly used for keybindings.
  var commands = {
    selectAll: selectAll,
    singleSelection: function (cm) { return cm.setSelection(cm.getCursor("anchor"), cm.getCursor("head"), sel_dontScroll); },
    killLine: function (cm) { return deleteNearSelection(cm, function (range) {
      if (range.empty()) {
        var len = getLine(cm.doc, range.head.line).text.length;
        if (range.head.ch == len && range.head.line < cm.lastLine())
          { return {from: range.head, to: Pos(range.head.line + 1, 0)} }
        else
          { return {from: range.head, to: Pos(range.head.line, len)} }
      } else {
        return {from: range.from(), to: range.to()}
      }
    }); },
    deleteLine: function (cm) { return deleteNearSelection(cm, function (range) { return ({
      from: Pos(range.from().line, 0),
      to: clipPos(cm.doc, Pos(range.to().line + 1, 0))
    }); }); },
    delLineLeft: function (cm) { return deleteNearSelection(cm, function (range) { return ({
      from: Pos(range.from().line, 0), to: range.from()
    }); }); },
    delWrappedLineLeft: function (cm) { return deleteNearSelection(cm, function (range) {
      var top = cm.charCoords(range.head, "div").top + 5;
      var leftPos = cm.coordsChar({left: 0, top: top}, "div");
      return {from: leftPos, to: range.from()}
    }); },
    delWrappedLineRight: function (cm) { return deleteNearSelection(cm, function (range) {
      var top = cm.charCoords(range.head, "div").top + 5;
      var rightPos = cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div");
      return {from: range.from(), to: rightPos }
    }); },
    undo: function (cm) { return cm.undo(); },
    redo: function (cm) { return cm.redo(); },
    undoSelection: function (cm) { return cm.undoSelection(); },
    redoSelection: function (cm) { return cm.redoSelection(); },
    goDocStart: function (cm) { return cm.extendSelection(Pos(cm.firstLine(), 0)); },
    goDocEnd: function (cm) { return cm.extendSelection(Pos(cm.lastLine())); },
    goLineStart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStart(cm, range.head.line); },
      {origin: "+move", bias: 1}
    ); },
    goLineStartSmart: function (cm) { return cm.extendSelectionsBy(function (range) { return lineStartSmart(cm, range.head); },
      {origin: "+move", bias: 1}
    ); },
    goLineEnd: function (cm) { return cm.extendSelectionsBy(function (range) { return lineEnd(cm, range.head.line); },
      {origin: "+move", bias: -1}
    ); },
    goLineRight: function (cm) { return cm.extendSelectionsBy(function (range) {
      var top = cm.cursorCoords(range.head, "div").top + 5;
      return cm.coordsChar({left: cm.display.lineDiv.offsetWidth + 100, top: top}, "div")
    }, sel_move); },
    goLineLeft: function (cm) { return cm.extendSelectionsBy(function (range) {
      var top = cm.cursorCoords(range.head, "div").top + 5;
      return cm.coordsChar({left: 0, top: top}, "div")
    }, sel_move); },
    goLineLeftSmart: function (cm) { return cm.extendSelectionsBy(function (range) {
      var top = cm.cursorCoords(range.head, "div").top + 5;
      var pos = cm.coordsChar({left: 0, top: top}, "div");
      if (pos.ch < cm.getLine(pos.line).search(/\S/)) { return lineStartSmart(cm, range.head) }
      return pos
    }, sel_move); },
    goLineUp: function (cm) { return cm.moveV(-1, "line"); },
    goLineDown: function (cm) { return cm.moveV(1, "line"); },
    goPageUp: function (cm) { return cm.moveV(-1, "page"); },
    goPageDown: function (cm) { return cm.moveV(1, "page"); },
    goCharLeft: function (cm) { return cm.moveH(-1, "char"); },
    goCharRight: function (cm) { return cm.moveH(1, "char"); },
    goColumnLeft: function (cm) { return cm.moveH(-1, "column"); },
    goColumnRight: function (cm) { return cm.moveH(1, "column"); },
    goWordLeft: function (cm) { return cm.moveH(-1, "word"); },
    goGroupRight: function (cm) { return cm.moveH(1, "group"); },
    goGroupLeft: function (cm) { return cm.moveH(-1, "group"); },
    goWordRight: function (cm) { return cm.moveH(1, "word"); },
    delCharBefore: function (cm) { return cm.deleteH(-1, "codepoint"); },
    delCharAfter: function (cm) { return cm.deleteH(1, "char"); },
    delWordBefore: function (cm) { return cm.deleteH(-1, "word"); },
    delWordAfter: function (cm) { return cm.deleteH(1, "word"); },
    delGroupBefore: function (cm) { return cm.deleteH(-1, "group"); },
    delGroupAfter: function (cm) { return cm.deleteH(1, "group"); },
    indentAuto: function (cm) { return cm.indentSelection("smart"); },
    indentMore: function (cm) { return cm.indentSelection("add"); },
    indentLess: function (cm) { return cm.indentSelection("subtract"); },
    insertTab: function (cm) { return cm.replaceSelection("\t"); },
    insertSoftTab: function (cm) {
      var spaces = [], ranges = cm.listSelections(), tabSize = cm.options.tabSize;
      for (var i = 0; i < ranges.length; i++) {
        var pos = ranges[i].from();
        var col = countColumn(cm.getLine(pos.line), pos.ch, tabSize);
        spaces.push(spaceStr(tabSize - col % tabSize));
      }
      cm.replaceSelections(spaces);
    },
    defaultTab: function (cm) {
      if (cm.somethingSelected()) { cm.indentSelection("add"); }
      else { cm.execCommand("insertTab"); }
    },
    // Swap the two chars left and right of each selection's head.
    // Move cursor behind the two swapped characters afterwards.
    //
    // Doesn't consider line feeds a character.
    // Doesn't scan more than one line above to find a character.
    // Doesn't do anything on an empty line.
    // Doesn't do anything with non-empty selections.
    transposeChars: function (cm) { return runInOp(cm, function () {
      var ranges = cm.listSelections(), newSel = [];
      for (var i = 0; i < ranges.length; i++) {
        if (!ranges[i].empty()) { continue }
        var cur = ranges[i].head, line = getLine(cm.doc, cur.line).text;
        if (line) {
          if (cur.ch == line.length) { cur = new Pos(cur.line, cur.ch - 1); }
          if (cur.ch > 0) {
            cur = new Pos(cur.line, cur.ch + 1);
            cm.replaceRange(line.charAt(cur.ch - 1) + line.charAt(cur.ch - 2),
                            Pos(cur.line, cur.ch - 2), cur, "+transpose");
          } else if (cur.line > cm.doc.first) {
            var prev = getLine(cm.doc, cur.line - 1).text;
            if (prev) {
              cur = new Pos(cur.line, 1);
              cm.replaceRange(line.charAt(0) + cm.doc.lineSeparator() +
                              prev.charAt(prev.length - 1),
                              Pos(cur.line - 1, prev.length - 1), cur, "+transpose");
            }
          }
        }
        newSel.push(new Range(cur, cur));
      }
      cm.setSelections(newSel);
    }); },
    newlineAndIndent: function (cm) { return runInOp(cm, function () {
      var sels = cm.listSelections();
      for (var i = sels.length - 1; i >= 0; i--)
        { cm.replaceRange(cm.doc.lineSeparator(), sels[i].anchor, sels[i].head, "+input"); }
      sels = cm.listSelections();
      for (var i$1 = 0; i$1 < sels.length; i$1++)
        { cm.indentLine(sels[i$1].from().line, null, true); }
      ensureCursorVisible(cm);
    }); },
    openLine: function (cm) { return cm.replaceSelection("\n", "start"); },
    toggleOverwrite: function (cm) { return cm.toggleOverwrite(); }
  };


  function lineStart(cm, lineN) {
    var line = getLine(cm.doc, lineN);
    var visual = visualLine(line);
    if (visual != line) { lineN = lineNo(visual); }
    return endOfLine(true, cm, visual, lineN, 1)
  }
  function lineEnd(cm, lineN) {
    var line = getLine(cm.doc, lineN);
    var visual = visualLineEnd(line);
    if (visual != line) { lineN = lineNo(visual); }
    return endOfLine(true, cm, line, lineN, -1)
  }
  function lineStartSmart(cm, pos) {
    var start = lineStart(cm, pos.line);
    var line = getLine(cm.doc, start.line);
    var order = getOrder(line, cm.doc.direction);
    if (!order || order[0].level == 0) {
      var firstNonWS = Math.max(start.ch, line.text.search(/\S/));
      var inWS = pos.line == start.line && pos.ch <= firstNonWS && pos.ch;
      return Pos(start.line, inWS ? 0 : firstNonWS, start.sticky)
    }
    return start
  }

  // Run a handler that was bound to a key.
  function doHandleBinding(cm, bound, dropShift) {
    if (typeof bound == "string") {
      bound = commands[bound];
      if (!bound) { return false }
    }
    // Ensure previous input has been read, so that the handler sees a
    // consistent view of the document
    cm.display.input.ensurePolled();
    var prevShift = cm.display.shift, done = false;
    try {
      if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
      if (dropShift) { cm.display.shift = false; }
      done = bound(cm) != Pass;
    } finally {
      cm.display.shift = prevShift;
      cm.state.suppressEdits = false;
    }
    return done
  }

  function lookupKeyForEditor(cm, name, handle) {
    for (var i = 0; i < cm.state.keyMaps.length; i++) {
      var result = lookupKey(name, cm.state.keyMaps[i], handle, cm);
      if (result) { return result }
    }
    return (cm.options.extraKeys && lookupKey(name, cm.options.extraKeys, handle, cm))
      || lookupKey(name, cm.options.keyMap, handle, cm)
  }

  // Note that, despite the name, this function is also used to check
  // for bound mouse clicks.

  var stopSeq = new Delayed;

  function dispatchKey(cm, name, e, handle) {
    var seq = cm.state.keySeq;
    if (seq) {
      if (isModifierKey(name)) { return "handled" }
      if (/\'$/.test(name))
        { cm.state.keySeq = null; }
      else
        { stopSeq.set(50, function () {
          if (cm.state.keySeq == seq) {
            cm.state.keySeq = null;
            cm.display.input.reset();
          }
        }); }
      if (dispatchKeyInner(cm, seq + " " + name, e, handle)) { return true }
    }
    return dispatchKeyInner(cm, name, e, handle)
  }

  function dispatchKeyInner(cm, name, e, handle) {
    var result = lookupKeyForEditor(cm, name, handle);

    if (result == "multi")
      { cm.state.keySeq = name; }
    if (result == "handled")
      { signalLater(cm, "keyHandled", cm, name, e); }

    if (result == "handled" || result == "multi") {
      e_preventDefault(e);
      restartBlink(cm);
    }

    return !!result
  }

  // Handle a key from the keydown event.
  function handleKeyBinding(cm, e) {
    var name = keyName(e, true);
    if (!name) { return false }

    if (e.shiftKey && !cm.state.keySeq) {
      // First try to resolve full name (including 'Shift-'). Failing
      // that, see if there is a cursor-motion command (starting with
      // 'go') bound to the keyname without 'Shift-'.
      return dispatchKey(cm, "Shift-" + name, e, function (b) { return doHandleBinding(cm, b, true); })
          || dispatchKey(cm, name, e, function (b) {
               if (typeof b == "string" ? /^go[A-Z]/.test(b) : b.motion)
                 { return doHandleBinding(cm, b) }
             })
    } else {
      return dispatchKey(cm, name, e, function (b) { return doHandleBinding(cm, b); })
    }
  }

  // Handle a key from the keypress event
  function handleCharBinding(cm, e, ch) {
    return dispatchKey(cm, "'" + ch + "'", e, function (b) { return doHandleBinding(cm, b, true); })
  }

  var lastStoppedKey = null;
  function onKeyDown(e) {
    var cm = this;
    if (e.target && e.target != cm.display.input.getField()) { return }
    cm.curOp.focus = activeElt();
    if (signalDOMEvent(cm, e)) { return }
    // IE does strange things with escape.
    if (ie && ie_version < 11 && e.keyCode == 27) { e.returnValue = false; }
    var code = e.keyCode;
    cm.display.shift = code == 16 || e.shiftKey;
    var handled = handleKeyBinding(cm, e);
    if (presto) {
      lastStoppedKey = handled ? code : null;
      // Opera has no cut event... we try to at least catch the key combo
      if (!handled && code == 88 && !hasCopyEvent && (mac ? e.metaKey : e.ctrlKey))
        { cm.replaceSelection("", null, "cut"); }
    }
    if (gecko && !mac && !handled && code == 46 && e.shiftKey && !e.ctrlKey && document.execCommand)
      { document.execCommand("cut"); }

    // Turn mouse into crosshair when Alt is held on Mac.
    if (code == 18 && !/\bCodeMirror-crosshair\b/.test(cm.display.lineDiv.className))
      { showCrossHair(cm); }
  }

  function showCrossHair(cm) {
    var lineDiv = cm.display.lineDiv;
    addClass(lineDiv, "CodeMirror-crosshair");

    function up(e) {
      if (e.keyCode == 18 || !e.altKey) {
        rmClass(lineDiv, "CodeMirror-crosshair");
        off(document, "keyup", up);
        off(document, "mouseover", up);
      }
    }
    on(document, "keyup", up);
    on(document, "mouseover", up);
  }

  function onKeyUp(e) {
    if (e.keyCode == 16) { this.doc.sel.shift = false; }
    signalDOMEvent(this, e);
  }

  function onKeyPress(e) {
    var cm = this;
    if (e.target && e.target != cm.display.input.getField()) { return }
    if (eventInWidget(cm.display, e) || signalDOMEvent(cm, e) || e.ctrlKey && !e.altKey || mac && e.metaKey) { return }
    var keyCode = e.keyCode, charCode = e.charCode;
    if (presto && keyCode == lastStoppedKey) {lastStoppedKey = null; e_preventDefault(e); return}
    if ((presto && (!e.which || e.which < 10)) && handleKeyBinding(cm, e)) { return }
    var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
    // Some browsers fire keypress events for backspace
    if (ch == "\x08") { return }
    if (handleCharBinding(cm, e, ch)) { return }
    cm.display.input.onKeyPress(e);
  }

  var DOUBLECLICK_DELAY = 400;

  var PastClick = function(time, pos, button) {
    this.time = time;
    this.pos = pos;
    this.button = button;
  };

  PastClick.prototype.compare = function (time, pos, button) {
    return this.time + DOUBLECLICK_DELAY > time &&
      cmp(pos, this.pos) == 0 && button == this.button
  };

  var lastClick, lastDoubleClick;
  function clickRepeat(pos, button) {
    var now = +new Date;
    if (lastDoubleClick && lastDoubleClick.compare(now, pos, button)) {
      lastClick = lastDoubleClick = null;
      return "triple"
    } else if (lastClick && lastClick.compare(now, pos, button)) {
      lastDoubleClick = new PastClick(now, pos, button);
      lastClick = null;
      return "double"
    } else {
      lastClick = new PastClick(now, pos, button);
      lastDoubleClick = null;
      return "single"
    }
  }

  // A mouse down can be a single click, double click, triple click,
  // start of selection drag, start of text drag, new cursor
  // (ctrl-click), rectangle drag (alt-drag), or xwin
  // middle-click-paste. Or it might be a click on something we should
  // not interfere with, such as a scrollbar or widget.
  function onMouseDown(e) {
    var cm = this, display = cm.display;
    if (signalDOMEvent(cm, e) || display.activeTouch && display.input.supportsTouch()) { return }
    display.input.ensurePolled();
    display.shift = e.shiftKey;

    if (eventInWidget(display, e)) {
      if (!webkit) {
        // Briefly turn off draggability, to allow widgets to do
        // normal dragging things.
        display.scroller.draggable = false;
        setTimeout(function () { return display.scroller.draggable = true; }, 100);
      }
      return
    }
    if (clickInGutter(cm, e)) { return }
    var pos = posFromMouse(cm, e), button = e_button(e), repeat = pos ? clickRepeat(pos, button) : "single";
    window.focus();

    // #3261: make sure, that we're not starting a second selection
    if (button == 1 && cm.state.selectingText)
      { cm.state.selectingText(e); }

    if (pos && handleMappedButton(cm, button, pos, repeat, e)) { return }

    if (button == 1) {
      if (pos) { leftButtonDown(cm, pos, repeat, e); }
      else if (e_target(e) == display.scroller) { e_preventDefault(e); }
    } else if (button == 2) {
      if (pos) { extendSelection(cm.doc, pos); }
      setTimeout(function () { return display.input.focus(); }, 20);
    } else if (button == 3) {
      if (captureRightClick) { cm.display.input.onContextMenu(e); }
      else { delayBlurEvent(cm); }
    }
  }

  function handleMappedButton(cm, button, pos, repeat, event) {
    var name = "Click";
    if (repeat == "double") { name = "Double" + name; }
    else if (repeat == "triple") { name = "Triple" + name; }
    name = (button == 1 ? "Left" : button == 2 ? "Middle" : "Right") + name;

    return dispatchKey(cm,  addModifierNames(name, event), event, function (bound) {
      if (typeof bound == "string") { bound = commands[bound]; }
      if (!bound) { return false }
      var done = false;
      try {
        if (cm.isReadOnly()) { cm.state.suppressEdits = true; }
        done = bound(cm, pos) != Pass;
      } finally {
        cm.state.suppressEdits = false;
      }
      return done
    })
  }

  function configureMouse(cm, repeat, event) {
    var option = cm.getOption("configureMouse");
    var value = option ? option(cm, repeat, event) : {};
    if (value.unit == null) {
      var rect = chromeOS ? event.shiftKey && event.metaKey : event.altKey;
      value.unit = rect ? "rectangle" : repeat == "single" ? "char" : repeat == "double" ? "word" : "line";
    }
    if (value.extend == null || cm.doc.extend) { value.extend = cm.doc.extend || event.shiftKey; }
    if (value.addNew == null) { value.addNew = mac ? event.metaKey : event.ctrlKey; }
    if (value.moveOnDrag == null) { value.moveOnDrag = !(mac ? event.altKey : event.ctrlKey); }
    return value
  }

  function leftButtonDown(cm, pos, repeat, event) {
    if (ie) { setTimeout(bind(ensureFocus, cm), 0); }
    else { cm.curOp.focus = activeElt(); }

    var behavior = configureMouse(cm, repeat, event);

    var sel = cm.doc.sel, contained;
    if (cm.options.dragDrop && dragAndDrop && !cm.isReadOnly() &&
        repeat == "single" && (contained = sel.contains(pos)) > -1 &&
        (cmp((contained = sel.ranges[contained]).from(), pos) < 0 || pos.xRel > 0) &&
        (cmp(contained.to(), pos) > 0 || pos.xRel < 0))
      { leftButtonStartDrag(cm, event, pos, behavior); }
    else
      { leftButtonSelect(cm, event, pos, behavior); }
  }

  // Start a text drag. When it ends, see if any dragging actually
  // happen, and treat as a click if it didn't.
  function leftButtonStartDrag(cm, event, pos, behavior) {
    var display = cm.display, moved = false;
    var dragEnd = operation(cm, function (e) {
      if (webkit) { display.scroller.draggable = false; }
      cm.state.draggingText = false;
      if (cm.state.delayingBlurEvent) {
        if (cm.hasFocus()) { cm.state.delayingBlurEvent = false; }
        else { delayBlurEvent(cm); }
      }
      off(display.wrapper.ownerDocument, "mouseup", dragEnd);
      off(display.wrapper.ownerDocument, "mousemove", mouseMove);
      off(display.scroller, "dragstart", dragStart);
      off(display.scroller, "drop", dragEnd);
      if (!moved) {
        e_preventDefault(e);
        if (!behavior.addNew)
          { extendSelection(cm.doc, pos, null, null, behavior.extend); }
        // Work around unexplainable focus problem in IE9 (#2127) and Chrome (#3081)
        if ((webkit && !safari) || ie && ie_version == 9)
          { setTimeout(function () {display.wrapper.ownerDocument.body.focus({preventScroll: true}); display.input.focus();}, 20); }
        else
          { display.input.focus(); }
      }
    });
    var mouseMove = function(e2) {
      moved = moved || Math.abs(event.clientX - e2.clientX) + Math.abs(event.clientY - e2.clientY) >= 10;
    };
    var dragStart = function () { return moved = true; };
    // Let the drag handler handle this.
    if (webkit) { display.scroller.draggable = true; }
    cm.state.draggingText = dragEnd;
    dragEnd.copy = !behavior.moveOnDrag;
    on(display.wrapper.ownerDocument, "mouseup", dragEnd);
    on(display.wrapper.ownerDocument, "mousemove", mouseMove);
    on(display.scroller, "dragstart", dragStart);
    on(display.scroller, "drop", dragEnd);

    cm.state.delayingBlurEvent = true;
    setTimeout(function () { return display.input.focus(); }, 20);
    // IE's approach to draggable
    if (display.scroller.dragDrop) { display.scroller.dragDrop(); }
  }

  function rangeForUnit(cm, pos, unit) {
    if (unit == "char") { return new Range(pos, pos) }
    if (unit == "word") { return cm.findWordAt(pos) }
    if (unit == "line") { return new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))) }
    var result = unit(cm, pos);
    return new Range(result.from, result.to)
  }

  // Normal selection, as opposed to text dragging.
  function leftButtonSelect(cm, event, start, behavior) {
    if (ie) { delayBlurEvent(cm); }
    var display = cm.display, doc = cm.doc;
    e_preventDefault(event);

    var ourRange, ourIndex, startSel = doc.sel, ranges = startSel.ranges;
    if (behavior.addNew && !behavior.extend) {
      ourIndex = doc.sel.contains(start);
      if (ourIndex > -1)
        { ourRange = ranges[ourIndex]; }
      else
        { ourRange = new Range(start, start); }
    } else {
      ourRange = doc.sel.primary();
      ourIndex = doc.sel.primIndex;
    }

    if (behavior.unit == "rectangle") {
      if (!behavior.addNew) { ourRange = new Range(start, start); }
      start = posFromMouse(cm, event, true, true);
      ourIndex = -1;
    } else {
      var range = rangeForUnit(cm, start, behavior.unit);
      if (behavior.extend)
        { ourRange = extendRange(ourRange, range.anchor, range.head, behavior.extend); }
      else
        { ourRange = range; }
    }

    if (!behavior.addNew) {
      ourIndex = 0;
      setSelection(doc, new Selection([ourRange], 0), sel_mouse);
      startSel = doc.sel;
    } else if (ourIndex == -1) {
      ourIndex = ranges.length;
      setSelection(doc, normalizeSelection(cm, ranges.concat([ourRange]), ourIndex),
                   {scroll: false, origin: "*mouse"});
    } else if (ranges.length > 1 && ranges[ourIndex].empty() && behavior.unit == "char" && !behavior.extend) {
      setSelection(doc, normalizeSelection(cm, ranges.slice(0, ourIndex).concat(ranges.slice(ourIndex + 1)), 0),
                   {scroll: false, origin: "*mouse"});
      startSel = doc.sel;
    } else {
      replaceOneSelection(doc, ourIndex, ourRange, sel_mouse);
    }

    var lastPos = start;
    function extendTo(pos) {
      if (cmp(lastPos, pos) == 0) { return }
      lastPos = pos;

      if (behavior.unit == "rectangle") {
        var ranges = [], tabSize = cm.options.tabSize;
        var startCol = countColumn(getLine(doc, start.line).text, start.ch, tabSize);
        var posCol = countColumn(getLine(doc, pos.line).text, pos.ch, tabSize);
        var left = Math.min(startCol, posCol), right = Math.max(startCol, posCol);
        for (var line = Math.min(start.line, pos.line), end = Math.min(cm.lastLine(), Math.max(start.line, pos.line));
             line <= end; line++) {
          var text = getLine(doc, line).text, leftPos = findColumn(text, left, tabSize);
          if (left == right)
            { ranges.push(new Range(Pos(line, leftPos), Pos(line, leftPos))); }
          else if (text.length > leftPos)
            { ranges.push(new Range(Pos(line, leftPos), Pos(line, findColumn(text, right, tabSize)))); }
        }
        if (!ranges.length) { ranges.push(new Range(start, start)); }
        setSelection(doc, normalizeSelection(cm, startSel.ranges.slice(0, ourIndex).concat(ranges), ourIndex),
                     {origin: "*mouse", scroll: false});
        cm.scrollIntoView(pos);
      } else {
        var oldRange = ourRange;
        var range = rangeForUnit(cm, pos, behavior.unit);
        var anchor = oldRange.anchor, head;
        if (cmp(range.anchor, anchor) > 0) {
          head = range.head;
          anchor = minPos(oldRange.from(), range.anchor);
        } else {
          head = range.anchor;
          anchor = maxPos(oldRange.to(), range.head);
        }
        var ranges$1 = startSel.ranges.slice(0);
        ranges$1[ourIndex] = bidiSimplify(cm, new Range(clipPos(doc, anchor), head));
        setSelection(doc, normalizeSelection(cm, ranges$1, ourIndex), sel_mouse);
      }
    }

    var editorSize = display.wrapper.getBoundingClientRect();
    // Used to ensure timeout re-tries don't fire when another extend
    // happened in the meantime (clearTimeout isn't reliable -- at
    // least on Chrome, the timeouts still happen even when cleared,
    // if the clear happens after their scheduled firing time).
    var counter = 0;

    function extend(e) {
      var curCount = ++counter;
      var cur = posFromMouse(cm, e, true, behavior.unit == "rectangle");
      if (!cur) { return }
      if (cmp(cur, lastPos) != 0) {
        cm.curOp.focus = activeElt();
        extendTo(cur);
        var visible = visibleLines(display, doc);
        if (cur.line >= visible.to || cur.line < visible.from)
          { setTimeout(operation(cm, function () {if (counter == curCount) { extend(e); }}), 150); }
      } else {
        var outside = e.clientY < editorSize.top ? -20 : e.clientY > editorSize.bottom ? 20 : 0;
        if (outside) { setTimeout(operation(cm, function () {
          if (counter != curCount) { return }
          display.scroller.scrollTop += outside;
          extend(e);
        }), 50); }
      }
    }

    function done(e) {
      cm.state.selectingText = false;
      counter = Infinity;
      // If e is null or undefined we interpret this as someone trying
      // to explicitly cancel the selection rather than the user
      // letting go of the mouse button.
      if (e) {
        e_preventDefault(e);
        display.input.focus();
      }
      off(display.wrapper.ownerDocument, "mousemove", move);
      off(display.wrapper.ownerDocument, "mouseup", up);
      doc.history.lastSelOrigin = null;
    }

    var move = operation(cm, function (e) {
      if (e.buttons === 0 || !e_button(e)) { done(e); }
      else { extend(e); }
    });
    var up = operation(cm, done);
    cm.state.selectingText = up;
    on(display.wrapper.ownerDocument, "mousemove", move);
    on(display.wrapper.ownerDocument, "mouseup", up);
  }

  // Used when mouse-selecting to adjust the anchor to the proper side
  // of a bidi jump depending on the visual position of the head.
  function bidiSimplify(cm, range) {
    var anchor = range.anchor;
    var head = range.head;
    var anchorLine = getLine(cm.doc, anchor.line);
    if (cmp(anchor, head) == 0 && anchor.sticky == head.sticky) { return range }
    var order = getOrder(anchorLine);
    if (!order) { return range }
    var index = getBidiPartAt(order, anchor.ch, anchor.sticky), part = order[index];
    if (part.from != anchor.ch && part.to != anchor.ch) { return range }
    var boundary = index + ((part.from == anchor.ch) == (part.level != 1) ? 0 : 1);
    if (boundary == 0 || boundary == order.length) { return range }

    // Compute the relative visual position of the head compared to the
    // anchor (<0 is to the left, >0 to the right)
    var leftSide;
    if (head.line != anchor.line) {
      leftSide = (head.line - anchor.line) * (cm.doc.direction == "ltr" ? 1 : -1) > 0;
    } else {
      var headIndex = getBidiPartAt(order, head.ch, head.sticky);
      var dir = headIndex - index || (head.ch - anchor.ch) * (part.level == 1 ? -1 : 1);
      if (headIndex == boundary - 1 || headIndex == boundary)
        { leftSide = dir < 0; }
      else
        { leftSide = dir > 0; }
    }

    var usePart = order[boundary + (leftSide ? -1 : 0)];
    var from = leftSide == (usePart.level == 1);
    var ch = from ? usePart.from : usePart.to, sticky = from ? "after" : "before";
    return anchor.ch == ch && anchor.sticky == sticky ? range : new Range(new Pos(anchor.line, ch, sticky), head)
  }


  // Determines whether an event happened in the gutter, and fires the
  // handlers for the corresponding event.
  function gutterEvent(cm, e, type, prevent) {
    var mX, mY;
    if (e.touches) {
      mX = e.touches[0].clientX;
      mY = e.touches[0].clientY;
    } else {
      try { mX = e.clientX; mY = e.clientY; }
      catch(e$1) { return false }
    }
    if (mX >= Math.floor(cm.display.gutters.getBoundingClientRect().right)) { return false }
    if (prevent) { e_preventDefault(e); }

    var display = cm.display;
    var lineBox = display.lineDiv.getBoundingClientRect();

    if (mY > lineBox.bottom || !hasHandler(cm, type)) { return e_defaultPrevented(e) }
    mY -= lineBox.top - display.viewOffset;

    for (var i = 0; i < cm.display.gutterSpecs.length; ++i) {
      var g = display.gutters.childNodes[i];
      if (g && g.getBoundingClientRect().right >= mX) {
        var line = lineAtHeight(cm.doc, mY);
        var gutter = cm.display.gutterSpecs[i];
        signal(cm, type, cm, line, gutter.className, e);
        return e_defaultPrevented(e)
      }
    }
  }

  function clickInGutter(cm, e) {
    return gutterEvent(cm, e, "gutterClick", true)
  }

  // CONTEXT MENU HANDLING

  // To make the context menu work, we need to briefly unhide the
  // textarea (making it as unobtrusive as possible) to let the
  // right-click take effect on it.
  function onContextMenu(cm, e) {
    if (eventInWidget(cm.display, e) || contextMenuInGutter(cm, e)) { return }
    if (signalDOMEvent(cm, e, "contextmenu")) { return }
    if (!captureRightClick) { cm.display.input.onContextMenu(e); }
  }

  function contextMenuInGutter(cm, e) {
    if (!hasHandler(cm, "gutterContextMenu")) { return false }
    return gutterEvent(cm, e, "gutterContextMenu", false)
  }

  function themeChanged(cm) {
    cm.display.wrapper.className = cm.display.wrapper.className.replace(/\s*cm-s-\S+/g, "") +
      cm.options.theme.replace(/(^|\s)\s*/g, " cm-s-");
    clearCaches(cm);
  }

  var Init = {toString: function(){return "CodeMirror.Init"}};

  var defaults = {};
  var optionHandlers = {};

  function defineOptions(CodeMirror) {
    var optionHandlers = CodeMirror.optionHandlers;

    function option(name, deflt, handle, notOnInit) {
      CodeMirror.defaults[name] = deflt;
      if (handle) { optionHandlers[name] =
        notOnInit ? function (cm, val, old) {if (old != Init) { handle(cm, val, old); }} : handle; }
    }

    CodeMirror.defineOption = option;

    // Passed to option handlers when there is no old value.
    CodeMirror.Init = Init;

    // These two are, on init, called from the constructor because they
    // have to be initialized before the editor can start at all.
    option("value", "", function (cm, val) { return cm.setValue(val); }, true);
    option("mode", null, function (cm, val) {
      cm.doc.modeOption = val;
      loadMode(cm);
    }, true);

    option("indentUnit", 2, loadMode, true);
    option("indentWithTabs", false);
    option("smartIndent", true);
    option("tabSize", 4, function (cm) {
      resetModeState(cm);
      clearCaches(cm);
      regChange(cm);
    }, true);

    option("lineSeparator", null, function (cm, val) {
      cm.doc.lineSep = val;
      if (!val) { return }
      var newBreaks = [], lineNo = cm.doc.first;
      cm.doc.iter(function (line) {
        for (var pos = 0;;) {
          var found = line.text.indexOf(val, pos);
          if (found == -1) { break }
          pos = found + val.length;
          newBreaks.push(Pos(lineNo, found));
        }
        lineNo++;
      });
      for (var i = newBreaks.length - 1; i >= 0; i--)
        { replaceRange(cm.doc, val, newBreaks[i], Pos(newBreaks[i].line, newBreaks[i].ch + val.length)); }
    });
    option("specialChars", /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u200b\u200e\u200f\u2028\u2029\ufeff\ufff9-\ufffc]/g, function (cm, val, old) {
      cm.state.specialChars = new RegExp(val.source + (val.test("\t") ? "" : "|\t"), "g");
      if (old != Init) { cm.refresh(); }
    });
    option("specialCharPlaceholder", defaultSpecialCharPlaceholder, function (cm) { return cm.refresh(); }, true);
    option("electricChars", true);
    option("inputStyle", mobile ? "contenteditable" : "textarea", function () {
      throw new Error("inputStyle can not (yet) be changed in a running editor") // FIXME
    }, true);
    option("spellcheck", false, function (cm, val) { return cm.getInputField().spellcheck = val; }, true);
    option("autocorrect", false, function (cm, val) { return cm.getInputField().autocorrect = val; }, true);
    option("autocapitalize", false, function (cm, val) { return cm.getInputField().autocapitalize = val; }, true);
    option("rtlMoveVisually", !windows);
    option("wholeLineUpdateBefore", true);

    option("theme", "default", function (cm) {
      themeChanged(cm);
      updateGutters(cm);
    }, true);
    option("keyMap", "default", function (cm, val, old) {
      var next = getKeyMap(val);
      var prev = old != Init && getKeyMap(old);
      if (prev && prev.detach) { prev.detach(cm, next); }
      if (next.attach) { next.attach(cm, prev || null); }
    });
    option("extraKeys", null);
    option("configureMouse", null);

    option("lineWrapping", false, wrappingChanged, true);
    option("gutters", [], function (cm, val) {
      cm.display.gutterSpecs = getGutters(val, cm.options.lineNumbers);
      updateGutters(cm);
    }, true);
    option("fixedGutter", true, function (cm, val) {
      cm.display.gutters.style.left = val ? compensateForHScroll(cm.display) + "px" : "0";
      cm.refresh();
    }, true);
    option("coverGutterNextToScrollbar", false, function (cm) { return updateScrollbars(cm); }, true);
    option("scrollbarStyle", "native", function (cm) {
      initScrollbars(cm);
      updateScrollbars(cm);
      cm.display.scrollbars.setScrollTop(cm.doc.scrollTop);
      cm.display.scrollbars.setScrollLeft(cm.doc.scrollLeft);
    }, true);
    option("lineNumbers", false, function (cm, val) {
      cm.display.gutterSpecs = getGutters(cm.options.gutters, val);
      updateGutters(cm);
    }, true);
    option("firstLineNumber", 1, updateGutters, true);
    option("lineNumberFormatter", function (integer) { return integer; }, updateGutters, true);
    option("showCursorWhenSelecting", false, updateSelection, true);

    option("resetSelectionOnContextMenu", true);
    option("lineWiseCopyCut", true);
    option("pasteLinesPerSelection", true);
    option("selectionsMayTouch", false);

    option("readOnly", false, function (cm, val) {
      if (val == "nocursor") {
        onBlur(cm);
        cm.display.input.blur();
      }
      cm.display.input.readOnlyChanged(val);
    });

    option("screenReaderLabel", null, function (cm, val) {
      val = (val === '') ? null : val;
      cm.display.input.screenReaderLabelChanged(val);
    });

    option("disableInput", false, function (cm, val) {if (!val) { cm.display.input.reset(); }}, true);
    option("dragDrop", true, dragDropChanged);
    option("allowDropFileTypes", null);

    option("cursorBlinkRate", 530);
    option("cursorScrollMargin", 0);
    option("cursorHeight", 1, updateSelection, true);
    option("singleCursorHeightPerLine", true, updateSelection, true);
    option("workTime", 100);
    option("workDelay", 100);
    option("flattenSpans", true, resetModeState, true);
    option("addModeClass", false, resetModeState, true);
    option("pollInterval", 100);
    option("undoDepth", 200, function (cm, val) { return cm.doc.history.undoDepth = val; });
    option("historyEventDelay", 1250);
    option("viewportMargin", 10, function (cm) { return cm.refresh(); }, true);
    option("maxHighlightLength", 10000, resetModeState, true);
    option("moveInputWithCursor", true, function (cm, val) {
      if (!val) { cm.display.input.resetPosition(); }
    });

    option("tabindex", null, function (cm, val) { return cm.display.input.getField().tabIndex = val || ""; });
    option("autofocus", null);
    option("direction", "ltr", function (cm, val) { return cm.doc.setDirection(val); }, true);
    option("phrases", null);
  }

  function dragDropChanged(cm, value, old) {
    var wasOn = old && old != Init;
    if (!value != !wasOn) {
      var funcs = cm.display.dragFunctions;
      var toggle = value ? on : off;
      toggle(cm.display.scroller, "dragstart", funcs.start);
      toggle(cm.display.scroller, "dragenter", funcs.enter);
      toggle(cm.display.scroller, "dragover", funcs.over);
      toggle(cm.display.scroller, "dragleave", funcs.leave);
      toggle(cm.display.scroller, "drop", funcs.drop);
    }
  }

  function wrappingChanged(cm) {
    if (cm.options.lineWrapping) {
      addClass(cm.display.wrapper, "CodeMirror-wrap");
      cm.display.sizer.style.minWidth = "";
      cm.display.sizerWidth = null;
    } else {
      rmClass(cm.display.wrapper, "CodeMirror-wrap");
      findMaxLine(cm);
    }
    estimateLineHeights(cm);
    regChange(cm);
    clearCaches(cm);
    setTimeout(function () { return updateScrollbars(cm); }, 100);
  }

  // A CodeMirror instance represents an editor. This is the object
  // that user code is usually dealing with.

  function CodeMirror(place, options) {
    var this$1 = this;

    if (!(this instanceof CodeMirror)) { return new CodeMirror(place, options) }

    this.options = options = options ? copyObj(options) : {};
    // Determine effective options based on given values and defaults.
    copyObj(defaults, options, false);

    var doc = options.value;
    if (typeof doc == "string") { doc = new Doc(doc, options.mode, null, options.lineSeparator, options.direction); }
    else if (options.mode) { doc.modeOption = options.mode; }
    this.doc = doc;

    var input = new CodeMirror.inputStyles[options.inputStyle](this);
    var display = this.display = new Display(place, doc, input, options);
    display.wrapper.CodeMirror = this;
    themeChanged(this);
    if (options.lineWrapping)
      { this.display.wrapper.className += " CodeMirror-wrap"; }
    initScrollbars(this);

    this.state = {
      keyMaps: [],  // stores maps added by addKeyMap
      overlays: [], // highlighting overlays, as added by addOverlay
      modeGen: 0,   // bumped when mode/overlay changes, used to invalidate highlighting info
      overwrite: false,
      delayingBlurEvent: false,
      focused: false,
      suppressEdits: false, // used to disable editing during key handlers when in readOnly mode
      pasteIncoming: -1, cutIncoming: -1, // help recognize paste/cut edits in input.poll
      selectingText: false,
      draggingText: false,
      highlight: new Delayed(), // stores highlight worker timeout
      keySeq: null,  // Unfinished key sequence
      specialChars: null
    };

    if (options.autofocus && !mobile) { display.input.focus(); }

    // Override magic textarea content restore that IE sometimes does
    // on our hidden textarea on reload
    if (ie && ie_version < 11) { setTimeout(function () { return this$1.display.input.reset(true); }, 20); }

    registerEventHandlers(this);
    ensureGlobalHandlers();

    startOperation(this);
    this.curOp.forceUpdate = true;
    attachDoc(this, doc);

    if ((options.autofocus && !mobile) || this.hasFocus())
      { setTimeout(function () {
        if (this$1.hasFocus() && !this$1.state.focused) { onFocus(this$1); }
      }, 20); }
    else
      { onBlur(this); }

    for (var opt in optionHandlers) { if (optionHandlers.hasOwnProperty(opt))
      { optionHandlers[opt](this, options[opt], Init); } }
    maybeUpdateLineNumberWidth(this);
    if (options.finishInit) { options.finishInit(this); }
    for (var i = 0; i < initHooks.length; ++i) { initHooks[i](this); }
    endOperation(this);
    // Suppress optimizelegibility in Webkit, since it breaks text
    // measuring on line wrapping boundaries.
    if (webkit && options.lineWrapping &&
        getComputedStyle(display.lineDiv).textRendering == "optimizelegibility")
      { display.lineDiv.style.textRendering = "auto"; }
  }

  // The default configuration options.
  CodeMirror.defaults = defaults;
  // Functions to run when options are changed.
  CodeMirror.optionHandlers = optionHandlers;

  // Attach the necessary event handlers when initializing the editor
  function registerEventHandlers(cm) {
    var d = cm.display;
    on(d.scroller, "mousedown", operation(cm, onMouseDown));
    // Older IE's will not fire a second mousedown for a double click
    if (ie && ie_version < 11)
      { on(d.scroller, "dblclick", operation(cm, function (e) {
        if (signalDOMEvent(cm, e)) { return }
        var pos = posFromMouse(cm, e);
        if (!pos || clickInGutter(cm, e) || eventInWidget(cm.display, e)) { return }
        e_preventDefault(e);
        var word = cm.findWordAt(pos);
        extendSelection(cm.doc, word.anchor, word.head);
      })); }
    else
      { on(d.scroller, "dblclick", function (e) { return signalDOMEvent(cm, e) || e_preventDefault(e); }); }
    // Some browsers fire contextmenu *after* opening the menu, at
    // which point we can't mess with it anymore. Context menu is
    // handled in onMouseDown for these browsers.
    on(d.scroller, "contextmenu", function (e) { return onContextMenu(cm, e); });
    on(d.input.getField(), "contextmenu", function (e) {
      if (!d.scroller.contains(e.target)) { onContextMenu(cm, e); }
    });

    // Used to suppress mouse event handling when a touch happens
    var touchFinished, prevTouch = {end: 0};
    function finishTouch() {
      if (d.activeTouch) {
        touchFinished = setTimeout(function () { return d.activeTouch = null; }, 1000);
        prevTouch = d.activeTouch;
        prevTouch.end = +new Date;
      }
    }
    function isMouseLikeTouchEvent(e) {
      if (e.touches.length != 1) { return false }
      var touch = e.touches[0];
      return touch.radiusX <= 1 && touch.radiusY <= 1
    }
    function farAway(touch, other) {
      if (other.left == null) { return true }
      var dx = other.left - touch.left, dy = other.top - touch.top;
      return dx * dx + dy * dy > 20 * 20
    }
    on(d.scroller, "touchstart", function (e) {
      if (!signalDOMEvent(cm, e) && !isMouseLikeTouchEvent(e) && !clickInGutter(cm, e)) {
        d.input.ensurePolled();
        clearTimeout(touchFinished);
        var now = +new Date;
        d.activeTouch = {start: now, moved: false,
                         prev: now - prevTouch.end <= 300 ? prevTouch : null};
        if (e.touches.length == 1) {
          d.activeTouch.left = e.touches[0].pageX;
          d.activeTouch.top = e.touches[0].pageY;
        }
      }
    });
    on(d.scroller, "touchmove", function () {
      if (d.activeTouch) { d.activeTouch.moved = true; }
    });
    on(d.scroller, "touchend", function (e) {
      var touch = d.activeTouch;
      if (touch && !eventInWidget(d, e) && touch.left != null &&
          !touch.moved && new Date - touch.start < 300) {
        var pos = cm.coordsChar(d.activeTouch, "page"), range;
        if (!touch.prev || farAway(touch, touch.prev)) // Single tap
          { range = new Range(pos, pos); }
        else if (!touch.prev.prev || farAway(touch, touch.prev.prev)) // Double tap
          { range = cm.findWordAt(pos); }
        else // Triple tap
          { range = new Range(Pos(pos.line, 0), clipPos(cm.doc, Pos(pos.line + 1, 0))); }
        cm.setSelection(range.anchor, range.head);
        cm.focus();
        e_preventDefault(e);
      }
      finishTouch();
    });
    on(d.scroller, "touchcancel", finishTouch);

    // Sync scrolling between fake scrollbars and real scrollable
    // area, ensure viewport is updated when scrolling.
    on(d.scroller, "scroll", function () {
      if (d.scroller.clientHeight) {
        updateScrollTop(cm, d.scroller.scrollTop);
        setScrollLeft(cm, d.scroller.scrollLeft, true);
        signal(cm, "scroll", cm);
      }
    });

    // Listen to wheel events in order to try and update the viewport on time.
    on(d.scroller, "mousewheel", function (e) { return onScrollWheel(cm, e); });
    on(d.scroller, "DOMMouseScroll", function (e) { return onScrollWheel(cm, e); });

    // Prevent wrapper from ever scrolling
    on(d.wrapper, "scroll", function () { return d.wrapper.scrollTop = d.wrapper.scrollLeft = 0; });

    d.dragFunctions = {
      enter: function (e) {if (!signalDOMEvent(cm, e)) { e_stop(e); }},
      over: function (e) {if (!signalDOMEvent(cm, e)) { onDragOver(cm, e); e_stop(e); }},
      start: function (e) { return onDragStart(cm, e); },
      drop: operation(cm, onDrop),
      leave: function (e) {if (!signalDOMEvent(cm, e)) { clearDragCursor(cm); }}
    };

    var inp = d.input.getField();
    on(inp, "keyup", function (e) { return onKeyUp.call(cm, e); });
    on(inp, "keydown", operation(cm, onKeyDown));
    on(inp, "keypress", operation(cm, onKeyPress));
    on(inp, "focus", function (e) { return onFocus(cm, e); });
    on(inp, "blur", function (e) { return onBlur(cm, e); });
  }

  var initHooks = [];
  CodeMirror.defineInitHook = function (f) { return initHooks.push(f); };

  // Indent the given line. The how parameter can be "smart",
  // "add"/null, "subtract", or "prev". When aggressive is false
  // (typically set to true for forced single-line indents), empty
  // lines are not indented, and places where the mode returns Pass
  // are left alone.
  function indentLine(cm, n, how, aggressive) {
    var doc = cm.doc, state;
    if (how == null) { how = "add"; }
    if (how == "smart") {
      // Fall back to "prev" when the mode doesn't have an indentation
      // method.
      if (!doc.mode.indent) { how = "prev"; }
      else { state = getContextBefore(cm, n).state; }
    }

    var tabSize = cm.options.tabSize;
    var line = getLine(doc, n), curSpace = countColumn(line.text, null, tabSize);
    if (line.stateAfter) { line.stateAfter = null; }
    var curSpaceString = line.text.match(/^\s*/)[0], indentation;
    if (!aggressive && !/\S/.test(line.text)) {
      indentation = 0;
      how = "not";
    } else if (how == "smart") {
      indentation = doc.mode.indent(state, line.text.slice(curSpaceString.length), line.text);
      if (indentation == Pass || indentation > 150) {
        if (!aggressive) { return }
        how = "prev";
      }
    }
    if (how == "prev") {
      if (n > doc.first) { indentation = countColumn(getLine(doc, n-1).text, null, tabSize); }
      else { indentation = 0; }
    } else if (how == "add") {
      indentation = curSpace + cm.options.indentUnit;
    } else if (how == "subtract") {
      indentation = curSpace - cm.options.indentUnit;
    } else if (typeof how == "number") {
      indentation = curSpace + how;
    }
    indentation = Math.max(0, indentation);

    var indentString = "", pos = 0;
    if (cm.options.indentWithTabs)
      { for (var i = Math.floor(indentation / tabSize); i; --i) {pos += tabSize; indentString += "\t";} }
    if (pos < indentation) { indentString += spaceStr(indentation - pos); }

    if (indentString != curSpaceString) {
      replaceRange(doc, indentString, Pos(n, 0), Pos(n, curSpaceString.length), "+input");
      line.stateAfter = null;
      return true
    } else {
      // Ensure that, if the cursor was in the whitespace at the start
      // of the line, it is moved to the end of that space.
      for (var i$1 = 0; i$1 < doc.sel.ranges.length; i$1++) {
        var range = doc.sel.ranges[i$1];
        if (range.head.line == n && range.head.ch < curSpaceString.length) {
          var pos$1 = Pos(n, curSpaceString.length);
          replaceOneSelection(doc, i$1, new Range(pos$1, pos$1));
          break
        }
      }
    }
  }

  // This will be set to a {lineWise: bool, text: [string]} object, so
  // that, when pasting, we know what kind of selections the copied
  // text was made out of.
  var lastCopied = null;

  function setLastCopied(newLastCopied) {
    lastCopied = newLastCopied;
  }

  function applyTextInput(cm, inserted, deleted, sel, origin) {
    var doc = cm.doc;
    cm.display.shift = false;
    if (!sel) { sel = doc.sel; }

    var recent = +new Date - 200;
    var paste = origin == "paste" || cm.state.pasteIncoming > recent;
    var textLines = splitLinesAuto(inserted), multiPaste = null;
    // When pasting N lines into N selections, insert one line per selection
    if (paste && sel.ranges.length > 1) {
      if (lastCopied && lastCopied.text.join("\n") == inserted) {
        if (sel.ranges.length % lastCopied.text.length == 0) {
          multiPaste = [];
          for (var i = 0; i < lastCopied.text.length; i++)
            { multiPaste.push(doc.splitLines(lastCopied.text[i])); }
        }
      } else if (textLines.length == sel.ranges.length && cm.options.pasteLinesPerSelection) {
        multiPaste = map(textLines, function (l) { return [l]; });
      }
    }

    var updateInput = cm.curOp.updateInput;
    // Normal behavior is to insert the new text into every selection
    for (var i$1 = sel.ranges.length - 1; i$1 >= 0; i$1--) {
      var range = sel.ranges[i$1];
      var from = range.from(), to = range.to();
      if (range.empty()) {
        if (deleted && deleted > 0) // Handle deletion
          { from = Pos(from.line, from.ch - deleted); }
        else if (cm.state.overwrite && !paste) // Handle overwrite
          { to = Pos(to.line, Math.min(getLine(doc, to.line).text.length, to.ch + lst(textLines).length)); }
        else if (paste && lastCopied && lastCopied.lineWise && lastCopied.text.join("\n") == textLines.join("\n"))
          { from = to = Pos(from.line, 0); }
      }
      var changeEvent = {from: from, to: to, text: multiPaste ? multiPaste[i$1 % multiPaste.length] : textLines,
                         origin: origin || (paste ? "paste" : cm.state.cutIncoming > recent ? "cut" : "+input")};
      makeChange(cm.doc, changeEvent);
      signalLater(cm, "inputRead", cm, changeEvent);
    }
    if (inserted && !paste)
      { triggerElectric(cm, inserted); }

    ensureCursorVisible(cm);
    if (cm.curOp.updateInput < 2) { cm.curOp.updateInput = updateInput; }
    cm.curOp.typing = true;
    cm.state.pasteIncoming = cm.state.cutIncoming = -1;
  }

  function handlePaste(e, cm) {
    var pasted = e.clipboardData && e.clipboardData.getData("Text");
    if (pasted) {
      e.preventDefault();
      if (!cm.isReadOnly() && !cm.options.disableInput)
        { runInOp(cm, function () { return applyTextInput(cm, pasted, 0, null, "paste"); }); }
      return true
    }
  }

  function triggerElectric(cm, inserted) {
    // When an 'electric' character is inserted, immediately trigger a reindent
    if (!cm.options.electricChars || !cm.options.smartIndent) { return }
    var sel = cm.doc.sel;

    for (var i = sel.ranges.length - 1; i >= 0; i--) {
      var range = sel.ranges[i];
      if (range.head.ch > 100 || (i && sel.ranges[i - 1].head.line == range.head.line)) { continue }
      var mode = cm.getModeAt(range.head);
      var indented = false;
      if (mode.electricChars) {
        for (var j = 0; j < mode.electricChars.length; j++)
          { if (inserted.indexOf(mode.electricChars.charAt(j)) > -1) {
            indented = indentLine(cm, range.head.line, "smart");
            break
          } }
      } else if (mode.electricInput) {
        if (mode.electricInput.test(getLine(cm.doc, range.head.line).text.slice(0, range.head.ch)))
          { indented = indentLine(cm, range.head.line, "smart"); }
      }
      if (indented) { signalLater(cm, "electricInput", cm, range.head.line); }
    }
  }

  function copyableRanges(cm) {
    var text = [], ranges = [];
    for (var i = 0; i < cm.doc.sel.ranges.length; i++) {
      var line = cm.doc.sel.ranges[i].head.line;
      var lineRange = {anchor: Pos(line, 0), head: Pos(line + 1, 0)};
      ranges.push(lineRange);
      text.push(cm.getRange(lineRange.anchor, lineRange.head));
    }
    return {text: text, ranges: ranges}
  }

  function disableBrowserMagic(field, spellcheck, autocorrect, autocapitalize) {
    field.setAttribute("autocorrect", autocorrect ? "" : "off");
    field.setAttribute("autocapitalize", autocapitalize ? "" : "off");
    field.setAttribute("spellcheck", !!spellcheck);
  }

  function hiddenTextarea() {
    var te = elt("textarea", null, null, "position: absolute; bottom: -1em; padding: 0; width: 1px; height: 1em; outline: none");
    var div = elt("div", [te], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
    // The textarea is kept positioned near the cursor to prevent the
    // fact that it'll be scrolled into view on input from scrolling
    // our fake cursor out of view. On webkit, when wrap=off, paste is
    // very slow. So make the area wide instead.
    if (webkit) { te.style.width = "1000px"; }
    else { te.setAttribute("wrap", "off"); }
    // If border: 0; -- iOS fails to open keyboard (issue #1287)
    if (ios) { te.style.border = "1px solid black"; }
    disableBrowserMagic(te);
    return div
  }

  // The publicly visible API. Note that methodOp(f) means
  // 'wrap f in an operation, performed on its `this` parameter'.

  // This is not the complete set of editor methods. Most of the
  // methods defined on the Doc type are also injected into
  // CodeMirror.prototype, for backwards compatibility and
  // convenience.

  function addEditorMethods(CodeMirror) {
    var optionHandlers = CodeMirror.optionHandlers;

    var helpers = CodeMirror.helpers = {};

    CodeMirror.prototype = {
      constructor: CodeMirror,
      focus: function(){window.focus(); this.display.input.focus();},

      setOption: function(option, value) {
        var options = this.options, old = options[option];
        if (options[option] == value && option != "mode") { return }
        options[option] = value;
        if (optionHandlers.hasOwnProperty(option))
          { operation(this, optionHandlers[option])(this, value, old); }
        signal(this, "optionChange", this, option);
      },

      getOption: function(option) {return this.options[option]},
      getDoc: function() {return this.doc},

      addKeyMap: function(map, bottom) {
        this.state.keyMaps[bottom ? "push" : "unshift"](getKeyMap(map));
      },
      removeKeyMap: function(map) {
        var maps = this.state.keyMaps;
        for (var i = 0; i < maps.length; ++i)
          { if (maps[i] == map || maps[i].name == map) {
            maps.splice(i, 1);
            return true
          } }
      },

      addOverlay: methodOp(function(spec, options) {
        var mode = spec.token ? spec : CodeMirror.getMode(this.options, spec);
        if (mode.startState) { throw new Error("Overlays may not be stateful.") }
        insertSorted(this.state.overlays,
                     {mode: mode, modeSpec: spec, opaque: options && options.opaque,
                      priority: (options && options.priority) || 0},
                     function (overlay) { return overlay.priority; });
        this.state.modeGen++;
        regChange(this);
      }),
      removeOverlay: methodOp(function(spec) {
        var overlays = this.state.overlays;
        for (var i = 0; i < overlays.length; ++i) {
          var cur = overlays[i].modeSpec;
          if (cur == spec || typeof spec == "string" && cur.name == spec) {
            overlays.splice(i, 1);
            this.state.modeGen++;
            regChange(this);
            return
          }
        }
      }),

      indentLine: methodOp(function(n, dir, aggressive) {
        if (typeof dir != "string" && typeof dir != "number") {
          if (dir == null) { dir = this.options.smartIndent ? "smart" : "prev"; }
          else { dir = dir ? "add" : "subtract"; }
        }
        if (isLine(this.doc, n)) { indentLine(this, n, dir, aggressive); }
      }),
      indentSelection: methodOp(function(how) {
        var ranges = this.doc.sel.ranges, end = -1;
        for (var i = 0; i < ranges.length; i++) {
          var range = ranges[i];
          if (!range.empty()) {
            var from = range.from(), to = range.to();
            var start = Math.max(end, from.line);
            end = Math.min(this.lastLine(), to.line - (to.ch ? 0 : 1)) + 1;
            for (var j = start; j < end; ++j)
              { indentLine(this, j, how); }
            var newRanges = this.doc.sel.ranges;
            if (from.ch == 0 && ranges.length == newRanges.length && newRanges[i].from().ch > 0)
              { replaceOneSelection(this.doc, i, new Range(from, newRanges[i].to()), sel_dontScroll); }
          } else if (range.head.line > end) {
            indentLine(this, range.head.line, how, true);
            end = range.head.line;
            if (i == this.doc.sel.primIndex) { ensureCursorVisible(this); }
          }
        }
      }),

      // Fetch the parser token for a given character. Useful for hacks
      // that want to inspect the mode state (say, for completion).
      getTokenAt: function(pos, precise) {
        return takeToken(this, pos, precise)
      },

      getLineTokens: function(line, precise) {
        return takeToken(this, Pos(line), precise, true)
      },

      getTokenTypeAt: function(pos) {
        pos = clipPos(this.doc, pos);
        var styles = getLineStyles(this, getLine(this.doc, pos.line));
        var before = 0, after = (styles.length - 1) / 2, ch = pos.ch;
        var type;
        if (ch == 0) { type = styles[2]; }
        else { for (;;) {
          var mid = (before + after) >> 1;
          if ((mid ? styles[mid * 2 - 1] : 0) >= ch) { after = mid; }
          else if (styles[mid * 2 + 1] < ch) { before = mid + 1; }
          else { type = styles[mid * 2 + 2]; break }
        } }
        var cut = type ? type.indexOf("overlay ") : -1;
        return cut < 0 ? type : cut == 0 ? null : type.slice(0, cut - 1)
      },

      getModeAt: function(pos) {
        var mode = this.doc.mode;
        if (!mode.innerMode) { return mode }
        return CodeMirror.innerMode(mode, this.getTokenAt(pos).state).mode
      },

      getHelper: function(pos, type) {
        return this.getHelpers(pos, type)[0]
      },

      getHelpers: function(pos, type) {
        var found = [];
        if (!helpers.hasOwnProperty(type)) { return found }
        var help = helpers[type], mode = this.getModeAt(pos);
        if (typeof mode[type] == "string") {
          if (help[mode[type]]) { found.push(help[mode[type]]); }
        } else if (mode[type]) {
          for (var i = 0; i < mode[type].length; i++) {
            var val = help[mode[type][i]];
            if (val) { found.push(val); }
          }
        } else if (mode.helperType && help[mode.helperType]) {
          found.push(help[mode.helperType]);
        } else if (help[mode.name]) {
          found.push(help[mode.name]);
        }
        for (var i$1 = 0; i$1 < help._global.length; i$1++) {
          var cur = help._global[i$1];
          if (cur.pred(mode, this) && indexOf(found, cur.val) == -1)
            { found.push(cur.val); }
        }
        return found
      },

      getStateAfter: function(line, precise) {
        var doc = this.doc;
        line = clipLine(doc, line == null ? doc.first + doc.size - 1: line);
        return getContextBefore(this, line + 1, precise).state
      },

      cursorCoords: function(start, mode) {
        var pos, range = this.doc.sel.primary();
        if (start == null) { pos = range.head; }
        else if (typeof start == "object") { pos = clipPos(this.doc, start); }
        else { pos = start ? range.from() : range.to(); }
        return cursorCoords(this, pos, mode || "page")
      },

      charCoords: function(pos, mode) {
        return charCoords(this, clipPos(this.doc, pos), mode || "page")
      },

      coordsChar: function(coords, mode) {
        coords = fromCoordSystem(this, coords, mode || "page");
        return coordsChar(this, coords.left, coords.top)
      },

      lineAtHeight: function(height, mode) {
        height = fromCoordSystem(this, {top: height, left: 0}, mode || "page").top;
        return lineAtHeight(this.doc, height + this.display.viewOffset)
      },
      heightAtLine: function(line, mode, includeWidgets) {
        var end = false, lineObj;
        if (typeof line == "number") {
          var last = this.doc.first + this.doc.size - 1;
          if (line < this.doc.first) { line = this.doc.first; }
          else if (line > last) { line = last; end = true; }
          lineObj = getLine(this.doc, line);
        } else {
          lineObj = line;
        }
        return intoCoordSystem(this, lineObj, {top: 0, left: 0}, mode || "page", includeWidgets || end).top +
          (end ? this.doc.height - heightAtLine(lineObj) : 0)
      },

      defaultTextHeight: function() { return textHeight(this.display) },
      defaultCharWidth: function() { return charWidth(this.display) },

      getViewport: function() { return {from: this.display.viewFrom, to: this.display.viewTo}},

      addWidget: function(pos, node, scroll, vert, horiz) {
        var display = this.display;
        pos = cursorCoords(this, clipPos(this.doc, pos));
        var top = pos.bottom, left = pos.left;
        node.style.position = "absolute";
        node.setAttribute("cm-ignore-events", "true");
        this.display.input.setUneditable(node);
        display.sizer.appendChild(node);
        if (vert == "over") {
          top = pos.top;
        } else if (vert == "above" || vert == "near") {
          var vspace = Math.max(display.wrapper.clientHeight, this.doc.height),
          hspace = Math.max(display.sizer.clientWidth, display.lineSpace.clientWidth);
          // Default to positioning above (if specified and possible); otherwise default to positioning below
          if ((vert == 'above' || pos.bottom + node.offsetHeight > vspace) && pos.top > node.offsetHeight)
            { top = pos.top - node.offsetHeight; }
          else if (pos.bottom + node.offsetHeight <= vspace)
            { top = pos.bottom; }
          if (left + node.offsetWidth > hspace)
            { left = hspace - node.offsetWidth; }
        }
        node.style.top = top + "px";
        node.style.left = node.style.right = "";
        if (horiz == "right") {
          left = display.sizer.clientWidth - node.offsetWidth;
          node.style.right = "0px";
        } else {
          if (horiz == "left") { left = 0; }
          else if (horiz == "middle") { left = (display.sizer.clientWidth - node.offsetWidth) / 2; }
          node.style.left = left + "px";
        }
        if (scroll)
          { scrollIntoView(this, {left: left, top: top, right: left + node.offsetWidth, bottom: top + node.offsetHeight}); }
      },

      triggerOnKeyDown: methodOp(onKeyDown),
      triggerOnKeyPress: methodOp(onKeyPress),
      triggerOnKeyUp: onKeyUp,
      triggerOnMouseDown: methodOp(onMouseDown),

      execCommand: function(cmd) {
        if (commands.hasOwnProperty(cmd))
          { return commands[cmd].call(null, this) }
      },

      triggerElectric: methodOp(function(text) { triggerElectric(this, text); }),

      findPosH: function(from, amount, unit, visually) {
        var dir = 1;
        if (amount < 0) { dir = -1; amount = -amount; }
        var cur = clipPos(this.doc, from);
        for (var i = 0; i < amount; ++i) {
          cur = findPosH(this.doc, cur, dir, unit, visually);
          if (cur.hitSide) { break }
        }
        return cur
      },

      moveH: methodOp(function(dir, unit) {
        var this$1 = this;

        this.extendSelectionsBy(function (range) {
          if (this$1.display.shift || this$1.doc.extend || range.empty())
            { return findPosH(this$1.doc, range.head, dir, unit, this$1.options.rtlMoveVisually) }
          else
            { return dir < 0 ? range.from() : range.to() }
        }, sel_move);
      }),

      deleteH: methodOp(function(dir, unit) {
        var sel = this.doc.sel, doc = this.doc;
        if (sel.somethingSelected())
          { doc.replaceSelection("", null, "+delete"); }
        else
          { deleteNearSelection(this, function (range) {
            var other = findPosH(doc, range.head, dir, unit, false);
            return dir < 0 ? {from: other, to: range.head} : {from: range.head, to: other}
          }); }
      }),

      findPosV: function(from, amount, unit, goalColumn) {
        var dir = 1, x = goalColumn;
        if (amount < 0) { dir = -1; amount = -amount; }
        var cur = clipPos(this.doc, from);
        for (var i = 0; i < amount; ++i) {
          var coords = cursorCoords(this, cur, "div");
          if (x == null) { x = coords.left; }
          else { coords.left = x; }
          cur = findPosV(this, coords, dir, unit);
          if (cur.hitSide) { break }
        }
        return cur
      },

      moveV: methodOp(function(dir, unit) {
        var this$1 = this;

        var doc = this.doc, goals = [];
        var collapse = !this.display.shift && !doc.extend && doc.sel.somethingSelected();
        doc.extendSelectionsBy(function (range) {
          if (collapse)
            { return dir < 0 ? range.from() : range.to() }
          var headPos = cursorCoords(this$1, range.head, "div");
          if (range.goalColumn != null) { headPos.left = range.goalColumn; }
          goals.push(headPos.left);
          var pos = findPosV(this$1, headPos, dir, unit);
          if (unit == "page" && range == doc.sel.primary())
            { addToScrollTop(this$1, charCoords(this$1, pos, "div").top - headPos.top); }
          return pos
        }, sel_move);
        if (goals.length) { for (var i = 0; i < doc.sel.ranges.length; i++)
          { doc.sel.ranges[i].goalColumn = goals[i]; } }
      }),

      // Find the word at the given position (as returned by coordsChar).
      findWordAt: function(pos) {
        var doc = this.doc, line = getLine(doc, pos.line).text;
        var start = pos.ch, end = pos.ch;
        if (line) {
          var helper = this.getHelper(pos, "wordChars");
          if ((pos.sticky == "before" || end == line.length) && start) { --start; } else { ++end; }
          var startChar = line.charAt(start);
          var check = isWordChar(startChar, helper)
            ? function (ch) { return isWordChar(ch, helper); }
            : /\s/.test(startChar) ? function (ch) { return /\s/.test(ch); }
            : function (ch) { return (!/\s/.test(ch) && !isWordChar(ch)); };
          while (start > 0 && check(line.charAt(start - 1))) { --start; }
          while (end < line.length && check(line.charAt(end))) { ++end; }
        }
        return new Range(Pos(pos.line, start), Pos(pos.line, end))
      },

      toggleOverwrite: function(value) {
        if (value != null && value == this.state.overwrite) { return }
        if (this.state.overwrite = !this.state.overwrite)
          { addClass(this.display.cursorDiv, "CodeMirror-overwrite"); }
        else
          { rmClass(this.display.cursorDiv, "CodeMirror-overwrite"); }

        signal(this, "overwriteToggle", this, this.state.overwrite);
      },
      hasFocus: function() { return this.display.input.getField() == activeElt() },
      isReadOnly: function() { return !!(this.options.readOnly || this.doc.cantEdit) },

      scrollTo: methodOp(function (x, y) { scrollToCoords(this, x, y); }),
      getScrollInfo: function() {
        var scroller = this.display.scroller;
        return {left: scroller.scrollLeft, top: scroller.scrollTop,
                height: scroller.scrollHeight - scrollGap(this) - this.display.barHeight,
                width: scroller.scrollWidth - scrollGap(this) - this.display.barWidth,
                clientHeight: displayHeight(this), clientWidth: displayWidth(this)}
      },

      scrollIntoView: methodOp(function(range, margin) {
        if (range == null) {
          range = {from: this.doc.sel.primary().head, to: null};
          if (margin == null) { margin = this.options.cursorScrollMargin; }
        } else if (typeof range == "number") {
          range = {from: Pos(range, 0), to: null};
        } else if (range.from == null) {
          range = {from: range, to: null};
        }
        if (!range.to) { range.to = range.from; }
        range.margin = margin || 0;

        if (range.from.line != null) {
          scrollToRange(this, range);
        } else {
          scrollToCoordsRange(this, range.from, range.to, range.margin);
        }
      }),

      setSize: methodOp(function(width, height) {
        var this$1 = this;

        var interpret = function (val) { return typeof val == "number" || /^\d+$/.test(String(val)) ? val + "px" : val; };
        if (width != null) { this.display.wrapper.style.width = interpret(width); }
        if (height != null) { this.display.wrapper.style.height = interpret(height); }
        if (this.options.lineWrapping) { clearLineMeasurementCache(this); }
        var lineNo = this.display.viewFrom;
        this.doc.iter(lineNo, this.display.viewTo, function (line) {
          if (line.widgets) { for (var i = 0; i < line.widgets.length; i++)
            { if (line.widgets[i].noHScroll) { regLineChange(this$1, lineNo, "widget"); break } } }
          ++lineNo;
        });
        this.curOp.forceUpdate = true;
        signal(this, "refresh", this);
      }),

      operation: function(f){return runInOp(this, f)},
      startOperation: function(){return startOperation(this)},
      endOperation: function(){return endOperation(this)},

      refresh: methodOp(function() {
        var oldHeight = this.display.cachedTextHeight;
        regChange(this);
        this.curOp.forceUpdate = true;
        clearCaches(this);
        scrollToCoords(this, this.doc.scrollLeft, this.doc.scrollTop);
        updateGutterSpace(this.display);
        if (oldHeight == null || Math.abs(oldHeight - textHeight(this.display)) > .5 || this.options.lineWrapping)
          { estimateLineHeights(this); }
        signal(this, "refresh", this);
      }),

      swapDoc: methodOp(function(doc) {
        var old = this.doc;
        old.cm = null;
        // Cancel the current text selection if any (#5821)
        if (this.state.selectingText) { this.state.selectingText(); }
        attachDoc(this, doc);
        clearCaches(this);
        this.display.input.reset();
        scrollToCoords(this, doc.scrollLeft, doc.scrollTop);
        this.curOp.forceScroll = true;
        signalLater(this, "swapDoc", this, old);
        return old
      }),

      phrase: function(phraseText) {
        var phrases = this.options.phrases;
        return phrases && Object.prototype.hasOwnProperty.call(phrases, phraseText) ? phrases[phraseText] : phraseText
      },

      getInputField: function(){return this.display.input.getField()},
      getWrapperElement: function(){return this.display.wrapper},
      getScrollerElement: function(){return this.display.scroller},
      getGutterElement: function(){return this.display.gutters}
    };
    eventMixin(CodeMirror);

    CodeMirror.registerHelper = function(type, name, value) {
      if (!helpers.hasOwnProperty(type)) { helpers[type] = CodeMirror[type] = {_global: []}; }
      helpers[type][name] = value;
    };
    CodeMirror.registerGlobalHelper = function(type, name, predicate, value) {
      CodeMirror.registerHelper(type, name, value);
      helpers[type]._global.push({pred: predicate, val: value});
    };
  }

  // Used for horizontal relative motion. Dir is -1 or 1 (left or
  // right), unit can be "codepoint", "char", "column" (like char, but
  // doesn't cross line boundaries), "word" (across next word), or
  // "group" (to the start of next group of word or
  // non-word-non-whitespace chars). The visually param controls
  // whether, in right-to-left text, direction 1 means to move towards
  // the next index in the string, or towards the character to the right
  // of the current position. The resulting position will have a
  // hitSide=true property if it reached the end of the document.
  function findPosH(doc, pos, dir, unit, visually) {
    var oldPos = pos;
    var origDir = dir;
    var lineObj = getLine(doc, pos.line);
    var lineDir = visually && doc.direction == "rtl" ? -dir : dir;
    function findNextLine() {
      var l = pos.line + lineDir;
      if (l < doc.first || l >= doc.first + doc.size) { return false }
      pos = new Pos(l, pos.ch, pos.sticky);
      return lineObj = getLine(doc, l)
    }
    function moveOnce(boundToLine) {
      var next;
      if (unit == "codepoint") {
        var ch = lineObj.text.charCodeAt(pos.ch + (dir > 0 ? 0 : -1));
        if (isNaN(ch)) {
          next = null;
        } else {
          var astral = dir > 0 ? ch >= 0xD800 && ch < 0xDC00 : ch >= 0xDC00 && ch < 0xDFFF;
          next = new Pos(pos.line, Math.max(0, Math.min(lineObj.text.length, pos.ch + dir * (astral ? 2 : 1))), -dir);
        }
      } else if (visually) {
        next = moveVisually(doc.cm, lineObj, pos, dir);
      } else {
        next = moveLogically(lineObj, pos, dir);
      }
      if (next == null) {
        if (!boundToLine && findNextLine())
          { pos = endOfLine(visually, doc.cm, lineObj, pos.line, lineDir); }
        else
          { return false }
      } else {
        pos = next;
      }
      return true
    }

    if (unit == "char" || unit == "codepoint") {
      moveOnce();
    } else if (unit == "column") {
      moveOnce(true);
    } else if (unit == "word" || unit == "group") {
      var sawType = null, group = unit == "group";
      var helper = doc.cm && doc.cm.getHelper(pos, "wordChars");
      for (var first = true;; first = false) {
        if (dir < 0 && !moveOnce(!first)) { break }
        var cur = lineObj.text.charAt(pos.ch) || "\n";
        var type = isWordChar(cur, helper) ? "w"
          : group && cur == "\n" ? "n"
          : !group || /\s/.test(cur) ? null
          : "p";
        if (group && !first && !type) { type = "s"; }
        if (sawType && sawType != type) {
          if (dir < 0) {dir = 1; moveOnce(); pos.sticky = "after";}
          break
        }

        if (type) { sawType = type; }
        if (dir > 0 && !moveOnce(!first)) { break }
      }
    }
    var result = skipAtomic(doc, pos, oldPos, origDir, true);
    if (equalCursorPos(oldPos, result)) { result.hitSide = true; }
    return result
  }

  // For relative vertical movement. Dir may be -1 or 1. Unit can be
  // "page" or "line". The resulting position will have a hitSide=true
  // property if it reached the end of the document.
  function findPosV(cm, pos, dir, unit) {
    var doc = cm.doc, x = pos.left, y;
    if (unit == "page") {
      var pageSize = Math.min(cm.display.wrapper.clientHeight, window.innerHeight || document.documentElement.clientHeight);
      var moveAmount = Math.max(pageSize - .5 * textHeight(cm.display), 3);
      y = (dir > 0 ? pos.bottom : pos.top) + dir * moveAmount;

    } else if (unit == "line") {
      y = dir > 0 ? pos.bottom + 3 : pos.top - 3;
    }
    var target;
    for (;;) {
      target = coordsChar(cm, x, y);
      if (!target.outside) { break }
      if (dir < 0 ? y <= 0 : y >= doc.height) { target.hitSide = true; break }
      y += dir * 5;
    }
    return target
  }

  // CONTENTEDITABLE INPUT STYLE

  var ContentEditableInput = function(cm) {
    this.cm = cm;
    this.lastAnchorNode = this.lastAnchorOffset = this.lastFocusNode = this.lastFocusOffset = null;
    this.polling = new Delayed();
    this.composing = null;
    this.gracePeriod = false;
    this.readDOMTimeout = null;
  };

  ContentEditableInput.prototype.init = function (display) {
      var this$1 = this;

    var input = this, cm = input.cm;
    var div = input.div = display.lineDiv;
    div.contentEditable = true;
    disableBrowserMagic(div, cm.options.spellcheck, cm.options.autocorrect, cm.options.autocapitalize);

    function belongsToInput(e) {
      for (var t = e.target; t; t = t.parentNode) {
        if (t == div) { return true }
        if (/\bCodeMirror-(?:line)?widget\b/.test(t.className)) { break }
      }
      return false
    }

    on(div, "paste", function (e) {
      if (!belongsToInput(e) || signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }
      // IE doesn't fire input events, so we schedule a read for the pasted content in this way
      if (ie_version <= 11) { setTimeout(operation(cm, function () { return this$1.updateFromDOM(); }), 20); }
    });

    on(div, "compositionstart", function (e) {
      this$1.composing = {data: e.data, done: false};
    });
    on(div, "compositionupdate", function (e) {
      if (!this$1.composing) { this$1.composing = {data: e.data, done: false}; }
    });
    on(div, "compositionend", function (e) {
      if (this$1.composing) {
        if (e.data != this$1.composing.data) { this$1.readFromDOMSoon(); }
        this$1.composing.done = true;
      }
    });

    on(div, "touchstart", function () { return input.forceCompositionEnd(); });

    on(div, "input", function () {
      if (!this$1.composing) { this$1.readFromDOMSoon(); }
    });

    function onCopyCut(e) {
      if (!belongsToInput(e) || signalDOMEvent(cm, e)) { return }
      if (cm.somethingSelected()) {
        setLastCopied({lineWise: false, text: cm.getSelections()});
        if (e.type == "cut") { cm.replaceSelection("", null, "cut"); }
      } else if (!cm.options.lineWiseCopyCut) {
        return
      } else {
        var ranges = copyableRanges(cm);
        setLastCopied({lineWise: true, text: ranges.text});
        if (e.type == "cut") {
          cm.operation(function () {
            cm.setSelections(ranges.ranges, 0, sel_dontScroll);
            cm.replaceSelection("", null, "cut");
          });
        }
      }
      if (e.clipboardData) {
        e.clipboardData.clearData();
        var content = lastCopied.text.join("\n");
        // iOS exposes the clipboard API, but seems to discard content inserted into it
        e.clipboardData.setData("Text", content);
        if (e.clipboardData.getData("Text") == content) {
          e.preventDefault();
          return
        }
      }
      // Old-fashioned briefly-focus-a-textarea hack
      var kludge = hiddenTextarea(), te = kludge.firstChild;
      cm.display.lineSpace.insertBefore(kludge, cm.display.lineSpace.firstChild);
      te.value = lastCopied.text.join("\n");
      var hadFocus = activeElt();
      selectInput(te);
      setTimeout(function () {
        cm.display.lineSpace.removeChild(kludge);
        hadFocus.focus();
        if (hadFocus == div) { input.showPrimarySelection(); }
      }, 50);
    }
    on(div, "copy", onCopyCut);
    on(div, "cut", onCopyCut);
  };

  ContentEditableInput.prototype.screenReaderLabelChanged = function (label) {
    // Label for screenreaders, accessibility
    if(label) {
      this.div.setAttribute('aria-label', label);
    } else {
      this.div.removeAttribute('aria-label');
    }
  };

  ContentEditableInput.prototype.prepareSelection = function () {
    var result = prepareSelection(this.cm, false);
    result.focus = activeElt() == this.div;
    return result
  };

  ContentEditableInput.prototype.showSelection = function (info, takeFocus) {
    if (!info || !this.cm.display.view.length) { return }
    if (info.focus || takeFocus) { this.showPrimarySelection(); }
    this.showMultipleSelections(info);
  };

  ContentEditableInput.prototype.getSelection = function () {
    return this.cm.display.wrapper.ownerDocument.getSelection()
  };

  ContentEditableInput.prototype.showPrimarySelection = function () {
    var sel = this.getSelection(), cm = this.cm, prim = cm.doc.sel.primary();
    var from = prim.from(), to = prim.to();

    if (cm.display.viewTo == cm.display.viewFrom || from.line >= cm.display.viewTo || to.line < cm.display.viewFrom) {
      sel.removeAllRanges();
      return
    }

    var curAnchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
    var curFocus = domToPos(cm, sel.focusNode, sel.focusOffset);
    if (curAnchor && !curAnchor.bad && curFocus && !curFocus.bad &&
        cmp(minPos(curAnchor, curFocus), from) == 0 &&
        cmp(maxPos(curAnchor, curFocus), to) == 0)
      { return }

    var view = cm.display.view;
    var start = (from.line >= cm.display.viewFrom && posToDOM(cm, from)) ||
        {node: view[0].measure.map[2], offset: 0};
    var end = to.line < cm.display.viewTo && posToDOM(cm, to);
    if (!end) {
      var measure = view[view.length - 1].measure;
      var map = measure.maps ? measure.maps[measure.maps.length - 1] : measure.map;
      end = {node: map[map.length - 1], offset: map[map.length - 2] - map[map.length - 3]};
    }

    if (!start || !end) {
      sel.removeAllRanges();
      return
    }

    var old = sel.rangeCount && sel.getRangeAt(0), rng;
    try { rng = range(start.node, start.offset, end.offset, end.node); }
    catch(e) {} // Our model of the DOM might be outdated, in which case the range we try to set can be impossible
    if (rng) {
      if (!gecko && cm.state.focused) {
        sel.collapse(start.node, start.offset);
        if (!rng.collapsed) {
          sel.removeAllRanges();
          sel.addRange(rng);
        }
      } else {
        sel.removeAllRanges();
        sel.addRange(rng);
      }
      if (old && sel.anchorNode == null) { sel.addRange(old); }
      else if (gecko) { this.startGracePeriod(); }
    }
    this.rememberSelection();
  };

  ContentEditableInput.prototype.startGracePeriod = function () {
      var this$1 = this;

    clearTimeout(this.gracePeriod);
    this.gracePeriod = setTimeout(function () {
      this$1.gracePeriod = false;
      if (this$1.selectionChanged())
        { this$1.cm.operation(function () { return this$1.cm.curOp.selectionChanged = true; }); }
    }, 20);
  };

  ContentEditableInput.prototype.showMultipleSelections = function (info) {
    removeChildrenAndAdd(this.cm.display.cursorDiv, info.cursors);
    removeChildrenAndAdd(this.cm.display.selectionDiv, info.selection);
  };

  ContentEditableInput.prototype.rememberSelection = function () {
    var sel = this.getSelection();
    this.lastAnchorNode = sel.anchorNode; this.lastAnchorOffset = sel.anchorOffset;
    this.lastFocusNode = sel.focusNode; this.lastFocusOffset = sel.focusOffset;
  };

  ContentEditableInput.prototype.selectionInEditor = function () {
    var sel = this.getSelection();
    if (!sel.rangeCount) { return false }
    var node = sel.getRangeAt(0).commonAncestorContainer;
    return contains(this.div, node)
  };

  ContentEditableInput.prototype.focus = function () {
    if (this.cm.options.readOnly != "nocursor") {
      if (!this.selectionInEditor() || activeElt() != this.div)
        { this.showSelection(this.prepareSelection(), true); }
      this.div.focus();
    }
  };
  ContentEditableInput.prototype.blur = function () { this.div.blur(); };
  ContentEditableInput.prototype.getField = function () { return this.div };

  ContentEditableInput.prototype.supportsTouch = function () { return true };

  ContentEditableInput.prototype.receivedFocus = function () {
      var this$1 = this;

    var input = this;
    if (this.selectionInEditor())
      { setTimeout(function () { return this$1.pollSelection(); }, 20); }
    else
      { runInOp(this.cm, function () { return input.cm.curOp.selectionChanged = true; }); }

    function poll() {
      if (input.cm.state.focused) {
        input.pollSelection();
        input.polling.set(input.cm.options.pollInterval, poll);
      }
    }
    this.polling.set(this.cm.options.pollInterval, poll);
  };

  ContentEditableInput.prototype.selectionChanged = function () {
    var sel = this.getSelection();
    return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset ||
      sel.focusNode != this.lastFocusNode || sel.focusOffset != this.lastFocusOffset
  };

  ContentEditableInput.prototype.pollSelection = function () {
    if (this.readDOMTimeout != null || this.gracePeriod || !this.selectionChanged()) { return }
    var sel = this.getSelection(), cm = this.cm;
    // On Android Chrome (version 56, at least), backspacing into an
    // uneditable block element will put the cursor in that element,
    // and then, because it's not editable, hide the virtual keyboard.
    // Because Android doesn't allow us to actually detect backspace
    // presses in a sane way, this code checks for when that happens
    // and simulates a backspace press in this case.
    if (android && chrome && this.cm.display.gutterSpecs.length && isInGutter(sel.anchorNode)) {
      this.cm.triggerOnKeyDown({type: "keydown", keyCode: 8, preventDefault: Math.abs});
      this.blur();
      this.focus();
      return
    }
    if (this.composing) { return }
    this.rememberSelection();
    var anchor = domToPos(cm, sel.anchorNode, sel.anchorOffset);
    var head = domToPos(cm, sel.focusNode, sel.focusOffset);
    if (anchor && head) { runInOp(cm, function () {
      setSelection(cm.doc, simpleSelection(anchor, head), sel_dontScroll);
      if (anchor.bad || head.bad) { cm.curOp.selectionChanged = true; }
    }); }
  };

  ContentEditableInput.prototype.pollContent = function () {
    if (this.readDOMTimeout != null) {
      clearTimeout(this.readDOMTimeout);
      this.readDOMTimeout = null;
    }

    var cm = this.cm, display = cm.display, sel = cm.doc.sel.primary();
    var from = sel.from(), to = sel.to();
    if (from.ch == 0 && from.line > cm.firstLine())
      { from = Pos(from.line - 1, getLine(cm.doc, from.line - 1).length); }
    if (to.ch == getLine(cm.doc, to.line).text.length && to.line < cm.lastLine())
      { to = Pos(to.line + 1, 0); }
    if (from.line < display.viewFrom || to.line > display.viewTo - 1) { return false }

    var fromIndex, fromLine, fromNode;
    if (from.line == display.viewFrom || (fromIndex = findViewIndex(cm, from.line)) == 0) {
      fromLine = lineNo(display.view[0].line);
      fromNode = display.view[0].node;
    } else {
      fromLine = lineNo(display.view[fromIndex].line);
      fromNode = display.view[fromIndex - 1].node.nextSibling;
    }
    var toIndex = findViewIndex(cm, to.line);
    var toLine, toNode;
    if (toIndex == display.view.length - 1) {
      toLine = display.viewTo - 1;
      toNode = display.lineDiv.lastChild;
    } else {
      toLine = lineNo(display.view[toIndex + 1].line) - 1;
      toNode = display.view[toIndex + 1].node.previousSibling;
    }

    if (!fromNode) { return false }
    var newText = cm.doc.splitLines(domTextBetween(cm, fromNode, toNode, fromLine, toLine));
    var oldText = getBetween(cm.doc, Pos(fromLine, 0), Pos(toLine, getLine(cm.doc, toLine).text.length));
    while (newText.length > 1 && oldText.length > 1) {
      if (lst(newText) == lst(oldText)) { newText.pop(); oldText.pop(); toLine--; }
      else if (newText[0] == oldText[0]) { newText.shift(); oldText.shift(); fromLine++; }
      else { break }
    }

    var cutFront = 0, cutEnd = 0;
    var newTop = newText[0], oldTop = oldText[0], maxCutFront = Math.min(newTop.length, oldTop.length);
    while (cutFront < maxCutFront && newTop.charCodeAt(cutFront) == oldTop.charCodeAt(cutFront))
      { ++cutFront; }
    var newBot = lst(newText), oldBot = lst(oldText);
    var maxCutEnd = Math.min(newBot.length - (newText.length == 1 ? cutFront : 0),
                             oldBot.length - (oldText.length == 1 ? cutFront : 0));
    while (cutEnd < maxCutEnd &&
           newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1))
      { ++cutEnd; }
    // Try to move start of change to start of selection if ambiguous
    if (newText.length == 1 && oldText.length == 1 && fromLine == from.line) {
      while (cutFront && cutFront > from.ch &&
             newBot.charCodeAt(newBot.length - cutEnd - 1) == oldBot.charCodeAt(oldBot.length - cutEnd - 1)) {
        cutFront--;
        cutEnd++;
      }
    }

    newText[newText.length - 1] = newBot.slice(0, newBot.length - cutEnd).replace(/^\u200b+/, "");
    newText[0] = newText[0].slice(cutFront).replace(/\u200b+$/, "");

    var chFrom = Pos(fromLine, cutFront);
    var chTo = Pos(toLine, oldText.length ? lst(oldText).length - cutEnd : 0);
    if (newText.length > 1 || newText[0] || cmp(chFrom, chTo)) {
      replaceRange(cm.doc, newText, chFrom, chTo, "+input");
      return true
    }
  };

  ContentEditableInput.prototype.ensurePolled = function () {
    this.forceCompositionEnd();
  };
  ContentEditableInput.prototype.reset = function () {
    this.forceCompositionEnd();
  };
  ContentEditableInput.prototype.forceCompositionEnd = function () {
    if (!this.composing) { return }
    clearTimeout(this.readDOMTimeout);
    this.composing = null;
    this.updateFromDOM();
    this.div.blur();
    this.div.focus();
  };
  ContentEditableInput.prototype.readFromDOMSoon = function () {
      var this$1 = this;

    if (this.readDOMTimeout != null) { return }
    this.readDOMTimeout = setTimeout(function () {
      this$1.readDOMTimeout = null;
      if (this$1.composing) {
        if (this$1.composing.done) { this$1.composing = null; }
        else { return }
      }
      this$1.updateFromDOM();
    }, 80);
  };

  ContentEditableInput.prototype.updateFromDOM = function () {
      var this$1 = this;

    if (this.cm.isReadOnly() || !this.pollContent())
      { runInOp(this.cm, function () { return regChange(this$1.cm); }); }
  };

  ContentEditableInput.prototype.setUneditable = function (node) {
    node.contentEditable = "false";
  };

  ContentEditableInput.prototype.onKeyPress = function (e) {
    if (e.charCode == 0 || this.composing) { return }
    e.preventDefault();
    if (!this.cm.isReadOnly())
      { operation(this.cm, applyTextInput)(this.cm, String.fromCharCode(e.charCode == null ? e.keyCode : e.charCode), 0); }
  };

  ContentEditableInput.prototype.readOnlyChanged = function (val) {
    this.div.contentEditable = String(val != "nocursor");
  };

  ContentEditableInput.prototype.onContextMenu = function () {};
  ContentEditableInput.prototype.resetPosition = function () {};

  ContentEditableInput.prototype.needsContentAttribute = true;

  function posToDOM(cm, pos) {
    var view = findViewForLine(cm, pos.line);
    if (!view || view.hidden) { return null }
    var line = getLine(cm.doc, pos.line);
    var info = mapFromLineView(view, line, pos.line);

    var order = getOrder(line, cm.doc.direction), side = "left";
    if (order) {
      var partPos = getBidiPartAt(order, pos.ch);
      side = partPos % 2 ? "right" : "left";
    }
    var result = nodeAndOffsetInLineMap(info.map, pos.ch, side);
    result.offset = result.collapse == "right" ? result.end : result.start;
    return result
  }

  function isInGutter(node) {
    for (var scan = node; scan; scan = scan.parentNode)
      { if (/CodeMirror-gutter-wrapper/.test(scan.className)) { return true } }
    return false
  }

  function badPos(pos, bad) { if (bad) { pos.bad = true; } return pos }

  function domTextBetween(cm, from, to, fromLine, toLine) {
    var text = "", closing = false, lineSep = cm.doc.lineSeparator(), extraLinebreak = false;
    function recognizeMarker(id) { return function (marker) { return marker.id == id; } }
    function close() {
      if (closing) {
        text += lineSep;
        if (extraLinebreak) { text += lineSep; }
        closing = extraLinebreak = false;
      }
    }
    function addText(str) {
      if (str) {
        close();
        text += str;
      }
    }
    function walk(node) {
      if (node.nodeType == 1) {
        var cmText = node.getAttribute("cm-text");
        if (cmText) {
          addText(cmText);
          return
        }
        var markerID = node.getAttribute("cm-marker"), range;
        if (markerID) {
          var found = cm.findMarks(Pos(fromLine, 0), Pos(toLine + 1, 0), recognizeMarker(+markerID));
          if (found.length && (range = found[0].find(0)))
            { addText(getBetween(cm.doc, range.from, range.to).join(lineSep)); }
          return
        }
        if (node.getAttribute("contenteditable") == "false") { return }
        var isBlock = /^(pre|div|p|li|table|br)$/i.test(node.nodeName);
        if (!/^br$/i.test(node.nodeName) && node.textContent.length == 0) { return }

        if (isBlock) { close(); }
        for (var i = 0; i < node.childNodes.length; i++)
          { walk(node.childNodes[i]); }

        if (/^(pre|p)$/i.test(node.nodeName)) { extraLinebreak = true; }
        if (isBlock) { closing = true; }
      } else if (node.nodeType == 3) {
        addText(node.nodeValue.replace(/\u200b/g, "").replace(/\u00a0/g, " "));
      }
    }
    for (;;) {
      walk(from);
      if (from == to) { break }
      from = from.nextSibling;
      extraLinebreak = false;
    }
    return text
  }

  function domToPos(cm, node, offset) {
    var lineNode;
    if (node == cm.display.lineDiv) {
      lineNode = cm.display.lineDiv.childNodes[offset];
      if (!lineNode) { return badPos(cm.clipPos(Pos(cm.display.viewTo - 1)), true) }
      node = null; offset = 0;
    } else {
      for (lineNode = node;; lineNode = lineNode.parentNode) {
        if (!lineNode || lineNode == cm.display.lineDiv) { return null }
        if (lineNode.parentNode && lineNode.parentNode == cm.display.lineDiv) { break }
      }
    }
    for (var i = 0; i < cm.display.view.length; i++) {
      var lineView = cm.display.view[i];
      if (lineView.node == lineNode)
        { return locateNodeInLineView(lineView, node, offset) }
    }
  }

  function locateNodeInLineView(lineView, node, offset) {
    var wrapper = lineView.text.firstChild, bad = false;
    if (!node || !contains(wrapper, node)) { return badPos(Pos(lineNo(lineView.line), 0), true) }
    if (node == wrapper) {
      bad = true;
      node = wrapper.childNodes[offset];
      offset = 0;
      if (!node) {
        var line = lineView.rest ? lst(lineView.rest) : lineView.line;
        return badPos(Pos(lineNo(line), line.text.length), bad)
      }
    }

    var textNode = node.nodeType == 3 ? node : null, topNode = node;
    if (!textNode && node.childNodes.length == 1 && node.firstChild.nodeType == 3) {
      textNode = node.firstChild;
      if (offset) { offset = textNode.nodeValue.length; }
    }
    while (topNode.parentNode != wrapper) { topNode = topNode.parentNode; }
    var measure = lineView.measure, maps = measure.maps;

    function find(textNode, topNode, offset) {
      for (var i = -1; i < (maps ? maps.length : 0); i++) {
        var map = i < 0 ? measure.map : maps[i];
        for (var j = 0; j < map.length; j += 3) {
          var curNode = map[j + 2];
          if (curNode == textNode || curNode == topNode) {
            var line = lineNo(i < 0 ? lineView.line : lineView.rest[i]);
            var ch = map[j] + offset;
            if (offset < 0 || curNode != textNode) { ch = map[j + (offset ? 1 : 0)]; }
            return Pos(line, ch)
          }
        }
      }
    }
    var found = find(textNode, topNode, offset);
    if (found) { return badPos(found, bad) }

    // FIXME this is all really shaky. might handle the few cases it needs to handle, but likely to cause problems
    for (var after = topNode.nextSibling, dist = textNode ? textNode.nodeValue.length - offset : 0; after; after = after.nextSibling) {
      found = find(after, after.firstChild, 0);
      if (found)
        { return badPos(Pos(found.line, found.ch - dist), bad) }
      else
        { dist += after.textContent.length; }
    }
    for (var before = topNode.previousSibling, dist$1 = offset; before; before = before.previousSibling) {
      found = find(before, before.firstChild, -1);
      if (found)
        { return badPos(Pos(found.line, found.ch + dist$1), bad) }
      else
        { dist$1 += before.textContent.length; }
    }
  }

  // TEXTAREA INPUT STYLE

  var TextareaInput = function(cm) {
    this.cm = cm;
    // See input.poll and input.reset
    this.prevInput = "";

    // Flag that indicates whether we expect input to appear real soon
    // now (after some event like 'keypress' or 'input') and are
    // polling intensively.
    this.pollingFast = false;
    // Self-resetting timeout for the poller
    this.polling = new Delayed();
    // Used to work around IE issue with selection being forgotten when focus moves away from textarea
    this.hasSelection = false;
    this.composing = null;
  };

  TextareaInput.prototype.init = function (display) {
      var this$1 = this;

    var input = this, cm = this.cm;
    this.createField(display);
    var te = this.textarea;

    display.wrapper.insertBefore(this.wrapper, display.wrapper.firstChild);

    // Needed to hide big blue blinking cursor on Mobile Safari (doesn't seem to work in iOS 8 anymore)
    if (ios) { te.style.width = "0px"; }

    on(te, "input", function () {
      if (ie && ie_version >= 9 && this$1.hasSelection) { this$1.hasSelection = null; }
      input.poll();
    });

    on(te, "paste", function (e) {
      if (signalDOMEvent(cm, e) || handlePaste(e, cm)) { return }

      cm.state.pasteIncoming = +new Date;
      input.fastPoll();
    });

    function prepareCopyCut(e) {
      if (signalDOMEvent(cm, e)) { return }
      if (cm.somethingSelected()) {
        setLastCopied({lineWise: false, text: cm.getSelections()});
      } else if (!cm.options.lineWiseCopyCut) {
        return
      } else {
        var ranges = copyableRanges(cm);
        setLastCopied({lineWise: true, text: ranges.text});
        if (e.type == "cut") {
          cm.setSelections(ranges.ranges, null, sel_dontScroll);
        } else {
          input.prevInput = "";
          te.value = ranges.text.join("\n");
          selectInput(te);
        }
      }
      if (e.type == "cut") { cm.state.cutIncoming = +new Date; }
    }
    on(te, "cut", prepareCopyCut);
    on(te, "copy", prepareCopyCut);

    on(display.scroller, "paste", function (e) {
      if (eventInWidget(display, e) || signalDOMEvent(cm, e)) { return }
      if (!te.dispatchEvent) {
        cm.state.pasteIncoming = +new Date;
        input.focus();
        return
      }

      // Pass the `paste` event to the textarea so it's handled by its event listener.
      var event = new Event("paste");
      event.clipboardData = e.clipboardData;
      te.dispatchEvent(event);
    });

    // Prevent normal selection in the editor (we handle our own)
    on(display.lineSpace, "selectstart", function (e) {
      if (!eventInWidget(display, e)) { e_preventDefault(e); }
    });

    on(te, "compositionstart", function () {
      var start = cm.getCursor("from");
      if (input.composing) { input.composing.range.clear(); }
      input.composing = {
        start: start,
        range: cm.markText(start, cm.getCursor("to"), {className: "CodeMirror-composing"})
      };
    });
    on(te, "compositionend", function () {
      if (input.composing) {
        input.poll();
        input.composing.range.clear();
        input.composing = null;
      }
    });
  };

  TextareaInput.prototype.createField = function (_display) {
    // Wraps and hides input textarea
    this.wrapper = hiddenTextarea();
    // The semihidden textarea that is focused when the editor is
    // focused, and receives input.
    this.textarea = this.wrapper.firstChild;
  };

  TextareaInput.prototype.screenReaderLabelChanged = function (label) {
    // Label for screenreaders, accessibility
    if(label) {
      this.textarea.setAttribute('aria-label', label);
    } else {
      this.textarea.removeAttribute('aria-label');
    }
  };

  TextareaInput.prototype.prepareSelection = function () {
    // Redraw the selection and/or cursor
    var cm = this.cm, display = cm.display, doc = cm.doc;
    var result = prepareSelection(cm);

    // Move the hidden textarea near the cursor to prevent scrolling artifacts
    if (cm.options.moveInputWithCursor) {
      var headPos = cursorCoords(cm, doc.sel.primary().head, "div");
      var wrapOff = display.wrapper.getBoundingClientRect(), lineOff = display.lineDiv.getBoundingClientRect();
      result.teTop = Math.max(0, Math.min(display.wrapper.clientHeight - 10,
                                          headPos.top + lineOff.top - wrapOff.top));
      result.teLeft = Math.max(0, Math.min(display.wrapper.clientWidth - 10,
                                           headPos.left + lineOff.left - wrapOff.left));
    }

    return result
  };

  TextareaInput.prototype.showSelection = function (drawn) {
    var cm = this.cm, display = cm.display;
    removeChildrenAndAdd(display.cursorDiv, drawn.cursors);
    removeChildrenAndAdd(display.selectionDiv, drawn.selection);
    if (drawn.teTop != null) {
      this.wrapper.style.top = drawn.teTop + "px";
      this.wrapper.style.left = drawn.teLeft + "px";
    }
  };

  // Reset the input to correspond to the selection (or to be empty,
  // when not typing and nothing is selected)
  TextareaInput.prototype.reset = function (typing) {
    if (this.contextMenuPending || this.composing) { return }
    var cm = this.cm;
    if (cm.somethingSelected()) {
      this.prevInput = "";
      var content = cm.getSelection();
      this.textarea.value = content;
      if (cm.state.focused) { selectInput(this.textarea); }
      if (ie && ie_version >= 9) { this.hasSelection = content; }
    } else if (!typing) {
      this.prevInput = this.textarea.value = "";
      if (ie && ie_version >= 9) { this.hasSelection = null; }
    }
  };

  TextareaInput.prototype.getField = function () { return this.textarea };

  TextareaInput.prototype.supportsTouch = function () { return false };

  TextareaInput.prototype.focus = function () {
    if (this.cm.options.readOnly != "nocursor" && (!mobile || activeElt() != this.textarea)) {
      try { this.textarea.focus(); }
      catch (e) {} // IE8 will throw if the textarea is display: none or not in DOM
    }
  };

  TextareaInput.prototype.blur = function () { this.textarea.blur(); };

  TextareaInput.prototype.resetPosition = function () {
    this.wrapper.style.top = this.wrapper.style.left = 0;
  };

  TextareaInput.prototype.receivedFocus = function () { this.slowPoll(); };

  // Poll for input changes, using the normal rate of polling. This
  // runs as long as the editor is focused.
  TextareaInput.prototype.slowPoll = function () {
      var this$1 = this;

    if (this.pollingFast) { return }
    this.polling.set(this.cm.options.pollInterval, function () {
      this$1.poll();
      if (this$1.cm.state.focused) { this$1.slowPoll(); }
    });
  };

  // When an event has just come in that is likely to add or change
  // something in the input textarea, we poll faster, to ensure that
  // the change appears on the screen quickly.
  TextareaInput.prototype.fastPoll = function () {
    var missed = false, input = this;
    input.pollingFast = true;
    function p() {
      var changed = input.poll();
      if (!changed && !missed) {missed = true; input.polling.set(60, p);}
      else {input.pollingFast = false; input.slowPoll();}
    }
    input.polling.set(20, p);
  };

  // Read input from the textarea, and update the document to match.
  // When something is selected, it is present in the textarea, and
  // selected (unless it is huge, in which case a placeholder is
  // used). When nothing is selected, the cursor sits after previously
  // seen text (can be empty), which is stored in prevInput (we must
  // not reset the textarea when typing, because that breaks IME).
  TextareaInput.prototype.poll = function () {
      var this$1 = this;

    var cm = this.cm, input = this.textarea, prevInput = this.prevInput;
    // Since this is called a *lot*, try to bail out as cheaply as
    // possible when it is clear that nothing happened. hasSelection
    // will be the case when there is a lot of text in the textarea,
    // in which case reading its value would be expensive.
    if (this.contextMenuPending || !cm.state.focused ||
        (hasSelection(input) && !prevInput && !this.composing) ||
        cm.isReadOnly() || cm.options.disableInput || cm.state.keySeq)
      { return false }

    var text = input.value;
    // If nothing changed, bail.
    if (text == prevInput && !cm.somethingSelected()) { return false }
    // Work around nonsensical selection resetting in IE9/10, and
    // inexplicable appearance of private area unicode characters on
    // some key combos in Mac (#2689).
    if (ie && ie_version >= 9 && this.hasSelection === text ||
        mac && /[\uf700-\uf7ff]/.test(text)) {
      cm.display.input.reset();
      return false
    }

    if (cm.doc.sel == cm.display.selForContextMenu) {
      var first = text.charCodeAt(0);
      if (first == 0x200b && !prevInput) { prevInput = "\u200b"; }
      if (first == 0x21da) { this.reset(); return this.cm.execCommand("undo") }
    }
    // Find the part of the input that is actually new
    var same = 0, l = Math.min(prevInput.length, text.length);
    while (same < l && prevInput.charCodeAt(same) == text.charCodeAt(same)) { ++same; }

    runInOp(cm, function () {
      applyTextInput(cm, text.slice(same), prevInput.length - same,
                     null, this$1.composing ? "*compose" : null);

      // Don't leave long text in the textarea, since it makes further polling slow
      if (text.length > 1000 || text.indexOf("\n") > -1) { input.value = this$1.prevInput = ""; }
      else { this$1.prevInput = text; }

      if (this$1.composing) {
        this$1.composing.range.clear();
        this$1.composing.range = cm.markText(this$1.composing.start, cm.getCursor("to"),
                                           {className: "CodeMirror-composing"});
      }
    });
    return true
  };

  TextareaInput.prototype.ensurePolled = function () {
    if (this.pollingFast && this.poll()) { this.pollingFast = false; }
  };

  TextareaInput.prototype.onKeyPress = function () {
    if (ie && ie_version >= 9) { this.hasSelection = null; }
    this.fastPoll();
  };

  TextareaInput.prototype.onContextMenu = function (e) {
    var input = this, cm = input.cm, display = cm.display, te = input.textarea;
    if (input.contextMenuPending) { input.contextMenuPending(); }
    var pos = posFromMouse(cm, e), scrollPos = display.scroller.scrollTop;
    if (!pos || presto) { return } // Opera is difficult.

    // Reset the current text selection only if the click is done outside of the selection
    // and 'resetSelectionOnContextMenu' option is true.
    var reset = cm.options.resetSelectionOnContextMenu;
    if (reset && cm.doc.sel.contains(pos) == -1)
      { operation(cm, setSelection)(cm.doc, simpleSelection(pos), sel_dontScroll); }

    var oldCSS = te.style.cssText, oldWrapperCSS = input.wrapper.style.cssText;
    var wrapperBox = input.wrapper.offsetParent.getBoundingClientRect();
    input.wrapper.style.cssText = "position: static";
    te.style.cssText = "position: absolute; width: 30px; height: 30px;\n      top: " + (e.clientY - wrapperBox.top - 5) + "px; left: " + (e.clientX - wrapperBox.left - 5) + "px;\n      z-index: 1000; background: " + (ie ? "rgba(255, 255, 255, .05)" : "transparent") + ";\n      outline: none; border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
    var oldScrollY;
    if (webkit) { oldScrollY = window.scrollY; } // Work around Chrome issue (#2712)
    display.input.focus();
    if (webkit) { window.scrollTo(null, oldScrollY); }
    display.input.reset();
    // Adds "Select all" to context menu in FF
    if (!cm.somethingSelected()) { te.value = input.prevInput = " "; }
    input.contextMenuPending = rehide;
    display.selForContextMenu = cm.doc.sel;
    clearTimeout(display.detectingSelectAll);

    // Select-all will be greyed out if there's nothing to select, so
    // this adds a zero-width space so that we can later check whether
    // it got selected.
    function prepareSelectAllHack() {
      if (te.selectionStart != null) {
        var selected = cm.somethingSelected();
        var extval = "\u200b" + (selected ? te.value : "");
        te.value = "\u21da"; // Used to catch context-menu undo
        te.value = extval;
        input.prevInput = selected ? "" : "\u200b";
        te.selectionStart = 1; te.selectionEnd = extval.length;
        // Re-set this, in case some other handler touched the
        // selection in the meantime.
        display.selForContextMenu = cm.doc.sel;
      }
    }
    function rehide() {
      if (input.contextMenuPending != rehide) { return }
      input.contextMenuPending = false;
      input.wrapper.style.cssText = oldWrapperCSS;
      te.style.cssText = oldCSS;
      if (ie && ie_version < 9) { display.scrollbars.setScrollTop(display.scroller.scrollTop = scrollPos); }

      // Try to detect the user choosing select-all
      if (te.selectionStart != null) {
        if (!ie || (ie && ie_version < 9)) { prepareSelectAllHack(); }
        var i = 0, poll = function () {
          if (display.selForContextMenu == cm.doc.sel && te.selectionStart == 0 &&
              te.selectionEnd > 0 && input.prevInput == "\u200b") {
            operation(cm, selectAll)(cm);
          } else if (i++ < 10) {
            display.detectingSelectAll = setTimeout(poll, 500);
          } else {
            display.selForContextMenu = null;
            display.input.reset();
          }
        };
        display.detectingSelectAll = setTimeout(poll, 200);
      }
    }

    if (ie && ie_version >= 9) { prepareSelectAllHack(); }
    if (captureRightClick) {
      e_stop(e);
      var mouseup = function () {
        off(window, "mouseup", mouseup);
        setTimeout(rehide, 20);
      };
      on(window, "mouseup", mouseup);
    } else {
      setTimeout(rehide, 50);
    }
  };

  TextareaInput.prototype.readOnlyChanged = function (val) {
    if (!val) { this.reset(); }
    this.textarea.disabled = val == "nocursor";
    this.textarea.readOnly = !!val;
  };

  TextareaInput.prototype.setUneditable = function () {};

  TextareaInput.prototype.needsContentAttribute = false;

  function fromTextArea(textarea, options) {
    options = options ? copyObj(options) : {};
    options.value = textarea.value;
    if (!options.tabindex && textarea.tabIndex)
      { options.tabindex = textarea.tabIndex; }
    if (!options.placeholder && textarea.placeholder)
      { options.placeholder = textarea.placeholder; }
    // Set autofocus to true if this textarea is focused, or if it has
    // autofocus and no other element is focused.
    if (options.autofocus == null) {
      var hasFocus = activeElt();
      options.autofocus = hasFocus == textarea ||
        textarea.getAttribute("autofocus") != null && hasFocus == document.body;
    }

    function save() {textarea.value = cm.getValue();}

    var realSubmit;
    if (textarea.form) {
      on(textarea.form, "submit", save);
      // Deplorable hack to make the submit method do the right thing.
      if (!options.leaveSubmitMethodAlone) {
        var form = textarea.form;
        realSubmit = form.submit;
        try {
          var wrappedSubmit = form.submit = function () {
            save();
            form.submit = realSubmit;
            form.submit();
            form.submit = wrappedSubmit;
          };
        } catch(e) {}
      }
    }

    options.finishInit = function (cm) {
      cm.save = save;
      cm.getTextArea = function () { return textarea; };
      cm.toTextArea = function () {
        cm.toTextArea = isNaN; // Prevent this from being ran twice
        save();
        textarea.parentNode.removeChild(cm.getWrapperElement());
        textarea.style.display = "";
        if (textarea.form) {
          off(textarea.form, "submit", save);
          if (!options.leaveSubmitMethodAlone && typeof textarea.form.submit == "function")
            { textarea.form.submit = realSubmit; }
        }
      };
    };

    textarea.style.display = "none";
    var cm = CodeMirror(function (node) { return textarea.parentNode.insertBefore(node, textarea.nextSibling); },
      options);
    return cm
  }

  function addLegacyProps(CodeMirror) {
    CodeMirror.off = off;
    CodeMirror.on = on;
    CodeMirror.wheelEventPixels = wheelEventPixels;
    CodeMirror.Doc = Doc;
    CodeMirror.splitLines = splitLinesAuto;
    CodeMirror.countColumn = countColumn;
    CodeMirror.findColumn = findColumn;
    CodeMirror.isWordChar = isWordCharBasic;
    CodeMirror.Pass = Pass;
    CodeMirror.signal = signal;
    CodeMirror.Line = Line;
    CodeMirror.changeEnd = changeEnd;
    CodeMirror.scrollbarModel = scrollbarModel;
    CodeMirror.Pos = Pos;
    CodeMirror.cmpPos = cmp;
    CodeMirror.modes = modes;
    CodeMirror.mimeModes = mimeModes;
    CodeMirror.resolveMode = resolveMode;
    CodeMirror.getMode = getMode;
    CodeMirror.modeExtensions = modeExtensions;
    CodeMirror.extendMode = extendMode;
    CodeMirror.copyState = copyState;
    CodeMirror.startState = startState;
    CodeMirror.innerMode = innerMode;
    CodeMirror.commands = commands;
    CodeMirror.keyMap = keyMap;
    CodeMirror.keyName = keyName;
    CodeMirror.isModifierKey = isModifierKey;
    CodeMirror.lookupKey = lookupKey;
    CodeMirror.normalizeKeyMap = normalizeKeyMap;
    CodeMirror.StringStream = StringStream;
    CodeMirror.SharedTextMarker = SharedTextMarker;
    CodeMirror.TextMarker = TextMarker;
    CodeMirror.LineWidget = LineWidget;
    CodeMirror.e_preventDefault = e_preventDefault;
    CodeMirror.e_stopPropagation = e_stopPropagation;
    CodeMirror.e_stop = e_stop;
    CodeMirror.addClass = addClass;
    CodeMirror.contains = contains;
    CodeMirror.rmClass = rmClass;
    CodeMirror.keyNames = keyNames;
  }

  // EDITOR CONSTRUCTOR

  defineOptions(CodeMirror);

  addEditorMethods(CodeMirror);

  // Set up methods on CodeMirror's prototype to redirect to the editor's document.
  var dontDelegate = "iter insert remove copy getEditor constructor".split(" ");
  for (var prop in Doc.prototype) { if (Doc.prototype.hasOwnProperty(prop) && indexOf(dontDelegate, prop) < 0)
    { CodeMirror.prototype[prop] = (function(method) {
      return function() {return method.apply(this.doc, arguments)}
    })(Doc.prototype[prop]); } }

  eventMixin(Doc);
  CodeMirror.inputStyles = {"textarea": TextareaInput, "contenteditable": ContentEditableInput};

  // Extra arguments are stored as the mode's dependencies, which is
  // used by (legacy) mechanisms like loadmode.js to automatically
  // load a mode. (Preferred mechanism is the require/define calls.)
  CodeMirror.defineMode = function(name/*, mode, …*/) {
    if (!CodeMirror.defaults.mode && name != "null") { CodeMirror.defaults.mode = name; }
    defineMode.apply(this, arguments);
  };

  CodeMirror.defineMIME = defineMIME;

  // Minimal default mode.
  CodeMirror.defineMode("null", function () { return ({token: function (stream) { return stream.skipToEnd(); }}); });
  CodeMirror.defineMIME("text/plain", "null");

  // EXTENSIONS

  CodeMirror.defineExtension = function (name, func) {
    CodeMirror.prototype[name] = func;
  };
  CodeMirror.defineDocExtension = function (name, func) {
    Doc.prototype[name] = func;
  };

  CodeMirror.fromTextArea = fromTextArea;

  addLegacyProps(CodeMirror);

  CodeMirror.version = "5.63.0";

  return CodeMirror;

})));
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

// Utility function that allows modes to be combined. The mode given
// as the base argument takes care of most of the normal mode
// functionality, but a second (typically simple) mode is used, which
// can override the style of text. Both modes get to parse all of the
// text, but when both assign a non-null style to a piece of code, the
// overlay wins, unless the combine argument was true and not overridden,
// or state.overlay.combineTokens was true, in which case the styles are
// combined.

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.overlayMode = function(base, overlay, combine) {
  return {
    startState: function() {
      return {
        base: CodeMirror.startState(base),
        overlay: CodeMirror.startState(overlay),
        basePos: 0, baseCur: null,
        overlayPos: 0, overlayCur: null,
        streamSeen: null
      };
    },
    copyState: function(state) {
      return {
        base: CodeMirror.copyState(base, state.base),
        overlay: CodeMirror.copyState(overlay, state.overlay),
        basePos: state.basePos, baseCur: null,
        overlayPos: state.overlayPos, overlayCur: null
      };
    },

    token: function(stream, state) {
      if (stream != state.streamSeen ||
          Math.min(state.basePos, state.overlayPos) < stream.start) {
        state.streamSeen = stream;
        state.basePos = state.overlayPos = stream.start;
      }

      if (stream.start == state.basePos) {
        state.baseCur = base.token(stream, state.base);
        state.basePos = stream.pos;
      }
      if (stream.start == state.overlayPos) {
        stream.pos = stream.start;
        state.overlayCur = overlay.token(stream, state.overlay);
        state.overlayPos = stream.pos;
      }
      stream.pos = Math.min(state.basePos, state.overlayPos);

      // state.overlay.combineTokens always takes precedence over combine,
      // unless set to null
      if (state.overlayCur == null) return state.baseCur;
      else if (state.baseCur != null &&
               state.overlay.combineTokens ||
               combine && state.overlay.combineTokens == null)
        return state.baseCur + " " + state.overlayCur;
      else return state.overlayCur;
    },

    indent: base.indent && function(state, textAfter, line) {
      return base.indent(state.base, textAfter, line);
    },
    electricChars: base.electricChars,

    innerMode: function(state) { return {state: state.base, mode: base}; },

    blankLine: function(state) {
      var baseToken, overlayToken;
      if (base.blankLine) baseToken = base.blankLine(state.base);
      if (overlay.blankLine) overlayToken = overlay.blankLine(state.overlay);

      return overlayToken == null ?
        baseToken :
        (combine && baseToken != null ? baseToken + " " + overlayToken : overlayToken);
    }
  };
};

});
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

var htmlConfig = {
  autoSelfClosers: {'area': true, 'base': true, 'br': true, 'col': true, 'command': true,
                    'embed': true, 'frame': true, 'hr': true, 'img': true, 'input': true,
                    'keygen': true, 'link': true, 'meta': true, 'param': true, 'source': true,
                    'track': true, 'wbr': true, 'menuitem': true},
  implicitlyClosed: {'dd': true, 'li': true, 'optgroup': true, 'option': true, 'p': true,
                     'rp': true, 'rt': true, 'tbody': true, 'td': true, 'tfoot': true,
                     'th': true, 'tr': true},
  contextGrabbers: {
    'dd': {'dd': true, 'dt': true},
    'dt': {'dd': true, 'dt': true},
    'li': {'li': true},
    'option': {'option': true, 'optgroup': true},
    'optgroup': {'optgroup': true},
    'p': {'address': true, 'article': true, 'aside': true, 'blockquote': true, 'dir': true,
          'div': true, 'dl': true, 'fieldset': true, 'footer': true, 'form': true,
          'h1': true, 'h2': true, 'h3': true, 'h4': true, 'h5': true, 'h6': true,
          'header': true, 'hgroup': true, 'hr': true, 'menu': true, 'nav': true, 'ol': true,
          'p': true, 'pre': true, 'section': true, 'table': true, 'ul': true},
    'rp': {'rp': true, 'rt': true},
    'rt': {'rp': true, 'rt': true},
    'tbody': {'tbody': true, 'tfoot': true},
    'td': {'td': true, 'th': true},
    'tfoot': {'tbody': true},
    'th': {'td': true, 'th': true},
    'thead': {'tbody': true, 'tfoot': true},
    'tr': {'tr': true}
  },
  doNotIndent: {"pre": true},
  allowUnquoted: true,
  allowMissing: true,
  caseFold: true
}

var xmlConfig = {
  autoSelfClosers: {},
  implicitlyClosed: {},
  contextGrabbers: {},
  doNotIndent: {},
  allowUnquoted: false,
  allowMissing: false,
  allowMissingTagName: false,
  caseFold: false
}

CodeMirror.defineMode("xml", function(editorConf, config_) {
  var indentUnit = editorConf.indentUnit
  var config = {}
  var defaults = config_.htmlMode ? htmlConfig : xmlConfig
  for (var prop in defaults) config[prop] = defaults[prop]
  for (var prop in config_) config[prop] = config_[prop]

  // Return variables for tokenizers
  var type, setStyle;

  function inText(stream, state) {
    function chain(parser) {
      state.tokenize = parser;
      return parser(stream, state);
    }

    var ch = stream.next();
    if (ch == "<") {
      if (stream.eat("!")) {
        if (stream.eat("[")) {
          if (stream.match("CDATA[")) return chain(inBlock("atom", "]]>"));
          else return null;
        } else if (stream.match("--")) {
          return chain(inBlock("comment", "-->"));
        } else if (stream.match("DOCTYPE", true, true)) {
          stream.eatWhile(/[\w\._\-]/);
          return chain(doctype(1));
        } else {
          return null;
        }
      } else if (stream.eat("?")) {
        stream.eatWhile(/[\w\._\-]/);
        state.tokenize = inBlock("meta", "?>");
        return "meta";
      } else {
        type = stream.eat("/") ? "closeTag" : "openTag";
        state.tokenize = inTag;
        return "tag bracket";
      }
    } else if (ch == "&") {
      var ok;
      if (stream.eat("#")) {
        if (stream.eat("x")) {
          ok = stream.eatWhile(/[a-fA-F\d]/) && stream.eat(";");
        } else {
          ok = stream.eatWhile(/[\d]/) && stream.eat(";");
        }
      } else {
        ok = stream.eatWhile(/[\w\.\-:]/) && stream.eat(";");
      }
      return ok ? "atom" : "error";
    } else {
      stream.eatWhile(/[^&<]/);
      return null;
    }
  }
  inText.isInText = true;

  function inTag(stream, state) {
    var ch = stream.next();
    if (ch == ">" || (ch == "/" && stream.eat(">"))) {
      state.tokenize = inText;
      type = ch == ">" ? "endTag" : "selfcloseTag";
      return "tag bracket";
    } else if (ch == "=") {
      type = "equals";
      return null;
    } else if (ch == "<") {
      state.tokenize = inText;
      state.state = baseState;
      state.tagName = state.tagStart = null;
      var next = state.tokenize(stream, state);
      return next ? next + " tag error" : "tag error";
    } else if (/[\'\"]/.test(ch)) {
      state.tokenize = inAttribute(ch);
      state.stringStartCol = stream.column();
      return state.tokenize(stream, state);
    } else {
      stream.match(/^[^\s\u00a0=<>\"\']*[^\s\u00a0=<>\"\'\/]/);
      return "word";
    }
  }

  function inAttribute(quote) {
    var closure = function(stream, state) {
      while (!stream.eol()) {
        if (stream.next() == quote) {
          state.tokenize = inTag;
          break;
        }
      }
      return "string";
    };
    closure.isInAttribute = true;
    return closure;
  }

  function inBlock(style, terminator) {
    return function(stream, state) {
      while (!stream.eol()) {
        if (stream.match(terminator)) {
          state.tokenize = inText;
          break;
        }
        stream.next();
      }
      return style;
    }
  }

  function doctype(depth) {
    return function(stream, state) {
      var ch;
      while ((ch = stream.next()) != null) {
        if (ch == "<") {
          state.tokenize = doctype(depth + 1);
          return state.tokenize(stream, state);
        } else if (ch == ">") {
          if (depth == 1) {
            state.tokenize = inText;
            break;
          } else {
            state.tokenize = doctype(depth - 1);
            return state.tokenize(stream, state);
          }
        }
      }
      return "meta";
    };
  }

  function lower(tagName) {
    return tagName && tagName.toLowerCase();
  }

  function Context(state, tagName, startOfLine) {
    this.prev = state.context;
    this.tagName = tagName || "";
    this.indent = state.indented;
    this.startOfLine = startOfLine;
    if (config.doNotIndent.hasOwnProperty(tagName) || (state.context && state.context.noIndent))
      this.noIndent = true;
  }
  function popContext(state) {
    if (state.context) state.context = state.context.prev;
  }
  function maybePopContext(state, nextTagName) {
    var parentTagName;
    while (true) {
      if (!state.context) {
        return;
      }
      parentTagName = state.context.tagName;
      if (!config.contextGrabbers.hasOwnProperty(lower(parentTagName)) ||
          !config.contextGrabbers[lower(parentTagName)].hasOwnProperty(lower(nextTagName))) {
        return;
      }
      popContext(state);
    }
  }

  function baseState(type, stream, state) {
    if (type == "openTag") {
      state.tagStart = stream.column();
      return tagNameState;
    } else if (type == "closeTag") {
      return closeTagNameState;
    } else {
      return baseState;
    }
  }
  function tagNameState(type, stream, state) {
    if (type == "word") {
      state.tagName = stream.current();
      setStyle = "tag";
      return attrState;
    } else if (config.allowMissingTagName && type == "endTag") {
      setStyle = "tag bracket";
      return attrState(type, stream, state);
    } else {
      setStyle = "error";
      return tagNameState;
    }
  }
  function closeTagNameState(type, stream, state) {
    if (type == "word") {
      var tagName = stream.current();
      if (state.context && state.context.tagName != tagName &&
          config.implicitlyClosed.hasOwnProperty(lower(state.context.tagName)))
        popContext(state);
      if ((state.context && state.context.tagName == tagName) || config.matchClosing === false) {
        setStyle = "tag";
        return closeState;
      } else {
        setStyle = "tag error";
        return closeStateErr;
      }
    } else if (config.allowMissingTagName && type == "endTag") {
      setStyle = "tag bracket";
      return closeState(type, stream, state);
    } else {
      setStyle = "error";
      return closeStateErr;
    }
  }

  function closeState(type, _stream, state) {
    if (type != "endTag") {
      setStyle = "error";
      return closeState;
    }
    popContext(state);
    return baseState;
  }
  function closeStateErr(type, stream, state) {
    setStyle = "error";
    return closeState(type, stream, state);
  }

  function attrState(type, _stream, state) {
    if (type == "word") {
      setStyle = "attribute";
      return attrEqState;
    } else if (type == "endTag" || type == "selfcloseTag") {
      var tagName = state.tagName, tagStart = state.tagStart;
      state.tagName = state.tagStart = null;
      if (type == "selfcloseTag" ||
          config.autoSelfClosers.hasOwnProperty(lower(tagName))) {
        maybePopContext(state, tagName);
      } else {
        maybePopContext(state, tagName);
        state.context = new Context(state, tagName, tagStart == state.indented);
      }
      return baseState;
    }
    setStyle = "error";
    return attrState;
  }
  function attrEqState(type, stream, state) {
    if (type == "equals") return attrValueState;
    if (!config.allowMissing) setStyle = "error";
    return attrState(type, stream, state);
  }
  function attrValueState(type, stream, state) {
    if (type == "string") return attrContinuedState;
    if (type == "word" && config.allowUnquoted) {setStyle = "string"; return attrState;}
    setStyle = "error";
    return attrState(type, stream, state);
  }
  function attrContinuedState(type, stream, state) {
    if (type == "string") return attrContinuedState;
    return attrState(type, stream, state);
  }

  return {
    startState: function(baseIndent) {
      var state = {tokenize: inText,
                   state: baseState,
                   indented: baseIndent || 0,
                   tagName: null, tagStart: null,
                   context: null}
      if (baseIndent != null) state.baseIndent = baseIndent
      return state
    },

    token: function(stream, state) {
      if (!state.tagName && stream.sol())
        state.indented = stream.indentation();

      if (stream.eatSpace()) return null;
      type = null;
      var style = state.tokenize(stream, state);
      if ((style || type) && style != "comment") {
        setStyle = null;
        state.state = state.state(type || style, stream, state);
        if (setStyle)
          style = setStyle == "error" ? style + " error" : setStyle;
      }
      return style;
    },

    indent: function(state, textAfter, fullLine) {
      var context = state.context;
      // Indent multi-line strings (e.g. css).
      if (state.tokenize.isInAttribute) {
        if (state.tagStart == state.indented)
          return state.stringStartCol + 1;
        else
          return state.indented + indentUnit;
      }
      if (context && context.noIndent) return CodeMirror.Pass;
      if (state.tokenize != inTag && state.tokenize != inText)
        return fullLine ? fullLine.match(/^(\s*)/)[0].length : 0;
      // Indent the starts of attribute names.
      if (state.tagName) {
        if (config.multilineTagIndentPastTag !== false)
          return state.tagStart + state.tagName.length + 2;
        else
          return state.tagStart + indentUnit * (config.multilineTagIndentFactor || 1);
      }
      if (config.alignCDATA && /<!\[CDATA\[/.test(textAfter)) return 0;
      var tagAfter = textAfter && /^<(\/)?([\w_:\.-]*)/.exec(textAfter);
      if (tagAfter && tagAfter[1]) { // Closing tag spotted
        while (context) {
          if (context.tagName == tagAfter[2]) {
            context = context.prev;
            break;
          } else if (config.implicitlyClosed.hasOwnProperty(lower(context.tagName))) {
            context = context.prev;
          } else {
            break;
          }
        }
      } else if (tagAfter) { // Opening tag spotted
        while (context) {
          var grabbers = config.contextGrabbers[lower(context.tagName)];
          if (grabbers && grabbers.hasOwnProperty(lower(tagAfter[2])))
            context = context.prev;
          else
            break;
        }
      }
      while (context && context.prev && !context.startOfLine)
        context = context.prev;
      if (context) return context.indent + indentUnit;
      else return state.baseIndent || 0;
    },

    electricInput: /<\/[\s\w:]+>$/,
    blockCommentStart: "<!--",
    blockCommentEnd: "-->",

    configuration: config.htmlMode ? "html" : "xml",
    helperType: config.htmlMode ? "html" : "xml",

    skipAttribute: function(state) {
      if (state.state == attrValueState)
        state.state = attrState
    },

    xmlCurrentTag: function(state) {
      return state.tagName ? {name: state.tagName, close: state.type == "closeTag"} : null
    },

    xmlCurrentContext: function(state) {
      var context = []
      for (var cx = state.context; cx; cx = cx.prev)
        context.push(cx.tagName)
      return context.reverse()
    }
  };
});

CodeMirror.defineMIME("text/xml", "xml");
CodeMirror.defineMIME("application/xml", "xml");
if (!CodeMirror.mimeModes.hasOwnProperty("text/html"))
  CodeMirror.defineMIME("text/html", {name: "xml", htmlMode: true});

});
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("css", function(config, parserConfig) {
  var inline = parserConfig.inline
  if (!parserConfig.propertyKeywords) parserConfig = CodeMirror.resolveMode("text/css");

  var indentUnit = config.indentUnit,
      tokenHooks = parserConfig.tokenHooks,
      documentTypes = parserConfig.documentTypes || {},
      mediaTypes = parserConfig.mediaTypes || {},
      mediaFeatures = parserConfig.mediaFeatures || {},
      mediaValueKeywords = parserConfig.mediaValueKeywords || {},
      propertyKeywords = parserConfig.propertyKeywords || {},
      nonStandardPropertyKeywords = parserConfig.nonStandardPropertyKeywords || {},
      fontProperties = parserConfig.fontProperties || {},
      counterDescriptors = parserConfig.counterDescriptors || {},
      colorKeywords = parserConfig.colorKeywords || {},
      valueKeywords = parserConfig.valueKeywords || {},
      allowNested = parserConfig.allowNested,
      lineComment = parserConfig.lineComment,
      supportsAtComponent = parserConfig.supportsAtComponent === true,
      highlightNonStandardPropertyKeywords = config.highlightNonStandardPropertyKeywords !== false;

  var type, override;
  function ret(style, tp) { type = tp; return style; }

  // Tokenizers

  function tokenBase(stream, state) {
    var ch = stream.next();
    if (tokenHooks[ch]) {
      var result = tokenHooks[ch](stream, state);
      if (result !== false) return result;
    }
    if (ch == "@") {
      stream.eatWhile(/[\w\\\-]/);
      return ret("def", stream.current());
    } else if (ch == "=" || (ch == "~" || ch == "|") && stream.eat("=")) {
      return ret(null, "compare");
    } else if (ch == "\"" || ch == "'") {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    } else if (ch == "#") {
      stream.eatWhile(/[\w\\\-]/);
      return ret("atom", "hash");
    } else if (ch == "!") {
      stream.match(/^\s*\w*/);
      return ret("keyword", "important");
    } else if (/\d/.test(ch) || ch == "." && stream.eat(/\d/)) {
      stream.eatWhile(/[\w.%]/);
      return ret("number", "unit");
    } else if (ch === "-") {
      if (/[\d.]/.test(stream.peek())) {
        stream.eatWhile(/[\w.%]/);
        return ret("number", "unit");
      } else if (stream.match(/^-[\w\\\-]*/)) {
        stream.eatWhile(/[\w\\\-]/);
        if (stream.match(/^\s*:/, false))
          return ret("variable-2", "variable-definition");
        return ret("variable-2", "variable");
      } else if (stream.match(/^\w+-/)) {
        return ret("meta", "meta");
      }
    } else if (/[,+>*\/]/.test(ch)) {
      return ret(null, "select-op");
    } else if (ch == "." && stream.match(/^-?[_a-z][_a-z0-9-]*/i)) {
      return ret("qualifier", "qualifier");
    } else if (/[:;{}\[\]\(\)]/.test(ch)) {
      return ret(null, ch);
    } else if (stream.match(/^[\w-.]+(?=\()/)) {
      if (/^(url(-prefix)?|domain|regexp)$/i.test(stream.current())) {
        state.tokenize = tokenParenthesized;
      }
      return ret("variable callee", "variable");
    } else if (/[\w\\\-]/.test(ch)) {
      stream.eatWhile(/[\w\\\-]/);
      return ret("property", "word");
    } else {
      return ret(null, null);
    }
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, ch;
      while ((ch = stream.next()) != null) {
        if (ch == quote && !escaped) {
          if (quote == ")") stream.backUp(1);
          break;
        }
        escaped = !escaped && ch == "\\";
      }
      if (ch == quote || !escaped && quote != ")") state.tokenize = null;
      return ret("string", "string");
    };
  }

  function tokenParenthesized(stream, state) {
    stream.next(); // Must be '('
    if (!stream.match(/^\s*[\"\')]/, false))
      state.tokenize = tokenString(")");
    else
      state.tokenize = null;
    return ret(null, "(");
  }

  // Context management

  function Context(type, indent, prev) {
    this.type = type;
    this.indent = indent;
    this.prev = prev;
  }

  function pushContext(state, stream, type, indent) {
    state.context = new Context(type, stream.indentation() + (indent === false ? 0 : indentUnit), state.context);
    return type;
  }

  function popContext(state) {
    if (state.context.prev)
      state.context = state.context.prev;
    return state.context.type;
  }

  function pass(type, stream, state) {
    return states[state.context.type](type, stream, state);
  }
  function popAndPass(type, stream, state, n) {
    for (var i = n || 1; i > 0; i--)
      state.context = state.context.prev;
    return pass(type, stream, state);
  }

  // Parser

  function wordAsValue(stream) {
    var word = stream.current().toLowerCase();
    if (valueKeywords.hasOwnProperty(word))
      override = "atom";
    else if (colorKeywords.hasOwnProperty(word))
      override = "keyword";
    else
      override = "variable";
  }

  var states = {};

  states.top = function(type, stream, state) {
    if (type == "{") {
      return pushContext(state, stream, "block");
    } else if (type == "}" && state.context.prev) {
      return popContext(state);
    } else if (supportsAtComponent && /@component/i.test(type)) {
      return pushContext(state, stream, "atComponentBlock");
    } else if (/^@(-moz-)?document$/i.test(type)) {
      return pushContext(state, stream, "documentTypes");
    } else if (/^@(media|supports|(-moz-)?document|import)$/i.test(type)) {
      return pushContext(state, stream, "atBlock");
    } else if (/^@(font-face|counter-style)/i.test(type)) {
      state.stateArg = type;
      return "restricted_atBlock_before";
    } else if (/^@(-(moz|ms|o|webkit)-)?keyframes$/i.test(type)) {
      return "keyframes";
    } else if (type && type.charAt(0) == "@") {
      return pushContext(state, stream, "at");
    } else if (type == "hash") {
      override = "builtin";
    } else if (type == "word") {
      override = "tag";
    } else if (type == "variable-definition") {
      return "maybeprop";
    } else if (type == "interpolation") {
      return pushContext(state, stream, "interpolation");
    } else if (type == ":") {
      return "pseudo";
    } else if (allowNested && type == "(") {
      return pushContext(state, stream, "parens");
    }
    return state.context.type;
  };

  states.block = function(type, stream, state) {
    if (type == "word") {
      var word = stream.current().toLowerCase();
      if (propertyKeywords.hasOwnProperty(word)) {
        override = "property";
        return "maybeprop";
      } else if (nonStandardPropertyKeywords.hasOwnProperty(word)) {
        override = highlightNonStandardPropertyKeywords ? "string-2" : "property";
        return "maybeprop";
      } else if (allowNested) {
        override = stream.match(/^\s*:(?:\s|$)/, false) ? "property" : "tag";
        return "block";
      } else {
        override += " error";
        return "maybeprop";
      }
    } else if (type == "meta") {
      return "block";
    } else if (!allowNested && (type == "hash" || type == "qualifier")) {
      override = "error";
      return "block";
    } else {
      return states.top(type, stream, state);
    }
  };

  states.maybeprop = function(type, stream, state) {
    if (type == ":") return pushContext(state, stream, "prop");
    return pass(type, stream, state);
  };

  states.prop = function(type, stream, state) {
    if (type == ";") return popContext(state);
    if (type == "{" && allowNested) return pushContext(state, stream, "propBlock");
    if (type == "}" || type == "{") return popAndPass(type, stream, state);
    if (type == "(") return pushContext(state, stream, "parens");

    if (type == "hash" && !/^#([0-9a-fA-f]{3,4}|[0-9a-fA-f]{6}|[0-9a-fA-f]{8})$/.test(stream.current())) {
      override += " error";
    } else if (type == "word") {
      wordAsValue(stream);
    } else if (type == "interpolation") {
      return pushContext(state, stream, "interpolation");
    }
    return "prop";
  };

  states.propBlock = function(type, _stream, state) {
    if (type == "}") return popContext(state);
    if (type == "word") { override = "property"; return "maybeprop"; }
    return state.context.type;
  };

  states.parens = function(type, stream, state) {
    if (type == "{" || type == "}") return popAndPass(type, stream, state);
    if (type == ")") return popContext(state);
    if (type == "(") return pushContext(state, stream, "parens");
    if (type == "interpolation") return pushContext(state, stream, "interpolation");
    if (type == "word") wordAsValue(stream);
    return "parens";
  };

  states.pseudo = function(type, stream, state) {
    if (type == "meta") return "pseudo";

    if (type == "word") {
      override = "variable-3";
      return state.context.type;
    }
    return pass(type, stream, state);
  };

  states.documentTypes = function(type, stream, state) {
    if (type == "word" && documentTypes.hasOwnProperty(stream.current())) {
      override = "tag";
      return state.context.type;
    } else {
      return states.atBlock(type, stream, state);
    }
  };

  states.atBlock = function(type, stream, state) {
    if (type == "(") return pushContext(state, stream, "atBlock_parens");
    if (type == "}" || type == ";") return popAndPass(type, stream, state);
    if (type == "{") return popContext(state) && pushContext(state, stream, allowNested ? "block" : "top");

    if (type == "interpolation") return pushContext(state, stream, "interpolation");

    if (type == "word") {
      var word = stream.current().toLowerCase();
      if (word == "only" || word == "not" || word == "and" || word == "or")
        override = "keyword";
      else if (mediaTypes.hasOwnProperty(word))
        override = "attribute";
      else if (mediaFeatures.hasOwnProperty(word))
        override = "property";
      else if (mediaValueKeywords.hasOwnProperty(word))
        override = "keyword";
      else if (propertyKeywords.hasOwnProperty(word))
        override = "property";
      else if (nonStandardPropertyKeywords.hasOwnProperty(word))
        override = highlightNonStandardPropertyKeywords ? "string-2" : "property";
      else if (valueKeywords.hasOwnProperty(word))
        override = "atom";
      else if (colorKeywords.hasOwnProperty(word))
        override = "keyword";
      else
        override = "error";
    }
    return state.context.type;
  };

  states.atComponentBlock = function(type, stream, state) {
    if (type == "}")
      return popAndPass(type, stream, state);
    if (type == "{")
      return popContext(state) && pushContext(state, stream, allowNested ? "block" : "top", false);
    if (type == "word")
      override = "error";
    return state.context.type;
  };

  states.atBlock_parens = function(type, stream, state) {
    if (type == ")") return popContext(state);
    if (type == "{" || type == "}") return popAndPass(type, stream, state, 2);
    return states.atBlock(type, stream, state);
  };

  states.restricted_atBlock_before = function(type, stream, state) {
    if (type == "{")
      return pushContext(state, stream, "restricted_atBlock");
    if (type == "word" && state.stateArg == "@counter-style") {
      override = "variable";
      return "restricted_atBlock_before";
    }
    return pass(type, stream, state);
  };

  states.restricted_atBlock = function(type, stream, state) {
    if (type == "}") {
      state.stateArg = null;
      return popContext(state);
    }
    if (type == "word") {
      if ((state.stateArg == "@font-face" && !fontProperties.hasOwnProperty(stream.current().toLowerCase())) ||
          (state.stateArg == "@counter-style" && !counterDescriptors.hasOwnProperty(stream.current().toLowerCase())))
        override = "error";
      else
        override = "property";
      return "maybeprop";
    }
    return "restricted_atBlock";
  };

  states.keyframes = function(type, stream, state) {
    if (type == "word") { override = "variable"; return "keyframes"; }
    if (type == "{") return pushContext(state, stream, "top");
    return pass(type, stream, state);
  };

  states.at = function(type, stream, state) {
    if (type == ";") return popContext(state);
    if (type == "{" || type == "}") return popAndPass(type, stream, state);
    if (type == "word") override = "tag";
    else if (type == "hash") override = "builtin";
    return "at";
  };

  states.interpolation = function(type, stream, state) {
    if (type == "}") return popContext(state);
    if (type == "{" || type == ";") return popAndPass(type, stream, state);
    if (type == "word") override = "variable";
    else if (type != "variable" && type != "(" && type != ")") override = "error";
    return "interpolation";
  };

  return {
    startState: function(base) {
      return {tokenize: null,
              state: inline ? "block" : "top",
              stateArg: null,
              context: new Context(inline ? "block" : "top", base || 0, null)};
    },

    token: function(stream, state) {
      if (!state.tokenize && stream.eatSpace()) return null;
      var style = (state.tokenize || tokenBase)(stream, state);
      if (style && typeof style == "object") {
        type = style[1];
        style = style[0];
      }
      override = style;
      if (type != "comment")
        state.state = states[state.state](type, stream, state);
      return override;
    },

    indent: function(state, textAfter) {
      var cx = state.context, ch = textAfter && textAfter.charAt(0);
      var indent = cx.indent;
      if (cx.type == "prop" && (ch == "}" || ch == ")")) cx = cx.prev;
      if (cx.prev) {
        if (ch == "}" && (cx.type == "block" || cx.type == "top" ||
                          cx.type == "interpolation" || cx.type == "restricted_atBlock")) {
          // Resume indentation from parent context.
          cx = cx.prev;
          indent = cx.indent;
        } else if (ch == ")" && (cx.type == "parens" || cx.type == "atBlock_parens") ||
            ch == "{" && (cx.type == "at" || cx.type == "atBlock")) {
          // Dedent relative to current context.
          indent = Math.max(0, cx.indent - indentUnit);
        }
      }
      return indent;
    },

    electricChars: "}",
    blockCommentStart: "/*",
    blockCommentEnd: "*/",
    blockCommentContinue: " * ",
    lineComment: lineComment,
    fold: "brace"
  };
});

  function keySet(array) {
    var keys = {};
    for (var i = 0; i < array.length; ++i) {
      keys[array[i].toLowerCase()] = true;
    }
    return keys;
  }

  var documentTypes_ = [
    "domain", "regexp", "url", "url-prefix"
  ], documentTypes = keySet(documentTypes_);

  var mediaTypes_ = [
    "all", "aural", "braille", "handheld", "print", "projection", "screen",
    "tty", "tv", "embossed"
  ], mediaTypes = keySet(mediaTypes_);

  var mediaFeatures_ = [
    "width", "min-width", "max-width", "height", "min-height", "max-height",
    "device-width", "min-device-width", "max-device-width", "device-height",
    "min-device-height", "max-device-height", "aspect-ratio",
    "min-aspect-ratio", "max-aspect-ratio", "device-aspect-ratio",
    "min-device-aspect-ratio", "max-device-aspect-ratio", "color", "min-color",
    "max-color", "color-index", "min-color-index", "max-color-index",
    "monochrome", "min-monochrome", "max-monochrome", "resolution",
    "min-resolution", "max-resolution", "scan", "grid", "orientation",
    "device-pixel-ratio", "min-device-pixel-ratio", "max-device-pixel-ratio",
    "pointer", "any-pointer", "hover", "any-hover", "prefers-color-scheme"
  ], mediaFeatures = keySet(mediaFeatures_);

  var mediaValueKeywords_ = [
    "landscape", "portrait", "none", "coarse", "fine", "on-demand", "hover",
    "interlace", "progressive",
    "dark", "light"
  ], mediaValueKeywords = keySet(mediaValueKeywords_);

  var propertyKeywords_ = [
    "align-content", "align-items", "align-self", "alignment-adjust",
    "alignment-baseline", "all", "anchor-point", "animation", "animation-delay",
    "animation-direction", "animation-duration", "animation-fill-mode",
    "animation-iteration-count", "animation-name", "animation-play-state",
    "animation-timing-function", "appearance", "azimuth", "backdrop-filter",
    "backface-visibility", "background", "background-attachment",
    "background-blend-mode", "background-clip", "background-color",
    "background-image", "background-origin", "background-position",
    "background-position-x", "background-position-y", "background-repeat",
    "background-size", "baseline-shift", "binding", "bleed", "block-size",
    "bookmark-label", "bookmark-level", "bookmark-state", "bookmark-target",
    "border", "border-bottom", "border-bottom-color", "border-bottom-left-radius",
    "border-bottom-right-radius", "border-bottom-style", "border-bottom-width",
    "border-collapse", "border-color", "border-image", "border-image-outset",
    "border-image-repeat", "border-image-slice", "border-image-source",
    "border-image-width", "border-left", "border-left-color", "border-left-style",
    "border-left-width", "border-radius", "border-right", "border-right-color",
    "border-right-style", "border-right-width", "border-spacing", "border-style",
    "border-top", "border-top-color", "border-top-left-radius",
    "border-top-right-radius", "border-top-style", "border-top-width",
    "border-width", "bottom", "box-decoration-break", "box-shadow", "box-sizing",
    "break-after", "break-before", "break-inside", "caption-side", "caret-color",
    "clear", "clip", "color", "color-profile", "column-count", "column-fill",
    "column-gap", "column-rule", "column-rule-color", "column-rule-style",
    "column-rule-width", "column-span", "column-width", "columns", "contain",
    "content", "counter-increment", "counter-reset", "crop", "cue", "cue-after",
    "cue-before", "cursor", "direction", "display", "dominant-baseline",
    "drop-initial-after-adjust", "drop-initial-after-align",
    "drop-initial-before-adjust", "drop-initial-before-align", "drop-initial-size",
    "drop-initial-value", "elevation", "empty-cells", "fit", "fit-content", "fit-position",
    "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow",
    "flex-shrink", "flex-wrap", "float", "float-offset", "flow-from", "flow-into",
    "font", "font-family", "font-feature-settings", "font-kerning",
    "font-language-override", "font-optical-sizing", "font-size",
    "font-size-adjust", "font-stretch", "font-style", "font-synthesis",
    "font-variant", "font-variant-alternates", "font-variant-caps",
    "font-variant-east-asian", "font-variant-ligatures", "font-variant-numeric",
    "font-variant-position", "font-variation-settings", "font-weight", "gap",
    "grid", "grid-area", "grid-auto-columns", "grid-auto-flow", "grid-auto-rows",
    "grid-column", "grid-column-end", "grid-column-gap", "grid-column-start",
    "grid-gap", "grid-row", "grid-row-end", "grid-row-gap", "grid-row-start",
    "grid-template", "grid-template-areas", "grid-template-columns",
    "grid-template-rows", "hanging-punctuation", "height", "hyphens", "icon",
    "image-orientation", "image-rendering", "image-resolution", "inline-box-align",
    "inset", "inset-block", "inset-block-end", "inset-block-start", "inset-inline",
    "inset-inline-end", "inset-inline-start", "isolation", "justify-content",
    "justify-items", "justify-self", "left", "letter-spacing", "line-break",
    "line-height", "line-height-step", "line-stacking", "line-stacking-ruby",
    "line-stacking-shift", "line-stacking-strategy", "list-style",
    "list-style-image", "list-style-position", "list-style-type", "margin",
    "margin-bottom", "margin-left", "margin-right", "margin-top", "marks",
    "marquee-direction", "marquee-loop", "marquee-play-count", "marquee-speed",
    "marquee-style", "mask-clip", "mask-composite", "mask-image", "mask-mode",
    "mask-origin", "mask-position", "mask-repeat", "mask-size","mask-type",
    "max-block-size", "max-height", "max-inline-size",
    "max-width", "min-block-size", "min-height", "min-inline-size", "min-width",
    "mix-blend-mode", "move-to", "nav-down", "nav-index", "nav-left", "nav-right",
    "nav-up", "object-fit", "object-position", "offset", "offset-anchor",
    "offset-distance", "offset-path", "offset-position", "offset-rotate",
    "opacity", "order", "orphans", "outline", "outline-color", "outline-offset",
    "outline-style", "outline-width", "overflow", "overflow-style",
    "overflow-wrap", "overflow-x", "overflow-y", "padding", "padding-bottom",
    "padding-left", "padding-right", "padding-top", "page", "page-break-after",
    "page-break-before", "page-break-inside", "page-policy", "pause",
    "pause-after", "pause-before", "perspective", "perspective-origin", "pitch",
    "pitch-range", "place-content", "place-items", "place-self", "play-during",
    "position", "presentation-level", "punctuation-trim", "quotes",
    "region-break-after", "region-break-before", "region-break-inside",
    "region-fragment", "rendering-intent", "resize", "rest", "rest-after",
    "rest-before", "richness", "right", "rotate", "rotation", "rotation-point",
    "row-gap", "ruby-align", "ruby-overhang", "ruby-position", "ruby-span",
    "scale", "scroll-behavior", "scroll-margin", "scroll-margin-block",
    "scroll-margin-block-end", "scroll-margin-block-start", "scroll-margin-bottom",
    "scroll-margin-inline", "scroll-margin-inline-end",
    "scroll-margin-inline-start", "scroll-margin-left", "scroll-margin-right",
    "scroll-margin-top", "scroll-padding", "scroll-padding-block",
    "scroll-padding-block-end", "scroll-padding-block-start",
    "scroll-padding-bottom", "scroll-padding-inline", "scroll-padding-inline-end",
    "scroll-padding-inline-start", "scroll-padding-left", "scroll-padding-right",
    "scroll-padding-top", "scroll-snap-align", "scroll-snap-type",
    "shape-image-threshold", "shape-inside", "shape-margin", "shape-outside",
    "size", "speak", "speak-as", "speak-header", "speak-numeral",
    "speak-punctuation", "speech-rate", "stress", "string-set", "tab-size",
    "table-layout", "target", "target-name", "target-new", "target-position",
    "text-align", "text-align-last", "text-combine-upright", "text-decoration",
    "text-decoration-color", "text-decoration-line", "text-decoration-skip",
    "text-decoration-skip-ink", "text-decoration-style", "text-emphasis",
    "text-emphasis-color", "text-emphasis-position", "text-emphasis-style",
    "text-height", "text-indent", "text-justify", "text-orientation",
    "text-outline", "text-overflow", "text-rendering", "text-shadow",
    "text-size-adjust", "text-space-collapse", "text-transform",
    "text-underline-position", "text-wrap", "top", "touch-action", "transform", "transform-origin",
    "transform-style", "transition", "transition-delay", "transition-duration",
    "transition-property", "transition-timing-function", "translate",
    "unicode-bidi", "user-select", "vertical-align", "visibility", "voice-balance",
    "voice-duration", "voice-family", "voice-pitch", "voice-range", "voice-rate",
    "voice-stress", "voice-volume", "volume", "white-space", "widows", "width",
    "will-change", "word-break", "word-spacing", "word-wrap", "writing-mode", "z-index",
    // SVG-specific
    "clip-path", "clip-rule", "mask", "enable-background", "filter", "flood-color",
    "flood-opacity", "lighting-color", "stop-color", "stop-opacity", "pointer-events",
    "color-interpolation", "color-interpolation-filters",
    "color-rendering", "fill", "fill-opacity", "fill-rule", "image-rendering",
    "marker", "marker-end", "marker-mid", "marker-start", "paint-order", "shape-rendering", "stroke",
    "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin",
    "stroke-miterlimit", "stroke-opacity", "stroke-width", "text-rendering",
    "baseline-shift", "dominant-baseline", "glyph-orientation-horizontal",
    "glyph-orientation-vertical", "text-anchor", "writing-mode",
  ], propertyKeywords = keySet(propertyKeywords_);

  var nonStandardPropertyKeywords_ = [
    "accent-color", "aspect-ratio", "border-block", "border-block-color", "border-block-end",
    "border-block-end-color", "border-block-end-style", "border-block-end-width",
    "border-block-start", "border-block-start-color", "border-block-start-style",
    "border-block-start-width", "border-block-style", "border-block-width",
    "border-inline", "border-inline-color", "border-inline-end",
    "border-inline-end-color", "border-inline-end-style",
    "border-inline-end-width", "border-inline-start", "border-inline-start-color",
    "border-inline-start-style", "border-inline-start-width",
    "border-inline-style", "border-inline-width", "content-visibility", "margin-block",
    "margin-block-end", "margin-block-start", "margin-inline", "margin-inline-end",
    "margin-inline-start", "overflow-anchor", "overscroll-behavior", "padding-block", "padding-block-end",
    "padding-block-start", "padding-inline", "padding-inline-end",
    "padding-inline-start", "scroll-snap-stop", "scrollbar-3d-light-color",
    "scrollbar-arrow-color", "scrollbar-base-color", "scrollbar-dark-shadow-color",
    "scrollbar-face-color", "scrollbar-highlight-color", "scrollbar-shadow-color",
    "scrollbar-track-color", "searchfield-cancel-button", "searchfield-decoration",
    "searchfield-results-button", "searchfield-results-decoration", "shape-inside", "zoom"
  ], nonStandardPropertyKeywords = keySet(nonStandardPropertyKeywords_);

  var fontProperties_ = [
    "font-display", "font-family", "src", "unicode-range", "font-variant",
     "font-feature-settings", "font-stretch", "font-weight", "font-style"
  ], fontProperties = keySet(fontProperties_);

  var counterDescriptors_ = [
    "additive-symbols", "fallback", "negative", "pad", "prefix", "range",
    "speak-as", "suffix", "symbols", "system"
  ], counterDescriptors = keySet(counterDescriptors_);

  var colorKeywords_ = [
    "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige",
    "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
    "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue",
    "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod",
    "darkgray", "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
    "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
    "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise", "darkviolet",
    "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick",
    "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite",
    "gold", "goldenrod", "gray", "grey", "green", "greenyellow", "honeydew",
    "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
    "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
    "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey", "lightpink",
    "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey",
    "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta",
    "maroon", "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple",
    "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise",
    "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
    "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered",
    "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
    "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue",
    "purple", "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown",
    "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver", "skyblue",
    "slateblue", "slategray", "slategrey", "snow", "springgreen", "steelblue", "tan",
    "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white",
    "whitesmoke", "yellow", "yellowgreen"
  ], colorKeywords = keySet(colorKeywords_);

  var valueKeywords_ = [
    "above", "absolute", "activeborder", "additive", "activecaption", "afar",
    "after-white-space", "ahead", "alias", "all", "all-scroll", "alphabetic", "alternate",
    "always", "amharic", "amharic-abegede", "antialiased", "appworkspace",
    "arabic-indic", "armenian", "asterisks", "attr", "auto", "auto-flow", "avoid", "avoid-column", "avoid-page",
    "avoid-region", "axis-pan", "background", "backwards", "baseline", "below", "bidi-override", "binary",
    "bengali", "blink", "block", "block-axis", "blur", "bold", "bolder", "border", "border-box",
    "both", "bottom", "break", "break-all", "break-word", "brightness", "bullets", "button", "button-bevel",
    "buttonface", "buttonhighlight", "buttonshadow", "buttontext", "calc", "cambodian",
    "capitalize", "caps-lock-indicator", "caption", "captiontext", "caret",
    "cell", "center", "checkbox", "circle", "cjk-decimal", "cjk-earthly-branch",
    "cjk-heavenly-stem", "cjk-ideographic", "clear", "clip", "close-quote",
    "col-resize", "collapse", "color", "color-burn", "color-dodge", "column", "column-reverse",
    "compact", "condensed", "contain", "content", "contents",
    "content-box", "context-menu", "continuous", "contrast", "copy", "counter", "counters", "cover", "crop",
    "cross", "crosshair", "cubic-bezier", "currentcolor", "cursive", "cyclic", "darken", "dashed", "decimal",
    "decimal-leading-zero", "default", "default-button", "dense", "destination-atop",
    "destination-in", "destination-out", "destination-over", "devanagari", "difference",
    "disc", "discard", "disclosure-closed", "disclosure-open", "document",
    "dot-dash", "dot-dot-dash",
    "dotted", "double", "down", "drop-shadow", "e-resize", "ease", "ease-in", "ease-in-out", "ease-out",
    "element", "ellipse", "ellipsis", "embed", "end", "ethiopic", "ethiopic-abegede",
    "ethiopic-abegede-am-et", "ethiopic-abegede-gez", "ethiopic-abegede-ti-er",
    "ethiopic-abegede-ti-et", "ethiopic-halehame-aa-er",
    "ethiopic-halehame-aa-et", "ethiopic-halehame-am-et",
    "ethiopic-halehame-gez", "ethiopic-halehame-om-et",
    "ethiopic-halehame-sid-et", "ethiopic-halehame-so-et",
    "ethiopic-halehame-ti-er", "ethiopic-halehame-ti-et", "ethiopic-halehame-tig",
    "ethiopic-numeric", "ew-resize", "exclusion", "expanded", "extends", "extra-condensed",
    "extra-expanded", "fantasy", "fast", "fill", "fill-box", "fixed", "flat", "flex", "flex-end", "flex-start", "footnotes",
    "forwards", "from", "geometricPrecision", "georgian", "grayscale", "graytext", "grid", "groove",
    "gujarati", "gurmukhi", "hand", "hangul", "hangul-consonant", "hard-light", "hebrew",
    "help", "hidden", "hide", "higher", "highlight", "highlighttext",
    "hiragana", "hiragana-iroha", "horizontal", "hsl", "hsla", "hue", "hue-rotate", "icon", "ignore",
    "inactiveborder", "inactivecaption", "inactivecaptiontext", "infinite",
    "infobackground", "infotext", "inherit", "initial", "inline", "inline-axis",
    "inline-block", "inline-flex", "inline-grid", "inline-table", "inset", "inside", "intrinsic", "invert",
    "italic", "japanese-formal", "japanese-informal", "justify", "kannada",
    "katakana", "katakana-iroha", "keep-all", "khmer",
    "korean-hangul-formal", "korean-hanja-formal", "korean-hanja-informal",
    "landscape", "lao", "large", "larger", "left", "level", "lighter", "lighten",
    "line-through", "linear", "linear-gradient", "lines", "list-item", "listbox", "listitem",
    "local", "logical", "loud", "lower", "lower-alpha", "lower-armenian",
    "lower-greek", "lower-hexadecimal", "lower-latin", "lower-norwegian",
    "lower-roman", "lowercase", "ltr", "luminosity", "malayalam", "manipulation", "match", "matrix", "matrix3d",
    "media-controls-background", "media-current-time-display",
    "media-fullscreen-button", "media-mute-button", "media-play-button",
    "media-return-to-realtime-button", "media-rewind-button",
    "media-seek-back-button", "media-seek-forward-button", "media-slider",
    "media-sliderthumb", "media-time-remaining-display", "media-volume-slider",
    "media-volume-slider-container", "media-volume-sliderthumb", "medium",
    "menu", "menulist", "menulist-button", "menulist-text",
    "menulist-textfield", "menutext", "message-box", "middle", "min-intrinsic",
    "mix", "mongolian", "monospace", "move", "multiple", "multiple_mask_images", "multiply", "myanmar", "n-resize",
    "narrower", "ne-resize", "nesw-resize", "no-close-quote", "no-drop",
    "no-open-quote", "no-repeat", "none", "normal", "not-allowed", "nowrap",
    "ns-resize", "numbers", "numeric", "nw-resize", "nwse-resize", "oblique", "octal", "opacity", "open-quote",
    "optimizeLegibility", "optimizeSpeed", "oriya", "oromo", "outset",
    "outside", "outside-shape", "overlay", "overline", "padding", "padding-box",
    "painted", "page", "paused", "persian", "perspective", "pinch-zoom", "plus-darker", "plus-lighter",
    "pointer", "polygon", "portrait", "pre", "pre-line", "pre-wrap", "preserve-3d",
    "progress", "push-button", "radial-gradient", "radio", "read-only",
    "read-write", "read-write-plaintext-only", "rectangle", "region",
    "relative", "repeat", "repeating-linear-gradient",
    "repeating-radial-gradient", "repeat-x", "repeat-y", "reset", "reverse",
    "rgb", "rgba", "ridge", "right", "rotate", "rotate3d", "rotateX", "rotateY",
    "rotateZ", "round", "row", "row-resize", "row-reverse", "rtl", "run-in", "running",
    "s-resize", "sans-serif", "saturate", "saturation", "scale", "scale3d", "scaleX", "scaleY", "scaleZ", "screen",
    "scroll", "scrollbar", "scroll-position", "se-resize", "searchfield",
    "searchfield-cancel-button", "searchfield-decoration",
    "searchfield-results-button", "searchfield-results-decoration", "self-start", "self-end",
    "semi-condensed", "semi-expanded", "separate", "sepia", "serif", "show", "sidama",
    "simp-chinese-formal", "simp-chinese-informal", "single",
    "skew", "skewX", "skewY", "skip-white-space", "slide", "slider-horizontal",
    "slider-vertical", "sliderthumb-horizontal", "sliderthumb-vertical", "slow",
    "small", "small-caps", "small-caption", "smaller", "soft-light", "solid", "somali",
    "source-atop", "source-in", "source-out", "source-over", "space", "space-around", "space-between", "space-evenly", "spell-out", "square",
    "square-button", "start", "static", "status-bar", "stretch", "stroke", "stroke-box", "sub",
    "subpixel-antialiased", "svg_masks", "super", "sw-resize", "symbolic", "symbols", "system-ui", "table",
    "table-caption", "table-cell", "table-column", "table-column-group",
    "table-footer-group", "table-header-group", "table-row", "table-row-group",
    "tamil",
    "telugu", "text", "text-bottom", "text-top", "textarea", "textfield", "thai",
    "thick", "thin", "threeddarkshadow", "threedface", "threedhighlight",
    "threedlightshadow", "threedshadow", "tibetan", "tigre", "tigrinya-er",
    "tigrinya-er-abegede", "tigrinya-et", "tigrinya-et-abegede", "to", "top",
    "trad-chinese-formal", "trad-chinese-informal", "transform",
    "translate", "translate3d", "translateX", "translateY", "translateZ",
    "transparent", "ultra-condensed", "ultra-expanded", "underline", "unidirectional-pan", "unset", "up",
    "upper-alpha", "upper-armenian", "upper-greek", "upper-hexadecimal",
    "upper-latin", "upper-norwegian", "upper-roman", "uppercase", "urdu", "url",
    "var", "vertical", "vertical-text", "view-box", "visible", "visibleFill", "visiblePainted",
    "visibleStroke", "visual", "w-resize", "wait", "wave", "wider",
    "window", "windowframe", "windowtext", "words", "wrap", "wrap-reverse", "x-large", "x-small", "xor",
    "xx-large", "xx-small"
  ], valueKeywords = keySet(valueKeywords_);

  var allWords = documentTypes_.concat(mediaTypes_).concat(mediaFeatures_).concat(mediaValueKeywords_)
    .concat(propertyKeywords_).concat(nonStandardPropertyKeywords_).concat(colorKeywords_)
    .concat(valueKeywords_);
  CodeMirror.registerHelper("hintWords", "css", allWords);

  function tokenCComment(stream, state) {
    var maybeEnd = false, ch;
    while ((ch = stream.next()) != null) {
      if (maybeEnd && ch == "/") {
        state.tokenize = null;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return ["comment", "comment"];
  }

  CodeMirror.defineMIME("text/css", {
    documentTypes: documentTypes,
    mediaTypes: mediaTypes,
    mediaFeatures: mediaFeatures,
    mediaValueKeywords: mediaValueKeywords,
    propertyKeywords: propertyKeywords,
    nonStandardPropertyKeywords: nonStandardPropertyKeywords,
    fontProperties: fontProperties,
    counterDescriptors: counterDescriptors,
    colorKeywords: colorKeywords,
    valueKeywords: valueKeywords,
    tokenHooks: {
      "/": function(stream, state) {
        if (!stream.eat("*")) return false;
        state.tokenize = tokenCComment;
        return tokenCComment(stream, state);
      }
    },
    name: "css"
  });

  CodeMirror.defineMIME("text/x-scss", {
    mediaTypes: mediaTypes,
    mediaFeatures: mediaFeatures,
    mediaValueKeywords: mediaValueKeywords,
    propertyKeywords: propertyKeywords,
    nonStandardPropertyKeywords: nonStandardPropertyKeywords,
    colorKeywords: colorKeywords,
    valueKeywords: valueKeywords,
    fontProperties: fontProperties,
    allowNested: true,
    lineComment: "//",
    tokenHooks: {
      "/": function(stream, state) {
        if (stream.eat("/")) {
          stream.skipToEnd();
          return ["comment", "comment"];
        } else if (stream.eat("*")) {
          state.tokenize = tokenCComment;
          return tokenCComment(stream, state);
        } else {
          return ["operator", "operator"];
        }
      },
      ":": function(stream) {
        if (stream.match(/^\s*\{/, false))
          return [null, null]
        return false;
      },
      "$": function(stream) {
        stream.match(/^[\w-]+/);
        if (stream.match(/^\s*:/, false))
          return ["variable-2", "variable-definition"];
        return ["variable-2", "variable"];
      },
      "#": function(stream) {
        if (!stream.eat("{")) return false;
        return [null, "interpolation"];
      }
    },
    name: "css",
    helperType: "scss"
  });

  CodeMirror.defineMIME("text/x-less", {
    mediaTypes: mediaTypes,
    mediaFeatures: mediaFeatures,
    mediaValueKeywords: mediaValueKeywords,
    propertyKeywords: propertyKeywords,
    nonStandardPropertyKeywords: nonStandardPropertyKeywords,
    colorKeywords: colorKeywords,
    valueKeywords: valueKeywords,
    fontProperties: fontProperties,
    allowNested: true,
    lineComment: "//",
    tokenHooks: {
      "/": function(stream, state) {
        if (stream.eat("/")) {
          stream.skipToEnd();
          return ["comment", "comment"];
        } else if (stream.eat("*")) {
          state.tokenize = tokenCComment;
          return tokenCComment(stream, state);
        } else {
          return ["operator", "operator"];
        }
      },
      "@": function(stream) {
        if (stream.eat("{")) return [null, "interpolation"];
        if (stream.match(/^(charset|document|font-face|import|(-(moz|ms|o|webkit)-)?keyframes|media|namespace|page|supports)\b/i, false)) return false;
        stream.eatWhile(/[\w\\\-]/);
        if (stream.match(/^\s*:/, false))
          return ["variable-2", "variable-definition"];
        return ["variable-2", "variable"];
      },
      "&": function() {
        return ["atom", "atom"];
      }
    },
    name: "css",
    helperType: "less"
  });

  CodeMirror.defineMIME("text/x-gss", {
    documentTypes: documentTypes,
    mediaTypes: mediaTypes,
    mediaFeatures: mediaFeatures,
    propertyKeywords: propertyKeywords,
    nonStandardPropertyKeywords: nonStandardPropertyKeywords,
    fontProperties: fontProperties,
    counterDescriptors: counterDescriptors,
    colorKeywords: colorKeywords,
    valueKeywords: valueKeywords,
    supportsAtComponent: true,
    tokenHooks: {
      "/": function(stream, state) {
        if (!stream.eat("*")) return false;
        state.tokenize = tokenCComment;
        return tokenCComment(stream, state);
      }
    },
    name: "css",
    helperType: "gss"
  });

});
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("javascript", function(config, parserConfig) {
  var indentUnit = config.indentUnit;
  var statementIndent = parserConfig.statementIndent;
  var jsonldMode = parserConfig.jsonld;
  var jsonMode = parserConfig.json || jsonldMode;
  var trackScope = parserConfig.trackScope !== false
  var isTS = parserConfig.typescript;
  var wordRE = parserConfig.wordCharacters || /[\w$\xa1-\uffff]/;

  // Tokenizer

  var keywords = function(){
    function kw(type) {return {type: type, style: "keyword"};}
    var A = kw("keyword a"), B = kw("keyword b"), C = kw("keyword c"), D = kw("keyword d");
    var operator = kw("operator"), atom = {type: "atom", style: "atom"};

    return {
      "if": kw("if"), "while": A, "with": A, "else": B, "do": B, "try": B, "finally": B,
      "return": D, "break": D, "continue": D, "new": kw("new"), "delete": C, "void": C, "throw": C,
      "debugger": kw("debugger"), "var": kw("var"), "const": kw("var"), "let": kw("var"),
      "function": kw("function"), "catch": kw("catch"),
      "for": kw("for"), "switch": kw("switch"), "case": kw("case"), "default": kw("default"),
      "in": operator, "typeof": operator, "instanceof": operator,
      "true": atom, "false": atom, "null": atom, "undefined": atom, "NaN": atom, "Infinity": atom,
      "this": kw("this"), "class": kw("class"), "super": kw("atom"),
      "yield": C, "export": kw("export"), "import": kw("import"), "extends": C,
      "await": C
    };
  }();

  var isOperatorChar = /[+\-*&%=<>!?|~^@]/;
  var isJsonldKeyword = /^@(context|id|value|language|type|container|list|set|reverse|index|base|vocab|graph)"/;

  function readRegexp(stream) {
    var escaped = false, next, inSet = false;
    while ((next = stream.next()) != null) {
      if (!escaped) {
        if (next == "/" && !inSet) return;
        if (next == "[") inSet = true;
        else if (inSet && next == "]") inSet = false;
      }
      escaped = !escaped && next == "\\";
    }
  }

  // Used as scratch variables to communicate multiple values without
  // consing up tons of objects.
  var type, content;
  function ret(tp, style, cont) {
    type = tp; content = cont;
    return style;
  }
  function tokenBase(stream, state) {
    var ch = stream.next();
    if (ch == '"' || ch == "'") {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    } else if (ch == "." && stream.match(/^\d[\d_]*(?:[eE][+\-]?[\d_]+)?/)) {
      return ret("number", "number");
    } else if (ch == "." && stream.match("..")) {
      return ret("spread", "meta");
    } else if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
      return ret(ch);
    } else if (ch == "=" && stream.eat(">")) {
      return ret("=>", "operator");
    } else if (ch == "0" && stream.match(/^(?:x[\dA-Fa-f_]+|o[0-7_]+|b[01_]+)n?/)) {
      return ret("number", "number");
    } else if (/\d/.test(ch)) {
      stream.match(/^[\d_]*(?:n|(?:\.[\d_]*)?(?:[eE][+\-]?[\d_]+)?)?/);
      return ret("number", "number");
    } else if (ch == "/") {
      if (stream.eat("*")) {
        state.tokenize = tokenComment;
        return tokenComment(stream, state);
      } else if (stream.eat("/")) {
        stream.skipToEnd();
        return ret("comment", "comment");
      } else if (expressionAllowed(stream, state, 1)) {
        readRegexp(stream);
        stream.match(/^\b(([gimyus])(?![gimyus]*\2))+\b/);
        return ret("regexp", "string-2");
      } else {
        stream.eat("=");
        return ret("operator", "operator", stream.current());
      }
    } else if (ch == "`") {
      state.tokenize = tokenQuasi;
      return tokenQuasi(stream, state);
    } else if (ch == "#" && stream.peek() == "!") {
      stream.skipToEnd();
      return ret("meta", "meta");
    } else if (ch == "#" && stream.eatWhile(wordRE)) {
      return ret("variable", "property")
    } else if (ch == "<" && stream.match("!--") ||
               (ch == "-" && stream.match("->") && !/\S/.test(stream.string.slice(0, stream.start)))) {
      stream.skipToEnd()
      return ret("comment", "comment")
    } else if (isOperatorChar.test(ch)) {
      if (ch != ">" || !state.lexical || state.lexical.type != ">") {
        if (stream.eat("=")) {
          if (ch == "!" || ch == "=") stream.eat("=")
        } else if (/[<>*+\-|&?]/.test(ch)) {
          stream.eat(ch)
          if (ch == ">") stream.eat(ch)
        }
      }
      if (ch == "?" && stream.eat(".")) return ret(".")
      return ret("operator", "operator", stream.current());
    } else if (wordRE.test(ch)) {
      stream.eatWhile(wordRE);
      var word = stream.current()
      if (state.lastType != ".") {
        if (keywords.propertyIsEnumerable(word)) {
          var kw = keywords[word]
          return ret(kw.type, kw.style, word)
        }
        if (word == "async" && stream.match(/^(\s|\/\*([^*]|\*(?!\/))*?\*\/)*[\[\(\w]/, false))
          return ret("async", "keyword", word)
      }
      return ret("variable", "variable", word)
    }
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next;
      if (jsonldMode && stream.peek() == "@" && stream.match(isJsonldKeyword)){
        state.tokenize = tokenBase;
        return ret("jsonld-keyword", "meta");
      }
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) break;
        escaped = !escaped && next == "\\";
      }
      if (!escaped) state.tokenize = tokenBase;
      return ret("string", "string");
    };
  }

  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (ch == "/" && maybeEnd) {
        state.tokenize = tokenBase;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return ret("comment", "comment");
  }

  function tokenQuasi(stream, state) {
    var escaped = false, next;
    while ((next = stream.next()) != null) {
      if (!escaped && (next == "`" || next == "$" && stream.eat("{"))) {
        state.tokenize = tokenBase;
        break;
      }
      escaped = !escaped && next == "\\";
    }
    return ret("quasi", "string-2", stream.current());
  }

  var brackets = "([{}])";
  // This is a crude lookahead trick to try and notice that we're
  // parsing the argument patterns for a fat-arrow function before we
  // actually hit the arrow token. It only works if the arrow is on
  // the same line as the arguments and there's no strange noise
  // (comments) in between. Fallback is to only notice when we hit the
  // arrow, and not declare the arguments as locals for the arrow
  // body.
  function findFatArrow(stream, state) {
    if (state.fatArrowAt) state.fatArrowAt = null;
    var arrow = stream.string.indexOf("=>", stream.start);
    if (arrow < 0) return;

    if (isTS) { // Try to skip TypeScript return type declarations after the arguments
      var m = /:\s*(?:\w+(?:<[^>]*>|\[\])?|\{[^}]*\})\s*$/.exec(stream.string.slice(stream.start, arrow))
      if (m) arrow = m.index
    }

    var depth = 0, sawSomething = false;
    for (var pos = arrow - 1; pos >= 0; --pos) {
      var ch = stream.string.charAt(pos);
      var bracket = brackets.indexOf(ch);
      if (bracket >= 0 && bracket < 3) {
        if (!depth) { ++pos; break; }
        if (--depth == 0) { if (ch == "(") sawSomething = true; break; }
      } else if (bracket >= 3 && bracket < 6) {
        ++depth;
      } else if (wordRE.test(ch)) {
        sawSomething = true;
      } else if (/["'\/`]/.test(ch)) {
        for (;; --pos) {
          if (pos == 0) return
          var next = stream.string.charAt(pos - 1)
          if (next == ch && stream.string.charAt(pos - 2) != "\\") { pos--; break }
        }
      } else if (sawSomething && !depth) {
        ++pos;
        break;
      }
    }
    if (sawSomething && !depth) state.fatArrowAt = pos;
  }

  // Parser

  var atomicTypes = {"atom": true, "number": true, "variable": true, "string": true,
                     "regexp": true, "this": true, "import": true, "jsonld-keyword": true};

  function JSLexical(indented, column, type, align, prev, info) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.prev = prev;
    this.info = info;
    if (align != null) this.align = align;
  }

  function inScope(state, varname) {
    if (!trackScope) return false
    for (var v = state.localVars; v; v = v.next)
      if (v.name == varname) return true;
    for (var cx = state.context; cx; cx = cx.prev) {
      for (var v = cx.vars; v; v = v.next)
        if (v.name == varname) return true;
    }
  }

  function parseJS(state, style, type, content, stream) {
    var cc = state.cc;
    // Communicate our context to the combinators.
    // (Less wasteful than consing up a hundred closures on every call.)
    cx.state = state; cx.stream = stream; cx.marked = null, cx.cc = cc; cx.style = style;

    if (!state.lexical.hasOwnProperty("align"))
      state.lexical.align = true;

    while(true) {
      var combinator = cc.length ? cc.pop() : jsonMode ? expression : statement;
      if (combinator(type, content)) {
        while(cc.length && cc[cc.length - 1].lex)
          cc.pop()();
        if (cx.marked) return cx.marked;
        if (type == "variable" && inScope(state, content)) return "variable-2";
        return style;
      }
    }
  }

  // Combinator utils

  var cx = {state: null, column: null, marked: null, cc: null};
  function pass() {
    for (var i = arguments.length - 1; i >= 0; i--) cx.cc.push(arguments[i]);
  }
  function cont() {
    pass.apply(null, arguments);
    return true;
  }
  function inList(name, list) {
    for (var v = list; v; v = v.next) if (v.name == name) return true
    return false;
  }
  function register(varname) {
    var state = cx.state;
    cx.marked = "def";
    if (!trackScope) return
    if (state.context) {
      if (state.lexical.info == "var" && state.context && state.context.block) {
        // FIXME function decls are also not block scoped
        var newContext = registerVarScoped(varname, state.context)
        if (newContext != null) {
          state.context = newContext
          return
        }
      } else if (!inList(varname, state.localVars)) {
        state.localVars = new Var(varname, state.localVars)
        return
      }
    }
    // Fall through means this is global
    if (parserConfig.globalVars && !inList(varname, state.globalVars))
      state.globalVars = new Var(varname, state.globalVars)
  }
  function registerVarScoped(varname, context) {
    if (!context) {
      return null
    } else if (context.block) {
      var inner = registerVarScoped(varname, context.prev)
      if (!inner) return null
      if (inner == context.prev) return context
      return new Context(inner, context.vars, true)
    } else if (inList(varname, context.vars)) {
      return context
    } else {
      return new Context(context.prev, new Var(varname, context.vars), false)
    }
  }

  function isModifier(name) {
    return name == "public" || name == "private" || name == "protected" || name == "abstract" || name == "readonly"
  }

  // Combinators

  function Context(prev, vars, block) { this.prev = prev; this.vars = vars; this.block = block }
  function Var(name, next) { this.name = name; this.next = next }

  var defaultVars = new Var("this", new Var("arguments", null))
  function pushcontext() {
    cx.state.context = new Context(cx.state.context, cx.state.localVars, false)
    cx.state.localVars = defaultVars
  }
  function pushblockcontext() {
    cx.state.context = new Context(cx.state.context, cx.state.localVars, true)
    cx.state.localVars = null
  }
  function popcontext() {
    cx.state.localVars = cx.state.context.vars
    cx.state.context = cx.state.context.prev
  }
  popcontext.lex = true
  function pushlex(type, info) {
    var result = function() {
      var state = cx.state, indent = state.indented;
      if (state.lexical.type == "stat") indent = state.lexical.indented;
      else for (var outer = state.lexical; outer && outer.type == ")" && outer.align; outer = outer.prev)
        indent = outer.indented;
      state.lexical = new JSLexical(indent, cx.stream.column(), type, null, state.lexical, info);
    };
    result.lex = true;
    return result;
  }
  function poplex() {
    var state = cx.state;
    if (state.lexical.prev) {
      if (state.lexical.type == ")")
        state.indented = state.lexical.indented;
      state.lexical = state.lexical.prev;
    }
  }
  poplex.lex = true;

  function expect(wanted) {
    function exp(type) {
      if (type == wanted) return cont();
      else if (wanted == ";" || type == "}" || type == ")" || type == "]") return pass();
      else return cont(exp);
    };
    return exp;
  }

  function statement(type, value) {
    if (type == "var") return cont(pushlex("vardef", value), vardef, expect(";"), poplex);
    if (type == "keyword a") return cont(pushlex("form"), parenExpr, statement, poplex);
    if (type == "keyword b") return cont(pushlex("form"), statement, poplex);
    if (type == "keyword d") return cx.stream.match(/^\s*$/, false) ? cont() : cont(pushlex("stat"), maybeexpression, expect(";"), poplex);
    if (type == "debugger") return cont(expect(";"));
    if (type == "{") return cont(pushlex("}"), pushblockcontext, block, poplex, popcontext);
    if (type == ";") return cont();
    if (type == "if") {
      if (cx.state.lexical.info == "else" && cx.state.cc[cx.state.cc.length - 1] == poplex)
        cx.state.cc.pop()();
      return cont(pushlex("form"), parenExpr, statement, poplex, maybeelse);
    }
    if (type == "function") return cont(functiondef);
    if (type == "for") return cont(pushlex("form"), pushblockcontext, forspec, statement, popcontext, poplex);
    if (type == "class" || (isTS && value == "interface")) {
      cx.marked = "keyword"
      return cont(pushlex("form", type == "class" ? type : value), className, poplex)
    }
    if (type == "variable") {
      if (isTS && value == "declare") {
        cx.marked = "keyword"
        return cont(statement)
      } else if (isTS && (value == "module" || value == "enum" || value == "type") && cx.stream.match(/^\s*\w/, false)) {
        cx.marked = "keyword"
        if (value == "enum") return cont(enumdef);
        else if (value == "type") return cont(typename, expect("operator"), typeexpr, expect(";"));
        else return cont(pushlex("form"), pattern, expect("{"), pushlex("}"), block, poplex, poplex)
      } else if (isTS && value == "namespace") {
        cx.marked = "keyword"
        return cont(pushlex("form"), expression, statement, poplex)
      } else if (isTS && value == "abstract") {
        cx.marked = "keyword"
        return cont(statement)
      } else {
        return cont(pushlex("stat"), maybelabel);
      }
    }
    if (type == "switch") return cont(pushlex("form"), parenExpr, expect("{"), pushlex("}", "switch"), pushblockcontext,
                                      block, poplex, poplex, popcontext);
    if (type == "case") return cont(expression, expect(":"));
    if (type == "default") return cont(expect(":"));
    if (type == "catch") return cont(pushlex("form"), pushcontext, maybeCatchBinding, statement, poplex, popcontext);
    if (type == "export") return cont(pushlex("stat"), afterExport, poplex);
    if (type == "import") return cont(pushlex("stat"), afterImport, poplex);
    if (type == "async") return cont(statement)
    if (value == "@") return cont(expression, statement)
    return pass(pushlex("stat"), expression, expect(";"), poplex);
  }
  function maybeCatchBinding(type) {
    if (type == "(") return cont(funarg, expect(")"))
  }
  function expression(type, value) {
    return expressionInner(type, value, false);
  }
  function expressionNoComma(type, value) {
    return expressionInner(type, value, true);
  }
  function parenExpr(type) {
    if (type != "(") return pass()
    return cont(pushlex(")"), maybeexpression, expect(")"), poplex)
  }
  function expressionInner(type, value, noComma) {
    if (cx.state.fatArrowAt == cx.stream.start) {
      var body = noComma ? arrowBodyNoComma : arrowBody;
      if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, expect("=>"), body, popcontext);
      else if (type == "variable") return pass(pushcontext, pattern, expect("=>"), body, popcontext);
    }

    var maybeop = noComma ? maybeoperatorNoComma : maybeoperatorComma;
    if (atomicTypes.hasOwnProperty(type)) return cont(maybeop);
    if (type == "function") return cont(functiondef, maybeop);
    if (type == "class" || (isTS && value == "interface")) { cx.marked = "keyword"; return cont(pushlex("form"), classExpression, poplex); }
    if (type == "keyword c" || type == "async") return cont(noComma ? expressionNoComma : expression);
    if (type == "(") return cont(pushlex(")"), maybeexpression, expect(")"), poplex, maybeop);
    if (type == "operator" || type == "spread") return cont(noComma ? expressionNoComma : expression);
    if (type == "[") return cont(pushlex("]"), arrayLiteral, poplex, maybeop);
    if (type == "{") return contCommasep(objprop, "}", null, maybeop);
    if (type == "quasi") return pass(quasi, maybeop);
    if (type == "new") return cont(maybeTarget(noComma));
    return cont();
  }
  function maybeexpression(type) {
    if (type.match(/[;\}\)\],]/)) return pass();
    return pass(expression);
  }

  function maybeoperatorComma(type, value) {
    if (type == ",") return cont(maybeexpression);
    return maybeoperatorNoComma(type, value, false);
  }
  function maybeoperatorNoComma(type, value, noComma) {
    var me = noComma == false ? maybeoperatorComma : maybeoperatorNoComma;
    var expr = noComma == false ? expression : expressionNoComma;
    if (type == "=>") return cont(pushcontext, noComma ? arrowBodyNoComma : arrowBody, popcontext);
    if (type == "operator") {
      if (/\+\+|--/.test(value) || isTS && value == "!") return cont(me);
      if (isTS && value == "<" && cx.stream.match(/^([^<>]|<[^<>]*>)*>\s*\(/, false))
        return cont(pushlex(">"), commasep(typeexpr, ">"), poplex, me);
      if (value == "?") return cont(expression, expect(":"), expr);
      return cont(expr);
    }
    if (type == "quasi") { return pass(quasi, me); }
    if (type == ";") return;
    if (type == "(") return contCommasep(expressionNoComma, ")", "call", me);
    if (type == ".") return cont(property, me);
    if (type == "[") return cont(pushlex("]"), maybeexpression, expect("]"), poplex, me);
    if (isTS && value == "as") { cx.marked = "keyword"; return cont(typeexpr, me) }
    if (type == "regexp") {
      cx.state.lastType = cx.marked = "operator"
      cx.stream.backUp(cx.stream.pos - cx.stream.start - 1)
      return cont(expr)
    }
  }
  function quasi(type, value) {
    if (type != "quasi") return pass();
    if (value.slice(value.length - 2) != "${") return cont(quasi);
    return cont(maybeexpression, continueQuasi);
  }
  function continueQuasi(type) {
    if (type == "}") {
      cx.marked = "string-2";
      cx.state.tokenize = tokenQuasi;
      return cont(quasi);
    }
  }
  function arrowBody(type) {
    findFatArrow(cx.stream, cx.state);
    return pass(type == "{" ? statement : expression);
  }
  function arrowBodyNoComma(type) {
    findFatArrow(cx.stream, cx.state);
    return pass(type == "{" ? statement : expressionNoComma);
  }
  function maybeTarget(noComma) {
    return function(type) {
      if (type == ".") return cont(noComma ? targetNoComma : target);
      else if (type == "variable" && isTS) return cont(maybeTypeArgs, noComma ? maybeoperatorNoComma : maybeoperatorComma)
      else return pass(noComma ? expressionNoComma : expression);
    };
  }
  function target(_, value) {
    if (value == "target") { cx.marked = "keyword"; return cont(maybeoperatorComma); }
  }
  function targetNoComma(_, value) {
    if (value == "target") { cx.marked = "keyword"; return cont(maybeoperatorNoComma); }
  }
  function maybelabel(type) {
    if (type == ":") return cont(poplex, statement);
    return pass(maybeoperatorComma, expect(";"), poplex);
  }
  function property(type) {
    if (type == "variable") {cx.marked = "property"; return cont();}
  }
  function objprop(type, value) {
    if (type == "async") {
      cx.marked = "property";
      return cont(objprop);
    } else if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property";
      if (value == "get" || value == "set") return cont(getterSetter);
      var m // Work around fat-arrow-detection complication for detecting typescript typed arrow params
      if (isTS && cx.state.fatArrowAt == cx.stream.start && (m = cx.stream.match(/^\s*:\s*/, false)))
        cx.state.fatArrowAt = cx.stream.pos + m[0].length
      return cont(afterprop);
    } else if (type == "number" || type == "string") {
      cx.marked = jsonldMode ? "property" : (cx.style + " property");
      return cont(afterprop);
    } else if (type == "jsonld-keyword") {
      return cont(afterprop);
    } else if (isTS && isModifier(value)) {
      cx.marked = "keyword"
      return cont(objprop)
    } else if (type == "[") {
      return cont(expression, maybetype, expect("]"), afterprop);
    } else if (type == "spread") {
      return cont(expressionNoComma, afterprop);
    } else if (value == "*") {
      cx.marked = "keyword";
      return cont(objprop);
    } else if (type == ":") {
      return pass(afterprop)
    }
  }
  function getterSetter(type) {
    if (type != "variable") return pass(afterprop);
    cx.marked = "property";
    return cont(functiondef);
  }
  function afterprop(type) {
    if (type == ":") return cont(expressionNoComma);
    if (type == "(") return pass(functiondef);
  }
  function commasep(what, end, sep) {
    function proceed(type, value) {
      if (sep ? sep.indexOf(type) > -1 : type == ",") {
        var lex = cx.state.lexical;
        if (lex.info == "call") lex.pos = (lex.pos || 0) + 1;
        return cont(function(type, value) {
          if (type == end || value == end) return pass()
          return pass(what)
        }, proceed);
      }
      if (type == end || value == end) return cont();
      if (sep && sep.indexOf(";") > -1) return pass(what)
      return cont(expect(end));
    }
    return function(type, value) {
      if (type == end || value == end) return cont();
      return pass(what, proceed);
    };
  }
  function contCommasep(what, end, info) {
    for (var i = 3; i < arguments.length; i++)
      cx.cc.push(arguments[i]);
    return cont(pushlex(end, info), commasep(what, end), poplex);
  }
  function block(type) {
    if (type == "}") return cont();
    return pass(statement, block);
  }
  function maybetype(type, value) {
    if (isTS) {
      if (type == ":") return cont(typeexpr);
      if (value == "?") return cont(maybetype);
    }
  }
  function maybetypeOrIn(type, value) {
    if (isTS && (type == ":" || value == "in")) return cont(typeexpr)
  }
  function mayberettype(type) {
    if (isTS && type == ":") {
      if (cx.stream.match(/^\s*\w+\s+is\b/, false)) return cont(expression, isKW, typeexpr)
      else return cont(typeexpr)
    }
  }
  function isKW(_, value) {
    if (value == "is") {
      cx.marked = "keyword"
      return cont()
    }
  }
  function typeexpr(type, value) {
    if (value == "keyof" || value == "typeof" || value == "infer" || value == "readonly") {
      cx.marked = "keyword"
      return cont(value == "typeof" ? expressionNoComma : typeexpr)
    }
    if (type == "variable" || value == "void") {
      cx.marked = "type"
      return cont(afterType)
    }
    if (value == "|" || value == "&") return cont(typeexpr)
    if (type == "string" || type == "number" || type == "atom") return cont(afterType);
    if (type == "[") return cont(pushlex("]"), commasep(typeexpr, "]", ","), poplex, afterType)
    if (type == "{") return cont(pushlex("}"), typeprops, poplex, afterType)
    if (type == "(") return cont(commasep(typearg, ")"), maybeReturnType, afterType)
    if (type == "<") return cont(commasep(typeexpr, ">"), typeexpr)
    if (type == "quasi") { return pass(quasiType, afterType); }
  }
  function maybeReturnType(type) {
    if (type == "=>") return cont(typeexpr)
  }
  function typeprops(type) {
    if (type.match(/[\}\)\]]/)) return cont()
    if (type == "," || type == ";") return cont(typeprops)
    return pass(typeprop, typeprops)
  }
  function typeprop(type, value) {
    if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property"
      return cont(typeprop)
    } else if (value == "?" || type == "number" || type == "string") {
      return cont(typeprop)
    } else if (type == ":") {
      return cont(typeexpr)
    } else if (type == "[") {
      return cont(expect("variable"), maybetypeOrIn, expect("]"), typeprop)
    } else if (type == "(") {
      return pass(functiondecl, typeprop)
    } else if (!type.match(/[;\}\)\],]/)) {
      return cont()
    }
  }
  function quasiType(type, value) {
    if (type != "quasi") return pass();
    if (value.slice(value.length - 2) != "${") return cont(quasiType);
    return cont(typeexpr, continueQuasiType);
  }
  function continueQuasiType(type) {
    if (type == "}") {
      cx.marked = "string-2";
      cx.state.tokenize = tokenQuasi;
      return cont(quasiType);
    }
  }
  function typearg(type, value) {
    if (type == "variable" && cx.stream.match(/^\s*[?:]/, false) || value == "?") return cont(typearg)
    if (type == ":") return cont(typeexpr)
    if (type == "spread") return cont(typearg)
    return pass(typeexpr)
  }
  function afterType(type, value) {
    if (value == "<") return cont(pushlex(">"), commasep(typeexpr, ">"), poplex, afterType)
    if (value == "|" || type == "." || value == "&") return cont(typeexpr)
    if (type == "[") return cont(typeexpr, expect("]"), afterType)
    if (value == "extends" || value == "implements") { cx.marked = "keyword"; return cont(typeexpr) }
    if (value == "?") return cont(typeexpr, expect(":"), typeexpr)
  }
  function maybeTypeArgs(_, value) {
    if (value == "<") return cont(pushlex(">"), commasep(typeexpr, ">"), poplex, afterType)
  }
  function typeparam() {
    return pass(typeexpr, maybeTypeDefault)
  }
  function maybeTypeDefault(_, value) {
    if (value == "=") return cont(typeexpr)
  }
  function vardef(_, value) {
    if (value == "enum") {cx.marked = "keyword"; return cont(enumdef)}
    return pass(pattern, maybetype, maybeAssign, vardefCont);
  }
  function pattern(type, value) {
    if (isTS && isModifier(value)) { cx.marked = "keyword"; return cont(pattern) }
    if (type == "variable") { register(value); return cont(); }
    if (type == "spread") return cont(pattern);
    if (type == "[") return contCommasep(eltpattern, "]");
    if (type == "{") return contCommasep(proppattern, "}");
  }
  function proppattern(type, value) {
    if (type == "variable" && !cx.stream.match(/^\s*:/, false)) {
      register(value);
      return cont(maybeAssign);
    }
    if (type == "variable") cx.marked = "property";
    if (type == "spread") return cont(pattern);
    if (type == "}") return pass();
    if (type == "[") return cont(expression, expect(']'), expect(':'), proppattern);
    return cont(expect(":"), pattern, maybeAssign);
  }
  function eltpattern() {
    return pass(pattern, maybeAssign)
  }
  function maybeAssign(_type, value) {
    if (value == "=") return cont(expressionNoComma);
  }
  function vardefCont(type) {
    if (type == ",") return cont(vardef);
  }
  function maybeelse(type, value) {
    if (type == "keyword b" && value == "else") return cont(pushlex("form", "else"), statement, poplex);
  }
  function forspec(type, value) {
    if (value == "await") return cont(forspec);
    if (type == "(") return cont(pushlex(")"), forspec1, poplex);
  }
  function forspec1(type) {
    if (type == "var") return cont(vardef, forspec2);
    if (type == "variable") return cont(forspec2);
    return pass(forspec2)
  }
  function forspec2(type, value) {
    if (type == ")") return cont()
    if (type == ";") return cont(forspec2)
    if (value == "in" || value == "of") { cx.marked = "keyword"; return cont(expression, forspec2) }
    return pass(expression, forspec2)
  }
  function functiondef(type, value) {
    if (value == "*") {cx.marked = "keyword"; return cont(functiondef);}
    if (type == "variable") {register(value); return cont(functiondef);}
    if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, mayberettype, statement, popcontext);
    if (isTS && value == "<") return cont(pushlex(">"), commasep(typeparam, ">"), poplex, functiondef)
  }
  function functiondecl(type, value) {
    if (value == "*") {cx.marked = "keyword"; return cont(functiondecl);}
    if (type == "variable") {register(value); return cont(functiondecl);}
    if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, mayberettype, popcontext);
    if (isTS && value == "<") return cont(pushlex(">"), commasep(typeparam, ">"), poplex, functiondecl)
  }
  function typename(type, value) {
    if (type == "keyword" || type == "variable") {
      cx.marked = "type"
      return cont(typename)
    } else if (value == "<") {
      return cont(pushlex(">"), commasep(typeparam, ">"), poplex)
    }
  }
  function funarg(type, value) {
    if (value == "@") cont(expression, funarg)
    if (type == "spread") return cont(funarg);
    if (isTS && isModifier(value)) { cx.marked = "keyword"; return cont(funarg); }
    if (isTS && type == "this") return cont(maybetype, maybeAssign)
    return pass(pattern, maybetype, maybeAssign);
  }
  function classExpression(type, value) {
    // Class expressions may have an optional name.
    if (type == "variable") return className(type, value);
    return classNameAfter(type, value);
  }
  function className(type, value) {
    if (type == "variable") {register(value); return cont(classNameAfter);}
  }
  function classNameAfter(type, value) {
    if (value == "<") return cont(pushlex(">"), commasep(typeparam, ">"), poplex, classNameAfter)
    if (value == "extends" || value == "implements" || (isTS && type == ",")) {
      if (value == "implements") cx.marked = "keyword";
      return cont(isTS ? typeexpr : expression, classNameAfter);
    }
    if (type == "{") return cont(pushlex("}"), classBody, poplex);
  }
  function classBody(type, value) {
    if (type == "async" ||
        (type == "variable" &&
         (value == "static" || value == "get" || value == "set" || (isTS && isModifier(value))) &&
         cx.stream.match(/^\s+[\w$\xa1-\uffff]/, false))) {
      cx.marked = "keyword";
      return cont(classBody);
    }
    if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property";
      return cont(classfield, classBody);
    }
    if (type == "number" || type == "string") return cont(classfield, classBody);
    if (type == "[")
      return cont(expression, maybetype, expect("]"), classfield, classBody)
    if (value == "*") {
      cx.marked = "keyword";
      return cont(classBody);
    }
    if (isTS && type == "(") return pass(functiondecl, classBody)
    if (type == ";" || type == ",") return cont(classBody);
    if (type == "}") return cont();
    if (value == "@") return cont(expression, classBody)
  }
  function classfield(type, value) {
    if (value == "!") return cont(classfield)
    if (value == "?") return cont(classfield)
    if (type == ":") return cont(typeexpr, maybeAssign)
    if (value == "=") return cont(expressionNoComma)
    var context = cx.state.lexical.prev, isInterface = context && context.info == "interface"
    return pass(isInterface ? functiondecl : functiondef)
  }
  function afterExport(type, value) {
    if (value == "*") { cx.marked = "keyword"; return cont(maybeFrom, expect(";")); }
    if (value == "default") { cx.marked = "keyword"; return cont(expression, expect(";")); }
    if (type == "{") return cont(commasep(exportField, "}"), maybeFrom, expect(";"));
    return pass(statement);
  }
  function exportField(type, value) {
    if (value == "as") { cx.marked = "keyword"; return cont(expect("variable")); }
    if (type == "variable") return pass(expressionNoComma, exportField);
  }
  function afterImport(type) {
    if (type == "string") return cont();
    if (type == "(") return pass(expression);
    if (type == ".") return pass(maybeoperatorComma);
    return pass(importSpec, maybeMoreImports, maybeFrom);
  }
  function importSpec(type, value) {
    if (type == "{") return contCommasep(importSpec, "}");
    if (type == "variable") register(value);
    if (value == "*") cx.marked = "keyword";
    return cont(maybeAs);
  }
  function maybeMoreImports(type) {
    if (type == ",") return cont(importSpec, maybeMoreImports)
  }
  function maybeAs(_type, value) {
    if (value == "as") { cx.marked = "keyword"; return cont(importSpec); }
  }
  function maybeFrom(_type, value) {
    if (value == "from") { cx.marked = "keyword"; return cont(expression); }
  }
  function arrayLiteral(type) {
    if (type == "]") return cont();
    return pass(commasep(expressionNoComma, "]"));
  }
  function enumdef() {
    return pass(pushlex("form"), pattern, expect("{"), pushlex("}"), commasep(enummember, "}"), poplex, poplex)
  }
  function enummember() {
    return pass(pattern, maybeAssign);
  }

  function isContinuedStatement(state, textAfter) {
    return state.lastType == "operator" || state.lastType == "," ||
      isOperatorChar.test(textAfter.charAt(0)) ||
      /[,.]/.test(textAfter.charAt(0));
  }

  function expressionAllowed(stream, state, backUp) {
    return state.tokenize == tokenBase &&
      /^(?:operator|sof|keyword [bcd]|case|new|export|default|spread|[\[{}\(,;:]|=>)$/.test(state.lastType) ||
      (state.lastType == "quasi" && /\{\s*$/.test(stream.string.slice(0, stream.pos - (backUp || 0))))
  }

  // Interface

  return {
    startState: function(basecolumn) {
      var state = {
        tokenize: tokenBase,
        lastType: "sof",
        cc: [],
        lexical: new JSLexical((basecolumn || 0) - indentUnit, 0, "block", false),
        localVars: parserConfig.localVars,
        context: parserConfig.localVars && new Context(null, null, false),
        indented: basecolumn || 0
      };
      if (parserConfig.globalVars && typeof parserConfig.globalVars == "object")
        state.globalVars = parserConfig.globalVars;
      return state;
    },

    token: function(stream, state) {
      if (stream.sol()) {
        if (!state.lexical.hasOwnProperty("align"))
          state.lexical.align = false;
        state.indented = stream.indentation();
        findFatArrow(stream, state);
      }
      if (state.tokenize != tokenComment && stream.eatSpace()) return null;
      var style = state.tokenize(stream, state);
      if (type == "comment") return style;
      state.lastType = type == "operator" && (content == "++" || content == "--") ? "incdec" : type;
      return parseJS(state, style, type, content, stream);
    },

    indent: function(state, textAfter) {
      if (state.tokenize == tokenComment || state.tokenize == tokenQuasi) return CodeMirror.Pass;
      if (state.tokenize != tokenBase) return 0;
      var firstChar = textAfter && textAfter.charAt(0), lexical = state.lexical, top
      // Kludge to prevent 'maybelse' from blocking lexical scope pops
      if (!/^\s*else\b/.test(textAfter)) for (var i = state.cc.length - 1; i >= 0; --i) {
        var c = state.cc[i];
        if (c == poplex) lexical = lexical.prev;
        else if (c != maybeelse && c != popcontext) break;
      }
      while ((lexical.type == "stat" || lexical.type == "form") &&
             (firstChar == "}" || ((top = state.cc[state.cc.length - 1]) &&
                                   (top == maybeoperatorComma || top == maybeoperatorNoComma) &&
                                   !/^[,\.=+\-*:?[\(]/.test(textAfter))))
        lexical = lexical.prev;
      if (statementIndent && lexical.type == ")" && lexical.prev.type == "stat")
        lexical = lexical.prev;
      var type = lexical.type, closing = firstChar == type;

      if (type == "vardef") return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? lexical.info.length + 1 : 0);
      else if (type == "form" && firstChar == "{") return lexical.indented;
      else if (type == "form") return lexical.indented + indentUnit;
      else if (type == "stat")
        return lexical.indented + (isContinuedStatement(state, textAfter) ? statementIndent || indentUnit : 0);
      else if (lexical.info == "switch" && !closing && parserConfig.doubleIndentSwitch != false)
        return lexical.indented + (/^(?:case|default)\b/.test(textAfter) ? indentUnit : 2 * indentUnit);
      else if (lexical.align) return lexical.column + (closing ? 0 : 1);
      else return lexical.indented + (closing ? 0 : indentUnit);
    },

    electricInput: /^\s*(?:case .*?:|default:|\{|\})$/,
    blockCommentStart: jsonMode ? null : "/*",
    blockCommentEnd: jsonMode ? null : "*/",
    blockCommentContinue: jsonMode ? null : " * ",
    lineComment: jsonMode ? null : "//",
    fold: "brace",
    closeBrackets: "()[]{}''\"\"``",

    helperType: jsonMode ? "json" : "javascript",
    jsonldMode: jsonldMode,
    jsonMode: jsonMode,

    expressionAllowed: expressionAllowed,

    skipExpression: function(state) {
      parseJS(state, "atom", "atom", "true", new CodeMirror.StringStream("", 2, null))
    }
  };
});

CodeMirror.registerHelper("wordChars", "javascript", /[\w$]/);

CodeMirror.defineMIME("text/javascript", "javascript");
CodeMirror.defineMIME("text/ecmascript", "javascript");
CodeMirror.defineMIME("application/javascript", "javascript");
CodeMirror.defineMIME("application/x-javascript", "javascript");
CodeMirror.defineMIME("application/ecmascript", "javascript");
CodeMirror.defineMIME("application/json", { name: "javascript", json: true });
CodeMirror.defineMIME("application/x-json", { name: "javascript", json: true });
CodeMirror.defineMIME("application/manifest+json", { name: "javascript", json: true })
CodeMirror.defineMIME("application/ld+json", { name: "javascript", jsonld: true });
CodeMirror.defineMIME("text/typescript", { name: "javascript", typescript: true });
CodeMirror.defineMIME("application/typescript", { name: "javascript", typescript: true });

});
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../xml/xml"), require("../javascript/javascript"), require("../css/css"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../xml/xml", "../javascript/javascript", "../css/css"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  var defaultTags = {
    script: [
      ["lang", /(javascript|babel)/i, "javascript"],
      ["type", /^(?:text|application)\/(?:x-)?(?:java|ecma)script$|^module$|^$/i, "javascript"],
      ["type", /./, "text/plain"],
      [null, null, "javascript"]
    ],
    style:  [
      ["lang", /^css$/i, "css"],
      ["type", /^(text\/)?(x-)?(stylesheet|css)$/i, "css"],
      ["type", /./, "text/plain"],
      [null, null, "css"]
    ]
  };

  function maybeBackup(stream, pat, style) {
    var cur = stream.current(), close = cur.search(pat);
    if (close > -1) {
      stream.backUp(cur.length - close);
    } else if (cur.match(/<\/?$/)) {
      stream.backUp(cur.length);
      if (!stream.match(pat, false)) stream.match(cur);
    }
    return style;
  }

  var attrRegexpCache = {};
  function getAttrRegexp(attr) {
    var regexp = attrRegexpCache[attr];
    if (regexp) return regexp;
    return attrRegexpCache[attr] = new RegExp("\\s+" + attr + "\\s*=\\s*('|\")?([^'\"]+)('|\")?\\s*");
  }

  function getAttrValue(text, attr) {
    var match = text.match(getAttrRegexp(attr))
    return match ? /^\s*(.*?)\s*$/.exec(match[2])[1] : ""
  }

  function getTagRegexp(tagName, anchored) {
    return new RegExp((anchored ? "^" : "") + "<\/\s*" + tagName + "\s*>", "i");
  }

  function addTags(from, to) {
    for (var tag in from) {
      var dest = to[tag] || (to[tag] = []);
      var source = from[tag];
      for (var i = source.length - 1; i >= 0; i--)
        dest.unshift(source[i])
    }
  }

  function findMatchingMode(tagInfo, tagText) {
    for (var i = 0; i < tagInfo.length; i++) {
      var spec = tagInfo[i];
      if (!spec[0] || spec[1].test(getAttrValue(tagText, spec[0]))) return spec[2];
    }
  }

  CodeMirror.defineMode("htmlmixed", function (config, parserConfig) {
    var htmlMode = CodeMirror.getMode(config, {
      name: "xml",
      htmlMode: true,
      multilineTagIndentFactor: parserConfig.multilineTagIndentFactor,
      multilineTagIndentPastTag: parserConfig.multilineTagIndentPastTag,
      allowMissingTagName: parserConfig.allowMissingTagName,
    });

    var tags = {};
    var configTags = parserConfig && parserConfig.tags, configScript = parserConfig && parserConfig.scriptTypes;
    addTags(defaultTags, tags);
    if (configTags) addTags(configTags, tags);
    if (configScript) for (var i = configScript.length - 1; i >= 0; i--)
      tags.script.unshift(["type", configScript[i].matches, configScript[i].mode])

    function html(stream, state) {
      var style = htmlMode.token(stream, state.htmlState), tag = /\btag\b/.test(style), tagName
      if (tag && !/[<>\s\/]/.test(stream.current()) &&
          (tagName = state.htmlState.tagName && state.htmlState.tagName.toLowerCase()) &&
          tags.hasOwnProperty(tagName)) {
        state.inTag = tagName + " "
      } else if (state.inTag && tag && />$/.test(stream.current())) {
        var inTag = /^([\S]+) (.*)/.exec(state.inTag)
        state.inTag = null
        var modeSpec = stream.current() == ">" && findMatchingMode(tags[inTag[1]], inTag[2])
        var mode = CodeMirror.getMode(config, modeSpec)
        var endTagA = getTagRegexp(inTag[1], true), endTag = getTagRegexp(inTag[1], false);
        state.token = function (stream, state) {
          if (stream.match(endTagA, false)) {
            state.token = html;
            state.localState = state.localMode = null;
            return null;
          }
          return maybeBackup(stream, endTag, state.localMode.token(stream, state.localState));
        };
        state.localMode = mode;
        state.localState = CodeMirror.startState(mode, htmlMode.indent(state.htmlState, "", ""));
      } else if (state.inTag) {
        state.inTag += stream.current()
        if (stream.eol()) state.inTag += " "
      }
      return style;
    };

    return {
      startState: function () {
        var state = CodeMirror.startState(htmlMode);
        return {token: html, inTag: null, localMode: null, localState: null, htmlState: state};
      },

      copyState: function (state) {
        var local;
        if (state.localState) {
          local = CodeMirror.copyState(state.localMode, state.localState);
        }
        return {token: state.token, inTag: state.inTag,
                localMode: state.localMode, localState: local,
                htmlState: CodeMirror.copyState(htmlMode, state.htmlState)};
      },

      token: function (stream, state) {
        return state.token(stream, state);
      },

      indent: function (state, textAfter, line) {
        if (!state.localMode || /^\s*<\//.test(textAfter))
          return htmlMode.indent(state.htmlState, textAfter, line);
        else if (state.localMode.indent)
          return state.localMode.indent(state.localState, textAfter, line);
        else
          return CodeMirror.Pass;
      },

      innerMode: function (state) {
        return {state: state.localState || state.htmlState, mode: state.localMode || htmlMode};
      }
    };
  }, "xml", "javascript", "css");

  CodeMirror.defineMIME("text/html", "htmlmixed");
});
// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"), require("../htmlmixed/htmlmixed"),
        require("../../addon/mode/overlay"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror", "../htmlmixed/htmlmixed",
            "../../addon/mode/overlay"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  "use strict";

  CodeMirror.defineMode("django:inner", function() {
    var keywords = ["block", "endblock", "for", "endfor", "true", "false", "filter", "endfilter",
                    "loop", "none", "self", "super", "if", "elif", "endif", "as", "else", "import",
                    "with", "endwith", "without", "context", "ifequal", "endifequal", "ifnotequal",
                    "endifnotequal", "extends", "include", "load", "comment", "endcomment",
                    "empty", "url", "static", "trans", "blocktrans", "endblocktrans", "now",
                    "regroup", "lorem", "ifchanged", "endifchanged", "firstof", "debug", "cycle",
                    "csrf_token", "autoescape", "endautoescape", "spaceless", "endspaceless",
                    "ssi", "templatetag", "verbatim", "endverbatim", "widthratio"],
        filters = ["add", "addslashes", "capfirst", "center", "cut", "date",
                   "default", "default_if_none", "dictsort",
                   "dictsortreversed", "divisibleby", "escape", "escapejs",
                   "filesizeformat", "first", "floatformat", "force_escape",
                   "get_digit", "iriencode", "join", "last", "length",
                   "length_is", "linebreaks", "linebreaksbr", "linenumbers",
                   "ljust", "lower", "make_list", "phone2numeric", "pluralize",
                   "pprint", "random", "removetags", "rjust", "safe",
                   "safeseq", "slice", "slugify", "stringformat", "striptags",
                   "time", "timesince", "timeuntil", "title", "truncatechars",
                   "truncatechars_html", "truncatewords", "truncatewords_html",
                   "unordered_list", "upper", "urlencode", "urlize",
                   "urlizetrunc", "wordcount", "wordwrap", "yesno"],
        operators = ["==", "!=", "<", ">", "<=", ">="],
        wordOperators = ["in", "not", "or", "and"];

    keywords = new RegExp("^\\b(" + keywords.join("|") + ")\\b");
    filters = new RegExp("^\\b(" + filters.join("|") + ")\\b");
    operators = new RegExp("^\\b(" + operators.join("|") + ")\\b");
    wordOperators = new RegExp("^\\b(" + wordOperators.join("|") + ")\\b");

    // We have to return "null" instead of null, in order to avoid string
    // styling as the default, when using Django templates inside HTML
    // element attributes
    function tokenBase (stream, state) {
      // Attempt to identify a variable, template or comment tag respectively
      if (stream.match("{{")) {
        state.tokenize = inVariable;
        return "tag";
      } else if (stream.match("{%")) {
        state.tokenize = inTag;
        return "tag";
      } else if (stream.match("{#")) {
        state.tokenize = inComment;
        return "comment";
      }

      // Ignore completely any stream series that do not match the
      // Django template opening tags.
      while (stream.next() != null && !stream.match(/\{[{%#]/, false)) {}
      return null;
    }

    // A string can be included in either single or double quotes (this is
    // the delimiter). Mark everything as a string until the start delimiter
    // occurs again.
    function inString (delimiter, previousTokenizer) {
      return function (stream, state) {
        if (!state.escapeNext && stream.eat(delimiter)) {
          state.tokenize = previousTokenizer;
        } else {
          if (state.escapeNext) {
            state.escapeNext = false;
          }

          var ch = stream.next();

          // Take into account the backslash for escaping characters, such as
          // the string delimiter.
          if (ch == "\\") {
            state.escapeNext = true;
          }
        }

        return "string";
      };
    }

    // Apply Django template variable syntax highlighting
    function inVariable (stream, state) {
      // Attempt to match a dot that precedes a property
      if (state.waitDot) {
        state.waitDot = false;

        if (stream.peek() != ".") {
          return "null";
        }

        // Dot followed by a non-word character should be considered an error.
        if (stream.match(/\.\W+/)) {
          return "error";
        } else if (stream.eat(".")) {
          state.waitProperty = true;
          return "null";
        } else {
          throw Error ("Unexpected error while waiting for property.");
        }
      }

      // Attempt to match a pipe that precedes a filter
      if (state.waitPipe) {
        state.waitPipe = false;

        if (stream.peek() != "|") {
          return "null";
        }

        // Pipe followed by a non-word character should be considered an error.
        if (stream.match(/\.\W+/)) {
          return "error";
        } else if (stream.eat("|")) {
          state.waitFilter = true;
          return "null";
        } else {
          throw Error ("Unexpected error while waiting for filter.");
        }
      }

      // Highlight properties
      if (state.waitProperty) {
        state.waitProperty = false;
        if (stream.match(/\b(\w+)\b/)) {
          state.waitDot = true;  // A property can be followed by another property
          state.waitPipe = true;  // A property can be followed by a filter
          return "property";
        }
      }

      // Highlight filters
      if (state.waitFilter) {
          state.waitFilter = false;
        if (stream.match(filters)) {
          return "variable-2";
        }
      }

      // Ignore all white spaces
      if (stream.eatSpace()) {
        state.waitProperty = false;
        return "null";
      }

      // Identify numbers
      if (stream.match(/\b\d+(\.\d+)?\b/)) {
        return "number";
      }

      // Identify strings
      if (stream.match("'")) {
        state.tokenize = inString("'", state.tokenize);
        return "string";
      } else if (stream.match('"')) {
        state.tokenize = inString('"', state.tokenize);
        return "string";
      }

      // Attempt to find the variable
      if (stream.match(/\b(\w+)\b/) && !state.foundVariable) {
        state.waitDot = true;
        state.waitPipe = true;  // A property can be followed by a filter
        return "variable";
      }

      // If found closing tag reset
      if (stream.match("}}")) {
        state.waitProperty = null;
        state.waitFilter = null;
        state.waitDot = null;
        state.waitPipe = null;
        state.tokenize = tokenBase;
        return "tag";
      }

      // If nothing was found, advance to the next character
      stream.next();
      return "null";
    }

    function inTag (stream, state) {
      // Attempt to match a dot that precedes a property
      if (state.waitDot) {
        state.waitDot = false;

        if (stream.peek() != ".") {
          return "null";
        }

        // Dot followed by a non-word character should be considered an error.
        if (stream.match(/\.\W+/)) {
          return "error";
        } else if (stream.eat(".")) {
          state.waitProperty = true;
          return "null";
        } else {
          throw Error ("Unexpected error while waiting for property.");
        }
      }

      // Attempt to match a pipe that precedes a filter
      if (state.waitPipe) {
        state.waitPipe = false;

        if (stream.peek() != "|") {
          return "null";
        }

        // Pipe followed by a non-word character should be considered an error.
        if (stream.match(/\.\W+/)) {
          return "error";
        } else if (stream.eat("|")) {
          state.waitFilter = true;
          return "null";
        } else {
          throw Error ("Unexpected error while waiting for filter.");
        }
      }

      // Highlight properties
      if (state.waitProperty) {
        state.waitProperty = false;
        if (stream.match(/\b(\w+)\b/)) {
          state.waitDot = true;  // A property can be followed by another property
          state.waitPipe = true;  // A property can be followed by a filter
          return "property";
        }
      }

      // Highlight filters
      if (state.waitFilter) {
          state.waitFilter = false;
        if (stream.match(filters)) {
          return "variable-2";
        }
      }

      // Ignore all white spaces
      if (stream.eatSpace()) {
        state.waitProperty = false;
        return "null";
      }

      // Identify numbers
      if (stream.match(/\b\d+(\.\d+)?\b/)) {
        return "number";
      }

      // Identify strings
      if (stream.match("'")) {
        state.tokenize = inString("'", state.tokenize);
        return "string";
      } else if (stream.match('"')) {
        state.tokenize = inString('"', state.tokenize);
        return "string";
      }

      // Attempt to match an operator
      if (stream.match(operators)) {
        return "operator";
      }

      // Attempt to match a word operator
      if (stream.match(wordOperators)) {
        return "keyword";
      }

      // Attempt to match a keyword
      var keywordMatch = stream.match(keywords);
      if (keywordMatch) {
        if (keywordMatch[0] == "comment") {
          state.blockCommentTag = true;
        }
        return "keyword";
      }

      // Attempt to match a variable
      if (stream.match(/\b(\w+)\b/)) {
        state.waitDot = true;
        state.waitPipe = true;  // A property can be followed by a filter
        return "variable";
      }

      // If found closing tag reset
      if (stream.match("%}")) {
        state.waitProperty = null;
        state.waitFilter = null;
        state.waitDot = null;
        state.waitPipe = null;
        // If the tag that closes is a block comment tag, we want to mark the
        // following code as comment, until the tag closes.
        if (state.blockCommentTag) {
          state.blockCommentTag = false;  // Release the "lock"
          state.tokenize = inBlockComment;
        } else {
          state.tokenize = tokenBase;
        }
        return "tag";
      }

      // If nothing was found, advance to the next character
      stream.next();
      return "null";
    }

    // Mark everything as comment inside the tag and the tag itself.
    function inComment (stream, state) {
      if (stream.match(/^.*?#\}/)) state.tokenize = tokenBase
      else stream.skipToEnd()
      return "comment";
    }

    // Mark everything as a comment until the `blockcomment` tag closes.
    function inBlockComment (stream, state) {
      if (stream.match(/\{%\s*endcomment\s*%\}/, false)) {
        state.tokenize = inTag;
        stream.match("{%");
        return "tag";
      } else {
        stream.next();
        return "comment";
      }
    }

    return {
      startState: function () {
        return {tokenize: tokenBase};
      },
      token: function (stream, state) {
        return state.tokenize(stream, state);
      },
      blockCommentStart: "{% comment %}",
      blockCommentEnd: "{% endcomment %}"
    };
  });

  CodeMirror.defineMode("django", function(config) {
    var htmlBase = CodeMirror.getMode(config, "text/html");
    var djangoInner = CodeMirror.getMode(config, "django:inner");
    return CodeMirror.overlayMode(htmlBase, djangoInner);
  });

  CodeMirror.defineMIME("text/x-django", "django");
});

    modulo.register('util', CodeMirror); // Expose CodeMirror as a global utility

    // Expose a global utility, which creates an object containing the contents
    // of components specified by the path (sans TestSuites and <Component> def
    // itself). Used by <mws-Demo> and <mws-AllExamples> code snippets in site.
    function getComponentDefs(path) {
        if (modulo.parentDefs.x_x.cachedComponentDefs) {
            // TODO: Introduce a more convenient way to access current conf,
            // specifically for static data like this
            if (path in modulo.parentDefs.x_x.cachedComponentDefs) {
                return modulo.parentDefs.x_x.cachedComponentDefs[path];
            }
        } else {
            modulo.parentDefs.x_x.cachedComponentDefs = {};
        }
        if (!(path in modulo.fetchQueue.data)) {
            console.error('ERROR: Have not loaded:', path);
            return {};
        }
        const sourceText = modulo.fetchQueue.data[path];
        const componentTexts = {};
        let name = '';
        let currentComponent = '';
        let inTestSuite = false;
        for (const line of sourceText.split('\n')) { // Crude line-by-line parser
            //const lower = line.trim().toLowerCase(); // TODO: Possibly tolerate whitespace?
            const lower = line.toLowerCase();
            if (lower.startsWith('</component>')) {
                componentTexts[name] = currentComponent;
                currentComponent = '';
                name = null;
            } else if (lower.startsWith('<component')) {
                name = line.split(' name="')[1].split('"')[0];
            } else if (lower.startsWith('<testsuite')) {
                inTestSuite = true;
            } else if (lower.includes('</testsuite>')) {
                inTestSuite = false;
            } else if (name && !inTestSuite) {
                currentComponent += line + '\n';
            }
        }
        modulo.parentDefs.x_x.cachedComponentDefs[path] = componentTexts;
        return componentTexts;
    }
    modulo.register('util', getComponentDefs);

return { "classTest": typeof classTest !== "undefined" ? classTest : undefined,
"removeChildren": typeof removeChildren !== "undefined" ? removeChildren : undefined,
"removeChildrenAndAdd": typeof removeChildrenAndAdd !== "undefined" ? removeChildrenAndAdd : undefined,
"elt": typeof elt !== "undefined" ? elt : undefined,
"eltP": typeof eltP !== "undefined" ? eltP : undefined,
"contains": typeof contains !== "undefined" ? contains : undefined,
"activeElt": typeof activeElt !== "undefined" ? activeElt : undefined,
"addClass": typeof addClass !== "undefined" ? addClass : undefined,
"joinClasses": typeof joinClasses !== "undefined" ? joinClasses : undefined,
"bind": typeof bind !== "undefined" ? bind : undefined,
"copyObj": typeof copyObj !== "undefined" ? copyObj : undefined,
"countColumn": typeof countColumn !== "undefined" ? countColumn : undefined,
"indexOf": typeof indexOf !== "undefined" ? indexOf : undefined,
"findColumn": typeof findColumn !== "undefined" ? findColumn : undefined,
"spaceStr": typeof spaceStr !== "undefined" ? spaceStr : undefined,
"lst": typeof lst !== "undefined" ? lst : undefined,
"map": typeof map !== "undefined" ? map : undefined,
"insertSorted": typeof insertSorted !== "undefined" ? insertSorted : undefined,
"nothing": typeof nothing !== "undefined" ? nothing : undefined,
"createObj": typeof createObj !== "undefined" ? createObj : undefined,
"isWordCharBasic": typeof isWordCharBasic !== "undefined" ? isWordCharBasic : undefined,
"isWordChar": typeof isWordChar !== "undefined" ? isWordChar : undefined,
"isEmpty": typeof isEmpty !== "undefined" ? isEmpty : undefined,
"isExtendingChar": typeof isExtendingChar !== "undefined" ? isExtendingChar : undefined,
"skipExtendingChars": typeof skipExtendingChars !== "undefined" ? skipExtendingChars : undefined,
"findFirst": typeof findFirst !== "undefined" ? findFirst : undefined,
"iterateBidiSections": typeof iterateBidiSections !== "undefined" ? iterateBidiSections : undefined,
"getBidiPartAt": typeof getBidiPartAt !== "undefined" ? getBidiPartAt : undefined,
"charType": typeof charType !== "undefined" ? charType : undefined,
"BidiSpan": typeof BidiSpan !== "undefined" ? BidiSpan : undefined,
"getOrder": typeof getOrder !== "undefined" ? getOrder : undefined,
"getHandlers": typeof getHandlers !== "undefined" ? getHandlers : undefined,
"off": typeof off !== "undefined" ? off : undefined,
"signal": typeof signal !== "undefined" ? signal : undefined,
"signalDOMEvent": typeof signalDOMEvent !== "undefined" ? signalDOMEvent : undefined,
"signalCursorActivity": typeof signalCursorActivity !== "undefined" ? signalCursorActivity : undefined,
"hasHandler": typeof hasHandler !== "undefined" ? hasHandler : undefined,
"eventMixin": typeof eventMixin !== "undefined" ? eventMixin : undefined,
"e_preventDefault": typeof e_preventDefault !== "undefined" ? e_preventDefault : undefined,
"e_stopPropagation": typeof e_stopPropagation !== "undefined" ? e_stopPropagation : undefined,
"e_defaultPrevented": typeof e_defaultPrevented !== "undefined" ? e_defaultPrevented : undefined,
"e_stop": typeof e_stop !== "undefined" ? e_stop : undefined,
"e_target": typeof e_target !== "undefined" ? e_target : undefined,
"e_button": typeof e_button !== "undefined" ? e_button : undefined,
"zeroWidthElement": typeof zeroWidthElement !== "undefined" ? zeroWidthElement : undefined,
"hasBadBidiRects": typeof hasBadBidiRects !== "undefined" ? hasBadBidiRects : undefined,
"hasBadZoomedRects": typeof hasBadZoomedRects !== "undefined" ? hasBadZoomedRects : undefined,
"defineMode": typeof defineMode !== "undefined" ? defineMode : undefined,
"defineMIME": typeof defineMIME !== "undefined" ? defineMIME : undefined,
"resolveMode": typeof resolveMode !== "undefined" ? resolveMode : undefined,
"getMode": typeof getMode !== "undefined" ? getMode : undefined,
"extendMode": typeof extendMode !== "undefined" ? extendMode : undefined,
"copyState": typeof copyState !== "undefined" ? copyState : undefined,
"innerMode": typeof innerMode !== "undefined" ? innerMode : undefined,
"startState": typeof startState !== "undefined" ? startState : undefined,
"getLine": typeof getLine !== "undefined" ? getLine : undefined,
"getBetween": typeof getBetween !== "undefined" ? getBetween : undefined,
"getLines": typeof getLines !== "undefined" ? getLines : undefined,
"updateLineHeight": typeof updateLineHeight !== "undefined" ? updateLineHeight : undefined,
"lineNo": typeof lineNo !== "undefined" ? lineNo : undefined,
"lineAtHeight": typeof lineAtHeight !== "undefined" ? lineAtHeight : undefined,
"isLine": typeof isLine !== "undefined" ? isLine : undefined,
"lineNumberFor": typeof lineNumberFor !== "undefined" ? lineNumberFor : undefined,
"Pos": typeof Pos !== "undefined" ? Pos : undefined,
"cmp": typeof cmp !== "undefined" ? cmp : undefined,
"equalCursorPos": typeof equalCursorPos !== "undefined" ? equalCursorPos : undefined,
"copyPos": typeof copyPos !== "undefined" ? copyPos : undefined,
"maxPos": typeof maxPos !== "undefined" ? maxPos : undefined,
"minPos": typeof minPos !== "undefined" ? minPos : undefined,
"clipLine": typeof clipLine !== "undefined" ? clipLine : undefined,
"clipPos": typeof clipPos !== "undefined" ? clipPos : undefined,
"clipToLen": typeof clipToLen !== "undefined" ? clipToLen : undefined,
"clipPosArray": typeof clipPosArray !== "undefined" ? clipPosArray : undefined,
"highlightLine": typeof highlightLine !== "undefined" ? highlightLine : undefined,
"getLineStyles": typeof getLineStyles !== "undefined" ? getLineStyles : undefined,
"getContextBefore": typeof getContextBefore !== "undefined" ? getContextBefore : undefined,
"processLine": typeof processLine !== "undefined" ? processLine : undefined,
"callBlankLine": typeof callBlankLine !== "undefined" ? callBlankLine : undefined,
"readToken": typeof readToken !== "undefined" ? readToken : undefined,
"takeToken": typeof takeToken !== "undefined" ? takeToken : undefined,
"extractLineClasses": typeof extractLineClasses !== "undefined" ? extractLineClasses : undefined,
"runMode": typeof runMode !== "undefined" ? runMode : undefined,
"findStartLine": typeof findStartLine !== "undefined" ? findStartLine : undefined,
"retreatFrontier": typeof retreatFrontier !== "undefined" ? retreatFrontier : undefined,
"seeReadOnlySpans": typeof seeReadOnlySpans !== "undefined" ? seeReadOnlySpans : undefined,
"seeCollapsedSpans": typeof seeCollapsedSpans !== "undefined" ? seeCollapsedSpans : undefined,
"MarkedSpan": typeof MarkedSpan !== "undefined" ? MarkedSpan : undefined,
"getMarkedSpanFor": typeof getMarkedSpanFor !== "undefined" ? getMarkedSpanFor : undefined,
"removeMarkedSpan": typeof removeMarkedSpan !== "undefined" ? removeMarkedSpan : undefined,
"addMarkedSpan": typeof addMarkedSpan !== "undefined" ? addMarkedSpan : undefined,
"markedSpansBefore": typeof markedSpansBefore !== "undefined" ? markedSpansBefore : undefined,
"markedSpansAfter": typeof markedSpansAfter !== "undefined" ? markedSpansAfter : undefined,
"stretchSpansOverChange": typeof stretchSpansOverChange !== "undefined" ? stretchSpansOverChange : undefined,
"clearEmptySpans": typeof clearEmptySpans !== "undefined" ? clearEmptySpans : undefined,
"removeReadOnlyRanges": typeof removeReadOnlyRanges !== "undefined" ? removeReadOnlyRanges : undefined,
"detachMarkedSpans": typeof detachMarkedSpans !== "undefined" ? detachMarkedSpans : undefined,
"attachMarkedSpans": typeof attachMarkedSpans !== "undefined" ? attachMarkedSpans : undefined,
"extraLeft": typeof extraLeft !== "undefined" ? extraLeft : undefined,
"extraRight": typeof extraRight !== "undefined" ? extraRight : undefined,
"compareCollapsedMarkers": typeof compareCollapsedMarkers !== "undefined" ? compareCollapsedMarkers : undefined,
"collapsedSpanAtSide": typeof collapsedSpanAtSide !== "undefined" ? collapsedSpanAtSide : undefined,
"collapsedSpanAtStart": typeof collapsedSpanAtStart !== "undefined" ? collapsedSpanAtStart : undefined,
"collapsedSpanAtEnd": typeof collapsedSpanAtEnd !== "undefined" ? collapsedSpanAtEnd : undefined,
"collapsedSpanAround": typeof collapsedSpanAround !== "undefined" ? collapsedSpanAround : undefined,
"conflictingCollapsedRange": typeof conflictingCollapsedRange !== "undefined" ? conflictingCollapsedRange : undefined,
"visualLine": typeof visualLine !== "undefined" ? visualLine : undefined,
"visualLineEnd": typeof visualLineEnd !== "undefined" ? visualLineEnd : undefined,
"visualLineContinued": typeof visualLineContinued !== "undefined" ? visualLineContinued : undefined,
"visualLineNo": typeof visualLineNo !== "undefined" ? visualLineNo : undefined,
"visualLineEndNo": typeof visualLineEndNo !== "undefined" ? visualLineEndNo : undefined,
"lineIsHidden": typeof lineIsHidden !== "undefined" ? lineIsHidden : undefined,
"lineIsHiddenInner": typeof lineIsHiddenInner !== "undefined" ? lineIsHiddenInner : undefined,
"heightAtLine": typeof heightAtLine !== "undefined" ? heightAtLine : undefined,
"lineLength": typeof lineLength !== "undefined" ? lineLength : undefined,
"findMaxLine": typeof findMaxLine !== "undefined" ? findMaxLine : undefined,
"updateLine": typeof updateLine !== "undefined" ? updateLine : undefined,
"cleanUpLine": typeof cleanUpLine !== "undefined" ? cleanUpLine : undefined,
"interpretTokenStyle": typeof interpretTokenStyle !== "undefined" ? interpretTokenStyle : undefined,
"buildLineContent": typeof buildLineContent !== "undefined" ? buildLineContent : undefined,
"defaultSpecialCharPlaceholder": typeof defaultSpecialCharPlaceholder !== "undefined" ? defaultSpecialCharPlaceholder : undefined,
"buildToken": typeof buildToken !== "undefined" ? buildToken : undefined,
"splitSpaces": typeof splitSpaces !== "undefined" ? splitSpaces : undefined,
"buildTokenBadBidi": typeof buildTokenBadBidi !== "undefined" ? buildTokenBadBidi : undefined,
"buildCollapsedSpan": typeof buildCollapsedSpan !== "undefined" ? buildCollapsedSpan : undefined,
"insertLineContent": typeof insertLineContent !== "undefined" ? insertLineContent : undefined,
"LineView": typeof LineView !== "undefined" ? LineView : undefined,
"buildViewArray": typeof buildViewArray !== "undefined" ? buildViewArray : undefined,
"pushOperation": typeof pushOperation !== "undefined" ? pushOperation : undefined,
"fireCallbacksForOps": typeof fireCallbacksForOps !== "undefined" ? fireCallbacksForOps : undefined,
"finishOperation": typeof finishOperation !== "undefined" ? finishOperation : undefined,
"signalLater": typeof signalLater !== "undefined" ? signalLater : undefined,
"fireOrphanDelayed": typeof fireOrphanDelayed !== "undefined" ? fireOrphanDelayed : undefined,
"updateLineForChanges": typeof updateLineForChanges !== "undefined" ? updateLineForChanges : undefined,
"need": typeof need !== "undefined" ? need : undefined,
"ensureLineWrapped": typeof ensureLineWrapped !== "undefined" ? ensureLineWrapped : undefined,
"updateLineBackground": typeof updateLineBackground !== "undefined" ? updateLineBackground : undefined,
"getLineContent": typeof getLineContent !== "undefined" ? getLineContent : undefined,
"updateLineText": typeof updateLineText !== "undefined" ? updateLineText : undefined,
"updateLineClasses": typeof updateLineClasses !== "undefined" ? updateLineClasses : undefined,
"updateLineGutter": typeof updateLineGutter !== "undefined" ? updateLineGutter : undefined,
"updateLineWidgets": typeof updateLineWidgets !== "undefined" ? updateLineWidgets : undefined,
"buildLineElement": typeof buildLineElement !== "undefined" ? buildLineElement : undefined,
"insertLineWidgets": typeof insertLineWidgets !== "undefined" ? insertLineWidgets : undefined,
"insertLineWidgetsFor": typeof insertLineWidgetsFor !== "undefined" ? insertLineWidgetsFor : undefined,
"positionLineWidget": typeof positionLineWidget !== "undefined" ? positionLineWidget : undefined,
"widgetHeight": typeof widgetHeight !== "undefined" ? widgetHeight : undefined,
"eventInWidget": typeof eventInWidget !== "undefined" ? eventInWidget : undefined,
"paddingTop": typeof paddingTop !== "undefined" ? paddingTop : undefined,
"paddingVert": typeof paddingVert !== "undefined" ? paddingVert : undefined,
"paddingH": typeof paddingH !== "undefined" ? paddingH : undefined,
"scrollGap": typeof scrollGap !== "undefined" ? scrollGap : undefined,
"displayWidth": typeof displayWidth !== "undefined" ? displayWidth : undefined,
"displayHeight": typeof displayHeight !== "undefined" ? displayHeight : undefined,
"ensureLineHeights": typeof ensureLineHeights !== "undefined" ? ensureLineHeights : undefined,
"mapFromLineView": typeof mapFromLineView !== "undefined" ? mapFromLineView : undefined,
"updateExternalMeasurement": typeof updateExternalMeasurement !== "undefined" ? updateExternalMeasurement : undefined,
"measureChar": typeof measureChar !== "undefined" ? measureChar : undefined,
"findViewForLine": typeof findViewForLine !== "undefined" ? findViewForLine : undefined,
"prepareMeasureForLine": typeof prepareMeasureForLine !== "undefined" ? prepareMeasureForLine : undefined,
"measureCharPrepared": typeof measureCharPrepared !== "undefined" ? measureCharPrepared : undefined,
"nodeAndOffsetInLineMap": typeof nodeAndOffsetInLineMap !== "undefined" ? nodeAndOffsetInLineMap : undefined,
"getUsefulRect": typeof getUsefulRect !== "undefined" ? getUsefulRect : undefined,
"measureCharInner": typeof measureCharInner !== "undefined" ? measureCharInner : undefined,
"maybeUpdateRectForZooming": typeof maybeUpdateRectForZooming !== "undefined" ? maybeUpdateRectForZooming : undefined,
"clearLineMeasurementCacheFor": typeof clearLineMeasurementCacheFor !== "undefined" ? clearLineMeasurementCacheFor : undefined,
"clearLineMeasurementCache": typeof clearLineMeasurementCache !== "undefined" ? clearLineMeasurementCache : undefined,
"clearCaches": typeof clearCaches !== "undefined" ? clearCaches : undefined,
"pageScrollX": typeof pageScrollX !== "undefined" ? pageScrollX : undefined,
"pageScrollY": typeof pageScrollY !== "undefined" ? pageScrollY : undefined,
"widgetTopHeight": typeof widgetTopHeight !== "undefined" ? widgetTopHeight : undefined,
"intoCoordSystem": typeof intoCoordSystem !== "undefined" ? intoCoordSystem : undefined,
"fromCoordSystem": typeof fromCoordSystem !== "undefined" ? fromCoordSystem : undefined,
"charCoords": typeof charCoords !== "undefined" ? charCoords : undefined,
"cursorCoords": typeof cursorCoords !== "undefined" ? cursorCoords : undefined,
"get": typeof get !== "undefined" ? get : undefined,
"getBidi": typeof getBidi !== "undefined" ? getBidi : undefined,
"estimateCoords": typeof estimateCoords !== "undefined" ? estimateCoords : undefined,
"PosWithInfo": typeof PosWithInfo !== "undefined" ? PosWithInfo : undefined,
"coordsChar": typeof coordsChar !== "undefined" ? coordsChar : undefined,
"wrappedLineExtent": typeof wrappedLineExtent !== "undefined" ? wrappedLineExtent : undefined,
"wrappedLineExtentChar": typeof wrappedLineExtentChar !== "undefined" ? wrappedLineExtentChar : undefined,
"boxIsAfter": typeof boxIsAfter !== "undefined" ? boxIsAfter : undefined,
"coordsCharInner": typeof coordsCharInner !== "undefined" ? coordsCharInner : undefined,
"coordsBidiPart": typeof coordsBidiPart !== "undefined" ? coordsBidiPart : undefined,
"coordsBidiPartWrapped": typeof coordsBidiPartWrapped !== "undefined" ? coordsBidiPartWrapped : undefined,
"textHeight": typeof textHeight !== "undefined" ? textHeight : undefined,
"charWidth": typeof charWidth !== "undefined" ? charWidth : undefined,
"getDimensions": typeof getDimensions !== "undefined" ? getDimensions : undefined,
"compensateForHScroll": typeof compensateForHScroll !== "undefined" ? compensateForHScroll : undefined,
"that": typeof that !== "undefined" ? that : undefined,
"estimateHeight": typeof estimateHeight !== "undefined" ? estimateHeight : undefined,
"estimateLineHeights": typeof estimateLineHeights !== "undefined" ? estimateLineHeights : undefined,
"posFromMouse": typeof posFromMouse !== "undefined" ? posFromMouse : undefined,
"findViewIndex": typeof findViewIndex !== "undefined" ? findViewIndex : undefined,
"regChange": typeof regChange !== "undefined" ? regChange : undefined,
"regLineChange": typeof regLineChange !== "undefined" ? regLineChange : undefined,
"resetView": typeof resetView !== "undefined" ? resetView : undefined,
"viewCuttingPoint": typeof viewCuttingPoint !== "undefined" ? viewCuttingPoint : undefined,
"adjustView": typeof adjustView !== "undefined" ? adjustView : undefined,
"countDirtyView": typeof countDirtyView !== "undefined" ? countDirtyView : undefined,
"updateSelection": typeof updateSelection !== "undefined" ? updateSelection : undefined,
"prepareSelection": typeof prepareSelection !== "undefined" ? prepareSelection : undefined,
"drawSelectionCursor": typeof drawSelectionCursor !== "undefined" ? drawSelectionCursor : undefined,
"cmpCoords": typeof cmpCoords !== "undefined" ? cmpCoords : undefined,
"drawSelectionRange": typeof drawSelectionRange !== "undefined" ? drawSelectionRange : undefined,
"add": typeof add !== "undefined" ? add : undefined,
"drawForLine": typeof drawForLine !== "undefined" ? drawForLine : undefined,
"coords": typeof coords !== "undefined" ? coords : undefined,
"wrapX": typeof wrapX !== "undefined" ? wrapX : undefined,
"restartBlink": typeof restartBlink !== "undefined" ? restartBlink : undefined,
"ensureFocus": typeof ensureFocus !== "undefined" ? ensureFocus : undefined,
"delayBlurEvent": typeof delayBlurEvent !== "undefined" ? delayBlurEvent : undefined,
"onFocus": typeof onFocus !== "undefined" ? onFocus : undefined,
"onBlur": typeof onBlur !== "undefined" ? onBlur : undefined,
"updateHeightsInViewport": typeof updateHeightsInViewport !== "undefined" ? updateHeightsInViewport : undefined,
"updateWidgetHeight": typeof updateWidgetHeight !== "undefined" ? updateWidgetHeight : undefined,
"visibleLines": typeof visibleLines !== "undefined" ? visibleLines : undefined,
"maybeScrollWindow": typeof maybeScrollWindow !== "undefined" ? maybeScrollWindow : undefined,
"scrollPosIntoView": typeof scrollPosIntoView !== "undefined" ? scrollPosIntoView : undefined,
"scrollIntoView": typeof scrollIntoView !== "undefined" ? scrollIntoView : undefined,
"calculateScrollPos": typeof calculateScrollPos !== "undefined" ? calculateScrollPos : undefined,
"addToScrollTop": typeof addToScrollTop !== "undefined" ? addToScrollTop : undefined,
"ensureCursorVisible": typeof ensureCursorVisible !== "undefined" ? ensureCursorVisible : undefined,
"scrollToCoords": typeof scrollToCoords !== "undefined" ? scrollToCoords : undefined,
"scrollToRange": typeof scrollToRange !== "undefined" ? scrollToRange : undefined,
"resolveScrollToPos": typeof resolveScrollToPos !== "undefined" ? resolveScrollToPos : undefined,
"scrollToCoordsRange": typeof scrollToCoordsRange !== "undefined" ? scrollToCoordsRange : undefined,
"updateScrollTop": typeof updateScrollTop !== "undefined" ? updateScrollTop : undefined,
"setScrollTop": typeof setScrollTop !== "undefined" ? setScrollTop : undefined,
"setScrollLeft": typeof setScrollLeft !== "undefined" ? setScrollLeft : undefined,
"measureForScrollbars": typeof measureForScrollbars !== "undefined" ? measureForScrollbars : undefined,
"maybeDisable": typeof maybeDisable !== "undefined" ? maybeDisable : undefined,
"updateScrollbars": typeof updateScrollbars !== "undefined" ? updateScrollbars : undefined,
"updateScrollbarsInner": typeof updateScrollbarsInner !== "undefined" ? updateScrollbarsInner : undefined,
"initScrollbars": typeof initScrollbars !== "undefined" ? initScrollbars : undefined,
"startOperation": typeof startOperation !== "undefined" ? startOperation : undefined,
"endOperation": typeof endOperation !== "undefined" ? endOperation : undefined,
"endOperations": typeof endOperations !== "undefined" ? endOperations : undefined,
"endOperation_R1": typeof endOperation_R1 !== "undefined" ? endOperation_R1 : undefined,
"endOperation_W1": typeof endOperation_W1 !== "undefined" ? endOperation_W1 : undefined,
"endOperation_R2": typeof endOperation_R2 !== "undefined" ? endOperation_R2 : undefined,
"endOperation_W2": typeof endOperation_W2 !== "undefined" ? endOperation_W2 : undefined,
"endOperation_finish": typeof endOperation_finish !== "undefined" ? endOperation_finish : undefined,
"runInOp": typeof runInOp !== "undefined" ? runInOp : undefined,
"operation": typeof operation !== "undefined" ? operation : undefined,
"methodOp": typeof methodOp !== "undefined" ? methodOp : undefined,
"docMethodOp": typeof docMethodOp !== "undefined" ? docMethodOp : undefined,
"startWorker": typeof startWorker !== "undefined" ? startWorker : undefined,
"highlightWorker": typeof highlightWorker !== "undefined" ? highlightWorker : undefined,
"maybeClipScrollbars": typeof maybeClipScrollbars !== "undefined" ? maybeClipScrollbars : undefined,
"selectionSnapshot": typeof selectionSnapshot !== "undefined" ? selectionSnapshot : undefined,
"restoreSelection": typeof restoreSelection !== "undefined" ? restoreSelection : undefined,
"updateDisplayIfNeeded": typeof updateDisplayIfNeeded !== "undefined" ? updateDisplayIfNeeded : undefined,
"postUpdateDisplay": typeof postUpdateDisplay !== "undefined" ? postUpdateDisplay : undefined,
"updateDisplaySimple": typeof updateDisplaySimple !== "undefined" ? updateDisplaySimple : undefined,
"patchDisplay": typeof patchDisplay !== "undefined" ? patchDisplay : undefined,
"rm": typeof rm !== "undefined" ? rm : undefined,
"updateGutterSpace": typeof updateGutterSpace !== "undefined" ? updateGutterSpace : undefined,
"setDocumentHeight": typeof setDocumentHeight !== "undefined" ? setDocumentHeight : undefined,
"alignHorizontally": typeof alignHorizontally !== "undefined" ? alignHorizontally : undefined,
"maybeUpdateLineNumberWidth": typeof maybeUpdateLineNumberWidth !== "undefined" ? maybeUpdateLineNumberWidth : undefined,
"getGutters": typeof getGutters !== "undefined" ? getGutters : undefined,
"renderGutters": typeof renderGutters !== "undefined" ? renderGutters : undefined,
"updateGutters": typeof updateGutters !== "undefined" ? updateGutters : undefined,
"Display": typeof Display !== "undefined" ? Display : undefined,
"wheelEventDelta": typeof wheelEventDelta !== "undefined" ? wheelEventDelta : undefined,
"wheelEventPixels": typeof wheelEventPixels !== "undefined" ? wheelEventPixels : undefined,
"onScrollWheel": typeof onScrollWheel !== "undefined" ? onScrollWheel : undefined,
"normalizeSelection": typeof normalizeSelection !== "undefined" ? normalizeSelection : undefined,
"simpleSelection": typeof simpleSelection !== "undefined" ? simpleSelection : undefined,
"changeEnd": typeof changeEnd !== "undefined" ? changeEnd : undefined,
"adjustForChange": typeof adjustForChange !== "undefined" ? adjustForChange : undefined,
"computeSelAfterChange": typeof computeSelAfterChange !== "undefined" ? computeSelAfterChange : undefined,
"offsetPos": typeof offsetPos !== "undefined" ? offsetPos : undefined,
"computeReplacedSel": typeof computeReplacedSel !== "undefined" ? computeReplacedSel : undefined,
"loadMode": typeof loadMode !== "undefined" ? loadMode : undefined,
"resetModeState": typeof resetModeState !== "undefined" ? resetModeState : undefined,
"isWholeLineUpdate": typeof isWholeLineUpdate !== "undefined" ? isWholeLineUpdate : undefined,
"updateDoc": typeof updateDoc !== "undefined" ? updateDoc : undefined,
"spansFor": typeof spansFor !== "undefined" ? spansFor : undefined,
"update": typeof update !== "undefined" ? update : undefined,
"linesFor": typeof linesFor !== "undefined" ? linesFor : undefined,
"linkedDocs": typeof linkedDocs !== "undefined" ? linkedDocs : undefined,
"propagate": typeof propagate !== "undefined" ? propagate : undefined,
"attachDoc": typeof attachDoc !== "undefined" ? attachDoc : undefined,
"setDirectionClass": typeof setDirectionClass !== "undefined" ? setDirectionClass : undefined,
"directionChanged": typeof directionChanged !== "undefined" ? directionChanged : undefined,
"History": typeof History !== "undefined" ? History : undefined,
"historyChangeFromChange": typeof historyChangeFromChange !== "undefined" ? historyChangeFromChange : undefined,
"clearSelectionEvents": typeof clearSelectionEvents !== "undefined" ? clearSelectionEvents : undefined,
"lastChangeEvent": typeof lastChangeEvent !== "undefined" ? lastChangeEvent : undefined,
"addChangeToHistory": typeof addChangeToHistory !== "undefined" ? addChangeToHistory : undefined,
"selectionEventCanBeMerged": typeof selectionEventCanBeMerged !== "undefined" ? selectionEventCanBeMerged : undefined,
"addSelectionToHistory": typeof addSelectionToHistory !== "undefined" ? addSelectionToHistory : undefined,
"pushSelectionToHistory": typeof pushSelectionToHistory !== "undefined" ? pushSelectionToHistory : undefined,
"attachLocalSpans": typeof attachLocalSpans !== "undefined" ? attachLocalSpans : undefined,
"removeClearedSpans": typeof removeClearedSpans !== "undefined" ? removeClearedSpans : undefined,
"getOldSpans": typeof getOldSpans !== "undefined" ? getOldSpans : undefined,
"mergeOldSpans": typeof mergeOldSpans !== "undefined" ? mergeOldSpans : undefined,
"copyHistoryArray": typeof copyHistoryArray !== "undefined" ? copyHistoryArray : undefined,
"extendRange": typeof extendRange !== "undefined" ? extendRange : undefined,
"extendSelection": typeof extendSelection !== "undefined" ? extendSelection : undefined,
"extendSelections": typeof extendSelections !== "undefined" ? extendSelections : undefined,
"replaceOneSelection": typeof replaceOneSelection !== "undefined" ? replaceOneSelection : undefined,
"setSimpleSelection": typeof setSimpleSelection !== "undefined" ? setSimpleSelection : undefined,
"filterSelectionChange": typeof filterSelectionChange !== "undefined" ? filterSelectionChange : undefined,
"setSelectionReplaceHistory": typeof setSelectionReplaceHistory !== "undefined" ? setSelectionReplaceHistory : undefined,
"setSelection": typeof setSelection !== "undefined" ? setSelection : undefined,
"setSelectionNoUndo": typeof setSelectionNoUndo !== "undefined" ? setSelectionNoUndo : undefined,
"setSelectionInner": typeof setSelectionInner !== "undefined" ? setSelectionInner : undefined,
"reCheckSelection": typeof reCheckSelection !== "undefined" ? reCheckSelection : undefined,
"skipAtomicInSelection": typeof skipAtomicInSelection !== "undefined" ? skipAtomicInSelection : undefined,
"skipAtomicInner": typeof skipAtomicInner !== "undefined" ? skipAtomicInner : undefined,
"skipAtomic": typeof skipAtomic !== "undefined" ? skipAtomic : undefined,
"movePos": typeof movePos !== "undefined" ? movePos : undefined,
"selectAll": typeof selectAll !== "undefined" ? selectAll : undefined,
"filterChange": typeof filterChange !== "undefined" ? filterChange : undefined,
"makeChange": typeof makeChange !== "undefined" ? makeChange : undefined,
"makeChangeInner": typeof makeChangeInner !== "undefined" ? makeChangeInner : undefined,
"makeChangeFromHistory": typeof makeChangeFromHistory !== "undefined" ? makeChangeFromHistory : undefined,
"shiftDoc": typeof shiftDoc !== "undefined" ? shiftDoc : undefined,
"makeChangeSingleDoc": typeof makeChangeSingleDoc !== "undefined" ? makeChangeSingleDoc : undefined,
"makeChangeSingleDocInEditor": typeof makeChangeSingleDocInEditor !== "undefined" ? makeChangeSingleDocInEditor : undefined,
"replaceRange": typeof replaceRange !== "undefined" ? replaceRange : undefined,
"rebaseHistSelSingle": typeof rebaseHistSelSingle !== "undefined" ? rebaseHistSelSingle : undefined,
"rebaseHistArray": typeof rebaseHistArray !== "undefined" ? rebaseHistArray : undefined,
"rebaseHist": typeof rebaseHist !== "undefined" ? rebaseHist : undefined,
"changeLine": typeof changeLine !== "undefined" ? changeLine : undefined,
"LeafChunk": typeof LeafChunk !== "undefined" ? LeafChunk : undefined,
"BranchChunk": typeof BranchChunk !== "undefined" ? BranchChunk : undefined,
"adjustScrollWhenAboveVisible": typeof adjustScrollWhenAboveVisible !== "undefined" ? adjustScrollWhenAboveVisible : undefined,
"addLineWidget": typeof addLineWidget !== "undefined" ? addLineWidget : undefined,
"markText": typeof markText !== "undefined" ? markText : undefined,
"markTextShared": typeof markTextShared !== "undefined" ? markTextShared : undefined,
"findSharedMarkers": typeof findSharedMarkers !== "undefined" ? findSharedMarkers : undefined,
"copySharedMarkers": typeof copySharedMarkers !== "undefined" ? copySharedMarkers : undefined,
"detachSharedMarkers": typeof detachSharedMarkers !== "undefined" ? detachSharedMarkers : undefined,
"onDrop": typeof onDrop !== "undefined" ? onDrop : undefined,
"onDragStart": typeof onDragStart !== "undefined" ? onDragStart : undefined,
"onDragOver": typeof onDragOver !== "undefined" ? onDragOver : undefined,
"clearDragCursor": typeof clearDragCursor !== "undefined" ? clearDragCursor : undefined,
"forEachCodeMirror": typeof forEachCodeMirror !== "undefined" ? forEachCodeMirror : undefined,
"ensureGlobalHandlers": typeof ensureGlobalHandlers !== "undefined" ? ensureGlobalHandlers : undefined,
"registerGlobalHandlers": typeof registerGlobalHandlers !== "undefined" ? registerGlobalHandlers : undefined,
"onResize": typeof onResize !== "undefined" ? onResize : undefined,
"normalizeKeyName": typeof normalizeKeyName !== "undefined" ? normalizeKeyName : undefined,
"normalizeKeyMap": typeof normalizeKeyMap !== "undefined" ? normalizeKeyMap : undefined,
"lookupKey": typeof lookupKey !== "undefined" ? lookupKey : undefined,
"isModifierKey": typeof isModifierKey !== "undefined" ? isModifierKey : undefined,
"addModifierNames": typeof addModifierNames !== "undefined" ? addModifierNames : undefined,
"keyName": typeof keyName !== "undefined" ? keyName : undefined,
"getKeyMap": typeof getKeyMap !== "undefined" ? getKeyMap : undefined,
"deleteNearSelection": typeof deleteNearSelection !== "undefined" ? deleteNearSelection : undefined,
"moveCharLogically": typeof moveCharLogically !== "undefined" ? moveCharLogically : undefined,
"moveLogically": typeof moveLogically !== "undefined" ? moveLogically : undefined,
"endOfLine": typeof endOfLine !== "undefined" ? endOfLine : undefined,
"moveVisually": typeof moveVisually !== "undefined" ? moveVisually : undefined,
"lineStart": typeof lineStart !== "undefined" ? lineStart : undefined,
"lineEnd": typeof lineEnd !== "undefined" ? lineEnd : undefined,
"lineStartSmart": typeof lineStartSmart !== "undefined" ? lineStartSmart : undefined,
"doHandleBinding": typeof doHandleBinding !== "undefined" ? doHandleBinding : undefined,
"lookupKeyForEditor": typeof lookupKeyForEditor !== "undefined" ? lookupKeyForEditor : undefined,
"is": typeof is !== "undefined" ? is : undefined,
"dispatchKey": typeof dispatchKey !== "undefined" ? dispatchKey : undefined,
"dispatchKeyInner": typeof dispatchKeyInner !== "undefined" ? dispatchKeyInner : undefined,
"handleKeyBinding": typeof handleKeyBinding !== "undefined" ? handleKeyBinding : undefined,
"handleCharBinding": typeof handleCharBinding !== "undefined" ? handleCharBinding : undefined,
"onKeyDown": typeof onKeyDown !== "undefined" ? onKeyDown : undefined,
"showCrossHair": typeof showCrossHair !== "undefined" ? showCrossHair : undefined,
"up": typeof up !== "undefined" ? up : undefined,
"onKeyUp": typeof onKeyUp !== "undefined" ? onKeyUp : undefined,
"onKeyPress": typeof onKeyPress !== "undefined" ? onKeyPress : undefined,
"clickRepeat": typeof clickRepeat !== "undefined" ? clickRepeat : undefined,
"onMouseDown": typeof onMouseDown !== "undefined" ? onMouseDown : undefined,
"handleMappedButton": typeof handleMappedButton !== "undefined" ? handleMappedButton : undefined,
"configureMouse": typeof configureMouse !== "undefined" ? configureMouse : undefined,
"leftButtonDown": typeof leftButtonDown !== "undefined" ? leftButtonDown : undefined,
"leftButtonStartDrag": typeof leftButtonStartDrag !== "undefined" ? leftButtonStartDrag : undefined,
"rangeForUnit": typeof rangeForUnit !== "undefined" ? rangeForUnit : undefined,
"leftButtonSelect": typeof leftButtonSelect !== "undefined" ? leftButtonSelect : undefined,
"extendTo": typeof extendTo !== "undefined" ? extendTo : undefined,
"extend": typeof extend !== "undefined" ? extend : undefined,
"done": typeof done !== "undefined" ? done : undefined,
"bidiSimplify": typeof bidiSimplify !== "undefined" ? bidiSimplify : undefined,
"gutterEvent": typeof gutterEvent !== "undefined" ? gutterEvent : undefined,
"clickInGutter": typeof clickInGutter !== "undefined" ? clickInGutter : undefined,
"onContextMenu": typeof onContextMenu !== "undefined" ? onContextMenu : undefined,
"contextMenuInGutter": typeof contextMenuInGutter !== "undefined" ? contextMenuInGutter : undefined,
"themeChanged": typeof themeChanged !== "undefined" ? themeChanged : undefined,
"defineOptions": typeof defineOptions !== "undefined" ? defineOptions : undefined,
"option": typeof option !== "undefined" ? option : undefined,
"dragDropChanged": typeof dragDropChanged !== "undefined" ? dragDropChanged : undefined,
"wrappingChanged": typeof wrappingChanged !== "undefined" ? wrappingChanged : undefined,
"CodeMirror": typeof CodeMirror !== "undefined" ? CodeMirror : undefined,
"registerEventHandlers": typeof registerEventHandlers !== "undefined" ? registerEventHandlers : undefined,
"finishTouch": typeof finishTouch !== "undefined" ? finishTouch : undefined,
"isMouseLikeTouchEvent": typeof isMouseLikeTouchEvent !== "undefined" ? isMouseLikeTouchEvent : undefined,
"farAway": typeof farAway !== "undefined" ? farAway : undefined,
"indentLine": typeof indentLine !== "undefined" ? indentLine : undefined,
"setLastCopied": typeof setLastCopied !== "undefined" ? setLastCopied : undefined,
"applyTextInput": typeof applyTextInput !== "undefined" ? applyTextInput : undefined,
"handlePaste": typeof handlePaste !== "undefined" ? handlePaste : undefined,
"triggerElectric": typeof triggerElectric !== "undefined" ? triggerElectric : undefined,
"copyableRanges": typeof copyableRanges !== "undefined" ? copyableRanges : undefined,
"disableBrowserMagic": typeof disableBrowserMagic !== "undefined" ? disableBrowserMagic : undefined,
"hiddenTextarea": typeof hiddenTextarea !== "undefined" ? hiddenTextarea : undefined,
"addEditorMethods": typeof addEditorMethods !== "undefined" ? addEditorMethods : undefined,
"findPosH": typeof findPosH !== "undefined" ? findPosH : undefined,
"findNextLine": typeof findNextLine !== "undefined" ? findNextLine : undefined,
"moveOnce": typeof moveOnce !== "undefined" ? moveOnce : undefined,
"findPosV": typeof findPosV !== "undefined" ? findPosV : undefined,
"belongsToInput": typeof belongsToInput !== "undefined" ? belongsToInput : undefined,
"onCopyCut": typeof onCopyCut !== "undefined" ? onCopyCut : undefined,
"poll": typeof poll !== "undefined" ? poll : undefined,
"posToDOM": typeof posToDOM !== "undefined" ? posToDOM : undefined,
"isInGutter": typeof isInGutter !== "undefined" ? isInGutter : undefined,
"badPos": typeof badPos !== "undefined" ? badPos : undefined,
"domTextBetween": typeof domTextBetween !== "undefined" ? domTextBetween : undefined,
"recognizeMarker": typeof recognizeMarker !== "undefined" ? recognizeMarker : undefined,
"close": typeof close !== "undefined" ? close : undefined,
"addText": typeof addText !== "undefined" ? addText : undefined,
"walk": typeof walk !== "undefined" ? walk : undefined,
"domToPos": typeof domToPos !== "undefined" ? domToPos : undefined,
"locateNodeInLineView": typeof locateNodeInLineView !== "undefined" ? locateNodeInLineView : undefined,
"find": typeof find !== "undefined" ? find : undefined,
"prepareCopyCut": typeof prepareCopyCut !== "undefined" ? prepareCopyCut : undefined,
"p": typeof p !== "undefined" ? p : undefined,
"prepareSelectAllHack": typeof prepareSelectAllHack !== "undefined" ? prepareSelectAllHack : undefined,
"rehide": typeof rehide !== "undefined" ? rehide : undefined,
"fromTextArea": typeof fromTextArea !== "undefined" ? fromTextArea : undefined,
"save": typeof save !== "undefined" ? save : undefined,
"addLegacyProps": typeof addLegacyProps !== "undefined" ? addLegacyProps : undefined,
"that": typeof that !== "undefined" ? that : undefined,
"inText": typeof inText !== "undefined" ? inText : undefined,
"chain": typeof chain !== "undefined" ? chain : undefined,
"inTag": typeof inTag !== "undefined" ? inTag : undefined,
"inAttribute": typeof inAttribute !== "undefined" ? inAttribute : undefined,
"inBlock": typeof inBlock !== "undefined" ? inBlock : undefined,
"doctype": typeof doctype !== "undefined" ? doctype : undefined,
"lower": typeof lower !== "undefined" ? lower : undefined,
"Context": typeof Context !== "undefined" ? Context : undefined,
"popContext": typeof popContext !== "undefined" ? popContext : undefined,
"maybePopContext": typeof maybePopContext !== "undefined" ? maybePopContext : undefined,
"baseState": typeof baseState !== "undefined" ? baseState : undefined,
"tagNameState": typeof tagNameState !== "undefined" ? tagNameState : undefined,
"closeTagNameState": typeof closeTagNameState !== "undefined" ? closeTagNameState : undefined,
"closeState": typeof closeState !== "undefined" ? closeState : undefined,
"closeStateErr": typeof closeStateErr !== "undefined" ? closeStateErr : undefined,
"attrState": typeof attrState !== "undefined" ? attrState : undefined,
"attrEqState": typeof attrEqState !== "undefined" ? attrEqState : undefined,
"attrValueState": typeof attrValueState !== "undefined" ? attrValueState : undefined,
"attrContinuedState": typeof attrContinuedState !== "undefined" ? attrContinuedState : undefined,
"ret": typeof ret !== "undefined" ? ret : undefined,
"tokenBase": typeof tokenBase !== "undefined" ? tokenBase : undefined,
"tokenString": typeof tokenString !== "undefined" ? tokenString : undefined,
"tokenParenthesized": typeof tokenParenthesized !== "undefined" ? tokenParenthesized : undefined,
"Context": typeof Context !== "undefined" ? Context : undefined,
"pushContext": typeof pushContext !== "undefined" ? pushContext : undefined,
"popContext": typeof popContext !== "undefined" ? popContext : undefined,
"pass": typeof pass !== "undefined" ? pass : undefined,
"popAndPass": typeof popAndPass !== "undefined" ? popAndPass : undefined,
"wordAsValue": typeof wordAsValue !== "undefined" ? wordAsValue : undefined,
"keySet": typeof keySet !== "undefined" ? keySet : undefined,
"tokenCComment": typeof tokenCComment !== "undefined" ? tokenCComment : undefined,
"kw": typeof kw !== "undefined" ? kw : undefined,
"readRegexp": typeof readRegexp !== "undefined" ? readRegexp : undefined,
"ret": typeof ret !== "undefined" ? ret : undefined,
"tokenBase": typeof tokenBase !== "undefined" ? tokenBase : undefined,
"tokenString": typeof tokenString !== "undefined" ? tokenString : undefined,
"tokenComment": typeof tokenComment !== "undefined" ? tokenComment : undefined,
"tokenQuasi": typeof tokenQuasi !== "undefined" ? tokenQuasi : undefined,
"before": typeof before !== "undefined" ? before : undefined,
"findFatArrow": typeof findFatArrow !== "undefined" ? findFatArrow : undefined,
"JSLexical": typeof JSLexical !== "undefined" ? JSLexical : undefined,
"inScope": typeof inScope !== "undefined" ? inScope : undefined,
"parseJS": typeof parseJS !== "undefined" ? parseJS : undefined,
"pass": typeof pass !== "undefined" ? pass : undefined,
"cont": typeof cont !== "undefined" ? cont : undefined,
"inList": typeof inList !== "undefined" ? inList : undefined,
"register": typeof register !== "undefined" ? register : undefined,
"decls": typeof decls !== "undefined" ? decls : undefined,
"registerVarScoped": typeof registerVarScoped !== "undefined" ? registerVarScoped : undefined,
"isModifier": typeof isModifier !== "undefined" ? isModifier : undefined,
"Context": typeof Context !== "undefined" ? Context : undefined,
"Var": typeof Var !== "undefined" ? Var : undefined,
"pushcontext": typeof pushcontext !== "undefined" ? pushcontext : undefined,
"pushblockcontext": typeof pushblockcontext !== "undefined" ? pushblockcontext : undefined,
"popcontext": typeof popcontext !== "undefined" ? popcontext : undefined,
"pushlex": typeof pushlex !== "undefined" ? pushlex : undefined,
"poplex": typeof poplex !== "undefined" ? poplex : undefined,
"expect": typeof expect !== "undefined" ? expect : undefined,
"exp": typeof exp !== "undefined" ? exp : undefined,
"statement": typeof statement !== "undefined" ? statement : undefined,
"maybeCatchBinding": typeof maybeCatchBinding !== "undefined" ? maybeCatchBinding : undefined,
"expression": typeof expression !== "undefined" ? expression : undefined,
"expressionNoComma": typeof expressionNoComma !== "undefined" ? expressionNoComma : undefined,
"parenExpr": typeof parenExpr !== "undefined" ? parenExpr : undefined,
"expressionInner": typeof expressionInner !== "undefined" ? expressionInner : undefined,
"maybeexpression": typeof maybeexpression !== "undefined" ? maybeexpression : undefined,
"maybeoperatorComma": typeof maybeoperatorComma !== "undefined" ? maybeoperatorComma : undefined,
"maybeoperatorNoComma": typeof maybeoperatorNoComma !== "undefined" ? maybeoperatorNoComma : undefined,
"quasi": typeof quasi !== "undefined" ? quasi : undefined,
"continueQuasi": typeof continueQuasi !== "undefined" ? continueQuasi : undefined,
"arrowBody": typeof arrowBody !== "undefined" ? arrowBody : undefined,
"arrowBodyNoComma": typeof arrowBodyNoComma !== "undefined" ? arrowBodyNoComma : undefined,
"maybeTarget": typeof maybeTarget !== "undefined" ? maybeTarget : undefined,
"target": typeof target !== "undefined" ? target : undefined,
"targetNoComma": typeof targetNoComma !== "undefined" ? targetNoComma : undefined,
"maybelabel": typeof maybelabel !== "undefined" ? maybelabel : undefined,
"property": typeof property !== "undefined" ? property : undefined,
"objprop": typeof objprop !== "undefined" ? objprop : undefined,
"getterSetter": typeof getterSetter !== "undefined" ? getterSetter : undefined,
"afterprop": typeof afterprop !== "undefined" ? afterprop : undefined,
"commasep": typeof commasep !== "undefined" ? commasep : undefined,
"proceed": typeof proceed !== "undefined" ? proceed : undefined,
"contCommasep": typeof contCommasep !== "undefined" ? contCommasep : undefined,
"block": typeof block !== "undefined" ? block : undefined,
"maybetype": typeof maybetype !== "undefined" ? maybetype : undefined,
"maybetypeOrIn": typeof maybetypeOrIn !== "undefined" ? maybetypeOrIn : undefined,
"mayberettype": typeof mayberettype !== "undefined" ? mayberettype : undefined,
"isKW": typeof isKW !== "undefined" ? isKW : undefined,
"typeexpr": typeof typeexpr !== "undefined" ? typeexpr : undefined,
"maybeReturnType": typeof maybeReturnType !== "undefined" ? maybeReturnType : undefined,
"typeprops": typeof typeprops !== "undefined" ? typeprops : undefined,
"typeprop": typeof typeprop !== "undefined" ? typeprop : undefined,
"quasiType": typeof quasiType !== "undefined" ? quasiType : undefined,
"continueQuasiType": typeof continueQuasiType !== "undefined" ? continueQuasiType : undefined,
"typearg": typeof typearg !== "undefined" ? typearg : undefined,
"afterType": typeof afterType !== "undefined" ? afterType : undefined,
"maybeTypeArgs": typeof maybeTypeArgs !== "undefined" ? maybeTypeArgs : undefined,
"typeparam": typeof typeparam !== "undefined" ? typeparam : undefined,
"maybeTypeDefault": typeof maybeTypeDefault !== "undefined" ? maybeTypeDefault : undefined,
"vardef": typeof vardef !== "undefined" ? vardef : undefined,
"pattern": typeof pattern !== "undefined" ? pattern : undefined,
"proppattern": typeof proppattern !== "undefined" ? proppattern : undefined,
"eltpattern": typeof eltpattern !== "undefined" ? eltpattern : undefined,
"maybeAssign": typeof maybeAssign !== "undefined" ? maybeAssign : undefined,
"vardefCont": typeof vardefCont !== "undefined" ? vardefCont : undefined,
"maybeelse": typeof maybeelse !== "undefined" ? maybeelse : undefined,
"forspec": typeof forspec !== "undefined" ? forspec : undefined,
"forspec1": typeof forspec1 !== "undefined" ? forspec1 : undefined,
"forspec2": typeof forspec2 !== "undefined" ? forspec2 : undefined,
"functiondef": typeof functiondef !== "undefined" ? functiondef : undefined,
"functiondecl": typeof functiondecl !== "undefined" ? functiondecl : undefined,
"typename": typeof typename !== "undefined" ? typename : undefined,
"funarg": typeof funarg !== "undefined" ? funarg : undefined,
"classExpression": typeof classExpression !== "undefined" ? classExpression : undefined,
"className": typeof className !== "undefined" ? className : undefined,
"classNameAfter": typeof classNameAfter !== "undefined" ? classNameAfter : undefined,
"classBody": typeof classBody !== "undefined" ? classBody : undefined,
"classfield": typeof classfield !== "undefined" ? classfield : undefined,
"afterExport": typeof afterExport !== "undefined" ? afterExport : undefined,
"exportField": typeof exportField !== "undefined" ? exportField : undefined,
"afterImport": typeof afterImport !== "undefined" ? afterImport : undefined,
"importSpec": typeof importSpec !== "undefined" ? importSpec : undefined,
"maybeMoreImports": typeof maybeMoreImports !== "undefined" ? maybeMoreImports : undefined,
"maybeAs": typeof maybeAs !== "undefined" ? maybeAs : undefined,
"maybeFrom": typeof maybeFrom !== "undefined" ? maybeFrom : undefined,
"arrayLiteral": typeof arrayLiteral !== "undefined" ? arrayLiteral : undefined,
"enumdef": typeof enumdef !== "undefined" ? enumdef : undefined,
"enummember": typeof enummember !== "undefined" ? enummember : undefined,
"isContinuedStatement": typeof isContinuedStatement !== "undefined" ? isContinuedStatement : undefined,
"expressionAllowed": typeof expressionAllowed !== "undefined" ? expressionAllowed : undefined,
"maybeBackup": typeof maybeBackup !== "undefined" ? maybeBackup : undefined,
"getAttrRegexp": typeof getAttrRegexp !== "undefined" ? getAttrRegexp : undefined,
"getAttrValue": typeof getAttrValue !== "undefined" ? getAttrValue : undefined,
"getTagRegexp": typeof getTagRegexp !== "undefined" ? getTagRegexp : undefined,
"addTags": typeof addTags !== "undefined" ? addTags : undefined,
"findMatchingMode": typeof findMatchingMode !== "undefined" ? findMatchingMode : undefined,
"html": typeof html !== "undefined" ? html : undefined,
"tokenBase": typeof tokenBase !== "undefined" ? tokenBase : undefined,
"inString": typeof inString !== "undefined" ? inString : undefined,
"inVariable": typeof inVariable !== "undefined" ? inVariable : undefined,
"inTag": typeof inTag !== "undefined" ? inTag : undefined,
"inComment": typeof inComment !== "undefined" ? inComment : undefined,
"inBlockComment": typeof inBlockComment !== "undefined" ? inBlockComment : undefined,
"getComponentDefs": typeof getComponentDefs !== "undefined" ? getComponentDefs : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["x829hs9"]= function (tagName, modulo){

    const { Props, Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_x_DemoModal'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[3], modulo);
    class DemoModal extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1rpq1pk';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_x_DemoModal'];
        }
    }
    modulo.globals.customElements.define(tagName, DemoModal);
    //console.log("Registered: DemoModal as " + tagName);
    return DemoModal;

};
currentModulo.assets.functions["j6jhe5"]= function (tagName, modulo){

    const { Props, Template, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_x_DemoChart'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class DemoChart extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1sgecs4';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_x_DemoChart'];
        }
    }
    modulo.globals.customElements.define(tagName, DemoChart);
    //console.log("Registered: DemoChart as " + tagName);
    return DemoChart;

};
currentModulo.assets.functions["u4j43f"]= function (tagName, modulo){

    const { Props, Template, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_x_ExampleBtn'];
    const initRenderObj = {};
    class ExampleBtn extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'i2kvpp';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_x_ExampleBtn'];
        }
    }
    modulo.globals.customElements.define(tagName, ExampleBtn);
    //console.log("Registered: ExampleBtn as " + tagName);
    return ExampleBtn;

};
currentModulo.assets.functions["x1jemelq"]= function (tagName, modulo){

    const { Props, Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_x_DemoSelector'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[3], modulo);
    class DemoSelector extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'ripjvb';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_x_DemoSelector'];
        }
    }
    modulo.globals.customElements.define(tagName, DemoSelector);
    //console.log("Registered: DemoSelector as " + tagName);
    return DemoSelector;

};
currentModulo.assets.functions["rbuqe3"]= function (tagName, modulo){

    const { Props, Style, Template, Script } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_mws_Page'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[3], modulo);
    class Page extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1apn7pv';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_mws_Page'];
        }
    }
    modulo.globals.customElements.define(tagName, Page);
    //console.log("Registered: Page as " + tagName);
    return Page;

};
currentModulo.assets.functions["x1ek8a23"]= function (tagName, modulo){

    const { Props, Template, State } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_mws_DevLogNav'];
    const initRenderObj = {};
    class DevLogNav extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'hdrs3f';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_mws_DevLogNav'];
        }
    }
    modulo.globals.customElements.define(tagName, DevLogNav);
    //console.log("Registered: DevLogNav as " + tagName);
    return DevLogNav;

};
currentModulo.assets.functions["xlb2rd4"]= function (tagName, modulo){

    const { Props, Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_mws_DocSidebar'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[3], modulo);
    class DocSidebar extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '15strma';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_mws_DocSidebar'];
        }
    }
    modulo.globals.customElements.define(tagName, DocSidebar);
    //console.log("Registered: DocSidebar as " + tagName);
    return DocSidebar;

};
currentModulo.assets.functions["xae74iu"]= function (tagName, modulo){

    const { Props, Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_mws_Demo'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[3], modulo);
    class Demo extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1jolobd';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_mws_Demo'];
        }
    }
    modulo.globals.customElements.define(tagName, Demo);
    //console.log("Registered: Demo as " + tagName);
    return Demo;

};
currentModulo.assets.functions["xescvna"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_mws_AllExamples'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class AllExamples extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x3m56c2';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_mws_AllExamples'];
        }
    }
    modulo.globals.customElements.define(tagName, AllExamples);
    //console.log("Registered: AllExamples as " + tagName);
    return AllExamples;

};
currentModulo.assets.functions["x2s8nar"]= function (tagName, modulo){

    const { Props, Template, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_mws_Section'];
    const initRenderObj = {};
    class Section extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1d1j0ca';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_mws_Section'];
        }
    }
    modulo.globals.customElements.define(tagName, Section);
    //console.log("Registered: Section as " + tagName);
    return Section;

};
currentModulo.assets.functions["x1s5o68b"]= function (tagName, modulo){

    const { Template, State, Script } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Templating_1'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class Templating_1 extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'g1ev96';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Templating_1'];
        }
    }
    modulo.globals.customElements.define(tagName, Templating_1);
    //console.log("Registered: Templating_1 as " + tagName);
    return Templating_1;

};
currentModulo.assets.functions["x1ut59dd"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Templating_PrepareCallback'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class Templating_PrepareCallback extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1u7tsfu';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Templating_PrepareCallback'];
        }
    }
    modulo.globals.customElements.define(tagName, Templating_PrepareCallback);
    //console.log("Registered: Templating_PrepareCallback as " + tagName);
    return Templating_PrepareCallback;

};
currentModulo.assets.functions["1hpjg9n"]= function (tagName, modulo){

    const { Template } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Templating_Comments'];
    const initRenderObj = {};
    class Templating_Comments extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'l7svrm';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Templating_Comments'];
        }
    }
    modulo.globals.customElements.define(tagName, Templating_Comments);
    //console.log("Registered: Templating_Comments as " + tagName);
    return Templating_Comments;

};
currentModulo.assets.functions["xfvvd04"]= function (tagName, modulo){

    const { Template, State, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Templating_Escaping'];
    const initRenderObj = {};
    class Templating_Escaping extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1ehsatd';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Templating_Escaping'];
        }
    }
    modulo.globals.customElements.define(tagName, Templating_Escaping);
    //console.log("Registered: Templating_Escaping as " + tagName);
    return Templating_Escaping;

};
currentModulo.assets.functions["1tlgcio"]= function (tagName, modulo){

    const { Template, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Tutorial_P1'];
    const initRenderObj = {};
    class Tutorial_P1 extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x51qst3';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Tutorial_P1'];
        }
    }
    modulo.globals.customElements.define(tagName, Tutorial_P1);
    //console.log("Registered: Tutorial_P1 as " + tagName);
    return Tutorial_P1;

};
currentModulo.assets.functions["xi6k4ld"]= function (tagName, modulo){

    const { Template } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Tutorial_P2'];
    const initRenderObj = {};
    class Tutorial_P2 extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1uj7p64';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Tutorial_P2'];
        }
    }
    modulo.globals.customElements.define(tagName, Tutorial_P2);
    //console.log("Registered: Tutorial_P2 as " + tagName);
    return Tutorial_P2;

};
currentModulo.assets.functions["x1dbdrel"]= function (tagName, modulo){

    const { Template } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Tutorial_P2_filters_demo'];
    const initRenderObj = {};
    class Tutorial_P2_filters_demo extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 't0upt6';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Tutorial_P2_filters_demo'];
        }
    }
    modulo.globals.customElements.define(tagName, Tutorial_P2_filters_demo);
    //console.log("Registered: Tutorial_P2_filters_demo as " + tagName);
    return Tutorial_P2_filters_demo;

};
currentModulo.assets.functions["xflbnij"]= function (tagName, modulo){

    const { Template, State, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Tutorial_P3_state_demo'];
    const initRenderObj = {};
    class Tutorial_P3_state_demo extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1oig15e';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Tutorial_P3_state_demo'];
        }
    }
    modulo.globals.customElements.define(tagName, Tutorial_P3_state_demo);
    //console.log("Registered: Tutorial_P3_state_demo as " + tagName);
    return Tutorial_P3_state_demo;

};
currentModulo.assets.functions["x14n2s57"]= function (tagName, modulo){

    const { Template, State } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_docseg_Tutorial_P3_state_bind'];
    const initRenderObj = {};
    class Tutorial_P3_state_bind extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'ngpccm';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_docseg_Tutorial_P3_state_bind'];
        }
    }
    modulo.globals.customElements.define(tagName, Tutorial_P3_state_bind);
    //console.log("Registered: Tutorial_P3_state_bind as " + tagName);
    return Tutorial_P3_state_bind;

};
currentModulo.assets.functions["1sp05hb"]= function (tagName, modulo){

    const { Template, State, Script } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_Hello'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class Hello extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1icoagp';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_Hello'];
        }
    }
    modulo.globals.customElements.define(tagName, Hello);
    //console.log("Registered: Hello as " + tagName);
    return Hello;

};
currentModulo.assets.functions["12v9omt"]= function (tagName, modulo){

    const { Template, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_Simple'];
    const initRenderObj = {};
    class Simple extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'xlo7cf3';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_Simple'];
        }
    }
    modulo.globals.customElements.define(tagName, Simple);
    //console.log("Registered: Simple as " + tagName);
    return Simple;

};
currentModulo.assets.functions["x1i4hc01"]= function (tagName, modulo){

    const { Template, State, Script } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_ToDo'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class ToDo extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1k33iqb';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_ToDo'];
        }
    }
    modulo.globals.customElements.define(tagName, ToDo);
    //console.log("Registered: ToDo as " + tagName);
    return ToDo;

};
currentModulo.assets.functions["xqrkh3q"]= function (tagName, modulo){

    const { Template, StaticData } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_JSON'];
    const initRenderObj = {};
    initRenderObj.staticdata = StaticData.factoryCallback(initRenderObj, confArray[1], modulo);
    class JSON extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x11tjlh2';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_JSON'];
        }
    }
    modulo.globals.customElements.define(tagName, JSON);
    //console.log("Registered: JSON as " + tagName);
    return JSON;

};
currentModulo.assets.functions["x1asnbs6"]= function (tagName, modulo){

    const { Template, StaticData } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_JSONArray'];
    const initRenderObj = {};
    initRenderObj.staticdata = StaticData.factoryCallback(initRenderObj, confArray[1], modulo);
    class JSONArray extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'xcql4f2';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_JSONArray'];
        }
    }
    modulo.globals.customElements.define(tagName, JSONArray);
    //console.log("Registered: JSONArray as " + tagName);
    return JSONArray;

};
currentModulo.assets.functions["x1edl05g"]= function (tagName, modulo){

    const { Template, State, Script } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_API'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class API extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1at59fc';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_API'];
        }
    }
    modulo.globals.customElements.define(tagName, API);
    //console.log("Registered: API as " + tagName);
    return API;

};
currentModulo.assets.functions["khu4dj"]= function (tagName, modulo){

    const { Template, State } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_ColorSelector'];
    const initRenderObj = {};
    class ColorSelector extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '6riop6';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_ColorSelector'];
        }
    }
    modulo.globals.customElements.define(tagName, ColorSelector);
    //console.log("Registered: ColorSelector as " + tagName);
    return ColorSelector;

};
currentModulo.assets.functions["q0bbc"]= function (tagName, modulo){

    const { Template, State, StaticData, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_SearchBox'];
    const initRenderObj = {};
    initRenderObj.staticdata = StaticData.factoryCallback(initRenderObj, confArray[2], modulo);
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[3], modulo);
    class SearchBox extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'ljc2i4';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_SearchBox'];
        }
    }
    modulo.globals.customElements.define(tagName, SearchBox);
    //console.log("Registered: SearchBox as " + tagName);
    return SearchBox;

};
currentModulo.assets.functions["x3ue3jq"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_DateNumberPicker'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class DateNumberPicker extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1i6hhtf';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_DateNumberPicker'];
        }
    }
    modulo.globals.customElements.define(tagName, DateNumberPicker);
    //console.log("Registered: DateNumberPicker as " + tagName);
    return DateNumberPicker;

};
currentModulo.assets.functions["x1lvrjsl"]= function (tagName, modulo){

    const { Template, State } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_FlexibleForm'];
    const initRenderObj = {};
    class FlexibleForm extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x4vivet';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_FlexibleForm'];
        }
    }
    modulo.globals.customElements.define(tagName, FlexibleForm);
    //console.log("Registered: FlexibleForm as " + tagName);
    return FlexibleForm;

};
currentModulo.assets.functions["x1gjb161"]= function (tagName, modulo){

    const { Template, State, Script } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_FlexibleFormWithAPI'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class FlexibleFormWithAPI extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1sg84mj';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_FlexibleFormWithAPI'];
        }
    }
    modulo.globals.customElements.define(tagName, FlexibleFormWithAPI);
    //console.log("Registered: FlexibleFormWithAPI as " + tagName);
    return FlexibleFormWithAPI;

};
currentModulo.assets.functions["x573nef"]= function (tagName, modulo){

    const { Template } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_Components'];
    const initRenderObj = {};
    class Components extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'xeg9s6i';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_Components'];
        }
    }
    modulo.globals.customElements.define(tagName, Components);
    //console.log("Registered: Components as " + tagName);
    return Components;

};
currentModulo.assets.functions["dib48s"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_OscillatingGraph'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class OscillatingGraph extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'ugu6po';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_OscillatingGraph'];
        }
    }
    modulo.globals.customElements.define(tagName, OscillatingGraph);
    //console.log("Registered: OscillatingGraph as " + tagName);
    return OscillatingGraph;

};
currentModulo.assets.functions["1f849r0"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_PrimeSieve'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class PrimeSieve extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '1b9a0ql';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_PrimeSieve'];
        }
    }
    modulo.globals.customElements.define(tagName, PrimeSieve);
    //console.log("Registered: PrimeSieve as " + tagName);
    return PrimeSieve;

};
currentModulo.assets.functions["1n2i9fj"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_MemoryGame'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class MemoryGame extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = '14schu5';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_MemoryGame'];
        }
    }
    modulo.globals.customElements.define(tagName, MemoryGame);
    //console.log("Registered: MemoryGame as " + tagName);
    return MemoryGame;

};
currentModulo.assets.functions["86fv1g"]= function (tagName, modulo){

    const { Template, State, Script, Style } = modulo.registry.cparts;
    const confArray = modulo.defs['x_x_eg_ConwayGameOfLife'];
    const initRenderObj = {};
    initRenderObj.script = Script.factoryCallback(initRenderObj, confArray[2], modulo);
    class ConwayGameOfLife extends modulo.registry.utils.BaseElement {
        constructor() {
            super();
            this.modulo = modulo;
            this.defHash = 'x1ketdcf';
            this.initRenderObj = initRenderObj;
            this.moduloChildrenData = confArray;
            this.moduloComponentConf = modulo.parentDefs['x_x_eg_ConwayGameOfLife'];
        }
    }
    modulo.globals.customElements.define(tagName, ConwayGameOfLife);
    //console.log("Registered: ConwayGameOfLife as " + tagName);
    return ConwayGameOfLife;

};
currentModulo.assets.functions["1pdamd5"]= function (CTX, G){
var OUT=[];
  OUT.push("\n        <button @click:=\"script.show\">"); // "<button @click:=\"script.show\">"
  OUT.push(G.escapeText(CTX.props.button)); // "props.button"
  OUT.push(" ⬇☐&nbsp;</button>\n        <div class=\"modal-backdrop\" @click:=\"script.hide\" style=\"display: "); // "⬇☐&nbsp;</button><div class=\"modal-backdrop\" @click:=\"script.hide\" style=\"display:"
  if (CTX.state.visible) { // "if state.visible"
  OUT.push("block"); // "block"
  } else { // "else"
  OUT.push("none"); // "none"
  } // "endif"
  OUT.push("\">\n        </div>\n        <div class=\"modal-body\" style=\"\n        "); // "\"></div><div class=\"modal-body\" style=\""
  if (CTX.state.visible) { // "if state.visible"
  OUT.push(" top: 100px; "); // "top: 100px;"
  } else { // "else"
  OUT.push(" top: -500px; "); // "top: -500px;"
  } // "endif"
  OUT.push("\">\n            <h2>"); // "\"><h2>"
  OUT.push(G.escapeText(CTX.props.title)); // "props.title"
  OUT.push(" <button @click:=\"script.hide\">×</button></h2>\n            <slot></slot>\n        </div>\n    "); // "<button @click:=\"script.hide\">×</button></h2><slot></slot></div>"

return OUT.join("");
};
currentModulo.assets.functions["16849hb"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function show() {
            state.visible = true;
        }
        function hide() {
            state.visible = false;
        }
    
return { "show": typeof show !== "undefined" ? show : undefined,
"hide": typeof hide !== "undefined" ? hide : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1k78eap"]= function (CTX, G){
var OUT=[];
  OUT.push("\n        <div class=\"chart-container\n        "); // "<div class=\"chart-container"
  if (CTX.props.animated) { // "if props.animated"
  OUT.push("animated"); // "animated"
  } // "endif"
  OUT.push("\">\n            "); // "\">"
  var ARR0=CTX.script.percent;for (var KEY in ARR0) {CTX. percent=ARR0[KEY]; // "for percent in script.percent"
  OUT.push("\n                <div style=\"height: "); // "<div style=\"height:"
  OUT.push(G.escapeText(CTX.percent)); // "percent"
  OUT.push("px; width: "); // "px; width:"
  OUT.push(G.escapeText(CTX.script.width)); // "script.width"
  OUT.push("px\">\n                </div>\n            "); // "px\"></div>"
  } // "endfor"
  OUT.push("\n        </div>\n        "); // "</div>"
  if (!(CTX.props.animated)) { // "if not props.animated"
  OUT.push("\n            "); // ""
  var ARR1=CTX.props.data;for (var KEY in ARR1) {CTX. value=ARR1[KEY]; // "for value in props.data"
  OUT.push("\n                <label style=\"width: "); // "<label style=\"width:"
  OUT.push(G.escapeText(CTX.script.width)); // "script.width"
  OUT.push("px\">"); // "px\">"
  OUT.push(G.escapeText(CTX.value)); // "value"
  OUT.push("</label>\n            "); // "</label>"
  } // "endfor"
  OUT.push("\n        "); // ""
  } // "endif"
  OUT.push("\n    "); // ""

return OUT.join("");
};
currentModulo.assets.functions["3hrifc"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function prepareCallback() {
            const data = props.data || [];
            const max = Math.max(...data);
            const min = 0;// Math.min(...props.data),
            return {
                percent: data.map(item => ((item - min) / max) * 100),
                width: Math.floor(100 / data.length),
            }
        }
    
return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["xdq8aqd"]= function (CTX, G){
var OUT=[];
  OUT.push("\n        <button class=\"my-btn my-btn__"); // "<button class=\"my-btn my-btn__"
  OUT.push(G.escapeText(CTX.props.shape)); // "props.shape"
  OUT.push("\">\n            "); // "\">"
  OUT.push(G.escapeText(CTX.props.label)); // "props.label"
  OUT.push("\n        </button>\n    "); // "</button>"

return OUT.join("");
};
currentModulo.assets.functions["xaqkmi6"]= function (CTX, G){
var OUT=[];
  OUT.push("\n        "); // ""
  var ARR0=CTX.props.options;for (var KEY in ARR0) {CTX. option=ARR0[KEY]; // "for option in props.options"
  OUT.push("\n            <input type=\"radio\" id=\""); // "<input type=\"radio\" id=\""
  OUT.push(G.escapeText(CTX.props.name)); // "props.name"
  OUT.push("_"); // "_"
  OUT.push(G.escapeText(CTX.option)); // "option"
  OUT.push("\" name=\""); // "\" name=\""
  OUT.push(G.escapeText(CTX.props.name)); // "props.name"
  OUT.push("\" payload=\""); // "\" payload=\""
  OUT.push(G.escapeText(CTX.option)); // "option"
  OUT.push("\" @change:=\"script.setValue\"><label for=\""); // "\" @change:=\"script.setValue\"><label for=\""
  OUT.push(G.escapeText(CTX.props.name)); // "props.name"
  OUT.push("_"); // "_"
  OUT.push(G.escapeText(CTX.option)); // "option"
  OUT.push("\">"); // "\">"
  OUT.push(G.escapeText(CTX.option)); // "option"
  OUT.push("</label>\n        "); // "</label>"
  } // "endfor"
  OUT.push("\n    "); // ""

return OUT.join("");
};
currentModulo.assets.functions["x17kp43e"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function prepareCallback() {
            state.value = element.value;
        }
        function setValue(val) {
            state.value = val;
            element.value = val;
            element.dispatchEvent(new Event('change'));
        }
    
return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
"setValue": typeof setValue !== "undefined" ? setValue : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["x1t2vqnu"]= function (CTX, G){
var OUT=[];
  OUT.push("<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf8\" />\n    <title>"); // "<!DOCTYPE html><html><head><meta charset=\"utf8\" /><title>"
  OUT.push(G.escapeText(CTX.props.pagetitle)); // "props.pagetitle"
  OUT.push(" - modulojs.org</title>\n    <link rel=\"icon\" type=\"image/png\" href=\"/img/mono_logo.png\" />\n\n    <!-- Some global CSS that is not tied to any component: -->\n    <link rel=\"stylesheet\" href=\"/js/codemirror_5.63.0/codemirror_bundled.css\" />\n</head>\n<body>\n\n<slot name=\"above-navbar\"></slot>\n\n<nav class=\"Navbar\">\n    <a href=\"/index.html\"><img src=\"/img/mono_logo.png\" style=\"height:70px\" alt=\"Modulo\" /></a>\n    <ul>\n        <li>\n            <a href=\"/index.html#about\" "); // "- modulojs.org</title><link rel=\"icon\" type=\"image/png\" href=\"/img/mono_logo.png\" /><!-- Some global CSS that is not tied to any component: --><link rel=\"stylesheet\" href=\"/js/codemirror_5.63.0/codemirror_bundled.css\" /></head><body><slot name=\"above-navbar\"></slot><nav class=\"Navbar\"><a href=\"/index.html\"><img src=\"/img/mono_logo.png\" style=\"height:70px\" alt=\"Modulo\" /></a><ul><li><a href=\"/index.html#about\""
  if (CTX.props.navbar === "about") { // "if props.navbar == \"about\""
  OUT.push("class=\"Navbar--selected\""); // "class=\"Navbar--selected\""
  } // "endif"
  OUT.push(">About</a>\n        </li>\n        <li>\n            <a href=\"/start.html\" "); // ">About</a></li><li><a href=\"/start.html\""
  if (CTX.props.navbar === "start") { // "if props.navbar == \"start\""
  OUT.push("class=\"Navbar--selected\""); // "class=\"Navbar--selected\""
  } // "endif"
  OUT.push(">Start</a>\n        </li>\n        <li>\n            <a href=\"/docs/\" "); // ">Start</a></li><li><a href=\"/docs/\""
  if (CTX.props.navbar === "docs") { // "if props.navbar == \"docs\""
  OUT.push("class=\"Navbar--selected\""); // "class=\"Navbar--selected\""
  } // "endif"
  OUT.push(">Docs</a>\n        </li>\n    </ul>\n\n    <div class=\"Navbar-rightInfo\">\n        "); // ">Docs</a></li></ul><div class=\"Navbar-rightInfo\">"
  if (CTX.script.exports.version) { // "if script.exports.version"
  OUT.push("\n            v: "); // "v:"
  OUT.push(G.escapeText(CTX.script.exports.version)); // "script.exports.version"
  OUT.push("<br />\n            SLOC: "); // "<br /> SLOC:"
  OUT.push(G.escapeText(CTX.script.exports.sloc)); // "script.exports.sloc"
  OUT.push(" lines<br />\n            <a href=\"https://github.com/michaelpb/modulo/\">github</a> | \n            <a href=\"https://npmjs.com/michaelpb/modulo/\">npm</a> \n        "); // "lines<br /><a href=\"https://github.com/michaelpb/modulo/\">github</a> | <a href=\"https://npmjs.com/michaelpb/modulo/\">npm</a>"
  } else { // "else"
  OUT.push("\n            <a href=\"https://github.com/michaelpb/modulo/\">Source Code\n                <br />\n                (on GitHub)\n            </a>\n        "); // "<a href=\"https://github.com/michaelpb/modulo/\">Source Code <br /> (on GitHub) </a>"
  } // "endif"
  OUT.push("\n    </div>\n</nav>\n\n"); // "</div></nav>"
  if (CTX.props.docbarselected) { // "if props.docbarselected"
  OUT.push("\n    <main class=\"Main Main--fluid Main--withSidebar\">\n        <aside class=\"TitleAside TitleAside--navBar\" >\n            <h3><span alt=\"Lower-case delta\">%</span></h3>\n            <nav class=\"TitleAside-navigation\">\n                <h3>Documentation</h3>\n                <mws-DocSidebar path=\""); // "<main class=\"Main Main--fluid Main--withSidebar\"><aside class=\"TitleAside TitleAside--navBar\" ><h3><span alt=\"Lower-case delta\">%</span></h3><nav class=\"TitleAside-navigation\"><h3>Documentation</h3><mws-DocSidebar path=\""
  OUT.push(G.escapeText(CTX.props.docbarselected)); // "props.docbarselected"
  OUT.push("\"></mws-DocSidebar>\n            </nav>\n        </aside>\n        <aside style=\"border:none\">\n            <slot></slot>\n        </aside>\n    </main>\n"); // "\"></mws-DocSidebar></nav></aside><aside style=\"border:none\"><slot></slot></aside></main>"
  } else { // "else"
  OUT.push("\n    <main class=\"Main\">\n        <slot></slot>\n    </main>\n"); // "<main class=\"Main\"><slot></slot></main>"
  } // "endif"
  OUT.push("\n\n<footer>\n    <main>\n        (C) 2022 - Michael Bethencourt - Documentation under LGPL 3.0\n    </main>\n</footer>\n\n</body>\n</html>\n"); // "<footer><main> (C) 2022 - Michael Bethencourt - Documentation under LGPL 3.0 </main></footer></body></html>"

return OUT.join("");
};
currentModulo.assets.functions["x1rrhpdc"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        console.log('mws-Page/Script is running', modulo);
    
return {  setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["x1kedq0o"]= function (CTX, G){
var OUT=[];
  OUT.push("<div id=\"news\" style=\"height: 100px; padding-top: 25px; clear: both; display: block; text-align: center\">\n    <strong>DEV LOG:</strong>\n    "); // "<div id=\"news\" style=\"height: 100px; padding-top: 25px; clear: both; display: block; text-align: center\"><strong>DEV LOG:</strong>"
  var ARR0=CTX.state.data;for (var KEY in ARR0) {CTX. pair=ARR0[KEY]; // "for pair in state.data"
  OUT.push("\n        "); // ""
  if (G.filters["get"](CTX.pair,0) === CTX.props.fn) { // "if pair|get:0 == props.fn"
  OUT.push("\n            <span style=\"text-decoration: overline underline;\">\n                "); // "<span style=\"text-decoration: overline underline;\">"
  OUT.push(G.escapeText(G.filters["get"](CTX.pair,0))); // "pair|get:0"
  OUT.push(" ("); // "("
  OUT.push(G.escapeText(G.filters["get"](CTX.pair,1))); // "pair|get:1"
  OUT.push(")\n            </span>\n        "); // ") </span>"
  } else { // "else"
  OUT.push("\n            <a href=\"/devlog/"); // "<a href=\"/devlog/"
  OUT.push(G.escapeText(G.filters["get"](CTX.pair,0))); // "pair|get:0"
  OUT.push(".html\">\n                "); // ".html\">"
  OUT.push(G.escapeText(G.filters["get"](CTX.pair,0))); // "pair|get:0"
  OUT.push(" ("); // "("
  OUT.push(G.escapeText(G.filters["get"](CTX.pair,1))); // "pair|get:1"
  OUT.push(")\n            </a>\n        "); // ") </a>"
  } // "endif"
  OUT.push("\n        "); // ""
  if (G.filters["get"](CTX.pair,1) != "FAQ") { // "if pair|get:1 != \"FAQ\""
  OUT.push("\n            |\n        "); // "|"
  } // "endif"
  OUT.push("\n    "); // ""
  } // "endfor"
  OUT.push("\n    "); // ""
  var ARR0=CTX.state.data;for (var KEY in ARR0) {CTX. pair=ARR0[KEY]; // "for pair in state.data"
  OUT.push("\n        "); // ""
  if (G.filters["get"](CTX.pair,0) === CTX.props.fn) { // "if pair|get:0 == props.fn"
  OUT.push("\n            <h1>"); // "<h1>"
  OUT.push(G.escapeText(G.filters["get"](CTX.pair,1))); // "pair|get:1"
  OUT.push("</h1>\n        "); // "</h1>"
  } // "endif"
  OUT.push("\n    "); // ""
  } // "endfor"
  OUT.push("\n</div>\n"); // "</div>"

return OUT.join("");
};
currentModulo.assets.functions["15rm5nh"]= function (CTX, G){
var OUT=[];
  OUT.push("<ul>\n    "); // "<ul>"
  var ARR0=CTX.state.menu;for (var KEY in ARR0) {CTX. linkGroup=ARR0[KEY]; // "for linkGroup in state.menu"
  OUT.push("\n        <li class=\"\n            "); // "<li class=\""
  if (CTX.linkGroup.children) { // "if linkGroup.children"
  OUT.push("\n                "); // ""
  if (CTX.linkGroup.active) { // "if linkGroup.active"
  OUT.push("gactive"); // "gactive"
  } else { // "else"
  OUT.push("ginactive"); // "ginactive"
  } // "endif"
  OUT.push("\n            "); // ""
  } // "endif"
  OUT.push("\n            \"><a href=\""); // "\"><a href=\""
  OUT.push(G.escapeText(CTX.linkGroup.filename)); // "linkGroup.filename"
  OUT.push("\">"); // "\">"
  OUT.push(G.escapeText(CTX.linkGroup.label)); // "linkGroup.label"
  OUT.push("</a>\n            "); // "</a>"
  if (CTX.linkGroup.active) { // "if linkGroup.active"
  OUT.push("\n                "); // ""
  if (CTX.linkGroup.children) { // "if linkGroup.children"
  OUT.push("\n                    <ul>\n                    "); // "<ul>"
  var ARR3=CTX.linkGroup.children;for (var KEY in ARR3) {CTX. childLink=ARR3[KEY]; // "for childLink in linkGroup.children"
  OUT.push("\n                        <li><a\n                          href=\""); // "<li><a href=\""
  if (CTX.childLink.filepath) { // "if childLink.filepath"
  OUT.push(G.escapeText(CTX.childLink.filepath)); // "childLink.filepath"
  } else { // "else"
  OUT.push(G.escapeText(CTX.linkGroup.filename)); // "linkGroup.filename"
  OUT.push("#"); // "#"
  OUT.push(G.escapeText(CTX.childLink.hash)); // "childLink.hash"
  } // "endif"
  OUT.push("\"\n                            >"); // "\" >"
  OUT.push(G.escapeText(CTX.childLink.label)); // "childLink.label"
  OUT.push("</a>\n                        "); // "</a>"
  if (CTX.props.showall) { // "if props.showall"
  OUT.push("\n                            "); // ""
  if (CTX.childLink.keywords.length > 0) { // "if childLink.keywords.length gt 0"
  OUT.push("\n                                <span style=\"margin-left: 10px; color: #aaa\">(<em>Topics: "); // "<span style=\"margin-left: 10px; color: #aaa\">(<em>Topics:"
  OUT.push(G.escapeText(G.filters["join"](CTX.childLink.keywords,", "))); // "childLink.keywords|join:', '"
  OUT.push("</em>)</span>\n                            "); // "</em>)</span>"
  } // "endif"
  OUT.push("\n                        "); // ""
  } // "endif"
  OUT.push("\n                        </li>\n                    "); // "</li>"
  } // "endfor"
  OUT.push("\n                    </ul>\n                "); // "</ul>"
  } // "endif"
  OUT.push("\n            "); // ""
  } // "endif"
  OUT.push("\n        </li>\n    "); // "</li>"
  } // "endfor"
  OUT.push("\n\n\n    <!--\n    <li>\n        Other resources:\n\n        <ul>\n            <li>\n                <a href=\"/docs/faq.html\">FAQ</a>\n            <li title=\"Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.\">\n                Literate Source*<br /><em>* Coming soon!</em>\n            </li>\n        </ul>\n\n    </li>\n    -->\n    <!--<a href=\"/literate/src/Modulo.html\">Literate source</a>-->\n</ul>\n\n"); // "<!-- <li> Other resources: <ul><li><a href=\"/docs/faq.html\">FAQ</a><li title=\"Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.\"> Literate Source*<br /><em>* Coming soon!</em></li></ul></li> --><!--<a href=\"/literate/src/Modulo.html\">Literate source</a>--></ul>"

return OUT.join("");
};
currentModulo.assets.functions["3ia7ql"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }
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

function _child(label, hash, keywords=[], filepath=null) {
    if (!hash) {
        hash = label.toLowerCase()
    }
    if (hash.endsWith('.html') && filepath === null) {
        filepath = hash;
    }
    return {label, hash, keywords, filepath};
}

let componentTexts = {};
try {
    componentTexts  = modulo.registry.utils.getComponentDefs('/libraries/eg.html');
} catch {
    console.log('couldnt get componentTexts');
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
        label: 'Template Reference',
        filename: '/docs/templating-reference.html',
        children: [
            _child('Built-in Template Tags', 'templatetags', [
                'if', 'elif', 'else', 'endif', 'for', 'empty', 'endfor',
                'operators', 'in', 'not in', 'is', 'is not', 'lt', 'gt',
                'comparison', 'control-flow',
            ]),
            _child('Built-in Filters', 'filters', [
                'add', 'allow', 'capfirst', 'concat', 'default',
                'divisibleby', 'escapejs', 'first', 'join', 'json', 'last',
                'length', 'lower', 'number', 'pluralize', 'subtract',
                'truncate', 'renderas', 'reversed', 'upper',
            ]),
        ],
    },

    {
        label: 'CParts',
        filename: '/docs/cparts.html',
        children: [
            _child('Props', 'props', ['accessing props', 'defining props',
                                'setting props', 'using props']),
            _child('Template', 'template', ['custom template', 'templating engine']),
            _child('State', 'state', ['state definition', 'state data types',
                            'json', 'state variables', 'state.bind directive']),
            _child('StaticData', 'staticdata', ['loading API', 'loading json',
                            'transform function', 'bundling data']),
            _child('Script', 'script', ['javascript', 'events', 'computed properties',
                            'static execution', 'custom lifecycle methods',
                                'script callback execution context', 'script exports']),
            _child('Style', 'style', ['CSS', 'styling', ':host', 'shadowDOM']),
            _child('Component', 'component', ['name', 'innerHTML', 'patches', 'reconciliation',
                                'rendering mode', 'manual rerender', 'shadow',
                                'vanish', 'vanish-into-document', 'component.event',
                                'component.slot', 'component.dataProp']),
            //_child('Module'),
        ],
    },

    {
        label: 'Lifecycle',
        filename: '/docs/lifecycle.html',
        children: [
            _child('Lifecycle phases', 'phases',
                ['lifestyle phases', 'lifestyle phase groups',
                'load', 'factory', 'prepare', 'initialized',
                'render', 'reconcile', 'update',
                'event', 'eventCleanup', 'hooking into lifecycle',
                'lifecycle callbacks', 'script tag callbacks']),
            _child('Factory lifecycle', 'factory',
                ['renderObj', 'baseRenderObj', 'loadObj',
                'dependency injection', 'middleware']),
            _child('renderObj', 'renderobj',
                ['renderObj', 'baseRenderObj', 'loadObj',
                'dependency injection', 'middleware']),
        ],
    },

    {
        label: 'Directives',
        filename: '/docs/directives.html',
        children: [
            _child('Directives', 'directives',
                ['built-in directives', 'directive shortcuts',
                'custom directives']),
            _child('Built-in directives', 'builtin', [
                    '[component.dataProp]', ':=', 'prop:=', 'JSON primitive',
                    'data-prop', 'assignment',
                    '[component.event]', '@click', '@...:=',
                    '[component.slot]', '[state.bind]',
                ]),
            _child('Custom directives', 'custom', [
                'refs', 'accessing dom', 'escape hatch',
                'Mount callbacks', 'Unmount callbacks',
                'template variables vs directives',
                'script-tag custom directives',
                'custom shortcuts',
            ]),
        ],
    },

    /*
    {
        label: 'API & Extension',
        filename: '/docs/api.html',
        children: [
            _child('Custom CParts', 'cparts'),
            _child('CPart Spares', 'spares'),
            _child('Custom Templating', 'template'),
            _child('Custom Filters', 'customfilters'),
            _child('Custom Template Tags', 'customtags'),
            _child('Custom Template Syntax', 'customtags'),
            _child('ModRec', 'modrec'),
            _child('DOMCursor', 'cursor'),
        ],
    },
    */

    {
        label: 'Examples',
        filename: '/demos/',
        children: [
            _child('Starter Files', 'starter', [ 'snippets',
                'component libraries', 'bootstrap', 'download', 'zip',
                'page layouts', 'using vanish' ]),
            _child('Example Library', 'library', Object.keys(componentTexts)),
            _child('Experiments', 'experiments', [
                'TestSuite', 'unit testing',
                'custom cparts', 'Tone.js', 'audio synthesis', 'MIDI',
                'FetchState cpart', 'jsx templating', 'babel.js',
                'transpiling', 'cparts for apis',
            ]),
        ],
    },

    /*
    {
        label: 'Project Info',
        filename: '/docs/project-info.html',
        children: [
            _child('FAQ', 'faq'),
            _child('Framework Design Philosophy', 'philosophy'),
        ],
    },
    */
];


return { "initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"_child": typeof _child !== "undefined" ? _child : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["t08jf1"]= function (CTX, G){
var OUT=[];
  OUT.push("<div class=\"demo-wrapper\n        "); // "<div class=\"demo-wrapper"
  if (CTX.state.showpreview) { // "if state.showpreview"
  OUT.push("     demo-wrapper__minipreview"); // "demo-wrapper__minipreview"
  } // "endif"
  OUT.push("\n        "); // ""
  if (CTX.state.showclipboard) { // "if state.showclipboard"
  OUT.push("   demo-wrapper__clipboard  "); // "demo-wrapper__clipboard"
  } // "endif"
  OUT.push("\n        "); // ""
  if (CTX.state.fullscreen) { // "if state.fullscreen"
  OUT.push("      demo-wrapper__fullscreen "); // "demo-wrapper__fullscreen"
  } // "endif"
  OUT.push("\n        "); // ""
  if (CTX.state.tabs.length === 1) { // "if state.tabs.length == 1"
  OUT.push("demo-wrapper__notabs     "); // "demo-wrapper__notabs"
  } // "endif"
  OUT.push("\n    \">\n    "); // "\">"
  if (CTX.state.tabs.length > 1) { // "if state.tabs.length gt 1"
  OUT.push("\n        <nav class=\"TabNav\">\n            <ul>\n                "); // "<nav class=\"TabNav\"><ul>"
  var ARR1=CTX.state.tabs;for (var KEY in ARR1) {CTX. tab=ARR1[KEY]; // "for tab in state.tabs"
  OUT.push("\n                    <li class=\"TabNav-title\n                        "); // "<li class=\"TabNav-title"
  if (CTX.tab.title === CTX.state.selected) { // "if tab.title == state.selected"
  OUT.push("\n                            TabNav-title--selected\n                        "); // "TabNav-title--selected"
  } // "endif"
  OUT.push("\n                    \"><a @click:=script.selectTab\n                            payload=\""); // "\"><a @click:=script.selectTab payload=\""
  OUT.push(G.escapeText(CTX.tab.title)); // "tab.title"
  OUT.push("\"\n                        >"); // "\" >"
  OUT.push(G.escapeText(CTX.tab.title)); // "tab.title"
  OUT.push("</a></li>\n                "); // "</a></li>"
  } // "endfor"
  OUT.push("\n            </ul>\n        </nav>\n    "); // "</ul></nav>"
  } // "endif"
  OUT.push("\n\n    <div class=\"editor-toolbar\">\n        <p style=\"font-size: 11px; width: 120px; margin-right: 10px; text-align: right;\n                    "); // "<div class=\"editor-toolbar\"><p style=\"font-size: 11px; width: 120px; margin-right: 10px; text-align: right;"
  if (!(CTX.state.fullscreen)) { // "if not state.fullscreen"
  OUT.push(" display: none; "); // "display: none;"
  } // "endif"
  OUT.push("\">\n            <em>Note: This is meant for exploring features. Your work will not be saved.</em>\n        </p>\n\n        "); // "\"><em>Note: This is meant for exploring features. Your work will not be saved.</em></p>"
  if (CTX.state.showclipboard) { // "if state.showclipboard"
  OUT.push("\n            <button class=\"m-Btn m-Btn--sm m-Btn--faded\"\n                    title=\"Copy this code\" @click:=script.doCopy>\n                Copy <span alt=\"Clipboard\">&#128203;</span>\n            </button>\n        "); // "<button class=\"m-Btn m-Btn--sm m-Btn--faded\" title=\"Copy this code\" @click:=script.doCopy> Copy <span alt=\"Clipboard\">&#128203;</span></button>"
  } // "endif"
  OUT.push("\n\n        "); // ""
  if (CTX.state.showpreview) { // "if state.showpreview"
  OUT.push("\n            <button class=\"m-Btn\"\n                    title=\"Toggle full screen view of code\" @click:=script.doFullscreen>\n                "); // "<button class=\"m-Btn\" title=\"Toggle full screen view of code\" @click:=script.doFullscreen>"
  if (CTX.state.fullscreen) { // "if state.fullscreen"
  OUT.push("\n                    <span alt=\"Shrink\">&swarr;</span>\n                "); // "<span alt=\"Shrink\">&swarr;</span>"
  } else { // "else"
  OUT.push("\n                    <span alt=\"Go Full Screen\">&nearr;</span>\n                "); // "<span alt=\"Go Full Screen\">&nearr;</span>"
  } // "endif"
  OUT.push("\n            </button>\n            &nbsp;\n            <button class=\"m-Btn\"\n                    title=\"Run a preview of this code\" @click:=script.doRun>\n                Run <span alt=\"Refresh\">&#10227;</span>\n            </button>\n        "); // "</button> &nbsp; <button class=\"m-Btn\" title=\"Run a preview of this code\" @click:=script.doRun> Run <span alt=\"Refresh\">&#10227;</span></button>"
  } // "endif"
  OUT.push("\n\n    </div>\n\n    <div class=\"side-by-side-panes\">\n        <div class=\"editor-wrapper\">\n            <div [script.codemirror] modulo-ignore>\n            </div>\n        </div>\n\n        "); // "</div><div class=\"side-by-side-panes\"><div class=\"editor-wrapper\"><div [script.codemirror] modulo-ignore></div></div>"
  if (CTX.state.showpreview) { // "if state.showpreview"
  OUT.push("\n            <div class=\"editor-minipreview\">\n                <div modulo-ignore>\n                    "); // "<div class=\"editor-minipreview\"><div modulo-ignore>"
  OUT.push(G.escapeText(G.filters["safe"](CTX.state.preview))); // "state.preview|safe"
  OUT.push("\n                </div>\n            </div>\n        "); // "</div></div>"
  } // "endif"
  OUT.push("\n\n    </div>\n</div>\n\n"); // "</div></div>"

return OUT.join("");
};
currentModulo.assets.functions["xrkkgea"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }
let componentTexts = null;
let exCounter = window._modExCounter || 0; // global variable to prevent conflicts

function _setupGlobalVariables() {
    const { getComponentDefs } = modulo.registry.utils;
    if (!getComponentDefs) {
          throw new Error('Uh oh, getComponentDefs isnt getting defined!');
    }
    const docseg = getComponentDefs('/libraries/docseg.html');
    const eg = getComponentDefs('/libraries/eg.html');
    componentTexts = Object.assign({}, docseg, eg);
}

function tmpGetDirectives() {
    console.count('DEPRECATED: Demo.js - tmpGetDirectives');
    return [ 'script.codemirror' ];
}

function codemirrorMount({ el }) {
    el.innerHTML = ''; // clear inner HTML before mounting
    const demoType = props.demotype || 'snippet';
    _setupCodemirrorSync(el, demoType, element, state);
    const myElement = element;
    setTimeout(() => {
        myElement.codeMirrorEditor.refresh()
        setTimeout(() => {
            myElement.codeMirrorEditor.refresh()
        }, 0); // Ensure refreshes after the first reflow
    }, 0); // Ensure refreshes after the first reflow
}

function _setupCodemirrorSync(el, demoType, myElement, myState) {
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
          const { CodeMirror } = modulo.registry.utils;
          if (typeof CodeMirror === 'undefined' || !CodeMirror) {
              throw new Error('Have not loaded CodeMirror yet');
          }
          myElement.codeMirrorEditor = CodeMirror(el, conf);
      }
      myElement.codeMirrorEditor.refresh()
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

function initializedCallback() {
    console.log('initializedCallback for Demo.js', element);
    if (componentTexts === null) {
        _setupGlobalVariables();
    }
    //console.log('these are componentTexts', componentTexts);

    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            componentTexts = false;
            console.error('Couldnt load:', props.fromlibrary)
            return;
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
        state.tabs.push({ title, text });
        // XXX Hack, refactor -v
        if (props.text2) {
            title = props.ttitle2 || 'Example';
            text = props.text2.trim();
            state.tabs.push({ title, text });
        }
        if (props.text3) {
            title = props.ttitle3 || 'Example';
            text = props.text3.trim();
            state.tabs.push({ title, text });
        }
        //console.log('this is props', props);
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
}

function _newModulo() {
    const mod = new Modulo(window.hackCoreModulo);
    // Refresh queue & asset manager
    mod.register('core', modulo.registry.core.FetchQueue);
    mod.register('core', modulo.registry.core.AssetManager);
    return mod;
}

function runModuloText(componentDef) {
    const defDiv = document.createElement('div');
    defDiv.innerHTML = componentDef;
    const mod = _newModulo();
    mod.loadFromDOM(defDiv);
    mod.preprocessAndDefine();
}

function doRun() {
    window._modExCounter = ++exCounter;
    //console.log('There are ', exCounter, ' examples on this page. Gee!')
    const namespace = `e${exCounter}g${state.nscounter}`; // TODO: later do hot reloading using same loader
    state.nscounter++;
    const tagName = 'DemoComponent';

    if (element.codeMirrorEditor) {
        state.text = element.codeMirrorEditor.getValue(); // make sure most up-to-date
    }
    runModuloText(`<Component namespace="${namespace}" name="${tagName}">` +
                  `\n${state.text}\n</Component>`);

    // Create a new modulo instance 
    const fullname = `${namespace}-${tagName}`;
    state.preview = `<${fullname}></${fullname}>`;
    setTimeout(() => {
        const div = element.querySelector('.editor-minipreview > div');
        if (div) {
            div.innerHTML = state.preview;
            //console.log('assigned to', div.innerHTML);
        } else {
            console.log('warning, cant update minipreview', div);
        }
    }, 0);

}

function countUp() {
    // TODO: Remove this when resolution context bug is fixed so that children
    // no longer can reference parents
    console.count('PROBLEM: Child event bubbling to parent!');
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


function setupShaChecksum() {
    console.log('setupShaChecksum DISABLED'); return; ///////////////////

    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (Modulo.isBackend && state && state.text.includes('$modulojs_sha384_checksum$')) {
        if (!mod || !mod.script || !mod.script.getVersionInfo) {
            console.log('no mod!');
        } else {
            const info = mod.script.getVersionInfo();
            const checksum = info.checksum || '';
            state.text = state.text.replace('$modulojs_sha384_checksum$', checksum)
            element.setAttribute('text', state.text);
        }
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


/*
// Use a new asset manager when loading, to prevent it from getting into the main bundle
let componentDef = state.text;
componentDef = `<component name="${tagName}">\n${componentDef}\n</component>`;
const loader = new Modulo.Loader(null, { attrs } );
const oldAssetMgr = Modulo.assets;
Modulo.assets = new Modulo.AssetManager();
loader.loadString(componentDef);
Modulo.assets = oldAssetMgr;

const fullname = `${namespace}-${tagName}`;
const factory = Modulo.factoryInstances[fullname];
state.preview = `<${fullname}></${fullname}>`;

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
*/


/*
function _setupCodemirror(el, demoType, myElement, myState) {
    console.log('_setupCodemirror DISABLED'); return; ///////////////////
    let expBackoff = 10;
    //console.log('this is codemirror', Modulo.globals.CodeMirror);
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
            console.log('dead code?');
            myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
        }
        myElement.codeMirrorEditor.refresh()
        //myElement.rerender();
    };
    mountCM();
    return;
    const {isBackend} = Modulo;
    if (!isBackend) {
        // TODO: Ugly hack, need better tools for working with legacy
        setTimeout(mountCM, expBackoff);
    }

    const myElem = element;
    const myState = state;
    const {isBackend} = Modulo;
    return;
    if (!isBackend) {
        setTimeout(() => {
            const div = myElem.querySelector('.editor-wrapper > div');
            _setupCodemirror(div, demoType, myElem, myState);
        }, 0); // put on queue
    }

}

*/

return { "_setupGlobalVariables": typeof _setupGlobalVariables !== "undefined" ? _setupGlobalVariables : undefined,
"tmpGetDirectives": typeof tmpGetDirectives !== "undefined" ? tmpGetDirectives : undefined,
"codemirrorMount": typeof codemirrorMount !== "undefined" ? codemirrorMount : undefined,
"_setupCodemirrorSync": typeof _setupCodemirrorSync !== "undefined" ? _setupCodemirrorSync : undefined,
"selectTab": typeof selectTab !== "undefined" ? selectTab : undefined,
"doCopy": typeof doCopy !== "undefined" ? doCopy : undefined,
"initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"_newModulo": typeof _newModulo !== "undefined" ? _newModulo : undefined,
"runModuloText": typeof runModuloText !== "undefined" ? runModuloText : undefined,
"doRun": typeof doRun !== "undefined" ? doRun : undefined,
"countUp": typeof countUp !== "undefined" ? countUp : undefined,
"doFullscreen": typeof doFullscreen !== "undefined" ? doFullscreen : undefined,
"previewspotMount": typeof previewspotMount !== "undefined" ? previewspotMount : undefined,
"setupShaChecksum": typeof setupShaChecksum !== "undefined" ? setupShaChecksum : undefined,
"_setupCodemirror": typeof _setupCodemirror !== "undefined" ? _setupCodemirror : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["x1c705ik"]= function (CTX, G){
var OUT=[];
  var ARR0=CTX.state.examples;for (var KEY in ARR0) {CTX. example=ARR0[KEY]; // "for example in state.examples"
  OUT.push("\n    "); // ""
  if (CTX.example.name === CTX.state.selected) { // "if example.name == state.selected"
  OUT.push("\n        <div class=\"Example expanded\">\n            <button class=\"tool-button\" alt=\"Edit\" title=\"Hide source code & editor\"\n                @click:=script.toggleExample payload=\""); // "<div class=\"Example expanded\"><button class=\"tool-button\" alt=\"Edit\" title=\"Hide source code & editor\" @click:=script.toggleExample payload=\""
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("\">\n                "); // "\">"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("\n                &times;\n            </button>\n            <mws-Demo\n                demotype=\"minipreview\"\n                fromlibrary='"); // "&times; </button><mws-Demo demotype=\"minipreview\" fromlibrary='"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("'\n            ></mws-Demo>\n        </div>\n    "); // "' ></mws-Demo></div>"
  } else { // "else"
  OUT.push("\n        <div class=\"Example\">\n            <button class=\"tool-button\" alt=\"Edit\" title=\"See source code & edit example\"\n                @click:=script.toggleExample payload=\""); // "<div class=\"Example\"><button class=\"tool-button\" alt=\"Edit\" title=\"See source code & edit example\" @click:=script.toggleExample payload=\""
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("\">\n                "); // "\">"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("\n                ✎\n            </button>\n            <div class=\"Example-wrapper\">\n                <eg-"); // "✎ </button><div class=\"Example-wrapper\"><eg-"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("></eg-"); // "></eg-"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push(">\n            </div>\n        </div>\n    "); // "></div></div>"
  } // "endif"
  OUT.push("\n"); // ""
  } // "endfor"
  OUT.push("\n\n<!--\n<mws-Section name=\""); // "<!-- <mws-Section name=\""
  OUT.push(G.escapeText(G.filters["lower"](CTX.example.name))); // "example.name|lower"
  OUT.push("\">\n    "); // "\">"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("\n</mws-Section>\n<mws-Demo\n    demotype=\"minipreview\"\n    fromlibrary='"); // "</mws-Section><mws-Demo demotype=\"minipreview\" fromlibrary='"
  OUT.push(G.escapeText(CTX.example.name)); // "example.name"
  OUT.push("'\n></mws-Demo>\n-->\n\n"); // "' ></mws-Demo> -->"

return OUT.join("");
};
currentModulo.assets.functions["xrgjiia"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }
function toggleExample(payload) {
    if (state.selected === payload) {
        state.selected = '';
    } else {
        state.selected = payload;
    }
}

function initializedCallback() {
    const eg = getComponentDefs('/libraries/eg.html');
    state.examples = [];
    for (const [ name, content ] of Object.entries(eg)) {
        state.examples.push({ name, content });
    }
    element.rerender();
}

 
return { "toggleExample": typeof toggleExample !== "undefined" ? toggleExample : undefined,
"initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1cod1g0"]= function (CTX, G){
var OUT=[];
  OUT.push("\n        <a class=\"secanchor\" title=\"Click to focus on this section.\" id=\""); // "<a class=\"secanchor\" title=\"Click to focus on this section.\" id=\""
  OUT.push(G.escapeText(CTX.props.name)); // "props.name"
  OUT.push("\" name=\""); // "\" name=\""
  OUT.push(G.escapeText(CTX.props.name)); // "props.name"
  OUT.push("\" href=\"#"); // "\" href=\"#"
  OUT.push(G.escapeText(CTX.props.name)); // "props.name"
  OUT.push("\">#</a>\n        <h2>"); // "\">#</a><h2>"
  OUT.push(G.escapeText(G.filters["safe"](CTX.component.originalHTML))); // "component.originalHTML|safe"
  OUT.push("</h2>\n    "); // "</h2>"

return OUT.join("");
};
currentModulo.assets.functions["x1g66lrh"]= function (CTX, G){
var OUT=[];
  OUT.push("\n<p>There are <em>"); // "<p>There are <em>"
  OUT.push(G.escapeText(CTX.state.count)); // "state.count"
  OUT.push("\n  "); // ""
  OUT.push(G.escapeText(G.filters["pluralize"](CTX.state.count,"articles,article"))); // "state.count|pluralize:\"articles,article\""
  OUT.push("</em>\n  on "); // "</em> on"
  OUT.push(G.escapeText(CTX.script.exports.title)); // "script.exports.title"
  OUT.push(".</p>\n\n"); // ".</p>"
  OUT.push("\n"); // ""
  var ARR0=CTX.state.articles;for (var KEY in ARR0) {CTX. article=ARR0[KEY]; // "for article in state.articles"
  OUT.push("\n    <h4 style=\"color: blue\">"); // "<h4 style=\"color: blue\">"
  OUT.push(G.escapeText(G.filters["upper"](CTX.article.headline))); // "article.headline|upper"
  OUT.push("</h4>\n    "); // "</h4>"
  if (CTX.article.tease) { // "if article.tease"
  OUT.push("\n      <p>"); // "<p>"
  OUT.push(G.escapeText(G.filters["truncate"](CTX.article.tease,30))); // "article.tease|truncate:30"
  OUT.push("</p>\n    "); // "</p>"
  } // "endif"
  OUT.push("\n"); // ""
  } // "endfor"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["154ld2"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    script.exports.title = "ModuloNews";

return {  setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1ccdre"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <input name=\"perc\" [state.bind]=\"\">% of\n    <input name=\"total\" [state.bind]=\"\">\n    is: "); // "<input name=\"perc\" [state.bind]=\"\">% of <input name=\"total\" [state.bind]=\"\"> is:"
  OUT.push(G.escapeText(CTX.script.calcResult)); // "script.calcResult"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["tv174n"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function prepareCallback() {
        const calcResult = (state.perc / 100) * state.total;
        return { calcResult };
    }

return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1gic6ht"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <h1>hello "); // "<h1>hello"
  OUT.push("</h1>\n    "); // "</h1>"
  /* // "comment"
  OUT.push("\n      "); // ""
  if (CTX.a) { // "if a"
  OUT.push("<div>"); // "<div>"
  OUT.push(G.escapeText(CTX.b)); // "b"
  OUT.push("</div>"); // "</div>"
  } // "endif"
  OUT.push("\n      <h3>"); // "<h3>"
  OUT.push(G.escapeText(G.filters["first"](CTX.state.items))); // "state.items|first"
  OUT.push("</h3>\n    "); // "</h3>"
  */ // "endcomment"
  OUT.push("\n    <p>Below the greeting...</p>\n"); // "<p>Below the greeting...</p>"

return OUT.join("");
};
currentModulo.assets.functions["xmc3bve"]= function (CTX, G){
var OUT=[];
  OUT.push("\n<p>User \"<em>"); // "<p>User \"<em>"
  OUT.push(G.escapeText(CTX.state.username)); // "state.username"
  OUT.push("</em>\" sent a message:</p>\n<div class=\"msgcontent\">\n    "); // "</em>\" sent a message:</p><div class=\"msgcontent\">"
  OUT.push(G.escapeText(G.filters["safe"](CTX.state.content))); // "state.content|safe"
  OUT.push("\n</div>\n"); // "</div>"

return OUT.join("");
};
currentModulo.assets.functions["9cf1vf"]= function (CTX, G){
var OUT=[];
  OUT.push("\nHello <strong>Modulo</strong> World!\n<p class=\"neat\">Any HTML can be here!</p>\n"); // "Hello <strong>Modulo</strong> World! <p class=\"neat\">Any HTML can be here!</p>"

return OUT.join("");
};
currentModulo.assets.functions["x35mjmh"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>Trying out the button...</p>\n    <x-examplebtn label=\"Button Example\" shape=\"square\"></x-examplebtn>\n\n    <p>Another button...</p>\n    <x-examplebtn label=\"Example 2: Rounded\" shape=\"round\"></x-examplebtn>\n"); // "<p>Trying out the button...</p><x-examplebtn label=\"Button Example\" shape=\"square\"></x-examplebtn><p>Another button...</p><x-examplebtn label=\"Example 2: Rounded\" shape=\"round\"></x-examplebtn>"

return OUT.join("");
};
currentModulo.assets.functions["9cmo7s"]= function (CTX, G){
var OUT=[];
  OUT.push("\n<p>Nonsense poem:</p> <pre>Professor "); // "<p>Nonsense poem:</p><pre>Professor"
  OUT.push(G.escapeText(G.filters["capfirst"](CTX.state.verb))); // "state.verb|capfirst"
  OUT.push(" who\n"); // "who"
  OUT.push(G.escapeText(CTX.state.verb)); // "state.verb"
  OUT.push("ed a "); // "ed a"
  OUT.push(G.escapeText(CTX.state.noun)); // "state.noun"
  OUT.push(",\ntaught "); // ", taught"
  OUT.push(G.escapeText(CTX.state.verb)); // "state.verb"
  OUT.push("ing in\nthe City of "); // "ing in the City of"
  OUT.push(G.escapeText(G.filters["capfirst"](CTX.state.noun))); // "state.noun|capfirst"
  OUT.push(",\nto "); // ", to"
  OUT.push(G.escapeText(CTX.state.count)); // "state.count"
  OUT.push(" "); // ""
  OUT.push(G.escapeText(CTX.state.noun)); // "state.noun"
  OUT.push("s.\n</pre>\n"); // "s. </pre>"

return OUT.join("");
};
currentModulo.assets.functions["x1qjabln"]= function (CTX, G){
var OUT=[];
  OUT.push("\n\n<div>\n    <label>Username:\n        <input [state.bind]=\"\" name=\"username\"></label>\n    <label>Color (\"green\" or \"blue\"):\n        <input [state.bind]=\"\" name=\"color\"></label>\n    <label>Opacity: <input [state.bind]=\"\" name=\"opacity\" type=\"number\" min=\"0\" max=\"1\" step=\"0.1\"></label>\n\n    <h5 style=\"\n            opacity: "); // "<div><label>Username: <input [state.bind]=\"\" name=\"username\"></label><label>Color (\"green\" or \"blue\"): <input [state.bind]=\"\" name=\"color\"></label><label>Opacity: <input [state.bind]=\"\" name=\"opacity\" type=\"number\" min=\"0\" max=\"1\" step=\"0.1\"></label><h5 style=\" opacity:"
  OUT.push(G.escapeText(CTX.state.opacity)); // "state.opacity"
  OUT.push(";\n            color: "); // "; color:"
  OUT.push(G.escapeText(G.filters["default"](G.filters["allow"](CTX.state.color,"green,blue"),"red"))); // "state.color|allow:'green,blue'|default:'red'"
  OUT.push(";\n        \">\n        "); // "; \">"
  OUT.push(G.escapeText(G.filters["lower"](CTX.state.username))); // "state.username|lower"
  OUT.push("\n    </h5>\n</div>\n\n"); // "</h5></div>"

return OUT.join("");
};
currentModulo.assets.functions["16vtia4"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <button @click:=\"script.countUp\">Hello "); // "<button @click:=\"script.countUp\">Hello"
  OUT.push(G.escapeText(CTX.state.num)); // "state.num"
  OUT.push("</button>\n"); // "</button>"

return OUT.join("");
};
currentModulo.assets.functions["1ug4oiq"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function countUp() {
        state.num++;
    }

return { "countUp": typeof countUp !== "undefined" ? countUp : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["gq8383"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    Components can use any number of <strong>CParts</strong>.\n    Here we use only <em>Style</em> and <em>Template</em>.\n"); // "Components can use any number of <strong>CParts</strong>. Here we use only <em>Style</em> and <em>Template</em>."

return OUT.join("");
};
currentModulo.assets.functions["x14e0noe"]= function (CTX, G){
var OUT=[];
  OUT.push("\n<ol>\n    "); // "<ol>"
  var ARR0=CTX.state.list;for (var KEY in ARR0) {CTX. item=ARR0[KEY]; // "for item in state.list"
  OUT.push("\n        <li>"); // "<li>"
  OUT.push(G.escapeText(CTX.item)); // "item"
  OUT.push("</li>\n    "); // "</li>"
  } // "endfor"
  OUT.push("\n    <li>\n        <input [state.bind]=\"\" name=\"text\">\n        <button @click:=\"script.addItem\">Add</button>\n    </li>\n</ol>\n"); // "<li><input [state.bind]=\"\" name=\"text\"><button @click:=\"script.addItem\">Add</button></li></ol>"

return OUT.join("");
};
currentModulo.assets.functions["x8ktit0"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function addItem() {
        state.list.push(state.text); // add to list
        state.text = ""; // clear input
    }

return { "addItem": typeof addItem !== "undefined" ? addItem : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["xa6nq8n"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <strong>Name:</strong> "); // "<strong>Name:</strong>"
  OUT.push(G.escapeText(CTX.staticdata.name)); // "staticdata.name"
  OUT.push(" <br>\n    <strong>Site:</strong> "); // "<br><strong>Site:</strong>"
  OUT.push(G.escapeText(CTX.staticdata.homepage)); // "staticdata.homepage"
  OUT.push(" <br>\n    <strong>Tags:</strong> "); // "<br><strong>Tags:</strong>"
  OUT.push(G.escapeText(G.filters["join"](CTX.staticdata.topics))); // "staticdata.topics|join"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["1sejui7"]= function (){
return {
  "id": 320452827,
  "node_id": "MDEwOlJlcG9zaXRvcnkzMjA0NTI4Mjc=",
  "name": "modulo",
  "full_name": "michaelpb/modulo",
  "private": false,
  "owner": {
    "login": "michaelpb",
    "id": 181549,
    "node_id": "MDQ6VXNlcjE4MTU0OQ==",
    "avatar_url": "https://avatars.githubusercontent.com/u/181549?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/michaelpb",
    "html_url": "https://github.com/michaelpb",
    "followers_url": "https://api.github.com/users/michaelpb/followers",
    "following_url": "https://api.github.com/users/michaelpb/following{/other_user}",
    "gists_url": "https://api.github.com/users/michaelpb/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/michaelpb/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/michaelpb/subscriptions",
    "organizations_url": "https://api.github.com/users/michaelpb/orgs",
    "repos_url": "https://api.github.com/users/michaelpb/repos",
    "events_url": "https://api.github.com/users/michaelpb/events{/privacy}",
    "received_events_url": "https://api.github.com/users/michaelpb/received_events",
    "type": "User",
    "site_admin": false
  },
  "html_url": "https://github.com/michaelpb/modulo",
  "description": "Modulo.js is a minimalist javascript framewor- 🤮",
  "fork": false,
  "url": "https://api.github.com/repos/michaelpb/modulo",
  "forks_url": "https://api.github.com/repos/michaelpb/modulo/forks",
  "keys_url": "https://api.github.com/repos/michaelpb/modulo/keys{/key_id}",
  "collaborators_url": "https://api.github.com/repos/michaelpb/modulo/collaborators{/collaborator}",
  "teams_url": "https://api.github.com/repos/michaelpb/modulo/teams",
  "hooks_url": "https://api.github.com/repos/michaelpb/modulo/hooks",
  "issue_events_url": "https://api.github.com/repos/michaelpb/modulo/issues/events{/number}",
  "events_url": "https://api.github.com/repos/michaelpb/modulo/events",
  "assignees_url": "https://api.github.com/repos/michaelpb/modulo/assignees{/user}",
  "branches_url": "https://api.github.com/repos/michaelpb/modulo/branches{/branch}",
  "tags_url": "https://api.github.com/repos/michaelpb/modulo/tags",
  "blobs_url": "https://api.github.com/repos/michaelpb/modulo/git/blobs{/sha}",
  "git_tags_url": "https://api.github.com/repos/michaelpb/modulo/git/tags{/sha}",
  "git_refs_url": "https://api.github.com/repos/michaelpb/modulo/git/refs{/sha}",
  "trees_url": "https://api.github.com/repos/michaelpb/modulo/git/trees{/sha}",
  "statuses_url": "https://api.github.com/repos/michaelpb/modulo/statuses/{sha}",
  "languages_url": "https://api.github.com/repos/michaelpb/modulo/languages",
  "stargazers_url": "https://api.github.com/repos/michaelpb/modulo/stargazers",
  "contributors_url": "https://api.github.com/repos/michaelpb/modulo/contributors",
  "subscribers_url": "https://api.github.com/repos/michaelpb/modulo/subscribers",
  "subscription_url": "https://api.github.com/repos/michaelpb/modulo/subscription",
  "commits_url": "https://api.github.com/repos/michaelpb/modulo/commits{/sha}",
  "git_commits_url": "https://api.github.com/repos/michaelpb/modulo/git/commits{/sha}",
  "comments_url": "https://api.github.com/repos/michaelpb/modulo/comments{/number}",
  "issue_comment_url": "https://api.github.com/repos/michaelpb/modulo/issues/comments{/number}",
  "contents_url": "https://api.github.com/repos/michaelpb/modulo/contents/{+path}",
  "compare_url": "https://api.github.com/repos/michaelpb/modulo/compare/{base}...{head}",
  "merges_url": "https://api.github.com/repos/michaelpb/modulo/merges",
  "archive_url": "https://api.github.com/repos/michaelpb/modulo/{archive_format}{/ref}",
  "downloads_url": "https://api.github.com/repos/michaelpb/modulo/downloads",
  "issues_url": "https://api.github.com/repos/michaelpb/modulo/issues{/number}",
  "pulls_url": "https://api.github.com/repos/michaelpb/modulo/pulls{/number}",
  "milestones_url": "https://api.github.com/repos/michaelpb/modulo/milestones{/number}",
  "notifications_url": "https://api.github.com/repos/michaelpb/modulo/notifications{?since,all,participating}",
  "labels_url": "https://api.github.com/repos/michaelpb/modulo/labels{/name}",
  "releases_url": "https://api.github.com/repos/michaelpb/modulo/releases{/id}",
  "deployments_url": "https://api.github.com/repos/michaelpb/modulo/deployments",
  "created_at": "2020-12-11T03:08:21Z",
  "updated_at": "2022-05-03T19:15:19Z",
  "pushed_at": "2022-09-17T21:21:02Z",
  "git_url": "git://github.com/michaelpb/modulo.git",
  "ssh_url": "git@github.com:michaelpb/modulo.git",
  "clone_url": "https://github.com/michaelpb/modulo.git",
  "svn_url": "https://github.com/michaelpb/modulo",
  "homepage": "https://modulojs.org/",
  "size": 6684,
  "stargazers_count": 2,
  "watchers_count": 2,
  "language": "JavaScript",
  "has_issues": true,
  "has_projects": true,
  "has_downloads": true,
  "has_wiki": true,
  "has_pages": true,
  "forks_count": 0,
  "mirror_url": null,
  "archived": false,
  "disabled": false,
  "open_issues_count": 0,
  "license": {
    "key": "lgpl-2.1",
    "name": "GNU Lesser General Public License v2.1",
    "spdx_id": "LGPL-2.1",
    "url": "https://api.github.com/licenses/lgpl-2.1",
    "node_id": "MDc6TGljZW5zZTEx"
  },
  "allow_forking": true,
  "is_template": false,
  "web_commit_signoff_required": false,
  "topics": [
    "component-based",
    "framework",
    "html",
    "javascript",
    "state-management",
    "template-engine",
    "vanilla-js",
    "web-components"
  ],
  "visibility": "public",
  "forks": 0,
  "open_issues": 0,
  "watchers": 2,
  "default_branch": "main",
  "temp_clone_token": null,
  "network_count": 0,
  "subscribers_count": 2
};
};
currentModulo.assets.functions["xmphgsn"]= function (CTX, G){
var OUT=[];
  OUT.push("\n  "); // ""
  var ARR0=CTX.staticdata;for (var KEY in ARR0) {CTX. post=ARR0[KEY]; // "for post in staticdata"
  OUT.push("\n    <p>"); // "<p>"
  if (CTX.post.completed) { // "if post.completed"
  OUT.push("★"); // "★"
  } else { // "else"
  OUT.push("☆"); // "☆"
  } // "endif"
  OUT.push("\n        "); // ""
  OUT.push(G.escapeText(G.filters["truncate"](CTX.post.title,15))); // "post.title|truncate:15"
  OUT.push("</p>\n  "); // "</p>"
  } // "endfor"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["16lf05u"]= function (){
return [
  {
    "userId": 1,
    "id": 1,
    "title": "delectus aut autem",
    "completed": false
  },
  {
    "userId": 1,
    "id": 2,
    "title": "quis ut nam facilis et officia qui",
    "completed": false
  },
  {
    "userId": 1,
    "id": 3,
    "title": "fugiat veniam minus",
    "completed": false
  },
  {
    "userId": 1,
    "id": 4,
    "title": "et porro tempora",
    "completed": true
  },
  {
    "userId": 1,
    "id": 5,
    "title": "laboriosam mollitia et enim quasi adipisci quia provident illum",
    "completed": false
  },
  {
    "userId": 1,
    "id": 6,
    "title": "qui ullam ratione quibusdam voluptatem quia omnis",
    "completed": false
  },
  {
    "userId": 1,
    "id": 7,
    "title": "illo expedita consequatur quia in",
    "completed": false
  },
  {
    "userId": 1,
    "id": 8,
    "title": "quo adipisci enim quam ut ab",
    "completed": true
  },
  {
    "userId": 1,
    "id": 9,
    "title": "molestiae perspiciatis ipsa",
    "completed": false
  },
  {
    "userId": 1,
    "id": 10,
    "title": "illo est ratione doloremque quia maiores aut",
    "completed": true
  },
  {
    "userId": 1,
    "id": 11,
    "title": "vero rerum temporibus dolor",
    "completed": true
  },
  {
    "userId": 1,
    "id": 12,
    "title": "ipsa repellendus fugit nisi",
    "completed": true
  },
  {
    "userId": 1,
    "id": 13,
    "title": "et doloremque nulla",
    "completed": false
  },
  {
    "userId": 1,
    "id": 14,
    "title": "repellendus sunt dolores architecto voluptatum",
    "completed": true
  },
  {
    "userId": 1,
    "id": 15,
    "title": "ab voluptatum amet voluptas",
    "completed": true
  },
  {
    "userId": 1,
    "id": 16,
    "title": "accusamus eos facilis sint et aut voluptatem",
    "completed": true
  },
  {
    "userId": 1,
    "id": 17,
    "title": "quo laboriosam deleniti aut qui",
    "completed": true
  },
  {
    "userId": 1,
    "id": 18,
    "title": "dolorum est consequatur ea mollitia in culpa",
    "completed": false
  },
  {
    "userId": 1,
    "id": 19,
    "title": "molestiae ipsa aut voluptatibus pariatur dolor nihil",
    "completed": true
  },
  {
    "userId": 1,
    "id": 20,
    "title": "ullam nobis libero sapiente ad optio sint",
    "completed": true
  },
  {
    "userId": 2,
    "id": 21,
    "title": "suscipit repellat esse quibusdam voluptatem incidunt",
    "completed": false
  },
  {
    "userId": 2,
    "id": 22,
    "title": "distinctio vitae autem nihil ut molestias quo",
    "completed": true
  },
  {
    "userId": 2,
    "id": 23,
    "title": "et itaque necessitatibus maxime molestiae qui quas velit",
    "completed": false
  },
  {
    "userId": 2,
    "id": 24,
    "title": "adipisci non ad dicta qui amet quaerat doloribus ea",
    "completed": false
  },
  {
    "userId": 2,
    "id": 25,
    "title": "voluptas quo tenetur perspiciatis explicabo natus",
    "completed": true
  },
  {
    "userId": 2,
    "id": 26,
    "title": "aliquam aut quasi",
    "completed": true
  },
  {
    "userId": 2,
    "id": 27,
    "title": "veritatis pariatur delectus",
    "completed": true
  },
  {
    "userId": 2,
    "id": 28,
    "title": "nesciunt totam sit blanditiis sit",
    "completed": false
  },
  {
    "userId": 2,
    "id": 29,
    "title": "laborum aut in quam",
    "completed": false
  },
  {
    "userId": 2,
    "id": 30,
    "title": "nemo perspiciatis repellat ut dolor libero commodi blanditiis omnis",
    "completed": true
  },
  {
    "userId": 2,
    "id": 31,
    "title": "repudiandae totam in est sint facere fuga",
    "completed": false
  },
  {
    "userId": 2,
    "id": 32,
    "title": "earum doloribus ea doloremque quis",
    "completed": false
  },
  {
    "userId": 2,
    "id": 33,
    "title": "sint sit aut vero",
    "completed": false
  },
  {
    "userId": 2,
    "id": 34,
    "title": "porro aut necessitatibus eaque distinctio",
    "completed": false
  },
  {
    "userId": 2,
    "id": 35,
    "title": "repellendus veritatis molestias dicta incidunt",
    "completed": true
  },
  {
    "userId": 2,
    "id": 36,
    "title": "excepturi deleniti adipisci voluptatem et neque optio illum ad",
    "completed": true
  },
  {
    "userId": 2,
    "id": 37,
    "title": "sunt cum tempora",
    "completed": false
  },
  {
    "userId": 2,
    "id": 38,
    "title": "totam quia non",
    "completed": false
  },
  {
    "userId": 2,
    "id": 39,
    "title": "doloremque quibusdam asperiores libero corrupti illum qui omnis",
    "completed": false
  },
  {
    "userId": 2,
    "id": 40,
    "title": "totam atque quo nesciunt",
    "completed": true
  },
  {
    "userId": 3,
    "id": 41,
    "title": "aliquid amet impedit consequatur aspernatur placeat eaque fugiat suscipit",
    "completed": false
  },
  {
    "userId": 3,
    "id": 42,
    "title": "rerum perferendis error quia ut eveniet",
    "completed": false
  },
  {
    "userId": 3,
    "id": 43,
    "title": "tempore ut sint quis recusandae",
    "completed": true
  },
  {
    "userId": 3,
    "id": 44,
    "title": "cum debitis quis accusamus doloremque ipsa natus sapiente omnis",
    "completed": true
  },
  {
    "userId": 3,
    "id": 45,
    "title": "velit soluta adipisci molestias reiciendis harum",
    "completed": false
  },
  {
    "userId": 3,
    "id": 46,
    "title": "vel voluptatem repellat nihil placeat corporis",
    "completed": false
  },
  {
    "userId": 3,
    "id": 47,
    "title": "nam qui rerum fugiat accusamus",
    "completed": false
  },
  {
    "userId": 3,
    "id": 48,
    "title": "sit reprehenderit omnis quia",
    "completed": false
  },
  {
    "userId": 3,
    "id": 49,
    "title": "ut necessitatibus aut maiores debitis officia blanditiis velit et",
    "completed": false
  },
  {
    "userId": 3,
    "id": 50,
    "title": "cupiditate necessitatibus ullam aut quis dolor voluptate",
    "completed": true
  },
  {
    "userId": 3,
    "id": 51,
    "title": "distinctio exercitationem ab doloribus",
    "completed": false
  },
  {
    "userId": 3,
    "id": 52,
    "title": "nesciunt dolorum quis recusandae ad pariatur ratione",
    "completed": false
  },
  {
    "userId": 3,
    "id": 53,
    "title": "qui labore est occaecati recusandae aliquid quam",
    "completed": false
  },
  {
    "userId": 3,
    "id": 54,
    "title": "quis et est ut voluptate quam dolor",
    "completed": true
  },
  {
    "userId": 3,
    "id": 55,
    "title": "voluptatum omnis minima qui occaecati provident nulla voluptatem ratione",
    "completed": true
  },
  {
    "userId": 3,
    "id": 56,
    "title": "deleniti ea temporibus enim",
    "completed": true
  },
  {
    "userId": 3,
    "id": 57,
    "title": "pariatur et magnam ea doloribus similique voluptatem rerum quia",
    "completed": false
  },
  {
    "userId": 3,
    "id": 58,
    "title": "est dicta totam qui explicabo doloribus qui dignissimos",
    "completed": false
  },
  {
    "userId": 3,
    "id": 59,
    "title": "perspiciatis velit id laborum placeat iusto et aliquam odio",
    "completed": false
  },
  {
    "userId": 3,
    "id": 60,
    "title": "et sequi qui architecto ut adipisci",
    "completed": true
  },
  {
    "userId": 4,
    "id": 61,
    "title": "odit optio omnis qui sunt",
    "completed": true
  },
  {
    "userId": 4,
    "id": 62,
    "title": "et placeat et tempore aspernatur sint numquam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 63,
    "title": "doloremque aut dolores quidem fuga qui nulla",
    "completed": true
  },
  {
    "userId": 4,
    "id": 64,
    "title": "voluptas consequatur qui ut quia magnam nemo esse",
    "completed": false
  },
  {
    "userId": 4,
    "id": 65,
    "title": "fugiat pariatur ratione ut asperiores necessitatibus magni",
    "completed": false
  },
  {
    "userId": 4,
    "id": 66,
    "title": "rerum eum molestias autem voluptatum sit optio",
    "completed": false
  },
  {
    "userId": 4,
    "id": 67,
    "title": "quia voluptatibus voluptatem quos similique maiores repellat",
    "completed": false
  },
  {
    "userId": 4,
    "id": 68,
    "title": "aut id perspiciatis voluptatem iusto",
    "completed": false
  },
  {
    "userId": 4,
    "id": 69,
    "title": "doloribus sint dolorum ab adipisci itaque dignissimos aliquam suscipit",
    "completed": false
  },
  {
    "userId": 4,
    "id": 70,
    "title": "ut sequi accusantium et mollitia delectus sunt",
    "completed": false
  },
  {
    "userId": 4,
    "id": 71,
    "title": "aut velit saepe ullam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 72,
    "title": "praesentium facilis facere quis harum voluptatibus voluptatem eum",
    "completed": false
  },
  {
    "userId": 4,
    "id": 73,
    "title": "sint amet quia totam corporis qui exercitationem commodi",
    "completed": true
  },
  {
    "userId": 4,
    "id": 74,
    "title": "expedita tempore nobis eveniet laborum maiores",
    "completed": false
  },
  {
    "userId": 4,
    "id": 75,
    "title": "occaecati adipisci est possimus totam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 76,
    "title": "sequi dolorem sed",
    "completed": true
  },
  {
    "userId": 4,
    "id": 77,
    "title": "maiores aut nesciunt delectus exercitationem vel assumenda eligendi at",
    "completed": false
  },
  {
    "userId": 4,
    "id": 78,
    "title": "reiciendis est magnam amet nemo iste recusandae impedit quaerat",
    "completed": false
  },
  {
    "userId": 4,
    "id": 79,
    "title": "eum ipsa maxime ut",
    "completed": true
  },
  {
    "userId": 4,
    "id": 80,
    "title": "tempore molestias dolores rerum sequi voluptates ipsum consequatur",
    "completed": true
  },
  {
    "userId": 5,
    "id": 81,
    "title": "suscipit qui totam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 82,
    "title": "voluptates eum voluptas et dicta",
    "completed": false
  },
  {
    "userId": 5,
    "id": 83,
    "title": "quidem at rerum quis ex aut sit quam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 84,
    "title": "sunt veritatis ut voluptate",
    "completed": false
  },
  {
    "userId": 5,
    "id": 85,
    "title": "et quia ad iste a",
    "completed": true
  },
  {
    "userId": 5,
    "id": 86,
    "title": "incidunt ut saepe autem",
    "completed": true
  },
  {
    "userId": 5,
    "id": 87,
    "title": "laudantium quae eligendi consequatur quia et vero autem",
    "completed": true
  },
  {
    "userId": 5,
    "id": 88,
    "title": "vitae aut excepturi laboriosam sint aliquam et et accusantium",
    "completed": false
  },
  {
    "userId": 5,
    "id": 89,
    "title": "sequi ut omnis et",
    "completed": true
  },
  {
    "userId": 5,
    "id": 90,
    "title": "molestiae nisi accusantium tenetur dolorem et",
    "completed": true
  },
  {
    "userId": 5,
    "id": 91,
    "title": "nulla quis consequatur saepe qui id expedita",
    "completed": true
  },
  {
    "userId": 5,
    "id": 92,
    "title": "in omnis laboriosam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 93,
    "title": "odio iure consequatur molestiae quibusdam necessitatibus quia sint",
    "completed": true
  },
  {
    "userId": 5,
    "id": 94,
    "title": "facilis modi saepe mollitia",
    "completed": false
  },
  {
    "userId": 5,
    "id": 95,
    "title": "vel nihil et molestiae iusto assumenda nemo quo ut",
    "completed": true
  },
  {
    "userId": 5,
    "id": 96,
    "title": "nobis suscipit ducimus enim asperiores voluptas",
    "completed": false
  },
  {
    "userId": 5,
    "id": 97,
    "title": "dolorum laboriosam eos qui iure aliquam",
    "completed": false
  },
  {
    "userId": 5,
    "id": 98,
    "title": "debitis accusantium ut quo facilis nihil quis sapiente necessitatibus",
    "completed": true
  },
  {
    "userId": 5,
    "id": 99,
    "title": "neque voluptates ratione",
    "completed": false
  },
  {
    "userId": 5,
    "id": 100,
    "title": "excepturi a et neque qui expedita vel voluptate",
    "completed": false
  },
  {
    "userId": 6,
    "id": 101,
    "title": "explicabo enim cumque porro aperiam occaecati minima",
    "completed": false
  },
  {
    "userId": 6,
    "id": 102,
    "title": "sed ab consequatur",
    "completed": false
  },
  {
    "userId": 6,
    "id": 103,
    "title": "non sunt delectus illo nulla tenetur enim omnis",
    "completed": false
  },
  {
    "userId": 6,
    "id": 104,
    "title": "excepturi non laudantium quo",
    "completed": false
  },
  {
    "userId": 6,
    "id": 105,
    "title": "totam quia dolorem et illum repellat voluptas optio",
    "completed": true
  },
  {
    "userId": 6,
    "id": 106,
    "title": "ad illo quis voluptatem temporibus",
    "completed": true
  },
  {
    "userId": 6,
    "id": 107,
    "title": "praesentium facilis omnis laudantium fugit ad iusto nihil nesciunt",
    "completed": false
  },
  {
    "userId": 6,
    "id": 108,
    "title": "a eos eaque nihil et exercitationem incidunt delectus",
    "completed": true
  },
  {
    "userId": 6,
    "id": 109,
    "title": "autem temporibus harum quisquam in culpa",
    "completed": true
  },
  {
    "userId": 6,
    "id": 110,
    "title": "aut aut ea corporis",
    "completed": true
  },
  {
    "userId": 6,
    "id": 111,
    "title": "magni accusantium labore et id quis provident",
    "completed": false
  },
  {
    "userId": 6,
    "id": 112,
    "title": "consectetur impedit quisquam qui deserunt non rerum consequuntur eius",
    "completed": false
  },
  {
    "userId": 6,
    "id": 113,
    "title": "quia atque aliquam sunt impedit voluptatum rerum assumenda nisi",
    "completed": false
  },
  {
    "userId": 6,
    "id": 114,
    "title": "cupiditate quos possimus corporis quisquam exercitationem beatae",
    "completed": false
  },
  {
    "userId": 6,
    "id": 115,
    "title": "sed et ea eum",
    "completed": false
  },
  {
    "userId": 6,
    "id": 116,
    "title": "ipsa dolores vel facilis ut",
    "completed": true
  },
  {
    "userId": 6,
    "id": 117,
    "title": "sequi quae est et qui qui eveniet asperiores",
    "completed": false
  },
  {
    "userId": 6,
    "id": 118,
    "title": "quia modi consequatur vero fugiat",
    "completed": false
  },
  {
    "userId": 6,
    "id": 119,
    "title": "corporis ducimus ea perspiciatis iste",
    "completed": false
  },
  {
    "userId": 6,
    "id": 120,
    "title": "dolorem laboriosam vel voluptas et aliquam quasi",
    "completed": false
  },
  {
    "userId": 7,
    "id": 121,
    "title": "inventore aut nihil minima laudantium hic qui omnis",
    "completed": true
  },
  {
    "userId": 7,
    "id": 122,
    "title": "provident aut nobis culpa",
    "completed": true
  },
  {
    "userId": 7,
    "id": 123,
    "title": "esse et quis iste est earum aut impedit",
    "completed": false
  },
  {
    "userId": 7,
    "id": 124,
    "title": "qui consectetur id",
    "completed": false
  },
  {
    "userId": 7,
    "id": 125,
    "title": "aut quasi autem iste tempore illum possimus",
    "completed": false
  },
  {
    "userId": 7,
    "id": 126,
    "title": "ut asperiores perspiciatis veniam ipsum rerum saepe",
    "completed": true
  },
  {
    "userId": 7,
    "id": 127,
    "title": "voluptatem libero consectetur rerum ut",
    "completed": true
  },
  {
    "userId": 7,
    "id": 128,
    "title": "eius omnis est qui voluptatem autem",
    "completed": false
  },
  {
    "userId": 7,
    "id": 129,
    "title": "rerum culpa quis harum",
    "completed": false
  },
  {
    "userId": 7,
    "id": 130,
    "title": "nulla aliquid eveniet harum laborum libero alias ut unde",
    "completed": true
  },
  {
    "userId": 7,
    "id": 131,
    "title": "qui ea incidunt quis",
    "completed": false
  },
  {
    "userId": 7,
    "id": 132,
    "title": "qui molestiae voluptatibus velit iure harum quisquam",
    "completed": true
  },
  {
    "userId": 7,
    "id": 133,
    "title": "et labore eos enim rerum consequatur sunt",
    "completed": true
  },
  {
    "userId": 7,
    "id": 134,
    "title": "molestiae doloribus et laborum quod ea",
    "completed": false
  },
  {
    "userId": 7,
    "id": 135,
    "title": "facere ipsa nam eum voluptates reiciendis vero qui",
    "completed": false
  },
  {
    "userId": 7,
    "id": 136,
    "title": "asperiores illo tempora fuga sed ut quasi adipisci",
    "completed": false
  },
  {
    "userId": 7,
    "id": 137,
    "title": "qui sit non",
    "completed": false
  },
  {
    "userId": 7,
    "id": 138,
    "title": "placeat minima consequatur rem qui ut",
    "completed": true
  },
  {
    "userId": 7,
    "id": 139,
    "title": "consequatur doloribus id possimus voluptas a voluptatem",
    "completed": false
  },
  {
    "userId": 7,
    "id": 140,
    "title": "aut consectetur in blanditiis deserunt quia sed laboriosam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 141,
    "title": "explicabo consectetur debitis voluptates quas quae culpa rerum non",
    "completed": true
  },
  {
    "userId": 8,
    "id": 142,
    "title": "maiores accusantium architecto necessitatibus reiciendis ea aut",
    "completed": true
  },
  {
    "userId": 8,
    "id": 143,
    "title": "eum non recusandae cupiditate animi",
    "completed": false
  },
  {
    "userId": 8,
    "id": 144,
    "title": "ut eum exercitationem sint",
    "completed": false
  },
  {
    "userId": 8,
    "id": 145,
    "title": "beatae qui ullam incidunt voluptatem non nisi aliquam",
    "completed": false
  },
  {
    "userId": 8,
    "id": 146,
    "title": "molestiae suscipit ratione nihil odio libero impedit vero totam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 147,
    "title": "eum itaque quod reprehenderit et facilis dolor autem ut",
    "completed": true
  },
  {
    "userId": 8,
    "id": 148,
    "title": "esse quas et quo quasi exercitationem",
    "completed": false
  },
  {
    "userId": 8,
    "id": 149,
    "title": "animi voluptas quod perferendis est",
    "completed": false
  },
  {
    "userId": 8,
    "id": 150,
    "title": "eos amet tempore laudantium fugit a",
    "completed": false
  },
  {
    "userId": 8,
    "id": 151,
    "title": "accusamus adipisci dicta qui quo ea explicabo sed vero",
    "completed": true
  },
  {
    "userId": 8,
    "id": 152,
    "title": "odit eligendi recusandae doloremque cumque non",
    "completed": false
  },
  {
    "userId": 8,
    "id": 153,
    "title": "ea aperiam consequatur qui repellat eos",
    "completed": false
  },
  {
    "userId": 8,
    "id": 154,
    "title": "rerum non ex sapiente",
    "completed": true
  },
  {
    "userId": 8,
    "id": 155,
    "title": "voluptatem nobis consequatur et assumenda magnam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 156,
    "title": "nam quia quia nulla repellat assumenda quibusdam sit nobis",
    "completed": true
  },
  {
    "userId": 8,
    "id": 157,
    "title": "dolorem veniam quisquam deserunt repellendus",
    "completed": true
  },
  {
    "userId": 8,
    "id": 158,
    "title": "debitis vitae delectus et harum accusamus aut deleniti a",
    "completed": true
  },
  {
    "userId": 8,
    "id": 159,
    "title": "debitis adipisci quibusdam aliquam sed dolore ea praesentium nobis",
    "completed": true
  },
  {
    "userId": 8,
    "id": 160,
    "title": "et praesentium aliquam est",
    "completed": false
  },
  {
    "userId": 9,
    "id": 161,
    "title": "ex hic consequuntur earum omnis alias ut occaecati culpa",
    "completed": true
  },
  {
    "userId": 9,
    "id": 162,
    "title": "omnis laboriosam molestias animi sunt dolore",
    "completed": true
  },
  {
    "userId": 9,
    "id": 163,
    "title": "natus corrupti maxime laudantium et voluptatem laboriosam odit",
    "completed": false
  },
  {
    "userId": 9,
    "id": 164,
    "title": "reprehenderit quos aut aut consequatur est sed",
    "completed": false
  },
  {
    "userId": 9,
    "id": 165,
    "title": "fugiat perferendis sed aut quidem",
    "completed": false
  },
  {
    "userId": 9,
    "id": 166,
    "title": "quos quo possimus suscipit minima ut",
    "completed": false
  },
  {
    "userId": 9,
    "id": 167,
    "title": "et quis minus quo a asperiores molestiae",
    "completed": false
  },
  {
    "userId": 9,
    "id": 168,
    "title": "recusandae quia qui sunt libero",
    "completed": false
  },
  {
    "userId": 9,
    "id": 169,
    "title": "ea odio perferendis officiis",
    "completed": true
  },
  {
    "userId": 9,
    "id": 170,
    "title": "quisquam aliquam quia doloribus aut",
    "completed": false
  },
  {
    "userId": 9,
    "id": 171,
    "title": "fugiat aut voluptatibus corrupti deleniti velit iste odio",
    "completed": true
  },
  {
    "userId": 9,
    "id": 172,
    "title": "et provident amet rerum consectetur et voluptatum",
    "completed": false
  },
  {
    "userId": 9,
    "id": 173,
    "title": "harum ad aperiam quis",
    "completed": false
  },
  {
    "userId": 9,
    "id": 174,
    "title": "similique aut quo",
    "completed": false
  },
  {
    "userId": 9,
    "id": 175,
    "title": "laudantium eius officia perferendis provident perspiciatis asperiores",
    "completed": true
  },
  {
    "userId": 9,
    "id": 176,
    "title": "magni soluta corrupti ut maiores rem quidem",
    "completed": false
  },
  {
    "userId": 9,
    "id": 177,
    "title": "et placeat temporibus voluptas est tempora quos quibusdam",
    "completed": false
  },
  {
    "userId": 9,
    "id": 178,
    "title": "nesciunt itaque commodi tempore",
    "completed": true
  },
  {
    "userId": 9,
    "id": 179,
    "title": "omnis consequuntur cupiditate impedit itaque ipsam quo",
    "completed": true
  },
  {
    "userId": 9,
    "id": 180,
    "title": "debitis nisi et dolorem repellat et",
    "completed": true
  },
  {
    "userId": 10,
    "id": 181,
    "title": "ut cupiditate sequi aliquam fuga maiores",
    "completed": false
  },
  {
    "userId": 10,
    "id": 182,
    "title": "inventore saepe cumque et aut illum enim",
    "completed": true
  },
  {
    "userId": 10,
    "id": 183,
    "title": "omnis nulla eum aliquam distinctio",
    "completed": true
  },
  {
    "userId": 10,
    "id": 184,
    "title": "molestias modi perferendis perspiciatis",
    "completed": false
  },
  {
    "userId": 10,
    "id": 185,
    "title": "voluptates dignissimos sed doloribus animi quaerat aut",
    "completed": false
  },
  {
    "userId": 10,
    "id": 186,
    "title": "explicabo odio est et",
    "completed": false
  },
  {
    "userId": 10,
    "id": 187,
    "title": "consequuntur animi possimus",
    "completed": false
  },
  {
    "userId": 10,
    "id": 188,
    "title": "vel non beatae est",
    "completed": true
  },
  {
    "userId": 10,
    "id": 189,
    "title": "culpa eius et voluptatem et",
    "completed": true
  },
  {
    "userId": 10,
    "id": 190,
    "title": "accusamus sint iusto et voluptatem exercitationem",
    "completed": true
  },
  {
    "userId": 10,
    "id": 191,
    "title": "temporibus atque distinctio omnis eius impedit tempore molestias pariatur",
    "completed": true
  },
  {
    "userId": 10,
    "id": 192,
    "title": "ut quas possimus exercitationem sint voluptates",
    "completed": false
  },
  {
    "userId": 10,
    "id": 193,
    "title": "rerum debitis voluptatem qui eveniet tempora distinctio a",
    "completed": true
  },
  {
    "userId": 10,
    "id": 194,
    "title": "sed ut vero sit molestiae",
    "completed": false
  },
  {
    "userId": 10,
    "id": 195,
    "title": "rerum ex veniam mollitia voluptatibus pariatur",
    "completed": true
  },
  {
    "userId": 10,
    "id": 196,
    "title": "consequuntur aut ut fugit similique",
    "completed": true
  },
  {
    "userId": 10,
    "id": 197,
    "title": "dignissimos quo nobis earum saepe",
    "completed": true
  },
  {
    "userId": 10,
    "id": 198,
    "title": "quis eius est sint explicabo",
    "completed": true
  },
  {
    "userId": 10,
    "id": 199,
    "title": "numquam repellendus a magnam",
    "completed": true
  },
  {
    "userId": 10,
    "id": 200,
    "title": "ipsam aperiam voluptates qui",
    "completed": false
  }
];
};
currentModulo.assets.functions["xoos95m"]= function (CTX, G){
var OUT=[];
  OUT.push("\n<p>"); // "<p>"
  OUT.push(G.escapeText(CTX.state.name)); // "state.name"
  OUT.push(" | "); // "|"
  OUT.push(G.escapeText(CTX.state.location)); // "state.location"
  OUT.push("</p>\n<p>"); // "</p><p>"
  OUT.push(G.escapeText(CTX.state.bio)); // "state.bio"
  OUT.push("</p>\n<a href=\"https://github.com/"); // "</p><a href=\"https://github.com/"
  OUT.push(G.escapeText(CTX.state.search)); // "state.search"
  OUT.push("/\" target=\"_blank\">\n    "); // "/\" target=\"_blank\">"
  if (CTX.state.search) { // "if state.search"
  OUT.push("github.com/"); // "github.com/"
  OUT.push(G.escapeText(CTX.state.search)); // "state.search"
  OUT.push("/"); // "/"
  } // "endif"
  OUT.push("\n</a>\n<input [state.bind]=\"\" name=\"search\" placeholder=\"Type GitHub username\">\n<button @click:=\"script.fetchGitHub\">Get Info</button>\n"); // "</a><input [state.bind]=\"\" name=\"search\" placeholder=\"Type GitHub username\"><button @click:=\"script.fetchGitHub\">Get Info</button>"

return OUT.join("");
};
currentModulo.assets.functions["397k54"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function fetchGitHub() {
        fetch(`https://api.github.com/users/${state.search}`)
            .then(response => response.json())
            .then(githubCallback);
    }
    function githubCallback(apiData) {
        state.name = apiData.name;
        state.location = apiData.location;
        state.bio = apiData.bio;
        element.rerender();
    }

return { "fetchGitHub": typeof fetchGitHub !== "undefined" ? fetchGitHub : undefined,
"githubCallback": typeof githubCallback !== "undefined" ? githubCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1op6kq6"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <div style=\"float: right\">\n        <p><label>Hue:<br>\n            <input [state.bind]=\"\" name=\"hue\" type=\"range\" min=\"0\" max=\"359\" step=\"1\">\n        </label></p>\n        <p><label>Saturation: <br>\n            <input [state.bind]=\"\" name=\"sat\" type=\"range\" min=\"0\" max=\"100\" step=\"1\">\n            </label></p>\n        <p><label>Luminosity:<br>\n            <input [state.bind]=\"\" name=\"lum\" type=\"range\" min=\"0\" max=\"100\" step=\"1\">\n            </label></p>\n    </div>\n    <div style=\"\n        width: 80px; height: 80px;\n        background: hsl("); // "<div style=\"float: right\"><p><label>Hue:<br><input [state.bind]=\"\" name=\"hue\" type=\"range\" min=\"0\" max=\"359\" step=\"1\"></label></p><p><label>Saturation: <br><input [state.bind]=\"\" name=\"sat\" type=\"range\" min=\"0\" max=\"100\" step=\"1\"></label></p><p><label>Luminosity:<br><input [state.bind]=\"\" name=\"lum\" type=\"range\" min=\"0\" max=\"100\" step=\"1\"></label></p></div><div style=\" width: 80px; height: 80px; background: hsl("
  OUT.push(G.escapeText(CTX.state.hue)); // "state.hue"
  OUT.push(", "); // ","
  OUT.push(G.escapeText(CTX.state.sat)); // "state.sat"
  OUT.push("%, "); // "%,"
  OUT.push(G.escapeText(CTX.state.lum)); // "state.lum"
  OUT.push("%)\">\n    </div>\n"); // "%)\"></div>"

return OUT.join("");
};
currentModulo.assets.functions["e3c95l"]= function (CTX, G){
var OUT=[];
  OUT.push("\n<p>Type a book name for \"search as you type\"\n(e.g. try “the lord of the rings”)</p>\n\n<input [state.bind]=\"\" name=\"search\" @keyup:=\"script.typingCallback\">\n\n<div class=\"results "); // "<p>Type a book name for \"search as you type\" (e.g. try “the lord of the rings”)</p><input [state.bind]=\"\" name=\"search\" @keyup:=\"script.typingCallback\"><div class=\"results"
  if (CTX.state.search.length > 0) { // "if state.search.length gt 0"
  OUT.push("\n                      visible "); // "visible"
  } // "endif"
  OUT.push("\">\n  <div class=\"results-container\">\n    "); // "\"><div class=\"results-container\">"
  if (CTX.state.loading) { // "if state.loading"
  OUT.push("\n      <img src=\""); // "<img src=\""
  OUT.push(G.escapeText(CTX.staticdata.gif)); // "staticdata.gif"
  OUT.push("\" alt=\"loading\">\n    "); // "\" alt=\"loading\">"
  } else { // "else"
  OUT.push("\n      "); // ""
  var ARR1=CTX.state.results;for (var KEY in ARR1) {CTX. result=ARR1[KEY]; // "for result in state.results"
  OUT.push("\n        <div class=\"result\">\n          <img src=\""); // "<div class=\"result\"><img src=\""
  OUT.push(G.escapeText(G.filters["add"](CTX.staticdata.cover,CTX.result.cover_i))); // "staticdata.cover|add:result.cover_i"
  OUT.push("-S.jpg\"> <label>"); // "-S.jpg\"><label>"
  OUT.push(G.escapeText(CTX.result.title)); // "result.title"
  OUT.push("</label>\n        </div>\n      "); // "</label></div>"
  G.FORLOOP_NOT_EMPTY2=true; } if (!G.FORLOOP_NOT_EMPTY2) { // "empty"
  OUT.push("\n        <p>No books found.</p>\n      "); // "<p>No books found.</p>"
  }G.FORLOOP_NOT_EMPTY2 = false; // "endfor"
  OUT.push("\n    "); // ""
  } // "endif"
  OUT.push("\n  </div>\n</div>\n"); // "</div></div>"

return OUT.join("");
};
currentModulo.assets.functions["4amukg"]= function (){
return {
  apiBase: 'https://openlibrary.org/search.json',
  cover: 'https://covers.openlibrary.org/b/id/',
  gif: 'https://cdnjs.cloudflare.com/ajax/libs/' +
    'semantic-ui/0.16.1/images/loader-large.gif'
};
};
currentModulo.assets.functions["1qe3kff"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function typingCallback() {
        state.loading = true;
        const search = `q=${state.search}`;
        const opts = 'limit=6&fields=title,author_name,cover_i';
        const url = `${staticdata.apiBase}?${search}&${opts}`;
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

    let _globalDebounceTimeout = null;
    function _globalDebounce(func) {
        if (_globalDebounceTimeout) {
            clearTimeout(_globalDebounceTimeout);
        }
        _globalDebounceTimeout = setTimeout(func, 500);
    }

return { "typingCallback": typeof typingCallback !== "undefined" ? typingCallback : undefined,
"dataBackCallback": typeof dataBackCallback !== "undefined" ? dataBackCallback : undefined,
"_globalDebounce": typeof _globalDebounce !== "undefined" ? _globalDebounce : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1u62nuj"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>ISO: <tt>"); // "<p>ISO: <tt>"
  OUT.push(G.escapeText(CTX.state.year)); // "state.year"
  OUT.push("-"); // "-"
  OUT.push(G.escapeText(CTX.state.month)); // "state.month"
  OUT.push("-"); // "-"
  OUT.push(G.escapeText(CTX.state.day)); // "state.day"
  OUT.push("</tt></p>\n    "); // "</tt></p>"
  var ARR0=CTX.state.ordering;for (var KEY in ARR0) {CTX. part=ARR0[KEY]; // "for part in state.ordering"
  OUT.push("\n        <label>\n            "); // "<label>"
  OUT.push(G.escapeText(G.filters["get"](CTX.state,CTX.part))); // "state|get:part"
  OUT.push("\n            <div>\n                <button @click:=\"script.next\" payload=\""); // "<div><button @click:=\"script.next\" payload=\""
  OUT.push(G.escapeText(CTX.part)); // "part"
  OUT.push("\">↑</button>\n                <button @click:=\"script.previous\" payload=\""); // "\">↑</button><button @click:=\"script.previous\" payload=\""
  OUT.push(G.escapeText(CTX.part)); // "part"
  OUT.push("\">↓</button>\n            </div>\n        </label>\n    "); // "\">↓</button></div></label>"
  } // "endfor"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["xeva47l"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function isValid({ year, month, day }) {
        month--; // Months are zero indexed
        const d = new Date(year, month, day);
        return d.getMonth() === month && d.getDate() === day && d.getFullYear() === year;
    }
    function next(part) {
        state[part]++;
        if (!isValid(state)) { // undo if not valid
            state[part]--;
        }
    }
    function previous(part) {
        state[part]--;
        if (!isValid(state)) { // undo if not valid
            state[part]++;
        }
    }

return { "isValid": typeof isValid !== "undefined" ? isValid : undefined,
"next": typeof next !== "undefined" ? next : undefined,
"previous": typeof previous !== "undefined" ? previous : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["1ssp5sa"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <form>\n        "); // "<form>"
  var ARR0=CTX.state.fields;for (var KEY in ARR0) {CTX. field=ARR0[KEY]; // "for field in state.fields"
  OUT.push("\n            <div class=\"field-pair\">\n                <label for=\""); // "<div class=\"field-pair\"><label for=\""
  OUT.push(G.escapeText(CTX.field)); // "field"
  OUT.push("_"); // "_"
  OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
  OUT.push("\">\n                    <strong>"); // "\"><strong>"
  OUT.push(G.escapeText(G.filters["capfirst"](CTX.field))); // "field|capfirst"
  OUT.push(":</strong>\n                </label>\n                <input [state.bind]=\"\" type=\""); // ":</strong></label><input [state.bind]=\"\" type=\""
  if (G.filters["type"](G.filters["get"](CTX.state,CTX.field)) === "string") { // "if state|get:field|type == 'string'"
  OUT.push("text"); // "text"
  } else { // "else"
  OUT.push("checkbox"); // "checkbox"
  } // "endif"
  OUT.push("\" name=\""); // "\" name=\""
  OUT.push(G.escapeText(CTX.field)); // "field"
  OUT.push("\" id=\""); // "\" id=\""
  OUT.push(G.escapeText(CTX.field)); // "field"
  OUT.push("_"); // "_"
  OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
  OUT.push("\">\n            </div>\n        "); // "\"></div>"
  } // "endfor"
  OUT.push("\n    </form>\n"); // "</form>"

return OUT.join("");
};
currentModulo.assets.functions["x110d077"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <form>\n        "); // "<form>"
  var ARR0=CTX.state.fields;for (var KEY in ARR0) {CTX. field=ARR0[KEY]; // "for field in state.fields"
  OUT.push("\n            <div class=\"field-pair\">\n                <label for=\""); // "<div class=\"field-pair\"><label for=\""
  OUT.push(G.escapeText(CTX.field)); // "field"
  OUT.push("_"); // "_"
  OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
  OUT.push("\">\n                    <strong>"); // "\"><strong>"
  OUT.push(G.escapeText(G.filters["capfirst"](CTX.field))); // "field|capfirst"
  OUT.push(":</strong>\n                </label>\n                <input [state.bind]=\"\" type=\""); // ":</strong></label><input [state.bind]=\"\" type=\""
  if (G.filters["type"](G.filters["get"](CTX.state,CTX.field)) === CTX.quotnumberquot) { // "if state|get:field|type == &quot;number&quot;"
  OUT.push("number"); // "number"
  } else { // "else"
  OUT.push("text"); // "text"
  } // "endif"
  OUT.push("\" name=\""); // "\" name=\""
  OUT.push(G.escapeText(CTX.field)); // "field"
  OUT.push("\" id=\""); // "\" id=\""
  OUT.push(G.escapeText(CTX.field)); // "field"
  OUT.push("_"); // "_"
  OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
  OUT.push("\">\n            </div>\n        "); // "\"></div>"
  } // "endfor"
  OUT.push("\n        <button @click:=\"script.submit\">Post comment</button>\n        <hr>\n\n        "); // "<button @click:=\"script.submit\">Post comment</button><hr>"
  var ARR0=G.filters["reversed"](CTX.state.posts);for (var KEY in ARR0) {CTX. post=ARR0[KEY]; // "for post in state.posts|reversed"
  OUT.push("\n            <p>\n                "); // "<p>"
  OUT.push(G.escapeText(CTX.post.userId)); // "post.userId"
  OUT.push(":\n                <strong>"); // ": <strong>"
  OUT.push(G.escapeText(G.filters["truncate"](CTX.post.title,15))); // "post.title|truncate:15"
  OUT.push("</strong>\n                "); // "</strong>"
  OUT.push(G.escapeText(G.filters["truncate"](CTX.post.body,18))); // "post.body|truncate:18"
  OUT.push("\n            </p>\n        "); // "</p>"
  } // "endfor"
  OUT.push("\n    </form>\n"); // "</form>"

return OUT.join("");
};
currentModulo.assets.functions["1qroh1a"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    const URL = 'https://jsonplaceholder.typicode.com/posts';
    const fakedPosts = [];
    const headers = [];

    function initializedCallback() {
        refresh(); // Refresh on first load
    }

    function refresh() {
        fetch(URL).then(r => r.json()).then(data => {
            // Since Typicode API doesn't save it's POST
            // data, we'll have manually fake it here
            state.posts = data.concat(fakedPosts);
            element.rerender();
        });
    }

    function submit() {
        // Rename the state variables to be what the API suggests
        const postData = {
              userId: state.user,
              title: state.topic,
              body: state.comment,
        };
        state.topic = ''; // clear the comment & topic text
        state.comment = '';
        fakedPosts.push(postData); // Required for refresh()

        // Send the POST request with fetch, then refresh after
        const opts = {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: { 'Content-type': 'application/json; charset=UTF-8' },
        };
        fetch(URL, opts).then(r => r.json()).then(refresh);
    }

return { "initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"refresh": typeof refresh !== "undefined" ? refresh : undefined,
"submit": typeof submit !== "undefined" ? submit : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["gukocp"]= function (CTX, G){
var OUT=[];
  OUT.push("\n\n<x-demochart data:=\"[1, 2, 3, 5, 8]\"></x-demochart>\n\n<x-demomodal button=\"Nicholas Cage\" title=\"Biography\">\n    <p>Prolific Hollywood actor</p>\n    <img src=\"https://www.placecage.com/640/360\">\n</x-demomodal>\n\n<x-demomodal button=\"Tommy Wiseau\" title=\"Further Data\">\n    <p>Actor, director, and acclaimed fashion designer</p>\n    <x-demochart data:=\"[50, 13, 94]\"></x-demochart>\n</x-demomodal>\n\n"); // "<x-demochart data:=\"[1, 2, 3, 5, 8]\"></x-demochart><x-demomodal button=\"Nicholas Cage\" title=\"Biography\"><p>Prolific Hollywood actor</p><img src=\"https://www.placecage.com/640/360\"></x-demomodal><x-demomodal button=\"Tommy Wiseau\" title=\"Further Data\"><p>Actor, director, and acclaimed fashion designer</p><x-demochart data:=\"[50, 13, 94]\"></x-demochart></x-demomodal>"

return OUT.join("");
};
currentModulo.assets.functions["xe5l02u"]= function (CTX, G){
var OUT=[];
  OUT.push("\n\n    <!-- Note that even with custom components, core properties like \"style\"\n        are available, making CSS variables a handy way of specifying style\n        overrides. -->\n    <x-demochart data:=\"state.data\" animated:=\"true\" style=\"\n            --align: center;\n            --speed: "); // "<!-- Note that even with custom components, core properties like \"style\" are available, making CSS variables a handy way of specifying style overrides. --><x-demochart data:=\"state.data\" animated:=\"true\" style=\" --align: center; --speed:"
  OUT.push(G.escapeText(CTX.state.anim)); // "state.anim"
  OUT.push(";\n        \"></x-demochart>\n\n    <p>\n        "); // "; \"></x-demochart><p>"
  if (!(CTX.state.playing)) { // "if not state.playing"
  OUT.push("\n            <button @click:=\"script.play\" alt=\"Play\">▶  tick: "); // "<button @click:=\"script.play\" alt=\"Play\">▶ tick:"
  OUT.push(G.escapeText(CTX.state.tick)); // "state.tick"
  OUT.push("</button>\n        "); // "</button>"
  } else { // "else"
  OUT.push("\n            <button @click:=\"script.pause\" alt=\"Pause\">‖  tick: "); // "<button @click:=\"script.pause\" alt=\"Pause\">‖ tick:"
  OUT.push(G.escapeText(CTX.state.tick)); // "state.tick"
  OUT.push("</button>\n        "); // "</button>"
  } // "endif"
  OUT.push("\n    </p>\n\n    "); // "</p>"
  var ARR0=CTX.script.exports.properties;for (var KEY in ARR0) {CTX. name=ARR0[KEY]; // "for name in script.exports.properties"
  OUT.push("\n        <label>"); // "<label>"
  OUT.push(G.escapeText(G.filters["capfirst"](CTX.name))); // "name|capfirst"
  OUT.push(":\n            <input [state.bind]=\"\" name=\""); // ": <input [state.bind]=\"\" name=\""
  OUT.push(G.escapeText(CTX.name)); // "name"
  OUT.push("\" type=\"range\" min=\"1\" max=\"20\" step=\"1\">\n        </label>\n    "); // "\" type=\"range\" min=\"1\" max=\"20\" step=\"1\"></label>"
  } // "endfor"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x1qkh8eg"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    let timeout = null;
    script.exports.properties = ["anim", "speed", "width", "pulse"];//, "offset"];
    function play() {
        state.playing = true;
        nextTick();
    }
    function pause() {
        state.playing = false;
    }
    function setEasing(payload) {
        state.easing = payload;
    }

    function nextTick() {
        if (timeout) {
            clearTimeout(timeout);
        }
        const el = element;
        timeout = setTimeout(() => {
            el.rerender();
        }, 2000 / state.speed);
    }

    function updateCallback() {
        if (state.playing) {
            while (state.data.length <= state.width) {
                state.tick++;
                state.data.push(Math.sin(state.tick / state.pulse) + 1); // add to right
            }
            state.data.shift(); // remove one from left
            nextTick();
        }
    }

return { "play": typeof play !== "undefined" ? play : undefined,
"pause": typeof pause !== "undefined" ? pause : undefined,
"setEasing": typeof setEasing !== "undefined" ? setEasing : undefined,
"nextTick": typeof nextTick !== "undefined" ? nextTick : undefined,
"updateCallback": typeof updateCallback !== "undefined" ? updateCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["f34ecp"]= function (CTX, G){
var OUT=[];
  OUT.push("\n  <div class=\"grid\">\n    "); // "<div class=\"grid\">"
  var ARR0=CTX.script.exports.range;for (var KEY in ARR0) {CTX. i=ARR0[KEY]; // "for i in script.exports.range"
  OUT.push("\n      <div @mouseover:=\"script.setNum\" class=\"\n            "); // "<div @mouseover:=\"script.setNum\" class=\""
  OUT.push("\n            "); // ""
  if (CTX.state.number === CTX.i) { // "if state.number == i"
  OUT.push("number"); // "number"
  } // "endif"
  OUT.push("\n            "); // ""
  if (CTX.state.number < CTX.i) { // "if state.number lt i"
  OUT.push("hidden"); // "hidden"
  } else { // "else"
  OUT.push("\n              "); // ""
  if (G.filters["divisibleby"](CTX.state.number,CTX.i)) { // "if state.number|divisibleby:i"
  OUT.push("whole"); // "whole"
  } // "endif"
  OUT.push("\n            "); // ""
  } // "endif"
  OUT.push("\n        \">"); // "\">"
  OUT.push(G.escapeText(CTX.i)); // "i"
  OUT.push("</div>\n    "); // "</div>"
  } // "endfor"
  OUT.push("\n  </div>\n"); // "</div>"

return OUT.join("");
};
currentModulo.assets.functions["x2f9ogu"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    // Getting big a range of numbers in JS. Use "script.exports"
    // to export this as a one-time global constant.
    // (Hint: Curious how it calculates prime? See CSS!)
    script.exports.range = 
        Array.from({length: 63}, (x, i) => i + 2);
    function setNum(payload, ev) {
        state.number = Number(ev.target.textContent);
    }

return { "setNum": typeof setNum !== "undefined" ? setNum : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["x1qhooen"]= function (CTX, G){
var OUT=[];
  OUT.push("\n"); // ""
  if (!(CTX.state.cards.length)) { // "if not state.cards.length"
  OUT.push("\n    <h3>The Symbolic Memory Game</h3>\n    <p>Choose your difficulty:</p>\n    <button @click:=\"script.setup\" click.payload=\"8\">2x4</button>\n    <button @click:=\"script.setup\" click.payload=\"16\">4x4</button>\n    <button @click:=\"script.setup\" click.payload=\"36\">6x6</button>\n"); // "<h3>The Symbolic Memory Game</h3><p>Choose your difficulty:</p><button @click:=\"script.setup\" click.payload=\"8\">2x4</button><button @click:=\"script.setup\" click.payload=\"16\">4x4</button><button @click:=\"script.setup\" click.payload=\"36\">6x6</button>"
  } else { // "else"
  OUT.push("\n    <div class=\"board\n        "); // "<div class=\"board"
  if (CTX.state.cards.length > 16) { // "if state.cards.length > 16"
  OUT.push("hard"); // "hard"
  } // "endif"
  OUT.push("\">\n    "); // "\">"
  OUT.push("\n    "); // ""
  var ARR1=CTX.state.cards;for (var KEY in ARR1) {CTX. card=ARR1[KEY]; // "for card in state.cards"
  OUT.push("\n        "); // ""
  OUT.push("\n        <div key=\"c"); // "<div key=\"c"
  OUT.push(G.escapeText(CTX.card.id)); // "card.id"
  OUT.push("\" class=\"card\n            "); // "\" class=\"card"
  if ((CTX.state.revealed).includes ? (CTX.state.revealed).includes(CTX.card.id) : (CTX.card.id in CTX.state.revealed)) { // "if card.id in state.revealed"
  OUT.push("\n                flipped\n            "); // "flipped"
  } // "endif"
  OUT.push("\n            \" style=\"\n            "); // "\" style=\""
  if (CTX.state.win) { // "if state.win"
  OUT.push("\n                animation: flipping 0.5s infinite alternate;\n                animation-delay: "); // "animation: flipping 0.5s infinite alternate; animation-delay:"
  OUT.push(G.escapeText(CTX.card.id)); // "card.id"
  OUT.push("."); // "."
  OUT.push(G.escapeText(CTX.card.id)); // "card.id"
  OUT.push("s;\n            "); // "s;"
  } // "endif"
  OUT.push("\n            \" @click:=\"script.flip\" click.payload=\""); // "\" @click:=\"script.flip\" click.payload=\""
  OUT.push(G.escapeText(CTX.card.id)); // "card.id"
  OUT.push("\">\n            "); // "\">"
  if ((CTX.state.revealed).includes ? (CTX.state.revealed).includes(CTX.card.id) : (CTX.card.id in CTX.state.revealed)) { // "if card.id in state.revealed"
  OUT.push("\n                "); // ""
  OUT.push(G.escapeText(CTX.card.symbol)); // "card.symbol"
  OUT.push("\n            "); // ""
  } // "endif"
  OUT.push("\n        </div>\n    "); // "</div>"
  } // "endfor"
  OUT.push("\n    </div>\n    <p style=\""); // "</div><p style=\""
  if (CTX.state.failedflip) { // "if state.failedflip"
  OUT.push("\n                color: red"); // "color: red"
  } // "endif"
  OUT.push("\">\n        "); // "\">"
  OUT.push(G.escapeText(CTX.state.message)); // "state.message"
  OUT.push("</p>\n"); // "</p>"
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x1b55hag"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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

return { "setup": typeof setup !== "undefined" ? setup : undefined,
"failedFlipCallback": typeof failedFlipCallback !== "undefined" ? failedFlipCallback : undefined,
"flip": typeof flip !== "undefined" ? flip : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions["xic9cvd"]= function (CTX, G){
var OUT=[];
  OUT.push("\n  <div class=\"grid\">\n    "); // "<div class=\"grid\">"
  var ARR0=CTX.script.exports.range;for (var KEY in ARR0) {CTX. i=ARR0[KEY]; // "for i in script.exports.range"
  OUT.push("\n        "); // ""
  var ARR1=CTX.script.exports.range;for (var KEY in ARR1) {CTX. j=ARR1[KEY]; // "for j in script.exports.range"
  OUT.push("\n          <div @click:=\"script.toggle\" payload:=\"[ "); // "<div @click:=\"script.toggle\" payload:=\"["
  OUT.push(G.escapeText(CTX.i)); // "i"
  OUT.push(", "); // ","
  OUT.push(G.escapeText(CTX.j)); // "j"
  OUT.push(" ]\" style=\""); // "]\" style=\""
  if (G.filters["get"](CTX.state.cells,CTX.i)) { // "if state.cells|get:i"
  OUT.push("\n                "); // ""
  if (G.filters["get"](G.filters["get"](CTX.state.cells,CTX.i),CTX.j)) { // "if state.cells|get:i|get:j"
  OUT.push("\n                    background: #B90183;\n                "); // "background: #B90183;"
  } // "endif"
  OUT.push("\n            "); // ""
  } // "endif"
  OUT.push("\"></div>\n        "); // "\"></div>"
  } // "endfor"
  OUT.push("\n    "); // ""
  } // "endfor"
  OUT.push("\n  </div>\n  <div class=\"controls\">\n    "); // "</div><div class=\"controls\">"
  if (!(CTX.state.playing)) { // "if not state.playing"
  OUT.push("\n        <button @click:=\"script.play\" alt=\"Play\">▶</button>\n    "); // "<button @click:=\"script.play\" alt=\"Play\">▶</button>"
  } else { // "else"
  OUT.push("\n        <button @click:=\"script.pause\" alt=\"Pause\">‖</button>\n    "); // "<button @click:=\"script.pause\" alt=\"Pause\">‖</button>"
  } // "endif"
  OUT.push("\n\n    <button @click:=\"script.randomize\" alt=\"Randomize\">RND</button>\n    <button @click:=\"script.clear\" alt=\"Randomize\">CLR</button>\n    <label>Spd: <input [state.bind]=\"\" name=\"speed\" type=\"number\" min=\"1\" max=\"10\" step=\"1\"></label>\n  </div>\n"); // "<button @click:=\"script.randomize\" alt=\"Randomize\">RND</button><button @click:=\"script.clear\" alt=\"Randomize\">CLR</button><label>Spd: <input [state.bind]=\"\" name=\"speed\" type=\"number\" min=\"1\" max=\"10\" step=\"1\"></label></div>"

return OUT.join("");
};
currentModulo.assets.functions["xmcdh86"]= function (modulo, require, component, library, props, style, template, staticdata, script, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'modulo') modulo = value; if (name === 'require') require = value; if (name === 'component') component = value; if (name === 'library') library = value; if (name === 'props') props = value; if (name === 'style') style = value; if (name === 'template') template = value; if (name === 'staticdata') staticdata = value; if (name === 'script') script = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function toggle([ i, j ]) {
        if (!state.cells[i]) {
            state.cells[i] = {};
        }
        state.cells[i][j] = !state.cells[i][j];
    }

    function play() {
        state.playing = true;
        setTimeout(() => {
            if (state.playing) {
                updateNextFrame();
                element.rerender(); // manually rerender
                play(); // cue next frame
            }
        }, 2000 / state.speed);
    }

    function pause() {
        state.playing = false;
    }

    function clear() {
        state.cells = {};
    }

    function randomize() {
        for (const i of script.exports.range) {
            for (const j of script.exports.range) {
                if (!state.cells[i]) {
                    state.cells[i] = {};
                }
                state.cells[i][j] = (Math.random() > 0.5);
            }
        }
    }

    // Helper function for getting a cell from data
    const get = (i, j) => !!(state.cells[i] && state.cells[i][j]);
    function updateNextFrame() {
        const nextData = {};
        for (const i of script.exports.range) {
            for (const j of script.exports.range) {
                if (!nextData[i]) {
                    nextData[i] = {};
                }
                const count = countNeighbors(i, j);
                nextData[i][j] = get(i, j) ?
                    (count === 2 || count === 3) : // stays alive
                    (count === 3); // comes alive
            }
        }
        state.cells = nextData;
    }

    function countNeighbors(i, j) {
        const neighbors = [get(i - 1, j), get(i - 1, j - 1), get(i, j - 1),
                get(i + 1, j), get(i + 1, j + 1), get(i, j + 1),
                get(i + 1, j - 1), get(i - 1, j + 1)];
        return neighbors.filter(v => v).length;
    }
    script.exports.range = Array.from({length: 24}, (x, i) => i);

return { "toggle": typeof toggle !== "undefined" ? toggle : undefined,
"play": typeof play !== "undefined" ? play : undefined,
"pause": typeof pause !== "undefined" ? pause : undefined,
"clear": typeof clear !== "undefined" ? clear : undefined,
"randomize": typeof randomize !== "undefined" ? randomize : undefined,
"updateNextFrame": typeof updateNextFrame !== "undefined" ? updateNextFrame : undefined,
"countNeighbors": typeof countNeighbors !== "undefined" ? countNeighbors : undefined,
 setLocalVariable: __set, exports: script.exports}
};
currentModulo.assets.functions['xpq350q'].call(window, currentModulo);

currentModulo.assets.functions['x829hs9']('x-demomodal', currentModulo);

currentModulo.assets.functions['j6jhe5']('x_x_x-demochart', currentModulo);

currentModulo.assets.functions['u4j43f']('x-examplebtn', currentModulo);

currentModulo.assets.functions['x1jemelq']('x-demoselector', currentModulo);

currentModulo.assets.functions['rbuqe3']('mws-page', currentModulo);

currentModulo.assets.functions['x1ek8a23']('mws-devlognav', currentModulo);

currentModulo.assets.functions['xlb2rd4']('mws-docsidebar', currentModulo);

currentModulo.assets.functions['xae74iu']('mws-demo', currentModulo);

currentModulo.assets.functions['xescvna']('mws-allexamples', currentModulo);

currentModulo.assets.functions['x2s8nar']('mws-section', currentModulo);

currentModulo.assets.functions['x1s5o68b']('docseg-templating_1', currentModulo);

currentModulo.assets.functions['x1ut59dd']('docseg-templating_preparecallback', currentModulo);

currentModulo.assets.functions['1hpjg9n']('docseg-templating_comments', currentModulo);

currentModulo.assets.functions['xfvvd04']('docseg-templating_escaping', currentModulo);

currentModulo.assets.functions['1tlgcio']('docseg-tutorial_p1', currentModulo);

currentModulo.assets.functions['xi6k4ld']('docseg-tutorial_p2', currentModulo);

currentModulo.assets.functions['x1dbdrel']('docseg-tutorial_p2_filters_demo', currentModulo);

currentModulo.assets.functions['xflbnij']('docseg-tutorial_p3_state_demo', currentModulo);

currentModulo.assets.functions['x14n2s57']('docseg-tutorial_p3_state_bind', currentModulo);

currentModulo.assets.functions['1sp05hb']('eg-hello', currentModulo);

currentModulo.assets.functions['12v9omt']('eg-simple', currentModulo);

currentModulo.assets.functions['x1i4hc01']('eg-todo', currentModulo);

currentModulo.assets.functions['xqrkh3q']('eg-json', currentModulo);

currentModulo.assets.functions['x1asnbs6']('eg-jsonarray', currentModulo);

currentModulo.assets.functions['x1edl05g']('eg-api', currentModulo);

currentModulo.assets.functions['khu4dj']('eg-colorselector', currentModulo);

currentModulo.assets.functions['q0bbc']('eg-searchbox', currentModulo);

currentModulo.assets.functions['x3ue3jq']('eg-datenumberpicker', currentModulo);

currentModulo.assets.functions['x1lvrjsl']('eg-flexibleform', currentModulo);

currentModulo.assets.functions['x1gjb161']('eg-flexibleformwithapi', currentModulo);

currentModulo.assets.functions['x573nef']('eg-components', currentModulo);

currentModulo.assets.functions['dib48s']('eg-oscillatinggraph', currentModulo);

currentModulo.assets.functions['1f849r0']('eg-primesieve', currentModulo);

currentModulo.assets.functions['1n2i9fj']('eg-memorygame', currentModulo);

currentModulo.assets.functions['86fv1g']('eg-conwaygameoflife', currentModulo);

currentModulo.assets.functions["x8j3c54"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>Before comment</p>\n    "); // "<p>Before comment</p>"
  /* // "comment \"Optional note\""
  OUT.push("\n        <p>Commented out text that will be ignored\n          "); // "<p>Commented out text that will be ignored"
  OUT.push(G.escapeText(G.filters["brokenFilter"](CTX.nonExistingVar,"abc"))); // "nonExistingVar|brokenFilter:\"abc\""
  OUT.push("</p>\n    "); // "</p>"
  */ // "endcomment"
  OUT.push("\n    <p>After comment</p>\n"); // "<p>After comment</p>"

return OUT.join("");
};
currentModulo.assets.functions["x11k4oji"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <ul>\n        "); // "<ul>"
  var ARR0=CTX.state.athletes;for (var KEY in ARR0) {CTX. athlete=ARR0[KEY]; // "for athlete in state.athletes"
  OUT.push("\n            <li>"); // "<li>"
  OUT.push(G.escapeText(CTX.athlete.name)); // "athlete.name"
  OUT.push("</li>\n        "); // "</li>"
  } // "endfor"
  OUT.push("\n    </ul>\n"); // "</ul>"

return OUT.join("");
};
currentModulo.assets.functions["1g4g3r1"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <ul>\n        "); // "<ul>"
  var ARR0=CTX.state.fave_colors;for (var KEY in ARR0) {CTX.name=KEY;CTX.color=ARR0[KEY]; // "for name, color in state.fave_colors"
  OUT.push("\n            <li><strong>"); // "<li><strong>"
  OUT.push(G.escapeText(CTX.name)); // "name"
  OUT.push("</strong>: "); // "</strong>:"
  OUT.push(G.escapeText(CTX.color)); // "color"
  OUT.push("</li>\n        "); // "</li>"
  } // "endfor"
  OUT.push("\n    </ul>\n"); // "</ul>"

return OUT.join("");
};
currentModulo.assets.functions["x14l5i9t"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <ul>\n        "); // "<ul>"
  var ARR0=CTX.state.fave_colors;for (var KEY in ARR0) {CTX.name=KEY;CTX.color=ARR0[KEY]; // "for name, color in state.fave_colors"
  OUT.push("\n            <li><strong>"); // "<li><strong>"
  OUT.push(G.escapeText(CTX.name)); // "name"
  OUT.push("</strong>: "); // "</strong>:"
  OUT.push(G.escapeText(CTX.color)); // "color"
  OUT.push("</li>\n        "); // "</li>"
  G.FORLOOP_NOT_EMPTY1=true; } if (!G.FORLOOP_NOT_EMPTY1) { // "empty"
  OUT.push("\n            No colors were found.\n        "); // "No colors were found."
  }G.FORLOOP_NOT_EMPTY1 = false; // "endfor"
  OUT.push("\n    </ul>\n"); // "</ul>"

return OUT.join("");
};
currentModulo.assets.functions["a5djj"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (CTX.state.show) { // "if state.show"
  OUT.push("\n        Hello testing template world!\n    "); // "Hello testing template world!"
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x7lkdod"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (CTX.state.athletes) { // "if state.athletes"
  OUT.push("\n        Athletes exists. Total athletes: "); // "Athletes exists. Total athletes:"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.athletes))); // "state.athletes|length"
  OUT.push("\n    "); // ""
  } else if (CTX.state.benched) { // "elif state.benched"
  OUT.push("\n        Benched exists. Total benched: "); // "Benched exists. Total benched:"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.benched))); // "state.benched|length"
  OUT.push("\n    "); // ""
  } else { // "else"
  OUT.push("\n        No athletes.\n    "); // "No athletes."
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["2rm5kq"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (CTX.state.somevar === "x") { // "if state.somevar == \"x\""
  OUT.push("\n        This appears if variable somevar equals the string \"x\"\n    "); // "This appears if variable somevar equals the string \"x\""
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x1k1tbb1"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (CTX.state.somevar != "x") { // "if state.somevar != \"x\""
  OUT.push("\n        This appears if variable state.somevar does not equal the string \"x\".\n    "); // "This appears if variable state.somevar does not equal the string \"x\"."
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x15dnkp2"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (!(CTX.state.show)) { // "if not state.show"
  OUT.push("\n        Do not show it!\n    "); // "Do not show it!"
  } else { // "else"
  OUT.push("\n        Show it!\n    "); // "Show it!"
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x8rv5n5"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (CTX.state.somevar < 100) { // "if state.somevar lt 100"
  OUT.push("\n        This appears if variable somevar is less than 100.\n    "); // "This appears if variable somevar is less than 100."
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["cip3uc"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (CTX.state.somevar > 100) { // "if state.somevar gt 100"
  OUT.push("\n        This appears if variable somevar is greater than 100.\n    "); // "This appears if variable somevar is greater than 100."
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["1otvgl5"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if ((CTX.state.era).includes ? (CTX.state.era).includes("B.C.E.") : ("B.C.E." in CTX.state.era)) { // "if \"B.C.E.\" in state.era"
  OUT.push("\n        This appears since \"B.C.E.\" is a substring of \""); // "This appears since \"B.C.E.\" is a substring of \""
  OUT.push(G.escapeText(CTX.state.era)); // "state.era"
  OUT.push("\"\n    "); // "\""
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["ale86f"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  if (G.filters["length"](CTX.state.athletes) > 2) { // "if state.athletes|length gt 2"
  OUT.push("\n        <p>There are more than 2 athletes!</p>\n    "); // "<p>There are more than 2 athletes!</p>"
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["1nj3f1e"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  OUT.push(G.escapeText(G.filters["add"](CTX.state.value,7))); // "state.value|add:7"
  OUT.push(" hacks <br>\n    "); // "hacks <br>"
  OUT.push(G.escapeText(G.filters["add"](CTX.state.value,CTX.state.another))); // "state.value|add:state.another"
  OUT.push(" hz\n"); // "hz"

return OUT.join("");
};
currentModulo.assets.functions["1ofib1a"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    Valid: "); // "Valid:"
  OUT.push(G.escapeText(G.filters["allow"](CTX.state.value,"orange,apple,pear"))); // "state.value|allow:\"orange,apple,pear\""
  OUT.push(" <br>\n    Invalid: "); // "<br> Invalid:"
  OUT.push(G.escapeText(G.filters["allow"](CTX.state.value,"a,b,c"))); // "state.value|allow:\"a,b,c\""
  OUT.push(" <br>\n    Invalid + default: "); // "<br> Invalid + default:"
  OUT.push(G.escapeText(G.filters["default"](G.filters["allow"](CTX.state.value,"a,b,c"),"Oops!"))); // "state.value|allow:\"a,b,c\"|default:\"Oops!\""
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["x1q1s27l"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    The "); // "The"
  OUT.push(G.escapeText(G.filters["capfirst"](CTX.state.value))); // "state.value|capfirst"
  OUT.push(" framework is my favorite\n"); // "framework is my favorite"

return OUT.join("");
};
currentModulo.assets.functions["xqccfe1"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    Fave snack: "); // "Fave snack:"
  OUT.push(G.escapeText(G.filters["default"](CTX.state.snack,"icecream"))); // "state.snack|default:\"icecream\""
  OUT.push(" <br>\n    Snack count: "); // "<br> Snack count:"
  OUT.push(G.escapeText(G.filters["default"](CTX.state.count,"none"))); // "state.count|default:\"none\""
  OUT.push(" <br>\n    Fave soda: "); // "<br> Fave soda:"
  OUT.push(G.escapeText(G.filters["default"](CTX.state.soda,"Cola"))); // "state.soda|default:\"Cola\""
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["xu2cevu"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    Can "); // "Can"
  OUT.push(G.escapeText(CTX.state.value)); // "state.value"
  OUT.push(" divide by 3? <br>\n    "); // "divide by 3? <br>"
  OUT.push(G.escapeText(G.filters["divisibleby"](CTX.state.value,3))); // "state.value|divisibleby:3"
  OUT.push(" <br>\n    "); // "<br>"
  if (G.filters["divisibleby"](CTX.state.value,2)) { // "if state.value|divisibleby:2"
  OUT.push("\n        "); // ""
  OUT.push(G.escapeText(CTX.state.value)); // "state.value"
  OUT.push(" is even\n    "); // "is even"
  } // "endif"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["1sa0mpn"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    Result: "); // "Result:"
  OUT.push(G.escapeText(G.filters["escapejs"](CTX.state.value))); // "state.value|escapejs"
  OUT.push(" <br>\n"); // "<br>"

return OUT.join("");
};
currentModulo.assets.functions["18vl137"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>"); // "<p>"
  OUT.push(G.escapeText(G.filters["first"](CTX.state.athletes))); // "state.athletes|first"
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};
currentModulo.assets.functions["1d8ujon"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>"); // "<p>"
  OUT.push(G.escapeText(G.filters["join"](CTX.state.athletes))); // "state.athletes|join"
  OUT.push("</p>\n    <p>"); // "</p><p>"
  OUT.push(G.escapeText(G.filters["join"](CTX.state.athletes," + "))); // "state.athletes|join:\" + \""
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};
currentModulo.assets.functions["x139tl73"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <pre>"); // "<pre>"
  OUT.push(G.escapeText(G.filters["json"](CTX.state.athletes))); // "state.athletes|json"
  OUT.push("</pre>\n    <pre>"); // "</pre><pre>"
  OUT.push(G.escapeText(G.filters["json"](CTX.state.athletes,2))); // "state.athletes|json:2"
  OUT.push("</pre>\n"); // "</pre>"

return OUT.join("");
};
currentModulo.assets.functions["jrca7"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>"); // "<p>"
  OUT.push(G.escapeText(G.filters["last"](CTX.state.athletes))); // "state.athletes|last"
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};
currentModulo.assets.functions["ljtjgd"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>Sentence length: "); // "<p>Sentence length:"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.sentence))); // "state.sentence|length"
  OUT.push("</p>\n    <p>Flowers length: "); // "</p><p>Flowers length:"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.flowers))); // "state.flowers|length"
  OUT.push("</p>\n    <p>Flights length: "); // "</p><p>Flights length:"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.flights))); // "state.flights|length"
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};
currentModulo.assets.functions["qoh762"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>Without: "); // "<p>Without:"
  OUT.push(G.escapeText(CTX.state.word)); // "state.word"
  OUT.push("</p>\n    <p>Lower: "); // "</p><p>Lower:"
  OUT.push(G.escapeText(G.filters["lower"](CTX.state.word))); // "state.word|lower"
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};
currentModulo.assets.functions["xpgpf73"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    We visited "); // "We visited"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.citynames))); // "state.citynames|length"
  OUT.push(" \n    "); // ""
  OUT.push(G.escapeText(G.filters["pluralize"](G.filters["length"](CTX.state.citynames),"cities,city"))); // "state.citynames|length|pluralize:\"cities,city\""
  OUT.push("\n\n    and picked "); // "and picked"
  OUT.push(G.escapeText(G.filters["length"](CTX.state.flowers))); // "state.flowers|length"
  OUT.push(" \n    flower"); // "flower"
  OUT.push(G.escapeText(G.filters["pluralize"](G.filters["length"](CTX.state.flowers),"s"))); // "state.flowers|length|pluralize:\"s\""
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["12f47p2"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    "); // ""
  OUT.push(G.escapeText(G.filters["subtract"](CTX.state.value,3))); // "state.value|subtract:3"
  OUT.push(" hacks <br>\n    "); // "hacks <br>"
  OUT.push(G.escapeText(G.filters["subtract"](CTX.state.value,CTX.state.another))); // "state.value|subtract:state.another"
  OUT.push(" is the answer\n"); // "is the answer"

return OUT.join("");
};
currentModulo.assets.functions["1p6tva9"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>Long sentence: "); // "<p>Long sentence:"
  OUT.push(G.escapeText(G.filters["truncate"](CTX.state.sentence,20))); // "state.sentence|truncate:20"
  OUT.push("</p>\n    <p>Short word: "); // "</p><p>Short word:"
  OUT.push(G.escapeText(G.filters["truncate"](CTX.state.word,20))); // "state.word|truncate:20"
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};
currentModulo.assets.functions["x36bu36"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>"); // "<p>"
  OUT.push(G.escapeText(G.filters["join"](G.filters["reversed"](CTX.state.flowers)))); // "state.flowers|reversed|join"
  OUT.push("</p>\n    "); // "</p>"
  var ARR0=G.filters["reversed"](CTX.state.cities);for (var KEY in ARR0) {CTX. city=ARR0[KEY]; // "for city in state.cities|reversed"
  OUT.push("\n        <p>"); // "<p>"
  OUT.push(G.escapeText(CTX.city)); // "city"
  OUT.push("</p>\n    "); // "</p>"
  } // "endfor"
  OUT.push("\n"); // ""

return OUT.join("");
};
currentModulo.assets.functions["17hmqg2"]= function (CTX, G){
var OUT=[];
  OUT.push("\n    <p>Without: "); // "<p>Without:"
  OUT.push(G.escapeText(CTX.state.word)); // "state.word"
  OUT.push("</p>\n    <p>Upper: "); // "</p><p>Upper:"
  OUT.push(G.escapeText(G.filters["upper"](CTX.state.word))); // "state.word|upper"
  OUT.push("</p>\n"); // "</p>"

return OUT.join("");
};