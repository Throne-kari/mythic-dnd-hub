/* Original, local synthesis. AudioContext is created only by the sound button. */
const culture = document.body.dataset.culture || 'japan';
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const controls = [...document.querySelectorAll('[data-sound-toggle]')];
let context = null, master = null, enabled = false, ambienceStarted = false, pending = false;
let lastClick = 0, suspendTimer;

function renderControls(message) {
  for (const button of controls) {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = message || `声音 · ${enabled ? '开启' : '关闭'}`;
    button.title = enabled ? '关闭环境声与反馈音' : '点击启用环境声与反馈音';
    button.setAttribute('aria-label', button.title);
  }
}

function envelope(node, when, duration, volume) {
  node.gain.setValueAtTime(0.0001, when);
  node.gain.exponentialRampToValueAtTime(volume, when + 0.008);
  node.gain.exponentialRampToValueAtTime(0.0001, when + duration);
}

function tone(frequency, when, duration = .25, volume = .06, type = 'sine') {
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, when);
  envelope(gain, when, duration, volume);
  oscillator.connect(gain).connect(master);
  oscillator.start(when);
  oscillator.stop(when + duration + .02);
}

function noiseBuffer(seconds = 4) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const samples = buffer.getChannelData(0);
  let seed = 11821, previous = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    previous = (previous + (seed / 2147483648 - 1) * .018) / 1.018;
    samples[i] = previous * 5.4;
  }
  return buffer;
}

function startAmbience() {
  if (ambienceStarted) return;
  ambienceStarted = true;
  const wind = context.createBufferSource(), filter = context.createBiquadFilter(), windGain = context.createGain();
  wind.buffer = noiseBuffer(); wind.loop = true;
  filter.type = 'lowpass'; filter.frequency.value = culture === 'india' ? 570 : 930;
  windGain.gain.value = culture === 'india' ? .12 : .07;
  wind.connect(filter).connect(windGain).connect(master); wind.start();
  const swell = context.createOscillator(), swellGain = context.createGain();
  swell.frequency.value = culture === 'india' ? .11 : .07;
  swellGain.gain.value = culture === 'india' ? .055 : .025;
  swell.connect(swellGain).connect(windGain.gain); swell.start();
  const notes = culture === 'india' ? [130.81, 196] : [146.83, 220];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.value = culture === 'india' ? .014 : .008;
    oscillator.detune.value = index ? 2 : -2;
    oscillator.connect(gain).connect(master); oscillator.start();
  });
}

export function cue(kind = 'click') {
  if (!enabled || !context || context.state !== 'running' || document.hidden) return;
  const now = context.currentTime;
  if (/roll|check|save|attack/.test(kind)) {
    for (let i = 0; i < 5; i++) tone(310 + i * 117, now + i * .043, .045, .035, 'triangle');
    tone(culture === 'india' ? 523.25 : 587.33, now + .24, .4, .035);
  } else if (/choice|cast|spell|end/.test(kind)) {
    const root = culture === 'india' ? 261.63 : 293.66;
    [1, 1.5, 2].forEach((ratio, i) => tone(root * ratio, now + i * .075, .45, .035));
  } else {
    tone(culture === 'india' ? 659.25 : 783.99, now, .09, .028, 'triangle');
  }
}

async function toggleSound() {
  if (pending) return;
  if (!AudioContextClass) { renderControls('声音 · 不支持'); return; }
  if (enabled) {
    enabled = false; renderControls();
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, .045);
    suspendTimer = setTimeout(() => { if (!enabled) context.suspend().catch(() => {}); }, 180);
    return;
  }
  pending = true;
  try {
    clearTimeout(suspendTimer);
    if (!context) {
      context = new AudioContextClass();
      master = context.createGain(); master.gain.value = 0; master.connect(context.destination);
    }
    await context.resume();
    startAmbience();
    enabled = true;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(.48, context.currentTime, .12);
    renderControls(); cue('choice');
  } catch {
    enabled = false; renderControls('声音 · 暂不可用');
  } finally { pending = false; }
}

controls.forEach(button => button.addEventListener('click', toggleSound));
document.addEventListener('click', event => {
  const button = event.target.closest?.('button');
  if (!button || button.disabled || button.matches('[data-sound-toggle],#rollBtn') || !enabled) return;
  const now = performance.now();
  if (now - lastClick < 65) return;
  lastClick = now; cue('click');
});
window.addEventListener('myth:action', event => cue(event.detail?.type || 'choice'));
document.addEventListener('visibilitychange', () => {
  if (!context) return;
  if (document.hidden) context.suspend().catch(() => {});
  else if (enabled) context.resume().catch(() => {});
});
window.addEventListener('pagehide', () => { if (context) context.suspend().catch(() => {}); });
renderControls();
