---
description: Running sequential solver instances in parallel to collect the performance within Total CPU Time
---

# Context
- You are working on a VRPPL (VRP with Parcel Locker) solver.
- The source folder is in `src/` dir:
 - `data/[25, 50, 100]/` dir contains the .txt files of each instance, for different dataset size (25, 50, 100)
 - `parameters` specify the finedtuned hyper-parameters of each solvers.
 - `src/core` specify the shared classes (Customer, Depot, Locker, InstanceParser,...) and specify the Factory Design Pattern.
 - `src/solvers` contains the logic codes for each solver.
 - `main.cpp` and `test.cpp` contains the main entry to run each solver or solve the whole dataset automatically. For example: `./build/main --solver paco --params parameters/paco.param.yaml --instances data/25/C101_co_25.txt --num-runs 1 --output output/test.csv --size small --verbose 1`.

# Requirements
- Since the solvers: `src/src/solvers/PACO.cpp` runs in parallel, its wall-clock is faster but the Total CPU Time is more than other sequential solvers.
- The sequential solvers therefore must run with multi-start approach:


# Steps:
1. Input the parameters:
 - M: number of sample instances
 - size [25, 50, 100]: the selected dataset size
 - max-cpu-time: the Total CPU Time of the PACO.
 - solver: the selected solver
 - params: the folder to the parameter file of the selected solver
 - output-run: the path to the exported result of each run.
 - output-agg: the path to the aggregated report

2. You need to sample M instances from the VRPPL instance folder: `src/data/[size]/`.
3. For each instance:
 3.1. Run the sequential baseline multiple times with different random seeds until the **accumulated Total CPU Time** is equal to the Total CPU TIME of the PACO.
 3.2. Take the best solution found across all N runs.
 3.3. After each run, the solver exports the results: [instance-file, run, objective value, runtime] in to a file.
4. After finish, export the into the aggregated result: [instance-file, best-known-solution (min objective), avg_runtime, total_cpu_time].
5. Continue with other sample instances.

# Expected output:
- A script to automatically execute the procedure and collect the results
- The collected performance of the solver should help to compare with the 3D-PACO in a normalized Total CPU Time.