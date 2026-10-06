"""Model changes invalidate analysis and retained source transcription."""
import os
import hashlib
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import asr_identity
import checkpoints
import recut
import subtitles
import analysis


class AsrIdentityTests(unittest.TestCase):
    def test_pinned_model_is_named_and_partial_mismatch_refused(self):
        digest = lambda data: hashlib.sha256(data).hexdigest()
        pin = {'demo/model': {'revision': 'abc', 'files': {'model.bin': digest(b'weights'),
                                                           'config.json': digest(b'{}')}}}
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'WHISPER_MODEL':folder, 'WHISPER_LANGUAGE':'vi'}), \
                patch.object(asr_identity, 'PINNED', pin):
            model = Path(folder)/'model.bin'; model.write_bytes(b'weights')
            config = Path(folder)/'config.json'; config.write_bytes(b'{}')
            runtime = asr_identity.current()
            self.assertEqual(runtime['modelProvenance'],
                             {'model': 'demo/model', 'revision': 'abc', 'verification': 'pinned-sha256'})
            self.assertEqual(runtime['decode']['language'], 'vi')
            self.assertEqual(runtime['segmentation'], asr_identity.SEGMENTATION)
            config.write_bytes(b'{"changed": true}')
            with self.assertRaisesRegex(ValueError, 'pinned demo/model'):
                asr_identity.current()
            model.write_bytes(b'unknown')
            self.assertEqual(asr_identity.current()['modelProvenance'], {})

    def test_turbo_pin_is_the_published_revision(self):
        pin = asr_identity.PINNED['mobiuslabsgmbh/faster-whisper-large-v3-turbo']
        self.assertEqual(pin['revision'], '0a363e9161cbc7ed1431c9597a8ceaf0c4f78fcf')
        self.assertEqual(pin['files']['model.bin'], 'e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da')

    def test_timestamp_decoding_choice_changes_identity(self):
        with patch.dict(os.environ, {'WHISPER_WITHOUT_TIMESTAMPS':'true'}):
            self.assertTrue(asr_identity.decode_settings()['without_timestamps'])
        with patch.dict(os.environ, {'WHISPER_WITHOUT_TIMESTAMPS':'bad'}):
            with self.assertRaises(ValueError): asr_identity.decode_settings()

    def test_model_bytes_and_language_change_checkpoint_identity(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'WHISPER_MODEL':'', 'WHISPER_LANGUAGE':'auto'}):
            os.environ['WHISPER_MODEL'] = folder
            model = Path(folder)/'model.bin'; model.write_bytes(b'first')
            original = checkpoints.digest(checkpoints.settings({'operation':'edit'}))
            model.write_bytes(b'other')
            changed = checkpoints.digest(checkpoints.settings({'operation':'edit'}))
            self.assertNotEqual(original, changed)
            os.environ['WHISPER_LANGUAGE'] = 'vi'
            self.assertNotEqual(changed, checkpoints.digest(checkpoints.settings({'operation':'edit'})))
            self.assertEqual(asr_identity.current()['decode']['language'], 'vi')

    def test_approved_plan_rejects_runtime_change_before_render(self):
        with patch('asr_identity.current',return_value={'files':{'model.bin':'new'}}):
            with self.assertRaisesRegex(ValueError,'ASR runtime changed'):
                analysis.validate_plan({'version':1,'sourceFingerprint':'source','engineFingerprint':'engine',
                    'asrRuntime':{'files':{'model.bin':'old'}}}, {}, 'source', 'engine')

    def test_recut_retains_acoustic_confidence_and_identity(self):
        words = subtitles.merge_continuation_words([
            {'word':' Việt','start':1,'end':1.2,'probability':.9},
            {'word':'.','start':1.2,'end':1.3,'probability':.2}])
        transcript = {'language':'vi','asr':{'runtime':{'files':{'model.bin':'hash'}}},
            'segments':[{'words':words}]}
        result = recut.virtual_transcript(transcript,[{'start':1,'end':2}])
        self.assertEqual(result['asr'],transcript['asr'])
        self.assertEqual(result['segments'][0]['words'][0]['probability'],.2)
        self.assertEqual(result['segments'][0]['words'][0]['word'],' Việt.')
        self.assertEqual(result['segments'][0]['words'][0]['start'],0)


if __name__=='__main__': unittest.main()
