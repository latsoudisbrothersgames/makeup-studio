import type { AppliedLayer, CosmeticCategory } from '../types/cosmetic';
import type { Face, Pt } from '../types/face';
import { COSMETICS } from './cosmetics';
import { centroid, makeRng } from '../engine/geometry';
import { newLayerId } from '../state/studioReducer';
import { slotsFor } from './accessories';

/**
 * Παιχνίδι «Αντίγραψε το στυλ»: τυχαίο έτοιμο στυλ ανά επίπεδο και έλεγχος αντιγραφής.
 * Χωρίς νέα εικαστικά — μόνο στρώματα από τον κατάλογο.
 */
export interface Level {
  id: 1 | 2 | 3;
  labelEl: string;
  emoji: string;
  items: number;
  seconds: number;
  pool: CosmeticCategory[];
}

export const LEVELS: Level[] = [
  { id: 1, labelEl: 'Εύκολο', emoji: '🌱', items: 3, seconds: 120, pool: ['lipstick', 'blush', 'eyeshadow', 'hairColor', 'sticker', 'facePaint'] },
  { id: 2, labelEl: 'Μεσαίο', emoji: '🌼', items: 5, seconds: 120, pool: ['lipstick', 'blush', 'eyeshadow', 'hairColor', 'sticker', 'facePaint', 'glitter', 'freckles', 'hairStreak', 'eyeliner', 'accessory'] },
  { id: 3, labelEl: 'Δύσκολο', emoji: '🔥', items: 7, seconds: 150, pool: ['lipstick', 'blush', 'eyeshadow', 'hairColor', 'sticker', 'facePaint', 'glitter', 'freckles', 'hairStreak', 'eyeliner', 'mascara', 'gloss', 'lipLiner', 'beautySpot', 'accessory'] },
];

export function levelById(id: number | null | undefined): Level {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

/** Θέσεις για ελεύθερα αντικείμενα (αυτοκόλλητα, γκλίτερ, ελιά). */
function freeSpots(face: Face): Pt[] {
  const r = face.regions.regions;
  const cl = centroid(r.cheekL.points), cr = centroid(r.cheekR.points);
  return [
    [Math.round(cl[0]), Math.round(cl[1] - 4)],
    [Math.round(cr[0]), Math.round(cr[1] - 4)],
    [268, 192],
    [268, 346],
  ];
}

function regionIdsFor(cat: CosmeticCategory): AppliedLayer['regionIds'] {
  const t = COSMETICS[cat].target;
  if (t.kind === 'regions') {
    if (cat === 'eyeliner' || cat === 'mascara') return ['lashL', 'lashR'];
    return t.regions;
  }
  if (t.kind === 'face') return ['skin'];
  if (t.kind === 'hair') return ['hair'];
  return [];
}

/** Τυχαίο στυλ: `items` διαφορετικές κατηγορίες από το pool του επιπέδου, ντετερμινιστικό ανά seed. */
export function makePreset(face: Face, level: Level, seed: number): AppliedLayer[] {
  const rng = makeRng(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const pool = [...level.pool];
  const spots = freeSpots(face);
  const usedSpots = new Set<number>();
  const out: AppliedLayer[] = [];
  while (out.length < level.items && pool.length) {
    const cat = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const def = COSMETICS[cat];
    const palette = def.palette;
    const variant = def.variants ? pick(def.variants) : undefined;
    // Μάσκα/μπογιές: το χρώμα ακολουθεί την παραλλαγή (όπως στο panel).
    const color = def.variants && (cat === 'facePaint' || cat === 'mask') ? palette[def.variants.indexOf(variant!)] ?? palette[0] : pick(palette);
    let at: Pt | undefined;
    if (def.target.kind === 'free') {
      let i = Math.floor(rng() * spots.length);
      while (usedSpots.has(i) && usedSpots.size < spots.length) i = (i + 1) % spots.length;
      usedSpots.add(i);
      at = spots[i];
    }
    const regionIds = cat === 'accessory' ? [pick(slotsFor(variant))] : regionIdsFor(cat);
    out.push({ id: newLayerId(), category: cat, color, variant, regionIds, at, seed: Math.floor(rng() * 1e9) });
  }
  return out;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** «Ίδιο» χρώμα για παιδί: κοντινές αποχρώσεις μετρούν (ευκλείδεια απόσταση RGB ≤ 70). */
export function sameColor(a: string, b: string): boolean {
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const [r1, g1, b1] = rgb(a), [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) <= 70;
}

const EXACT_COLOR: ReadonlySet<CosmeticCategory> = new Set(['hairColor', 'hairStreak']);
const VARIANT_ONLY: ReadonlySet<CosmeticCategory> = new Set(['facePaint', 'sticker', 'mask']);
const FREE_TOLERANCE = 60;

/** Ταιριάζει το στρώμα του παίκτη με ένα στοιχείο του στόχου; */
export function matches(target: AppliedLayer, l: AppliedLayer): boolean {
  if (l.category !== target.category) return false;
  if (VARIANT_ONLY.has(target.category) && l.variant !== target.variant) return false;
  if (target.category === 'accessory' && (l.variant !== target.variant || l.regionIds[0] !== target.regionIds[0])) return false;
  if (!VARIANT_ONLY.has(target.category)) {
    if (EXACT_COLOR.has(target.category) ? l.color.toLowerCase() !== target.color.toLowerCase() : !sameColor(l.color, target.color)) return false;
  }
  if (target.at) {
    if (!l.at) return false;
    if (Math.hypot(l.at[0] - target.at[0], l.at[1] - target.at[1]) > FREE_TOLERANCE) return false;
  }
  return true;
}

/** Πόσα στοιχεία του στόχου έχει αντιγράψει ο παίκτης (κάθε στρώμα μετρά μία φορά). */
export function matchedItems(preset: AppliedLayer[], layers: AppliedLayer[]): boolean[] {
  const used = new Set<string>();
  return preset.map((t) => {
    const hit = layers.find((l) => !used.has(l.id) && matches(t, l));
    if (hit) used.add(hit.id);
    return !!hit;
  });
}
