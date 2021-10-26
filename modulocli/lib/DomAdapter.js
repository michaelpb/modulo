const { webComponentsUpgrade } = require('./jsdomUtils');

function customElementsUpgrade(elem, factoryInstances) {
    // Assuming JSDOM-style, this upgrades elem's children that are registered
    // as factories.
    // TODO: Refactor into "DomImplementation" adapter engine (linkedom vs
    // jsdom vs puppeteer)
    let allMounted = false;
    let retries = 15; // Test render recursion depth
    let factory;
    while (!allMounted && (--retries > 0)) {
        const sel = (Object.keys(factoryInstances).join(',') || 'X');
        const allModElems = elem.querySelectorAll(sel);
        allMounted = true;
        for (const elem of allModElems) {
            if (elem.isMounted) {
                continue;
            }
            allMounted = false;
            const lowerTag = (elem.tagName || '').toLowerCase();
            for (factory of Object.values(factoryInstances)) {
                if (lowerTag === factory.fullName.toLowerCase()) {
                    break;
                }
            }
            if (!factory) {
                throw new Error('No fac for: ' + lowerTag);
            }

            /*
            console.log('lower tag:', lowerTag);
            if (lowerTag === 'x-testbtn') {
                console.log('------------------------------------')
                console.log('PRE UPGRADE', elem.innerHTML);
                console.log('------------------------------------')
            }
            */
            webComponentsUpgrade(elem, new factory.componentClass());
        }
    }
}

module.exports = {
    customElementsUpgrade,
}
