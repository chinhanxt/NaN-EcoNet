import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


CORE = Path(__file__).resolve().parents[2] / 'packages/openshorts-engine/core'
sys.path.insert(0, str(CORE))
import hooks


class HookReadonlyCwdTests(unittest.TestCase):
    def test_hook_does_not_cover_faces_or_caption_band(self):
        protected = [[120,140,200,160],[0,450,360,190]]
        y = hooks.safe_overlay_y(360,640,300,90,protected)
        self.assertLessEqual(y+90,140)
        with self.assertRaisesRegex(ValueError,'No hook region'):
            hooks.safe_overlay_y(360,640,300,90,[[0,0,360,640]])

    def test_hook_overlay_uses_job_output_directory_when_cwd_is_readonly(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            source = directory / 'source.mp4'
            output = directory / 'hook.mp4'
            subprocess.run([
                'ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                'color=blue:s=320x568:r=12:d=1', '-c:v', 'libx264',
                '-threads', '1', str(source),
            ], check=True)
            previous = os.getcwd()
            try:
                os.chdir('/proc')
                self.assertTrue(hooks.add_hook_to_video(str(source), 'Save water', str(output), duration=.5))
            finally:
                os.chdir(previous)
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 0)
            self.assertEqual(list(directory.glob('temp_hook_*.png')), [])


if __name__ == '__main__':
    unittest.main()
