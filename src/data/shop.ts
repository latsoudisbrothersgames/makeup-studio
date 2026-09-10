import type { CosmeticCategory } from '../types/cosmetic';
import { unlockFor } from './unlocks';
import { S } from './strings';

/**
 * Κατάστημα: τα νομίσματα του Σαλονιού αγοράζουν πράγματα. Όλο το εμπόρευμα είναι κώδικας
 * (νέα χρώματα στις παλέτες, ράμπες μαλλιών, σκηνικά πίσω από το πρόσωπο) — χωρίς νέα εικαστικά.
 * Τα χρώματα του καταστήματος υπάρχουν ήδη στις παλέτες και εμφανίζονται με 🛒 μέχρι να αγοραστούν.
 */

/** Σκηνικά πίσω από το πρόσωπο (CSS στο FaceStage). */
export type StageBg = 'classic' | 'hearts' | 'stars' | 'rainbow' | 'night' | 'beach';
export const STAGE_BGS: StageBg[] = ['classic', 'hearts', 'stars', 'rainbow', 'night', 'beach'];
export const STAGE_BG_LABEL: Record<StageBg, string> = {
  classic: 'Κλασικό', hearts: 'Καρδούλες', stars: 'Αστεράκια', rainbow: 'Ουράνιο τόξο', night: 'Νύχτα', beach: 'Παραλία',
};

export type ShopItem =
  | { id: string; kind: 'color'; labelEl: string; emoji: string; price: number; category: CosmeticCategory; color: string; keys: string[] }
  | { id: string; kind: 'bg'; labelEl: string; emoji: string; price: number; bg: StageBg; keys: string[] };

const color = (id: string, labelEl: string, emoji: string, price: number, category: CosmeticCategory, hex: string, extra: CosmeticCategory[] = []): ShopItem => ({
  id, kind: 'color', labelEl, emoji, price, category, color: hex,
  keys: [category, ...extra].map((c) => `${c}:${hex.toLowerCase()}`),
});
const bg = (b: StageBg, labelEl: string, emoji: string, price: number): ShopItem => ({ id: `bg-${b}`, kind: 'bg', labelEl, emoji, price, bg: b, keys: [`bg:${b}`] });

export const SHOP_ITEMS: ShopItem[] = [
  // Κραγιόν «τρελά» χρώματα
  color('lip-blue', 'Μπλε κραγιόν', '💄', 25, 'lipstick', '#1e88e5'),
  color('lip-gold', 'Χρυσό κραγιόν', '💄', 30, 'lipstick', '#ffd700'),
  color('lip-green', 'Πράσινο κραγιόν', '💄', 25, 'lipstick', '#2e7d32'),
  color('lip-black', 'Μαύρο κραγιόν', '💄', 25, 'lipstick', '#111111'),
  // Σκιές
  color('shadow-gold', 'Χρυσή σκιά', '🎨', 30, 'eyeshadow', '#ffd700'),
  color('shadow-silver', 'Ασημί σκιά', '🎨', 30, 'eyeshadow', '#c0c0c0'),
  color('shadow-fuchsia', 'Φούξια σκιά', '🎨', 25, 'eyeshadow', '#ff1493'),
  // Γκλίτερ
  color('glitter-gold', 'Χρυσό γκλίτερ', '🌟', 20, 'glitter', '#ffd700'),
  color('glitter-green', 'Πράσινο γκλίτερ', '🌟', 20, 'glitter', '#69f0ae'),
  color('glitter-fuchsia', 'Φούξια γκλίτερ', '🌟', 20, 'glitter', '#ff4081'),
  // Μαλλιά (χρώμα + τούφα μαζί)
  color('hair-green', 'Πράσινα μαλλιά', '🖌️', 40, 'hairColor', '#2e9e5b', ['hairStreak']),
  color('hair-orange', 'Πορτοκαλί μαλλιά', '🖌️', 40, 'hairColor', '#ff9f1c', ['hairStreak']),
  color('hair-silver', 'Ασημένια μαλλιά', '🖌️', 50, 'hairColor', '#e8e8f0', ['hairStreak']),
  // Σκηνικά
  bg('hearts', 'Σκηνικό: Καρδούλες', '💗', 30),
  bg('stars', 'Σκηνικό: Αστεράκια', '✨', 30),
  bg('rainbow', 'Σκηνικό: Ουράνιο τόξο', '🌈', 40),
  bg('night', 'Σκηνικό: Νύχτα', '🌙', 40),
  bg('beach', 'Σκηνικό: Παραλία', '🏖️', 40),
];

export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** Το προϊόν που «κρύβεται» πίσω από ένα κλειδί swatch (`lipstick:#1e88e5`) ή σκηνικού (`bg:night`). */
export function shopItemFor(key: string): ShopItem | undefined {
  const k = key.toLowerCase();
  return SHOP_ITEMS.find((i) => i.keys.includes(k));
}

/** Κλειδιά καταστήματος που ΔΕΝ έχουν αγοραστεί (κλειδωμένα στο panel με 🛒). */
export function shopLockedKeys(owned: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const i of SHOP_ITEMS) if (!owned.includes(i.id)) for (const k of i.keys) out.add(k);
  return out;
}

/** Όλα τα κλειδιά καταστήματος (για το σήμα 🛒 αντί για 🔒). */
export const SHOP_KEYS: ReadonlySet<string> = new Set(SHOP_ITEMS.flatMap((i) => i.keys));

export function ownsBg(owned: readonly string[], b: StageBg): boolean {
  return b === 'classic' || owned.includes(`bg-${b}`);
}


/** Μήνυμα όταν το παιδί πατά κλειδωμένο swatch: αστέρια ή κατάστημα. */
export function lockedMessage(key: string): string {
  const u = unlockFor(key);
  if (u) return S.lockedHint(u.stars);
  const item = shopItemFor(key);
  if (item) return S.shopHint(item.price);
  return S.lockedGeneric;
}
