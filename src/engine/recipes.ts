import type { AppliedLayer, Cosmetic } from '../types/cosmetic';
import type { Expression, Face, Poly, Pt, RegionId } from '../types/face';
import { makeCanvas, ctx2d } from './canvas';
import { centroid, expandBBox, makeRng, polyBBox, samplePolyline, tracePoly, tracePolyline, type BBox } from './geometry';
import { clipMask, cutHoles, featheredMask, type MaskBitmap } from './masks';
import { ACCESSORY_DRAW, TOP_SLOT_DY } from '../data/accessories';
import { rampFor, recolorImage } from './hairColor';

/** Ένα πέρασμα σύνθεσης: bitmap σε τοπικές συντεταγμένες bbox + τρόπος ανάμειξης. */
export interface Pass {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  blend: GlobalCompositeOperation;
  alpha: number;
  /** Συμμετέχει στον «παλμό» του ρουζ. */
  pulse?: boolean;
  /** Σχεδιάζεται ΠΑΝΩ από το επίπεδο μαλλιών (αξεσουάρ). */
  aboveHair?: boolean;
}

export interface RecipeEnv {
  face: Face;
  expr: Expression;
  points(id: RegionId): Poly;
  /** Φτερωτή μάσκα περιοχής (cache ανά έκφραση). Πάντα νέο αντίγραφο αν θα τροποποιηθεί. */
  mask(id: RegionId, feather: number): MaskBitmap;
  skinMask(): MaskBitmap;
  sprite(name: string): HTMLImageElement | undefined;
}

export type Recipe = (layer: AppliedLayer, cosmetic: Cosmetic, env: RecipeEnv) => Pass[];

// ───────────────────────────── helpers ─────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mix(hex: string, with_: string, t: number): string {
  const a = hexToRgb(hex), b = hexToRgb(with_);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function copyMask(m: MaskBitmap): MaskBitmap {
  const c = makeCanvas(m.w, m.h);
  ctx2d(c).drawImage(m.canvas, 0, 0);
  return { ...m, canvas: c };
}

/** Ζωγραφίζει μέσα στο bbox της μάσκας και κρατά μόνο ό,τι πέφτει στη μάσκα. */
function paintMasked(
  mask: MaskBitmap,
  paint: (ctx: CanvasRenderingContext2D, bb: BBox) => void,
  blend: GlobalCompositeOperation,
  alpha: number,
  pulse = false,
): Pass {
  const c = makeCanvas(mask.w, mask.h);
  const ctx = ctx2d(c);
  ctx.save();
  ctx.translate(-mask.x, -mask.y);
  paint(ctx, mask);
  ctx.restore();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask.canvas, 0, 0);
  return { canvas: c, x: mask.x, y: mask.y, blend, alpha, pulse };
}

function flat(color: string): (ctx: CanvasRenderingContext2D, bb: BBox) => void {
  return (ctx, bb) => {
    ctx.fillStyle = color;
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  };
}

function radial(cx: number, cy: number, r: number, inner: string, outer = 'rgba(255,255,255,0)') {
  return (ctx: CanvasRenderingContext2D, bb: BBox) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  };
}

function vertical(y0: number, y1: number, c0: string, c1: string) {
  return (ctx: CanvasRenderingContext2D, bb: BBox) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, c0);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
  };
}

function regionsOf(layer: AppliedLayer, env: RecipeEnv): RegionId[] {
  return layer.regionIds.filter((id) => env.points(id).length >= 2);
}

/** Pass από ελεύθερο σχέδιο γύρω από σημείο, κομμένο στο δέρμα. */
function freePass(
  env: RecipeEnv,
  at: Pt,
  radius: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
  blend: GlobalCompositeOperation,
  alpha: number,
  clipToSkin = true,
): Pass {
  const bb = expandBBox({ x: at[0] - radius, y: at[1] - radius, w: radius * 2, h: radius * 2 }, 0);
  const c = makeCanvas(bb.w, bb.h);
  const ctx = ctx2d(c);
  ctx.save();
  ctx.translate(-bb.x, -bb.y);
  paint(ctx);
  ctx.restore();
  if (clipToSkin) {
    const skin = env.skinMask();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(skin.canvas, skin.x - bb.x, skin.y - bb.y);
    ctx.globalCompositeOperation = 'source-over';
  }
  return { canvas: c, x: bb.x, y: bb.y, blend, alpha };
}

// ───────────────────────────── recipes ─────────────────────────────

const foundation: Recipe = (layer, _c, env) => {
  const t = env.face.tuning;
  const m = copyMask(env.mask('skin', 4));
  cutHoles(m, [env.points('eyeHoleL'), env.points('eyeHoleR'), env.points('browL'), env.points('browR'), env.points('lips')], 2);
  return [
    paintMasked(m, flat(layer.color), 'color', 0.25 * t.color),
    paintMasked(m, flat(layer.color), 'soft-light', 0.3),
  ];
};

const concealer: Recipe = (layer, _c, env) =>
  regionsOf(layer, env).flatMap((id) => {
    const m = env.mask(id, 6);
    return [
      paintMasked(m, flat(layer.color), 'soft-light', 0.5),
      paintMasked(m, flat(layer.color), 'screen', 0.12 * env.face.tuning.screen),
    ];
  });

const blush: Recipe = (layer, _c, env) =>
  regionsOf(layer, env).flatMap((id) => {
    const m = env.mask(id, 10);
    const pts = env.points(id);
    const [cx, cy] = centroid(pts);
    const bb = polyBBox(pts);
    const r = Math.max(bb.w, bb.h) * 0.6;
    return [
      paintMasked(m, radial(cx, cy, r, rgba(layer.color, 1)), 'soft-light', 0.55, true),
      paintMasked(m, radial(cx, cy, r, rgba(layer.color, 1)), 'multiply', 0.2 * env.face.tuning.multiply, true),
    ];
  });

const highlighter: Recipe = (layer, _c, env) =>
  regionsOf(layer, env).map((id) => {
    const m = env.mask(id, 8);
    const bb = polyBBox(env.points(id));
    return paintMasked(m, vertical(bb.y, bb.y + bb.h, '#ffffff', layer.color), 'screen', 0.35 * env.face.tuning.screen);
  });

const eyeshadow: Recipe = (layer, _c, env) =>
  regionsOf(layer, env).flatMap((id) => {
    const m = env.mask(id, 3);
    const bb = polyBBox(env.points(id));
    // Πυκνό στη γραμμή βλεφαρίδων (κάτω), ξεθωριάζει προς την πτυχή (πάνω).
    const grad = vertical(bb.y + bb.h, bb.y, rgba(layer.color, 1), rgba(layer.color, 0.3));
    return [
      paintMasked(m, grad, 'multiply', 0.6 * env.face.tuning.multiply),
      paintMasked(m, flat(mix(layer.color, '#ffffff', 0.5)), 'screen', 0.15 * env.face.tuning.screen),
    ];
  });

function lashLinePass(env: RecipeEnv, id: RegionId, width: number, color: string, blend: GlobalCompositeOperation, alpha: number, lashes: boolean, seed: number): Pass | null {
  const line = env.points(id);
  if (line.length < 2) return null;
  const bb = expandBBox(polyBBox(line), 14);
  const c = makeCanvas(bb.w, bb.h);
  const ctx = ctx2d(c);
  ctx.translate(-bb.x, -bb.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePolyline(ctx, line);
  ctx.stroke();
  if (lashes) {
    const rng = makeRng(seed);
    ctx.lineWidth = 1.5;
    for (const { p, n } of samplePolyline(line, 4)) {
      // Κάθετη προς τα πάνω (η κλειστή γραμμή βλεφαρίδων στο blink δείχνει προς τα κάτω).
      const up = n[1] < 0 ? n : ([-n[0], -n[1]] as Pt);
      const len = 5 + rng() * 4;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + up[0] * len, p[1] + up[1] * len);
      ctx.stroke();
    }
  }
  return { canvas: c, x: bb.x, y: bb.y, blend, alpha };
}

const eyeliner: Recipe = (layer, _c, env) =>
  regionsOf(layer, env)
    .map((id) => lashLinePass(env, id, 3, layer.color, 'source-over', 0.9, false, layer.seed))
    .filter((p): p is Pass => !!p);

const mascara: Recipe = (layer, _c, env) =>
  regionsOf(layer, env)
    .map((id) => lashLinePass(env, id, 2, layer.color, 'multiply', 0.85, true, layer.seed))
    .filter((p): p is Pass => !!p);

const brow: Recipe = (layer, _c, env) =>
  regionsOf(layer, env).map((id) => paintMasked(env.mask(id, 1.5), flat(layer.color), 'multiply', 0.5 * env.face.tuning.multiply));

const lipstick: Recipe = (layer, _c, env) => {
  const m = env.mask('lips', 1.5);
  const anchor = (env.expr === 'smile' && env.face.regions.anchors.lipHighlightSmile) || env.face.regions.anchors.lipHighlight;
  const bb = polyBBox(env.points('lips'));
  const t = env.face.tuning;
  return [
    paintMasked(m, flat(layer.color), 'color', 0.55 * t.color),
    paintMasked(m, flat(layer.color), 'multiply', 0.45 * t.multiply),
    paintMasked(m, radial(anchor[0], anchor[1], Math.max(12, bb.w * 0.28), 'rgba(255,255,255,1)'), 'screen', 0.15 * t.screen),
  ];
};

const gloss: Recipe = (layer, _c, env) => {
  const m = env.mask('lips', 1.5);
  const anchor = (env.expr === 'smile' && env.face.regions.anchors.lipHighlightSmile) || env.face.regions.anchors.lipHighlight;
  const bb = polyBBox(env.points('lips'));
  return [
    paintMasked(m, flat(layer.color), 'soft-light', 0.3),
    paintMasked(m, radial(anchor[0], anchor[1] - 2, Math.max(12, bb.w * 0.3), 'rgba(255,255,255,1)'), 'screen', 0.5 * env.face.tuning.screen),
  ];
};

const RAINBOW = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];

/**
 * Μπογιές προσώπου: έτοιμα σχέδια ζωγραφισμένα πάνω στις περιοχές (ακολουθούν την έκφραση,
 * κόβονται στο δέρμα, οι τούφες τα καλύπτουν). Χωρίς εικαστικά.
 */
const facePaint: Recipe = (layer, _c, env) => {
  const variant = layer.variant ?? 'cat';
  const m = env.mask('skin', 1);
  if (variant === 'rainbow') {
    return [
      paintMasked(m, (ctx) => {
        ctx.lineCap = 'butt';
        for (const id of ['cheekL', 'cheekR'] as RegionId[]) {
          const pts = env.points(id);
          if (pts.length < 3) continue;
          const [cx, cy] = centroid(pts);
          const bb = polyBBox(pts);
          const R = Math.max(22, Math.min(bb.w, bb.h) * 0.55);
          RAINBOW.forEach((col, i) => {
            ctx.strokeStyle = col;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.arc(cx, cy + 6, R - i * 3, Math.PI, 2 * Math.PI);
            ctx.stroke();
          });
        }
      }, 'source-over', 0.85),
    ];
  }
  // Γατούλα: μυτούλα, γραμμή προς τα χείλη, 3 μουστάκια και 3 τελίτσες σε κάθε πλευρά.
  const nose = env.points('noseBridge');
  const nb = polyBBox(nose);
  const tx = nb.x + nb.w / 2, ty = nb.y + nb.h - 6;
  const lipsTop = polyBBox(env.points('lips')).y;
  const col = layer.color || '#1a1a1a';
  return [
    paintMasked(m, (ctx) => {
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(tx - 10, ty - 6); ctx.lineTo(tx + 10, ty - 6); ctx.lineTo(tx, ty + 5); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx, ty + 4); ctx.lineTo(tx, lipsTop - 2); ctx.stroke();
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const y0 = ty + 2 + i * 7, x0 = tx + s * 18;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + s * 62, y0 + (i - 1) * 14); ctx.stroke();
          ctx.beginPath(); ctx.arc(x0 - s * 4, y0, 1.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }, 'source-over', 0.92),
  ];
};

/** Μολύβι χειλιών: περίγραμμα του πολυγώνου των χειλιών (ακολουθεί το χαμόγελο). */
const lipLiner: Recipe = (layer, _c, env) => {
  const pts = env.points('lips');
  if (pts.length < 3) return [];
  const bb = expandBBox(polyBBox(pts), 6);
  const c = makeCanvas(bb.w, bb.h);
  const ctx = ctx2d(c);
  ctx.translate(-bb.x, -bb.y);
  ctx.strokeStyle = layer.color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  tracePoly(ctx, pts);
  ctx.stroke();
  return [{ canvas: c, x: bb.x, y: bb.y, blend: 'multiply', alpha: 0.8 * env.face.tuning.multiply }];
};

const recolorCache = new Map<string, HTMLCanvasElement>();

/** Αξεσουάρ μαλλιών: sprite βαμμένο με παλέτα, στη θέση της άγκυρας, πάνω από τα μαλλιά, με προαιρετικό διακοσμητικό. */
const accessory: Recipe = (layer, _c, env) => {
  const variant = layer.variant ?? 'clip';
  const slot = layer.regionIds[0];
  const anchor = env.face.regions.anchors[slot as 'accL' | 'accR' | 'accTop'];
  const sprite = env.sprite(`ac_${variant}`);
  if (!anchor || !sprite) return [];
  const d = ACCESSORY_DRAW[variant] ?? ACCESSORY_DRAW.clip;
  const key = `${variant}|${layer.color}`;
  let tinted = recolorCache.get(key);
  if (!tinted) {
    tinted = recolorImage(sprite, rampFor(layer.color), sprite.width, sprite.height);
    if (recolorCache.size > 64) recolorCache.clear();
    recolorCache.set(key, tinted);
  }
  const w = sprite.width * d.scale, h = sprite.height * d.scale;
  const cx = anchor[0] + d.dx, cy = anchor[1] + d.dy + (slot === 'accTop' && (variant === 'clip' || variant === 'bow') ? TOP_SLOT_DY : 0);
  const deco = layer.deco ? env.sprite(`st_${layer.deco}`) : undefined;
  const pad = 30;
  const bb = expandBBox({ x: cx - w / 2 - pad, y: cy - h / 2 - pad, w: w + pad * 2, h: h + pad * 2 }, 0);
  const c = makeCanvas(bb.w, bb.h);
  const ctx = ctx2d(c);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tinted, Math.round(cx - w / 2 - bb.x), Math.round(cy - h / 2 - bb.y), w, h);
  if (deco) ctx.drawImage(deco, Math.round(cx - deco.width / 2 - bb.x), Math.round(cy + d.decoDy - deco.height / 2 - bb.y));
  return [{ canvas: c, x: bb.x, y: bb.y, blend: 'source-over', alpha: 1, aboveHair: true }];
};

const mask: Recipe = (layer, _c, env) => {
  const m = copyMask(env.mask('faceBox', 1));
  cutHoles(m, [env.points('eyeHoleL'), env.points('eyeHoleR'), env.points('mouthHole')], 2);
  const rng = makeRng(layer.seed);
  const variant = layer.variant ?? 'sheet';
  if (variant === 'sheet') {
    return [
      paintMasked(
        m,
        (ctx, bb) => {
          ctx.fillStyle = layer.color || '#eaf4ff';
          ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          for (let i = 0; i < 900; i++) {
            ctx.fillRect(bb.x + rng() * bb.w, bb.y + rng() * bb.h, 1, 1);
          }
          ctx.fillStyle = 'rgba(150,180,210,0.35)';
          for (let i = 0; i < 500; i++) {
            ctx.fillRect(bb.x + rng() * bb.w, bb.y + rng() * bb.h, 1, 2);
          }
        },
        'source-over',
        0.9,
      ),
    ];
  }
  if (variant === 'clay') {
    return [
      paintMasked(
        m,
        (ctx, bb) => {
          ctx.fillStyle = layer.color || '#d7ccc8';
          ctx.fillRect(bb.x, bb.y, bb.w, bb.h);
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          for (let i = 0; i < 700; i++) {
            const s = 1 + Math.floor(rng() * 2);
            ctx.fillRect(bb.x + rng() * bb.w, bb.y + rng() * bb.h, s, s);
          }
        },
        'source-over',
        0.92,
      ),
    ];
  }
  // cream
  return [
    paintMasked(m, flat(layer.color || '#e8f5e9'), 'source-over', 0.78),
    paintMasked(m, radial(256, 200, 220, 'rgba(255,255,255,0.5)'), 'screen', 0.4),
  ];
};

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillRect(x - r, y, r * 2 + 1, 1);
  ctx.fillRect(x, y - r, 1, r * 2 + 1);
  if (r >= 3) {
    ctx.fillRect(x - 1, y - 1, 3, 3);
  }
}

const glitter: Recipe = (layer, _c, env) => {
  if (!layer.at) return [];
  const rng = makeRng(layer.seed);
  const [ax, ay] = layer.at;
  return [
    freePass(
      env,
      layer.at,
      30,
      (ctx) => {
        for (let i = 0; i < 20; i++) {
          const a = rng() * Math.PI * 2, d = rng() * 26;
          const x = Math.round(ax + Math.cos(a) * d), y = Math.round(ay + Math.sin(a) * d);
          ctx.fillStyle = rng() < 0.6 ? layer.color : '#ffffff';
          if (rng() < 0.35) star(ctx, x, y, 2 + Math.floor(rng() * 2));
          else ctx.fillRect(x, y, 1 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 2));
        }
      },
      'lighter',
      0.9,
    ),
  ];
};

function drawFallbackSticker(ctx: CanvasRenderingContext2D, variant: string, color: string, x: number, y: number, s: number): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (variant === 'heart') {
    ctx.moveTo(x, y + s * 0.45);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.3, x - s * 0.35, y - s * 0.75, x, y - s * 0.25);
    ctx.bezierCurveTo(x + s * 0.35, y - s * 0.75, x + s * 0.9, y - s * 0.3, x, y + s * 0.45);
  } else if (variant === 'star') {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s * 0.5 : s * 0.22;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  } else if (variant === 'gem') {
    ctx.moveTo(x - s * 0.5, y - s * 0.15); ctx.lineTo(x - s * 0.25, y - s * 0.45); ctx.lineTo(x + s * 0.25, y - s * 0.45);
    ctx.lineTo(x + s * 0.5, y - s * 0.15); ctx.lineTo(x, y + s * 0.5);
  } else if (variant === 'flower') {
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.moveTo(x, y);
      ctx.arc(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.3, s * 0.22, 0, Math.PI * 2);
    }
  } else {
    // butterfly: δύο ζεύγη φτερών
    ctx.ellipse(x - s * 0.25, y - s * 0.15, s * 0.28, s * 0.22, -0.4, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.5, y - s * 0.15);
    ctx.ellipse(x + s * 0.25, y - s * 0.15, s * 0.28, s * 0.22, 0.4, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.15, y + s * 0.25);
    ctx.ellipse(x - s * 0.18, y + s * 0.2, s * 0.2, s * 0.16, 0.5, 0, Math.PI * 2);
    ctx.moveTo(x + s * 0.4, y + s * 0.25);
    ctx.ellipse(x + s * 0.18, y + s * 0.2, s * 0.2, s * 0.16, -0.5, 0, Math.PI * 2);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  if (variant === 'flower') {
    ctx.fillStyle = '#ffe082';
    ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill();
  }
}

const sticker: Recipe = (layer, _c, env) => {
  if (!layer.at) return [];
  const variant = layer.variant ?? 'heart';
  const sprite = env.sprite(`st_${variant}`);
  const size = 40;
  return [
    freePass(
      env,
      layer.at,
      size,
      (ctx) => {
        const [x, y] = layer.at!;
        if (sprite) ctx.drawImage(sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height / 2));
        else drawFallbackSticker(ctx, variant, layer.color, x, y, size);
      },
      'source-over',
      1,
      false,
    ),
  ];
};

const freckles: Recipe = (layer, _c, env) => {
  const rng = makeRng(layer.seed);
  return regionsOf(layer, env).map((id) =>
    paintMasked(
      env.mask(id, 0),
      (ctx, bb) => {
        ctx.fillStyle = layer.color;
        const n = Math.round((bb.w * bb.h) / 140);
        for (let i = 0; i < n; i++) {
          const s = rng() < 0.7 ? 2 : 3;
          ctx.fillRect(Math.round(bb.x + rng() * bb.w), Math.round(bb.y + rng() * bb.h), s, s);
        }
      },
      'multiply',
      0.5,
    ),
  );
};

const beautySpot: Recipe = (layer, _c, env) => {
  if (!layer.at) return [];
  return [
    freePass(env, layer.at, 4, (ctx) => {
      ctx.fillStyle = layer.color;
      ctx.beginPath(); ctx.arc(layer.at![0], layer.at![1], 2.2, 0, Math.PI * 2); ctx.fill();
    }, 'multiply', 0.9),
  ];
};

export const RECIPES: Record<Cosmetic['category'], Recipe> = {
  foundation, concealer, blush, highlighter, eyeshadow, eyeliner, mascara, brow, lipstick, gloss, mask, glitter, sticker, freckles, beautySpot,
  // Τα μαλλιά δεν είναι πέρασμα: συντίθενται στο Compositor.hairImage (βλ. hairColor.ts).
  hairColor: () => [],
  hairStreak: () => [],
  facePaint,
  lipLiner,
  // Το βαμβάκι δεν ζωγραφίζει: αφαιρεί στρώμα (βλ. StudioScreen.onDrop).
  remover: () => [],
  accessory,
};

export { featheredMask, clipMask, tracePoly };
