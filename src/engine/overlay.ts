import type { Expression, Face, RegionId } from '../types/face';
import type { Particle } from './animator';
import { polyPath, polylinePath } from './geometry';
import { getRegion } from './regions';
import { hairOutline } from './hairMask';

export interface OverlayState {
  /** Περιοχές-υποψήφιες (διακεκομμένο περίγραμμα). */
  hints: RegionId[];
  /** Περιοχή που «ακούει» τώρα (λαμπερό περίγραμμα). */
  glow: RegionId[];
  particles: Particle[];
}

/** Ζωγραφίζει τα βοηθήματα του drag και τους σπινθήρες σε καμβά 512 πάνω από το πρόσωπο. */
export function drawOverlay(ctx: CanvasRenderingContext2D, face: Face, expr: Expression, s: OverlayState): void {
  ctx.clearRect(0, 0, 512, 512);
  const pathOf = (id: RegionId): Path2D | null => {
    const r = getRegion(face.regions, expr, id);
    if (r.points.length < 2) return null;
    return r.kind === 'polyline' ? polylinePath(r.points) : polyPath(r.points);
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const hair = hairOutline(face.id);
  for (const id of s.hints) {
    if (s.glow.includes(id)) continue;
    if (id === 'hair') {
      if (hair) { ctx.globalAlpha = 0.85; ctx.drawImage(hair, 0, 0); ctx.globalAlpha = 1; }
      continue;
    }
    const p = pathOf(id);
    if (!p) continue;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke(p);
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(90,58,94,0.6)';
    ctx.stroke(p);
  }
  for (const id of s.glow) {
    if (id === 'hair') {
      if (hair) {
        ctx.save();
        ctx.shadowColor = '#fff2a8';
        ctx.shadowBlur = 14;
        ctx.drawImage(hair, 0, 0);
        ctx.restore();
      }
      continue;
    }
    const p = pathOf(id);
    if (!p) continue;
    ctx.save();
    ctx.shadowColor = '#fff2a8';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffd54f';
    ctx.stroke(p);
    ctx.restore();
    const r = getRegion(face.regions, expr, id);
    if (r.kind === 'polygon') {
      ctx.fillStyle = 'rgba(255,240,150,0.28)';
      ctx.fill(p);
    }
  }
  for (const pt of s.particles) {
    const a = 1 - pt.life / pt.max;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = pt.color;
    const x = Math.round(pt.x), y = Math.round(pt.y), r = pt.size;
    ctx.fillRect(x - r, y, r * 2 + 1, 1);
    ctx.fillRect(x, y - r, 1, r * 2 + 1);
    if (r > 2) ctx.fillRect(x - 1, y - 1, 3, 3);
  }
  ctx.globalAlpha = 1;
}
