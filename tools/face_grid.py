#!/usr/bin/env python3
"""Βοηθήματα ανάγνωσης συντεταγμένων για τον χάρτη περιοχών ενός προσώπου.

  face_grid.py <base.png> <outdir>   → grid.png (2×, πλέγμα 32px), zoom-eyes.png, zoom-mouth.png (4×, πλέγμα 8px)
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw


def grid(im, out):
    big = im.resize((1024, 1024), Image.NEAREST)
    bg = Image.new('RGBA', big.size, (255, 255, 255, 255)); bg.alpha_composite(big)
    d = ImageDraw.Draw(bg)
    for v in range(0, 513, 32):
        d.line([(v * 2, 0), (v * 2, 1024)], fill=(0, 0, 255, 120))
        d.line([(0, v * 2), (1024, v * 2)], fill=(0, 0, 255, 120))
        d.text((v * 2 + 2, 2), str(v), fill=(200, 0, 0, 255)); d.text((2, v * 2 + 2), str(v), fill=(200, 0, 0, 255))
    bg.save(out)


def zoom(im, box, out, s=4, step=8):
    c = im.crop(box)
    z = c.resize((c.width * s, c.height * s), Image.NEAREST)
    zb = Image.new('RGBA', z.size, (255, 255, 255, 255)); zb.alpha_composite(z)
    d = ImageDraw.Draw(zb)
    for x in range(box[0], box[2] + 1, step):
        X = (x - box[0]) * s; d.line([(X, 0), (X, zb.height)], fill=(0, 0, 255, 90)); d.text((X + 1, 1), str(x), fill=(200, 0, 0, 255))
    for y in range(box[1], box[3] + 1, step):
        Y = (y - box[1]) * s; d.line([(0, Y), (zb.width, Y)], fill=(0, 0, 255, 90)); d.text((1, Y + 1), str(y), fill=(200, 0, 0, 255))
    zb.save(out)


if __name__ == '__main__':
    im = Image.open(sys.argv[1]).convert('RGBA')
    out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    grid(im, out / 'grid.png')
    zoom(im, (150, 170, 370, 270), out / 'zoom-eyes.png')
    zoom(im, (190, 250, 330, 350), out / 'zoom-mouth.png')
    print('ok', out)
