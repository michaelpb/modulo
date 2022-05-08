/*
    Modulo Music ideas:
      - tonesynth is main audio CPart
      - Allows creation / destruction / connection of all Tone.js elements
      - This includes creating timelines, buses, signal sources / synths, etc
      - Exposes loopable "menu" of elements with descriptions
      - Eventually, create "music-ToneDevice" component that generates a
        UI for each element
      - Knobs that are sliders!
          - on mouse down, show absolute slider over knob and focus, so it
            immediately starts drag motion



ANOTHER IDEA:
- Have parameters hook up directly with state properties, so turning knobs can
  be fast
- Write a script that just goes through API docs and parses into JSON, that can
  then be read as DataSource for a DAW or modular synth-type app
*/

const TONE_JS_API_EVENT_TYPED = { Loop: true, Part: true, Pattern: true,
                    Sequence: true, ToneEvent: true };

const TONE_JS_API = [
    {
        name: 'Core',
        devices: [ 'Clock', 'Context', 'Delay', 'Destination', 'Draw',
                  'Emitter', 'Gain', 'Listener', 'OfflineContext', 'Param',
                  'Tone', 'ToneAudioBuffer', 'ToneAudioBuffers', 'Transport'],
    },

    {
        name: 'Source',
        devices: [ 'AMOscillator', 'FMOscillator', 'FatOscillator',
                  'GrainPlayer', 'LFO', 'Noise', 'OmniOscillator',
                  'Oscillator', 'PWMOscillator', 'Player', 'Players',
                  'PulseOscillator', 'ToneBufferSource', 'ToneOscillatorNode',
                  'UserMedia', ],
    },

    {
        name: 'Instrument',
        devices: [ 'AMSynth', 'DuoSynth', 'FMSynth', 'MembraneSynth',
                  'MetalSynth', 'MonoSynth', 'NoiseSynth', 'PluckSynth',
                  'PolySynth', 'Sampler', 'Synth', ],
    },

    {
        name: 'Effect',
        devices: [ 'AutoFilter', 'AutoPanner', 'AutoWah', 'BitCrusher',
                  'Chebyshev', 'Chorus', 'Distortion', 'FeedbackDelay',
                  'Freeverb', 'FrequencyShifter', 'JCReverb', 'MidSideEffect',
                  'Phaser', 'PingPongDelay', 'PitchShift', 'Reverb',
                  'StereoWidener', 'Tremolo', 'Vibrato', ],
    },

    {
        name: 'Component',
        devices: [ 'AmplitudeEnvelope', 'Analyser', 'BiquadFilter', 'Channel',
                  'Compressor', 'Convolver', 'CrossFade', 'DCMeter', 'EQ3',
                  'Envelope', 'FFT', 'FeedbackCombFilter', 'Filter',
                  'Follower', 'FrequencyEnvelope', 'Gate', 'Limiter',
                  'LowpassCombFilter', 'Merge', 'Meter', 'MidSideCompressor',
                  'MidSideMerge', 'MidSideSplit', 'Mono',
                  'MultibandCompressor', 'MultibandSplit', 'OnePoleFilter',
                  'PanVol', 'Panner', 'Panner3D', 'PhaseShiftAllpass',
                  'Recorder', 'Solo', 'Split', 'Volume', 'Waveform', ],
    },

    {
        name: 'Signal',
        devices: [ 'Abs', 'Add', 'AudioToGain', 'GainToAudio', 'GreaterThan',
                  'GreaterThanZero', 'Multiply', 'Negate', 'Pow', 'Scale',
                  'ScaleExp', 'Signal', 'Subtract', 'ToneConstantSource',
                  'WaveShaper', 'Zero', ],
    },

    {
        name: 'Event',
        devices: [ 'Loop', 'Part', 'Pattern', 'Sequence', 'ToneEvent' ],
    },
];

const TONE_JS_API_SETS = Object.fromEntries(
    TONE_JS_API.map(({ name, devices }) => ([name, new Set(devices)])));

Modulo.cparts.tone = class ToneJsAdaptor extends Modulo.ComponentPart {
    initializedCallback(renderObj) {
        if (!this.attrs.engine) {
            this.Tone = Tone;
        } else{
            this.Tone = this.attrs.engine; // allows for patching
        }

        this.devicesByStateKey = {};
        this.lowerToCapitalized = {};
        for (const [ key, value ] of Object.entries(this.Tone)) {
            this.lowerToCapitalized[key.toLowerCase()] = key;
        }

        // Prep renderObj data
        this.data = {
            deviceInfoArray: TONE_JS_API,
            parameters: {},
            deviceArray: [],
            connectionStack: [],

            nextAdaptorId: 1,
            isConnected: false,
            isStarted: false,

            start: this.start.bind(this),
            connect: this.connect.bind(this),
            noteOn: args => this.triggerMethod('triggerAttack', args),
            noteOff: this.noteOff.bind(this),
            note: this.note.bind(this),
        };

        for (const [ deviceName, parameters ] of Object.entries(this.attrs)) {
            this.newDevice(deviceName, this.prepParameters(parameters, deviceName));
        }

        /*this.newDevice('Sequence', {
            events:  ["C4", ["E4", "D4", "E4"], "G4", ["A4", "G4"]],
            subdivision: '8n',
        });*/
        return this.data;
    }

    prepParameters(parameters, deviceName) {
        const { type } = Modulo.templating.defaultOptions.filters;
        const pType = type(parameters);
        if (!parameters) {
            return undefined; // Use default
        }
        if (pType === 'object' || pType === 'array') {
            return parameters;

        } else if (parameters === 'state') {
            this.bindToAllState(); // Bind ALL parameters directly to state
            return this.boundState.data;

        } else if (parameters.startsWith('state.')) {
            const stateKey = parameters.substring('state.'.length);
            this.bindToState(stateKey, deviceName); // Bind to part of state
            return this.boundState.data[stateKey];

        } else {
            Modulo.assert(false, `Device node (${string}) invalid: ${parameters}`);
        }
    }

    bindToAllState() {
        const { state } = this.element.cparts;
        this.boundState = state;
        for (const key of Object.keys(this.boundState.data)) {
            this.boundState.boundElements[key].push([ this, null, null ]);
        }
    }

    bindToState(stateKey, deviceName) {
        if (!(stateKey in this.devicesByStateKey)) {
            this.devicesByStateKey[stateKey] = [];
        }
        this.devicesByStateKey[stateKey].push(deviceName);
    }

    stateChangedCallback(name, val) {
        if (name in this.devicesByStateKey && this.devicesByStateKey[name].length) {
            for (const deviceName of this.devicesByStateKey[name]) {
                const device = this.data[deviceName];
                if (device.deviceType in TONE_JS_API_EVENT_TYPED && Array.isArray(val)) {
                    device.set({ events: val }); // Update events, since it's an array type
                } else {
                    throw new Erorr('not implemented');
                    //device[name].value = val[name]; // TODO: check this is correct
                }
            }
            return;
        }
        for (const device of this.data.deviceArray) {
            if (name in device) {
                device[name].value = val; // set individual value of parameter
            }
        }
    }

    newDevice(name, parameters) {
        const deviceName = name.replace(/[0-9]/g, ''); // allow for named, e.g. Oscillator1
        const lcName = deviceName.toLowerCase(); // normalize (for attr names)
        const deviceType = this.lowerToCapitalized[lcName];
        Modulo.assert(deviceType, `No device named: ${ deviceName }`);

        let device = null;
        if (deviceType in TONE_JS_API_EVENT_TYPED) {
            let events = [];
            if (Array.isArray(parameters)) {
                events = parameters;
                parameters = {};
            }
            const paramDefaults = {
                events,
                subdivision: '8n',
                callback: (timeDuration, note) => {
                    // TODO: Add "string" version of callback param
                    this.data.note(note, timeDuration);
                },
            };
            const params = Object.assign(paramDefaults, parameters);
            device = new this.Tone[deviceType](params);
        } else {
            device = new this.Tone[deviceType](parameters);
        }

        device.id = this.getNextAdaptorId();
        device.name = name;
        device.deviceType = deviceType;

        // Expose the device in many ways:
        for (const key of [ name, device.id, lcName, deviceType ]) {
            this.data[key] = device;
        }
        this.data.deviceArray.push(device);
        this.data.parameters[name] = parameters;
        this.data.parameters[device.id] = parameters;

        // Redo type-based arrays
        this.setupTypeBasedArrays();
        console.log('device', device);
    }

    getNextAdaptorId() {
        const id = this.data.nextAdaptorId;
        this.data.nextAdaptorId++;
        return id;
    }

    connect(destination) {
        this.destination = destination;
    }

    getDevices(type) {
        const inSet = ({ deviceType }) => TONE_JS_API_SETS[type].has(deviceType);
        return this.data.deviceArray.filter(inSet);
    }

    setupTypeBasedArrays() {
        for (const { name } of TONE_JS_API) {
            this.data[name.toLowerCase() + 'Devices'] = this.getDevices(name);
        }
    }

    connectAll() {
        if (!this.destination) {
            this.destination = this.Tone.getDestination();
        }
        this.data.connectionStack = [ this.destination ]; // stack starts with output

        // TODO: Maybe just go by if it has an input...?
        // Now, start in the following order: Scan for FX and connect in stack
        const { signalDevices, componentDevices, effectDevices } = this.data;
        const processing = signalDevices.concat(componentDevices).concat(effectDevices);
        for (const device of processing) {
            device.connect(this.getInternalDestination());
            this.data.connectionStack.push(device); // add as next destination
        }

        // And now scan for instruments and connect
        const { instrumentDevices, sourceDevices } = this.data;
        for (const device of sourceDevices.concat(instrumentDevices)) {
            device.connect(this.getInternalDestination());
        }

        this.data.isConnected = true;
    }

    getInternalDestination() {
        const { connectionStack } = this.data;
        return connectionStack[connectionStack.length - 1]; // top of stack
    }

    start(startTime) {
        (async () => {
            await this.Tone.start();
        })();

        if (!this.data.isConnected) {
            this.connectAll();
        }

        if (!startTime || typeof startTime !== 'number') {
            startTime = 0.0; // ensure set to 0.0
        }

        for (const device of this.data.deviceArray) {
            if (device.start) {
                device.start(startTime);//identifier, now + time);
            }
        }

        // IDEA: <Midi noteOn=tone.noteOn noteOff=tone.noteOff sysPlay=tone.start > etc
        Tone.Transport.start();
        this.data.isStarted = true;
    }

    connectMount({ el }) {
        el.tone = this;
        el.Tone = this.Tone;
        if (el.cparts && el.cparts.tone) {
            el.cparts.tone.parentTone = this;
            const newDestination = this.getInternalDestination();
            const { _oldDestination, destination } = el.cparts.tone;
            // Connect destinations to our stack
            if (destination !== newDestination) {
                if (!_oldDestination && destination) {
                    el.cparts.tone._oldDestination = destination;
                }
                el.cparts.tone.destination = newDestination;
                el.cparts.tone.connectAll();
            }
        }
    }

    connectUnmount({ el }) {
        el.tone = null;
        el.Tone = null;
        if (el.cparts && el.cparts.tone) {
            el.cparts.tone.parentTone = null;
            const { _oldDestination } = el.cparts.tone;
            if (_oldDestination) {
                el.cparts.tone.destination = _oldDestination;
            }
            el.cparts.tone.connectAll();
        }
    }

    noteOn(args) {
        const now = this.Tone.now()
        let time;
        let identifier;
        if (typeof args === 'string') {
            time = 0.0; // ensure set to 0.0
            identifier = args;
        } else {
            identifier = args[0];
            time = args[1];
        }
        for (const device of this.data.deviceArray) {
            if (device.triggerAttack) {
                device.triggerAttack(identifier, now + time);
            }
        }
    }

    noteOff(releaseTime) {
        const now = this.Tone.now()
        if (!releaseTime || typeof releaseTime === 'string') {
            releaseTime = 0.0; // ensure set to 0.0
        }
        for (const device of this.data.deviceArray) {
            if (device.triggerRelease) {
                device.triggerRelease(now + releaseTime);//identifier, now + time);
            }
        }
    }

    triggerMethod(methodName, args, duration) {
        if (!this.data.isStarted) {
            // Start!
            this.start();
        }
        const now = this.Tone.now()
        let time;
        let identifier;
        if (typeof args === 'string') {
            time = 0.0; // ensure set to 0.0
            identifier = args;
        } else {
            identifier = args[0];
            time = args[1];
        }
        console.log('this is', methodName, identifier, time);
        for (const device of this.data.deviceArray) {
            if (methodName in device) {
                if (duration) {
                    device[methodName](identifier, now + time);
                } else {
                    device[methodName](identifier, duration, now + time);
                }
            }
        }
    }

    note(identifier, duration, time) {
        if (!duration) {
            duration = '4n';
        }
        if (!time) {
            time = 0; // right now
        }
        const now = this.Tone.now()
        for (const device of this.data.deviceArray) {
            if (device.triggerAttackRelease) {
                device.triggerAttackRelease(identifier, duration, now + time);
            }
        }
    }
}


/*
eventCleanupCallback() {
    if (this.boundState) {
        for (const device of this.data.deviceArray) {
            // IDEA: filter through state data, to maybe configure
            // clock-related stuff, e.g. time or notes? Or maybe have that
            // "inherit"?
            console.log('updating config', this.boundState.data);
            device.set(this.boundState.data);
        }
    }

}
noteCallback({ note }) {
    if (this.synth) {
        console.log('playing!', note);
        this.synth.triggerAttackRelease(note, '8n');
    }
}
*/

