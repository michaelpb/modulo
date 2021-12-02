<component name="Test_VanishIntoDocument" mode="vanish-into-document">
    <template>
        <head>
            <link href="whatevs.css" /><title>Hello Vanish</title>
        </head>
        <body>
            <h1>Hello World</h1>
            <div>{{ component.originalHTML|safe }}</div>
        </body>
    </template>
</component>

<component name="Test_Vanish" mode="vanish">
    <!-- Note: Link etc SHOULD NOT get scooped into head since its vanish, not
    vanish-into-document -->
    <template>
        <head> <link href="whatevs.css" /> </head>
        <body>
            <h1>Hello World</h1>
            <div>{{ component.originalHTML|safe }}</div>
        </body>
    </template>
</component>


<component name="Test_RootRegular" mode="regular">
    <template>
        <head> <link href="whatevs.css" /> </head>
        <body>
            <h1>Hello World</h1>
            <div>{{ component.originalHTML|safe }}</div>
        </body>
    </template>
</component>


<component name="Test_RootShadow" mode="shadow">
    <template>
        <head> <link href="whatevs.css" /> </head>
        <body>
            <h1>Hello World</h1>
            <div>{{ component.originalHTML|safe }}</div>
        </body>
    </template>
</component>

<component name="ComponentCPart_ModeTester">
    <state
        rootmode="vanish"
    ></state>
    <template>
        <div id="a">
            {% if state.rootmode == "vanish" %}
                <x-Test_Vanish><p>Abc</p></x-Test_Vanish>
            {% elif state.rootmode == "vanish-into-document" %}
                <x-Test_VanishIntoDocument><p>Def</p></x-Test_VanishIntoDocument>
            {% elif state.rootmode == "element" %}
                <x-Test_RootRegular><p>Hij</p></x-Test_RootRegular>
            {% elif state.rootmode == "shadow" %}
                <x-Test_RootShadow><p>Jkl</p></x-Test_RootShadow>
            {% endif %}
        </div>
    </template>

    <testsuite>

        <test name="Root mode: element">
            <state
                rootmode="element"
            ></state>
            <template name="Regular rendering within element">
                <div id="a">
                    <x-test_rootregular>
                        <link href="whatevs.css">
                        <h1>Hello World</h1>
                        <div><p>Hij</p></div>
                    </x-test_rootregular>
                </div>
            </template>

            <script name="Empty head" skip-rerender>
                assert: document.head.innerHTML === ''
            </script>
        </test>

        <test name="Root mode: vanish">
            <state
                rootmode="vanish"
            ></state>
            <template>
                <div id="a">
                    <link href="whatevs.css">
                    <h1>Hello World</h1>
                    <div><p>Abc</p></div>
                </div>
            </template>

            <script name="Empty head" skip-rerender>
                assert: document.head.innerHTML === ''
            </script>
        </test>

        <test name="Root mode: shadow">
            <state
                rootmode="shadow"
            ></state>
            <template name="ShadowDOM rendering within element">
                <div id="a">
                    <x-test_rootshadow><p>Jkl</p></x-test_rootshadow>
                </div>
            </template>

            <script name="Rendered to shadow DOM instead" skip-rerender>
                const elem = document.querySelector('x-test_rootshadow');
                const expected = "<link href=\"whatevs.css\"> \n        \n            <h1>Hello World</h1>\n            <div><p>Jkl</p></div>";
                const actual = elem.shadowRoot.innerHTML.trim()
                assert: actual === expected
            </script>

            <script name="Empty head" skip-rerender>
                assert: document.head.innerHTML === ''
            </script>
        </test>

        <test name="Root mode: vanish-into-document">
            <state
                rootmode="vanish-into-document"
            ></state>
            <script name="HTML body element is as expected">
                const expectedBody = '<h1>Hello World</h1>\n            <div><p>Def</p></div>';
                const actual = document.body.innerHTML.trim();

                assert: actual === expectedBody
            </script>

            <script name="HTML head element is as expected" skip-rerender>
                const expectedHead = '<link href="whatevs.css"><title>Hello Vanish</title>';
                const actual = document.head.innerHTML;

                assert: actual === expectedHead
            </script>
        </test>

    </testsuite>
</component>


