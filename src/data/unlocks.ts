import type { CosmeticCategory } from '../types/cosmetic';

/**
 * Ξεκλειδώματα με αστέρια. Κλειδί στοιχείου: `<category>:<χρώμα ή παραλλαγή>`.
 * Το βασικό σετ μένει γενναιόδωρο — κλειδώνουν λίγα «ξεχωριστά» πράγματα ώστε να υπάρχει στόχος.
 */
export interface Unlock {
  stars: number;
  labelEl: string;
  emoji: string;
  keys: string[];
  /** Εικαστικό για το μενού «Τι ξεκλειδώνουν τα αστέρια;» (sprites/χρώματα που υπάρχουν ήδη). */
  art: { kind: 'accessory' | 'sticker' | 'swatch' | 'icon'; ids: string[] };
}

export const UNLOCKS: Unlock[] = [
  { stars: 3, labelEl: 'Τιάρα', emoji: '👑', keys: ['accessory:tiara'], art: { kind: 'accessory', ids: ['tiara'] } },
  { stars: 6, labelEl: 'Μωβ και τιρκουάζ μαλλιά', emoji: '💜', keys: ['hairColor:#9a5ed8', 'hairColor:#3fd0c9', 'hairStreak:#9a5ed8', 'hairStreak:#3fd0c9'], art: { kind: 'swatch', ids: ['#9a5ed8', '#3fd0c9'] } },
  { stars: 10, labelEl: 'Πεταλούδα και πετράδι', emoji: '🦋', keys: ['sticker:butterfly', 'sticker:gem'], art: { kind: 'sticker', ids: ['butterfly', 'gem'] } },
  { stars: 15, labelEl: 'Μπογιά ουράνιο τόξο', emoji: '🌈', keys: ['facePaint:rainbow'], art: { kind: 'icon', ids: ['facePaint'] } },
];

/** Κλειδί για swatch (χρώμα) ή παραλλαγή. */
export function unlockKey(category: CosmeticCategory, colorOrVariant: string): string {
  return `${category}:${colorOrVariant.toLowerCase()}`;
}

/** Ποια στοιχεία είναι ακόμη κλειδωμένα για `stars` αστέρια. */
export function lockedKeys(stars: number): Set<string> {
  const out = new Set<string>();
  for (const u of UNLOCKS) if (stars < u.stars) for (const k of u.keys) out.add(k);
  return out;
}

/** Το ξεκλείδωμα που απαιτεί ένα κλειδί (για το μήνυμα «Ξεκλειδώνει με N αστέρια»). */
export function unlockFor(key: string): Unlock | undefined {
  return UNLOCKS.find((u) => u.keys.includes(key));
}

/** Ξεκλειδώματα που κερδήθηκαν περνώντας από `before` σε `after` αστέρια. */
export function newlyUnlocked(before: number, after: number): Unlock[] {
  return UNLOCKS.filter((u) => before < u.stars && after >= u.stars);
}

/** Το επόμενο ξεκλείδωμα μετά τα `stars` (για τον πίνακα). */
export function nextUnlock(stars: number): Unlock | undefined {
  return UNLOCKS.find((u) => stars < u.stars);
}
