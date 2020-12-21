Todo notes: 2020-12-20

- Before official release, make sure well tested, then re-order entire code
  base to sort by lifecycle. Then, I can do literate coding to fully document
  the entire library, for hyper well-documented code.

---

Todo notes: 2020-12-13

What works & has tests:
- Most things seem to work

What works but does not have tests:
- morphdom
- TinyTiny
- ghost-state from browser
- non-mocked browser usage in general

What's left:
- Bugs:
    - Functions are getting resolved incorrectly. (Has skipped test) Need to
      generalize around "resolved attributes", and determine which renderObj is
      relevant at render time (that is, correctly determine render context
      component). See TODO in code. Maybe back to the render stack system (?)
- Nice to haves:
    - Break Ghost and all DEBUG code off into it's own file
    - Possibly move core DeepMap etc into own file
    - Modulo-debug.js?
    - Allow loading from files for ComponentParts using src
    - Refactor factoryMiddleware and logic around these
- Main focus
    - Build homepage to think about main focus / pros/cons
        - "JS-free developent" (like TurboLinks etc)
        - embeded turoials
- Other component parts (CParts)
    - mod-fetch
        - Provides templates to simple APIs
        - Allow "JS free" development
    - mod-router
        - Provide logic for routnig to other CPart e.g. templates
    - mod-canvas
        - For graphical things, e.g. games, paint apps, etc
        - Allow some other structure of content?
    - mod-api-whatever
        - Specific "API" CParts, one for each popular API
        - Allow things like giphy.lastSearch
    - This one would be useful: `<mod-native>`
        - Have same JS logic, props, state, but native display (and separate
          iOS / android)
    - mod-form
        - Provide form serialization, submission utils?
- Tooling
    - Create build conf for project (maybe using rollup or another one instead
      of webpack?)
    - Bundle ideas:
        - Modulus.minimal.js -- Just Modulo.Component and Modulo.Loader etc
        - Modulus.core.js -- Core only (all adaptors, and Backtick and none as
                             default settings)
        - Modulus.standard.js -- Includes DEBUG, all parts & default
                                 middleware, TinyTiny, morphdom
        - Modulus.extra.js -- Any extra stuff?
- Hot reloading
    - Hash components -- Come up with JSON-alphabetical (if it doesn't
      already exist) and then hash the JSON file and truncate to 8
      digits
    - In the final built copy, maybe do something like
      MyComponent-x7aerf as the rewritten references
    - Idea
      - On front-end, every time Loader loads something, it should
        fetch or say on WebSocket "Loaded /static/whatevs.js"
      - The server then searches for that file based on suffix (e.g.
        starts by finding all whatevs.js, then sorts them by suffix
        similarity, e.g. djangoapps/mystuff/static/whatevs.js wins
        against other/cache/whatevs.js)
      - The server starts watching that file
      - When its saved, it sends signal to loader, telling it to
        reload & refresh that file
      - POSSIBLY: Runs a parallel loader on the backend, and diffs the
        resulting hash

- Tooling
- Low prio:
    - Write some very simple CSS or HTML lexers

