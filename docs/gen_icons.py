#!/usr/bin/env python3
"""Generate BrainByte app icons from the SVG using Pillow.
Draws the icon programmatically to avoid SVG rendering dependencies."""

import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ICON_SIZES = {
    os.path.join(ROOT, "mobile/assets/icon.png"): 1024,
    os.path.join(ROOT, "mobile/assets/adaptive-icon.png"): 1024,
    os.path.join(ROOT, "mobile/assets/splash.png"): 1284,
    os.path.join(ROOT, "mobile/assets/favicon.png"): 48,
}

PURPLE = (182, 160, 255)  # #b6a0ff — primary
CYAN = (0, 227, 253)  # #00e3fd — secondary
DARK_BG = (10, 10, 10)  # #0a0a0a
DARK_RING = (26, 26, 26)  # #1a1a1a


def draw_icon(size: int, output_path: str):
    """Draw the BrainByte 'B' icon at the given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = size / 2
    cy = size / 2
    r = size * 0.48  # outer radius

    # Background circle
    draw.ellipse(
        [(cx - r, cy - r), (cx + r, cy + r)],
        fill=DARK_BG,
    )
    draw.ellipse(
        [(cx - r, cy - r), (cx + r, cy + r)],
        outline=DARK_RING,
        width=max(1, int(size * 0.008)),
    )

    # Subtle accent ring
    accent_r = r - size * 0.012
    draw.ellipse(
        [(cx - accent_r, cy - accent_r), (cx + accent_r, cy + accent_r)],
        outline=PURPLE + (76,),  # 30% opacity
        width=max(1, int(size * 0.003)),
    )

    # ── "B" logomark ──────────────────────────────────────────
    stem_width = int(size * 0.07)
    stem_x = int(cx - size * 0.17)
    stem_left = stem_x - stem_width // 2
    stem_top = int(cy - size * 0.24)
    stem_bottom = int(cy + size * 0.24)

    # Left stem
    draw.rounded_rectangle(
        [(stem_left, stem_top), (stem_left + stem_width, stem_bottom)],
        radius=stem_width // 2,
        fill=PURPLE,
    )

    # Bowl stroke width
    bowl_sw = int(size * 0.065)
    bowl_right = int(cx + size * 0.18)
    bowl_mid_y = int(cy)

    # Upper bowl arc (from stem top going right, curving down to middle)
    upper_bowl_cy = int(cy - size * 0.09)
    upper_bowl_rx = bowl_right - stem_x
    upper_bowl_ry = int(size * 0.10)

    draw.arc(
        [
            (stem_x, upper_bowl_cy - upper_bowl_ry),
            (stem_x + 2 * upper_bowl_rx, upper_bowl_cy + upper_bowl_ry),
        ],
        start=200,
        end=340,
        fill=PURPLE,
        width=bowl_sw,
    )

    # Lower bowl arc (from middle, curving right down, returning to stem bottom)
    lower_bowl_cy = int(cy + size * 0.09)
    lower_bowl_rx = bowl_right - stem_x
    lower_bowl_ry = int(size * 0.10)

    draw.arc(
        [
            (stem_x, lower_bowl_cy - lower_bowl_ry),
            (stem_x + 2 * lower_bowl_rx, lower_bowl_cy + lower_bowl_ry),
        ],
        start=20,
        end=160,
        fill=PURPLE,
        width=bowl_sw,
    )

    # ── Data dots ───────────────────────────────────────────
    dot_small = max(2, int(size * 0.008))
    dot_large = max(3, int(size * 0.011))

    left_x = int(cx - size * 0.24)
    right_x = int(cx + size * 0.24)

    # Left-side dots
    for y_pct, dot_size, color in [
        (-0.16, dot_large, CYAN),
        (-0.05, dot_small, PURPLE),
        (0.07, dot_large, CYAN),
        (0.18, dot_small, PURPLE),
    ]:
        y = int(cy + y_pct * size)
        r = dot_size
        draw.ellipse(
            [(left_x - r, y - r), (left_x + r, y + r)],
            fill=color + (150,),
        )

    # Right-side dots
    for y_pct, dot_size, color in [
        (-0.14, dot_large, CYAN),
        (0.0, dot_large, PURPLE),
        (0.13, dot_large, CYAN),
    ]:
        y = int(cy + y_pct * size)
        r = dot_size
        draw.ellipse(
            [(right_x - r, y - r), (right_x + r, y + r)],
            fill=color + (150,),
        )

    # ── Save ────────────────────────────────────────────────
    img.save(output_path, "PNG")
    print(f"  ✓ {output_path} ({size}x{size})")


if __name__ == "__main__":
    for output_path, size in ICON_SIZES.items():
        draw_icon(size, output_path)
    print("Done! All app icons generated.")
