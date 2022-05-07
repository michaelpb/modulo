
Modulo.cparts.midi = class WebMidiAdaptor extends Modulo.ComponentPart {
    initializedCallback() {
        if (!this.attrs.engine) {
            this.WebMidi = WebMidi; // Use WebMidi API
        } else{
            this.WebMidi = this.attrs.engine;
        }

        this.data = {}; // misc state-like data to be exposed
        //this.data.devices = []; // Store high level interface of attached devices
        // Enable WebMidi.js and trigger the onEnabled() function when ready
        this.data.isError = false;
        this.data.isReady = false;

        //this.WebMidi.addListener('connected', (ev) => this.addInput(ev.target));
        //this.WebMidi.addListener('disconnected', (ev) => this.removeInput(ev.target));

        this.WebMidi.addListener('enabled', ev => this.element.rerender());
        this.WebMidi.addListener('connected', ev => this.element.rerender());
        this.WebMidi.addListener('disconnected', ev => this.element.rerender());

        this.WebMidi
          .enable()
          .then(() => {
              this.data.isReady = true;
              this.element.rerender();
          })
          .catch(err => {
              this.data.isError = true;
              this.data.error = err;
              this.element.rerender();
          });
    }

    /*
    findOrCreateDevice(input) {
        let foundDevice = null;
        for (const device of this.data.devices) {
            if (device.name === input.name || device.id === input.id) {
                foundDevice = device;
                break;
            }
            // Now check for fuzzy match
            //console.log("thsi is input", input);
        }

        if (!foundDevice) {
            foundDevice = {
                id: input.id,
                name: input.name,
                inputs: [],
                outputs: [],
            };
        }
        return foundDevice;
    }

    selectInput(inputId) {
        if (this.selectedInputListeners) {
            for (const listener of this.selectedInputListeners) {
                listener.remove(); // close out existing listeners
            }
        }

        const device = this.data.devices.find(({ id }) => id === inputId);
        this.data.inputDevice = device;
        const input = device.inputs[0];
        this.selectedInputListeners = WebMidi.inputs[0].addListener('noteon', this.noteOn.bind(this));
    }
    */

    selectInput(inputId) {
        if (this.selectedInputListeners) {
            for (const listener of this.selectedInputListeners) {
                listener.remove(); // close out existing listeners
            }
        }

        this.data.input = this.WebMidi.inputs.find(input => input.id === inputId);
        this.selectedInputListeners = this.data.input.addListener('noteon', this.onEvent.bind(this));
        this.selectedInputListeners = this.data.input.addListener('noteoff', this.onEvent.bind(this));
    }

    onEvent(ev) {
        this.data.lastInputNote = ev.note;
        this.data.lastInputChannel = ev.target;
        const renderObj = this.element.getCurrentRenderObj(); // mess XXX
        renderObj.note = String(ev.note.identifier); // XXX
        this.element.lifecycle([ 'note' ]);
        this.element.rerender(); // have different rerender modes
    }

    noteOn(identifier) {
        const renderObj = this.element.getCurrentRenderObj(); // mess XXX
        renderObj.note = String(identifier); // XXX
        this.element.lifecycle([ 'note' ]);
        this.element.rerender(); // have different rerender modes
    }

    noteOff(identifier) {
    }

    /*
    addInput(input) {
        const device = this.findOrCreateDevice(input);
        device.inputs.push(input);
        this.element.rerender();
    }

    removeInput(input) {
        const device = this.findOrCreateDevice(input);
        this.element.rerender();
        // TODO: Remove
        //device.inputs = device.inputs = .remove(input);
    }
    */

    prepareCallback() {
        this.data.inputs = this.WebMidi.inputs; // expose inputs
        this.data.ouputs = this.WebMidi.ouputs; // and inputs
        this.data.selectInput = this.selectInput.bind(this);
        return this.data;
    }


}


Modulo.cparts.midikeyboard = class MidiKeyboard extends Modulo.ComponentPart {
    initializedCallback() {
        this.data = {};
        this.data.fullKeys = this.makeKeyboard(0, 127);
        this.data.octave = 3;
        this.data.span = 2;
        return this.data;
    }

    prepareCallback() {
        const start = this.data.octave * 12;
        const end = (this.data.octave + this.data.span) * 12;
        this.data.keys = this.data.fullKeys.slice(start, end);
        return this.data;
    }

    makeKeyboard(start, end) {
        // Makes a static array of keyboard data
        let i = start;
        const data = [];
        const blackKeys = { 1: true, 3: true, 5: true, 7: true, 9: true };
        const letters = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        while (i < end) {
            const octave = i / 12;
            const octaveKey = i % 12;
            const letter = letters[octaveKey]
            const isSharp = letter.endsWith('#');
            data.push({ i, octave, letter, isSharp });
            i++;
        }
        return data;
    }
}

