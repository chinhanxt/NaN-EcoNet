# Sample commands

**Run the sensitivity analysis**
`uv run -m src.experiment.sensitivity`:
 - `--size <large | medium | small>`: Size of the problem instance.
 - `--instance-file <path_to_instance_file>`: Path to the instance file to use for the experiment.
 - `--parameters <path_to_parameters_file>`: Path to the YAML file containing the parameters for the experiment.
 - `--output <path_to_output_file>`: Path to the output CSV file to store the results.
 - `--num-runs <number_of_runs>`: Number of runs to perform for each parameter setting.

For example: `uv run -m src.experiment.sensitivity --size small --instance-file data/25 --parameters parameters/paco.tune.yaml --output results/sensitivity.csv --num-runs 5`

**Build the project**

1. `cd src/build`
2. `make`
3. `cd ..`

**Run the solver on a set of instances (`main`)**

Use `./build/main` to run experiments on all instances in a directory.

Options:
 - `--solver <paco | sa>`: The solver to use (PACO or Simulated Annealing).
 - `--params <path_to_parameters_file>`: Path to the YAML file containing solver parameters.
 - `--instances <path_to_directory>`: Directory containing instance files.
 - `--num-runs <number_of_runs>`: Number of runs per instance. (Default: 5)
 - `--output <path_to_output_file.csv>`: Path to store result CSV.
 - `--size <large | medium | small>`: Problem size category for parameter lookup.
 - `--verbose <level>`: 0 (results only), 1 (summary).

Example:
```bash
./build/main --solver paco --params parameters/paco.param.yaml --instances data/25 --num-runs 5 --output output/experiment_results.csv --size small
```

**Run the solver on a single instance (`test`)**

Use `./build/test` to run a solver on a specific instance, useful for debugging or quick checks.

Options:
 - `--solver <paco | sa>`: The solver to use.
 - `--instance-file <path_to_file>`: Specific instance file to solve.
 - `--params <path_to_parameters_file>`: Path to solver parameters YAML.
 - `--size <large | medium | small>`: Problem size category.
 - `--verbose <level>`: 0 (minimal), 1 (basic), 2 (detailed routes).
 - `--full-solution`: Output full solution details in JSON format.

Example:
```bash
./build/test --solver paco --params parameters/paco.param.yaml --instance-file data/25/C101_co_25.txt --size small --verbose 2
```