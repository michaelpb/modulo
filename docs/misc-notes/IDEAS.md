

# Ideas


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
