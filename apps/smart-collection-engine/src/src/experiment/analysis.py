#!/usr/bin/env python3
"""
Unified (deprecated) analysis dispatch script.

The original monolithic implementation has been split into:
  - sensitivity.py
  - scalability.py
  - speedup.py

This file now only parses the --experiment argument and forwards to the
appropriate module, preserving backward compatibility.
"""

import argparse

from .common import load_parameters, get_paco_exec
from .sensitivity import sensitivity
from .scalability import scalability_analysis
from .speedup import speedup_analysis


def main():
    parser = argparse.ArgumentParser(description="PACO Algorithm Analysis Script (Dispatcher - deprecated)")
    parser.add_argument('--size', type=str, default='medium', help='Problem instance size')
    parser.add_argument('--instance-file', type=str, required=True, help='Path to problem instance file')
    parser.add_argument('--parameters', type=str, required=True, help='Path to PACO parameters YAML file')
    parser.add_argument('--output', type=str, required=True, help='Path to output CSV file')
    parser.add_argument('--experiment', type=str, choices=['sensitivity', 'scalability', 'speedup'], default='sensitivity')
    parser.add_argument('--num-runs', type=int, default=5, help='Number of repetitions for each configuration')
    args = parser.parse_args()

    config = load_parameters(args.parameters)
    paco_exec = get_paco_exec(__file__)
    print(f"(Deprecated dispatcher) Using PACO executable at: {paco_exec}")
    if not paco_exec.exists():
        print(f"Error: PACO executable not found at {paco_exec}")
        raise SystemExit(1)

    if args.experiment == 'sensitivity':
        sensitivity(args, config, paco_exec)
    elif args.experiment == 'scalability':
        scalability_analysis(args, config, paco_exec)
    else:
        speedup_analysis(args, config, paco_exec)


if __name__ == '__main__':
    main()