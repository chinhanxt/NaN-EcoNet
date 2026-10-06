"""Caption adapter boundary and real ASS generation, without AI/model loads."""
import copy
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / 'packages/openshorts-engine/src'),
               str(ROOT / 'packages/openshorts-engine/core')]
import caption_options
import pipeline
import subtitles


class CaptionAppearanceTests(unittest.TestCase):
    def test_private_boundary_rejects_injection_and_nonfinite_values(self):
        invalid = [{'fontName': "Anton',Outline=0"}, {'fontName': ' '},
                   {'fontColor': '#fff'}, {'bgColor': 'red;filter=x'},
                   {'fontSize': True}, {'fontSize': float('nan')},
                   {'borderWidth': 11}, {'baseOpacity': -1},
                   {'bgOpacity': float('inf')}, {'position': 'left'},
                   {'uppercase': 'true'}, {'effect': 'script'}]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                caption_options.validate(value)

    def test_existing_presets_and_explicit_effect_override(self):
        auto = {'font_name': 'Anton', 'fontsize': 44, 'font_color': '#FFFFFF',
                'highlight_color': '#FFE500', 'border_color': '#000000', 'border_width': 4,
                'base_opacity': 1.0, 'uppercase': True, 'max_chars': 16, 'max_duration': 1.4}
        for style, expected in [('karaoke', 'pop'), ('neon', 'glow'),
                                ('pop', 'pop'), ('box', 'box')]:
            self.assertEqual(caption_options.renderer_options(style),
                             (style, {**auto, 'effect': expected}))
        self.assertEqual(caption_options.renderer_options({'style': 'neon', 'effect': 'none'})[1]['effect'],
                         'none')
        self.assertEqual(caption_options.renderer_options('classic'), ('classic', {'effect': 'none'}))

    def test_default_karaoke_is_upstream_auto_style_and_user_values_win(self):
        style, values = caption_options.renderer_options({'style': 'karaoke'})
        for key, value in subtitles.AUTO_CAPTION_STYLE.items():
            if key not in ('style', 'alignment'):
                self.assertEqual(values['fontsize' if key == 'font_size' else key], value)
        _, values = caption_options.renderer_options({'style': 'karaoke', 'fontName': 'Montserrat',
                                                      'fontSize': 30, 'uppercase': False})
        self.assertEqual((values['font_name'], values['fontsize'], values['uppercase']),
                         ('Montserrat', 30, False))

    def test_default_block_size_reaches_the_ass_file(self):
        words = [{'word': ' ' + w, 'start': i * .3, 'end': i * .3 + .3}
                 for i, w in enumerate('được chữa lành sau covid rồi mọi người ơi'.split())]
        transcript = {'segments': [{'text': '', 'words': words}]}
        with tempfile.TemporaryDirectory() as directory:
            path, _, _ = pipeline._caption_file(transcript, {'style': 'karaoke'}, Path(directory), 3)
            text = path.read_text()
        self.assertIn('Style: Default,Anton,37,', text)
        self.assertIn('ĐƯỢC', text)
        # 16 chars / 1.4 s blocks: no block spans more than 1.4 s of speech.
        self.assertNotIn('LÀNH SAU COVID RỒI', text)

    def test_real_ass_has_requested_appearance_and_preserves_transcript(self):
        transcript = {'segments': [{'text': 'Xin chào', 'words': [
            {'word': ' Xin', 'start': 0, 'end': .5},
            {'word': ' chào', 'start': .5, 'end': 1}]}]}
        original = copy.deepcopy(transcript)
        options = {'style': 'pop', 'position': 'top', 'fontName': 'Anton',
                   'fontSize': 40, 'fontColor': '#112233', 'borderColor': '#223344',
                   'borderWidth': 3, 'highlightColor': '#445566',
                   'bgColor': '#556677', 'bgOpacity': .5, 'baseOpacity': .5,
                   'uppercase': True}
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            with patch.object(pipeline.rendering, 'probe', return_value={'duration': 1}), \
                 patch.object(subtitles, 'burn_subtitles') as burn:
                pipeline._captions('source.mp4', 'target.mp4', transcript, options, directory)
            text = next(directory.glob('*.ass')).read_text()
            self.assertIn('Style: Default,Anton,34,', text)
            self.assertIn(',8,10,10,', text)
            self.assertIn('CHÀO', text)
            self.assertIn('\\fscx90', text)
            self.assertIn('&H665544&', text)
            self.assertEqual(burn.call_args.kwargs['bg_opacity'], .5)
        self.assertEqual(transcript, original)

    def test_classic_passes_burn_controls_and_uppercases_without_mutation(self):
        transcript = {'segments': [{'text': 'Xin chào', 'words': [
            {'word': ' Xin', 'start': 0, 'end': .5},
            {'word': ' chào', 'start': .5, 'end': 1}]}]}
        original = copy.deepcopy(transcript)
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            with patch.object(pipeline.rendering, 'probe', return_value={'duration': 1}), \
                 patch.object(subtitles, 'burn_subtitles') as burn:
                pipeline._captions('source.mp4', 'target.mp4', transcript,
                    {'style': 'classic', 'fontName': 'Anton', 'fontSize': 40,
                     'position': 'middle', 'uppercase': True}, directory)
            self.assertIn('XIN CHÀO', next(directory.glob('*.srt')).read_text())
            self.assertEqual(burn.call_args.kwargs,
                             {'font_name': 'Anton', 'fontsize': 40, 'alignment': 'middle'})
        self.assertEqual(transcript, original)


if __name__ == '__main__':
    unittest.main()
