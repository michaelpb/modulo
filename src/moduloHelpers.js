const Modulo = {};
if (typeof module !== 'undefined') {
    module.exports = Modulo;
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

// TODO: Decide on ":" vs ""
Modulo.ON_EVENT_SELECTOR = Array.from(Modulo.ON_EVENTS).map(name => `[${name}\\:]`).join(',');
// moedco.REWRITE_CHILD_SELECTOR = []; // TODO: Select only children with : in property name

const defaultLifeCycleMethods = {
    initialized: () => {},
    prepare: component => component.factory.prepareDefaultRenderInfo(component),
    render: (context, opts) => opts.compiledTemplate(context),
    update: (component, newContents) => {
        component.clearEvents();
        component.factory.options.meta.reconcile(component, newContents);
        component.rewriteEvents();
    },
    updated: () => {},
};
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
        console.log('this is new CSS', content);
        return {...info, content};
    },
    compileTemplate(info, opts) {
        const templateCompiler = Modulo.adapters.templating[opts.templatingEngine]();
        const compiledTemplate = templateCompiler(info.content, opts);
        return {...info, compiledTemplate};
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
        const message = Array.from(messages).join(' - ');
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
    const observer = new MutationObserver(mutations => mutations
        .filter(({type}) => type === 'attributes')
        .map(element.attributeMutated, element))
    observer.observe(element, {attributes: true});
}

const defaultSettings = {
    factoryMiddleware: {
        template: [middleware.rewriteComponentNamespace, middleware.compileTemplate],
        style: [middleware.prefixAllSelectors],
        script: [],
        'mod-state': [],
        'mod-props': [],
        'mod-component': [middleware.selectReconciliationEngine],
        'mod-load': [],
        //'mod-load': [middleware.rewriteTemplateTagsAsScriptTags],
                        // This is where we can warn if ':="' occurs (:= should
                        // only be for symbols)
    },
    enforceProps: true, // TODO: Put as default seting on mod-props
};



class ModuloConfigure extends HTMLElement {
    static defaultSettings = {};
    connectedCallback() {
        this.settings = parseAttrs(this);
    }
    // attributeChangedCallback() {} // TODO - allow live configuration
}

class ModuloState extends HTMLElement {
    get(key) {
        if (this.hasAttribute(key + ':')) {
            const value = this.getAttribute(key + ':');
            console.log('this is value', value);
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
        this.parentComponent = ModuloComponent.renderStackPeak();
        this.parentComponent.state = this; // Currently assumes 1 state
        if (!this.isMounted) {
            this.defaults = parseAttrs(this, true);
            observeAllAttributes(this);
            this.isMounted = true;
        }
    }
    attributeMutated() {
        //console.log('attributeMutated!'); // TODO dedupe 
        this.parentComponent.rerender();
    }
}

class ModuloProps extends HTMLElement {}
