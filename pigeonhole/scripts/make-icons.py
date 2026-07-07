#!/usr/bin/env python3
"""Generate Pigeonhole add-in icons (2x2 pigeonhole grid mark) as PNGs."""

from PIL import Image, ImageDraw
import os

INK = (27, 42, 65, 255)        # #1B2A41
PAPER = (244, 241, 234, 115)   # #F4F1EA @ 45%
ACCENT = (232, 168, 124, 255)  # #E8A87C

OUT = os.path.join(os.path.dirname(__file__), "..", "addin", "assets")


def rounded(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_icon(size):
    scale = 8  # supersample for crisp edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    m = s * 2 // 32               # outer margin
    rounded(d, (m, m, s - m, s - m), radius=s * 7 // 32, fill=INK)

    cell = s * 7 // 32
    gap = s * 2 // 32
    x0 = (s - 2 * cell - gap) // 2
    y0 = x0
    r = max(scale, s // 21)
    for row in range(2):
        for col in range(2):
            x = x0 + col * (cell + gap)
            y = y0 + row * (cell + gap)
            fill = ACCENT if (row, col) == (1, 1) else PAPER
            rounded(d, (x, y, x + cell, y + cell), radius=r, fill=fill)

    img = img.resize((size, size), Image.LANCZOS)
    path = os.path.join(OUT, f"icon-{size}.png")
    img.save(path)
    print(f"wrote {path}")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for size in (16, 32, 64, 80, 128):
        make_icon(size)
