
            
            Modulo.defineAll(); // ensure fetchQ gets defined
            Modulo.fetchQ.data = {
  "/components/layouts.html": // (167 lines)
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

`,// (ends: /components/layouts.html) 

  "/components/examplelib.html": // (676 lines)
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





<component name="SearchBox">
<Template>
<p>Start typing a book name to see "search as you type" (e.g. try &ldquo;the
lord of the rings&rdquo;)</p>

<input [state.bind] name="search" @keyup:=script.typingCallback />

<div class="results {% if state.search.length gt 0 %}visible{% endif %}">
    <div class="results-container">
        {% if state.loading %}
            <img style="margin-top: 30px"
                src="{{ script.exports.loadingGif  }}" alt="loading" />
        {% else %}
            {% for result in state.results %}
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/{{ result.cover_i }}-S.jpg" />
                    <label>{{ result.title }}</label>
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

<Script>
    // Because this variable is created "loose" in the script tag, it becomes a
    // static variable global to all instances of this class (though,
    // thankfully, not global in general -- it's still in an "IFFE")
    // (If we had wanted individual components to be debounced, we'd have
    // needed to attach it to state in the initializedCallback)
    let _globalDebounceTimeout = null;
    function _globalDebounce(func) {
        if (_globalDebounceTimeout) {
            clearTimeout(_globalDebounceTimeout);
        }
        _globalDebounceTimeout = setTimeout(func, 500);
    }

    function typingCallback() {
        state.loading = true;
        const apiBase = 'http://openlibrary.org/search.json'
        const search = \`q=\${state.search}\`;
        const opts = 'limit=6&fields=title,author_name,cover_i';
        const url = \`\${apiBase}?\${search}&\${opts}\`;
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

    // Puting this long URL down here to declutter
    script.exports.loadingGif = ('https://cdnjs.cloudflare.com/ajax/libs/' +
                                 'semantic-ui/0.16.1/images/loader-large.gif');
</Script>

<Style>
    SearchBox {
        position: relative;
        display: block;
        width: 300px;
    }
    input {
        padding: 8px;
        background: coral;
        color: white;
        width: 200px;
        border: none;
    }
    input::after {
        content: '\\1F50E';
    }
    .results-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }
    .results {
        position: absolute;
        height: 0;
        width: 0;
        overflow: hidden;
        display: block;
        border: 2px solid coral;
        border-radius: 0 0 20px 20px;
        transition: height 2s;
        z-index: 1;
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

  "/components/modulowebsite.html": // (565 lines)
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
            label: 'Example Library',
            filename: '/docs/example-library.html',
            children: Object.keys(componentTexts).map(name => _child(name)),
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


`,// (ends: /components/modulowebsite.html) 

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

  "/components/examplelib-tests/SearchBox-tests.html": // (119 lines)
`<test name="Renders based on state">
    <template name="Ensure initial render is correct" test-values>
        <p>Start typing a book name to see "search as you type"
        (e.g. try “the lord of the rings”)</p>
        <input
            [state.bind]
            name="search"
            value=""
            @keyup:=script.typingCallback />
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
        <p>Start typing a book name to see "search as you type"
        (e.g. try “the lord of the rings”)</p>
        <input
            [state.bind]
            name="search"
            value="the lord of the rings"
            @keyup:=script.typingCallback />
        <div class="results visible">
            <div class="results-container">
                <img style="margin-top: 30px"
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
        <p>Start typing a book name to see "search as you type" (e.g. try “the lord of the rings”)</p>
        <input [state.bind]="" name="search" @keyup:="script.typingCallback">
        <div class="results visible">
            <div class="results-container">
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/9255566-S.jpg">
                    <label>The Lord of the Rings</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/8474036-S.jpg">
                    <label>The Fellowship of the Ring</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/528867-S.jpg">
                    <label>The Lord of the Rings Trilogy (Lord of the Rings)</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/1454705-S.jpg">
                    <label>Lord of the Rings</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/2111453-S.jpg">
                    <label>Lord of the Rings</label>
                </div>
                <div class="result">
                    <img src="http://covers.openlibrary.org/b/id/undefined-S.jpg">
                    <label>Lords of the ring</label>
                </div>
            </div>
        </div>
    </template>
</test>


`,// (ends: /components/examplelib-tests/SearchBox-tests.html) 

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

  "/components/modulowebsite/demo.js": // (319 lines)
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
    loader.loadString(componentDef);
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
    min-width: 10%;
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

};
            
                "use strict";Modulo.assets.functions["1n6ue51"]= function (Modulo, factory, module, component, props, template, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

            function clickies() {
                console.log('hi it is clickies');
                const a = 123;
                //a();
            }
        
return { "clickies": typeof clickies !== "undefined" ? clickies : undefined,
 setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["t5kftq"]= function (CTX, G){
var OUT=[];
OUT.push("\n            <button @click:=\"script.clickies\">"); // "<button @click:=\"script.clickies\">"
OUT.push(G.escapeHTML(CTX.props.txt)); // "props.txt"
OUT.push("</button>\n            <p>ABC</p>\n            <!--<div [component.slot]></div>-->\n            <slot>abc</slot>\n            <p>DEF</p>\n        "); // "</button>\n            <p>ABC</p>\n            <!--<div [component.slot]></div>-->\n            <slot>abc</slot>\n            <p>DEF</p>"

return OUT.join("");
};
            
                "use strict";Modulo.assets.functions["x11m00cs"]= function (Modulo, factory, module, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["x1kg0tea"]= function (Modulo, factory, module, component, props, template, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["x1gol8eg"]= function (Modulo, factory, module, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["1n5m36a"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function countUp() {
        state.num++;
    }

return { "countUp": typeof countUp !== "undefined" ? countUp : undefined,
 setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["x1cdn50g"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function addItem() {
        state.list.push(state.text); // add to list
        state.text = ""; // clear input
    }

return { "addItem": typeof addItem !== "undefined" ? addItem : undefined,
 setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["dfca1k"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["o25k49"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    // Because this variable is created "loose" in the script tag, it becomes a
    // static variable global to all instances of this class (though,
    // thankfully, not global in general -- it's still in an "IFFE")
    // (If we had wanted individual components to be debounced, we'd have
    // needed to attach it to state in the initializedCallback)
    let _globalDebounceTimeout = null;
    function _globalDebounce(func) {
        if (_globalDebounceTimeout) {
            clearTimeout(_globalDebounceTimeout);
        }
        _globalDebounceTimeout = setTimeout(func, 500);
    }

    function typingCallback() {
        state.loading = true;
        const apiBase = 'http://openlibrary.org/search.json'
        const search = `q=${state.search}`;
        const opts = 'limit=6&fields=title,author_name,cover_i';
        const url = `${apiBase}?${search}&${opts}`;
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

    // Puting this long URL down here to declutter
    script.exports.loadingGif = ('https://cdnjs.cloudflare.com/ajax/libs/' +
                                 'semantic-ui/0.16.1/images/loader-large.gif');

return { "_globalDebounce": typeof _globalDebounce !== "undefined" ? _globalDebounce : undefined,
"typingCallback": typeof typingCallback !== "undefined" ? typingCallback : undefined,
"dataBackCallback": typeof dataBackCallback !== "undefined" ? dataBackCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["1iu3f2i"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["x1as77n0"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["13lid16"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["uon9pj"]= function (Modulo, factory, module, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["x648bme"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    script.exports.title = "ModuloNews";

return {  setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["xa49eup"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

    function prepareCallback() {
        const calcResult = (state.perc / 100) * state.total;
        return { calcResult };
    }

return { "prepareCallback": typeof prepareCallback !== "undefined" ? prepareCallback : undefined,
 setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["nienp6"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
                "use strict";Modulo.assets.functions["xpmo3gd"]= function (Modulo, factory, module, component, props, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }
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
    loader.loadString(componentDef);
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
};
            
                "use strict";Modulo.assets.functions["xdu5ajb"]= function (Modulo, factory, module, component, props, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'props') props = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
            label: 'Example Library',
            filename: '/docs/example-library.html',
            children: Object.keys(componentTexts).map(name => _child(name)),
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
};
            
                "use strict";Modulo.assets.functions["ki6eec"]= function (Modulo, factory, module, component, template, style, props, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'style') style = value; if (name === 'props') props = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

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
};
            
            
            window.onload = () => Modulo.defineAll();
        