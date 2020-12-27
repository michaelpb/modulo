const test = require('ava');
const {setupModulo, strip} = require('./utils/domUtils.js');

class MockComponent {
    constructor() {
        this.name = 'mockComponent';
        this.rvCalls = [];
    }
    resolveValue(...args) {
        this.rvCalls.push(args);
        return this.rvCalls.length;
    }
}


test('collectDirectives finds directives', t => {
    const Modulo = setupModulo(null, null, `<!DOCTYPE HTML>
      <a b="valb" [dir.path.here]c="valc" d="vald"></a>
    `);
    const el = Modulo.document.querySelector('a');
    const mockComponent = new MockComponent();
    const directives = Modulo.collectDirectives(mockComponent, el);
    t.truthy(directives);
    t.is(directives.length, 1);
    t.deepEqual(directives[0], {
        attrName: 'c',
        dName: 'dir.path.here',
        el: el,
        rawName: '[dir.path.here]c',
        setUp: 1,
        tearDown: 2,
        value: 'valc',
    });
    t.deepEqual(mockComponent.rvCalls, [
        ['dir.path.hereMount'],
        ['dir.path.hereUnmount'],
    ]);
});

test('collectDirectives applies syntactic sugar', t => {
    const Modulo = setupModulo(null, null, `<!DOCTYPE HTML>
      <a b="valb" c:="valc" @d="vald"></a>
    `);
    const el = Modulo.document.querySelector('a');
    const mockComponent = new MockComponent();
    const directives = Modulo.collectDirectives(mockComponent, el);
    t.truthy(directives);
    t.is(directives.length, 2);
    t.deepEqual(directives[0], {
        attrName: 'c',
        dName: 'mockComponent.resolve',
        el: el,
        rawName: 'c:',
        setUp: 1,
        tearDown: 2,
        value: 'valc',
    });
    t.deepEqual(mockComponent.rvCalls, [
        ['mockComponent.resolveMount'],
        ['mockComponent.resolveUnmount'],
        ['mockComponent.eventMount'],
        ['mockComponent.eventUnmount'],
    ]);
});


test('collectDirectives can find multiple directives on one attribute with syntactic sugar', t => {
    const Modulo = setupModulo(null, null, `<!DOCTYPE HTML>
      <a b="valb" @e:="vale"></a>
    `);
    const el = Modulo.document.querySelector('a');
    const mockComponent = new MockComponent();
    const directives = Modulo.collectDirectives(mockComponent, el);
    t.truthy(directives);
    t.is(directives.length, 2);
    t.deepEqual(directives[0], {
        attrName: 'e',
        dName: 'mockComponent.resolve',
        el: el,
        rawName: '@e:',
        setUp: 1,
        tearDown: 2,
        value: 'vale',
    });
    t.deepEqual(mockComponent.rvCalls, [
        ['mockComponent.resolveMount'],
        ['mockComponent.resolveUnmount'],
        ['mockComponent.eventMount'],
        ['mockComponent.eventUnmount'],
    ]);
});


test('collectDirectives can find arbitrary numbers of directives on one attribute', t => {
    const Modulo = setupModulo(null, null, `<!DOCTYPE HTML>
      <a b="valb" [a][b][c][d]e="vale"></a>
    `);
    const el = Modulo.document.querySelector('a');
    const mockComponent = new MockComponent();
    const directives = Modulo.collectDirectives(mockComponent, el);
    t.truthy(directives);
    t.is(directives.length, 4);
    t.deepEqual(directives[0], {
        attrName: 'e',
        dName: 'a',
        el: el,
        rawName: '[a][b][c][d]e',
        setUp: 1,
        tearDown: 2,
        value: 'vale',
    });
    t.deepEqual(mockComponent.rvCalls, [
        ['aMount'], ['aUnmount'],
        ['bMount'], ['bUnmount'],
        ['cMount'], ['cUnmount'],
        ['dMount'], ['dUnmount'],
    ]);
});

test('collectDirectives can find bare directives', t => {
    const Modulo = setupModulo(null, null, `<!DOCTYPE HTML>
      <a b="valb" [testing]></a>
    `);
    const el = Modulo.document.querySelector('a');
    const mockComponent = new MockComponent();
    const directives = Modulo.collectDirectives(mockComponent, el);
    t.truthy(directives);
    t.is(directives.length, 1);
    t.deepEqual(directives[0], {
        attrName: '',
        dName: 'testing',
        el: el,
        rawName: '[testing]',
        setUp: 1,
        tearDown: 2,
        value: '',
    });
    t.deepEqual(mockComponent.rvCalls, [
        ['testingMount'], ['testingUnmount'],
    ]);
});


test('collectDirectives can search children for multiple directives', t => {
    const Modulo = setupModulo(null, null, `<!DOCTYPE HTML>
        <main more-stuff-to-:ignore=true>
            <div stuff-to-ignore><img src="" /></div>
            <button @click:=props.clickme>
                Test
            </button>
        </main>
    `);
    const el = Modulo.document.querySelector('main');
    const mockComponent = new MockComponent();
    const directives = Modulo.collectDirectives(mockComponent, el);
    t.truthy(directives);
    t.is(directives.length, 2);
    t.deepEqual(directives, [
        {
            attrName: 'click',
            dName: 'mockComponent.resolve',
            el: el.querySelector('button'),
            rawName: '@click:',
            setUp: 1,
            tearDown: 2,
            value: 'props.clickme',
        },
        {
            attrName: 'click',
            dName: 'mockComponent.event',
            el: el.querySelector('button'),
            rawName: '@click:',
            setUp: 3,
            tearDown: 4,
            value: 'props.clickme',
        },
    ]);
    t.deepEqual(mockComponent.rvCalls, [
        ['mockComponent.resolveMount'],
        ['mockComponent.resolveUnmount'],
        ['mockComponent.eventMount'],
        ['mockComponent.eventUnmount'],
    ]);
});

