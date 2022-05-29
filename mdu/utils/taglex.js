Modulo.utils.taglex = (function () {
    const ROOT = 'tag_root';
    const TEXT_NODE  = 1;
    const TAG_NODE   = 2;
    const POP        = 1;
    const DOUBLE_POP = 2;
    const NOOP       = 3;

    const reverse = {};
    reverse[exports.POP] = 'POP';
    reverse[exports.DOUBLE_POP] = 'DOUBLE_POP';
    reverse[exports.NOOP] = 'NOOP';

    const utility = {};

    utility.extend = function extend (origin, add) {
        var keys = Object.keys(add || {}), i = keys.length;
        while (i--) { origin[keys[i]] = add[keys[i]]; }
        return origin;
    };
    utility.arg_coerce = function arg_coerce (arg) {
        return Array.prototype.slice.call(arg);
    };
    utility.escape_for_regexp = function escape_for_regexp (str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };

    //var EventEmitter = require('events').EventEmitter;
    //var util = require('util');

    /////////////////////////////////////////////// Lexer
    var Lexer = function (ruleset, default_state, on_func) {
        // This is the only true Lexer, StackParser and TagParser both maintain
        // stack-state
        EventEmitter.call(this);
        this.ruleset = ruleset;
        this.default_state = default_state;
        this.state = default_state;

        // Shortcut for adding a listener to token
        if (on_func) { this.on('token', on_func); }
    };
    util.inherits(Lexer, EventEmitter);

    /*
    Feed text into the lexer
    */
    Lexer.prototype.write = function (text) {
        //console.log("------------", text);
        var res = { text: text };
        while (res.text.length > 0) {
            // process returns remaining text, so we loop through processing all the text
            res = this._process(res.text, this.state);
            if (res === null) { break; }

            // Emit everything
            this._emit_and_token(res.next_state,
                res.initial_text, res.normalized, res.token);
        }
    };

    Lexer.prototype._emit_and_token = function (next_state, initial_text, normalized, token) {
        // Check state for error conditions
        if (next_state === null) {
            var msg = "Entered unknown state with token " + token;
            this.emit("error", new Error(msg));
        }

        // Emit the prefix text, and the token
        if (initial_text.length > 0) {
            this.emit("token", TEXT_NODE, initial_text);
        }
        this.emit("token", TAG_NODE, normalized, token);

        // Check if next state is a "NOOP" operation
        if (next_state === NOOP) {
            // PASS
        } else {
            // store next state for next iteration
            this.state = next_state;
        }
    };



    /*
    Process 1 text node, or 1 text node and 1 tag node
    */
    Lexer.prototype._process = function (text, state) {
        var regexps = this.ruleset.regexps;
        if (!regexps) { // ensure it's compiled
            throw new Error("RuleSet: Writing without compiled");
        }

        var opts = this.ruleset.opts;
        var regexp = regexps[state];
        //console.log(state, text);

        if (!regexp) {
            this.emit("error", new Error("Entered unknown state " + state));
        }

        // perform regexp
        var match = text.match(regexp);

        if (match === null) {
            // entirely text match
            if (text.length > 0) { this.emit("token", TEXT_NODE, text); }
            return null;
        }

        // Found a match, figure out what we matched
        var index = match.index;
        var token = match[0];

        // Normalize the token (based on options) to get state
        var normalized = opts.normalizer ? opts.normalizer(token) : token;
        if (opts.ignore_case) {
            normalized = normalized.toLowerCase();
        }

        // Fetch the next state, ensure is valid
        var next_state = this.ruleset.state_edges[state][normalized] || null;

        // Split text based on token
        var initial_text = text.substring(0, index);
        var remaining_text = text.substring(index + token.length, text.length);

        return {
            next_state: next_state,
            token: token,
            initial_text: initial_text,
            normalized: normalized,
            text: remaining_text,
        };
    };

    exports.Lexer = Lexer;


};





})();
