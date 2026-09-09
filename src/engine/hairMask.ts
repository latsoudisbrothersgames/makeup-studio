import type { FaceId, Pt } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';

/**
 * Μητρώο των pixel των μαλλιών ανά πρόσωπο (από το hair.png). Χρησιμεύει ως στόχος drop
 * («Άφησε τη βαφή στα μαλλιά») και για το περίγραμμα-υπόδειξη στο overlay. Ένα μόνο πολύγωνο
 * δεν αρκεί εδώ: τα μαλλιά περιβάλλουν το πρόσωπο (σχήμα με τρύπα), οπότε δουλεύουμε με το alpha.
 */
interface HairEntry {
  alpha: Uint8Array;
  centroid: Pt;
  outline: HTMLCanvasElement;
  image: CanvasImageSource;
}

const registry = new Map<string, HairEntry>();
const active = new Map<FaceId, string>();

export const ORIGINAL_STYLE = 'original';

/** Ποιο χτένισμα φοράει τώρα το πρόσωπο (το ορίζει ο compositor του παίκτη σε κάθε απόδοση). */
export function activateHairStyle(faceId: FaceId, style: string): void {
  active.set(faceId, style);
}
export function activeHairStyle(faceId: FaceId): string {
  return active.get(faceId) ?? ORIGINAL_STYLE;
}
function entry(faceId: FaceId): HairEntry | undefined {
  return registry.get(`${faceId}:${activeHairStyle(faceId)}`) ?? registry.get(`${faceId}:${ORIGINAL_STYLE}`);
}

export function registerHairImage(faceId: FaceId, img: CanvasImageSource, style: string = ORIGINAL_STYLE): void {
  const c = makeCanvas(512, 512);
  const ctx = ctx2d(c);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, 512, 512).data;
  const alpha = new Uint8Array(512 * 512);
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < alpha.length; i++) {
    const a = data[i * 4 + 3];
    alpha[i] = a;
    if (a > 0) {
      sx += i % 512;
      sy += (i / 512) | 0;
      n++;
    }
  }
  registry.set(`${faceId}:${style}`, {
    alpha,
    centroid: n ? [sx / n, sy / n] : [256, 100],
    outline: silhouetteOutline(c),
    image: img,
  });
}

export function hasHair(faceId: FaceId): boolean {
  return !!entry(faceId);
}

export function hairImage(faceId: FaceId): CanvasImageSource | undefined {
  return entry(faceId)?.image;
}

export function hairCentroid(faceId: FaceId): Pt {
  return entry(faceId)?.centroid ?? [256, 100];
}

/** Υπάρχουν μαλλιά μέσα σε ακτίνα `tol` γύρω από το σημείο (χώρος 512); */
export function hairHit(faceId: FaceId, [px, py]: Pt, tol: number): boolean {
  const e = entry(faceId);
  if (!e) return false;
  const x0 = Math.max(0, Math.floor(px - tol)), x1 = Math.min(511, Math.ceil(px + tol));
  const y0 = Math.max(0, Math.floor(py - tol)), y1 = Math.min(511, Math.ceil(py + tol));
  const t2 = tol * tol;
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const dx = x - px, dy = y - py;
      if (dx * dx + dy * dy <= t2 && e.alpha[y * 512 + x] > 0) return true;
    }
  }
  return false;
}

/** Λευκό περίγραμμα 2px γύρω από τη σιλουέτα των μαλλιών, για το overlay. */
export function hairOutline(faceId: FaceId): HTMLCanvasElement | undefined {
  return entry(faceId)?.outline;
}

function silhouetteOutline(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(512, 512);
  const ctx = ctx2d(c);
  // Σιλουέτα σε 8 μετατοπίσεις μείον η ίδια η σιλουέτα = δακτύλιος πλάτους 2px.
  const sil = makeCanvas(512, 512);
  const sc = ctx2d(sil);
  sc.drawImage(src, 0, 0);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = '#fff';
  sc.fillRect(0, 0, 512, 512);
  for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2]]) {
    ctx.drawImage(sil, dx, dy);
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(sil, 0, 0);
  return c;
}
