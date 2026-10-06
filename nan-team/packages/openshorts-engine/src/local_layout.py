"""Conservative local layout evidence. Unknown evidence always goes to AGY.

Sample once per source scene; faces, screen metrics, bubble geometry and fallback
AGY all consume those same JPEGs. Never infer speaker identity from face count.
Reframe retains its existing per-frame TRACK/GENERAL/speaker-cut decisions.
"""
import math

import agy_compat


def screen_metrics(frame):
    import cv2
    import numpy as np
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (640, 360))
    # Ignore the bottom fifth (subtitles/tickers). Text must span BOTH halves.
    gray = gray[18:288]
    edges = cv2.Canny(gray, 60, 160)
    flat = float(np.mean(cv2.absdiff(gray, cv2.GaussianBlur(gray, (5, 5), 0)) < 3))
    mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    glyphs = [s for s in stats[1:count] if 2 <= s[2] <= 24 and 4 <= s[3] <= 22
              and 4 <= s[4] <= 220 and s[4] / (s[2]*s[3]) > .12]
    halves = [sum(1 for s in glyphs if (s[0] < 320) == left) for left in (True, False)]
    return {'edgeDensity': round(float(np.mean(edges > 0)), 4),
            'flatFraction': round(flat, 4), 'textHalves': halves}


def classify_sample(faces, width, height, metrics):
    sizes = [min(b['box'][2]/width, b['box'][3]/height) for b in faces]
    # Small inset heads must never turn a desktop into a talking-head crop.
    large = sum(size >= .05 for size in sizes)
    screen = (metrics['flatFraction'] >= .70 and .008 <= metrics['edgeDensity'] <= .20
              and min(metrics['textHalves']) >= 8)
    return {'faceCount': len(faces), 'largeFaces': large,
            'faceSizes': [round(s, 4) for s in sizes], 'screenLike': screen, **metrics}


def scene_kind(samples, bubble):
    if len(samples) < 3:
        return 'ambiguous'
    if bubble and all(s['screenLike'] and s['faceCount'] == 1 and max(s['faceSizes']) < .16 for s in samples):
        return 'screen'
    if bubble:
        return 'ambiguous'
    # Burned-in name titles can make a single camera frame look text-heavy: a scene
    # counts as a shot of people when most samples agree, a screen only with a bubble.
    if sum(s['screenLike'] for s in samples) * 3 > len(samples):
        return 'ambiguous'
    if all(s['largeFaces'] >= 2 for s in samples):
        return 'group'
    if all(s['largeFaces'] == 1 for s in samples):
        return 'camera'
    if not any(s['largeFaces'] or s['screenLike'] for s in samples):
        return 'wide'  # people too small to crop to, or b-roll: core picks GENERAL/TRACK
    return 'ambiguous'


def _fraction(records, test):
    total = sum(r['endSeconds'] - r['startSeconds'] for r in records) or 1
    return sum((r['endSeconds'] - r['startSeconds']) * sum(map(test, r['samples'])) / len(r['samples'])
               for r in records) / total


class Evidence:
    def __init__(self, source, info, scenes):
        self.source, self.info, self.scenes = source, info, scenes
        self.frames, self.records, self.error = [], [], None
        self._read()

    def _read(self):
        try:
            import cv2
            import camera_inset
            import screencast_layout
            schedule = []
            for scene in self.scenes:
                a, b = scene['startSeconds'], scene['endSeconds']
                n = max(3, math.ceil((b-a)/8))
                schedule.append([a+(b-a)*(i+.5)/n for i in range(n)])
            if sum(map(len, schedule)) > 72:
                self.error = 'sample-budget'
                return
            self.frames = agy_compat.sample_times(self.source, [t for ts in schedule for t in ts], width=1280)
            if len(self.frames) != sum(map(len, schedule)):
                raise ValueError('incomplete layout samples')
            cursor = 0
            for scene, times in zip(self.scenes, schedule):
                samples, grays, corner_faces = [], [], []
                for ref in self.frames[cursor:cursor+len(times)]:
                    frame = cv2.imread(ref['path'])
                    if frame is None:
                        raise ValueError('unreadable layout frame')
                    h, w = frame.shape[:2]
                    faces = screencast_layout.detect_faces_full_res(frame)
                    metrics = screen_metrics(frame)
                    samples.append(classify_sample(faces, w, h, metrics))
                    grays.append(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY))
                    box = max(faces, key=lambda f: f['score'])['box'] if faces else None
                    if box and camera_inset.is_cornered(box, w, h):
                        corner_faces.append(box)
                bubble = camera_inset.bubble_from_samples(grays, corner_faces, w, h, len(times))
                self.records.append({**scene, 'kind': scene_kind(samples, bubble),
                                     'samples': samples, 'bubble': bubble})
                cursor += len(times)
        except Exception as error:
            # Missing ML runtime / decode failure is uncertainty, never "no faces".
            self.error = type(error).__name__ + ': ' + str(error)[:160]
            self.records = []

    def layout(self, aspect):
        """Mirrors LAYOUT_CHOICE_PROMPT: screencast only for a screen with a camera
        bubble, "split" (speaker-cut) only for two people in the same shot in most
        frames, otherwise "none" (auto). Anything in between is None: ask AGY."""
        self.reason = None
        if self.error or not self.records:
            return None
        kinds = [r['kind'] for r in self.records]
        if all(k == 'screen' for k in kinds):
            self.reason = 'screen-with-camera-bubble'
            return 'screencast'
        if any(k in ('screen', 'ambiguous') for k in kinds):
            return None
        ratio = {'9:16': 9/16, '16:9': 16/9, '1:1': 1}.get(aspect)
        if ratio and self.info['width'] / self.info['height'] <= ratio + .01:
            # Already fits the target: core passes it through; no people crop to choose.
            self.reason = 'source-fits-target-aspect'
            return 'auto'
        two = _fraction(self.records, lambda s: s['largeFaces'] >= 2)
        face = _fraction(self.records, lambda s: s['largeFaces'] >= 1)
        if two >= .8:
            self.reason = 'two-people-same-shot'
            return 'speaker-cut'
        if two <= .2 and face >= .5:
            # Mixed close-ups/wide shots keep the core's per-scene TRACK/GENERAL choice.
            self.reason = 'single-subject-shots'
            return 'auto'
        return None

    def ranges(self, segments):
        if self.error or not self.records:
            return None
        result, offset = [], 0
        for segment in segments:
            cursor = segment['start']
            for record in self.records:
                a, b = max(segment['start'], record['startSeconds']), min(segment['end'], record['endSeconds'])
                if b <= a:
                    continue
                if record['kind'] != 'screen' or a > cursor + .001:
                    return None
                result.append([offset+a-segment['start'], offset+b-segment['start'], 'screen content', 1.0])
                cursor = b
            if cursor < segment['end'] - .001:
                return None
            offset += segment['end']-segment['start']
        return result or None

    def frames_for(self, segments):
        frames = [f for f in self.frames if any(s['start'] <= f['timestampSeconds'] < s['end'] for s in segments)]
        # Each selected interval needs evidence; do not reuse unrelated frames.
        if not all(any(s['start'] <= f['timestampSeconds'] < s['end'] for f in frames) for s in segments):
            return []
        return spread(frames)

    def receipt(self, source, layout):
        return {'source': source, 'layout': layout,
                **({'reason': self.reason} if getattr(self, 'reason', None) and source == 'local' else {}),
                'scenes': [{'startSeconds': r['startSeconds'], 'endSeconds': r['endSeconds'],
                            'kind': r['kind'], 'bubble': bool(r['bubble']),
                            'faces': [s['faceCount'] for s in r['samples']]} for r in self.records],
                **({'uncertainty': self.error} if self.error else {})}


def spread(frames, count=6):
    """At most `count` evenly spread frames: the AGY fallback keeps its old 6-frame prompt."""
    return frames if len(frames) <= count else [frames[int((i+.5)*len(frames)/count)] for i in range(count)]
