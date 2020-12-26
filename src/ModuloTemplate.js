'use strict';
if (typeof require !== 'undefined' && typeof Modulo === 'undefined') {
    var Modulo = require('./Modulo.js'); // Node environment
    var HTMLElement = Modulo.globals.HTMLElement;
}
if (typeof Modulo === 'undefined' || !Modulo) {
    throw new Error('ModuloDebugger.js: Must load Modulo first');
}
if (typeof globals === 'undefined') {
    var {globals} = Modulo;
}

const defaultOptions = {
    operators: ['==', '>', '<', '>=', '<=', '!=', 'not in', 'is not', 'is', 'in', 'not'],
    opTrans: {
        '!=':'X !== Y',
        '==':'X === Y',
        'is': 'X === Y',
        'is not': 'X !== Y',
        'not': '!(Y)',
        'in': 'typeof Y[X] !== "undefined" || Y.indexOf && Y.indexOf(X) != -1',
    },
};

defaultOptions.modes = {
    '{%': (text, tmplt, stack) => {
        const tTag = tmplt.trim(text).split(' ')[0];
        const tagFunc = tmplt.tags[tTag];
        if (stack.length && tTag === stack[stack.length - 1].close) {
            return stack.pop().end; // Closing tag, return it's end code
        } else if (!tagFunc) { // Undefined template tag
            throw new Error('Unknown tag:', tTag);
        } // Normal opening tag
        const result = tagFunc(text.slice(tTag.length + 1), tmplt);
        if (!result.end) { // Self-closing tTag
            return result;
        }
        stack.push({close: `end${tTag}`, ...result}); // Add open tag to stack
        return result.start;
    },
    '{#': (text, tmplt) => {},
    '{{': (text, tmplt) => `OUT.push(G.escapeHTML(${tmplt.expression(text)}));`,
    text: (text, tmplt) => text && `OUT.push(${JSON.stringify(text)});`,
};

defaultOptions.filters = {
    upper: s => s.toUpperCase(),
    lower: s => s.toLowerCase(),
    escapejs: s => JSON.stringify(s),
    first: s => s[0],
    last: s => s[s.length - 1],
    length: s => s.length,
    safe: s => Object.assign(new String(s), {safe: true}),
    join: (s, arg) => s.join(arg),
    pluralize: (s, arg, b) => arg.split(',')[(s === 1) * 1],
    add: (s, arg) => s + arg,
    subtract: (s, arg) => s - arg,
    default: (s, arg) => s || arg,
    divisibleby: (s, arg) => ((s * 1) % (arg * 1)) === 0,
};

defaultOptions.tags = {
    'if': (n, tmplt, b, c) => {
        const a = n.split(tmplt.operatorRegExp);
        let d = a.length > 1 ? (tmplt.opTrans[a[1]] || ('X ' + a[1] + ' Y')) : 'X';
        d = d.replace(/([XY])/g, (k, m) => tmplt.expression(a[m === 'X' ? 0 : 2]));
        const start = `if (${d}){`;
        return {start, end: '}'};
    },
    'else': () => '} else {',
    'elif': (s, tmplt) => '} else ' + tmplt.tags['if'](s, tmplt).start,
    'comment': () => ({ start: "/*", end: "*/"}),
    'for': (text, G) => {
        // Keeps unique arr ids to get over JS's quirky scoping
        const arr = 'arr' + G.stack.length;
        const split = text.split(' in ');
        const vars = split[0].split(',');
        let start = 'var '+arr+'='+G.expression(split[1])+';';
        start += 'for (var key in '+arr+') {';
        if (vars.length > 1) {
            start += 'CTX.'+G.getWord(vars[0])+'=key;';
            vars = vars[1];
        }
        start += 'CTX.'+G.getWord(vars)+'='+arr+'[key];';
        return {start, end: '}'};
    },
    'empty': (text, {stack}) => {
        // make not_empty be based on nested-ness of tag stack
        const varname = 'G.forloop_not_empty' + stack.length;
        const old_end = stack.pop().end; // get rid of dangling for
        return {
            'start': varname+'=true;'
                + old_end + '\nif (!'+varname+') {',
            'end': '}'+varname+'=false;',
            'close': 'endfor'
        }
    },
};


Modulo.Template = class Template {
    constructor(text, options = {}) {
        const modeTokens = options.modeTokens || ['{% %}', '{{ }}', '{# #}'];
        Object.assign(this, defaultOptions, options);
        this.tokensRegEx = '(' + modeTokens.join('|(').replace(/ +/g, ')(.+?)');
        this.operatorRegExp = RegExp(' ('+this.operators.join('|')+') ')
        this.opTrans['not in'] = '!(' + this.opTrans['in'] + ')';
        this.renderFunc = this.compile(text);
    }

    compile(templateText) {
        this.stack = []; // Template tag stack
        let output = '';
        let tokens = templateText.split(RegExp(this.tokensRegEx));
        tokens = tokens.filter(token => token !== undefined);
        let mode = 'text';
        for (const token of tokens) {
            if (mode) {
                output += (this.modes[mode](token, this, this.stack)) || '';
            }
            mode = (mode === 'text') ? null : (mode ? 'text' : token);
        }
        const f = new Function('CTX,FILTERS,OUT,G', output + ';return OUT.join("");');
        return function CompiledTemplate(renderContext) {
            return f(renderContext, this.filters, [], this);
        };
    }

    expression(text) {
        const filters = text.split('|');
        let results = this.value(filters.shift());
        for (const [fName, arg] of filters.map(s => s.trim().split(':'))) {
            const argList = arg ? ',' + this.value(arg) : '';
            results = `FILTERS["${fName}"](${results}${argList})`;
        }
        return results;
    }

    value(s) {
        s = this.trim(s);
        if (s.match(/^('.*'|".*")$/)) {
            return JSON.stringify(s.substr(1, s.length - 2));
        } else if (s.match(/^\d+$/)) {
            return s;
        } else { // Variable name
            return `CTX.${s}`;
        }
    }

    getWord(text) { // deadcode?
        return (text + '').replace(/[^a-zA-Z0-9$_\.]/g, '');
    }
    trim(k) {
        return k.replace(/^\s+|\s+$/g, '');
    }

    render(context) {
        return this.renderFunc(context);
    }

    escapeHTML(text = '') {
        return text.safe ? text : (text + '').replace(/&/g, '&amp;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

if (typeof module !== 'undefined') {
    module.exports = Modulo; // Node environment
}
