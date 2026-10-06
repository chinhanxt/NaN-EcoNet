"""Source/clip timeline mapping and sentence-complete boundary validation."""
import re
import recut
import frame_timeline

END = re.compile(r'[.!?。！？][\"\'”’\)\]]*$')


def scenes(source, info):
    import scene_detection
    found, _ = scene_detection.detect_scenes(str(source))
    result = frame_timeline.scene_seconds(source, found, info['duration']) if found else []
    if not result:
        result = [{'startSeconds':0, 'endSeconds':info['duration']}]
    return result


def rebase_scenes(boundaries, segments):
    result, offset = [], 0
    for segment in segments:
        for scene in boundaries:
            start = max(segment['start'], scene['startSeconds'])
            end = min(segment['end'], scene['endSeconds'])
            if end > start:
                result.append({'startSeconds':round(offset + start - segment['start'],3),
                               'endSeconds':round(offset + end - segment['start'],3),
                               'sourceStartSeconds':start, 'sourceEndSeconds':end})
        offset += segment['end'] - segment['start']
    return result


# Large-v3-turbo often omits terminal punctuation in Vietnamese; a clear
# speech pause is then the only sentence evidence the transcript carries.
PAUSE_SECONDS = 0.45
# Silero VAD silences (asr.segmentation.speechRegions) at least this long are
# unit boundaries too: Whisper word stamps are usually contiguous, so the
# word-gap rule alone rarely fires on real speech.
VAD_PAUSE_SECONDS = 0.25


def _segment_ends(transcript):
    ends = set()
    for segment in (transcript or {}).get('segments', []):
        words = segment.get('words') or []
        if words and 'end' in words[-1]:
            ends.add(round(float(words[-1]['end']), 3))
    return ends


def _vad_pauses(transcript, minimum):
    regions = (((transcript or {}).get('asr') or {}).get('segmentation') or {}).get('speechRegions') or []
    pauses, cursor = [], None
    for start, end in sorted(regions):
        if cursor is not None and start - cursor >= minimum:
            pauses.append((cursor + start) / 2)
        cursor = end if cursor is None else max(cursor, end)
    return pauses


def sentences(transcript, pause=PAUSE_SECONDS, vad_pause=VAD_PAUSE_SECONDS):
    """Sentence units {start,end,text}: punctuation, word gaps, sparse-punctuation segment ends, VAD silences."""
    words = recut.transcript_words(transcript)
    # With sparse punctuation (fewer sentence ends than half the decoder
    # segments), segment ends (utterance-level phrase breaks) are clause
    # boundaries too.
    segment_ends = _segment_ends(transcript)
    if sum(1 for word in words if END.search(word['w'])) * 2 >= len(segment_ends):
        segment_ends = set()
    silences = _vad_pauses(transcript, vad_pause)
    result, start, text = [], None, []
    for index, word in enumerate(words):
        if start is None:
            start = word['s']
        text.append(word['w'])
        following = words[index + 1] if index + 1 < len(words) else None
        silent = following is not None and any(
            (word['s'] + word['e']) / 2 < m < (following['s'] + following['e']) / 2 for m in silences)
        if (END.search(word['w']) or following is None or following['s'] - word['e'] >= pause
                or round(word['e'], 3) in segment_ends or silent):
            result.append({'start':start, 'end':word['e'], 'text':' '.join(text)})
            start, text = None, []
    return result


def _runs(bounds, selected, minimum, maximum, duration):
    """Best contiguous run of whole units within [min,max]; None when none fits."""
    best = None
    a, b = selected['start'], selected['end']
    for i, first in enumerate(bounds):
        previous = bounds[i-1]['end'] if i else 0
        start = max(previous, first['start'] - 0.1, 0)
        for j in range(i, len(bounds)):
            following = bounds[j+1]['start'] if j + 1 < len(bounds) else duration
            end = min(following, bounds[j]['end'] + 0.1, duration)
            length = end - start
            if length > maximum + 0.1:
                break
            if length < minimum - 0.1:
                continue
            # Most spoken AI span kept (unit edges, not margins); then its
            # ending (the payoff); then its start.
            overlap = max(0.0, min(bounds[j]['end'], b) - max(first['start'], a))
            key = (-round(overlap, 1), round(abs(end - b), 2), round(abs(start - a), 2))
            if best is None or key < best[0]:
                best = (key, {'start':round(start,3), 'end':round(end,3)})
    return best and best[1]


def _word_fallback(selected, words, minimum, maximum, duration):
    """Upstream snap_clip_to_words (word edges + half the silence), forced into the band."""
    import clip_selection
    compact = [{'w':w['w'], 's':w['s'], 'e':w['e']} for w in words]
    start, end = clip_selection.snap_clip_to_words(selected['start'], selected['end'], compact, duration,
                                                   min_duration=minimum, max_duration=maximum)
    if not minimum - 0.1 <= end - start <= maximum + 0.1:
        length = min(max(end - start, minimum), maximum, duration)
        start = min(max(0.0, start), duration - length)
        target = start + length
        # Land the end in the gap after the word end nearest to the target length.
        ends = [(w['e'], nxt['s']) for w, nxt in zip(words, words[1:] + [{'s': duration}])
                if minimum - 0.1 <= w['e'] - start <= maximum]
        if ends:
            word_end, gap_end = min(ends, key=lambda pair: abs(pair[0] - target))
            end = min(duration, word_end + min(0.45, max(0.0, gap_end - word_end) / 2), start + maximum)
        else:
            end = target
    return {'start':round(start,3), 'end':round(min(end, duration),3)}


def fit_selection(selected, transcript, minimum, maximum, duration, alternates=()):
    """Fit the AI span to whole sentence units inside [min,max].

    Returns (segment, sentence_complete, warning). Never raises for a length
    mismatch: when no run of whole units fits, the cut falls back to upstream
    word-edge snapping and the result is marked sentence-incomplete.

    `alternates` are other transcripts with the same word timings (the unrepaired
    copy moment selection read): their unit edges are tried after `transcript`'s at
    each pause tier, since an ASR repair that adds sentence ends can switch off the
    segment-end boundaries and leave coarser units.
    """
    words = recut.transcript_words(transcript)
    if not words:
        raise ValueError('ASR contains no sentence boundaries; sentence-complete selection cannot be verified')
    if not any(END.search(word['w']) for word in words) and minimum - 0.1 <= duration <= maximum + 0.1:
        # Unpunctuated ASR over a source that already fits: keeping it whole
        # cannot cut an utterance mid-sentence.
        return {'start': 0, 'end': round(duration, 3)}, True, None
    for pause, vad_pause in ((PAUSE_SECONDS, VAD_PAUSE_SECONDS), (0.3, 0.2), (0.2, 0.15)):
        for candidate in (transcript, *[t for t in alternates if t is not None]):
            found = _runs(sentences(candidate, pause, vad_pause), selected, minimum, maximum, duration)
            if found:
                return found, True, None
    return (_word_fallback(selected, words, minimum, maximum, duration), False,
            'sentence boundaries unavailable for %.1f-%.1fs; cut at word pauses' % (minimum, maximum))


def complete_selection(selected, transcript, minimum, maximum, duration):
    """Segment-only view of fit_selection."""
    return fit_selection(selected, transcript, minimum, maximum, duration)[0]


def reuse_segments(requested, canonical):
    """Map absolute source intervals onto a clean clip's concatenated EDL."""
    result = []
    for segment in requested:
        offset, match = 0, None
        for original in canonical:
            if recut.within_range([segment], original['start'], original['end']):
                match = recut.rebase_segments([segment], original['start'], original['end'])[0]
                match = {'start':round(match['start']+offset,3), 'end':round(match['end']+offset,3)}
                break
            offset += original['end']-original['start']
        if match is None:
            return None
        result.append(match)
    return result
