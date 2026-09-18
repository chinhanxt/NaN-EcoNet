---
mode: 'agent'
description: 'Generate script to run analysis on the proposed PACO algorithm.'
---
You are a expert in algorithm design and optimization.
You are given a PACO algorithm for solving the Vehicle Routing Problem with Parcel Locker (VRPPL) and a set of parameters.
Your task is to generate a script that will run an analysis on the proposed PACO algorithm.
The code should be organized and well-structured, following best practices for readability and maintainability.
Each test should be clearly defined and separated into modules.
The analysis should include the following steps:

**Script inputs**:
- "--size" (string): The size of the problem instance (e.g., "small", "medium", "large").
- "--instance" (string): The path to the problem instance file.
- "--parameters" (string): The path to the PACO's parameters YAML file.
- "--output" (string): The path to the output file where results will be saved.
- "--experiment" (string): The type of experiment to run ["scalability", "sensitivity"].
- "--num-runs" (int): The number of repetitions for each configuration.

## Scalability Analysis:
1. The path to the predefined PACO's parameters YAML file will be given.
2. The script should read the parameters from the YAML file.
3. Load a problem instance from the specified path.
4. Run the PACO with different numbers of threads (1, 2, 4, 8, etc.), the range will be defined in the parameters file.
5. Record the execution time and solution quality for each thread count.
*Create a sample parameters file that you can use for testing.*

## Parameter Sensitivity Analysis:
1. The path to the predefined PACO's parameters YAML file will be given.
2. The script should read the parameters from the YAML file.
3. Each parameter will be varied one at a time while keeping others constant (using default values).
4. Any parameter that is not varied should be set to its default value.
5. Run each configuration multiple times (as specified by --num-runs) and record the average execution time and solution quality.
6. Record the runtime, solution quality, and the parameter values used for each run.
7. Save the results in a structured format (e.g., CSV or JSON): param_name, param_value, runtime, solution_quality.

The parameter format:
```yaml
parameters:
  m:
    type: int
    range: [10, 30, 50, 70]
    default: 50
  I:
    type: int
    range: [5, 10, 15, 20]
    default: 10
    step: 50
    tune: false
  LS:
    type: int
    range: [10, 50, 100, 150]
    default: 100
  alpha:
    type: float
    range: [0.5, 0.75, 1.0, 1.25]
    default: 1.0
  beta:
    type: float
    range: [0.5, 0.75, 1.0, 1.25]
    default: 0.75
  rho:
    type: float
    range: [0.4, 0.5, 0.6, 0.7]
    default: 0.5
  Q:
    type: float
    range: [0.1, 0.5, 1.0, 1.5]
    default: 1.0
    step: 0.5
  t:
    type: int
    range: [10, 40, 70, 100]
    default: 20
    step: 10
  p:
    type: int
    range: []
    default: 64
```

