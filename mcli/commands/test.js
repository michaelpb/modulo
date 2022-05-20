async function test(moduloWrapper, config) {
    const { verbose, inputFile, testPath } = config;
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
    const file = testPath || inputFile;

    // Run the test command
    log(`Running tests from: ${file}`);
    let [ html, buildArtifacts, results ] = await moduloWrapper.runAsync(file, 'test');
    if (results) {
        log(`${file} -- TEST SUCCESS!`);
    } else {
        log(`${file} -- TEST FAILURE!`);
    }
}

module.exports = {
    test,
};
