/*
  What's done:
    - Directives + syntactic sugar
    - Moving core functionality into Component CPart
  Next steps:
    - Figure out "Directive Resolution Context"
        - Best case: Hook into reconciliation / morphdom, do clean-up and
          tear-down
        - Possibly will need render stack, or will be entirely with morphdom
        - Write tests around this
        - Stop skipping tests that test parents passing down props
    - Copy ModuloTemplate into this file, make default template language
    - Start use as soon as above is finished to uncover typical usage + bugs
  Refactoring needed:
    - Finish / test / refactor extends
    - DONE: Rename ModuloComponent to "ModuloElement" consistently
    - Possibly:
      - Refactor Component CPart, maybe rename to "lifecycle" or "base"
      - Remove the [this] -- remove Element / Component "lifecycle" step
      - Think about how extension / getSuper('state') etc might work
*/
'use strict';
if (typeof HTMLElement === 'undefined') {
    var HTMLElement = class {}; // Node.js compatibilty
}
var globals = {HTMLElement};
var Modulo = {globals};

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
    register(value) {
        // deadcode, todo finish after multimap merge for cleaner extension syntax
        const {name} = value; // works for Functions, need to work for Classes
        assert(name, `Invalid register type "{value}"`);
        this.set(key, value);
    }
    // Idea: Can implement TaggedObjectMap with MultiMap:
    //   - save(tagName) - Savepoints are looping through values,
    //                     and saving an obj of lengths
    //   - modifyTag(tagName, key, value) - get tagName array, then insert value
    //                                      at savepoint[key].length
}

function getValue(obj, path) {
    return path.split('.').reduce((obj, name) => obj[name], obj);
}

function parseWord(text) {
    return (text + '').replace(/[^a-zA-Z0-9$_\.]/g, '') || '';
}

Modulo.TaggedObjectMap = class TaggedObjectMap extends Map {
    constructor(otherMap) {
        super(otherMap)
        this.tags = Object.assign({}, (otherMap || {}).tags || {});
        this.tagNames = Array.from((otherMap || {}).tagNames || {});
    }

    get(key) {
        if (!this.has(key)) {
            super.set(key, {});
        }
        return super.get(key);
    }

    resolve(key) {
        return getValue(this.toObject(), key);
    }

    set(key, value) {
        // maybe todo: possibly bind objects here (?)
        super.set(key, Object.assign(value, this.get(key), value));
    }

    save(tagName) {
        if (!this.tags) {
            this.tags = {};
            this.tagNames = [];
        }
        this.tags[tagName] = this.toObject();
        this.tagNames.push(tagName); // deadcode
    }

    getTagsSince(tagName) {// deadcode
        const index = this.tagNames.findIndex(tagName);
        if (index === -1) {
            throw Error(`Unknown tagName "${tagName}" for TaggedMap`)
        }
        return this.tagNames.slice(index);
    }

    modifyTag(tagName, key, value) {
        // Note: This changes how it was in history at the point of tagging,
        // and possibly the current value too
        const historicalValue = (this.tags || {})[tagName] || {};
        const existing = this.get(key);
        this.set(key, Object.assign(historicalValue, value, existing));
    }

    toObject() {
        // Possibly: Need binding here
        return Object.fromEntries(this);
    }

    // OKAY, this data type still needs more work. Ultimately, we'll need:
    //  - For "hot reloading", to set at 'initalized', then replay lifecycle since? ugh
}


function getFirstModuloAncestor(elem) {
    // Walk up tree to first DOM node that is a modulo component
    const node = elem.parentNode;
    return !node ? null : (
        node.isModuloElement ? node : getFirstModuloAncestor(node)
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
Modulo.parseAttrs = parseAttrs;

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
    const key = `${lifecycleName}_${cPart.name}_${timing}`;
    const middlewareArr = Modulo.middleware.get(key); // new
    for (const middleware of middlewareArr) {
        middleware.apply(cPart, args);
    }
}

function runLifecycle(lifecycleName, parts, renderObj, ...extraArgs) {
    let partsArray = [];
    if (isPlainObject(parts)) {
        for (const [partName, partOptionsArr] of Object.entries(parts)) {
            const cPart = Modulo.cparts.get(partName);
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

Modulo.collectDirectives = function collectDirectives(component, el, arr = null) {
    if (!arr) {
        arr = [];
    }
    // TODO: for "pre-load" directives, possibly just pass in "Loader" as
    // "component" so we can have load-time directives
    for (const rawName of el.getAttributeNames()) {
        // todo: optimize skipping most elements or attributes
        let name = rawName;
        for (const [regexp, dSuffix] of Modulo.directiveShortcuts) {
            if (rawName.match(regexp)) {
                name = `[component.${dSuffix}]` + name.replace(regexp, '');
            }
        }
        if (!name.startsWith('[')) {
            continue; // There are no directives, skip
        }
        const value = el.getAttribute(rawName);
        const attrName = parseWord((name.match(/\][^\]]+$/) || [''])[0]);
        for (const dName of name.split(']').map(parseWord)) {
            if (dName === attrName) {
                continue; // Skip bare name
            }
            const setUp = component.resolveValue(dName + 'Mount');
            const tearDown = component.resolveValue(dName + 'Unmount');
            assert(setUp || tearDown, `Unknown directive: "${dName}"`);
            arr.push({el, value, attrName, rawName, setUp, tearDown, dName})
        }
    }
    for (const child of el.children) {
        // tail recursion into children
        Modulo.collectDirectives(component, child, arr);
    }
    return arr;
}

Modulo.middleware = new Modulo.MultiMap();
Modulo.cparts = new Map();
Modulo.directiveShortcuts = new Map();
Modulo.directiveShortcuts.set(/^@/, 'event');
Modulo.directiveShortcuts.set(/:$/, 'resolve');

Modulo.Loader = class Loader extends HTMLElement {
    static defineCoreCustomElements() {
        globals.customElements.define('mod-load', Modulo.Loader);
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
        // TODO - Maybe use DOMParser here instead
        const frag = new globals.DocumentFragment();
        const div = globals.document.createElement('div');
        div.innerHTML = text;
        frag.append(div);
        const results = [];
        for (const tag of div.querySelectorAll('[mod-component],component')) {
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
        if (!(Modulo.cparts.has(cPartName))) {
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
        const extend = attrs['extends'];
        const loadingObj = new Modulo.MultiMap();
        if (extend) {
            for (const [name, data] of this.componentFactoryData) {
                // TODO: Change this.componentFactoryData to be a map
                // Also, refactor this mess in general
                if (name === extend) {
                    for (const key of Object.keys(data)) {
                        loadingObj.get(key).push(...data[key]);
                    }
                }
            }
        }
        loadingObj.set('component', {name}); // Everything gets implicit Component CPart
        runMiddleware('load', {name: 'component'}, 'before', [elem, this, loadingObj]);

        //const cPartsMap = new Modulo.MultiMap();
        for (const {cPartName, node} of this.getCPartNamesFromDOM(elem)) {
            //cPartsMap.set(cPartName, node);
            const cPart = Modulo.cparts.get(cPartName);
            runMiddleware('load', cPart, 'before', [node, this, loadingObj]);
            const results = cPart.loadCallback(node, this, loadingObj);
            runMiddleware('load', cPart, 'after', [node, this, loadingObj, results]);
            loadingObj.set(cPart.name, results);
        }
        // TODO: finish this, possibly, or give up on trying to make load
        // lifecycle behave the same as the others --v
        //runLifecycle('load', cPartsMap.toObject(), loadingObj, this);
        const partsInfo = loadingObj.toObject();
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

const nanomorph = (function () {
    var events = [
      'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
      'onmousemove', 'onmouseout', 'onmouseenter', 'onmouseleave',
      'ontouchcancel', 'ontouchend', 'ontouchmove', 'ontouchstart',
      'ondragstart', 'ondrag', 'ondragenter', 'ondragleave', 'ondragover',
      'ondrop', 'ondragend', 'onkeydown', 'onkeypress', 'onkeyup', 'onunload',
      'onabort', 'onerror', 'onresize', 'onscroll', 'onselect', 'onchange',
      'onsubmit', 'onreset', 'onfocus', 'onblur', 'oninput', 'oncontextmenu',
      'onfocusin', 'onfocusout'
    ]
    var eventsLength = events.length

    var ELEMENT_NODE = 1
    var TEXT_NODE = 3
    var COMMENT_NODE = 8
    // diff elements and apply the resulting patch to the old node
    // (obj, obj) -> null
    function morph (newNode, oldNode) {
      var nodeType = newNode.nodeType
      var nodeName = newNode.nodeName

      if (nodeType === ELEMENT_NODE && oldNode.nodeType === ELEMENT_NODE) {
        copyAttrs(newNode, oldNode)
      }

      if (nodeType === TEXT_NODE || nodeType === COMMENT_NODE) {
        if (oldNode.nodeValue !== newNode.nodeValue) {
          oldNode.nodeValue = newNode.nodeValue
        }
      }

      // Some DOM nodes are weird
      // https://github.com/patrick-steele-idem/morphdom/blob/master/src/specialElHandlers.js
      if (nodeName === 'INPUT') updateInput(newNode, oldNode)
      else if (nodeName === 'OPTION') updateOption(newNode, oldNode)
      else if (nodeName === 'TEXTAREA') updateTextarea(newNode, oldNode)

      copyEvents(newNode, oldNode)

      if (oldNode.childNodes && newNode.childNodes && newNode.append) {
          for (let i = 0; i < oldNode.childNodes.length; i++) {
              let oldNodeChild = oldNode.childNodes[i];
              let newNodeChild = newNode.childNodes[i];
              if (newNodeChild) {
                  console.log('morphing child');
                  morph(newNodeChild, oldNodeChild);
              } else {
                  console.log('appending child');
                  console.log('this is newNode', newNode);
                  newNode.append(oldNodeChild);
              }
          }
      }
    }

    function copyAttrs (newNode, oldNode) {
      var oldAttrs = oldNode.attributes
      var newAttrs = newNode.attributes
      var attrNamespaceURI = null
      var attrValue = null
      var fromValue = null
      var attrName = null
      var attr = null

      for (var i = newAttrs.length - 1; i >= 0; --i) {
        attr = newAttrs[i]
        attrName = attr.name
        attrNamespaceURI = attr.namespaceURI
        attrValue = attr.value
        if (attrNamespaceURI) {
          attrName = attr.localName || attrName
          fromValue = oldNode.getAttributeNS(attrNamespaceURI, attrName)
          if (fromValue !== attrValue) {
            oldNode.setAttributeNS(attrNamespaceURI, attrName, attrValue)
          }
        } else {
          if (!oldNode.hasAttribute(attrName)) {
            oldNode.setAttribute(attrName, attrValue)
          } else {
            fromValue = oldNode.getAttribute(attrName)
            if (fromValue !== attrValue) {
              // apparently values are always cast to strings, ah well
              if (attrValue === 'null' || attrValue === 'undefined') {
                oldNode.removeAttribute(attrName)
              } else {
                oldNode.setAttribute(attrName, attrValue)
              }
            }
          }
        }
      }

      // Remove any extra attributes found on the original DOM element that
      // weren't found on the target element.
      for (var j = oldAttrs.length - 1; j >= 0; --j) {
        attr = oldAttrs[j]
        if (attr.specified !== false) {
          attrName = attr.name
          attrNamespaceURI = attr.namespaceURI

          if (attrNamespaceURI) {
            attrName = attr.localName || attrName
            if (!newNode.hasAttributeNS(attrNamespaceURI, attrName)) {
              oldNode.removeAttributeNS(attrNamespaceURI, attrName)
            }
          } else {
            if (!newNode.hasAttributeNS(null, attrName)) {
              oldNode.removeAttribute(attrName)
            }
          }
        }
      }
    }

    function copyEvents (newNode, oldNode) {
      for (var i = 0; i < eventsLength; i++) {
        var ev = events[i]
        if (newNode[ev]) {           // if new element has a whitelisted attribute
          oldNode[ev] = newNode[ev]  // update existing element
        } else if (oldNode[ev]) {    // if existing element has it and new one doesnt
          oldNode[ev] = undefined    // remove it from existing element
        }
      }
    }

    function updateOption (newNode, oldNode) {
      updateAttribute(newNode, oldNode, 'selected')
    }

    // The "value" attribute is special for the <input> element since it sets the
    // initial value. Changing the "value" attribute without changing the "value"
    // property will have no effect since it is only used to the set the initial
    // value. Similar for the "checked" attribute, and "disabled".
    function updateInput (newNode, oldNode) {
      var newValue = newNode.value
      var oldValue = oldNode.value

      updateAttribute(newNode, oldNode, 'checked')
      updateAttribute(newNode, oldNode, 'disabled')

      // The "indeterminate" property can not be set using an HTML attribute.
      // See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/checkbox
      if (newNode.indeterminate !== oldNode.indeterminate) {
        oldNode.indeterminate = newNode.indeterminate
      }

      // Persist file value since file inputs can't be changed programatically
      if (oldNode.type === 'file') return

      if (newValue !== oldValue) {
        oldNode.setAttribute('value', newValue)
        oldNode.value = newValue
      }

      if (newValue === 'null') {
        oldNode.value = ''
        oldNode.removeAttribute('value')
      }

      if (!newNode.hasAttributeNS(null, 'value')) {
        oldNode.removeAttribute('value')
      } else if (oldNode.type === 'range') {
        // this is so elements like slider move their UI thingy
        oldNode.value = newValue
      }
    }

    function updateTextarea (newNode, oldNode) {
      var newValue = newNode.value
      if (newValue !== oldNode.value) {
        oldNode.value = newValue
      }

      if (oldNode.firstChild && oldNode.firstChild.nodeValue !== newValue) {
        // Needed for IE. Apparently IE sets the placeholder as the
        // node value and vise versa. This ignores an empty update.
        if (newValue === '' && oldNode.firstChild.nodeValue === oldNode.placeholder) {
          return
        }

        oldNode.firstChild.nodeValue = newValue
      }
    }

    function updateAttribute (newNode, oldNode, name) {
      if (newNode[name] !== oldNode[name]) {
        oldNode[name] = newNode[name]
        if (newNode[name]) {
          oldNode.setAttribute(name, '')
        } else {
          oldNode.removeAttribute(name)
        }
      }
    }
    return morph;
})();


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
                    // TODO: Possibly add directives here-ish
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
        nanomorph: () => (component, html) => {
            if (!component.isMounted) {
                component.innerHTML = html;
                return;
            }
            //const frag = new globals.DocumentFragment();
            //const div = globals.document.createElement('div');
            //div.innerHTML = html;
            //frag.append(div);
            const parser = new globals.DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newDomElem = doc.body;
            //console.log('this is frag', frag.firstChild.innerHTML);
            //component.innerHTML = frag.firstChild.innerHTML;
            nanomorph(component, newDomElem);
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
        this.baseRenderObj = new Modulo.TaggedObjectMap();
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
                const cPart = Modulo.cparts.get(partName);
                if (!cPart) {
                    console.log('this is unknown cpart', partName);
                }
                results.push({cPart, partOptions});
            }
        }
        return results;
    }

    createClass() {
        const {fullName} = this;
        const {reconciliationEngine = 'setdom'} = this.options;
        const reconcile = Modulo.adapters.reconciliation[reconciliationEngine]();
        return class CustomComponent extends Modulo.Element {
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

Modulo.Element = class ModuloElement extends HTMLElement {
    constructor() {
        super();
        this.componentParts = [];
        this.originalHTML = this.innerHTML;
        this.initialize();
    }

    initialize() {
        this.name = 'element'; // Used by lifecycle // TODO: Replace with lifecycleName
        this.fullName = this.factory.fullName;
        this.isMounted = false;
        this.isModuloElement = true; // used when finding parent
        this.initRenderObj = new Modulo.TaggedObjectMap(this.factory.baseRenderObj);
        // this.cparts = new Modulo.TaggedObjectMap();
    }

    constructParts(isReload=false) {
        const oldCParts = isReload ? this.componentParts : [];
        this.componentParts = [this]; // Include self, to hook into lifecycle
        for (const {cPart, partOptions} of this.factory.getCParts()) {
            const instance = new cPart(this, partOptions);
            this.componentParts.push(instance);
            // this.cparts.set(cPart.name, instance);

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

    applyDirectives(directives) {
        for (const args of directives) {
            const {setUp, tearDown, el, rawName, hasRun, value, dName} = args;
            if (!setUp) {
                console.error('TMP Skipping:', dName, rawName, value);
                continue;
            }
            // TODO fix this with truly predictable context
            args.resolutionContext = this.moduloRenderContext || getFirstModuloAncestor(this) || this; // INCORRECT
            if (hasRun) {
                if (!tearDown) {
                    console.error('TMP NO TEAR DOWN ERR:', rawName);
                }
                tearDown(args);
            }
            args.hasRun = true;
            setUp(args);
            /*
            if (setUp) {
                el.onload = setUp.bind(thisContext, [args]);
            }
            if (tearDown) {
                el.onunload = tearDown.bind(thisContext, [args]);
            }
            */
        }
    }

    rerender() {
        // Calls all the LifeCycle functions in order
        this.renderObj = new Modulo.TaggedObjectMap(this.getCurrentRenderObj());
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
        return (this.eventRenderObj || this.renderObj || this.initRenderObj);
    }
    resolveValue(value) {
        return this.getCurrentRenderObj().resolve(value);
    }

    resolveAttributeName(name) {
        if (this.hasAttribute(name)) {
            return name;
        } else if (this.hasAttribute(name + ':')) {
            return name + ':';
        }
        return null;
    }

    connectedCallback() {
        // TODO: Properly determine the render context component
        this.moduloRenderContext = getFirstModuloAncestor(this); // INCORRECT
        // Note: For testability, constructParts is invoked on first mount,
        // before initialize.  This is so the hacky "fake-upgrade" for custom
        // components works for the automated tests. Logically, it should
        // probably be invoked in the constructor.
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
Modulo.parts.Component = class Component extends Modulo.ComponentPart {
    static name = 'component';
    prepareCallback() {
        // TODO shouldn't have to do this ---v
        return {
            eventMount: this.eventMount.bind(this),
            eventUnmount: this.eventUnmount.bind(this),
            resolveMount: this.resolveMount.bind(this),
            resolveUnmount: this.resolveUnmount.bind(this),
        };
    }

    updateCallback(renderObj) {
        const {component} = this;
        const newContents = renderObj.get('template').renderedOutput || '';
        component.reconcile(component, newContents);
        const directives = Modulo.collectDirectives(component, component);
        component.applyDirectives(directives);
    }

    handleEvent(func, ev, payload) {
        this.component.lifecycle('event');
        func.call(this.component, ev, payload);
        this.component.lifecycle('eventCleanup');
    }

    eventMount(info) {
        const {el, value, attrName, rawName} = info;
        el.getAttr = el.getAttr || el.getAttribute;
        const listener = (ev) => {
            const func = el.getAttr(attrName, el.getAttr(rawName));
            assert(func, `Bad ${attrName}, ${value} is ${func}`);
            const payload = el.getAttr(`${attrName}.payload`, el.value);
            this.handleEvent(func, ev, payload);
        };
        info.listener = listener;
        el.addEventListener(attrName, listener);
    }

    eventUnmount({attrName, listener}) {
        el.removeEventListener(attrName, listener);
    }

    resolveMount({el, value, attrName, resolutionContext}) {
        const resolvedValue = resolutionContext.resolveValue(value);
        el.attrs = Object.assign(el.attrs || {}, {[attrName]: resolvedValue});
        el.getAttr = (n, def) => n in el.attrs ? el.attrs[n] : el.getAttribute(n) || def;
    }
    resolveUnmount({el, value}) {
        el.attrs = {};
    }
}
Modulo.cparts.set('component', Modulo.parts.Component);

Modulo.parts.Props = class Props extends Modulo.ComponentPart {
    static name = 'props';
    static factoryCallback({options}, {componentClass}, renderObj) {
        // untested / daedcode ---v
        componentClass.observedAttributes = Object.keys(options);
    }
    initializedCallback(renderObj) {
        return this.buildProps();
    }
    copyMount({el}) {
        // change to "this.element"
        for (const attr of this.component.getAttributeNames()) {
            el.setAttribute(attr, this.component.getAttribute(attr));
        }
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
Modulo.cparts.set('props', Modulo.parts.Props);

Modulo.parts.Style = class Style extends Modulo.ComponentPart {
    static name = 'style';
    static factoryCallback({content}, factory, renderObj) {
        const {fullName} = factory;
        const id = `${fullName}_style`;
        let elem = globals.document.getElementById(id);
        if (!elem) {
            elem = globals.document.createElement('style');
            elem.id = id;
            globals.document.head.append(elem)
        }
        elem.textContent = content;
    }
}
Modulo.cparts.set('style', Modulo.parts.Style);


Modulo.parts.Template = class Template extends Modulo.ComponentPart {
    static name = 'template';
    static factoryCallback(opts, factory, renderObj) {
        const {templatingEngine = 'Backtick'} = renderObj.get('template').options || {};
        const templateCompiler = Modulo.adapters.templating[templatingEngine]();
        const compiledTemplate = templateCompiler(opts.content, opts);
        return {compiledTemplate};
    }
    renderCallback(renderObj) {
        const compiledTemplate = renderObj.get('template').compiledTemplate;
        const context = renderObj.toObject();
        const result = compiledTemplate(context);
        return {renderedOutput: result};
    }
}
Modulo.cparts.set('template', Modulo.parts.Template);


Modulo.parts.Script = class Script extends Modulo.ComponentPart {
    static name = 'script';

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
        //const scriptContextDefaults = {...renderObj.toObject(), Modulo};
        const scriptContextDefaults = renderObj.toObject();
        const c = partOptions.content || '';
        const localVars = Object.keys(scriptContextDefaults);
        localVars.push('element'); // add in element as a local var
        localVars.push('parent'); // add in access to previous versions of renderObj // TODO: finish, currently dead code
        const wrappedJS = this.wrapJavaScriptContext(c, localVars);
        return (new Function('Modulo', wrappedJS)).call(null, Modulo);
        //return (new Function(wrappedJS)).call(null);
        return scopedEval(null, {}, wrappedJS);
        return scopedEval(null, scriptContextDefaults, wrappedJS);
    }

    eventCallback(renderObj) {
        // Make sure that the local variables are all properly set
        const script = renderObj.get('script');
        for (const part of this.component.componentParts) {
            script.setLocalVariable(part.name, part);
        }
        script.setLocalVariable('element', this.component);
        script.setLocalVariable('component', this.component);
    }
}
Modulo.cparts.set('script', Modulo.parts.Script);

Modulo.parts.State = class State extends Modulo.ComponentPart {
    static name = 'state';
    static debugGhost = true;
    get debugGhost() { return true; }
    initializedCallback(renderObj) {
        this.rawDefaults = renderObj.get('state').options || {};
        if (!this.data) {
            this.data = simplifyResolvedLiterals(this.rawDefaults);
        }
    }

    prepareCallback(renderObj) {
        this.initializedCallback(renderObj); // TODO remove this, should not have to
        return this.data;
    }

    reloadCallback(oldPart) {
        this.data = Object.assign({}, oldPart.data, this.data, oldPart.data);
    }

    eventCallback() {
        this._oldData = Object.assign({}, this.data);
        Object.assign(this, this.data);
    }

    eventCleanupCallback() {
        for (const name of Object.keys(this.data)) {
            if (!(name in this._oldData)) {
                // clean up extra
                delete this.data[name];
                // this.set(name, null);
            } else if (this[name] !== this.data[name]) {
                this.set(name, this[name]); // update
            }
        }
        // ToDo: Clean this up, maybe have data be what's returned for
        // prepareEventCallback, just like with prepareCallback?
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
Modulo.cparts.set('state', Modulo.parts.State);

Modulo.middleware.set(
    'load_template_after',
    function rewriteComponentNamespace(node, loader, loadingObj, info) {
        let content = info.content || '';
        content = content.replace(/(<\/?)my-/ig, '$1' + loader.namespace + '-')
        info.content = content;
    },
);

Modulo.middleware.set(
    'load_style_after',
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

Modulo.defineAll = () => Modulo.Loader.defineCoreCustomElements();

if (typeof module !== 'undefined') { // Node
    module.exports = Modulo;
}
if (typeof customElements !== 'undefined') { // Browser
    globals = window;
}
Modulo.globals = globals;
