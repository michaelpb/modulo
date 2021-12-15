------

# Final To-Do:

1. HeadExportCPart
  - "AssetCPart" ?
  - Base class for Script and Style CPart
  - Allow CParts to export a tag with given content (style or script)

2. Finish m.build()
  - Idea, use hashes? can that hack work?

3. ModRec & DOMCursor refactor
  - Finish de-tangling bugs
  - Implement new patch-set system
  - Swap algo with non-recursive DFS using explicit stack var

4. CPart interface refactor
  - Decide on "template" vs "Template"

5. Decide on general Modulo config
  - Change "defineAll" to "configAndRegister" or something
  - Generates a "configuration stack" of Modulo objects
  - Remove ALL global "Modulo" object references, instead allow instantiating
    entire framework / lib as encapsulated config instance
  - Decide on Possibly moving more config to this level

6. Namespaces & Module interface

7. CPart stdlib finalize
  - Move more of "element" into FactoryCPart
  - Finish Store, Fetch
  - Rename to component.slot
  - Finalize < slot > vs [component.slot]

8. Documentation finalize


------
# AssetCPart

  - During build step, "style" goes into a CSS file, "script" goes into JS
  - Script and Style contents in fetchQ cache output get blanked (or maybe
    replaced with newlines to preserve line numbering, or a comment explaining
    the new location)
  - Interface could have a "dedupe" and "dedupeReplace"
  - Script format:
    -
      (function (factory, Modulo, loadObj) {





          loadObj.script = {
          }); // what was return before
      })();


  - Another idea: Have "detachedFactoryCallback" as a general utility


- Think about refactoring FactoryCPart and AssetCPart each into a helper
  library, or something, to avoid too many base classes (or maybe just
  assetCPart)











------

# Broad ideas for increased code-use around CParts + templates + build

- Problem:
    - How do we structure different asset requirements? How can we make JS/CSS
      build bundles? How do CParts expose this?
    - Idea 1: CParts can implement a "exportCallback" that accumulates a JS file
    - Idea 2: This could somehow get folded into the < script > and < style >
      tag in the header idea: Basically, a CPart can export a "head depedency",
      that get inserted of the given type. Thus, building is the same as just
      summing together all "exports" or head-dependencies.
    - Idea 3: This feels like this could also somehow get folded into "fast
      reorged builds" (e.g. resurrecting factoryData)
    - Idea 4: For flat

- IDEA: When we get default attrs, refactor Style factory Callback into a
  Template that somehow implements prefixAllSelectors. The Template can be
  overridden.


- Misc cleanup: Replace all Modulo.globals.document with "ownerDocument"!

- MDU idea:
    - MTLMarkdown - A varient of MTL engine that does a "markown" conversion
      after templating but before setting component.innerHTML
    - Or maybe better yet, markdowntemplate is the CPart
    - Building on that, perhaps a way to configure markdown "handlers" for
      different types, e.g. using x-EmbedImg instead of img.
    - Could create and register custom tags using TagLex

# Ideas for better CPart development:

- Script should allow "export-as-cpart" or "cpart-name", which creates a
  one-off CPart class that can be reused

# Broad idea for increased code re-use around coniguration:

- "Configurable" base class
    - CPart, Loader, Template, ModRec, Cursor all derive from it
    - Does not get included into "CPart" lifecycle, but shares some behavior
      with CPart (can be configured with stackable defaults, has this.element
      back reference, etc)

- Misc todo item: Rename "component.children" to "component.slot", so its more
  obvious what it does
------

# Broad idea or approach to detangle various rendering issues:

- Broad idea or approach to detangle various configuration issues:
    - Use initialized/prepare + renderObj as a simple configuration system
    - Truly self-configuring
    - Directive shortcuts should be stored there too
    - TagDirective shortcuts as well (which in turn get populated by < Load >
      CPart)
    - Old todo that's relevant: Add a check somewhere for CParts to "register"
      a directive that also ensures at least one of Load, Mount, Unmount or
      Change exists for every "registered" directive
    - initializedCallback() { renderObj.component.directives.push('compiler.resolve'); }
    - Speed optimization: To prevent wasted space, need to think of a solution
      that allows each renderObj to "seem" like it can be separately modified,
      but it isn't actually (e.g. one of the old "maps", or a hashed registry
      of cached renderObjs, or something, or a "pushAndFork(arr)" or something)



- Predirectives (MOSTLY DONE!)
    - Directives that get resolved BEFORE reconciler.reconcile()
    - Maybe change the interface to support "loadString" then "reconcile"
    - The loadString step would make a fragment and then apply pre-directives
    - The predirective would be like: "directiveLoad"


- Pre-reconciler modifications
    - (see "predirectives" for a more concrete version of this)
    - The reconciler should ALWAYS attempt to reconcile the two DOMs
    - There should instead be hooks for pre-reconciler modifications to the
      generated DOM
    - This would allow [component.children] as a pre-directive: It will attach
      the "originalChildren" DOM to the fragment DOM, pre-rerender
    - This could also be used for tag namespace transformations:
        - [load.tag] could be a reconciler pre-directive
        - Tag-based directives can be triggered by certain tagnames


        - More general concept of "tagTransforms": Transform tagname into
          directive
        - This works for [component.ignore] as well:

            ignoreDirectiveLoad(node, key) {
                //const key = this.reconciler.getKey(node);
                if (this.isMounted && key in this.ignoredNodes) {
                    node.replaceWith(this.ignoredNodes[key]);
                } else {
                    this.ignoredNodes[key] = node;
                }
            }

- Give more thought to the "modulo-" prefix idea:
    - One simple way to express it is: all cases of "&lt;C" turn into
      "&lt;modulo-C"

- Thunked function / "PatchSet"
    - For render() and directives, it might make sense to "squash" functions
      into a "function set" that can run all (see older idea below about a
      possible micro-optimization for rerender())
          - E.g. instead of renderCallback()
    - If that makes sense, then perhaps merging this with the idea of "patch
      set" would help
    - They could get "nested", but keep on storing a pre-computed flattened
      version for fast speed
    - In the end, this would almost be like a mini VM thing:
        - Tightly optimize an inner loop
        - A special list format for storing a sequence of function executions
        - Each execution could be wrapped in a try/catch block
        - Could have "metadata" in a separate list 
    - Might even be useful for replacing "callback" interface with TagLoad --
      generally dereferencing since {'body': 'bodyVanish'} is repetitive
    - Note: Danger with this is hot-reloading -- needs to be easy to "refresh"

------
# Misc notes:

- Template vs template
    - Since MTL and JS are case-sensitive, "Template" could be the class, allowing
      for Template.tableRow to refer to <Template name="tableRow">
    - Lowercase "template" is the currently selected CPart instance

- Plural vs singular notes:
    - imagine the following use cases:
        - We want EVERY <load> CPart to hook onto reconciler directives
          (e.g. for multiple namespaces)
    - This is all pointing toward "squashed" callback hooks
    - This just means looking in spares as well for directive callbacks


----
# Misc notes:

- Massive performance bug:
    - http://localhost:8081/docs/templating-reference.html
    - Currently, it's doing renderas 88 times!
    - currently, it rerenders EVERY SINGLE one each time one loads, causing
      exponentially slow algos
    - Likely a bug with mws-Demo, or could be some script / scoping issue with
      Modulo

- CPart "Spares" is broken!
    - Right now, manually setting which one CPart is active is effectively
      creatinq a new type of state
    - We want some way to "choose" or bind based on actual state
    - Solution #1: "static getCurrentCPartCallback" on each CPart type
    - Solution #2: Something like "active-if:=script.shouldShow"
        - Or, make it a normal lifecycle method, e.g. "pick CPart"?
        - E.g. something like "templateSelectCallback"?
    - Solution #3: Feature of state
        - Don't change much (e.g. have spares), but leave manually swapping
          spares as a "bad practice"
        - E.g. '<template [state.choose] name="shop">'
            - By default will use state variable "template"
        - Like bind, except 1 direction, swaps spares on state change
        - Directive only can be used on CParts
    - Solution #4: Make it internally CPart-handled (?)
        - Each CPart can be either a "squasher" or a "stacker"
    - Solution #5: Remove documentation on swapping spares
        - Possibly combine above
        - Is there really any use for swapping templates, as spares are already
          used by |renderas?

- MTL: Support for "or" and "and" operators in if statements, and better
    error messages if encountering unknown conditional operators
        - Another idea: Have {% and %} and {% or %} be tags that modify the
          previous token

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

- Idea for "modulocli test" multiprocessing:
  - Create a SPA "dashboard" with a table of components & their tests
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
        - (DONE) "settingProps" as a means to squirrel away data during ssg
    - Do immediately prefixing components
    - (DONE) Work on Modulo Router
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
    - CSS bundling
    - An interesting ToDo:
        - Maybe only good for mdu, not this, but with headless browser testing +
          step-based testing, imagine the <style> tag also being for stuff like this:
            - <style user-action>
                  click button.extraBtn {
                      color: blue;
                      background: red;
                  }
              </style>
            - Basically, can be used for both triggering events, and checking
              that things are visually identifiable
            - Could have other filters as well, e.g. "color: contrast-with(var(background));"
    - Possibly change directive syntax,
        - Current has bad w3c compliance, not sure if better:
        -  __component.children__
        - ##component.children##
        - _%component.children%_

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


# -------------------

        // IDEA: Render-path micro-optimization idea:
        // - Push prebound func to list, to "pre-compute" render loop
        // - .rerender() thus is just looping through list of funcs running each



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


                // (Reason can't do for <PrivateComponents>: Requires parsing
                // HTML, since /[^>]+/ only works since we ignore attributes)
                //const regExp = /<(\/?)(body|head)([^>]*)>/gi;
                //innerHTML = innerHTML.replace(regExp, '<$1modulo-v-$2$3>');

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

- How to show off practicing different props:
    - Add another "type" of text: Preview text
    - By default, show as another pane (?)
        - Maybe to the right of the preview?
    - By default, do not allow editing
    - By default, show some other tabs (?) to select
- Could allow a show-off "auto" mode, for the front-page or other places, where
  it just cycles through different sets of props, showing the result of each
  (could look really cool with a transition!!)


-->
