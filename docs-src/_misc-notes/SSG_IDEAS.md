How to solve ugly header problem:

The M.js bundle.

<script src="/M.js"></script>

That's the "Preloaded M.js".
- It's Modulo.js + preloads for the www-src/M.js
- It's Modulo.js + preloads + all components ever for the www/M.js

-----------

modulocli build
- Generates M.js file

about.html

<script src="/M.js"></script>
<MainPage title="About">
    <h1>Wow, this is great!</h1>
</MainPage>


Idea:
--

- SSG approach:
    - Loop through all docs-src/
    - Do not generate at first, only create
        'dependency list'
    - Basically, like this:

this.depList = {
    'docs/start.html': ['docs-src/start.html'],
    'docs/docs/tutorial.html': [
        'docs-src/docs.html',
        'docs-src/_docs/tutorial.html', // nix this actually, due to above
    ],
}

