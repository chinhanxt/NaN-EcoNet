"""Generate an original, quiet ambient accompaniment. No downloaded music assets."""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

RATE = 48000
DURATION = 60
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'packages/remotion-engine/public/audio/morning-ambient.mp3'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
t = np.arange(RATE * DURATION, dtype=np.float64) / RATE
left = np.zeros_like(t)
right = np.zeros_like(t)
# Cmaj7, Am7, Fmaj7, G6: softly voiced pads with a sparse piano arpeggio.
chords = [(48, 55, 59, 64), (45, 52, 55, 60), (41, 48, 52, 57), (43, 50, 55, 59)]
for bar in range(20):
    start = bar * 3
    local = t - start
    envelope = np.where((local >= 0) & (local < 4), np.minimum(local / .45, 1) * np.clip((4 - local) / 1.1, 0, 1), 0)
    for i, note in enumerate(chords[bar % 4]):
        hz = 440 * 2 ** ((note - 69) / 12)
        tone = np.sin(2 * np.pi * hz * t) + .22 * np.sin(2 * np.pi * hz * 2 * t)
        left += tone * envelope * .030 * (1 + .15 * np.sin(2 * np.pi * .17 * t + i))
        right += tone * envelope * .030 * (1 + .15 * np.sin(2 * np.pi * .17 * t + i + .8))
    for beat in range(4):
        note = chords[bar % 4][beat] + 12
        hz = 440 * 2 ** ((note - 69) / 12)
        age = t - (start + beat * .75)
        active = age >= 0
        env = np.where(active, np.minimum(np.maximum(age, 0) / .012, 1) * np.exp(-np.maximum(age, 0) * 2.4), 0)
        piano = np.sin(2 * np.pi * hz * t) + .25 * np.sin(2 * np.pi * hz * 2 * t) + .07 * np.sin(2 * np.pi * hz * 3 * t)
        left += piano * env * .08
        right += piano * env * .07
fade = np.clip(t / 1.5, 0, 1) * np.clip((DURATION - t) / 2, 0, 1)
stereo = np.stack([left * fade, right * fade], axis=1)
stereo *= .68 / max(float(np.max(np.abs(stereo))), .68)
with tempfile.TemporaryDirectory(prefix='nan-bgm-') as folder:
    wav = Path(folder) / 'ambient.wav'
    with wave.open(str(wav), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(RATE)
        stream.writeframes((stereo * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k', str(OUTPUT)], check=True)
print(OUTPUT)
