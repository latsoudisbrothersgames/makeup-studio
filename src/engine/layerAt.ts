import type { AppliedLayer } from '../types/cosmetic';
import type { Expression, Face, Pt } from '../types/face';
import { distToPolyline, pointInPolygon } from './geometry';
import { hairHit } from './hairMask';
import { getRegion } from './regions';

/**
 * Βαμβάκι ντεμακιγιάζ: ποιο στρώμα καλύπτει το σημείο; Το πιο ΠΡΟΣΦΑΤΑ εφαρμοσμένο κερδίζει
 * (όχι το πιο πάνω στη σειρά σχεδίασης) — «σβήνει το τελευταίο προϊόν που έβαλες εκεί».
 */
export function layerAt(face: Face, expr: Expression, layers: AppliedLayer[], pt: Pt): AppliedLayer | undefined {
  const covers = (l: AppliedLayer): boolean => {
    if (l.category === 'remover') return false;
    if (l.category === 'hairColor') return hairHit(face.id, pt, 6);
    if (l.category === 'hairStreak') return hairHit(face.id, pt, 6) && pointInPolygon(pt, getRegion(face.regions, 'neutral', 'hairStreak').points);
    if (l.at) return Math.hypot(l.at[0] - pt[0], l.at[1] - pt[1]) <= 28;
    for (const id of l.regionIds) {
      const r = getRegion(face.regions, expr, id);
      if (r.points.length < 2) continue;
      if (r.kind === 'polyline' ? distToPolyline(pt, r.points) <= 14 : pointInPolygon(pt, r.points)) return true;
    }
    return false;
  };
  for (let i = layers.length - 1; i >= 0; i--) if (covers(layers[i])) return layers[i];
  return undefined;
}
