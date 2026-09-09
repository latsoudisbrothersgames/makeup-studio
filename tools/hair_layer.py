#!/usr/bin/env python3
"""Εξαγωγή επιπέδου μαλλιών από τη βάση κάθε μοντέλου (χωρίς PixelLab).

  hair_layer.py <id> [<id>...]   → src/assets/faces/<id>/hair.png  (RGBA, μόνο τα pixel των μαλλιών)
                                   tools/shots/hair-<id>.png       (προεπισκόπηση: μαλλιά | βάση χωρίς μαλλιά)

Τα PixelLab πρόσωπα έχουν λίγα, διακριτά χρώματα (26–51) χωρίς antialiasing, οπότε τα μαλλιά
απομονώνονται με λίστα χρωμάτων ανά μοντέλο. Φρύδια, βλεφαρίδες και μάτια, που μοιράζονται
χρώματα με τα μαλλιά, αφαιρούνται με τα πολύγωνα του regions.json (διεσταλμένα κατά DILATE[περιοχή] px).
Μικρά απομονωμένα νησάκια (< MIN_ISLAND px) πετιούνται.
Τα μαλλιά είναι pixel-ίδια σε όλες τις εκφράσεις (ελέγχθηκε 09.09.2026), άρα ένα επίπεδο αρκεί.
"""
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DILATE = {'browL': 7, 'browR': 7, 'eyeHoleL': 5, 'eyeHoleR': 5, 'lashL': 4, 'lashR': 4, 'lips': 3, 'mouthHole': 3}
MIN_ISLAND = 40
THIN_H = 4  # νησίδες με ύψος ≤ THIN_H px είναι περιγράμματα φρυδιών, όχι μαλλιά

HAIR_COLOURS = {
    'f1': ['#cf9d4e', '#bc823e', '#9e6332', '#844d2c', '#965c30', '#663a2f', '#eac383', '#784529'],
    'f2': ['#2c150d', '#3b1e13', '#562e1e', '#6f3f2e', '#5e3326', '#4b291a', '#452724'],
    'f3': ['#c26530', '#762a16', '#5e1f13', '#9d4420', '#501a11', '#6c2414', '#ea8c4f', '#451918',
           '#a84c20', '#943d1e', '#802f17', '#b15522', '#cc6c32', '#883c27', '#e69357'],
    'f4': ['#21151d', '#3c3237', '#2f2228', '#0d0816', '#665557', '#362a30', '#150b14', '#221222'],
}
# Περιοχές που μοιράζονται χρώματα με τα μαλλιά και πρέπει να εξαιρεθούν.
EXCLUDE_REGIONS = ['browL', 'browR', 'eyeHoleL', 'eyeHoleR', 'lashL', 'lashR', 'lips', 'mouthHole']


def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def exclusion_mask(regions):
    m = Image.new('L', (512, 512), 0)
    d = ImageDraw.Draw(m)
    for rid in EXCLUDE_REGIONS:
        r = regions['regions'].get(rid)
        pts = [tuple(p) for p in (r or {}).get('points', [])]
        if len(pts) < 2:
            continue
        w = DILATE[rid] * 2 + 1
        if r['kind'] == 'polyline':
            d.line(pts, fill=255, width=w)
        else:
            d.polygon(pts, fill=255, outline=255)
            d.line(pts + [pts[0]], fill=255, width=w)
        for x, y in pts:
            d.ellipse([x - DILATE[rid], y - DILATE[rid], x + DILATE[rid], y + DILATE[rid]], fill=255)
    return m


def islands(keep):
    """Συνεκτικές συνιστώσες (4-γειτονιά) πάνω σε boolean grid 512×512· επιστρέφει λίστα συνόλων."""
    seen = set()
    out = []
    for y in range(512):
        for x in range(512):
            if not keep[y][x] or (x, y) in seen:
                continue
            comp = []
            q = deque([(x, y)])
            seen.add((x, y))
            while q:
                cx, cy = q.popleft()
                comp.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < 512 and 0 <= ny < 512 and keep[ny][nx] and (nx, ny) not in seen:
                        seen.add((nx, ny))
                        q.append((nx, ny))
            out.append(comp)
    return out


def extract(fid):
    base = Image.open(ROOT / f'src/assets/faces/{fid}/neutral.png').convert('RGBA')
    regions = json.loads((ROOT / f'src/data/faces/{fid}.regions.json').read_text())
    colours = {hex_rgb(h) for h in HAIR_COLOURS[fid]}
    excl = exclusion_mask(regions).load()
    px = base.load()
    keep = [[px[x, y][3] > 0 and px[x, y][:3] in colours and excl[x, y] == 0 for x in range(512)] for y in range(512)]
    comps = islands(keep)
    def is_hair(c):
        if len(c) < MIN_ISLAND:
            return False
        ys = [y for _, y in c]
        return max(ys) - min(ys) + 1 > THIN_H

    kept = [c for c in comps if is_hair(c)]
    dropped = sum(len(c) for c in comps) - sum(len(c) for c in kept)

    hair = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    hp = hair.load()
    rest = base.copy()
    rp = rest.load()
    n = 0
    for comp in kept:
        for x, y in comp:
            hp[x, y] = px[x, y]
            rp[x, y] = (255, 0, 255, 255)
            n += 1
    out = ROOT / f'src/assets/faces/{fid}/hair.png'
    hair.save(out)

    grey = Image.new('RGBA', (512, 512), (120, 120, 120, 255))
    grey.alpha_composite(hair)
    sheet = Image.new('RGBA', (1024, 512))
    sheet.paste(grey, (0, 0))
    sheet.paste(rest, (512, 0))
    prev = ROOT / f'tools/shots/hair-{fid}.png'
    sheet.save(prev)
    print(f'{fid}: {n} hair px in {len(kept)} islands (dropped {dropped} px in {len(comps) - len(kept)} small islands) → {out.relative_to(ROOT)}, preview {prev.relative_to(ROOT)}')


if __name__ == '__main__':
    ids = sys.argv[1:] or list(HAIR_COLOURS)
    for fid in ids:
        extract(fid)
