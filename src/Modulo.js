if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
const globals = {HTMLElement};
const Modulo = {globals};
Modulo.DEBUG = true;

function isPlainObject(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
  return Object.prototype.toString.call(obj) === '[object Object]';
}

Modulo.DeepMap = class DeepMap {
    constructor(copyFrom=null, autoSave='lazy') {
        this.label = null;
        this.readOnly = false;
        this.sep = '.';
        if (copyFrom) {
            // Easiest way to setup this one -- todo: should do a deep copy
            this.data = new Map(copyFrom.data);
            this.prefixes = new Map(copyFrom.prefixes);
            //for (const [key, value] of copyFrom.data) {
            //    this.set(key, value, true);
            //}
            this.savepoints = Array.from(copyFrom.savepoints);
        } else {
            this.data = new Map();
            this.prefixes = new Map();
            this.savepoints = [];
        }
        this.shouldAutoSave = {
            'lazy': key => this.data.has(key) && // autosave if not redundant
                           (this.data.get(key) !== this.getLastSavedValue(key)),
            'granular': key => this.data.has(key), // only autosave if conflict
            'manual': key => false, // never autosave
        }[autoSave || 'manual'];
    }
    save(label) {
        const dm = new Modulo.DeepMap(this);
        dm.label = label || null;
        dm.readOnly = true;
        this.savepoints.push(dm);
    }
    setObject(key, obj) {
        for (const [suffix, val] of Object.entries(obj)) {
            const sep = key && suffix ? this.sep : '';
            const fullKey = key + sep + suffix;
            this.set(fullKey, val);
        }
    }
    set(key, value) {
        if (this.readOnly) {
            throw new Error('Read only');
        } else if (isPlainObject(value)) {
            this.setObject(key, value);
        } else {
            if (this.shouldAutoSave(key)) {
                this.save();
            }
            // assert(!this.prefixes.has(key), `Invalid: ${key} is prefix`);
            this.data.set(key, value);
            this._setPrefixesForKey(key);
        }
    }
    _setPrefixesForKey(key) {
        const keyParts = key.split(this.sep);
        let i = 0;
        while (i < keyParts.length + 1) {
            const prefix = keyParts.slice(0, i).join(this.sep);
            const suffix = keyParts.slice(i).join(this.sep);
            if (!this.prefixes.has(prefix)) {
                this.prefixes.set(prefix, new Set());
            }
            this.prefixes.get(prefix).add(suffix);
            i++;
        }
    }
    getAllKeys(level = 1) {
        if (level === 0) {
            return [''];
        }
        const results = [];
        for (const key of this.prefixes.keys()) {
            if (key && key.split(this.sep).length === level) {
                results.push(key);
            }
        }
        return results;
    }
    getLastSavedValue(key, defaultValue) {
        let i = this.savepoints.length;
        while (i > 0) {
            i--;
            const val = this.savepoints[i].get(key);
            if (val !== undefined) {
                return val;
            }
        }
        return defaultValue;
    }
    get(key, defaultValue) {
        if (!this.prefixes.has(key)) {
            return defaultValue;
        }
        if (this.data.has(key)){
            return this.data.get(key);
        }

        // This means key is a prefix, so we need to create an obj
        const obj = {};
        for (const suffix of Array.from(this.prefixes.get(key))) {
            const sep = key && suffix ? this.sep : '';
            const fullKey = key + sep + suffix;
            if (!this.data.has(fullKey)) { // never should happen
                throw 'dont forget the good times we had';
            }
            const value = this.data.get(fullKey);
            this._setObjByDotKey(obj, suffix, value);
        }
        return obj;
    }
    _setObjByDotKey(obj, dotKey, value) {
        const subkeys = dotKey.split(this.sep);
        const lastSubkey = subkeys.pop(); // get rid of last one
        for (const subkey of subkeys) {
            if (!(subkey in obj)) {
                obj[subkey] = {};
            }
            obj = obj[subkey];
        }
        obj[lastSubkey] = value;
    }
    toObject() {
        //return this.get('', {}); // <-- should work
        const obj = {};
        for (const [key, value] of this.data) {
            this._setObjByDotKey(obj, key, value);
        }
        return obj;
    }
    toObjectWithHistory(level) {
        const results = {};
        const hackSeen = new Set();
        for (const dm of this.savepoints.concat([this])) {
            for (const key of dm.getAllKeys(level)) {
                if (!(key in results)) {
                    results[key] = [];
                }

                //////// hack to prevent dupes
                const hackString = JSON.stringify(dm.get(key));
                if (hackSeen.has(hackString)) { continue; }
                else { hackSeen.add(hackString); }
                //////// TODO: Correct behavior is to have another mode that is
                //       careful with history, at the key-level

                results[key].push(dm.get(key));
            }
        }
        return results;
    }
    getAll(key) {
        const results = [];
        for (const dm of this.savepoints.concat([this])) {
            const result = dm.get(key);
            if (typeof result !== 'undefined') {
                results.push(result);
            }
        }
        return results;
    }
}

//Modulo.DeepMap = OldDeepMap;

Modulo.ON_EVENTS = new Set([
    'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
    'onmousemove', 'onmouseout', 'ondragstart', 'ondrag', 'ondragenter',
    'ondragleave', 'ondragover', 'ondrop', 'ondragend', 'onkeydown',
    'onkeypress', 'onkeyup', 'onload', 'onunload', 'onabort', 'onerror',
    'onresize', 'onscroll', 'onselect', 'onchange', 'onsubmit', 'onreset',
    'onfocus', 'onblur',
]);

// TODO: Decide on ':' vs ''
Modulo.ON_EVENT_SELECTOR = Array.from(Modulo.ON_EVENTS).map(name => `[${name}\\:]`).join(',');

function rewriteTemplateTagsAsScriptTags(info, opts) {
    // DEAD CODE
    // NOTE: May need to create a simple helper library of HTML parsing, for
    // both this and componentNamespace and maybe CSS "it's easy"
    return {
        ...info,
        content: info.content.replace(/<template /ig, '<script type="modulo/template"'),
    };
}

function getByDotNotation(obj, key, defaultValue) {
    const specialObj = {};
    const result = key.split('.')
        .reduce((obj, k) => (k in obj ? obj[k] : specialObj), obj);
    return result === specialObj ? defaultValue : result;
}

function simplifyResolvedLiterals(attrs) {
    // TODO: Refactor this with parseAttrs, buildProps & resolveAttr etc
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

function parseAttrs(elem, processColons) {
    const obj = {};
    for (let name of elem.getAttributeNames()) {
        let value = elem.getAttribute(name);
        name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
        if (processColons && name.endsWith(':')) {
            // TODO: Refactor this with buildProps & resolveAttr etc
            name = name.slice(0, -1); // slice out colon
            value = JSON.parse(value);
        }
        obj[name] = value;
    }
    return obj;
}

function assert(value, ...messages) {
    if (!value) {
        console.error(...messages);
        const message = Array.from(messages).join(' ');
        throw new Error(`Modulo Error: "${message}"`)
    }
}

function scopedEval(thisContext, namedArgs, code) {
    const argPairs = Array.from(Object.entries(namedArgs));
    const argNames = argPairs.map(pair => pair[0]);
    const argValues = argPairs.map(pair => pair[1]);
    const func = new Function(...argNames, code);
    return func.apply(thisContext, argValues);
}


function getFirstModuloAncestor(elem) {
    // Walk up tree to first DOM node that is a modulo component
    const node = elem.parentNode;
    return !node ? null : (
        node.isModuloComponent ? node : getFirstModuloAncestor(node)
    );
}

function runMiddleware(middlewareMS, lifecycleName, cPart, timing, renderingObj, args) {
    const key = `${lifecycleName}.${cPart.name}.${timing}`;
    const middlewareArr = middlewareMS.getAll(key);
    for (const middleware of middlewareArr) {
        middleware.apply(cPart, [renderingObj, ...args]);
    }
}

function runLifecycle(lifecycleName, partsArray, renderingObj, includeArgs = false, middleware = null) {
    if (middleware === null) {
        middleware = Modulo.Loader.middleware;
    }
    for (let cPart of partsArray) {
        let args = [];
        if (includeArgs) {
            // todo: remove, when 'load' lifecycle can generate renderingObj
            args = cPart.args;
            cPart = cPart.cPart;
            assert(args, 'need args yo');
        }

        runMiddleware(middleware, lifecycleName, cPart, 'before', renderingObj, args);
        const method = cPart[lifecycleName + 'Callback'];
        if (method) {
            const results = method.apply(cPart, [renderingObj, ...args]);
            if (results) {
                renderingObj.set(cPart.name, results); // beginning of siloing?
            }
        }
        runMiddleware(middleware, lifecycleName, cPart, 'after', renderingObj, args);
    }
    renderingObj.save(lifecycleName);
}

function getGhostElementName(cPart){
    return `ghost-${cPart.name}`;
}

Modulo.DebugGhostBase = class DebugGhostBase extends HTMLElement {
    connectedCallback() {
        if (this.isMounted) { // prevent double-registering
            return;
        }
        this.isMounted = true;
        // https://github.com/WICG/webcomponents/issues/565
        const observer = new globals.MutationObserver(
            mutations => mutations
                .filter(({type}) => type === 'attributes')
                .map(this.attributeMutated, this))
        observer.observe(this, {attributes: true});
    }
    attributeMutated() {
        const parentComponent = getFirstModuloAncestor(this);
        const cPart = parentComponent.getPart(this.name);
        assert(cPart.ghostAttributeMutedCallback, 'not a real ghost');
        cPart.ghostAttributeMutedCallback(this)
    }

    static defineDebugGhost(cPartClass) {
        const tagName = getGhostElementName(cPartClass);
        globals.customElements.define(tagName, class extends Modulo.DebugGhostBase {
            get name() {
                return cPartClass.name;
            }
        });
    }
}

Modulo.Loader = class Loader extends HTMLElement {
    static componentParts = {};
    static componentPartsByTagName = {};
    static registerComponentPart(cPartClass) {
        const {name, upgradesFrom = []} = cPartClass;
        Modulo.Loader.componentParts[name] = cPartClass;
        const names = [`mod-${name}`, ...upgradesFrom];
        for (const name of names) {
            Modulo.Loader.componentPartsByTagName[name] = cPartClass;
        }
    }
    static defineCoreCustomElements() {
        globals.customElements.define('mod-load', Modulo.Loader);
        if (Modulo.DEBUG) {
            const {defineDebugGhost} = Modulo.DebugGhostBase;
            Modulo.Loader.getPartsWithGhosts().forEach(defineDebugGhost);
        }
    }

    static getPartsWithGhosts() {
        return Object.values(Modulo.Loader.componentParts)
            .filter(({debugGhost}) => debugGhost);
    }

    static middleware = new Modulo.DeepMap();
    static registerMiddleware(key, func) {
        assert(key.split('.').filter(p => p).length === 3, 'Invalid name');
        Modulo.Loader.middleware.set(key, func);
    }

    constructor(...args) {
        super()
        this.initialize.apply(this, args);
    }

    initialize(namespace, options, factoryData=null) {
        this.namespace = namespace;
        this.customizedSettings = options;
        this.settings = Object.assign({}, {}, options);
        this.componentFactoryData = [];
        if (factoryData) {
            for (const [name, options] of factoryData) {
                this.defineComponent(name, options);
            }
        }
    }

    serialize() {
        // Note: Will probably rewrite thsi when working on "modulo-cli build"
        const arg0 = JSON.stringify(this.namespace);
        const arg1 = JSON.stringify(this.customizedSettings);
        const arg2 = JSON.stringify(this.componentFactoryData);
        return `new Modulo.Loader(${arg0}, ${arg1}, ${arg2});`;
    }

    connectedCallback() {
        this.initialize(this.getAttribute('namespace'), parseAttrs(this));
        // TODO: Check if already loaded via a global / static serialized obj
        globals.fetch(this.getAttribute('src'))
            .then(response => response.text())
            .then(text => this.loadString(text));
    }

    loadString(text) {
        const frag = new globals.DocumentFragment();
        const div = globals.document.createElement('div');
        div.innerHTML = text;
        frag.append(div);
        this.loadFromDOM(div);
    }

    loadFromDOM(domElement) {
        for (const tag of domElement.querySelectorAll('[mod-component]')) {
            this.loadFromDOMElement(tag);
        }
    }

    getNodeCPartName(child) {
        const {tagName, nodeType, textContent} = child;
        if (nodeType !== 1) {
            // Text nodes, comment nodes, etc
            if (nodeType === 3 && textContent && textContent.trim()) {
                console.error('Unexpected text in component def:', textContent);
            }
            return null;
        }
        let cPartName = tagName.toLowerCase();
        const splitType = (child.getAttribute('type') || '').split('/');
        if (splitType[0] && splitType[0].lower() === 'modulo') {
            cPartName = splitType[1];
        }
        if (!(cPartName in Modulo.Loader.componentPartsByTagName)) {
            console.error('Unexpected tag in component def:', tagName);
            return null;
        }
        return cPartName;
    }

    getCPartClasses(elem) {
        const results = [];
        for (const child of elem.content.childNodes) {
            const cPartName = this.getNodeCPartName(child);
            if (!cPartName) {
                continue;
            }
            // Get part name for this tag
            const cPart = Modulo.Loader.componentPartsByTagName[cPartName];
            const args = [child, this]; // extra args
            results.push({cPart, args});
        }
        return results;
    }

    loadFromDOMElement(elem) {
        const attrs = parseAttrs(elem);
        const name = attrs.modComponent || attrs.name;
        const cPartClasses = this.getCPartClasses(elem);
        const loadingObj = new Modulo.DeepMap(null, 'manual');
        loadingObj.set('component', {name});
        runLifecycle('load', cPartClasses, loadingObj, true);
        const partsInfo = loadingObj.toObjectWithHistory(1);
        delete partsInfo['component']; // no need for that anymore!
        this.defineComponent(name, partsInfo);
    }

    defineComponent(name, options) {
        this.componentFactoryData.push([name, options]);
        const componentFactory = new ComponentFactory(this, name, options);
        componentFactory.register();
    }
}

function genSelectorForDescendant(component, elem) {
    // todo: improve with real key system (?)
    // NOTE: Low priority, since morphdom works great
    const tags = Array.from(component.querySelectorAll(elem.tagName));
    const index = tags.findIndex(el => el === elem);
    return `${elem.tagName}:nth-of-type(${index + 1})`; // tODO: broken
}

function saveFocus(component) {
    component._activeElementSelector = null;
    const {activeElement} = globals.document;
    if (activeElement && component.contains(activeElement)) {
        component._activeElementSelector = genSelectorForDescendant(component, activeElement);
    }
}

function restoreFocus(component) {
    if (component._activeElementSelector) {
        const elem = component.querySelector(component._activeElementSelector);
        if (elem) {
            // https://stackoverflow.com/a/2345915
            elem.focus();
            const {value} = elem;
            elem.value = '';
            elem.value = value;
        } else {
            // console.log('Could not restore focus!', component._activeElementSelector);
        }
    }
    component._activeElementSelector = null;
}


function makeAttrString(component) {
    return Array.from(component.attributes)
        .map(({name, value}) => `${name}=${JSON.stringify(value)}`).join(' ');
}

function wrapHTML(component, inner) {
    const attrs = makeAttrString(component);
    return `<${component.tagName} ${attrs}>${inner}</${component.tagName}>`;
}

Modulo.adapters = {
    templating: {
        Backtick: () => str => {
            // TODO: Need to clean this up
            let html = JSON.stringify(str).replace(/`/g, "\`").slice(1, -1);
            html = html.replace(/&amp;/g, '&'); // probably not needed
            const code = `return \`${html.trim()}\`;`
            return context => scopedEval(null, (context || {}), code);
        },
        TinyTiny: () => {
            assert(globals.window.TinyTiny, 'TinyTiny is not loaded at window.TinyTiny');
            return globals.window.TinyTiny;
        },
    },
    reconciliation: {
        none: () => (component, html) => {
            saveFocus(component);
            component.innerHTML = html;
            restoreFocus(component);
        },
        setdom: () => {
            assert(globals.window.setDOM, 'setDOM is not loaded at window.setDOM');
            const {setDOM} = globals.window;
            setDOM.KEY = 'key';
            return (component, html) => {
                if (!component.isMounted) {
                    component.innerHTML = html;
                } else {
                    setDOM(component, wrapHTML(component, html));
                }
            };
        },
        morphdom: () => {
            assert(globals.window.morphdom, 'morphdom is not loaded at window.morphdom');
            const {morphdom} = globals.window;
            const opts = {
                getNodeKey: el => el.getAttribute && el.getAttribute('key'),
                onBeforeElChildrenUpdated: (fromEl, toEl) => {
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

class ComponentFactory {
    // NOTE: The "dream" is to have an upgraded template like mod-component
    // that instantiates these component factories, but the "upgrade" support
    // seems still kinda iffy
    // Dream alternative: Use mod-load
    constructor(loader, name, options) {
        assert(name, 'Name must be given.');
        this.loader = loader;
        this.options = options;
        this.cParts = this.prepareCPartOptions();
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;
        this.baseRenderingObj = this.prepareBaseRenderingObject();
        this.componentClass = this.createClass();
    }

    prepareCPartOptions() {
        const results = [];
        for (const [partName, partOptionsArr] of Object.entries(this.options)) {
            for (const partOptions of partOptionsArr) {
                const cPart = Modulo.Loader.componentParts[partName];
                const args = [this, partOptions]; // extra args for lifecycle
                results.push({cPart, partOptions, args});
            }
        }
        return results;
    }

    prepareBaseRenderingObject() {
        const renderingObj = new Modulo.DeepMap();
        runLifecycle('factory', this.cParts, renderingObj, true);
        return renderingObj;
    }

    createClass() {
        const factory = this;
        const {reconciliationEngine  = 'none'} = this.options;// TODO FINSIH THIS
        const reconcile = Modulo.adapters.reconciliation[reconciliationEngine]();
        const componentClass = class CustomComponent extends ModuloComponent {
            get factory() { return factory; }
            get reconcile() { return reconcile; }
            static get observedAttributes() {
                // TODO Should be set by factoryCallback in Props
                return [];
            }
        };
        return componentClass;
    }

    getSelected(type) {
        return this.options[type][0];
    }

    register() {
        const tagName = this.fullName.toLowerCase();
        globals.customElements.define(tagName, this.componentClass);
    }
}

class ModuloComponent extends HTMLElement {
    constructor() {
        super();
        this.isMounted = false;
        this.isModuloComponent = true; // used when finding parent
        this.originalHTML = this.innerHTML;
        this.initRenderingObj = new Modulo.DeepMap(this.factory.baseRenderingObj);
        this.componentParts = [];
    }

    constructParts() {
        this.componentParts = [this]; // Include self, to hook into lifecycle
        for (const {cPart, partOptions} of this.factory.cParts) {
            // console.log('this is partOptions during construction:', partOptions);
            const instance = new cPart(this, partOptions);
            this.componentParts.push(instance);
        }
        this.lifecycle('build');
    }

    getPart(searchName) {
        // TODO: Maybe should refactor this? Shouldn't be used much...
        return this.componentParts.find(({name}) => name === searchName);
    }

    prepareCallback() {
        if (Modulo.DEBUG) {
            if (!this.isMounted) {
                this.createGhostElements();
            }
            // saveUtilityComponents
            //const selector = this.getPartsWithGhosts()
            //    .map(getGhostElementName).join(', ')
            //console.log('this is selector', this.getPartsWithGhosts(), selector2);
            const selector = Modulo.Loader.getPartsWithGhosts()
                .map(getGhostElementName).join(', ');
            this.ghostElements = Array.from(this.querySelectorAll(selector));
            this.ghostElements.forEach(elem => elem.remove());
        }
    }

    getPartsWithGhosts() {
        return this.componentParts.filter(p => p.debugGhost || p.constructor.debugGhost);
    }

    updateCallback(renderingObj) {
        this.clearEvents();
        const newContents = renderingObj.get('template.renderedOutput', '');
        this.reconcile(this, newContents);
        this.rewriteEvents();
    }

    updatedCallback() {
        if (Modulo.DEBUG) {
            // restoreUtilityComponents
            this.ghostElements.forEach(elem => this.prepend(elem));
        }
    }

    rerender() {
        // Calls all the LifeCycle functions in order
        this.renderingObj = new Modulo.DeepMap(this.initRenderingObj);
        this.lifecycle('prepare', 'render', 'update', 'updated');
        this.renderingObj = null; // rendering is over, set to null
    }

    lifecycle(...names) {
        const renderingObj = this.getCurrentRenderingObj();
        for (const name of names) {
            runLifecycle(name, this.componentParts, renderingObj);
        }
    }

    getCurrentRenderingObj() {
        return (this.renderingObj || this.initRenderingObj);
    }
    resolveValue(value) {
        // ^-- Shouldn't be necessary, should always know if using renderingObj
        // or initRenderingObj
        return this.getCurrentRenderingObj().get(value);
    }

    resolveAttributeName(name) {
        if (this.hasAttribute(name)) {
            return name;
        } else if (this.hasAttribute(name + ':')) {
            return name + ':';
        }
        return null;
    }

    rewriteEvents() {
        const elements = this.querySelectorAll(Modulo.ON_EVENT_SELECTOR);
        this.clearEvents(); // just in case, also setup events array
        for (const el of elements) {
            for (const name of el.getAttributeNames()) {
                const eventName = name.slice(0, -1);
                if (!Modulo.ON_EVENTS.has(eventName)) {
                    continue;
                }
                assert(name.endsWith(':'), 'Events must be resolved attributes');
                const listener = (ev) => {
                    const value = el.getAttribute(name);
                    const func = this.getCurrentRenderingObj().get(value);
                    assert(func, `Bad ${name}, ${value} is ${func}`);
                    const payloadAttr = `${eventName}.payload`;
                    const payload = el.hasAttribute(payloadAttr) ?
                        el.getAttribute(payloadAttr) : el.value;
                    func.call(this, ev, payload);
                };
                el.addEventListener(eventName.slice(2), listener);
                this.events.push([el, eventName.slice(2), listener]);
            }
        }
    }

    clearEvents() {
        for (const [el, eventName, func] of (this.events || [])) {
            el.removeEventListener(eventName, func);
        }
        this.events = [];
    }

    createGhostElements() {
        for (const cPart of this.getPartsWithGhosts()) {
            const tagName = getGhostElementName(cPart);
            const elem = globals.document.createElement(tagName);
            cPart.ghostCreatedCallback(elem);
            this.prepend(elem);
        }
    }

    connectedCallback() {
        this.parentComponent = getFirstModuloAncestor(this);
        // Note: For testability, buildParts is invoked on first mount, before
        // initialize.  This is so the hacky "fake-upgrade" for custom
        // components works for the automated tests. Logically, it should
        // probably be invoked in the constructor
        this.constructParts();
        this.lifecycle('initialized')
        this.rerender();
        this.isMounted = true;
    }
}

Modulo.ComponentPart = class ComponentPart {
    static loadCallback(renderingObj, node, loader) {
        const options = parseAttrs(node);
        const content = node.tagName === 'TEMPLATE' ? node.innerHTML
                                                    : node.textContent;
        return {options, content};
    }

    constructor(component, options) {
        this.component = component;
        this.options = options.options;
        this.content = options.content;
    }

    buildCallback(renderingObj, node, loader) {
        //console.log('build stage', renderingObj);
        const {options, content} = this;
        return {options, content};
    }

    applyPreprocessors() {
        return this.constructor.name;
    }

    get name() {
        return this.constructor.name;
    }
}

Modulo.parts = {};

Modulo.parts.Props = class Props extends Modulo.ComponentPart {
    static name = 'props';
    initializedCallback(renderObj) {
        return this.buildProps();
    }
    buildProps() {
        // old todo: This logic is bad. There needs to be a concept of...
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
                value = this.component.parentComponent.resolveValue(value);
            }
            props[propName] = value;
        }
        return props;
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Props);

Modulo.parts.Style = class Style extends Modulo.ComponentPart {
    static name = 'style';
    static upgradesFrom = ['style'];
    static factoryCallback(renderingObj, factory, {content}) {
        const styling = globals.document.createElement('style');
        styling.append(content);
        globals.document.head.append(styling)
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Style);


Modulo.parts.Template = class Template extends Modulo.ComponentPart {
    static name = 'template';
    static upgradesFrom = ['template'];
    static factoryCallback(renderingObj, factory, opts) {
        const {templatingEngine = 'Backtick'} = renderingObj.get('template.options', {});
        const templateCompiler = Modulo.adapters.templating[templatingEngine]();
        const compiledTemplate = templateCompiler(opts.content, opts);
        return {compiledTemplate};
    }
    renderCallback(renderingObj) {
        const compiledTemplate = renderingObj.get('template.compiledTemplate');
        const context = renderingObj.toObject();
        const result = compiledTemplate(context);
        return {renderedOutput: result};
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Template);


Modulo.parts.Script = class Script extends Modulo.ComponentPart {
    static name = 'script';
    static upgradesFrom = ['script'];

    static getSymbolsAsObjectAssignment(contents) {
        const regexpG = /function\s+(\w+)/g;
        const regexp2 = /function\s+(\w+)/; // hack, refactor
        return contents.match(regexpG)
            .map(s => s.match(regexp2)[1])
            .map(s => `"${s}": typeof ${s} !== "undefined" ? ${s} : undefined,\n`)
            .join('');
    }

    static wrapJavaScriptContext(contents) {
        const symbolsString = this.getSymbolsAsObjectAssignment(contents);
        return `
            'use strict';
            const module = {exports: {}};
            ${contents}
            return { ${symbolsString} ...module.exports, };
        `;
    }

    static factoryCallback(renderingObj, factory, partOptions) {
        // todo: possibly move part of this into loadCallback, e.g. all string
        // preprocessing -- only if we do the same for precompiled Templates
        const scriptContextDefaults = {...renderingObj.toObject(), Modulo};
        const wrappedJS = this.wrapJavaScriptContext(partOptions.content || '');
        return scopedEval(null, scriptContextDefaults, wrappedJS);
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Script);

Modulo.parts.State = class State extends Modulo.ComponentPart {
    static name = 'state';
    static debugGhost = true;
    get debugGhost() { return true; }
    initializedCallback(renderingObj) {
        this.rawDefaults = renderingObj.get('state', {options: {}}).options;
        this.data = simplifyResolvedLiterals(this.rawDefaults);
        this.component.state = this;
    }
    prepareCallback() {
        return this.data;
    }
    ghostCreatedCallback(ghostElem) {
        this.ghostElem = ghostElem;
        for (const [key, value] of Object.entries(this.rawDefaults)) {
            ghostElem.setAttribute(key, value);
        }
    }
    ghostAttributeMutedCallback(ghostElem) {
        const data = parseAttrs(ghostElem);
        this.data = Object.assign({}, this.data, data);
        this.component.rerender();
    }
    get(key) {
        return this.data[key];
    }
    set(key, value) {
        const data = {[key]: value};
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
Modulo.Loader.registerComponentPart(Modulo.parts.State);

Modulo.Loader.registerMiddleware(
    'load.template.after',
    function rewriteComponentNamespace(renderingObj, node, loader) {
        let content = renderingObj.get('template.content', '');
        content = content.replace(/(<\/?)my-/ig, '$1' + loader.namespace + '-')
        renderingObj.set('template.content', content);
    },
);
Modulo.Loader.registerMiddleware(
    'load.style.after',
    function prefixAllSelectors(renderingObj, node, loader) {
        // TODO: replace with AST based auto-prefixing
        const name = renderingObj.get('component.name');
        const fullName = `${loader.namespace}-${name}`;
        let content = renderingObj.get('style.content', '');
        content = content.replace(/\*\/.*?\*\//ig, ''); // strip comments
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
        renderingObj.set('style.content', content);
    },
);

Modulo.Component = ModuloComponent;
Modulo.defineAll = Modulo.Loader.defineCoreCustomElements;
Modulo.globals = globals;

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    globals.window = window;
    globals.document = document;
    globals.MutationObserver = MutationObserver;
    globals.fetch = window.fetch;
    globals.DocumentFragment = DocumentFragment;
    globals.customElements = customElements;
    Modulo.defineAll();
}
