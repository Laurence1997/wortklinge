#!/usr/bin/env python3
"""Render sprite blocks to a PNG contact sheet: art_preview.py OUT.png [file …] (default: generated + hand-drawn).

Each cell shows the sprite at 4× on the everyday grass green with its word underneath."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_drawn import PAL  # noqa: E402


def read_blocks(path):
    blocks, name, cur = [], None, []
    for line in Path(path).read_text(encoding='utf-8').split('\n'):
        if line.startswith('#'):
            continue
        if line.startswith('= '):
            name, cur = line[2:].split('|')[0].strip(), []
            continue
        if name and line.strip():
            cur.append(line)
            if len(cur) == 16:
                blocks.append((name, cur))
                name = None
    return blocks


def sheet(blocks, out, cols=16, scale=int(__import__("os").environ.get("SC", 4)), bg=(132, 198, 105)):
    cw, ch = 16 * scale + 24, 16 * scale + 22
    rows = (len(blocks) + cols - 1) // cols
    img = Image.new('RGB', (cols * cw, rows * ch), bg)
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 11)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, rs) in enumerate(blocks):
        ox, oy = (i % cols) * cw + 12, (i // cols) * ch + 4
        for y, r in enumerate(rs):
            for x, c in enumerate(r[:16]):
                if c in PAL:
                    col = PAL[c]
                    d.rectangle([ox + x * scale, oy + y * scale, ox + x * scale + scale - 1, oy + y * scale + scale - 1], fill=col)
        tw = d.textlength(name, font=font)
        d.text((ox + 8 * scale - tw / 2, oy + 16 * scale + 2), name, fill=(20, 20, 30), font=font)
    img.save(out)
    print(out, len(blocks))


if __name__ == '__main__':
    out = sys.argv[1]
    files = sys.argv[2:]
    bl = []
    for f in files:
        bl += read_blocks(f)
    sheet(bl, out)
