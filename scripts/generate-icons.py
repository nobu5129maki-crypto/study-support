#!/usr/bin/env python3
"""元画像から 192/512 と maskable の正方形アイコンを作る。"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "icon-source.png"
PUBLIC = ROOT / "public"


def load_square() -> Image.Image:
    src = Image.open(SRC).convert("RGBA")
    arr = np.array(src)
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    mask = ~((r > 240) & (g > 240) & (b > 240))
    ys, xs = np.where(mask)
    x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    crop = src.crop((x0, y0, x1 + 1, y1 + 1))
    w, h = crop.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(crop, ((side - w) // 2, (side - h) // 2))
    pix = np.array(square)
    rr, gg, bb = pix[:, :, 0].astype(int), pix[:, :, 1].astype(int), pix[:, :, 2].astype(int)
    bg = (np.abs(rr - 247) < 14) & (np.abs(gg - 247) < 14) & (np.abs(bb - 247) < 14)
    pix[:, :, 3] = np.where(bg, 0, pix[:, :, 3])
    return Image.fromarray(pix)


def sample_color(img: Image.Image, y_ratio: float) -> tuple[int, int, int, int]:
    side = img.size[0]
    y = min(side - 1, max(0, int(side * y_ratio)))
    for x in range(side // 5, 4 * side // 5):
        p = img.getpixel((x, y))
        if p[3] > 220 and p[2] > 80 and p[0] < 160 and (p[2] > p[0] + 15 or p[0] < 90):
            return p
    return (37, 99, 235, 255)


def gradient(size: int, c1: tuple[int, int, int, int], c2: tuple[int, int, int, int]) -> Image.Image:
    g = Image.new("RGBA", (size, size))
    px = g.load()
    for y in range(size):
        t = y / (size - 1)
        col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
        for x in range(size):
            px[x, y] = col
    return g


def maskable(square: Image.Image, size: int, top, bot) -> Image.Image:
    bg = gradient(size, top, bot)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.70)
    icon = square.resize((inner, inner), Image.Resampling.LANCZOS)
    layer.paste(icon, ((size - inner) // 2, (size - inner) // 2), icon)
    return Image.alpha_composite(bg, layer)


def main() -> None:
    square = load_square()
    top = sample_color(square, 0.18)
    bot = sample_color(square, 0.82)
    if bot[0] > 180 and bot[1] > 180 and bot[2] > 180:
        bot = (14, 165, 233, 255)
    any512 = square.resize((512, 512), Image.Resampling.LANCZOS)
    any192 = square.resize((192, 192), Image.Resampling.LANCZOS)
    any512.save(PUBLIC / "icon-512.png", "PNG", optimize=True)
    any192.save(PUBLIC / "icon-192.png", "PNG", optimize=True)
    maskable(square, 512, top, bot).save(PUBLIC / "icon-maskable-512.png", "PNG", optimize=True)
    maskable(square, 192, top, bot).save(PUBLIC / "icon-maskable-192.png", "PNG", optimize=True)
    print("icons", top, bot)


if __name__ == "__main__":
    main()
