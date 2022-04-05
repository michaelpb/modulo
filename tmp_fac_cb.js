

function Modulo() {
    // TODO: Dead code, needs development
    // New interface without defineAll
    const modulo = Object.freeze(Object.assign({}, Modulo));
    modulo.fetchQ = new modulo.FetchQueue();
    modulo.assets = new modulo.AssetManager();
    modulo.globalLoader = new modulo.Loader(null, { attrs });
    modulo.CommandMenu.setup();
    window.Modulo = modulo;
    modulo.fetchQ.wait(() => {
        const query = 'template[modulo-embed],modulo,m-module';
        for (const elem of modulo.globals.document.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            modulo.globalLoader.loadString(elem.innerHTML);
        }
    });
    return modulo;
}


static factoryCallback(opts, factory, loadObj) {
        // TODO: Delete this after we are done with directive-based expansion
        const tagPref = '$1' + factory.loader.namespace + '-';
        const content = (opts.content || '').replace(/(<\/?)my-/ig, tagPref);
        return { content };
    }
