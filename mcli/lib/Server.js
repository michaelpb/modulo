

function _getModuloMiddleware(config, express) {
    let {
        serverAutoFixSlashes,
        serverAutoFixExtensions,
        serverSetNoCache,
        verbose,
    } = config;
    const log = msg => verbose ? console.log(`|%| - - SERVER: ${msg}`) : null;
    if (serverAutoFixExtensions === true) {
        serverAutoFixExtensions = ['html'];
    }
    const staticSettings = {
        maxAge: 0,
        redirect: serverAutoFixSlashes,
        extensions: serverAutoFixExtensions,
    };
    const staticMiddleware = express.static(config.output, staticSettings);
    log(`Express Static middleware options: ${staticSettings}`);
    return (req, res, next) => {
        if (serverSetNoCache) {
            res.set('Cache-Control', 'no-store');
        }
        log(`${req.method} ${req.url}`);
        staticMiddleware(req, res, next);

        // TODO: Add in "/$username/" style wildcard matches, auto .html
        //       prefixing, etc before static. Behavior is simple:
        //       $username becomes Modulo.route.username for any generates
        //       within this dir (or something similar)
        //this._app.use(this.wildcardPatchMiddleware);
    };
}

