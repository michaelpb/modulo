![](docs-src/img/mono_logo.png)

# Modulo

[modulojs.org](https://modulojs.org)

**A tiny JavaScript UI framework**

- [X] <1000 lines of code as a thin layer over vanilla Web Components
- [X] Components system inspired by React, Svelte, and Polymer
- [X] Modular with opinionated defaults and few assumptions
- [X] A "no fuss" drop-in to add JS to existing web apps


---------

## Status: prealpha

- **prealpha - keep an eye on it!**
- alpha - use it if you don't mind large bugs or incomplete feature
- beta - use it if you don't mind small bugs
- release - use it, ready for general use, some small bugs may crop up, and
  some extra features may be added
- mature - use it, featureset is stable and will have no changes




# Contributing

The best way to contribute is by trying it out: Building something with it, and
giving feedback.

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
- For larger blocks of code, consider JS constructs such as `for..of` loops
  to keep the code's logical flow clear and imperitive, instead of chaining
  methods such as `.forEach` or `.map`.
- Most operations should be synchronous, so they can finish before reflow.
- Do not add any layers of callback indirection unless it is necessary.

