# Misc notes:

- Right now, manually setting which one CPart is active is effectively creatinq
  a new type of state
- We want some way to "choose" or bind based on actual state
- "static getCurrentCPartCallback" could be a solution to cpart spares

# Next refactor:

- Switch to < load > , and fix sub-namespacing / hash namespacing

- Namespacing fix:
  - Start by simply renaming "namespace" to "global-namespace".
  - Same behavior, always register absolutely to global-namespace
  - This way we can "punt" on hash namespacing until "namespace" (private ns)
    becomes a required feature

- CLI testing: https://bitbucket.org/michaelb/scrollcli/src/master/runtests.sh
- Use my old work on scrollcli BATS for "E2E" modulocli testing
- Another: Either part of testing framework, or built-in, support archives of
  site sources as "input" that it unzips to a tmp file, so we can have "frozen"
  versions of CLI tests at different version tags for a more sophisticated CLI
  test matrix
- Improve "basePath" --> switch to workingDir and add as chdir() function

- TODO: New lifecycle names:
  - Prepare -> Render -> Reconcile -> Update

- Another idea: Create a JavaScript interface for Component and CPart
  definition that uses Template literals tagged syntax:
    - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
    - Would be very easy for massive gain (e.g. much more clear integration into other frameworks)
    - Perhaps the Modulo object could have it?  - const modulo = new Modulo(); - modulo.define` -    <component> ...  - `
    - Not sure how useful this is, on second thought, compared to: modulo.loadString(`...`)
    - Much better to be per-component, then:
      - const { component } = modulo.cpartDef;
      - component`name=""`
      - endcompnent``

- How to show off practicing different props:
    - Add another "type" of text: Preview text
    - By default, show as another pane (?)
        - Maybe to the right of the preview?
    - By default, do not allow editing
    - By default, show some other tabs (?) to select
- Could allow a show-off "auto" mode, for the front-page or other places, where
  it just cycles through different sets of props, showing the result of each
  (could look really cool with a transition!!)

# Notes on using ModRec to simplify load / reload:

- ModRec + hooks for load
  - Loader is just a domfragment
  - It keeps the dom of the loaded components loaded
  - It reconciles if hot-updated
      - (eventually can do othe stuff)
- modulo-loader can hook into tagTransforms, can hook into build process
  - Use to populate load obj
  - Thus, can use to load everything + get directives applied

- One radical idea is to just do dom nodes all the way down:
  - E.g. change state into < modulo-state /> dom node factory representation
  - Factory loops through it's dom nodes

- getAttr terminology ideas: ":="
  - Give it a new name: dataProps
  - The Props CPart will get its data from either dataProps or real attributes
  - Can be for any JSON value (invalid word symbols, except for true/false/null)

- Idea for "modulocli test" multiprocessing:
  - Start "test server" -- HTTP server that serves up test results + badges
  - Expose HTTP API to re-run tests (maybe also git pull & rerun?)
  - HTTP API should allow "split" work -- this way it can be used as a primitive worker-queue
      - This would allow starting X processes, one for each physical core
      - Then TestSuites get "round-robined" between the processes

- More ideas for "fetch actions":
    <request
        prefix="https://github.com/"
        repos.GET="/api/users/{{ username }}"
        repos.callback:=script.dataReceived
    ></request>
    - Under the hood uses fetchQ.enqueue + fetchQ.wait (to gather multiple)
    - The routes are all templated, e.g.:
    - request.repos.get({username: 'michaelpb'})
    - Future idea: Could use reversable named routes from backend

- Misc other ideas:
    - "Scheduler": combine fetchQ + setTimeout into a custom queue


- Release schedule ideas:
    - Set up a robust testing matrix
    - "Modulo Version"   x   "Unit-test version"   x   "Browser"
    - e.g. 0.5.1         x   0.3.4                 x   Edge 18
    - Will have to play by ear the old unit-test idea, but it would just check
      out old git branches/tags, move in the latest src/Modulo.js, then test
    - Might have to ONLY do this with "public API" unit tests, since the goal
      is to check against old tests taht might be using old APIs, to ensure we
      don't lose public-facing API features

# More notes: 2021 (Nov)

- GET params config idea:
    - Allow importing of libraries with GET parameters, e.g. /components.html?theme=bootstrap
    - This generates that loader with the given config (which it adds to the
      hash), allowing for the same library to be imported multiple times with
      different configs and different namespaces.
    - This would allow for the same component library to be configured multiple
      times. The ideal sitch


# More notes: 2021 (Sep)

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
    - Fix key=
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
    - An interesting ToDo:
        - Maybe only good for mdu, not this, but with headless browser testing +
          step-based testing, imagine the <style> tag also being for stuff like this:
            - <style user-action>
                  click button {
                      color: blue;
                      background: red;
                  }
              </style>
            - Basically, can be used for both triggering events, and checking
              that things are visually identifiable
            - Could have other filters as well, e.g.  "color: contrast-with(var(background));"
    - Possibly change directive syntax,
        - Current has bad w3c compliance, not sure if better:
        -  __component.children__
        - ##component.children##
        - _%component.children%_

- Look into replacing JSDom with linkedom: https://github.com/WebReflection/linkedom#readme

- Supposed to be much faster and support customElements out of the box.

--------------

    - // TODO: Idea: Allow global dot resolution for config like this, so we
        // can do settings=:module.script.exports.templateSettings

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

# Misc performance update ideas:

        // for directive search, would have to measure to see if a regexp can
        // cut back time (I'm increasingly thinking: Probably not, only for
        // very large attribute lists, everything else is probably slower)
        for (const node of nodes) {
            // Check if this speeds up, due to regexp compilation
            const attrs = node.getAttributeNames().join(' ');
            if (/^[ a-z-]+$/ig.test(attrs)) {
                continue;
            }
            // ...
        }

# -------------------

        Idea: CSS variables set by state

        <state
            userColor="red"
        ></state>
        <style [state.bind]color="userColor">
            div {
                color: var(--color);
            }
        </style>




# More notes: 2021

- Replace all mention of 'options' with 'attrs' or something equally consistent
  / accurate

- Uniquely identifying components:
    - component-hash: a7efa90
    - mutation-hash: 1a3a4f9
    - mutation-hash: 0000000 # for immutable, or initial state
    - mutation-hash is only implemented for State CPart

        // Idea: Use Template interface for Style transformers (so that MTL
        // could be used in a pinch well). Eg if ('transform' in options) {
        // Transfomer().render(renderObj) }
        // TODO: Need to do '<x-' -> '<xa3d2af-' for private components, and do
        // '<x-' -> '<tagPref-' for public components
        // (and remove '<my-')
        //const content = (opts.content || '').replace(/(<\/?)x-/ig, tagPref);
        // TODO -v prefered
        //content = content.replace(/(<\/?)x-/g, tagPref);

            // Possibility matrix:
            // (Note: It's not symmetric due to side-effect of getMatchedNode,
            // specifically ordering of checking child first.)
            // matchedRival    ===  null
            //                              rival
            //                                       !== rival
            // matchedChild                                            false
            //       ===  null  . normal    .  e   . nr=r,r=MR    .   skip R
            //           child  . normal    .  e   .  normal      .   normal
            //       !== child  . c=MC,nc=c .  e   .  skip both   .   r=MR,nr=r...
            //           false  . skip C    .  e   . c=MC,nc=c... .   skip both
            //Modulo.assert(matchedRival ? (matchedRival !== rival) : false, 'Repeated key!');

        // The "Everything is custom component" idea:
        // - Use tagTransforms to convert <state> into <m-state> etc
        // - Use connectedCallback to do: this.parentNode.cparts[this.cpartName] = this;

- Does not work, shadowDom only:Consideration for [component.children] ... Perhaps do < slot > interface
  instead?
<!--
TODO Idea:
Implement another demo type:
- Very similar to minipreview with tabs, but with 1 exception:
    - Have tabs be on left to be more readable with longer names
    - Disable editing
    - By default, have a play button "[>]" that every 3 seconds loops to the
      next example snippet
    - The goal is to cycle through showing off different props of the same
      component
-->
