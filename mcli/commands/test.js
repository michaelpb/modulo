async function test(moduloWrapper, config) {
    const { inputFile, testLibrary } = config;
    const file = testLibrary || inputFile;
    let [ html, buildArtifacts, results ] = await moduloWrapper.runAsync(file, 'test');
    console.log('test is over!');
    console.log('test is over!');
    console.log('test is over!');
    console.log('test is over!');
    console.log('test is over!');
}

module.exports = {
    test,
};
