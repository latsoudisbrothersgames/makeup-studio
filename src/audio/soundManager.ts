/**
 * Ήχοι συνθεμένοι με WebAudio — κανένα αρχείο. Παίζουν μόνο μετά από αλληλεπίδραση
 * του χρήστη (unlock στο πρώτο pointerdown).
 */
export type SoundName = 'click' | 'pop' | 'sparkle' | 'wow' | 'boing' | 'clear' | 'save' | 'undo';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}
export function isSoundEnabled(): boolean {
  return enabled;
}

function getContext(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Κλήση στο πρώτο pointerdown για να ξεκλειδώσει ο ήχος σε iOS. */
export function unlockAudio(): void {
  const c = getContext();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  g.gain.value = 0.0001;
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.01);
}

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, endFreq?: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext, start: number, dur: number, vol = 0.12, hp = 2000): void {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(start);
  src.stop(start + dur);
}

let last = 0;
export function playSound(name: SoundName): void {
  if (!enabled) return;
  const c = getContext();
  if (!c) return;
  const now = c.currentTime;
  if (now - last < 0.03) return;
  last = now;
  switch (name) {
    case 'click':
      tone(c, 660, now, 0.07, 'triangle', 0.12);
      break;
    case 'pop':
      tone(c, 420, now, 0.12, 'sine', 0.2, 880);
      break;
    case 'sparkle':
      [1320, 1760, 2200, 2640].forEach((f, i) => tone(c, f, now + i * 0.05, 0.16, 'sine', 0.08));
      noise(c, now, 0.2, 0.05, 5000);
      break;
    case 'wow':
      tone(c, 330, now, 0.35, 'triangle', 0.16, 660);
      tone(c, 495, now + 0.12, 0.35, 'triangle', 0.12, 990);
      break;
    case 'boing':
      tone(c, 300, now, 0.25, 'square', 0.08, 120);
      break;
    case 'clear':
      noise(c, now, 0.35, 0.1, 1200);
      tone(c, 520, now, 0.3, 'sine', 0.1, 220);
      break;
    case 'save':
      [523, 659, 784, 1047].forEach((f, i) => tone(c, f, now + i * 0.08, 0.22, 'triangle', 0.12));
      break;
    case 'undo':
      tone(c, 700, now, 0.12, 'triangle', 0.1, 450);
      break;
  }
}

/** Τζινγκλ πασαρέλας (~5″): χαρούμενη μελωδία με τους ίδιους ταλαντωτές — χωρίς αρχεία ήχου. */
export function playJingle(): void {
  if (!enabled) return;
  const c = getContext();
  if (!c) return;
  const t0 = c.currentTime + 0.05;
  // C5 E5 G5 C6 | B5 G5 E5 G5 | A5 C6 A5 G5 | E5 G5 C6 (τελική)
  const melody = [523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25, 783.99, 1046.5];
  const step = 0.3;
  melody.forEach((f, i) => tone(c, f, t0 + i * step, i === melody.length - 1 ? 0.9 : 0.26, 'triangle', 0.16));
  // Μπάσο σε κάθε δεύτερο χτύπο
  const bass = [130.81, 164.81, 196, 130.81, 174.61, 196, 130.81, 130.81];
  bass.forEach((f, i) => tone(c, f, t0 + i * step * 2, 0.5, 'sine', 0.12));
  // «Τσικ» στο ρυθμό
  for (let i = 0; i < melody.length; i += 2) noise(c, t0 + i * step, 0.05, 0.05, 6000);
}
