class ModuloLoader extends HTMLElement {
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
        return `new ModuloLoader(${arg0}, ${arg1}, ${arg2});`;
    }

    connectedCallback() {
        this.initialize(this.getAttribute('namespace'), parseAttrs(this));
        // TODO: Check if already loaded via serialized etc
        fetch(this.getAttribute('src'))
            .then(response => response.text())
            .then(this.loadString.bind(this));
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
            //   post-compile templates)
        }
        return tagInfo;
    }

    loadString(text) {
        const frag = new DocumentFragment();
        const div = document.createElement('div');
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
        // TODO: Move this to loader middleware?
        const textContent = this.componentFactoryData
            .map(([tagName, options]) =>
                options.style.map(({content}) => content).join('\n')
            ).join('\n');
        const styling = document.createElement('style');
        styling.append(textContent);
        document.head.append(styling)
        console.log('this is me', this.componentFactoryData)
    }

    _checkNode(child, searchTagName) {
        if (child.nodeType === 3 || child.nodeType === 8) {
            return false; // Text node, continue (later generate warning if not whitespace)
        }
        let name = (child.tagName || '').toLowerCase();
        const splitType = (child.getAttribute('type') || '').split('/');
        if (splitType[0] && splitType[0].lower() === 'modulo') {
            name = splitType[1];
        }
        if (!(name in {script: 1, style: 1, template: 1, 'mod-state': 1, 'mod-props': 1})) {
            console.error('Modulo - Unknown tag in component def:', name);
            return false; // Invalid node (later generate warning)
        }
        return name === searchTagName;
    }

    loadTagType(parentElem, searchTagName, componentMeta) {
        const results = [];
        for (const childNode of parentElem.content.childNodes) {
            if (!this._checkNode(childNode, searchTagName)) {
                continue;
            }
            const options = parseAttrs(childNode);
            const content = searchTagName === 'template' ? childNode.innerHTML
                                                         : childNode.textContent;
            let tagInfo = {options, content};
            tagInfo = this.applyMiddleware(searchTagName, tagInfo, componentMeta);
            results.push(tagInfo);
        }
        return results;
    }

    loadFromDOMElement(elem) {
        const attrs = parseAttrs(elem);
        let componentMeta = {content: '', options: attrs};
        componentMeta = this.applyMiddleware('mod-component', componentMeta);
        const style = this.loadTagType(elem, 'style', componentMeta);
        const template = this.loadTagType(elem, 'template', componentMeta);
        const script = this.loadTagType(elem, 'script', componentMeta);
        const state = this.loadTagType(elem, 'mod-state', componentMeta);
        const props = this.loadTagType(elem, 'mod-props', componentMeta);
        assert(style.length < 2, 'Mod: only 1 style'); // later allow for cascading
        assert(script.length < 3, 'Mod: only 1 script'); // ""
        assert(template.length < 2, 'Mod: only 1 template'); // later allow for "selection"
        assert(props.length < 2, 'Mod: only 1 props');
        assert(state.length < 2, 'Mod: only 1 state');
        const options = {template, style, script, state, props, meta: componentMeta};
        this.defineComponent(attrs.modComponent, options);
    }

    defineComponent(name, options) {
        this.componentFactoryData.push([name, options]);
        const componentFactory = new ComponentFactory(this, name, options);
        componentFactory.register();
    }
}

if (typeof module !== 'undefined') { // Node compat
    module.exports = Modulo;
}
