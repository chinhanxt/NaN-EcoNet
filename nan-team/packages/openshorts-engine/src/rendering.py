"""Reuse OpenShorts render builders and local FFmpeg; outputs stay in job dir."""
import json
import os
import subprocess
from pathlib import Path
import ffmpeg_utils
import reframe_v2
import recut
import frame_timeline
from fractions import Fraction
from contracts import ASPECTS


def _rate(value):
    try:
        rate = float(Fraction(str(value)))
        return rate if 0 < rate < float('inf') else 0.0
    except (ValueError, ZeroDivisionError, TypeError):
        return 0.0


def run(command):
    if Path(command[0]).name == 'ffmpeg':
        threads = str(int(os.environ.get('OPENSHORTS_THREADS', '1')))
        command = [command[0], '-threads', threads, '-filter_threads', threads, '-filter_complex_threads', threads, *command[1:]]
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=1800)
    if result.returncode:
        raise RuntimeError('FFmpeg failed: ' + result.stderr.decode(errors='replace')[-3000:])


def probe(path):
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
                     '-show_format', '-of', 'json', str(path)], timeout=30))
    video = next((s for s in data['streams'] if s['codec_type'] == 'video'), None)
    if video is None:
        raise ValueError('source has no video stream')
    duration = float(data['format']['duration'])
    if not 0 < duration <= 21600:
        raise ValueError('video duration is outside 0–6 hours')
    average = video.get('avg_frame_rate', '0/0')
    nominal = video.get('r_frame_rate', average)
    fps = _rate(average) or _rate(nominal)
    if not fps:
        raise ValueError('source video frame rate is unknown')
    return {'duration': duration, 'width': video['width'], 'height': video['height'],
            'fps': fps,
            'avgFrameRate': average, 'rFrameRate': nominal,
            'audio': any(s['codec_type'] == 'audio' for s in data['streams'])}


def audio_duration(path):
    """Duration of an audio-only (or any) media file; requires an audio stream, not video."""
    data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
                     '-show_format', '-of', 'json', str(path)], timeout=30))
    audio = next((s for s in data.get('streams', []) if s.get('codec_type') == 'audio'), None)
    if audio is None:
        raise ValueError('narration has no audio stream')
    try:
        duration = float(data.get('format', {}).get('duration') or audio.get('duration'))
    except (TypeError, ValueError):
        raise ValueError('narration audio duration is unknown') from None
    if not 0 < duration <= 21600:
        raise ValueError('narration audio duration is outside 0–6 hours')
    return duration


def cfr_rate(info):
    """Normalize VFR during the existing cut encode; preserve genuine CFR rates."""
    average = _rate(info['fps']) or _rate(info.get('rFrameRate'))
    if not average:
        raise ValueError('source video frame rate is unknown')
    nominal = info.get('rFrameRate', str(average))
    rate = _rate(nominal)
    if average > 0 and abs(rate - average) / average < .005:
        return nominal
    for standard in ['24000/1001', '24', '25', '30000/1001', '30', '50', '60000/1001', '60']:
        if float(Fraction(standard)) >= average:
            return standard
    return '60'


def encode(source, target, vf=None, graph=None):
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', str(source)]
    if graph:
        cmd += ['-filter_complex', graph, '-map', '[v]', '-map', '0:a?']
    elif vf:
        cmd += ['-vf', vf]
    cmd += [*ffmpeg_utils.video_encode_args(ffmpeg_utils.INTERMEDIATE), '-c:a', 'aac',
            *ffmpeg_utils.METADATA_SCRUB, '-movflags', '+faststart', str(target)]
    run(cmd)


def reframe(source, target, aspect, layout, warnings, crop_overrides=None, content_ranges=None, focus_regions=None):
    info = probe(source)
    ratio = ASPECTS[aspect]
    # Core's "already fits" includes narrower portraits to avoid unnecessary
    # subject crops. A canonical delivery request still needs its exact canvas:
    # narrower than the target is not the same aspect ratio.
    if abs(info['width'] / info['height'] - ratio) <= .01 and not crop_overrides and layout not in ('screencast', 'speaker-cut'):
        encode(source, target)
        return {'engine':'matching-aspect-passthrough','cropScenes':crop_scenes(source,info)}
    width, height = reframe_v2.delivery_size(info['width'], info['height'], ratio)
    if layout in ('general', 'wide') and not crop_overrides:
        content_h = reframe_v2.full_width_content_height(info['width'], info['height'], width)
        graph = reframe_v2.general_filtergraph(width, height,
                content_h=content_h if layout == 'wide' else None,
                orig_w=info['width'], orig_h=info['height'])
        encode(source, target, graph=graph)
        return {'engine':'core-filter-builder','layout':layout,'cropScenes':crop_scenes(source,info)}
    try:
        import tracking
    except ImportError as error:
        raise RuntimeError('Requested tracking/layout requires provisioned MediaPipe/OpenShorts ML runtime: ' + str(error)) from error
    force = {'general': 'GENERAL', 'wide': 'WIDE'}.get(layout)
    ranges = content_ranges
    if layout == 'screencast' and ranges is None:
        import screencast_layout
        ranges = screencast_layout.detect_content_ranges(str(source), info['duration'])
        if not ranges:
            raise ValueError('No validated screen-content ranges for screencast layout')
    decision = {}
    reframe_v2.render(str(source), str(target), ratio, content_ranges=ranges, force_strategy=force,
                      crop_overrides=crop_overrides, decision_receipt=decision,
                      focus_regions=focus_regions if layout == 'screencast' else None)
    if layout == 'speaker-cut' and not any(s['strategy']=='ALTERNATE' for s in decision.get('scenes',[])) \
            and not (decision.get('speakerAttribution') or {}).get('validated'):
        warnings.append('Speaker-cut requested but no validated two-speaker conversation was detected; actual scene decisions are recorded')
    if layout == 'screencast' and not any(s['strategy'] in ('SCREENCAST','INSET','FOCUS') for s in decision.get('scenes',[])):
        warnings.append('Screencast kept screen content but could not validate a stacked presenter; actual scene decisions are recorded')
    return decision


def crop_scenes(source, info):
    import scene_detection
    scenes, fps = scene_detection.detect_scenes(str(source))
    # PySceneDetect returns a Fraction in the provisioned Docker runtime.
    fps = float(fps)
    if not scenes:
        return [{'sceneIndex':0,'startSeconds':0,'endSeconds':info['duration']}]
    seconds = frame_timeline.scene_seconds(source, scenes, info['duration'])
    return [{'sceneIndex':index, **scene} for index,scene in enumerate(seconds)]


LOUDNESS_TARGET = 'I=-14:TP=-1.5:LRA=11'  # short-form social delivery loudness


def _measured_loudness(inputs, graph, duration):
    """First loudnorm pass over the final mix; None when the mix is silent or unmeasurable."""
    command = ['ffmpeg', '-hide_banner', '-nostats', '-y', *inputs, '-filter_complex',
               graph + f';[mix]loudnorm={LOUDNESS_TARGET}:print_format=json[a]', '-map', '[a]',
               '-t', duration, '-f', 'null', '-']
    result = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=1800)
    text = result.stderr.decode(errors='replace')
    if result.returncode or '{' not in text:
        return None
    try:
        values = json.loads(text[text.rindex('{'):text.rindex('}') + 1])
        measured = {key: float(values[key]) for key in ('input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset')}
    except (ValueError, KeyError):
        return None
    return measured if all(abs(value) != float('inf') for value in measured.values()) and measured['input_i'] > -70 else None


def audio_mix(source, target, audio):
    mode = audio.get('mode', 'keep')
    narration, bgm = audio.get('narrationPath'), audio.get('bgmPath')
    if mode == 'mute':
        run(['ffmpeg', '-v', 'error', '-y', '-i', str(source), '-c:v', 'copy', '-an', str(target)])
        return target
    if not narration and not bgm:
        return source
    info = probe(source)
    has_audio, duration = info['audio'], info['duration']
    inputs = ['-i', str(source)]
    original = '[0:a]' if has_audio and mode != 'replace-narration' else None
    voice = None
    if narration:
        voice = f"[{inputs.count('-i')}:a]"
        inputs += ['-i', str(narration)]
    bg_track = None
    if bgm:
        bg_track = f"[{inputs.count('-i')}:a]"
        inputs += ['-stream_loop', '-1', '-i', str(bgm)]
    graphs = []
    if original and voice:
        # Voice-over over the source: duck the original under the narration instead of equal-level summing.
        graphs += [f'{voice}apad=whole_dur={duration},asplit=2[voice][key]',
                   f'{original}apad=whole_dur={duration},volume=0.5[orig]',
                   '[orig][key]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=400[bed]',
                   '[voice][bed]amix=inputs=2:duration=longest:normalize=0[program]']
    elif original or voice:
        graphs.append(f'{original or voice}anull[program]')
    if bg_track and graphs:
        # Duck background music against actual speech, then mix without clipping.
        graphs += [f"[program]apad=whole_dur={duration},asplit=2[speech][control]",
                   bg_track + 'volume=0.2[bg]',
                   '[bg][control]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=300[ducked]',
                   '[speech][ducked]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[mix]']
    elif bg_track:
        graphs.append(bg_track + 'volume=0.2[mix]')
    elif graphs:
        graphs.append('[program]anull[mix]')
    else:
        raise ValueError('audio mix has no tracks')
    graph = ';'.join(graphs)
    measured = _measured_loudness(inputs, graph, str(duration))
    level = (f"loudnorm={LOUDNESS_TARGET}:measured_I={measured['input_i']}:measured_TP={measured['input_tp']}"
             f":measured_LRA={measured['input_lra']}:measured_thresh={measured['input_thresh']}"
             f":offset={measured['target_offset']}:linear=true,aresample=48000,") if measured else ''
    fade = max(0.0, float(duration) - 0.12)
    graph += f';[mix]{level}apad=whole_dur={duration},afade=t=out:st={fade:.3f}:d=0.12[a]'
    cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[a]',
           '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(duration), str(target)]
    run(cmd)
    return target
