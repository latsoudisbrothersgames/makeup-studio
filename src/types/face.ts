/** Σημείο στον χώρο του προσώπου (0..512). */
export type Pt = [number, number];
export type Poly = Pt[];

export type Expression = 'neutral' | 'blink' | 'smile' | 'wow';
export const EXPRESSIONS: Expression[] = ['neutral', 'blink', 'smile', 'wow'];

export type FaceId = 'f1' | 'f2' | 'f3' | 'f4';

export type RegionId =
  | 'skin'
  | 'faceBox'
  | 'lips'
  | 'mouthHole'
  | 'eyeHoleL'
  | 'eyeHoleR'
  | 'cheekL'
  | 'cheekR'
  | 'cheekboneL'
  | 'cheekboneR'
  | 'tzone'
  | 'noseBridge'
  | 'lidL'
  | 'lidR'
  | 'lashL'
  | 'lashR'
  | 'underEyeL'
  | 'underEyeR'
  | 'browL'
  | 'browR'
  /** Όλα τα μαλλιά (γενναιόδωρο περίγραμμα, στόχος για βαφή/αξεσουάρ). */
  | 'hair'
  /** Η πλαϊνή τούφα που παίρνει δεύτερο χρώμα. */
  | 'hairStreak';

export const REGION_IDS: RegionId[] = [
  'skin', 'faceBox', 'lips', 'mouthHole', 'eyeHoleL', 'eyeHoleR', 'cheekL', 'cheekR',
  'cheekboneL', 'cheekboneR', 'tzone', 'noseBridge', 'lidL', 'lidR', 'lashL', 'lashR',
  'underEyeL', 'underEyeR', 'browL', 'browR', 'hair', 'hairStreak',
];

/** Οι περιοχές που είναι πολυγραμμές (γραμμή βλεφαρίδων) και όχι πολύγωνα. */
export const POLYLINE_REGIONS: ReadonlySet<RegionId> = new Set<RegionId>(['lashL', 'lashR']);

export interface Region {
  id: RegionId;
  kind: 'polygon' | 'polyline';
  points: Poly;
}

export interface RegionMap {
  size: 512;
  /** Ουδέτερη έκφραση. */
  regions: Record<RegionId, Region>;
  /** Παραλλαγές ανά έκφραση — μόνο ό,τι αλλάζει. Κενό `points` = η περιοχή λείπει (π.χ. μάτι κλειστό). */
  variants: Partial<Record<Expression, Partial<Record<RegionId, Region>>>>;
  anchors: {
    lipHighlight: Pt;
    lipHighlightSmile?: Pt;
    /** Θέσεις αξεσουάρ μαλλιών: αριστερά, δεξιά, κορυφή. */
    accL?: Pt;
    accR?: Pt;
    accTop?: Pt;
  };
}

export type AccessorySlot = 'accL' | 'accR' | 'accTop';
export const ACCESSORY_SLOTS: AccessorySlot[] = ['accL', 'accR', 'accTop'];

export type HairColor = 'blonde' | 'brunette' | 'red' | 'black';

/** Ρυθμίσεις ανάμειξης ανά τόνο δέρματος (σκουρότερο δέρμα → λιγότερο multiply). */
export interface SkinTuning {
  multiply: number;
  color: number;
  screen: number;
}

export interface Face {
  id: FaceId;
  nameEl: string;
  hair: HairColor;
  skinTone: string;
  hairTone: string;
  /** 5 αποχρώσεις foundation γύρω από τον τόνο του δέρματος. */
  foundationShades: string[];
  tuning: SkinTuning;
  /** URLs ανά έκφραση· κενό = σχεδιάζεται placeholder από τα πολύγωνα. */
  images: Partial<Record<Expression, string>>;
  /** Ξεχωριστό επίπεδο μαλλιών (RGBA, ίδιο σε όλες τις εκφράσεις)· βλ. tools/hair_layer.py. */
  hairUrl?: string;
  regions: RegionMap;
}
