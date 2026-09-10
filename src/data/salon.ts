import type { AppliedLayer, CosmeticCategory } from '../types/cosmetic';
import type { FaceId, RegionId } from '../types/face';

/**
 * «Σαλόνι»: πελάτισσες με αίτημα. Κάθε αίτημα = κανόνες που ελέγχονται στα στρώματα του παιδιού.
 * Ανοιχτό παιχνίδι: πολλές σωστές λύσεις — μετράει μόνο αν έγινε αυτό που ζήτησε η πελάτισσα.
 * Χωρίς νέα εικαστικά. Κείμενα για 8χρονα: μία-δύο σύντομες προτάσεις.
 */

export type ColorGroup = 'red' | 'pink' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'turquoise' | 'white' | 'black' | 'brown' | 'blonde';

export const COLOR_GROUP_LABEL: Record<ColorGroup, string> = {
  red: 'κόκκινο', pink: 'ροζ', orange: 'πορτοκαλί', yellow: 'κίτρινο', green: 'πράσινο', blue: 'μπλε', purple: 'μωβ',
  turquoise: 'τιρκουάζ', white: 'άσπρο', black: 'μαύρο', brown: 'καστανό', blonde: 'ξανθό',
};

/** Τα χρώματα μαλλιών έχουν όνομα (η παλέτα αντικατάστασης, όχι απόχρωση). */
const HAIR_GROUP: Record<string, ColorGroup> = {
  '#1a1822': 'black', '#6b4028': 'brown', '#e9c56b': 'blonde', '#c95e2c': 'red',
  '#ff7fbf': 'pink', '#9a5ed8': 'purple', '#4f86ea': 'blue', '#3fd0c9': 'turquoise',
};

function hsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return [h, s, l];
}

/** Ομάδα χρώματος για παιδί: «ροζ», «κόκκινο», «μπλε»… */
export function colorGroup(hex: string, category?: CosmeticCategory): ColorGroup {
  const k = hex.toLowerCase();
  if ((category === 'hairColor' || category === 'hairStreak') && HAIR_GROUP[k]) return HAIR_GROUP[k];
  const [h, s, l] = hsl(k);
  if (l >= 0.88) return 'white';
  if (l <= 0.16) return 'black';
  if (s < 0.2) return l < 0.45 ? 'black' : 'white';
  if (h < 12 || h >= 342) return l > 0.62 ? 'pink' : 'red';
  if (h < 40) return l < 0.45 && s < 0.6 ? 'brown' : 'orange';
  if (h < 68) return 'yellow';
  if (h < 165) return 'green';
  if (h < 195) return 'turquoise';
  if (h < 250) return 'blue';
  if (h < 300) return 'purple';
  return 'pink';
}

export type Rule =
  /** Να υπάρχει (τουλάχιστον `min`, προεπιλογή 1) στρώμα της κατηγορίας, με προαιρετική παραλλαγή/ομάδα χρώματος. */
  | { kind: 'has'; category: CosmeticCategory; variant?: string; colors?: ColorGroup[]; min?: number; labelEl: string }
  /** Να ΜΗΝ υπάρχει (όλη η κατηγορία, ή μόνο μια ομάδα χρώματος / παραλλαγή). */
  | { kind: 'not'; category: CosmeticCategory; variant?: string; colors?: ColorGroup[]; labelEl: string }
  /** Τίποτα άλλο εκτός από αυτές τις κατηγορίες. */
  | { kind: 'only'; categories: CosmeticCategory[]; labelEl: string }
  /** Αξεσουάρ σε συγκεκριμένες θέσεις (π.χ. φιόγκος αριστερά ΚΑΙ δεξιά). */
  | { kind: 'slots'; variant: string; slots: RegionId[]; labelEl: string }
  /** Τουλάχιστον `min` πράγματα σε αυτές τις ομάδες χρώματος (οποιαδήποτε κατηγορία εκτός μαλλιών). */
  | { kind: 'colorCount'; colors: ColorGroup[]; min: number; labelEl: string };

export interface Brief {
  id: string;
  /** Emoji της περίστασης. */
  emoji: string;
  /** «Έχει γενέθλια!» — η αφορμή. */
  occasionEl: string;
  /** Το αίτημα, όπως το λέει η πελάτισσα (1–2 προτάσεις). */
  requestEl: string;
  rules: Rule[];
  /** Κλειδιά ξεκλειδωμάτων που χρειάζονται (αλλιώς το αίτημα δεν προσφέρεται). */
  needs?: string[];
}

export const BRIEFS: Brief[] = [
  {
    id: 'birthday', emoji: '🎂', occasionEl: 'Έχει γενέθλια!',
    requestEl: 'Θέλω γκλίτερ και ροζ κραγιόν!',
    rules: [
      { kind: 'has', category: 'glitter', labelEl: 'Γκλίτερ' },
      { kind: 'has', category: 'lipstick', colors: ['pink'], labelEl: 'Ροζ κραγιόν' },
    ],
  },
  {
    id: 'wedding', emoji: '💒', occasionEl: 'Πάει σε γάμο.',
    requestEl: 'Κάτι λαμπερό, με λάμψη στα ζυγωματικά. Κραγιόν ναι, αλλά όχι κόκκινο!',
    rules: [
      { kind: 'has', category: 'highlighter', labelEl: 'Λάμψη' },
      { kind: 'has', category: 'lipstick', labelEl: 'Κραγιόν' },
      { kind: 'not', category: 'lipstick', colors: ['red'], labelEl: 'Όχι κόκκινο κραγιόν' },
    ],
  },
  {
    id: 'costume-cat', emoji: '🐱', occasionEl: 'Πάει σε πάρτι μεταμφιεσμένων.',
    requestEl: 'Κάνε με γατούλα!',
    rules: [{ kind: 'has', category: 'facePaint', variant: 'cat', labelEl: 'Μπογιά γατούλα' }],
  },
  {
    id: 'blue-star', emoji: '🌟', occasionEl: 'Θέλει κάτι διαφορετικό.',
    requestEl: 'Μπλε μαλλιά και ένα αστέρι στο μάγουλο.',
    rules: [
      { kind: 'has', category: 'hairColor', colors: ['blue'], labelEl: 'Μπλε μαλλιά' },
      { kind: 'has', category: 'sticker', variant: 'star', labelEl: 'Αυτοκόλλητο αστέρι' },
    ],
  },
  {
    id: 'photo-shoot', emoji: '📸', occasionEl: 'Έχει φωτογράφιση για περιοδικό.',
    requestEl: 'Σκιά στα μάτια, μάσκαρα και ρουζ. Να είμαι τέλεια!',
    rules: [
      { kind: 'has', category: 'eyeshadow', labelEl: 'Σκιά ματιών' },
      { kind: 'has', category: 'mascara', labelEl: 'Μάσκαρα' },
      { kind: 'has', category: 'blush', labelEl: 'Ρουζ' },
    ],
  },
  {
    id: 'school', emoji: '🎒', occasionEl: 'Πρώτη μέρα στο σχολείο.',
    requestEl: 'Κάτι απλό: λίγο ρουζ και λίγο κραγιόν. Όχι γκλίτερ, όχι αυτοκόλλητα!',
    rules: [
      { kind: 'has', category: 'blush', labelEl: 'Ρουζ' },
      { kind: 'has', category: 'lipstick', labelEl: 'Κραγιόν' },
      { kind: 'not', category: 'glitter', labelEl: 'Όχι γκλίτερ' },
      { kind: 'not', category: 'sticker', labelEl: 'Όχι αυτοκόλλητα' },
    ],
  },
  {
    id: 'beach', emoji: '🏖️', occasionEl: 'Πάει στη θάλασσα.',
    requestEl: 'Φακίδες σαν τον ήλιο και ένα λουλούδι στο μάγουλο.',
    rules: [
      { kind: 'has', category: 'freckles', labelEl: 'Φακίδες' },
      { kind: 'has', category: 'sticker', variant: 'flower', labelEl: 'Αυτοκόλλητο λουλούδι' },
    ],
  },
  {
    id: 'princess', emoji: '👑', occasionEl: 'Είναι πριγκίπισσα για μια μέρα.',
    requestEl: 'Τιάρα στο κεφάλι και μωβ μαλλιά!',
    rules: [
      { kind: 'has', category: 'accessory', variant: 'tiara', labelEl: 'Τιάρα' },
      { kind: 'has', category: 'hairColor', colors: ['purple'], labelEl: 'Μωβ μαλλιά' },
    ],
    needs: ['accessory:tiara', 'hairColor:#9a5ed8'],
  },
  {
    id: 'two-bows', emoji: '🎀', occasionEl: 'Πάει σε πάρτι.',
    requestEl: 'Δύο φιόγκους: έναν αριστερά κι έναν δεξιά!',
    rules: [{ kind: 'slots', variant: 'bow', slots: ['accL', 'accR'], labelEl: 'Φιόγκος αριστερά και δεξιά' }],
  },
  {
    id: 'winter', emoji: '❄️', occasionEl: 'Κάνει κρύο έξω!',
    requestEl: 'Ρουζ στα μάγουλα και κόκκινο κραγιόν, σαν το χιόνι και τα κεράσια.',
    rules: [
      { kind: 'has', category: 'blush', labelEl: 'Ρουζ' },
      { kind: 'has', category: 'lipstick', colors: ['red'], labelEl: 'Κόκκινο κραγιόν' },
    ],
  },
  {
    id: 'movie-star', emoji: '🎬', occasionEl: 'Πάει σε πρεμιέρα ταινίας.',
    requestEl: 'Μια ελιά σαν σταρ του σινεμά και άιλάινερ στα μάτια.',
    rules: [
      { kind: 'has', category: 'beautySpot', labelEl: 'Ελιά' },
      { kind: 'has', category: 'eyeliner', labelEl: 'Άιλάινερ' },
    ],
  },
  {
    id: 'spa', emoji: '🧖', occasionEl: 'Θέλει χαλάρωση.',
    requestEl: 'Μόνο μια μάσκα προσώπου. Τίποτα άλλο, σε παρακαλώ!',
    rules: [
      { kind: 'has', category: 'mask', labelEl: 'Μάσκα προσώπου' },
      { kind: 'only', categories: ['mask'], labelEl: 'Τίποτα άλλο' },
    ],
  },
  {
    id: 'butterfly', emoji: '🦋', occasionEl: 'Έχει σχολική παράσταση.',
    requestEl: 'Μια πεταλούδα και ένα λουλούδι στο πρόσωπο!',
    rules: [
      { kind: 'has', category: 'sticker', variant: 'butterfly', labelEl: 'Πεταλούδα' },
      { kind: 'has', category: 'sticker', variant: 'flower', labelEl: 'Λουλούδι' },
    ],
    needs: ['sticker:butterfly'],
  },
  {
    id: 'blonde', emoji: '💇', occasionEl: 'Έβαψε τα μαλλιά της λάθος!',
    requestEl: 'Κάνε τα μαλλιά μου ξανθά, γρήγορα!',
    rules: [{ kind: 'has', category: 'hairColor', colors: ['blonde'], labelEl: 'Ξανθά μαλλιά' }],
  },
  {
    id: 'yellow', emoji: '🌻', occasionEl: 'Αγαπάει το κίτρινο.',
    requestEl: 'Θέλω δύο κίτρινα πράγματα στο πρόσωπο!',
    rules: [{ kind: 'colorCount', colors: ['yellow'], min: 2, labelEl: 'Δύο κίτρινα πράγματα' }],
  },
  {
    id: 'streak', emoji: '🌈', occasionEl: 'Πάει σε συναυλία.',
    requestEl: 'Μια τούφα σε άλλο χρώμα και γκλίτερ τρεις φορές!',
    rules: [
      { kind: 'has', category: 'hairStreak', labelEl: 'Τούφα' },
      { kind: 'has', category: 'glitter', min: 3, labelEl: 'Γκλίτερ 3 φορές' },
    ],
  },
  {
    id: 'rainbow', emoji: '🎨', occasionEl: 'Πάει σε καρναβάλι.',
    requestEl: 'Ουράνιο τόξο στο πρόσωπο και πολύχρωμα μαλλιά, ροζ ή τιρκουάζ!',
    rules: [
      { kind: 'has', category: 'facePaint', variant: 'rainbow', labelEl: 'Μπογιά ουράνιο τόξο' },
      { kind: 'has', category: 'hairColor', colors: ['pink', 'turquoise'], labelEl: 'Ροζ ή τιρκουάζ μαλλιά' },
    ],
    needs: ['facePaint:rainbow'],
  },
  {
    id: 'green-eyes', emoji: '🍀', occasionEl: 'Έχει τυχερή μέρα.',
    requestEl: 'Πράσινη σκιά στα μάτια και μια καρδούλα όπου θέλεις.',
    rules: [
      { kind: 'has', category: 'eyeshadow', colors: ['green', 'turquoise'], labelEl: 'Πράσινη σκιά' },
      { kind: 'has', category: 'sticker', variant: 'heart', labelEl: 'Αυτοκόλλητο καρδιά' },
    ],
  },
  {
    id: 'pink-all', emoji: '🩷', occasionEl: 'Όλα ροζ!',
    requestEl: 'Ροζ μαλλιά, ροζ ρουζ και ροζ κραγιόν. Όλα ροζ!',
    rules: [
      { kind: 'has', category: 'hairColor', colors: ['pink'], labelEl: 'Ροζ μαλλιά' },
      { kind: 'has', category: 'blush', colors: ['pink'], labelEl: 'Ροζ ρουζ' },
      { kind: 'has', category: 'lipstick', colors: ['pink'], labelEl: 'Ροζ κραγιόν' },
    ],
  },
  {
    id: 'brows', emoji: '🧐', occasionEl: 'Έχει σημαντική συνέντευξη.',
    requestEl: 'Φρύδια σε τάξη και κονσίλερ κάτω από τα μάτια. Τίποτα λαμπερό!',
    rules: [
      { kind: 'has', category: 'brow', labelEl: 'Φρύδια' },
      { kind: 'has', category: 'concealer', labelEl: 'Κονσίλερ' },
      { kind: 'not', category: 'glitter', labelEl: 'Όχι γκλίτερ' },
      { kind: 'not', category: 'highlighter', labelEl: 'Όχι λάμψη' },
    ],
  },
];

const NOT_COLOR_COUNTED: ReadonlySet<CosmeticCategory> = new Set(['hairColor', 'hairStreak', 'remover', 'hairstyle', 'foundation', 'concealer']);

function layerInGroups(l: AppliedLayer, groups: ColorGroup[]): boolean {
  return groups.includes(colorGroup(l.color, l.category));
}

/** Έλεγχος ενός κανόνα στα στρώματα. */
export function checkRule(rule: Rule, layers: AppliedLayer[]): boolean {
  switch (rule.kind) {
    case 'has': {
      const hits = layers.filter((l) =>
        l.category === rule.category &&
        (!rule.variant || l.variant === rule.variant) &&
        (!rule.colors || layerInGroups(l, rule.colors)));
      return hits.length >= (rule.min ?? 1);
    }
    case 'not':
      return !layers.some((l) =>
        l.category === rule.category &&
        (!rule.variant || l.variant === rule.variant) &&
        (!rule.colors || layerInGroups(l, rule.colors)));
    case 'only':
      return layers.every((l) => rule.categories.includes(l.category));
    case 'slots':
      return rule.slots.every((slot) => layers.some((l) => l.category === 'accessory' && l.variant === rule.variant && l.regionIds[0] === slot));
    case 'colorCount':
      return layers.filter((l) => !NOT_COLOR_COUNTED.has(l.category) && layerInGroups(l, rule.colors)).length >= rule.min;
  }
}

export interface Verdict {
  results: { rule: Rule; ok: boolean }[];
  ok: number;
  total: number;
  /** 0–3 */
  stars: number;
  coins: number;
  reaction: 'wow' | 'smile' | 'neutral';
}

/** Πόσο ευχαριστήθηκε η πελάτισσα. Όλα σωστά → 3★· λείπει ένα → 2★· τα μισά → 1★· αλλιώς 0. */
export function evaluate(brief: Brief, layers: AppliedLayer[]): Verdict {
  const results = brief.rules.map((rule) => ({ rule, ok: checkRule(rule, layers) }));
  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  let stars = 0;
  if (ok === total) stars = 3;
  else if (total >= 2 && ok === total - 1) stars = 2;
  else if (ok * 2 >= total && ok > 0) stars = 1;
  const coins = stars === 3 ? 30 : stars === 2 ? 20 : stars === 1 ? 10 : 5;
  return { results, ok, total, stars, coins, reaction: stars === 3 ? 'wow' : stars > 0 ? 'smile' : 'neutral' };
}

export interface Customer {
  face: FaceId;
  brief: Brief;
}

/** Επόμενη πελάτισσα: διαφορετικό πρόσωπο από την προηγούμενη, αίτημα που δεν ήρθε πρόσφατα και δεν θέλει κλειδωμένα. */
export function nextCustomer(locked: ReadonlySet<string>, recentBriefs: string[], lastFace: FaceId | null, rnd: () => number = Math.random): Customer {
  const faces: FaceId[] = ['f1', 'f2', 'f3', 'f4'];
  const facePool = faces.filter((f) => f !== lastFace);
  const face = facePool[Math.floor(rnd() * facePool.length)];
  const open = BRIEFS.filter((b) => !b.needs?.some((k) => locked.has(k)));
  const fresh = open.filter((b) => !recentBriefs.includes(b.id));
  const pool = fresh.length ? fresh : open;
  const brief = pool[Math.floor(rnd() * pool.length)];
  return { face, brief };
}

export function briefById(id: string): Brief | undefined {
  return BRIEFS.find((b) => b.id === id);
}
