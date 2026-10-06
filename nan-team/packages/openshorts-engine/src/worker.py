#!/usr/bin/env python3
"""One authenticated job per process. stdout is exclusively NDJSON protocol."""
import contextlib
import json
import os
from pathlib import Path
import sys
import threading

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'core'))
sys.path.insert(0, str(ROOT / 'src'))
os.environ.setdefault('PYTHONDONTWRITEBYTECODE', '1')
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
os.environ.setdefault('SCENE_ENGINE', 'pyscenedetect')


def exit_with_parent(parent, interval=2.0):
    """The Node owner spawns this worker detached (own process group). If the owner dies
    (orchestrator crash/restart) the Temporal retry starts a new worker; stop this orphan
    and its FFmpeg/ASR children so two heavy jobs never run side by side."""
    import signal
    import time

    def watch():
        while True:
            time.sleep(interval)
            if os.getppid() != parent:
                try:
                    if os.getpgrp() == os.getpid():
                        os.killpg(os.getpgrp(), signal.SIGKILL)
                finally:
                    os._exit(75)

    threading.Thread(target=watch, name='parent-watchdog', daemon=True).start()


def main():
    protocol = sys.stdout
    if os.environ.get('OPENSHORTS_EXIT_WITH_PARENT', '1') != '0':
        # The owner exports its PID so a parent that died before this line is still detected.
        owner = os.environ.get('OPENSHORTS_OWNER_PID', '')
        exit_with_parent(int(owner) if owner.isdigit() else os.getppid(),
                         float(os.environ.get('OPENSHORTS_PARENT_POLL_SECONDS', '2')))
    lock = threading.Lock()

    def emit(message):
        with lock:
            protocol.write(json.dumps(message, ensure_ascii=False, allow_nan=False) + '\n')
            protocol.flush()

    try:
        message = json.loads(sys.stdin.readline())
        if message.get('type') != 'start':
            raise ValueError('first message must be start')
        request = message['request']
        with contextlib.redirect_stdout(sys.stderr):
            import contracts
            source, directory = contracts.validate(request)
            # A separate group lets limits and parent cancellation stop FFmpeg too.
            if os.getpgrp() != os.getpid():
                os.setpgid(0, 0)
            # Heavy libraries must not write user/global config or shared caches.
            cache = directory / 'runtime-cache'
            cache.mkdir(exist_ok=True)
            for name in ('MPLCONFIGDIR', 'YOLO_CONFIG_DIR', 'TORCHINDUCTOR_CACHE_DIR', 'XDG_CACHE_HOME', 'TMPDIR'):
                os.environ[name] = str(cache)
            import tempfile
            tempfile.tempdir = str(cache)
            import ai_provider
            rpc = ai_provider.JobRpc(source, directory, emit, sys.stdin)
            ai_provider.configure(rpc)
            rpc.start_reader()
            import pipeline
            import budgets
            import retention
            with retention.worker_lease(directory), budgets.Monitor(request, source, directory, emit) as monitor:
                import rendering
                monitor.check_duration(rendering.probe(source)['duration'])
                result = pipeline.execute(request, emit)
                monitor.check()
        emit(result)
        return 0
    except Exception as error:
        with contextlib.redirect_stdout(sys.stderr):
            import traceback
            traceback.print_exc()
        code = 'RESOURCE_LIMIT' if error.__class__.__name__ == 'BudgetExceeded' else ('INVALID_REQUEST' if isinstance(error, (ValueError, KeyError, TypeError)) else 'ENGINE_FAILED')
        emit({'type': 'error', 'code': code, 'message': str(error)[:3000]})
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
