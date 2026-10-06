"""Private process limits. Aggregate disk monitoring is an observed soft limit."""
import os
from pathlib import Path
import signal
import threading

DEFAULTS = {'inputBytes': 1024**3, 'workBytes': 5*1024**3, 'durationSeconds': 21600}
ENV = {'inputBytes': 'OPENSHORTS_MAX_INPUT_BYTES', 'workBytes': 'OPENSHORTS_MAX_WORK_BYTES',
       'durationSeconds': 'OPENSHORTS_MAX_DURATION_SECONDS'}


class BudgetExceeded(RuntimeError):
    pass


def limits(request=None):
    result = {}
    requested = (request or {}).get('budgets', {})
    if not isinstance(requested, dict) or set(requested)-set(DEFAULTS):
        raise ValueError('unsupported resource budget')
    for key, default in DEFAULTS.items():
        maximum = int(os.environ.get(ENV[key], default))
        value = requested.get(key, maximum)
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 < value <= maximum:
            raise ValueError('budget must be positive and cannot expand backend limits: '+key)
        result[key] = value
    return result


def disk_bytes(directory):
    total = 0
    for current, dirs, files in os.walk(directory, followlinks=False):
        dirs[:] = [name for name in dirs if not Path(current, name).is_symlink()]
        for name in files:
            path = Path(current, name)
            try:
                if not path.is_symlink():
                    total += path.stat().st_size
            except FileNotFoundError:
                pass  # Encoder may atomically rename a file while scanning.
    return total


class Monitor:
    def __init__(self, request, source, directory, emit):
        self.limits = limits(request)
        self.directory, self.emit = directory, emit
        self.stop = threading.Event()
        if source.stat().st_size > self.limits['inputBytes']:
            raise BudgetExceeded('source exceeds input byte budget')
        self.check()

    def check(self):
        if disk_bytes(self.directory) > self.limits['workBytes']:
            raise BudgetExceeded('working artifacts exceed disk byte budget')

    def check_duration(self, duration):
        if duration > self.limits['durationSeconds']:
            raise BudgetExceeded('source exceeds duration budget')

    def __enter__(self):
        def observe():
            while not self.stop.wait(.5):
                try:
                    self.check()
                except BudgetExceeded as error:
                    self.emit({'type': 'error', 'code': 'RESOURCE_LIMIT', 'message': str(error)})
                    # The worker establishes its own group before starting encoders.
                    if os.getpgrp() == os.getpid():
                        os.killpg(os.getpid(), signal.SIGTERM)
                    os._exit(1)
        self.thread = threading.Thread(target=observe, name='disk-budget', daemon=True)
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.stop.set()
        self.thread.join(timeout=1)
