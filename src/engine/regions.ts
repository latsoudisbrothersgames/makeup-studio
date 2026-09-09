import type { Expression, Face, Poly, Region, RegionId, RegionMap } from '../types/face';
import { REGION_IDS } from '../types/face';

/** Η περιοχή για μια έκφραση: παραλλαγή αν υπάρχει, αλλιώς η ουδέτερη. */
export function getRegion(map: RegionMap, expr: Expression, id: RegionId): Region {
  return map.variants[expr]?.[id] ?? map.regions[id];
}

export function getPoints(face: Face, expr: Expression, id: RegionId): Poly {
  return getRegion(face.regions, expr, id).points;
}

export function resolveRegions(map: RegionMap, expr: Expression): Record<RegionId, Region> {
  const out = { ...map.regions };
  const v = map.variants[expr];
  if (v) for (const k of Object.keys(v) as RegionId[]) out[k] = v[k]!;
  return out;
}

export function validateRegionMap(v: unknown): v is RegionMap {
  if (!v || typeof v !== 'object') return false;
  const m = v as RegionMap;
  if (m.size !== 512 || !m.regions || typeof m.regions !== 'object') return false;
  for (const id of REGION_IDS) {
    const r = m.regions[id];
    if (!r) {
      // Νεότερες περιοχές (π.χ. hair, hairStreak) μπορεί να λείπουν από παλιό JSON → κενό πολύγωνο.
      m.regions[id] = { id, kind: 'polygon', points: [] };
      continue;
    }
    if (!Array.isArray(r.points)) return false;
  }
  return !!m.anchors && Array.isArray(m.anchors.lipHighlight);
}
