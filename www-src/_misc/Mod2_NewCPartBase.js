class ModuloComponentPart {
    constructor(firstArg, options) {
        // Only adaptor:
        if (firstArg.partConf && !options) {
            // NEW: Is def
            const def = firstArg;
            const { element } = def.config.component;
            this.element = element;
            this.content = firstArg.partConf.Content;
            this.attrs = firstArg.partConf;
            this.partConf = firstArg.partConf;
            //console.log("NEW DEF!", def.config);

            // HACK:
            if (def.instance) {
                this.instance = def.instance;
            }
        } else {
            /// LEGACY
            this.element = firstArg;
            this.content = options.content;
            this.attrs = options.attrs;
        }
    }

    // Rest is legacy, will be RM'd:
    static getAttrDefaults(node, loader) {
        return {};
    }

    static loadCallback(node, loader) {
        const defaults = this.getAttrDefaults(node, loader);
        const attrs = Modulo.utils.mergeAttrs(node, defaults);
        // TODO is this still useful? --v
        const content = node.tagName.startsWith('TE') ? node.innerHTML
                                                      : node.textContent;
        return { attrs, content, dependencies: attrs.src || null };
    }

    static loadedCallback(data, content) {
        data.content = (data.content || '') + (content || '');
    }

    static factoryCallback() {}

    getDirectives() {
        return [];
    }

}


