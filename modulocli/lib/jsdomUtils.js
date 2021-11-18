
function addRangeToWindow(globals) {
    const noop = function () {};
    Object.assign(globals.Range.prototype, {
        moveToElementText: noop,
        collapse: noop,
        moveEnd: noop,
        moveStart: noop,
        getBoundingClientRect: function () {
          return {};
        },
        getClientRects: function () {
          return [];
        },
    });
}

// Very simple hacky way to do mocked web-components define for JSDOM
function webComponentsUpgrade(el, instance) {

    // Both MOD-LOADER and ModuloElement have "initialize" property, so
    // anything we upgrade will have that.
    const secondTime = Boolean(el.initialize);

    // Manually "upgrading" the JSDOM element with the webcomponent
    const protos = [instance, Reflect.getPrototypeOf(instance)];
    if (!el.tagName.startsWith('MOD-')) { // TODO: verify that this is deletable after mod-load is deleted
        // Only add in prototype of ModuloElement if necessary
        protos.push(Reflect.getPrototypeOf(protos[1]));
    }
    protos.reverse(); // apply in reverse order so last "wins"

    // Get every prototype key
    const allKeys = [];
    for (const proto of protos) {
        allKeys.push(...Reflect.ownKeys(proto));
    }

    // Loop through binding functions to element
    for (const key of allKeys) {
        if (instance[key] instanceof Function) {
            el[key] = instance[key].bind(el);
        } else {
            el[key] = instance[key];
        }
    }

    if (!secondTime) {
        // "Re-initialize" so we get innerHTML etc
        if (el.initialize) { // Is a modulo Element
            el.initialize();
        }
        if (el.connectedCallback) {
            el.connectedCallback();
        }
    }
}

function patchWindow(globals) {
    addRangeToWindow(globals);
}

module.exports = {
    patchWindow,
    webComponentsUpgrade,
}
