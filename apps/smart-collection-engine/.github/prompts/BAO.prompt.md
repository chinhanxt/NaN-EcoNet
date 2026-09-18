Based on the instance description in `VRPPL.prompt.md`

# Pseudo-solver interface:
- Input: an instance
- Output: Best solution (routes), best objective value. If infeasible, then best solutin is empty and objective value is abitrary high.

## 1. Objectie value
- The objective is the total traveling distance between nodes
- Calculated using Euclidean distance.
- To save computation, the distance matrix is calculated during instance parsing.
- Infeasible solution will receive very high penalty.

## Tasks
- I want to create a tuning program to find general "good" hyperparameter of each solvers for different datasets (small, medium and large).
- The goal of tuning to ensure that the other solvers is at the acceptable performance to be comparable with my proposed methods
- The results of tuning will be published in the research paper.

## Resources
- Small dataset can be very fast but medium and large datasets are computationally expensive.
- There are 56 instances for each datasets, but a "good" geneneralized hyperparameters can be used for all of them.

## Method
- We will use Bayesian Optimization on the given Param Grid, usually defined in `*.tune.yaml` files.
- The input is hyperparameters set (different between solves) with their range, discrete steps and a flag to indicate if they need to be tuned or not.
- A sample param files would look like this:

```yaml
parameters:
  m:
    type: int
    range: [10, 20, 30, 40]
    default: 30
    step: 10
  I:
    type: int
    range: [5, 10, 15, 20]
    default: 10
    step: 5
  alpha:
    type: float
    range: [0.5, 3.0]
    default: 1.25
    step: 0.25
  beta:
    type: float
    range: [0.5, 3.0]
    default: 1.0
    step: 0.25
  rho:
    type: float
    range: [0.2, 0.7]
    default: 0.6
    step: 0.1
  Q:
    type: float
    range: [0.5, 3.0]
    default: 2.0
    step: 0.5
  t:
    type: int
    range: [10, 100]
    default: 10
    step: 10
  p:
    type: int
    range: [64, 64]
    default: 64
    step: 1
    tune: false
```

## Process

1. Initialization: You start by trying a few sets of hyperparameters randomly.

2. Surrogate Model Fitting: You use the results from these initial trials to build or update your surrogate model (like the Gaussian Process). 

3. Acquisition Function Optimization: The acquisition function looks at the surrogate model's predictions and uncertainties and suggests the next set of hyperparameters to try. It aims to balance exploring uncertain areas with exploiting promising ones.

4. Evaluation: You train and evaluate your machine learning model using the hyperparameters suggested by the acquisition function.

5. Iteration: You add the new hyperparameter settings and their performance to your history, and you go back to step 2. You update the surrogate model with this new information, and the process repeats.

Termination: You continue this iterative process until you reach a certain budget (e.g., a maximum number of trials) or when the improvement in performance becomes very small.

## Implementation
1. Write a Python script that implements the Bayesian Optimization process using the `scikit-optimize` library.
2. The script should read the parameter grid from the `*.tune.yaml` file.
3. It should define the objective function that evaluates the performance of the solver with the given hyperparameters.
4. The Python script should execute `build/test` compiled code with specified parameter:
`Usage: ./test --solver <name> --params <param_file.yaml> [--instances <dir>] [--num-runs <int>] [--output <output_file.csv>] [--size <experiment_size>] [--instance-file <file>] [--verbose <level> | -v <level>`
5. The script should use the `gp_minimize` function from `scikit-optimize` to perform the optimization.
6. The script should save the best hyperparameters and their corresponding performance metrics to a file.

**Can refer to `src/experment/analysis.py` for the example of how to run the solver with the given parameters.**
