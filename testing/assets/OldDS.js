

function isPlainObject(obj) {
  return obj && typeof obj === 'object' && !Array.isArray(obj);
}

Modulo.DeepMap = class DeepMap {
    constructor(copyFrom=null, autoSave='lazy') {
        this.label = null;
        this.readOnly = false;
        this.sep = '.';
        if (copyFrom) {
            // Easiest way to setup this one -- todo: should do a deep copy
            this.data = new Map(copyFrom.data);
            this.prefixes = new Map(copyFrom.prefixes);
            //for (const [key, value] of copyFrom.data) {
            //    this.set(key, value, true);
            //}
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
        const dm = new Modulo.DeepMap(this);
        dm.label = label || null;
        dm.readOnly = true;
        this.savepoints.push(dm);
    }
    setObject(key, obj) {
        for (const [suffix, val] of Object.entries(obj)) {
            const sep = key && suffix ? this.sep : '';
            const fullKey = key + sep + suffix;
            this.set(fullKey, val);
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
            // assert(!this.prefixes.has(key), `Invalid: ${key} is prefix`);
            this.data.set(key, value);
            this._setPrefixesForKey(key);
        }
    }
    _setPrefixesForKey(key) {
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
    getAllKeys(level = 1) {
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
    getLastSavedValue(key, defaultValue) {
        let i = this.savepoints.length;
        while (i > 0) {
            i--;
            const val = this.savepoints[i].get(key);
            if (val !== undefined) {
                return val;
            }
        }
        return defaultValue;
    }
    get(key, defaultValue) {
        if (!this.prefixes.has(key)) {
            return defaultValue;
        }
        if (this.data.has(key)){
            return this.data.get(key);
        }

        // This means key is a prefix, so we need to create an obj
        const obj = {};
        for (const suffix of Array.from(this.prefixes.get(key))) {
            const sep = key && suffix ? this.sep : '';
            const fullKey = key + sep + suffix;
            if (!this.data.has(fullKey)) { // never should happen
                throw 'dont forget the good times we had';
            }
            const value = this.data.get(fullKey);
            this._setObjByDotKey(obj, suffix, value);
        }
        return obj;
    }
    _setObjByDotKey(obj, dotKey, value) {
        const subkeys = dotKey.split(this.sep);
        const lastSubkey = subkeys.pop(); // get rid of last one
        for (const subkey of subkeys) {
            if (!(subkey in obj)) {
                obj[subkey] = {};
            }
            obj = obj[subkey];
        }
        obj[lastSubkey] = value;
    }
    toObject() {
        //return this.get('', {}); // <-- should work
        const obj = {};
        for (const [key, value] of this.data) {
            this._setObjByDotKey(obj, key, value);
        }
        return obj;
    }
    toObjectWithHistory(level) {
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
    }
    getAll(key) {
        const results = [];
        for (const dm of this.savepoints.concat([this])) {
            const result = dm.get(key);
            if (typeof result !== 'undefined') {
                results.push(result);
            }
        }
        return results;
    }
}


Modulo.TaggedObjectMap = class TaggedObjectMap extends Map {
    constructor(otherMap) {
        super(otherMap);
        this.tags = Object.assign({}, (otherMap || {}).tags || {});
        this.tagNames = Array.from((otherMap || {}).tagNames || {});
    }

    get(key) {
        if (!this.has(key)) {
            super.set(key, {});
        }
        return super.get(key);
    }

    resolve(key) {
        return getValue(this.toObject(), key);
    }

    set(key, value) {
        // maybe todo: possibly bind objects here (?)
        super.set(key, Object.assign(value, this.get(key), value));
    }

    save(tagName) {
        if (!this.tags) {
            this.tags = {};
            this.tagNames = [];
        }
        this.tags[tagName] = this.toObject();
        this.tagNames.push(tagName); // deadcode
    }

    getTagsSince(tagName) {// deadcode
        const index = this.tagNames.findIndex(tagName);
        if (index === -1) {
            throw Error(`Unknown tagName "${tagName}" for TaggedMap`)
        }
        return this.tagNames.slice(index);
    }

    modifyTag(tagName, key, value) {
        // Note: This changes how it was in history at the point of tagging,
        // and possibly the current value too
        const historicalValue = (this.tags || {})[tagName] || {};
        const existing = this.get(key);
        this.set(key, Object.assign(historicalValue, value, existing));
    }

    toObject() {
        // Possibly: Need binding here
        return Object.fromEntries(this);
    }

    // OKAY, this data type still needs more work. Ultimately, we'll need:
    //  - For "hot reloading", to set at 'initalized', then replay lifecycle since? ugh
}

