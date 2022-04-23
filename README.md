![](www-src/img/mono_logo_percent_only.png)

# Modulo

[modulojs.org](https://modulojs.org)

**A concise JavaScript Component framework**

- [X] A single file with less than 2000 lines as a thin layer over vanilla Custom Web Components
- [X] Components system inspired by React, Svelte, and Polymer
- [X] Modular with opinionated defaults and few assumptions
- [X] A "no fuss" drop-in to add JS to existing web apps


- **Status**: `prealpha` *(unreleased, but keep an eye on it!)*


-----

# Quick start

Full getting started guide on Modulo's website: <https://modulojs.org/start.html>

Modulo is a small framework for creating custom Web Components: Reusable
snippets of HTML, CSS, and JavaScript that create new HTML-like tags that can
be used and reused anywhere on your site. Under the hood, it uses a widely
compatible subset of the [customElements API](https://caniuse.com/custom-elementsv1).
To get started with creating a custom component, do the following 3 steps:

1. Download [src/Modulo.js](https://github.com/michaelpb/modulo/blob/main/src/Modulo.js)
(the single file that contains all of Modulo) to wherever you put JS files for
your website (for example, `/static/js/Modulo.js`)


2. Include in your HTML file a reference to the script, followed by a
"modulo-embed", which we'll fill later with component definitions, and finally
followed by a `Modulo.defineAll()` to activate Modulo:

```html
<script src="/static/js/Modulo.js"></script>

<template modulo-embed>
</template>

<script>Modulo.defineAll()</script>
```


3. Now, in this "modulo-embed", we can define our first component. We can use
"template", "script", and "style" tags, to incorporate HTML, JavaScript, and
CSS respectively into our component:

```html
<script src="/static/js/Modulo.js"></script>

<template modulo-embed>
    <Component name="HelloWorld">
        <Template>
            Hello <strong>Modulo</strong> World!
        </Template>
        <Script>
            console.log('Hello Modulo JS world!');
        </Script>
        <Style>
            strong { color: purple; }
        </Style>
    </Component>
</template>

<script>Modulo.defineAll()</script>
```

Now, you can use and reuse your component wherever you want, just like any
normal HTML tag:

```html
<x-HelloWorld></x-HelloWorld>
<p>In a P tag: <x-HelloWorld></x-HelloWorld></p>
```


* **Continue?** Want to try more? The tutorial picks up where this leaves off
  starting with
[Part 1, Section 2: CParts](https://modulojs.org/docs/tutorial_part1.html#cparts)


-----

## License

(C) 2022 - Michael Bethencourt

[LGPL-2.1](https://github.com/michaelpb/modulo/blob/main/LICENSE)

