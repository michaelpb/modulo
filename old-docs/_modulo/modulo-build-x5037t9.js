Modulo.assets.functions["1125s79"]= function (CTX, G){
var OUT=[];
OUT.push("\nHello <strong>Modulo</strong> World!\n<p class=\"neat\">Any HTML can be here!</p>\n"); // "Hello <strong>Modulo</strong> World!\n<p class=\"neat\">Any HTML can be here!</p>"

return OUT.join("");
};Modulo.assets.functions["11ctt4u"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <form>\n        "); // "<form>"
var ARR0=CTX.state.fields;for (var KEY in ARR0) {CTX. field=ARR0[KEY]; // "for field in state.fields"
OUT.push("\n            <div class=\"field-pair\">\n                <label for=\""); // "<div class=\"field-pair\">\n                <label for=\""
OUT.push(G.escapeText(CTX.field)); // "field"
OUT.push("_"); // "_"
OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
OUT.push("\">\n                    <strong>"); // "\">\n                    <strong>"
OUT.push(G.escapeText(G.filters["capfirst"](CTX.field))); // "field|capfirst"
OUT.push(":</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type='"); // ":</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type='"
if (G.filters["type"](G.filters["get"](CTX.state,CTX.field)) === "string") { // "if state|get:field|type == \"string\""
OUT.push("text"); // "text"
} else { // "else"
OUT.push("checkbox"); // "checkbox"
} // "endif"
OUT.push("'\n                    name=\""); // "'\n                    name=\""
OUT.push(G.escapeText(CTX.field)); // "field"
OUT.push("\"\n                    id=\""); // "\"\n                    id=\""
OUT.push(G.escapeText(CTX.field)); // "field"
OUT.push("_"); // "_"
OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
OUT.push("\"\n                />\n            </div>\n        "); // "\"\n                />\n            </div>"
} // "endfor"
OUT.push("\n    </form>\n"); // "</form>"

return OUT.join("");
};Modulo.assets.functions["13lid16"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function toggle([ i, j ]) {
        if (!state.cells[i]) {
            state.cells[i] = {};
        }
        state.cells[i][j] = !state.cells[i][j];
    }

    function play() {
        state.playing = true;
        setTimeout(() => {
            if (state.playing) {
                updateNextFrame();
                element.rerender(); // manually rerender
                play(); // cue next frame
            }
        }, 2000 / state.speed);
    }

    function pause() {
        state.playing = false;
    }

    function clear() {
        state.cells = {};
    }

    function randomize() {
        for (const i of script.exports.range) {
            for (const j of script.exports.range) {
                if (!state.cells[i]) {
                    state.cells[i] = {};
                }
                state.cells[i][j] = (Math.random() > 0.5);
            }
        }
    }

    // Helper function for getting a cell from data
    const get = (i, j) => Boolean(state.cells[i] && state.cells[i][j]);
    function updateNextFrame() {
        const nextData = {};
        for (const i of script.exports.range) {
            for (const j of script.exports.range) {
                if (!nextData[i]) {
                    nextData[i] = {};
                }
                const count = countNeighbors(i, j);
                nextData[i][j] = get(i, j) ?
                    (count === 2 || count === 3) : // stays alive
                    (count === 3); // comes alive
            }
        }
        state.cells = nextData;
    }

    function countNeighbors(i, j) {
        const neighbors = [get(i - 1, j), get(i - 1, j - 1), get(i, j - 1),
                get(i + 1, j), get(i + 1, j + 1), get(i, j + 1),
                get(i + 1, j - 1), get(i - 1, j + 1)];
        return neighbors.filter(v => v).length;
    }
    script.exports.range = Array.from({length: 24}, (x, i) => i);

return { "toggle": typeof toggle !== "undefined" ? toggle : undefined,
"play": typeof play !== "undefined" ? play : undefined,
"pause": typeof pause !== "undefined" ? pause : undefined,
"clear": typeof clear !== "undefined" ? clear : undefined,
"randomize": typeof randomize !== "undefined" ? randomize : undefined,
"updateNextFrame": typeof updateNextFrame !== "undefined" ? updateNextFrame : undefined,
"countNeighbors": typeof countNeighbors !== "undefined" ? countNeighbors : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["13pul53"]= function (CTX, G){
var OUT=[];
OUT.push("\n        <a @click:=\"script.makeError\">Click me to cause a traceback</a>\n        <a @click:=\"script.countUp\">Click me to count: "); // "<a @click:=\"script.makeError\">Click me to cause a traceback</a>\n        <a @click:=\"script.countUp\">Click me to count:"
OUT.push(G.escapeText(CTX.state.num)); // "state.num"
OUT.push("</a>\n\n        "); // "</a>"
if (CTX.state.num > 3) { // "if state.num gt 3"
OUT.push("\n            "); // ""
OUT.push(G.escapeText(G.filters["brokenFilter"](CTX.state.num))); // "state.num|brokenFilter"
OUT.push("\n        "); // ""
} // "endif"
OUT.push("\n    "); // ""

return OUT.join("");
};Modulo.assets.functions["150k820"]= function (CTX, G){
var OUT=[];
OUT.push("\n\n    <!-- Note that even with custom components, core properties like \"style\"\n        are available, making CSS variables a handy way of specifying style\n        overrides. -->\n    <x-DemoChart\n        data:=state.data\n        animated:=true\n        style=\"\n            --align: center;\n            --speed: "); // "<!-- Note that even with custom components, core properties like \"style\"\n        are available, making CSS variables a handy way of specifying style\n        overrides. -->\n    <x-DemoChart\n        data:=state.data\n        animated:=true\n        style=\"\n            --align: center;\n            --speed:"
OUT.push(G.escapeText(CTX.state.anim)); // "state.anim"
OUT.push(";\n        \"\n    ></x-DemoChart>\n\n    <p>\n        "); // ";\n        \"\n    ></x-DemoChart>\n\n    <p>"
if (!(CTX.state.playing)) { // "if not state.playing"
OUT.push("\n            <button @click:=script.play alt=\"Play\">&#x25B6;  tick: "); // "<button @click:=script.play alt=\"Play\">&#x25B6;  tick:"
OUT.push(G.escapeText(CTX.state.tick)); // "state.tick"
OUT.push("</button>\n        "); // "</button>"
} else { // "else"
OUT.push("\n            <button @click:=script.pause alt=\"Pause\">&#x2016;  tick: "); // "<button @click:=script.pause alt=\"Pause\">&#x2016;  tick:"
OUT.push(G.escapeText(CTX.state.tick)); // "state.tick"
OUT.push("</button>\n        "); // "</button>"
} // "endif"
OUT.push("\n    </p>\n\n    "); // "</p>"
var ARR0=CTX.script.exports.properties;for (var KEY in ARR0) {CTX. name=ARR0[KEY]; // "for name in script.exports.properties"
OUT.push("\n        <label>"); // "<label>"
OUT.push(G.escapeText(G.filters["capfirst"](CTX.name))); // "name|capfirst"
OUT.push(":\n            <input [state.bind]\n                name=\""); // ":\n            <input [state.bind]\n                name=\""
OUT.push(G.escapeText(CTX.name)); // "name"
OUT.push("\"\n                type=\"range\"\n                min=\"1\" max=\"20\" step=\"1\" />\n        </label>\n    "); // "\"\n                type=\"range\"\n                min=\"1\" max=\"20\" step=\"1\" />\n        </label>"
} // "endfor"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["15q41kr"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function isValid({ year, month, day }) {
        month--; // Months are zero indexed
        const d = new Date(year, month, day);
        return d.getMonth() === month && d.getDate() === day && d.getFullYear() === year;
    }
    function next(part) {
        state[part]++;
        if (!isValid(state)) { // undo if not valid
            state[part]--;
        }
    }
    function previous(part) {
        state[part]--;
        if (!isValid(state)) { // undo if not valid
            state[part]++;
        }
    }

return { "isValid": typeof isValid !== "undefined" ? isValid : undefined,
"next": typeof next !== "undefined" ? next : undefined,
"previous": typeof previous !== "undefined" ? previous : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["16ailbv"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <p>Trying out the button...</p>\n    <x-ExampleBtn\n        label=\"Button Example\"\n        shape=\"square\"\n    ></x-ExampleBtn>\n\n    <p>Another button...</p>\n    <x-ExampleBtn\n        label=\"Example 2: Rounded\"\n        shape=\"round\"\n    ></x-ExampleBtn>\n"); // "<p>Trying out the button...</p>\n    <x-ExampleBtn\n        label=\"Button Example\"\n        shape=\"square\"\n    ></x-ExampleBtn>\n\n    <p>Another button...</p>\n    <x-ExampleBtn\n        label=\"Example 2: Rounded\"\n        shape=\"round\"\n    ></x-ExampleBtn>"

return OUT.join("");
};Modulo.assets.functions["16lf05u"]= function (){
return [
  {
    "userId": 1,
    "id": 1,
    "title": "delectus aut autem",
    "completed": false
  },
  {
    "userId": 1,
    "id": 2,
    "title": "quis ut nam facilis et officia qui",
    "completed": false
  },
  {
    "userId": 1,
    "id": 3,
    "title": "fugiat veniam minus",
    "completed": false
  },
  {
    "userId": 1,
    "id": 4,
    "title": "et porro tempora",
    "completed": true
  },
  {
    "userId": 1,
    "id": 5,
    "title": "laboriosam mollitia et enim quasi adipisci quia provident illum",
    "completed": false
  },
  {
    "userId": 1,
    "id": 6,
    "title": "qui ullam ratione quibusdam voluptatem quia omnis",
    "completed": false
  },
  {
    "userId": 1,
    "id": 7,
    "title": "illo expedita consequatur quia in",
    "completed": false
  },
  {
    "userId": 1,
    "id": 8,
    "title": "quo adipisci enim quam ut ab",
    "completed": true
  },
  {
    "userId": 1,
    "id": 9,
    "title": "molestiae perspiciatis ipsa",
    "completed": false
  },
  {
    "userId": 1,
    "id": 10,
    "title": "illo est ratione doloremque quia maiores aut",
    "completed": true
  },
  {
    "userId": 1,
    "id": 11,
    "title": "vero rerum temporibus dolor",
    "completed": true
  },
  {
    "userId": 1,
    "id": 12,
    "title": "ipsa repellendus fugit nisi",
    "completed": true
  },
  {
    "userId": 1,
    "id": 13,
    "title": "et doloremque nulla",
    "completed": false
  },
  {
    "userId": 1,
    "id": 14,
    "title": "repellendus sunt dolores architecto voluptatum",
    "completed": true
  },
  {
    "userId": 1,
    "id": 15,
    "title": "ab voluptatum amet voluptas",
    "completed": true
  },
  {
    "userId": 1,
    "id": 16,
    "title": "accusamus eos facilis sint et aut voluptatem",
    "completed": true
  },
  {
    "userId": 1,
    "id": 17,
    "title": "quo laboriosam deleniti aut qui",
    "completed": true
  },
  {
    "userId": 1,
    "id": 18,
    "title": "dolorum est consequatur ea mollitia in culpa",
    "completed": false
  },
  {
    "userId": 1,
    "id": 19,
    "title": "molestiae ipsa aut voluptatibus pariatur dolor nihil",
    "completed": true
  },
  {
    "userId": 1,
    "id": 20,
    "title": "ullam nobis libero sapiente ad optio sint",
    "completed": true
  },
  {
    "userId": 2,
    "id": 21,
    "title": "suscipit repellat esse quibusdam voluptatem incidunt",
    "completed": false
  },
  {
    "userId": 2,
    "id": 22,
    "title": "distinctio vitae autem nihil ut molestias quo",
    "completed": true
  },
  {
    "userId": 2,
    "id": 23,
    "title": "et itaque necessitatibus maxime molestiae qui quas velit",
    "completed": false
  },
  {
    "userId": 2,
    "id": 24,
    "title": "adipisci non ad dicta qui amet quaerat doloribus ea",
    "completed": false
  },
  {
    "userId": 2,
    "id": 25,
    "title": "voluptas quo tenetur perspiciatis explicabo natus",
    "completed": true
  },
  {
    "userId": 2,
    "id": 26,
    "title": "aliquam aut quasi",
    "completed": true
  },
  {
    "userId": 2,
    "id": 27,
    "title": "veritatis pariatur delectus",
    "completed": true
  },
  {
    "userId": 2,
    "id": 28,
    "title": "nesciunt totam sit blanditiis sit",
    "completed": false
  },
  {
    "userId": 2,
    "id": 29,
    "title": "laborum aut in quam",
    "completed": false
  },
  {
    "userId": 2,
    "id": 30,
    "title": "nemo perspiciatis repellat ut dolor libero commodi blanditiis omnis",
    "completed": true
  },
  {
    "userId": 2,
    "id": 31,
    "title": "repudiandae totam in est sint facere fuga",
    "completed": false
  },
  {
    "userId": 2,
    "id": 32,
    "title": "earum doloribus ea doloremque quis",
    "completed": false
  },
  {
    "userId": 2,
    "id": 33,
    "title": "sint sit aut vero",
    "completed": false
  },
  {
    "userId": 2,
    "id": 34,
    "title": "porro aut necessitatibus eaque distinctio",
    "completed": false
  },
  {
    "userId": 2,
    "id": 35,
    "title": "repellendus veritatis molestias dicta incidunt",
    "completed": true
  },
  {
    "userId": 2,
    "id": 36,
    "title": "excepturi deleniti adipisci voluptatem et neque optio illum ad",
    "completed": true
  },
  {
    "userId": 2,
    "id": 37,
    "title": "sunt cum tempora",
    "completed": false
  },
  {
    "userId": 2,
    "id": 38,
    "title": "totam quia non",
    "completed": false
  },
  {
    "userId": 2,
    "id": 39,
    "title": "doloremque quibusdam asperiores libero corrupti illum qui omnis",
    "completed": false
  },
  {
    "userId": 2,
    "id": 40,
    "title": "totam atque quo nesciunt",
    "completed": true
  },
  {
    "userId": 3,
    "id": 41,
    "title": "aliquid amet impedit consequatur aspernatur placeat eaque fugiat suscipit",
    "completed": false
  },
  {
    "userId": 3,
    "id": 42,
    "title": "rerum perferendis error quia ut eveniet",
    "completed": false
  },
  {
    "userId": 3,
    "id": 43,
    "title": "tempore ut sint quis recusandae",
    "completed": true
  },
  {
    "userId": 3,
    "id": 44,
    "title": "cum debitis quis accusamus doloremque ipsa natus sapiente omnis",
    "completed": true
  },
  {
    "userId": 3,
    "id": 45,
    "title": "velit soluta adipisci molestias reiciendis harum",
    "completed": false
  },
  {
    "userId": 3,
    "id": 46,
    "title": "vel voluptatem repellat nihil placeat corporis",
    "completed": false
  },
  {
    "userId": 3,
    "id": 47,
    "title": "nam qui rerum fugiat accusamus",
    "completed": false
  },
  {
    "userId": 3,
    "id": 48,
    "title": "sit reprehenderit omnis quia",
    "completed": false
  },
  {
    "userId": 3,
    "id": 49,
    "title": "ut necessitatibus aut maiores debitis officia blanditiis velit et",
    "completed": false
  },
  {
    "userId": 3,
    "id": 50,
    "title": "cupiditate necessitatibus ullam aut quis dolor voluptate",
    "completed": true
  },
  {
    "userId": 3,
    "id": 51,
    "title": "distinctio exercitationem ab doloribus",
    "completed": false
  },
  {
    "userId": 3,
    "id": 52,
    "title": "nesciunt dolorum quis recusandae ad pariatur ratione",
    "completed": false
  },
  {
    "userId": 3,
    "id": 53,
    "title": "qui labore est occaecati recusandae aliquid quam",
    "completed": false
  },
  {
    "userId": 3,
    "id": 54,
    "title": "quis et est ut voluptate quam dolor",
    "completed": true
  },
  {
    "userId": 3,
    "id": 55,
    "title": "voluptatum omnis minima qui occaecati provident nulla voluptatem ratione",
    "completed": true
  },
  {
    "userId": 3,
    "id": 56,
    "title": "deleniti ea temporibus enim",
    "completed": true
  },
  {
    "userId": 3,
    "id": 57,
    "title": "pariatur et magnam ea doloribus similique voluptatem rerum quia",
    "completed": false
  },
  {
    "userId": 3,
    "id": 58,
    "title": "est dicta totam qui explicabo doloribus qui dignissimos",
    "completed": false
  },
  {
    "userId": 3,
    "id": 59,
    "title": "perspiciatis velit id laborum placeat iusto et aliquam odio",
    "completed": false
  },
  {
    "userId": 3,
    "id": 60,
    "title": "et sequi qui architecto ut adipisci",
    "completed": true
  },
  {
    "userId": 4,
    "id": 61,
    "title": "odit optio omnis qui sunt",
    "completed": true
  },
  {
    "userId": 4,
    "id": 62,
    "title": "et placeat et tempore aspernatur sint numquam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 63,
    "title": "doloremque aut dolores quidem fuga qui nulla",
    "completed": true
  },
  {
    "userId": 4,
    "id": 64,
    "title": "voluptas consequatur qui ut quia magnam nemo esse",
    "completed": false
  },
  {
    "userId": 4,
    "id": 65,
    "title": "fugiat pariatur ratione ut asperiores necessitatibus magni",
    "completed": false
  },
  {
    "userId": 4,
    "id": 66,
    "title": "rerum eum molestias autem voluptatum sit optio",
    "completed": false
  },
  {
    "userId": 4,
    "id": 67,
    "title": "quia voluptatibus voluptatem quos similique maiores repellat",
    "completed": false
  },
  {
    "userId": 4,
    "id": 68,
    "title": "aut id perspiciatis voluptatem iusto",
    "completed": false
  },
  {
    "userId": 4,
    "id": 69,
    "title": "doloribus sint dolorum ab adipisci itaque dignissimos aliquam suscipit",
    "completed": false
  },
  {
    "userId": 4,
    "id": 70,
    "title": "ut sequi accusantium et mollitia delectus sunt",
    "completed": false
  },
  {
    "userId": 4,
    "id": 71,
    "title": "aut velit saepe ullam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 72,
    "title": "praesentium facilis facere quis harum voluptatibus voluptatem eum",
    "completed": false
  },
  {
    "userId": 4,
    "id": 73,
    "title": "sint amet quia totam corporis qui exercitationem commodi",
    "completed": true
  },
  {
    "userId": 4,
    "id": 74,
    "title": "expedita tempore nobis eveniet laborum maiores",
    "completed": false
  },
  {
    "userId": 4,
    "id": 75,
    "title": "occaecati adipisci est possimus totam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 76,
    "title": "sequi dolorem sed",
    "completed": true
  },
  {
    "userId": 4,
    "id": 77,
    "title": "maiores aut nesciunt delectus exercitationem vel assumenda eligendi at",
    "completed": false
  },
  {
    "userId": 4,
    "id": 78,
    "title": "reiciendis est magnam amet nemo iste recusandae impedit quaerat",
    "completed": false
  },
  {
    "userId": 4,
    "id": 79,
    "title": "eum ipsa maxime ut",
    "completed": true
  },
  {
    "userId": 4,
    "id": 80,
    "title": "tempore molestias dolores rerum sequi voluptates ipsum consequatur",
    "completed": true
  },
  {
    "userId": 5,
    "id": 81,
    "title": "suscipit qui totam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 82,
    "title": "voluptates eum voluptas et dicta",
    "completed": false
  },
  {
    "userId": 5,
    "id": 83,
    "title": "quidem at rerum quis ex aut sit quam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 84,
    "title": "sunt veritatis ut voluptate",
    "completed": false
  },
  {
    "userId": 5,
    "id": 85,
    "title": "et quia ad iste a",
    "completed": true
  },
  {
    "userId": 5,
    "id": 86,
    "title": "incidunt ut saepe autem",
    "completed": true
  },
  {
    "userId": 5,
    "id": 87,
    "title": "laudantium quae eligendi consequatur quia et vero autem",
    "completed": true
  },
  {
    "userId": 5,
    "id": 88,
    "title": "vitae aut excepturi laboriosam sint aliquam et et accusantium",
    "completed": false
  },
  {
    "userId": 5,
    "id": 89,
    "title": "sequi ut omnis et",
    "completed": true
  },
  {
    "userId": 5,
    "id": 90,
    "title": "molestiae nisi accusantium tenetur dolorem et",
    "completed": true
  },
  {
    "userId": 5,
    "id": 91,
    "title": "nulla quis consequatur saepe qui id expedita",
    "completed": true
  },
  {
    "userId": 5,
    "id": 92,
    "title": "in omnis laboriosam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 93,
    "title": "odio iure consequatur molestiae quibusdam necessitatibus quia sint",
    "completed": true
  },
  {
    "userId": 5,
    "id": 94,
    "title": "facilis modi saepe mollitia",
    "completed": false
  },
  {
    "userId": 5,
    "id": 95,
    "title": "vel nihil et molestiae iusto assumenda nemo quo ut",
    "completed": true
  },
  {
    "userId": 5,
    "id": 96,
    "title": "nobis suscipit ducimus enim asperiores voluptas",
    "completed": false
  },
  {
    "userId": 5,
    "id": 97,
    "title": "dolorum laboriosam eos qui iure aliquam",
    "completed": false
  },
  {
    "userId": 5,
    "id": 98,
    "title": "debitis accusantium ut quo facilis nihil quis sapiente necessitatibus",
    "completed": true
  },
  {
    "userId": 5,
    "id": 99,
    "title": "neque voluptates ratione",
    "completed": false
  },
  {
    "userId": 5,
    "id": 100,
    "title": "excepturi a et neque qui expedita vel voluptate",
    "completed": false
  },
  {
    "userId": 6,
    "id": 101,
    "title": "explicabo enim cumque porro aperiam occaecati minima",
    "completed": false
  },
  {
    "userId": 6,
    "id": 102,
    "title": "sed ab consequatur",
    "completed": false
  },
  {
    "userId": 6,
    "id": 103,
    "title": "non sunt delectus illo nulla tenetur enim omnis",
    "completed": false
  },
  {
    "userId": 6,
    "id": 104,
    "title": "excepturi non laudantium quo",
    "completed": false
  },
  {
    "userId": 6,
    "id": 105,
    "title": "totam quia dolorem et illum repellat voluptas optio",
    "completed": true
  },
  {
    "userId": 6,
    "id": 106,
    "title": "ad illo quis voluptatem temporibus",
    "completed": true
  },
  {
    "userId": 6,
    "id": 107,
    "title": "praesentium facilis omnis laudantium fugit ad iusto nihil nesciunt",
    "completed": false
  },
  {
    "userId": 6,
    "id": 108,
    "title": "a eos eaque nihil et exercitationem incidunt delectus",
    "completed": true
  },
  {
    "userId": 6,
    "id": 109,
    "title": "autem temporibus harum quisquam in culpa",
    "completed": true
  },
  {
    "userId": 6,
    "id": 110,
    "title": "aut aut ea corporis",
    "completed": true
  },
  {
    "userId": 6,
    "id": 111,
    "title": "magni accusantium labore et id quis provident",
    "completed": false
  },
  {
    "userId": 6,
    "id": 112,
    "title": "consectetur impedit quisquam qui deserunt non rerum consequuntur eius",
    "completed": false
  },
  {
    "userId": 6,
    "id": 113,
    "title": "quia atque aliquam sunt impedit voluptatum rerum assumenda nisi",
    "completed": false
  },
  {
    "userId": 6,
    "id": 114,
    "title": "cupiditate quos possimus corporis quisquam exercitationem beatae",
    "completed": false
  },
  {
    "userId": 6,
    "id": 115,
    "title": "sed et ea eum",
    "completed": false
  },
  {
    "userId": 6,
    "id": 116,
    "title": "ipsa dolores vel facilis ut",
    "completed": true
  },
  {
    "userId": 6,
    "id": 117,
    "title": "sequi quae est et qui qui eveniet asperiores",
    "completed": false
  },
  {
    "userId": 6,
    "id": 118,
    "title": "quia modi consequatur vero fugiat",
    "completed": false
  },
  {
    "userId": 6,
    "id": 119,
    "title": "corporis ducimus ea perspiciatis iste",
    "completed": false
  },
  {
    "userId": 6,
    "id": 120,
    "title": "dolorem laboriosam vel voluptas et aliquam quasi",
    "completed": false
  },
  {
    "userId": 7,
    "id": 121,
    "title": "inventore aut nihil minima laudantium hic qui omnis",
    "completed": true
  },
  {
    "userId": 7,
    "id": 122,
    "title": "provident aut nobis culpa",
    "completed": true
  },
  {
    "userId": 7,
    "id": 123,
    "title": "esse et quis iste est earum aut impedit",
    "completed": false
  },
  {
    "userId": 7,
    "id": 124,
    "title": "qui consectetur id",
    "completed": false
  },
  {
    "userId": 7,
    "id": 125,
    "title": "aut quasi autem iste tempore illum possimus",
    "completed": false
  },
  {
    "userId": 7,
    "id": 126,
    "title": "ut asperiores perspiciatis veniam ipsum rerum saepe",
    "completed": true
  },
  {
    "userId": 7,
    "id": 127,
    "title": "voluptatem libero consectetur rerum ut",
    "completed": true
  },
  {
    "userId": 7,
    "id": 128,
    "title": "eius omnis est qui voluptatem autem",
    "completed": false
  },
  {
    "userId": 7,
    "id": 129,
    "title": "rerum culpa quis harum",
    "completed": false
  },
  {
    "userId": 7,
    "id": 130,
    "title": "nulla aliquid eveniet harum laborum libero alias ut unde",
    "completed": true
  },
  {
    "userId": 7,
    "id": 131,
    "title": "qui ea incidunt quis",
    "completed": false
  },
  {
    "userId": 7,
    "id": 132,
    "title": "qui molestiae voluptatibus velit iure harum quisquam",
    "completed": true
  },
  {
    "userId": 7,
    "id": 133,
    "title": "et labore eos enim rerum consequatur sunt",
    "completed": true
  },
  {
    "userId": 7,
    "id": 134,
    "title": "molestiae doloribus et laborum quod ea",
    "completed": false
  },
  {
    "userId": 7,
    "id": 135,
    "title": "facere ipsa nam eum voluptates reiciendis vero qui",
    "completed": false
  },
  {
    "userId": 7,
    "id": 136,
    "title": "asperiores illo tempora fuga sed ut quasi adipisci",
    "completed": false
  },
  {
    "userId": 7,
    "id": 137,
    "title": "qui sit non",
    "completed": false
  },
  {
    "userId": 7,
    "id": 138,
    "title": "placeat minima consequatur rem qui ut",
    "completed": true
  },
  {
    "userId": 7,
    "id": 139,
    "title": "consequatur doloribus id possimus voluptas a voluptatem",
    "completed": false
  },
  {
    "userId": 7,
    "id": 140,
    "title": "aut consectetur in blanditiis deserunt quia sed laboriosam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 141,
    "title": "explicabo consectetur debitis voluptates quas quae culpa rerum non",
    "completed": true
  },
  {
    "userId": 8,
    "id": 142,
    "title": "maiores accusantium architecto necessitatibus reiciendis ea aut",
    "completed": true
  },
  {
    "userId": 8,
    "id": 143,
    "title": "eum non recusandae cupiditate animi",
    "completed": false
  },
  {
    "userId": 8,
    "id": 144,
    "title": "ut eum exercitationem sint",
    "completed": false
  },
  {
    "userId": 8,
    "id": 145,
    "title": "beatae qui ullam incidunt voluptatem non nisi aliquam",
    "completed": false
  },
  {
    "userId": 8,
    "id": 146,
    "title": "molestiae suscipit ratione nihil odio libero impedit vero totam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 147,
    "title": "eum itaque quod reprehenderit et facilis dolor autem ut",
    "completed": true
  },
  {
    "userId": 8,
    "id": 148,
    "title": "esse quas et quo quasi exercitationem",
    "completed": false
  },
  {
    "userId": 8,
    "id": 149,
    "title": "animi voluptas quod perferendis est",
    "completed": false
  },
  {
    "userId": 8,
    "id": 150,
    "title": "eos amet tempore laudantium fugit a",
    "completed": false
  },
  {
    "userId": 8,
    "id": 151,
    "title": "accusamus adipisci dicta qui quo ea explicabo sed vero",
    "completed": true
  },
  {
    "userId": 8,
    "id": 152,
    "title": "odit eligendi recusandae doloremque cumque non",
    "completed": false
  },
  {
    "userId": 8,
    "id": 153,
    "title": "ea aperiam consequatur qui repellat eos",
    "completed": false
  },
  {
    "userId": 8,
    "id": 154,
    "title": "rerum non ex sapiente",
    "completed": true
  },
  {
    "userId": 8,
    "id": 155,
    "title": "voluptatem nobis consequatur et assumenda magnam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 156,
    "title": "nam quia quia nulla repellat assumenda quibusdam sit nobis",
    "completed": true
  },
  {
    "userId": 8,
    "id": 157,
    "title": "dolorem veniam quisquam deserunt repellendus",
    "completed": true
  },
  {
    "userId": 8,
    "id": 158,
    "title": "debitis vitae delectus et harum accusamus aut deleniti a",
    "completed": true
  },
  {
    "userId": 8,
    "id": 159,
    "title": "debitis adipisci quibusdam aliquam sed dolore ea praesentium nobis",
    "completed": true
  },
  {
    "userId": 8,
    "id": 160,
    "title": "et praesentium aliquam est",
    "completed": false
  },
  {
    "userId": 9,
    "id": 161,
    "title": "ex hic consequuntur earum omnis alias ut occaecati culpa",
    "completed": true
  },
  {
    "userId": 9,
    "id": 162,
    "title": "omnis laboriosam molestias animi sunt dolore",
    "completed": true
  },
  {
    "userId": 9,
    "id": 163,
    "title": "natus corrupti maxime laudantium et voluptatem laboriosam odit",
    "completed": false
  },
  {
    "userId": 9,
    "id": 164,
    "title": "reprehenderit quos aut aut consequatur est sed",
    "completed": false
  },
  {
    "userId": 9,
    "id": 165,
    "title": "fugiat perferendis sed aut quidem",
    "completed": false
  },
  {
    "userId": 9,
    "id": 166,
    "title": "quos quo possimus suscipit minima ut",
    "completed": false
  },
  {
    "userId": 9,
    "id": 167,
    "title": "et quis minus quo a asperiores molestiae",
    "completed": false
  },
  {
    "userId": 9,
    "id": 168,
    "title": "recusandae quia qui sunt libero",
    "completed": false
  },
  {
    "userId": 9,
    "id": 169,
    "title": "ea odio perferendis officiis",
    "completed": true
  },
  {
    "userId": 9,
    "id": 170,
    "title": "quisquam aliquam quia doloribus aut",
    "completed": false
  },
  {
    "userId": 9,
    "id": 171,
    "title": "fugiat aut voluptatibus corrupti deleniti velit iste odio",
    "completed": true
  },
  {
    "userId": 9,
    "id": 172,
    "title": "et provident amet rerum consectetur et voluptatum",
    "completed": false
  },
  {
    "userId": 9,
    "id": 173,
    "title": "harum ad aperiam quis",
    "completed": false
  },
  {
    "userId": 9,
    "id": 174,
    "title": "similique aut quo",
    "completed": false
  },
  {
    "userId": 9,
    "id": 175,
    "title": "laudantium eius officia perferendis provident perspiciatis asperiores",
    "completed": true
  },
  {
    "userId": 9,
    "id": 176,
    "title": "magni soluta corrupti ut maiores rem quidem",
    "completed": false
  },
  {
    "userId": 9,
    "id": 177,
    "title": "et placeat temporibus voluptas est tempora quos quibusdam",
    "completed": false
  },
  {
    "userId": 9,
    "id": 178,
    "title": "nesciunt itaque commodi tempore",
    "completed": true
  },
  {
    "userId": 9,
    "id": 179,
    "title": "omnis consequuntur cupiditate impedit itaque ipsam quo",
    "completed": true
  },
  {
    "userId": 9,
    "id": 180,
    "title": "debitis nisi et dolorem repellat et",
    "completed": true
  },
  {
    "userId": 10,
    "id": 181,
    "title": "ut cupiditate sequi aliquam fuga maiores",
    "completed": false
  },
  {
    "userId": 10,
    "id": 182,
    "title": "inventore saepe cumque et aut illum enim",
    "completed": true
  },
  {
    "userId": 10,
    "id": 183,
    "title": "omnis nulla eum aliquam distinctio",
    "completed": true
  },
  {
    "userId": 10,
    "id": 184,
    "title": "molestias modi perferendis perspiciatis",
    "completed": false
  },
  {
    "userId": 10,
    "id": 185,
    "title": "voluptates dignissimos sed doloribus animi quaerat aut",
    "completed": false
  },
  {
    "userId": 10,
    "id": 186,
    "title": "explicabo odio est et",
    "completed": false
  },
  {
    "userId": 10,
    "id": 187,
    "title": "consequuntur animi possimus",
    "completed": false
  },
  {
    "userId": 10,
    "id": 188,
    "title": "vel non beatae est",
    "completed": true
  },
  {
    "userId": 10,
    "id": 189,
    "title": "culpa eius et voluptatem et",
    "completed": true
  },
  {
    "userId": 10,
    "id": 190,
    "title": "accusamus sint iusto et voluptatem exercitationem",
    "completed": true
  },
  {
    "userId": 10,
    "id": 191,
    "title": "temporibus atque distinctio omnis eius impedit tempore molestias pariatur",
    "completed": true
  },
  {
    "userId": 10,
    "id": 192,
    "title": "ut quas possimus exercitationem sint voluptates",
    "completed": false
  },
  {
    "userId": 10,
    "id": 193,
    "title": "rerum debitis voluptatem qui eveniet tempora distinctio a",
    "completed": true
  },
  {
    "userId": 10,
    "id": 194,
    "title": "sed ut vero sit molestiae",
    "completed": false
  },
  {
    "userId": 10,
    "id": 195,
    "title": "rerum ex veniam mollitia voluptatibus pariatur",
    "completed": true
  },
  {
    "userId": 10,
    "id": 196,
    "title": "consequuntur aut ut fugit similique",
    "completed": true
  },
  {
    "userId": 10,
    "id": 197,
    "title": "dignissimos quo nobis earum saepe",
    "completed": true
  },
  {
    "userId": 10,
    "id": 198,
    "title": "quis eius est sint explicabo",
    "completed": true
  },
  {
    "userId": 10,
    "id": 199,
    "title": "numquam repellendus a magnam",
    "completed": true
  },
  {
    "userId": 10,
    "id": 200,
    "title": "ipsam aperiam voluptates qui",
    "completed": false
  }
];
};Modulo.assets.functions["17dsoab"]= function (CTX, G){
var OUT=[];
OUT.push("\n<p>Type a book name for \"search as you type\"\n(e.g. try &ldquo;the lord of the rings&rdquo;)</p>\n\n<input [state.bind] name=\"search\"\n  @keyup:=script.typingCallback />\n\n<div class=\"results "); // "<p>Type a book name for \"search as you type\"\n(e.g. try &ldquo;the lord of the rings&rdquo;)</p>\n\n<input [state.bind] name=\"search\"\n  @keyup:=script.typingCallback />\n\n<div class=\"results"
if (CTX.state.search.length > 0) { // "if state.search.length gt 0"
OUT.push("\n                      visible "); // "visible"
} // "endif"
OUT.push("\">\n  <div class=\"results-container\">\n    "); // "\">\n  <div class=\"results-container\">"
if (CTX.state.loading) { // "if state.loading"
OUT.push("\n      <img src=\""); // "<img src=\""
OUT.push(G.escapeText(CTX.staticdata.gif)); // "staticdata.gif"
OUT.push("\" alt=\"loading\" />\n    "); // "\" alt=\"loading\" />"
} else { // "else"
OUT.push("\n      "); // ""
var ARR1=CTX.state.results;for (var KEY in ARR1) {CTX. result=ARR1[KEY]; // "for result in state.results"
OUT.push("\n        <div class=\"result\">\n          <img\n            src=\""); // "<div class=\"result\">\n          <img\n            src=\""
OUT.push(G.escapeText(G.filters["add"](CTX.staticdata.cover,CTX.result.cover_i))); // "staticdata.cover|add:result.cover_i"
OUT.push("-S.jpg\"\n          /> <label>"); // "-S.jpg\"\n          /> <label>"
OUT.push(G.escapeText(CTX.result.title)); // "result.title"
OUT.push("</label>\n        </div>\n      "); // "</label>\n        </div>"
G.FORLOOP_NOT_EMPTY2=true; } if (!G.FORLOOP_NOT_EMPTY2) { // "empty"
OUT.push("\n        <p>No books found.</p>\n      "); // "<p>No books found.</p>"
}G.FORLOOP_NOT_EMPTY2 = false; // "endfor"
OUT.push("\n    "); // ""
} // "endif"
OUT.push("\n  </div>\n</div>\n"); // "</div>\n</div>"

return OUT.join("");
};Modulo.assets.functions["182j849"]= function (CTX, G){
var OUT=[];
OUT.push("\n    Components can use any number of <strong>CParts</strong>.\n    Here we use only <em>Style</em> and <em>Template</em>.\n"); // "Components can use any number of <strong>CParts</strong>.\n    Here we use only <em>Style</em> and <em>Template</em>."

return OUT.join("");
};Modulo.assets.functions["1b2ttl4"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <input name=\"perc\" [state.bind] />% of\n    <input name=\"total\" [state.bind] />\n    is: "); // "<input name=\"perc\" [state.bind] />% of\n    <input name=\"total\" [state.bind] />\n    is:"
OUT.push(G.escapeText(CTX.script.calcResult)); // "script.calcResult"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["1bv8obf"]= function (CTX, G){
var OUT=[];
OUT.push("\n<p>There are <em>"); // "<p>There are <em>"
OUT.push(G.escapeText(CTX.state.count)); // "state.count"
OUT.push("\n  "); // ""
OUT.push(G.escapeText(G.filters["pluralize"](CTX.state.count,"articles,article"))); // "state.count|pluralize:\"articles,article\""
OUT.push("</em>\n  on "); // "</em>\n  on"
OUT.push(G.escapeText(CTX.script.exports.title)); // "script.exports.title"
OUT.push(".</p>\n\n"); // ".</p>"
OUT.push("\n"); // ""
var ARR0=CTX.state.articles;for (var KEY in ARR0) {CTX. article=ARR0[KEY]; // "for article in state.articles"
OUT.push("\n    <h4 style=\"color: blue\">"); // "<h4 style=\"color: blue\">"
OUT.push(G.escapeText(G.filters["upper"](CTX.article.headline))); // "article.headline|upper"
OUT.push("</h4>\n    "); // "</h4>"
if (CTX.article.tease) { // "if article.tease"
OUT.push("\n      <p>"); // "<p>"
OUT.push(G.escapeText(G.filters["truncate"](CTX.article.tease,30))); // "article.tease|truncate:30"
OUT.push("</p>\n    "); // "</p>"
} // "endif"
OUT.push("\n"); // ""
} // "endfor"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["1ctee13"]= function (Modulo, factory, module, component, props, template, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function prepareCallback() {
            const { data } = props;
            const max = Math.max(...data);
            const min = 0;// Math.min(...props.data),
            return {
                percent: data.map(item => ((item - min) / max) * 100),
                width: Math.floor(100 / data.length),
            }
        }
    
return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["1hhbf94"]= function (CTX, G){
var OUT=[];
OUT.push("\n        "); // ""
var ARR0=CTX.props.options;for (var KEY in ARR0) {CTX. option=ARR0[KEY]; // "for option in props.options"
OUT.push("\n            <input\n                type=\"radio\" \n                id=\""); // "<input\n                type=\"radio\" \n                id=\""
OUT.push(G.escapeText(CTX.props.name)); // "props.name"
OUT.push("_"); // "_"
OUT.push(G.escapeText(CTX.option)); // "option"
OUT.push("\"\n                name=\""); // "\"\n                name=\""
OUT.push(G.escapeText(CTX.props.name)); // "props.name"
OUT.push("\"\n                payload=\""); // "\"\n                payload=\""
OUT.push(G.escapeText(CTX.option)); // "option"
OUT.push("\"\n                @change:=script.setValue\n            /><label for=\""); // "\"\n                @change:=script.setValue\n            /><label for=\""
OUT.push(G.escapeText(CTX.props.name)); // "props.name"
OUT.push("_"); // "_"
OUT.push(G.escapeText(CTX.option)); // "option"
OUT.push("\">"); // "\">"
OUT.push(G.escapeText(CTX.option)); // "option"
OUT.push("</label>\n        "); // "</label>"
} // "endfor"
OUT.push("\n    "); // ""

return OUT.join("");
};Modulo.assets.functions["1iu3f2i"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    // Getting big a range of numbers in JS. Use "script.exports"
    // to export this as a one-time global constant.
    // (Hint: Curious how it calculates prime? See CSS!)
    script.exports.range = 
        Array.from({length: 63}, (x, i) => i + 2);
    function setNum(payload, ev) {
        state.number = Number(ev.target.textContent);
    }

return { "setNum": typeof setNum !== "undefined" ? setNum : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["1n5m36a"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function countUp() {
        state.num++;
    }

return { "countUp": typeof countUp !== "undefined" ? countUp : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["1nm8gm0"]= function (CTX, G){
var OUT=[];
OUT.push("\n<p>User \"<em>"); // "<p>User \"<em>"
OUT.push(G.escapeText(CTX.state.username)); // "state.username"
OUT.push("</em>\" sent a message:</p>\n<div class=\"msgcontent\">\n    "); // "</em>\" sent a message:</p>\n<div class=\"msgcontent\">"
OUT.push(G.escapeText(G.filters["safe"](CTX.state.content))); // "state.content|safe"
OUT.push("\n</div>\n"); // "</div>"

return OUT.join("");
};Modulo.assets.functions["1s5vkkp"]= function (CTX, G){
var OUT=[];
OUT.push("\n"); // ""
if (!(CTX.state.cards.length)) { // "if not state.cards.length"
OUT.push("\n    <h3>The Symbolic Memory Game</h3>\n    <p>Choose your difficulty:</p>\n    <button @click:=script.setup click.payload=8>2x4</button>\n    <button @click:=script.setup click.payload=16>4x4</button>\n    <button @click:=script.setup click.payload=36>6x6</button>\n"); // "<h3>The Symbolic Memory Game</h3>\n    <p>Choose your difficulty:</p>\n    <button @click:=script.setup click.payload=8>2x4</button>\n    <button @click:=script.setup click.payload=16>4x4</button>\n    <button @click:=script.setup click.payload=36>6x6</button>"
} else { // "else"
OUT.push("\n    <div class=\"board\n        "); // "<div class=\"board"
if (CTX.state.cards.length > 16) { // "if state.cards.length > 16"
OUT.push("hard"); // "hard"
} // "endif"
OUT.push("\">\n    "); // "\">"
OUT.push("\n    "); // ""
var ARR1=CTX.state.cards;for (var KEY in ARR1) {CTX. card=ARR1[KEY]; // "for card in state.cards"
OUT.push("\n        "); // ""
OUT.push("\n        <div key=\"c"); // "<div key=\"c"
OUT.push(G.escapeText(CTX.card.id)); // "card.id"
OUT.push("\"\n            class=\"card\n            "); // "\"\n            class=\"card"
if ((CTX.state.revealed).includes ? (CTX.state.revealed).includes(CTX.card.id) : (CTX.card.id in CTX.state.revealed)) { // "if card.id in state.revealed"
OUT.push("\n                flipped\n            "); // "flipped"
} // "endif"
OUT.push("\n            \"\n            style=\"\n            "); // "\"\n            style=\""
if (CTX.state.win) { // "if state.win"
OUT.push("\n                animation: flipping 0.5s infinite alternate;\n                animation-delay: "); // "animation: flipping 0.5s infinite alternate;\n                animation-delay:"
OUT.push(G.escapeText(CTX.card.id)); // "card.id"
OUT.push("."); // "."
OUT.push(G.escapeText(CTX.card.id)); // "card.id"
OUT.push("s;\n            "); // "s;"
} // "endif"
OUT.push("\n            \"\n            @click:=script.flip\n            click.payload=\""); // "\"\n            @click:=script.flip\n            click.payload=\""
OUT.push(G.escapeText(CTX.card.id)); // "card.id"
OUT.push("\">\n            "); // "\">"
if ((CTX.state.revealed).includes ? (CTX.state.revealed).includes(CTX.card.id) : (CTX.card.id in CTX.state.revealed)) { // "if card.id in state.revealed"
OUT.push("\n                "); // ""
OUT.push(G.escapeText(CTX.card.symbol)); // "card.symbol"
OUT.push("\n            "); // ""
} // "endif"
OUT.push("\n        </div>\n    "); // "</div>"
} // "endfor"
OUT.push("\n    </div>\n    <p style=\""); // "</div>\n    <p style=\""
if (CTX.state.failedflip) { // "if state.failedflip"
OUT.push("\n                color: red"); // "color: red"
} // "endif"
OUT.push("\">\n        "); // "\">"
OUT.push(G.escapeText(CTX.state.message)); // "state.message"
OUT.push("</p>\n"); // "</p>"
} // "endif"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["1t7kt92"]= function (Modulo, factory, module, component, props, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }
let componentTexts = null;
let componentTexts2 = null;
let exCounter = 0; // global variable

//console.log('this is demo.js');

function _setupGlobalVariables() {
    // TODO: Refactor this, obvs
    // Get text from the two example component libraries
    //console.log('this is registered Modulo instances', Object.keys(Modulo.factoryInstances));
    try {
        componentTexts = Modulo.factoryInstances['eg-eg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts:', err);
        componentTexts = null;
    }

    try {
        componentTexts2 = Modulo.factoryInstances['docseg-docseg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts2:', err);
        componentTexts2 = null;
    }

    if (componentTexts) {
        componentTexts = Object.assign({}, componentTexts, componentTexts2);
    }
}

function tmpGetDirectives() {
    return [ 'script.codemirror' ];
}

function codemirrorMount({ el }) {
    //console.log('codeMirrorMount', { el });
    el.innerHTML = ''; // clear inner HTML before mounting
    const demoType = props.demotype || 'snippet';
    //_setupCodemirror(el, demoType, element, state);
    _setupCodemirrorSync(el, demoType, element, state);
}

function _setupCodemirrorSync(el, demoType, myElement, myState) {
      let readOnly = false;
      let lineNumbers = true;
      if (demoType === 'snippet') {
          readOnly = true;
          lineNumbers = false;
      }

      const conf = {
          value: myState.text,
          mode: 'django',
          theme: 'eclipse',
          indentUnit: 4,
          readOnly,
          lineNumbers,
      };

      if (demoType === 'snippet') {
          myState.showclipboard = true;
      } else if (demoType === 'minipreview') {
          myState.showpreview = true;
      }

      if (!myElement.codeMirrorEditor) {
          myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
      }
      myElement.codeMirrorEditor.refresh()
}

function _setupCodemirror(el, demoType, myElement, myState) {
    //console.log('_setupCodemirror DISABLED'); return; ///////////////////
    let expBackoff = 10;
    //console.log('this is codemirror', Modulo.globals.CodeMirror);
    const mountCM = () => {
        // TODO: hack, allow JS deps or figure out loader or something
        if (!Modulo.globals.CodeMirror) {
            expBackoff *= 2;
            setTimeout(mountCM, expBackoff); // poll again
            return;
        }

        let readOnly = false;
        let lineNumbers = true;
        if (demoType === 'snippet') {
            readOnly = true;
            lineNumbers = false;
        }

        const conf = {
            value: myState.text,
            mode: 'django',
            theme: 'eclipse',
            indentUnit: 4,
            readOnly,
            lineNumbers,
        };

        if (demoType === 'snippet') {
            myState.showclipboard = true;
        } else if (demoType === 'minipreview') {
            myState.showpreview = true;
        }

        if (!myElement.codeMirrorEditor) {
            myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
        }
        myElement.codeMirrorEditor.refresh()
        //myElement.rerender();
    };
    mountCM();
    return;
    const {isBackend} = Modulo;
    if (!isBackend) {
        // TODO: Ugly hack, need better tools for working with legacy
        setTimeout(mountCM, expBackoff);
    }
}

function selectTab(newTitle) {
    //console.log('tab getting selected!', newTitle);
    if (!element.codeMirrorEditor) {
        return; // not ready yet
    }
    const currentTitle = state.selected;
    state.selected = newTitle;
    for (const tab of state.tabs) {
        if (tab.title === currentTitle) { // save text back to state
            tab.text = element.codeMirrorEditor.getValue();
        } else if (tab.title === newTitle) {
            state.text = tab.text;
        }
    }
    element.codeMirrorEditor.setValue(state.text);
    doRun();
}

function doCopy() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (!mod || !mod.script || !mod.script.copyTextToClipboard) {
        console.log('no mod!');
    } else {
        mod.script.copyTextToClipboard(state.text);
    }
}

function initializedCallback() {
    // console.log('initializedCallback');
    if (componentTexts === null) {
        _setupGlobalVariables();
    }

    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            componentTexts = false;
            throw new Error('Couldnt load:', props.fromlibrary)
        }

        const componentNames = props.fromlibrary.split(',');
        for (const title of componentNames) {
            if (title in componentTexts) {
                text = componentTexts[title].trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                state.tabs.push({ text, title });
            } else {
                console.error('invalid fromlibrary:', title);
                console.log(componentTexts);
                return;
            }
        }
    } else if (props.text) {
        let title = props.ttitle || 'Example';
        text = props.text.trim();
        state.tabs.push({title, text});
        // hack -v
        if (props.text2) {
            title = props.ttitle2 || 'Example';
            text = props.text2.trim();
            state.tabs.push({title, text});
        }
        if (props.text3) {
            title = props.ttitle3 || 'Example';
            text = props.text3.trim();
            state.tabs.push({title, text});
        }
        //console.log('this is props', props);
    }

    const demoType = props.demotype || 'snippet';
    if (demoType === 'snippet') {
        state.showclipboard = true;
    } else if (demoType === 'minipreview') {
        state.showpreview = true;
    }

    state.text = state.tabs[0].text; // load first

    state.selected = state.tabs[0].title; // set first as tab title
    //setupShaChecksum();
    if (demoType === 'minipreview') {
        doRun();
    }

    const myElem = element;
    const myState = state;
    const {isBackend} = Modulo;
    return;
    if (!isBackend) {
        setTimeout(() => {
            const div = myElem.querySelector('.editor-wrapper > div');
            _setupCodemirror(div, demoType, myElem, myState);
        }, 0); // put on queue
    }
}

function doRun() {
    exCounter++;
    //console.log('There are ', exCounter, ' examples on this page. Gee!')
    const namespace = `e${exCounter}g${state.nscounter}`; // TODO: later do hot reloading using same loader
    state.nscounter++;
    const attrs = { src: '', namespace };
    const tagName = 'Example';

    if (element.codeMirrorEditor) {
        state.text = element.codeMirrorEditor.getValue(); // make sure most up-to-date
    }
    let componentDef = state.text;
    componentDef = `<component name="${tagName}">\n${componentDef}\n</component>`;
    const loader = new Modulo.Loader(null, { attrs } );

    // Use a new asset manager when loading, to prevent it from getting into the main bundle
    const oldAssetMgr = Modulo.assets;
    Modulo.assets = new Modulo.AssetManager();
    loader.loadString(componentDef);
    Modulo.assets = oldAssetMgr;

    const fullname = `${namespace}-${tagName}`;
    const factory = Modulo.factoryInstances[fullname];
    state.preview = `<${fullname}></${fullname}>`;

    // Hacky way to mount, required due to buggy dom resolver
    const {isBackend} = Modulo;
    if (!isBackend) {
        setTimeout(() => {
            const div = element.querySelector('.editor-minipreview > div');
            if (div) {
                div.innerHTML = state.preview;
            } else {
                console.log('warning, cant update minipreview', div);
            }
        }, 0);
    }
}

function countUp() {
    // TODO: Remove this when resolution context bug is fixed so that children
    // no longer can reference parents
    console.count('PROBLEM: Child event bubbling to parent!');
}

function doFullscreen() {
    document.body.scrollTop = document.documentElement.scrollTop = 0;
    if (state.fullscreen) {
        state.fullscreen = false;
        document.querySelector('html').style.overflow = "auto";
        if (element.codeMirrorEditor) {
            element.codeMirrorEditor.refresh()
        }
    } else {
        state.fullscreen = true;
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        // TODO: way to share variables in CSS
        if (vw > 768) {
              document.querySelector('html').style.overflow = "hidden";
              if (element.codeMirrorEditor) {
                  element.codeMirrorEditor.refresh()
              }
        }
    }
    if (element.codeMirrorEditor) {
        //element.codeMirrorEditor.refresh()
    }
}

/*
function previewspotMount({ el }) {
    element.previewSpot = el;
    if (!element.isMounted) {
        doRun(); // mount after first render
    }
}


function setupShaChecksum() {
    console.log('setupShaChecksum DISABLED'); return; ///////////////////

    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (Modulo.isBackend && state && state.text.includes('$modulojs_sha384_checksum$')) {
        if (!mod || !mod.script || !mod.script.getVersionInfo) {
            console.log('no mod!');
        } else {
            const info = mod.script.getVersionInfo();
            const checksum = info.checksum || '';
            state.text = state.text.replace('$modulojs_sha384_checksum$', checksum)
            element.setAttribute('text', state.text);
        }
    }
}
*/

/*
const component = factory.createTestElement();
component.remove()
console.log(component);
element.previewSpot.innerHTML = '';
element.previewSpot.appendChild(component);
*/


return { "_setupGlobalVariables": typeof _setupGlobalVariables !== "undefined" ? _setupGlobalVariables : undefined,
"tmpGetDirectives": typeof tmpGetDirectives !== "undefined" ? tmpGetDirectives : undefined,
"codemirrorMount": typeof codemirrorMount !== "undefined" ? codemirrorMount : undefined,
"_setupCodemirrorSync": typeof _setupCodemirrorSync !== "undefined" ? _setupCodemirrorSync : undefined,
"_setupCodemirror": typeof _setupCodemirror !== "undefined" ? _setupCodemirror : undefined,
"selectTab": typeof selectTab !== "undefined" ? selectTab : undefined,
"doCopy": typeof doCopy !== "undefined" ? doCopy : undefined,
"initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"doRun": typeof doRun !== "undefined" ? doRun : undefined,
"countUp": typeof countUp !== "undefined" ? countUp : undefined,
"doFullscreen": typeof doFullscreen !== "undefined" ? doFullscreen : undefined,
"previewspotMount": typeof previewspotMount !== "undefined" ? previewspotMount : undefined,
"setupShaChecksum": typeof setupShaChecksum !== "undefined" ? setupShaChecksum : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["1v31h2l"]= function (CTX, G){
var OUT=[];
OUT.push("\n  <div class=\"grid\">\n    "); // "<div class=\"grid\">"
var ARR0=CTX.script.exports.range;for (var KEY in ARR0) {CTX. i=ARR0[KEY]; // "for i in script.exports.range"
OUT.push("\n        "); // ""
var ARR1=CTX.script.exports.range;for (var KEY in ARR1) {CTX. j=ARR1[KEY]; // "for j in script.exports.range"
OUT.push("\n          <div\n            @click:=script.toggle\n            payload:='[ "); // "<div\n            @click:=script.toggle\n            payload:='["
OUT.push(G.escapeText(CTX.i)); // "i"
OUT.push(", "); // ","
OUT.push(G.escapeText(CTX.j)); // "j"
OUT.push(" ]'\n            "); // "]'"
if (G.filters["get"](CTX.state.cells,CTX.i)) { // "if state.cells|get:i"
OUT.push("\n                "); // ""
if (G.filters["get"](G.filters["get"](CTX.state.cells,CTX.i),CTX.j)) { // "if state.cells|get:i|get:j"
OUT.push("\n                    style=\"background: #B90183;\"\n                "); // "style=\"background: #B90183;\""
} // "endif"
OUT.push("\n            "); // ""
} // "endif"
OUT.push("\n           ></div>\n        "); // "></div>"
} // "endfor"
OUT.push("\n    "); // ""
} // "endfor"
OUT.push("\n  </div>\n  <div class=\"controls\">\n    "); // "</div>\n  <div class=\"controls\">"
if (!(CTX.state.playing)) { // "if not state.playing"
OUT.push("\n        <button @click:=script.play alt=\"Play\">&#x25B6;</button>\n    "); // "<button @click:=script.play alt=\"Play\">&#x25B6;</button>"
} else { // "else"
OUT.push("\n        <button @click:=script.pause alt=\"Pause\">&#x2016;</button>\n    "); // "<button @click:=script.pause alt=\"Pause\">&#x2016;</button>"
} // "endif"
OUT.push("\n\n    <button @click:=script.randomize alt=\"Randomize\">RND</button>\n    <button @click:=script.clear alt=\"Randomize\">CLR</button>\n    <label>Spd: <input [state.bind]\n        name=\"speed\"\n        type=\"number\" min=\"1\" max=\"10\" step=\"1\" /></label>\n  </div>\n"); // "<button @click:=script.randomize alt=\"Randomize\">RND</button>\n    <button @click:=script.clear alt=\"Randomize\">CLR</button>\n    <label>Spd: <input [state.bind]\n        name=\"speed\"\n        type=\"number\" min=\"1\" max=\"10\" step=\"1\" /></label>\n  </div>"

return OUT.join("");
};Modulo.assets.functions["1vpv9ub"]= function (CTX, G){
var OUT=[];
OUT.push("\n  "); // ""
var ARR0=CTX.staticdata;for (var KEY in ARR0) {CTX. post=ARR0[KEY]; // "for post in staticdata"
OUT.push("\n    <p>"); // "<p>"
if (CTX.post.completed) { // "if post.completed"
OUT.push("&starf;"); // "&starf;"
} else { // "else"
OUT.push("&star;"); // "&star;"
} // "endif"
OUT.push("\n        "); // ""
OUT.push(G.escapeText(G.filters["truncate"](CTX.post.title,15))); // "post.title|truncate:15"
OUT.push("</p>\n  "); // "</p>"
} // "endfor"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["3c01k5"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <strong>Name:</strong> "); // "<strong>Name:</strong>"
OUT.push(G.escapeText(CTX.staticdata.name)); // "staticdata.name"
OUT.push(" <br />\n    <strong>Site:</strong> "); // "<br />\n    <strong>Site:</strong>"
OUT.push(G.escapeText(CTX.staticdata.homepage)); // "staticdata.homepage"
OUT.push(" <br />\n    <strong>Tags:</strong> "); // "<br />\n    <strong>Tags:</strong>"
OUT.push(G.escapeText(G.filters["join"](CTX.staticdata.topics))); // "staticdata.topics|join"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["4amukg"]= function (){
return {
  apiBase: 'https://openlibrary.org/search.json',
  cover: 'https://covers.openlibrary.org/b/id/',
  gif: 'https://cdnjs.cloudflare.com/ajax/libs/' +
    'semantic-ui/0.16.1/images/loader-large.gif'
};
};Modulo.assets.functions["6dqor"]= function (CTX, G){
var OUT=[];
OUT.push("\n<ul>\n    "); // "<ul>"
var ARR0=CTX.state.menu;for (var KEY in ARR0) {CTX. linkGroup=ARR0[KEY]; // "for linkGroup in state.menu"
OUT.push("\n        <li class=\"\n            "); // "<li class=\""
if (CTX.linkGroup.children) { // "if linkGroup.children"
OUT.push("\n                "); // ""
if (CTX.linkGroup.active) { // "if linkGroup.active"
OUT.push("gactive"); // "gactive"
} else { // "else"
OUT.push("ginactive"); // "ginactive"
} // "endif"
OUT.push("\n            "); // ""
} // "endif"
OUT.push("\n            \"><a href=\""); // "\"><a href=\""
OUT.push(G.escapeText(CTX.linkGroup.filename)); // "linkGroup.filename"
OUT.push("\">"); // "\">"
OUT.push(G.escapeText(CTX.linkGroup.label)); // "linkGroup.label"
OUT.push("</a>\n            "); // "</a>"
if (CTX.linkGroup.active) { // "if linkGroup.active"
OUT.push("\n                "); // ""
if (CTX.linkGroup.children) { // "if linkGroup.children"
OUT.push("\n                    <ul>\n                    "); // "<ul>"
var ARR3=CTX.linkGroup.children;for (var KEY in ARR3) {CTX. childLink=ARR3[KEY]; // "for childLink in linkGroup.children"
OUT.push("\n                        <li><a href=\""); // "<li><a href=\""
if (CTX.childLink.filepath) { // "if childLink.filepath"
OUT.push(G.escapeText(CTX.childLink.filepath)); // "childLink.filepath"
} else { // "else"
OUT.push(G.escapeText(CTX.linkGroup.filename)); // "linkGroup.filename"
OUT.push("#"); // "#"
OUT.push(G.escapeText(CTX.childLink.hash)); // "childLink.hash"
} // "endif"
OUT.push("\">"); // "\">"
OUT.push(G.escapeText(CTX.childLink.label)); // "childLink.label"
OUT.push("</a>\n                        "); // "</a>"
if (CTX.props.showall) { // "if props.showall"
OUT.push("\n                            "); // ""
if (CTX.childLink.keywords.length > 0) { // "if childLink.keywords.length gt 0"
OUT.push("\n                                <span style=\"margin-left: 10px; color: #aaa\">(<em>Topics: "); // "<span style=\"margin-left: 10px; color: #aaa\">(<em>Topics:"
OUT.push(G.escapeText(G.filters["join"](CTX.childLink.keywords,", "))); // "childLink.keywords|join:', '"
OUT.push("</em>)</span>\n                            "); // "</em>)</span>"
} // "endif"
OUT.push("\n                        "); // ""
} // "endif"
OUT.push("\n                        </li>\n                    "); // "</li>"
} // "endfor"
OUT.push("\n                    </ul>\n                "); // "</ul>"
} // "endif"
OUT.push("\n            "); // ""
} // "endif"
OUT.push("\n        </li>\n    "); // "</li>"
} // "endfor"
OUT.push("\n\n\n    <!--\n    <li>\n        Other resources:\n\n        <ul>\n            <li>\n                <a href=\"/docs/faq.html\">FAQ</a>\n            <li title=\"Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.\">\n                Literate Source*<br /><em>* Coming soon!</em>\n            </li>\n        </ul>\n\n    </li>\n    -->\n    <!--<a href=\"/literate/src/Modulo.html\">Literate source</a>-->\n</ul>\n"); // "<!--\n    <li>\n        Other resources:\n\n        <ul>\n            <li>\n                <a href=\"/docs/faq.html\">FAQ</a>\n            <li title=\"Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.\">\n                Literate Source*<br /><em>* Coming soon!</em>\n            </li>\n        </ul>\n\n    </li>\n    -->\n    <!--<a href=\"/literate/src/Modulo.html\">Literate source</a>-->\n</ul>"

return OUT.join("");
};Modulo.assets.functions["6u97l2"]= function (CTX, G){
var OUT=[];
OUT.push("\n<p>Nonsense poem:</p> <pre>\nProfessor "); // "<p>Nonsense poem:</p> <pre>\nProfessor"
OUT.push(G.escapeText(G.filters["capfirst"](CTX.state.verb))); // "state.verb|capfirst"
OUT.push(" who\n"); // "who"
OUT.push(G.escapeText(CTX.state.verb)); // "state.verb"
OUT.push("ed a "); // "ed a"
OUT.push(G.escapeText(CTX.state.noun)); // "state.noun"
OUT.push(",\ntaught "); // ",\ntaught"
OUT.push(G.escapeText(CTX.state.verb)); // "state.verb"
OUT.push("ing in\nthe City of "); // "ing in\nthe City of"
OUT.push(G.escapeText(G.filters["capfirst"](CTX.state.noun))); // "state.noun|capfirst"
OUT.push(",\nto "); // ",\nto"
OUT.push(G.escapeText(CTX.state.count)); // "state.count"
OUT.push(" "); // ""
OUT.push(G.escapeText(CTX.state.noun)); // "state.noun"
OUT.push("s.\n</pre>\n"); // "s.\n</pre>"

return OUT.join("");
};Modulo.assets.functions["988kh9"]= function (CTX, G){
var OUT=[];
OUT.push("\n\n<x-DemoChart\n    data:='[1, 2, 3, 5, 8]'\n></x-DemoChart>\n\n<x-DemoModal button=\"Nicholas Cage\" title=\"Biography\">\n    <p>Prolific Hollywood actor</p>\n    <img src=\"https://www.placecage.com/640/360\" />\n</x-DemoModal>\n\n<x-DemoModal button=\"Tommy Wiseau\" title=\"Further Data\">\n    <p>Actor, director, and acclaimed fashion designer</p>\n    <x-DemoChart data:='[50, 13, 94]' ></x-DemoChart>\n</x-DemoModal>\n\n"); // "<x-DemoChart\n    data:='[1, 2, 3, 5, 8]'\n></x-DemoChart>\n\n<x-DemoModal button=\"Nicholas Cage\" title=\"Biography\">\n    <p>Prolific Hollywood actor</p>\n    <img src=\"https://www.placecage.com/640/360\" />\n</x-DemoModal>\n\n<x-DemoModal button=\"Tommy Wiseau\" title=\"Further Data\">\n    <p>Actor, director, and acclaimed fashion designer</p>\n    <x-DemoChart data:='[50, 13, 94]' ></x-DemoChart>\n</x-DemoModal>"

return OUT.join("");
};Modulo.assets.functions["9bs2ga"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <div style=\"float: right\">\n        <p><label>Hue:<br />\n            <input [state.bind] name=\"hue\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" />\n        </label></p>\n        <p><label>Saturation: <br />\n            <input [state.bind] name=\"sat\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n        <p><label>Luminosity:<br />\n            <input [state.bind] name=\"lum\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n    </div>\n    <div style=\"\n        width: 80px; height: 80px;\n        background: hsl("); // "<div style=\"float: right\">\n        <p><label>Hue:<br />\n            <input [state.bind] name=\"hue\" type=\"range\" min=\"0\" max=\"359\" step=\"1\" />\n        </label></p>\n        <p><label>Saturation: <br />\n            <input [state.bind] name=\"sat\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n        <p><label>Luminosity:<br />\n            <input [state.bind] name=\"lum\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" />\n            </label></p>\n    </div>\n    <div style=\"\n        width: 80px; height: 80px;\n        background: hsl("
OUT.push(G.escapeText(CTX.state.hue)); // "state.hue"
OUT.push(", "); // ","
OUT.push(G.escapeText(CTX.state.sat)); // "state.sat"
OUT.push("%, "); // "%,"
OUT.push(G.escapeText(CTX.state.lum)); // "state.lum"
OUT.push("%)\">\n    </div>\n"); // "%)\">\n    </div>"

return OUT.join("");
};Modulo.assets.functions["dfca1k"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function fetchGitHub() {
        fetch(`https://api.github.com/users/${state.search}`)
            .then(response => response.json())
            .then(githubCallback);
    }
    function githubCallback(apiData) {
        state.name = apiData.name;
        state.location = apiData.location;
        state.bio = apiData.bio;
        element.rerender();
    }

return { "fetchGitHub": typeof fetchGitHub !== "undefined" ? fetchGitHub : undefined,
"githubCallback": typeof githubCallback !== "undefined" ? githubCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["ki6eec"]= function (Modulo, factory, module, component, template, style, props, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'style') style = value; if (name === 'props') props = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        let egTexts = null;
        try {
            if ('eg-eg' in Modulo.factoryInstances) {
                egTexts = Modulo.factoryInstances['eg-eg']
                    .baseRenderObj.script.exports.componentTexts;
            }
        } catch {
            console.log('couldnt get egTexts');
        }

        let exCounter = 0; // global variable
        //console.log('gettin script tagged');
        /* Configure loader: */
        function initializedCallback() {
            //console.log('hey i am getting initialized wow');
            //console.log('initialized callback', element.innerHTML);
            if (Modulo.isBackend) {
                let html;
                if (egTexts && props.cname) {
                    Modulo.assert(props.cname in egTexts, `${props.cname} not found`);
                    html = egTexts[props.cname];
                } else {
                    html = (element.innerHTML || '').trim();
                    html = html.replace(/([\w\[\]\._-]+):="(\w+)"/, '$1:=$2'); // clean up due to DOM
                }

                if (props.textsrc) {
                    const html = Modulo.require('fs')
                        .readFileSync('./docs-src/' + props.textsrc, 'utf8');
                    element.setAttribute('text', html);
                } else if (html && !element.getAttribute('text')) {
                    element.setAttribute('text', html);
                }
            }
        }

        function previewspotMount({el}) {
            element.previewSpot = el.firstElementChild;
            run(); // mount after first render
        }

        function codemirrorMount({el}) {
            if (Modulo.globals.CodeMirror) {
                //console.log('this is props', props);
                // TODO: Debug this, should not use textarea, should not need
                // extra refreshes or anything
                const cm = CodeMirror.fromTextArea(el, {
                    lineNumbers: true,
                    mode: 'django',
                    theme: 'eclipse',
                    indentUnit: 4,
                });
                element.codeMirrorEditor = cm;
                window.cm = cm;

                const height = props.vsize ? Number(props.vsize) : 170;
                cm.setValue('');
                cm.setSize(null, height);
                cm.refresh();

                let text = props.text.trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                cm.setValue(text);
                setTimeout(() => {
                    cm.setValue(text);
                    cm.setSize(null, height);
                    cm.refresh();
                }, 1);
                el.setAttribute('modulo-ignore', 'y');
            } else {
                //console.log('Code mirror not found'); // probably SSG
            }
        }

        function run() {
            if (!Modulo.globals.CodeMirror) {
                return;
            }
            exCounter++;
            //console.log('There are ', exCounter, ' examples on this page. Gee!')
            const namespace = `e${exCounter}g${state.nscounter}`; // TODO: later do hot reloading using same loader
            state.nscounter++;
            const loadOpts = {src: '', namespace};
            const loader = new Modulo.Loader(null, {options: loadOpts});
            const tagName = 'Example';
            let text = element.codeMirrorEditor.getValue();
            text = `<template mod-component="${tagName}">${text}</template>`;
            //console.log('Creating component from text:', text)
            loader.loadString(text);
            const tag = `${namespace}-${tagName}`;
            let extraPropsStr = '';
            /*
            const extraProps =  props.extraprops ? JSON.parse(props.extraprops) : {};
            for (const [key, value] of Object.entries(extraProps)) {
                const escValue = value.replace(/"/g, , '&quot;');
                extraPropsStr += ` ${key}="${escValue}"`;
            }
            */

            const preview = `<${tag}${extraPropsStr}></${tag}>`;
            element.previewSpot.innerHTML = preview;
            //state.preview = preview;
            //document.querySelector('#previewSpot').innerHTML = preview;
            //console.log('adding preview', preview);
        }
    
return { "initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"previewspotMount": typeof previewspotMount !== "undefined" ? previewspotMount : undefined,
"codemirrorMount": typeof codemirrorMount !== "undefined" ? codemirrorMount : undefined,
"run": typeof run !== "undefined" ? run : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["mk1elf"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    const URL = 'https://jsonplaceholder.typicode.com/posts';
    const fakedPosts = []; // Since Typicode API doesn't save it's POST
                           // data, we'll have to fake it here
    function initializedCallback() {
        refresh();
    }

    function refresh(lastdata) {
        fetch(URL).then(r => r.json()).then(data => {
            state.posts = data.concat(fakedPosts);
            element.rerender();
        });
    }

    function submit() {
        // Rename the state variables to be what the API suggests
        const postData = {
              userId: state.user,
              title: state.topic,
              body: state.comment,
        };
        state.topic = ''; // clear the comment & topic text
        state.comment = '';
        fakedPosts.push(postData); // Add to faked list

        // Set up  the POST fetch, and then refresh after
        const opts = {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: { 'Content-type': 'application/json; charset=UTF-8' },
        };
        fetch(URL, opts).then(r => r.json()).then(refresh);
    }

return { "initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"refresh": typeof refresh !== "undefined" ? refresh : undefined,
"submit": typeof submit !== "undefined" ? submit : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["nienp6"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        // console.info('factory method of ErrorCauser');
        function countUp() {
            state.num++;
        }

        function makeError() {
            console.info('makeError callback happening');
            const a = 10;
            a(); // cause error
        }
    
return { "countUp": typeof countUp !== "undefined" ? countUp : undefined,
"makeError": typeof makeError !== "undefined" ? makeError : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["o7lq06"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <form>\n        "); // "<form>"
var ARR0=CTX.state.fields;for (var KEY in ARR0) {CTX. field=ARR0[KEY]; // "for field in state.fields"
OUT.push("\n            <div class=\"field-pair\">\n                <label for=\""); // "<div class=\"field-pair\">\n                <label for=\""
OUT.push(G.escapeText(CTX.field)); // "field"
OUT.push("_"); // "_"
OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
OUT.push("\">\n                    <strong>"); // "\">\n                    <strong>"
OUT.push(G.escapeText(G.filters["capfirst"](CTX.field))); // "field|capfirst"
OUT.push(":</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type='"); // ":</strong>\n                </label>\n                <input\n                    [state.bind]\n                    type='"
if (G.filters["type"](G.filters["get"](CTX.state,CTX.field)) === "number") { // "if state|get:field|type == \"number\""
OUT.push("number"); // "number"
} else { // "else"
OUT.push("text"); // "text"
} // "endif"
OUT.push("'\n                    name=\""); // "'\n                    name=\""
OUT.push(G.escapeText(CTX.field)); // "field"
OUT.push("\"\n                    id=\""); // "\"\n                    id=\""
OUT.push(G.escapeText(CTX.field)); // "field"
OUT.push("_"); // "_"
OUT.push(G.escapeText(CTX.component.uniqueId)); // "component.uniqueId"
OUT.push("\"\n                />\n            </div>\n        "); // "\"\n                />\n            </div>"
} // "endfor"
OUT.push("\n        <button @click:=script.submit>Post comment</button>\n        <hr />\n\n        "); // "<button @click:=script.submit>Post comment</button>\n        <hr />"
var ARR0=G.filters["reversed"](CTX.state.posts);for (var KEY in ARR0) {CTX. post=ARR0[KEY]; // "for post in state.posts|reversed"
OUT.push("\n            <p>\n                "); // "<p>"
OUT.push(G.escapeText(CTX.post.userId)); // "post.userId"
OUT.push(":\n                <strong>"); // ":\n                <strong>"
OUT.push(G.escapeText(G.filters["truncate"](CTX.post.title,15))); // "post.title|truncate:15"
OUT.push("</strong>\n                "); // "</strong>"
OUT.push(G.escapeText(G.filters["truncate"](CTX.post.body,18))); // "post.body|truncate:18"
OUT.push("\n            </p>\n        "); // "</p>"
} // "endfor"
OUT.push("\n    </form>\n"); // "</form>"

return OUT.join("");
};Modulo.assets.functions["ptd3tb"]= function (){
return {
  "id": 320452827,
  "node_id": "MDEwOlJlcG9zaXRvcnkzMjA0NTI4Mjc=",
  "name": "modulo",
  "full_name": "michaelpb/modulo",
  "private": false,
  "owner": {
    "login": "michaelpb",
    "id": 181549,
    "node_id": "MDQ6VXNlcjE4MTU0OQ==",
    "avatar_url": "https://avatars.githubusercontent.com/u/181549?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/michaelpb",
    "html_url": "https://github.com/michaelpb",
    "followers_url": "https://api.github.com/users/michaelpb/followers",
    "following_url": "https://api.github.com/users/michaelpb/following{/other_user}",
    "gists_url": "https://api.github.com/users/michaelpb/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/michaelpb/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/michaelpb/subscriptions",
    "organizations_url": "https://api.github.com/users/michaelpb/orgs",
    "repos_url": "https://api.github.com/users/michaelpb/repos",
    "events_url": "https://api.github.com/users/michaelpb/events{/privacy}",
    "received_events_url": "https://api.github.com/users/michaelpb/received_events",
    "type": "User",
    "site_admin": false
  },
  "html_url": "https://github.com/michaelpb/modulo",
  "description": "Modulo.js is a minimalist javascript framewor- 🤮",
  "fork": false,
  "url": "https://api.github.com/repos/michaelpb/modulo",
  "forks_url": "https://api.github.com/repos/michaelpb/modulo/forks",
  "keys_url": "https://api.github.com/repos/michaelpb/modulo/keys{/key_id}",
  "collaborators_url": "https://api.github.com/repos/michaelpb/modulo/collaborators{/collaborator}",
  "teams_url": "https://api.github.com/repos/michaelpb/modulo/teams",
  "hooks_url": "https://api.github.com/repos/michaelpb/modulo/hooks",
  "issue_events_url": "https://api.github.com/repos/michaelpb/modulo/issues/events{/number}",
  "events_url": "https://api.github.com/repos/michaelpb/modulo/events",
  "assignees_url": "https://api.github.com/repos/michaelpb/modulo/assignees{/user}",
  "branches_url": "https://api.github.com/repos/michaelpb/modulo/branches{/branch}",
  "tags_url": "https://api.github.com/repos/michaelpb/modulo/tags",
  "blobs_url": "https://api.github.com/repos/michaelpb/modulo/git/blobs{/sha}",
  "git_tags_url": "https://api.github.com/repos/michaelpb/modulo/git/tags{/sha}",
  "git_refs_url": "https://api.github.com/repos/michaelpb/modulo/git/refs{/sha}",
  "trees_url": "https://api.github.com/repos/michaelpb/modulo/git/trees{/sha}",
  "statuses_url": "https://api.github.com/repos/michaelpb/modulo/statuses/{sha}",
  "languages_url": "https://api.github.com/repos/michaelpb/modulo/languages",
  "stargazers_url": "https://api.github.com/repos/michaelpb/modulo/stargazers",
  "contributors_url": "https://api.github.com/repos/michaelpb/modulo/contributors",
  "subscribers_url": "https://api.github.com/repos/michaelpb/modulo/subscribers",
  "subscription_url": "https://api.github.com/repos/michaelpb/modulo/subscription",
  "commits_url": "https://api.github.com/repos/michaelpb/modulo/commits{/sha}",
  "git_commits_url": "https://api.github.com/repos/michaelpb/modulo/git/commits{/sha}",
  "comments_url": "https://api.github.com/repos/michaelpb/modulo/comments{/number}",
  "issue_comment_url": "https://api.github.com/repos/michaelpb/modulo/issues/comments{/number}",
  "contents_url": "https://api.github.com/repos/michaelpb/modulo/contents/{+path}",
  "compare_url": "https://api.github.com/repos/michaelpb/modulo/compare/{base}...{head}",
  "merges_url": "https://api.github.com/repos/michaelpb/modulo/merges",
  "archive_url": "https://api.github.com/repos/michaelpb/modulo/{archive_format}{/ref}",
  "downloads_url": "https://api.github.com/repos/michaelpb/modulo/downloads",
  "issues_url": "https://api.github.com/repos/michaelpb/modulo/issues{/number}",
  "pulls_url": "https://api.github.com/repos/michaelpb/modulo/pulls{/number}",
  "milestones_url": "https://api.github.com/repos/michaelpb/modulo/milestones{/number}",
  "notifications_url": "https://api.github.com/repos/michaelpb/modulo/notifications{?since,all,participating}",
  "labels_url": "https://api.github.com/repos/michaelpb/modulo/labels{/name}",
  "releases_url": "https://api.github.com/repos/michaelpb/modulo/releases{/id}",
  "deployments_url": "https://api.github.com/repos/michaelpb/modulo/deployments",
  "created_at": "2020-12-11T03:08:21Z",
  "updated_at": "2022-05-03T19:15:19Z",
  "pushed_at": "2022-05-22T14:14:20Z",
  "git_url": "git://github.com/michaelpb/modulo.git",
  "ssh_url": "git@github.com:michaelpb/modulo.git",
  "clone_url": "https://github.com/michaelpb/modulo.git",
  "svn_url": "https://github.com/michaelpb/modulo",
  "homepage": "https://modulojs.org/",
  "size": 6074,
  "stargazers_count": 2,
  "watchers_count": 2,
  "language": "JavaScript",
  "has_issues": true,
  "has_projects": true,
  "has_downloads": true,
  "has_wiki": true,
  "has_pages": true,
  "forks_count": 0,
  "mirror_url": null,
  "archived": false,
  "disabled": false,
  "open_issues_count": 0,
  "license": {
    "key": "lgpl-2.1",
    "name": "GNU Lesser General Public License v2.1",
    "spdx_id": "LGPL-2.1",
    "url": "https://api.github.com/licenses/lgpl-2.1",
    "node_id": "MDc6TGljZW5zZTEx"
  },
  "allow_forking": true,
  "is_template": false,
  "topics": [
    "component-based",
    "framework",
    "html",
    "javascript",
    "state-management",
    "template-engine",
    "vanilla-js",
    "web-components"
  ],
  "visibility": "public",
  "forks": 0,
  "open_issues": 0,
  "watchers": 2,
  "default_branch": "main",
  "temp_clone_token": null,
  "network_count": 0,
  "subscribers_count": 1
};
};Modulo.assets.functions["uon9pj"]= function (Modulo, factory, module, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        // Splits up own source-code to get source for each example
        let myText = Modulo.fetchQ.data['/components/embeddedexampleslib.html'];
        //console.log('this si keys', Object.keys(Modulo.fetchQ.data));
        //console.log('this si myText', myText);
        const componentTexts = {};
        if (!myText) {
            console.error('ERROR: Could not load own text :(');
            myText = '';
        }
        let name = '';
        let currentComponent = '';
        let inTestSuite = false;
        for (const line of myText.split('\n')) {
            const lower = line.toLowerCase();
            if (lower.startsWith('</component>')) {
                componentTexts[name] = currentComponent;
                currentComponent = '';
                name = null;
            } else if (lower.startsWith('<component')) {
                name = line.split(' name="')[1].split('"')[0];
            } else if (lower.startsWith('<testsuite')) {
                inTestSuite = true;
            } else if (lower.includes('</testsuite>')) {
                inTestSuite = false;
            } else if (name && !inTestSuite) {
                currentComponent += line + '\n';
            }
        }
        script.exports.componentTexts = componentTexts;
    
return {  setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x11m00cs"]= function (Modulo, factory, module, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        let txt;

        function sloccount() {
            if (!txt) {
                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
            }
            return Modulo.require('sloc')(txt, 'js').source;
        }

        function checksum() {
            if (!txt) {
                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
            }
            const CryptoJS = Modulo.require("crypto-js");
            const hash = CryptoJS['SHA384'](txt);
            return hash.toString(CryptoJS.enc.Base64);
            //const shaObj = new jsSHA("SHA-384", "TEXT", { encoding: "UTF8" });

            //shaObj.update(txt);
            //const hash = shaObj.getHash("B64");
            //return hash;
        }

        function getGlobalInfo() {
            // Only do once to speed up SSG
            //console.log('this is Modulo', Object.keys(Modulo));
            if (!Modulo.isBackend) {
                return;
            }
            if (!Modulo.ssgStore.versionInfo) {
                const bytes = Modulo.require('fs').readFileSync('./package.json');
                const data = JSON.parse(bytes);
                Modulo.ssgStore.versionInfo = {
                    version: data.version,
                    sloc: sloccount(),
                    checksum: checksum(),
                };
            }
            return Modulo.ssgStore.versionInfo;
        }

        // https://stackoverflow.com/questions/400212/
        const {document, navigator} = Modulo.globals;
        function fallbackCopyTextToClipboard(text) {
            console.count('fallbackCopyTextToClipboard');
            var textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                var msg = successful ? 'successful' : 'unsuccessful';
                //console.log('Fallback: Copying text command was ' + msg);
            } catch (err) {
                //console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
        }

        function copyTextToClipboard(text) {
            if (!navigator.clipboard) {
                fallbackCopyTextToClipboard(text);
                return;
            }
            navigator.clipboard.writeText(text).then(function() {
                //console.log('Async: Copying to clipboard was successful!');
            }, function(err) {
                console.error('Async: Could not copy text: ', err);
            });
        }
    
return { "sloccount": typeof sloccount !== "undefined" ? sloccount : undefined,
"checksum": typeof checksum !== "undefined" ? checksum : undefined,
"getGlobalInfo": typeof getGlobalInfo !== "undefined" ? getGlobalInfo : undefined,
"fallbackCopyTextToClipboard": typeof fallbackCopyTextToClipboard !== "undefined" ? fallbackCopyTextToClipboard : undefined,
"copyTextToClipboard": typeof copyTextToClipboard !== "undefined" ? copyTextToClipboard : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x12mqs4u"]= function (CTX, G){
var OUT=[];
OUT.push("\n\n        <div id=\"news\" style=\"height: 100px; padding-top: 25px; clear: both; display: block; text-align: center\">\n            <strong>DEV LOG:</strong>\n            "); // "<div id=\"news\" style=\"height: 100px; padding-top: 25px; clear: both; display: block; text-align: center\">\n            <strong>DEV LOG:</strong>"
var ARR0=CTX.state.data;for (var KEY in ARR0) {CTX. pair=ARR0[KEY]; // "for pair in state.data"
OUT.push("\n                "); // ""
if (G.filters["get"](CTX.pair,0) === CTX.props.fn) { // "if pair|get:0 == props.fn"
OUT.push("\n                    <span style=\"text-decoration: overline underline;\">\n                        "); // "<span style=\"text-decoration: overline underline;\">"
OUT.push(G.escapeText(G.filters["get"](CTX.pair,0))); // "pair|get:0"
OUT.push(" ("); // "("
OUT.push(G.escapeText(G.filters["get"](CTX.pair,1))); // "pair|get:1"
OUT.push(")\n                    </span>\n                "); // ")\n                    </span>"
} else { // "else"
OUT.push("\n                    <a href=\"/devlog/"); // "<a href=\"/devlog/"
OUT.push(G.escapeText(G.filters["get"](CTX.pair,0))); // "pair|get:0"
OUT.push(".html\">\n                        "); // ".html\">"
OUT.push(G.escapeText(G.filters["get"](CTX.pair,0))); // "pair|get:0"
OUT.push(" ("); // "("
OUT.push(G.escapeText(G.filters["get"](CTX.pair,1))); // "pair|get:1"
OUT.push(")\n                    </a>\n                "); // ")\n                    </a>"
} // "endif"
OUT.push("\n                "); // ""
if (G.filters["get"](CTX.pair,1) != "FAQ") { // "if pair|get:1 != \"FAQ\""
OUT.push("\n                    |\n                "); // "|"
} // "endif"
OUT.push("\n            "); // ""
} // "endfor"
OUT.push("\n            "); // ""
var ARR0=CTX.state.data;for (var KEY in ARR0) {CTX. pair=ARR0[KEY]; // "for pair in state.data"
OUT.push("\n                "); // ""
if (G.filters["get"](CTX.pair,0) === CTX.props.fn) { // "if pair|get:0 == props.fn"
OUT.push("\n                    <h1>"); // "<h1>"
OUT.push(G.escapeText(G.filters["get"](CTX.pair,1))); // "pair|get:1"
OUT.push("</h1>\n                "); // "</h1>"
} // "endif"
OUT.push("\n            "); // ""
} // "endfor"
OUT.push("\n        </div>\n\n    "); // "</div>"

return OUT.join("");
};Modulo.assets.functions["x12tstpp"]= function (CTX, G){
var OUT=[];
OUT.push("\n        <div class=\"chart-container\n        "); // "<div class=\"chart-container"
if (CTX.props.animated) { // "if props.animated"
OUT.push("animated"); // "animated"
} // "endif"
OUT.push("\">\n            "); // "\">"
var ARR0=CTX.script.percent;for (var KEY in ARR0) {CTX. percent=ARR0[KEY]; // "for percent in script.percent"
OUT.push("\n                <div style=\"height: "); // "<div style=\"height:"
OUT.push(G.escapeText(CTX.percent)); // "percent"
OUT.push("px; width: "); // "px; width:"
OUT.push(G.escapeText(CTX.script.width)); // "script.width"
OUT.push("px\">\n                </div>\n            "); // "px\">\n                </div>"
} // "endfor"
OUT.push("\n        </div>\n        "); // "</div>"
if (!(CTX.props.animated)) { // "if not props.animated"
OUT.push("\n            "); // ""
var ARR1=CTX.props.data;for (var KEY in ARR1) {CTX. value=ARR1[KEY]; // "for value in props.data"
OUT.push("\n                <label style=\"width: "); // "<label style=\"width:"
OUT.push(G.escapeText(CTX.script.width)); // "script.width"
OUT.push("px\">"); // "px\">"
OUT.push(G.escapeText(CTX.value)); // "value"
OUT.push("</label>\n            "); // "</label>"
} // "endfor"
OUT.push("\n        "); // ""
} // "endif"
OUT.push("\n    "); // ""

return OUT.join("");
};Modulo.assets.functions["x14fslon"]= function (Modulo, factory, module, component, props, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function _child(label, hash, keywords=[], filepath=null) {
        if (!hash) {
            hash = label.toLowerCase()
        }
        if (hash.endsWith('.html') && filepath === null) {
            filepath = hash;
        }
        return {label, hash, keywords, filepath};
    }
    let componentTexts;
    try {
        //console.log('this is', Object.keys(Modulo.factoryInstances));
        //console.log('this is', Modulo.factoryInstances);
        componentTexts = Modulo.factoryInstances['eg-eg'].baseRenderObj.script.exports.componentTexts;
    } catch {
        console.log('couldnt get componentTexts');
        componentTexts = {};
    }
    script.exports.menu = [
        {
            label: 'Table of Contents',
            filename: '/docs/',
        },

        {
            label: 'Tutorial',
            filename: '/docs/tutorial_part1.html',
            children: [
                _child('Part 1: Components, CParts, and Loading', '/docs/tutorial_part1.html', ['cdn', 'module-embed', 'components', 'cparts', 'template', 'style', 'html & css']),
                _child('Part 2: Props, Templating, and Building', '/docs/tutorial_part2.html', ['props', 'template variables', 'template filters', 'modulo console command', 'build', 'hash']),
                _child('Part 3: State, Directives, and Scripting', '/docs/tutorial_part3.html', ['state', 'directives', 'data props', 'state.bind', 'data types', 'events', 'basic scripting']),
            ],
        },

        {
            label: 'Templating',
            filename: '/docs/templating.html',
            children: [
                _child('Templates', null, ['templating philosophy', 'templating overview']),
                _child('Variables', null, ['variable syntax', 'variable sources', 'cparts as variables']),
                _child('Filters', null, ['filter syntax', 'example filters']),
                _child('Tags', null, ['template-tag syntax', 'example use of templatetags']),
                _child('Comments', null, ['syntax', 'inline comments', 'block comments']),
                _child('Escaping', null, ['escaping HTML', 'safe filter', 'XSS injection protection']),
            ],
        },

        {
            label: 'Template Reference',
            filename: '/docs/templating-reference.html',
            children: [
                _child('Built-in Template Tags', 'templatetags', [
                    'if', 'elif', 'else', 'endif', 'for', 'empty', 'endfor',
                    'operators', 'in', 'not in', 'is', 'is not', 'lt', 'gt',
                    'comparison', 'control-flow',
                ]),
                _child('Built-in Filters', 'filters', [
                    'add', 'allow', 'capfirst', 'concat', 'default',
                    'divisibleby', 'escapejs', 'first', 'join', 'json', 'last',
                    'length', 'lower', 'number', 'pluralize', 'subtract',
                    'truncate', 'renderas', 'reversed', 'upper',
                ]),
            ],
        },

        {
            label: 'CParts',
            filename: '/docs/cparts.html',
            children: [
                _child('Props', 'props', ['accessing props', 'defining props',
                                    'setting props', 'using props']),
                _child('Template', 'template', ['custom template', 'templating engine']),
                _child('State', 'state', ['state definition', 'state data types',
                                'json', 'state variables', 'state.bind directive']),
                _child('StaticData', 'staticdata', ['loading API', 'loading json',
                                'transform function', 'bundling data']),
                _child('Script', 'script', ['javascript', 'events', 'computed properties',
                                'static execution', 'custom lifecycle methods',
                                    'script callback execution context', 'script exports']),
                _child('Style', 'style', ['CSS', 'styling', ':host', 'shadowDOM']),
                _child('Component', 'component', ['name', 'innerHTML', 'patches', 'reconciliation',
                                    'rendering mode', 'manual rerender', 'shadow',
                                    'vanish', 'vanish-into-document', 'component.event',
                                    'component.slot', 'component.dataProp']),
                //_child('Module'),
            ],
        },

        {
            label: 'Lifecycle',
            filename: '/docs/lifecycle.html',
            children: [
                _child('Lifecycle phases', 'phases',
                    ['lifestyle phases', 'lifestyle phase groups',
                     'load', 'factory', 'prepare', 'initialized',
                     'render', 'reconcile', 'update',
                     'event', 'eventCleanup', 'hooking into lifecycle',
                     'lifecycle callbacks', 'script tag callbacks']),
                _child('Factory lifecycle', 'factory',
                    ['renderObj', 'baseRenderObj', 'loadObj',
                     'dependency injection', 'middleware']),
                _child('renderObj', 'renderobj',
                    ['renderObj', 'baseRenderObj', 'loadObj',
                     'dependency injection', 'middleware']),
            ],
        },

        {
            label: 'Directives',
            filename: '/docs/directives.html',
            children: [
                _child('Directives', 'directives',
                    ['built-in directives', 'directive shortcuts',
                     'custom directives']),
                _child('Built-in directives', 'builtin', [
                        '[component.dataProp]', ':=', 'prop:=', 'JSON primitive',
                        'data-prop', 'assignment',
                        '[component.event]', '@click', '@...:=',
                        '[component.slot]', '[state.bind]',
                    ]),
                _child('Custom directives', 'custom', [
                    'refs', 'accessing dom', 'escape hatch',
                    'Mount callbacks', 'Unmount callbacks',
                    'template variables vs directives',
                    'script-tag custom directives',
                    'custom shortcuts',
                ]),
            ],
        },

        /*
        {
            label: 'API & Extension',
            filename: '/docs/api.html',
            children: [
                _child('Custom CParts', 'cparts'),
                _child('CPart Spares', 'spares'),
                _child('Custom Templating', 'template'),
                _child('Custom Filters', 'customfilters'),
                _child('Custom Template Tags', 'customtags'),
                _child('Custom Template Syntax', 'customtags'),
                _child('ModRec', 'modrec'),
                _child('DOMCursor', 'cursor'),
            ],
        },
        */

        {
            label: 'Examples',
            filename: '/demos/',
            children: [
                _child('Starter Files', 'starter', [ 'snippets',
                    'component libraries', 'bootstrap', 'download', 'zip',
                    'page layouts', 'using vanish' ]),
                _child('Example Library', 'library', Object.keys(componentTexts)),
                _child('Experiments', 'experiments', [
                    'TestSuite', 'unit testing', 
                    'custom cparts', 'Tone.js', 'audio synthesis', 'MIDI',
                    'FetchState cpart', 'jsx templating', 'babel.js',
                    'transpiling', 'cparts for apis',
                ]),
            ],
        },

        /*
        {
            label: 'Project Info',
            filename: '/docs/project-info.html',
            children: [
                _child('FAQ', 'faq'),
                _child('Framework Design Philosophy', 'philosophy'),
            ],
        },
        */
    ];

    function initializedCallback() {
        const { path, showall } = props;
        state.menu = script.exports.menu.map(o => Object.assign({}, o)); // dupe
        for (const groupObj of state.menu) {
            if (showall) {
                groupObj.active = true;
            }
            if (groupObj.filename && path && groupObj.filename.endsWith(path)) {
                groupObj.active = true;
            }
        }
    }

return { "_child": typeof _child !== "undefined" ? _child : undefined,
"initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x14n3i1s"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <button @click:=script.countUp>Hello "); // "<button @click:=script.countUp>Hello"
OUT.push(G.escapeText(CTX.state.num)); // "state.num"
OUT.push("</button>\n"); // "</button>"

return OUT.join("");
};Modulo.assets.functions["x173m149"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <p>ISO: <tt>"); // "<p>ISO: <tt>"
OUT.push(G.escapeText(CTX.state.year)); // "state.year"
OUT.push("-"); // "-"
OUT.push(G.escapeText(CTX.state.month)); // "state.month"
OUT.push("-"); // "-"
OUT.push(G.escapeText(CTX.state.day)); // "state.day"
OUT.push("</tt></p>\n    "); // "</tt></p>"
var ARR0=CTX.state.ordering;for (var KEY in ARR0) {CTX. part=ARR0[KEY]; // "for part in state.ordering"
OUT.push("\n        <label>\n            "); // "<label>"
OUT.push(G.escapeText(G.filters["get"](CTX.state,CTX.part))); // "state|get:part"
OUT.push("\n            <div>\n                <button @click:=script.next payload=\""); // "<div>\n                <button @click:=script.next payload=\""
OUT.push(G.escapeText(CTX.part)); // "part"
OUT.push("\">&uarr;</button>\n                <button @click:=script.previous payload=\""); // "\">&uarr;</button>\n                <button @click:=script.previous payload=\""
OUT.push(G.escapeText(CTX.part)); // "part"
OUT.push("\">&darr;</button>\n            </div>\n        </label>\n    "); // "\">&darr;</button>\n            </div>\n        </label>"
} // "endfor"
OUT.push("\n"); // ""

return OUT.join("");
};Modulo.assets.functions["x1as77n0"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

const symbolsStr = "%!@#=?&+~÷≠∑µ‰∂Δƒσ"; // 16 options
function setup(payload) {
    const count = Number(payload);
    let symbols = symbolsStr.substr(0, count/2).split("");
    symbols = symbols.concat(symbols); // duplicate cards
    let id = 0;
    while (id < count) {
        const index = Math.floor(Math.random()
                                    * symbols.length);
        const symbol = symbols.splice(index, 1)[0];
        state.cards.push({symbol, id});
        id++;
    }
}

function failedFlipCallback() {
    // Remove both from revealed array & set to null
    state.revealed = state.revealed.filter(
            id => id !== state.failedflip
                    && id !== state.lastflipped);
    state.failedflip = null;
    state.lastflipped = null;
    state.message = "";
    element.rerender();
}

function flip(id) {
    if (state.failedflip !== null) {
        return;
    }
    id = Number(id);
    if (state.revealed.includes(id)) {
        return; // double click
    } else if (state.lastflipped === null) {
        state.lastflipped = id;
        state.revealed.push(id);
    } else {
        state.revealed.push(id);
        const {symbol} = state.cards[id];
        const lastCard = state.cards[state.lastflipped];
        if (symbol === lastCard.symbol) {
            // Successful match! Check for win.
            const {revealed, cards} = state;
            if (revealed.length === cards.length) {
                state.message = "You win!";
                state.win = true;
            } else {
                state.message = "Nice match!";
            }
            state.lastflipped = null;
        } else {
            state.message = "No match.";
            state.failedflip = id;
            setTimeout(failedFlipCallback, 1000);
        }
    }
}

return { "setup": typeof setup !== "undefined" ? setup : undefined,
"failedFlipCallback": typeof failedFlipCallback !== "undefined" ? failedFlipCallback : undefined,
"flip": typeof flip !== "undefined" ? flip : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x1bjq2q3"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <h1>hello "); // "<h1>hello"
OUT.push("</h1>\n    "); // "</h1>"
/* // "comment"
OUT.push("\n      "); // ""
if (CTX.a) { // "if a"
OUT.push("<div>"); // "<div>"
OUT.push(G.escapeText(CTX.b)); // "b"
OUT.push("</div>"); // "</div>"
} // "endif"
OUT.push("\n      <h3>"); // "<h3>"
OUT.push(G.escapeText(G.filters["first"](CTX.state.items))); // "state.items|first"
OUT.push("</h3>\n    "); // "</h3>"
*/ // "endcomment"
OUT.push("\n    <p>Below the greeting...</p>\n"); // "<p>Below the greeting...</p>"

return OUT.join("");
};Modulo.assets.functions["x1bunisd"]= function (CTX, G){
var OUT=[];
OUT.push("\n  <div class=\"grid\">\n    "); // "<div class=\"grid\">"
var ARR0=CTX.script.exports.range;for (var KEY in ARR0) {CTX. i=ARR0[KEY]; // "for i in script.exports.range"
OUT.push("\n      <div @mouseover:=script.setNum\n        class=\"\n            "); // "<div @mouseover:=script.setNum\n        class=\""
OUT.push("\n            "); // ""
if (CTX.state.number === CTX.i) { // "if state.number == i"
OUT.push("number"); // "number"
} // "endif"
OUT.push("\n            "); // ""
if (CTX.state.number < CTX.i) { // "if state.number lt i"
OUT.push("hidden"); // "hidden"
} else { // "else"
OUT.push("\n              "); // ""
if (G.filters["divisibleby"](CTX.state.number,CTX.i)) { // "if state.number|divisibleby:i"
OUT.push("whole"); // "whole"
} // "endif"
OUT.push("\n            "); // ""
} // "endif"
OUT.push("\n        \">"); // "\">"
OUT.push(G.escapeText(CTX.i)); // "i"
OUT.push("</div>\n    "); // "</div>"
} // "endfor"
OUT.push("\n  </div>\n"); // "</div>"

return OUT.join("");
};Modulo.assets.functions["x1cdn50g"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function addItem() {
        state.list.push(state.text); // add to list
        state.text = ""; // clear input
    }

return { "addItem": typeof addItem !== "undefined" ? addItem : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x1eciili"]= function (CTX, G){
var OUT=[];
OUT.push("\n<p>"); // "<p>"
OUT.push(G.escapeText(CTX.state.name)); // "state.name"
OUT.push(" | "); // "|"
OUT.push(G.escapeText(CTX.state.location)); // "state.location"
OUT.push("</p>\n<p>"); // "</p>\n<p>"
OUT.push(G.escapeText(CTX.state.bio)); // "state.bio"
OUT.push("</p>\n<a href=\"https://github.com/"); // "</p>\n<a href=\"https://github.com/"
OUT.push(G.escapeText(CTX.state.search)); // "state.search"
OUT.push("/\" target=\"_blank\">\n    "); // "/\" target=\"_blank\">"
if (CTX.state.search) { // "if state.search"
OUT.push("github.com/"); // "github.com/"
OUT.push(G.escapeText(CTX.state.search)); // "state.search"
OUT.push("/"); // "/"
} // "endif"
OUT.push("\n</a>\n<input [state.bind] name=\"search\"\n    placeholder=\"Type GitHub username\" />\n<button @click:=script.fetchGitHub>Get Info</button>\n"); // "</a>\n<input [state.bind] name=\"search\"\n    placeholder=\"Type GitHub username\" />\n<button @click:=script.fetchGitHub>Get Info</button>"

return OUT.join("");
};Modulo.assets.functions["x1gol8eg"]= function (Modulo, factory, module, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        // Splits up own source-code to get source for each example
        const mySrc = '/components/examplelib.html';
        const myText = Modulo.fetchQ.data[mySrc];
        const componentTexts = {};
        if (myText) {
            let name = '';
            let currentComponent = '';
            let inTestSuite = false;
            for (const line of myText.split('\n')) {
                const lower = line.toLowerCase();
                if (lower.startsWith('</component>')) {
                    componentTexts[name] = currentComponent;
                    currentComponent = '';
                    name = null;
                } else if (lower.startsWith('<component')) {
                    name = line.split(' name="')[1].split('"')[0];
                } else if (lower.startsWith('<testsuite')) {
                    inTestSuite = true;
                } else if (lower.includes('</testsuite>')) {
                    inTestSuite = false;
                } else if (name && !inTestSuite) {
                    currentComponent += line + '\n';
                }
            }
        }
        script.exports.componentTexts = componentTexts;
    
return {  setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x1j6psf9"]= function (Modulo, factory, module, component, template, state, staticdata, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'staticdata') staticdata = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function typingCallback() {
        state.loading = true;
        const search = `q=${state.search}`;
        const opts = 'limit=6&fields=title,author_name,cover_i';
        const url = `${staticdata.apiBase}?${search}&${opts}`;
        _globalDebounce(() => {
            fetch(url)
                .then(response => response.json())
                .then(dataBackCallback);
        });
    }

    function dataBackCallback(data) {
        state.results = data.docs;
        state.loading = false;
        element.rerender();
    }

    let _globalDebounceTimeout = null;
    function _globalDebounce(func) {
        if (_globalDebounceTimeout) {
            clearTimeout(_globalDebounceTimeout);
        }
        _globalDebounceTimeout = setTimeout(func, 500);
    }

return { "typingCallback": typeof typingCallback !== "undefined" ? typingCallback : undefined,
"dataBackCallback": typeof dataBackCallback !== "undefined" ? dataBackCallback : undefined,
"_globalDebounce": typeof _globalDebounce !== "undefined" ? _globalDebounce : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x1kg0tea"]= function (Modulo, factory, module, component, props, template, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function initializedCallback() {
            //console.log('this is module', module);
            if (Modulo.isBackend && module) {
                //Modulo.ssgStore.navbar = module.script.getGlobalInfo();
                //Object.assign(script.exports, Modulo.ssgStore.navbar);
                const info = module.script.getGlobalInfo();
                Object.assign(script.exports, info);
                // Store results in DOM for FE JS
                element.setAttribute('script-exports', JSON.stringify(script.exports));
            } else if (element.getAttribute('script-exports')) {
                // FE JS, retrieve from DOM
                const dataStr = element.getAttribute('script-exports');
                Object.assign(script.exports, JSON.parse(dataStr));
            } else {
                //console.log('Warning: Couldnt get global info');
            }
        }
    
return { "initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x1ko2pe7"]= function (CTX, G){
var OUT=[];
OUT.push("\n\n<div>\n    <label>Username:\n        <input [state.bind] name=\"username\" /></label>\n    <label>Color (\"green\" or \"blue\"):\n        <input [state.bind] name=\"color\" /></label>\n    <label>Opacity: <input [state.bind]\n        name=\"opacity\"\n        type=\"number\" min=\"0\" max=\"1\" step=\"0.1\" /></label>\n\n    <h5 style=\"\n            opacity: "); // "<div>\n    <label>Username:\n        <input [state.bind] name=\"username\" /></label>\n    <label>Color (\"green\" or \"blue\"):\n        <input [state.bind] name=\"color\" /></label>\n    <label>Opacity: <input [state.bind]\n        name=\"opacity\"\n        type=\"number\" min=\"0\" max=\"1\" step=\"0.1\" /></label>\n\n    <h5 style=\"\n            opacity:"
OUT.push(G.escapeText(CTX.state.opacity)); // "state.opacity"
OUT.push(";\n            color: "); // ";\n            color:"
OUT.push(G.escapeText(G.filters["default"](G.filters["allow"](CTX.state.color,"green,blue"),"red"))); // "state.color|allow:'green,blue'|default:'red'"
OUT.push(";\n        \">\n        "); // ";\n        \">"
OUT.push(G.escapeText(G.filters["lower"](CTX.state.username))); // "state.username|lower"
OUT.push("\n    </h5>\n</div>\n\n"); // "</h5>\n</div>"

return OUT.join("");
};Modulo.assets.functions["x1o14j1k"]= function (CTX, G){
var OUT=[];
OUT.push("\n<ol>\n    "); // "<ol>"
var ARR0=CTX.state.list;for (var KEY in ARR0) {CTX. item=ARR0[KEY]; // "for item in state.list"
OUT.push("\n        <li>"); // "<li>"
OUT.push(G.escapeText(CTX.item)); // "item"
OUT.push("</li>\n    "); // "</li>"
} // "endfor"
OUT.push("\n    <li>\n        <input [state.bind] name=\"text\" />\n        <button @click:=script.addItem>Add</button>\n    </li>\n</ol>\n"); // "<li>\n        <input [state.bind] name=\"text\" />\n        <button @click:=script.addItem>Add</button>\n    </li>\n</ol>"

return OUT.join("");
};Modulo.assets.functions["x1rr8sab"]= function (CTX, G){
var OUT=[];
OUT.push("\n        <button @click:=script.show>"); // "<button @click:=script.show>"
OUT.push(G.escapeText(CTX.props.button)); // "props.button"
OUT.push(" ⬇☐&nbsp;</button>\n        <div class=\"modal-backdrop\"\n            @click:=script.hide\n            style=\"display: "); // "⬇☐&nbsp;</button>\n        <div class=\"modal-backdrop\"\n            @click:=script.hide\n            style=\"display:"
if (CTX.state.visible) { // "if state.visible"
OUT.push("block"); // "block"
} else { // "else"
OUT.push("none"); // "none"
} // "endif"
OUT.push("\">\n        </div>\n        <div class=\"modal-body\" style=\"\n        "); // "\">\n        </div>\n        <div class=\"modal-body\" style=\""
if (CTX.state.visible) { // "if state.visible"
OUT.push(" top: 100px; "); // "top: 100px;"
} else { // "else"
OUT.push(" top: -400px; "); // "top: -400px;"
} // "endif"
OUT.push("\">\n            <h2>"); // "\">\n            <h2>"
OUT.push(G.escapeText(CTX.props.title)); // "props.title"
OUT.push(" <button @click:=script.hide>&times;</button></h2>\n            <slot></slot>\n        </div>\n    "); // "<button @click:=script.hide>&times;</button></h2>\n            <slot></slot>\n        </div>"

return OUT.join("");
};Modulo.assets.functions["x1sconuu"]= function (Modulo, factory, module, component, props, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function prepareCallback() {
            state.value = element.value;
        }

        function setValue(val) {
            state.value = val;
            element.value = val;
            element.dispatchEvent(new Event('change'));
        }
    
return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
"setValue": typeof setValue !== "undefined" ? setValue : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x1tlnjm9"]= function (Modulo, factory, module, component, props, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function show() {
            state.visible = true;
        }
        function hide() {
            state.visible = false;
        }
    
return { "show": typeof show !== "undefined" ? show : undefined,
"hide": typeof hide !== "undefined" ? hide : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x648bme"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    script.exports.title = "ModuloNews";

return {  setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x8clbk3"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

        function toggleExample(payload) {
            if (state.selected === payload) {
                state.selected = '';
            } else {
                state.selected = payload;
            }
        }
        function initializedCallback() {
            // TODO: make sure initialized only get called once
            // TODO: Encapsolate this into a dependency pattern, if proves
            // useful
            Modulo.fetchQ.enqueue('/components/examplelib.html', (text) => {
                //Modulo.fetchQ.wait(() => _setup(text)); // not sure why -v is needed
                Modulo.fetchQ.wait(() => setTimeout(() => _setup(text), 0));
            });
        }
        function _setup(text) {
            let componentTexts;
            try {
                componentTexts = Modulo.factoryInstances['eg-eg']
                        .baseRenderObj.script.exports.componentTexts;
            } catch {
                console.log('couldnt get componentTexts (2)', Modulo.factoryInstances);
                componentTexts = null;
            }
            if (!componentTexts) {
                return;
            }

            state.examples = [];
            for (const [name, content] of Object.entries(componentTexts)) {
                state.examples.push({ name, content });
            }
            element.rerender();
        }
    
return { "toggleExample": typeof toggleExample !== "undefined" ? toggleExample : undefined,
"initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"_setup": typeof _setup !== "undefined" ? _setup : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["x8oalaf"]= function (CTX, G){
var OUT=[];
OUT.push("<div class=\"demo-wrapper\n        "); // "<div class=\"demo-wrapper"
if (CTX.state.showpreview) { // "if state.showpreview"
OUT.push("     demo-wrapper__minipreview"); // "demo-wrapper__minipreview"
} // "endif"
OUT.push("\n        "); // ""
if (CTX.state.showclipboard) { // "if state.showclipboard"
OUT.push("   demo-wrapper__clipboard  "); // "demo-wrapper__clipboard"
} // "endif"
OUT.push("\n        "); // ""
if (CTX.state.fullscreen) { // "if state.fullscreen"
OUT.push("      demo-wrapper__fullscreen "); // "demo-wrapper__fullscreen"
} // "endif"
OUT.push("\n        "); // ""
if (CTX.state.tabs.length === 1) { // "if state.tabs.length == 1"
OUT.push("demo-wrapper__notabs     "); // "demo-wrapper__notabs"
} // "endif"
OUT.push("\n    \">\n    "); // "\">"
if (CTX.state.tabs.length > 1) { // "if state.tabs.length gt 1"
OUT.push("\n        <nav class=\"TabNav\">\n            <ul>\n                "); // "<nav class=\"TabNav\">\n            <ul>"
var ARR1=CTX.state.tabs;for (var KEY in ARR1) {CTX. tab=ARR1[KEY]; // "for tab in state.tabs"
OUT.push("\n                    <li class=\"TabNav-title\n                        "); // "<li class=\"TabNav-title"
if (CTX.tab.title === CTX.state.selected) { // "if tab.title == state.selected"
OUT.push("\n                            TabNav-title--selected\n                        "); // "TabNav-title--selected"
} // "endif"
OUT.push("\n                    \"><a @click:=script.selectTab\n                            payload=\""); // "\"><a @click:=script.selectTab\n                            payload=\""
OUT.push(G.escapeText(CTX.tab.title)); // "tab.title"
OUT.push("\"\n                        >"); // "\"\n                        >"
OUT.push(G.escapeText(CTX.tab.title)); // "tab.title"
OUT.push("</a></li>\n                "); // "</a></li>"
} // "endfor"
OUT.push("\n            </ul>\n        </nav>\n    "); // "</ul>\n        </nav>"
} // "endif"
OUT.push("\n\n    <div class=\"editor-toolbar\">\n        <p style=\"font-size: 11px; width: 120px; margin-right: 10px; text-align: right;\n                    "); // "<div class=\"editor-toolbar\">\n        <p style=\"font-size: 11px; width: 120px; margin-right: 10px; text-align: right;"
if (!(CTX.state.fullscreen)) { // "if not state.fullscreen"
OUT.push(" display: none; "); // "display: none;"
} // "endif"
OUT.push("\">\n            <em>Note: This is meant for exploring features. Your work will not be saved.</em>\n        </p>\n\n        "); // "\">\n            <em>Note: This is meant for exploring features. Your work will not be saved.</em>\n        </p>"
if (CTX.state.showclipboard) { // "if state.showclipboard"
OUT.push("\n            <button class=\"m-Btn m-Btn--sm m-Btn--faded\"\n                    title=\"Copy this code\" @click:=script.doCopy>\n                Copy <span alt=\"Clipboard\">&#128203;</span>\n            </button>\n        "); // "<button class=\"m-Btn m-Btn--sm m-Btn--faded\"\n                    title=\"Copy this code\" @click:=script.doCopy>\n                Copy <span alt=\"Clipboard\">&#128203;</span>\n            </button>"
} // "endif"
OUT.push("\n\n        "); // ""
if (CTX.state.showpreview) { // "if state.showpreview"
OUT.push("\n            <button class=\"m-Btn\"\n                    title=\"Toggle full screen view of code\" @click:=script.doFullscreen>\n                "); // "<button class=\"m-Btn\"\n                    title=\"Toggle full screen view of code\" @click:=script.doFullscreen>"
if (CTX.state.fullscreen) { // "if state.fullscreen"
OUT.push("\n                    <span alt=\"Shrink\">&swarr;</span>\n                "); // "<span alt=\"Shrink\">&swarr;</span>"
} else { // "else"
OUT.push("\n                    <span alt=\"Go Full Screen\">&nearr;</span>\n                "); // "<span alt=\"Go Full Screen\">&nearr;</span>"
} // "endif"
OUT.push("\n            </button>\n            &nbsp;\n            <button class=\"m-Btn\"\n                    title=\"Run a preview of this code\" @click:=script.doRun>\n                Run <span alt=\"Refresh\">&#10227;</span>\n            </button>\n        "); // "</button>\n            &nbsp;\n            <button class=\"m-Btn\"\n                    title=\"Run a preview of this code\" @click:=script.doRun>\n                Run <span alt=\"Refresh\">&#10227;</span>\n            </button>"
} // "endif"
OUT.push("\n\n    </div>\n\n    <div class=\"side-by-side-panes\">\n        <div class=\"editor-wrapper\">\n            <div [script.codemirror] modulo-ignore>\n            </div>\n        </div>\n\n        "); // "</div>\n\n    <div class=\"side-by-side-panes\">\n        <div class=\"editor-wrapper\">\n            <div [script.codemirror] modulo-ignore>\n            </div>\n        </div>"
if (CTX.state.showpreview) { // "if state.showpreview"
OUT.push("\n            <div class=\"editor-minipreview\">\n                <div modulo-ignore>\n                    "); // "<div class=\"editor-minipreview\">\n                <div modulo-ignore>"
OUT.push(G.escapeText(G.filters["safe"](CTX.state.preview))); // "state.preview|safe"
OUT.push("\n                </div>\n            </div>\n        "); // "</div>\n            </div>"
} // "endif"
OUT.push("\n\n    </div>\n</div>\n\n"); // "</div>\n</div>"

return OUT.join("");
};Modulo.assets.functions["xa49eup"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function prepareCallback() {
        const calcResult = (state.perc / 100) * state.total;
        return { calcResult };
    }

return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["xco5ifg"]= function (CTX, G){
var OUT=[];
OUT.push("<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf8\" />\n    <title>"); // "<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf8\" />\n    <title>"
OUT.push(G.escapeText(CTX.props.pagetitle)); // "props.pagetitle"
OUT.push(" - modulojs.org</title>\n    <link rel=\"stylesheet\" href=\"/css/style.css\" />\n    <link rel=\"icon\" type=\"image/png\" href=\"/img/mono_logo.png\" />\n    <!-- Moving this to individual pages for faster / blocking load, at least for now: -->\n    <!--<script src=\"/js/codemirror_5.63.0/codemirror_bundled.js\"></script>-->\n    <!--<link rel=\"stylesheet\" href=\"/js/codemirror_5.63.0/codemirror_bundled.css\" />-->\n</head>\n<body>\n\n<div [component.slot]=\"above-navbar\">\n</div>\n\n<nav class=\"Navbar\">\n    <a href=\"/index.html\"><img src=\"/img/mono_logo.png\" style=\"height:70px\" alt=\"Modulo\" /></a>\n    <ul>\n        <li>\n            <a href=\"/index.html#about\" "); // "- modulojs.org</title>\n    <link rel=\"stylesheet\" href=\"/css/style.css\" />\n    <link rel=\"icon\" type=\"image/png\" href=\"/img/mono_logo.png\" />\n    <!-- Moving this to individual pages for faster / blocking load, at least for now: -->\n    <!--<script src=\"/js/codemirror_5.63.0/codemirror_bundled.js\"></script>-->\n    <!--<link rel=\"stylesheet\" href=\"/js/codemirror_5.63.0/codemirror_bundled.css\" />-->\n</head>\n<body>\n\n<div [component.slot]=\"above-navbar\">\n</div>\n\n<nav class=\"Navbar\">\n    <a href=\"/index.html\"><img src=\"/img/mono_logo.png\" style=\"height:70px\" alt=\"Modulo\" /></a>\n    <ul>\n        <li>\n            <a href=\"/index.html#about\""
if (CTX.props.navbar === "about") { // "if props.navbar == \"about\""
OUT.push("class=\"Navbar--selected\""); // "class=\"Navbar--selected\""
} // "endif"
OUT.push(">About</a>\n        </li>\n        <li>\n            <a href=\"/start.html\" "); // ">About</a>\n        </li>\n        <li>\n            <a href=\"/start.html\""
if (CTX.props.navbar === "start") { // "if props.navbar == \"start\""
OUT.push("class=\"Navbar--selected\""); // "class=\"Navbar--selected\""
} // "endif"
OUT.push(">Start</a>\n        </li>\n        <li>\n            <a href=\"/docs/\" "); // ">Start</a>\n        </li>\n        <li>\n            <a href=\"/docs/\""
if (CTX.props.navbar === "docs") { // "if props.navbar == \"docs\""
OUT.push("class=\"Navbar--selected\""); // "class=\"Navbar--selected\""
} // "endif"
OUT.push(">Docs</a>\n        </li>\n    </ul>\n\n    <div class=\"Navbar-rightInfo\">\n        "); // ">Docs</a>\n        </li>\n    </ul>\n\n    <div class=\"Navbar-rightInfo\">"
if (CTX.script.exports.version) { // "if script.exports.version"
OUT.push("\n            v: "); // "v:"
OUT.push(G.escapeText(CTX.script.exports.version)); // "script.exports.version"
OUT.push("<br />\n            SLOC: "); // "<br />\n            SLOC:"
OUT.push(G.escapeText(CTX.script.exports.sloc)); // "script.exports.sloc"
OUT.push(" lines<br />\n            <a href=\"https://github.com/michaelpb/modulo/\">github</a> | \n            <a href=\"https://npmjs.com/michaelpb/modulo/\">npm</a> \n        "); // "lines<br />\n            <a href=\"https://github.com/michaelpb/modulo/\">github</a> | \n            <a href=\"https://npmjs.com/michaelpb/modulo/\">npm</a>"
} else { // "else"
OUT.push("\n            <a href=\"https://github.com/michaelpb/modulo/\">Source Code\n                <br />\n                (on GitHub)\n            </a>\n        "); // "<a href=\"https://github.com/michaelpb/modulo/\">Source Code\n                <br />\n                (on GitHub)\n            </a>"
} // "endif"
OUT.push("\n    </div>\n</nav>\n\n"); // "</div>\n</nav>"
if (CTX.props.docbarselected) { // "if props.docbarselected"
OUT.push("\n    <main class=\"Main Main--fluid Main--withSidebar\">\n        <aside class=\"TitleAside TitleAside--navBar\" >\n            <h3><span alt=\"Lower-case delta\">%</span></h3>\n            <nav class=\"TitleAside-navigation\">\n                <h3>Documentation</h3>\n                <mws-DocSidebar path=\""); // "<main class=\"Main Main--fluid Main--withSidebar\">\n        <aside class=\"TitleAside TitleAside--navBar\" >\n            <h3><span alt=\"Lower-case delta\">%</span></h3>\n            <nav class=\"TitleAside-navigation\">\n                <h3>Documentation</h3>\n                <mws-DocSidebar path=\""
OUT.push(G.escapeText(CTX.props.docbarselected)); // "props.docbarselected"
OUT.push("\"></mws-DocSidebar>\n            </nav>\n        </aside>\n        <aside style=\"border: none\" [component.slot]>\n        </aside>\n    </main>\n"); // "\"></mws-DocSidebar>\n            </nav>\n        </aside>\n        <aside style=\"border: none\" [component.slot]>\n        </aside>\n    </main>"
} else { // "else"
OUT.push("\n    <main class=\"Main\" [component.slot]>\n    </main>\n"); // "<main class=\"Main\" [component.slot]>\n    </main>"
} // "endif"
OUT.push("\n\n<footer>\n    <main>\n        (C) 2022 - Michael Bethencourt - Documentation under LGPL 3.0\n    </main>\n</footer>\n\n</body>\n</html>\n"); // "<footer>\n    <main>\n        (C) 2022 - Michael Bethencourt - Documentation under LGPL 3.0\n    </main>\n</footer>\n\n</body>\n</html>"

return OUT.join("");
};Modulo.assets.functions["xf92622"]= function (CTX, G){
var OUT=[];
OUT.push("\n        "); // ""
var ARR0=CTX.state.examples;for (var KEY in ARR0) {CTX. example=ARR0[KEY]; // "for example in state.examples"
OUT.push("\n            "); // ""
if (CTX.example.name === CTX.state.selected) { // "if example.name == state.selected"
OUT.push("\n                <div class=\"Example expanded\">\n                    <button class=\"tool-button\" alt=\"Edit\" title=\"Hide source code & editor\"\n                        @click:=script.toggleExample payload=\""); // "<div class=\"Example expanded\">\n                    <button class=\"tool-button\" alt=\"Edit\" title=\"Hide source code & editor\"\n                        @click:=script.toggleExample payload=\""
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push("\">\n                        "); // "\">"
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push("\n                        &times;\n                    </button>\n                    <mws-Demo\n                        demotype=\"minipreview\"\n                        fromlibrary='"); // "&times;\n                    </button>\n                    <mws-Demo\n                        demotype=\"minipreview\"\n                        fromlibrary='"
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push("'\n                    ></mws-Demo>\n                </div>\n            "); // "'\n                    ></mws-Demo>\n                </div>"
} else { // "else"
OUT.push("\n                <div class=\"Example\">\n                    <button class=\"tool-button\" alt=\"Edit\" title=\"See source code & edit example\"\n                        @click:=script.toggleExample payload=\""); // "<div class=\"Example\">\n                    <button class=\"tool-button\" alt=\"Edit\" title=\"See source code & edit example\"\n                        @click:=script.toggleExample payload=\""
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push("\">\n                        "); // "\">"
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push("\n                        ✎\n                       <!--Source-->\n                    </button>\n                    <div class=\"Example-wrapper\">\n                        <eg-"); // "✎\n                       <!--Source-->\n                    </button>\n                    <div class=\"Example-wrapper\">\n                        <eg-"
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push("></eg-"); // "></eg-"
OUT.push(G.escapeText(CTX.example.name)); // "example.name"
OUT.push(">\n                    </div>\n                </div>\n            "); // ">\n                    </div>\n                </div>"
} // "endif"
OUT.push("\n        "); // ""
} // "endfor"
OUT.push("\n    "); // ""

return OUT.join("");
};Modulo.assets.functions["xfchbde"]= function (CTX, G){
var OUT=[];
OUT.push("\n        <div class=\"split\">\n            <div style=\"height: "); // "<div class=\"split\">\n            <div style=\"height:"
OUT.push(G.escapeText(G.filters["add"](G.filters["default"](G.filters["number"](CTX.props.vsize),170),2))); // "props.vsize|number|default:170|add:2"
OUT.push("px;\" modulo-ignore=\"\">\n                <textarea [script.codemirror]=\"\">                </textarea>\n            </div>\n\n            <div>\n                <div class=\"toolbar\">\n                    <h2>Preview</h2>\n                    <button @click:=\"script.run\">Run ⟳</button>\n                </div>\n                <div [script.previewspot]=\"\" class=\"preview-wrapper\">\n                    <div modulo-ignore=\"\"></div>\n                </div>\n                "); // "px;\" modulo-ignore=\"\">\n                <textarea [script.codemirror]=\"\">                </textarea>\n            </div>\n\n            <div>\n                <div class=\"toolbar\">\n                    <h2>Preview</h2>\n                    <button @click:=\"script.run\">Run ⟳</button>\n                </div>\n                <div [script.previewspot]=\"\" class=\"preview-wrapper\">\n                    <div modulo-ignore=\"\"></div>\n                </div>"
if (CTX.props.showtag) { // "if props.showtag"
OUT.push("\n                    "); // ""
if (CTX.props.preview) { // "if props.preview"
OUT.push("\n                        <div class=\"toolbar\">\n                            <h2>Tag</h2>\n                            <code>"); // "<div class=\"toolbar\">\n                            <h2>Tag</h2>\n                            <code>"
OUT.push(G.escapeText(CTX.props.preview)); // "props.preview"
OUT.push("</code>\n                        </div>\n                    "); // "</code>\n                        </div>"
} // "endif"
OUT.push("\n                "); // ""
} // "endif"
OUT.push("\n            </div>\n        </div>\n    "); // "</div>\n        </div>"

return OUT.join("");
};Modulo.assets.functions["xi80br0"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    let timeout = null;
    script.exports.properties = ["anim", "speed", "width", "pulse"];//, "offset"];
    function play() {
        state.playing = true;
        nextTick();
    }
    function pause() {
        state.playing = false;
    }
    function setEasing(payload) {
        state.easing = payload;
    }

    function nextTick() {
        if (timeout) {
            clearTimeout(timeout);
        }
        const el = element;
        timeout = setTimeout(() => {
            el.rerender();
        }, 2000 / state.speed);
    }

    function updateCallback() {
        if (state.playing) {
            while (state.data.length <= state.width) {
                state.tick++;
                state.data.push(Math.sin(state.tick / state.pulse) + 1); // add to right
            }
            state.data.shift(); // remove one from left
            nextTick();
        }
    }

return { "play": typeof play !== "undefined" ? play : undefined,
"pause": typeof pause !== "undefined" ? pause : undefined,
"setEasing": typeof setEasing !== "undefined" ? setEasing : undefined,
"nextTick": typeof nextTick !== "undefined" ? nextTick : undefined,
"updateCallback": typeof updateCallback !== "undefined" ? updateCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};Modulo.assets.functions["xp6jj6i"]= function (CTX, G){
var OUT=[];
OUT.push("\n        <a class=\"secanchor\" title=\"Click to focus on this section.\" id=\""); // "<a class=\"secanchor\" title=\"Click to focus on this section.\" id=\""
OUT.push(G.escapeText(CTX.props.name)); // "props.name"
OUT.push("\" name=\""); // "\" name=\""
OUT.push(G.escapeText(CTX.props.name)); // "props.name"
OUT.push("\" href=\"#"); // "\" href=\"#"
OUT.push(G.escapeText(CTX.props.name)); // "props.name"
OUT.push("\">#</a>\n        <h2>"); // "\">#</a>\n        <h2>"
OUT.push(G.escapeText(G.filters["safe"](CTX.component.originalHTML))); // "component.originalHTML|safe"
OUT.push("</h2>\n    "); // "</h2>"

return OUT.join("");
};
Modulo.fetchQ.data = {
  "/components/embeddedexampleslib.html": // (360 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        let myText = Modulo.fetchQ.data['/components/embeddedexampleslib.html'];
        //console.log('this si keys', Object.keys(Modulo.fetchQ.data));
        //console.log('this si myText', myText);
        const componentTexts = {};
        if (!myText) {
            console.error('ERROR: Could not load own text :(');
            myText = '';
        }
        let name = '';
        let currentComponent = '';
        let inTestSuite = false;
        for (const line of myText.split('\\n')) {
            const lower = line.toLowerCase();
            if (lower.startsWith('</component>')) {
                componentTexts[name] = currentComponent;
                currentComponent = '';
                name = null;
            } else if (lower.startsWith('<component')) {
                name = line.split(' name="')[1].split('"')[0];
            } else if (lower.startsWith('<testsuite')) {
                inTestSuite = true;
            } else if (lower.includes('</testsuite>')) {
                inTestSuite = false;
            } else if (name && !inTestSuite) {
                currentComponent += line + '\\n';
            }
        }
        script.exports.componentTexts = componentTexts;
    </script>
</module>



<component name="Templating_1">
<Template>
<p>There are <em>{{ state.count }}
  {{ state.count|pluralize:"articles,article" }}</em>
  on {{ script.exports.title }}.</p>

{# Show the articles #}
{% for article in state.articles %}
    <h4 style="color: blue">{{ article.headline|upper }}</h4>
    {% if article.tease %}
      <p>{{ article.tease|truncate:30 }}</p>
    {% endif %}
{% endfor %}
</Template>

<!-- The data below was used to render the template above -->
<State
    count:=42
    articles:='[
      {"headline": "Modulo released!",
       "tease": "The most exciting news of the century."},
      {"headline": "Can JS be fun again?"},
      {"headline": "MTL considered harmful",
       "tease": "Why constructing JS is risky business."}
    ]'
></State>
<Script>
    script.exports.title = "ModuloNews";
</Script>

<testsuite
    src="./examplelib-tests/Templating_1-tests.html"
></testsuite>

</component>


<component name="Templating_PrepareCallback">
<Template>
    <input name="perc" [state.bind] />% of
    <input name="total" [state.bind] />
    is: {{ script.calcResult }}
</Template>

<State
    perc:=50
    total:=30
></State>

<Script>
    function prepareCallback() {
        const calcResult = (state.perc / 100) * state.total;
        return { calcResult };
    }
</Script>

<Style>
    input { display: inline; width: 25px }
</Style>

<testsuite>
    <test name="renders with computed value as expected">
        <template test-values name="initial render">
          <input name="perc" value="50" [state.bind] />% of
          <input name="total" value="30" [state.bind] />
          is: 15
        </template>

        <state
            perc:=55
        ></state>

        <template test-values name="rerenders correctly if changed">
          <input name="perc" value="55" [state.bind] />% of
          <input name="total" value="30" [state.bind] />
          is: 16.5
        </template>
    </test>
</testsuite>

</component>



<component name="Templating_Comments">
<Template>
    <h1>hello {# greeting #}</h1>
    {% comment %}
      {% if a %}<div>{{ b }}</div>{% endif %}
      <h3>{{ state.items|first }}</h3>
    {% endcomment %}
    <p>Below the greeting...</p>
</Template>

<testsuite>
    <test name="Hides comments">
        <template>
            <h1>hello </h1>
            <p>Below the greeting...</p>
        </template>
    </test>
</testsuite>

</component>



<component name="Templating_Escaping">
<Template>
<p>User "<em>{{ state.username }}</em>" sent a message:</p>
<div class="msgcontent">
    {{ state.content|safe }}
</div>
</Template>

<State
    username="Little <Bobby> <Drop> &tables"
    content='
        I <i>love</i> the classic <a target="_blank"
        href="https://xkcd.com/327/">xkcd #327</a> on
        the risk of trusting <b>user inputted data</b>
    '
></State>
<Style>
    .msgcontent {
        background: #999;
        padding: 10px;
        margin: 10px;
    }
</Style>

<testsuite>
    <test name="Escapes HTML, safe works">
        <template>
            <p>User "<em>Little &lt;Bobby&gt; &lt;Drop&gt;
            &amp;tables</em>" sent a message:</p>
            <div class="msgcontent"> I <i>love</i> the classic <a
            target="_blank" href="https://xkcd.com/327/">xkcd #327</a> on
            the risk of trusting <b>user inputted data</b></div>
        </template>
    </test>
</testsuite>

</component>



<component name="Tutorial_P1">
<Template>
Hello <strong>Modulo</strong> World!
<p class="neat">Any HTML can be here!</p>
</Template>
<Style>
/* ...and any CSS here! */
strong {
    color: blue;
}
.neat {
    font-variant: small-caps;
}
:host { /* styles the entire component */
    display: inline-block;
    background-color: cornsilk;
    padding: 5px;
    box-shadow: 10px 10px 0 0 turquoise;
}
</Style>

<testsuite>
    <test name="renders as expected">
        <template>
            Hello <strong>Modulo</strong> World!
            <p class="neat">Any HTML can be here!</p>
        </template>
    </test>
</testsuite>


</component>


<component name="Tutorial_P2">
<Template>
    <p>Trying out the button...</p>
    <x-ExampleBtn
        label="Button Example"
        shape="square"
    ></x-ExampleBtn>

    <p>Another button...</p>
    <x-ExampleBtn
        label="Example 2: Rounded"
        shape="round"
    ></x-ExampleBtn>
</Template>

<testsuite>
    <test name="renders as expected">
        <template string-count=1>
            <p>Trying out the button...</p>
        </template>
        <!-- Unfortunately can't test the following... -->
        <!--
        <template>
            <button class="my-btn my-btn__square">
                Button Example
            </button>
        </template>
        <template>
            <button class="my-btn my-btn__round">
                Rounded is Great Too
            </button>
        </template>
        -->
    </test>
</testsuite>
</component>


<component name="Tutorial_P2_filters_demo">
<Template>
    <p>Trying out the button...</p>
    <x-ExampleBtn
        label="Button Example"
        shape="square"
    ></x-ExampleBtn>

    <p>Another button...</p>
    <x-ExampleBtn
        label="Example 2: Rounded"
        shape="round"
    ></x-ExampleBtn>
</Template>

<testsuite>
    <test name="renders as expected">
        <template string-count=1>
            <p>Trying out the button...</p>
        </template>
    </test>
</testsuite>


</component>



<!-- ................................ -->
<!-- . Tutorial - Part 3 ............ -->
<!-- ................................ -->

<component name="Tutorial_P3_state_demo">
<Template>
<p>Nonsense poem:</p> <pre>
Professor {{ state.verb|capfirst }} who
{{ state.verb }}ed a {{ state.noun }},
taught {{ state.verb }}ing in
the City of {{ state.noun|capfirst }},
to {{ state.count }} {{ state.noun }}s.
</pre>
</Template>

<State
    verb="toot"
    noun="kazoo"
    count="two"
></State>

<Style>
    :host {
        font-size: 0.8rem;
    }
</Style>

<testsuite>
    <test>
        <template>
            <p>Nonsense poem:</p>
            <pre>Professor Toot who tooted a kazoo, taught tooting in the City
            of Kazoo, to two kazoos. </pre>
        </template>
    </test>
</testsuite>

</component>


<component name="Tutorial_P3_state_bind">
<Template>

<div>
    <label>Username:
        <input [state.bind] name="username" /></label>
    <label>Color ("green" or "blue"):
        <input [state.bind] name="color" /></label>
    <label>Opacity: <input [state.bind]
        name="opacity"
        type="number" min="0" max="1" step="0.1" /></label>

    <h5 style="
            opacity: {{ state.opacity }};
            color: {{ state.color|allow:'green,blue'|default:'red' }};
        ">
        {{ state.username|lower }}
    </h5>
</div>

</Template>

<State
    opacity="0.5"
    color="blue"
    username="Testing_Username"
></State>

<testsuite
    src="./examplelib-tests/Tutorial_P3_state_bind-tests.html"
></testsuite>

</component>



`,// (ends: /components/embeddedexampleslib.html) 

  "/components/examplelib-tests/API-tests.html": // (43 lines)
`<test name="renders with search data">

    <template name="Ensure initial render is correct">
        <p> | </p>
        <p></p>
        <a href="https://github.com//" target="_blank"></a>
        <input [state.bind] name="search"
            placeholder="Type GitHub username" />
        <button @click:="script.fetchGitHub">Get Info</button>
    </template>

    <state search="michaelpb"></state>
    <template name="Ensure state from search box renders" test-values>
        <p> | </p>
        <p></p>
        <a href="https://github.com/michaelpb/" target="_blank">
          github.com/michaelpb/
        </a>
        <input [state.bind] name="search" value="michaelpb"
            placeholder="Type GitHub username" />
        <button @click:=script.fetchGitHub>Get Info</button>
    </template>

    <script>
        const name = 'a b c'
        const location = 'd e f'
        const bio = 'h i j'
        script.githubCallback({name, location, bio})
    </script>
    <template name="Ensure callback shows data in expected spots" test-values>
        <p>a b c | d e f</p>
        <p>h i j</p>
        <a href="https://github.com/michaelpb/" target="_blank">
          github.com/michaelpb/
        </a>
        <input [state.bind] name="search" value="michaelpb"
            placeholder="Type GitHub username" />
        <button @click:=script.fetchGitHub>Get Info</button>
    </template>

</test>

`,// (ends: /components/examplelib-tests/API-tests.html) 

  "/components/examplelib-tests/Hello-tests.html": // (45 lines)
`<test name="Renders with different numbers">
    <script name="Ensure state is initialized">
        assert: state.num === 42
    </script>

    <template name="Ensure initial render is correct">
        <button @click:="script.countUp">Hello 42</button>
    </template>

    <state
        num:=100
    ></state>

    <template name="Ensure modifying state shows new content">
        <button @click:="script.countUp">Hello 100</button>
    </template>

    <script name="Ensure count up function increments">
        script.countUp();
        assert: state.num === 101
    </script>

    <template name="Ensure re-render">
        <button @click:="script.countUp">Hello 101</button>
    </template>

    <script name="Ensure click calls count up">
        element.querySelector('button').click()
        assert: state.num === 102
    </script>

    <template name="Ensure re-render 2">
        <button @click:="script.countUp">Hello 102</button>
    </template>

    <script name="Ensure 2nd click still works (using event: macro)">
        event: click button
    </script>

    <template name="Ensure re-render 3">
        <button @click:="script.countUp">Hello 103</button>
    </template>
</test>

`,// (ends: /components/examplelib-tests/Hello-tests.html) 

  "/components/examplelib-tests/MemoryGame-tests.html": // (152 lines)
`<test name="starts a game">
    <template name="Ensure initial render is correct">
        <h3>The Symbolic Memory Game</h3>
        <p>Choose your difficulty:</p>
        <button @click:=script.setup click.payload=8>2x4</button>
        <button @click:=script.setup click.payload=16>4x4</button>
        <button @click:=script.setup click.payload=36>6x6</button>
    </template>

    <!-- Ensure starting conditions are as expected -->
    <script> assert: state.cards.length === 0 </script>
    <script> assert: state.revealed.length === 0 </script>
    <script> assert: state.message === "Good luck!" </script>
    <script> assert: state.win === false </script>
    <script> assert: state.lastflipped === null </script>

    <script name="Click the first button">
        event: click button:first-of-type
    </script>

    <script name="Ensure the state consists of expected symbols (sort to ignore order)">
        const symbols = state.cards.map(({symbol}) => symbol);
        symbols.sort();
        const expected = ["!", "!", "#", "#", "%", "%", "@", "@"];
        assert: JSON.stringify(symbols) === JSON.stringify(expected);
    </script>

    <script name="Ensure the state consists of expected IDs (sort to ignore order)">
        const ids = state.cards.map(({id}) => id);
        ids.sort();
        const expected = [0, 1, 2, 3, 4, 5, 6, 7];
        assert: JSON.stringify(ids) === JSON.stringify(expected);
    </script>

    <template name="Check tiles" string-count=8>
          class="card "
          style=" "
          @click:="script.flip"
    </template>
</test>

<test name="renders board and handles flips">
    <state
        message="Good luck!"
        cards:='[
          {"id": 0, "symbol": "A"},
          {"id": 1, "symbol": "A"},
          {"id": 2, "symbol": "B"},
          {"id": 3, "symbol": "B"},
          {"id": 4, "symbol": "C"},
          {"id": 5, "symbol": "C"},
          {"id": 6, "symbol": "D"},
          {"id": 7, "symbol": "D"}
        ]'
        revealed:='[]'
        lastflipped:=null
        failedflip:=null
    ></state>
    <template name="Ensure board render is correct">
        <div class="board ">
            <div key="c0" class="card " style=" " @click:="script.flip" click.payload="0"></div>
            <div key="c1" class="card " style=" " @click:="script.flip" click.payload="1"></div>
            <div key="c2" class="card " style=" " @click:="script.flip" click.payload="2"></div>
            <div key="c3" class="card " style=" " @click:="script.flip" click.payload="3"></div>
            <div key="c4" class="card " style=" " @click:="script.flip" click.payload="4"></div>
            <div key="c5" class="card " style=" " @click:="script.flip" click.payload="5"></div>
            <div key="c6" class="card " style=" " @click:="script.flip" click.payload="6"></div>
            <div key="c7" class="card " style=" " @click:="script.flip" click.payload="7"></div>
        </div>
        <p style=""> Good luck!</p>
    </template>

    <script>
      event: click div.card:nth-of-type(1)
    </script>

    <template name="Check that first tile was revealed" string-count=1>
        <div key="c0"
            class="card flipped "
            style=" "
            @click:=script.flip
            click.payload="0"> A </div>
    </template>

    <template name="Check that 7 other tiles are not revealed" string-count=7>
          class="card "
          style=" "
          @click:="script.flip"
    </template>
    <script> assert: state.revealed.length === 1 </script>

    <script name="Ensure nice match is shown">
      event: click div.card:nth-of-type(2)
      assert: state.message === "Nice match!"
    </script>
    <script> assert: state.revealed.length === 2 </script>

    <template name="Check that 6 other tiles are not revealed" string-count=6>
          class="card "
          style=" "
          @click:="script.flip"
    </template>
</test>

<test name="Renders winning condition">
    <state
        message="Good luck!"
        cards:='[
            {"id": 0, "symbol": "A"},
            {"id": 1, "symbol": "A"},
            {"id": 2, "symbol": "B"},
            {"id": 3, "symbol": "B"},
            {"id": 4, "symbol": "C"},
            {"id": 5, "symbol": "C"},
            {"id": 6, "symbol": "D"},
            {"id": 7, "symbol": "D"}
        ]'
        revealed:='[]'
        lastflipped:=null
        failedflip:=null
    ></state>
    <script name="When all cards are flipped, winning message is shown">
        // "Reveal" all cards
        script.flip(7);
        script.flip(6);
        script.flip(5);
        script.flip(4);
        script.flip(3);
        script.flip(2);
        script.flip(1);
        script.flip(0);
        assert: state.message === "You win!"
    </script>

    <template name="Reveals cards (A)" string-count=2>A</template>
    <template name="Reveals cards (B)" string-count=2>B</template>
    <template name="Reveals cards (C)" string-count=2>C</template>
    <template name="Reveals cards (D)" string-count=2>D</template>

    <template name="Show win message" string-count=1>
        <p style=""> You win!</p>
    </template>
    <template name="Show flipping animation" string-count=8>
        animation: flipping 0.5s infinite alternate;
    </template>

    <template name="Nothing unflipped" string-count=0>
          class="card "
    </template>
</test>

`,// (ends: /components/examplelib-tests/MemoryGame-tests.html) 

  "/components/examplelib-tests/PrimeSieve-tests.html": // (37 lines)
`<test name="renders with search data">
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" whole ">2</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" number whole ">64</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" ">3</div>
    </template>

    <script>
        // 20 is effectively 21 (since starts at 2)
        event: mouseover div:nth-child(20)
    </script>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" whole ">3</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" whole ">7</div>
    </template>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" number whole ">21</div>
    </template>

    <script>
        // 46 is effectively 47 (since starts at 2)
        event: mouseover div:nth-child(46)
    </script>
    <template name="Ensure substrings of render" string-count=1>
        <div @mouseover:="script.setNum" class=" number whole ">47</div>
    </template>

    <template name="Ensure only one whole number (since prime)"
        string-count=1>whole</template>
</test>
`,// (ends: /components/examplelib-tests/PrimeSieve-tests.html) 

  "/components/examplelib-tests/SearchBox-tests.html": // (103 lines)
`<test name="Renders based on state">
    <template name="Ensure initial render is correct" test-values>
        <p>Type a book name for "search as you type"
        (e.g. try “the lord of the rings”)</p>
        <input
            [state.bind]
            name="search"
            @keyup:=script.typingCallback
            value=""
          />
        <div class="results ">
            <div class="results-container">
                <p>No books found.</p>
            </div>
        </div>
    </template>
    <state
        search="the lord of the rings"
        loading:=true
    ></state>

    <template name="Shows loading when typing" test-values>
        <p>Type a book name for "search as you type"
        (e.g. try “the lord of the rings”)</p>
        <input
            [state.bind]
            name="search"
            @keyup:=script.typingCallback
            value="the lord of the rings"
        />
        <div class="results visible ">
            <div class="results-container">
                <img
                    src="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/0.16.1/images/loader-large.gif"
                    alt="loading" />
            </div>
        </div>
    </template>

    <script name="load test data">
        const fakeApiData ={
            "numFound": 487,
            "start": 0,
            "numFoundExact": true,
            "docs": [
                {
                    "title": "The Lord of the Rings",
                    "cover_i": 9255566,
                    "author_name": [ "J.R.R. Tolkien" ]
                },
                {
                    "title": "The Fellowship of the Ring",
                    "cover_i": 8474036,
                    "author_name": [ "J.R.R. Tolkien" ]
                },
                {
                    "title": "The Lord of the Rings Trilogy (Lord of the Rings)",
                    "cover_i": 528867
                },
                {
                    "title": "Lord of the Rings",
                    "cover_i": 1454705,
                    "author_name": [ "Cedco Publishing" ]
                },
                {
                    "title": "Lord of the Rings",
                    "cover_i": 2111453,
                    "author_name": [ "Ernest Mathijs" ]
                },
                {
                    "title": "Lords of the ring",
                    "author_name": [ "Harry Lansdown", "Alex Spillius" ]
                }
            ],
            "num_found": 487,
            "q": "the lord of the rings",
            "offset": null
        }
        script.dataBackCallback(fakeApiData)
    </script>

    <script name="ensure no longer loading">
        assert: state.loading === false
    </script>

    <template name="ensure rerender is as expected">
      <p>Type a book name for "search as you type" (e.g. try “the lord of the rings”)</p>
      <input [state.bind]="" name="search" @keyup:="script.typingCallback">
      <div class="results visible ">
        <div class="results-container">
          <div class="result"><img src="https://covers.openlibrary.org/b/id/9255566-S.jpg"><label>The Lord of the Rings</label></div>
          <div class="result"><img src="https://covers.openlibrary.org/b/id/8474036-S.jpg"><label>The Fellowship of the Ring</label></div>
          <div class="result"><img src="https://covers.openlibrary.org/b/id/528867-S.jpg"><label>The Lord of the Rings Trilogy (Lord of the Rings)</label></div>
          <div class="result"><img src="https://covers.openlibrary.org/b/id/1454705-S.jpg"><label>Lord of the Rings</label></div>
          <div class="result"><img src="https://covers.openlibrary.org/b/id/2111453-S.jpg"><label>Lord of the Rings</label></div>
          <div class="result"><img src="https://covers.openlibrary.org/b/id/undefined-S.jpg"><label>Lords of the ring</label></div>
        </div>
      </div>
    </template>
</test>


`,// (ends: /components/examplelib-tests/SearchBox-tests.html) 

  "/components/examplelib-tests/Templating_1-tests.html": // (12 lines)
`<test name="Renders initially as expected">
    <template>
        <p>There are <em>42 articles</em> on ModuloNews.</p>
        <h4 style="color: blue">MODULO RELEASED!</h4>
        <p>The most exciting news of the…</p>
        <h4 style="color: blue">CAN JS BE FUN AGAIN?</h4>
        <h4 style="color: blue">MTL CONSIDERED HARMFUL</h4>
        <p>Why constructing JS is risky …</p>
    </template>
</test>

`,// (ends: /components/examplelib-tests/Templating_1-tests.html) 

  "/components/examplelib-tests/ToDo-tests.html": // (29 lines)
`<test name="Basic functionality">

    <template name="Ensure initial render is correct" test-values>
        <ol>
            <li>Milk</li><li>Bread</li><li>Candy</li>
            <li>
                <input [state.bind] name="text" value="Beer" />
                <button @click:="script.addItem">Add</button>
            </li>
        </ol>
    </template>

    <script>
        event: click button
        assert: state.list.length === 4
    </script>

    <template name="Ensure render after adding is fine" test-values>
        <ol>
            <li>Milk</li><li>Bread</li><li>Candy</li><li>Beer</li>
            <li>
                <input [state.bind] name="text" value="" />
                <button @click:="script.addItem">Add</button>
            </li>
        </ol>
    </template>
</test>

`,// (ends: /components/examplelib-tests/ToDo-tests.html) 

  "/components/examplelib-tests/Tutorial_P3_state_bind-tests.html": // (49 lines)
`<test name="Behaves as expected">
    <template name="Ensure initial inputs are bound so render is as expected" test-values>
        <div>
            <label>Username:
                <input [state.bind] name="username" value="Testing_Username" /></label>
            <label>Color ("green" or "blue"):
                <input [state.bind] name="color" value="blue" /></label>
            <label>Opacity: <input [state.bind]
                name="opacity"
                type="number" min="0" max="1" step="0.1" value="0.5" /></label>
            <h5 style="
                    opacity: 0.5;
                    color: blue;
                ">
                testing_username
            </h5>
        </div>
    </template>

    <script>
        element.querySelector('input[name="username"]').value = 'tEsT2'
        event: keyup input[name="username"]
    </script>

    <script>
        element.querySelector('input[name="color"]').value = 'green'
        event: keyup input[name="color"]
    </script>

    <template name="Ensure changing inputs with state.bind causes updated rendering" test-values>
        <div>
            <label>Username:
                <input [state.bind] name="username" value="tEsT2" /></label>
            <label>Color ("green" or "blue"):
                <input [state.bind] name="color" value="green" /></label>
            <label>Opacity: <input [state.bind]
                name="opacity"
                type="number" min="0" max="1" step="0.1" value="0.5" /></label>
            <h5 style="
                    opacity: 0.5;
                    color: green;
                ">
                test2
            </h5>
        </div>
    </template>
</test>

`,// (ends: /components/examplelib-tests/Tutorial_P3_state_bind-tests.html) 

  "/components/examplelib.html": // (1028 lines)
`<module>
    <script>
        // Splits up own source-code to get source for each example
        const mySrc = '/components/examplelib.html';
        const myText = Modulo.fetchQ.data[mySrc];
        const componentTexts = {};
        if (myText) {
            let name = '';
            let currentComponent = '';
            let inTestSuite = false;
            for (const line of myText.split('\\n')) {
                const lower = line.toLowerCase();
                if (lower.startsWith('</component>')) {
                    componentTexts[name] = currentComponent;
                    currentComponent = '';
                    name = null;
                } else if (lower.startsWith('<component')) {
                    name = line.split(' name="')[1].split('"')[0];
                } else if (lower.startsWith('<testsuite')) {
                    inTestSuite = true;
                } else if (lower.includes('</testsuite>')) {
                    inTestSuite = false;
                } else if (name && !inTestSuite) {
                    currentComponent += line + '\\n';
                }
            }
        }
        script.exports.componentTexts = componentTexts;
    </script>
</module>

<!--
/*} else if (sName === 'style') {
    console.log('this is content', data.content);
    const content = data.content.replace(/\\*\\/.*?\\*\\//ig, '');
    // To prefix the selectors, we loop through them,
    // with this RegExp that looks for { chars
    content.replace(/([^\\r\\n,{}]+)(,(?=[^}]*{)|\\s*{)/gi, (selector, data) => {
        console.log('selector', selector);
        console.log('data', data);
    });*/
-->

<component name="Hello">

<Template>
    <button @click:=script.countUp>Hello {{ state.num }}</button>
</Template>
<State
    num:=42
></State>
<Script>
    function countUp() {
        state.num++;
    }
</Script>

<testsuite
    src="./examplelib-tests/Hello-tests.html"
></testsuite>

</component>




<component name="Simple">

<Template>
    Components can use any number of <strong>CParts</strong>.
    Here we use only <em>Style</em> and <em>Template</em>.
</Template>

<Style>
    em { color: darkgreen; }
    * { text-decoration: underline; }
</Style>

<testsuite>
    <test name="Initially renders">
        <template>
            Components can use any number of <strong>CParts</strong>.
            Here we use only <em>Style</em> and <em>Template</em>.
        </template>
    </test>
</testsuite>

</component>




<component name="ToDo">
<Template>
<ol>
    {% for item in state.list %}
        <li>{{ item }}</li>
    {% endfor %}
    <li>
        <input [state.bind] name="text" />
        <button @click:=script.addItem>Add</button>
    </li>
</ol>
</Template>

<State
    list:='["Milk", "Bread", "Candy"]'
    text="Beer"
></State>

<Script>
    function addItem() {
        state.list.push(state.text); // add to list
        state.text = ""; // clear input
    }
</Script>

<testsuite
    src="./examplelib-tests/ToDo-tests.html"
></testsuite>

</component>

<!--list:=&#39;["Milk", "Bread", "Candy"]&#39;-->


<component name="JSON">
<!-- Use StaticData CPart to include JSON from an API or file -->
<Template>
    <strong>Name:</strong> {{ staticdata.name }} <br />
    <strong>Site:</strong> {{ staticdata.homepage }} <br />
    <strong>Tags:</strong> {{ staticdata.topics|join }}
</Template>
<StaticData
    src="https://api.github.com/repos/michaelpb/modulo"
></StaticData>
</component>




<component name="JSONArray">
<!-- Use StaticData CPart to include JSON from an API or file.
You can use it for arrays as well. Note that it is "bundled"
as static data in with JS, so it does not refresh. -->
<Template>
  {% for post in staticdata %}
    <p>{% if post.completed %}&starf;{% else %}&star;{% endif %}
        {{ post.title|truncate:15 }}</p>
  {% endfor %}
</Template>
<StaticData
  src="https://jsonplaceholder.typicode.com/todos"
></StaticData>
</component>

<component name="API">
<Template>
<p>{{ state.name }} | {{ state.location }}</p>
<p>{{ state.bio }}</p>
<a href="https://github.com/{{ state.search }}/" target="_blank">
    {% if state.search %}github.com/{{ state.search }}/{% endif %}
</a>
<input [state.bind] name="search"
    placeholder="Type GitHub username" />
<button @click:=script.fetchGitHub>Get Info</button>
</Template>

<State
    search=""
    name=""
    location=""
    bio=""
></State>

<Script>
    function fetchGitHub() {
        fetch(\`https://api.github.com/users/\${state.search}\`)
            .then(response => response.json())
            .then(githubCallback);
    }
    function githubCallback(apiData) {
        state.name = apiData.name;
        state.location = apiData.location;
        state.bio = apiData.bio;
        element.rerender();
    }
</Script>

<testsuite
    src="./examplelib-tests/API-tests.html"
></testsuite>

</component>


<component name="ColorSelector">
<Template>
    <div style="float: right">
        <p><label>Hue:<br />
            <input [state.bind] name="hue" type="range" min="0" max="359" step="1" />
        </label></p>
        <p><label>Saturation: <br />
            <input [state.bind] name="sat" type="range" min="0" max="100" step="1" />
            </label></p>
        <p><label>Luminosity:<br />
            <input [state.bind] name="lum" type="range" min="0" max="100" step="1" />
            </label></p>
    </div>
    <div style="
        width: 80px; height: 80px;
        background: hsl({{ state.hue }}, {{ state.sat }}%, {{ state.lum }}%)">
    </div>
</Template>
<State
    hue:=130
    sat:=50
    lum:=50
></State>
</component>






<component name="SearchBox">
<!-- A "type as you go" search box implementation,
an example of more complicated HTML and JS behavior -->
<Template>
<p>Type a book name for "search as you type"
(e.g. try &ldquo;the lord of the rings&rdquo;)</p>

<input [state.bind] name="search"
  @keyup:=script.typingCallback />

<div class="results {% if state.search.length gt 0 %}
                      visible {% endif %}">
  <div class="results-container">
    {% if state.loading %}
      <img src="{{ staticdata.gif }}" alt="loading" />
    {% else %}
      {% for result in state.results %}
        <div class="result">
          <img
            src="{{ staticdata.cover|add:result.cover_i }}-S.jpg"
          /> <label>{{ result.title }}</label>
        </div>
      {% empty %}
        <p>No books found.</p>
      {% endfor %}
    {% endif %}
  </div>
</div>
</Template>

<State
    search=""
    results:=[]
    loading:=false
></State>

<!-- Puting long URLs down here to declutter -->
<StaticData>
{
  apiBase: 'https://openlibrary.org/search.json',
  cover: 'https://covers.openlibrary.org/b/id/',
  gif: 'https://cdnjs.cloudflare.com/ajax/libs/' +
    'semantic-ui/0.16.1/images/loader-large.gif'
}
</StaticData>

<Script>
    function typingCallback() {
        state.loading = true;
        const search = \`q=\${state.search}\`;
        const opts = 'limit=6&fields=title,author_name,cover_i';
        const url = \`\${staticdata.apiBase}?\${search}&\${opts}\`;
        _globalDebounce(() => {
            fetch(url)
                .then(response => response.json())
                .then(dataBackCallback);
        });
    }

    function dataBackCallback(data) {
        state.results = data.docs;
        state.loading = false;
        element.rerender();
    }

    let _globalDebounceTimeout = null;
    function _globalDebounce(func) {
        if (_globalDebounceTimeout) {
            clearTimeout(_globalDebounceTimeout);
        }
        _globalDebounceTimeout = setTimeout(func, 500);
    }
</Script>

<Style>
    input {
        width: 100%;
    }
    .results-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }
    .results-container > img { margin-top 30px; }
    .results {
        position: absolute;
        height: 0;
        width: 0;
        overflow: hidden;
        display: block;
        border: 2px solid #B90183;
        border-radius: 0 0 20px 20px;
        transition: height 0.2s;
        z-index: 20;
        background: white;
    }
    .results.visible {
        height: 200px;
        width: 200px;
    }
    .result {
        padding: 10px;
        width: 80px;
        position: relative;
    }
    .result label {
        position: absolute;
        width: 80px;
        background: rgba(255, 255, 255, 0.5);
        font-size: 0.7rem;
        top: 0;
        left: 0;
    }
</Style>

<testsuite
    src="./examplelib-tests/SearchBox-tests.html"
></testsuite>

</component>



<component name="DateNumberPicker">
<Template>
    <p>ISO: <tt>{{ state.year }}-{{ state.month }}-{{ state.day }}</tt></p>
    {% for part in state.ordering %}
        <label>
            {{ state|get:part }}
            <div>
                <button @click:=script.next payload="{{ part }}">&uarr;</button>
                <button @click:=script.previous payload="{{ part }}">&darr;</button>
            </div>
        </label>
    {% endfor %}
</Template>

<State
    day:=1
    month:=1
    year:=2022
    ordering:='["year", "month", "day"]'
></State>

<Script>
    function isValid({ year, month, day }) {
        month--; // Months are zero indexed
        const d = new Date(year, month, day);
        return d.getMonth() === month && d.getDate() === day && d.getFullYear() === year;
    }
    function next(part) {
        state[part]++;
        if (!isValid(state)) { // undo if not valid
            state[part]--;
        }
    }
    function previous(part) {
        state[part]--;
        if (!isValid(state)) { // undo if not valid
            state[part]++;
        }
    }
</Script>

<Style>
    :host {
        border: 1px solid black;
        padding: 10px;
        margin: 10px;
        margin-left: 0;
        display: flex;
        flex-wrap: wrap;
        font-weight: bold;
    }
    div {
        float: right;
    }
    label {
        display: block;
        width: 100%;
    }
</Style>
</component>


<component name="FlexibleForm">
<!-- Here, we have a form that's easy to update. If this gets used more
than a couple times, it could be turned into a reusable component where
the "ordering" and initial values get set via Props. -->
<Template>
    <form>
        {% for field in state.fields %}
            <div class="field-pair">
                <label for="{{ field }}_{{ component.uniqueId }}">
                    <strong>{{ field|capfirst }}:</strong>
                </label>
                <input
                    [state.bind]
                    type='{% if state|get:field|type == "string" %}text{% else %}checkbox{% endif %}'
                    name="{{ field }}"
                    id="{{ field }}_{{ component.uniqueId }}"
                />
            </div>
        {% endfor %}
    </form>
</Template>

<State
    name="Spartacus"
    topic="On the treatment of Thracian gladiators"
    subscribe:=true
    private:=false
    comment="So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink."
    fields:='["name", "topic", "comment", "private", "subscribe"]'
></State>
</component>





<component name="FlexibleFormWithAPI">
<!-- Combining the code from the previous exercise, we can interact with
APIs. Here we use a Typicode's placeholder API to make posts -->
<Template>
    <form>
        {% for field in state.fields %}
            <div class="field-pair">
                <label for="{{ field }}_{{ component.uniqueId }}">
                    <strong>{{ field|capfirst }}:</strong>
                </label>
                <input
                    [state.bind]
                    type='{% if state|get:field|type == "number" %}number{% else %}text{% endif %}'
                    name="{{ field }}"
                    id="{{ field }}_{{ component.uniqueId }}"
                />
            </div>
        {% endfor %}
        <button @click:=script.submit>Post comment</button>
        <hr />

        {% for post in state.posts|reversed %}
            <p>
                {{ post.userId }}:
                <strong>{{ post.title|truncate:15 }}</strong>
                {{ post.body|truncate:18 }}
            </p>
        {% endfor %}
    </form>
</Template>

<State
    user:=1337
    topic="On the treatment of Thracian gladiators"
    comment="So, like, Romans claim to be all about virtue, but do you know what I think? I think they stink."
    fields:='["user", "topic", "comment"]'
    posts:='[]'
></State>

<Script>
    const URL = 'https://jsonplaceholder.typicode.com/posts';
    const fakedPosts = []; // Since Typicode API doesn't save it's POST
                           // data, we'll have to fake it here
    function initializedCallback() {
        refresh();
    }

    function refresh(lastdata) {
        fetch(URL).then(r => r.json()).then(data => {
            state.posts = data.concat(fakedPosts);
            element.rerender();
        });
    }

    function submit() {
        // Rename the state variables to be what the API suggests
        const postData = {
              userId: state.user,
              title: state.topic,
              body: state.comment,
        };
        state.topic = ''; // clear the comment & topic text
        state.comment = '';
        fakedPosts.push(postData); // Add to faked list

        // Set up  the POST fetch, and then refresh after
        const opts = {
            method: 'POST',
            body: JSON.stringify(postData),
            headers: { 'Content-type': 'application/json; charset=UTF-8' },
        };
        fetch(URL, opts).then(r => r.json()).then(refresh);
    }
</Script>

</component>




<component name="Components">
<!-- Once defined, Modulo web components can be used like HTML.
DemoModal and DemoChart are already defined. Try using below! -->
<Template>

<x-DemoChart
    data:='[1, 2, 3, 5, 8]'
></x-DemoChart>

<x-DemoModal button="Nicholas Cage" title="Biography">
    <p>Prolific Hollywood actor</p>
    <img src="https://www.placecage.com/640/360" />
</x-DemoModal>

<x-DemoModal button="Tommy Wiseau" title="Further Data">
    <p>Actor, director, and acclaimed fashion designer</p>
    <x-DemoChart data:='[50, 13, 94]' ></x-DemoChart>
</x-DemoModal>

</Template>

</component>



<component name="OscillatingGraph">
<Template>

    <!-- Note that even with custom components, core properties like "style"
        are available, making CSS variables a handy way of specifying style
        overrides. -->
    <x-DemoChart
        data:=state.data
        animated:=true
        style="
            --align: center;
            --speed: {{ state.anim }};
        "
    ></x-DemoChart>

    <p>
        {% if not state.playing %}
            <button @click:=script.play alt="Play">&#x25B6;  tick: {{ state.tick }}</button>
        {% else %}
            <button @click:=script.pause alt="Pause">&#x2016;  tick: {{ state.tick }}</button>
        {% endif %}
    </p>

    {% for name in script.exports.properties %}
        <label>{{ name|capfirst }}:
            <input [state.bind]
                name="{{ name }}"
                type="range"
                min="1" max="20" step="1" />
        </label>
    {% endfor %}
</Template>

<State
    playing:=false
    speed:=10
    easing="linear"
    align="flex-end"
    tick:=1
    width:=10
    anim:=10
    speed:=10
    pulse:=1
    offset:=1
    data:=[]
></State>
<Script>
    let timeout = null;
    script.exports.properties = ["anim", "speed", "width", "pulse"];//, "offset"];
    function play() {
        state.playing = true;
        nextTick();
    }
    function pause() {
        state.playing = false;
    }
    function setEasing(payload) {
        state.easing = payload;
    }

    function nextTick() {
        if (timeout) {
            clearTimeout(timeout);
        }
        const el = element;
        timeout = setTimeout(() => {
            el.rerender();
        }, 2000 / state.speed);
    }

    function updateCallback() {
        if (state.playing) {
            while (state.data.length <= state.width) {
                state.tick++;
                state.data.push(Math.sin(state.tick / state.pulse) + 1); // add to right
            }
            state.data.shift(); // remove one from left
            nextTick();
        }
    }
</Script>
<Style>
    input {
        width: 50px;
    }
</Style>
</component>




<!--

    {% comment "Uncomment this comment to try changing the easing!" %}
    <x-DemoSelector
        [state.bind]
        name="easing"
        options:='["linear", "ease-out", "ease-in", "ease-in-out"]'
    ></x-DemoSelector>
    {% endcomment %}
-->

<component name="PrimeSieve">
<!-- Demos mouseover, template filters, template control flow,
     and static script exports -->
<Template>
  <div class="grid">
    {% for i in script.exports.range %}
      <div @mouseover:=script.setNum
        class="
            {# If-statements to check divisibility in template: #}
            {% if state.number == i %}number{% endif %}
            {% if state.number lt i %}hidden{% else %}
              {% if state.number|divisibleby:i %}whole{% endif %}
            {% endif %}
        ">{{ i }}</div>
    {% endfor %}
  </div>
</Template>

<State
    number:=64
></State>

<Script>
    // Getting big a range of numbers in JS. Use "script.exports"
    // to export this as a one-time global constant.
    // (Hint: Curious how it calculates prime? See CSS!)
    script.exports.range = 
        Array.from({length: 63}, (x, i) => i + 2);
    function setNum(payload, ev) {
        state.number = Number(ev.target.textContent);
    }
</Script>

<Style>
.grid {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    color: #ccc;
    font-weight: bold;
    width: 100%;
    margin: -5px;
}
.grid > div {
    border: 1px solid #ccc;
    cursor: crosshair;
    transition: 0.2s;
}
div.whole {
    color: white;
    background: #B90183;
}
div.hidden {
    background: #ccc;
    color: #ccc;
}

/* Color green and add asterisk */
div.number { background: green; }
div.number::after { content: "*"; }
/* Check for whole factors (an adjacent div.whole).
   If found, then hide asterisk and green */
div.whole ~ div.number { background: #B90183; }
div.whole ~ div.number::after { opacity: 0; }
</Style>

<testsuite
    src="./examplelib-tests/PrimeSieve-tests.html"
></testsuite>

</component>





<component name="MemoryGame">
<!-- A much more complicated example application -->
<Template>
{% if not state.cards.length %}
    <h3>The Symbolic Memory Game</h3>
    <p>Choose your difficulty:</p>
    <button @click:=script.setup click.payload=8>2x4</button>
    <button @click:=script.setup click.payload=16>4x4</button>
    <button @click:=script.setup click.payload=36>6x6</button>
{% else %}
    <div class="board
        {% if state.cards.length > 16 %}hard{% endif %}">
    {# Loop through each card in the "deck" (state.cards) #}
    {% for card in state.cards %}
        {# Use "key=" to speed up DOM reconciler #}
        <div key="c{{ card.id }}"
            class="card
            {% if card.id in state.revealed %}
                flipped
            {% endif %}
            "
            style="
            {% if state.win %}
                animation: flipping 0.5s infinite alternate;
                animation-delay: {{ card.id }}.{{ card.id }}s;
            {% endif %}
            "
            @click:=script.flip
            click.payload="{{ card.id }}">
            {% if card.id in state.revealed %}
                {{ card.symbol }}
            {% endif %}
        </div>
    {% endfor %}
    </div>
    <p style="{% if state.failedflip %}
                color: red{% endif %}">
        {{ state.message }}</p>
{% endif %}
</Template>

<State
    message="Good luck!"
    win:=false
    cards:=[]
    revealed:=[]
    lastflipped:=null
    failedflip:=null
></State>

<Script>
const symbolsStr = "%!@#=?&+~÷≠∑µ‰∂Δƒσ"; // 16 options
function setup(payload) {
    const count = Number(payload);
    let symbols = symbolsStr.substr(0, count/2).split("");
    symbols = symbols.concat(symbols); // duplicate cards
    let id = 0;
    while (id < count) {
        const index = Math.floor(Math.random()
                                    * symbols.length);
        const symbol = symbols.splice(index, 1)[0];
        state.cards.push({symbol, id});
        id++;
    }
}

function failedFlipCallback() {
    // Remove both from revealed array & set to null
    state.revealed = state.revealed.filter(
            id => id !== state.failedflip
                    && id !== state.lastflipped);
    state.failedflip = null;
    state.lastflipped = null;
    state.message = "";
    element.rerender();
}

function flip(id) {
    if (state.failedflip !== null) {
        return;
    }
    id = Number(id);
    if (state.revealed.includes(id)) {
        return; // double click
    } else if (state.lastflipped === null) {
        state.lastflipped = id;
        state.revealed.push(id);
    } else {
        state.revealed.push(id);
        const {symbol} = state.cards[id];
        const lastCard = state.cards[state.lastflipped];
        if (symbol === lastCard.symbol) {
            // Successful match! Check for win.
            const {revealed, cards} = state;
            if (revealed.length === cards.length) {
                state.message = "You win!";
                state.win = true;
            } else {
                state.message = "Nice match!";
            }
            state.lastflipped = null;
        } else {
            state.message = "No match.";
            state.failedflip = id;
            setTimeout(failedFlipCallback, 1000);
        }
    }
}
</Script>

<Style>
h3 {
    background: #B90183;
    border-radius: 8px;
    text-align: center;
    color: white;
    font-weight: bold;
}
.board {
    display: grid;
    grid-template-rows: repeat(4, 1fr);
    grid-template-columns: repeat(4, 1fr);
    grid-gap: 2px;
    width: 100%;
    height: 150px;
    width: 150px;
}
.board.hard {
    grid-gap: 1px;
    grid-template-rows: repeat(6, 1fr);
    grid-template-columns: repeat(6, 1fr);
}
.board > .card {
    background: #B90183;
    border: 2px solid black;
    border-radius: 1px;
    cursor: pointer;
    text-align: center;
    min-height: 15px;
    transition: background 0.3s, transform 0.3s;
    transform: scaleX(-1);
    padding-top: 2px;
    color: #B90183;
}
.board.hard > .card {
    border: none !important;
    padding: 0;
}
.board > .card.flipped {
    background: #FFFFFF;
    border: 2px solid #B90183;
    transform: scaleX(1);
}

@keyframes flipping {
    from { transform: scaleX(-1.1); background: #B90183; }
    to {   transform: scaleX(1.0);  background: #FFFFFF; }
}
</Style>

<testsuite
    src="./examplelib-tests/MemoryGame-tests.html"
></testsuite>

</component>




<component name="ConwayGameOfLife">
<Template>
  <div class="grid">
    {% for i in script.exports.range %}
        {% for j in script.exports.range %}
          <div
            @click:=script.toggle
            payload:='[ {{ i }}, {{ j }} ]'
            {% if state.cells|get:i %}
                {% if state.cells|get:i|get:j %}
                    style="background: #B90183;"
                {% endif %}
            {% endif %}
           ></div>
        {% endfor %}
    {% endfor %}
  </div>
  <div class="controls">
    {% if not state.playing %}
        <button @click:=script.play alt="Play">&#x25B6;</button>
    {% else %}
        <button @click:=script.pause alt="Pause">&#x2016;</button>
    {% endif %}

    <button @click:=script.randomize alt="Randomize">RND</button>
    <button @click:=script.clear alt="Randomize">CLR</button>
    <label>Spd: <input [state.bind]
        name="speed"
        type="number" min="1" max="10" step="1" /></label>
  </div>
</Template>

<State
    playing:=false
    speed:=3
    cells:='{
        "12": { "10": true, "11": true, "12": true },
        "11": { "12": true },
        "10": { "11": true }
    }'
></State>

<Script>
    function toggle([ i, j ]) {
        if (!state.cells[i]) {
            state.cells[i] = {};
        }
        state.cells[i][j] = !state.cells[i][j];
    }

    function play() {
        state.playing = true;
        setTimeout(() => {
            if (state.playing) {
                updateNextFrame();
                element.rerender(); // manually rerender
                play(); // cue next frame
            }
        }, 2000 / state.speed);
    }

    function pause() {
        state.playing = false;
    }

    function clear() {
        state.cells = {};
    }

    function randomize() {
        for (const i of script.exports.range) {
            for (const j of script.exports.range) {
                if (!state.cells[i]) {
                    state.cells[i] = {};
                }
                state.cells[i][j] = (Math.random() > 0.5);
            }
        }
    }

    // Helper function for getting a cell from data
    const get = (i, j) => Boolean(state.cells[i] && state.cells[i][j]);
    function updateNextFrame() {
        const nextData = {};
        for (const i of script.exports.range) {
            for (const j of script.exports.range) {
                if (!nextData[i]) {
                    nextData[i] = {};
                }
                const count = countNeighbors(i, j);
                nextData[i][j] = get(i, j) ?
                    (count === 2 || count === 3) : // stays alive
                    (count === 3); // comes alive
            }
        }
        state.cells = nextData;
    }

    function countNeighbors(i, j) {
        const neighbors = [get(i - 1, j), get(i - 1, j - 1), get(i, j - 1),
                get(i + 1, j), get(i + 1, j + 1), get(i, j + 1),
                get(i + 1, j - 1), get(i - 1, j + 1)];
        return neighbors.filter(v => v).length;
    }
    script.exports.range = Array.from({length: 24}, (x, i) => i);
</Script>

<Style>
    :host {
        display: flex;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(24, 5px);
        margin: -2px;
        grid-gap: 1px;
    }
    .grid > div {
        background: white;
        width: 5px;
        height: 5px;
    }
    input, button {
        width: 40px;
    }
</Style>

</component>

`,// (ends: /components/examplelib.html) 

  "/components/layouts.html": // (393 lines)
`<load src="./examplelib.html" namespace="eg"></load>
<load src="./embeddedexampleslib.html" namespace="docseg"></load>

<!-- NOTE: Need to put modulowebsite.html last due to peer dependencies with
     above -->
<load src="./modulowebsite.html" namespace="mws"></load>


<!--<script src="/components/layouts/globalUtils.js"></script>-->
<module>
    <script>
        let txt;

        function sloccount() {
            if (!txt) {
                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
            }
            return Modulo.require('sloc')(txt, 'js').source;
        }

        function checksum() {
            if (!txt) {
                txt = Modulo.require('fs').readFileSync('./src/Modulo.js', 'utf8');
            }
            const CryptoJS = Modulo.require("crypto-js");
            const hash = CryptoJS['SHA384'](txt);
            return hash.toString(CryptoJS.enc.Base64);
            //const shaObj = new jsSHA("SHA-384", "TEXT", { encoding: "UTF8" });

            //shaObj.update(txt);
            //const hash = shaObj.getHash("B64");
            //return hash;
        }

        function getGlobalInfo() {
            // Only do once to speed up SSG
            //console.log('this is Modulo', Object.keys(Modulo));
            if (!Modulo.isBackend) {
                return;
            }
            if (!Modulo.ssgStore.versionInfo) {
                const bytes = Modulo.require('fs').readFileSync('./package.json');
                const data = JSON.parse(bytes);
                Modulo.ssgStore.versionInfo = {
                    version: data.version,
                    sloc: sloccount(),
                    checksum: checksum(),
                };
            }
            return Modulo.ssgStore.versionInfo;
        }

        // https://stackoverflow.com/questions/400212/
        const {document, navigator} = Modulo.globals;
        function fallbackCopyTextToClipboard(text) {
            console.count('fallbackCopyTextToClipboard');
            var textArea = document.createElement("textarea");
            textArea.value = text;

            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                var msg = successful ? 'successful' : 'unsuccessful';
                //console.log('Fallback: Copying text command was ' + msg);
            } catch (err) {
                //console.error('Fallback: Oops, unable to copy', err);
            }

            document.body.removeChild(textArea);
        }

        function copyTextToClipboard(text) {
            if (!navigator.clipboard) {
                fallbackCopyTextToClipboard(text);
                return;
            }
            navigator.clipboard.writeText(text).then(function() {
                //console.log('Async: Copying to clipboard was successful!');
            }, function(err) {
                console.error('Async: Could not copy text: ', err);
            });
        }
    </script>

</module>

<component name="Page" mode="vanish-into-document">
    <props
        navbar
        docbarselected 
        pagetitle
    ></props>

    <template src="./layouts/base.html"></template>

    <script>
        function initializedCallback() {
            //console.log('this is module', module);
            if (Modulo.isBackend && module) {
                //Modulo.ssgStore.navbar = module.script.getGlobalInfo();
                //Object.assign(script.exports, Modulo.ssgStore.navbar);
                const info = module.script.getGlobalInfo();
                Object.assign(script.exports, info);
                // Store results in DOM for FE JS
                element.setAttribute('script-exports', JSON.stringify(script.exports));
            } else if (element.getAttribute('script-exports')) {
                // FE JS, retrieve from DOM
                const dataStr = element.getAttribute('script-exports');
                Object.assign(script.exports, JSON.parse(dataStr));
            } else {
                //console.log('Warning: Couldnt get global info');
            }
        }
    </script>
</component>

<component name="DevLogNav" mode="vanish">
    <props
        fn
    ></props>

    <Template>

        <div id="news" style="height: 100px; padding-top: 25px; clear: both; display: block; text-align: center">
            <strong>DEV LOG:</strong>
            {% for pair in state.data %}
                {% if pair|get:0 == props.fn %}
                    <span style="text-decoration: overline underline;">
                        {{ pair|get:0 }} ({{ pair|get:1 }})
                    </span>
                {% else %}
                    <a href="/devlog/{{ pair|get:0 }}.html">
                        {{ pair|get:0 }} ({{ pair|get:1 }})
                    </a>
                {% endif %}
                {% if pair|get:1 != "FAQ" %}
                    |
                {% endif %}
            {% endfor %}
            {% for pair in state.data %}
                {% if pair|get:0 == props.fn %}
                    <h1>{{ pair|get:1 }}</h1>
                {% endif %}
            {% endfor %}
        </div>

    </Template>

    <State
        data:='[
            ["2022-03", "Next steps for alpha"],
            ["2021-09", "Thoughts on design"],
            ["2021-01", "FAQ"]
        ]'
    ></State>

</component>

<!-- Used by demos! -->
<component name="DemoChart">
    <Props
        data
        animated
    ></Props>
    <Template>
        <div class="chart-container
        {% if props.animated %}animated{% endif %}">
            {% for percent in script.percent %}
                <div style="height: {{ percent }}px; width: {{ script.width }}px">
                </div>
            {% endfor %}
        </div>
        {% if not props.animated %}
            {% for value in props.data %}
                <label style="width: {{ script.width }}px">{{ value }}</label>
            {% endfor %}
        {% endif %}
    </Template>

    <Script>
        function prepareCallback() {
            const { data } = props;
            const max = Math.max(...data);
            const min = 0;// Math.min(...props.data),
            return {
                percent: data.map(item => ((item - min) / max) * 100),
                width: Math.floor(100 / data.length),
            }
        }
    </Script>

    <Style>
        .chart-container {
            border: 1px solid black;
            height: 100px;
            width: 100px;
            display: flex;
            align-items: flex-end;
        }
        .chart-container > div {
            box-sizing: border-box;
            background-color: #b90183;
            background-color: white;
            border: 1px solid grey;
            width: 30px;
            border-radius: 1px 5px 1px 5px;
            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);
            margin-top: -5px;
        }

        .chart-container.animated > div {
            transition: height calc(var(--speed, 10) * 0.1s) var(--easing, linear);
        }
        .chart-container > div:first-of-type {
            margin-left: -4px;
        }
        .chart-container > div:hover {
            background-color: #b90183;
        }
        label {
            display: inline-block;
        }
    </Style>
</Component>



<!-- Used by demos! -->
<component name="DemoModal">
    <Props
        button
        title
    ></Props>

    <Template>
        <button @click:=script.show>{{ props.button }} ⬇☐&nbsp;</button>
        <div class="modal-backdrop"
            @click:=script.hide
            style="display: {% if state.visible %}block{% else %}none{% endif %}">
        </div>
        <div class="modal-body" style="
        {% if state.visible %} top: 100px; {% else %} top: -400px; {% endif %}">
            <h2>{{ props.title }} <button @click:=script.hide>&times;</button></h2>
            <slot></slot>
        </div>
    </Template>

    <State
        visible:=false
    ></State>


    <Script>
        function show() {
            state.visible = true;
        }
        function hide() {
            state.visible = false;
        }
    </Script>

    <Style>
        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            height: 100vh;
            width: 100vw;
        }
        .modal-backdrop {
            background: rgba(0, 0, 0, 0.5);
            z-index: 11;
        }
        .modal-body {
            --w: 400px;
            width: var(--w);
            position: fixed;
            z-index: 12;
            left: calc(50vw - (var(--w) / 2));
            display: block;
            background: white;
            border: 7px solid black;
            border-radius: 7px;
            padding: 50px;
            transition: top 1s;
        }
        .modal-body > h2 {
            border-bottom: 3px solid black;
            color: #b90183;
            padding: 10px;
            border-top: 0;
            margin: -50px;
            margin-bottom: 50px;
        }
        .modal-body > h2 button {
            font-size: 25px;
            float: right;
            width: 50px;
        }

        button {
            font-size: 13px;
            font-weight: bold;
            border-radius: 1px 10px 1px 10px;
            background:  #b90183;
            color: black;
            border: 1px solid grey;
            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);
            cursor: default;
            margin-top: 0px;
            padding: 5px;
            background-color: white;
            margin-bottom: 4px;
        }
        button:active {
            box-shadow: inset 5px 5px 1px 1px hsla(0,0%,39.2%,.3);
            margin-top: 5px;
        }
    </Style>
</Component>


<!-- Used by demos! -->
<component name="DemoSelector">
    <Props
        onchange
        options
        name
    ></Props>

    <Template>
        {% for option in props.options %}
            <input
                type="radio" 
                id="{{ props.name }}_{{ option }}"
                name="{{ props.name }}"
                payload="{{ option }}"
                @change:=script.setValue
            /><label for="{{ props.name }}_{{ option }}">{{ option }}</label>
        {% endfor %}
    </Template>

    <State
        value=""
    ></State>

    <Script>
        function prepareCallback() {
            state.value = element.value;
        }

        function setValue(val) {
            state.value = val;
            element.value = val;
            element.dispatchEvent(new Event('change'));
        }
    </Script>


    <Style>
        label {
            font-size: 13px;
            font-weight: bold;
            border-radius: 1px 5px 1px 5px;
            background:  #b90183;
            color: black;
            border: 1px solid grey;
            box-shadow: inset -5px -5px 1px 1px hsla(0,0%,39.2%,.3);
            cursor: default;
            margin-top: 0px;
            padding: 5px;
            background-color: white;
            margin-bottom: 4px;
            margin-left: 3px;
        }
        input:checked + label {
            box-shadow: inset 5px 5px 1px 1px hsla(0,0%,39.2%,.3);
            margin-top: 5px;
        }
    </Style>
</Component>



`,// (ends: /components/layouts.html) 

  "/components/layouts/base.html": // (71 lines)
`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf8" />
    <title>{{ props.pagetitle }} - modulojs.org</title>
    <link rel="stylesheet" href="/css/style.css" />
    <link rel="icon" type="image/png" href="/img/mono_logo.png" />
    <!-- Moving this to individual pages for faster / blocking load, at least for now: -->
    <!--<script src="/js/codemirror_5.63.0/codemirror_bundled.js"></script>-->
    <!--<link rel="stylesheet" href="/js/codemirror_5.63.0/codemirror_bundled.css" />-->
</head>
<body>

<div [component.slot]="above-navbar">
</div>

<nav class="Navbar">
    <a href="/index.html"><img src="/img/mono_logo.png" style="height:70px" alt="Modulo" /></a>
    <ul>
        <li>
            <a href="/index.html#about" {% if props.navbar == "about" %}class="Navbar--selected"{% endif %}>About</a>
        </li>
        <li>
            <a href="/start.html" {% if props.navbar == "start" %}class="Navbar--selected"{% endif %}>Start</a>
        </li>
        <li>
            <a href="/docs/" {% if props.navbar == "docs" %}class="Navbar--selected"{% endif %}>Docs</a>
        </li>
    </ul>

    <div class="Navbar-rightInfo">
        {% if script.exports.version %}
            v: {{ script.exports.version }}<br />
            SLOC: {{ script.exports.sloc }} lines<br />
            <a href="https://github.com/michaelpb/modulo/">github</a> | 
            <a href="https://npmjs.com/michaelpb/modulo/">npm</a> 
        {% else %}
            <a href="https://github.com/michaelpb/modulo/">Source Code
                <br />
                (on GitHub)
            </a>
        {% endif %}
    </div>
</nav>

{% if props.docbarselected %}
    <main class="Main Main--fluid Main--withSidebar">
        <aside class="TitleAside TitleAside--navBar" >
            <h3><span alt="Lower-case delta">%</span></h3>
            <nav class="TitleAside-navigation">
                <h3>Documentation</h3>
                <mws-DocSidebar path="{{ props.docbarselected }}"></mws-DocSidebar>
            </nav>
        </aside>
        <aside style="border: none" [component.slot]>
        </aside>
    </main>
{% else %}
    <main class="Main" [component.slot]>
    </main>
{% endif %}

<footer>
    <main>
        (C) 2022 - Michael Bethencourt - Documentation under LGPL 3.0
    </main>
</footer>

</body>
</html>
`,// (ends: /components/layouts/base.html) 

  "/components/modulowebsite.html": // (728 lines)
`<component name="Section">
    <props
        name
    ></props>
    <template>
        <a class="secanchor"
            title="Click to focus on this section."
            id="{{ props.name }}"
            name="{{ props.name }}"
            href="#{{ props.name }}">#</a>
        <h2>{{ component.originalHTML|safe }}</h2>
    </template>
    <style>
        Section {
            position: relative;
        }
        h2 {
            font-weight: bold;
            color: var(--highlight-color);
            margin-bottom: 0;
        }
        a.secanchor {
            padding-top: 100px;
            color: var(--highlight-color);
            opacity: 0.3;
            display: block;
        }
        Section:hover .Section-helper {
            opacity: 1.0;
        }
    </style>
</component>


<component name="ErrorCauser">
    <template>
        <a @click:=script.makeError>Click me to cause a traceback</a>
        <a @click:=script.countUp>Click me to count: {{ state.num }}</a>

        {% if state.num gt 3 %}
            {{ state.num|brokenFilter }}
        {% endif %}
    </template>
    <state
      num:=1
    ></state>
    <script>
        // console.info('factory method of ErrorCauser');
        function countUp() {
            state.num++;
        }

        function makeError() {
            console.info('makeError callback happening');
            const a = 10;
            a(); // cause error
        }
    </script>
    <style>
        * {
            color: orangered !important;
            background: black !important;
            border: blue 5px solid;
            padding: 10px;
        }
    </style>
</component>




<component name="Demo">
    <!-- TODO: Refactor the following to take variable length props instead of 2, 3, etc-->
    <props
        text
        text2
        text3
        ttitle
        ttitle2
        ttitle3
        demotype
        fromlibrary
    ></props>
    <template src="./modulowebsite/demo.html"></template>

    <state
        tabs:='[]'
        selected:=null
        preview=""
        text=""
        nscounter:=1
        showpreview:=false
        showclipboard:=false
        fullscreen:=false
    ></state>
    <script src="./modulowebsite/demo.js"></script>
    <style src="./modulowebsite/demo.css"> </style>

</component>




<component name="DocSidebar">

<props
    path
    showall
></props>

<template>
<ul>
    {% for linkGroup in state.menu %}
        <li class="
            {% if linkGroup.children %}
                {% if linkGroup.active %}gactive{% else %}ginactive{% endif %}
            {% endif %}
            "><a href="{{ linkGroup.filename }}">{{ linkGroup.label }}</a>
            {% if linkGroup.active %}
                {% if linkGroup.children %}
                    <ul>
                    {% for childLink in linkGroup.children %}
                        <li><a
                          href="{% if childLink.filepath %}{{ childLink.filepath }}{% else %}{{ linkGroup.filename }}#{{ childLink.hash }}{% endif %}"
                            >{{ childLink.label }}</a>
                        {% if props.showall %}
                            {% if childLink.keywords.length gt 0 %}
                                <span style="margin-left: 10px; color: #aaa">(<em>Topics: {{ childLink.keywords|join:', ' }}</em>)</span>
                            {% endif %}
                        {% endif %}
                        </li>
                    {% endfor %}
                    </ul>
                {% endif %}
            {% endif %}
        </li>
    {% endfor %}


    <!--
    <li>
        Other resources:

        <ul>
            <li>
                <a href="/docs/faq.html">FAQ</a>
            <li title="Work in progress: Finalizing source code and methodically annotating entire file with extensive comments.">
                Literate Source*<br /><em>* Coming soon!</em>
            </li>
        </ul>

    </li>
    -->
    <!--<a href="/literate/src/Modulo.html">Literate source</a>-->
</ul>
</template>

<state
  menu
></state>

<script>
    function _child(label, hash, keywords=[], filepath=null) {
        if (!hash) {
            hash = label.toLowerCase()
        }
        if (hash.endsWith('.html') && filepath === null) {
            filepath = hash;
        }
        return {label, hash, keywords, filepath};
    }
    let componentTexts;
    try {
        //console.log('this is', Object.keys(Modulo.factoryInstances));
        //console.log('this is', Modulo.factoryInstances);
        componentTexts = Modulo.factoryInstances['eg-eg'].baseRenderObj.script.exports.componentTexts;
    } catch {
        console.log('couldnt get componentTexts');
        componentTexts = {};
    }
    script.exports.menu = [
        {
            label: 'Table of Contents',
            filename: '/docs/',
        },

        {
            label: 'Tutorial',
            filename: '/docs/tutorial_part1.html',
            children: [
                _child('Part 1: Components, CParts, and Loading', '/docs/tutorial_part1.html', ['cdn', 'module-embed', 'components', 'cparts', 'template', 'style', 'html & css']),
                _child('Part 2: Props, Templating, and Building', '/docs/tutorial_part2.html', ['props', 'template variables', 'template filters', 'modulo console command', 'build', 'hash']),
                _child('Part 3: State, Directives, and Scripting', '/docs/tutorial_part3.html', ['state', 'directives', 'data props', 'state.bind', 'data types', 'events', 'basic scripting']),
            ],
        },

        {
            label: 'Templating',
            filename: '/docs/templating.html',
            children: [
                _child('Templates', null, ['templating philosophy', 'templating overview']),
                _child('Variables', null, ['variable syntax', 'variable sources', 'cparts as variables']),
                _child('Filters', null, ['filter syntax', 'example filters']),
                _child('Tags', null, ['template-tag syntax', 'example use of templatetags']),
                _child('Comments', null, ['syntax', 'inline comments', 'block comments']),
                _child('Escaping', null, ['escaping HTML', 'safe filter', 'XSS injection protection']),
            ],
        },

        {
            label: 'Template Reference',
            filename: '/docs/templating-reference.html',
            children: [
                _child('Built-in Template Tags', 'templatetags', [
                    'if', 'elif', 'else', 'endif', 'for', 'empty', 'endfor',
                    'operators', 'in', 'not in', 'is', 'is not', 'lt', 'gt',
                    'comparison', 'control-flow',
                ]),
                _child('Built-in Filters', 'filters', [
                    'add', 'allow', 'capfirst', 'concat', 'default',
                    'divisibleby', 'escapejs', 'first', 'join', 'json', 'last',
                    'length', 'lower', 'number', 'pluralize', 'subtract',
                    'truncate', 'renderas', 'reversed', 'upper',
                ]),
            ],
        },

        {
            label: 'CParts',
            filename: '/docs/cparts.html',
            children: [
                _child('Props', 'props', ['accessing props', 'defining props',
                                    'setting props', 'using props']),
                _child('Template', 'template', ['custom template', 'templating engine']),
                _child('State', 'state', ['state definition', 'state data types',
                                'json', 'state variables', 'state.bind directive']),
                _child('StaticData', 'staticdata', ['loading API', 'loading json',
                                'transform function', 'bundling data']),
                _child('Script', 'script', ['javascript', 'events', 'computed properties',
                                'static execution', 'custom lifecycle methods',
                                    'script callback execution context', 'script exports']),
                _child('Style', 'style', ['CSS', 'styling', ':host', 'shadowDOM']),
                _child('Component', 'component', ['name', 'innerHTML', 'patches', 'reconciliation',
                                    'rendering mode', 'manual rerender', 'shadow',
                                    'vanish', 'vanish-into-document', 'component.event',
                                    'component.slot', 'component.dataProp']),
                //_child('Module'),
            ],
        },

        {
            label: 'Lifecycle',
            filename: '/docs/lifecycle.html',
            children: [
                _child('Lifecycle phases', 'phases',
                    ['lifestyle phases', 'lifestyle phase groups',
                     'load', 'factory', 'prepare', 'initialized',
                     'render', 'reconcile', 'update',
                     'event', 'eventCleanup', 'hooking into lifecycle',
                     'lifecycle callbacks', 'script tag callbacks']),
                _child('Factory lifecycle', 'factory',
                    ['renderObj', 'baseRenderObj', 'loadObj',
                     'dependency injection', 'middleware']),
                _child('renderObj', 'renderobj',
                    ['renderObj', 'baseRenderObj', 'loadObj',
                     'dependency injection', 'middleware']),
            ],
        },

        {
            label: 'Directives',
            filename: '/docs/directives.html',
            children: [
                _child('Directives', 'directives',
                    ['built-in directives', 'directive shortcuts',
                     'custom directives']),
                _child('Built-in directives', 'builtin', [
                        '[component.dataProp]', ':=', 'prop:=', 'JSON primitive',
                        'data-prop', 'assignment',
                        '[component.event]', '@click', '@...:=',
                        '[component.slot]', '[state.bind]',
                    ]),
                _child('Custom directives', 'custom', [
                    'refs', 'accessing dom', 'escape hatch',
                    'Mount callbacks', 'Unmount callbacks',
                    'template variables vs directives',
                    'script-tag custom directives',
                    'custom shortcuts',
                ]),
            ],
        },

        /*
        {
            label: 'API & Extension',
            filename: '/docs/api.html',
            children: [
                _child('Custom CParts', 'cparts'),
                _child('CPart Spares', 'spares'),
                _child('Custom Templating', 'template'),
                _child('Custom Filters', 'customfilters'),
                _child('Custom Template Tags', 'customtags'),
                _child('Custom Template Syntax', 'customtags'),
                _child('ModRec', 'modrec'),
                _child('DOMCursor', 'cursor'),
            ],
        },
        */

        {
            label: 'Examples',
            filename: '/demos/',
            children: [
                _child('Starter Files', 'starter', [ 'snippets',
                    'component libraries', 'bootstrap', 'download', 'zip',
                    'page layouts', 'using vanish' ]),
                _child('Example Library', 'library', Object.keys(componentTexts)),
                _child('Experiments', 'experiments', [
                    'TestSuite', 'unit testing', 
                    'custom cparts', 'Tone.js', 'audio synthesis', 'MIDI',
                    'FetchState cpart', 'jsx templating', 'babel.js',
                    'transpiling', 'cparts for apis',
                ]),
            ],
        },

        /*
        {
            label: 'Project Info',
            filename: '/docs/project-info.html',
            children: [
                _child('FAQ', 'faq'),
                _child('Framework Design Philosophy', 'philosophy'),
            ],
        },
        */
    ];

    function initializedCallback() {
        const { path, showall } = props;
        state.menu = script.exports.menu.map(o => Object.assign({}, o)); // dupe
        for (const groupObj of state.menu) {
            if (showall) {
                groupObj.active = true;
            }
            if (groupObj.filename && path && groupObj.filename.endsWith(path)) {
                groupObj.active = true;
            }
        }
    }
</script>

<style>
  li {
      margin-left: 20px;
  }
  /*
  li.ginactive > ul::before,
  li.gactive > ul::before {
      content: ' - ';
      background: var(--highlight-color);
      color: white;
      text-decoration: none;
  }
  */
  li.ginactive > a::before {
      content: '+ ';
  }
</style>

</component>



<component name="CodeExample">
    <template>
        <div class="split">
            <div
            style="height: {{ props.vsize|number|default:170|add:2 }}px;"
            modulo-ignore>
                <textarea [script.codemirror]>
                </textarea>
            </div>

            <div>
                <div class="toolbar">
                    <h2>Preview</h2>
                    <button @click:=script.run>Run &#10227;</button>
                </div>
                <div [script.previewspot] class="preview-wrapper">
                    <div modulo-ignore></div>
                </div>
                {% if props.showtag %}
                    {% if props.preview %}
                        <div class="toolbar">
                            <h2>Tag</h2>
                            <code>{{ props.preview }}</code>
                        </div>
                    {% endif %}
                {% endif %}
            </div>
        </div>
    </template>

    <style>
        .toolbar {
            display: flex;
            justify-content: space-between;
        }
        .toolbar > button {
            border: 2px solid black;
            border-top-width: 1px;
            border-bottom-width: 3px;
            border-radius: 3px;
            background: white;
            font-weight: lighter;
            text-transform: uppercase;
        }
        .toolbar > button:active {
            border-top-width: 3px;
            border-bottom-width: 1px;
        }
        .toolbar > button:hover {
            box-shadow: 0 0 2px var(--highlight-color); /* extremely subtle shadow */
        }
        .split > div:last-child {
            padding: 5px;
            background: whiteSmoke;
        }
        .split > div:first-child{
            border: 1px solid black;
            /*overflow-y: scroll;*/
        }

        .preview-wrapper {
            margin-top: 4px;
            padding: 5px;
            padding-left: 20px;
            padding-right: 20px;
            border: 1px solid black;
        }

        .split > div > textarea {
            width: 100%;
            min-height: 10px;
        }
        .split {
            display: grid;
            grid-template-columns: 2fr 1fr;
        }
        @media (max-width: 992px) {
            .split { display: block; }
        }
    </style>

    <props
        text
        extraprops
        vsize
        textsrc
        cname
    ></props>

    <state 
        nscounter:=1
        preview=''
    ></state>
    <script>
        let egTexts = null;
        try {
            if ('eg-eg' in Modulo.factoryInstances) {
                egTexts = Modulo.factoryInstances['eg-eg']
                    .baseRenderObj.script.exports.componentTexts;
            }
        } catch {
            console.log('couldnt get egTexts');
        }

        let exCounter = 0; // global variable
        //console.log('gettin script tagged');
        /* Configure loader: */
        function initializedCallback() {
            //console.log('hey i am getting initialized wow');
            //console.log('initialized callback', element.innerHTML);
            if (Modulo.isBackend) {
                let html;
                if (egTexts && props.cname) {
                    Modulo.assert(props.cname in egTexts, \`\${props.cname} not found\`);
                    html = egTexts[props.cname];
                } else {
                    html = (element.innerHTML || '').trim();
                    html = html.replace(/([\\w\\[\\]\\._-]+):="(\\w+)"/, '\$1:=\$2'); // clean up due to DOM
                }

                if (props.textsrc) {
                    const html = Modulo.require('fs')
                        .readFileSync('./docs-src/' + props.textsrc, 'utf8');
                    element.setAttribute('text', html);
                } else if (html && !element.getAttribute('text')) {
                    element.setAttribute('text', html);
                }
            }
        }

        function previewspotMount({el}) {
            element.previewSpot = el.firstElementChild;
            run(); // mount after first render
        }

        function codemirrorMount({el}) {
            if (Modulo.globals.CodeMirror) {
                //console.log('this is props', props);
                // TODO: Debug this, should not use textarea, should not need
                // extra refreshes or anything
                const cm = CodeMirror.fromTextArea(el, {
                    lineNumbers: true,
                    mode: 'django',
                    theme: 'eclipse',
                    indentUnit: 4,
                });
                element.codeMirrorEditor = cm;
                window.cm = cm;

                const height = props.vsize ? Number(props.vsize) : 170;
                cm.setValue('');
                cm.setSize(null, height);
                cm.refresh();

                let text = props.text.trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                cm.setValue(text);
                setTimeout(() => {
                    cm.setValue(text);
                    cm.setSize(null, height);
                    cm.refresh();
                }, 1);
                el.setAttribute('modulo-ignore', 'y');
            } else {
                //console.log('Code mirror not found'); // probably SSG
            }
        }

        function run() {
            if (!Modulo.globals.CodeMirror) {
                return;
            }
            exCounter++;
            //console.log('There are ', exCounter, ' examples on this page. Gee!')
            const namespace = \`e\${exCounter}g\${state.nscounter}\`; // TODO: later do hot reloading using same loader
            state.nscounter++;
            const loadOpts = {src: '', namespace};
            const loader = new Modulo.Loader(null, {options: loadOpts});
            const tagName = 'Example';
            let text = element.codeMirrorEditor.getValue();
            text = \`<template mod-component="\${tagName}">\${text}</template>\`;
            //console.log('Creating component from text:', text)
            loader.loadString(text);
            const tag = \`\${namespace}-\${tagName}\`;
            let extraPropsStr = '';
            /*
            const extraProps =  props.extraprops ? JSON.parse(props.extraprops) : {};
            for (const [key, value] of Object.entries(extraProps)) {
                const escValue = value.replace(/"/g, , '&quot;');
                extraPropsStr += \` \${key}="\${escValue}"\`;
            }
            */

            const preview = \`<\${tag}\${extraPropsStr}></\${tag}>\`;
            element.previewSpot.innerHTML = preview;
            //state.preview = preview;
            //document.querySelector('#previewSpot').innerHTML = preview;
            //console.log('adding preview', preview);
        }
    </script>
</component>



<Component name="AllExamples">
    <Template>
        {% for example in state.examples %}
            {% if example.name == state.selected %}
                <div class="Example expanded">
                    <button class="tool-button" alt="Edit" title="Hide source code & editor"
                        @click:=script.toggleExample payload="{{ example.name }}">
                        {{ example.name }}
                        &times;
                    </button>
                    <mws-Demo
                        demotype="minipreview"
                        fromlibrary='{{ example.name }}'
                    ></mws-Demo>
                </div>
            {% else %}
                <div class="Example">
                    <button class="tool-button" alt="Edit" title="See source code & edit example"
                        @click:=script.toggleExample payload="{{ example.name }}">
                        {{ example.name }}
                        ✎
                       <!--Source-->
                    </button>
                    <div class="Example-wrapper">
                        <eg-{{ example.name }}></eg-{{ example.name }}>
                    </div>
                </div>
            {% endif %}
        {% endfor %}
    </Template>

    <!--
    <mws-Section name="{{ example.name|lower }}">
        {{ example.name }}
    </mws-Section>
    <mws-Demo
        demotype="minipreview"
        fromlibrary='{{ example.name }}'
    ></mws-Demo>
    -->
    <State
        selected=""
        examples:=[]
    ></State>

    <Script>
        function toggleExample(payload) {
            if (state.selected === payload) {
                state.selected = '';
            } else {
                state.selected = payload;
            }
        }
        function initializedCallback() {
            // TODO: make sure initialized only get called once
            // TODO: Encapsolate this into a dependency pattern, if proves
            // useful
            Modulo.fetchQ.enqueue('/components/examplelib.html', (text) => {
                //Modulo.fetchQ.wait(() => _setup(text)); // not sure why -v is needed
                Modulo.fetchQ.wait(() => setTimeout(() => _setup(text), 0));
            });
        }
        function _setup(text) {
            let componentTexts;
            try {
                componentTexts = Modulo.factoryInstances['eg-eg']
                        .baseRenderObj.script.exports.componentTexts;
            } catch {
                console.log('couldnt get componentTexts (2)', Modulo.factoryInstances);
                componentTexts = null;
            }
            if (!componentTexts) {
                return;
            }

            state.examples = [];
            for (const [name, content] of Object.entries(componentTexts)) {
                state.examples.push({ name, content });
            }
            element.rerender();
        }
    </Script>

    <Style>
        :host {
            --colcount: 5;
            display: grid;
            grid-template-columns: repeat(var(--colcount), 1fr);
        }
        :host > .Example {
            border: 1px solid black;
            border-radius: 2px;
            padding: 10px;
            margin: 10px;
            min-height: 200px;
            background: #ddd;
            position: relative;
            margin-top: 50px;
        }
        .Example-wrapper {
            height: 200px;
            overflow-y: auto;
        }

        :host > .Example.expanded {
            background: transparent;
            grid-column: 1 / span var(--colcount);
        }

        :host > .Example .tool-button {
            position: absolute;
            top: -30px;
            height: 30px;
            right: 0px;
            min-width: 80px;
            border-radius: 10px 10px 0 0;
            /*border-bottom: none;*/
            background: #ddd;
        }
        :host > .Example .tool-button:hover {
            cursor: pointer;
            text-decoration: underline;
        }

        @media (max-width: 1550px) {
            :host {
                --colcount: 4;
            }
        }
        @media (max-width: 1250px) {
            :host {
                --colcount: 3;
            }
        }

        @media (max-width: 1160px) {
            :host {
                --colcount: 2;
            }
        }

        @media (max-width: 768px) {
            :host {
                --colcount: 1;
            }
        }
    </Style>
</Component>

`,// (ends: /components/modulowebsite.html) 

  "/components/modulowebsite/demo.css": // (267 lines)
`.demo-wrapper.demo-wrapper__minipreview .CodeMirror {
    height: 200px;
}

.demo-wrapper.demo-wrapper__clipboard .CodeMirror {
    height: auto;
}

.demo-wrapper.demo-wrapper__clipboard .CodeMirror * {
    font-family: monospace;
    font-size: 1rem;
}

.demo-wrapper.demo-wrapper__minipreview .CodeMirror * {
    font-family: monospace;
    font-size: 14px;
}

.demo-wrapper.demo-wrapper__fullscreen .CodeMirror {
    height: 87vh;
}
.demo-wrapper.demo-wrapper__fullscreen .CodeMirror * {
    font-family: monospace;
    font-size: 16px;
}

.demo-wrapper {
    position: relative;
    display: block;
    width: 100%;
}

.Main--fluid  .demo-wrapper.demo-wrapper__minipreview   {
    /* Make look better in Docs */
    max-width: 900px;
}
.Main--fluid  .demo-wrapper.demo-wrapper__minipreview.demo-wrapper__fullscreen  {
    /* ...except if full screen */
    max-width: 100vw;
}

.demo-wrapper.demo-wrapper__fullscreen {
    position: absolute;
    display: block;
    width: 100vw;
    height: 100vh;
    z-index: 100;
    top: 0;
    left: 0;
    box-sizing: border-box;
    padding: 20px;
    background: white;
}

/* No tabs sitch: */
.demo-wrapper__notabs .editor-minipreview {
    margin-top: 40px;
    margin-left: 5px;
    border: 1px solid #999;
    height: 160px;
}

.demo-wrapper__fullscreen.demo-wrapper__notabs .editor-minipreview {
    margin-top: 65px;
}

.editor-toolbar {
    position: absolute;
    z-index: 3;
    display: flex;
    width: auto;
    /*right: -70px;*/
    right: 30px;
    top: 0;
    height: 35px;
    padding: 2px;
    border: #ddd 1px solid;
}



.demo-wrapper__fullscreen .editor-toolbar {
    height: 60px;
    padding: 10px;
}


.demo-wrapper__minipreview  .editor-wrapper {
    width: 78%;
    border: 1px solid black;
}
.Main--fluid  .demo-wrapper__minipreview  .editor-wrapper {
}

.demo-wrapper.demo-wrapper__clipboard .editor-wrapper {
    border: 1px dotted #ddd;
    width: 100%;
}

.demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {
    border: 5px solid black;
    border-radius: 1px 8px 1px 8px;
    border-bottom-width: 1px;
    border-right-width: 1px;
}

.editor-minipreview {
    border: 1px solid black;
    border-radius: 1px;
    background: #eee;
    padding: 5px;
    border-left: none;
    width: 200px;
    height: 200px;
    overflow-y: auto;
}
.editor-minipreview > div > * > input {
  max-width: 175px;
}

.demo-wrapper__fullscreen .editor-minipreview {
    width: 30vw;
    height: auto;
    border: 1px solid black;
    margin: 20px;
    padding: 30px;
    border: 5px solid black;
    border-radius: 1px 8px 1px 8px;
    border-bottom-width: 1px;
    border-right-width: 1px;
}

.side-by-side-panes {
    display: flex;
    justify-content: space-between;
}

.TabNav {
    /*border-bottom: 1px dotted var(--highlight-color);*/
    width: 100%;
}


.TabNav > ul {
    width: 100%;
    display: flex;
}

.TabNav-title {
    border: 2px solid black;
    border-top-width: 4px;
    /*border-bottom-width: 0;*/
    margin-bottom: -2px;
    border-radius: 8px 8px 0 0;
    background: white;
    min-width: 50px;
    box-shadow: 0 0 0 0 var(--highlight-color);
    transition: box-shadow 0.3s,
                border-color 0.2s;
}

.TabNav-title a,
.TabNav-title a:visited,
.TabNav-title a:active {
    text-decoration: none;
    color: black;
    display: block;
    padding: 5px;
    font-weight: bold;
    cursor: pointer;
    font-size: 1.1rem;
}

.TabNav-title:hover {
    border-color: var(--highlight-color);
}

.TabNav-title--selected {
    border-color: var(--highlight-color);
    background: var(--highlight-color);
    box-shadow: 0 0 0 8px var(--highlight-color);
    border-radius: 8px 8px 8px 8px;
}
.TabNav-title--selected a {
    color: white !important;
}


@media (max-width: 992px) {
    .TabNav > ul {
        flex-wrap: wrap;
        justify-content: flex-start;
    }
}
@media (max-width: 768px) {
    .TabNav-title {
        padding: 7px;
    }
}



@media (max-width: 768px) {
    .demo-wrapper.demo-wrapper__fullscreen {
        position: relative;
        display: block;
        width: 100vw;
        height: auto;
        z-index: 1;
    }
}


@media (max-width: 768px) {
    .editor-toolbar {
        position: static;
        padding: 10px;
        margin: 20px;
        height: 60px;
        font-size: 1.1rem;
    }
    .demo-wrapper__fullscreen .editor-toolbar {
        margin: 5px;
        height: 60px;
        padding: 5px;
        display: flex;
        justify-content: flex-end;
    }
}


@media (max-width: 768px) {
    .side-by-side-panes {
        display: block;
    }
}

@media (max-width: 768px) {
    .editor-minipreview {
        width: 100%;
    }
    .demo-wrapper__fullscreen .editor-minipreview {
        width: 90%;
    }
}


@media (min-width: 768px) {
    .demo-wrapper__minipreview.demo-wrapper__fullscreen .editor-wrapper {
        height: auto;
        width: 70vw;
        min-height: 87vh;
    }
}


@media (max-width: 768px) {
    .editor-wrapper {
        width: 100%;
        border: 1px solid black;
    }
    .demo-wrapper__fullscreen .editor-wrapper {
        width: 100%;
    }
}

`,// (ends: /components/modulowebsite/demo.css) 

  "/components/modulowebsite/demo.html": // (71 lines)
`<div class="demo-wrapper
        {% if state.showpreview %}     demo-wrapper__minipreview{% endif %}
        {% if state.showclipboard %}   demo-wrapper__clipboard  {% endif %}
        {% if state.fullscreen %}      demo-wrapper__fullscreen {% endif %}
        {% if state.tabs.length == 1 %}demo-wrapper__notabs     {% endif %}
    ">
    {% if state.tabs.length gt 1 %}
        <nav class="TabNav">
            <ul>
                {% for tab in state.tabs %}
                    <li class="TabNav-title
                        {% if tab.title == state.selected %}
                            TabNav-title--selected
                        {% endif %}
                    "><a @click:=script.selectTab
                            payload="{{ tab.title }}"
                        >{{ tab.title }}</a></li>
                {% endfor %}
            </ul>
        </nav>
    {% endif %}

    <div class="editor-toolbar">
        <p style="font-size: 11px; width: 120px; margin-right: 10px; text-align: right;
                    {% if not state.fullscreen %} display: none; {% endif %}">
            <em>Note: This is meant for exploring features. Your work will not be saved.</em>
        </p>

        {% if state.showclipboard %}
            <button class="m-Btn m-Btn--sm m-Btn--faded"
                    title="Copy this code" @click:=script.doCopy>
                Copy <span alt="Clipboard">&#128203;</span>
            </button>
        {% endif %}

        {% if state.showpreview %}
            <button class="m-Btn"
                    title="Toggle full screen view of code" @click:=script.doFullscreen>
                {% if state.fullscreen %}
                    <span alt="Shrink">&swarr;</span>
                {% else %}
                    <span alt="Go Full Screen">&nearr;</span>
                {% endif %}
            </button>
            &nbsp;
            <button class="m-Btn"
                    title="Run a preview of this code" @click:=script.doRun>
                Run <span alt="Refresh">&#10227;</span>
            </button>
        {% endif %}

    </div>

    <div class="side-by-side-panes">
        <div class="editor-wrapper">
            <div [script.codemirror] modulo-ignore>
            </div>
        </div>

        {% if state.showpreview %}
            <div class="editor-minipreview">
                <div modulo-ignore>
                    {{ state.preview|safe }}
                </div>
            </div>
        {% endif %}

    </div>
</div>

`,// (ends: /components/modulowebsite/demo.html) 

  "/components/modulowebsite/demo.js": // (325 lines)
`let componentTexts = null;
let componentTexts2 = null;
let exCounter = 0; // global variable

//console.log('this is demo.js');

function _setupGlobalVariables() {
    // TODO: Refactor this, obvs
    // Get text from the two example component libraries
    //console.log('this is registered Modulo instances', Object.keys(Modulo.factoryInstances));
    try {
        componentTexts = Modulo.factoryInstances['eg-eg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts:', err);
        componentTexts = null;
    }

    try {
        componentTexts2 = Modulo.factoryInstances['docseg-docseg']
                .baseRenderObj.script.exports.componentTexts;
    } catch (err) {
        console.log('couldnt get componentTexts2:', err);
        componentTexts2 = null;
    }

    if (componentTexts) {
        componentTexts = Object.assign({}, componentTexts, componentTexts2);
    }
}

function tmpGetDirectives() {
    return [ 'script.codemirror' ];
}

function codemirrorMount({ el }) {
    //console.log('codeMirrorMount', { el });
    el.innerHTML = ''; // clear inner HTML before mounting
    const demoType = props.demotype || 'snippet';
    //_setupCodemirror(el, demoType, element, state);
    _setupCodemirrorSync(el, demoType, element, state);
}

function _setupCodemirrorSync(el, demoType, myElement, myState) {
      let readOnly = false;
      let lineNumbers = true;
      if (demoType === 'snippet') {
          readOnly = true;
          lineNumbers = false;
      }

      const conf = {
          value: myState.text,
          mode: 'django',
          theme: 'eclipse',
          indentUnit: 4,
          readOnly,
          lineNumbers,
      };

      if (demoType === 'snippet') {
          myState.showclipboard = true;
      } else if (demoType === 'minipreview') {
          myState.showpreview = true;
      }

      if (!myElement.codeMirrorEditor) {
          myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
      }
      myElement.codeMirrorEditor.refresh()
}

function _setupCodemirror(el, demoType, myElement, myState) {
    //console.log('_setupCodemirror DISABLED'); return; ///////////////////
    let expBackoff = 10;
    //console.log('this is codemirror', Modulo.globals.CodeMirror);
    const mountCM = () => {
        // TODO: hack, allow JS deps or figure out loader or something
        if (!Modulo.globals.CodeMirror) {
            expBackoff *= 2;
            setTimeout(mountCM, expBackoff); // poll again
            return;
        }

        let readOnly = false;
        let lineNumbers = true;
        if (demoType === 'snippet') {
            readOnly = true;
            lineNumbers = false;
        }

        const conf = {
            value: myState.text,
            mode: 'django',
            theme: 'eclipse',
            indentUnit: 4,
            readOnly,
            lineNumbers,
        };

        if (demoType === 'snippet') {
            myState.showclipboard = true;
        } else if (demoType === 'minipreview') {
            myState.showpreview = true;
        }

        if (!myElement.codeMirrorEditor) {
            myElement.codeMirrorEditor = Modulo.globals.CodeMirror(el, conf);
        }
        myElement.codeMirrorEditor.refresh()
        //myElement.rerender();
    };
    mountCM();
    return;
    const {isBackend} = Modulo;
    if (!isBackend) {
        // TODO: Ugly hack, need better tools for working with legacy
        setTimeout(mountCM, expBackoff);
    }
}

function selectTab(newTitle) {
    //console.log('tab getting selected!', newTitle);
    if (!element.codeMirrorEditor) {
        return; // not ready yet
    }
    const currentTitle = state.selected;
    state.selected = newTitle;
    for (const tab of state.tabs) {
        if (tab.title === currentTitle) { // save text back to state
            tab.text = element.codeMirrorEditor.getValue();
        } else if (tab.title === newTitle) {
            state.text = tab.text;
        }
    }
    element.codeMirrorEditor.setValue(state.text);
    doRun();
}

function doCopy() {
    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (!mod || !mod.script || !mod.script.copyTextToClipboard) {
        console.log('no mod!');
    } else {
        mod.script.copyTextToClipboard(state.text);
    }
}

function initializedCallback() {
    // console.log('initializedCallback');
    if (componentTexts === null) {
        _setupGlobalVariables();
    }

    let text;
    state.tabs = [];
    if (props.fromlibrary) {
        if (!componentTexts) {
            componentTexts = false;
            throw new Error('Couldnt load:', props.fromlibrary)
        }

        const componentNames = props.fromlibrary.split(',');
        for (const title of componentNames) {
            if (title in componentTexts) {
                text = componentTexts[title].trim();
                text = text.replace(/&#39;/g, "'"); // correct double escape
                state.tabs.push({ text, title });
            } else {
                console.error('invalid fromlibrary:', title);
                console.log(componentTexts);
                return;
            }
        }
    } else if (props.text) {
        let title = props.ttitle || 'Example';
        text = props.text.trim();
        state.tabs.push({title, text});
        // hack -v
        if (props.text2) {
            title = props.ttitle2 || 'Example';
            text = props.text2.trim();
            state.tabs.push({title, text});
        }
        if (props.text3) {
            title = props.ttitle3 || 'Example';
            text = props.text3.trim();
            state.tabs.push({title, text});
        }
        //console.log('this is props', props);
    }

    const demoType = props.demotype || 'snippet';
    if (demoType === 'snippet') {
        state.showclipboard = true;
    } else if (demoType === 'minipreview') {
        state.showpreview = true;
    }

    state.text = state.tabs[0].text; // load first

    state.selected = state.tabs[0].title; // set first as tab title
    //setupShaChecksum();
    if (demoType === 'minipreview') {
        doRun();
    }

    const myElem = element;
    const myState = state;
    const {isBackend} = Modulo;
    return;
    if (!isBackend) {
        setTimeout(() => {
            const div = myElem.querySelector('.editor-wrapper > div');
            _setupCodemirror(div, demoType, myElem, myState);
        }, 0); // put on queue
    }
}

function doRun() {
    exCounter++;
    //console.log('There are ', exCounter, ' examples on this page. Gee!')
    const namespace = \`e\${exCounter}g\${state.nscounter}\`; // TODO: later do hot reloading using same loader
    state.nscounter++;
    const attrs = { src: '', namespace };
    const tagName = 'Example';

    if (element.codeMirrorEditor) {
        state.text = element.codeMirrorEditor.getValue(); // make sure most up-to-date
    }
    let componentDef = state.text;
    componentDef = \`<component name="\${tagName}">\\n\${componentDef}\\n</component>\`;
    const loader = new Modulo.Loader(null, { attrs } );

    // Use a new asset manager when loading, to prevent it from getting into the main bundle
    const oldAssetMgr = Modulo.assets;
    Modulo.assets = new Modulo.AssetManager();
    loader.loadString(componentDef);
    Modulo.assets = oldAssetMgr;

    const fullname = \`\${namespace}-\${tagName}\`;
    const factory = Modulo.factoryInstances[fullname];
    state.preview = \`<\${fullname}></\${fullname}>\`;

    // Hacky way to mount, required due to buggy dom resolver
    const {isBackend} = Modulo;
    if (!isBackend) {
        setTimeout(() => {
            const div = element.querySelector('.editor-minipreview > div');
            if (div) {
                div.innerHTML = state.preview;
            } else {
                console.log('warning, cant update minipreview', div);
            }
        }, 0);
    }
}

function countUp() {
    // TODO: Remove this when resolution context bug is fixed so that children
    // no longer can reference parents
    console.count('PROBLEM: Child event bubbling to parent!');
}

function doFullscreen() {
    document.body.scrollTop = document.documentElement.scrollTop = 0;
    if (state.fullscreen) {
        state.fullscreen = false;
        document.querySelector('html').style.overflow = "auto";
        if (element.codeMirrorEditor) {
            element.codeMirrorEditor.refresh()
        }
    } else {
        state.fullscreen = true;
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

        // TODO: way to share variables in CSS
        if (vw > 768) {
              document.querySelector('html').style.overflow = "hidden";
              if (element.codeMirrorEditor) {
                  element.codeMirrorEditor.refresh()
              }
        }
    }
    if (element.codeMirrorEditor) {
        //element.codeMirrorEditor.refresh()
    }
}

/*
function previewspotMount({ el }) {
    element.previewSpot = el;
    if (!element.isMounted) {
        doRun(); // mount after first render
    }
}


function setupShaChecksum() {
    console.log('setupShaChecksum DISABLED'); return; ///////////////////

    let mod = Modulo.factoryInstances['x-x'].baseRenderObj;
    if (Modulo.isBackend && state && state.text.includes('\$modulojs_sha384_checksum\$')) {
        if (!mod || !mod.script || !mod.script.getVersionInfo) {
            console.log('no mod!');
        } else {
            const info = mod.script.getVersionInfo();
            const checksum = info.checksum || '';
            state.text = state.text.replace('\$modulojs_sha384_checksum\$', checksum)
            element.setAttribute('text', state.text);
        }
    }
}
*/

/*
const component = factory.createTestElement();
component.remove()
console.log(component);
element.previewSpot.innerHTML = '';
element.previewSpot.appendChild(component);
*/

`,// (ends: /components/modulowebsite/demo.js) 

  "https://api.github.com/repos/michaelpb/modulo": // (117 lines)
`{
  "id": 320452827,
  "node_id": "MDEwOlJlcG9zaXRvcnkzMjA0NTI4Mjc=",
  "name": "modulo",
  "full_name": "michaelpb/modulo",
  "private": false,
  "owner": {
    "login": "michaelpb",
    "id": 181549,
    "node_id": "MDQ6VXNlcjE4MTU0OQ==",
    "avatar_url": "https://avatars.githubusercontent.com/u/181549?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/michaelpb",
    "html_url": "https://github.com/michaelpb",
    "followers_url": "https://api.github.com/users/michaelpb/followers",
    "following_url": "https://api.github.com/users/michaelpb/following{/other_user}",
    "gists_url": "https://api.github.com/users/michaelpb/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/michaelpb/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/michaelpb/subscriptions",
    "organizations_url": "https://api.github.com/users/michaelpb/orgs",
    "repos_url": "https://api.github.com/users/michaelpb/repos",
    "events_url": "https://api.github.com/users/michaelpb/events{/privacy}",
    "received_events_url": "https://api.github.com/users/michaelpb/received_events",
    "type": "User",
    "site_admin": false
  },
  "html_url": "https://github.com/michaelpb/modulo",
  "description": "Modulo.js is a minimalist javascript framewor- 🤮",
  "fork": false,
  "url": "https://api.github.com/repos/michaelpb/modulo",
  "forks_url": "https://api.github.com/repos/michaelpb/modulo/forks",
  "keys_url": "https://api.github.com/repos/michaelpb/modulo/keys{/key_id}",
  "collaborators_url": "https://api.github.com/repos/michaelpb/modulo/collaborators{/collaborator}",
  "teams_url": "https://api.github.com/repos/michaelpb/modulo/teams",
  "hooks_url": "https://api.github.com/repos/michaelpb/modulo/hooks",
  "issue_events_url": "https://api.github.com/repos/michaelpb/modulo/issues/events{/number}",
  "events_url": "https://api.github.com/repos/michaelpb/modulo/events",
  "assignees_url": "https://api.github.com/repos/michaelpb/modulo/assignees{/user}",
  "branches_url": "https://api.github.com/repos/michaelpb/modulo/branches{/branch}",
  "tags_url": "https://api.github.com/repos/michaelpb/modulo/tags",
  "blobs_url": "https://api.github.com/repos/michaelpb/modulo/git/blobs{/sha}",
  "git_tags_url": "https://api.github.com/repos/michaelpb/modulo/git/tags{/sha}",
  "git_refs_url": "https://api.github.com/repos/michaelpb/modulo/git/refs{/sha}",
  "trees_url": "https://api.github.com/repos/michaelpb/modulo/git/trees{/sha}",
  "statuses_url": "https://api.github.com/repos/michaelpb/modulo/statuses/{sha}",
  "languages_url": "https://api.github.com/repos/michaelpb/modulo/languages",
  "stargazers_url": "https://api.github.com/repos/michaelpb/modulo/stargazers",
  "contributors_url": "https://api.github.com/repos/michaelpb/modulo/contributors",
  "subscribers_url": "https://api.github.com/repos/michaelpb/modulo/subscribers",
  "subscription_url": "https://api.github.com/repos/michaelpb/modulo/subscription",
  "commits_url": "https://api.github.com/repos/michaelpb/modulo/commits{/sha}",
  "git_commits_url": "https://api.github.com/repos/michaelpb/modulo/git/commits{/sha}",
  "comments_url": "https://api.github.com/repos/michaelpb/modulo/comments{/number}",
  "issue_comment_url": "https://api.github.com/repos/michaelpb/modulo/issues/comments{/number}",
  "contents_url": "https://api.github.com/repos/michaelpb/modulo/contents/{+path}",
  "compare_url": "https://api.github.com/repos/michaelpb/modulo/compare/{base}...{head}",
  "merges_url": "https://api.github.com/repos/michaelpb/modulo/merges",
  "archive_url": "https://api.github.com/repos/michaelpb/modulo/{archive_format}{/ref}",
  "downloads_url": "https://api.github.com/repos/michaelpb/modulo/downloads",
  "issues_url": "https://api.github.com/repos/michaelpb/modulo/issues{/number}",
  "pulls_url": "https://api.github.com/repos/michaelpb/modulo/pulls{/number}",
  "milestones_url": "https://api.github.com/repos/michaelpb/modulo/milestones{/number}",
  "notifications_url": "https://api.github.com/repos/michaelpb/modulo/notifications{?since,all,participating}",
  "labels_url": "https://api.github.com/repos/michaelpb/modulo/labels{/name}",
  "releases_url": "https://api.github.com/repos/michaelpb/modulo/releases{/id}",
  "deployments_url": "https://api.github.com/repos/michaelpb/modulo/deployments",
  "created_at": "2020-12-11T03:08:21Z",
  "updated_at": "2022-05-03T19:15:19Z",
  "pushed_at": "2022-05-22T14:14:20Z",
  "git_url": "git://github.com/michaelpb/modulo.git",
  "ssh_url": "git@github.com:michaelpb/modulo.git",
  "clone_url": "https://github.com/michaelpb/modulo.git",
  "svn_url": "https://github.com/michaelpb/modulo",
  "homepage": "https://modulojs.org/",
  "size": 6074,
  "stargazers_count": 2,
  "watchers_count": 2,
  "language": "JavaScript",
  "has_issues": true,
  "has_projects": true,
  "has_downloads": true,
  "has_wiki": true,
  "has_pages": true,
  "forks_count": 0,
  "mirror_url": null,
  "archived": false,
  "disabled": false,
  "open_issues_count": 0,
  "license": {
    "key": "lgpl-2.1",
    "name": "GNU Lesser General Public License v2.1",
    "spdx_id": "LGPL-2.1",
    "url": "https://api.github.com/licenses/lgpl-2.1",
    "node_id": "MDc6TGljZW5zZTEx"
  },
  "allow_forking": true,
  "is_template": false,
  "topics": [
    "component-based",
    "framework",
    "html",
    "javascript",
    "state-management",
    "template-engine",
    "vanilla-js",
    "web-components"
  ],
  "visibility": "public",
  "forks": 0,
  "open_issues": 0,
  "watchers": 2,
  "default_branch": "main",
  "temp_clone_token": null,
  "network_count": 0,
  "subscribers_count": 1
}
`,// (ends: https://api.github.com/repos/michaelpb/modulo) 

  "https://jsonplaceholder.typicode.com/todos": // (1202 lines)
`[
  {
    "userId": 1,
    "id": 1,
    "title": "delectus aut autem",
    "completed": false
  },
  {
    "userId": 1,
    "id": 2,
    "title": "quis ut nam facilis et officia qui",
    "completed": false
  },
  {
    "userId": 1,
    "id": 3,
    "title": "fugiat veniam minus",
    "completed": false
  },
  {
    "userId": 1,
    "id": 4,
    "title": "et porro tempora",
    "completed": true
  },
  {
    "userId": 1,
    "id": 5,
    "title": "laboriosam mollitia et enim quasi adipisci quia provident illum",
    "completed": false
  },
  {
    "userId": 1,
    "id": 6,
    "title": "qui ullam ratione quibusdam voluptatem quia omnis",
    "completed": false
  },
  {
    "userId": 1,
    "id": 7,
    "title": "illo expedita consequatur quia in",
    "completed": false
  },
  {
    "userId": 1,
    "id": 8,
    "title": "quo adipisci enim quam ut ab",
    "completed": true
  },
  {
    "userId": 1,
    "id": 9,
    "title": "molestiae perspiciatis ipsa",
    "completed": false
  },
  {
    "userId": 1,
    "id": 10,
    "title": "illo est ratione doloremque quia maiores aut",
    "completed": true
  },
  {
    "userId": 1,
    "id": 11,
    "title": "vero rerum temporibus dolor",
    "completed": true
  },
  {
    "userId": 1,
    "id": 12,
    "title": "ipsa repellendus fugit nisi",
    "completed": true
  },
  {
    "userId": 1,
    "id": 13,
    "title": "et doloremque nulla",
    "completed": false
  },
  {
    "userId": 1,
    "id": 14,
    "title": "repellendus sunt dolores architecto voluptatum",
    "completed": true
  },
  {
    "userId": 1,
    "id": 15,
    "title": "ab voluptatum amet voluptas",
    "completed": true
  },
  {
    "userId": 1,
    "id": 16,
    "title": "accusamus eos facilis sint et aut voluptatem",
    "completed": true
  },
  {
    "userId": 1,
    "id": 17,
    "title": "quo laboriosam deleniti aut qui",
    "completed": true
  },
  {
    "userId": 1,
    "id": 18,
    "title": "dolorum est consequatur ea mollitia in culpa",
    "completed": false
  },
  {
    "userId": 1,
    "id": 19,
    "title": "molestiae ipsa aut voluptatibus pariatur dolor nihil",
    "completed": true
  },
  {
    "userId": 1,
    "id": 20,
    "title": "ullam nobis libero sapiente ad optio sint",
    "completed": true
  },
  {
    "userId": 2,
    "id": 21,
    "title": "suscipit repellat esse quibusdam voluptatem incidunt",
    "completed": false
  },
  {
    "userId": 2,
    "id": 22,
    "title": "distinctio vitae autem nihil ut molestias quo",
    "completed": true
  },
  {
    "userId": 2,
    "id": 23,
    "title": "et itaque necessitatibus maxime molestiae qui quas velit",
    "completed": false
  },
  {
    "userId": 2,
    "id": 24,
    "title": "adipisci non ad dicta qui amet quaerat doloribus ea",
    "completed": false
  },
  {
    "userId": 2,
    "id": 25,
    "title": "voluptas quo tenetur perspiciatis explicabo natus",
    "completed": true
  },
  {
    "userId": 2,
    "id": 26,
    "title": "aliquam aut quasi",
    "completed": true
  },
  {
    "userId": 2,
    "id": 27,
    "title": "veritatis pariatur delectus",
    "completed": true
  },
  {
    "userId": 2,
    "id": 28,
    "title": "nesciunt totam sit blanditiis sit",
    "completed": false
  },
  {
    "userId": 2,
    "id": 29,
    "title": "laborum aut in quam",
    "completed": false
  },
  {
    "userId": 2,
    "id": 30,
    "title": "nemo perspiciatis repellat ut dolor libero commodi blanditiis omnis",
    "completed": true
  },
  {
    "userId": 2,
    "id": 31,
    "title": "repudiandae totam in est sint facere fuga",
    "completed": false
  },
  {
    "userId": 2,
    "id": 32,
    "title": "earum doloribus ea doloremque quis",
    "completed": false
  },
  {
    "userId": 2,
    "id": 33,
    "title": "sint sit aut vero",
    "completed": false
  },
  {
    "userId": 2,
    "id": 34,
    "title": "porro aut necessitatibus eaque distinctio",
    "completed": false
  },
  {
    "userId": 2,
    "id": 35,
    "title": "repellendus veritatis molestias dicta incidunt",
    "completed": true
  },
  {
    "userId": 2,
    "id": 36,
    "title": "excepturi deleniti adipisci voluptatem et neque optio illum ad",
    "completed": true
  },
  {
    "userId": 2,
    "id": 37,
    "title": "sunt cum tempora",
    "completed": false
  },
  {
    "userId": 2,
    "id": 38,
    "title": "totam quia non",
    "completed": false
  },
  {
    "userId": 2,
    "id": 39,
    "title": "doloremque quibusdam asperiores libero corrupti illum qui omnis",
    "completed": false
  },
  {
    "userId": 2,
    "id": 40,
    "title": "totam atque quo nesciunt",
    "completed": true
  },
  {
    "userId": 3,
    "id": 41,
    "title": "aliquid amet impedit consequatur aspernatur placeat eaque fugiat suscipit",
    "completed": false
  },
  {
    "userId": 3,
    "id": 42,
    "title": "rerum perferendis error quia ut eveniet",
    "completed": false
  },
  {
    "userId": 3,
    "id": 43,
    "title": "tempore ut sint quis recusandae",
    "completed": true
  },
  {
    "userId": 3,
    "id": 44,
    "title": "cum debitis quis accusamus doloremque ipsa natus sapiente omnis",
    "completed": true
  },
  {
    "userId": 3,
    "id": 45,
    "title": "velit soluta adipisci molestias reiciendis harum",
    "completed": false
  },
  {
    "userId": 3,
    "id": 46,
    "title": "vel voluptatem repellat nihil placeat corporis",
    "completed": false
  },
  {
    "userId": 3,
    "id": 47,
    "title": "nam qui rerum fugiat accusamus",
    "completed": false
  },
  {
    "userId": 3,
    "id": 48,
    "title": "sit reprehenderit omnis quia",
    "completed": false
  },
  {
    "userId": 3,
    "id": 49,
    "title": "ut necessitatibus aut maiores debitis officia blanditiis velit et",
    "completed": false
  },
  {
    "userId": 3,
    "id": 50,
    "title": "cupiditate necessitatibus ullam aut quis dolor voluptate",
    "completed": true
  },
  {
    "userId": 3,
    "id": 51,
    "title": "distinctio exercitationem ab doloribus",
    "completed": false
  },
  {
    "userId": 3,
    "id": 52,
    "title": "nesciunt dolorum quis recusandae ad pariatur ratione",
    "completed": false
  },
  {
    "userId": 3,
    "id": 53,
    "title": "qui labore est occaecati recusandae aliquid quam",
    "completed": false
  },
  {
    "userId": 3,
    "id": 54,
    "title": "quis et est ut voluptate quam dolor",
    "completed": true
  },
  {
    "userId": 3,
    "id": 55,
    "title": "voluptatum omnis minima qui occaecati provident nulla voluptatem ratione",
    "completed": true
  },
  {
    "userId": 3,
    "id": 56,
    "title": "deleniti ea temporibus enim",
    "completed": true
  },
  {
    "userId": 3,
    "id": 57,
    "title": "pariatur et magnam ea doloribus similique voluptatem rerum quia",
    "completed": false
  },
  {
    "userId": 3,
    "id": 58,
    "title": "est dicta totam qui explicabo doloribus qui dignissimos",
    "completed": false
  },
  {
    "userId": 3,
    "id": 59,
    "title": "perspiciatis velit id laborum placeat iusto et aliquam odio",
    "completed": false
  },
  {
    "userId": 3,
    "id": 60,
    "title": "et sequi qui architecto ut adipisci",
    "completed": true
  },
  {
    "userId": 4,
    "id": 61,
    "title": "odit optio omnis qui sunt",
    "completed": true
  },
  {
    "userId": 4,
    "id": 62,
    "title": "et placeat et tempore aspernatur sint numquam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 63,
    "title": "doloremque aut dolores quidem fuga qui nulla",
    "completed": true
  },
  {
    "userId": 4,
    "id": 64,
    "title": "voluptas consequatur qui ut quia magnam nemo esse",
    "completed": false
  },
  {
    "userId": 4,
    "id": 65,
    "title": "fugiat pariatur ratione ut asperiores necessitatibus magni",
    "completed": false
  },
  {
    "userId": 4,
    "id": 66,
    "title": "rerum eum molestias autem voluptatum sit optio",
    "completed": false
  },
  {
    "userId": 4,
    "id": 67,
    "title": "quia voluptatibus voluptatem quos similique maiores repellat",
    "completed": false
  },
  {
    "userId": 4,
    "id": 68,
    "title": "aut id perspiciatis voluptatem iusto",
    "completed": false
  },
  {
    "userId": 4,
    "id": 69,
    "title": "doloribus sint dolorum ab adipisci itaque dignissimos aliquam suscipit",
    "completed": false
  },
  {
    "userId": 4,
    "id": 70,
    "title": "ut sequi accusantium et mollitia delectus sunt",
    "completed": false
  },
  {
    "userId": 4,
    "id": 71,
    "title": "aut velit saepe ullam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 72,
    "title": "praesentium facilis facere quis harum voluptatibus voluptatem eum",
    "completed": false
  },
  {
    "userId": 4,
    "id": 73,
    "title": "sint amet quia totam corporis qui exercitationem commodi",
    "completed": true
  },
  {
    "userId": 4,
    "id": 74,
    "title": "expedita tempore nobis eveniet laborum maiores",
    "completed": false
  },
  {
    "userId": 4,
    "id": 75,
    "title": "occaecati adipisci est possimus totam",
    "completed": false
  },
  {
    "userId": 4,
    "id": 76,
    "title": "sequi dolorem sed",
    "completed": true
  },
  {
    "userId": 4,
    "id": 77,
    "title": "maiores aut nesciunt delectus exercitationem vel assumenda eligendi at",
    "completed": false
  },
  {
    "userId": 4,
    "id": 78,
    "title": "reiciendis est magnam amet nemo iste recusandae impedit quaerat",
    "completed": false
  },
  {
    "userId": 4,
    "id": 79,
    "title": "eum ipsa maxime ut",
    "completed": true
  },
  {
    "userId": 4,
    "id": 80,
    "title": "tempore molestias dolores rerum sequi voluptates ipsum consequatur",
    "completed": true
  },
  {
    "userId": 5,
    "id": 81,
    "title": "suscipit qui totam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 82,
    "title": "voluptates eum voluptas et dicta",
    "completed": false
  },
  {
    "userId": 5,
    "id": 83,
    "title": "quidem at rerum quis ex aut sit quam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 84,
    "title": "sunt veritatis ut voluptate",
    "completed": false
  },
  {
    "userId": 5,
    "id": 85,
    "title": "et quia ad iste a",
    "completed": true
  },
  {
    "userId": 5,
    "id": 86,
    "title": "incidunt ut saepe autem",
    "completed": true
  },
  {
    "userId": 5,
    "id": 87,
    "title": "laudantium quae eligendi consequatur quia et vero autem",
    "completed": true
  },
  {
    "userId": 5,
    "id": 88,
    "title": "vitae aut excepturi laboriosam sint aliquam et et accusantium",
    "completed": false
  },
  {
    "userId": 5,
    "id": 89,
    "title": "sequi ut omnis et",
    "completed": true
  },
  {
    "userId": 5,
    "id": 90,
    "title": "molestiae nisi accusantium tenetur dolorem et",
    "completed": true
  },
  {
    "userId": 5,
    "id": 91,
    "title": "nulla quis consequatur saepe qui id expedita",
    "completed": true
  },
  {
    "userId": 5,
    "id": 92,
    "title": "in omnis laboriosam",
    "completed": true
  },
  {
    "userId": 5,
    "id": 93,
    "title": "odio iure consequatur molestiae quibusdam necessitatibus quia sint",
    "completed": true
  },
  {
    "userId": 5,
    "id": 94,
    "title": "facilis modi saepe mollitia",
    "completed": false
  },
  {
    "userId": 5,
    "id": 95,
    "title": "vel nihil et molestiae iusto assumenda nemo quo ut",
    "completed": true
  },
  {
    "userId": 5,
    "id": 96,
    "title": "nobis suscipit ducimus enim asperiores voluptas",
    "completed": false
  },
  {
    "userId": 5,
    "id": 97,
    "title": "dolorum laboriosam eos qui iure aliquam",
    "completed": false
  },
  {
    "userId": 5,
    "id": 98,
    "title": "debitis accusantium ut quo facilis nihil quis sapiente necessitatibus",
    "completed": true
  },
  {
    "userId": 5,
    "id": 99,
    "title": "neque voluptates ratione",
    "completed": false
  },
  {
    "userId": 5,
    "id": 100,
    "title": "excepturi a et neque qui expedita vel voluptate",
    "completed": false
  },
  {
    "userId": 6,
    "id": 101,
    "title": "explicabo enim cumque porro aperiam occaecati minima",
    "completed": false
  },
  {
    "userId": 6,
    "id": 102,
    "title": "sed ab consequatur",
    "completed": false
  },
  {
    "userId": 6,
    "id": 103,
    "title": "non sunt delectus illo nulla tenetur enim omnis",
    "completed": false
  },
  {
    "userId": 6,
    "id": 104,
    "title": "excepturi non laudantium quo",
    "completed": false
  },
  {
    "userId": 6,
    "id": 105,
    "title": "totam quia dolorem et illum repellat voluptas optio",
    "completed": true
  },
  {
    "userId": 6,
    "id": 106,
    "title": "ad illo quis voluptatem temporibus",
    "completed": true
  },
  {
    "userId": 6,
    "id": 107,
    "title": "praesentium facilis omnis laudantium fugit ad iusto nihil nesciunt",
    "completed": false
  },
  {
    "userId": 6,
    "id": 108,
    "title": "a eos eaque nihil et exercitationem incidunt delectus",
    "completed": true
  },
  {
    "userId": 6,
    "id": 109,
    "title": "autem temporibus harum quisquam in culpa",
    "completed": true
  },
  {
    "userId": 6,
    "id": 110,
    "title": "aut aut ea corporis",
    "completed": true
  },
  {
    "userId": 6,
    "id": 111,
    "title": "magni accusantium labore et id quis provident",
    "completed": false
  },
  {
    "userId": 6,
    "id": 112,
    "title": "consectetur impedit quisquam qui deserunt non rerum consequuntur eius",
    "completed": false
  },
  {
    "userId": 6,
    "id": 113,
    "title": "quia atque aliquam sunt impedit voluptatum rerum assumenda nisi",
    "completed": false
  },
  {
    "userId": 6,
    "id": 114,
    "title": "cupiditate quos possimus corporis quisquam exercitationem beatae",
    "completed": false
  },
  {
    "userId": 6,
    "id": 115,
    "title": "sed et ea eum",
    "completed": false
  },
  {
    "userId": 6,
    "id": 116,
    "title": "ipsa dolores vel facilis ut",
    "completed": true
  },
  {
    "userId": 6,
    "id": 117,
    "title": "sequi quae est et qui qui eveniet asperiores",
    "completed": false
  },
  {
    "userId": 6,
    "id": 118,
    "title": "quia modi consequatur vero fugiat",
    "completed": false
  },
  {
    "userId": 6,
    "id": 119,
    "title": "corporis ducimus ea perspiciatis iste",
    "completed": false
  },
  {
    "userId": 6,
    "id": 120,
    "title": "dolorem laboriosam vel voluptas et aliquam quasi",
    "completed": false
  },
  {
    "userId": 7,
    "id": 121,
    "title": "inventore aut nihil minima laudantium hic qui omnis",
    "completed": true
  },
  {
    "userId": 7,
    "id": 122,
    "title": "provident aut nobis culpa",
    "completed": true
  },
  {
    "userId": 7,
    "id": 123,
    "title": "esse et quis iste est earum aut impedit",
    "completed": false
  },
  {
    "userId": 7,
    "id": 124,
    "title": "qui consectetur id",
    "completed": false
  },
  {
    "userId": 7,
    "id": 125,
    "title": "aut quasi autem iste tempore illum possimus",
    "completed": false
  },
  {
    "userId": 7,
    "id": 126,
    "title": "ut asperiores perspiciatis veniam ipsum rerum saepe",
    "completed": true
  },
  {
    "userId": 7,
    "id": 127,
    "title": "voluptatem libero consectetur rerum ut",
    "completed": true
  },
  {
    "userId": 7,
    "id": 128,
    "title": "eius omnis est qui voluptatem autem",
    "completed": false
  },
  {
    "userId": 7,
    "id": 129,
    "title": "rerum culpa quis harum",
    "completed": false
  },
  {
    "userId": 7,
    "id": 130,
    "title": "nulla aliquid eveniet harum laborum libero alias ut unde",
    "completed": true
  },
  {
    "userId": 7,
    "id": 131,
    "title": "qui ea incidunt quis",
    "completed": false
  },
  {
    "userId": 7,
    "id": 132,
    "title": "qui molestiae voluptatibus velit iure harum quisquam",
    "completed": true
  },
  {
    "userId": 7,
    "id": 133,
    "title": "et labore eos enim rerum consequatur sunt",
    "completed": true
  },
  {
    "userId": 7,
    "id": 134,
    "title": "molestiae doloribus et laborum quod ea",
    "completed": false
  },
  {
    "userId": 7,
    "id": 135,
    "title": "facere ipsa nam eum voluptates reiciendis vero qui",
    "completed": false
  },
  {
    "userId": 7,
    "id": 136,
    "title": "asperiores illo tempora fuga sed ut quasi adipisci",
    "completed": false
  },
  {
    "userId": 7,
    "id": 137,
    "title": "qui sit non",
    "completed": false
  },
  {
    "userId": 7,
    "id": 138,
    "title": "placeat minima consequatur rem qui ut",
    "completed": true
  },
  {
    "userId": 7,
    "id": 139,
    "title": "consequatur doloribus id possimus voluptas a voluptatem",
    "completed": false
  },
  {
    "userId": 7,
    "id": 140,
    "title": "aut consectetur in blanditiis deserunt quia sed laboriosam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 141,
    "title": "explicabo consectetur debitis voluptates quas quae culpa rerum non",
    "completed": true
  },
  {
    "userId": 8,
    "id": 142,
    "title": "maiores accusantium architecto necessitatibus reiciendis ea aut",
    "completed": true
  },
  {
    "userId": 8,
    "id": 143,
    "title": "eum non recusandae cupiditate animi",
    "completed": false
  },
  {
    "userId": 8,
    "id": 144,
    "title": "ut eum exercitationem sint",
    "completed": false
  },
  {
    "userId": 8,
    "id": 145,
    "title": "beatae qui ullam incidunt voluptatem non nisi aliquam",
    "completed": false
  },
  {
    "userId": 8,
    "id": 146,
    "title": "molestiae suscipit ratione nihil odio libero impedit vero totam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 147,
    "title": "eum itaque quod reprehenderit et facilis dolor autem ut",
    "completed": true
  },
  {
    "userId": 8,
    "id": 148,
    "title": "esse quas et quo quasi exercitationem",
    "completed": false
  },
  {
    "userId": 8,
    "id": 149,
    "title": "animi voluptas quod perferendis est",
    "completed": false
  },
  {
    "userId": 8,
    "id": 150,
    "title": "eos amet tempore laudantium fugit a",
    "completed": false
  },
  {
    "userId": 8,
    "id": 151,
    "title": "accusamus adipisci dicta qui quo ea explicabo sed vero",
    "completed": true
  },
  {
    "userId": 8,
    "id": 152,
    "title": "odit eligendi recusandae doloremque cumque non",
    "completed": false
  },
  {
    "userId": 8,
    "id": 153,
    "title": "ea aperiam consequatur qui repellat eos",
    "completed": false
  },
  {
    "userId": 8,
    "id": 154,
    "title": "rerum non ex sapiente",
    "completed": true
  },
  {
    "userId": 8,
    "id": 155,
    "title": "voluptatem nobis consequatur et assumenda magnam",
    "completed": true
  },
  {
    "userId": 8,
    "id": 156,
    "title": "nam quia quia nulla repellat assumenda quibusdam sit nobis",
    "completed": true
  },
  {
    "userId": 8,
    "id": 157,
    "title": "dolorem veniam quisquam deserunt repellendus",
    "completed": true
  },
  {
    "userId": 8,
    "id": 158,
    "title": "debitis vitae delectus et harum accusamus aut deleniti a",
    "completed": true
  },
  {
    "userId": 8,
    "id": 159,
    "title": "debitis adipisci quibusdam aliquam sed dolore ea praesentium nobis",
    "completed": true
  },
  {
    "userId": 8,
    "id": 160,
    "title": "et praesentium aliquam est",
    "completed": false
  },
  {
    "userId": 9,
    "id": 161,
    "title": "ex hic consequuntur earum omnis alias ut occaecati culpa",
    "completed": true
  },
  {
    "userId": 9,
    "id": 162,
    "title": "omnis laboriosam molestias animi sunt dolore",
    "completed": true
  },
  {
    "userId": 9,
    "id": 163,
    "title": "natus corrupti maxime laudantium et voluptatem laboriosam odit",
    "completed": false
  },
  {
    "userId": 9,
    "id": 164,
    "title": "reprehenderit quos aut aut consequatur est sed",
    "completed": false
  },
  {
    "userId": 9,
    "id": 165,
    "title": "fugiat perferendis sed aut quidem",
    "completed": false
  },
  {
    "userId": 9,
    "id": 166,
    "title": "quos quo possimus suscipit minima ut",
    "completed": false
  },
  {
    "userId": 9,
    "id": 167,
    "title": "et quis minus quo a asperiores molestiae",
    "completed": false
  },
  {
    "userId": 9,
    "id": 168,
    "title": "recusandae quia qui sunt libero",
    "completed": false
  },
  {
    "userId": 9,
    "id": 169,
    "title": "ea odio perferendis officiis",
    "completed": true
  },
  {
    "userId": 9,
    "id": 170,
    "title": "quisquam aliquam quia doloribus aut",
    "completed": false
  },
  {
    "userId": 9,
    "id": 171,
    "title": "fugiat aut voluptatibus corrupti deleniti velit iste odio",
    "completed": true
  },
  {
    "userId": 9,
    "id": 172,
    "title": "et provident amet rerum consectetur et voluptatum",
    "completed": false
  },
  {
    "userId": 9,
    "id": 173,
    "title": "harum ad aperiam quis",
    "completed": false
  },
  {
    "userId": 9,
    "id": 174,
    "title": "similique aut quo",
    "completed": false
  },
  {
    "userId": 9,
    "id": 175,
    "title": "laudantium eius officia perferendis provident perspiciatis asperiores",
    "completed": true
  },
  {
    "userId": 9,
    "id": 176,
    "title": "magni soluta corrupti ut maiores rem quidem",
    "completed": false
  },
  {
    "userId": 9,
    "id": 177,
    "title": "et placeat temporibus voluptas est tempora quos quibusdam",
    "completed": false
  },
  {
    "userId": 9,
    "id": 178,
    "title": "nesciunt itaque commodi tempore",
    "completed": true
  },
  {
    "userId": 9,
    "id": 179,
    "title": "omnis consequuntur cupiditate impedit itaque ipsam quo",
    "completed": true
  },
  {
    "userId": 9,
    "id": 180,
    "title": "debitis nisi et dolorem repellat et",
    "completed": true
  },
  {
    "userId": 10,
    "id": 181,
    "title": "ut cupiditate sequi aliquam fuga maiores",
    "completed": false
  },
  {
    "userId": 10,
    "id": 182,
    "title": "inventore saepe cumque et aut illum enim",
    "completed": true
  },
  {
    "userId": 10,
    "id": 183,
    "title": "omnis nulla eum aliquam distinctio",
    "completed": true
  },
  {
    "userId": 10,
    "id": 184,
    "title": "molestias modi perferendis perspiciatis",
    "completed": false
  },
  {
    "userId": 10,
    "id": 185,
    "title": "voluptates dignissimos sed doloribus animi quaerat aut",
    "completed": false
  },
  {
    "userId": 10,
    "id": 186,
    "title": "explicabo odio est et",
    "completed": false
  },
  {
    "userId": 10,
    "id": 187,
    "title": "consequuntur animi possimus",
    "completed": false
  },
  {
    "userId": 10,
    "id": 188,
    "title": "vel non beatae est",
    "completed": true
  },
  {
    "userId": 10,
    "id": 189,
    "title": "culpa eius et voluptatem et",
    "completed": true
  },
  {
    "userId": 10,
    "id": 190,
    "title": "accusamus sint iusto et voluptatem exercitationem",
    "completed": true
  },
  {
    "userId": 10,
    "id": 191,
    "title": "temporibus atque distinctio omnis eius impedit tempore molestias pariatur",
    "completed": true
  },
  {
    "userId": 10,
    "id": 192,
    "title": "ut quas possimus exercitationem sint voluptates",
    "completed": false
  },
  {
    "userId": 10,
    "id": 193,
    "title": "rerum debitis voluptatem qui eveniet tempora distinctio a",
    "completed": true
  },
  {
    "userId": 10,
    "id": 194,
    "title": "sed ut vero sit molestiae",
    "completed": false
  },
  {
    "userId": 10,
    "id": 195,
    "title": "rerum ex veniam mollitia voluptatibus pariatur",
    "completed": true
  },
  {
    "userId": 10,
    "id": 196,
    "title": "consequuntur aut ut fugit similique",
    "completed": true
  },
  {
    "userId": 10,
    "id": 197,
    "title": "dignissimos quo nobis earum saepe",
    "completed": true
  },
  {
    "userId": 10,
    "id": 198,
    "title": "quis eius est sint explicabo",
    "completed": true
  },
  {
    "userId": 10,
    "id": 199,
    "title": "numquam repellendus a magnam",
    "completed": true
  },
  {
    "userId": 10,
    "id": 200,
    "title": "ipsam aperiam voluptates qui",
    "completed": false
  }
]`,// (ends: https://jsonplaceholder.typicode.com/todos) 

};
