const test = require('ava');
const {Template} = require('../src/ModuloTemplate');

const makeTest = (templateText, context, expected) => t => {
    const template = new Template(templateText);
    const result = template.render(context);
    t.is(result, expected);
};

const noop = a => a;

test("Basic test", makeTest(
    'This is a {{ test }}!', {'test': 'tester'},
        'This is a tester!'));

test("Sub values", makeTest(
    'This is a {{ test.thing }}, cool. {{ test.thing }}', {'test': {'thing': 'tester'}},
        'This is a tester, cool. tester'));

test("Literal test", makeTest(
    'This is a {{ "testing"|upper }}', {'test': 'tester'},
        'This is a TESTING'));

test("Filter arguments test 1", makeTest(
    'This is a {{ test|add:"123" }}', {'test': 'tester'},
        'This is a tester123'));


test("Filter arguments test 2", makeTest(
    'You have {{ count1 }} '+
        'cherr{{ count1|pluralize:"ies,y" }} '+
        'and {{ count2 }} apple{{ count2|pluralize:"s," }}.', {'count1': 3, 'count2': 1},
        'You have 3 cherries and 1 apple.'));

test("Char test", makeTest(
    [
        'This',
        'isn\'t {',
        'a }?',
        '{{ test|upper }}'
        ].join("\n"), {'test': 'tester'},
        'This\nisn\'t {\na }?\nTESTER'));

test("Escaping test", makeTest(
    [
        'Testing {{ test }} testing {{ test|safe }}'
        ].join("\n"), {'test': '<script>&copy;</script>'},
        'Testing &lt;script&gt;&amp;copy;&lt;/script&gt; testing <script>&copy;</script>'));


test("If test", makeTest(
    [
        '{% if test == "tester" %}',
        'something',
        '{% endif %} else'
        ].join(""), {'test': 'tester'},
        'something else'));

test("If test false", makeTest(
    [
        '{% if test == "TeStEr" %}',
        'something',
        '{% endif %} else'
        ].join(""), {'test': 'tester'},
        ' else'));

test("If else test 1", makeTest(
    [
        '{% if test == "tester" %}',
        'correct',
        '{% else %}',
        'something',
        '{% endif %} else'
        ].join(""), {'test': '4tester'},
        'something else'));


test("If else test 2", makeTest(
    [
        '{% if test == "tester" %}',
        'correct',
        '{% else %}',
        'something',
        '{% endif %} else'
        ].join(""), {'test': 'tester'},
        'correct else'));


test("If else if test", makeTest(
    [
        '{% if test == "tester" %}',
        'wrong1',
        '{% elif test == "tester2"  %}',
        'wrong2',
        '{% elif test == "tester3"  %}',
        'correct',
        '{% endif %} else'
        ].join(""), {'test': 'tester3'},
        'correct else'));

test("Nested test", makeTest(
    [
        '{% if test == "tester" %}',
            '{% if test == "tester" %}',
            'corr',
            '{% endif %}',
        'ect',
        '{% endif %} else'
        ].join(""), {'test': 'tester'},
        'correct else'));


test("Expressions in if statement", makeTest(
    [
        '{% if test|upper == "TESTER" %}',
        'correct',
        '{% endif %} else'
        ].join(""), {'test': 'teSteR'},
        'correct else'));



test("If operations", makeTest(
    [
        '{% if test == "tester" %}0{% endif %}',
        '{% if test != "tester" %}a{% endif %}',
        '{% if test is "tester" %}1{% endif %}',
        '{% if test is not "tester" %}b{% endif %}',
        '{% if test in "tester" %}2{% endif %}',
        '{% if test not in "tester" %}c{% endif %}',
        '{% if "e" in "tester" %}3{% endif %}',
        '{% if "b" in lst %}4{% endif %}',
        '{% if "c" in lst %}d{% endif %}',
        '{% if "three" in dict %}5{% endif %}',
        '{% if 3 == dict.three %}6{% endif %}',
        '{% if 3 > dict.three %}e{% endif %}',
        '{% if 3 < dict.three %}f{% endif %}',
        '{% if 3 != dict.three %}g{% endif %}',
        '{% if 3 <= dict.three %}7{% endif %}',
        '{% if 3 >= dict.three %}8{% endif %}',
        '{% if 4 > dict.three %}9{% endif %}',
        '{% if 4 >= dict.three %}0{% endif %}',
        '{% if 4 <= dict.three %}h{% endif %}',
        '{% if 4 < dict.three %}i{% endif %}',
        '{% if 4 < dict.five %}1{% endif %}',
        ].join(""), {'test': 'tester', 'lst': ['a', 'b'], 'dict': {'three': 3, 'five': 5}},
        '012345678901'));


test("Single argument ifs", makeTest(
    [
        '{% if not doesnotexist %}0{% endif %}',
        '{% if not exists %}a{% endif %}',
        '{% if not isfalse %}1{% endif %}',
        '{% if doesnotexist %}b{% endif %}',
        '{% if exists %}2{% endif %}',
        '{% if isfalse %}c{% endif %}',
        ].join(""), {'exists': true, 'isfalse': false},
        '012'));

test("Reserved word in quotes", makeTest(
    [
        '{% if "is not" != "not in" %}0{% endif %}',
        '{% if "==" == "==" %}3{% endif %}',
        ].join(""), {'not': 'is not'},
        '03'));

// ************************************* *
// For loop testing                    * *
// ************************************* *




test("For loop", makeTest(
    [
        '{% for num in test %}{{ num }}{% endfor %}',
        ].join(""), {'test': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]},
        '0123456789'));

test("Nested for loop", makeTest(
    [
        '{% for n in test %}{% for num in test  %}{{ num }}{% endfor %}{% endfor %}',
        ].join(""), {'test': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]},
        '01234567890123456789012345678901234567890123456789'+
        '01234567890123456789012345678901234567890123456789'
        ));


test("For loop with if", makeTest(
    [
        '{% for num in test %}{% if num > 4 %}{{ num }}{% else %}a{% endif %}{% endfor %}',
        ].join(""), {'test': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]},
        'aaaaa56789'));

test("For loop over objects", makeTest(
    [
        '{% for obj in test %}{{ obj.a|upper }}',
        '{% if obj.a|upper == "C" %}lol{% endif %}{% endfor %}',
        ].join(""), {'test': [{a: 'a'}, {a: 'b'}, {a: 'c'}]},
        'ABClol'));


test("For loop with empty 0", makeTest(
    [
        '{% for num in test %}{{ num }}{% empty %}nothing here{% endfor %}',
        ].join(""), {'test': []},
        'nothing here'
        ));


test("For loop with empty 1", makeTest(
    [
        '{% for num in test %}{{ num }}{% empty %}nothing here{% endfor %}',
        ].join(""), {'test': ['a', 'b', 'c']},
        'abc'
        ));


test("For loop with empty 2", makeTest(
    [
        '{% for num in test1 %}a{% empty %}w{% endfor %}',
        '{% for num in test2 %}{% empty %}nothing here{% endfor %}',
        ].join(""), {'test1': ['a'], 'test2': []},
        'anothing here'
        ));


test("Nested for loop with empty", makeTest(
    [
        '{% for arr in test %}{% for num in arr  %}{{ num }}{% empty %}e{% endfor %}{% empty %}w{% endfor %}',
        ].join(""), {'test': [[], [1, 2, 3], [], ['a', 'b']]},
        'e123eab'));

test('For loop with filter', t => {
    const text = '{% for num in test|first %}{{ num }},{% endfor %}';
    const first = arr => arr[0];
    const template = new Template(text, {filters: {first}});
    const result = template.render({test: ['ab', 1, 2]});
    t.is(result, 'a,b,');
});


test("Test order", t => {
    const text = 'This is a {{ test|a|b:2|caps }} {% lol "ThIs iS a TEst!"|caps %}';
    const template = new Template(text, {
        filters: {
            'a': function (s) { return ['a', 'b', 'correct', 'c']; },
            'b': function (s, a) { return s[a]; },
            'caps': function (s) { return s.toUpperCase(); },
        }, tags: {
            'lol': function (n, G) { return "OUT.push(" + G.parseExpr(n) + ".indexOf('S'));"; },
        }
    });
    const result = template.render({'test': 'tester'});
    t.is(result, 'This is a CORRECT 3');
});



/*
// TODO bug: when variables have portions of things in them, or quotes. need to
// "consume" as opposed to just blindly split
test("Reserved word in quotes BREAKING",
    makeTest([
        '{% if " is not " != "not in" %}0{% endif %}',
        '{% if is == "in" %}1{% endif %}',
        '{% if not != "not in" %}1{% endif %}',
        '{% if not == "is not" %}2{% endif %}',
        ].join("")), {'is': 'in'},
        '01');
*/
