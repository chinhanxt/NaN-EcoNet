#!/usr/bin/env python3
"""
Multi-Start Solver Script for Normalized CPU Time Comparison

This script runs sequential solvers (ACO, ALNS, HHO, etc.) multiple times until
the accumulated CPU time matches a given budget (typically from PACO results),
allowing fair comparison between parallel and sequential algorithms.

Usage:
    python multistart_solver.py \
        --M 5 \
        --size 25 \
        --max-cpu-time 18.5 \
        --solver aco \
        --params parameters/aco.param.yaml \
        --output-run output/multistart/aco_runs.csv \
        --output-agg output/multistart/aco_aggregated.csv
"""

import argparse
import subprocess
import os
import random
import csv
import re
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Optional


@dataclass
class RunResult:
    """Result from a single solver run."""
    instance: str
    run: int
    objective: float
    runtime: float
    num_vehicles: int


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Run sequential solver with multi-start approach for normalized CPU time comparison"
    )
    parser.add_argument(
        "--M", type=int, required=True,
        help="Number of instances to sample (use 0 for all instances)"
    )
    parser.add_argument(
        "--size", type=str, required=True, choices=["25", "50", "100"],
        help="Dataset size (25, 50, or 100)"
    )
    parser.add_argument(
        "--max-cpu-time", type=float, required=True,
        help="Maximum CPU time budget in seconds (from PACO results)"
    )
    parser.add_argument(
        "--solver", type=str, required=True,
        help="Sequential solver name (e.g., aco, alns, hho, sa, ga)"
    )
    parser.add_argument(
        "--params", type=str, required=True,
        help="Path to the parameter YAML file for the solver"
    )
    parser.add_argument(
        "--output-run", type=str, required=True,
        help="Path to export per-run results CSV"
    )
    parser.add_argument(
        "--output-agg", type=str, required=True,
        help="Path to export aggregated results CSV"
    )
    parser.add_argument(
        "--executable", type=str, default="./build/main",
        help="Path to the solver executable (default: ./build/main)"
    )
    parser.add_argument(
        "--verbose", type=int, default=0,
        help="Verbosity level (0=quiet, 1=info, 2=debug)"
    )
    return parser.parse_args()


def get_size_key(size: str) -> str:
    """Convert size to parameter key."""
    size_map = {"25": "small", "50": "medium", "100": "large"}
    return size_map.get(size, "small")


def sample_instances(data_dir: Path, m: int) -> List[Path]:
    """Sample M instances from the data directory."""
    all_instances = sorted([f for f in data_dir.glob("*.txt")])
    
    if m <= 0 or m >= len(all_instances):
        # Use all instances
        return all_instances
    
    return sorted(random.sample(all_instances, m))


def run_solver(
    executable: str,
    solver: str,
    params_file: str,
    instance_file: Path,
    size_key: str,
    verbose: int = 0
) -> Tuple[float, float, int]:
    """
    Run the solver once and return (objective, runtime, num_vehicles).
    
    Returns:
        Tuple of (objective_value, runtime_seconds, num_vehicles)
    """
    cmd = [
        executable,
        "--solver", solver,
        "--params", params_file,
        "--instances", str(instance_file.parent),
        "--num-runs", "1",
        "--size", size_key,
        "--output", "/tmp/multistart_temp.csv",
        "--verbose", str(verbose)
    ]
    
    # Filter to run only the specific instance
    # The main.cpp loads all instances from directory, so we need a workaround
    # We'll create a temporary directory with just this instance
    import tempfile
    import shutil
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Copy the single instance file to temp directory
        tmp_instance = Path(tmpdir) / instance_file.name
        shutil.copy(instance_file, tmp_instance)
        
        # Update command to use temp directory
        cmd = [
            executable,
            "--solver", solver,
            "--params", params_file,
            "--instances", tmpdir,
            "--num-runs", "1",
            "--size", size_key,
            "--output", f"{tmpdir}/output.csv",
            "--verbose", str(verbose)
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout per run
            )
            
            # Parse output CSV
            output_csv = Path(tmpdir) / "output.csv"
            if output_csv.exists():
                with open(output_csv, 'r') as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        objective = float(row.get("Best Distance", row.get("AVG Distance", 0)))
                        runtime = float(row.get("AVG Runtime (s)", 0))
                        num_vehicles = int(row.get("Num Vehicles", 0))
                        return objective, runtime, num_vehicles
            
            # Fallback: parse from stdout
            stdout = result.stdout
            # Look for patterns like "Obj = 213.335" and "Time = 18.8492s"
            obj_match = re.search(r"Obj\s*=\s*([\d.]+)", stdout)
            time_match = re.search(r"Time\s*=\s*([\d.]+)", stdout)
            vehicles_match = re.search(r"Vehicles\s*=\s*(\d+)", stdout)
            
            objective = float(obj_match.group(1)) if obj_match else float('inf')
            runtime = float(time_match.group(1)) if time_match else 0.0
            num_vehicles = int(vehicles_match.group(1)) if vehicles_match else 0
            
            return objective, runtime, num_vehicles
            
        except subprocess.TimeoutExpired:
            print(f"  WARNING: Solver timed out for {instance_file.name}")
            return float('inf'), 3600.0, 0
        except Exception as e:
            print(f"  ERROR running solver: {e}")
            return float('inf'), 0.0, 0


def run_multistart(
    args: argparse.Namespace,
    instance: Path,
    size_key: str
) -> List[RunResult]:
    """
    Run the solver multiple times until accumulated CPU time reaches the budget.
    
    Returns:
        List of RunResult for each run
    """
    results = []
    accumulated_time = 0.0
    run = 0
    
    print(f"\nProcessing: {instance.name}")
    print(f"  CPU time budget: {args.max_cpu_time:.2f}s")
    
    while accumulated_time < args.max_cpu_time:
        run += 1
        objective, runtime, num_vehicles = run_solver(
            args.executable,
            args.solver,
            args.params,
            instance,
            size_key,
            args.verbose
        )
        
        accumulated_time += runtime
        
        result = RunResult(
            instance=instance.name,
            run=run,
            objective=objective,
            runtime=runtime,
            num_vehicles=num_vehicles
        )
        results.append(result)
        
        print(f"  Run {run}: Obj={objective:.3f}, Time={runtime:.3f}s, "
              f"Accumulated={accumulated_time:.3f}s")
        
        # Safety check: if runtime is 0 or very small, break to avoid infinite loop
        if runtime < 0.001:
            print(f"  WARNING: Runtime too small ({runtime}s), stopping early")
            break
    
    print(f"  Completed {run} runs, Total CPU time: {accumulated_time:.3f}s")
    return results


def main():
    args = parse_args()
    
    # Determine paths
    script_dir = Path(__file__).parent
    data_dir = script_dir / "data" / args.size
    
    if not data_dir.exists():
        print(f"ERROR: Data directory not found: {data_dir}")
        return 1
    
    size_key = get_size_key(args.size)
    
    # Sample instances
    instances = sample_instances(data_dir, args.M)
    print(f"Sampled {len(instances)} instances from {data_dir}")
    for inst in instances:
        print(f"  - {inst.name}")
    
    # Prepare output directories
    run_output_path = Path(args.output_run)
    agg_output_path = Path(args.output_agg)
    run_output_path.parent.mkdir(parents=True, exist_ok=True)
    agg_output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Open output files
    all_run_results: List[RunResult] = []
    aggregated_results = []
    
    for instance in instances:
        run_results = run_multistart(args, instance, size_key)
        all_run_results.extend(run_results)
        
        # Compute aggregated statistics
        if run_results:
            best_obj = min(r.objective for r in run_results)
            best_vehicles = min(
                (r.num_vehicles for r in run_results if r.objective == best_obj),
                default=0
            )
            avg_runtime = sum(r.runtime for r in run_results) / len(run_results)
            total_cpu_time = sum(r.runtime for r in run_results)
            num_runs = len(run_results)
            
            aggregated_results.append({
                "instance_name": instance.name,
                "Num Vehicles": best_vehicles,
                "Best Distance": best_obj,
                "Num Runs": num_runs,
                "AVG Runtime (s)": avg_runtime,
                "Total CPU Time (s)": total_cpu_time
            })
    
    # Write per-run results
    with open(run_output_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(["instance_name", "run", "objective", "runtime", "num_vehicles"])
        for r in all_run_results:
            writer.writerow([r.instance, r.run, r.objective, r.runtime, r.num_vehicles])
    
    print(f"\nPer-run results saved to: {run_output_path}")
    
    # Write aggregated results
    with open(agg_output_path, 'w', newline='') as f:
        fieldnames = ["instance_name", "Num Vehicles", "Best Distance", "Num Runs", 
                      "AVG Runtime (s)", "Total CPU Time (s)"]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(aggregated_results)
    
    print(f"Aggregated results saved to: {agg_output_path}")
    
    # Print summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Solver: {args.solver}")
    print(f"Dataset size: {args.size}")
    print(f"CPU time budget: {args.max_cpu_time}s")
    print(f"Instances processed: {len(instances)}")
    print(f"Total runs: {len(all_run_results)}")
    
    if aggregated_results:
        avg_best = sum(r["Best Distance"] for r in aggregated_results) / len(aggregated_results)
        print(f"Average best objective: {avg_best:.3f}")
    
    return 0


if __name__ == "__main__":
    exit(main())
