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
        this.componentClass = this.createClass();
    }

    wrapJavaScriptContext(contents) {
        // NOTE: Might want to clean up so we don't have to use eval()?
        return `
            'use strict';
            const module = {exports: {}};
            ${contents}
            return {
                get: (name) => {
                    try { return eval(name); }
                    catch (e) {
                        if (superScript) {
                            return superScript.get(name);
                        } else {
                            return undefined;
                        }
                    }
                },
                ...module.exports,
            };
        `;
    }

    /* Prepares data before render() step of lifecycle */
    prepareDefaultRenderInfo(component) {
        // ...(component.script.get('context') || {}), ????
        return {
            templateInfo: this.getSelected('template'),
            context: component.getDefaultTemplateContext(),
        }
    }

    evalConstructorScript(meta, superScript) {
        const factory = this;
        const scriptContextDefaults = {superScript, factory, meta};
        const wrappedJS = this.wrapJavaScriptContext(meta.content || '');
        return scopedEval(factory, scriptContextDefaults, wrappedJS);
    }

    createClass() {
        // The "script" object represents custom JavaScript in the script
        let superScript = baseScript;
        let script = baseScript;
        for (const meta of this.options.script) {
            script = this.evalConstructorScript(meta, superScript);
            superScript = script;
        }
        const factory = this;
        const componentClass = class CustomComponent extends ModuloComponent {
            get script() { return script; }
            get factory() { return factory; }
            static get observedAttributes() {
                // TODO fix, almost correct
                //const propsInfo = this.getSelected('props');
                //return Array.from(Object.keys(propsInfo.options));
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
        customElements.define(tagName, this.componentClass);
    }
}

class ModuloComponent extends HTMLElement {
    static renderStack = [document.body];
    static renderStackPeak() {
        const { length } = ModuloComponent.renderStack;
        if (length === 0) {
            return null; // Later, have "Global Parent", to make interface with
                         // multi page apps easier?
        }
        return ModuloComponent.renderStack[length - 1];
    }
    renderStackPush() {
        ModuloComponent.renderStack.push(this);
    }
    renderStackPop() {
        ModuloComponent.renderStack.pop();
    }

    constructor() {
        super();
        this.isMounted = false;
        this.originalHTML = this.innerHTML;
    }

    saveUtilityComponents() {
        this.specialComponents = Array.from(this.querySelectorAll('mod-state'));
        this.specialComponents.forEach(elem => elem.remove);
    }

    restoreUtilityComponents() {
        this.specialComponents.forEach(elem => this.prepend(elem));
    }

    rerender() {
        // Calls all the LifeCycle functions in order
        this.renderStackPush();
        if (!this.isMounted) {
            this.createUtilityComponents();
        }
        this.saveUtilityComponents();
        const {context, templateInfo} = this.script.get('prepare').call(this, this);
        const newHTML = this.script.get('render').call(this, context, templateInfo);
        this.script.get('update').call(this, this, newHTML);
        this.script.get('updated').call(this, this);
        this.restoreUtilityComponents();
        this.renderStackPop();
    }

    resolveValue(value) {
        const scriptValue = this.script.get(value);
        if (scriptValue !== undefined) {
            return scriptValue;
        }
        const context = this.getDefaultTemplateContext();
        // Allow "." notation to drill down into context
        return value.split('.').reduce((obj, key) => obj[key], context);
        //return scopedEval(this, context, 'return ' + value);
    }

    getDefaultTemplateContext() {
        const state = this.state && parseAttrs(this.state, true);
        return {state, props: this.props};
    }

    buildProps() {
        const propsInfo = this.factory.getSelected('props');
        if (!propsInfo) {
            this.props = null;
            return;
        }
        this.props = {};
        for (const propName of Object.keys(propsInfo.options)) {
            // if (this.settings.enforceProps) { } // TODO: add enforcement here
            let attrName = this.resolveAttributeName(propName);
            if (!attrName) {
                console.error('Prop', propName, 'is required for', this.tagName);
                continue;
            }
            let value = this.getAttribute(attrName);
            if (attrName.endsWith(':')) {
                // TODO: If we have DOCUMENT tier props, then resolve at window
                // instead
                attrName = attrName.slice(0, -1); // trim ':'
                value = this.parentComponent.resolveValue(value);
            }
            this.props[propName] = value;
        }
        console.log('this is props', this.props);
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
                    // Not sure why this doesn't work:
                    //const currentValue = this.getAttribute(name);
                    //const func = this.resolveValue(currentValue);
                    const func = this.resolveValue(value);
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
            const elem = document.createElement('mod-state');
            for (const [key, value] of Object.entries(options)) {
                elem.setAttribute(key, value);
            }
            this.appendChild(elem);
        }
    }

    connectedCallback() {
        const { length } = ModuloComponent.renderStack;
        this.parentComponent = ModuloComponent.renderStackPeak();
        if (Modulo.DEBUG) { console.log('<', this.tagName, '>', this); }
        this.buildProps();
        this.rerender();
        this.script.get('initialized').call(this, this);
        if (Modulo.DEBUG) { console.log('</', this.tagName, '>'); }
        this.isMounted = true;
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        if (!this.isMounted) {
            return;
        }
        this.buildProps();
        this.rerender();
    }
}

if (typeof module !== 'undefined') { // Node compat
    module.exports = Modulo;
}
