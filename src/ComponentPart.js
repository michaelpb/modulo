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



// Each componentPart should function like middleware:
const renderingObjectExample = {
    props: {
    },
    state: {
    },
    script: {
      // OH shit, script.myFunc
      // super.script.myFunc
    },
    template: {
        content: '<...>',
        // template "breaks out" and changes output
        // also, has a render(),
    },
    output: '<div...>',
};

LifeCycle:

  load // e.g. during load (generates "options" obj)
  factory // e.g. during construction (on class)

  build // e.g. constructed
  initialized // e.g. mounted (on instance)

  prepare // about to render
  render // doing the render
  update // doing the update itself
  updated // noop hook (?)


LifeCycle:

  factory
      - script runs
          - Eventually: we get a static_ function_ context etc (using stuff)
      - template runs
          - compiles

  initialized // e.g. mounted (on instance)
      - props runs
          - populates rendering obj with_ props
          - Use object freeze on ----------^ (?)
          - "RenderingObj.setFrozen()"
          - only needs to happen once per instance
          - receive props
      - state runs
          - populate default_ props

  prepare
      - state runs
          - populates rendering obj with_ state
      - template runs
          - chooses the template (for_ template selection, if_ exists)
      - MAP STACK GROUP undoes through:
          - 'prepare'

  render // doing the render
      - template
          - runs chosen template and populates render object with_ output

  update // doing the update itself
      - template (?) runs --- or maybe "mod-configure" runs
          - Maybe mod-component RUNS!!!! Thats where it runs!!! HOOKS ITSELF
          - reconcile happens

  updated // noop hook (?)

