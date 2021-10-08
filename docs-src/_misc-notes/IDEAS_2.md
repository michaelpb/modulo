    Modulo.cparts.attributes = class Attributes extends Modulo.ComponentPart {
        initializedCallback() {
            for (let [name, value] of Object.entries(this.options)) {
                if (name.includes('.')) {
                    name = '[' + nae
                }
                this.element.setAttribute(name, value);
            }
        }
    }

    Props.copyMount({el}) {
        // useful? untested code? not sure!
        for (const attr of this.element.getAttributeNames()) {
            el.setAttribute(attr, this.element.getAttribute(attr));
        }
        /*
        const props = {};
        for (let propName of Object.keys(this.options)) {
            propName = propName.replace(/:$/, ''); // normalize
            let attrName = this.element.resolveAttributeName(propName);
            if (!attrName) {
                console.error('Prop', propName, 'is required for', this.element.tagName);
                continue;
            }
            let value = this.element.getAttribute(attrName);
            if (attrName.endsWith(':')) {
                attrName = attrName.slice(0, -1); // trim ':'
                value = this.element.moduloRenderContext.resolveValue(value);
            }
            props[propName] = value;
        }
        */
    }


    swapSpare(type, name) {
        const arr = this.cpartSpares[type];
        const spare = arr.find(({attrs}) => attrs.name === name);
        Modulo.assert(spare, `No ${type} with name="${name}"`);
        this.cparts[type] = spare;
        /* (SPARES ONLY)
        const arr = this.cpartSpares[type];
        const index = arr.findIndex(({attrs}) => attrs.name === name);
        Modulo.assert(index >= 0, `No ${type} with name="${name}"`);
        const spare = arr[index];
        arr[index] = this.cparts[type];
        this.cparts[type] = spare;
        */
    }

