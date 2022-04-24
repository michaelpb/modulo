# High priority

- Finish bundle()

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

- ModRec & DOMCursor refactor
    - Finish detangling repetitive directives and dead code
    - Finish modulo-ignore and modulo-key
    - Fix nested subrender directives
    - Possibly: Implement new patch-set data structure


# Low priority

- Fix Reconciler1 tests so they run on other Node versions (they rely on an
  older "[object Object]" style toString that is inconsistent)

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

### Misc bundle improvements

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
        - <Data source="dirlisting"></Data>
        - {% for filename, title of data.files %}<a href="{{ filename }}">Hi</a>{% endfor %}
- The goal is JS / build parity:
    - During dev, it will be a fetch
    - During build, it will be built like an asset, like anything else
- Later uses involve any BE <-> FE communication that can be prebaked
    - E.g. urls.py could be dumped into a JSON conf file, to allow named params


### Simplest hot-reloading

- If a hot-reload is needed, push to FE that its the case
- Then, State CPart (only?) should save to localStorage
- Force refresh, then check from localStorage and restore & do rerender
- That way it's always a true refresh, but state gets remembered

