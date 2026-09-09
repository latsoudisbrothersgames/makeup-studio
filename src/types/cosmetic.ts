import type { Pt, RegionId } from './face';

export type CosmeticCategory =
  | 'foundation'
  | 'concealer'
  | 'blush'
  | 'highlighter'
  | 'eyeshadow'
  | 'eyeliner'
  | 'mascara'
  | 'brow'
  | 'lipstick'
  | 'gloss'
  | 'mask'
  | 'glitter'
  | 'sticker'
  | 'freckles'
  | 'beautySpot'
  | 'hairColor'
  | 'hairStreak'
  | 'facePaint'
  | 'lipLiner'
  | 'remover';

export type CosmeticGroup = 'face' | 'eyes' | 'lips' | 'hair' | 'fun';

export type DropTarget =
  /** Κουμπώνει σε μία από αυτές τις περιοχές (+ η καθρεφτισμένη της αν mirror). */
  | { kind: 'regions'; regions: RegionId[]; mirror: boolean }
  /** Οπουδήποτε πάνω στο δέρμα → όλο το πρόσωπο. */
  | { kind: 'face' }
  /** Οπουδήποτε πάνω στο δέρμα → ακριβώς εκεί. */
  | { kind: 'free' }
  /** Οπουδήποτε πάνω στα pixel των μαλλιών (hair.png) → όλα τα μαλλιά. */
  | { kind: 'hair' }
  /** Οπουδήποτε πάνω σε δέρμα ή μαλλιά → ακριβώς εκεί (βαμβάκι ντεμακιγιάζ). */
  | { kind: 'any' };

export type AnimTrigger = 'smile' | 'wow' | 'blushPulse' | 'none';

export interface Cosmetic {
  category: CosmeticCategory;
  group: CosmeticGroup;
  labelEl: string;
  /** «Άφησε το κραγιόν στα χείλη» — εμφανίζεται όσο σέρνεται. */
  hintEl: string;
  /** Emoji fallback μέχρι να έρθουν τα εικονίδια PixelLab. */
  emoji: string;
  target: DropTarget;
  /** Χρώματα (hex) ή, για μάσκες/αυτοκόλλητα, ονόματα παραλλαγών. */
  palette: string[];
  variants?: string[];
  anim: AnimTrigger;
  zRank: number;
  /** true → αντικαθιστά υπάρχον στρώμα ίδιας κατηγορίας στις ίδιες περιοχές. */
  singleton: boolean;
}

export interface AppliedLayer {
  id: string;
  category: CosmeticCategory;
  color: string;
  variant?: string;
  /** Κενό για ελεύθερη τοποθέτηση. */
  regionIds: RegionId[];
  at?: Pt;
  seed: number;
}
