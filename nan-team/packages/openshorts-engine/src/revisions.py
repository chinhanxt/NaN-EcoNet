"""Reuse verified clean revisions only when base rendering settings are unchanged."""
from pathlib import Path
import contracts
import checkpoints
import timelines
import recut

# Shortest stretch worth its own piece: a sliver of the parent is not worth a seam,
# and a new source range needs enough frames for the reframe decisions.
MIN_PIECE = recut.MIN_SEGMENT_SECONDS


def _verified(request, source_fingerprint, layout):
    """The staged parent clean artifact when it may be reused under these settings, else None."""
    reuse = request.get('reuse')
    if not reuse:
        return None
    path = Path(reuse['cleanPath']).resolve(strict=True)
    directory = Path(request['workDir']).resolve(strict=True)
    if not path.is_file() or not path.is_relative_to(directory):
        raise ValueError('Reusable clean artifact must be staged inside this job directory')
    if checkpoints.file_hash(path) != reuse.get('cleanSha256'):
        raise ValueError('Reusable clean artifact checksum mismatch')
    if reuse.get('sourceFingerprint') != source_fingerprint:
        raise ValueError('Reusable clean artifact source fingerprint mismatch')
    if settings_changed(request, layout):
        return None
    # A model/decoder upgrade must not inherit stale source speech captions.
    transcript = reuse.get('transcript', {})
    if transcript.get('segments') and request.get('audio', {}).get('mode') != 'replace-narration':
        import asr_identity
        runtime = asr_identity.current()
        if runtime['localAssetsVerified'] and transcript.get('asr', {}).get('runtime') != runtime:
            return None
    return path


def settings_changed(request, layout):
    """True when the revision deliberately changed base settings (layout, aspect, effects, audio...)."""
    reuse = request.get('reuse')
    return bool(reuse) and reuse.get('baseFingerprint') != checkpoints.base_fingerprint(request, layout)


def _canonical(request):
    return contracts.segments(request['reuse']['sourceSegments'], 21600, max_total=21600)


def candidate(request, source_fingerprint, layout, desired):
    path = _verified(request, source_fingerprint, layout)
    if path is None:
        return None
    reuse = request['reuse']
    rebased = timelines.reuse_segments(desired, _canonical(request))
    if rebased is None:
        return None
    return {'path':str(path), 'segments':rebased,
            'transcript':recut.virtual_transcript(reuse.get('transcript', {}), rebased)}


def _merge(parts):
    out = []
    for part in parts:
        last = out[-1] if out else None
        if (last and last[0] == part[0] and abs(last[2] - part[1]) < 1e-6
                and (part[0] == 'source' or abs(last[3] - part[3]) < 1e-6)):
            last[2] = part[2]
        else:
            out.append(list(part))
    return out


def _settle(parts):
    """No parent sliver shorter than MIN_PIECE; every new source range at least MIN_PIECE,
    borrowing time from a neighbouring parent piece (which then renders from source)."""
    parts = _merge([['source', a, b, None] if kind == 'clean' and b - a < MIN_PIECE - 1e-6
                    else [kind, a, b, shift] for kind, a, b, shift in parts])
    changed = True
    while changed:
        changed = False
        for index, part in enumerate(parts):
            if part[0] != 'source' or part[2] - part[1] >= MIN_PIECE - 1e-6 or len(parts) == 1:
                continue
            need = MIN_PIECE - (part[2] - part[1])
            if index + 1 < len(parts):
                after = parts[index + 1]
                if after[2] - after[1] - need >= MIN_PIECE - 1e-6:
                    part[2] += need; after[1] += need
                else:
                    after[0], after[3] = 'source', None
            else:
                before = parts[index - 1]
                if before[2] - before[1] - need >= MIN_PIECE - 1e-6:
                    part[1] -= need; before[2] -= need
                else:
                    before[0], before[3] = 'source', None
            parts = _merge(parts)
            changed = True
            break
    return parts


def pieces(desired, canonical):
    """Split each desired source interval into parent-clean pieces (time already framed in the
    base clip) and source pieces (new time). None when nothing overlaps the base clip."""
    offsets, total = [], 0.0
    for original in canonical:
        offsets.append(total)
        total += original['end'] - original['start']
    result = []
    for segment in desired:
        overlaps = sorted((max(segment['start'], c['start']), min(segment['end'], c['end']), offset - c['start'])
                          for c, offset in zip(canonical, offsets))
        parts, cursor = [], segment['start']
        for a, b, shift in overlaps:
            a = max(a, cursor)
            if b - a <= 1e-3:
                continue
            if a > cursor + 1e-3:
                parts.append(['source', cursor, a, None])
            parts.append(['clean', a, b, shift])
            cursor = b
        if cursor < segment['end'] - 1e-3:
            parts.append(['source', cursor, segment['end'], None])
        result.extend(_settle(parts))
    if not any(kind == 'clean' for kind, *_ in result):
        return None
    return [{'kind':kind, 'start':round(a, 3), 'end':round(b, 3),
             **({'cleanStart':round(a + shift, 3), 'cleanEnd':round(b + shift, 3)} if kind == 'clean' else {})}
            for kind, a, b, shift in result]


def partial(request, source_fingerprint, layout, desired):
    """Parent clean pieces for the overlapping time plus source pieces for new time only."""
    audio = request.get('audio', {})
    # A narration/music bed spans the whole clip; stitching per-piece mixes would break it.
    if audio.get('mode', 'keep') not in ('keep', 'mute') or audio.get('narrationPath') or audio.get('bgmPath'):
        return None
    # Crop override indices name scenes of the whole clip EDL, not of a new piece.
    if request.get('cropOverrides'):
        return None
    path = _verified(request, source_fingerprint, layout)
    if path is None:
        return None
    parts = pieces(desired, _canonical(request))
    return {'path':str(path), 'pieces':parts} if parts else None


def inherited_layout(request, source_fingerprint):
    """The parent's resolved layout for an 'auto' revision of the same source: the base
    clip's framing is kept instead of re-deciding it for the new ranges."""
    parent = request.get('parentAnalysis')
    if (request.get('operation') != 'edit' or request.get('layout') != 'auto' or not isinstance(parent, dict)
            or parent.get('sourceFingerprint') != source_fingerprint):
        return None
    layout = parent.get('layout')
    return layout if layout in contracts.LAYOUTS - {'auto'} else None


def lost(request, layout, desired):
    """Reuse was possible in principle (same base settings, overlapping time) but not used."""
    if not request.get('reuse') or settings_changed(request, layout):
        return False
    try:
        return pieces(desired, _canonical(request)) is not None
    except (KeyError, ValueError):
        return False
