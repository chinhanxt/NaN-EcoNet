"""scripts/remove-background.py: flood-fill fallback on a white sticker (no rembg model needed)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import cv2
import numpy as np

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'remove-background.py'
spec = importlib.util.spec_from_file_location('remove_background', SCRIPT)
remove_background = importlib.util.module_from_spec(spec)
spec.loader.exec_module(remove_background)


class FloodFillTest(unittest.TestCase):
    def sticker(self, folder, background=(255, 255, 255)):
        image = np.full((200, 200, 3), background, np.uint8)
        cv2.circle(image, (100, 100), 60, (30, 140, 240), -1)
        cv2.circle(image, (100, 100), 15, (255, 255, 255), -1)  # white inside the sticker stays opaque
        path = str(Path(folder) / 'sticker.png')
        cv2.imwrite(path, image)
        return path

    def test_white_paper_becomes_transparent_and_inner_white_is_kept(self):
        with tempfile.TemporaryDirectory() as folder:
            image, method = remove_background.with_flood_fill(self.sticker(folder))
        self.assertEqual(method, 'flood-fill')
        self.assertEqual(image.shape[2], 4)
        self.assertEqual(image[2, 2, 3], 0)
        self.assertEqual(image[100, 60, 3], 255)
        self.assertEqual(image[100, 100, 3], 255)

    def test_busy_border_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.sticker(folder)
            noisy = cv2.imread(path)
            noisy[:, :20] = np.random.default_rng(1).integers(0, 255, noisy[:, :20].shape, dtype=np.uint8)
            cv2.imwrite(path, noisy)
            with self.assertRaises(RuntimeError):
                remove_background.with_flood_fill(path)


if __name__ == '__main__':
    unittest.main()
