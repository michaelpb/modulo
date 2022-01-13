if (typeof Modulo === 'undefined') {
    var Modulo = require('../modulocli/lib/BaseModulo');
}

class TestSuite extends Modulo.ComponentPart {
    static stateInit(cpart, element, initData) {
        element.cparts.state.eventCallback();
        Object.assign(element.cparts.state.data, initData);
        element.cparts.state.eventCleanupCallback();
    }

    static propsInit(cpart, element, initData) {
        element.initRenderObj.props = initData;
    }

    static templateAssertion(cpart, element, stepConf) {
        const {makeDiv, normalize} = Modulo.utils;
        const _process = 'testWhitespace' in stepConf ? s => s : normalize;
        const text1 = _process(cpart.instance.render(stepConf));

        if ('testValues' in stepConf) {
            for (const input of element.querySelectorAll('input')) {
                input.setAttribute('value', input.value);
            }
        }

        const text2 = _process(element.innerHTML);
        let verb = '---(IS NOT)---';
        let result = true;
        if ('stringCount' in stepConf) {
            const count = Number(stepConf.stringCount);
            // Splitting is a fast way to check count
            const realCount = text2.split(text1).length - 1;
            if (count !== realCount) {
                verb = `=== FOUND BELOW ${realCount} ` +
                        `TIMES (${count} expected) ===`;
                result = false;
            }
        } else {
            result = makeDiv(text1).isEqualNode(makeDiv(text2));
        }
        return [result, `${text1}\n${verb}\n${text2}\n`];
    }

    static scriptAssertion(cpart, element, stepConf, data) {
        let errorValues = [];
        function _reportValues(values) {
            errorValues = values;
        }

        // Apply assert and event macros:
        let assertionText, result;
        // Idea for assert macro: Take expression and put it in an eval, with
        // try/catch and variable dumping
        const assertRe = /^\s*assert:\s*(.+)\s*$/m;
        const isAssertion = assertRe.test(data.content);
        let content = data.content;
        /*
        if (!content.includes('assert:') && !content.includes('event:')) {
            return [false, 'Script tag uses no macro'];
        }
        */

        if (isAssertion) {
            assertionText = content.match(assertRe)[1];
            //content = content.replace(assertRe, 'return $1');

            // Alternate version, that breaks: This will show a "variable exposition" of failure
            const assertRe2 = /\n\s*assert:\s*(.+)\s*$/;
            const explanationCode = assertionText.split(/([^\w_\.]+)/)
                .filter(s => s && !Modulo.INVALID_WORDS.has(s))
                .map(word => (
                    /^[a-zA-Z][\w_\.]*$/g.test(word) ?
                      (`typeof ${word} !== "undefined" ? ${word} : '…'`)
                    : JSON.stringify(word)
                )).join(','); // TODO: Possibly change it to ellispis everything


            content = content.replace(assertRe,
                `_reportValues([${explanationCode}]); return $1`);
        }
        const eventRe = /^\s*event:\s*([a-zA-Z]+)\s+(.+)\s*$/m;
        content = content.replace(eventRe, `
            if (!element.querySelector('$2')) {
                throw new Error('Event target not found: $2');
            }
            element.querySelector('$2').dispatchEvent(new Modulo.globals.Event('$1'));
        `);
        const document = element.ownerDocument;
        const extra = { _reportValues, element, Modulo, document };
        const vars = Object.assign(element.getCurrentRenderObj(), extra);
        let func;
        try {
            func = new Function(Object.keys(vars).join(','), content);
        } catch (err) {
            return [false, `Error occured, cannot compile: ${err}`]
        }

        try {
            result = func.apply(null, Object.values(vars));
        } catch (err) {
            return [false, `Error occured: ${err}`]
        }
        if (!isAssertion) {
            return [undefined, undefined];
        }
        const resultArr = [
            assertionText, '\n', '--(VALUES)-->', '\n'
        ].concat(errorValues);
        return [result, resultArr];
    }

    static doTestStep(element, sName, data) {
        const {testsuite} = Modulo.cparts;
        const attrs = {content: data.content, attrs: data};
        const stepConf = data.attrs;
        const isInit = (sName + 'Init') in testsuite;
        const assertionMethod = testsuite[sName + 'Assertion'];
        let cpart = null;
        if (sName === 'template' || isInit) {
            cpart = new Modulo.cparts[sName](element, attrs);
        }
        if (isInit) {
            const initData = cpart.initializedCallback({[sName]: data});
            testsuite[sName + 'Init'](cpart, element, initData);
            return null;
        } else if (!assertionMethod) {
            throw new Error('Could not find', sName);
        }

        if (!('skipRerender' in stepConf)) {
            // ensure re-rendered before running script
            element.factory().doTestRerender(element);
        }
        const [result, message] = assertionMethod(cpart, element, stepConf, data);
        if (result) {
            return true;
        } else if (result === false) {
            const msgAttrs = stepConf.name ? ` name="${stepConf.name}"` : '';
            console.log(`ASSERTION <${sName}${msgAttrs}> FAILED:`)
            if (message.map) {
                console.log(...message);
            } else {
                console.log(message);
            }
            return false;
        }
        return null;
    }

    static runTests(attrs, factory) {
        const {content} = attrs;
        const {testsuite} = Modulo.cparts;

        let total = 0;
        let failure = 0;

        const parentNode = factory.loader._stringToDom(content);
        for (const testNode of parentNode.children) {
            const element = factory.createTestElement();
            // Could be implied first test?
            Modulo.assert(element.isMounted, 'Successfully mounted element');

            // TODO: Switch to new cpart-container system used by "component" and "module"
            const stepArray = factory.loader.loadFromDOMElement(testNode);
            const testName = testNode.getAttribute('name') || '<test>';

            console.group('[%]', '         ? TEST', testName);
            Modulo.isTest = testName; // useful in tests, maybe remove, or document
            let testTotal = 0;
            let testFailed = 0;
            for (let [sName, data] of stepArray) {
                const result = testsuite.doTestStep(element, sName, data);
                if (result !== null) {
                    testTotal++;
                    total++;
                }
                if (result === false) {
                    testFailed++;
                    failure++;
                }
            }
            const isOk = testFailed ? 'FAILURE' : 'OK     ';
            const successes = testTotal - testFailed;
            console.groupEnd();
            console.log(`[%]  ${isOk} - ${testName} (${successes}/${testTotal})`);
        }
        return [total - failure, failure];
    }
}
Modulo.cparts.testsuite = TestSuite;

if (typeof require !== 'undefined') {
    module.exports = TestSuite;
}


/*
    _ref(node) {
        this.refCount++;
        const key = (node.tagName ? (node.tagName + ' ') : 0) + this.refCount;
        this.refs[key] = node;
        return key;
    }

    _deref(ref) {
        return this.refs[ref];
    }

    patch(node, method, arg, arg2=null) {
        arg2 = arg2 ? this._ref(arg2) : null;
        arg = method === 'node-value' ? arg : this._ref(arg);
        this.patches.push([this._ref(node), method, arg, arg2]);
    }

    applyPatch(node, method, arg, arg2) { // take that, rule of 3!
        arg2 = arg2 ? this._deref(arg2) : null;
        node = this._deref(node);
        if (method === 'node-value') {
            node.nodeValue = arg;
        } else if (method === 'insertBefore') { // Needs 2 args
            node.insertBefore(this._deref(arg), arg2);
        } else { // invoke normal method
            node[method].call(node, this._deref(arg));
        }
    }
*/
