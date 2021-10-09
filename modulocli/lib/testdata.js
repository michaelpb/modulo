const TEST_HTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf8" />
        <link rel="stylesheet" href="/css/style.css" />

        <template modulo-embed>
            <component name="TestHello">

                <template>
                    Hello world! {{ state.num }}
                    <p style="color: green">I am green</p>
                </template>

                <state num:=3></state>

                <testsuite>
                    <test name="reflects state">
                        <state num:=5></state>
                        <template>Hello world! 5</template>
                        <script>assert: state.num === 5</script>
                    </test>
                </testsuite>

            </component>
        </template>
    </head>

    <body>
        <div>
        <x-TestHello></x-TestHello>
    </body>
`;

module.exports = {
    TEST_HTML,
};
