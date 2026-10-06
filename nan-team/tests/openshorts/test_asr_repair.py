"""Constrained AGY ASR repair: same-syllable replacements, edit budget, punctuation, graceful failure."""
import copy
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import asr_repair
import timelines


def word(text, start, end, probability=.9):
    return {'word': text, 'start': start, 'end': end, 'probability': probability}


def transcript():
    tokens = (' Xin chào các bạn đến với Vietcetra hôm nay có thầy Minh Điệm'
              ' nói về series yêu lành cho người trẻ').split(' ')[1:]
    low = {'Vietcetra': .3, 'Điệm': .35, 'yêu': .4}
    words = [word(' ' + t, i * .4, i * .4 + .35, low.get(t, .9)) for i, t in enumerate(tokens)]
    return {'language': 'vi', 'text': '', 'segments': [
        {'start': 0, 'end': words[12]['end'], 'text': '', 'words': words[:13]},
        {'start': words[13]['start'], 'end': words[-1]['end'], 'text': '', 'words': words[13:]}],
        'asr': {'runtime': {'model': 'turbo'}, 'rawSegments': [{'text': 'raw'}]}}


class FakeAgy:
    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def request(self, prompt, schema, frames=None, role='content-editor'):
        self.calls.append({'prompt': prompt, 'schema': schema, 'frames': frames, 'role': role})
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer


def texts(t):
    return [w['word'] for s in t['segments'] for w in s['words']]


class RepairTests(unittest.TestCase):
    def test_accepts_same_syllable_fixes_and_keeps_timings(self):
        t = transcript()
        before = copy.deepcopy(t)
        agy = FakeAgy([{'edits': [{'i': 6, 'replacement': 'Vietcetera', 'reason': 'logo'},
                                  {'i': 12, 'replacement': 'Niệm', 'reason': 'name'},
                                  {'i': 16, 'replacement': 'chữa', 'reason': 'chữa lành'}]}])
        frames = [{'path': '/x.jpg', 'timestampSeconds': 1}]
        warnings = asr_repair.repair(t, frames, {'title': 'Vietcetera', 'glossary': ['Minh Niệm']}, agy)
        self.assertEqual(warnings, [])
        self.assertEqual(agy.calls[0]['role'], 'asr-repair')
        self.assertEqual(agy.calls[0]['frames'], frames)
        self.assertIn('glossary: Minh Niệm', agy.calls[0]['prompt'])
        self.assertIn('Vietcetra\t0.30', agy.calls[0]['prompt'])
        self.assertEqual(texts(t)[6], ' Vietcetera')
        self.assertEqual(texts(t)[12], ' Niệm')
        self.assertIn('series chữa lành', t['text'])
        self.assertIn('thầy Minh Niệm', t['segments'][0]['text'])
        for new, old in zip([w for s in t['segments'] for w in s['words']],
                            [w for s in before['segments'] for w in s['words']]):
            self.assertEqual((new['start'], new['end']), (old['start'], old['end']))
        self.assertEqual(t['asr']['rawWords'][12]['word'], ' Điệm')
        self.assertEqual([e['to'] for e in t['asr']['repair']['edits']], ['Vietcetera', 'Niệm', 'chữa'])
        self.assertEqual(t['asr']['runtime'], before['asr']['runtime'])
        self.assertEqual(t['asr']['rawSegments'], before['asr']['rawSegments'])

    def test_rejects_edits_that_break_constraints(self):
        t = transcript()
        agy = FakeAgy([{'edits': [{'i': 12, 'replacement': 'Minh-Niệm'},       # adds a syllable
                                  {'i': 3, 'replacement': 'bạn.'},             # punctuation
                                  {'i': 99, 'replacement': 'x'},               # out of range
                                  {'i': 0, 'replacement': 'Xin'},              # no-op
                                  {'i': 16, 'replacement': 'chữa'},
                                  {'i': 16, 'replacement': 'chửa'}]}])         # duplicate
        warnings = asr_repair.repair(t, None, None, agy)
        repair = t['asr']['repair']
        self.assertEqual([e['i'] for e in repair['edits']], [16])
        self.assertEqual(sorted(r['i'] for r in repair['rejected']), [0, 3, 12, 16, 99])
        self.assertTrue(any('syllable' in r['reason'] for r in repair['rejected']))
        self.assertIn('rejected 5', warnings[0])
        self.assertEqual(texts(t)[12], ' Điệm')

    def test_budget_keeps_least_confident_tokens(self):
        t = transcript()
        n = len(texts(t))  # 21 words -> budget 3
        edits = [{'i': i, 'replacement': 'khác'} for i in (0, 1, 2, 6, 12, 16)]
        agy = FakeAgy([{'edits': edits}])
        asr_repair.repair(t, None, None, agy)
        repair = t['asr']['repair']
        self.assertEqual(int(n * asr_repair.MAX_EDIT_RATIO), 3)
        self.assertEqual([e['i'] for e in repair['edits']], [6, 12, 16])
        self.assertEqual(sorted(r['i'] for r in repair['rejected']), [0, 1, 2])
        self.assertTrue(all('budget' in r['reason'] for r in repair['rejected']))

    def test_sentence_end_punctuation_feeds_sentence_units(self):
        t = transcript()
        words = [w for s in t['segments'] for w in s['words']]
        for w in words[5:]:  # audible pause after "đến" (index 4)
            w['start'] += .5
            w['end'] += .5
        words[4]['word'] = ' đến,'
        agy = FakeAgy([{'sentence_ends': [{'i': 4, 'mark': '!'}, {'i': 20, 'mark': '?'},
                                          {'i': 7, 'mark': ';'}, {'i': 40, 'mark': '.'}]}])
        asr_repair.repair(t, None, None, agy)
        words = texts(t)
        self.assertEqual(words[4], ' đến!')  # comma replaced by the sentence mark
        self.assertEqual(words[5], ' Với')    # capitalised after an accepted end
        self.assertEqual(words[20], ' trẻ?')  # transcript end needs no pause
        repair = t['asr']['repair']
        self.assertEqual([(e['i'], e['gap']) for e in repair['sentenceEnds']], [(4, .55), (20, None)])
        self.assertEqual(len(repair['rejected']), 2)
        units = timelines.sentences(t)
        self.assertGreaterEqual(len(units), 2)
        self.assertTrue(units[0]['text'].endswith('đến!'))

    def test_sentence_ends_need_acoustic_boundary(self):
        # Live 8370e2ef: "bố cục. Đó, sẽ có" came from an end at a zero-gap ASR segment split.
        tokens = ('chúng ta những cái bố cục đó sẽ có những cái tỷ lệ bố cục ví dụ như '
                  'mình đăng bài video chúng ta muốn làm với nhau còn cái này').split()
        gaps = {5: 0, 14: 0, 21: .5, 27: .18, 28: .2}   # gap after word i; default tight .02
        words, clock = [], 0.0
        for i, token in enumerate(tokens):
            words.append(word(' ' + token, clock, clock + .2))
            clock += .2 + gaps.get(i, .02)
        t = {'language': 'vi', 'text': '', 'asr': {}, 'segments': [
            {'start': 0, 'end': words[5]['end'], 'text': '', 'words': words[:6]},
            {'start': words[6]['start'], 'end': words[14]['end'], 'text': '', 'words': words[6:15]},
            {'start': words[15]['start'], 'end': words[28]['end'], 'text': '', 'words': words[15:29]},
            {'start': words[29]['start'], 'end': words[-1]['end'], 'text': '', 'words': words[29:]}]}
        ends = [5, 14, 21, 24, 27, 28, 9]
        agy = FakeAgy([{'sentence_ends': [{'i': i, 'mark': '.'} for i in ends]}])
        warnings = asr_repair.repair(t, None, None, agy)
        out = texts(t)
        repair = t['asr']['repair']
        self.assertEqual([e['i'] for e in repair['sentenceEnds']], [21, 28])
        rejected = {e['i']: e['reason'] for e in repair['rejectedSentenceEnds']}
        self.assertEqual(sorted(rejected), [5, 9, 14, 24, 27])
        self.assertIn('zero-gap ASR segment split', rejected[5])   # "bố cục. Đó"
        self.assertIn('gap 0.02s', rejected[9])                    # inside a tight word run
        self.assertIn('only 3 word(s)', rejected[24])              # density after "video."
        self.assertIn('gap 0.18s', rejected[27])                   # "nhau. Còn" without a pause
        self.assertEqual(out[5:7], [' cục', ' đó'])                # no mark, no capitalisation
        self.assertEqual(out[27:29], [' nhau', ' còn.'])
        self.assertEqual(out[21:23], [' video.', ' Chúng'])
        self.assertEqual(out[14:16], [' cục', ' ví'])
        self.assertEqual(out[29], ' Cái')                          # new ASR segment after a .2s pause
        self.assertEqual(warnings, [])
        self.assertEqual([u['text'].split()[-1] for u in timelines.sentences(t)][:2], ['video.', 'còn.'])

    def test_failure_keeps_original_transcript(self):
        for failure in (RuntimeError('AGY RPC input closed'), {'edits': 'not a list'}):
            t = transcript()
            before = copy.deepcopy(t)
            warnings = asr_repair.repair(t, None, None, FakeAgy([failure]))
            self.assertIn('original transcript kept', warnings[0])
            self.assertEqual(t['segments'], before['segments'])
            self.assertNotIn('rawWords', t['asr'])
            self.assertEqual(t['asr']['repair']['failedChunks'], 1)

    def test_unconfigured_provider_and_frames_degrade(self):
        t = transcript()
        before = copy.deepcopy(t['segments'])
        with patch('ai_provider._provider', None):
            warnings = asr_repair.repair_source(t, '/nope.mp4', {'duration': 10, 'width': 640}, {})
        self.assertEqual(len(warnings), 2)
        self.assertIn('frames unavailable', warnings[0])
        self.assertIn('ASR repair unavailable', warnings[1])
        self.assertEqual(t['segments'], before)

    def test_long_transcript_is_chunked(self):
        words = [word(' từ', i * .3, i * .3 + .2) for i in range(asr_repair.CHUNK_WORDS + 10)]
        t = {'language': 'vi', 'segments': [{'start': 0, 'end': 1, 'text': '', 'words': words}], 'asr': {}}
        agy = FakeAgy([{'edits': [{'i': 5, 'replacement': 'tư'}]},
                       {'edits': [{'i': 5, 'replacement': 'tư'}, {'i': asr_repair.CHUNK_WORDS + 1, 'replacement': 'tư'}]}])
        asr_repair.repair(t, None, None, agy)
        self.assertEqual(len(agy.calls), 2)
        self.assertEqual([e['i'] for e in t['asr']['repair']['edits']], [5, asr_repair.CHUNK_WORDS + 1])
        self.assertEqual(t['asr']['repair']['rejected'][0]['reason'], 'index outside this transcript chunk')

    def test_scoped_repair_sends_only_words_in_range(self):
        t = transcript()
        words = [w for s in t['segments'] for w in s['words']]
        scope = asr_repair.scope_for(t, [{'start': 4.0, 'end': 4.5}], margin=.5)
        self.assertEqual(scope, (8, 13))  # 3.5-5.0 s overlaps words 8..12
        self.assertIsNone(asr_repair.scope_for(t, [{'start': 0, 'end': 8}], margin=0))  # >= 80% of words
        agy = FakeAgy([{'edits': [{'i': 12, 'replacement': 'Niệm'}, {'i': 6, 'replacement': 'Vietcetera'}]}])
        asr_repair.repair(t, None, None, agy, scope=scope)
        prompt = agy.calls[0]['prompt']
        self.assertIn('12\tĐiệm', prompt)
        self.assertNotIn('Vietcetra', prompt)
        self.assertEqual(texts(t)[12], ' Niệm')
        self.assertEqual(texts(t)[6], ' Vietcetra')  # outside the scope: untouched, edit rejected
        report = t['asr']['repair']
        # The scope reaches into the pauses up to the neighbouring (unrepaired) words.
        self.assertEqual(report['scope'], {'startSeconds': words[7]['end'], 'endSeconds': words[13]['start'],
                                           'wordStartSeconds': words[8]['start'], 'wordEndSeconds': words[12]['end'],
                                           'fromStart': False, 'toEnd': False,
                                           'words': 5, 'totalWords': len(words)})
        self.assertEqual(report['rejected'][0]['reason'], 'index outside this transcript chunk')
        self.assertTrue(asr_repair.within_scope(report, [{'start': 3.2, 'end': 5.1}], snap=0))
        self.assertFalse(asr_repair.within_scope(report, [{'start': 3.7, 'end': 4.8}]))  # snap could leave it
        self.assertFalse(asr_repair.within_scope(report, [{'start': 0, 'end': 4.8}], snap=0))
        self.assertFalse(asr_repair.within_scope(report, None))
        self.assertTrue(asr_repair.within_scope({'edits': []}, None))

    def test_repair_source_scopes_frames_to_ranges(self):
        t = transcript()
        agy = FakeAgy([{'edits': []}])
        with patch('ai_provider.current', return_value=agy), patch.object(asr_repair, 'SCOPE_MARGIN_SECONDS', .5), \
                patch('agy_compat.sample_times', return_value=['f']) as sample:
            asr_repair.repair_source(t, '/x.mp4', {'duration': 60, 'width': 640}, {},
                                     ranges=[{'start': 4.0, 'end': 4.5}])
        times = sample.call_args[0][1]
        self.assertTrue(all(3.0 <= x <= 5.5 for x in times))
        self.assertIn('scope', t['asr']['repair'])

    def test_relabel_carries_edits_into_selector_text(self):
        edits = [{'from': 'đống', 'to': 'đóng', 'start': 40.0}, {'from': 'Điệm', 'to': 'Niệm', 'start': 90.0}]
        self.assertEqual(asr_repair.relabel('Đống phim: kể đống phim, xđống', edits, 30, 60),
                         'Đóng phim: kể đóng phim, xđống')
        self.assertEqual(asr_repair.relabel('thầy Điệm', edits, 30, 60), 'thầy Điệm')  # edit outside the clip
        self.assertEqual(asr_repair.relabel('thầy Điệm', edits), 'thầy Niệm')
        self.assertEqual(asr_repair.relabel(88, edits), 88)

    def test_scope_edges_in_silence_allow_child_reuse(self):
        # Speech starts at 0.42 s and has a 5 s silence after 63.1 s; the parent edited 0-60 s.
        words = [word(' từ', .42 + i * .5, .42 + i * .5 + .4) for i in range(126)]  # last ends 63.32
        words += [word(' nữa', 68.5 + i * .5, 68.9 + i * .5) for i in range(100)]
        t = {'language': 'vi', 'segments': [{'start': 0, 'end': 120, 'text': '', 'words': words}], 'asr': {}}
        scope = asr_repair.scope_for(t, [{'start': 0, 'end': 60}])
        asr_repair.repair(t, None, None, FakeAgy([{'edits': []}]), scope=scope)
        report = t['asr']['repair']
        self.assertTrue(report['scope']['fromStart'])
        self.assertEqual(report['scope']['startSeconds'], 0.0)
        self.assertEqual(report['scope']['endSeconds'], 68.5)
        self.assertTrue(asr_repair.within_scope(report, [{'start': 0, 'end': 60}], 120))
        self.assertTrue(asr_repair.within_scope(report, [{'start': 0, 'end': 66.9}], 120))  # cut in the silence
        self.assertFalse(asr_repair.within_scope(report, [{'start': 0, 'end': 67.5}], 120))  # snap reaches 68.5
        # A legacy word-edge scope from the source start is still read as open at 0.
        self.assertTrue(asr_repair.within_scope({'scope': {'startSeconds': 0.0, 'endSeconds': 63.1}},
                                                [{'start': 0, 'end': 60}], 120))
        # Scope to the end of the transcript: any end up to the duration is covered.
        self.assertTrue(asr_repair.within_scope({'scope': {'startSeconds': 10, 'endSeconds': 90, 'toEnd': True}},
                                                [{'start': 12, 'end': 120}], 120))

    def test_relabel_is_single_pass_and_skips_ambiguous_words(self):
        # ma->mà at 40 s, but "ma" still occurs (unrepaired) in the clip: the title "Chuyện ma" keeps it.
        repaired = [word(' Chuyện', 30, 30.4), word(' ma', 30.5, 30.8), word(' mà', 40, 40.3)]
        edits = [{'from': 'ma', 'to': 'mà', 'start': 40.0}]
        self.assertEqual(asr_repair.relabel('Chuyện ma có thật', edits, 25, 60, words=repaired), 'Chuyện ma có thật')
        # No other "ma" in the clip: the edit applies.
        self.assertEqual(asr_repair.relabel('nhưng ma vẫn', edits, 25, 60, words=repaired[2:]), 'nhưng mà vẫn')
        # Edits never chain: ma->mà and mà->má in one pass.
        chained = edits + [{'from': 'mà', 'to': 'má', 'start': 41.0}]
        self.assertEqual(asr_repair.relabel('ma và mà', chained, 25, 60), 'mà và má')
        # Two targets for one word: ambiguous, skipped.
        clash = edits + [{'from': 'ma', 'to': 'mã', 'start': 45.0}]
        self.assertEqual(asr_repair.relabel('Ma ma', clash, 25, 60), 'Ma ma')
        # Other words in the text are still relabeled; unrepaired words outside the span don't block.
        outside = [word(' ma', 90, 90.3)]
        self.assertEqual(asr_repair.relabel('Ma nói', edits, 25, 60, words=outside), 'Mà nói')

    def test_fit_uses_unrepaired_units_when_repair_coarsens_them(self):
        def build(mark):
            words = [word(' từ' + (mark if i in (29, 58, 59) else ''), i, i + .9) for i in range(60)]
            return {'segments': [{'start': k, 'end': k + 9.9, 'text': '', 'words': words[k:k + 10]}
                                 for k in range(0, 60, 10)]}
        repaired, raw = build('.'), build('')
        selected = {'start': 10.0, 'end': 25.0}
        # Repair added sentence ends: the sparse rule drops segment-end boundaries, units are 30 s.
        _, complete, warning = timelines.fit_selection(selected, repaired, 10, 20, 60)
        self.assertFalse(complete)
        self.assertIn('sentence boundaries unavailable', warning)
        fitted, complete, warning = timelines.fit_selection(selected, repaired, 10, 20, 60, alternates=(raw,))
        self.assertTrue(complete)
        self.assertIsNone(warning)
        self.assertTrue(10 - .1 <= fitted['end'] - fitted['start'] <= 20 + .1)
        self.assertEqual(round(fitted['start']) % 10, 0)  # lands on a unit edge of the unrepaired copy

    def test_context_from_request(self):
        self.assertEqual(asr_repair.context_from_request({'asrContext': {'topic': 'x'}}), {'topic': 'x'})
        self.assertEqual(asr_repair.context_from_request({'sourceTitle': 'Vietcetera'}), {'title': 'Vietcetera'})
        self.assertIsNone(asr_repair.context_from_request({}))


if __name__ == '__main__':
    unittest.main()
