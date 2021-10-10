const defaultConfig = {
    fail: false,
    verbose: false,
    host: '127.0.0.1',
    port: 3333,
    input: 'src-www',
    output: 'www',
    serverApp: null,
    serverAppPath: 'server/index.js',
    ssgRenderDepth: 10,
    isSkip: '^(\\.|_)', // starts with a dot or underscore
    //isCopyOnly: '/?(components?|static)/', // in a one of 2 dirs
    isCopyOnly: '/components?/', // in a one of 2 dirs
    isGenerate: '.*\\.html$', // anything with html ending
    isolateBeforeGenerate: false,
    clearBeforeGenerate: true,
};

module.exports = defaultConfig;

