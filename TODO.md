# High priority

- Loading relative component libraries is broken, e.g. ./scratchlib4.html

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
    - See directive idea below

- ModRec & DOMCursor refactor
    - Finish detangling repetitive directives and dead code
    - Finish modulo-ignore and modulo-key
    - Fix nested subrender directives
    - Possibly: Implement new patch-set data structure


# Low priority

- Simple API for component rerender: mark isDirty on any lifecycle, and will
  always rerender
- Fix Reconciler1 tests so they run on other Node versions (they rely on an
  older "[object Object]" style toString that is inconsistent)


-----------------------------

## Modulo Config simplification / ordering idea (22-05)

- Maybe a "config" lifecycle, that comes after load, when all CParts have done
  initial registration?
- Could be for CParts that depend on seeing other CParts, e.g. that way Script
  can include all CParts regardless of order
- This could then DISCARD, by default, the loadObject, or something, meaning
  the loadObject IS the config? So something like loadObj.template.filters...
    - And then, the config
- Modulo.register could do this as well? E.g.
    - `Modulo.register(loadObj, 'template.filters', {...)`


-----------------------------

## MDU Components & CParts library thoughts


- Have src= be MTL templated with a obj in config
- That way, we can have Library src="{{ mdu }}/components/Button.html"
- And "mdu" can be the root to the MDU release tracked with this Modulo
  version, but can be updated easily with config
- IDEA: Config.template(...) -- apply as context to given template string


--------

ModDOM dev idea:

Start by making a MagicMock that just "proxies" everything, with "warnings"
when it's not found. Run in Node.js VM and put it as HTMLElement, window,
document, etc. Then, one by one eliminate warnings.

--------

Possible repo setup:

- modulo/modulo -- src/Modulo.js, www-src, tests & docs for core
- modulo/mdu -- modulocli/, mdu/cparts, mdu/html, tests & docs for mdu
- modulo/website-common -- The component libraries for x-Page, etc, so both mdu
  and modulo can share the same look! Then, mdu.modulojs.org could be the docs
  for the "MDU" Tab.

The docs for the MDU tab could even just be literally a self-generated
storybook, inside an x-Page component


## MDU FE Ideas

- UndoState CPart, as a drop-in replacement for state
    - Could use the "time travelling" Map implementations
    - Expose "undo" state.undo and state.redo
    - Could have a super simple implementation example that's like:
        - < input @change=state.save [state.bind] > (x 10 for a form)
        - < button @click=state.undo >Undo</button> (+ redo etc)
    - No custom JavaScript code! Super impressive!



## MDU FE FreezeCPart

- Generate the code for any arbitrary CPart config:

```
Modulo.cparts.mycpart = class MyCPart extends Modulo.cparts.FetchState {
    static getAttrPreset() {
        return {
            githuburl: '//', // etc
        }
    }

    static factoryCallback(partOptions, factory, renderObj) {
        // Override the factory callback to inject attrs and content
        const { factoryCallback } = Modulo.cparts.FetchState;
        const { getAttrPreset, getContentPreset } = Modulo.cparts.mycpart;
        const { attrs, content } = partOptions;
        partOptions.attrs = getAttrPreset(attrs);
        partOptions.content = getContentPreset(content);
        return factoryCallback(partOptions, factory, renderObj);
    }
}
```

- Could be a management command!
    - Could even use saveFileAs, so it could be run from the CLI conceivably
- This would allow for quickly "spinning off" FetchState, for example, into a
  re-usable "API" Component Part that is centrally maintained.
- Could have custom configs for other MDU ones, that maybe even intelligently
  auto-generate stuff. For example, Script would come out like an actual CPart,
  and in general it could attempt to produce an idomatically correct pattern
  that could be comfortably maintained going forward.


## MDU FE StaticData

- StaticData 2 - Should add a little more code to prefix, e.g. default filter
  could be:
        const key = Modulo.statics[attrs.name || attrs.src];
        if (key in Modulo.statics) {
            return Modulo.statics[key];
        }
        Modulo.statics[key] = {{ filter }};
        return Modulo.statics[key];

- State $sync:=Modulo.statics.user - Auto-refresh

## Config Directives + Modulo config

- Another idea: have "dash" prefix be for modifying config, e.g.
    '-name="Component"' or something. Maybe only for State/Props/etc, things
    that need it?
- Create a directive like "%" used at load, that sets silo'ed config based on
  path:
    - Top level: `{ "component": { "mode": "regular" } }`
    - `<Component %mode="vanish"></Component>`
    -  (turns into component.mode = "vanish" in silo'ed modulo)



## MDU CLI

- For now, focus on Puppeteer implementation, since it's most browser-similar

- Commands:
    - help
    - ssg
    - watch
    - build
    - bundle
    - postprocess
    - pregenerate
    - test
    - serve
    - servesrc

### Misc bundle improvements (MOSTLY DONE)

- Possibly: Move the innerHTML file generation to be in Modulo.js, so that
  m.build() or m.bundle() will generate a file as well
- Then, in SSG mode, it just attempts to rewrite anything with a hash in the
  filename into an absolute location, while the rest it keeps as relative
- This allows for easily hooked file generations (e.g. for
    {% thumbnail 200x200 "image.png" %} type stuff, could make
    image-x7aree.png)

- Another thing: Simpler total build structure? Have a better way to know if
  included in build, e.g. an attribute like "modulo-asset" Then, Modulo.js
  simply just collects all with the given attribute, removing it as it does so
  (everything removed gets put into an array, so it can be reapplied)
- So, build vs bundle does the same thing, the only difference is which it
  selects (e.g. "modulo-asset" marked things only, or everything)
- At the end, it generates an HTML file, possibly
- Once done with either, it also generates an HTML file

### Improvements for CLI rewrite:

- Generalize / improve global lock to prevent simultaneous SSG builds
- Generalize a "dependency" backwards to allow generate and delete to do
  partial builds



## MDU Server features

### Backend pre-rendered data

- "PREGEN Hook"
    - Allow arbitrary JS code to be registered as a prebuild step
    - Then CParts can load it
    - Should use dep system for this too, e.g.

- Auto-genned source files:
    - The only time it will be updating srcwww
- Allow for hooking into build-process for things like directory listings
    - e.g. .modulo-data.dirlisting.json
    - Have a CPart that makes this easy to access:
        - <StaticData source="dirlisting"></StaticData>
        - {% for filename, title of data.files %}<a href="{{ filename }}">Hi</a>{% endfor %}
- The goal is JS / build parity:
    - During dev, it will be a fetch
    - During build, it will be built like an asset, like anything else
- Later uses involve any BE <-> FE communication that can be prebaked
    - E.g. urls.py could be dumped into a JSON conf file, to allow named params


### Autogen notes

- AutoGenProvider is a type of middleware that has a strict ordering, and is
  set when configuring modulocli
- devserver has autogen providers available by default, but production server
  WILL NOT run them (thus, only run during development / build, to remain
  "static")
- During SSG, it will ONLY generate autogen files to --output if they are in a
  dependency somewhere else (e.g., when an autogen gets used during the build
  process will it be built by SSG)
- At their core, autogens are path matchers that only kick in if there is a 404
- Unlike Express routes / controller functions that get request info, autogen
  functions if matched are given config, along with one thing: path, relative
  to --input, and only return 1 thing: a result to be stored in the path

- There should be a globally set whitelisting regexp for them, e.g. if you have
  no need for potentially dubious ".md" -> ".html" type autogens, then you
  could whitelist /^\.autogen-/

- Uses:
    - / * * /.autogen-directory-listing.json - Directory listing of each dir root
    - /.autogen-package.json - Walking up above the input, first package.json



### Simplest hot-reloading

- If a hot-reload is needed, push to FE that its the case
- Then, State CPart (only?) should save to localStorage
- Force refresh, then check from localStorage and restore & do rerender
- That way it's always a true refresh, but state gets remembered



### Misc note on a potential ordering bug with wait()

An outer-most wait caused all dependencies in modulo-embed to fail:

    Modulo.defineAll = function defineAll() { // NEEDS REFACTOR after config stack
        const query = 'template[modulo-embed],modulo';
        for (const elem of Modulo.globals.document.querySelectorAll(query)) {
            // TODO: Should be elem.content if tag===TEMPLATE
            Modulo.globalLoader.loadString(elem.innerHTML);
        }
        //Modulo.fetchQ.wait(() => { // BREAKS! for dependencies
        //});
    };


USed the following code to debug, to figure out the "stray" check wait eats up
the queue from children check-waits. This behavior is questionable, and the
logic in checkWait should be more robust, I think.

    checkWait() {
        console.log('--------CHECKING WAIT', Object.keys(this.queue).length);
        if (Object.keys(this.queue).length === 0) {
            const { waitCallbacks } = this;
            while (waitCallbacks.length > 0) {
                waitCallbacks.shift()(); // clear while invoking
            }
            //this.waitCallbacks = [];
            //waitCallbacks.forEach(callback => callback());
            /*
            while (this.waitCallbacks.length > 0) {
                this.waitCallbacks.shift()(); // clear while invoking
            }
            */
        }
        console.log('--------DONE CHECKING WAIT', Object.keys(this.queue).length);
    }
}

