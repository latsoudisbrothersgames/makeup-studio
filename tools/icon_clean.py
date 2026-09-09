#!/usr/bin/env python3
"""Καθαρισμός εικονιδίου PixelLab: κρατά μόνο τη μεγαλύτερη συνεκτική νησίδα (και όσες ≥ KEEP_RATIO αυτής),
σβήνει τα «σκουπίδια» που προσθέτει το pixen γύρω από το αντικείμενο, και το κεντράρει.

  icon_clean.py <in.png> [<out.png>] [keep_ratio=0.15]
"""
import sys
from collections import deque
from PIL import Image

def main(src, dst=None, keep=0.15):
    im = Image.open(src).convert('RGBA'); W, H = im.size; px = im.load()
    seen = set(); comps = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0 or (x, y) in seen: continue
            q = deque([(x, y)]); seen.add((x, y)); comp = []
            while q:
                cx, cy = q.popleft(); comp.append((cx, cy))
                for nx, ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1),(cx+1,cy+1),(cx-1,cy-1),(cx+1,cy-1),(cx-1,cy+1)):
                    if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] > 0 and (nx, ny) not in seen:
                        seen.add((nx, ny)); q.append((nx, ny))
            comps.append(comp)
    if not comps: return
    big = max(len(c) for c in comps)
    kept = [c for c in comps if len(c) >= big * keep]
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); op = out.load()
    for c in kept:
        for x, y in c: op[x, y] = px[x, y]
    bb = out.getbbox()
    if bb:
        crop = out.crop(bb); out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        out.paste(crop, ((W - crop.width) // 2, (H - crop.height) // 2))
    out.save(dst or src)
    print(f'{src}: {len(comps)} islands → kept {len(kept)} ({sum(len(c) for c in kept)} px)')

if __name__ == '__main__':
    a = sys.argv[1:]; main(a[0], a[1] if len(a) > 1 else None, float(a[2]) if len(a) > 2 else 0.15)
