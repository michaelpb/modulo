'use strict';
if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
var globals = {HTMLElement};
var Modulo = {globals};

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

Modulo.DeepMap = class DeepMap {
    constructor(copyFrom=null, autoSave=false) {
        // TODO: Move the full version of this class into ModuloDebugger, make
        // it extend Map (for better introspection). The history / savepoints
        // mostly just good for debugging.
        this.label = null;
        this.readOnly = false;
        this.sep = '.';
        if (copyFrom) {
            // Easiest way to setup this one -- todo: should do a deep copy
            this.data = new Map(copyFrom.data);
            this.prefixes = new Map(Array.from(copyFrom.prefixes)
                    .map(([key, set]) => ([key, new Set(set)])));
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
    _getKey(prefix, suffix) {
        const sep = prefix && suffix ? this.sep : '';
        return prefix + sep + suffix;
    }
    setObject(key, obj) {
        for (const [suffix, val] of Object.entries(obj)) {
            this.set(this._getKey(key, suffix), val);
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
            this.data.set(key, value);
            this._updatePrefixesForKey(key);
        }
    }
    _updatePrefixesForKey(key) {
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
    get(key, defaultValue) {
        if (!this.prefixes.has(key)) {
            return defaultValue;
        }
        if (this.data.has(key)){
            return this.data.get(key);
        }
        // This means key is a prefix, so we need to create an obj
        const newObject = {};
        for (const suffix of this.prefixes.get(key)) {
            const [obj, finalInfix] = this._fillInObj(newObject, suffix);
            obj[finalInfix] = this.data.get(this._getKey(key, suffix));
        }
        return newObject;
    }
    _fillInObj(obj, key) {
        const infixes = key.split(this.sep);
        const finalInfix = infixes.pop(); // handle last one separately
        for (const infix of infixes) {
            if (!(infix in obj)) {
                obj[infix] = {};
            }
            obj = obj[infix];
        }
        return [obj, finalInfix];
    }
    toObject() {
        return this.get('', {});
    }
}

Modulo.MultiMap = class MultiMap extends Map {
    get(key) {
        if (!this.has(key)) {
            super.set(key, []);
        }
        return super.get(key);
    }
    set(key, value) {
        this.get(key).push(value);
    }
    toObject() {
        return Object.fromEntries(this);
    }
}

function getFirstModuloAncestor(elem) {
    // Walk up tree to first DOM node that is a modulo component
    const node = elem.parentNode;
    return !node ? null : (
        node.isModuloComponent ? node : getFirstModuloAncestor(node)
    );
}

function isPlainObject(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

function simplifyResolvedLiterals(attrs) {
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

function parseAttrs(elem) {
    const obj = {};
    for (let name of elem.getAttributeNames()) {
        const value = elem.getAttribute(name);
        name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
        obj[name] = value;
    }
    return obj;
}

function assert(value, ...info) {
    if (!value) {
        console.error(...info);
        throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
    }
}

function scopedEval(thisContext, namedArgs, code) {
    const argPairs = Array.from(Object.entries(namedArgs));
    const argNames = argPairs.map(pair => pair[0]);
    const argValues = argPairs.map(pair => pair[1]);
    const func = new Function(...argNames, code);
    return func.apply(thisContext, argValues);
}

function runMiddleware(lifecycleName, cPart, timing, args) {
    const key = `${lifecycleName}.${cPart.name}.${timing}`;
    //console.log('Running middleware', key);
    const middlewareArr = Modulo.Loader.middleware.get(key);
    for (const middleware of middlewareArr) {
        middleware.apply(cPart, args);
    }
}

function runLifecycle(lifecycleName, parts, renderObj, ...extraArgs) {
    let partsArray = [];
    if (isPlainObject(parts)) {
        for (const [partName, partOptionsArr] of Object.entries(parts)) {
            const cPart = Modulo.Loader.componentParts[partName];
            for (const data of partOptionsArr) {
                partsArray.push({cPart, cPartArgs: [data]});
                renderObj.set(cPart.name, data);
            }
        }
    } else {
        partsArray = parts.map(cPart => ({cPart, cPartArgs: []}));
    }
    for (const {cPart, cPartArgs} of partsArray) {
        const args = [...cPartArgs, ...extraArgs, renderObj];
        runMiddleware(lifecycleName, cPart, 'before', args);
        let results = {};
        const method = cPart[lifecycleName + 'Callback'];
        if (method) {
            results = method.apply(cPart, args) || results;
        }
        runMiddleware(lifecycleName, cPart, 'after', args.concat([results]));
        renderObj.set(cPart.name, results);
    }
    if (renderObj.save) {
        renderObj.save(lifecycleName);
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
    static middleware = new Modulo.MultiMap();
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
        this.settings = Object.assign({}, options);
        this.componentFactoryData = factoryData || [];
        this.loadAll();
    }

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

    connectedCallback() {
        this.src = this.getAttribute('src');
        this.initialize(this.getAttribute('namespace'), parseAttrs(this));
        // TODO: Check if already loaded via a global / static serialized obj
        globals.fetch(this.src)
            .then(response => response.text())
            .then(text => this.loadString(text));
    }

    loadString(text, alsoRegister=true) {
        const frag = new globals.DocumentFragment();
        const div = globals.document.createElement('div');
        div.innerHTML = text;
        frag.append(div);
        const results = [];
        for (const tag of div.querySelectorAll('[mod-component]')) {
            const componentFactory = this.loadFromDOMElement(tag, alsoRegister);
            results.push(componentFactory);
            if (alsoRegister) {
                componentFactory.register();
            }
        }
        return results;
    }

    getNodeCPartName(node) {
        const {tagName, nodeType, textContent} = node;
        if (nodeType !== 1) {
            // Text nodes, comment nodes, etc
            if (nodeType === 3 && textContent && textContent.trim()) {
                console.error('Unexpected text in component def:', textContent);
            }
            return null;
        }
        let cPartName = tagName.toLowerCase();
        const splitType = (node.getAttribute('type') || '').split('/');
        if (splitType[0] && splitType[0].toLowerCase() === 'modulo') {
            cPartName = splitType[1];
        }
        if (!(cPartName in Modulo.Loader.componentPartsByTagName)) {
            console.error('Unexpected tag in component def:', tagName);
            return null;
        }
        return cPartName;
    }

    getCPartNamesFromDOM(elem) {
        return Array.from(elem.content.childNodes)
            .map(node => ({node, cPartName: this.getNodeCPartName(node)}))
            .filter(obj => obj.cPartName);
    }

    loadFromDOMElement(elem) {
        const attrs = parseAttrs(elem);
        const name = attrs.modComponent || attrs.name;
        const loadingObj = new Modulo.MultiMap();
        loadingObj.set('component', {name});
        runMiddleware('load', {name: 'component'}, 'before', [elem, this, loadingObj]);

        //const cPartsMap = new Modulo.MultiMap();
        for (const {cPartName, node} of this.getCPartNamesFromDOM(elem)) {
            //cPartsMap.set(cPartName, node);
            const cPart = Modulo.Loader.componentPartsByTagName[cPartName];
            runMiddleware('load', cPart, 'before', [node, this, loadingObj]);
            const results = cPart.loadCallback(node, this, loadingObj);
            runMiddleware('load', cPart, 'after', [node, this, loadingObj, results]);
            loadingObj.set(cPart.name, results);
        }
        // TODO: finish this, possibly, or give up on trying to make load
        // lifecycle behave the same as the others --v
        //runLifecycle('load', cPartsMap.toObject(), loadingObj, this);
        const partsInfo = loadingObj.toObject();
        delete partsInfo['component']; // no need for that anymore!
        this.componentFactoryData.push([name, partsInfo]);
        return this.defineComponent(name, partsInfo);
    }

    defineComponent(name, options) {
        const factory = new Modulo.ComponentFactory(this, name, options);
        runMiddleware('load', {name: 'component'}, 'after', [null, this, null, factory]);
        if (globals.defineComponentCallback) {
            globals.defineComponentCallback(factory); // TODO rm when possible
        }
        return factory;
    }
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
            assert(globals.TinyTiny, 'TinyTiny is not loaded at window.TinyTiny');
            return globals.TinyTiny;
        },
    },
    reconciliation: {
        none: () => (component, html) => {
            component.innerHTML = html;
        },
        setdom: () => {
            assert(globals.setDOM, 'setDOM is not loaded at window.setDOM');
            function makeAttrString(component) {
                return Array.from(component.attributes)
                    .map(({name, value}) => `${name}=${JSON.stringify(value)}`).join(' ');
            }

            function wrapHTML(component, inner) {
                const attrs = makeAttrString(component);
                return `<${component.tagName} ${attrs}>${inner}</${component.tagName}>`;
            }
            const {setDOM} = globals;
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
            assert(globals.morphdom, 'morphdom is not loaded at window.morphdom');
            const {morphdom} = globals;
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

Modulo.ComponentFactory = class ComponentFactory {
    static instances = new Map();
    static registerInstance(instance) {
        Modulo.ComponentFactory.instances.set(instance.fullName, instance);
    }

    constructor(loader, name, options) {
        assert(name, 'Name must be given.');
        this.loader = loader;
        this.options = options;
        this.baseRenderObj = new Modulo.DeepMap();
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;
        Modulo.ComponentFactory.registerInstance(this);
        this.componentClass = this.createClass();
        runLifecycle('factory', options, this.baseRenderObj, this);
    }

    getCParts() {
        const results = [];
        for (const [partName, partOptionsArr] of Object.entries(this.options)) {
            for (const partOptions of partOptionsArr) {
                const cPart = Modulo.Loader.componentParts[partName];
                results.push({cPart, partOptions});
            }
        }
        return results;
    }

    createClass() {
        const {fullName} = this;
        const {reconciliationEngine = 'none'} = this.options;
        const reconcile = Modulo.adapters.reconciliation[reconciliationEngine]();
        return class CustomComponent extends ModuloComponent {
            get factory() {
                return Modulo.ComponentFactory.instances.get(fullName);
            }
            get reconcile() { return reconcile; }
        };
    }

    register() {
        const tagName = this.fullName.toLowerCase();
        globals.customElements.define(tagName, this.componentClass);
    }
}

class ModuloComponent extends HTMLElement {
    constructor() {
        super();
        this.componentParts = [];
        this.originalHTML = this.innerHTML;
        this.initialize();
    }

    initialize() {
        this.name = 'component'; // Used by lifecycle
        this.fullName = this.factory.fullName;
        this.isMounted = false;
        this.isModuloComponent = true; // used when finding parent
        this.initRenderObj = new Modulo.DeepMap(this.factory.baseRenderObj);
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

    updateCallback(renderObj) {
        this.clearEvents();
        const newContents = renderObj.get('template.renderedOutput', '');
        this.reconcile(this, newContents);
        this.rewriteEvents();
    }

    rerender() {
        // Calls all the LifeCycle functions in order
        this.renderObj = new Modulo.DeepMap(this.initRenderObj);
        // TODO: this.renderObj.set('', this.parts); // Flatten part objects into render obj
        this.lifecycle('prepare', 'render', 'update', 'updated');
        this.renderObj = null; // rendering is over, set to null
    }

    lifecycle(...names) {
        const renderObj = this.getCurrentRenderObj();
        for (const name of names) {
            runLifecycle(name, this.componentParts, renderObj);
        }
    }

    getCurrentRenderObj() {
        return (this.renderObj || this.initRenderObj);
    }
    resolveValue(value) {
        // ^-- Shouldn't be necessary, should always know if using renderObj
        // or initRenderObj
        return this.getCurrentRenderObj().get(value);
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
                assert(name.endsWith(':'), 'Events must be resolved attr');
                const listener = (ev) => {
                    const value = el.getAttribute(name);
                    const func = this.getCurrentRenderObj().get(value);
                    assert(func, `Bad ${name}, ${value} is ${func}`);
                    const payloadAttr = `${eventName}.payload`;
                    const payload = el.hasAttribute(payloadAttr) ?
                        el.getAttribute(payloadAttr) : el.value;

                    this.lifecycle('event');
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

    connectedCallback() {
        // TODO: Properly determine the render context component
        this.moduloRenderContext = getFirstModuloAncestor(this); // INCORRECT
        // Note: For testability, constructParts is invoked on first mount,
        // before initialize.  This is so the hacky "fake-upgrade" for custom
        // components works for the automated tests. Logically, it should
        // probably be invoked in the constructor
        this.constructParts();
        this.lifecycle('initialized')
        this.rerender();
        this.isMounted = true;
    }
}

Modulo.ComponentPart = class ComponentPart {
    static loadCallback(node, loader, loadingObj) {
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

    get name() {
        return this.constructor.name;
    }
}

Modulo.parts = {};

Modulo.parts.Props = class Props extends Modulo.ComponentPart {
    static name = 'props';
    static factoryCallback({options}, {componentClass}, renderObj) {
        componentClass.observedAttributes = Object.keys(options);
    }
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
                value = this.component.moduloRenderContext.resolveValue(value);
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
    static factoryCallback({content}, factory, renderObj) {
        // Need to move into somewhere else, as there can't be side-effects here
        /*
        const styling = globals.document.createElement('style');
        styling.append(content);
        globals.document.head.append(styling)
        */
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Style);


Modulo.parts.Template = class Template extends Modulo.ComponentPart {
    static name = 'template';
    static upgradesFrom = ['template'];
    static factoryCallback(opts, factory, renderObj) {
        const {templatingEngine = 'Backtick'} = renderObj.get('template.options', {});
        const templateCompiler = Modulo.adapters.templating[templatingEngine]();
        const compiledTemplate = templateCompiler(opts.content, opts);
        return {compiledTemplate};
    }
    renderCallback(renderObj) {
        const compiledTemplate = renderObj.get('template.compiledTemplate');
        const context = renderObj.toObject();
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

    static wrapJavaScriptContext(contents, localVars) {
        const symbolsString = this.getSymbolsAsObjectAssignment(contents);
        const localVarsLet = localVars.join(',') || 'noLocalVars=true';
        const localVarsIfs = localVars.map(n => `if (name === '${n}') ${n} = value;`).join('\n');
        return `
            'use strict';
            const module = {exports: {}};
            let ${localVarsLet};
            function setLocalVariable(name, value) { ${localVarsIfs} }
            ${contents}
            return { ${symbolsString} ...module.exports, setLocalVariable };
        `;
    }

    static factoryCallback(partOptions, factory, renderObj) {
        const scriptContextDefaults = {...renderObj.toObject(), Modulo};
        const c = partOptions.content || '';
        const localVars = Object.keys(scriptContextDefaults);
        const wrappedJS = this.wrapJavaScriptContext(c, localVars);
        return scopedEval(null, {}, wrappedJS);
        return scopedEval(null, scriptContextDefaults, wrappedJS);
    }

    eventCallback() {
        // Make sure that the local variables are all properly set
        const renderObj = this.component.getCurrentRenderObj();
        const script = renderObj.get('script');
        for (const part of this.component.componentParts) {
            script.setLocalVariable(part.name, part);
        }
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Script);

Modulo.parts.State = class State extends Modulo.ComponentPart {
    static name = 'state';
    static debugGhost = true;
    get debugGhost() { return true; }
    initializedCallback(renderObj) {
        this.rawDefaults = renderObj.get('state').options || {};
        if (!this.data) {
            this.data = simplifyResolvedLiterals(this.rawDefaults); // TODO: Make configurable, switch to DeepMap
        }
    }

    prepareCallback(renderObj) {
        this.initializedCallback(renderObj); // TODO remove this, should not have to
        return this.data;
    }

    reloadCallback(oldPart) {
        this.data = Object.assign({}, oldPart.data, this.data, oldPart.data);
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
    function rewriteComponentNamespace(node, loader, loadingObj, info) {
        let content = info.content || '';
        content = content.replace(/(<\/?)my-/ig, '$1' + loader.namespace + '-')
        info.content = content;
    },
);

Modulo.Loader.registerMiddleware(
    'load.style.after',
    function prefixAllSelectors(node, loader, loadingObj, info) {
        const {name} = loadingObj.get('component')[0];
        const fullName = `${loader.namespace}-${name}`;
        let content = info.content || '';
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
        info.content = content;
    },
);

Modulo.Component = ModuloComponent;
Modulo.defineAll = () => Modulo.Loader.defineCoreCustomElements();

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    globals = window;
}
Modulo.globals = globals;
