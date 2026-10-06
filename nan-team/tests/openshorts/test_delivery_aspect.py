"""Real frame geometry regressions for narrower inputs and canonical canvases."""
from pathlib import Path
import os
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'packages/openshorts-engine/src'),
               str(ROOT / 'packages/openshorts-engine/core')]
import rendering


class DeliveryAspectTests(unittest.TestCase):
    def test_portrait_is_not_passed_through_for_square_or_landscape(self):
        os.environ['OPENSHORTS_THREADS'] = '1'
        os.environ['FFMPEG_ENCODER'] = 'x264'
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            source = directory / 'portrait.mp4'
            rendering.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                           'testsrc2=size=120x160:rate=10', '-t', '0.5',
                           '-c:v', 'libx264', str(source)])
            for aspect, ratio in [('1:1', 1), ('16:9', 16 / 9)]:
                for layout in ['wide', 'general']:
                    target = directory / (aspect.replace(':', '-') + layout + '.mp4')
                    with self.subTest(aspect=aspect, layout=layout):
                        decision = rendering.reframe(source, target, aspect, layout, [])
                        metadata = rendering.probe(target)
                        self.assertLess(abs(metadata['width'] / metadata['height'] - ratio), .01)
                        self.assertGreaterEqual(metadata['width'], 1080)
                        self.assertEqual(decision['engine'], 'core-filter-builder')
                        self.assertAlmostEqual(metadata['duration'], .5, delta=.15)


if __name__ == '__main__':
    unittest.main()
