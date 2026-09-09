import type { Poly, Region, RegionId, RegionMap } from '../../types/face';
import { ellipsePoly, mirrorPoly } from '../../engine/geometry';

/**
 * Παραμετρικός χάρτης περιοχών: χρησιμοποιείται για τα placeholder πρόσωπα και ως
 * αφετηρία στον επεξεργαστή περιοχών πριν αντικατασταθεί από χειροκίνητο JSON ανά πρόσωπο.
 * Όλες οι συντεταγμένες στον χώρο 512×512.
 */
export interface FaceParams {
  cx: number;      // κέντρο προσώπου x (άξονας συμμετρίας)
  cy: number;      // κέντρο προσώπου y
  rx: number;      // ημιπλάτος οβάλ
  ry: number;      // ημιύψος οβάλ
  eyeY: number;
  eyeDX: number;   // απόσταση ματιού από τον άξονα
  eyeRX: number;
  eyeRY: number;
  browY: number;
  mouthY: number;
  mouthW: number;
}

export const DEFAULT_PARAMS: FaceParams = {
  cx: 256, cy: 272, rx: 150, ry: 192,
  eyeY: 240, eyeDX: 66, eyeRX: 30, eyeRY: 15,
  browY: 203, mouthY: 372, mouthW: 104,
};

function poly(id: RegionId, points: Poly, kind: Region['kind'] = 'polygon'): Region {
  return { id, kind, points };
}

function lipsClosed(p: FaceParams, cornerLift = 0, fullness = 1): Poly {
  const { cx, mouthY: y, mouthW: w } = p;
  const hw = w / 2;
  const up = 10 * fullness, lo = 16 * fullness;
  return [
    [cx - hw, y - cornerLift], [cx - hw * 0.6, y - up * 0.7], [cx - hw * 0.25, y - up], [cx, y - up * 0.55],
    [cx + hw * 0.25, y - up], [cx + hw * 0.6, y - up * 0.7], [cx + hw, y - cornerLift],
    [cx + hw * 0.62, y + lo * 0.85], [cx + hw * 0.25, y + lo], [cx, y + lo], [cx - hw * 0.25, y + lo], [cx - hw * 0.62, y + lo * 0.85],
  ].map(([x, yy]) => [Math.round(x), Math.round(yy)] as [number, number]);
}

function lidOpen(p: FaceParams, ex: number): Poly {
  // Πάνω βλέφαρο: από τη γραμμή βλεφαρίδων ως την πτυχή, ~14px ψηλότερα.
  const { eyeY: y, eyeRX: rx, eyeRY: ry } = p;
  return [
    [ex - rx - 4, y + 2], [ex - rx * 0.6, y - ry - 4], [ex, y - ry - 6], [ex + rx * 0.6, y - ry - 4], [ex + rx + 4, y + 2],
    [ex + rx + 2, y - ry - 12], [ex + rx * 0.5, y - ry - 18], [ex, y - ry - 20], [ex - rx * 0.5, y - ry - 18], [ex - rx - 2, y - ry - 12],
  ].map(([x, yy]) => [Math.round(x), Math.round(yy)]);
}

function lidClosed(p: FaceParams, ex: number): Poly {
  // Κλειστό μάτι: το βλέφαρο καλύπτει και τον βολβό ως τη χαμηλή γραμμή βλεφαρίδων.
  const { eyeY: y, eyeRX: rx, eyeRY: ry } = p;
  return [
    [ex - rx - 4, y + ry - 2], [ex - rx * 0.6, y + ry + 2], [ex, y + ry + 3], [ex + rx * 0.6, y + ry + 2], [ex + rx + 4, y + ry - 2],
    [ex + rx + 2, y - ry - 12], [ex + rx * 0.5, y - ry - 18], [ex, y - ry - 20], [ex - rx * 0.5, y - ry - 18], [ex - rx - 2, y - ry - 12],
  ].map(([x, yy]) => [Math.round(x), Math.round(yy)]);
}

function lashOpen(p: FaceParams, ex: number, outerSign: number): Poly {
  const { eyeY: y, eyeRX: rx, eyeRY: ry } = p;
  // Από την εσωτερική γωνία προς την εξωτερική με μικρό φτερό.
  const inner = ex - outerSign * rx, outer = ex + outerSign * rx;
  return [
    [inner, y + 1], [ex - outerSign * rx * 0.55, y - ry - 1], [ex, y - ry - 3], [ex + outerSign * rx * 0.55, y - ry - 1],
    [outer, y - 1], [outer + outerSign * 7, y - 6],
  ].map(([x, yy]) => [Math.round(x), Math.round(yy)]);
}

function lashClosed(p: FaceParams, ex: number, outerSign: number): Poly {
  const { eyeY: y, eyeRX: rx, eyeRY: ry } = p;
  const inner = ex - outerSign * rx, outer = ex + outerSign * rx;
  return [
    [inner, y + ry - 4], [ex - outerSign * rx * 0.5, y + ry + 1], [ex, y + ry + 2], [ex + outerSign * rx * 0.5, y + ry + 1],
    [outer, y + ry - 4],
  ].map(([x, yy]) => [Math.round(x), Math.round(yy)]);
}

function brow(p: FaceParams, ex: number, outerSign: number, lift = 0): Poly {
  const y = p.browY - lift;
  const rx = p.eyeRX + 8;
  const inner = ex - outerSign * rx, outer = ex + outerSign * rx;
  return [
    [inner, y + 4], [ex - outerSign * rx * 0.4, y - 4], [ex + outerSign * rx * 0.2, y - 6], [outer, y],
    [outer + outerSign * 2, y + 5], [ex + outerSign * rx * 0.2, y + 3], [ex - outerSign * rx * 0.4, y + 5], [inner + outerSign * 2, y + 9],
  ].map(([x, yy]) => [Math.round(x), Math.round(yy)]);
}

export function buildRegionMap(p: FaceParams = DEFAULT_PARAMS): RegionMap {
  const { cx, cy, rx, ry, eyeY, eyeDX, eyeRX, eyeRY } = p;
  const exL = cx - eyeDX, exR = cx + eyeDX;

  const face = ellipsePoly(cx, cy, rx, ry, 36);
  const faceBox = ellipsePoly(cx, cy, rx + 6, ry + 6, 36);
  const eyeL = ellipsePoly(exL, eyeY, eyeRX, eyeRY, 16);
  const cheekL = ellipsePoly(cx - eyeDX - 10, cy + 34, 46, 34, 18);
  const cheekboneL = ellipsePoly(cx - eyeDX - 14, cy + 6, 48, 12, 16, -0.28);
  const underEyeL = [
    [exL - eyeRX - 2, eyeY + 2], [exL - eyeRX * 0.5, eyeY + eyeRY + 3], [exL, eyeY + eyeRY + 5], [exL + eyeRX * 0.5, eyeY + eyeRY + 3], [exL + eyeRX + 2, eyeY + 2],
    [exL + eyeRX + 2, eyeY + eyeRY + 14], [exL, eyeY + eyeRY + 18], [exL - eyeRX - 2, eyeY + eyeRY + 14],
  ] as Poly;
  const noseBridge: Poly = [[cx - 11, eyeY - 12], [cx + 11, eyeY - 12], [cx + 15, cy + 40], [cx - 15, cy + 40]];
  const tzone: Poly = [
    [cx - 60, cy - 130], [cx + 60, cy - 130], [cx + 44, cy - 74], [cx + 13, cy - 60], [cx + 16, cy + 44], [cx - 16, cy + 44], [cx - 13, cy - 60], [cx - 44, cy - 74],
  ];
  const lips = lipsClosed(p);
  const lipsSmile = lipsClosed({ ...p, mouthW: p.mouthW + 22 }, 9, 1.05);
  const wowLips = ellipsePoly(cx, p.mouthY + 6, 30, 34, 20);
  const wowHole = ellipsePoly(cx, p.mouthY + 8, 19, 24, 16);

  const regions = {
    skin: poly('skin', face),
    faceBox: poly('faceBox', faceBox),
    lips: poly('lips', lips),
    mouthHole: poly('mouthHole', []),
    eyeHoleL: poly('eyeHoleL', eyeL),
    eyeHoleR: poly('eyeHoleR', mirrorPoly(eyeL, cx)),
    cheekL: poly('cheekL', cheekL),
    cheekR: poly('cheekR', mirrorPoly(cheekL, cx)),
    cheekboneL: poly('cheekboneL', cheekboneL),
    cheekboneR: poly('cheekboneR', mirrorPoly(cheekboneL, cx)),
    tzone: poly('tzone', tzone),
    noseBridge: poly('noseBridge', noseBridge),
    lidL: poly('lidL', lidOpen(p, exL)),
    lidR: poly('lidR', mirrorPoly(lidOpen(p, exL), cx)),
    lashL: poly('lashL', lashOpen(p, exL, -1), 'polyline'),
    lashR: poly('lashR', lashOpen(p, exR, 1), 'polyline'),
    underEyeL: poly('underEyeL', underEyeL),
    underEyeR: poly('underEyeR', mirrorPoly(underEyeL, cx)),
    browL: poly('browL', brow(p, exL, -1)),
    browR: poly('browR', brow(p, exR, 1)),
    hair: poly('hair', ellipsePoly(cx, p.cy - p.ry * 0.55, p.rx * 1.15, p.ry * 0.6, 20)),
    hairStreak: poly('hairStreak', []),
    accL: poly('accL', ellipsePoly(cx - p.rx * 0.95, p.cy - p.ry * 0.55, 30, 30, 12)),
    accR: poly('accR', ellipsePoly(cx + p.rx * 0.95, p.cy - p.ry * 0.55, 30, 30, 12)),
    accTop: poly('accTop', ellipsePoly(cx, p.cy - p.ry * 1.1, 30, 30, 12)),
  } satisfies Record<RegionId, Region>;

  const eyeWowL = ellipsePoly(exL, eyeY - 2, eyeRX + 2, eyeRY + 6, 16);
  const lidWowL = lidOpen({ ...p, eyeY: eyeY - 8, eyeRY: eyeRY + 4 }, exL);

  return {
    size: 512,
    regions,
    variants: {
      blink: {
        eyeHoleL: poly('eyeHoleL', []),
        eyeHoleR: poly('eyeHoleR', []),
        lidL: poly('lidL', lidClosed(p, exL)),
        lidR: poly('lidR', mirrorPoly(lidClosed(p, exL), cx)),
        lashL: poly('lashL', lashClosed(p, exL, -1), 'polyline'),
        lashR: poly('lashR', lashClosed(p, exR, 1), 'polyline'),
      },
      smile: {
        lips: poly('lips', lipsSmile),
      },
      wow: {
        lips: poly('lips', wowLips),
        mouthHole: poly('mouthHole', wowHole),
        browL: poly('browL', brow(p, exL, -1, 14)),
        browR: poly('browR', brow(p, exR, 1, 14)),
        eyeHoleL: poly('eyeHoleL', eyeWowL),
        eyeHoleR: poly('eyeHoleR', mirrorPoly(eyeWowL, cx)),
        lidL: poly('lidL', lidWowL),
        lidR: poly('lidR', mirrorPoly(lidWowL, cx)),
        lashL: poly('lashL', lashOpen({ ...p, eyeY: eyeY - 8, eyeRY: eyeRY + 4 }, exL, -1), 'polyline'),
        lashR: poly('lashR', lashOpen({ ...p, eyeY: eyeY - 8, eyeRY: eyeRY + 4 }, exR, 1), 'polyline'),
      },
    },
    anchors: {
      lipHighlight: [cx, p.mouthY + 7],
      lipHighlightSmile: [cx, p.mouthY + 8],
      accL: [cx - p.rx * 0.95, p.cy - p.ry * 0.55],
      accR: [cx + p.rx * 0.95, p.cy - p.ry * 0.55],
      accTop: [cx, p.cy - p.ry * 1.1],
    },
  };
}
