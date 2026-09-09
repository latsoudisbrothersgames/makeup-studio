import type { AppliedLayer } from '../types/cosmetic';

/**
 * Κάρτες έμπνευσης: 4 προαιρετικές κάρτες με 2 απλά αιτήματα η καθεμία.
 * Κάθε αίτημα είναι ένας έλεγχος πάνω στα στρώματα — καμία νέα εικόνα.
 */
export interface CardGoal {
  id: string;
  labelEl: string;
  done(layers: AppliedLayer[]): boolean;
}

export interface Card {
  id: string;
  titleEl: string;
  emoji: string;
  goals: [CardGoal, CardGoal];
}

const has = (layers: AppliedLayer[], cat: AppliedLayer['category'], pred: (l: AppliedLayer) => boolean = () => true) =>
  layers.some((l) => l.category === cat && pred(l));

const PINK_LIPS = new Set(['#f06292', '#ff8a80', '#ff5252']);
const BLUE_EYES = new Set(['#5c6bc0', '#7e57c2']);

export const CARDS: Card[] = [
  {
    id: 'purple-star',
    titleEl: 'Μωβ μαλλιά και ένα αστέρι',
    emoji: '💜',
    goals: [
      { id: 'purpleHair', labelEl: 'Μωβ μαλλιά', done: (ls) => has(ls, 'hairColor', (l) => l.color === '#9a5ed8') },
      { id: 'star', labelEl: 'Ένα αστέρι', done: (ls) => has(ls, 'sticker', (l) => l.variant === 'star') },
    ],
  },
  {
    id: 'flower-pink',
    titleEl: 'Ένα λουλούδι και ροζ χείλη',
    emoji: '🌸',
    goals: [
      { id: 'flower', labelEl: 'Ένα λουλούδι', done: (ls) => has(ls, 'sticker', (l) => l.variant === 'flower') },
      { id: 'pinkLips', labelEl: 'Ροζ κραγιόν', done: (ls) => has(ls, 'lipstick', (l) => PINK_LIPS.has(l.color)) },
    ],
  },
  {
    id: 'cat-blue',
    titleEl: 'Γατούλα με μπλε σκιά',
    emoji: '🐱',
    goals: [
      { id: 'cat', labelEl: 'Μπογιά γατούλα', done: (ls) => has(ls, 'facePaint', (l) => l.variant === 'cat') },
      { id: 'blueShadow', labelEl: 'Μπλε ή μωβ σκιά ματιών', done: (ls) => has(ls, 'eyeshadow', (l) => BLUE_EYES.has(l.color)) },
    ],
  },
  {
    id: 'rainbow-streak',
    titleEl: 'Ουράνιο τόξο και τιρκουάζ τούφα',
    emoji: '🌈',
    goals: [
      { id: 'rainbow', labelEl: 'Μπογιά ουράνιο τόξο', done: (ls) => has(ls, 'facePaint', (l) => l.variant === 'rainbow') },
      { id: 'streak', labelEl: 'Τιρκουάζ τούφα', done: (ls) => has(ls, 'hairStreak', (l) => l.color === '#3fd0c9') },
    ],
  },
];

export function cardById(id: string | null): Card | undefined {
  return CARDS.find((c) => c.id === id);
}
