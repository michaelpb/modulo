const test = require('ava');
const {setupModulo, strip} = require('./utils/domUtils.js');

test('Loader instantiates with empty args', t => {
    const Modulo = setupModulo();
    const loader = new Modulo.Loader();
    t.truthy(loader);
});

test('Modulo defineAll runs and registers built-in', t => {
    const Modulo = setupModulo();
    Modulo.defineAll();
    t.is(Modulo.globals.mockRegistered.length, 1); // only "mod-load"
});

test('Loader loads libraries with expected properties', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    const loader = document.querySelector('mod-load');
    t.truthy(loader);
    t.truthy(loader.componentFactoryData);
    t.snapshot(loader.componentFactoryData);
});

// TODO: When ghost is fully extricated, stop skipping
test.skip('Loader libraries which mount components', t => {
    const {globals, document} = setupModulo('./testing/assets/loader_test.html');
    t.is(globals.mockRegistered.length, 4);
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
        <lib-counter>
            <aside onclick:="script.testClick">Test</aside>
            <button onclick:="script.count">
                1
            </button>
        </lib-counter>
        <p>More stuff</p>
    `));
});

test.skip('Loader loads correctly prefixed CSS', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    const styles = Array.from(document.querySelectorAll('style'));
    //console.log('this is styles', styles);
    //console.log('this is styles', styles[0].textContent, styles[1].textContent);
    t.is(styles.length, 1); // disabled due to bug with styles
    const expectedStyle = strip(`
        lib-Counter button {
            color: blue;
            background: pink;
        }
    `);
    const text = strip(styles[0].textContent);
    t.is(text, expectedStyle);
});


test('Components update DOM with template', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    const h1elems = Array.from(document.querySelectorAll('h1'));
    t.is(h1elems.length, 2);
    t.is(h1elems[0].textContent, 'Ignorable stuff');
    t.is(h1elems[1].textContent, 'Hello Test World');
});


test('Components register click events', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    const comps = Array.from(document.querySelectorAll('lib-Counter'));
    t.is(comps.length, 1);
    const component = comps[0];
    component.querySelector('aside').click();
    t.is(component.wasClicked, true);
});

test('Components can alter state during click events', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    let buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    let btn = buttons[0];
    t.is(strip(btn.textContent), '1');
    btn.click(); // simulate the click that increments the counter
    const html = strip(document.body.innerHTML);
    buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    btn = buttons[0];
    t.is(strip(btn.textContent), '2'); // ensure the number increased
});


test('Components can have other components and namespaces get rewritten', t => {
    const {document} = setupModulo('./testing/assets/composition_test.html');
    const html = strip(document.body.innerHTML);
    t.is(html, strip(`
        <mod-load namespace="lib" src="./composition_test_library.html"></mod-load>
        <h1>Ignorable stuff</h1>
        <lib-parentcomponent>
            <div>
                <lib-childcomponent clickme:="script.gotClicked" txt="Click me! :)">
                    <button onclick:="props.clickme">
                        Click me! :)
                    </button>
                </lib-childcomponent>
            </div>
        </lib-parentcomponent>
        <p>More stuff</p>
    `));
});


test.skip('Parent components can pass down functions as props', t => {
    const {document} = setupModulo('./testing/assets/composition_test.html');
    let buttons = Array.from(document.querySelectorAll('button'));
    t.is(buttons.length, 1);
    let btn = buttons[0];
    btn.click(); // simulate click
    const comps = Array.from(document.querySelectorAll('lib-ParentComponent'));
    t.is(comps.length, 1);
    const component = comps[0];
    t.is(component.wasClicked, true);
});

/*
Tough composition scenarios:

Basic - event is passed down as prop, e.g.:

<template name="P">
    <my-C clicky:=clickme></my-C>
    <script>
        function clickme() {}
    </script>
</template>

<template name="C">
    <button onclick:=props.clicky>Klicky</button>
    <script>
        function clickme() {}
    </script>
</template>



Harder - event is attached to inner content, e.g.:

<template name="P">
    <my-C>
        <button onclick:=script.clickme>Klicky</button>
    </my-C>
    <script>
        function clickme() {}
    </script>
</template>

<template name="C">
    ${props.content}
    <script>
        function clickme() {}
    </script>
</template>




*/


