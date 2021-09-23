//const Modulo = require('./src/Modulo');
const utils = require('./modulocli-utils');
const path = require('path');

const commands = {
    ssg: args => {
        const inputDir = args.positional[0];
        const outputDir = args.flags.output;
        utils.assert(inputDir, 'Specify a source directory');
        utils.assert(outputDir, 'Specify output dir, e.g. --output=docs/');
        const filenames = utils.walkSync(inputDir);
        for (const inputPath of filenames) {
            const outputPath = outputDir + inputPath.slice(inputDir.length);
            utils.mkdirToContain(outputPath);
            const ext = path.extname(inputPath).slice(1).toLowerCase();
            if (ext === 'html') {
                utils.renderModuloHtml(inputPath, outputPath, null, () => {
                    console.log('RENDER:', inputPath, '->', outputPath);
                });
            } else if (ext in args.flags) {
                const tmpltPath = args.flags[ext];
                fs.readFile(inputPath, 'utf8', (err, content) => {
                    const args = {inputPath, outputPath, filenames, content};
                    utils.renderModuloHtml(tmpltPath, outputPath, args, () => {
                        console.log('TEMPLATE:', inputPath, '->', outputPath,
                                    `(USING: ${tmpltPath})`);
                    });
                });
            } else {
                utils.copyIfDifferent(inputPath, outputPath, null, () => {
                    console.log('COPIED:', inputPath, '->', outputPath);
                });
            }
        }
    },
    buildjs: args => {
        // BROKEN
        const loaders = [];
        utils.assert(args.namespace, 'Must specify namespace')
        utils.assert(args.src, 'Must specify src')
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) throw err;
            const loader = new Modulo.Loader(args.namespace, args.src);
            loaders.push(loader);
            loader.loadString(data);
        });
    },
};

function main(argv) {
    const args = utils.parseArgs(Array.from(argv));
    utils.checkArgs(args, commands);
    commands[args.command](args);
}

main(process.argv);
