
# More notes: 2021 (later)

- Main next steps:
    - (DONE) Remove ".name"
    - (DONE) Do cparts.state vs state conversion
    - (DONE-ish) Work on "Live Code Preview" component for examples
    - (DONE) Misc must have features:
        - Cache for components in localStorage
        - (DONE) "settingProps" as a means to squirrel away data during ssg
    - Do immediately prefixing components
    - Work on Modulo Router
    - MTL: Support for "or" and "and" operators in if statements, and better
      error messages if encountering unknown conditional operators
    - ERROR: On GitHub API search, key= doesn't work to keep input focus
      between renders, if a new element is introduced above it. Need to debug
      SET DOM how it uses key.
    - Linting Rules!!

- Code quality idea: Max cyclomatic complexity
    - (Can be configured via linting?)
    - Currently only collectDirectives (7) and "anon method-18" (6) violate
      this

- Idea for template selection:
    - Last template always wins (right now)
    - All cparts get stored in a list. Simply assign cparts.template to
      something else!

- Idea for solving inheritance / libraries / composition etc:
    - < library name="GoodTemplates" > .. identical to components, except will
      not get registered, just stored in global vars
    - Stored globally so we can then do < load template from="GoodTemplates">
    - or < template load-from="GoodTemplates">


- Idea for configuring cparts from within script tag:
    - Set already-constructed cparts in script before running script
    - Allow global / static code like such:
    - < script >
    -   template.addFilter('asOrdinal', s => s === 1 ? '1st' : s + 'th')
    -   or template.filters.asOrdinal = ... etc
    -   OR have someting like factory.configure('template', 'filters', ...)
    - (best, since should be static/factory, thus passed in at time of Function)

- Idea for Modulo Router
    - Could make easier to develop navbar
    - Detect if in SSG step:
        - If not, then use fragment style routing + fetch (for simplicity)
        - If in SSG step, provide an external escape hatch in SSG that allows
          for writing to multiple files. Then loop through each named URL,
          generating a new file, maybe like... index__my-stuff.html
            - Exact mechanics:
                - mdu-Link would be fairly simplistic
                - mdu-Route would house most of the logic
                - mdu-Route would also set something globally so that mdu-Link
                  can look different if necessary (using class-if-active)
        - This would be extremely useful, and basically make the SSG 100x more
          useful

      <nav>
          <mdu-Link target="my-stuff" class="cool" class-if-active="active">
            Check out my stuff
          </mdu-Link>
      </nav>

      <main>
          <mdu-Route
              name="my-stuff"
              src="./content/relevant_my_stuff_content.html"
          ></mdu-Route>

          <mdu-Route
              name="blog-posts-and-stuff"
              src="./content/blog_post.md"
          ></mdu-Route>
      </main>


- Ideas & untested code on inheritance:

        // ## Loader: loadFromDOMElement
        /*
          Two other ideas:
          - Create a CPart that handles inheritance / composition:

            <inherits state from lib-CoolThing></inherits>
            <inherits>lib-CoolThing</inherits>
            <parent is lib-CoolThing></parent>
            (Then we'd get parent.XYZ syntax for free!)

          - Only have extends on a per-CPart basis. So,

            <state inherits from lib-CoolThing></state>
            <template inherits from lib-CoolThing></template>
        */

        /* Untested TODO: Change this.componentFactoryData to be a map, also,
                 refactor this mess in general
        const extend = attrs['extends'];
        if (extend) {
            for (const [name, data] of this.componentFactoryData) {
                if (name === extend) {
                    for (const key of Object.keys(data)) {
                        loadingObj[name] = [data[key]];
                    }
                }
            }
        }
        */





# More notes: 2021

- Replace all mention of 'options' with 'attrs' or something equally consistent
  / accurate

- Uniquely identifying components:
    - component-hash: a7efa90
    - mutation-hash: 1a3a4f9
    - mutation-hash: 0000000 # for immutable, or initial state
    - mutation-hash is only implemented for State CPart

- Skypack "ecosystem" for example deployment:
    - https://www.skypack.dev/

- SSG: (DONE)
    - Possibly make (undocumented) SSG based on jsdom and existing domUtils.
    - Use that to template the site.
    - Usage example:
        modulo-ssg ./docs-src output=docs/ --markdown=lib-Markdown
    - Will copy everything, templating HTML files, and handle anything of
      --xyz= type with the given component
    - Ex:

      <component name="Markdown">
        <template>
            {{ text|markdown }}
        </template>
        <props
            text:=String
        ></props>
        <script>
        </script>
      </component>



---

(DONE) Ideas for unifying renderObj etc:

- Template render context and script context has 2 things:
    - cparts.XYZ --- the OOP version with bound methods
    - XYZ --- the plain object version
    - What that means for each:
        - state
            - cparts.state -- has "set" "get" "bindMount" etc
            - state -- simple object with state, in callbakc will check this
              for mutations after each event
        - script
            - cparts.script -- used to set or modify private values
            - script -- object with all exported values
        - props
            - cparts.props -- no real use
            - props -- simple object with resolved props
        - style
            - cparts.style -- no use
            - style -- no use
        - template
            - cparts.template -- can be used to render, select which is active
            - template -- holds last rendered

- CParts then could return values if they want to be replace the bare symbol in
  the renderObj, or NOT if they don't want to, in which case the default is the
  resolved attrs of the CPart definition
    - If anything other than undefined is returned by any lifecycle method,
      then that's used for the renderObj
    - Otherwise, the post-factory, automatically resolved attributes are
      available (automatically squashed)


