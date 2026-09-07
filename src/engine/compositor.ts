import type { AppliedLayer, Cosmetic, CosmeticCategory } from '../types/cosmetic';
import type { Expression, Face, RegionId } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';
import { featheredMask, type MaskBitmap } from './masks';
import { RECIPES, type Pass, type RecipeEnv } from './recipes';
import { getPoints } from './regions';

export type SpriteMap = Record<string, HTMLImageElement>;
export type FaceImages = Record<Expression, CanvasImageSource>;

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
  private frameKey = '';
  readonly face: Face;
  private readonly images: FaceImages;
  private readonly catalogue: Record<CosmeticCategory, Cosmetic>;
  private readonly sprites: SpriteMap;

  constructor(face: Face, images: FaceImages, catalogue: Record<CosmeticCategory, Cosmetic>, sprites: SpriteMap = {}) {
    this.face = face;
    this.images = images;
    this.catalogue = catalogue;
    this.sprites = sprites;
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
    return layers
      .map((l, i) => ({ l, i, z: this.catalogue[l.category].zRank }))
      .sort((a, b) => a.z - b.z || a.i - b.i)
      .map((x) => x.l);
  }

  /** Αποδίδει στο `out`. `pulse` = πολλαπλασιαστής alpha για τα περάσματα με pulse (ρουζ). */
  render(expr: Expression, layers: AppliedLayer[], pulse = 1): HTMLCanvasElement {
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
    ctx.drawImage(this.images[expr], 0, 0);
    for (const layer of this.sorted(layers)) {
      for (const p of this.passesFor(layer, expr)) {
        ctx.globalCompositeOperation = p.blend;
        ctx.globalAlpha = Math.min(1, p.alpha * (p.pulse ? pulse : 1));
        ctx.drawImage(p.canvas, p.x, p.y);
      }
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
