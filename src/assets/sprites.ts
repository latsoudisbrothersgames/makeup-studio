import { stickerUrls } from './index';
import { loadImage } from '../engine/canvas';
import type { SpriteMap } from '../engine/compositor';

let spriteCache: Promise<SpriteMap> | null = null;

/** Φορτώνει μία φορά τα sprites των αυτοκόλλητων (κοινό για στούντιο και παιχνίδι). */
export function loadSprites(): Promise<SpriteMap> {
  if (!spriteCache) {
    spriteCache = (async () => {
      const out: SpriteMap = {};
      for (const [name, url] of Object.entries(stickerUrls())) {
        try { out[name] = await loadImage(url); } catch { /* παραλείπεται */ }
      }
      return out;
    })();
  }
  return spriteCache;
}
