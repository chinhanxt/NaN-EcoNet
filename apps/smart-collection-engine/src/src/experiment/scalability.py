"""Scalability analysis CLI for PACO."""
from __future__ import annotations

import argparse
import csv
from pathlib import Path
from statistics import mean, stdev

from .common import load_parameters, run_paco, get_paco_exec


def scalability_analysis(args, config, paco_exec):
    parameters = config['parameters']
    default_params = {k: v['default'] for k, v in parameters.items()}
    thread_counts = config.get('threading', {}).get('thread_counts', [1, 2, 4, 8])
    results = []
    for threads in thread_counts:
        test_params = default_params.copy()
        test_params['p'] = threads
        runtimes, qualities = [], []
        for _ in range(args.num_runs):
            runtime, quality = run_paco(test_params, args.instance_file, paco_exec, args.size)
            if runtime is not None and quality is not None:
                runtimes.append(runtime)
                qualities.append(quality)
        if runtimes:
            results.append({
                'thread_count': threads,
                'avg_runtime': mean(runtimes),
                'std_runtime': stdev(runtimes) if len(runtimes) > 1 else 0.0,
                'avg_solution_quality': mean(qualities),
                'std_solution_quality': stdev(qualities) if len(qualities) > 1 else 0.0,
                'num_successful_runs': len(runtimes),
                'instance': Path(args.instance_file).name,
            })
    if results:
        with open(args.output, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
    print(f"Scalability analysis complete. Results saved to {args.output}")


def build_arg_parser():
    p = argparse.ArgumentParser(description="PACO Scalability Analysis")
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
    scalability_analysis(args, config, paco_exec)


if __name__ == '__main__':  # pragma: no cover
    main()
