if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
const globals = {HTMLElement};
const Modulo = {globals};

Modulo.GroupedMapStack = class GroupedMapStack {
    static groupPrefix = 'GROUP-';
    constructor(parentStack) {
        this.stack = [];
        this.parentStack = parentStack;
        this.push(''); // start with empty string..?
    }
    pushGroup(name) {
        // probably will be dead code, mapstack is too powerful!
        const {groupPrefix} = Modulo.GroupedMapStack;
        this.stack.push([groupPrefix + name, {}]);
    }
    popThroughGroup(name) {
        // dead code?
        const {groupPrefix} = Modulo.GroupedMapStack;
        let i = this.stack.length - 1;
        while (i >= 0) {
            const name = this.stack[i][0];
            if (name === groupPrefix + name) {
                // found!
                break;
            }
            i--;
        }
        let j = 0;
        while (j < i) {
            this.pop();
            j++;
        }
    }
    push(name) {
        const {groupPrefix} = Modulo.GroupedMapStack;
        this.top = {};
        assert(!name.startsWith(groupPrefix), 'invalid name');
        this.stack.push([name, this.top]);
    }
    pop() {
        // dead code?
        const [name, obj] = this.stack.pop();
        this.top = obj || {};
        return name;
    }
    toObject() {
        // TODO: Recurse into sub-objects and flatten, allowing for proper flattening
        const pObj = this.parentStack ? this.parentStack.toObject() : {};
        return Object.assign(pObj, ...this.stack.map(pair => pair[1]), this.top);
    }
    get(key, defaultValue) {
        const obj = this.toObject();
        const result = key.split('.')
            .reduce((obj, k) => (k in obj ? obj[k] : {}), obj);
        //return key in obj ? obj[key] : defaultValue;
        return result;
    }
    set(key, value) {
        this.top[key] = value;
    }
}

Modulo.DEBUG = true;
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
// moedco.REWRITE_CHILD_SELECTOR = []; // TODO: Select only children with : in property name

// TODO delete these noops -v
const defaultLifeCycleMethods = {};
const baseScript = {get: key => defaultLifeCycleMethods[key]};

const middleware = {
    prefixAllSelectors: (info, {loader}, componentMeta) => {
        // TODO: replace with AST based auto-prefixing
        const name = componentMeta.options.modComponent;
        const fullName = `${loader.namespace}-${name}`;
        //let content = info.content.replace(new RegExp(name, 'ig'), fullName);
        let content = info.content.replace(/\*\/.*?\*\//ig, ''); // strip comments
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
        return {...info, content};
    },
    rewriteComponentNamespace(info, {loader}) {
        return {
            ...info,
            content: info.content.replace(/(<\/?)my-/ig, '$1' + loader.namespace + '-'),
        };
    },
    selectReconciliationEngine(metaInfo, opts) {
        const reconcile = Modulo.adapters.reconciliation[opts.reconciliationEngine]();
        return {...metaInfo, reconcile};
    },
    rewriteTemplateTagsAsScriptTags(info, opts) {
        // NOTE: May need to create a simple helper library of HTML parsing,
        // for both this and componentNamespace and maybe CSS "it's easy"
        return {
            ...info,
            content: info.content.replace(/<template /ig, '<script type="modulo/template"'),
        };
    },
};

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

function observeAllAttributes(element) {
    // https://github.com/WICG/webcomponents/issues/565
    const observer = new globals.MutationObserver(
        mutations => mutations
            .filter(({type}) => type === 'attributes')
            .map(element.attributeMutated, element))
    observer.observe(element, {attributes: true});
}

function getFirstModuloAncestor(elem) {
    // Walk up tree to first DOM node that is a modulo component
    const node = elem.parentNode;
    return !node ? null : (
        node.isModuloComponent ? node : getFirstModuloAncestor(node)
    );
}


function runLifecycle(lifecycleName, partsArray, renderingObj, includeArgs = false) {
    renderingObj.pushGroup(lifecycleName);
    for (let cPart of partsArray) {
        let args = [];
        if (includeArgs) {
            // todo: remove, when 'load' lifecycle can generate renderingObj
            args = cPart.args;
            cPart = cPart.cls;
            assert(args, 'need args yo');
        }
        const method = cPart[lifecycleName + 'Callback'];
        if (method) {
            const results = method.apply(cPart, [renderingObj, ...args]);
            if (results) {
                renderingObj.set(cPart.name, results); // beginning of siloing?
                renderingObj.push(lifecycleName + ':' + cPart.name);
            }
        }
    }
}


const defaultSettings = {
    factoryMiddleware: {
        template: [middleware.rewriteComponentNamespace],
        style: [middleware.prefixAllSelectors],
        script: [],
        'mod-state': [],
        'state': [], // todo
        'mod-props': [],
        'props': [], // todo
        'mod-component': [middleware.selectReconciliationEngine],
        'mod-load': [],
        //'mod-load': [middleware.rewriteTemplateTagsAsScriptTags],
                        // This is where we can warn if ':="' occurs (:= should
                        // only be for symbols)
    },
    enforceProps: true, // TODO: Put as default seting on mod-props
};


Modulo.Loader = class Loader extends HTMLElement {
    static componentParts = {};
    static componentPartsByTagName = {};
    static registerComponentPart(componentClass) {
        const {name, upgradesFrom} = componentClass;
        Modulo.Loader.componentParts[name] = componentClass;
        const names = [`mod-${name}`, ...(upgradesFrom || [])];
        for (const name of names) {
            Modulo.Loader.componentPartsByTagName[name] = componentClass;
        }
    }

    constructor(...args) {
        super()
        this.initialize.apply(this, args);
    }

    initialize(namespace, options, factoryData=null) {
        this.namespace = namespace;
        this.customizedSettings = options;
        this.settings = Object.assign({}, defaultSettings, options);
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

    applyMiddleware(typeName, tagInfo, componentMeta = null) {
        const middlewareArr = this.settings.factoryMiddleware[typeName];
        const attrs = tagInfo.options;
        assert(middlewareArr, 'not midware:', typeName);
        const opts = {
            attrs,
            loader: this,
            reconciliationEngine: attrs.reconciliationEngine || 'none',
            templatingEngine: attrs.templatingEngine || 'Backtick',
        };
        for (const func of middlewareArr) {
            tagInfo = func(tagInfo, opts, componentMeta);
            // TODO: Add asserts to make sure tagInfo remains serializable --
            // factory middleware should be preprocessing only
            // - Later make "executable" string type (for serializing
            // post-compile templates)
        }
        return tagInfo;
    }

    loadString(text) {
        const frag = new globals.DocumentFragment();
        const div = globals.document.createElement('div');
        const tagInfo = {content: text, options: parseAttrs(this)};
        const {content} = this.applyMiddleware('mod-load', tagInfo, {});
        div.innerHTML = content;
        frag.append(div);
        this.loadFromDOM(div);
    }

    loadFromDOM(domElement) {
        const elem = domElement.querySelector('mod-settings');
        Object.assign(this.settings, (elem || {}).settings);
        const tags = domElement.querySelectorAll('[mod-component]');
        for (const tag of tags) {
            this.loadFromDOMElement(tag);
        }
    }

    loadFromDOMElement(elem) {
        const attrs = parseAttrs(elem);
        let componentMeta = {content: '', options: attrs};
        componentMeta = this.applyMiddleware('mod-component', componentMeta);

        // >---< SURGERY
        const partsInfo = {};
        for (const child of elem.content.childNodes) {
            if (child.nodeType === 3 || child.nodeType === 8) {
                // Text nodes & comment nodes
                if (child.nodeType === 3 && child.textContent && child.textContent.trim()) {
                    console.error('Unexpected text in component def:', child.textContent);
                }
                continue;
            }
            let tagName = (child.tagName || '').toLowerCase();
            const splitType = (child.getAttribute('type') || '').split('/');
            if (splitType[0] && splitType[0].lower() === 'modulo') {
                tagName = splitType[1];
            }
            if (!(tagName in Modulo.Loader.componentPartsByTagName)) {
                //console.error('Unexpected tag in component def:', tagName);
                continue;
            }
            // Get part name for this tag
            const partClass = Modulo.Loader.componentPartsByTagName[tagName];
            const {name, loadCallback} = partClass;
            let tagInfo = loadCallback(child);
            tagInfo = this.applyMiddleware(name, tagInfo, componentMeta); // todo: axe middleware
            if (!(name in partsInfo)) {
                partsInfo[name] = [];
            }
            partsInfo[name].push(tagInfo);
        }

        const {props = [], style = [], template = [], script = [], state = []} = partsInfo;
        // >---< SURGERY

        const options = {template, style, script, state, props, meta: componentMeta};
        this.defineComponent(attrs.modComponent, options);
    }

    defineComponent(name, options) {
        this.componentFactoryData.push([name, options]);
        const componentFactory = new ComponentFactory(this, name, options);
        componentFactory.register();
    }
}

class ModuloConfigure extends HTMLElement {
    static defaultSettings = {};
    connectedCallback() {
        this.settings = parseAttrs(this);
    }
    // attributeChangedCallback() {} // TODO - allow live configuration
}

class ModuloState extends HTMLElement {
    // TODO: Replace this with "DebugGhost"
    get(key) {
        if (this.hasAttribute(key + ':')) {
            const value = this.getAttribute(key + ':');
            //console.log('this is value', value);
            return JSON.parse(value);
        } else {
            return this.getAttribute(key);
        }
    }
    set(key, value) {
        if (typeof value !== 'string') {
            value = JSON.stringify(value);
            key += ':';
        }
        this.setAttribute(key, value);
    }

    alter(key, callback) {
        setTimeout(() => this.set(key, callback(this.get(key))), 0);
    }

    reference(key) {
        const newVersion = this.get(key);
        setTimeout(() => this.set(key, newVersion), 0);
        return newVersion;
    }

    connectedCallback() {
        if (!this.isMounted) {
            this.isMounted = true;
            this.defaults = parseAttrs(this, true);
            if (Modulo.DEBUG) {
                observeAllAttributes(this);
            }
        }
    }

    attributeMutated() { // TODO: Clean up, should only use in DEBUG mode
        const parentComponent = getFirstModuloAncestor(this);
        parentComponent.rerender();
    }
}

class ModuloProps extends HTMLElement {}

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
            //console.log('Could not restore focus!', component._activeElementSelector);
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
        this.name = name;
        this.fullName = `${this.loader.namespace}-${name}`;
        this.script = baseScript; // todo: remove after stack rewrite
        this.baseRenderingObj = this.prepareBaseRenderingObject();
        this.componentClass = this.createClass();
    }

    getComponentPartClasses() {
        const results = [];
        for (const [partName, partOptionsArr] of Object.entries(this.options)) {
            if (partName === 'meta') { continue } // HACK // HACK // HACK // HACK
            for (const partOptions of partOptionsArr) {
                const cls = Modulo.Loader.componentParts[partName];
                const args = [this, partOptions]; // extra args
                results.push({cls, args});
            }
        }
        return results;
    }

    prepareBaseRenderingObject() {
        const renderingObj = new Modulo.GroupedMapStack();
        const cParts = this.getComponentPartClasses();
        runLifecycle('factory', cParts, renderingObj, true);
        return renderingObj;
    }

    createClass() {
        /*
        // Old pre-stack script logic:
        let superScript = baseScript;
        let script = baseScript;
        for (const meta of this.options.script) {
            script = this.evalConstructorScript(meta, superScript);
            superScript = script;
        }
        */
        const factory = this;
        const componentClass = class CustomComponent extends ModuloComponent {
            get script() { return factory.script; } // TODO, fix with stacked
            get factory() { return factory; }
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
        this.isModuloComponent = true; // important
        this.originalHTML = this.innerHTML;
        this.initRenderingObj = new Modulo.GroupedMapStack(this.factory.baseRenderingObj);
        this.componentParts = [];
    }

    buildParts() {
        // TODO: Refactor with loop in factory and/or runLifecycle

        // Note: For testability, this is invoked on first mount, before
        // initialize.  This is so the hacky "fake-upgrade" for custom
        // components works for the automated tests. Logically, it should
        // probably be invoked in the constructor
        this.componentParts = [this]; // hook ourselves in
        // console.log('this is facotry options', this.factory.options);
        for (const [partName, partOptionsArr] of Object.entries(this.factory.options)) {
            //if (partName !== 'props') continue; // surgery 
            if (partName === 'meta') { continue } // hack
            // console.log('this is partsOptionsArr', partName, partOptionsArr);
            for (const partOptions of partOptionsArr) {
                const cls = Modulo.Loader.componentParts[partName]
                const instance = new cls(this, partOptions);
                this.componentParts.push(instance);
            }
        }
    }

    saveUtilityComponents() {
        this.specialComponents = Array.from(this.querySelectorAll('mod-state'));
        this.specialComponents.forEach(elem => elem.remove());
    }

    restoreUtilityComponents() {
        this.specialComponents.forEach(elem => this.prepend(elem));
    }

    updateCallback(renderingObj) {
        this.clearEvents();
        const newContents = renderingObj.get('template.renderedOutput', '');
        this.factory.options.meta.reconcile(this, newContents);
        this.rewriteEvents();
    }

    rerender() {
        // Calls all the LifeCycle functions in order
        if (!this.isMounted) {
            this.createUtilityComponents();
        }
        if (Modulo.DEBUG) {
            this.saveUtilityComponents();
        }

        this.renderingObj = new Modulo.GroupedMapStack(this.initRenderingObj);
        const renderingObj = this.renderingObj; //dd
        this.lifecycle('prepare', 'render', 'update', 'updated');
        if (Modulo.DEBUG) {
            this.restoreUtilityComponents();
        }
        this.renderingObj = null; // rendering is over, set to null

        //this.renderingObj.popThroughGroup('prepare'); // unwind back to
        //"prepare" stage -- no need if we have the "parent" system, then we
        //can just toss this one
        //this.prepend(document.createElement('render-marker'));
        //newHTML.replace(/:=(\w+)/g, `"getElementById('thisid').$1"`); // TODO, fix this, see buildProps issue
        //this.querySelector('render-marker').remove();
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
        // Shouldn't be necessary, should always know if using renderingObj or
        // initRenderingObj
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
                const value = el.getAttribute(name);
                const eventName = name.slice(0, -1);
                if (!Modulo.ON_EVENTS.has(eventName)) {
                    continue;
                }
                assert(name.endsWith(':'), 'Events must be resolved attributes');
                const listener = (ev) => {
                    // TODO: get current value, switch to this:
                    //const func = this.resolveValue(currentValue);
                    //const currentValue = el.getAttribute(name);
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

    createUtilityComponents() {
        const stateObjects = this.factory.options.state;
        for (const {options} of stateObjects) {
            const elem = globals.document.createElement('mod-state');
            for (const [key, value] of Object.entries(options)) {
                elem.setAttribute(key, value);
            }
            if (Modulo.DEBUG) {
                this.prepend(elem);
            }
            this.state = elem;
        }
    }

    connectedCallback() {
        this.parentComponent = getFirstModuloAncestor(this);
        this.buildParts();
        this.lifecycle('initialized')
        this.rerender();
        //this.script.get('initialized').call(this, this);
        this.isMounted = true;
    }
}

Modulo.ComponentPart = class ComponentPart {
    static loadCallback(node) {
        const options = parseAttrs(node);
        const content = node.tagName === 'TEMPLATE' ? node.innerHTML
                                                    : node.textContent;
        return {options, content};
    }

    get name() {
        return this.constructor.name;
    }

    constructor(component, options) {
        this.component = component;
        this.options = options.options;
        this.content = options.content;
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
        this.component.props = props; // hack, dd
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
        const {templatingEngine = 'Backtick'} = opts.options;
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
            return {
                ${symbolsString}
                ...module.exports,
            };
        `;
    }

    static evalConstructorScript(meta) {
        // (getting replaced with new stack-based inheritance)
        const superScript = baseScript;
        const factory = null; // ? probably not needed
        const scriptContextDefaults = {superScript, meta, Modulo};
        const wrappedJS = this.wrapJavaScriptContext(meta.content || '');
        return scopedEval(factory, scriptContextDefaults, wrappedJS);
    }

    static factoryCallback(renderingObj, factory, partOptions) {
        // todo: possibly move part of this into loadCallback, e.g. all string
        // preprocessing -- only if we do the same for precompiled Templates
        const script = Modulo.parts.Script.evalConstructorScript(partOptions);
        // TODO delete below after stack-based inheritance
        factory.script = script;
        script.get = name => script[name] || baseScript.get(name);
        return script;
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.Script);


Modulo.parts.State = class State extends Modulo.ComponentPart {
    static name = 'state';
    prepareCallback() {
        const state = this.component.state && parseAttrs(this.component.state, true);
        return state;
    }
}
Modulo.Loader.registerComponentPart(Modulo.parts.State);


Modulo.Component = ModuloComponent;
Modulo.State = ModuloState;
Modulo.Configure = ModuloConfigure;
Modulo.middleware = middleware;
Modulo.globals = globals;
Modulo.defineAll = () => {
    globals.customElements.define('mod-load', Modulo.Loader);
    globals.customElements.define('mod-state', ModuloState);
    globals.customElements.define('mod-props', ModuloProps);
    globals.customElements.define('mod-configure', ModuloConfigure);
};

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
    globals.defineAll();
}
