function toggleExample(payload) {
    if (state.selected === payload) {
        state.selected = '';
    } else {
        state.selected = payload;
    }
}

function initializedCallback() {
    const eg = getComponentDefs('/libraries/eg.html');
    state.examples = [];
    for (const [ name, content ] of Object.entries(eg)) {
        state.examples.push({ name, content });
    }
    element.rerender();
}

