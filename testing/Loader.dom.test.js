const test = require('ava');
const {setupModulo, strip} = require('./utils/domUtils.js');

test('Loader instantiates with empty args in Node', t => {
    const Modulo = setupModulo();
    const loader = new Modulo.Loader();
    t.truthy(loader);
});

test('Modulo defineAll runs and registers built-in', t => {
    const Modulo = setupModulo();
    Modulo.defineAll();
    t.is(Modulo.globals.mockRegistered.length, 4);
});

test('Loader loads libraries which mount', t => {
    const Modulo = setupModulo('./testing/assets/loader_test.html');
    t.is(Modulo.globals.mockRegistered.length, 6);
    t.is(Modulo.globals.mockMounted.length, 2);
});

test('Loader loads correctly prefixed CSS', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    const styles = Array.from(document.querySelectorAll('style'));
    t.is(styles.length, 1);
    const expectedStyle = strip(`
        lib-Counter button {
            color: blue;
            background: pink;
        }
    `);
    const text = strip(styles[0].textContent);
    t.is(text, expectedStyle);
});


test('Components behave as expected', t => {
    const {document} = setupModulo('./testing/assets/loader_test.html');
    const styles = Array.from(document.querySelectorAll('style'));
    t.is(styles.length, 1);
    const expectedStyle = strip(`
        lib-Counter button {
            color: blue;
            background: pink;
        }
    `);
    const text = strip(styles[0].textContent);
    t.is(text, expectedStyle);
});




