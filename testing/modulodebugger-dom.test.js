// XXX: Skipping ALL, until time to return to ModuloDebugger

const test = require('ava');
const {setupModulo, strip} = require('./utils/domUtils.js');

test.skip('Modulo defineAll & debugger runs and registers built-in', t => {
    const Modulo = setupModulo(null, true);
    Modulo.defineAll();
    t.is(Modulo.globals.mockRegistered.length, 2); // "mod-load" and "ghost-state"
});

test.skip('Loader mounts components and shows ghost and toolbar', t => {
    const {globals, document} = setupModulo('./testing/assets/loader_test.html', true);
    t.is(globals.mockRegistered.length, 5); // mod-load, moddebug-toolbar, ghost-state, lib-testcomponent, lib-counter,
    const html = strip(document.body.innerHTML);
    t.is(globals.mockMounted.length, 4); // loader, testcomponent, counter, and state
    t.is(html, strip(`
        <mod-load namespace="lib" src="./loader_test_library.html"></mod-load>
        <h1>Ignorable stuff</h1>
        <lib-testcomponent>
            <h1>Hello Test World</h1>
        </lib-testcomponent>
        <lib-counter><ghost-state num:="1"></ghost-state>
            <aside @click:="script.testClick">Test</aside>
            <button @click:="script.count">
                1
            </button>
        </lib-counter>
        <p>More stuff</p>
        <moddebug-toolbar></moddebug-toolbar>
    `));
});


test.skip('Components can alter state during click events, which is reflected in ghost', t => {
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


// Skipping since middleware was removed
test.skip('Reloader sets up timeouts', t => {
    const {globals} = setupModulo('./testing/assets/loader_test.html', true);
    t.is(globals.mockRegistered.length, 5); // mod-load, moddebug-toolbar, ghost-state, lib-testcomponent, lib-counter,
    t.is(globals.mockTimeouts.length, 1);
    globals.mockTimeouts[0].func();
    t.is(globals.mockTimeouts.length, 2);
    globals.mockTimeouts[1].func();
    t.is(globals.mockRegistered.length, 5); // should still be the same
});


test.skip('Reloader tries reloading when template is changed', t => {
    const {globals, document} = setupModulo('./testing/assets/loader_test.html', true);
    globals.mockTimeouts[0].func();
    t.is(globals.mockTimeouts.length, 2);
    // Now lets change stuff
    globals.mockModifyFile.push((fullPath, data) => {
        t.true(fullPath.endsWith('loader_test_library.html'));
        return data.replace('Hello Test World', 'Hello Changed World');
    });
    globals.mockTimeouts[1].func();
    const html = strip(document.body.innerHTML);
    t.regex(html, /Hello Changed World/); // ensure change took effect
    t.notRegex(html, /Hello Test World/); // ensure change took effect
});

test.skip('Reloader state changes are preserved', t => {
    const {globals, document} = setupModulo('./testing/assets/loader_test.html', true);
    let buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    let btn = buttons[0];
    t.is(strip(btn.textContent), '1');
    btn.click(); // simulate the click that increments the counter
    let html = strip(document.body.innerHTML);
    t.regex(html, /ghost-state num:="2"/i); // ensure state num increased
    buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    btn = buttons[0];
    t.is(strip(btn.textContent), '2'); // ensure the number increased

    globals.mockTimeouts[0].func();
    t.is(globals.mockTimeouts.length, 2);
    // Now lets change stuff
    globals.mockModifyFile.push((fullPath, data) => {
        t.true(fullPath.endsWith('loader_test_library.html'));
        return data.replace('Test</aside>', 'SomethingElse</aside>');
    });
    globals.mockTimeouts[1].func();
    html = strip(document.body.innerHTML);
    t.regex(html, /SomethingElse..aside/);
    t.notRegex(html, /Test..aside/);
    t.regex(html, /ghost-state num:="2"/i); // ensure state num increased
    buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    btn = buttons[0];
    t.is(strip(btn.textContent), '2'); // ensure the number is still 2
});
