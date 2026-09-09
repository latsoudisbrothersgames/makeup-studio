import type { AppliedLayer, Cosmetic, CosmeticCategory } from '../types/cosmetic';
import type { Expression, Face, RegionId } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';
import { featheredMask, type MaskBitmap } from './masks';
import { RECIPES, type Pass, type RecipeEnv } from './recipes';
import { getPoints } from './regions';
import { composeHair } from './hairColor';
import { activateHairStyle, ORIGINAL_STYLE } from './hairMask';

export type SpriteMap = Record<string, HTMLImageElement>;
export type FaceImages = Record<Expression, CanvasImageSource> & {
  /** Επίπεδο μαλλιών: σχεδιάζεται ΠΑΝΩ από όλο το μακιγιάζ ώστε οι τούφες να καλύπτουν μάσκα, μπογιές κ.λπ. */
  hair?: CanvasImageSource;
  /** Εναλλακτικά χτενίσματα: βάση ανά έκφραση (χωρίς τα παλιά μαλλιά) + το δικό τους επίπεδο μαλλιών. */
  styles?: Record<string, Partial<Record<Expression, CanvasImageSource>> & { hair?: CanvasImageSource }>;
};

/** Σειρά σχεδίασης: zRank, μετά σειρά εφαρμογής. */
export function sortLayers(layers: AppliedLayer[], catalogue: Record<CosmeticCategory, Cosmetic>): AppliedLayer[] {
  return layers
    .map((l, i) => ({ l, i, z: catalogue[l.category].zRank }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((x) => x.l);
}

/**
 * Συνθέτει βάση (ανά έκφραση) + στρώματα μακιγιάζ σε έναν καμβά 512×512.
 * Τα περάσματα κάθε στρώματος υπολογίζονται μία φορά ανά (στρώμα, έκφραση) και αποθηκεύονται.
 */
export class Compositor {
  readonly out = makeCanvas(512, 512);
  private readonly ctx = ctx2d(this.out);
  private readonly maskCache = new Map<string, MaskBitmap>();
  private readonly passCache = new Map<string, Pass[]>();
  private readonly frameCache = new Map<Expression, HTMLCanvasElement>();
  private readonly hairCache = new Map<string, CanvasImageSource>();
  private frameKey = '';
  readonly face: Face;
  private readonly images: FaceImages;
  private readonly catalogue: Record<CosmeticCategory, Cosmetic>;
  private readonly sprites: SpriteMap;

  /** false για τον compositor του «στόχου» στο παιχνίδι: δεν αλλάζει το ενεργό χτένισμα του hit-test. */
  private readonly trackStyle: boolean;

  constructor(face: Face, images: FaceImages, catalogue: Record<CosmeticCategory, Cosmetic>, sprites: SpriteMap = {}, trackStyle = true) {
    this.face = face;
    this.images = images;
    this.catalogue = catalogue;
    this.sprites = sprites;
    this.trackStyle = trackStyle;
  }

  /** Το χτένισμα από το τελευταίο στρώμα 'hairstyle' (αν υπάρχουν εικόνες του), αλλιώς το αρχικό. */
  styleOf(layers: AppliedLayer[]): string {
    let st = ORIGINAL_STYLE;
    for (const l of layers) if (l.category === 'hairstyle' && l.variant) st = l.variant;
    return st !== ORIGINAL_STYLE && this.images.styles?.[st] ? st : ORIGINAL_STYLE;
  }

  /** Σημεία περιοχής με παραλλαγή χτενίσματος (π.χ. τούφα του καρέ). */
  private stylePoints(expr: Expression, id: RegionId, style: string) {
    const o = style !== ORIGINAL_STYLE ? this.face.regions.styleRegions?.[style]?.[id] : undefined;
    return o ? o.points : getPoints(this.face, expr, id);
  }

  private env(expr: Expression): RecipeEnv {
    const face = this.face;
    const mask = (id: RegionId, feather: number): MaskBitmap => {
      const key = `${expr}|${id}|${feather}`;
      let m = this.maskCache.get(key);
      if (!m) {
        m = featheredMask(getPoints(face, expr, id), feather);
        this.maskCache.set(key, m);
      }
      return m;
    };
    return {
      face,
      expr,
      points: (id) => getPoints(face, expr, id),
      mask,
      skinMask: () => mask('skin', 2),
      sprite: (name) => this.sprites[name],
    };
  }

  private passesFor(layer: AppliedLayer, expr: Expression): Pass[] {
    const key = `${layer.id}|${expr}`;
    let p = this.passCache.get(key);
    if (!p) {
      const cosmetic = this.catalogue[layer.category];
      try {
        p = RECIPES[layer.category](layer, cosmetic, this.env(expr));
      } catch (e) {
        console.error('recipe failed', layer.category, e);
        p = [];
      }
      if (this.passCache.size > 400) this.passCache.clear();
      this.passCache.set(key, p);
    }
    return p;
  }

  private sorted(layers: AppliedLayer[]): AppliedLayer[] {
    return sortLayers(layers, this.catalogue);
  }

  /** Αποδίδει στο `out`. `pulse` = πολλαπλασιαστής alpha για τα περάσματα με pulse (ρουζ). */
  render(expr: Expression, layers: AppliedLayer[], pulse = 1): HTMLCanvasElement {
    const style = this.styleOf(layers);
    if (this.trackStyle) activateHairStyle(this.face.id, style);
    const key = layers.map((l) => l.id).join(',');
    if (key !== this.frameKey) {
      this.frameCache.clear();
      this.frameKey = key;
    }
    const cached = pulse === 1 ? this.frameCache.get(expr) : undefined;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (cached) {
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(cached, 0, 0);
      return this.out;
    }
    ctx.clearRect(0, 0, 512, 512);
    const base = (style !== ORIGINAL_STYLE && this.images.styles?.[style]?.[expr]) || this.images[expr];
    ctx.drawImage(base, 0, 0);
    const aboveHair: Pass[] = [];
    for (const layer of this.sorted(layers)) {
      for (const p of this.passesFor(layer, expr)) {
        if (p.aboveHair) { aboveHair.push(p); continue; }
        ctx.globalCompositeOperation = p.blend;
        ctx.globalAlpha = Math.min(1, p.alpha * (p.pulse ? pulse : 1));
        ctx.drawImage(p.canvas, p.x, p.y);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const hair = this.hairImage(layers, style);
    if (hair) ctx.drawImage(hair, 0, 0);
    for (const p of aboveHair) {
      ctx.globalCompositeOperation = p.blend;
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(p.canvas, p.x, p.y);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (pulse === 1) {
      const snap = makeCanvas(512, 512);
      ctx2d(snap).drawImage(this.out, 0, 0);
      this.frameCache.set(expr, snap);
    }
    return this.out;
  }

  /** Το επίπεδο μαλλιών όπως θα σχεδιαστεί: αρχικό ή βαμμένο (χρώμα + τούφα), με cache ανά συνδυασμό. */
  private hairImage(layers: AppliedLayer[], style: string): CanvasImageSource | undefined {
    const src = (style !== ORIGINAL_STYLE ? this.images.styles?.[style]?.hair : undefined) ?? this.images.hair;
    if (!src) return undefined;
    let base: string | null = null, streak: string | null = null;
    for (const l of layers) {
      if (l.category === 'hairColor') base = l.color;
      else if (l.category === 'hairStreak') streak = l.color;
    }
    if (!base && !streak) return src;
    const key = `${style}|${base ?? ''}|${streak ?? ''}`;
    let out = this.hairCache.get(key);
    if (!out) {
      out = composeHair(src, base, streak, this.stylePoints('neutral', 'hairStreak', style));
      if (this.hairCache.size > 24) this.hairCache.clear();
      this.hairCache.set(key, out);
    }
    return out;
  }

  /** Προθέρμανση των περασμάτων ενός στρώματος για τις άλλες εκφράσεις (σε idle χρόνο). */
  prewarm(layer: AppliedLayer, exprs: Expression[]): void {
    const run = () => exprs.forEach((e) => this.passesFor(layer, e));
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    if (ric) ric(run);
    else setTimeout(run, 0);
  }

  invalidate(): void {
    this.passCache.clear();
    this.frameCache.clear();
    this.frameKey = '';
  }
}
