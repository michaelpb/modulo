
// TODO: Move this entire thing into the TestSuite CPart file, so that it will
// work in the browser as well. Then, add a "run()" command for test.

function test(config, modulo, isSrcServe=false) {
    let discovered = [];
    let soloMode = false;
    let skippedCount = 0;
    for (const factory of Object.values(modulo.factoryInstances)) {
        //console.log('factory', factory.fullName);
        const { testsuite } = factory.baseRenderObj;
        if (!testsuite) {
            continue;
        }
        if ('skip' in testsuite.attrs) {
            skippedCount++;
            continue;
        }
        if ('solo' in testsuite.attrs) {
            soloMode = true;
        }
        discovered.push([factory, testsuite]);
    }
    if (soloMode) {
        discovered = discovered.filter(([fac, {attrs}]) => 'solo' in attrs);
    }

    console.log('[%]', discovered.length + ' test suites found');
    const { runTests } = modulo.cparts.testsuite;
    let success = 0;
    let failure = 0;
    let omission = 0;
    const failedComponents = [];

    if (discovered.length === 0) {
        console.warn('OMISSION: No test suites discovered')
        omission++;
    }
    for (const [ factory, testsuite ] of discovered) {
        const info = ' ' + (testsuite.name || '');
        console.group('[%]', 'TestSuite: ' + factory.fullName + info);
        const [ successes, failures ] = runTests(testsuite, factory)
        if (failures) {
            failedComponents.push(factory.fullName);
        }
        success += successes;
        failure += failures;
        if (!successes && !failures) {
            console.log('[%]', 'TestSuite omission: no assertions');
            omission++; // no assertions = 1 omission failure
        }
        console.groupEnd();
    }

    if (skippedCount > 0) {
        console.log(TERM.YELLOW_FG, 'SKIPPED', TERM.RESET, skippedCount,
                    'TestSuite(s) skipped');
    }

    if (config.testLog) {
        let testLogData;
        let highscore = 0;
        const total = failure + success;
        try {
            const testLogFile = fs.readFileSync(config.testLogPath, 'utf8');
            testLogData = JSON.parse(testLogFile);
        } catch (err) {
            console.log('omission: Could not open test log file', err);
            omission++;
        }
        if (testLogData) {
            highscore = testLogData.highscore;
        }

        let data;
        if (total < highscore) {
            console.log('[!] OMISSION:', total, 'assertion(s) ran');
            console.log('[!] OMISSION:', highscore, 'assertion(s) ran previously');
            console.log('[!] (delete ', config.testLogPath, 'to reset)');
            omission += highscore - total;
        } else if (total > highscore) {
            try {
                data = JSON.stringify({ highscore: failure + success }, null, 4);
                fs.writeFileSync(config.testLogPath, data);
            } catch (err) {
                console.log('OMISSION: Could not write to test log file', data, err);
                omission++;
            }
        }
    }

    if (!failure && !omission && success) {
        console.log(TERM.GREEN_FG, 'OK', TERM.RESET,
                    `${success} assertions passed`);
        process.exit(0);
    } else {
        console.log('SUCCESSES:', success, 'assertions passed');
        if (omission) {
            console.log('OMISSIONS:', omission, 'empty test suites or ' +
                        'expected assertions');
        }
        console.log(TERM.RED_FG, 'FAILURE ', TERM.RESET, failure,
          'assertions failed\n Failing components:', failedComponents);
        process.exit(1);
    }
}
