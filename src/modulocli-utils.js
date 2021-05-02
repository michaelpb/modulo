
function exitErr(message) {
    console.warn(message);
    process.exit(1);
}

function parseArgs(argArray) {
    argArray.shift(); // always get rid of first argument
    if (argArray[0].endsWith('modulocli.js')) {
        argArray.shift(); // shift again, if necessary
    }
    const args = {flags: {}, positional: [], command: null};
    let currentFlag = null;
    for (const arg of argArray) {
        if (arg.startsWith('-')) {
            if (currentFlag) {
                args.flags[currentFlag] = true;
            }
            if (arg.startsWith('--')) {
                currentFlag = arg.slice(2);
            } else {
                currentFlag = null;
                for (const singleChar of arg.split('')) {
                    args.flags[singleChar] = true;
                }
            }
        } else if (currentFlag) {
            args.flags[currentFlag] = arg;
        } else if (args.command === null) {
            args.command = arg;
        } else {
            args.positional.push(arg);
        }
    }
    return args;
}

function checkArgs(split, commands) {
    // presently no-op
}

module.exports = {
  checkArgs,
  parseArgs,
}
