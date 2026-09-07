import type { Poly } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';
import { expandBBox, polyBBox, tracePoly, type BBox } from './geometry';

/** Μια μάσκα: μαύρο alpha μέσα στο bbox της (x,y) στον χώρο 512. */
export interface MaskBitmap extends BBox {
  canvas: HTMLCanvasElement;
}

/**
 * Φτερωτή μάσκα πολυγώνου. Χρησιμοποιεί το κόλπο του shadowBlur (δουλεύει και σε iOS Safari,
 * όπου το ctx.filter δεν είναι αξιόπιστο): σχεδιάζουμε το σχήμα εκτός καμβά και κρατάμε μόνο
 * τη θολή σκιά του.
 */
export function featheredMask(poly: Poly, feather: number): MaskBitmap {
  const bb = expandBBox(polyBBox(poly), feather * 2 + 1);
  const c = makeCanvas(bb.w, bb.h);
  const ctx = ctx2d(c);
  if (poly.length < 3) return { canvas: c, ...bb };
  if (feather <= 0) {
    ctx.fillStyle = '#000';
    tracePoly(ctx, poly, bb.x, bb.y);
    ctx.fill();
    return { canvas: c, ...bb };
  }
  const OFF = 4000;
  ctx.shadowColor = '#000';
  ctx.shadowBlur = feather;
  ctx.shadowOffsetX = OFF;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#000';
  tracePoly(ctx, poly, bb.x + OFF, bb.y);
  ctx.fill();
  // Δεύτερο πέρασμα για πιο «γεμάτο» κέντρο (η σκιά μόνη της είναι αχνή στην άκρη).
  ctx.fill();
  return { canvas: c, ...bb };
}

/** Αφαιρεί «τρύπες» (destination-out) από μια μάσκα. */
export function cutHoles(mask: MaskBitmap, holes: Poly[], feather: number): void {
  const ctx = ctx2d(mask.canvas);
  ctx.globalCompositeOperation = 'destination-out';
  for (const h of holes) {
    if (h.length < 3) continue;
    const hm = featheredMask(h, feather);
    ctx.drawImage(hm.canvas, hm.x - mask.x, hm.y - mask.y);
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Κρατά από τη μάσκα μόνο ό,τι πέφτει μέσα στη μάσκα clip (destination-in). */
export function clipMask(mask: MaskBitmap, clip: MaskBitmap): void {
  const ctx = ctx2d(mask.canvas);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(clip.canvas, clip.x - mask.x, clip.y - mask.y);
  ctx.globalCompositeOperation = 'source-over';
}
