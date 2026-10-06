"""Read sampled frames without a seek per sample.

The scene classifiers sample a handful of frames per scene with
``cap.set(CAP_PROP_POS_FRAMES, i); cap.read()``. On H.264 every such seek
decodes again from the previous keyframe, so a clip's ~100 samples decoded
the same GOPs over and over: 89 CPU-s for one 20 s clip, against 6 CPU-s for
a single forward pass that keeps the frames asked for (prod bench,
25-sep-2026). The frames are byte-identical either way (checked on 217
samples of NVENC-cut clips), so every downstream decision stays the same.
"""
import cv2

# Past this many frames ahead, one seek is cheaper than decoding forward to
# the target (an NVENC cut's GOP is ~250 frames).
MAX_FORWARD = 300


def read_at(cap, indices, max_forward=MAX_FORWARD):
    """Yield ``cap.read()``'s frame for each index in ``indices``, in order,
    or None where a seek + read would have failed (past the last frame).

    ``cap`` must be freshly opened (positioned at frame 0). Indices should be
    non-decreasing to get the forward-pass saving; a step backwards or a jump
    past ``max_forward`` seeks exactly like the callers used to. A repeated
    index yields the same frame object again: treat frames as read-only.
    """
    pos = 0            # index of the frame the next grab() decodes
    last = (None, None)
    for idx in indices:
        idx = int(idx)
        if idx == last[0]:
            yield last[1]
            continue
        if idx < pos or idx - pos > max_forward:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            pos = idx
        frame = None
        while pos < idx:
            if not cap.grab():
                break
            pos += 1
        if pos == idx:
            ok, frame = cap.read()
            pos += 1
            if not ok:
                frame = None
        last = (idx, frame)
        yield frame
