The research presents a metaheuristic solution for the Vehicle Routing Problem with Heterogeneous Locker Boxes (VRPHLB). The goal is to minimize total costs, which include routing costs and compensation payments for customers using locker boxes, while also considering the complexities of packing different-sized parcels into various-sized locker slots[cite: 8].

## Solution Representation

A solution, or "delivery plan," encompasses several key decisions:
1.  **Customer Service Mode**: For each customer, it's decided whether they are served at their **home address** (within a specific time window) or at a **locker box station**[cite: 38].
2.  **Locker Box Assignment**: If a customer is served via a locker box, the plan specifies *which* locker box station is used from the set of stations acceptable to that customer[cite: 38, 97].
3.  **Parcel Packing**: For customers served at locker boxes, the plan details how their multiple, potentially different-sized parcels are packed into the available heterogeneous slots at the assigned station[cite: 38]. Key packing rules include:
    * Parcels for one customer can be grouped into a single slot if space allows.
    * A single slot cannot be shared by multiple customers.
    * All parcels for a single customer must go to the same locker station.
4.  **Vehicle Routes**: The plan includes the actual vehicle routes, detailing the sequence of home addresses and locker box stations visited by each vehicle, starting and ending at the depot.

## Metaheuristic Method Overview

The proposed metaheuristic method iteratively refines a solution. It starts with a pure home delivery plan and then strategically moves customers to locker box delivery, re-optimizes routes and packing, and further improves the selection of delivery modes.

```pseudocode
// Main Metaheuristic Algorithm (based on Algorithm 2)

Function Metaheuristic_VRPHLB
  // Initialization
  s_best_solution = null
  // Generate initial solution: all customers served at home, routes solved by ALNS
  current_solution = Generate_Pure_Home_Delivery_Solution_ALNS()

  // Pre-processing: Generate feasible packing patterns for each customer's parcels
  // using Iterative First-Fit Decreasing (IFFD)
  For each customer c
    FeasiblePackingPatterns[c] = Generate_IFFD_Packing_Solutions(parcels_of_customer[c], available_slot_types)
  End For

  // Main iterative loop
  For m iterations (e.g., m = 500)
    working_solution = deepcopy(current_solution) // Or from s_best_solution

    // --- Step 1: Decide which customers move from Home to Locker Box ---
    // Modifies working_solution by changing delivery modes and assigning to stations.
    // Operators from Section 4.2 are used.
    Selected_MoveToLocker_Operator = Randomly_Choose_From(["ReduceDistance", "FillUpStations", "RemoveTour"])
    Switch (Selected_MoveToLocker_Operator)
      Case "ReduceDistance":
        working_solution = Apply_Reduce_Distance_Operator(working_solution, FeasiblePackingPatterns)
      Case "FillUpStations":
        working_solution = Apply_Fill_Up_Locker_Box_Stations_Operator(working_solution, FeasiblePackingPatterns)
      Case "RemoveTour":
        If (NumberOfTours(working_solution.routing_plan) > 2) Then
          working_solution = Apply_Remove_Tour_Operator(working_solution, FeasiblePackingPatterns)
        End If
    End Switch
    // Note: The above operators internally use Check_Locker_Box_Capacity_Feasibility

    // --- Step 2: Solve Routing Problem for the current set of delivery locations ---
    // Nodes include remaining home delivery customers and all *used* locker box stations.
    // ALNS is used for routing.
    working_solution.routing_plan = ALNS_Solve_Routing(
                                        working_solution.home_delivery_customers,
                                        working_solution.used_locker_stations,
                                        depot_information,
                                        customer_and_locker_time_windows
                                    )

    // --- Step 3: Optimize Bin Packing for all customers assigned to Locker Boxes ---
    // This step refines how parcels are packed into slots for the currently selected locker box customers.
    // Uses a heuristic set covering formulation based on IFFD patterns.
    working_solution.locker_assignments_and_packing_details = Solve_Bin_Packing_Heuristic_Set_Cover(
                                                                    working_solution.locker_box_customers,
                                                                    FeasiblePackingPatterns, // All customers' patterns
                                                                    working_solution.used_locker_stations_capacities
                                                                )

    // --- Step 4: Iteratively Re-optimize the Selection of Home vs. Locker Box Customers ---
    // This loop applies operators from Section 4.5 to improve the solution.
    iterations_without_improvement_reopt = 0
    max_iter_no_improve_reopt = 10 //
    While (iterations_without_improvement_reopt < max_iter_no_improve_reopt)
      solution_before_reopt = deepcopy(working_solution)
      // Randomly select a re-optimization operator
      Reoptimize_Operator = Randomly_Select_Reoptimize_Operator_From([
                              "SwapCustomers_AllowNewStations", "SwapCustomers_KeepStations",
                              "IncreaseLockerCustomers_AllowNewStations", "IncreaseLockerCustomers_KeepStations",
                              "DecreaseLockerCustomers", "CloseLockerStation"
                            ])
      working_solution = Apply_Reoptimize_Operator(Reoptimize_Operator, working_solution, FeasiblePackingPatterns)

      // After applying the operator, routing and packing might need updates if customer assignments changed.
      // This could involve re-running ALNS for routing and the Bin Packing solver.
      // (Simplified here; the paper implies these are part of maintaining a consistent solution state)
      Update_Routing_And_Packing_If_Needed(working_solution, FeasiblePackingPatterns)


      If (Cost(working_solution) < Cost(solution_before_reopt)) Then
        iterations_without_improvement_reopt = 0
      Else
        iterations_without_improvement_reopt++
      End If
    End While

    // --- Step 5: Update Global Best Solution ---
    // Conditional execution: only if the set of moved home delivery customers and their packing
    // has not appeared before (a diversification mechanism).
    // For simplicity, we check cost, but the actual condition is more complex.
    If (s_best_solution == null Or Cost(working_solution) < Cost(s_best_solution)) Then
      s_best_solution = deepcopy(working_solution)
    End If
  End For

  Return s_best_solution
End Function
```

---
### Key Sub-Procedures and Delivery Option Handling:

**1. Generating Initial Pure Home Delivery Solution (ALNS)**:
* All customers are initially set to be served at home.
* An Adaptive Large Neighborhood Search (ALNS) algorithm solves this initial Vehicle Routing Problem with Time Windows (VRPTW)[cite: 147].

**2. Moving Customers from Home to Locker Box (Section 4.2)**:
This step involves operators that decide which customers switch to locker delivery:
* **Reduce Distance Operator**:
    * Shifts customers to locker boxes if distance savings (minus compensation costs) are beneficial.
    * Uses randomization and allows for deteriorations based on a threshold.
    * Station Opening: Can be *sequential* (open new station only if existing open ones lack capacity) or *parallel* (assume all stations are open, try stations with smallest remaining capacity first).
* **Fill Up Locker Box Stations Operator**:
    * Opens stations sequentially and fills them with customers who offer the largest improvement to the objective function when moved from home delivery.
    * Station choice considers which stations the high-benefit customers accept and proximity criteria.
* **Remove Tour Operator**:
    * If more than two tours exist, this operator attempts to eliminate one tour by moving its customers to locker boxes or reassigning them to other tours.
    * Customers with fewer accepted locker station options are prioritized for locker delivery.
* **Capacity Checking (Iterative First-Fit Decreasing - IFFD)** (Section 4.3):
    * During the above moves, when a customer is considered for a locker station, their parcels' feasibility of packing must be checked.
    * A set of feasible packing solutions for each customer is pre-generated using the IFFD algorithm.
    * To check feasibility at a station:
        * Iterate through the customer's pre-generated packing patterns.
        * Strategies: Start with the *first feasible solution* in the list (often uses largest slots) or start with a *random feasible solution* from the list to encourage diverse slot usage[cite: 219, 220].
        * If a pattern fits the station's available slots, the customer can be assigned.

**3. ALNS for Routing (Section 4.1)**:
* Used to solve the routing problem for the current set of home delivery customers and *used* locker box stations.
* Employs various *destroy* (e.g., random removal, worst removal, related removal) and *repair* (e.g., cheapest insertion, regret insertion) operators.
* Operator weights are adapted based on performance (pairwise evaluation).
* Incorporates Or-Opt for local search on good solutions and simulated annealing for accepting deteriorating solutions.

**4. Bin Packing Optimization (Heuristic Set Covering) (Section 4.4)**:
* After an initial set of customers is assigned to locker boxes, this step optimizes how their collective parcels are packed to minimize overall slot usage.
* It uses a heuristic set covering formulation.
    * The "columns" in the set covering problem are the feasible packing solutions for each customer (generated by IFFD).
    * The objective is to select one packing pattern per locker-box customer such that all parcels are packed, station slot capacities are respected, and the total number of slots used is minimized.

**5. Re-optimizing Home/Locker Selection (Section 4.5)**:
This phase uses several operators to iteratively refine the assignment of customers to home or locker delivery:
* **Swap Customers**: Swaps a home-delivery customer with a locker-box customer if beneficial. Can either allow opening new locker stations [cite: 240, 242] or restrict to currently open stations (which might require reassigning other customers within those stations for capacity [cite: 243, 244]).
* **Increase Number of Locker Box Customers**: Attempts to move more customers from home delivery to locker boxes, potentially opening new stations [cite: 245, 246] or using only existing ones (again, possibly requiring internal reassignments for capacity [cite: 247]).
* **Decrease Number of Locker Box Customers**: Moves customers from locker boxes back to home delivery if it reduces total costs[cite: 248, 249].
* **Close Locker Box Station**: Closes a station if doing so improves the objective. Customers from the closed station are reassigned to other open stations (which may involve rearranging those stations' existing occupants/parcels [cite: 250, 251, 252]).
* Any operator causing a station to become empty results in that station being closed and removed from the routes[cite: 253].

Throughout these steps, the handling of delivery options is dynamic. Customers are moved between home and locker delivery based on cost-benefit analyses, routing implications, and locker capacity (which itself depends on complex packing constraints). The IFFD pre-processing provides the fundamental packing options, while the set-covering bin packing optimizes their collective use. ALNS continually re-solves the routing aspect as delivery locations change.