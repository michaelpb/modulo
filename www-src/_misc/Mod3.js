/*
  What's next:
   3. Work on Library?
*/


/*
  Potentially unifying concept:
    - Library (defines children in silo'ed Modulo)
    - Component (defines children in silo'ed Modulo)
    - ComponentInstance (defines children in silo'ed Modulo)
*/

// Avoid overwriting other Modulo versions / instances
window.ModuloPrevious = window.Modulo;
window.moduloPrevious = window.modulo;

class LegacyCPart {
    static getAttrDefaults(node, loader) {
        return {};
    }

    static factoryHackCallback(modulo, conf) {
        if (!window.facHack){
            window.facHack = {};
        }
        class mock {}
        const data = this.factoryCallback(conf, mock, window.facHack) || data;
        window.facHack[conf.Type.toLowerCase()] = data;
    }

    getDirectives() {
        return [];
    }

    constructor(element, options) {
        this.element = element;
        this.content = options.content;
        this.attrs = options.attrs;
    }
}

window.Modulo = class Modulo {
    constructor(parentModulo = null) {
        this.config = {};
        this.factories = {};
        this.registry = {
            dom: {},
            cparts: {},
            utils: {},
            core: {},
            reconcilers: {}, // maybe merge reconcilers into core?
            templatingEngines: {},
        };
        if (parentModulo) {
            this.parentModulo = parentModulo;
            // should do deep copy here?
            this.config = Object.assign({}, parentModulo.config);
            this.registry = Object.assign({}, parentModulo.registry);
        }
    }

    static configureCallback(modulo, conf) {
        // Configure callback for Modulo object itself
        const { Src, Content, Name } = conf;
        // TODO: Make these configurable, e.g. static/modulo directives
        if (Src) {
            delete conf.Src; // prevent double loading
            modulo.fetchQueue.enqueue(Src, text => { conf.Content += text; });
        } else if (Content) {
            delete conf.Content; // prevent double loading
            modulo.loadString(Content, Name ? `${Name}_` : null);
        }
    }

    register(type, cls, defaults = null) {
        type = (`${type}s` in this.registry) ? `${type}s` : type; // plural / singular
        this.assert(type in this.registry, 'Unknown registration type:', type);
        this.registry[type][cls.name] = cls;

        if (type === 'cparts') { // CParts get loaded from DOM
            this.registry.dom[cls.name.toLowerCase()] = cls;
        }
        if (cls.name[0].toUpperCase() === cls.name[0]) { // is CapFirst
            this.config[cls.name.toLowerCase()] = defaults || cls.defaults || {};
            this.factories[cls.name.toLowerCase()] = {};

            // Global / core utility class getting registered
            if (type === 'core') {
                // TODO: Implement differently, like { fetchQ: utils.FetchQueue } or something
                const lowerName = cls.name[0].toLowerCase() + cls.name.slice(1);
                this[lowerName] = new cls(this);
                this.fetchQ = this.fetchQueue;
                this.assets = this.assetManager;
                this.reconciler = this.modRec;
                this.cmd = this.commandMenu;
            }
        }
    }

    loadFromDOM(elem, selector = null, namePrefix = '') {
        const nodes = selector ? elem.querySelector(selector) : elem.children;
        const partialConfs = [];
        for (const node of nodes) {
            const type = this.getNodeModuloType(node);
            if (!type) {
                continue;
            }

            // TODO: Low hanging fruit to refactor type / name logic here
            const partialConf = this.loadPartialConfigFromNode(node);
            if (!partialConf.Name && 'name' in partialConf) { // TODO, possibly remove
                partialConf.Name = partialConf.name;
            }
            let name = partialConf.Name;
            if (namePrefix) {
                name = namePrefix + (name || type);
            }
            if (name) {
                this.factories[type][name] = Object.assign({}, this.factories[type][name], partialConf);
            } else {
                this.config[type] = partialConf;
            }
            partialConfs.push(partialConf);
        }

        // Then, run configure callback
        this.repeatLifecycle(this.registry.cparts, 'configure', () => {
            console.log('this is the result', this);
        });
        return partialConfs;
    }

    loadString(text, namePrefix = null) {
        /*
        this.reconciler = new this.registry.cparts.Reconciler({
            directives: { 'modulo.dataPropLoad': this },
            directiveShortcuts: [ [ /:$/, 'modulo.dataProp' ] ],
        });
        const div = this.reconciler.loadString(text, {});
        */
        const div = document.createElement('div');
        div.innerHTML = text;
        return this.loadFromDOM(div, null, namePrefix);
    }

    squashFactories() {
        for (const [ type, facs ] of Object.entries(this.factories)) {
            for (const [ name, conf ] of Object.entries(facs)) {
                facs[name] = Object.assign(conf, this.config[type], conf);
            }
        }
    }

    getLifecyclePatches(lcObj, lifecycleName) {
        const patches = [];
        for (const [ typeUpper, obj ] of Object.entries(lcObj)) {
            const methodName = lifecycleName + 'Callback';
            if (!(methodName in obj)) {
                continue; // Skip if obj has not registered callback
            }
            const type = typeUpper.toLowerCase();
            patches.push([ obj, methodName, this.config[type] ]);
            const facs = this.factories[type] || {}; // Loop through facs
            for (const [ name, conf ] of Object.entries(facs)) {
                patches.push([ obj, methodName, facs[name] ]);
            }
        }
        return patches;
    }

    applyPatches(patches, renderObj = null) {
        for (const [ obj, methodName, conf ] of patches) {
            obj[methodName].call(obj, this, conf);
        }
    }

    runLifecycle(lcObj, lifecycleName) {
        this.squashFactories(); // Ensure factories are squashed with config
        const patches = this.getLifecyclePatches(lcObj, lifecycleName);
        this.applyPatches(patches);
        //return patches;
    }

    repeatLifecycle(lcObj, lifecycleName, callback) {
        // First, run lifecycle, then repeat if there is anything left to load
        this.runLifecycle(lcObj, lifecycleName);
        if (Object.keys(this.fetchQueue.queue).length) {
            this.fetchQueue.wait(() => this.repeatLifecycle(lcObj, lifecycleName, callback));
        } else {
            callback();
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
                console.error('Modulo.Loader: Unexpected text:', textContent);
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

    assert(value, ...info) {
        if (!value) {
            console.error(...info);
            throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
        }
    }
}


// Create a new modulo instance to be the global default instance
var modulo = new Modulo();//window.defaultModuloConfig || {});

modulo.register('cpart', Modulo);

// note: Maybe design for no extension, to make mix-ins easier?
//modulo.register('cpart', class Component extends modulo.CPart {

modulo.register('cpart', class Component {
    static configureCallback(modulo, conf) {
        // TODO: Need to also do Src
        const { Content, Name } = conf;
        if (Content) {
            delete conf.Content;
            conf.Children = modulo.loadString(Content, Name ? `${Name}_` : null);
        }
    }

    static configuredCallback(modulo, conf) {
        // (Possibly rename as defineCallback or something?)
        const { Content, Name, Children } = conf;
        if (Children) {
            conf.Children = '';
            const code = `
                let baseRenderObj = {};
                class ${ Name } extends modulo.registry.utils.BaseElement {
                    get baseRenderObj() {
                        return baseRenderObj;
                    }
                    constructor() {
                        super();
                        this.moduloChildrenData = ${ JSON.stringify(Children) };
                        this.modulo = modulo;
                    }
                }
                modulo.repeatLifecycle(modulo.registry.cparts, 'factoryLoad', () => {
                    modulo.globals.customElements.define(tagName, ${ Name });
                    modulo.runLifecycle(modulo.registry.cparts, 'factoryHack', () => {
                        baseRenderObj = window.facHack;
                        delete window.facHack;
                        console.log("Registered: ${ Name }");
                    });
                });
            `;
            const args = [ 'tagName', 'modulo' ];
            const func = modulo.assets.registerFunction(args, code);
            conf.Hash = func.hash;
            const tagName = 'x-' + Name.toLowerCase();
            func(tagName, modulo);
        }
    }

    /*
    static factoryCallback(modulo, conf) {
        // maybe do in sep step like this?
        const { Hash, Name } = conf;
        if (Name && Hash) {
            const tagName = 'x-' + Name.toLowerCase();
            modulo.assets.functions[Hash](tagName, modulo);
        }
    }
    */
}, { mode: 'regular', rerender: 'event', engine: 'ModRec' });

modulo.register('cpart', class Library {
    static configureCallback(modulo, conf) {
        // TODO: untested + Need to also do Src
        const { Content, namespace } = conf;
        // Exposes library at top level:
        if (Content) {
            console.log('Loading library');
            delete conf.Content; // Prevent repeat
            const Mod = modulo.registry.cparts.Modulo;
            const libraryModulo = new Mod(modulo); // "Fork" modulo obj
            libraryModulo.loadString(conf.Content);
            libraryModulo.name = namespace; // TODO Fix, should default to filename of Src, or component namespace, or something
            modulo.register('library', libraryModulo);
        }
    }
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
        this.initRenderObj = Object.assign({}, this.baseRenderObj);
    }

    setupCParts() {
        // This function does the heavy lifting of actually constructing a
        // component, and is invoked when the component is mounted to the page.
        this.cpartSpares = {}; // no need to include, since only 1 element
        console.log('this is cparts', this.modulo);
        const hackCParts = Object.assign({}, this.modulo.registry.dom, this.modulo.registry.cparts);

        // Loop through the parsed array of objects that define the Component
        // Parts for this component, checking for errors.
        for (const partOptions of this.moduloChildrenData) {
            const name = partOptions.Type;
            this.modulo.assert(name in hackCParts, `Unknown cPart: ${name}`);
            if (!(name in this.cpartSpares)) {
                this.cpartSpares[name] = [];
            }
            const instance = new hackCParts[name](this, partOptions);
            this.cpartSpares[name].push(instance);
            this.cparts[name] = instance;
        }
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
        if (!this.isMounted) {
            setTimeout(() => this.parsedCallback(), 0);
        }
    }

    parsedCallback() {
        let original = this;
        /*
        if (this.hasAttribute('modulo-original-html')) {
            original = Modulo.utils.makeDiv(this.getAttribute('modulo-original-html'));
        }
        */
        this.setupCParts();
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
        const hash = Modulo.utils.hash(text);
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
        //src = Modulo.utils.resolvePath(this.basePath || '', src);
        src = (this.basePath || '') + src;

        if (src in this.data) {
            callback(this.data[src], label, src); // Synchronous route
        } else if (!(src in this.queue)) {
            this.queue[src] = [ callback ];
            // TODO: Think about if we want to keep cache:no-store
            Modulo.globals.fetch(src, { cache: 'no-store' })
                .then(response => response.text())
                .then(text => this.receiveData(text, label, src))
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
});


modulo.register('cpart', class Props extends LegacyCPart {
    initializedCallback(renderObj) {
        const props = {};
        const { resolveDataProp } = Modulo.utils;
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


modulo.register('cpart', class Style extends LegacyCPart {
    static factoryCallback({ content }, { loader, name }, loadObj) {
        //if (loadObj.component.attrs.mode === 'shadow') { // TODO finish
        //    return;
        //}
        //if (loadObj.component.attrs.mode === 'regular') { // TODO finish
            const { prefixAllSelectors } = Modulo.cparts.style;
            content = prefixAllSelectors(loader.namespace, name, content);
        //}
        Modulo.assets.registerStylesheet(content);
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

    static prefixAllSelectors(namespace, name, text='') {
        // TODO - Refactor this into a helper in asset manager (has old tests that can be resurrected)
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
});


modulo.register('cpart', class Template extends LegacyCPart {
    static factoryCallback(partOptions, factory, renderObj) {
        const engineClass = Modulo.templating[partOptions.attrs.engine || 'MTL'];
        const opts = Object.assign({}, partOptions.attrs, {
            makeFunc: (a, b) => Modulo.assets.registerFunction(a, b),
        });
        partOptions.instance = new engineClass(partOptions.content, opts);
    }

    constructor(element, options) {
        super(element, options);
        if (options) {
            if (!options.instance) { // TODO: Remove, needed for tests
                Modulo.cparts.template.factoryCallback(options);
            }
            this.instance = options.instance;
        }
    }

    prepareCallback(renderObj) {
        // Exposes templates in render context, so stuff like
        // "|renderas:template.row" works
        // (todo: untested, needs unit testing, iirc?)
        const obj = {};
        for (const template of this.element.cpartSpares.template) {
            obj[template.attrs.name || 'regular'] = template;
            //obj[template.name || 'regular'] = template;
        }
        return obj;
    }

    renderCallback(renderObj) {
        renderObj.component.innerHTML = this.instance.render(renderObj);
    }
});

modulo.register('cpart', class StaticData extends LegacyCPart {
    static factoryCallback(partOptions, factory, renderObj) {
        const code = partOptions.content || ''; // TODO: trim whitespace?
        const defTransform = s => `return ${s.trim()};`;
        //(s => `return ${JSON.stringify(JSON.parse(s))}`);
        const transform = partOptions.attrs.transform || defTransform;
        return Modulo.assets.registerFunction([], transform(code))();
    }
});

modulo.register('cpart', class Script extends LegacyCPart {
    static factoryCallback(partOptions, factory, renderObj) {
        const code = partOptions.content || ''; // TODO: trim whitespace?
        const localVars = Object.keys(renderObj);
        localVars.push('element'); // add in element as a local var
        localVars.push('cparts'); // give access to CParts JS interface
        const ns = factory.loader.namespace;
        const moduleFac = Modulo.factoryInstances[`{ns}-{ns}`];
        const module = moduleFac ? moduleFac.baseRenderObj : null;

        // Combine localVars + fixed args into allArgs
        const args = [ 'Modulo', 'factory', 'module', 'require' ];
        const allArgs = args.concat(localVars.filter(n => !args.includes(n)));
        const opts = { exports: 'script' };
        const func = Modulo.assets.registerFunction(allArgs, code, opts);

        // Now, actually run code in Script tag to do factory method
        const results = func.call(null, Modulo, factory, module, this.require);
        if (results.factoryCallback) {
            //this.prepLocalVars(renderObj); // ?
            results.factoryCallback(partOptions, factory, renderObj);
        }
        results.localVars = localVars;
        return results;
    }

    getDirectives() { // TODO: refactor / rm, maybe move to component, make for all?
        const { script } = this.element.initRenderObj;
        const isCbRegex = /(Unmount|Mount)$/;
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

    constructor(element, options) {
        super(element, options);

        // Attach callbacks from script to this, to hook into lifecycle.
        const { script } = this.element.initRenderObj;
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

modulo.register('cpart', class State extends LegacyCPart {
    getDirectives() {
        return [ 'state.bindMount', 'state.bindUnmount' ];
    }

    initializedCallback(renderObj) {
        if (!this.data) {
            // Initialize with deep copy of attributes
            let { attrs } = this;
            if (attrs.attrs) { // TODO: Hack code here, not sure why its like this
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
        const val = Modulo.utils.get(this.data, name);
        Modulo.assert(val !== undefined, `state.bind "${name}" is undefined`);
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
        Modulo.utils.set(this.data, name, value);
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
            Modulo.assert(name in this._oldData, `There is no "state.${name}"`);
            const val = this.data[name];
            if (name in this.boundElements && val !== this._oldData[name]) {
                this.propagate(name, val);
            }
        }
        this._oldData = null;
    }
});



if (typeof document !== undefined && document.head) { // Browser environ
    Modulo.globals = window;
    modulo.globals = window; // TODO, remove?
    // TODO: REMOVE SELECTOR! IT's borken
    modulo.loadFromDOM(document.head, Modulo.SELECTOR);
    modulo.fetchQ.wait(() => {
        modulo.runLifecycle(modulo.registry.cparts, 'configured');
    });
} else if (typeof exports !== undefined) { // Node.js / silo'ed script
    exports = { Modulo, modulo };
}
