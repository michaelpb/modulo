
# Ideas

    eventCleanupCallback() {
        for (const name of Object.keys(this.data)) {
            Modulo.assert(name in this._oldData, 'Invalid key: state.' + name)
            if (this.boundElements[name]) {
                if (this.data[name] !== this._oldData[name]) {
                    const [el, func, evName] = this.boundElements[name];
                    el.value = value;
                }
            }
        }
        /* .-HACK, rerenders every time, should have
           v dirty state detection */
        this.element.rerender();
        this._oldData = null;
        /*
            How we can more do a more targeted approach:
                Have a "function var reference counter" utility function, that
                caches function references and guesses / does some clever stuff
                to determine a list of assignments and/or references. Then, use
                this to know which state variables to check. This might be
                overkill!
            const funcString = String(renderObj._eventFunction);
            funcString.match(/state/)
        */
    }

    /*
    eventCleanupCallbackOld() {
        for (const name of Object.keys(this.data)) {
            if (!(name in this._oldData)) {
                // clean up extra
                delete this.data[name];
                // this.set(name, null);
            } else if (this[name] !== this.data[name]) {
                this.set(name, this[name]); // update
            }
        }
        this.element.rerender(); // HACK
        // ToDo: Clean this up, maybe have data be what's returned for
        // prepareEventCallback, just like with prepareCallback?
    }
    */


- Notes on component.resolve directive:
    - elem.getAttr will NOT WORK in the long run. Why? HTML built-ins!
      While not necessary (can use templating), it's obviously an
      expected feature
    - The ONLY solution, thus, is a bit messier in terms of DOM
    - The ONLY solution is setAttribute & immediate resolution
    - So the resulting DOM for:
        <a
          href:=script.computedLink
          title:=props.title>{{ props.text }}</a>
        <a
          href:="script.computedLink"
          href="/ext/link?a=3"
          title:="props.title"
          title="Learn more about a classic book"
          >Great Expectations</a>
    - Ideally, changing the value of title:= would update in live
    - Similarly deleting it would delete title= (binding)
    - Modifying title= directly would be discouraged
    - No templating "syntactic sugar" can achieve this (eg ':=thing'
      gets replaced with '="{{ thing }}"'), since that would still not
      support updates directly from the DOM


# Some ideas on BE version:

- Overview 1
    - Same behavior / coding approach as SSG + Modulo Router
    - Start server with just running SSG into a tmp directory
        - However, maybe stripping .html extensions by default
        - This way the paths ALWAYS correspond
    - Then run static express server in front
    - Mostly just serve up HTML
    - But also allow wildcards in directory structure, eg:
        - /:username/userpage.html
        - Then all components in userpage get a prop "path-username="
        - These directories get copied over WITHOUT any SSG (?)
        - And only generate on the fly
        - OR, only if they have a certain CPart, <pathvar username></pathvar>
    - But also send over a FE script that sets up below:

- Overview 2
    - Use the same idea as Livewire / Django Unicorn / etc
    - The script CParts only run on backend
    - The script-frontend only runs frontend
        <script backend>  <!-- BACKEND / SSG -->
        </script>
        <script frontend> <!-- FRONTEND -->
        </script>

    - The state is public
    - The state CParts form a REST-bridge
        - window._moduloBeState = {
        - }

- Not good idea:
    - Idea for to load JS file and get good stack traces:
        - Step 1: Loop through window and remember all values
        - Step 2: Add as SCRIPT tag to body! (dangerously LOOSE)
        - Step 3: See what changed since Step 2, and to clean up public namespace
        - Note: On second thought, this would be really hard for < script > CPart,
          since we need to do the whole __set thing
    - Better idea than above: Catch errors, can we customize it to improve it?
      - https://javascript.info/custom-errors

# Misc ideas

directive:


    //[/\.$/, 'json'] // idea for JSON literals

# Older misc ideas

- Other component parts (CParts)
    - mod-fetch
        - Provides templates to simple APIs
        - Allow "JS free" development
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
      x7aerf-MyComponent as the rewritten references
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


