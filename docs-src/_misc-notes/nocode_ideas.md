# ModuloCMS

- "X for Y" pitch: "NetlifyCMS for No-Code"

- Why is this a better No-Code pitch than most?
    - FOSS / clean code to make devs happy
    - "Builds up" from low buy-in dev tools
        - The opposite of other approaches that start with no-code and build
          backward (eg high buy-in dev tools are added later)
    - Modulo SSG concepts are very simple
        - One of the few SSG systems that truly "scales up" from a static
          hand-managed pages, much like "PHP golden age"
        - The SSG 1:1 correspondance is great for NoCode, much easier for
          beginners and requires only file management info to control routes
        - Quite useful as-is without any JS
    - Extremely declarative syntax using well-known languages (HTML as a
      non-strict XML conf)
    - CParts are good encapsulation for this
        - Allow for hiding imperative, OOP, or functional coding styles, which
          are less 1:1 for No-Code, to declarative, which is the preferred
          style for Godot / Unreal / Unity etc (low-code design tools)
        - CParts could eventually build up an API library similar to Zapier
    - Entire SSG sites could be plugged in with few deps
        - The "No-Code" solution would feel a lot like CPanel, only better
        - Imagine if "/modulo-forum/" was a repo that could be forked & added


- Basically, a drop-in CMS that is for managing components & composing HTML
  files

- Has a "scratch" drag & drop style -- CParts would work great for this

- Use a good build of CKEditor for normal HTML files

- Main area would either show a normal editor (Plaintext), or "As Tabs"  or "As
  Panes" (basically breaking up each CPart definition into separate editor)
    - CParts could register custom editors (very "Scroll Project"-ish)
    - Style could have hints for all CSS properties, for example (find nice
      pre-built style editor)

- Designer features:
    - Create "Storybook"-style auto-documentation
    - As you enumerate properties, auto-generates examples
    - Can create "Scenarios":
        - Scenarios have "pluggable" spots, e.g. "Button goes here"
        - This would allow previewing as you design with more complicated
          arrangements

- Content team features:
    - WYSIWYG editor, block-based
    - Components appear within CKE menu bar
    - NetlifyCMS-style git login

- Goal: Work for the following people:
    - Developers:
        - It's all plain HTML, CSS, and Modulo / JS code
        - Can develop CParts that they expose to designers
    - Designers / component devs:
        - Can create & test component libraries directly
        - Can do no-code hook-ups of basic components
        - Can do no-code hook-ups of CParts
        - Less back & forth between design & FE dev team
    - Content:
        - Should be as easy as NetlifyCMS (or even easier!)
        - 1:1 parity between source code and URL structure is much easier to
          reason with

- Default CPart editor:
    - Value setting a la Godot or Unreal for attrs
    - HTML (CKEDitor) for content
    - Configure CKE to have MTL template variables, tags, blocks, with textual
      descriptions


Mockup:


         (branches / file nav)   (editor tab(s))          (flipped preview)
         ______    _____      |  ____________           |    _________
        | main |__|_dev_|_____|_|x-HelloWorld|__________|___|Preview  |________
        src-www/              | _________   ______      |
          - library.html      ||template | |script|     | |Preview settings: |props | state|
              - x-HelloWorld  |                         |
              - x-Button      |                         | |Save as example...|
          - home.html         |                         |
          - start.html        |                         |



