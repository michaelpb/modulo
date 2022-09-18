![](www-src/img/mono_logo_percent_only.png)

# Modulo

[modulojs.org](https://modulojs.org)

**A concise JavaScript Component framework**

- [X] A single file with about 2000 lines as a thin layer over vanilla Custom Web Components
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


2. Include in your HTML file a reference to the script with a "Modulo"
attribute, which we'll fill later with component definitions:

```html
<script Modulo src="/static/js/Modulo.js">
</script>
```


3. Now, inside this embedded script tag, we can define a Modulo Component. We
can use "template", "cpart script", and "style" tags, to incorporate HTML,
JavaScript, and CSS respectively into our component:

```html
<script Modulo src="/static/js/Modulo.js">
    <Component name="HelloWorld">
        <Template>
            Hello <strong>Modulo</strong> World!
        </Template>
        <cpart Script>
            console.log('Hello Modulo JS world!');
        </cpart>
        <Style>
            strong { color: purple; }
        </Style>
    </Component>
</script>
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

