const fs = require('fs');
const path = require('path');

const {
    ACTIONS,
    walkSync,
    getAction,
    logStatusBar,
    unlockToWrite,
    ifDifferentAsync,
    mirrorMTimesAsync,
} = require('../lib/cliUtils');

function hackPostprocess(html, buildArtifacts) {
    if (!/^<!doctype html>/i.test(html)) {
        // Ensure all documents start with doctype
        html = '<!DOCTYPE HTML>\n' + html;
    }

    // --- XXX --- HACK
    // Inject hacky script after loading Modulo.js
    // TODO: Remove in favor of a consistent treatment, once m.bundle() is done
    html = html.replace('<script src="/js/Modulo.js"></script>', `
        <meta charset="utf8" />
        <script src="/js/Modulo.js"></script>
        <script>
        if (!Modulo.fetchQ) {
            Modulo.fetchQ = new Modulo.FetchQueue();
            Modulo.assets = new Modulo.AssetManager();
        }
        window.onload = () => {
            Modulo.fetchQ.wait(() => {
                Modulo.defineAll();
            });
        };
        </script>
    `);
    // --- XXX --- HACK

    for (const { absUriPath, filename } of buildArtifacts) {
        if (filename.toLowerCase().endsWith('.js')) {
            // JS File, insert at end of body
            html = html.replace('</body>', `<script src="${absUriPath}"></script>\n</body>`);
        } else if (filename.toLowerCase().endsWith('.css')) {
            // JS File, insert at end of body
            html = html.replace('</head>', `<link rel="stylesheet" href="${absUriPath}">\n</head>`);
        } else {
            console.log('ERROR: Unknown build artifact type: ', filename);
        }
    }
    return html;
}


async function doGenerate(moduloWrapper, config) {
    const { inputFile, output, outputFile, verbose, force, buildPath } = config;
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;
    const action = getAction(inputFile, config);
    const inputRelPath = path.relative('.', inputFile);
    const outputRelPath = path.relative('.', outputFile);
    if (action === ACTIONS.SKIP) {
        log('SKIPPING ' + inputRelPath);
        return false;
    }

    if (!force) {
        const isDifferent = await ifDifferentAsync(inputFile, outputFile);
        if (!isDifferent) {
            log('(SAME)   ' + inputRelPath + ' -> ' + outputRelPath);
            return false;
        }
    }

    // Not skipping, doing COPY, CUSTOM, or GENERATE
    if (action === ACTIONS.COPY) {
        log('COPY     ' + inputRelPath + ' -> ' + outputRelPath);
        await unlockToWrite(outputFile, null, log);
        await fs.promises.copyFile(inputFile, outputFile);
    } else if (action === ACTIONS.CUSTOM) {
        log('CUSTOM   ' + inputRelPath + ' -> ' + outputRelPath);
        throw new Error('Custom inputFile generators not implemented');
    } else if (action === ACTIONS.GENERATE) {

        log('GENERATE ' + inputRelPath + ' -> ' + outputRelPath);
        let [ html, buildArtifacts ] = await moduloWrapper.runAsync(inputFile, 'build');

        // First, write buildArtifacts (result of build / bundle cmd)
        for (let artifactInfo of buildArtifacts) {
            const { filename, text } = artifactInfo;
            artifactInfo.outputPath = path.resolve(output, './' + buildPath, filename);
            artifactInfo.absUriPath = (`/${buildPath}/${filename}`).replace(/\/\//g, '/');
            await unlockToWrite(artifactInfo.outputPath, text, log);
        }

        // Then, do post processing and write main HTML
        //html = hackPostprocess(html, buildArtifacts);
        await unlockToWrite(outputFile, html, log);

    } else {
        throw new Error('Invalid action');
    }

    await mirrorMTimesAsync(inputFile, outputFile);
    return true;
}

async function generate(moduloWrapper, config) {
    const { input, inputFile, output, verbose, generateCheckDeps } = config;
    const log = msg => verbose ? console.log(`|%| - - ${msg}`) : null;

    if (!inputFile || !output) {
        console.error('ERROR: "generate" needs "--inputFile" and "--output"');
        return;
    }

    // Calculate relative outputFile to inputFile
    const relPath = path.relative(input, inputFile);
    const outputFile = path.resolve(output, relPath);

    // Prep conf and then do generate action
    const conf = Object.assign({}, config, { outputFile });
    const didGenerate = await doGenerate(moduloWrapper, conf);
    if (!generateCheckDeps || !didGenerate) {
        return;
    }

    // Now check for dependencies, and regenerate those

    // TODO: Move dep stuff to a new class, make it relative, and serialize to
    // disk, then auto "force build" if it's not found, to regenerate full dep
    // structure
    const deps = moduloWrapper.getDependencies(inputFile);
    log(`GENERATE: Found ${deps.length} dependencies for ${inputFile}`);
    for (const outputRelPath of deps) {
        const outputFile = path.resolve(output, outputRelPath);
        const conf = Object.assign({}, config, { outputFile });
        await doGenerate(moduloWrapper, conf);
    }
}

async function ssg(moduloWrapper, config) {
    const files = walkSync(config.input, config);

    let count = 0;
    // Store all files that are slower in a set
    const slowFilesRemaining = new Set(files.filter(file => {
        const a = getAction(file, config);
        return a === ACTIONS.GENERATE || a === ACTIONS.CUSTOM;
    }));
    const slowTotal = slowFilesRemaining.size;
    for (const inputFile of files) {
        const extra = { inputFile, generateCheckDeps: false };
        const conf = Object.assign({}, config, extra);
        await generate(moduloWrapper, conf);

        logStatusBar('SSG', slowTotal - slowFilesRemaining.size, slowTotal);
        slowFilesRemaining.delete(inputFile); // remove file if slow
    }
    moduloWrapper.close();
}

module.exports = { generate, ssg };
