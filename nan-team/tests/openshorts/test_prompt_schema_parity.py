"""Engine prompt text and AGY runner shape hint must describe the same result objects.

Run: nice -n 19 python3 -m pytest tests/openshorts/test_prompt_schema_parity.py -q
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / 'packages/openshorts-engine'
sys.path[:0] = [str(PACKAGE / 'src'), str(PACKAGE / 'core')]
import gemini_worker  # noqa: E402


def runner_shape(schema):
    script = ("const {resultShape,resultShapeNote}=require(process.argv[1]);"
              "const s=JSON.parse(require('fs').readFileSync(0,'utf8'));"
              "process.stdout.write(JSON.stringify([resultShape(s),resultShapeNote(s)]))")
    out = subprocess.run(['node', '-e', script, str(ROOT / 'packages/agy-mcp-runner/job-server.cjs')],
                         input=json.dumps(schema), capture_output=True, text=True, check=True, timeout=30)
    return json.loads(out.stdout)


def template_keys(template, list_key):
    block = template[template.rindex('"%s": [' % list_key):]
    return set(re.findall(r'"([a-z_]+)":', block)) - {list_key}


class PromptSchemaParity(unittest.TestCase):
    def test_runner_hint_renders_every_clip_field_as_object_item(self):
        for response, item in ((gemini_worker.DetailResponse, gemini_worker.DetailClipModel),
                               (gemini_worker.VisualResponse, gemini_worker.VisualClipModel),
                               (gemini_worker.ScoreResponse, gemini_worker.ScoredWindowModel)):
            shape, note = runner_shape(response.model_json_schema())
            self.assertNotIn('<item>', shape)
            self.assertIn('[{', shape)
            self.assertIn('never strings', note)
            schema = item.model_json_schema()
            for field in item.model_fields:
                marker = '' if field in schema.get('required', []) else '?'
                self.assertIn('"%s"%s: ' % (field, marker), shape, (response.__name__, field))

    def test_detail_and_score_templates_list_exact_model_fields(self):
        self.assertEqual(template_keys(gemini_worker.DETAIL_PROMPT_TEMPLATE, 'shorts'),
                         set(gemini_worker.DetailClipModel.model_fields))
        self.assertEqual(template_keys(gemini_worker.SCORE_PROMPT_TEMPLATE, 'windows'),
                         set(gemini_worker.ScoredWindowModel.model_fields))

    def test_visual_template_lists_exact_model_fields(self):
        self.assertEqual(template_keys(gemini_worker.VISUAL_PROMPT_TEMPLATE, 'shorts'),
                         set(gemini_worker.VisualClipModel.model_fields))


if __name__ == '__main__':
    unittest.main()
