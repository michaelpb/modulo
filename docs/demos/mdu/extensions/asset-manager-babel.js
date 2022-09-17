Modulo.AssetManager.prototype.wrapFunctionText = (({ wrapFunctionText }) => {
    //const { wrapFunctionText } = Modulo.AssetManager.prototype;
    return function (params, text, opts = {}, hash = null) {

        if (opts.exports) { // TODO: probably should just do this in base
            text = `var exports = ${ opts.exports }.exports;\n${text}`;
        }

        if (opts.babel) {
            text = Babel.transform(text, opts.babel).code
        }

        return wrapFunctionText.call(this, params, text, opts, hash);
        // TODO: Double check that should transform BEFORE wrapping, so its properly silo'ed
        //if (opts.babel) {
        //    result = Babel.transform(result, opts.babel).code;
        //}
        //return result;
    }
})(Modulo.AssetManager.prototype);

