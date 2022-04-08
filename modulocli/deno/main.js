// Note: -wasm-noinit.ts and not -wasm.ts
/*
import {
  DOMParser,
  initParser,
} from "https://deno.land/x/deno_dom/deno-dom-native.ts";
*/

import {
  DOMParser,
  initParser,
} from "https://deno.land/x/deno_dom/deno-dom-wasm-noinit.ts";

// ...and when you need Deno DOM make sure you initialize the parser...
await initParser();

const doc = new DOMParser().parseFromString(
  `
  <h1>Hello World!</h1>
  <p>Hello from <a href="https://deno.land/">Deno!</a></p>
`,
  "text/html",
);

const p = doc.querySelector("p");

console.log(p.textContent); // "Hello from Deno!"
console.log(p.childNodes[1].textContent); // "Deno!"

p.innerHTML = "DOM in <b>Deno</b> is pretty cool";
console.log(p.children[0].outerHTML); // "<b>Deno</b>"


console.log(window.eval("window.thing = 10;console.log(1000 + 'ok')"));

console.log('this is window', window.thing);

/*
const decoder = new TextDecoder("utf-8");
const data = await Deno.readFile("hello.txt");
console.log(decoder.decode(data));
*/

