
Modulo.MultiMap = class MultiMap extends Map {
    get(key) {
        if (!this.has(key)) {
            super.set(key, []);
        }
        return super.get(key)[-1];
    }
    getAll(key) {
    }
    set(key, value) {
        this.get(key).push(value);
    }
    toObject() {
        return Object.fromEntries(this);
    }
}



