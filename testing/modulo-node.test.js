const test = require('ava');
const Modulo = require('../src/Modulo2');
const {strip} = require('./utils/domUtils.js');

test('Loader instantiates with empty args in node.js environ', t => {
    const loader = new Modulo.Loader();
    t.truthy(loader);
});

test('Loader serializes with empty args in node.js environ', t => {
    const loader = new Modulo.Loader();
    const results = loader.serialize();
    t.truthy(results);
});

const testScript1 = `
    function testing123() {
        // etc
    }
    function testing321() {
        // etc
    }
`;
const expectedFuncsString = `
    "testing123": typeof testing123 !== "undefined" ? testing123 : undefined,
    "testing321": typeof testing321 !== "undefined" ? testing321 : undefined,
`;
const expectedWrappedScript = `
    'use strict';
    const module = {exports: {}};
    ${testScript1}
    return {
        ${expectedFuncsString}
        ...module.exports,
    };
`;


test('Script.getSymbolsAsObjectAssignment - finds functions', t => {
    const results = Modulo.parts.Script.getSymbolsAsObjectAssignment(testScript1);
    t.truthy(results);
    t.is(strip(results), strip(expectedFuncsString));
});


test('Script.wrapJavaScriptContext - works as intended', t => {
    const results = Modulo.parts.Script.wrapJavaScriptContext(testScript1);
    t.truthy(results);
    t.is(strip(results), strip(expectedWrappedScript));
});



