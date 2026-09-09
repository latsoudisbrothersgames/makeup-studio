#!/usr/bin/env python3
"""Σύνθεση χτενίσματος από εικόνα edit_image (pro) του PixelLab.

  hairstyle_compose.py <faceId> <styleId> <edited.png> '#hex,#hex,...'

Το pro edit ξανασχεδιάζει ΟΛΗ την εικόνα (ελαφρώς άλλα χρώματα), οπότε ΔΕΝ χρησιμοποιούμε το
πρόσωπό της. Κανόνας σύνθεσης ανά έκφραση:
  1. αρχική εικόνα της έκφρασης, χωρίς τα παλιά μαλλιά (τρύπες από hair.png)
  2. οι τρύπες γεμίζουν από τη νέα εικόνα όπου εκείνη ΔΕΝ έχει μαλλιά (ώμοι, λαιμός, φόντο)
  3. τα μαλλιά του νέου χτενίσματος (λίστα χρωμάτων + αφαίρεση φρυδιών/ματιών/χειλιών) → hair.png
Έξοδος: src/assets/faces/<faceId>/styles/<styleId>/{neutral,blink,smile,wow,hair}.png
Το πρόσωπο μένει pixel-ίδιο → οι χάρτες περιοχών και οι εκφράσεις ισχύουν ως έχουν.
"""
import sys, json
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from hair_layer import exclusion_mask, islands, MIN_ISLAND, THIN_H  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def main(fid, sid, edited, colours):
    cols = {tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) for h in colours.split(',')}
    new = Image.open(edited).convert('RGBA'); npx = new.load()
    old_hair = Image.open(ROOT / f'src/assets/faces/{fid}/hair.png').convert('RGBA'); hp0 = old_hair.load()
    # Τρύπες = παλιά μαλλιά + η σκούρα γραμμή περιγράμματός τους (έως 3px γύρω τους), που δεν ανήκε στο hair.png.
    from PIL import ImageFilter
    hm = Image.new('L', (512, 512), 0); hmp = hm.load()
    for y in range(512):
        for x in range(512):
            if hp0[x, y][3] > 0: hmp[x, y] = 255
    near_head = hm.filter(ImageFilter.MaxFilter(11)).load()
    near_low = hm.filter(ImageFilter.MaxFilter(19)).load()   # λαιμός/ώμοι: το περίγραμμα της αλογοουράς απλώνει πιο μακριά
    near = type('N', (), {'__getitem__': lambda self, xy: (near_low if xy[1] > 320 else near_head)[xy]})()
    orig0 = Image.open(ROOT / f'src/assets/faces/{fid}/neutral.png').convert('RGBA').load()
    class _H:  # ίδια διεπαφή με το PixelAccess (μόνο [x, y] → alpha>0 = τρύπα)
        def __getitem__(self, xy):
            x, y = xy
            if hp0[x, y][3] > 0: return (0, 0, 0, 255)
            c = orig0[x, y]
            if near[x, y] and c[3] > 0 and max(c[:3]) < 60: return (0, 0, 0, 255)
            return (0, 0, 0, 0)
    hp = _H()
    regions = json.loads((ROOT / f'src/data/faces/{fid}.regions.json').read_text())
    excl = exclusion_mask(regions).load()
    keep = [[npx[x, y][3] > 0 and npx[x, y][:3] in cols and excl[x, y] == 0 for x in range(512)] for y in range(512)]
    comps = islands(keep)
    def is_hair(c):
        if len(c) < MIN_ISLAND: return False
        ys = [y for _, y in c]; return max(ys) - min(ys) + 1 > THIN_H
    hair = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); hpx = hair.load()
    for c in comps:
        if is_hair(c):
            for x, y in c: hpx[x, y] = npx[x, y]
    out = ROOT / f'src/assets/faces/{fid}/styles/{sid}'; out.mkdir(parents=True, exist_ok=True)
    hair.save(out / 'hair.png')
    orig_pal = {orig0[x, y][:3] for y in range(512) for x in range(512) if orig0[x, y][3] > 0}
    snap_cache = {}
    def snap(c):
        k = c[:3]
        if k in snap_cache: return snap_cache[k]
        best = min(orig_pal, key=lambda o: (o[0]-k[0])**2 + (o[1]-k[1])**2 + (o[2]-k[2])**2)
        d = ((best[0]-k[0])**2 + (best[1]-k[1])**2 + (best[2]-k[2])**2) ** 0.5
        snap_cache[k] = (best + (c[3],)) if d <= 12 else c
        return snap_cache[k]
    for e in ('neutral', 'blink', 'smile', 'wow'):
        src = Image.open(ROOT / f'src/assets/faces/{fid}/{e}.png').convert('RGBA'); sp = src.load()
        dst = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); dp = dst.load()
        for y in range(512):
            for x in range(512):
                if hp[x, y][3] > 0:                      # τρύπα παλιών μαλλιών
                    if hpx[x, y][3] == 0 and npx[x, y][3] > 0: dp[x, y] = snap(npx[x, y])   # γέμισμα από τη νέα (όχι μαλλιά), κουμπωμένο στην αρχική παλέτα
                else:
                    dp[x, y] = sp[x, y]
        dst.save(out / f'{e}.png')
    n = sum(1 for y in range(512) for x in range(512) if hpx[x, y][3] > 0)
    holes = sum(1 for y in range(512) for x in range(512) if hp[x, y][3] > 0 and hpx[x, y][3] == 0 and npx[x, y][3] == 0)
    print(f'{fid}/{sid}: hair px {n}, uncovered old-hair holes {holes} → {out.relative_to(ROOT)}')


if __name__ == '__main__':
    main(*sys.argv[1:5])
