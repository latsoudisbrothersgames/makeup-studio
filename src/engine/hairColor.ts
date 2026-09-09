import type { Poly } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';
import { featheredMask } from './masks';

/**
 * Αλλαγή χρώματος μαλλιών με αντικατάσταση παλέτας (όχι blend mode).
 *
 * Τα PixelLab μαλλιά έχουν 7–15 διακριτούς τόνους. Ταξινομούμε τα χρώματα του επιπέδου κατά
 * φωτεινότητα, κανονικοποιούμε σε t∈[0,1] και διαβάζουμε το νέο χρώμα από μια ράμπα 5 τόνων
 * (σκιά → φως). Έτσι διατηρείται η δομή της σκίασης, αλλά η φωτεινότητα αλλάζει ελεύθερα:
 * μαύρα → ξανθά ή παστέλ, κάτι που το `color` blend mode δεν μπορεί (κρατά τη φωτεινότητα).
 */
export type Ramp = [string, string, string, string, string];

/** Ράμπες ανά χρώμα-βάση (το swatch). Σκιά → φως. */
export const HAIR_RAMPS: Record<string, Ramp> = {
  '#1a1822': ['#0b0a10', '#1a1822', '#2b2834', '#4a4656', '#6e6a7c'], // μαύρο
  '#6b4028': ['#2a150c', '#4a2a18', '#6b4028', '#8c5a3a', '#b07c55'], // καστανό
  '#e9c56b': ['#7a4d1e', '#a8722e', '#d1a04a', '#e9c56b', '#f8e6a4'], // ξανθό
  '#c95e2c': ['#4a1408', '#7a2a12', '#a8421c', '#c95e2c', '#e88a52'], // κόκκινο
  '#ff7fbf': ['#7a1d55', '#b33380', '#e5539f', '#ff7fbf', '#ffb3d9'], // ροζ
  '#9a5ed8': ['#2c1052', '#4c2185', '#7237b8', '#9a5ed8', '#c69bf0'], // μωβ
  '#4f86ea': ['#0e2260', '#1a3c96', '#2b5fcf', '#4f86ea', '#8fb6f5'], // μπλε
  '#3fd0c9': ['#0a4a48', '#127a76', '#1fa8a3', '#3fd0c9', '#8fe8e2'], // τιρκουάζ
};

export const HAIR_PALETTE = Object.keys(HAIR_RAMPS);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ράμπα για οποιοδήποτε hex: γνωστή, αλλιώς παράγεται γύρω από το χρώμα. */
export function rampFor(hex: string): Ramp {
  const known = HAIR_RAMPS[hex.toLowerCase()];
  if (known) return known;
  const [r, g, b] = hexToRgb(hex);
  const k = (f: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0')).join('');
  return [k(0.4), k(0.7), hex, k(1.25), k(1.55)];
}

function interpRamp(ramp: Ramp, t: number): [number, number, number] {
  const pos = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(pos));
  const f = pos - i;
  const a = hexToRgb(ramp[i]), b = hexToRgb(ramp[i + 1]);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Επιστρέφει νέο καμβά 512×512 με τα μαλλιά βαμμένα στη ράμπα. */
export function recolorHair(hair: CanvasImageSource, ramp: Ramp): HTMLCanvasElement {
  return recolorImage(hair, ramp, 512, 512);
}

/** Γενική αντικατάσταση παλέτας (ίδια μέθοδος) για οποιοδήποτε sprite, π.χ. αξεσουάρ. */
export function recolorImage(src: CanvasImageSource, ramp: Ramp, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Μοναδικά χρώματα → φωτεινότητα → t.
  const lum = new Map<number, number>();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    if (!lum.has(key)) {
      const L = luminance([d[i], d[i + 1], d[i + 2]]);
      lum.set(key, L);
      if (L < lo) lo = L;
      if (L > hi) hi = L;
    }
  }
  const span = Math.max(1, hi - lo);
  const mapped = new Map<number, [number, number, number]>();
  for (const [key, L] of lum) mapped.set(key, interpRamp(ramp, (L - lo) / span));

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const m = mapped.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])!;
    d[i] = Math.round(m[0]);
    d[i + 1] = Math.round(m[1]);
    d[i + 2] = Math.round(m[2]);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Σύνθεση του τελικού επιπέδου μαλλιών: βάση (αρχική ή βαμμένη) + τούφα σε δεύτερο χρώμα
 * μέσα στο πολύγωνο `streakPoly` (ελαφρά φτερωτό για να μη φαίνεται ευθεία κοπή).
 */
export function composeHair(hair: CanvasImageSource, baseColor: string | null, streakColor: string | null, streakPoly: Poly): CanvasImageSource {
  const base = baseColor ? recolorHair(hair, rampFor(baseColor)) : hair;
  if (!streakColor || streakPoly.length < 3) return base;
  const out = makeCanvas(512, 512);
  const ctx = ctx2d(out);
  ctx.drawImage(base, 0, 0);
  const streak = recolorHair(hair, rampFor(streakColor));
  const m = featheredMask(streakPoly, 1.5);
  const sc = ctx2d(streak);
  sc.globalCompositeOperation = 'destination-in';
  // Η μάσκα είναι σε τοπικές συντεταγμένες bbox· ό,τι είναι εκτός bbox σβήνεται.
  const full = makeCanvas(512, 512);
  ctx2d(full).drawImage(m.canvas, m.x, m.y);
  sc.drawImage(full, 0, 0);
  ctx.drawImage(streak, 0, 0);
  return out;
}
