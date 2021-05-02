//const Modulo = require('./src/Modulo');
const utils = require('./modulossg-utils');

const commands = {
    buildjs: args => {
        const loaders = [];
        assert(args.namespace, 'Must specify namespace')
        assert(args.src, 'Must specify src')
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
    //commands[args.command](args);
}

main(process.argv);
