// (note: all untested code)

if (typeof Modulo === 'undefined' && typeof require !== 'undefined') {
    const Modulo = require('./Modulo.js'); // Node environment
}
if (typeof Modulo === 'undefined' || !Modulo) {
    throw new Error('ModuloDebugger.js: Must load Modulo first');
}
if (typeof globals === 'undefined') {
    globals = Modulo.globals;
}
Modulo.DEBUG = true;
Modulo.moddebug = {};

function deepEquals(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return null;
    }
}

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
Modulo.moddebug.factories = {};
Modulo.moddebug.reloaders = {};
Modulo.moddebug.loader = new Modulo.Loader('moddebug');
Modulo.moddebug.Toolbar = Modulo.moddebug.loader.loadString(`
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
`)[0];


// NOTE: Need to think "1 Reloader" per component, and "1 Factory Reloader"
// total
//Modulo.moddebug.Reloader = class Reloader extends Modulo.CompontentPart {
Modulo.moddebug.Reloader = class Reloader extends Modulo.CompontentPart {
    static name = 'reloader';
    initializedCallback() {
        const {factory} = this.component;
        Modulo.moddebug.reloaders[factory.fullName] = this;
        Modulo.moddebug.factories[factory.fullName] = factory;
        const src = factory.loader.getAttribute('src');
        const pollRate = 5000;
        const lastText = '';
        this.pollInProgress = false;
        this.pollInterval = setInterval(() => {
            if (this.pollInProgress) {
                return; // prevent multiples
            }
            this.pollInProgress = true;
            this.doPoll();
        }, 5000);
    }
    doPoll() {
        const newLoader = new Modulo.Loader(loader.namespace, loader.options);
        const oldFacData = loader.componentFactoryData;
        const oldFacDataS = JSON.stringify(loader.componentFactoryData);
        globals.fetch(src)
            .then(response => response.text())
            .then(text => {
                newLoader.loadString(text, false);
                const newFacData = newLoader.componentFactoryData;
                const newFacDataS = JSON.stringify(newFacData);
                if (newFacDataS !== oldFacDataS) {
                    this.reload(loader, oldFacData, newFacData);
                }
                this.pollInProgress = false;
            });
    }
    reload(loader, oldFacData, newFacData) {
        const newDataObj = Object.fromEntries(newFacData);
        const oldDataObj = Object.fromEntries(oldFacData);
        const newComponentSet = new Set(newDataObj.keys());
        const oldComponentSet = new Set(oldDataObj.keys());
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
        const newFactory = loader.defineComponent(name, newOptions);
        const oldOpts = loader.componentFactoryData.filter([name, newOptions]);
        const oldFactory = Modulo.moddebug.factories[newFactory.fullName];
        const oldClass = oldFactory.componentClass;
        Object.assign(oldFactory, newFactory);
        oldFactory.componentClass = Object.assign(oldClass, newFactory.componentClass);
    }
    deleteComponent(loader, name) {
        // impossible, but can hot patch into no-ops
    }
}
Modulo.Loader.registerComponentPart(Modulo.moddebug.Reloader);
Modulo.Loader.registerMiddleware(
    'load.component.before',
    function addReloaderCPart(node, loader, loadingObj) {
        loadingObj.set('reloader', {content: '', options: {}});
    },
);
Modulo.Loader.registerMiddleware(
    'load.component.after',
    function registerFactory(node, loader, loadingObj, factory) {
    },
);


if (typeof module !== 'undefined') { // Node
    module.exports = ModuloDebugger;
}
