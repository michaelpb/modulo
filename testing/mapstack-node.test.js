const test = require('ava');

function isPlainObject(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

class DeepMap {
    constructor(copyFrom=null, autoSave=false) {
        // TODO: Move the full version of this class into ModuloDebugger, make
        // it extend Map (for better introspection). The history / savepoints
        // mostly just good for debugging.
        this.label = null;
        this.readOnly = false;
        this.sep = '.';
        if (copyFrom) {
            // Easiest way to setup this one -- todo: deep copy?
            this.data = new Map(copyFrom.data);
            this.prefixes = new Map(Array.from(copyFrom.prefixes)
                    .map(([key, set]) => ([key, new Set(set)])));
            this.savepoints = Array.from(copyFrom.savepoints);
        } else {
            this.data = new Map();
            this.prefixes = new Map();
            this.savepoints = [];
        }
        this.shouldAutoSave = {
            'lazy': key => this.data.has(key) && // autosave if not redundant
                           (this.data.get(key) !== this.getLastSavedValue(key)),
            'granular': key => this.data.has(key), // only autosave if conflict
            'manual': key => false, // never autosave
        }[autoSave || 'manual'];
    }
    save(label) {
        const dm = new DeepMap(this);
        dm.label = label || null;
        dm.readOnly = true;
        this.savepoints.push(dm);
    }
    _getKey(prefix, suffix) {
        const sep = prefix && suffix ? this.sep : '';
        return prefix + sep + suffix;
    }
    setObject(key, obj) {
        for (const [suffix, val] of Object.entries(obj)) {
            this.set(this._getKey(key, suffix), val);
        }
    }
    set(key, value) {
        if (this.readOnly) {
            throw new Error('Read only');
        } else if (isPlainObject(value)) {
            this.setObject(key, value);
        } else {
            if (this.shouldAutoSave(key)) {
                this.save();
            }
            this.data.set(key, value);
            this._updatePrefixesForKey(key);
        }
    }
    _updatePrefixesForKey(key) {
        const keyParts = key.split(this.sep);
        let i = 0;
        while (i < keyParts.length + 1) {
            const prefix = keyParts.slice(0, i).join(this.sep);
            const suffix = keyParts.slice(i).join(this.sep);
            if (!this.prefixes.has(prefix)) {
                this.prefixes.set(prefix, new Set());
            }
            this.prefixes.get(prefix).add(suffix);
            i++;
        }
    }
    resolve(key) { return this.get(key) }
    get(key, defaultValue) {
        if (!this.prefixes.has(key)) {
            return defaultValue;
        }
        if (this.data.has(key)){
            return this.data.get(key);
        }
        // This means key is a prefix, so we need to create an obj
        const newObject = {};
        for (const suffix of this.prefixes.get(key)) {
            const [obj, finalInfix] = this._fillInObj(newObject, suffix);
            obj[finalInfix] = this.data.get(this._getKey(key, suffix));
        }
        return newObject;
    }
    _fillInObj(obj, key) {
        const infixes = key.split(this.sep);
        const finalInfix = infixes.pop(); // handle last one separately
        for (const infix of infixes) {
            if (!(infix in obj)) {
                obj[infix] = {};
            }
            obj = obj[infix];
        }
        return [obj, finalInfix];
    }
    toObject() {
        return this.get('', {});
    }
}



// Moving these methods here, so it is still tested in case they are ever
// needed again, but declutters Modulo.js
DeepMap.prototype.getAll = function getAll(key) {
    const results = [];
    for (const dm of this.savepoints.concat([this])) {
        const result = dm.get(key);
        if (typeof result !== 'undefined') {
            results.push(result);
        }
    }
    return results;
};

DeepMap.prototype.getLastSavedValue = function getLastSavedValue(key, defaultValue) {
    let i = this.savepoints.length;
    while (i > 0) {
        i--;
        const val = this.savepoints[i].get(key);
        if (val !== undefined) {
            return val;
        }
    }
    return defaultValue;
};

DeepMap.prototype.getAllKeys = function getAllKeys(level = 1) {
    if (level === 0) {
        return [''];
    }
    const results = [];
    for (const key of this.prefixes.keys()) {
        if (key && key.split(this.sep).length === level) {
            results.push(key);
        }
    }
    return results;
}

DeepMap.prototype.toObjectWithHistory = function toObjectWithHistory(level) {
    const results = {};
    for (const dm of this.savepoints.concat([this])) {
        for (const key of dm.getAllKeys(level)) {
            if (!(key in results)) {
                results[key] = [];
            }
            results[key].push(dm.get(key));
        }
    }
    return results;
};



test('DeepMap.constructor', t => {
    const dm = new DeepMap();
    t.truthy(dm);
});

test('DeepMap.toObject empty', t => {
    const dm = new DeepMap();
    t.truthy(dm.toObject());
    t.deepEqual(dm.toObject(), {});
});

test('DeepMap.set basic', t => {
    const dm = new DeepMap();
    dm.set('foo', 'bar');
    const obj = dm.toObject();
    t.deepEqual(obj, {foo: 'bar'});
});

test('DeepMap.set multiple', t => {
    const dm = new DeepMap();
    dm.set('foo1', 'bar1');
    dm.set('foo2', 'bar2');
    const obj = dm.toObject();
    t.deepEqual(obj, {foo1: 'bar1', foo2: 'bar2'});
});

test('DeepMap.set overrides', t => {
    const dm = new DeepMap();
    dm.set('foo', 'bar');
    dm.set('foo', 'bar2');
    const obj = dm.toObject();
    t.deepEqual(obj, {foo: 'bar2'});
});

test('DeepMap.set supports dot notation', t => {
    const dm = new DeepMap();
    dm.set('foo.baz', 'bar');
    const obj = dm.toObject();
    t.deepEqual(obj, {foo: {baz: 'bar'}});
});

test('DeepMap.set supports merge operation for objects', t => {
    const dm = new DeepMap();
    dm.set('foo', {biff: 'a', baz: 'b'});
    t.deepEqual(dm.toObject(), {foo: {biff: 'a', baz: 'b'}});
    t.deepEqual(dm.get('foo'), {biff: 'a', baz: 'b'});
    t.deepEqual(dm.get('foo.biff'), 'a');
    t.deepEqual(dm.get('foo.baz'), 'b');
});

test('DeepMap.set supports dot notation & overrides', t => {
    const dm = new DeepMap();
    dm.set('foo.biff', 'bar3');
    dm.set('foo.baz', 'bar');
    dm.set('foo.baz', 'bar2');
    const obj = dm.toObject();
    t.deepEqual(obj, {foo: {baz: 'bar2', biff: 'bar3'}});
});

test('DeepMap.get basic', t => {
    const dm = new DeepMap();
    dm.set('foo', 'bar');
    t.deepEqual(dm.get('foo'), 'bar');
});

test('DeepMap.get with default on empty', t => {
    const dm = new DeepMap();
    t.deepEqual(dm.get('foo', 'def val'), 'def val');
});

test('DeepMap.get with default on full obj', t => {
    const dm = new DeepMap();
    dm.set('bar', 'baz');
    t.deepEqual(dm.get('foo', 'def val'), 'def val');
});

test('DeepMap.get supports objs', t => {
    const dm = new DeepMap();
    dm.set('foo', {bar: 'baz'});
    t.deepEqual(dm.get('foo'), {bar: 'baz'});
});

test('DeepMap.get supports objs set by dot notation', t => {
    const dm = new DeepMap();
    dm.set('foo.bar', 'baz');
    t.deepEqual(dm.get('foo'), {bar: 'baz'});
});

test('DeepMap.get respects overrides', t => {
    const dm = new DeepMap();
    dm.set('foo', 'bar');
    dm.set('foo', 'bar2');
    t.deepEqual(dm.get('foo'), 'bar2');
});

test('DeepMap.get supports dot notation', t => {
    const dm = new DeepMap();
    dm.set('foo.baz', 'bar');
    t.deepEqual(dm.get('foo.baz'), 'bar');
});

test('DeepMap.get supports top-level objects', t => {
    const dm = new DeepMap();
    dm.set('', {foo: {baz: 'bar'}});
    t.deepEqual(dm.get('foo.baz'), 'bar');
});

test('DeepMap.get can get objects', t => {
    const dm = new DeepMap();
    dm.set('foo.baz', 'bar');
    t.deepEqual(dm.get('foo'), {baz: 'bar'});
});

test('DeepMap.get can get objects & overrides', t => {
    const dm = new DeepMap();
    dm.set('foo.biff', 'bar3');
    dm.set('foo.baz', 'bar');
    dm.set('foo.baz', 'bar2');
    t.deepEqual(dm.get('foo'), {baz: 'bar2', biff: 'bar3'});
});

test('DeepMap.getAllKeys(1) shows keys', t => {
    const dm = new DeepMap();
    dm.set('foo.biff', 'bar3');
    dm.set('biff.baz', 'bar');
    dm.set('baz.foo', 'bar2');
    const arr = dm.getAllKeys(1);
    t.deepEqual(arr, ['foo', 'biff', 'baz']);
});

test('DeepMap.toUnFlatObject(1) can show multiple', t => {
    const dm = new DeepMap(null, 'lazy');
    dm.set('foo.biff', 'bar3');
    dm.set('foo.baz', 'bar');
    dm.set('foo.baz', 'bar2');
    const obj = dm.toObjectWithHistory(1);
    t.deepEqual(obj, {foo: [
        {baz: 'bar', biff: 'bar3'},
        {baz: 'bar2', biff: 'bar3'},
    ]});
});

test('DeepMap inheritance works', t => {
    const dmP = new DeepMap();
    dmP.set('foo.biff', 'bar3');
    dmP.set('foo.baz', 'bar');
    dmP.set('foo.baz', 'bar2');
    const dm = new DeepMap(dmP);
    t.deepEqual(dm.get('foo'), {baz: 'bar2', biff: 'bar3'});
});

test('DeepMap inheritance can override', t => {
    const dmP = new DeepMap();
    dmP.set('foo.biff', 'bar3');
    dmP.set('foo.baz', 'bar');
    const dm = new DeepMap(dmP);
    dm.set('foo.baz', 'bar2');
    t.deepEqual(dm.toObject(), {foo: {baz: 'bar2', biff: 'bar3'}});
    t.deepEqual(dmP.toObject(), {foo: {baz: 'bar', biff: 'bar3'}});
});

test('DeepMap.setObject calculates prefixes for object merge', t => {
    const dm = new DeepMap();
    t.deepEqual(Array.from(dm.prefixes.keys()), []);
    dm.setObject('foo', {
        biff: 'a',
        baz: 'b',
        bar: {fizz: {buzz: 'c'}},
    });
    t.deepEqual(Array.from(dm.prefixes.keys()), [
        '',
        'foo',
        'foo.biff',
        'foo.baz',
        'foo.bar',
        'foo.bar.fizz',
        'foo.bar.fizz.buzz',
    ]);
});

test('DeepMap.set calculates prefixes for dot notation', t => {
    const dm = new DeepMap();
    t.deepEqual(Array.from(dm.prefixes.keys()), []);
    dm.set('foo.biff', 'a');
    dm.set('foo.baz', 'b');
    dm.set('foo.bar.fizz.buzz', 'c');
    t.deepEqual(Array.from(dm.prefixes.keys()), [
        '',
        'foo',
        'foo.biff',
        'foo.baz',
        'foo.bar',
        'foo.bar.fizz',
        'foo.bar.fizz.buzz',
    ]);
});

test('DeepMap.getAll gets a historical array at a certain level', t => {
    const dm = new DeepMap(null, 'granular');
    dm.set('foo.biff', 'a');
    dm.set('foo.baz', 'b'); // obj1
    dm.set('foo.biff', 'c'); // obj2
    dm.set('foo.baz', 'd'); // obj3
    t.deepEqual(dm.getAll('foo'), [
        {biff: 'a', baz: 'b'},
        {biff: 'c', baz: 'b'},
        {biff: 'c', baz: 'd'},
    ]);
});

test('DeepMap supports manual saving', t => {
    const dm = new DeepMap(null, 'manual');
    dm.set('foo.biff', 'a');
    dm.set('foo.baz', 'b');
    dm.set('foo.biff', 'c');
    dm.save();
    dm.set('foo.baz', 'd');
    t.deepEqual(dm.getAll('foo'), [
        {biff: 'c', baz: 'b'},
        {biff: 'c', baz: 'd'},
    ]);
});

test('DeepMap supports lazy auto saving', t => {
    const dm = new DeepMap(null, 'lazy');
    dm.set('foo.biff', 'a');
    dm.set('foo.baz', 'b'); // obj1
    dm.set('foo.biff', 'c'); // obj2
    dm.set('foo.baz', 'd'); // DONT FORK, be lazy
    t.deepEqual(dm.getAll('foo'), [
        {biff: 'a', baz: 'b'},
        {biff: 'c', baz: 'd'},
    ]);
});


test('DeepMap supports serializing complicated data', t => {
    const dm = new DeepMap();
    dm.setObject('', {
        'component.name': 'ChildComponent',
        'template.content': 'example',
        'props.options.clickme:': 'Function',
        'props.options.txt:': 'String',
        'props.content': 'test',
    });
    t.deepEqual(dm.getAll('props'), [{
        options: {'clickme:': 'Function', 'txt:': 'String'},
        content: 'test',
    }]);
});

