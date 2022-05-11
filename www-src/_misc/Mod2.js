/*


<Component> // No name
    <State> // Creates default state for all subsequent Components
    </State>
</Component>

<Component name=""> // With name, becomes Factory type
</Component>











---------------------------------------------


Development approach of this file:


Goal: Rewrite the entire loading / configuring core in a better and hopefully
shorter / simpler way

Steps:

1. Work on loading the component library into this config format (below)
    - in progress
2. Validate & test this 
3. Register components based on this
4. Fork parts of Modulo.js for legacy modulo node if necessary

ComponentFactory should mostly be obsolete as well, so it will gradually get
duped, then deduped in the Modul2 system

*/
/*
  Everything without a name (or Name e.g. -name):
      - Singular
      - .Content gets concatenated, attrs merged
      - goes into this.config.lowercasecpartname
  Everything with a name (or Name e.g. -name):
      - Plural
      - Loads individually
      - goes into this.config.UpperCaseCPartName.MyNameGoesHere
      - Named CParts can hold other CParts (e.g. Component, Library)
      - Then, all CParts are instantiated (CParts), OR registered for instantation (Components)

*/

/*
      - Library idea: "name='modlib'" is a human-readable name that gets
        changed into a hash after (as opposed to namespace, which defaults to
        null and thus gets a hash as a default)
*/


// Another idea: Start writing the core of Modulo based on an internal API that
// makes sense as a set of tools for building Modulo-like APIs
class CPartConf {
    constructor(partialPartConf, config) {
        this.config = Modulo.utils.deepClone(config);
        if (partialPartConf.tagName) {
            partialPartConf = this.loadPartialConfigFromNode(partialPartConf);
        }
        const { Type, Name } = partialPartConf;
        console.log ( { Type, Name } ) ;
        this.partConf = this.config[Type] = Object.assign(
            {},
            this.config[Type],
            Type in this.config.modulo.factories ? this.config.modulo.factories[Type][Name] : {},
            partialPartConf,
        );
        this.children = []; // children CParts
    }

    loadDependencies(callback) {
        // TODO Clean up
        const src = this.partConf.Src || this.partConf.src;
        if (src) {
            //Modulo.fetchQ.enqueue(this.partConf.Src, callback, basePath);
            Modulo.fetchQ.enqueue(src, (text, label, src) => {
                this.partConf.Content = text;
                callback();
            });
        } else {
            callback();
        }
    }

    loadPartialConfigFromNode(node) {
        const partType = String(Modulo.utils.getNodeCPartName(node, this.config));
        const config = Modulo.utils.mergeAttrs(node, this.config[partType]);
        const content = node.tagName === 'SCRIPT' ? node.textContent : node.innerHTML;
        config.Content = (config.Content || '') + content; // concatenate
        config.Type = partType; // Ensure Type is set as well
        return config;
    }

    makeFactory() {
        this.fullName = `${this.loader.namespace}-${name}`;
        this.isModule = this.loader.namespace === name; // if name = namespace
        Modulo.ComponentFactory.registerInstance(this);

        this.componentClass = this.createClass();
        this.childrenLoadObj = childrenLoadObj;
        this.baseRenderObj = this.runFactoryLifecycle(this.childrenLoadObj);
    }
}

class Modul3 {
    constructor(config, baseConfig = null) {
        this.config = Modulo.utils.deepClone(baseConfig || Modul2.defaults);
        this.children = [];
        if (typeof config === 'string') { // String of HTML to load
            this.loadChildrenNodes(this.loadString(config), this.config, this);
        } else if (config && config.nodeType && config.innerHTML) { // DOM node
            this.loadChildrenNodes(this.loadString(config.innerHTML), this.config, this);
        } else {
            // TODO: Add "deepCloneMerge", and do that with config if obj
            Modulo.assert(!config, 'Invalid config, must be string or node')
        }
    }

    loadChildrenNodes(node, config, parentConf) {
        const nodes = node.content ? node.content.childNodes : node.children;
        for (const node of nodes) {
            const name = Modulo.utils.getNodeCPartName(node, config);
            if (!name) {
                continue;
            }
            const conf = new CPartConf(node, config);
            parentConf.children.push(conf);
            console.log('LOADING DEPS FOR:', conf.partConf);
            conf.loadDependencies(() => {
                const { isContainer, isFactory, isSelfContaining } = config.modulo.cparts[name];
                if (isContainer) {
                    const subNodes = this.loadString(conf.partConf.Content || '');
                    this.loadChildrenNodes(subNodes, conf.config, conf); // use silo'ed config to load
                }

                Modulo.fetchQ.wait(() => {
                    if (!isFactory) { return; }
                    // TODO: hacky adaptor
                    const mockLoader = { localNameMap: { }, namespace: 'x' };
                    const childrenLoadObj = conf.children.map(({ partConf }) =>
                        [ partConf.Type, partConfToData(partConf) ]);
                    if (isSelfContaining) {
                        childrenLoadObj.unshift([ 'component', partConfToData(conf.partConf) ]); // Add "self" as CPart
                    }
                    const name = conf.partConf.Name || conf.partConf.name; // TODO?
                    conf.partConf.Factory = new Modulo.ComponentFactory(mockLoader, name, childrenLoadObj);
                    conf.partConf.Factory.register();
                    //console.log(childrenLoadObj )
                });
            });
        }
    }

    loadString(text) {
        this.reconciler = new Modulo.reconcilers.ModRec({
            directives: { 'modulo.dataPropMount': this },
            directiveShortcuts: [ [ /:$/, 'modulo.dataProp' ] ],
        });
        return this.reconciler.loadString(text, {});
    }

    dataPropMount({ el, value, attrName, rawName }) { // element, 
        const { get, set } = Modulo.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
            el.dataPropsAttributeNames = {};
        }
        const isVar = /^[a-z]/i.test(value) && !Modulo.INVALID_WORDS.has(value);
        //const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        const renderObj = this.config;
        const val = isVar ? get(renderObj, value) : JSON.parse(value);
        set(el.dataProps, attrName, val); // set according to path given
        el.dataPropsAttributeNames[rawName] = attrName;
    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }

    onReady(callback) {
        this.onReadyCallback = callback;
    }
}


class Modul2 {
    constructor(config, partConf = null) {
        this.config = config;
        this.partConf = partConf;
        this.modul2 = window.modul2; // TODO, should be window.modulo
        this.childConfigs = [];
        this.instances = [];
    }

    register(path, value) {
        const { get, set } = Modulo.utils;
        const existing = get(this.config, value);
        if (existing && Array.isArray(existing)) {
            existing.push(value);
        } else {
            set(this.config, path, value);
        }
    }

    configure(node) {
        if (typeof node === 'string') {
            this.partConf = Object.assign(this.partConf, { Content: node });
            this.loadElement = this.applyLoadDirectives();
            this.configureChildren(this.loadElement); // And configure self
        } else {
            if (node) {
                this.configureNode(node); // configure self
            }
            this.loadElement = this.applyLoadDirectives();
            if (node) {
                node.replaceWith(this.loadElement); // Replace with loaded version
            }
            this.configureChildren(this.loadElement); // And configure self
        }
    }

    configureNode(node) {
        const partType = String(this.getNodeCPartName(node));
        const partConf = this.loadNodeConfig(node, this.config[partType.toLowerCase()]);
        partConf.Type = partType;
        const name = partConf.Name || partConf.name; // TODO possibly remove lc name alias
        if (name) {
            const key = 'modulo.factories' + '.' + partType + '.' + name;
            Modulo.utils.set(this.config, key, partConf);
        } else {
            this.config[partType.toLowerCase()] = partConf;
        }

        if (!this.partConf) { // loading self, apply
            this.partConf = partConf;
        } else {
            this.childConfigs.push(partConf);
        }
    }

    configureChildren(elem) {
        const nodes = elem.content ? elem.content.childNodes : elem.children;
        for (const node of nodes) {
            const name = this.getNodeCPartName(node);
            this.configureNode(node);
        }
    }

    loadNodeConfig(node, defaults) {
        const config = Modulo.utils.mergeAttrs(node, defaults);
        const content = node.tagName === 'SCRIPT' ? node.textContent : node.innerHTML;
        config.Content = (config.Content || '') + content; // concatenate
        return config;
    }

    getDataPropContext(el) {
        // idea: Component overwrites?
        return this.config;
    }

    dataPropMount({ el, value, attrName, rawName }) { // element, 
        const { get, set } = Modulo.utils;
        // Resolve the given value and attach to dataProps
        if (!el.dataProps) {
            el.dataProps = {};
            el.dataPropsAttributeNames = {};
        }
        const isVar = /^[a-z]/i.test(value) && !Modulo.INVALID_WORDS.has(value);
        //const renderObj = isVar ? this.element.getCurrentRenderObj() : {};
        const renderObj = this.getDataPropContext(el);
        const val = isVar ? get(renderObj, value) : JSON.parse(value);
        set(el.dataProps, attrName, val); // set according to path given
        el.dataPropsAttributeNames[rawName] = attrName;
    }

    dataPropUnmount({ el, attrName, rawName }) {
        delete el.dataProps[attrName];
        delete el.dataPropsAttributeNames[rawName];
    }

    applyLoadDirectives() {
        this.loadReconciler = new Modulo.reconcilers.ModRec({
            directives: { 'modulo.dataPropMount': this },
            directiveShortcuts: [ [ /:$/, 'modulo.dataProp' ] ],
        });
        return this.loadReconciler.loadString(this.partConf.Content, {});
    }

    // TODO: Rename all these methods with a consistent naming, e.g. config -> load -> factory
    runLoadLifecycle() {
        const array = [];
        for (const partConf of this.childConfigs) {
            const cPartName = partConf.Type;
            const cpartClass = this.config.modulo.cparts[cPartName];
            console.log('thsi si cpart', partConf);
            Modulo.assert(cpartClass, 'Unable to load, no cpart:' + cPartName);

            const cb = cpartClass.loadConfigCallback || ((data) => {
                // TODO: loadConfigCallback default should be in base, for now an adaptor to old load style
                const dependencies = data.Src || data.src;
                const content = data.Content;
                const attrs = data;
                return { dependencies, content, attrs };
            });

            const data = cb(partConf);
            array.push([ cPartName, data ]);

            if (data.dependencies) {
                // Ensure any CPart dependencies are loaded (relative to src)
                const basePath = Modulo.utils.resolvePath(this.src, '..');
                const loadCb = cpartClass.loadedCallback.bind(cpartClass);
                const cb = (text, label, src) => loadCb(data, text, label, this, src);
                Modulo.fetchQ.enqueue(data.dependencies, cb, basePath);
            }

        }
        return array;
    }

    _hackGetMockLoader() {
        if (!this.mockLoader) {
            this.mockLoader = {
                localNameMap: { },
                namespace: 'x',
            }
        }
        return this.mockLoader;
    }
}

class Factor2 {
  static loadedCallback(data, content, label, modulo) {
        const libraryModulo = new Modul2(modulo.config, modulo.partConf); // todo: do deep copies here, so the isolation is enforced by Library
        console.log('loadedCallback', content);
        libraryModulo.configure(content); // maybe make this part of constr?

        // Loop through children, loading:
        const childrenLoadObj = libraryModulo.runLoadLifecycle();
        Modulo.fetchQ.wait(() => {
            for (const factoryObj of Object.values(libraryModulo.config.modulo.factories)) {
                for (const [ name, partConf ] of Object.entries(factoryObj)) {
                    const cPartName = partConf.Type;
                    const cpartClass = libraryModulo.partConf.cparts[cPartName];
                    cpartClass.factoryLoadedCallback(libraryModulo, name, partConf);
                }
            }
        });
    }
}

class Librar2 extends Factor2 {
    static factoryLoadedCallback(libraryModulo, name, partConf) {
    }
}

const partConfToData = (pc) => {
    // TODO: loadConfigCallback default should be in base, for now an adaptor to old load style
    const dependencies = pc.Src || pc.src;
    const content = pc.Content;
    const attrs = pc;
    return { dependencies, content, attrs };
};


/*
Modulo.cparts.component.loadedCallback = Factor2.prototype.loadedCallback;
Modulo.cparts.component.factoryLoadedCallback = (modulo, name, partConf) => {
    const libraryModulo = new Modul2(modulo.config, modulo.partConf);
    libraryModulo.configure(partConf.Content);
    const childrenLoadObj = libraryModulo.runLoadLifecycle(); // descend
    childrenLoadObj.unshift([ 'component', partConfToData(partConf) ]); // Add "self" as CPart
    const mockLoader = modulo._hackGetMockLoader();
    // Let children load
    Modulo.fetchQ.wait(() => {
        console.log('facLoadedCallback, after wait', childrenLoadObj);
        const factory = new Modulo.ComponentFactory(mockLoader, name, childrenLoadObj);
        factory.register();
    });
}
*/


Modulo.utils.deepClone = obj => {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    var clone = new obj.constructor();
    for(var key in obj) {
        if (obj.hasOwnProperty(key)) {
            clone[key] = Modulo.utils.deepClone(obj[key]);
        }
    }
    return clone;
};


Modul2.defaults = {
    template: {},
    component: {},
    staticdata: {},
    state: {},
    style: {},
    modulo: {
        cparts: {
            modulo: Modul2,
            library: Librar2,
            template: Modulo.cparts.template,
            script: Modulo.cparts.script,
            component: Modulo.cparts.component,
            state: Modulo.cparts.state,
            staticdata: Modulo.cparts.staticdata,
            style: Modulo.cparts.style,
        },
        factories: {
            component: {},
            library: {},
            modulo: {},
        },
    },
};

Modul2.defaults.modulo.cparts.library.isContainer = true;
Modul2.defaults.modulo.cparts.component.isContainer = true;
Modul2.defaults.modulo.cparts.modulo.isContainer = true;
Modul2.defaults.modulo.cparts.component.isFactory = true;
Modul2.defaults.modulo.cparts.component.isSelfContaining = true;

//window.modul2 = new Modul2(Modul2.defaults);
window.modul2 = new Modul3();



Modulo.defineAll = function testMod2() {
    const query = 'template[modulo-embed],modulo';
    for (const elem of Modulo.globals.document.querySelectorAll(query)) {
        //window.modul2.configure(elem);
        //window.modul2.runLoadLifecycle();
        window.modul2 = new Modul3(elem);
        console.log(window.modul2.config, window.modul2.partConf);
    }
}

Modulo.utils.getNodeCPartName = (node, config) => {
    const { tagName, nodeType, textContent } = node;

    // node.nodeType equals 1 if the node is a DOM element (as opposed to
    // text, or comment). Ignore comments, tolerate empty text nodes, but
    // warn on others (since those are typically syntax mistakes).
    if (nodeType !== 1) {
        // Text nodes, comment nodes, etc
        if (nodeType === 3 && textContent && textContent.trim()) {
            console.error('Modulo.Loader: Unexpected text:', textContent);
        }
        return null;
    }

    // Determine the name: The tag name, or the type attribute in the case
    // of the alt script-tag syntax (eg `<script type="modulo/Template">`)
    let cPartName = tagName.toLowerCase(); // rm this, once its cparts.Template // TODO
    const splitType = (node.getAttribute('type') || '').split('/');
    if (splitType[0] && splitType[0].toLowerCase() === 'modulo') {
        cPartName = splitType[1];
        cPartName = cPartName.toLowerCase(); // rm this, once its cparts.Template // TODO
    }
    if (!(cPartName in config.modulo.cparts)) {
        console.error('Modulo.Loader: Unknown CPart def:', cPartName);
        return null;
    }
    return cPartName;
}

/*
            if (cpartClass.childrenLoadedCallback) { // a factory type
                const minimodulo = new Modul2(this.config, partConf);
                minimodulo.configure(); // maybe make this part of constr?
                data.children = minimodulo.runLoadLifecycle(); // descend
                const cb = cpartClass.childrenLoadedCallback.bind(cpartClass);

                // Wait for enqueued loads (side-effect of loadFromDOMElement)
                const mockLoader = this._hackGetMockLoader();
                Modulo.fetchQ.wait(() => cb(data.children, mockLoader, data));
            }

*/

        /*
        const cb = Librar2.childrenLoadedCallback;
        Modulo.fetchQ.wait(() => cb(data.children, mockLoader, data));
        const cb = cpartClass.childrenLoadedCallback.bind(cpartClass);
        // Wait for enqueued loads (side-effect of loadFromDOMElement)
        const mockLoader = modulo._hackGetMockLoader();
        Modulo.fetchQ.wait(() => cb(data.children, mockLoader, data));
        */
