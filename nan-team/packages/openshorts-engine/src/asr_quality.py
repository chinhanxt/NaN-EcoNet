"""ASR diagnostics for suspect word timing and end-window text, plus the one bounded trim.

Observed on the Vietcetera fixture: after the last spoken sentence ("... là cái
thời điểm.") the decoder appended unrelated text ("thất bại.", "một ngày qua ...
đà nẵng.") where a window cut interrupted speech. Text alone cannot separate
such tails from real speech, so a span is only suspected when at least two
kinds of decoder evidence agree.

Thresholds were calibrated on word-level receipts of that fixture
(reports/openshorts-integration/phowhisper-decode-variants/receipt.json, 16 runs
of the formerly used PhoWhisper-small; turbo-silence-clips/receipt.json for
large-v3-turbo): real-speech segments had avg_logprob >= -0.40 and mean word
probability >= 0.54 (turbo, short phrase with an English word; PhoWhisper >= 0.85);
hallucinated windows had avg_logprob <= -0.25, mean word probability <= 0.72,
mostly > 8 words/s. Word probability alone overlaps, so its limit stays at 0.5.
That is one fixture, not an accuracy measurement.

trim_end_window() removes only the narrowest suspected end-window span; the
caller keeps the raw decoded transcript in its receipt.
"""
import math
import re

THRESHOLDS = {'tailSeconds': 3.0, 'mediaEndSeconds': 0.5, 'minCategories': 2,
              'meanWordProbability': 0.5, 'avgLogprob': -0.45, 'wordsPerSecond': 8.0,
              'zeroDurationFraction': 0.25, 'noSpeechProb': 0.6, 'compressionRatio': 2.4}
# Signal -> evidence kind. Correlated signals share a kind so one cause cannot
# satisfy minCategories on its own (zero-length words also inflate the rate).
CATEGORIES = {'low-word-confidence': 'confidence', 'low-avg-logprob': 'confidence',
              'implausible-speech-rate': 'timing', 'zero-duration-words': 'timing',
              'high-no-speech-probability': 'speech-presence', 'repetitive-text': 'repetition'}
SENTENCE_END = re.compile(r'[.!?…]["”’)\]]*$')


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def segment_metrics(segment):
    """Decoder confidence faster-whisper reports per segment (None when absent)."""
    return {'avgLogprob': _number(getattr(segment, 'avg_logprob', None)),
            'noSpeechProb': _number(getattr(segment, 'no_speech_prob', None)),
            'compressionRatio': _number(getattr(segment, 'compression_ratio', None)),
            'temperature': _number(getattr(segment, 'temperature', None))}


def invalid_word_timings(segments):
    found = []
    for segment_index, segment in enumerate(segments):
        for word_index, word in enumerate(segment.get('words') or []):
            start, end = _number(word.get('start')), _number(word.get('end'))
            if start is None or end is None:
                reason = 'non-finite'
            elif end < start:
                reason = 'negative-duration'
            elif end == start:
                reason = 'zero-duration'
            else:
                continue
            found.append({'segmentIndex': segment_index, 'wordIndex': word_index,
                          'word': str(word.get('word', '')).strip(), 'start': start, 'end': end,
                          'reason': reason})
    return found


def _span(scope, segment_index, segment, words, metrics, duration):
    limits = THRESHOLDS
    times = [(_number(w.get('start')), _number(w.get('end'))) for w in words]
    valid = [(start, end) for start, end in times if start is not None and end is not None]
    probabilities = [p for p in (_number(w.get('probability')) for w in words) if p is not None]
    evidence, signals = {'words': len(words)}, []
    if probabilities:
        evidence['meanWordProbability'] = round(sum(probabilities)/len(probabilities), 4)
        if evidence['meanWordProbability'] < limits['meanWordProbability']:
            signals.append('low-word-confidence')
    if words:
        invalid = sum(1 for start, end in times if start is None or end is None or end <= start)
        evidence['invalidTimingWords'] = invalid
        if invalid/len(words) >= limits['zeroDurationFraction']:
            signals.append('zero-duration-words')
    if valid:
        seconds = max(end for _, end in valid) - min(start for start, _ in valid)
        evidence['spanSeconds'] = round(seconds, 3)
        if len(words) >= 2 and (seconds <= 0 or len(words)/seconds > limits['wordsPerSecond']):
            signals.append('implausible-speech-rate')
    if metrics.get('avgLogprob') is not None and metrics['avgLogprob'] < limits['avgLogprob']:
        signals.append('low-avg-logprob')
    if metrics.get('noSpeechProb') is not None and metrics['noSpeechProb'] > limits['noSpeechProb']:
        signals.append('high-no-speech-probability')
    if metrics.get('compressionRatio') is not None and metrics['compressionRatio'] > limits['compressionRatio']:
        signals.append('repetitive-text')
    categories = sorted({CATEGORIES[signal] for signal in signals})
    start = min((s for s, _ in valid), default=_number(segment.get('start')))
    end = max((e for _, e in valid), default=_number(segment.get('end')))
    text = ''.join(str(w.get('word', '')) for w in words).strip() if words else str(segment.get('text', '')).strip()
    return {'scope': scope, 'segmentIndex': segment_index, 'start': start, 'end': end, 'text': text,
            'signals': signals, 'categories': categories, 'evidence': evidence, 'segmentMetrics': metrics,
            'speechReachesMediaEnd': bool(duration is not None and end is not None
                                          and end >= duration - limits['mediaEndSeconds']),
            'suspected': len(categories) >= limits['minCategories']}


def end_window(segments, metrics, duration=None):
    """Final segment, plus the words after its last sentence end, when they sit at the media end."""
    if not segments:
        return []
    index = len(segments) - 1
    segment = segments[index]
    end = _number(segment.get('end'))
    if duration is not None and end is not None and end < duration - THRESHOLDS['tailSeconds']:
        return []
    words = segment.get('words') or []
    measured = metrics[index] if index < len(metrics) else {}
    spans = [_span('final-segment', index, segment, words, measured, duration)]
    boundary = max((i + 1 for i, word in enumerate(words[:-1])
                    if SENTENCE_END.search(str(word.get('word', '')).strip())), default=0)
    if boundary:
        spans.append(_span('after-last-sentence-end', index, segment, words[boundary:], measured, duration))
    return spans


def _clock(value):
    return '?' if value is None else f'{value:.2f}'


def trim_end_window(segments, report):
    """Copy of segments without the narrowest suspected end-window span; (segments, removed words)."""
    suspected = [span for span in report.get('endWindow', []) if span['suspected']]
    if not suspected:
        return [dict(segment, words=list(segment.get('words') or [])) for segment in segments], []
    span = suspected[-1]
    index = span['segmentIndex']
    kept = [dict(segment, words=list(segment.get('words') or [])) for segment in segments[:index]]
    words = list(segments[index].get('words') or [])
    if span['scope'] == 'after-last-sentence-end':
        count = span['evidence']['words']
        removed, remaining = words[len(words)-count:], words[:len(words)-count]
        segment = dict(segments[index], words=remaining,
                       text=''.join(str(w.get('word', '')) for w in remaining))
        if remaining:
            segment['end'] = max(_number(w.get('end')) or segment['start'] for w in remaining)
        kept.append(segment)
    else:
        removed = words
    return kept, removed


def assess(segments, metrics, duration=None, trim=False):
    """Diagnostics for a transcribe_media() transcript; segments are read, never modified.

    With trim=True the report describes the trim_end_window() the caller applies.
    """
    invalid = invalid_word_timings(segments)
    spans = end_window(segments, metrics, duration)
    warnings = []
    if invalid:
        first = invalid[0]
        warnings.append(f'ASR returned {len(invalid)} word(s) with invalid timing (first "{first["word"]}" at '
                        f'{_clock(first["start"])}s, {first["reason"]}); kept as decoded, but timed clip captions '
                        'skip words whose end is not after their start')
    # Spans are ordered widest first; warn once, for the narrowest suspected one.
    suspected = [span for span in spans if span['suspected']]
    if suspected:
        span = suspected[-1]
        excerpt = span['text'] if len(span['text']) <= 80 else span['text'][:77] + '...'
        warning = (f'ASR end-window text at {_clock(span["start"])}-{_clock(span["end"])}s ("{excerpt}") has '
                   f'possible hallucination signals ({", ".join(span["signals"])}); '
                   + ('removed from captions and hook input, raw decode kept in the ASR receipt' if trim
                      else 'kept unchanged, review before publishing'))
        if span['speechReachesMediaEnd']:
            warning += '; speech runs to the media end, so the source cut may interrupt a word'
        warnings.append(warning)
    return {'version': 1, 'timeline': 'source-seconds', 'thresholds': dict(THRESHOLDS),
            'invalidWordTimings': invalid, 'endWindow': spans, 'warnings': warnings,
            'transcriptModified': bool(trim and suspected),
            'wordsDiscarded': (suspected[-1]['evidence']['words'] if trim and suspected else 0)}
