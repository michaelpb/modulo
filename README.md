![](docs-src/img/mono_logo.png)

# Modulo

[modulojs.org](https://modulojs.org)

**A concise JavaScript Component framework**

- [X] About ~1000 lines of code as a thin layer over vanilla Custom Web Components
- [X] Components system inspired by React, Svelte, and Polymer
- [X] Modular with opinionated defaults and few assumptions
- [X] A "no fuss" drop-in to add JS to existing web apps


---------

## Status: `prealpha`

- **prealpha - unreleased, keep an eye on it!**
- alpha - use it if you don't mind large bugs or incomplete feature
- beta - use it if you don't mind small bugs
- release - use it, ready for general use, some small bugs may crop up, and
  some extra features may be added
- mature - use it, featureset is stable and will have no changes


## Versioning roadmap

- Prealpha / alpha: no version numbers
- Beta: 0.x.y
    - Patch releases: No documentation changes
    - Minor releases: Documentation or feature changes
    - Major releases: Backwards incompatibility


---------

# Usage

*(Full getting started guide on site: <https://modulojs.org/start.html>)*

1. Download `/src/Modulo.js` (the single file containing all of Modulo.js) to
wherever you put JS files for your website (for example, `/static/js/Modulo.js`)


2. Include in your HTML file a reference to the script:

```html
<script src="/js/Modulo.js"></script>
```


3. And finally, define a component, followed by a "Modulo.defineAll()" to
activate Modulo. For example, we can use "template", "script", and "style"
tags, to incorporate HTML, JavaScript, and CSS respectively into our component:

```html
<script src="/js/Modulo.js"></script>

<!-- Define a custom component in a "modulo-embed" -->
<template modulo-embed>
    <component name="HelloWorld">
        <template>
            Hello <strong>Modulo</strong> World!
        </template>
        <script>
            console.log('Hello Modulo JS world!');
        </script>
        <style>
            strong { color: purple; }
        </style>
    </component>
</template>

<script>Modulo.defineAll()</script>
```

4. Now, you can use and reuse your component wherever you want, just like any
normal HTML tag:

```html
<x-HelloWorld></x-HelloWorld>
<p>In a P tag: <x-HelloWorld></x-HelloWorld></p>
```


5. Want to try more? The tutorial picks up where this leaves
off starting with
[Part 1, Section 2: CParts](https://modulojs.org/docs/tutorial_part1.html#cparts)


-----

# Contributing

The best way to contribute is by trying it out: Building something with it, and
then give feedback.

## Formatting

Contributing code to the core of Modulo follows stricter than typical JS coding
standards:

- 80 char line limit (no exceptions!)
- 4 char space indentation

## Guidelines

- Do not write any clever, cool, smart, or fun code. Only boring code allowed.
- Modulo may be short & sweet, but that doesn't mean "code golf" style
  minification. Instead, keep it simple, clear, and self-documenting.
- Avoid continuing long statements onto new lines. Instead, create
  descriptively named temporary variables.
- For larger blocks of code, consider JS constructs such as `for..of` loops to
  keep the code's logical flow clear and imperitive, instead of chaining
  methods such as `.forEach` or `.map`.
- Most operations should be synchronous, so they can finish before reflow.
- Do not add any layers of callback indirection unless it is absolutely
  necessary.

