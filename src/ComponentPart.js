Modulo.Loader.registerComponentPart(State, {
    name: 'state',
    priority: 1, // -1, 0, 1, higher means earlier
    debug: {
        showGhost: true,
    },
});

Modulo.Loader.registerComponentPart(Script, {
    name: 'script',
    upgradesFrom: ['script'],
    //requires: ['state'], ?
    priority: 0, // -1, 0, 1, higher means earlier
});

module.exports = ComponentPart;



