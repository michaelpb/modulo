
{# This is broken: #}
        {% if not state.showclipboard %}
            <button class="m-Btn m-Btn--sm m-Btn--faded"
                    title="Copy this code" @click:=script.doCopy>
                Copy <span alt="Clipboard">&#128203;</span>
            </button>
        {% endif %}

{# This is not broken: #}
            <button class="m-Btn m-Btn--sm m-Btn--faded"
                    title="Copy this code" @click:=script.doCopy
        {% if not state.showclipboard %}
          style="display: none"
        {% endif %}
                    >
                Copy <span alt="Clipboard">&#128203;</span>
            </button>


Reason? The events don't get properly dismounted, I think..? It's trying to
transform from one to the other, but not fully?
