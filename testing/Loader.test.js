const test = require('ava');
const Modulo = require('../src/Modulo');

test('Loader instantiates with empty args', t => {
    const loader = new Modulo.Loader();
    t.truthy(loader);
});

test('Loader serializes with empty args', t => {
    const loader = new Modulo.Loader();
    const results = loader.serialize();
    t.truthy(results);
});


