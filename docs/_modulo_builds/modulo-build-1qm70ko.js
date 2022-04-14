
            
            Modulo.defineAll(); // ensure fetchQ gets defined
            Modulo.fetchQ.data = {
};
            
                "use strict";Modulo.assets.functions["x4cjooh"]= function (CTX, G){
var OUT=[];
OUT.push("\n    <table>\n        <tbody>\n            "); // "<table>\n        <tbody>"
var ARR0=CTX.state.celldata;for (var KEY in ARR0) {CTX. row=ARR0[KEY]; // "for row in state.celldata"
OUT.push("\n                <tr>\n                    "); // "<tr>"
var ARR1=CTX.row;for (var KEY in ARR1) {CTX. col=ARR1[KEY]; // "for col in row"
OUT.push("\n                        <td class=\"hah\">\n                            "); // "<td class=\"hah\">"
OUT.push(G.escapeHTML(CTX.col)); // "col"
OUT.push("\n                        </td>\n                    "); // "</td>"
} // "endfor"
OUT.push("\n                </tr>\n            "); // "</tr>"
} // "endfor"
OUT.push("\n        </tbody>\n    </table>\n"); // "</tbody>\n    </table>"

return OUT.join("");
};
            
            
            window.onload = () => Modulo.defineAll();
        