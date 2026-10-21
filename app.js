const svg = document.querySelector('#vowelMap');
const cursor = document.querySelector('#cursor');
const f1Out = document.querySelector('#f1Value');
const f2Out = document.querySelector('#f2Value');
const vowelOut = document.querySelector('#vowelValue');
const statusOut = document.querySelector('#status');
const startButton = document.querySelector('#startButton');
const f0Slider = document.querySelector('#f0Slider');
const f0Out = document.querySelector('#f0Value');
const spaceSlider = document.querySelector('#spaceSlider');
const spaceOut = document.querySelector('#spaceValue');
const perturbationToggle = document.querySelector('#perturbationToggle');
const perturbationState = document.querySelector('#perturbationState');
const spectrumCanvas = document.querySelector('#spectrum');
const spectrumContext = spectrumCanvas.getContext('2d');

const plot = { left: 70, top: 25, width: 650, height: 430 };
const domain = { f1Min: 200, f1Max: 900, f2Min: 600, f2Max: 2800 };
const baseVowels = [
  { label: '/i/', f1: 300, f2: 2300 }, { label: '/e/', f1: 450, f2: 1900 },
  { label: '/a/', f1: 700, f2: 1200 }, { label: '/o/', f1: 500, f2: 900 },
  { label: '/u/', f1: 350, f2: 1000 }
];
let audioContext, source, f1Filter, f2Filter, formantBus, outputGain, analyser, spectrumData;
let jitterNoise, shimmerNoise, jitterDepth, shimmerDepth;
let pressed = false;
let currentF1 = 500;
let currentF2 = 1500;
let currentF0 = Number(f0Slider.value);
let spaceScale = Number(spaceSlider.value) / 100;

const vowelCenter = {
  f1: baseVowels.reduce((sum, vowel) => sum + vowel.f1, 0) / baseVowels.length,
  f2: baseVowels.reduce((sum, vowel) => sum + vowel.f2, 0) / baseVowels.length
};
const scaledVowels = () => baseVowels.map(vowel => ({
  ...vowel,
  f1: vowelCenter.f1 + (vowel.f1 - vowelCenter.f1) * spaceScale,
  f2: vowelCenter.f2 + (vowel.f2 - vowelCenter.f2) * spaceScale
}));

const xFromF2 = f2 => plot.left + (domain.f2Max - f2) / (domain.f2Max - domain.f2Min) * plot.width;
const yFromF1 = f1 => plot.top + (f1 - domain.f1Min) / (domain.f1Max - domain.f1Min) * plot.height;
const f2FromX = x => domain.f2Max - ((x - plot.left) / plot.width) * (domain.f2Max - domain.f2Min);
const f1FromY = y => domain.f1Min + ((y - plot.top) / plot.height) * (domain.f1Max - domain.f1Min);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function createSmoothNoise(context, duration = 4, interval = .012) {
  const length = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  const segmentLength = Math.max(1, Math.round(context.sampleRate * interval));
  let from = Math.random() * 2 - 1;
  let to = Math.random() * 2 - 1;
  for (let i = 0; i < length; i++) {
    const phase = (i % segmentLength) / segmentLength;
    const blend = (1 - Math.cos(Math.PI * phase)) / 2;
    data[i] = from + (to - from) * blend;
    if ((i + 1) % segmentLength === 0) {
      from = to;
      to = Math.random() * 2 - 1;
    }
  }
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

function setPerturbationEnabled(enabled) {
  perturbationState.textContent = enabled ? 'ON' : 'OFF';
  if (!audioContext || !jitterDepth || !shimmerDepth) return;
  const now = audioContext.currentTime;
  jitterDepth.gain.cancelScheduledValues(now);
  shimmerDepth.gain.cancelScheduledValues(now);
  jitterDepth.gain.setTargetAtTime(enabled ? 5 : 0, now, .025);
  shimmerDepth.gain.setTargetAtTime(enabled ? .015 : 0, now, .025);
}

function drawMap() {
  const grid = document.querySelector('#grid');
  const labels = document.querySelector('#labels');
  const vowelGroup = document.querySelector('#vowels');
  for (const f1 of [200, 400, 600, 800]) {
    const y = yFromF1(f1);
    grid.insertAdjacentHTML('beforeend', `<line class="grid-line" x1="${plot.left}" y1="${y}" x2="${plot.left + plot.width}" y2="${y}"/><text class="tick-label" x="${plot.left - 10}" y="${y + 5}" text-anchor="end">${f1}</text>`);
  }
  for (const f2 of [600, 1000, 1500, 2000, 2500, 2800]) {
    const x = xFromF2(f2);
    grid.insertAdjacentHTML('beforeend', `<line class="grid-line" x1="${x}" y1="${plot.top}" x2="${x}" y2="${plot.top + plot.height}"/><text class="tick-label" x="${x}" y="${plot.top + plot.height + 22}" text-anchor="middle">${f2}</text>`);
  }
  labels.innerHTML = `<text class="axis-label" x="${plot.left + plot.width / 2}" y="510" text-anchor="middle">F2 (Hz)   high ←　　　　　　　　　→ low</text><text class="axis-label" transform="translate(18 ${plot.top + plot.height / 2}) rotate(-90)" text-anchor="middle">F1 (Hz)   high ←　　　　　　　　　→ low</text>`;
  drawVowels();
}

function drawVowels() {
  const vowelGroup = document.querySelector('#vowels');
  vowelGroup.innerHTML = scaledVowels().map(v => `<circle class="vowel-dot" cx="${xFromF2(v.f2)}" cy="${yFromF1(v.f1)}" r="7"/><text class="vowel-label" x="${xFromF2(v.f2) + 11}" y="${yFromF1(v.f1) + 6}">${v.label}</text>`).join('');
}

function nearestVowel(f1, f2) {
  return scaledVowels().reduce((best, v) => Math.hypot((f1 - v.f1) / 250, (f2 - v.f2) / 700) < best.distance ? { label: v.label, distance: Math.hypot((f1 - v.f1) / 250, (f2 - v.f2) / 700) } : best, { label: '—', distance: Infinity }).label;
}

function updatePosition(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const x = (clientX - rect.left) * 760 / rect.width;
  const y = (clientY - rect.top) * 520 / rect.height;
  const f1 = Math.round(clamp(f1FromY(y), domain.f1Min, domain.f1Max));
  const f2 = Math.round(clamp(f2FromX(x), domain.f2Min, domain.f2Max));
  currentF1 = f1; currentF2 = f2;
  cursor.setAttribute('cx', xFromF2(f2)); cursor.setAttribute('cy', yFromF1(f1)); cursor.setAttribute('visibility', 'visible');
  f1Out.textContent = f1; f2Out.textContent = f2; vowelOut.textContent = nearestVowel(f1, f2);
  if (f1Filter) { const now = audioContext.currentTime; f1Filter.frequency.cancelScheduledValues(now); f2Filter.frequency.cancelScheduledValues(now); f1Filter.frequency.setTargetAtTime(f1, now, .015); f2Filter.frequency.setTargetAtTime(f2, now, .015); }
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createOscillator(); source.type = 'sawtooth'; source.frequency.value = currentF0;
    f1Filter = audioContext.createBiquadFilter(); f1Filter.type = 'bandpass'; f1Filter.Q.value = 8;
    f2Filter = audioContext.createBiquadFilter(); f2Filter.type = 'bandpass'; f2Filter.Q.value = 10;
    formantBus = audioContext.createGain(); formantBus.gain.value = .75;
    outputGain = audioContext.createGain(); outputGain.gain.value = 0;
    jitterNoise = createSmoothNoise(audioContext);
    shimmerNoise = createSmoothNoise(audioContext);
    jitterDepth = audioContext.createGain(); jitterDepth.gain.value = perturbationToggle.checked ? 5 : 0;
    shimmerDepth = audioContext.createGain(); shimmerDepth.gain.value = perturbationToggle.checked ? .015 : 0;
    analyser = audioContext.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = .82; analyser.minDecibels = -100; analyser.maxDecibels = -20;
    spectrumData = new Float32Array(analyser.frequencyBinCount);
    source.connect(f1Filter).connect(formantBus);
    source.connect(f2Filter).connect(formantBus);
    jitterNoise.connect(jitterDepth).connect(source.detune);
    shimmerNoise.connect(shimmerDepth).connect(formantBus.gain);
    formantBus.connect(outputGain).connect(analyser).connect(audioContext.destination);
    jitterNoise.start();
    shimmerNoise.start();
    source.start();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

function begin(e) { e.preventDefault(); ensureAudio(); svg.setPointerCapture(e.pointerId); pressed = true; updatePosition(e.clientX, e.clientY); const t = audioContext.currentTime; outputGain.gain.cancelScheduledValues(t); outputGain.gain.setTargetAtTime(.16, t, .01); statusOut.textContent = '再生中'; }
function end(e) { if (!pressed) return; e.preventDefault(); pressed = false; const t = audioContext.currentTime; outputGain.gain.cancelScheduledValues(t); outputGain.gain.setTargetAtTime(0, t, .04); statusOut.textContent = '停止中'; }
svg.addEventListener('pointerdown', begin); svg.addEventListener('pointermove', e => { if (pressed) updatePosition(e.clientX, e.clientY); }); svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('lostpointercapture', end);
startButton.addEventListener('click', () => { ensureAudio(); startButton.textContent = '音声は有効です'; startButton.disabled = true; });
f0Slider.addEventListener('input', () => {
  currentF0 = Number(f0Slider.value);
  f0Out.textContent = `${currentF0} Hz`;
  if (source && audioContext) source.frequency.setTargetAtTime(currentF0, audioContext.currentTime, .015);
});
spaceSlider.addEventListener('input', () => {
  spaceScale = Number(spaceSlider.value) / 100;
  spaceOut.textContent = `${spaceSlider.value}%`;
  drawVowels();
  vowelOut.textContent = nearestVowel(currentF1, currentF2);
});
perturbationToggle.addEventListener('change', () => setPerturbationEnabled(perturbationToggle.checked));
document.addEventListener('visibilitychange', () => { if (document.hidden && pressed) end({ preventDefault() {} }); });

function drawSpectrum() {
  const dpr = window.devicePixelRatio || 1;
  const width = spectrumCanvas.clientWidth;
  const height = spectrumCanvas.clientHeight;
  if (spectrumCanvas.width !== Math.round(width * dpr) || spectrumCanvas.height !== Math.round(height * dpr)) {
    spectrumCanvas.width = Math.round(width * dpr);
    spectrumCanvas.height = Math.round(height * dpr);
  }
  const ctx = spectrumContext;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const margin = { left: 48, right: 14, top: 14, bottom: 30 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const minHz = 80;
  const maxHz = 5000;
  const minDb = -100;
  const maxDb = -20;
  const xForHz = hz => margin.left + Math.log(hz / minHz) / Math.log(maxHz / minHz) * plotWidth;
  const yForDb = db => margin.top + (maxDb - db) / (maxDb - minDb) * plotHeight;

  ctx.font = '11px system-ui, sans-serif';
  ctx.strokeStyle = '#374151';
  ctx.fillStyle = '#9ca3af';
  ctx.lineWidth = 1;
  for (const db of [-100, -80, -60, -40, -20]) {
    const y = yForDb(db);
    ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(width - margin.right, y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`${db}`, margin.left - 7, y);
  }
  for (const hz of [100, 200, 500, 1000, 2000, 5000]) {
    const x = xForHz(hz);
    ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, height - margin.bottom); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, x, height - margin.bottom + 7);
  }

  if (analyser && spectrumData) {
    analyser.getFloatFrequencyData(spectrumData);
    const nyquist = audioContext.sampleRate / 2;
    const firstBin = Math.max(1, Math.ceil(minHz / nyquist * spectrumData.length));
    const lastBin = Math.min(spectrumData.length - 1, Math.floor(maxHz / nyquist * spectrumData.length));
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.beginPath();
    for (let bin = firstBin; bin <= lastBin; bin++) {
      const hz = bin / spectrumData.length * nyquist;
      const x = xForHz(hz);
      const y = yForDb(clamp(spectrumData[bin], minDb, maxDb));
      if (bin === firstBin) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Enable audio to start the spectrum display', margin.left + plotWidth / 2, margin.top + plotHeight / 2);
  }

  ctx.setLineDash([5, 4]);
  for (const [label, hz, color] of [['F1', currentF1, '#fbbf24'], ['F2', currentF2, '#f97316']]) {
    const x = xForHz(hz);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, height - margin.bottom); ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`${label} ${hz} Hz`, Math.min(x + 4, width - 75), margin.top + (label === 'F1' ? 4 : 19));
  }
  ctx.setLineDash([]);
  requestAnimationFrame(drawSpectrum);
}

drawMap();
drawSpectrum();
