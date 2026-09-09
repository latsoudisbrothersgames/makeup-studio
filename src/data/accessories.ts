import type { RegionId } from '../types/face';
import type { AppliedLayer } from '../types/cosmetic';

/** Αξεσουάρ μαλλιών: ποιες θέσεις δέχεται κάθε παραλλαγή. */
export const ACCESSORY_SLOTS: RegionId[] = ['accL', 'accR', 'accTop'];
export function slotsFor(variant: string | undefined): RegionId[] {
  return variant === 'band' || variant === 'tiara' ? ['accTop'] : ACCESSORY_SLOTS;
}

/** Κλίμακα σχεδίασης και θέση κάθε sprite ως προς την άγκυρα της θέσης (χώρος 512). */
export const ACCESSORY_DRAW: Record<string, { scale: number; dx: number; dy: number; decoDy: number }> = {
  clip: { scale: 2, dx: 0, dy: 0, decoDy: 0 },
  bow: { scale: 2, dx: 0, dy: 0, decoDy: 0 },
  band: { scale: 2, dx: 0, dy: 54, decoDy: -44 },
  tiara: { scale: 1, dx: 0, dy: 10, decoDy: 4 },
};

/** Κοκαλάκι/φιόγκος στην κορυφή: λίγο πιο κάτω ώστε να μην κόβονται από το πάνω άκρο του καμβά. */
export const TOP_SLOT_DY = 16;

export function isAccessorySlot(id: string | undefined): id is 'accL' | 'accR' | 'accTop' {
  return id === 'accL' || id === 'accR' || id === 'accTop';
}

/**
 * Αυτοκόλλητο πάνω σε θέση αξεσουάρ → γίνεται διακοσμητικό του αξεσουάρ που υπάρχει εκεί.
 * Επιστρέφει το νέο στρώμα (αντικαθιστά το παλιό ως singleton της θέσης) ή undefined αν η θέση είναι άδεια.
 */
export function decorateAccessory(layers: AppliedLayer[], slot: RegionId, deco: string, decoColor: string, newId: string): AppliedLayer | undefined {
  const acc = [...layers].reverse().find((l) => l.category === 'accessory' && l.regionIds[0] === slot);
  if (!acc) return undefined;
  return { ...acc, id: newId, deco, decoColor };
}
