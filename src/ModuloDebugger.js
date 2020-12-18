if (typeof Modulo === 'undefined' && typeof require !== 'undefined') {
    Modulo = require('./Modulo.js'); // Node environment
    HTMLElement = Modulo.globals.HTMLElement;
}
if (typeof Modulo === 'undefined' || !Modulo) {
    throw new Error('ModuloDebugger.js: Must load Modulo first');
}
if (typeof globals === 'undefined') {
    globals = Modulo.globals;
}

Modulo.DEBUG = true;
Modulo.moddebug = {pollingRate: 1000};

function assert(value, ...info) {
    if (!value) {
        console.error(...info);
        throw new Error(`Modulo Error: "${Array.from(info).join(' ')}"`)
    }
}

function deepEquals(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return null;
    }
}

function getFirstModuloAncestor(elem) {
    // Walk up tree to first DOM node that is a modulo component
    const node = elem.parentNode;
    return !node ? null : (
        node.isModuloComponent ? node : getFirstModuloAncestor(node)
    );
}

function getGhostElementName(cPart){
    return `ghost-${cPart.name}`;
}

function getPartsWithGhosts(component) {
    return component.componentParts.filter(p => p.debugGhost || p.constructor.debugGhost);
}

function createGhostElements(component) {
    for (const cPart of getPartsWithGhosts(component)) {
        const tagName = getGhostElementName(cPart);
        const elem = globals.document.createElement(tagName);
        cPart.ghostCreatedCallback(elem);
        component.prepend(elem);
    }
}


const setDiff = (a, b) => new Set(Array.from(a).map(item => !b.has(item)));

/*
            ${
                state.partTypes.map(({name}) =>
                    \`
                    <label><input onchange:="ghostToggle"
                                  onchange.payload="${name}"
                                  type="checkbox" />
                        ${name} ghost</label>
                    \`).join('')
            }
*/

const debugToolbarString = `
<template mod-component="DebugToolbar">
    <script type="modulo/template">
        <div>
            <span class="logo">%</span>
            <label><input onchange:="hotreloadToggle" type="checkbox" />
                Hot-reloading</label>
            <h2>Ghost debug elements</h2>
        </div>
    </script>
    <style>
        DebugToolbar {
            position: fixed;
            top: 20px;
            right: 0px;
            background: tomato;
            height: 50px;
            width: 50px;
        }
        .logo {
            color: cerulean;
        }
    </style>
    <mod-state
        state-saveto="localstorage"
        visible:=true
        ghost:=true
        hotreload:=true
    ></mod-state>
    <script>
        function initialized() {
            window._modDebugToolbarInstance = this;
        }
        function ghostToggle() {
        }
    </script>
</template>
`;

Modulo.moddebug.LoaderReloader = class LoaderReloader {
    constructor() {
        this.loadersByPath = new Map();
        this.componentsByName = new Modulo.MultiMap();
        this.factoriesByPath = new Modulo.MultiMap(); // dead code
        this.resourceTextByPath = new Map();
        setTimeout(this.startPolling.bind(this), Modulo.moddebug.pollingRate);
    }

    register(loader, factory) {
        if (!loader.src) { // Loader being used programmatically
            return;
        }
        this.loadersByPath.set(loader.src, loader);
        this.factoriesByPath.set(loader.src, factory); // dead code
    }

    registerComponent(component) {
        this.componentsByName.set(component.factory.fullName, component);
    }

    onFileChanged(filePath) {
        // dead code/ 
        // TODO: This is only useful for the filesystem based one
        const loader = this.matchLongestPathSuffix(filePath);
        if (!loader) {
            return;
        }
        const factories = this.factoriesByPath.get(loader.src);
        for (const factory of factories) {
        }
    }

    matchLongestPathSuffix(originalPath) {
        // dead code/ 
        let suffix = originalPath;
        while (suffix) {
            for (const [path, loader] of this.loadersByPath) {
                if (path.endsWith(suffix)) {
                    return loader;
                }
            }
            suffix = suffix.slice(suffix.indexOf('/'), suffix.length);
        }
        return null;
    }

    checkLongPolling() {
        // dead code
        const url = '/_moduloServerInfo';
        globals.fetch(url, {cache: 'no-store'})
            .then(response => response.json())
            .then(data => {
                if (data && data.url) {
                    this.longPollingURL = data.url;
                }
            });
        setTimeout(() => {
            if (this.longPollingURL) {
                return; // already discovered
            }
            globals.fetch(url, {cache: 'no-store'})
                .then(response => response.json())
                .then(data => {
                    if (data && data.url) {
                        this.longPollingURL = data.url;
                    }
                });
        }, 1000);
    }

    startPolling(loader, factory) {
        const lastText = '';
        this.pollInProgress = false;
        this.pollInterval = setInterval(() => {
            if (this.pollInProgress) {
                return; // Throttle
            }
            this.pollInProgress = true;
            this.doPoll();
        }, Modulo.moddebug.pollingRate);
    }

    doPoll() {
        this.doReload(this.loadersByPath);
    }

    doReload(loadersByPath) {
        const totalExpectedResponses = loadersByPath.size;
        let responses = 0;
        for (const [src, loader] of loadersByPath) {
            globals.fetch(src, {cache: 'no-store'})
                .then(response => response.text())
                .then(text => {
                    this.onResponseReceived(loader, text);
                    responses++;
                    if (responses >= totalExpectedResponses) {
                        this.pollInProgress = false;
                    }
                });
        }
    }

    onResponseReceived(loader, text) {
        if (this.resourceTextByPath.has(loader.src)) {
            if (this.resourceTextByPath.get(loader.src) === text) {
                return; // if the text hasn't changed, there is no change
            }
        }
        this.resourceTextByPath.set(loader.src, text);

        // console.log('hey this is text', text);
        const oldFacData = loader.componentFactoryData;
        const oldFacDataS = JSON.stringify(loader.componentFactoryData);
        const newLoader = new Modulo.Loader(loader.namespace, loader.options);
        newLoader.loadString(text, false);
        const newFacData = newLoader.componentFactoryData;
        const newFacDataS = JSON.stringify(newFacData);
        if (newFacDataS === oldFacDataS) {
            return;
        }
        this.reload(loader, oldFacData, newFacData);
    }

    reload(loader, oldFacData, newFacData) {
        const newDataObj = Object.fromEntries(newFacData);
        const oldDataObj = Object.fromEntries(oldFacData);
        const newComponentSet = new Set(Object.keys(newDataObj));
        const oldComponentSet = new Set(Object.keys(oldDataObj));
        const createComponents = setDiff(newDataObj, oldDataObj);
        const deleteComponents = setDiff(oldDataObj, newDataObj);
        const updateComponents = Array.from(oldComponentSet)
            .filter(name => newComponentSet.has(name)) // intersect
            .filter(name => !deepEquals(newDataObj[name], oldDataObj[name]));

        // CUD operations, for components
        // CREATE
        for (const name of createComponents) {
            this.defineComponent(loader, name, newDataObj[name]); // easy
        }

        // UPDATE
        for (const name of updateComponents) {
            this.updateComponent(loader, name, newDataObj[name]); // hard
        }

        // DELETE
        for (const name of updateComponents) {
            this.deleteComponent(loader, name); // impossible
        }
    }

    defineComponent(loader, name, newOptions) {
        const factory = loader.defineComponent(name, newOptions);
        loader.componentFactoryData.push([name, newOptions]);
        factory.register();
    }

    updateComponent(loader, name, newOptions) {
        const factory = loader.defineComponent(name, newOptions);
        // Now, we need to reload existing ones
        for (const component of this.componentsByName.get(factory.fullName)) {
            //console.log('this is new fac comp class', factory.componentClass);
            component.initialize();
            component.constructParts(true); // Rebuild the component from parts
            component.isMounted = true;
            component.rerender();
        }
    }

    deleteComponent(loader, name) {
        // Should have a global "no-op component factory" that dead
        // components get patched into
        // Impossible to undefined components, so instead we just update
        // with a blank component
        this.updateComponent(loader, name, {}); // "no-op component"
    }

}

function oneTimeSetup() {
    const {Loader, moddebug} = Modulo;
    moddebug.reloader = new moddebug.LoaderReloader();
    moddebug.loader = new Loader('moddebug');
    moddebug.loader.loadString(debugToolbarString);
    moddebug.toolbar = globals.document.createElement('moddebug-toolbar');
    globals.document.body.appendChild(moddebug.toolbar);
}

Modulo.Loader.registerMiddleware(
    'load.component.after',
    function registerFactory(node, loader, loadingObj, factory) {
        if (!Modulo.moddebug.reloader) {
            oneTimeSetup();
        }
        Modulo.moddebug.reloader.register(loader, factory);
    },
);


Modulo.Loader.registerMiddleware(
    'initialized.component.after',
    function registerFactory() {
        Modulo.moddebug.reloader.registerComponent(this);
    },
);


Modulo.Loader.registerMiddleware(
    'prepare.component.before',
    function createGhosts() {
        if (!this.isMounted) {
            createGhostElements(this);
        }
    },
)

Modulo.Loader.registerMiddleware(
    'update.component.before',
    function hideGhosts() {
        // saveUtilityComponents
        //const selector = this.getPartsWithGhosts()
        //    .map(getGhostElementName).join(', ')
        //console.log('this is selector', this.getPartsWithGhosts(), selector2);
        const selector = Modulo.Loader.getPartsWithGhosts()
            .map(getGhostElementName).join(', ');
        this.ghostElements = Array.from(this.querySelectorAll(selector));
        this.ghostElements.forEach(elem => elem.remove());
    },
);

Modulo.Loader.registerMiddleware(
    'update.component.after',
    function restoreGhosts() {
        this.ghostElements.forEach(elem => this.prepend(elem));
    },
);

Modulo.DebugGhostBase = class DebugGhostBase extends HTMLElement {
    connectedCallback() {
        if (this.isMounted) { // prevent double-registering
            return;
        }
        this.isMounted = true;
        // https://github.com/WICG/webcomponents/issues/565
        const observer = new globals.MutationObserver(
            mutations => mutations
                .filter(({type}) => type === 'attributes')
                .map(this.attributeMutated, this))
        observer.observe(this, {attributes: true});
    }
    attributeMutated() {
        const parentComponent = getFirstModuloAncestor(this);
        const cPart = parentComponent.getPart(this.name);
        assert(cPart.ghostAttributeMutedCallback, 'not a real ghost');
        cPart.ghostAttributeMutedCallback(this)
    }

    static defineDebugGhost(cPartClass) {
        const tagName = getGhostElementName(cPartClass);
        globals.customElements.define(tagName, class extends Modulo.DebugGhostBase {
            get name() {
                return cPartClass.name;
            }
        });
    }
}

if (typeof module !== 'undefined') {
    module.exports = Modulo; // Node environment
} else if (typeof customElements !== 'undefined') {
    Modulo.defineAll(); // Browser environment
}
