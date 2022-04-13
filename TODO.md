# High priority

- Finish bundle()


# Medium priority

- Decide on Loader / Module simplification
    - Possibly: Rename + condense Loader / Module to only be "Library"
    - Rationale: Less visually similar to Modulo, more descriptive, less
      confusing since "module" is a vanilla JS feature (import)
- Decide on Modulo / Config simplification
    - Remove ALL global "Modulo" object references, instead allow instantiating
      entire framework / lib as encapsulated config instance
    - Think about 'Modulo.register('cpart', 'Template', class Template extends
      CPart { });'

- ModRec & DOMCursor refactor
    - Finish detangling repetitive directives and dead code
    - Finish modulo-ignore and modulo-key
    - Fix nested subrender directives
    - Possibly: Implement new patch-set data structure


# Low priority

- Fix Reconciler1 tests so they run on other Node versions (they rely on an
  older "[object Object]" style toString that is inconsistent)

