"""Backend-only terminal-job cleanup; never infer terminal state from file age."""
import contextlib
import fcntl
import os
from pathlib import Path
import re
import shutil
import time
import uuid


@contextlib.contextmanager
def worker_lease(directory):
    configured = os.environ.get('SOURCE_VIDEO_JOB_DIRECTORY')
    root = Path(configured).resolve(strict=True) if configured else directory
    if not directory.is_relative_to(root):
        raise ValueError('workDir outside configured backend job root')
    with (root/'.retention.lock').open('a') as gate, (directory/'worker.lock').open('a') as lock:
        fcntl.flock(gate, fcntl.LOCK_SH)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            fcntl.flock(lock, fcntl.LOCK_UN)
            fcntl.flock(gate, fcntl.LOCK_UN)


def cleanup_terminal_jobs(root, candidates, active_job_ids, retention_seconds=86400, now=None):
    """Call only with a current backend DB terminal snapshot and its active IDs.

    candidates: [{jobId,status,finishedAtEpochSeconds}]. The durable orchestration
    owner must hold its job scheduling lease while calling this helper. Acquiring
    the exclusive root gate blocks new workers and refuses cleanup while any worker
    holds a shared gate. Review-waiting jobs must remain in active_job_ids.
    """
    path = Path(root)
    if not path.is_absolute() or path.is_symlink() or path == Path('/'):
        raise ValueError('invalid retention root')
    path = path.resolve(strict=True)
    if retention_seconds < 60:
        raise ValueError('retention must be at least 60 seconds')
    removed = []
    with (path/'.retention.lock').open('a') as gate:
        try:
            fcntl.flock(gate, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return removed
        for candidate in candidates:
            job_id = candidate.get('jobId', '')
            if not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', job_id):
                raise ValueError('invalid retention jobId')
            if job_id in active_job_ids or candidate.get('status') not in {'completed', 'failed', 'cancelled'}:
                continue
            finished = candidate.get('finishedAtEpochSeconds')
            if not isinstance(finished, (int, float)) or not 0 < finished <= (now or time.time())-retention_seconds:
                continue
            directory = path/job_id
            if not directory.is_dir() or directory.is_symlink():
                continue
            quarantine = path/('.retired-'+uuid.uuid4().hex)
            directory.rename(quarantine)
            shutil.rmtree(quarantine)
            removed.append(job_id)
    return removed
