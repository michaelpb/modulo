const defaultConfig = {
    fail: false,
    verbose: false,
    host: '127.0.0.1',
    port: 3333,
    input: 'srcwww',
    output: 'www',
    preload: [],
    buildOutput: './modulo-build-{{versiondate}}-{{hash}}.js',
    buildPreload: '{{input}}/m.js',
    serverApp: null,
    serverAppPath: 'srv/index.js',
    serverFramework: 'express',
    ssgRenderDepth: 10,
    ssgBuildOutput: '{{output}}/js/modulo-build-{{versiondate}}-{{hash}}.js',
    isSkip: '^(\\.|_)', // starts with a dot or underscore
    //isCopyOnly: '?(components?|static)', // in a one of 2 dirs
    isCopyOnly: '^components?$',
    isGenerate: '.*\\.html$', // anything with html ending
    newGlobalsBeforeGenerate: false,
    clearBeforeGenerate: false,
};

module.exports = defaultConfig;

