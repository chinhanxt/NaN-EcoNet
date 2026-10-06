"""Conservative reference text mapping onto isolated narration ASR intervals.

This corrects lexical recognition mistakes; it is not phoneme forced alignment
or evidence that the synthesizer actually pronounced every reference word.
"""
from copy import deepcopy
import unicodedata

from contracts import number


def normalized(text):
    return ''.join(char for char in unicodedata.normalize('NFC', text).casefold()
                   if char.isalnum())


def map_reference(transcript, reference):
    import subtitles
    tokens = reference.split()
    recognized = subtitles.merge_continuation_words([
        word for segment in transcript.get('segments', []) for word in segment.get('words', [])])
    if not tokens or len(tokens) != len(recognized):
        raise ValueError('Narration reference cannot be mapped to ASR intervals: token counts differ')
    expected = [normalized(token) for token in tokens]
    actual = [normalized(str(word.get('word', ''))) for word in recognized]
    if not all(expected) or not all(actual):
        raise ValueError('Narration reference contains unsupported standalone punctuation')
    matches = [left == right for left, right in zip(expected, actual)]
    changed = [index for index, matched in enumerate(matches) if not matched]
    agreement = sum(matches) / len(matches)
    if changed and (agreement < .75 or sum(matches) < 3):
        raise ValueError('Narration reference cannot be mapped to ASR intervals: insufficient agreement')
    index = 0
    while index < len(matches):
        if matches[index]:
            index += 1
            continue
        start = index
        while index < len(matches) and not matches[index]:
            index += 1
        if index - start > 2 or start == 0 or index == len(matches):
            raise ValueError('Narration reference cannot be mapped to ASR intervals: unanchored correction')
    words = []
    previous = 0
    for index, word in enumerate(recognized):
        start = number(word.get('start'), 'narration ASR start', previous, 21600)
        end = number(word.get('end'), 'narration ASR end', start + .001, 21600)
        previous = end
        # A leading space is the canonical ASR word-boundary marker. Removing
        # it would concatenate words in upstream continuation merging.
        words.append({**word, 'word': ' ' + tokens[index], 'start': start, 'end': end})
    result = {**deepcopy(transcript), 'segments': [{'start': words[0]['start'],
              'end': words[-1]['end'], 'text': ' '.join(tokens), 'words': words}],
              'timingSource': 'generated-narration-ASR-reference',
              'narrationAlignment': {'method': 'reference words on unchanged ASR intervals',
                'phonemeAlignmentVerified': False, 'agreement': agreement,
                'correctedIndices': changed, 'recognizedWords': deepcopy(recognized),
                'referenceText': reference}}
    return result


def align_reference(transcript, reference, minimum_agreement=.7):
    """Sequence-aligned fallback when ASR token counts differ from the script.

    Matched words keep their ASR intervals; replaced script words share the
    interval of the ASR words they stand for, script words the ASR missed share
    their left neighbour's interval (split by letter count), extra ASR words are
    dropped. Rejects weak agreement.
    """
    from difflib import SequenceMatcher
    import subtitles
    tokens = reference.split()
    recognized = subtitles.merge_continuation_words([
        word for segment in transcript.get('segments', []) for word in segment.get('words', [])])
    expected = [normalized(token) for token in tokens]
    actual = [normalized(str(word.get('word', ''))) for word in recognized]
    if not tokens or not recognized or not all(expected):
        raise ValueError('Narration reference cannot be aligned to ASR words')
    times, previous = [], 0
    for word in recognized:
        start = number(word.get('start'), 'narration ASR start', previous, 21600)
        end = number(word.get('end'), 'narration ASR end', start + .001, 21600)
        times.append((start, end))
        previous = end
    opcodes = SequenceMatcher(None, expected, actual, autojunk=False).get_opcodes()
    matched = sum(i2 - i1 for tag, i1, i2, _, _ in opcodes if tag == 'equal')
    agreement = matched / len(tokens)
    if agreement < minimum_agreement or matched / len(recognized) < minimum_agreement:
        raise ValueError('Narration reference cannot be aligned to ASR words: insufficient agreement')
    spans = []  # (token indices, start, end)
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == 'equal':
            spans += [([i1 + k], *times[j1 + k]) for k in range(i2 - i1)]
        elif tag == 'replace' and i2 - i1 == j2 - j1:  # same-count misrecognitions keep 1:1 intervals
            spans += [([i1 + k], *times[j1 + k]) for k in range(i2 - i1)]
        elif tag == 'replace':
            spans.append((list(range(i1, i2)), times[j1][0], times[j2 - 1][1]))
        elif tag == 'delete':  # script words the ASR missed; ASR-only words ('insert') are dropped
            gap_start = spans[-1][2] if spans else 0
            gap_end = times[j1][0] if j1 < len(times) else None
            if gap_end is not None and gap_end - gap_start >= .12 * (i2 - i1):  # a pause holds them
                spans.append((list(range(i1, i2)), gap_start + .02, gap_end - .02))
            elif spans:  # share the left neighbour's interval
                indices, start, end = spans.pop()
                spans.append((indices + list(range(i1, i2)), start, end))
            else:
                spans.append((list(range(i1, i2)), None, None))
    if spans and spans[0][1] is None:  # leading missed words join the first timed span
        head = spans.pop(0)
        if not spans:
            raise ValueError('Narration reference cannot be aligned to ASR words')
        indices, start, end = spans.pop(0)
        spans.insert(0, (head[0] + indices, start, end))
    words = []
    for indices, start, end in spans:
        weights = [max(1, len(expected[index])) for index in indices]
        total, cursor = sum(weights), start
        for index, weight in zip(indices, weights):
            stop = end if index == indices[-1] else cursor + (end - start) * weight / total
            words.append({'word': ' ' + tokens[index], 'start': round(cursor, 3),
                          'end': round(max(stop, cursor + .001), 3)})
            cursor = stop
    changed = sorted(index for tag, i1, i2, _, _ in opcodes if tag != 'equal' for index in range(i1, i2))
    return {**deepcopy(transcript), 'segments': [{'start': words[0]['start'], 'end': words[-1]['end'],
            'text': ' '.join(tokens), 'words': words}],
            'timingSource': 'generated-narration-ASR-aligned',
            'narrationAlignment': {'method': 'sequence-aligned reference words on ASR intervals',
              'phonemeAlignmentVerified': False, 'agreement': agreement,
              'correctedIndices': changed, 'recognizedWords': deepcopy(recognized),
              'referenceText': reference}}


def reference_transcript(transcript, reference):
    """Strict 1:1 mapping first; sequence alignment when token counts or runs differ."""
    try:
        return map_reference(transcript, reference)
    except ValueError:
        return align_reference(transcript, reference)
