Modulo.cparts.jsxtemplate = class JSXTemplate extends Modulo.ComponentPart {
    static factoryCallback(partOptions, factory, renderObj) {
        const DEFAULT_CONF = { presets: [ "env", "react" ] };
        let { content, attrs } = partOptions;
        if (!attrs.multiline) {
            content = `return (\n${content}\n);`;
        }
        const opts = { babel: (attrs.babel || DEFAULT_CONF) };


        /*
        Modulo.js:
        const lcName = instance.name.toLowerCase();
        instance.loader.localNameMap[lcName] = instance.fullName;
        Modulo.factoryInstances[instance.fullName] = instance;
        */
        const nameMap = Object.fromEntries(
            Object.entries(factory.loader.localNameMap).map(
                ([key, fullName]) => [
                    Modulo.factoryInstances[fullName].name,
                    fullName,
                ]));
        //console.log('this is map', nameMap);
        //this.localNameMap = this.element.factory().loader.localNameMap;
        const args = [
            "React",
            ...Object.keys(nameMap),
            ...Object.keys(Modulo.cparts),
        ];
        const func = Modulo.assets.registerFunction(args, content, opts);
        Object.assign(partOptions, { args, func, nameMap });
    }

    constructor(element, options) {
        super(element, options);
        this.renderFunc = options.func;
        this.renderArgs = options.args;
        this.renderMap = options.nameMap;
    }

    prepareCallback(renderObj) {
        const stored = {};
        // Setup a "React-like" interface
        renderObj.React = {
            createElement: (name, attrs, ...children) => {
                const attrStr = this.serializeAttrs(attrs, stored);
                // Flatten arrays
                const sumArr = arr => arr.reduce((a, b) => (
                            (Array.isArray(a) ? sumArr(a) : a) +
                            (Array.isArray(b) ? sumArr(b) : b)
                        ), '');
                return `<${name}${attrStr}>${sumArr(children)}</${name}>`;
            },
        };
        return { stored }
    }

    serializeAttrs(attrs, stored) {
        if (!attrs) {
            return '';
        }
        let result = '';
        const { escapeText } = Modulo.templating.MTL.prototype;
        for (let [ key, value ] of Object.entries(attrs)) {
            if (key === 'style' && typeof value === 'object') {
                value = Object.entries(value)
                    .map(([key, value]) =>
                        `${key}: ${value}${typeof value === 'number' ? 'px' : ''};`)
                    .join(';\n');
            }

            if (typeof value !== 'string') {
                let storeKey = key;
                let count = 0;
                while (storeKey in stored) {
                    storeKey = key + String(++count);
                }
                stored[storeKey] = value;
                key += ":";
                value = 'jsxtemplate.stored.' + storeKey;
            }

            if (/on[A-Z]/.test(key)) {
                key = '@' + key.toLowerCase().substr(2);
            }
            result += ` ${key}="${escapeText(value)}"`;
        }
        return result;
    }

    renderCallback(renderObj) {
        const values = [];
        for (const arg of this.renderArgs) {
            if (arg in this.renderMap) { // local -> true name map
                values.push(this.renderMap[arg]);
            } else { // Normal renderObj value
                values.push(renderObj[arg]);
            }
        }
        renderObj.component.innerHTML = this.renderFunc.apply(null, values);
    }
}

