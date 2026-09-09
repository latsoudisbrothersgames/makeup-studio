import type { Cosmetic, CosmeticCategory, CosmeticGroup } from '../types/cosmetic';
import { S } from './strings';
import { HAIR_PALETTE } from '../engine/hairColor';

/**
 * Κατάλογος καλλυντικών. Το `palette` της βάσης/κονσίλερ γεμίζει από τις αποχρώσεις του
 * κάθε προσώπου (βλ. paletteFor).
 */
export const COSMETICS: Record<CosmeticCategory, Cosmetic> = {
  foundation: {
    category: 'foundation', group: 'face', labelEl: 'Βάση', hintEl: 'Άφησε τη βάση πάνω στο πρόσωπο', emoji: '🧴',
    target: { kind: 'face' }, palette: [], anim: 'smile', zRank: 0, singleton: true,
  },
  concealer: {
    category: 'concealer', group: 'face', labelEl: 'Κονσίλερ', hintEl: 'Άφησε το κονσίλερ κάτω από τα μάτια', emoji: '🖍️',
    target: { kind: 'regions', regions: ['underEyeL', 'underEyeR'], mirror: true }, palette: [], anim: 'smile', zRank: 1, singleton: true,
  },
  freckles: {
    category: 'freckles', group: 'face', labelEl: 'Φακίδες', hintEl: 'Άφησε τις φακίδες στα μάγουλα', emoji: '🟤',
    target: { kind: 'regions', regions: ['cheekL', 'cheekR', 'noseBridge'], mirror: true },
    palette: ['#a1724e', '#8d5a3b', '#c48b63'], anim: 'smile', zRank: 2, singleton: true,
  },
  blush: {
    category: 'blush', group: 'face', labelEl: 'Ρουζ', hintEl: 'Άφησε το ρουζ στα μάγουλα', emoji: '🌸',
    target: { kind: 'regions', regions: ['cheekL', 'cheekR'], mirror: true },
    palette: ['#ff8fa3', '#ff6f91', '#f4a6c1', '#e57373', '#ffab91', '#d98cb3'], anim: 'blushPulse', zRank: 3, singleton: true,
  },
  highlighter: {
    category: 'highlighter', group: 'face', labelEl: 'Λάμψη', hintEl: 'Άφησε τη λάμψη στα ζυγωματικά', emoji: '✨',
    target: { kind: 'regions', regions: ['cheekboneL', 'cheekboneR', 'tzone'], mirror: true },
    palette: ['#fff3c4', '#ffe0b2', '#f8bbd0', '#e1f5fe', '#fffde7'], anim: 'smile', zRank: 4, singleton: false,
  },
  eyeshadow: {
    category: 'eyeshadow', group: 'eyes', labelEl: 'Σκιά ματιών', hintEl: 'Άφησε τη σκιά στα βλέφαρα', emoji: '🎨',
    target: { kind: 'regions', regions: ['lidL', 'lidR'], mirror: true },
    palette: ['#7e57c2', '#5c6bc0', '#26a69a', '#ec407a', '#ffca28', '#8d6e63', '#90a4ae', '#43a047'], anim: 'smile', zRank: 5, singleton: true,
  },
  eyeliner: {
    category: 'eyeliner', group: 'eyes', labelEl: 'Άιλάινερ', hintEl: 'Άφησε το άιλάινερ στα μάτια', emoji: '🖊️',
    target: { kind: 'regions', regions: ['lashL', 'lashR', 'lidL', 'lidR', 'eyeHoleL', 'eyeHoleR'], mirror: true },
    palette: ['#1a1a1a', '#3e2723', '#1a237e', '#004d40', '#6a1b9a'], anim: 'smile', zRank: 6, singleton: true,
  },
  mascara: {
    category: 'mascara', group: 'eyes', labelEl: 'Μάσκαρα', hintEl: 'Άφησε τη μάσκαρα στις βλεφαρίδες', emoji: '🪄',
    target: { kind: 'regions', regions: ['lashL', 'lashR', 'lidL', 'lidR', 'eyeHoleL', 'eyeHoleR'], mirror: true },
    palette: ['#111111', '#3e2723', '#1a237e'], anim: 'smile', zRank: 7, singleton: true,
  },
  brow: {
    category: 'brow', group: 'eyes', labelEl: 'Φρύδια', hintEl: 'Άφησε το μολύβι στα φρύδια', emoji: '✏️',
    target: { kind: 'regions', regions: ['browL', 'browR'], mirror: true },
    palette: ['#3e2723', '#5d4037', '#8d6e63', '#212121', '#a1887f'], anim: 'smile', zRank: 8, singleton: true,
  },
  lipstick: {
    category: 'lipstick', group: 'lips', labelEl: 'Κραγιόν', hintEl: 'Άφησε το κραγιόν στα χείλη', emoji: '💄',
    target: { kind: 'regions', regions: ['lips'], mirror: false },
    palette: ['#c2185b', '#e53935', '#ff5252', '#ad1457', '#f06292', '#d84315', '#8e24aa', '#ff8a80'], anim: 'smile', zRank: 9, singleton: true,
  },
  lipLiner: {
    category: 'lipLiner', group: 'lips', labelEl: 'Μολύβι χειλιών', hintEl: 'Άφησε το μολύβι στα χείλη', emoji: '✏️',
    target: { kind: 'regions', regions: ['lips'], mirror: false },
    palette: ['#8e1b3a', '#b5423b', '#6d2b1f', '#a0446a', '#3e2723', '#d85a6a'], anim: 'smile', zRank: 9.5, singleton: true,
  },
  gloss: {
    category: 'gloss', group: 'lips', labelEl: 'Γκλος', hintEl: 'Άφησε το γκλος στα χείλη', emoji: '💧',
    target: { kind: 'regions', regions: ['lips'], mirror: false },
    palette: ['#ffb3c6', '#ffd6e0', '#ffccbc', '#f8bbd0'], anim: 'smile', zRank: 10, singleton: true,
  },
  beautySpot: {
    category: 'beautySpot', group: 'face', labelEl: 'Ελιά', hintEl: 'Άφησε την ελιά όπου θέλεις στο πρόσωπο', emoji: '⚫',
    target: { kind: 'free' }, palette: ['#3e2723', '#212121'], anim: 'smile', zRank: 11, singleton: false,
  },
  accessory: {
    category: 'accessory', group: 'hair', labelEl: 'Στολίδια', hintEl: 'Άφησε το στολίδι αριστερά, δεξιά ή στην κορυφή', emoji: '🎀',
    target: { kind: 'regions', regions: ['accL', 'accR', 'accTop'], mirror: false },
    palette: ['#ff7fbf', '#e53935', '#f5b301', '#4f86ea', '#9a5ed8', '#3fd0c9', '#f4f4f4', '#2b2834'],
    variants: ['clip', 'bow', 'band', 'tiara'], anim: 'smile', zRank: 30, singleton: true,
  },
  facePaint: {
    category: 'facePaint', group: 'fun', labelEl: 'Μπογιές', hintEl: 'Άφησε τη μπογιά πάνω στο πρόσωπο', emoji: '🎭',
    target: { kind: 'face' },
    palette: ['#1a1a1a', '#e53935'], variants: ['cat', 'rainbow'], anim: 'wow', zRank: 11.5, singleton: true,
  },
  glitter: {
    category: 'glitter', group: 'fun', labelEl: 'Γκλίτερ', hintEl: 'Άφησε το γκλίτερ όπου θέλεις στο πρόσωπο', emoji: '🌟',
    target: { kind: 'free' }, palette: ['#ffd54f', '#f48fb1', '#80deea', '#ce93d8', '#ffffff'], anim: 'smile', zRank: 12, singleton: false,
  },
  sticker: {
    category: 'sticker', group: 'fun', labelEl: 'Αυτοκόλλητα', hintEl: 'Άφησε το αυτοκόλλητο όπου θέλεις στο πρόσωπο', emoji: '💖',
    target: { kind: 'free' },
    palette: ['#ff5c8a', '#ffd54f', '#4fc3f7', '#ff8a65', '#ba68c8'],
    variants: ['heart', 'star', 'gem', 'flower', 'butterfly'], anim: 'smile', zRank: 13, singleton: false,
  },
  hairColor: {
    category: 'hairColor', group: 'hair', labelEl: 'Χρώμα', hintEl: 'Άφησε τη βαφή πάνω στα μαλλιά', emoji: '🖌️',
    target: { kind: 'hair' }, palette: HAIR_PALETTE, anim: 'wow', zRank: 20, singleton: true,
  },
  hairStreak: {
    category: 'hairStreak', group: 'hair', labelEl: 'Τούφα', hintEl: 'Άφησε το χρώμα πάνω στην τούφα, στα αριστερά', emoji: '🌈',
    target: { kind: 'regions', regions: ['hairStreak'], mirror: false }, palette: HAIR_PALETTE, anim: 'smile', zRank: 21, singleton: true,
  },
  remover: {
    category: 'remover', group: 'fun', labelEl: 'Βαμβάκι', hintEl: 'Σύρε το βαμβάκι εκεί που θέλεις να σβήσεις', emoji: '🧻',
    target: { kind: 'any' }, palette: ['#ffffff'], anim: 'none', zRank: 99, singleton: false,
  },
  mask: {
    category: 'mask', group: 'face', labelEl: 'Μάσκα προσώπου', hintEl: 'Άφησε τη μάσκα πάνω στο πρόσωπο', emoji: '🎭',
    target: { kind: 'face' },
    palette: ['#eaf4ff', '#e8f5e9', '#d7ccc8'], variants: ['sheet', 'cream', 'clay'], anim: 'wow', zRank: 14, singleton: true,
  },
};

export const GROUPS: { id: CosmeticGroup; labelEl: string; emoji: string }[] = [
  { id: 'face', labelEl: S.groupFace, emoji: '🙂' },
  { id: 'eyes', labelEl: S.groupEyes, emoji: '👁️' },
  { id: 'lips', labelEl: S.groupLips, emoji: '👄' },
  { id: 'hair', labelEl: S.groupHair, emoji: '💇' },
  { id: 'fun', labelEl: S.groupFun, emoji: '🎉' },
];

export const CATEGORY_ORDER: CosmeticCategory[] = [
  'foundation', 'concealer', 'blush', 'highlighter', 'freckles', 'beautySpot', 'mask',
  'eyeshadow', 'eyeliner', 'mascara', 'brow',
  'lipstick', 'lipLiner', 'gloss',
  'hairColor', 'hairStreak', 'accessory',
  'facePaint', 'glitter', 'sticker', 'remover',
];

export function categoriesOf(group: CosmeticGroup): Cosmetic[] {
  return CATEGORY_ORDER.map((c) => COSMETICS[c]).filter((c) => c.group === group);
}

/** Ετικέτες παραλλαγών (μάσκες/αυτοκόλλητα). */
export const VARIANT_LABELS: Record<string, string> = {
  sheet: 'Υφασμάτινη', cream: 'Κρέμα', clay: 'Άργιλος',
  heart: 'Καρδιά', star: 'Αστέρι', gem: 'Πετράδι', flower: 'Λουλούδι', butterfly: 'Πεταλούδα',
  cat: 'Γατούλα', rainbow: 'Ουράνιο τόξο',
  clip: 'Κοκαλάκι', bow: 'Φιόγκος', band: 'Στέκα', tiara: 'Τιάρα',
};
