const svg = document.querySelector('#vowelMap');
const cursor = document.querySelector('#cursor');
const f1Out = document.querySelector('#f1Value');
const f2Out = document.querySelector('#f2Value');
const vowelOut = document.querySelector('#vowelValue');
const statusOut = document.querySelector('#status');
const startButton = document.querySelector('#startButton');

const plot = { left: 70, top: 25, width: 650, height: 430 };
const domain = { f1Min: 200, f1Max: 900, f2Min: 600, f2Max: 2800 };
const vowels = [
  { label: '/i/', f1: 300, f2: 2300 }, { label: '/e/', f1: 450, f2: 1900 },
  { label: '/a/', f1: 700, f2: 1200 }, { label: '/o/', f1: 500, f2: 900 },
  { label: '/u/', f1: 350, f2: 1000 }
];
let audioContext, source, f1Filter, f2Filter, outputGain;
let pressed = false;

const xFromF2 = f2 => plot.left + (domain.f2Max - f2) / (domain.f2Max - domain.f2Min) * plot.width;
const yFromF1 = f1 => plot.top + (f1 - domain.f1Min) / (domain.f1Max - domain.f1Min) * plot.height;
const f2FromX = x => domain.f2Max - ((x - plot.left) / plot.width) * (domain.f2Max - domain.f2Min);
const f1FromY = y => domain.f1Min + ((y - plot.top) / plot.height) * (domain.f1Max - domain.f1Min);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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
  labels.innerHTML = `<text class="axis-label" x="${plot.left + plot.width / 2}" y="510" text-anchor="middle">F2 (Hz)   high ←　　　　　　　　　→ low</text><text class="axis-label" transform="translate(18 ${plot.top + plot.height / 2}) rotate(-90)" text-anchor="middle">F1 (Hz)   low ←　　　　　　　　　→ high</text>`;
  vowelGroup.innerHTML = vowels.map(v => `<circle class="vowel-dot" cx="${xFromF2(v.f2)}" cy="${yFromF1(v.f1)}" r="7"/><text class="vowel-label" x="${xFromF2(v.f2) + 11}" y="${yFromF1(v.f1) + 6}">${v.label}</text>`).join('');
}

function nearestVowel(f1, f2) {
  return vowels.reduce((best, v) => Math.hypot((f1 - v.f1) / 250, (f2 - v.f2) / 700) < best.distance ? { label: v.label, distance: Math.hypot((f1 - v.f1) / 250, (f2 - v.f2) / 700) } : best, { label: '—', distance: Infinity }).label;
}

function updatePosition(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const x = (clientX - rect.left) * 760 / rect.width;
  const y = (clientY - rect.top) * 520 / rect.height;
  const f1 = Math.round(clamp(f1FromY(y), domain.f1Min, domain.f1Max));
  const f2 = Math.round(clamp(f2FromX(x), domain.f2Min, domain.f2Max));
  cursor.setAttribute('cx', xFromF2(f2)); cursor.setAttribute('cy', yFromF1(f1)); cursor.setAttribute('visibility', 'visible');
  f1Out.textContent = f1; f2Out.textContent = f2; vowelOut.textContent = nearestVowel(f1, f2);
  if (f1Filter) { const now = audioContext.currentTime; f1Filter.frequency.cancelScheduledValues(now); f2Filter.frequency.cancelScheduledValues(now); f1Filter.frequency.setTargetAtTime(f1, now, .015); f2Filter.frequency.setTargetAtTime(f2, now, .015); }
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createOscillator(); source.type = 'sawtooth'; source.frequency.value = 125;
    f1Filter = audioContext.createBiquadFilter(); f1Filter.type = 'bandpass'; f1Filter.Q.value = 8;
    f2Filter = audioContext.createBiquadFilter(); f2Filter.type = 'bandpass'; f2Filter.Q.value = 10;
    outputGain = audioContext.createGain(); outputGain.gain.value = 0;
    source.connect(f1Filter).connect(f2Filter).connect(outputGain).connect(audioContext.destination); source.start();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

function begin(e) { e.preventDefault(); ensureAudio(); svg.setPointerCapture(e.pointerId); pressed = true; updatePosition(e.clientX, e.clientY); const t = audioContext.currentTime; outputGain.gain.cancelScheduledValues(t); outputGain.gain.setTargetAtTime(.16, t, .01); statusOut.textContent = 'Playing'; }
function end(e) { if (!pressed) return; e.preventDefault(); pressed = false; const t = audioContext.currentTime; outputGain.gain.cancelScheduledValues(t); outputGain.gain.setTargetAtTime(0, t, .04); statusOut.textContent = 'Stopped'; }
svg.addEventListener('pointerdown', begin); svg.addEventListener('pointermove', e => { if (pressed) updatePosition(e.clientX, e.clientY); }); svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('lostpointercapture', end);
startButton.addEventListener('click', () => { ensureAudio(); startButton.textContent = 'Audio Enabled'; startButton.disabled = true; });
document.addEventListener('visibilitychange', () => { if (document.hidden && pressed) end({ preventDefault() {} }); });
drawMap();
