const defaultConfig = {
    // NOTE: Text between STARTHELP and ENDHELP is processed into help text and
    // command descriptions

    // (STARTHELP)
    help: false,
        // [alias: -h] Show this online help text (same as "help" command)

    verbose: false,
        // [alias: -v] Produce noisier logging output for debugging

    host: '127.0.0.1',
        // [alias: -a] For modulo server: Specifies address to bind

    port: 3333,
        // [alias: -p] For modulo server: Specifies port to bind

    input: 'srcwww',
        // Specifies input directory for static site, which will be copied 1:1
        // and transformed into output

    output: 'www',
        // Specifies output directory for static site. This directory
        // is the one that should be served up as your site (e.g. for sites
        // hosted on GitHub Pages, this should be "docs").

    buildOutput: './modulo-build-{{versiondate}}-{{hash}}.js',
        // Use this to specify the path of the BUILD JS bundle output during
        // the SSG step. This file will contain the Modulo source code, all of
        // your components, preloads, and any extra bundled JS files. Also,
        // during the postprocessing step, each GENERATE'd page will be
        // revisited and get a script-tag inserted with the path to this file.
        // This path gets templated using MTL syntax and the following
        // variables available:
        // input, output (the same as config)
        // versiondate (an Ubuntu-esque version number, e.g. 1.10 for a release
        //              in the 10th month of 2021)
        // hash        (the hash uniquely identifying the new build)


    serverApp: null,
        // If you are building a JAMstack-style app, you can use point this
        // path to the file that sets up your backend routes. You can already
        // get this behavior by simply placing a file in "srv/index.js" that
        // exports an Express.js-like "app". When you run "modulocli serve", it
        // will find this file, require it, and then use whatever exported as
        // the server that Modulo attaches it's own middleware to.

    serverAppPath: 'srv/index.js',
        // This is the default value of serverApp if not specified, and
        // changing this behaves the same way with one exception: If it's not
        // found, it will simply warn (in verbose mode) and move on. 
        // Typically this is not changed (instead you should change serverApp).

    serverFramework: 'express',
        // Specify a package to be "required" to host the server. If you change
        // this from "express", the interface of this package should be
        // generally Express.js-like. Typically not changed, but could be
        // useful for upgrading to alternate packages, or specifying a local
        // path to allow middleware or patching.

    serverAutoFixSlashes: false,
        // Set to true to automatically attach "/" to requests that need it
        // (e.g. requesting "/site/news", where "news" is a directory, might
        // turn into "/site/news/" and thus "/site/news/index.html".) Note that
        // this setting ONLY affects the server, it will not affect the SSG
        // output, which will never attempt to fix this or alter paths.

    serverAutoFixExtensions: true,
        // Set to true to automatically attach ".html" to requests that need
        // it, allowing you to skip the .html ending in your links. Note that
        // this setting ONLY affects the server, it will not affect the SSG
        // output, which will always attach .html endings. If you want to hide
        // .html endings for an static-deployed site, you will need to
        // configure this with your static host. Many hosts support this,
        // in fact GitHub Pages does this automatically already, so no
        // configuration necessary there.

    ssgRenderDepth: 10,
        // During the SSG step, this important setting specifies how many times
        // GENERATE will rerender, discovering and attaching Modulo components,
        // before deciding that the page is "good enough" and copying over the
        // results. How many steps do you need? Each time a component renders a
        // subcomponent, or renders in an unpredictable manner (e.g. produces
        // random output), Modulo will need to do another rendering step, since
        // it will keep on rendering until the HTML "stabilizes". Thus, if you
        // expect many nested components, you should set this to a high number.
        // The purpose of this limit is to prevent infinite recursion caused by
        // non-deterministic components. However, you should still avoid
        // non-deterministic components for other reasons.

    ssgBuildOutput: '{{output}}/js/modulo-build-{{versiondate}}-{{hash}}.js',
        // Use this to specify the path of the BUILD JS bundle output during
        // the SSG step. This file will contain the Modulo source code, all of
        // your components, preloads, and any extra bundled JS files. Also,
        // during the postprocessing step, each GENERATE'd page will be
        // revisited and get a script-tag inserted with the path to this file.
        // As with other BUILD paths, this path gets templated using MTL syntax
        // with the same variables available (see buildPath)

    testLog: false,
        // Enable the test log file will keep track of the maximum number of
        // assertions that pass and fail when running. If enabled, an OMISSION
        // FAILURE will occur if the number of assertions ever goes down. This
        // is to ensure that no regressions get introduced which cause tests to
        // not even be "picked up" or fail silently (e.g. Regressions during
        // CPart load-steps can cause tests to not even load).

    testLogPath: '.modulo.testlog.json',
        // Specify the desired file path of your test log file. Do not ignore
        // this file in VCS: Share when collaborating to "lock in" test count.

    isSkip: '^(\\.|_)',
        // For SSG, specify a RegExp string that is tested against every "path
        // part", or each directory or filename that make up a file path. If
        // any path part matches this, it will skip that path and everything
        // under it.  The default behavior is to ignore dot-prefixed and
        // underscore-prefixed hidden files. Since most OS's do not treat
        // underscore-prefixed files to be hidden, this is a handy way to get
        // the SSG to skip a directory, without it being fully hidden.

    isCopyOnly: '^components?$',
        // For SSG, specify a RegExp string that is tested against every "path
        // part", or each directory or filename that make up a file path. If
        // any path part matches this, it will refuse to apply the GENERATE
        // action (i.e.  prerender the file as an Modulo HTML file), even if it
        // otherwise would have. You should set this to match whatever
        // directory (or directories) contain your component files, so it
        // doesn't attempt to "prerender" the component definitions, which
        // might be fine, but more likely will lead to unexpected results.

    isGenerate: '.*\\.html$',
        // For SSG, specify a RegExp string that is tested against each file's
        // entire path (e.g. the $ is the end of the full path).

    // (ENDHELP)

    // Undocumented:

    domEngine: 'jsdom',
        // Which DOM engine to use.

    watchAllowPartialBuilds: false,
        // Not supported.

    watchAllowDeletions: false,
        // By default, WATCH command will not attempt to 

    newGlobalsBeforeGenerate: false,
        // Presently unsupported

    clearBeforeGenerate: false,
        // Presently unsupported

    fail: false,
        // Cause Modulo to fail on some recoverable errors

    // presently not used-v
    rootPath: 'CWD',
        // Override the current working directory to specify a new base path.
        // This will be used when loading relative file paths from the file
        // system. The default is "CWD" for the current directory.

    /*
    // TODO:
    tests: '(^tests$|*.test.html$)',
    */
};

module.exports = defaultConfig;
