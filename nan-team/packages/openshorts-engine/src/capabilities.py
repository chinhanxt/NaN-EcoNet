"""Report observed runtime readiness without downloading/loading models."""
import importlib.util
import os
from pathlib import Path
import shutil
import budgets


def capabilities():
    modules = {name: importlib.util.find_spec(name) is not None for name in
               ('cv2', 'numpy', 'PIL', 'pydantic', 'scenedetect', 'mediapipe', 'ultralytics', 'faster_whisper')}
    model = os.environ.get('WHISPER_MODEL', '')
    weights = os.environ.get('YOLO_MODEL_PATH', '')
    return {'ffmpeg': shutil.which('ffmpeg'), 'ffprobe': shutil.which('ffprobe'),
            'modules': modules,
            'asrLocalAssets': bool(model and (Path(model)/'model.bin').is_file()),
            'yoloLocalAssets': bool(weights and Path(weights).is_file()),
            'asrModelPath': model or None, 'yoloModelPath': weights or None,
            'resourceLimits': budgets.limits(),
            'modelLoadHealth': 'not observed; asset presence is not a model inference test',
            'aiProvider': 'authenticated-parent-AGY-MCP-RPC',
            'aiReachability': 'requires a live parent job; not proven by library presence'}


if __name__ == '__main__':
    import json
    print(json.dumps(capabilities(), indent=2))
