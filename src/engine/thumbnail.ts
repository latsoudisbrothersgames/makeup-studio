import { makeCanvas, ctx2d } from './canvas';

/** 128px PNG data URL από τον καμβά του προσώπου (λευκό φόντο, ομαλή σμίκρυνση). */
export function makeThumbnail(src: CanvasImageSource, size = 128): string {
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  ctx.fillStyle = '#fff5f9';
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, size, size);
  try {
    return c.toDataURL('image/png');
  } catch {
    return '';
  }
}
