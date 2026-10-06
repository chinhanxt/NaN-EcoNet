"""bin/docker-python host watchdog: the container is removed when the owner process dies."""
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
WRAPPER = ROOT/'packages/openshorts-engine/bin/docker-python'
# Fake docker: `run` records its pid under the container name and sleeps; `rm -f` kills it.
FAKE_DOCKER = r'''#!/usr/bin/env bash
state="$FAKE_DOCKER_STATE"
if [[ "$1" == run ]]; then
  while [[ $# -gt 0 && "$1" != --name ]]; do shift; done
  echo "$$" > "$state/$2.pid"; exec sleep 60
elif [[ "$1" == rm ]]; then
  echo "$3" >> "$state/removed"
  [[ -f "$state/$3.pid" ]] && kill "$(cat "$state/$3.pid")" 2>/dev/null
fi
exit 0
'''


@unittest.skipUnless(shutil.which('setsid'), 'setsid required')
class DockerPythonWatchdogTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp/'bin').mkdir()
        (self.tmp/'bin/docker').write_text(FAKE_DOCKER)
        (self.tmp/'bin/docker').chmod(0o755)
        (self.tmp/'models').mkdir()
        (self.tmp/'models/model.bin').write_text('x')
        (self.tmp/'yolo.pt').write_text('x')
        (self.tmp/'jobs').mkdir()
        (self.tmp/'state').mkdir()
        self.env = {**os.environ, 'PATH': '%s:%s' % (self.tmp/'bin', os.environ['PATH']),
                    'FAKE_DOCKER_STATE': str(self.tmp/'state'), 'SOURCE_VIDEO_JOB_DIRECTORY': str(self.tmp/'jobs'),
                    'OPENSHORTS_WHISPER_MODEL_DIRECTORY': str(self.tmp/'models'),
                    'OPENSHORTS_YOLO_MODEL_PATH': str(self.tmp/'yolo.pt'),
                    'OPENSHORTS_DOCKER_IMAGE': 'sha256:' + '0' * 64, 'OPENSHORTS_PARENT_POLL_SECONDS': '0.2'}

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def removed(self):
        path = self.tmp/'state/removed'
        return path.read_text().split() if path.exists() else []

    def wait_for(self, predicate, seconds=10):
        deadline = time.time() + seconds
        while time.time() < deadline:
            if predicate():
                return True
            time.sleep(.1)
        return False

    def test_owner_death_removes_container(self):
        owner = subprocess.Popen(['sleep', '60'])
        wrapper = subprocess.Popen([str(WRAPPER), '-c', 'pass'], stdin=subprocess.DEVNULL,
                                   env={**self.env, 'OPENSHORTS_OWNER_PID': str(owner.pid)}, start_new_session=True)
        name = 'nan-openshorts-%d' % wrapper.pid
        try:
            self.assertTrue(self.wait_for(lambda: (self.tmp/'state'/(name + '.pid')).exists()))
            time.sleep(.5)
            self.assertEqual(self.removed(), [])  # owner alive: container untouched
            owner.kill()
            owner.wait()
            self.assertTrue(self.wait_for(lambda: name in self.removed()))
            wrapper.wait(timeout=10)
        finally:
            owner.kill()
            if wrapper.poll() is None:
                os.killpg(wrapper.pid, signal.SIGKILL)

    def test_wrapper_sigkill_removes_container(self):
        wrapper = subprocess.Popen([str(WRAPPER), '-c', 'pass'], stdin=subprocess.DEVNULL, env=self.env,
                                   start_new_session=True)
        name = 'nan-openshorts-%d' % wrapper.pid
        self.assertTrue(self.wait_for(lambda: (self.tmp/'state'/(name + '.pid')).exists()))
        os.killpg(wrapper.pid, signal.SIGKILL)  # no trap runs; the setsid watchdog survives
        wrapper.wait()
        self.assertTrue(self.wait_for(lambda: name in self.removed()))

    def test_normal_exit_stops_watchdog(self):
        (self.tmp/'bin/docker').write_text('#!/usr/bin/env bash\necho "$1" >> "$FAKE_DOCKER_STATE/calls"\nexit 0\n')
        result = subprocess.run([str(WRAPPER), '-c', 'pass'], stdin=subprocess.DEVNULL, env=self.env, timeout=10)
        self.assertEqual(result.returncode, 0)
        time.sleep(1)
        calls = (self.tmp/'state/calls').read_text().split()
        self.assertEqual(calls, ['run', 'rm'])  # only the EXIT cleanup; the watchdog was stopped

    def test_owner_agy_limits_are_forwarded_only_when_set(self):
        (self.tmp/'bin/docker').write_text(
            '#!/usr/bin/env bash\n[[ "$1" == run ]] && printf "%s\\n" "$@" > "$FAKE_DOCKER_STATE/args"\nexit 0\n')
        subprocess.run([str(WRAPPER), '-c', 'pass'], stdin=subprocess.DEVNULL, timeout=10, check=True,
                       env={**self.env, 'AGY_MCP_WORKER_CONCURRENCY': '3'})
        args = (self.tmp/'state/args').read_text().split('\n')
        for name in ('AGY_MCP_WORKER_CONCURRENCY', 'AGY_MCP_TIMEOUT_MS'):
            self.assertIn(name, args)
            self.assertEqual(args[args.index(name) - 1], '-e')  # bare name: docker copies the value only if set


if __name__ == '__main__':
    unittest.main()
