import os
import subprocess
import sys
import time
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[2] / 'packages/openshorts-engine'


def alive(pid):
    try:
        state = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()[0]
    except (FileNotFoundError, ProcessLookupError, IndexError):
        return False
    return state not in ('Z', 'X')


@unittest.skipUnless(sys.platform.startswith('linux'), 'uses /proc')
class WorkerParentDeathTest(unittest.TestCase):
    def spawn_orphan(self, env):
        read, write = os.pipe()  # the test keeps stdin open: only the watchdog can end the worker
        launcher = ('import subprocess,sys;'
                    'import os;p=subprocess.Popen([sys.executable,sys.argv[1]],stdin=int(sys.argv[2]),pass_fds=(int(sys.argv[2]),),'
                    'stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True,'
                    'env={**os.environ,"OPENSHORTS_OWNER_PID":str(os.getpid())});print(p.pid)')
        out = subprocess.run([sys.executable, '-c', launcher, str(PACKAGE / 'src/worker.py'), str(read)],
                             capture_output=True, text=True, env=env, pass_fds=(read,), check=True, timeout=30)
        os.close(read)
        self.addCleanup(os.close, write)
        return int(out.stdout.strip())

    def test_orphaned_worker_group_exits_after_owner_dies(self):
        env = {**os.environ, 'OPENSHORTS_PARENT_POLL_SECONDS': '0.2'}
        pid = self.spawn_orphan(env)
        deadline = time.monotonic() + 10
        while alive(pid) and time.monotonic() < deadline:
            time.sleep(0.1)
        self.assertFalse(alive(pid), 'orphaned worker kept running after its owner died')

    def test_watchdog_can_be_disabled(self):
        env = {**os.environ, 'OPENSHORTS_PARENT_POLL_SECONDS': '0.2', 'OPENSHORTS_EXIT_WITH_PARENT': '0'}
        pid = self.spawn_orphan(env)
        try:
            time.sleep(1.5)
            self.assertTrue(alive(pid))
        finally:
            try:
                os.kill(pid, 9)
            except ProcessLookupError:
                pass


if __name__ == '__main__':
    unittest.main()
