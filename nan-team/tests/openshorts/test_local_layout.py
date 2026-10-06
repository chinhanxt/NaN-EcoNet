"""Fixture-derived screen metrics + controlled face evidence; no network or ML weights."""
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import local_layout as ll
import pipeline
import analysis
import camera_inset

# Measurements of the existing f_2/f_22/f_42 Canva JPEGs and f_2/f_35/f_68
# 8saigon JPEGs (1280x720), not an end-to-end detector/render acceptance test.
CANVA = [(.0661, .7868, [50,18]), (.0537, .7837, [58,9]), (.0622, .7635, [47,19])]
DIALOGUE = [(.0461, .8493, [13,5]), (.0526, .8388, [16,3]), (.0511, .8417, [17,6])]


def observations(metrics, boxes):
    return [ll.classify_sample([{'box': b} for b in boxes], 1280, 720,
            dict(edgeDensity=e, flatFraction=f, textHalves=t)) for e,f,t in metrics]


LARGE = {'group': 2, 'camera': 1, 'wide': 0, 'screen': 1, 'ambiguous': 1}


def evidence(kinds, durations=None):
    obj = ll.Evidence.__new__(ll.Evidence)
    obj.error, obj.frames = None, []
    obj.info = {'width':1280, 'height':720}
    obj.records, start = [], 0
    for kind, length in zip(kinds, durations or [10]*len(kinds)):
        samples = [{'faceCount': LARGE[kind], 'largeFaces': LARGE[kind], 'screenLike': kind == 'screen'}]*3
        obj.records.append(dict(startSeconds=start, endSeconds=start+length, kind=kind, samples=samples, bubble=None))
        start += length
    return obj


def test_8saigon_general_speaker_cut_route():
    samples = observations(DIALOGUE, [[395,250,105,130], [820,225,115,145]])
    assert ll.scene_kind(samples, None) == 'group'
    assert evidence(['group']).layout('9:16') == 'speaker-cut'
    # Core remains responsible for GENERAL/ALTERNATE; face count is not diarization.


def test_canva_screencast_inset_route():
    samples = observations(CANVA, [[1020,535,105,130]])
    bubble = {'box': (960,440,240,240), 'shape':'circle'}
    assert ll.scene_kind(samples, bubble) == 'screen'
    obj = evidence(['screen', 'screen'])
    assert obj.layout('9:16') == 'screencast'
    assert obj.ranges([{'start':2,'end':8}, {'start':12,'end':16}]) == [
        [0,6,'screen content',1.0], [6,10,'screen content',1.0]]


def test_8saigon_title_frame_does_not_block_two_shot():
    # Real 8saigon sample: burned-in name title makes one of 11 frames text-dense.
    samples = observations([(.0477,.8476,[12,8])] + DIALOGUE, [[395,250,105,130], [820,225,115,145]])
    assert samples[0]['screenLike'] and ll.scene_kind(samples, None) == 'group'


def test_vietcetera_keeps_track_general_mix():
    # Real Vietcetera scene kinds (12 scenes): close-ups plus two wide two-shots.
    kinds = ['camera','camera','wide','camera','camera','camera','camera','wide','camera','camera','camera','camera']
    lengths = [4.4,6.4,5.4,6.6,4.7,8.5,4.5,8.2,2.1,4.3,3.8,1.1]
    obj = evidence(kinds, lengths)
    assert obj.layout('9:16') == 'auto' and obj.reason == 'single-subject-shots'
    # Forcing "general" here would suppress core tracking on the close-ups.


def test_mostly_faceless_or_half_two_shot_defers():
    assert evidence(['wide','wide','camera']).layout('9:16') is None
    assert evidence(['group','camera']).layout('9:16') is None


@pytest.mark.parametrize('kinds', [['ambiguous'], ['screen','camera'], ['group','ambiguous']])
def test_uncertain_or_mixed_content_defers(kinds):
    assert evidence(kinds).layout('9:16') is None


def test_aspect_match_retains_passthrough():
    assert evidence(['group']).layout('16:9') == 'auto'


def test_texture_or_subtitles_without_bubble_never_proves_screen():
    assert ll.scene_kind(observations(CANVA, [[1020,535,105,130]]), None) == 'ambiguous'
    assert ll.scene_kind(observations(DIALOGUE, []), None) == 'wide'
    assert evidence(['wide']).layout('9:16') is None


def test_missing_coverage_and_uncertain_ranges_defer():
    obj = evidence(['screen','ambiguous'])
    assert obj.ranges([{'start':0,'end':20}]) is None
    assert obj.ranges([{'start':0,'end':21}]) is None
    obj.error = 'detector unavailable'
    assert obj.layout('9:16') is None
    assert obj.ranges([{'start':0,'end':5}]) is None


def test_local_layout_never_calls_agy_and_records_source():
    receipt = {}
    with patch.object(pipeline.ai_provider, 'current', side_effect=AssertionError('AGY forbidden')):
        assert pipeline._layout({'layout':'auto', 'aspectRatio':'9:16'}, 'video', evidence(['group']), receipt) == 'speaker-cut'
    assert receipt['source'] == 'local'


def test_ambiguous_layout_reuses_samples_and_records_agy():
    obj = evidence(['ambiguous'])
    obj.frames = [{'path':'frame.jpg','timestampSeconds':1}]
    rpc = Mock()
    rpc.request.return_value = {'layout':'none', 'confidence':.9, 'why':'camera'}
    receipt = {}
    with patch.object(pipeline.ai_provider, 'current', return_value=rpc), patch.object(ll.agy_compat, 'sample_video', side_effect=AssertionError('second decode')):
        assert pipeline._layout({'layout':'auto'}, 'video', obj, receipt) == 'auto'
    assert receipt['source'] == 'agy'
    assert rpc.request.call_args.args[2] == obj.frames


def test_sampled_faces_and_pixels_are_shared_with_bubble():
    refs = [{'path':f'{i}.jpg','timestampSeconds':i+1} for i in range(3)]
    detector = Mock(return_value=[{'box':[1000,530,100,130], 'score':13000}])
    frame = np.zeros((720,1280,3), np.uint8)
    metrics = dict(edgeDensity=.06, flatFraction=.8, textHalves=[30,20])
    with patch.object(ll.agy_compat,'sample_times', return_value=refs) as sample, \
         patch('cv2.imread', return_value=frame) as read, \
         patch('screencast_layout.detect_faces_full_res',detector), \
         patch.object(ll,'screen_metrics',return_value=metrics), \
         patch.object(camera_inset,'bubble_from_samples',return_value={'shape':'circle'}) as bubble:
        obj = ll.Evidence('source', {'width':1280,'height':720}, [{'startSeconds':0,'endSeconds':10}])
    assert obj.error is None
    assert sample.call_count == 1 and read.call_count == detector.call_count == 3
    assert len(bubble.call_args.args[1]) == 3
    assert obj.layout('9:16') == 'screencast'
    assert obj.ranges([{'start':0,'end':10}]) is not None
    assert obj.frames_for([{'start':0,'end':10}]) == refs
    assert obj.frames_for([{'start':7,'end':8}]) == []


def test_analysis_local_screen_skips_agy_and_persists_receipts(tmp_path):
    obj = evidence(['screen'])
    req = {'operation':'edit','layout':'auto','aspectRatio':'9:16','effects':[],
           'captions':{'enabled':False},'hook':{'enabled':False},'audio':{'mode':'keep'}}
    with patch.object(analysis.checkpoints,'load',return_value=None), \
         patch.object(analysis.rendering,'probe',return_value={'width':1280,'height':720,'duration':10,'audio':False}), \
         patch.object(analysis.timelines,'scenes',return_value=[{'startSeconds':0,'endSeconds':10}]), \
         patch.object(ll,'Evidence',return_value=obj), \
         patch.object(pipeline.ai_provider,'current',side_effect=AssertionError('AGY forbidden')):
        plan = analysis.analyze(req, tmp_path/'source.mp4', tmp_path, lambda event:None, 'source', 'engine')
    assert plan['layoutDecision']['source'] == 'local'
    assert plan['clips'][0]['screenDecision']['source'] == 'local'
    assert plan['clips'][0]['contentRanges'] == [[0,10,'screen content',1.0]]


def test_analysis_ambiguous_screen_keeps_agy_ranges_and_reuses_frames(tmp_path):
    obj = evidence(['ambiguous'])
    obj.frames = [{'path':'cached.jpg','timestampSeconds':5}]
    req = {'operation':'edit','layout':'screencast','aspectRatio':'9:16','effects':[],
           'captions':{'enabled':False},'hook':{'enabled':False},'audio':{'mode':'keep'}}
    rpc = Mock()
    rpc.request.return_value = {'ranges':[{'start':0,'end':10,'what':'desktop','width_fraction':1}]}
    with patch.object(analysis.checkpoints,'load',return_value=None), \
         patch.object(analysis.rendering,'probe',return_value={'width':1280,'height':720,'duration':10,'audio':False}), \
         patch.object(analysis.timelines,'scenes',return_value=[{'startSeconds':0,'endSeconds':10}]), \
         patch.object(ll,'Evidence',return_value=obj), \
         patch.object(analysis,'frames_for_segments',side_effect=AssertionError('duplicate decode')), \
         patch.object(pipeline.ai_provider,'current',return_value=rpc):
        plan = analysis.analyze(req, tmp_path/'source.mp4', tmp_path, lambda event:None, 'source', 'engine')
    assert plan['clips'][0]['screenDecision']['source'] == 'agy'
    assert plan['clips'][0]['contentRanges'] == [[0,10,'desktop',1]]
    assert rpc.request.call_count == 1
    assert rpc.request.call_args.args[2] == obj.frames


def test_decode_or_detector_failure_is_uncertain():
    with patch.object(ll.agy_compat,'sample_times',side_effect=RuntimeError('decoder unavailable')):
        obj = ll.Evidence('source', {}, [{'startSeconds':0,'endSeconds':10}])
    assert obj.layout('9:16') is None
    assert obj.ranges([{'start':0,'end':10}]) is None
    assert 'decoder unavailable' in obj.error


def test_sample_budget_never_makes_partial_local_decision():
    with patch.object(ll.agy_compat,'sample_times',side_effect=AssertionError('budget must precede decode')):
        obj = ll.Evidence('source', {}, [{'startSeconds':0,'endSeconds':600}])
    assert obj.error == 'sample-budget'
    assert obj.layout('9:16') is None


def test_corner_bubble_without_clear_screen_is_ambiguous():
    samples = observations(DIALOGUE, [[1020,535,105,130]])
    assert ll.scene_kind(samples, {'shape':'rect'}) == 'ambiguous'


def test_partial_decodes_never_prove_local_layout():
    with patch.object(ll.agy_compat, 'sample_times', return_value=[]):
        obj = ll.Evidence('source', {}, [{'startSeconds':0,'endSeconds':10}])
    assert obj.layout('9:16') is None
    assert 'incomplete layout samples' in obj.error


def test_evidence_and_local_layout_overlap_asr(tmp_path):
    import threading
    started = threading.Event()
    obj = evidence(['group'])
    def build(*args):
        started.set()
        return obj
    def asr(source, info, listen, window=None):
        # Evidence must already be running while ASR decodes audio.
        assert started.wait(5)
        return {'segments': []}
    req = {'operation':'edit','layout':'auto','aspectRatio':'9:16','effects':[],
           'captions':{'enabled':False},'hook':{'enabled':False},'audio':{'mode':'keep'}}
    with patch.object(analysis.checkpoints,'load',return_value=None), \
         patch.object(analysis.rendering,'probe',return_value={'width':1280,'height':720,'duration':10,'audio':False}), \
         patch.object(analysis.timelines,'scenes',return_value=[{'startSeconds':0,'endSeconds':10}]), \
         patch.object(ll,'Evidence',side_effect=build), patch.object(pipeline,'_transcript',side_effect=asr), \
         patch.object(pipeline.ai_provider,'current',side_effect=AssertionError('AGY forbidden')):
        plan = analysis.analyze(req, tmp_path/'source.mp4', tmp_path, lambda event:None, 'source', 'engine')
    assert plan['layoutDecision'] == {**plan['layoutDecision'], 'source':'local', 'layout':'speaker-cut', 'reason':'two-people-same-shot'}
    assert plan['clips'][0]['layout'] == 'speaker-cut'


def test_analysis_agy_screen_ranges_carry_focus_boxes_in_the_same_call(tmp_path):
    obj = evidence(['ambiguous'])
    obj.frames = [{'path':'cached.jpg','timestampSeconds':5}]
    req = {'operation':'edit','layout':'screencast','aspectRatio':'9:16','effects':[],
           'captions':{'enabled':False},'hook':{'enabled':False},'audio':{'mode':'keep'}}
    rpc = Mock()
    rpc.request.return_value = {'ranges':[
        {'start':0,'end':6,'what':'form','width_fraction':1,'focus_box':[.1,.2,.3,.1]},
        {'start':6,'end':10,'what':'menu','width_fraction':.3,'focus_box':[.9,.5,.3,.2]},  # clamped to the frame
    ]}
    with patch.object(analysis.checkpoints,'load',return_value=None), \
         patch.object(analysis.rendering,'probe',return_value={'width':1280,'height':720,'duration':10,'audio':False}), \
         patch.object(analysis.timelines,'scenes',return_value=[{'startSeconds':0,'endSeconds':10}]), \
         patch.object(ll,'Evidence',return_value=obj), \
         patch.object(pipeline.ai_provider,'current',return_value=rpc):
        plan = analysis.analyze(req, tmp_path/'source.mp4', tmp_path, lambda event:None, 'source', 'engine')
    clip = plan['clips'][0]
    assert rpc.request.call_count == 1
    assert 'focus_box' in rpc.request.call_args.args[0]
    assert 'focus_box' in json.dumps(rpc.request.call_args.args[1])
    assert clip['contentRanges'] == [[0,6,'form',1]]
    assert clip['contentFocus'] == [[0,6,.1,.2,.3,.1,'form'],[6,10,.9,.5,.1,.2,'menu']]


def test_focus_box_clamps_or_rejects():
    assert analysis.focus_box([.1,.2,.3,.4]) == [.1,.2,.3,.4]
    assert analysis.focus_box([-.05,.5,.5,.6]) == [0.0,.5,.45,.5]   # slightly outside: clamped
    assert analysis.focus_box([200,100,300,50]) is None             # pixels, not fractions
    assert analysis.focus_box([.5,.5,0,.2]) is None                 # empty
    assert analysis.focus_box([.5,.5,.02,.2]) is None               # a point, not a region
    assert analysis.focus_box([0,0,1,1]) is None                    # whole frame: no focus
    assert analysis.focus_box(None) is None and analysis.focus_box([.1,.2,.3]) is None
    assert analysis.focus_box([.1,'x',.3,.4]) is None
