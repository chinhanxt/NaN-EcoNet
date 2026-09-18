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
- We will use ParamILS (Parameter Iterated Local Search) for tuning:

The main steps of the ParamILS procedure (Algorithm 3 in the paper) are:

1. Default Parameter Vector Initialization: The process begins with a default parameter configuration (c_0). This is typically based on user experience or prior knowledge.
2. Initial Random Trials: The algorithm performs a set of R initial trials (loops). In each trial, a random parameter vector (c) is generated. If this random configuration is found to be "better" than the current best configuration (c_0), c_0 is updated to this new configuration.
3. Iterative First Improvement (Initial): After the initial random trials, the IterativeFirstImprovement procedure (Algorithm 4 in the paper) is applied to the best configuration found so far (c_0). This procedure performs a local search starting from c_0 to find a local optimum (c_ib).
4. Main Loop (Iterated Local Search): The algorithm then enters a loop that continues until a termination criterion is met (e.g., maximum number of executions reached). In each iteration of this loop:
    - The current configuration (c) is set to the incumbent best configuration found so far in the iterated local search (c_ils).
    - Perturbation: s random perturbations are applied to c. For each perturbation, a new random parameter vector (c') is generated in the neighborhood of c.
    - Local Search (Iterative First Improvement): The IterativeFirstImprovement procedure is applied to the perturbed configuration (c') to find a local optimum.
    - Acceptance: If the local optimum found (c'') is "better" than the current best iterated local search configuration (c_ils), c_ils is updated to c''.
    - Restart: With a probability P_restart, the search is re-initialized with a random parameter vector, allowing the algorithm to jump to a completely different area of the search space.
5. Return Best Configuration: After the loop terminates, the overall best configuration found during the entire process is returned.

The IterativeFirstImprovement(c, N) procedure itself works by repeatedly searching the neighborhood (N(c')) of a configuration c' in a randomized order. If a better configuration c'' is found in the neighborhood, the current configuration c' is updated to c'', and the search in the neighborhood restarts from this new better configuration. This continues until no better configuration is found in the neighborhood of c'.

The paper mentions that different versions of ParamILS, BasicILS and FocusedILS, differ in their better(c, c') procedure used for comparing two configurations. FocusedILS uses a dominance concept that considers both the performance and the number of seeds used for evaluation (a configuration is better if it has superior average performance and was tested on more seeds).

ParamILS Algorithm Parameters:

    R (Random solutions in first phase): Value = 10. This is the number of initial random parameter vectors generated and evaluated in the first phase to find a starting point for the local search.
    S (Random solutions at each iteration): Value = 3. This is the number of random perturbations applied to the current configuration in each iteration of the main loop.
    P_restart (Probability of restarting the search): Value = 0.01. This is the probability of re-initializing the search with a completely random parameter vector in each iteration of the main loop.
    max execs (Maximum number of executions): Value = 10. This is the total budget for the ParamILS tuning process, limiting the number of times the target algorithm can be executed.

The performance metrics will be solution quality and runtime.

## Complete procedure

'''
Procedure ParamILS
c0 ← default parameter vector
for i ← 1 to R do
 c ← random parameter vector
 if better(c, c0) then c0 ← c
endfor
c_{ils} ← random parameter vector in $N(c)$
while not terminationcriterion() do
 c ← c_{ils}
 for i ← 1 to s do
 c ← random parameter vector in $N(c)$
 c ← IterativeFirstImprovement(c, $N$)
 if better(c, c_ils) then cils ← c
 if prestart then cils ← random parameter vector
endwhile
return overall best c
'''

IterativeFirstImprovement
'''
Procedure
repeat
 c′ ← c
 foreach $c'' \in N(c')$ in randomized order do
   if better(c″, c′) then c ← c″
   break
until c′ = c
return c
'''