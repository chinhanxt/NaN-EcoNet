Based on the instance description in `VRPPL.prompt.md`.

Imagine you are a diligent researcher in Optimization Algorithm. I am proposing a new meta-heuristics method (A). I want to validate my proposed method against other existing methods. However, there has been no other researches working on the VRP models  I am researching. 

# Experiments

## Convergence Rate

The experiment measure the change in best objective over iteration of each solver

1. Each solver will record their history: iter, best_objective
2. Output the results to 'src/output/experiment/<solver>.cvr.csv`