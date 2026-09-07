import type { Expression, Face } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';
import { centroid, ellipsePoly, polyBBox, tracePoly, tracePolyline } from './geometry';
import { resolveRegions } from './regions';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/**
 * Σχεδιάζει ένα απλό πρόσωπο 512×512 ΑΠΟ τα πολύγωνα των περιοχών, ώστε ο compositor και
 * το UI να χτιστούν πριν έρθουν τα PixelLab PNG. Ίδια γεωμετρία = μηδέν αλλαγές αργότερα.
 */
export function drawPlaceholderFace(face: Face, expr: Expression): HTMLCanvasElement {
  const c = makeCanvas(512, 512);
  const ctx = ctx2d(c);
  const R = resolveRegions(face.regions, expr);
  const skin = face.skinTone, hair = face.hairTone;
  const faceBB = polyBBox(R.skin.points);
  const [fcx, fcy] = centroid(R.skin.points);

  // Λαιμός + μπλούζα
  ctx.fillStyle = shade(skin, -18);
  ctx.fillRect(fcx - 46, fcy + faceBB.h * 0.42, 92, 90);
  ctx.fillStyle = '#cfe8ff';
  ctx.beginPath();
  ctx.moveTo(fcx - 190, 512); ctx.lineTo(fcx - 120, fcy + faceBB.h * 0.52); ctx.lineTo(fcx - 46, fcy + faceBB.h * 0.5);
  ctx.lineTo(fcx, fcy + faceBB.h * 0.56); ctx.lineTo(fcx + 46, fcy + faceBB.h * 0.5); ctx.lineTo(fcx + 120, fcy + faceBB.h * 0.52);
  ctx.lineTo(fcx + 190, 512); ctx.closePath(); ctx.fill();

  // Μαλλιά πίσω
  ctx.fillStyle = hair;
  tracePoly(ctx, ellipsePoly(fcx, fcy - 30, faceBB.w * 0.62, faceBB.h * 0.62, 36));
  ctx.fill();
  ctx.fillRect(fcx - faceBB.w * 0.62, fcy - 30, faceBB.w * 1.24, faceBB.h * 0.75);

  // Πρόσωπο με απαλή σκίαση
  const g = ctx.createRadialGradient(fcx - 40, fcy - 60, 20, fcx, fcy, faceBB.h * 0.62);
  g.addColorStop(0, shade(skin, 14));
  g.addColorStop(0.7, skin);
  g.addColorStop(1, shade(skin, -34));
  ctx.fillStyle = g;
  tracePoly(ctx, R.skin.points);
  ctx.fill();
  ctx.strokeStyle = shade(skin, -70);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Μαλλιά μπροστά (αφέλειες)
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(fcx - faceBB.w * 0.5, fcy - faceBB.h * 0.2);
  ctx.quadraticCurveTo(fcx - faceBB.w * 0.3, fcy - faceBB.h * 0.62, fcx + 10, fcy - faceBB.h * 0.42);
  ctx.quadraticCurveTo(fcx + faceBB.w * 0.35, fcy - faceBB.h * 0.6, fcx + faceBB.w * 0.5, fcy - faceBB.h * 0.2);
  ctx.quadraticCurveTo(fcx + faceBB.w * 0.3, fcy - faceBB.h * 0.42, fcx, fcy - faceBB.h * 0.36);
  ctx.quadraticCurveTo(fcx - faceBB.w * 0.3, fcy - faceBB.h * 0.42, fcx - faceBB.w * 0.5, fcy - faceBB.h * 0.2);
  ctx.fill();
  ctx.fillStyle = shade(hair, 26);
  ctx.beginPath();
  ctx.ellipse(fcx - 40, fcy - faceBB.h * 0.5, 40, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Μύτη
  ctx.strokeStyle = shade(skin, -40);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fcx - 4, fcy - 10); ctx.lineTo(fcx - 12, fcy + 34); ctx.quadraticCurveTo(fcx, fcy + 44, fcx + 12, fcy + 34);
  ctx.stroke();

  // Φρύδια
  ctx.fillStyle = shade(hair, -30);
  for (const id of ['browL', 'browR'] as const) { tracePoly(ctx, R[id].points); ctx.fill(); }

  // Μάτια
  for (const side of ['L', 'R'] as const) {
    const hole = R[`eyeHole${side}`].points;
    const lid = R[`lid${side}`].points;
    ctx.fillStyle = shade(skin, -6);
    tracePoly(ctx, lid); ctx.fill();
    if (hole.length >= 3) {
      const [ex, ey] = centroid(hole);
      const bb = polyBBox(hole);
      ctx.fillStyle = '#fbfbfb';
      tracePoly(ctx, hole); ctx.fill();
      ctx.save();
      tracePoly(ctx, hole); ctx.clip();
      ctx.fillStyle = face.hair === 'blonde' ? '#4a86c8' : face.hair === 'red' ? '#3f9a5a' : '#5a3a25';
      ctx.beginPath(); ctx.arc(ex, ey + 1, bb.h * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#151515';
      ctx.beginPath(); ctx.arc(ex, ey + 1, bb.h * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex - bb.h * 0.22, ey - bb.h * 0.2, bb.h * 0.14, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = shade(skin, -60);
      ctx.lineWidth = 1.5;
      tracePoly(ctx, hole); ctx.stroke();
    }
    // Γραμμή βλεφαρίδων
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    tracePolyline(ctx, R[`lash${side}`].points); ctx.stroke();
  }

  // Χείλη
  const lipBase = face.tuning.multiply < 1 ? shade(skin, -22) : shade(skin, -14);
  ctx.fillStyle = lipBase;
  tracePoly(ctx, R.lips.points); ctx.fill();
  ctx.strokeStyle = shade(skin, -55);
  ctx.lineWidth = 1.5;
  tracePoly(ctx, R.lips.points); ctx.stroke();
  if (R.mouthHole.points.length >= 3) {
    ctx.fillStyle = '#3a1a1e';
    tracePoly(ctx, R.mouthHole.points); ctx.fill();
  } else {
    // Γραμμή στόματος
    const bb = polyBBox(R.lips.points);
    ctx.strokeStyle = shade(skin, -60);
    ctx.beginPath();
    ctx.moveTo(bb.x + 4, bb.y + bb.h * 0.42);
    ctx.quadraticCurveTo(fcx, bb.y + bb.h * 0.5, bb.x + bb.w - 4, bb.y + bb.h * 0.42);
    ctx.stroke();
  }

  // «Pixel» υφή: ελαφρύ posterize για να μοιάζει με pixel art
  posterize(ctx, 512, 512, 24);
  return c;
}

function posterize(ctx: CanvasRenderingContext2D, w: number, h: number, levels: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const step = 256 / levels;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    d[i] = Math.round(Math.floor(d[i] / step) * step + step / 2);
    d[i + 1] = Math.round(Math.floor(d[i + 1] / step) * step + step / 2);
    d[i + 2] = Math.round(Math.floor(d[i + 2] / step) * step + step / 2);
  }
  ctx.putImageData(img, 0, 0);
}
