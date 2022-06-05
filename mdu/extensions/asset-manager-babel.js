Modulo.AssetManager.prototype.wrapFunctionText = (({ wrapFunctionText }) => {
    //const { wrapFunctionText } = Modulo.AssetManager.prototype;
    return function (params, text, opts = {}) {

        // Add "exports" alias for maximum compatibility, so that it seems kind
        // of node-like (todo: Maybe do this in base?)
        if (opts.exports) {
            //text = `var exports = ${ opts.exports }.exports;\n${text}`;
        }

        // TODO: Should transform BEFORE wrapping, so its properly silo'ed

        let result = wrapFunctionText.call(this, params, text, opts);
        if (opts.babel) {
            result = Babel.transform(result, opts.babel).code;
        }
        return result;
    }
})(Modulo.AssetManager.prototype);

