import type { Face, FaceId, RegionMap } from '../types/face';
import { buildRegionMap, DEFAULT_PARAMS } from './faces/defaultRegions';
import { validateRegionMap } from '../engine/regions';

/** Χειροκίνητα JSON περιοχών ανά πρόσωπο (όταν υπάρχουν) — αλλιώς ο παραμετρικός χάρτης. */
const regionFiles = import.meta.glob('./faces/*.regions.json', { eager: true, import: 'default' }) as Record<string, unknown>;
/** Εικόνες PixelLab ανά πρόσωπο/έκφραση: src/assets/faces/f1/neutral.png κ.λπ. */
const faceImages = import.meta.glob('../assets/faces/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
/** Χτενίσματα: src/assets/faces/f1/styles/bob/{neutral,blink,smile,wow,hair}.png */
const styleImages = import.meta.glob('../assets/faces/*/styles/*/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function regionsFor(id: FaceId): RegionMap {
  const json = regionFiles[`./faces/${id}.regions.json`];
  if (json && validateRegionMap(json)) return json;
  return buildRegionMap(DEFAULT_PARAMS);
}

function hairFor(id: FaceId): string | undefined {
  return faceImages[`../assets/faces/${id}/hair.png`];
}

function stylesFor(id: FaceId): Face['styles'] {
  const out: NonNullable<Face['styles']> = {};
  for (const [path, url] of Object.entries(styleImages)) {
    const m = path.match(/\/faces\/([^/]+)\/styles\/([^/]+)\/(neutral|blink|smile|wow|hair)\.png$/);
    if (!m || m[1] !== id) continue;
    const st = (out[m[2]] ??= { images: {} });
    if (m[3] === 'hair') st.hairUrl = url;
    else st.images[m[3] as keyof Face['images']] = url;
  }
  return Object.keys(out).length ? out : undefined;
}

function imagesFor(id: FaceId): Face['images'] {
  const out: Face['images'] = {};
  for (const [path, url] of Object.entries(faceImages)) {
    const m = path.match(/\/faces\/([^/]+)\/(neutral|blink|smile|wow)\.png$/);
    if (m && m[1] === id) out[m[2] as keyof Face['images']] = url;
  }
  return out;
}

function shades(hex: string): string[] {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number, k: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  const to = (k: number) => '#' + [f(r, k), f(g, k), f(b, k)].map((v) => v.toString(16).padStart(2, '0')).join('');
  return [to(1.12), to(1.06), hex, to(0.94), to(0.86)];
}

const BASE: Omit<Face, 'regions' | 'images' | 'hairUrl' | 'styles' | 'foundationShades'>[] = [
  { id: 'f1', nameEl: 'Ελένη', hair: 'blonde', skinTone: '#f1d6c0', hairTone: '#e8c36a', tuning: { multiply: 1, color: 1, screen: 1 } },
  { id: 'f2', nameEl: 'Μαρία', hair: 'brunette', skinTone: '#d8a882', hairTone: '#4a2e1e', tuning: { multiply: 0.95, color: 1.05, screen: 1.05 } },
  { id: 'f3', nameEl: 'Άννα', hair: 'red', skinTone: '#f4dccb', hairTone: '#c4552a', tuning: { multiply: 1, color: 1, screen: 1 } },
  { id: 'f4', nameEl: 'Σοφία', hair: 'black', skinTone: '#8e5a3c', hairTone: '#161214', tuning: { multiply: 0.7, color: 1.3, screen: 1.35 } },
];

export const FACES: Face[] = BASE.map((b) => ({
  ...b,
  foundationShades: shades(b.skinTone),
  images: imagesFor(b.id),
  hairUrl: hairFor(b.id),
  styles: stylesFor(b.id),
  regions: regionsFor(b.id),
}));

export function faceById(id: string | undefined | null): Face | undefined {
  return FACES.find((f) => f.id === id);
}

export function isFaceId(v: unknown): v is FaceId {
  return typeof v === 'string' && FACES.some((f) => f.id === v);
}
