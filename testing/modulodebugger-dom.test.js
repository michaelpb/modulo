const test = require('ava');
const {setupModulo, strip} = require('./utils/domUtils.js');

test('Modulo defineAll runs and registers built-in', t => {
    const Modulo = setupModulo(null, true);
    Modulo.defineAll();
    t.is(Modulo.globals.mockRegistered.length, 2); // "mod-load" and "ghost-state"
});

test('Loader libraries which mount components and show ghost and toolbar', t => {
    const {globals, document} = setupModulo('./testing/assets/loader_test.html', true);
    t.is(globals.mockRegistered.length, 5); // mod-load, moddebug-toolbar, ghost-state, lib-testcomponent, lib-counter,
    //console.log('mounted', globals.mockMounted);
    //console.log('this is innerHTML', document.body.innerHTML);
    const html = strip(document.body.innerHTML);
    t.is(globals.mockMounted.length, 4); // loader, testcomponent, counter, and state
    t.is(html, strip(`
        <mod-load namespace="lib" src="./loader_test_library.html"></mod-load>
        <h1>Ignorable stuff</h1>
        <lib-testcomponent>
            <h1>Hello Test World</h1>
        </lib-testcomponent>
        <lib-counter><ghost-state num:="1"></ghost-state>
            <aside onclick:="script.testClick">Test</aside>
            <button onclick:="script.count">
                1
            </button>
        </lib-counter>
        <p>More stuff</p>
        <moddebug-toolbar></moddebug-toolbar>
    `));
});


test('Components can alter state during click events, which is reflected in ghost', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html', true);
    let buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    let btn = buttons[0];
    t.is(strip(btn.textContent), '1');
    btn.click(); // simulate the click that increments the counter
    const html = strip(document.body.innerHTML);
    t.regex(html, /ghost-state num:="2"/i); // ensure state num increased
    buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    btn = buttons[0];
    t.is(strip(btn.textContent), '2'); // ensure the number increased
});
