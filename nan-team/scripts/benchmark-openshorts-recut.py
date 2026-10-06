"""Source-bound OpenShorts recut benchmark, deliberately limited to recut.

Runs the original core and integrated snapshot against one identical local
input and EDL. Cold means a fresh Python process; warm means its second render.
The OS page cache is not flushed, so these timings are not disk-cold results.
"""
import argparse
import hashlib
import json
from pathlib import Path
import resource
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT.parents[1] / 'openshorts-core'
INTEGRATED = ROOT / 'packages/openshorts-engine/core'
DEFAULT_SOURCE = ROOT / 'reports/openshorts-integration/fixtures/vietnamese-source-18s.mp4'
SEGMENTS = [{'start': 1.0, 'end': 3.0}, {'start': 7.0, 'end': 9.0}]


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def checked(command):
    return subprocess.run(command, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, text=True).stdout


def output_info(path):
    probe = json.loads(checked(['ffprobe', '-v', 'error', '-show_format',
                                '-show_streams', '-of', 'json', str(path)]))
    decoded = checked(['ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:v:0',
                       '-f', 'framemd5', '-'])
    return {
        'sha256': sha(path), 'bytes': path.stat().st_size,
        'durationSeconds': float(probe['format']['duration']),
        'streams': [{'codec': s['codec_name'], 'type': s['codec_type'],
                     'width': s.get('width'), 'height': s.get('height')}
                    for s in probe['streams']],
        'decodedVideoFramemd5Sha256': hashlib.sha256(decoded.encode()).hexdigest(),
    }


def child(core, source, out_dir):
    before = resource.getrusage(resource.RUSAGE_CHILDREN)
    imported_at = time.perf_counter()
    sys.path.insert(0, str(core))
    import recut
    import_seconds = time.perf_counter() - imported_at
    renders = []
    for name in ('fresh_process_first_render', 'same_process_second_render'):
        output = out_dir / f'{name}.mp4'
        started = time.perf_counter()
        recut.run_cut_concat(str(source), SEGMENTS, str(output), str(out_dir))
        elapsed = time.perf_counter() - started
        usage = resource.getrusage(resource.RUSAGE_CHILDREN)
        renders.append({'name': name, 'wallSeconds': elapsed,
                        'ffmpegUserCpuSeconds': usage.ru_utime - before.ru_utime,
                        'ffmpegSystemCpuSeconds': usage.ru_stime - before.ru_stime,
                        'peakChildRssKiB': usage.ru_maxrss,
                        'output': output_info(output)})
        before = usage
    print(json.dumps({'core': str(core), 'coreRecutSha256': sha(core / 'recut.py'),
                      'coreFfmpegUtilsSha256': sha(core / 'ffmpeg_utils.py'),
                      'pythonImportSeconds': import_seconds,
                      'renders': renders}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--receipt', type=Path, default=ROOT / 'reports/openshorts-integration/recut-benchmark.json')
    parser.add_argument('--child', nargs=3, metavar=('CORE', 'SOURCE', 'OUTPUT_DIR'))
    args = parser.parse_args()
    if args.child:
        child(Path(args.child[0]), Path(args.child[1]), Path(args.child[2]))
        return
    source = args.source.resolve(strict=True)
    if source.stat().st_size == 0:
        raise ValueError('Source video is empty')
    for core in (ORIGINAL, INTEGRATED):
        if not core.is_dir():
            raise FileNotFoundError(core)
    versions = {'python': sys.version.split()[0],
                'ffmpeg': checked(['ffmpeg', '-version']).splitlines()[0]}
    results = {}
    with tempfile.TemporaryDirectory(prefix='openshorts-recut-benchmark-') as temporary:
        work = Path(temporary)
        # Keep the order explicit in the receipt. OS cache is uncontrolled, so
        # the timings are observations rather than a performance ranking.
        for name, core in (('baseline', ORIGINAL), ('candidate', INTEGRATED)):
            out_dir = work / name
            out_dir.mkdir()
            raw = checked([sys.executable, str(Path(__file__).resolve()), '--child',
                           str(core), str(source), str(out_dir)])
            # The upstream ffmpeg_utils prints its encoder choice on import.
            results[name] = json.loads(raw.splitlines()[-1])
    baseline = results['baseline']['renders']
    candidate = results['candidate']['renders']
    parity = [baseline[i]['output']['decodedVideoFramemd5Sha256'] ==
              candidate[i]['output']['decodedVideoFramemd5Sha256'] for i in range(2)]
    byte_parity = [baseline[i]['output']['sha256'] == candidate[i]['output']['sha256']
                   for i in range(2)]
    receipt = {
        'kind': 'source-bound-recut-only-benchmark',
        'recordedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'harnessSha256': sha(Path(__file__).resolve()),
        'source': {'path': str(source), 'sha256': sha(source), 'bytes': source.stat().st_size},
        'edl': SEGMENTS, 'versions': versions, 'results': results,
        'decodedVideoParity': parity, 'byteIdenticalOutputs': byte_parity,
        'limitations': [
            'This compares only the deterministic OpenShorts recut stage, not AI analysis, AGY calls, rendering, publishing, or end-to-end latency.',
            'The input is a local synthetic fixture, not representative user footage.',
            'Fresh process does not mean cold OS page cache; the baseline ran before the candidate.',
            'Peak child RSS includes FFmpeg and is a process maximum, not a stage-isolated delta.',
        ],
    }
    if not all(parity):
        raise AssertionError('Decoded baseline/candidate video differs')
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'receipt': str(args.receipt), 'decodedVideoParity': parity,
                      'baselineWallSeconds': [r['wallSeconds'] for r in baseline],
                      'candidateWallSeconds': [r['wallSeconds'] for r in candidate]}))


if __name__ == '__main__':
    main()
