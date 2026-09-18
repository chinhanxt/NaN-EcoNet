# PACO::solve Algorithmic Description (No GA)

---

## Overview
`PACO` is a parallel Ant Colony Optimization (ACO) metaheuristic for solving a variant of the Vehicle Routing Problem (VRP) with flexible delivery types (direct or locker). The method is parallelized using OpenMP and supports multi-threaded execution. This version **does not include any Genetic Algorithm (GA) refinement**.

---

## Step-by-Step Algorithm

### 1. Initialization
- **Parameters**: Extract problem and algorithm parameters (number of ants `m`, threads `p`, elite solutions `t`, max non-improved iterations `I`, etc.).
- **Pheromone Matrix**: Initialize a 3D pheromone matrix `tau` and a feasibility mask `mask` to encode allowed transitions and delivery types (direct or locker).
- **Global Best**: Set up variables to track the global best solution and convergence history.

### 2. Main Iterative Loop
The main loop continues until the number of non-improved iterations reaches `I`.

#### 2.1. Parallel Ant Construction and Local Search
- **Parallelization**: The loop is parallelized over `p` threads.
- **Ant Construction**: Each thread constructs multiple ant solutions using a probabilistic transition rule based on pheromone and heuristic information.
- **Local Search**: Each ant solution undergoes local search (swap, insert, reverse/2-opt) to improve its permutation.
- **Evaluation**: Each solution is evaluated for objective value.

#### 2.2. Global Solution Pool
- **Aggregation**: Each thread contributes its best solutions to a global pool for the current iteration.
- **Sorting**: The global pool is sorted by objective value.

#### 2.3. Pheromone Update
- **Evaporation**: All pheromone values are decayed by a factor `(1 - rho)`.
- **Reinforcement**: The top `t` solutions from the global pool reinforce the pheromone matrix along their routes, proportional to their quality.

#### 2.4. Global Best Update & Convergence
- **Best Solution**: If a new best solution is found, it is recorded and the non-improved counter is reset.
- **Evaporation Rate**: The evaporation rate `rho` is adaptively updated using a sigmoid function based on the number of non-improved iterations.
- **Convergence History**: The best objective value is recorded for each iteration if history tracking is enabled.

### 3. Output
- **Convergence Log**: If enabled, writes the convergence history to a CSV file.
- **Return**: Returns the best solution found.

---

## Key Features
- **Parallelism**: Uses OpenMP for multi-threaded ant construction and local search.
- **Hybridization**: Combines ACO with local search for solution refinement (no GA).
- **Adaptive Parameters**: Adjusts the number of ants based on search progress.
- **Flexible Delivery Types**: Supports both direct and locker deliveries with feasibility masking.

---

## References
- PACO: Population-based Ant Colony Optimization
- VRP: Vehicle Routing Problem
- 2-opt: Local search for permutations

---

*This document describes the implementation in `PACO.cpp` after removal of the Genetic Algorithm (GA) refinement.*
