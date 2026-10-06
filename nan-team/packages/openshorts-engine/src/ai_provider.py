"""Job-scoped JSON RPC. The Node owner routes requests to native AGY MCP."""
import json
import os
import threading
import time
import uuid
from pathlib import Path

_provider = None


def configure(provider):
    global _provider
    _provider = provider


def current():
    if _provider is None:
        raise RuntimeError('AGY job RPC is not configured; direct provider calls are disabled')
    return _provider


def agy_deadline_seconds(native_review=False):
    """Mirror of the AGY runner deadline (agy-mcp-runner/index.cjs): 300 s, 600 s with native review, capped at 600 s."""
    try:
        configured = float(os.environ.get('AGY_MCP_TIMEOUT_MS') or 0)
    except ValueError:
        configured = 0
    milliseconds = configured if configured > 0 else (600000 if native_review else 300000)
    return min(600000, max(1000, milliseconds)) / 1000


def parallelism():
    """AGY requests the Node owner runs at once (AGY_MCP_WORKER_CONCURRENCY, clamped 1..4 like the owner)."""
    try:
        value = int(os.environ.get('AGY_MCP_WORKER_CONCURRENCY') or 1)
    except ValueError:
        value = 1
    return max(1, min(4, value))


class Background:
    """A daemon-thread call; result() returns its value or re-raises its error.

    Daemon, so a failing job never waits at interpreter exit for an AGY answer.
    """
    def __init__(self, function, *args, **kwargs):
        self._done = threading.Event()
        self._value = self._error = None
        def run():
            try:
                self._value = function(*args, **kwargs)
            except BaseException as error:  # re-raised in result()
                self._error = error
            finally:
                self._done.set()
        threading.Thread(target=run, daemon=True).start()

    def result(self):
        self._done.wait()
        if self._error is not None:
            raise self._error
        return self._value


def gather(calls, limit=None):
    """Results of zero-argument calls, in order.

    Sequential (the historical behaviour) unless the owner runs more than one AGY
    request at once; then at most `limit` (default parallelism()) run together.
    The first failure in call order is re-raised after every call has finished.
    """
    calls = list(calls)
    limit = parallelism() if limit is None else max(1, int(limit))
    if limit <= 1 or len(calls) <= 1:
        return [call() for call in calls]
    gate = threading.Semaphore(limit)
    def bounded(call):
        with gate:
            return call()
    running = [Background(bounded, call) for call in calls]
    outcomes = []
    for job in running:
        try:
            outcomes.append((True, job.result()))
        except BaseException as error:
            outcomes.append((False, error))
    for ok, value in outcomes:
        if not ok:
            raise value
    return [value for _, value in outcomes]


# A request still queued in the Node owner (no ai-started yet) may wait this many
# extra deadlines before the Python side gives up; each attempt start resets the clock.
QUEUE_GRACE_DEADLINES = 1


class JobRpc:
    def __init__(self, source, workdir, emit, input_stream, timeout=None):
        self.source = Path(source).resolve(strict=True)
        self.workdir = Path(workdir).resolve(strict=True)
        self.emit, self.input_stream, self.timeout = emit, input_stream, timeout
        self.lock = threading.Lock()
        self.pending = {}
        self.closed = False

    def start_reader(self):
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        try:
            for line in self.input_stream:
                message = json.loads(line)
                if message.get('type') not in ('ai-result', 'ai-error', 'ai-started'):
                    continue
                with self.lock:
                    slot = self.pending.get(message.get('requestId'))
                    if slot and message['type'] == 'ai-started':
                        slot['started'] = time.monotonic()  # each AGY attempt restarts the deadline
                        slot['grace'] = 0.0
                    elif slot:
                        slot['response'] = message
                        slot['event'].set()
        finally:
            with self.lock:
                self.closed = True
                for slot in self.pending.values():
                    slot['event'].set()

    def allowed(self, path):
        path = Path(path).resolve(strict=True)
        if path != self.source and not path.is_relative_to(self.workdir):
            raise ValueError('AI media must belong to this job')
        return path

    def request(self, prompt, schema, frames=None, role='content-editor', native_review=False):
        # Token repair may overlap moment selection; the selection brief is not its evidence.
        if getattr(self, 'selection_brief', '') and role != 'asr-repair':
            prompt += '\nUser selection preference (apply only when selecting/scoring source clips): ' + self.selection_brief
        request_id = uuid.uuid4().hex
        # AGY deadline + 60 s, measured from the latest attempt start the Node owner reports.
        timeout = self.timeout if self.timeout is not None else agy_deadline_seconds(native_review) + 60
        # Until the owner reports the first attempt start the request may be queued behind
        # another AGY request (overlapped layout/content/effects), so it gets queue grace.
        slot = {'event': threading.Event(), 'started': time.monotonic(), 'grace': timeout * QUEUE_GRACE_DEADLINES}
        with self.lock:
            if self.closed:
                raise RuntimeError('AGY RPC input closed')
            self.pending[request_id] = slot
        try:
            payload = {'type': 'ai-request', 'requestId': request_id,
                       'prompt': prompt, 'schema': schema, 'role': role}
            if native_review:
                payload['nativeReview'] = True
            if frames:
                payload['frames'] = frames
            self.emit(payload)
            while not slot['event'].wait(max(0.0, min(5.0, slot['started'] + slot['grace'] + timeout - time.monotonic()))):
                if time.monotonic() >= slot['started'] + slot['grace'] + timeout:
                    raise TimeoutError('AGY analysis deadline exceeded')
            answer = slot.get('response')
            if not answer:
                raise RuntimeError('AGY RPC input closed before response')
            if answer['type'] == 'ai-error':
                raise RuntimeError(answer.get('message', 'AGY analysis failed'))
            data = answer.get('data')
            if not isinstance(data, dict):
                raise ValueError('AGY must return a JSON object')
            return data
        finally:
            with self.lock:
                self.pending.pop(request_id, None)
