const {JSDOM} = require('jsdom');

function patchGlobals() {
    Modulo.globals = new JSDOM('');
}

