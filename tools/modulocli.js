//const Modulo = require('./src/Modulo');
const utils = require('./modulocli-utils');
const path = require('path');

const commands = {
    ssg: args => {
        const inputDir = args.positional[0];
        const outputDir = args.flags.output;
        utils.assert(inputDir, 'Specify a source directory');
        utils.assert(outputDir, 'Specify output dir, e.g. --output=docs/');

        const rootPath = path.resolve(inputDir);
        const filenames = utils.walkSync(inputDir);
        for (const inputPath of filenames) {
            const outputPath = outputDir + inputPath.slice(inputDir.length);
            utils.mkdirToContain(outputPath);
            const ext = path.extname(inputPath).slice(1).toLowerCase();

            // TODO: Should add "static" dir that's always copied, replace
            // 'components' check with that
            // OR, better yet, only "flip" HTML files it finds that
            // start with <!DOCTYPE HTML
            const isStatic = inputPath.includes('/components/');
            if (ext === 'html' && !isStatic) {
                utils.renderModuloHtml(rootPath, inputPath, outputPath, (subPaths, inputContents) => {
                    console.log('RENDERED:', inputPath, '->', outputPath);
                    if (subPaths) {
                        console.log('         ', Array.from(inputPath.length).join(' '),
                                    `-> NOTE: ${subPaths.length} subpaths`);
                        for (const newFilePath of subPaths) {
                            utils.mkdirToContain(newFilePath);
                            utils.renderModuloHtmlForSubpath(rootPath,
                                    inputContents, inputPath, newFilePath, () => {
                                console.log('RENDERED SUB-PATH:', inputPath, '->', newFilePath);
                            });
                        }
                    }

                });
            } else if (ext in args.flags) {
                // DEADCODE, unused code path
                const tmpltPath = args.flags[ext];
                fs.readFile(inputPath, 'utf8', (err, content) => {
                    //const args = {inputPath, outputPath, filenames, content};
                    utils.renderModuloHtml(inputDir, tmpltPath, outputPath, (subPaths) => {
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
