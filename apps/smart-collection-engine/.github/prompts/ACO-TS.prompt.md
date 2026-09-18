Based on the instance description in `VRPPL.prompt.md`, start to implement the VRPPL solver

# Pseudo-solver interface (Already implemented) `Solver.cpp`:
- Input: an instance
- Output: Best solution (routes), best objective value. If infeasible, then best solutin is empty and objective value is abitrary high.

## 1. Objectie value
- The objective is the total traveling distance between nodes
- Calculated using Euclidean distance.
- To save computation, the distance matrix is calculated during instance parsing.
- Infeasible solution will receive very high penalty.

## 2. Constraints
- Capacity: total carrying demand must not exceed vehicle capacity
- Time-window: early node visit will render the vehicle to wait, however, late visit is not permitted.

## 3. Delimter-based Route Construction (Customer permutation to routes)
- 1. Based on the delivery node corresponding to a each customer, a vehicle traverses the graph, starting from depot 0's location and back to depot.
- 2. When visit a customer, the capacity and time-window is updated. The traveling time is the same the distance between nodes.
- 3. There will be delimeter of depot between customers in permutation, signaling route break. For example: [0,1,2,3,0,4,5,6,0]

# ACO-TS (Ant Colony Optimization with Tabu-Search)

## Initial solution:

Solution Representation:
1. An array: permutation of customer, sorted based on their indices.
2. A mapper function (customer index -> actual delivery node): assigned particular delivery node based on type of customer. Type-I will be assigned directly to their node, type-II to their prefered locker node, type-III be assigned randomly based on $p$.

For example:
```
First array: 0, 1, 2, 3, 4, 5,...N
Second array: 0, 1, 27, 3, 26, 26,...
```

## Solution construction process

Each ant starts at the depot and constructs a route by incrementally select customers until no customers left.

Transitional Probability

\begin{equation}
  P_{i\to j}^{(k)} \;=\;
  \begin{cases}
    \displaystyle
    \frac{\bigl[\tau_{ij}\bigr]^{\alpha}\,\bigl[\eta_{ij}\bigr]^{\beta}}
         {\sum_{u\in\mathcal{N}_i^{(k)}}\bigl[\tau_{iu}\bigr]^{\alpha}\,\bigl[\eta_{iu}\bigr]^{\beta}}
    & \text{if } j\in \mathcal{N}_i^{(k)},\\[1em]
    0 & \text{otherwise},
  \end{cases}
  \label{eq:aco-transition}
\end{equation}
where:
\begin{itemize}
    \item $\tau_{ij}$ is the pheromone trail intensity on edge $(i,j)$,
    \item $\eta = \frac{1}{d_{ij}}$ is the heuristic desirability (e.g., inverse distance),
    \item $\alpha, \beta > 0$ control the relative influence of pheromone vs. heuristic,
    \item $\mathcal{N}_i^{(k)}$ is the feasible neighborhood for ant $k$ at node $i$.
\end{itemize}

After all ants complete their tours, pheromone trails are updated via

\begin{equation}
  \tau_{ij} \;\leftarrow\; (1-\rho)\,\tau_{ij}
  \;+\;\sum_{k=1}^m \Delta\tau_{ij}^{(k)},
  \label{eq:aco-update}
\end{equation}
\begin{equation}
    \Delta\tau_{ij}^{(k)} = 
  \begin{cases}
    \dfrac{Q}{L^{(k)}} & \text{if ant }k\text{ used }(i,j),\\[0.5em]
    0 & \text{otherwise},
  \end{cases}
\end{equation}

## Local search

There are 2 stateies:
1. Exchanging customers between two routes: Firstly, randomly select a route (e.g., 0–2–1–5–7–0) and a cus- tomer from the route (e.g., customer 7). Then, the customer is ran- domly inserted into anther route satisfying the capacity constrains (e.g., 0–8–9–10–0) and a new solution can be acquired.
2. nserting customers between two routes: Firstly, randomly select a route (e.g., 0–2–1–5–7–0) and a cus- tomer from the route (e.g., customer 7). Then, the customer is ran- domly inserted into anther route satisfying the capacity constrains (e.g., 0–8–9–10–0) and a new solution can be acquired.

2-opt is used to improve local optimality of new method

## Tabu Search algorithm

- Tabu Search is a **memory-based meta-heuristic** integrated into a hybrid algorithm with Ant Colony Optimization (ACO) to solve the Vehicle Routing Problem with Time Windows (VRPTW).
- It is **applied only once** during the overall algorithm execution.
- TS is initiated **when the ACO process appears to be near convergence**, specifically when it obtains the same solutions for three successive searches.
- The **initial solution** for the Tabu Search is the **current best solution found by the ACO process**.
- **Neighbor solutions** are explored using a neighborhood search procedure involving **exchanging or inserting customers** between routes, improved by 2-opt exchange.
- A **Tabu list** is used to give certain customers (e.g., those leaving a route) a **Tabu status** for a given number of iterations to prevent cycling.
*   A **large Tabu interval**, specifically **half of the number of customers**, is chosen to attentively explore the solution space around the ACO-provided initial solution.
- The Tabu status of a move can be **overruled** (aspiration criteria) if it results in a **better solution than the current best**, or if **all candidate solutions are on the Tabu list**.
- **Pheromone trails are updated after each move** within the Tabu search process to inform the subsequent ACO search.
- Tabu Search terminates upon reaching either the **maximum total number of iterations** or the **maximum number of iterations without improvement**.
- After Tabu Search terminates, the algorithm **returns to continue the ACO search**.
- The primary goal of introducing Tabu Search at this stage is to **maintain the diversity of the ant colony, explore new solution space, and prevent getting trapped in local optima** when ACO is converging.