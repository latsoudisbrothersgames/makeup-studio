import { makeCanvas, ctx2d } from './canvas';

/** Φόντα «Φωτογράφισε τη δημιουργία μου»: όλα ζωγραφίζονται με κώδικα. */
export type PhotoBg = 'plain' | 'dots' | 'white';
export const PHOTO_BGS: PhotoBg[] = ['plain', 'dots', 'white'];

export const PHOTO_W = 1024;
export const PHOTO_H = 1180;

function paintBackground(ctx: CanvasRenderingContext2D, bg: PhotoBg): void {
  if (bg === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, PHOTO_H);
  g.addColorStop(0, '#ffe3ee');
  g.addColorStop(1, '#e8e4ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  if (bg === 'dots') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let y = 24; y < PHOTO_H; y += 56) {
      for (let x = ((y / 56) | 0) % 2 ? 52 : 24; x < PHOTO_W; x += 56) {
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Τελική εικόνα: φόντο + πρόσωπο 512→1024 (pixelated) + λεζάντα. Η βάση του προσώπου έχει
 * διαφανές φόντο, οπότε το φόντο φαίνεται γύρω του.
 */
export function renderPhoto(face: CanvasImageSource, bg: PhotoBg, caption: string, subcaption: string): HTMLCanvasElement {
  const c = makeCanvas(PHOTO_W, PHOTO_H);
  const ctx = ctx2d(c);
  paintBackground(ctx, bg);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(face, 0, 0, PHOTO_W, PHOTO_W);
  // Λεζάντα σε λευκή «πινακίδα».
  const bandY = PHOTO_W + 10;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, 40, bandY, PHOTO_W - 80, PHOTO_H - bandY - 20, 28);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#5a2a52';
  ctx.font = '700 46px Comfortaa, system-ui, sans-serif';
  ctx.fillText(caption, PHOTO_W / 2, bandY + 52, PHOTO_W - 140);
  ctx.fillStyle = '#e6417f';
  ctx.font = '700 28px Comfortaa, system-ui, sans-serif';
  ctx.fillText(subcaption, PHOTO_W / 2, bandY + 108, PHOTO_W - 140);
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

function toBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

/**
 * Παράδοση της εικόνας στο παιδί:
 *  - iPhone/iPad (και Android): Web Share API με αρχείο → φύλλο «Αποθήκευση εικόνας».
 *  - Desktop: λήψη αρχείου PNG.
 * Πρέπει να κληθεί από χειρονομία χρήστη (κλικ)· το toBlob κρατά τη χειρονομία ζωντανή.
 */
export async function sharePhoto(canvas: HTMLCanvasElement, filename: string, title: string): Promise<ShareResult> {
  const blob = await toBlob(canvas);
  if (!blob) return 'failed';
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  // Κοινοποίηση μόνο σε συσκευές αφής (iPhone/iPad/Android): στο desktop το Web Share ανοίγει
  // παράθυρο του λειτουργικού αντί για λήψη, και σε headless/δοκιμές κρεμάει.
  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent);
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (touchDevice && nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title });
      return 'shared';
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    // Συνέχεια με λήψη.
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
