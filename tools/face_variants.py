#!/usr/bin/env python3
"""Παραλλαγές έκφρασης για ένα πρόσωπο (blink / smile / wow) μέσω edit_image_pixen σε crops.

  face_variants.py <faceId> <base.png> [workdir]

Κόβει σταθερές ζώνες (μάτια / στόμα / όλο το κέντρο), τις στέλνει στο PixelLab (1 gen η καθεμία),
περιμένει, τις ξανακολλά στη βάση μέσα από inset+feather μάσκα (μηδέν αλλαγές έξω από τη ζώνη)
και εγκαθιστά τα PNG στο src/assets/faces/<faceId>/. Γράφει και review sheet.
"""
import subprocess, sys, json, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PL = ROOT / 'tools' / 'pl.py'

BOXES = {
    'blink': (150, 170, 370, 270),   # 220×100
    'smile': (190, 258, 330, 350),   # 140×92
    'wow':   (160, 150, 360, 350),   # 200×200
}
PROMPTS = {
    'blink': 'Same pixel art face, identical colours and shading, keep the skin background exactly as it is; both eyes gently closed, upper eyelids lowered fully covering the eyes, eyelashes resting as a thin dark curved line on the lower lid, relaxed blink; eyebrows unchanged; no other change; no makeup',
    'smile': 'Same pixel art face, identical colours and shading, keep the skin background exactly as it is; change only the mouth to a gentle friendly closed-lip smile with the corners of the mouth raised, lips natural bare skin colour, mouth closed, no teeth; no other change; no makeup',
    'wow':   'Same pixel art face, identical colours and shading, keep the skin background exactly as it is; surprised wow expression: both eyebrows raised high, eyes wide open showing more white, mouth open in a small round O shape with a dark interior, no teeth; no other change; no makeup',
}


def call(tool, args):
    out = subprocess.run([sys.executable, str(PL), 'call', tool, json.dumps(args)], capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit(out.stderr or out.stdout)
    m = re.search(r'job_id:\s*(\S+)', out.stdout)
    if not m:
        raise SystemExit('no job id in: ' + out.stdout)
    return m.group(1)


def wait(job, out):
    subprocess.run([sys.executable, str(PL), 'wait', job, str(out)], check=True)


def composite(base, edit_png, box, inset=5, feather=3):
    e = Image.open(edit_png).convert('RGBA')
    layer = base.copy()
    layer.paste(e, (box[0], box[1]))
    mask = Image.new('L', base.size, 0)
    ImageDraw.Draw(mask).rectangle((box[0] + inset, box[1] + inset, box[2] - inset, box[3] - inset), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    im = Image.composite(layer, base, mask)
    im.putalpha(base.getchannel('A'))
    return im


def main(face_id, base_png, workdir=None, seed=2):
    work = Path(workdir or (ROOT / 'assets-src' / face_id))
    work.mkdir(parents=True, exist_ok=True)
    base = Image.open(base_png).convert('RGBA')
    assert base.size == (512, 512), base.size
    dest = ROOT / 'src' / 'assets' / 'faces' / face_id
    dest.mkdir(parents=True, exist_ok=True)
    base.save(dest / 'neutral.png')
    jobs = {}
    for name, box in BOXES.items():
        crop = work / f'crop-{name}.png'
        base.crop(box).save(crop)
        jobs[name] = call('edit_image_pixen', {
            'image_url': f'@file:{crop}', 'no_background': False,
            'description': PROMPTS[name], 'seed': seed,
        })
        print(name, 'job', jobs[name])
    for name, job in jobs.items():
        edit = work / f'edit-{name}.png'
        wait(job, edit)
        im = composite(base, edit, BOXES[name])
        im.save(work / f'{name}.png')
        im.save(dest / f'{name}.png')
        print('installed', dest / f'{name}.png')
    # review sheet
    tiles = [base] + [Image.open(work / f'{n}.png').convert('RGBA') for n in BOXES]
    sheet = Image.new('RGBA', (len(tiles) * 260, 300), (255, 255, 255, 255))
    for i, t in enumerate(tiles):
        sheet.alpha_composite(t.crop((130, 110, 390, 410)), (i * 260, 0))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.save(work / 'variants-sheet.png')
    print('sheet', work / 'variants-sheet.png')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
