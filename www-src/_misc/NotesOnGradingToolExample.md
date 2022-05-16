Modulo - Grading Tool idea list
-----------------------------------------

- Use: Isomorphic Git - https://isomorphic-git.org/
- Start with web-browser-only based app
- Later create Taurus-based desktop app (like debug trainer)

- Architecture:

- Create Modulo component:

        <x-AutograderDashboard
            submission="{{ submission.text }}"
            rubric="{{ obligation.autograding_rubric_conf }}"
        ></x-AutograderDashboard>

- Paste in the assignment, which generates a "tabbed workspace" style
  arrangement (Maybe? Or maybe not, as the Dashboard is the thing tabbed?)
- Each tab is a panel arrangement of various "grading analysis panels" based on
  which rubric script is selected
    - E.g. iframe of xyz.github.io/abc
            - Along with checkers of URLs 404ing
    - E.g. recursive dump of file-structure tree of repo
            - Along with checkers of the existence of certain files
    - E.g. the content of certain files (syntax highlighted)
            - Along with checkers
    - E.g., for desktop version: The result of running a certain command in the
      terminal 
- These are customizable in a "rubric script"  (a JS file, maybe? or some other
  format....)
- Release as separate floss app
- BUT ALSO, integrate into LiveSyllabus
    - Obligations can have a `autograding_rubric_conf` textfield (JS? JSON?
      "rubric script")
