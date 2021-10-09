const Modulo = require('./lib/ModuloNode');
const cliutils = require('./lib/utils');
const fs = require('fs');

const defaultConfig = {
    generate: {
        input: 'src-www',
        output: 'www',
        check: {
            isSkip: '(^\\.|^_)',
            isCopyOnly: '/components?/', // should determine based on content?
            isGenerate: '.*\\.html$', // anything with html ending
        },
    },
};

let modulo = null;
const TEST_TEXT = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf8" />
        <link rel="stylesheet" href="/css/style.css" />

        <template modulo-embed>
            <component name="TestHello">

                <template>
                    Hello world! {{ state.num }}
                    <p style="color: green">I am green</p>
                </template>

                <state num:=3></state>

                <testsuite>
                    <test name="reflects state">
                        <state num:=5></state>
                        <template>Hello world! 5</template>
                        <script>assert: state.num === 5</script>
                    </test>
                </testsuite>

            </component>
        </template>
    </head>

    <body>
        <x-TestHello></x-TestHello>
    </body>
`;

function findConfig(args, callback) {
    if ('config' in args.flags) {
        fs.readFile(args.flags.config, 'utf8', (data, err) => {
            if (err) {
                console.log('Could not read path:', args.flags.config);
                throw err;
            }

            callback(JSON.parse(data), args);
        });
        return;
    }

    fs.readFile('./modulo.json', 'utf8', (err1, data) => {
        if (err1) {
            fs.readFile('./package.json', (err2, data) => {
                if (err2) {
                    callback(defaultConfig, args);
                } else {
                    const jsonData = JSON.parse(data);
                    if (jsonData.modulo) {
                        callback(jsonData.modulo, args);
                    } else {
                        callback(defaultConfig, args);
                    }
                }
            });
        } else {
            callback(JSON.parse(data), args);
        }
    });
}

function doCommand(config, args) {
    if (config.modulo) {
        config = config.modulo; // if there's a modulo key, only use that
    }

    modulo = new Modulo();
    let {command, positional, flags} = args;

    const preloadFiles = (config.preload || []).concat(positional || []);
    const preloadQueue = new modulo.FetchQueue();
    for (let filePath of preloadFiles) {
        if (filePath === '-') {
            filePath = 0; // load from stdin, which has FD=0
        }
        preloadQueue.enqueue(filePath, source => {
            modulo.loadText(source);
        });
    }

    preloadQueue.wait(() => {
        //modulo.loadText(TEST_TEXT);
        modulo.defineAll();

        if (!command) {
            command = 'repl';
        }
        if (!(command in modulo.commands) || 'h' in args.flags) {
            command = 'help';
        }
        console.log(cliutils.TERM.LOGOLINE, command, cliutils.TERM.RESET);
        modulo.commands[command](modulo);
    })
}

function main(argv, shiftFirst=false) {
    const args = cliutils.parseArgs(argv, shiftFirst);
    findConfig(args, doCommand);
}

function getModuloInstance() {
    return modulo;
}

if (require.main === module) {
    main(process.argv, true);
}

module.exports = {
    doCommand,
    findConfig,
    getModuloInstance,
    main,
};

