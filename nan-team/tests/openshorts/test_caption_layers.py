"""SPLIT captions preserve the seam, including the worker ASS adapter."""
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT/'packages/openshorts-engine/src'), str(ROOT/'packages/openshorts-engine/core')]
import pipeline


class CaptionLayerTests(unittest.TestCase):
    def test_ass_seam_applies_only_during_split_scene(self):
        transcript = {'language':'vi','segments':[
            {'start':0,'end':.4,'text':'Xin chào','words':[
                {'word':' Xin','start':0,'end':.2}, {'word':' chào','start':.2,'end':.4}]},
            {'start':1,'end':1.4,'text':'Việt Nam','words':[
                {'word':' Việt','start':1,'end':1.2}, {'word':' Nam','start':1.2,'end':1.4}]}]}
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            with patch('rendering.probe',return_value={'duration':2}), \
                 patch('subtitles.burn_subtitles') as burn:
                pipeline._captions(directory/'source.mp4', directory/'output.mp4', transcript,
                    {'style':'karaoke'}, directory, split_ranges=[(0,.5)])
            ass = Path(burn.call_args.args[1]).read_text()
            events = [line for line in ass.splitlines() if line.startswith('Dialogue:')]
            self.assertTrue(events)
            seam = [line for line in events if r'\an5' in line]
            self.assertTrue(seam)
            self.assertTrue(any('XIN' in line.upper() for line in seam))
            self.assertIn(r'\an5', events[0])
            self.assertNotIn(r'\an5', events[-1])


if __name__ == '__main__':
    unittest.main()
