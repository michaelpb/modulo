const test = require('ava');
const {setupModulo, strip} = require('./utils/domUtils.js');

test('TodoMVC - Components register click events after lists rerendering', t => {
    const {document} = setupModulo('./testing/assets/todomvc_test.html');
    const comps = Array.from(document.querySelectorAll('ns-Todo'));
    t.is(comps.length, 1);
    const component = comps[0];

    // Initial
    let lis = Array.from(component.querySelectorAll('li'));
    t.is(lis.length, 4);
    let texts = lis.map(li => li.textContent).map(strip);
    t.deepEqual(texts, ['Milk', 'Bread', 'Candy', 'Add']);

    // 1st Click
    component.querySelector('button').click();
    lis = Array.from(component.querySelectorAll('li'));
    t.is(lis.length, 5);
    texts = lis.map(li => li.textContent).map(strip);
    t.deepEqual(texts, ['Milk', 'Bread', 'Candy', 'Beer', 'Add']);

    // 2nd Click
    component.querySelector('button').click();
    lis = Array.from(component.querySelectorAll('li'));
    t.is(lis.length, 6);
    texts = lis.map(li => li.textContent).map(strip);
    t.deepEqual(texts, ['Milk', 'Bread', 'Candy', 'Beer', 'Beer', 'Add']);
});

