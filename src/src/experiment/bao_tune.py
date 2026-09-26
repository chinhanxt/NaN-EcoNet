#!/usr/bin/env python3
"""
Bayesian Optimization Tuning Script for VRPPL Solvers
"""
import argparse
import yaml
import subprocess
import json
from pathlib import Path
from skopt import gp_minimize
from skopt.space import Real, Integer, Categorical
from skopt.utils import use_named_args
import numpy as np

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer, np.int64)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, np.bool_):
            return bool(obj)
        return super(CustomEncoder, self).default(obj)

# --- Helper functions ---
def load_tune_config(tune_file, size):
    with open(tune_file, 'r') as f:
        config = yaml.safe_load(f)
    if size not in config:
        raise ValueError(f"Size '{size}' not found in tune file {tune_file}")
    return config[size]

def build_search_space(param_grid):
    space = []
    param_names = []
    for k, v in param_grid.items():
        if v.get('tune', True) is False:
            continue
        if len(v['range']) == 0:
            continue
        # Only add to param_names if we actually add to space
        param_names.append(k)
        if v['type'] == 'int':
            if isinstance(v['range'], list) and len(v['range']) > 2:
                space.append(Categorical(v['range'], name=k))
            else:
                space.append(Integer(v['range'][0], v['range'][-1], name=k))
        elif v['type'] == 'float':
            space.append(Real(v['range'][0], v['range'][-1], name=k))
        elif v['type'] == 'categorical':
            space.append(Categorical(v['range'], name=k))
    return space, param_names

def update_param_file(param_file_path, params, base_param_grid, instance_dir, size, output_csv):
    # Load the existing param file
    with open(param_file_path, 'r') as f:
        config = yaml.safe_load(f)
    # Update the params for the given size
    if size not in config:
        config[size] = {}
    if 'params' not in config[size]:
        config[size]['params'] = {}
    for k, v in base_param_grid.items():
        def to_scalar(val):
            # Convert numpy types to native python types
            if hasattr(val, 'item'):
                val = val.item()
            if isinstance(val, list):
                return val[0] if len(val) == 1 else val
            return val
        if v.get('tune', True) is False:
            config[size]['params'][k] = to_scalar(v['default'])
        elif k in params:
            config[size]['params'][k] = to_scalar(params[k])
        else:
            config[size]['params'][k] = to_scalar(v['default'])
    config[size]['data_dir'] = str(instance_dir)
    config[size]['num_runs'] = 1
    config[size]['output_csv'] = output_csv
    with open(param_file_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)

def run_solver(solver, param_file, instance_file, test_exec, size, timeout):
    try:
        cmd = [
            str(test_exec),
            '--solver', solver,
            '--params', param_file,
            '--size', size,
            '--instances', str(instance_file.parent),
            '--verbose', '1',
            '--output', '/tmp/bao_temp_output.csv'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)  # Reduced timeout to 1100 seconds
        if result.returncode != 0:
            print(f"Solver failed: {result.stderr}")
            return None, None
        import re
        # Parse for the specific instance we're interested in
        instance_name = instance_file.name
        lines = result.stdout.splitlines()
        for line in lines:
            # Match lines like '  Obj = 496.513, Vehicles = 7, Time = 12.4854s'
            m = re.search(r"Obj = ([0-9.eE+-]+), Vehicles = (\d+), Time = ([0-9.eE+-]+)s", line)
            if m:
                obj = float(m.group(1))
                time = float(m.group(3))
                return obj, time
        print(f"Could not parse solver output for instance {instance_name}")
        return None, None
    except Exception as e:
        print(f"Error running solver: {e}")
        return None, None

def main():
    parser = argparse.ArgumentParser(description="Bayesian Optimization Tuning for VRPPL Solvers")
    parser.add_argument('--solver', type=str, required=True, help='Solver name (e.g., paco, sa, ga, aco-ts)')
    parser.add_argument('--tune-file', type=str, required=True, help='Path to tune YAML file')
    parser.add_argument('--param-file', type=str, required=True, help='Path to static param YAML file to update')
    parser.add_argument('--instance-dir', type=str, required=True, help='Directory containing instances')
    parser.add_argument('--size', type=str, default='small', help='Experiment size (small, medium, large)')
    parser.add_argument('--n-calls', type=int, default=30, help='Number of BO iterations')
    parser.add_argument('--n-samples', type=int, default=5, help='Number of instances to sample for evaluation')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for instance sampling')
    parser.add_argument('--output', type=str, default='bao_tuning_result.json', help='Output file for best params')
    parser.add_argument('--runtime-weight', type=float, default=0.1, help='Weight for runtime in the objective function')
    parser.add_argument('--test-exec', type=str, default='../../build/main', help='Path to compiled test executable')
    parser.add_argument('--timeout', type=int, default=1100, help='Timeout for solver execution')
    args = parser.parse_args()

    param_grid = load_tune_config(args.tune_file, args.size)
    space, param_names = build_search_space(param_grid)
    instance_dir = Path(args.instance_dir)
    test_exec = Path(args.test_exec)
    size = args.size
    output_csv = '/tmp/bao_temp_output.csv'
    param_file_path = args.param_file
    runtime_weight = args.runtime_weight

    # Sample instances for tuning
    all_instance_files = sorted([f for f in instance_dir.iterdir() if f.is_file()])
    if not all_instance_files:
        print(f"No instance files found in {instance_dir}")
        exit(1)
    
    import random
    random.seed(args.seed)
    if args.n_samples > 0 and args.n_samples < len(all_instance_files):
        instance_files = random.sample(all_instance_files, args.n_samples)
    else:
        instance_files = all_instance_files
    
    print(f"Using {len(instance_files)} instances for evaluation:")
    for f in instance_files:
        print(f"  - {f.name}")

    @use_named_args(space)
    def objective(**params):
        print(f"Testing params: {params}")
        update_param_file(param_file_path, params, param_grid, instance_dir, size, output_csv)

        total_obj = 0
        total_time = 0
        success_count = 0

        for instance_file in instance_files:
            obj, time = run_solver(args.solver, param_file_path, instance_file, test_exec, size, args.timeout)
            if obj is None or time is None:
                print(f"Sample {instance_file.name} infeasible or timeout.")
                # Dynamic Penalty Strategy:
                # Avoid the "cliff" of 1e9 which distorts the Gaussian Process.
                # Instead, use a value worse than the worst valid solution seen so far.
                if hasattr(objective, 'valid_scores') and objective.valid_scores:
                    # 1.5x the worst valid score creates a barrier that "mvalid_scoresoves" with the search
                    penalty = max(objective.valid_scores) * 1.5
                else:
                    # Fallback if no valid solutions found yet (heuristic high value)
                    penalty = 100000.0
                print(f"  -> Assigning dynamic penalty: {penalty:.2f}")
                return penalty

            total_obj += obj
            total_time += time
            success_count += 1

        # if success_count == 0:
        #     print("All solver runs failed for this parameter set.")
        #     # Same penalty logic for total failure
        #     if hasattr(objective, 'valid_scores') and objective.valid_scores:
        #         return max(objective.valid_scores) * 1.5
        #     return 100000.0

        avg_obj = total_obj / success_count
        avg_time = total_time / success_count
        # Robust Penalty Mechanism:
        # Penalize runtime as a percentage of the timeout budget.
        # This scales with the objective value (solving the normalization issue)
        # and creates a trade-off relative to the allowed time.
        # Formula: Score = Obj * (1 + weight * (Time / Timeout))
        time_ratio = avg_time / args.timeout
        penalty_multiplier = 1.0 + (runtime_weight * time_ratio)
        score = avg_obj * penalty_multiplier

        print(f"Avg Obj: {avg_obj:.2f}, Avg Time: {avg_time:.2f}s (Ratio: {time_ratio:.2%}), Score: {score:.2f}")
        score = avg_obj + runtime_weight * avg_time
        # Track valid scores for future penalties
        if not hasattr(objective, 'valid_scores'):
            objective.valid_scores = []
        objective.valid_scores.append(score)
        return score

    res = gp_minimize(objective, space, n_calls=args.n_calls, random_state=args.seed, verbose=True)
    
    # Convert numpy types to native python types for JSON serialization
    best_params = {param_names[i]: res.x[i] for i in range(len(param_names))}
    
    print(f"Best params: {best_params}")
    print(f"Best objective: {res.fun}")
    with open(args.output, 'w') as f:
        json.dump({'best_params': best_params, 'best_objective': res.fun}, f, indent=2, cls=CustomEncoder)

if __name__ == '__main__':
    main()
