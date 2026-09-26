---
trigger: always_on
---

# Project Context: VRPPL Solver

## Overview
You are working on a **VRPPL (Vehicle Routing Problem with Parcel Locker)** solver implemented in C++.

## Project Structure
- `data/[25, 50, 100]/`: Contains `.txt` instance files categorized by dataset size.
- `parameters/`: Contains `.yaml` files specifying fine-tuned hyper-parameters for each solver.
- `src/core/`: Core domain logic. Contains shared classes (`Customer`, `Depot`, `Locker`, `InstanceParser`).
- `src/solvers/`: Contains the implementation logic for specific solver algorithms.
- `main.cpp` & `test.cpp`: Entry points for execution and automated testing.

## Architectural Patterns
- **Factory Design Pattern:** Used in `src/core` to instantiate solvers and components. Adhere to this pattern when adding new solvers.