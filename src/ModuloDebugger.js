// (note: all untested code)

if (typeof Modulo === 'undefined' && typeof require !== 'undefined') {
    const Modulo = require('./Modulo.js'); // Node environment
}
if (typeof Modulo === 'undefined' || !Modulo) {
    throw new Error('Must load Modulo first');
}


const {globals} = Modulo;
Modulo.DEBUG = true;
Modulo.moddebug = {};

function deepEquals(a, b) {
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return null;
    }
}

Modulo.moddebug.loader = new Modulo.Loader('moddebug');
Modulo.moddebug.Toolbar = Modulo.moddebug.loader.loadString(`
<template mod-component="DebugToolbar">
    <script type="modulo/template">
        <div>
            <span class="logo">%</span>
            <label><input onchange:="hotreloadToggle" type="checkbox" />
                Hot-reloading</label>
            <h2>Ghost debug elements</h2>
            ${
                state.partTypes.map(({name}) =>
                    \`
                    <label><input onchange:="ghostToggle"
                                  onchange.payload="${name}"
                                  type="checkbox" />
                        ${name} ghost</label>
                    \`).join('')
            }
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


Modulo.moddebug.Reloader = class Reloader extends Modulo.CompontentPart {
    static name = 'reloader';
    initializedCallback() {
        const {loader} = this.component.factory;
        const src = loader.getAttribute('src');
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
        const oldFacData = JSON.stringify(loader.componentFactoryData);
        globals.fetch(src)
            .then(response => response.text())
            .then(text => {
                newLoader.loadString(text, false);
                const newFacData = newLoader.componentFactoryData;
                if (JSON.stringify(newFacData) !== oldFacData) {
                    loader.reload(newFacData);
                }
                this.pollInProgress = false;
            });
    }
}
Modulo.Loader.registerComponentPart(Modulo.moddebug.Reloader);
Modulo.Loader.registerMiddleware(
    'load.component.before',
    function addReloaderCPart(node, loader, loadingObj) {
        loadingObj.set('reloader', {content: '', options: {}});
    },
);
Modulo.Loader.prototype.reload = function () {
    // todo: better to do with middleware?
}

if (typeof module !== 'undefined') { // Node
    module.exports = ModuloDebugger;
}
