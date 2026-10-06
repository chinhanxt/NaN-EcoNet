"""Minimal local SDK shape for original prompts; no Google SDK/network calls."""
import json
import subprocess
import uuid
from pathlib import Path
from types import SimpleNamespace
import ai_provider


class GenerateContentConfig(SimpleNamespace):
    pass


class Part:
    @staticmethod
    def from_bytes(data, mime_type):
        if mime_type != 'image/jpeg':
            raise ValueError('Only JPEG frame parts are supported')
        rpc = ai_provider.current()
        path = rpc.workdir / ('frame-' + uuid.uuid4().hex + '.jpg')
        path.write_bytes(data)
        return SimpleNamespace(frame={'path': str(path), 'timestampSeconds': 0})


types = SimpleNamespace(GenerateContentConfig=GenerateContentConfig, Part=Part,
                        ThinkingConfig=GenerateContentConfig,
                        MediaResolution=SimpleNamespace(MEDIA_RESOLUTION_LOW='low'))


def sample_video(path, count=8):
    rpc = ai_provider.current()
    path = rpc.allowed(path)
    duration = float(json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'json', str(path)]))['format']['duration'])
    return sample_times(path, [duration*(index+0.5)/count for index in range(count)])


def sample_times(path, times, width=640):
    rpc = ai_provider.current()
    path = rpc.allowed(path)
    frames = []
    for seconds in times:
        target = rpc.workdir / ('frame-' + uuid.uuid4().hex + '.jpg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(seconds),
                        '-i', str(path), '-frames:v', '1', '-vf', f'scale={int(width)}:-2',
                        '-threads', '1', str(target)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60)
        frames.append({'path': str(target), 'timestampSeconds': seconds})
    return frames


class Files:
    def upload(self, file, config=None):
        path = ai_provider.current().allowed(file.name)
        return SimpleNamespace(name=str(path), path=str(path),
                               state=SimpleNamespace(name='ACTIVE'))

    def get(self, name):
        return SimpleNamespace(state=SimpleNamespace(name='ACTIVE'))

    def delete(self, name):
        pass  # These are local source references, never remote uploads.


class Models:
    def generate_content(self, model, contents, config=None):
        items = contents if isinstance(contents, list) else [contents]
        prompts, frames = [], []
        for item in items:
            if isinstance(item, str):
                prompts.append(item)
            elif hasattr(item, 'frame'):
                frames.append(item.frame)
            elif hasattr(item, 'path'):
                frames.extend(sample_video(item.path))
            else:
                raise ValueError('Unsupported AI content')
        schema_type = getattr(config, 'response_schema', None)
        schema = schema_type.model_json_schema() if schema_type else {'type': 'object'}
        name = getattr(schema_type, '__name__', '')
        role = 'visual-editor' if frames else 'content-editor'
        if name == 'EditPlan':
            role = 'render-reviewer'
        data = ai_provider.current().request('\n'.join(prompts), schema, frames, role)
        if schema_type:
            data = schema_type.model_validate(data).model_dump()
        return SimpleNamespace(text=json.dumps(data), usage_metadata=None,
                               candidates=[], prompt_feedback=None)


class Client:
    def __init__(self, **kwargs):
        ai_provider.current()  # Require authenticated job context.
        self.files, self.models = Files(), Models()
