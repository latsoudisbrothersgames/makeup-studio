import { useEffect, useState } from 'react';
import { loadImage } from '../engine/canvas';
import { drawPlaceholderFace } from '../engine/placeholderFace';
import type { FaceImages } from '../engine/compositor';
import { EXPRESSIONS, type Face } from '../types/face';

const cache = new Map<string, Promise<FaceImages>>();

/** Φορτώνει τα PNG του προσώπου ή σχεδιάζει placeholder από τα πολύγωνα. */
export function loadFaceImages(face: Face): Promise<FaceImages> {
  let p = cache.get(face.id);
  if (!p) {
    p = (async () => {
      const out = {} as FaceImages;
      for (const e of EXPRESSIONS) {
        const url = face.images[e] ?? face.images.neutral;
        if (url) {
          try {
            out[e] = await loadImage(url);
            continue;
          } catch (err) {
            console.warn(err);
          }
        }
        out[e] = drawPlaceholderFace(face, e);
      }
      return out;
    })();
    cache.set(face.id, p);
  }
  return p;
}

export function useFaceImages(face: Face | null): FaceImages | null {
  const [images, setImages] = useState<FaceImages | null>(null);
  useEffect(() => {
    let alive = true;
    setImages(null);
    if (!face) return;
    void loadFaceImages(face).then((im) => alive && setImages(im));
    return () => {
      alive = false;
    };
  }, [face]);
  return images;
}
