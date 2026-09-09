import { useEffect, useState } from 'react';
import { makeCanvas, ctx2d } from '../engine/canvas';
import { ORIGINAL_STYLE } from '../engine/hairMask';
import type { Face } from '../types/face';
import { loadFaceImages } from './useFaceImages';

const cache = new Map<string, Record<string, string>>();

/**
 * Μικρογραφίες χτενισμάτων για το panel: κομμένο κεφάλι (χωρίς μακιγιάζ) ανά χτένισμα, ως data URL.
 * Μηδέν εικαστικά — φτιάχνονται από τις ίδιες εικόνες του προσώπου.
 */
export function useHairstyleThumbs(face: Face): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>(() => cache.get(face.id) ?? {});
  useEffect(() => {
    let alive = true;
    const hit = cache.get(face.id);
    if (hit) { setThumbs(hit); return; }
    void loadFaceImages(face).then((im) => {
      if (!alive) return;
      const out: Record<string, string> = {};
      const draw = (base: CanvasImageSource, hair?: CanvasImageSource) => {
        const c = makeCanvas(64, 64);
        const ctx = ctx2d(c);
        ctx.imageSmoothingEnabled = false;
        // Κεφάλι: χώρος 512, περιοχή x 96–416, y 0–320 → 64×64
        ctx.drawImage(base, 96, 0, 320, 320, 0, 0, 64, 64);
        if (hair) ctx.drawImage(hair, 96, 0, 320, 320, 0, 0, 64, 64);
        try { return c.toDataURL('image/png'); } catch { return ''; }
      };
      out[ORIGINAL_STYLE] = draw(im.neutral);
      for (const [id, st] of Object.entries(im.styles ?? {})) {
        if (st.neutral) out[id] = draw(st.neutral, st.hair);
      }
      cache.set(face.id, out);
      setThumbs(out);
    });
    return () => { alive = false; };
  }, [face]);
  return thumbs;
}
