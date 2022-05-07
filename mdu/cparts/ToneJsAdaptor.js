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
]


Modulo.cparts.tonesynth = class ToneSynthAdaptor extends Modulo.ComponentPart {
    initializedCallback() {
        if (!this.attrs.engine) {
            this.Tone = Tone;
        } else{
            this.Tone = this.attrs.engine; // allows for patching
        }

        this.lowerToCapitalized = {};
        for (const [ key, value ] of Object.entries(this.Tone)) {
            this.lowerToCapitalized[key.toLowerCase()] = key;
        }

        // Prep renderObj data
        this.parameters = {};
        const instruments = TONE_JS_API;
        this.data = {
            instruments: TONE_JS_API,
            parameters: {},
            devicesArray: [],
        };

        return this.data;
    }

    newDevice(name, parameters) {
        const deviceName = name.replace(/[0-9]/g, ''); // allow for named, e.g. Oscillator1
        const lcName = deviceName.toLowerCase(); // normalize (for attr names)
        const deviceType = this.lowerToCapitalized[lcName];
        Modulo.assert(deviceType, `No device named: ${ deviceName }`);
        // Later, require calling toDestination
        const device = new this.Tone[deviceType](parameters);//.toDestination();
        console.log(device);
        device.id = this.getNextAdaptorId();
        device.name = name;
        console.log(device);
        this.data[name] = device;
        this.data[device.id] = device;
        this.data.deviceArray.push(device);
        this.data.parameters.push(device);
    }

    getNextAdaptorId() {
        const id = this.nextAdaptorId;
        this.nextAdaptorId++;
        return id;
    }

    start() {
        for (const device of this.devicesArray) {
        }
        this.synth = new this.Tone.Synth().toDestination()
    }

    noteCallback({ note }) {
        if (this.synth) {
            console.log('playing!', note);
            this.synth.triggerAttackRelease(note, '8n');
        }
    }
}

