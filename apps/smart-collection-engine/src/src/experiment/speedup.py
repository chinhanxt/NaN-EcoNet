"""Speedup/Efficiency analysis CLI for PACO."""
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from statistics import mean, stdev

from .common import load_parameters, run_paco, get_paco_exec


def speedup_analysis(args, config, paco_exec):
    print("Running speedup/efficiency analysis...")
    parameters = config['parameters']
    default_params = {k: v['value'] if 'value' in v and not isinstance(v['value'], list) else v.get('default', None) for k, v in parameters.items()}
    total_ants = parameters.get('total_ants', {}).get('value', 6400)
    thread_counts = parameters.get('p', {}).get('value', [1, 2, 4, 8, 16, 32, 64])
    results = []
    baseline_runtime = None
    for threads in thread_counts:
        m = max(1, total_ants // threads)
        test_params = default_params.copy()
        test_params['p'] = threads
        test_params['m'] = m
        runtimes, qualities = [], []
        for _ in range(args.num_runs):
            print(f"Run {_ + 1}/{args.num_runs} for threads = {threads}, m = {m}")
            runtime, quality = run_paco(test_params, args.instance_file, paco_exec, args.size)
            if runtime is not None and quality is not None:
                runtimes.append(runtime)
                qualities.append(quality)
        if runtimes:
            avg_runtime = mean(runtimes)
            avg_quality = mean(qualities)
            std_runtime = stdev(runtimes) if len(runtimes) > 1 else 0.0
            std_quality = stdev(qualities) if len(qualities) > 1 else 0.0
            if threads == thread_counts[0]:
                baseline_runtime = avg_runtime
            speedup = (baseline_runtime / avg_runtime) if baseline_runtime else 1.0
            efficiency = speedup / threads
            result_row = {
                'thread_count': threads,
                'm': m,
                'avg_runtime': avg_runtime,
                'std_runtime': std_runtime,
                'avg_solution_quality': avg_quality,
                'std_solution_quality': std_quality,
                'speedup': speedup,
                'efficiency': efficiency,
                'instance': Path(args.instance_file).name,
            }
            results.append(result_row)
            print(f"Threads: {threads}, m: {m}, Speedup: {speedup:.2f}, Efficiency: {efficiency:.2f}")
        if results:
            with open(args.output, 'w', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=results[0].keys())
                writer.writeheader()
                writer.writerows(results)
    print(f"Speedup/efficiency analysis complete. Results saved to {args.output}")


def build_arg_parser():
    p = argparse.ArgumentParser(description="PACO Speedup Analysis")
    p.add_argument('--size', type=str, default='medium', help='Problem instance size')
    p.add_argument('--instance-file', type=str, required=True, help='Path to problem instance file')
    p.add_argument('--parameters', type=str, required=True, help='Path to PACO parameters YAML file')
    p.add_argument('--output', type=str, required=True, help='Path to output CSV file')
    p.add_argument('--num-runs', type=int, default=5, help='Number of repetitions for each configuration')
    return p


def main():  # pragma: no cover
    args = build_arg_parser().parse_args()
    config = load_parameters(args.parameters)
    paco_exec = get_paco_exec(__file__)
    if not paco_exec.exists():
        print(f"Error: PACO executable not found at {paco_exec}")
        raise SystemExit(1)
    speedup_analysis(args, config, paco_exec)


if __name__ == '__main__':  # pragma: no cover
    main()
