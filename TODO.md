
# More notes: 2021 (later)


- Main next steps:
    - (DONE) Remove ".name"
    - (DONE) Do cparts.state vs state conversion
    - (DONE-ish) Work on "Live Code Preview" component for examples
    - (DONE) Misc must have features:
        - Cache for components in localStorage
        - (DONE) "settingProps" as a means to squirrel away data during ssg
    - Do immediately prefixing components
    - (DONE) Work on Modulo Router
    - MTL: Support for "or" and "and" operators in if statements, and better
      error messages if encountering unknown conditional operators
    - ERROR: On GitHub API search, key= doesn't work to keep input focus
      between renders, if a new element is introduced above it. Need to debug
      SET DOM implementation how it uses key.
    - Linting Rules!!
    - (DONE) component.innerHTML = ... is what does reconcile! ({component: {innerHTML: ..})
    - ShadowDOM + scoped style as an option (style could respect compnent)
        - shadow - will attach component.innerHTML to shadow DOM
        - shadow=only - will clear innerHTML, and then attach 
                        component.innerHTML to shadow DOM
    - Big TODO: Finish Loading prefixing correctly
        - 1) x- for local, or imported without namespace
        - 2) x328f- get rewritten for imported ones
    - How to get better stack traces when everything is in an eval? Anyway to
      catch & throw? (defineComponent is the big try/catch)
    - Fix resolution issue with [component.children]... (causing x-Page to not show content)
    - CSS bundling
    - Possibly change directive syntax,
        - Current has bad w3c compliance, not sure if better:
        -  __component.children__
        - ##component.children##
        - _%component.children%_

- Look into replacing JSDom with linkedom: https://github.com/WebReflection/linkedom#readme

- Supposed to be much faster and support customElements out of the box.

### Good ideas
        // Post setdom refactor idea:
        // 1. CParts can contain other CParts
        // 2. CParts classes self-configure:
        //         - parentCPart = true;

        // Re 1, maybe those could be "modulo-containers", eg customElements,
        // so m-loader, m-component and m-module. These self-enable.
--------------


    - // TODO: Idea: Allow global dot resolution for config like this, so we
        // can do settings=:module.script.exports.templateSettings
- Code quality idea: Max cyclomatic complexity
    - (Can be configured via linting?)
    - Currently only collectDirectives (7) and "anon method-18" (6) violate
      this

- Why doesn't this already work, via factory properties? -v (see below for more thoughts)
- Idea for configuring cparts from within script tag:
    - Set already-constructed cparts in script before running script
    - Allow global / static code like such:
    - < script >
    -   template.addFilter('asOrdinal', s => s === 1 ? '1st' : s + 'th')
    -   or template.filters.asOrdinal = ... etc
    -   OR have someting like factory.configure('template', 'filters', ...)
    - (best, since should be static/factory, thus passed in at time of Function)

- Why doesn't this already work, via factory properties? (possible improvement) -v
      - One improvement would be an explicit "config stack":
        loader.config.push({'template': {defaultOptions}});
        const obj = Object.assign({}, ...loader.config);
      - It would actually better resemble inheritence... as such:
          - Modulo.config
              - each Loader gets: this.config = Object.create(Modulo.config);
              - each Factory gets: this.config = Object.create(loader.config);
              - each instance gets: this.config = Object.create(factory.config);
              - each cpart gets: this.attrs = Object.create(factory.config[cpartName]);
              - template attrs put onto config!!!
      - This would also play nicely with the "cparts all the way down" approach
      - Cparts get attrs of parents. It would go up to Loader.



# More notes: 2021

- Replace all mention of 'options' with 'attrs' or something equally consistent
  / accurate

- Uniquely identifying components:
    - component-hash: a7efa90
    - mutation-hash: 1a3a4f9
    - mutation-hash: 0000000 # for immutable, or initial state
    - mutation-hash is only implemented for State CPart
