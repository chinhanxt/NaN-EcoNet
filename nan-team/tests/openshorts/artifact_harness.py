"""Delivered-pixel audit for the clean -> hook -> captioned render stages.

Frames are decoded by FFmpeg with passthrough timing, so frame N here is frame N
of the file, never a timestamp seek. Hook pixels are what changed between the
clean and hooked stages; caption pixels are what changed between the hooked and
final stages. Faces are checked only with a caller-supplied detector; the
synthetic detectors in tests prove geometry and sampling, not face accuracy.

Jobs burn hook + captions in ONE encode, so <clip>-hook.mp4 exists only when the
worker ran with OPENSHORTS_KEEP_HOOK_STAGE=1 (second output of the same decode;
the delivered file is unchanged).

    python tests/openshorts/artifact_harness.py CLEAN HOOKED FINAL CLIP_JSON [--detect-faces]

CLIP_JSON is one rendered clip receipt (renderDecision.hookPlacement) or a bare
hookPlacement; its durationSeconds (else designDecision.hook.durationSeconds) sets
the expected hook frames. continuousClearanceVerified is reported true only when
the caption audit passed AND faces were checked on every visible hook frame
(--detect-faces runs the engine's face detector on the clean stage).
Exit status 1 means a check failed.
"""
import argparse
from fractions import Fraction
import itertools
import json
import math
from pathlib import Path
import subprocess
import sys

import numpy as np

# Burned text and hook boxes differ from flat footage by >100 levels; CRF18
# generation loss stays far below 64. The block density drops isolated ringing.
THRESHOLD = 64
BLOCK = 4
DENSITY = .25
MIN_HOOK_PIXELS = 32


def _stream(path, entries, extra=()):
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', *extra, '-select_streams', 'v:0',
                                               '-show_entries', 'stream=' + entries, '-of', 'json', str(path)],
                                              timeout=900))
    return data['streams'][0]


def size(path):
    stream = _stream(path, 'width,height')
    return int(stream['width']), int(stream['height'])


def frame_rate(path):
    return float(Fraction(_stream(path, 'r_frame_rate')['r_frame_rate']))


def frame_count(path):
    """Frames the demuxer+decoder actually return, not the container estimate."""
    return int(_stream(path, 'nb_read_frames', ['-count_frames'])['nb_read_frames'])


def sampled(index, dense, step):
    """Frame indices kept by frames(path, dense, step): all below `dense`, then every `step`-th."""
    return index < dense or (index - dense) % step == 0


def frames(path, dense=None, step=1):
    """Yield decoded BGR frames in presentation order, one at a time.

    With `dense`, only frames for which sampled(n, dense, step) holds are converted and piped
    (FFmpeg's select on the decoder frame number n, so indices stay exact)."""
    width, height = size(path)
    length = width * height * 3
    select = [] if dense is None else ['-vf', f'select=lt(n\\,{dense})+gte(n\\,{dense})*not(mod(n-{dense}\\,{step}))']
    process = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', str(path), '-an', *select, '-fps_mode', 'passthrough',
                                '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-'],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    try:
        while True:
            buffer = process.stdout.read(length)
            if len(buffer) < length:
                break
            yield np.frombuffer(buffer, dtype=np.uint8).reshape(height, width, 3)
    except GeneratorExit:
        process.kill()
        raise
    finally:
        process.stdout.close()
        code = process.wait()
    if code:
        raise RuntimeError(f'FFmpeg could not decode {path}')


def lockstep(*paths, dense=None, step=1):
    """Frame-aligned tuples across render stages; unequal lengths are an error."""
    for group in itertools.zip_longest(*(frames(path, dense, step) for path in paths)):
        if any(frame is None for frame in group):
            raise AssertionError('Render stages decode to different frame counts: ' + ', '.join(map(str, paths)))
        yield group


def changed(before, after, threshold=THRESHOLD, block=BLOCK, density=DENSITY):
    """Pixels that really changed between two stages, ignoring sparse encode noise."""
    diff = np.abs(before.astype(np.int16) - after.astype(np.int16)).max(axis=2) > threshold
    height, width = diff.shape
    padded = np.pad(diff, ((0, -height % block), (0, -width % block)))
    dense = padded.reshape(padded.shape[0] // block, block, padded.shape[1] // block, block).mean(axis=(1, 3))
    keep = np.repeat(np.repeat(dense >= density, block, axis=0), block, axis=1)[:height, :width]
    return diff & keep


def bbox(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]


def overlaps(a, b):
    return a[0] < b[0] + b[2] and a[0] + a[2] > b[0] and a[1] < b[1] + b[3] and a[1] + a[3] > b[1]


def inside(box, region):
    return (box[0] >= region[0] and box[1] >= region[1] and
            box[0] + box[2] <= region[0] + region[2] and box[1] + box[3] <= region[1] + region[3])


def pixels_in(mask, rect):
    x, y, w, h = rect
    return int(mask[max(0, y):max(0, y + h), max(0, x):max(0, x + w)].sum())


def outside(mask, regions):
    """Count of mask pixels covered by none of the regions."""
    covered = np.zeros(mask.shape, dtype=bool)
    for x, y, w, h in regions:
        covered[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = True
    return int((mask & ~covered).sum())


def runs(indices):
    """[[first, last], ...] for sorted frame indices; keeps receipts small."""
    result = []
    for index in indices:
        if result and index == result[-1][1] + 1:
            result[-1][1] = index
        else:
            result.append([index, index])
    return result


def audit(clean, hooked, final, placement, hook_seconds=None, face_detector=None, sample_seconds=None, margin_seconds=.5):
    """Check every frame on which the hook is actually visible in the delivered file.

    face_detector(frame) -> [{'box': [x, y, w, h]}] is run on the clean frame of every
    visible hook frame; without it face clearance stays unverified.

    sample_seconds (needs a hook duration) keeps every frame of the hook window plus
    margin_seconds dense (hook, caption and face checks on each frame there) and checks the
    rest every sample_seconds. The verdict already fails any visible hook frame past the
    window, so faces are not detected beyond window + margin.
    """
    rect = [int(placement[key]) for key in ('x', 'y', 'width', 'height')]
    bands = placement.get('captionBands') or []
    if hook_seconds is None:
        hook_seconds = placement.get('durationSeconds')
    fps = frame_rate(final)
    dense, step = None, 1
    if sample_seconds and hook_seconds is not None:
        dense = math.ceil(float(hook_seconds) * fps - 1e-6) + math.ceil(margin_seconds * fps)
        step = max(1, int(round(float(sample_seconds) * fps)))
    probed = {name: frame_count(path) for name, path in (('clean', clean), ('hooked', hooked), ('final', final))}
    indices = (n for n in itertools.count() if dense is None or sampled(n, dense, step))
    visible, captioned, collisions, escapes, faces, scanned = [], [], [], [], [], 0
    for index, (base, hook, delivered) in zip(indices, lockstep(clean, hooked, final, dense=dense, step=step)):
        scanned += 1
        if pixels_in(changed(base, hook), rect) < MIN_HOOK_PIXELS:
            continue
        visible.append(index)
        if (face_detector is not None and (dense is None or index < dense)
                and any(overlaps(rect, face['box']) for face in face_detector(base))):
            faces.append(index)
        caption = changed(hook, delivered)
        if caption.any():
            captioned.append(index)
        if pixels_in(caption, rect):
            collisions.append(index)
        if bands and outside(caption, bands):
            escapes.append(index)
    total = scanned
    if dense is not None:
        # Sampled scan: the decoded count must equal what the probed length implies, so a short decode still fails.
        expected_scans = sum(1 for n in range(probed['final']) if sampled(n, dense, step))
        if scanned != expected_scans:
            raise AssertionError(f'Decoded {scanned} sampled frames, expected {expected_scans} from the probed frame count')
        total = probed['final']
    report = {'frames': total, 'fps': fps,
              'probedFrames': probed,
              'scan': {'denseFrames': total if dense is None else min(dense, total), 'sampleStepFrames': step,
                       'scannedFrames': scanned, 'faceDetectedUntilFrame': total if dense is None else min(dense, total)},
              'hookRect': rect, 'reservedCaptionBands': bands,
              'hookVisibleFrames': runs(visible), 'captionDuringHookFrames': runs(captioned),
              'captionInsideHookFrames': runs(collisions),
              'captionOutsideReservedBandFrames': runs(escapes),
              'faceAudit': face_detector is not None, 'hookOverFaceFrames': runs(faces)}
    passed = (not collisions and not escapes and bool(visible) and
              set(report['probedFrames'].values()) == {total})
    if hook_seconds is not None:
        # Hook shown for D seconds covers frames with t < D on a CFR clip starting at 0.
        report['expectedHookFrames'] = math.ceil(float(hook_seconds) * fps - 1e-6)
        report['hookVisibleCount'] = len(visible)
        passed = passed and visible == list(range(report['expectedHookFrames']))
    passed = passed and not faces
    report['passed'] = passed
    report['continuousClearanceVerified'] = passed and face_detector is not None
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description='Audit one rendered clip across clean, hook and final stages.')
    for name in ('clean', 'hooked', 'final', 'clip_json'):
        parser.add_argument(name)
    parser.add_argument('--detect-faces', action='store_true',
                        help='run the engine face detector on every visible hook frame')
    parser.add_argument('--sample-outside-hook', type=float, default=None, metavar='SECONDS',
                        help='scan every frame of the hook window + 0.5 s, then one frame per SECONDS')
    args = parser.parse_args(argv)
    clip = json.loads(Path(args.clip_json).read_text())
    placement = (clip.get('renderDecision', {}).get('hookPlacement') or clip.get('hookPlacement')
                 or (clip if 'width' in clip and 'y' in clip else None))
    if not placement:
        parser.error('clip receipt has no hookPlacement')
    seconds = placement.get('durationSeconds') or clip.get('designDecision', {}).get('hook', {}).get('durationSeconds')
    detector = None
    if args.detect_faces:
        engine = Path(__file__).resolve().parents[2] / 'packages/openshorts-engine'
        sys.path[:0] = [str(engine / 'src'), str(engine / 'core')]
        import tracking
        detector = tracking.detect_face_candidates
    report = audit(args.clean, args.hooked, args.final, placement, seconds, detector, args.sample_outside_hook)
    print(json.dumps(report, indent=2))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
