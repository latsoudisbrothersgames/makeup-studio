import type { Cosmetic } from '../types/cosmetic';
import type { Expression, Face, Pt, RegionId } from '../types/face';
import { centroid, distToPolyline, MIRROR, pointInPolygon, polyBBox } from './geometry';
import { getRegion } from './regions';
import { hairCentroid, hairHit } from './hairMask';
import { ACCESSORY_SLOTS, slotsFor } from '../data/accessories';

/** Μέγιστη απόσταση (σε μονάδες προσώπου 512) από το κέντρο θέσης αξεσουάρ για να «κουμπώσει». */
const ACCESSORY_SNAP_RADIUS = 120;

export type DropResolution =
  | { ok: true; regionIds: RegionId[]; anchor: Pt }
  | { ok: false };

function hitsRegion(face: Face, expr: Expression, id: RegionId, p: Pt, tolerance: number): boolean {
  const r = getRegion(face.regions, expr, id);
  if (r.points.length < 2) return false;
  if (r.kind === 'polyline') return distToPolyline(p, r.points) <= tolerance + 6;
  if (pointInPolygon(p, r.points)) return true;
  if (tolerance <= 0) return false;
  const bb = polyBBox(r.points);
  const [cx, cy] = centroid(r.points);
  // Ελλειπτική ανοχή γύρω από το κέντρο: κουμπώνει και λίγο έξω από την περιοχή.
  const dx = (p[0] - cx) / (bb.w / 2 + tolerance);
  const dy = (p[1] - cy) / (bb.h / 2 + tolerance);
  return dx * dx + dy * dy <= 1;
}

/** Ποιες περιοχές να φωτίζονται όσο σέρνεται ένα καλλυντικό. */
export function candidateRegions(face: Face, expr: Expression, cosmetic: Cosmetic, variant?: string): RegionId[] {
  const t = cosmetic.target;
  if (cosmetic.category === 'accessory') return slotsFor(variant);
  if (t.kind === 'regions') return t.regions.filter((id) => getRegion(face.regions, expr, id).points.length >= 2);
  if (t.kind === 'face') return ['faceBox'];
  if (t.kind === 'hair') return ['hair'];
  if (t.kind === 'any') return ['skin', 'hair'];
  // Ελεύθερη τοποθέτηση: κανένα περίγραμμα — μόνο το σημάδι στόχου κάτω από το δάχτυλο (overlay.marker).
  return [];
}

/** Τι θα ζωγραφιστεί όταν το παιδί αφήσει το καλλυντικό στο σημείο p. */
export function resolveDrop(face: Face, expr: Expression, cosmetic: Cosmetic, p: Pt, variant?: string): DropResolution {
  const t = cosmetic.target;
  // Αξεσουάρ: κουμπώνει στην ΠΛΗΣΙΕΣΤΕΡΗ επιτρεπτή θέση αν αφεθεί οπουδήποτε κοντά στο κεφάλι
  // (πάνω στα μαλλιά ή έως ~120 μονάδες από μια θέση). Οι θέσεις είναι μικροί κύκλοι· σε κινητό,
  // κάτω από το δάχτυλο, ήταν πολύ δύσκολο να πετύχεις τους πλαϊνούς.
  if (cosmetic.category === 'accessory') {
    const slots = slotsFor(variant).filter((id) => getRegion(face.regions, expr, id).points.length >= 3);
    let best: { id: RegionId; d: number; c: Pt } | null = null;
    for (const id of slots) {
      const c = centroid(getRegion(face.regions, expr, id).points);
      const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
      if (!best || d < best.d) best = { id, d, c };
    }
    if (!best) return { ok: false };
    const nearHead = best.d <= ACCESSORY_SNAP_RADIUS || hairHit(face.id, p, 24);
    if (!nearHead) return { ok: false };
    return { ok: true, regionIds: [best.id], anchor: best.c };
  }
  if (t.kind === 'regions') {
    const regions = t.regions;
    for (const id of regions) {
      if (!hitsRegion(face, expr, id, p, 24)) continue;
      const ids: RegionId[] = [id];
      const twin = MIRROR[id];
      if (t.mirror && twin && t.regions.includes(twin)) ids.push(twin);
      // Το άιλάινερ/μάσκαρα στοχεύει τη γραμμή βλεφαρίδων ακόμη κι αν χτυπήσει βλέφαρο/μάτι.
      const remapped = ids.map((r) => remapToLash(cosmetic, r));
      const [ax, ay] = centroid(getRegion(face.regions, expr, remapped[0]).points);
      return { ok: true, regionIds: dedupe(remapped), anchor: [ax, ay] };
    }
    return { ok: false };
  }
  if (t.kind === 'face') {
    if (!hitsRegion(face, expr, 'skin', p, 30)) return { ok: false };
    const [ax, ay] = centroid(getRegion(face.regions, expr, 'skin').points);
    return { ok: true, regionIds: ['skin'], anchor: [ax, ay] };
  }
  if (t.kind === 'any') {
    if (hairHit(face.id, p, 22)) return { ok: true, regionIds: [], anchor: [Math.round(p[0]), Math.round(p[1])] };
    const skinAny = getRegion(face.regions, expr, 'skin').points;
    if (!nearPolygon(p, skinAny, FREE_TOLERANCE)) return { ok: false };
    return { ok: true, regionIds: [], anchor: clampIntoPolygon(p, skinAny) };
  }
  if (t.kind === 'hair') {
    if (!hairHit(face.id, p, 22)) return { ok: false };
    return { ok: true, regionIds: ['hair'], anchor: hairCentroid(face.id) };
  }
  // Αυτοκόλλητο πάνω σε θέση αξεσουάρ → διακοσμητικό (βλ. decorateAccessory).
  if (cosmetic.category === 'sticker') {
    for (const id of ACCESSORY_SLOTS) {
      if (hitsRegion(face, expr, id, p, 8)) return { ok: true, regionIds: [id], anchor: centroid(getRegion(face.regions, expr, id).points) };
    }
  }
  // Ελεύθερη τοποθέτηση (γκλίτερ, αυτοκόλλητα, ελιά): με ανοχή — λίγο έξω από το πρόσωπο κουμπώνει μέσα.
  // Σε κινητό (μικρό πρόσωπο, φάντασμα ανασηκωμένο) η ακριβής ρίψη μέσα στο δέρμα ήταν δύσκολη.
  const skin = getRegion(face.regions, expr, 'skin').points;
  if (!nearPolygon(p, skin, FREE_TOLERANCE)) return { ok: false };
  return { ok: true, regionIds: [], anchor: clampIntoPolygon(p, skin) };
}

/** Ανοχή (μονάδες προσώπου) για ελεύθερη τοποθέτηση: λίγο έξω από το δέρμα → κουμπώνει στο πλησιέστερο σημείο μέσα. */
const FREE_TOLERANCE = 34;

/** Μέσα στο πολύγωνο ή έως `tol` μονάδες από το περίγραμμά του (πραγματική απόσταση, όχι έλλειψη). */
function nearPolygon(p: Pt, poly: Pt[], tol: number): boolean {
  if (pointInPolygon(p, poly)) return true;
  return distToPolyline(p, [...poly, poly[0]]) <= tol;
}

/** Αν το p είναι έξω από το πολύγωνο, το φέρνει μέσα κατά μήκος της ευθείας προς το κέντρο (δυαδική αναζήτηση). */
function clampIntoPolygon(p: Pt, poly: Pt[]): Pt {
  if (pointInPolygon(p, poly)) return p;
  const c = centroid(poly);
  let lo = 0, hi = 1; // 0 = p (έξω), 1 = c (μέσα)
  for (let i = 0; i < 14; i++) {
    const m = (lo + hi) / 2;
    const q: Pt = [p[0] + (c[0] - p[0]) * m, p[1] + (c[1] - p[1]) * m];
    if (pointInPolygon(q, poly)) hi = m; else lo = m;
  }
  const t = Math.min(1, hi + 0.04); // λίγο πιο μέσα από το όριο
  return [Math.round(p[0] + (c[0] - p[0]) * t), Math.round(p[1] + (c[1] - p[1]) * t)];
}

function remapToLash(cosmetic: Cosmetic, id: RegionId): RegionId {
  if (cosmetic.category !== 'eyeliner' && cosmetic.category !== 'mascara') return id;
  if (id === 'lidL' || id === 'eyeHoleL') return 'lashL';
  if (id === 'lidR' || id === 'eyeHoleR') return 'lashR';
  return id;
}

function dedupe<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}
