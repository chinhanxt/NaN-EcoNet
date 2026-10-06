import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EDGE_WORD_SCRIPT } from './tts.edge-script';
import { runTtsProcess } from './tts.process';

const prelude = String.raw`
import sys, types, asyncio
edge = types.ModuleType('edge_tts')
http = types.ModuleType('aiohttp')
class NoAudioReceived(Exception): pass
edge.exceptions = types.SimpleNamespace(NoAudioReceived=NoAudioReceived)
http.ClientError = type('ClientError', (Exception,), {})
calls = 0
class FakeStream:
    def __init__(self, *args, **kwargs): pass
    async def stream(self):
        global calls
        calls += 1
        if calls <= FAILURES: raise NoAudioReceived(f'Simulated {calls} attempts')
        yield {'type':'audio', 'data':b'unit-test-audio'}
        yield {'type':'WordBoundary', 'text':'Xin', 'offset':0, 'duration':1000000}
edge.Communicate = FakeStream
sys.modules['edge_tts'] = edge
sys.modules['aiohttp'] = http
async def no_wait(seconds): pass
asyncio.sleep = no_wait
`;

describe('Edge speech provider retry budget', () => {
  it.each([2, 5])('handles %i simulated empty speech responses within a five-attempt budget', async (failures) => {
    const directory = await mkdtemp(join(tmpdir(), 'nan-speech-retry-'));
    try {
      const pending = runTtsProcess('python3', ['-c', `FAILURES = ${failures}\n${prelude}\n${EDGE_WORD_SCRIPT}`], {
        stdin: JSON.stringify({ text: 'Xin', voice: 'vi-VN-HoaiMyNeural', audioPath: join(directory, 'voice.mp3') }),
      });
      if (failures === 5) await expect(pending).rejects.toThrow('Simulated 5 attempts');
      else expect(JSON.parse(await pending)).toEqual([{ text: 'Xin', startMs: 0, endMs: 100 }]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
