# Vowel Space Synth

An experimental browser-based formant synthesizer. Click and hold anywhere on the F1–F2 vowel map to sustain a vowel-like sound; drag while holding to explore the vowel space.

## Current implementation

- Static browser app with no external dependencies
- SVG F1–F2 map with Japanese vowel reference points
- English GUI
- Web Audio API synthesis using:
  - sawtooth oscillator as the excitation source
  - two band-pass `BiquadFilterNode` resonators for F1 and F2
  - gain envelope for attack/release
- Pointer Events for mouse, touch, and pen input
- Audio activation button for browser autoplay policies
- Visibility-change handling to prevent stuck notes

## Run locally

Open `index.html` in a modern browser. Press **Enable Audio**, then press and hold the map.

For local development, a static server is recommended, for example:

```sh
npx serve .
```

## Files

- `index.html` — page structure and UI text
- `style.css` — layout and visual styling
- `app.js` — vowel map, coordinate conversion, pointer handling, and audio graph

## Coordinate conventions

- Horizontal axis: F2, higher frequencies on the left
- Vertical axis: F1, lower frequencies at the top
- F1 range: 200–900 Hz
- F2 range: 600–2800 Hz

The reference points are illustrative and should not be interpreted as universal vowel boundaries; formants vary by speaker, age, sex, and language.

## Possible next steps

- Add F3 and configurable formant bandwidths
- Add voice/F0 presets
- Improve excitation with a glottal waveform or `AudioWorklet`
- Add keyboard controls and a mute/master-volume control
- Add responsive/mobile layout refinements
- Add a deployment workflow for GitHub Pages

## Project name

The planned GitHub repository name is `vowel-space-synth`.
