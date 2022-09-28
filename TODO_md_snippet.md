Markdown-first
-------------------------------

Here's how a ssg-starter can be a blog with Markdown support:


blog/index.html



    <Component name="BlogPostList">
        <Template>
            <h1>Welcome to my blog</h1>
            {% for filename in state.articles %}
                <x-BlogPostSnippet
                    url="/blog/{{ filename }}"
                ></x-BlogPostSnippet>
            {% endfor %}
        </Template>
        <State
            articles:='[
                "2022-03-03_what_modulo_can_do.md",
                "2022-03-01_my_new_blog_post.md",
                "my_favorite_ideas.md"
            ]'
        ></State>
    </Component>


    <Component name="BlogPostSnippet">
        <Props
            url
        ></Props>
        <Template>
            <h3>{{ state.title }}</h3>
            {% if state.loading %}<p><em>Loading...</em></p>{% endif %}
            <p>{{ state.description }}</p>
            <p><a href="{{ props.url }}">Read more...</a></p>
        </Template>
        <State
            loading:=true
            description=''
            title=''
        ></State>
        <!--<Script -src="libraries/js/scrape-page-urljs">-->
        <Script>
            function getTitle(text) {
                return text.match(/<title>([^<]+)</title>/i)[0];
            }
            function getDescription(text) {
                return text.match(/<meta\s+name=.description.\s*content="([^"]+)")[0];
            }
            function initializedCallback() {
                const myElement = element;
                const myState = state;
                const { url } = props;
                modulo.fetchQueue.enqueue(url, (text) => {
                    myState.loading = false;
                    myState.title = getTitle(text);
                    myState.description = getDescription(text);
                    // Maybe change component mode to vanish? Or make a
                    // rerenderAndVanish method
                    myElement.rerender();
                });
            }
        </Script>
    </Component>

    <Component name="BlogPostPage" mode="vanish-into-document">
        <Template>
            <head>
                <title>{{ props.title }}</title>
                <meta name="description" description="{{ props.description }}" />
            </head>
            <body>
            </body>
        </Template>
    </Component>


In that way, the title / description will get scraped by blog post snippet, and
any performance issues get taken care of by pre-building.


