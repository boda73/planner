#!/usr/bin/env python3
"""Bake ground textures from the satellite photo (images/planner/planCosmos.png).

  assets/ground/context.jpg   warped satellite, plot-aligned, X ∈ [-12, 26], Y ∈ [-11, 34]  @ 32 px/m  (1216×1440)
  assets/ground/lawn.jpg      clean lawn for the fenced area, X ∈ [-1.7, 20], Y ∈ [0, 25.4]  @ 64 px/m  (1389×1626)

Both are "north up" in PLOT coordinates: left edge = X0, top edge = Y1.
The affine below is the survey result (see docs/SURVEY.md); change it there and here together.

  python3 tools/bake_ground.py
"""
import numpy as np
from PIL import Image, ImageFilter

SRC = 'images/planner/planCosmos.png'
O = (204.8, 777.1)        # satellite pixel of the plot's SW corner
U = (26.41, 5.61)         # pixels per metre of +X (east)
V = (4.22, -26.67)        # pixels per metre of +Y (north)

CONTEXT = dict(X0=-12, Y0=-11, X1=26, Y1=34, R=32)
FAR_GROUND = np.array([88, 102, 72], np.float32) / 255     # colour the context fades to at its rim (use it for the far ground)
LAWN = dict(X0=-1.7, Y0=0, X1=20, Y1=25.4, R=64)      # = SITE.plot.bounds (the fenced area)
LAWN_TARGET = np.array([104, 128, 56], np.float32) / 255     # mean lawn colour seen in the ground-level photos


def warp(src, X0, Y0, X1, Y1, R, resample=Image.BICUBIC):
    W, H = int(round((X1 - X0) * R)), int(round((Y1 - Y0) * R))
    a, b = U[0] / R, -V[0] / R
    d, e = U[1] / R, -V[1] / R
    c = O[0] + X0 * U[0] + Y1 * V[0] + 0.5 * (a + b) - 0.5
    f = O[1] + X0 * U[1] + Y1 * V[1] + 0.5 * (d + e) - 0.5
    coeffs = (a, b, c, d, e, f)
    img = src.transform((W, H), Image.AFFINE, coeffs, resample=resample)
    mask = Image.new('L', src.size, 255).transform((W, H), Image.AFFINE, coeffs, resample=Image.BILINEAR)
    return np.asarray(img, np.float32) / 255, np.asarray(mask, np.float32) / 255


def blur(a, radius):
    """Gaussian blur of a float array (H×W or H×W×C) via PIL."""
    if a.ndim == 2:
        im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), 'L')
        return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), np.float32) / 255
    return np.stack([blur(a[..., i], radius) for i in range(a.shape[2])], axis=2)


def masked_fill(img, mask, radii):
    """Fill pixels where mask≈0 with a normalised blur of the valid pixels, coarsest radius last."""
    out = img.copy()
    have = mask.copy()
    for r in radii:
        num, den = blur(img * mask[..., None], r), blur(mask, r)
        est = num / np.maximum(den[..., None], 1e-4)
        ok = den > 0.02
        w = (1 - have) * ok
        out = out * (1 - w[..., None]) + est * w[..., None]
        have = np.maximum(have, ok.astype(np.float32))
    mean = (img * mask[..., None]).sum((0, 1)) / max(mask.sum(), 1)
    return out * have[..., None] + mean * (1 - have[..., None])


def value_noise(shape, cell, rng):
    h, w = shape
    small = rng.random((max(2, h // cell + 2), max(2, w // cell + 2))).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8), 'L').resize((w, h), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255 - 0.5


def save(a, path, q=86):
    Image.fromarray(np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8), 'RGB').save(path, quality=q, optimize=True)
    print('wrote', path, a.shape[1], 'x', a.shape[0])


def main():
    src = Image.open(SRC).convert('RGB')
    rng = np.random.default_rng(7)

    # ---- context: the satellite itself, with the uncovered rim filled by blurred neighbours
    img, mask = warp(src, **CONTEXT)
    valid = (mask > 0.99).astype(np.float32)
    ctx = masked_fill(img, valid, [12, 40])
    # feather: fully satellite 1.5 m inside the covered area, fading to FAR_GROUND at its rim and beyond
    inner = np.clip((blur(valid, 40) - 0.5) * 2.4, 0, 1) * valid
    inner = blur(inner, 10)
    edge = np.ones_like(inner)
    f = 64                                                    # also fade at the texture border (2 m)
    ramp = np.clip(np.arange(inner.shape[1]) / f, 0, 1); edge *= np.minimum(ramp, ramp[::-1])[None, :]
    ramp = np.clip(np.arange(inner.shape[0]) / f, 0, 1); edge *= np.minimum(ramp, ramp[::-1])[:, None]
    w = (inner * edge)[..., None]
    ctx = ctx * w + FAR_GROUND * (1 - w)
    save(ctx, 'assets/ground/context.jpg', 84)

    # ---- lawn: keep the real large-scale colour of the grass, drop shadows / roofs / paving / trampoline
    img, mask = warp(src, **LAWN)
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    grassy = (lum > 0.33) & (lum < 0.66) & (g > b * 1.04) & (g > r * 0.9) & (mask > 0.99)
    m = blur(grassy.astype(np.float32), 3)
    m = (m > 0.85).astype(np.float32)
    base = masked_fill(img, m, [20, 60, 160, 400])
    base = blur(base, 28)                                   # ≈0.45 m: only patchiness survives
    # recolour: satellite grass is washed out; pull its mean to what the eye-level photos show, keep the variation
    mean = base.reshape(-1, 3).mean(0)
    base = LAWN_TARGET * (1 + 1.0 * (base - mean) / mean.mean())
    shape = base.shape[:2]
    lumn = (0.10 * value_noise(shape, 96, rng) + 0.10 * value_noise(shape, 28, rng)
            + 0.10 * value_noise(shape, 9, rng) + 0.12 * value_noise(shape, 3, rng)
            + 0.10 * (rng.random(shape).astype(np.float32) - 0.5))
    warm = value_noise(shape, 150, rng) + 0.6 * value_noise(shape, 40, rng)     # yellowish / dry patches
    lawn = base * (1 + lumn)[..., None]
    lawn[..., 0] *= 1 + 0.12 * warm
    lawn[..., 2] *= 1 - 0.08 * warm
    save(lawn, 'assets/ground/lawn.jpg', 88)


if __name__ == '__main__':
    main()
