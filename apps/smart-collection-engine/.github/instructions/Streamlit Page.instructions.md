---
applyTo: '**'
---
Act as an Optimizer Researcher, help me implement a webpage using Streamlit for solving VRP problems.

# Streamlit Page for Solving VRP Problems
This Streamlit page allows users to upload the instance files, selecting the parameter (file size), and then solving the Vehicle Routing Problem (VRP) using a predefined optimization algorithm.

When users upload the instance file, the page will load and visualize the VRP instance. After selecting the desired parameters, users can click a button to solve the VRP.

The solutions will be formatted and displayed on the webpage as the set of routes for each vehicle.

# Solvers
The solvers algorithm is already compiled using C++ (read `src/solve.sh` for more details how to execute it). **Notice** that the solvers is expected to read the instance as input file.