
            
            Modulo.defineAll(); // ensure fetchQ gets defined
            Modulo.fetchQ.data = {
  "/scratchlib.html": // (129 lines)
`<Component name="MiniExcel">
  <!--<Debug></Debug>-->
  <Template>
      <label>\${{ state.col }}\${{ state.row }}=<input [state.bind] name="formula" /></label>
      <table>
          <thead>
              <tr>
                  <th></th>
                  {% for col in state.columns %}
                      <th>{{ col }}</th>
                  {% endfor %}
              </tr>
          </thead>
          <tbody>
              {% for row in state.rows %}
                  <tr>
                      <th>{{ row }}</th>
                      {% for col in state.columns %}
                          <td
                            @click:=script.cellClick
                            payload:='[ "{{ col }}", "{{ row }}" ]'
                            class="
                              {% if state.row == row %}
                                  active-row
                              {% endif %}
                              {% if state.col == col %}
                                  active-col
                              {% endif %}
                            ">
                              {{ state.output|get:row|get:col }}
                          </td>
                      {% endfor %}
                  </tr>
              {% endfor %}
          </tbody>
      </table>
  </Template>

  <State
      col="A"
      row="1"
      formula="Hello world!"
      columns:=[]
      rows:=[]
      cellformulas:={}
      output:={}
  ></State>

  <Script>
      console.log('factory for miniexcel');

      // TODO: fix with proper extension
      function initializedCallback(renderObj) {
          console.log('getting initialized', renderObj);
          setRowsAndCols(1, 20, 'A', 'Z');
          updateOutput();
      }

      function setRowsAndCols(startRow, endRow, startCol, endCol) {
          state.columns = [];
          let colChar = startCol;
          while (colChar <= endCol) {
              state.columns.push(colChar);
              colChar = String.fromCharCode(colChar.charCodeAt(0) + 1);
          }
          state.rows = [];
          let row = startRow;
          while (row < endRow) {
              state.rows.push("" + row);
              row++;
          }
      }

      function updateOutput() {
          state.output = {};
          for (const row of state.rows) {
              state.output[row] = {};
              for (const col of state.columns) {
                  const key = '\$' + state.col + '\$' + state.row;
                  if (key in state.cellformulas) {
                      state.output[row][col] = state.cellformulas[key];
                  } else {
                      state.output[row][col] = '';
                  }
              }
          }
      }

      function cellClick(payload) {
          const [ col, row ] = payload;
          state.col = col;
          state.row = row;
          const key = '\$' + state.col + '\$' + state.row;
          state.formula = key in state.cellformulas ? state.cellformulas[key] : '';
      }
  </Script>

  <Style>
      :host {
          border: 2px solid pink;
          overflow: auto;
          max-width: 300px;
          display: block;
          --accent: pink;
      }

      tr {
          min-height: 1rem;
      }
      td {
          border: 4px solid gray;
          min-width: 1rem;
      }
      td.active-row {
          border-bottom-color: var(--accent);
          border-top-color: var(--accent);
      }
      td.active-col {
          border-left-color: var(--accent);
          border-right-color: var(--accent);
      }
      td.active-row.active-col {
          background: var(--accent);
      }
  </Style>

</Component>

`,// (ends: /scratchlib.html) 

};
            
                "use strict";Modulo.assets.functions["x1i7l3jg"]= function (Modulo, factory, module, component, template, state, element, cparts){var script = { exports: {} };  function __set(name, value) { if (name === 'Modulo') Modulo = value; if (name === 'factory') factory = value; if (name === 'module') module = value; if (name === 'component') component = value; if (name === 'template') template = value; if (name === 'state') state = value; if (name === 'element') element = value; if (name === 'cparts') cparts = value; }

      console.log('factory for miniexcel');

      // TODO: fix with proper extension
      function initializedCallback(renderObj) {
          console.log('getting initialized', renderObj);
          setRowsAndCols(1, 20, 'A', 'Z');
          updateOutput();
      }

      function setRowsAndCols(startRow, endRow, startCol, endCol) {
          state.columns = [];
          let colChar = startCol;
          while (colChar <= endCol) {
              state.columns.push(colChar);
              colChar = String.fromCharCode(colChar.charCodeAt(0) + 1);
          }
          state.rows = [];
          let row = startRow;
          while (row < endRow) {
              state.rows.push("" + row);
              row++;
          }
      }

      function updateOutput() {
          state.output = {};
          for (const row of state.rows) {
              state.output[row] = {};
              for (const col of state.columns) {
                  const key = '$' + state.col + '$' + state.row;
                  if (key in state.cellformulas) {
                      state.output[row][col] = state.cellformulas[key];
                  } else {
                      state.output[row][col] = '';
                  }
              }
          }
      }

      function cellClick(payload) {
          const [ col, row ] = payload;
          state.col = col;
          state.row = row;
          const key = '$' + state.col + '$' + state.row;
          state.formula = key in state.cellformulas ? state.cellformulas[key] : '';
      }
  
return { "initializedCallback": typeof initializedCallback !== "undefined" ? initializedCallback : undefined,
"setRowsAndCols": typeof setRowsAndCols !== "undefined" ? setRowsAndCols : undefined,
"updateOutput": typeof updateOutput !== "undefined" ? updateOutput : undefined,
"cellClick": typeof cellClick !== "undefined" ? cellClick : undefined,
 setLocalVariable: __set, exports: script.exports}
};
            
                "use strict";Modulo.assets.functions["xh14q8n"]= function (CTX, G){
var OUT=[];
OUT.push("\n      <label>$"); // "<label>$"
OUT.push(G.escapeHTML(CTX.state.col)); // "state.col"
OUT.push("$"); // "$"
OUT.push(G.escapeHTML(CTX.state.row)); // "state.row"
OUT.push("=<input [state.bind] name=\"formula\" /></label>\n      <table>\n          <thead>\n              <tr>\n                  <th></th>\n                  "); // "=<input [state.bind] name=\"formula\" /></label>\n      <table>\n          <thead>\n              <tr>\n                  <th></th>"
var ARR0=CTX.state.columns;for (var KEY in ARR0) {CTX. col=ARR0[KEY]; // "for col in state.columns"
OUT.push("\n                      <th>"); // "<th>"
OUT.push(G.escapeHTML(CTX.col)); // "col"
OUT.push("</th>\n                  "); // "</th>"
} // "endfor"
OUT.push("\n              </tr>\n          </thead>\n          <tbody>\n              "); // "</tr>\n          </thead>\n          <tbody>"
var ARR0=CTX.state.rows;for (var KEY in ARR0) {CTX. row=ARR0[KEY]; // "for row in state.rows"
OUT.push("\n                  <tr>\n                      <th>"); // "<tr>\n                      <th>"
OUT.push(G.escapeHTML(CTX.row)); // "row"
OUT.push("</th>\n                      "); // "</th>"
var ARR1=CTX.state.columns;for (var KEY in ARR1) {CTX. col=ARR1[KEY]; // "for col in state.columns"
OUT.push("\n                          <td\n                            @click:=script.cellClick\n                            payload:='[ \""); // "<td\n                            @click:=script.cellClick\n                            payload:='[ \""
OUT.push(G.escapeHTML(CTX.col)); // "col"
OUT.push("\", \""); // "\", \""
OUT.push(G.escapeHTML(CTX.row)); // "row"
OUT.push("\" ]'\n                            class=\"\n                              "); // "\" ]'\n                            class=\""
if (CTX.state.row === CTX.row) { // "if state.row == row"
OUT.push("\n                                  active-row\n                              "); // "active-row"
} // "endif"
OUT.push("\n                              "); // ""
if (CTX.state.col === CTX.col) { // "if state.col == col"
OUT.push("\n                                  active-col\n                              "); // "active-col"
} // "endif"
OUT.push("\n                            \">\n                              "); // "\">"
OUT.push(G.escapeHTML(G.filters["get"](G.filters["get"](CTX.state.output,CTX.row),CTX.col))); // "state.output|get:row|get:col"
OUT.push("\n                          </td>\n                      "); // "</td>"
} // "endfor"
OUT.push("\n                  </tr>\n              "); // "</tr>"
} // "endfor"
OUT.push("\n          </tbody>\n      </table>\n  "); // "</tbody>\n      </table>"

return OUT.join("");
};
            
            
            window.onload = () => Modulo.defineAll();
        