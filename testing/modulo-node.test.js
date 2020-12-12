const test = require('ava');
const {Loader} = require('../src/Modulo');

test('Loader instantiates with empty args in node.js environ', t => {
    const loader = new Loader();
    t.truthy(loader);
});

test('Loader serializes with empty args in node.js environ', t => {
    const loader = new Loader();
    const results = loader.serialize();
    t.truthy(results);
});


