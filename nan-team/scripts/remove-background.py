#!/usr/bin/env python3
"""Remove an image background: transparent PNG out. Usage: remove-background.py <in> <out>

rembg first (isnet-general-use when its model is already in ~/.u2net, else u2net; never downloads),
then a light edge clean-up of the alpha. If rembg fails, a near-uniform background (white sticker
paper, flat color) is removed by flood fill from the border with a tolerance and a feathered edge.
Prints one JSON line: {"method", "width", "height"}.
"""
import json
import os
import sys

import cv2
import numpy as np

MODEL_DIR = os.environ.get('U2NET_HOME', os.path.expanduser('~/.u2net'))
FLOOD_TOLERANCE = 18      # per-channel distance from the border color still counted as background
UNIFORM_BORDER_STD = 12   # border pixels must be this uniform for the flood-fill fallback


def load_rgba(path):
    image = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError('unreadable image')
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def smooth_alpha(alpha):
    """Drop speckles and soften the cut edge by about one pixel."""
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    soft = cv2.GaussianBlur(alpha, (3, 3), 0)
    # Keep solid interiors solid; only the edge band takes the blurred value.
    return np.where((alpha == 255) & (soft >= 250), 255, soft).astype(np.uint8)


def with_rembg(path):
    from rembg import new_session, remove
    name = 'isnet-general-use' if os.path.exists(os.path.join(MODEL_DIR, 'isnet-general-use.onnx')) else 'u2net'
    if not os.path.exists(os.path.join(MODEL_DIR, name + '.onnx')):
        raise RuntimeError('no local rembg model')
    with open(path, 'rb') as handle:
        data = remove(handle.read(), session=new_session(name))
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_UNCHANGED)
    if image is None or image.ndim != 3 or image.shape[2] != 4:
        raise RuntimeError('rembg returned no alpha')
    image[:, :, 3] = smooth_alpha(image[:, :, 3])
    return image, 'rembg-' + name


def with_flood_fill(path):
    image = load_rgba(path)
    bgr = image[:, :, :3]
    border = np.concatenate([bgr[0], bgr[-1], bgr[:, 0], bgr[:, -1]]).astype(np.float32)
    if border.std(axis=0).max() > UNIFORM_BORDER_STD:
        raise RuntimeError('background is not uniform enough for flood fill')
    height, width = bgr.shape[:2]
    mask = np.zeros((height + 2, width + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | cv2.FLOODFILL_FIXED_RANGE | (255 << 8)
    tolerance = (FLOOD_TOLERANCE,) * 3
    seeds = [(x, 0) for x in range(0, width, 8)] + [(x, height - 1) for x in range(0, width, 8)] \
        + [(0, y) for y in range(0, height, 8)] + [(width - 1, y) for y in range(0, height, 8)]
    for seed in seeds:
        if mask[seed[1] + 1, seed[0] + 1] == 0:
            cv2.floodFill(bgr.copy(), mask, seed, 0, tolerance, tolerance, flags)
    background = mask[1:-1, 1:-1] > 0
    alpha = np.where(background, 0, image[:, :, 3]).astype(np.uint8)
    image[:, :, 3] = smooth_alpha(alpha)
    return image, 'flood-fill'


def main():
    if len(sys.argv) != 3:
        sys.exit('usage: remove-background.py <in> <out>')
    source, target = sys.argv[1], sys.argv[2]
    try:
        image, method = with_rembg(source)
    except Exception as error:  # rembg missing/broken: try the deterministic fallback
        print('rembg failed (%s: %s); trying flood fill' % (type(error).__name__, error), file=sys.stderr)
        image, method = with_flood_fill(source)
    if not cv2.imwrite(target, image, [cv2.IMWRITE_PNG_COMPRESSION, 6]):
        raise RuntimeError('could not write PNG')
    print(json.dumps({'method': method, 'width': int(image.shape[1]), 'height': int(image.shape[0])}))


if __name__ == '__main__':
    main()
