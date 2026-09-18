Based on the instance description in `VRPPL.prompt.md`, start to implement the VRPPL solver, called `PACO.h / PACO.cpp`

# Pseudo-solver interface:
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

## 3. Route Construction (Greedy insertion heuristics)
- 1. When ant is iteratively traversing the graph, insert new selected customer into the route.
- 2. When visit a customer, the capacity and time-window is updated. The traveling time is the same the distance between nodes.
- 3. If any constraint is violated, switch to next vehicle, back to depot and reset the capacity and time-window.
- 4. If all vehicles are used but there are unserived customers, the solution is infeasible.

## Delivery options assignment:
- We denote each demand by the pair \((i,o)\), where \(i\in N_C\) identifies the customer and \(o\in O\) specifies the chosen option.
- Routes are constructed incrementally using a Sequential Insertion Heuristic (SIH).
 - Beginning at the depot (\(i=0\)), we select the next demand \((j,o)\) according to the transition probability defined in Equation \ref{eq:3d-transition}.
 - Upon inserting each new demand into the route, we update the vehicle’s load and the current time.
 - This insertion process continues until adding any remaining demand would violate either the vehicle’s capacity or the prescribed time windows. 
 - At that point, the route is deemed saturated, and we initiate a new route by resetting both load and time, modeling parallel vehicle deployments.

## Locker bundled.
- To streamline bundled deliveries to the same locker, any consecutive demands for that locker are aggregated into a single, larger demand. - However, revisits to the same locker after servicing an intervening location are treated as violations and hence new vehicle will be deployed. For example:
 - (Feasbile): Route 1 [0,1,27,27,27,2] is treated as [0,27,2] for distance and time update.
 - (Infeasible) Route 2 [0,1,27,27,3,27] is infeasible due to revisit locker 27 even though the vehicle has moved to node 3.
- Finally, if unsatisfied demands remain once all vehicles have been deployed, the overall solution is declared infeasible.

# 3D-ACO

## Hyperparameters:
- Number of ants $m$
- $\alpha$, $\beta$, $\rho$ and $Q$
- Number of iterations $I$
- $t$: top ants for pheromone update (elitist strategy)
- $p$: number of processors required

## Initialization:

1. Construct 3D pheromone matrix: $\tau_{ijo}$, where $i,j \in {N_C + depot}$ and $o \in {0,1}$ delivery options (home, locker).
2. A feasibility mask $M_{ijo} \in \{0, 1\}$ is applied to enforce both home-delivery / locker-delivery constraints.
 - $M_{ij1} = 0, \forall i \in N_C$ if customer $j$ is type-I
 - $M_{ij0} = 0, \forall i \in N_C$ if customer $j$ is type-II.
 - $M_{iio} = 0 \forall i \in N_C$ to prevent self-delivery.
 - Before computing transition probabilities, we zero out all infeasible entries by masking: $\tilde{\tau}_{ijo} = \tau_{ijo} \times M_{ijo}$.
  - An advantage of feasibility mask is that it only needs to apply **once during initialization**, since zeroed-out node will have no probability to be visited.

## Iteration
1. Similar to traditional ACO but with 3D pheromone
2. Applied top-t elitist strategy so that only best $t$ ants is allowed to update the matrix.
\begin{equation}
\Delta\tau^{(k)}_{ijo} =
\begin{cases}
\displaystyle\frac{Q}{L^{(k)}}, & \text{if } (i,j,o) \in \text{solution path of } k \\
0, & \text{otherwise}
\end{cases}
\end{equation}
\begin{equation}
\tau_{ijo} \leftarrow (1 - \rho) \cdot \tau_{ijo} + \sum_{k \in t} \Delta\tau^{(k)}_{ijo}
\label{3d-phero-update}
\end{equation}

3. Transitional probability:
$$
\Delta\tau^{(k)}_{ijo} =
\begin{cases}
\displaystyle\frac{Q}{L^{(k)}}, & \text{if } (i,j,o) \in \text{solution path of } k \\
0, & \text{otherwise}
$$

1. At the current node $i$, flatten the matrix (j,o) to 1D vector j * o.
2. 

\end{equation}
\begin{equation}
\tau_{ijo} \leftarrow (1 - \rho) \cdot \tau_{ijo} + \sum_{k \in t} \Delta\tau^{(k)}_{ijo}
\label{3d-phero-update}
\end{equation}

## Parallelization
It uses coarse-grain master-slave parallel schema.

### Master:
- Manages global resources: shared-memory 3d pheromone matrix, best known solution / objectives
- Master will handle the pheromone update for each iteration, only select top-$k$ ants (solutions) to do it.

### Slaves:
- Each slave is a parallel processes, each slave will have a subcolony of ants: $m_p = m // p$, m is the total ants, p is the number of processors 
- From the shared-memory 3d pheromone matrix, each slave constructs solutions.
- In each iteration, wait until all slaves have completed, then update the pheromone and global best known solution (if found)
- Start again for new iteration, until completed.

## References

'''python
class PACO(Solver):
    def __init__(self, problem: Problem, num_ants=1000, num_iterations=100, batch_size=100, alpha=1.0, beta=2.0, evaporation_rate=0.2, Q=1.0, elitist_num=0.1):
        """
        Initializes the ACO optimizer for the VRPPL problem using a 3D pheromone matrix and sets up key parameters for
        ant colony optimization with batch processing for parallel execution.

        Parameters:
            problem (Problem): The routing problem instance containing customer data and related properties.
            num_ants (int, optional): The number of ants to simulate per iteration, influencing exploration. Defaults to 1000.
            num_iterations (int, optional): The number of iterations the algorithm will perform to refine solutions. Defaults to 100.
            batch_size (int, optional): The number of iterations to process in each parallel batch. Defaults to 100.
            alpha (float, optional): The factor controlling the influence of pheromone trails in ant decision-making. Defaults to 1.0.
            beta (float, optional): The factor controlling the influence of heuristic information (e.g., distance) in ant decisions. Defaults to 2.0.
            evaporation_rate (float, optional): The rate at which pheromone intensity diminishes over time, promoting exploration. Defaults to 0.1.
            Q (float, optional): The pheromone deposit constant, influencing the amount of pheromone deposited by ants. Defaults to 1.0.
            elitist_num (int, optional): The number of elite solutions to retain. Defaults to 10.
        """
        super().__init__(problem.node2routes, num_iterations=num_iterations)
        self.problem: Problem = problem
        self.num_iterations = num_iterations
        self.num_ants = num_ants
        self.batch_size = batch_size
        self.alpha = alpha
        self.beta = beta
        self.evaporation_rate = evaporation_rate
        self.Q = Q
        self.num_elitist = int(num_ants * elitist_num) if elitist_num < 1 else elitist_num
        self.tau_min = 0.01
        self.tau_max = 2.0
        # n: number of customers
        self.n = self.problem.num_customers

        # Initialize a single 3D pheromone matrix with dimensions (n+1) x (n+1) x 2.
        pheromones = np.full((self.n + 1, self.n + 1, 2), self.tau_max)
        for j, customer in enumerate(self.problem.customers, start=1):
            if customer.customer_type == 1:
                pheromones[:, j, 1] = 0.0
            elif customer.customer_type == 2:
                pheromones[:, j, 0] = 0.0
        # Create shared memory block for the pheromone matrix
        self.pheromone_shm = shared_memory.SharedMemory(create=True, size=pheromones.nbytes)
        # Create a NumPy array backed by shared memory
        self.shared_pheromones = np.ndarray(pheromones.shape, dtype=pheromones.dtype, buffer=self.pheromone_shm.buf)
        np.copyto(self.shared_pheromones, pheromones)
        self.global_best_fitness = float('inf')
        self.global_best_solution = None
        self.global_best_routes = None
        self.fitness_history = []
        # To track overhead (average overhead per ant per iteration)
        self.overhead_history = []
        self.overhead = None

    def construct_solution(self, shared_pheromones):
        """
        Constructs one ant's solution using the integrated 3D pheromone matrix.
        """
        current_location = (self.problem.depot.x, self.problem.depot.y)
        prev_index = 0
        unvisited = list(range(1, self.n + 1))
        transitions = []
        final_route = [self.problem.depot]

        while unvisited:
            candidate_options = []
            for j in unvisited:
                customer = self.problem.customers[j - 1]
                allowed = [0] if customer.customer_type == 1 else [1] if customer.customer_type == 2 else [0, 1]
                for d in allowed:
                    candidate_coord = (customer.x, customer.y) if d == 0 else (customer.assigned_locker.x, customer.assigned_locker.y)
                    distance = euclidean_distance(current_location, candidate_coord)
                    heuristic = 1.0 / distance if distance > 0 else 1e6
                    tau = shared_pheromones[prev_index, j, d]
                    value = (tau ** self.alpha) * (heuristic ** self.beta)
                    candidate_options.append((j, d, value, candidate_coord))

            total_value = sum(option[2] for option in candidate_options)
            probs = [option[2] / total_value for option in candidate_options] if total_value > 0 else [1 / len(candidate_options)] * len(candidate_options)
            r = np.random.random()
            cumulative = 0.0
            selected = None
            for (j, d, _, candidate_coord), prob in zip(candidate_options, probs):
                cumulative += prob
                if r <= cumulative:
                    selected = (j, d, candidate_coord)
                    break
            if selected is None:
                selected = candidate_options[-1][0:2] + (candidate_options[-1][3],)
            j, d, candidate_coord = selected
            transitions.append((prev_index, j, d))
            final_route.append(self.problem.customers[j - 1] if d == 0 else self.problem.customers[j - 1].assigned_locker)
            current_location = candidate_coord
            prev_index = j
            unvisited.remove(j)
        final_route.append(self.problem.depot)
        return transitions, final_route

    def update_pheromones(self, solutions):
        """
        Updates the integrated 3D pheromone matrix based on ant solutions using both max–min and elitist strategies.
        """
        # Evaporate pheromones
        self.shared_pheromones *= (1 - self.evaporation_rate)
        solutions = sorted(solutions, key=lambda x: x[1])
        solutions = solutions[:self.num_elitist]  # Keep only the best solutions

        # Standard deposit from each ant's solution
        for transitions, fitness in solutions:
            deposit = self.Q / (fitness if fitness > 0 else 1e-8)
            for (i, j, d) in transitions:
                self.shared_pheromones[i, j, d] += deposit
            
    # --- Bundle Multiple Ants in One Task ---
    def multi_ant_solution(self, num_ants_in_task, pheromone_shm_name, shape, dtype):
        # Attach to shared memory for pheromones
        shm = shared_memory.SharedMemory(name=pheromone_shm_name)
        shared_pheromones = np.ndarray(shape, dtype=dtype, buffer=shm.buf)
        results = []
        for _ in range(num_ants_in_task):
            worker_ant_start = time.time()
            transitions, final_route = self.construct_solution(shared_pheromones)
            fitness, routes = self.problem.node2routes(final_route)
            worker_ant_end = time.time()
            ant_compute_time = worker_ant_end - worker_ant_start
            # Append result with compute time for overhead estimation
            results.append((transitions, fitness, final_route, routes, ant_compute_time))
        shm.close()  # Only close, do not unlink in worker
        return results
    
    def optimize(self, verbose=True):
        """
        Main optimization loop.
        Returns a tuple: (global_best_solution, global_best_fitness, global_best_routes)
        Also computes an average overhead per ant which is stored in self.overhead.
        """
        pheromone_shape = self.shared_pheromones.shape
        pheromone_dtype = self.shared_pheromones.dtype
        try:
            with ProcessPoolExecutor() as executor:
                for iteration in range(self.num_iterations):
                    iter_start = time.time()
                    futures = []
                    submission_times = {}
                    num_tasks = self.num_ants // self.batch_size
                    # Submit tasks.
                    for _ in range(num_tasks):
                        sub_time = time.time()
                        future = executor.submit(self.multi_ant_solution,
                                                 self.batch_size,
                                                 self.pheromone_shm.name,
                                                 pheromone_shape,
                                                 pheromone_dtype)
                        futures.append(future)
                        submission_times[future] = sub_time

                    solutions = []
                    overheads = []
                    # Retrieve results.
                    for future in as_completed(futures):
                        iter_end = time.time()
                        round_trip = iter_end - submission_times[future] # Round trip time is the time taken for the task to complete
                        task_results = future.result()
                        total_worker_time = sum(res[4] for res in task_results)
                        overhead = round_trip - total_worker_time # Overhead = round-trip time - total worker time
                        overheads.append(overhead)
                        solutions.extend(task_results)

                    # Update pheromones using the solutions from all ants.
                    # We assume each task returns (transitions, fitness, ..., ...)
                    self.update_pheromones([(transitions, fitness) for (transitions, fitness, _, _, _) in solutions])
                    # Update global best.
                    for (transitions, fitness, final_route, routes, _) in solutions:
                        if fitness < self.global_best_fitness:
                            self.global_best_fitness = fitness
                            self.global_best_solution = final_route
                            self.global_best_routes = routes
                    # Record fitness history.
                    self.fitness_history.append(self.global_best_fitness)
                    iter_end = time.time()
                    avg_overhead = sum(overheads) / len(overheads) if overheads else 0
                    overhead_per_ant = avg_overhead / self.batch_size
                    self.overhead_history.append(overhead_per_ant)
                    if verbose:
                        print(f"Iteration {iteration+1}/{self.num_iterations} | Best Fitness: {self.global_best_fitness:.2f} | Iteration Time: {iter_end - iter_start:.2f}s")
        except Exception as e:
            self.cleanup()
            raise e
        finally:
            self.cleanup()
        # Aggregate overall overhead.
        if self.overhead_history:
            self.overhead = mean(self.overhead_history)
        else:
            self.overhead = None
        return self.global_best_solution, self.global_best_fitness, self.global_best_routes

    def cleanup(self):
'''