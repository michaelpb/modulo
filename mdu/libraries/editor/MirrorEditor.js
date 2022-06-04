const SIGIL = String.fromCharCode(160); // NBSP (non-breaking space)
const { escapeText } = Modulo.templating.MTL.prototype;
const { safe } = Modulo.templating.defaultOptions.filters;

function syntaxHighlight(text) {
    text = escapeText(text);
    //text = text.replace(/&quot;.*?&quot;/g, '<span class="syn-string">$&</span>');
    //text = text.replace(/&gt;.*?&lt;/g, '<span class="syn-tag">$&</span>');
    text = text.replace(/\*.*?\*/g, '<span class="syn-bold">$&</span>');
    text = text.replace(/_.*?_/g, '<span class="syn-italic">$&</span>');
    text = text.replace(/^#+.*?$/gm, '<span class="syn-header">$&</span>');
    text = text.replace(/^\s*[+*-] /gm, '<span class="syn-ul">$&</span>');
    text = text.replace(/^\s*\d+[\.:]? /gm, '<span class="syn-ol">$&</span>');
    text = text.replace(/^---+$/gm, '<span class="syn-hr">$&</span>');
    text = text.replace(/`.*?`/g, '<span class="syn-code">$&</span>');
    text = text.replace(/\!?\[.*?\]\(.*?\)/g, '<span class="syn-link">$&</span>');
    return safe(text);
}

function mergeStrings(baseText, overlayText) {
    let baseIndex = 0;
    let overlayIndex = 0;
    let results = '';
    while (baseIndex < baseText.length || overlayIndex < overlayText.length) {
        const overlayChar = overlayText[overlayIndex];
        const baseChar = baseText[baseIndex];
        if (baseChar === SIGIL || baseChar === overlayChar) {
            results += (overlayChar && overlayChar !== SIGIL) ? overlayChar : ''; // Ensure str
            overlayIndex++;
        } else { // We are dealing with an insertion in the base:
            results += baseChar ? baseChar : ''; // Ensure str
        }
        baseIndex++; // Always progress through base
    }
    return results;
}

function isCharacterKeyPress(ev) {
    if (typeof ev.which == "number" && ev.which > 0) {
        return !ev.ctrlKey && !ev.metaKey && !ev.altKey && ev.which !== 8;
    }
    return false;
}

// TODO wrap cbs below in callback
let globalDebounce = null;
function keyDown(ev) {
    const key = ev.key;
    const textarea = ev.target;
    setStateAndRerender(textarea); // Ensure state is updated with val 

    // Always clear globalDebounce if it exists
    if (globalDebounce) {
        clearTimeout(globalDebounce);
    }

    // If cursor is before text on the same line
    const originalValue = textarea.value;
    const after = originalValue.substr(state.selectionStart);
    const isOnEmptyLine = /^\s*$/.test(after) || /^\s+[\n\r]+/.test(after);
    if (!isOnEmptyLine || !isCharacterKeyPress(ev)) { // If it's not "normal typing"
        globalDebounce = setTimeout(() => setStateAndRerender(textarea), 50);
        return;
    }

    // Person is typing, remove keydown for as fast as possible
    // interaction
    textarea.removeEventListener('keydown', keyDown);
    // Replace all non-space with sigils, and add sigil to reserve space at caret
    let value = originalValue;
    value = value.replace(/[^\r\n ]/g, SIGIL);
    //value = value.substr(0, state.selectionStart - 1) + SIGIL + value.substr(state.selectionStart - 1);
    textarea.value = value; // Set "blanked" version of textarea
    textarea.style.color = 'black'; // Ensure their text is visible
    textarea.setSelectionRange(state.selectionStart, state.selectionStart);

    globalDebounce = setTimeout(() => {
        state.selectionStart = textarea.selectionStart;
        textarea.value = mergeStrings(textarea.value, originalValue);
        textarea.setSelectionRange(state.selectionStart, state.selectionStart);
        setStateAndRerender(textarea);
        textarea.addEventListener('keydown', keyDown); // restore keydown
    }, 20);
}

function updateDimensions() {
    //console.count('updateDimensions ' + Modulo.utils.hash(props.value));
    const { textarea } = element;
    if (!textarea) {
        return;
    }
    const { scrollTop, clientWidth, clientHeight } = textarea;
    if (state.scrollTop !== scrollTop ||
            state.width !== clientWidth ||
            state.height !== clientHeight) {
        state.scrollTop = scrollTop;
        state.width = clientWidth;
        state.height = clientHeight;
        element.rerender();
    }
}

function setStateAndRerender(textarea) {
    state.selectionStart = textarea.selectionStart;
    if (state.value !== textarea.value) {
        state.value = textarea.value;
        state.editorShadowHtml = syntaxHighlight(textarea.value);
        element.value = state.value;
        element.rerender();
    }
}

function textMount({ el }){
    const value = (props.value || '').trim();
    const textarea = el;
    element.textarea = textarea;
    textarea.value = value;
    setStateAndRerender(textarea);
    textarea.addEventListener('keydown', keyDown);
    try {
        new ResizeObserver(updateDimensions).observe(textarea)
    } catch {
        console.error('Could not listen to resize of textarea');
    }
}

