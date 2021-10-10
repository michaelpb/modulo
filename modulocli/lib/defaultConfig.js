const defaultConfig = {
    fail: false,
    verbose: false,
    host: '127.0.0.1',
    port: 3333,
    input: 'srcwww',
    output: 'www',
    buildOutput: './modulo-build-$versiondate-$hash.js',
    serverApp: null,
    serverAppPath: 'srv/index.js',
    ssgRenderDepth: 10,
    buildPreload: '$input/m.js',
    isSkip: '^(\\.|_)', // starts with a dot or underscore
    //isCopyOnly: '?(components?|static)', // in a one of 2 dirs
    isCopyOnly: '^components?$',
    isGenerate: '.*\\.html$', // anything with html ending
    isolateBeforeGenerate: false,
    clearBeforeGenerate: true,
};

module.exports = defaultConfig;

