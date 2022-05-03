Modulo.AssetManager.prototype.wrapFunctionText = (({ wrapFunctionText }) => {
    //const { wrapFunctionText } = Modulo.AssetManager.prototype;
    return function (params, text, opts = {}) {
        let result = wrapFunctionText.call(this, params, text, opts);
        if (opts.babel) {
            result = Babel.transform(result, opts.babel).code;
        }
        return result;
    }
})(Modulo.AssetManager.prototype);

