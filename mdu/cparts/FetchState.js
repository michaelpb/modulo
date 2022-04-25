Modulo.cparts.fetchstate = class FetchState extends Modulo.ComponentPart {
    static factoryCallback(partOptions, factory, renderObj) {
        console.log("thsi is partoptions",partOptions);
        // During factory callback, create each a new template for each URL
        const { defaultOptions } = Modulo.templating;
        const engineClass = Modulo.templating[partOptions.attrs.engine || 'MTL'];
        const opts = Modulo.cparts.fetchstate.getTemplateOptions(defaultOptions);
        // Loop through attributes, compiling a template based on the given
        // template engine for each one
        partOptions.urlTemplates = {};
        for (const [ key, value ] of Object.entries(partOptions.attrs)) {
            const templateText = value.trim(); // strip whitespace
            partOptions.urlTemplates[key] = new engineClass(templateText, opts);
        }
    }

    constructor(element, options) {
        super(element, options);
        this.urlTemplates = options.urlTemplates;
    }

    initializedCallback(renderObj) {
        // When a component is initialized, set up state variables
        if (!this.data) {
            this.data = {};
        }

        for (const key of Object.keys(this.urlTemplates)) {
            if (!(key in this.data)) {
                this.data[key] = null;
            }
        }
        this.data.isReady = false;
        this.data.isLoading = false;
        this.data.isError = false;
        this.data.lastError = null;
        this.allErrors = [];
        this.allLoading = [];
        this.send();
        return this.data;
    }

    send(key) {
        if (key) {
            delete this.lastSynced[key]; // Clear a single URL
        } else {
            this.lastSynced = {}; // Cause a "force refresh" on all URLs
        }
        this.sync();
    }

    renderURL(key) {
        const template = this.urlTemplates[key];
        const context = this.getDefaultContext();
        let url = template.render(context);
        url = url.trim().replace(/\s+/g, ''); // clear ALL whitespace
        return { url, context };
    }

    sync() {
        for (const key of Object.keys(this.urlTemplates)) {
            const { url, context } = this.renderURL(key);

            // Extra request meta options that were set in tags in URL template
            const { METHOD, FORM, HEADERS, BODY } = context;
            const json = context.JSON;

            // FetchState stores a hash value of a string representation of
            // each URL that it queries, to avoid sending the same request
            // twice. If that ever changes, then assumedly the generated
            // request will change as well, and thus it will re-sync.
            const uniqueArr = [ url, METHOD, json, FORM, HEADERS, BODY ];
            const fetchHash = Modulo.utils.hash(JSON.stringify(uniqueArr));
            if (this.lastSynced[key] !== fetchHash) {
                if (url) { // If a URL was constructed, then launch the fetch itself
                    this.doFetch(key, url, METHOD, json, FORM, HEADERS, BODY);
                }
            }
            this.lastSynced[key] = fetchHash; // set it as having been already tried
        }
    }

    eventCleanupCallback() {
        this.sync(); // Try sync-ing after every event
    }

    getDefaultContext() {
        // Get default template rendering context
        const renderObj = this.element.getCurrentRenderObj();
        return Object.assign({
            METHOD: 'GET',
            JSON: null,
            FORM: null,
            HEADERS: null,
            BODY: null,
        }, renderObj);
    }

    doFetch(key, url, method, json, form, extraHeaders, rawBody) {
        // TODO: Write tests!
        const headers = {};
        const fetchOpts = { method };

        if (json) {
            headers['Content-Type'] = 'application/json';
            fetchOpts.body = JSON.stringify(json);
        } else if (form) {
            const formData = new FormData();
            for (const [ key, value ] of Object.entries(FORM)) {
                formData.append(key, value);
            }
            fetchOpts.body = formData;
        } else if (rawBody) {
            fetchOpts.body = rawBody;
        }

        if (extraHeaders) {
            Object.assign(headers, extraHeaders);
        }


        // Construct the options used for the fetch
        if (Object.keys(headers).length) { // custom headers set
            fetchOpts.headers = headers;
        }

        // Add to loading to set isLoading state, then rerender to show
        this.addToLoading(url);
        this.element.rerender();
        console.log('thsi is url', url);
        console.log('thsi is fetchOpts', fetchOpts);

        // And finally queue the fetch itself
        return Modulo.globals.fetch(url, fetchOpts)
            .then(response => response.json())
            .then(result => {
                console.log('Success:', result); // TODO rm
                this.removeFromLoading(url);
                this.isError = false;
                this.data[key] = result;
                this.element.rerender();
            })
            .catch(error => {
                console.error('Error:', error);
                this.removeFromLoading(url);
                this.data.isError = true;
                this.data.lastError = error;
                this.allErrors.push(error)
                this.element.rerender();
            });
    }

    addToLoading(url) {
        this.data.isLoading = true;
        this.allLoading.push(url);
    }

    removeFromLoading(url) {
        this.data.isReady = true;
        const index = this.allLoading.indexOf(url);
        if (index !== -1) {
            this.allLoading.splice(index, 1);
        }
        this.data.isLoading = Boolean(this.allLoading.length); // false if empty
    }
}

// Creates the options for the Template that is instantiated for each URL
Modulo.cparts.fetchstate.getTemplateOptions = (defaultOptions) => ({
    // TODO the registerFunction should come by default?
    makeFunc: (a, b) => Modulo.assets.registerFunction(a, b),
    escapeText: text => {
        if (text && text.safe) { // skip text marked as safe
            return text;
        }
        return encodeURIComponent(text);
    },
    /*filters: {
        ...defaultOptions.filters,
        encodeURI: s => defaultOptions.filters.safe(encodeURI(s)),
    },*/
    tags: {
        ...defaultOptions.tags,
        method: (text, tmplt) => `CTX.METHOD = ${tmplt.parseExpr(text)};`,
        body: (text, tmplt) => `CTX.BODY = ${tmplt.parseExpr(text)};`,
        json: (text, tmplt) => `CTX.JSON = ${tmplt.parseExpr(text)};`,
        form: (text, tmplt) => `CTX.FORM = ${tmplt.parseExpr(text)};`,
        headers: (text, tmplt) => `CTX.HEADERS = ${tmplt.parseExpr(text)};`,
    },
});

