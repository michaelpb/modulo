
Modulo.cparts.reactcomponent = class ReactComponent extends Modulo.ComponentPart {
    static defineComponent(code, attrs) {
        const { name, namespace } = attrs;

        const reactComponentClass = Modulo.utils.runInReactlikeEnviron(code, attrs);

        class ReactElement extends Modulo.ReactComponentElement {
            mountReactComponent() {
                this.reactRoot = ReactDOM.createRoot(this);
                // TODO: Implement dataProps, etc
                const props = Modulo.utils.mergeAttrs(this, {});
                const elem = React.createElement(
                    reactComponentClass,
                    props,
                    this.textContent, // children?
                );
                this.reactRoot.render(elem);
            }
        }

        const fullName = `${namespace}-${name}`;
        try {
            Modulo.globals.customElements.define(fullName.toLowerCase(), ReactElement);
        } catch (err) {
            console.log('Modulo React Component, cannot register:', err);
            trace();
        }
    }

    static loadCallback(node, loader, array) {
        // Do the base loadCallback
        const result = Modulo.ComponentPart.loadCallback(node, loader, array);
        const { defineComponent } = Modulo.cparts.reactcomponent;
        if (!result.attrs.namespace) {
            result.attrs.namespace = loader.namespace; // TODO: (Hack) - Fix after CPartDef rewrite
        }

        const callback = () => {
            const { content, attrs } = result;
            // TODO: Enqueue imports somehow, for a totally transparent
            // transpiling process?
            defineComponent(content, attrs)
        };

        // Wait on queue if dependencies exist; otherwise, define synchronously
        Modulo.fetchQ.wait(callback);
        return result;
    }
}

Modulo.utils.runInReactlikeEnviron = function runInReactlikeEnviron (code, attrs) {
    const { syncOnlyRequire } = Modulo.utils;
    const DEFAULT_CONF = { presets: [ 'env', 'react' ] };
    const opts = {
        babel: ((attrs && attrs.babel) || DEFAULT_CONF),
        exports: 'module', // exposes module.exports
    };
    const allArgs = [ 'Modulo', 'React', 'require' ];

    // Register function (evalling code)
    const func = Modulo.assets.registerFunction(allArgs, code, opts);
    const exports = func.call(null, Modulo, React, syncOnlyRequire);
    if (!attrs) { // Just return export directly, don't try to do anything funny
        return exports;
    }

    // Otherwise, get the named thing separately
    const { name } = attrs;
    let reactComponentClass = exports[name]; // Possibly have import / export implemented here?
    if (!reactComponentClass && exports.default) {
        reactComponentClass = exports.default;
    }
    return reactComponentClass;
}

Modulo.utils.syncOnlyRequire = function syncOnlyRequire (path) {
    if (path === 'React') {
        // Note: Might want to have a few more hardcoded ones for common stuff
        return React;
    }

    // Try enqueuing, to see if already cached, and error otherwise
    let jsCode = null;
    Modulo.fetchQ.enqueue(path, responseData => { jsCode = reponseData; });
    Modulo.assert(jsCode, `Invalid require, path not loaded: ${ path }`);
    return Modulo.utils.runInReactlikeEnviron(jsCode);
};

Modulo.ReactComponentElement = class ReactComponentElement extends HTMLElement {
    constructor() {
        super();
        this.isMounted = false;
        this.isModulo = true;
        this.originalHTML = null;
        this.originalChildren = [];
    }

    lifecycle() {
        // TODO, be able to interface with react lifecycle?
    }
    setupCParts() { } // stub

    rerender(original = null) {
        if (!this.isMounted) {
            console.log('Rerendering!');
            this.mountReactComponent();
        }
    }

    connectedCallback() {
        if (!this.isMounted) {
            setTimeout(() => this.parsedCallback(), 0);
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
        /*
        if (this.hasAttribute('modulo-original-html')) {
            const { reconciler } = this.cparts.component;
            reconciler.patch = reconciler.applyPatch; // Apply patches immediately
            reconciler.patchAndDescendants(this, 'Mount');
            reconciler.patch = reconciler.pushPatch;
        }
        */
        // XXX --------------------------
        this.isMounted = true;
    }
}

