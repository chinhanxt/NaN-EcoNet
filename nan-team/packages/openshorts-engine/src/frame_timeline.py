"""Presentation timestamps for source scene boundaries, including VFR input."""
import json
import math
import subprocess
import statistics


def _number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0


def boundaries(source):
    data = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'frame=best_effort_timestamp_time,duration_time,pkt_duration_time:stream=start_time,duration:format=duration',
        '-of', 'json', str(source)], timeout=900))
    frames = data.get('frames', [])
    if not frames:
        raise ValueError('Source presentation timeline has no frames')
    pts = [float(frame['best_effort_timestamp_time']) for frame in frames]
    if any(not math.isfinite(value) for value in pts) or any(b <= a for a,b in zip(pts, pts[1:])):
        raise ValueError('Source presentation timestamps must increase')
    origin = pts[0]
    stream = next(iter(data.get('streams', [])), {})
    last_duration = _number(frames[-1].get('duration_time')) or _number(frames[-1].get('pkt_duration_time'))
    end = pts[-1] + max(0, last_duration)
    # A known video frame duration wins over container duration (audio can be longer).
    if end <= pts[-1] and _number(stream.get('duration')) > 0:
        end = _number(stream.get('start_time', origin)) + _number(stream['duration'])
    if end <= pts[-1]:
        end = _number(data.get('format', {}).get('duration'))
    if end <= pts[-1] and len(pts) > 1:
        end = pts[-1] + statistics.median(b - a for a, b in zip(pts, pts[1:]))
    if not math.isfinite(end) or end <= pts[-1]:
        raise ValueError('Source final frame duration is unknown')
    return [value - origin for value in pts] + [end - origin]


def scene_seconds(source, scenes, duration):
    clock = boundaries(source)
    result = []
    for start, end in scenes:
        s, e = start.get_frames(), end.get_frames()
        if not 0 <= s < e < len(clock):
            raise ValueError('Scene frame boundary is outside the source timeline')
        result.append({'startSeconds':round(clock[s], 6),
                       'endSeconds':min(round(clock[e], 6), duration)})
    return result
