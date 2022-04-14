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

- Finish mcli rework of MDU CLI

-----------------------------


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

### Improvements for CLI rewrite:

- Generalize / improve global lock to prevent simultaneous SSG builds
- Set files to "readonly" after writing to prevent accidentally opening
  output instead of input
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

