#include "ACO.h"
#include "../core/SolverFactory.h"
#include <omp.h>
#include <algorithm>
#include <limits>
#include <cmath>
#include <iostream>
#include <fstream>
#include <filesystem>
#include <numeric>
#include <random>

namespace {
    SolverRegistrar<ACO> registrar("aco");
}

struct ACOParams {
    int m = 50;
    int I = 1000;
    double alpha = 1.0;
    double beta = 2.0;
    double rho = 0.1; // evaporation
    double Q = 1.0;
    double p = 0.5; // for type-III assignment
    int num_threads = 32; // parallel threads
    int t = 10; // number of elite ants for pheromone update
    int LS = 10; // local search iterations
};

// Helper: initialize delivery node mapping for each customer (thread-safe)
static void initialize_customer2node(const VRPInstance& instance, std::unordered_map<int, int>& customer2node, double p, std::mt19937& gen) {
    int n = instance.num_customers;
    std::uniform_real_distribution<> prob(0.0, 1.0);
    for (int i = 0; i < n; ++i) {
        auto c = instance.customers[i];
        if (c->customer_type == 1) {
            customer2node[c->id] = c->id;
        } else if (c->customer_type == 2) {
            int assigned = -1;
            if (!instance.customer_preferences.empty() && i < instance.customer_preferences.size()) {
                for (size_t j = 0; j < instance.customer_preferences[i].size(); ++j) {
                    if (instance.customer_preferences[i][j] == 1) {
                        assigned = instance.lockers[j]->id;
                        break;
                    }
                }
            }
            if (assigned != -1) {
                customer2node[c->id] = assigned;
            } else if (!instance.lockers.empty()) {
                customer2node[c->id] = instance.lockers[0]->id;
            } else {
                customer2node[c->id] = c->id;
            }
        } else if (c->customer_type == 3) {
            double r = prob(gen);
            int assigned = -1;
            if (r >= p) {
                if (!instance.customer_preferences.empty() && i < instance.customer_preferences.size()) {
                    for (size_t j = 0; j < instance.customer_preferences[i].size(); ++j) {
                        if (instance.customer_preferences[i][j] == 1) {
                            assigned = instance.lockers[j]->id;
                            break;
                        }
                    }
                }
                if (assigned != -1) {
                    customer2node[c->id] = assigned;
                } else if (!instance.lockers.empty()) {
                    customer2node[c->id] = instance.lockers[0]->id;
                } else {
                    customer2node[c->id] = c->id;
                }
            } else {
                customer2node[c->id] = c->id;
            }
        }
    }
}

// Helper: ACO construction using transition probability (thread-safe)
static std::vector<int> aco_construct_permutation(const VRPInstance& instance, const std::unordered_map<int, int>& customer2node, const std::vector<std::vector<double>>& tau, double alpha, double beta, std::mt19937& gen) {
    int n = instance.num_customers;
    int m = instance.num_vehicles;
    int depot_id = 0;
    std::vector<int> unvisited;
    for (int i = 1; i <= n; ++i) unvisited.push_back(i);
    std::vector<int> perm;
    perm.push_back(depot_id); // start at depot
    int curr_node = depot_id;
    int load = 0;
    double time = 0;
    int vehicles_used = 1;
    
    while (!unvisited.empty() && vehicles_used <= m) {
        // Build feasible neighborhood
        std::vector<int> feasible;
        for (int cust_id : unvisited) {
            int delivery_node = customer2node.at(cust_id);
            int demand = 0;
            int early = 0, late = 0;
            if (delivery_node <= instance.num_customers) {
                auto c = instance.customers[delivery_node-1];
                demand = c->demand;
                early = c->early_time;
                late = c->late_time;
            } else {
                auto l = instance.lockers[delivery_node-1-instance.num_customers];
                auto c = instance.customers[cust_id-1];
                demand = c->demand;
                early = l->early_time;
                late = l->late_time;
            }
            double arr_time = time + instance.distance_matrix[curr_node][delivery_node];
            if (load + demand <= instance.vehicle_capacity && arr_time <= late) {
                feasible.push_back(cust_id);
            }
        }
        
        if (feasible.empty()) {
            // No feasible customer, close route
            perm.push_back(depot_id);
            curr_node = depot_id;
            load = 0;
            time = 0;
            vehicles_used++;
            continue;
        }
        
        // Compute probabilities
        std::vector<double> probs;
        double sum_prob = 0.0;
        for (int cust_id : feasible) {
            int delivery_node = customer2node.at(cust_id);
            double tau_ij = tau[curr_node][delivery_node];
            double eta_ij = 1.0 / (instance.distance_matrix[curr_node][delivery_node] + 1e-6);
            double val = std::pow(tau_ij, alpha) * std::pow(eta_ij, beta);
            probs.push_back(val);
            sum_prob += val;
        }
        
        // Normalize
        for (double& p : probs) p /= (sum_prob + 1e-9);
        
        // Roulette wheel selection
        std::discrete_distribution<> dist(probs.begin(), probs.end());
        int idx = dist(gen);
        int next_cust = feasible[idx];
        int delivery_node = customer2node.at(next_cust);
        
        // Update state
        perm.push_back(next_cust);
        load += (delivery_node <= instance.num_customers)
            ? instance.customers[delivery_node-1]->demand
            : instance.customers[next_cust-1]->demand;
        double arr_time = time + instance.distance_matrix[curr_node][delivery_node];
        if (delivery_node <= instance.num_customers) {
            time = std::max(arr_time, (double)instance.customers[delivery_node-1]->early_time);
        } else {
            time = std::max(arr_time, (double)instance.lockers[delivery_node-1-instance.num_customers]->early_time);
        }
        curr_node = delivery_node;
        
        // Remove from unvisited
        unvisited.erase(std::remove(unvisited.begin(), unvisited.end(), next_cust), unvisited.end());
    }
    
    // End with depot
    if (perm.back() != depot_id) perm.push_back(depot_id);
    return perm;
}

// Local search on customer permutation (thread-safe)
static std::vector<int> local_search_customer_permutation(const std::vector<int>& perm, const VRPInstance& instance, const std::unordered_map<int, int>& customer2node, int max_iters, std::mt19937& gen) {
    std::vector<int> best_perm = perm;
    Solution best_sol = Solver::evaluate(instance, best_perm, customer2node, true);
    double best_obj = best_sol.objective_value;
    
    std::vector<int> curr_perm = best_perm;
    double curr_obj = best_obj;
    
    for (int iter = 0; iter < max_iters; ++iter) {
        std::vector<int> neighbor_perm = curr_perm;
        int n = neighbor_perm.size();
        
        if (n <= 3) break; // nothing to do
        
        // Choose random operation
        std::uniform_real_distribution<> op_dist(0.0, 1.0);
        std::uniform_int_distribution<> idx_dist(1, n - 2); // avoid depot positions
        
        double r = op_dist(gen);
        
        if (r < 1.0/3.0) { // Swap
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j && neighbor_perm[i] != 0 && neighbor_perm[j] != 0) {
                std::swap(neighbor_perm[i], neighbor_perm[j]);
            }
        } else if (r < 2.0/3.0) { // Insert
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j && neighbor_perm[i] != 0) {
                int val = neighbor_perm[i];
                neighbor_perm.erase(neighbor_perm.begin() + i);
                if (j > i) j--;
                if (j >= neighbor_perm.size()) j = neighbor_perm.size() - 1;
                neighbor_perm.insert(neighbor_perm.begin() + j, val);
            }
        } else { // 2-opt (reverse)
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i > j) std::swap(i, j);
            if (i != j && j < n - 1) {
                std::reverse(neighbor_perm.begin() + i, neighbor_perm.begin() + j + 1);
            }
        }
        
        // Evaluate neighbor
        Solution neighbor_sol = Solver::evaluate(instance, neighbor_perm, customer2node, true);
        double neighbor_obj = neighbor_sol.objective_value;
        
        if (neighbor_obj < curr_obj) {
            curr_perm = neighbor_perm;
            curr_obj = neighbor_obj;
            if (curr_obj < best_obj) {
                best_perm = curr_perm;
                best_obj = curr_obj;
            }
        }
    }
    
    return best_perm;
}

Solution ACO::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    ACOParams params;
    params.m = params_node["m"].as<int>();
    params.I = params_node["I"].as<int>();
    params.alpha = params_node["alpha"].as<double>();
    params.beta = params_node["beta"].as<double>();
    params.rho = params_node["rho"].as<double>();
    params.Q = params_node["Q"].as<double>();
    params.p = params_node["p"].as<double>();
    params.num_threads = params_node["num_threads"].as<int>();
    params.t = params_node["t"].as<int>();
    params.LS = params_node["LS"].as<int>();

    if (verbose >= 1) std::cout << "[ACO] Starting parallel solve..." << std::endl;
    
    int n = instance.num_customers;
    int num_nodes = n + instance.num_lockers + 1;
    
    // Initialize 2D pheromone matrix
    std::vector<std::vector<double>> tau(num_nodes, std::vector<double>(num_nodes, 1.0));
    
    Solution global_best;
    global_best.objective_value = std::numeric_limits<double>::max();
    std::vector<double> convergence_history;
    if (history) convergence_history.push_back(global_best.objective_value);
    
    std::random_device rd_global_seed;
    
    int non_improved = 0;
    int iter = 0;
    
    // Main ACO loop - continue until stagnation limit reached  
    while (non_improved < params.I) {
        if (verbose >= 1) std::cout << "[ACO] Iteration " << iter << std::endl;
        
        std::vector<Solution> iteration_solutions;
        
        #pragma omp parallel num_threads(params.num_threads)
        {
            int tid = omp_get_thread_num();
            std::mt19937 thread_rng(rd_global_seed() + tid + iter);
            
            std::vector<Solution> thread_solutions;
            
            // Each thread processes multiple ants
            int ants_per_thread = params.m;
            int extra_ants = std::min(non_improved + 1, 8); // Extra ants for exploration
            int start_ant_idx_global = tid * ants_per_thread;
            int num_ants_this_thread = ants_per_thread * extra_ants;
            
            for (int k = 0; k < num_ants_this_thread; ++k) {
                // 1. Assign delivery nodes
                std::unordered_map<int, int> customer2node;
                initialize_customer2node(instance, customer2node, params.p, thread_rng);
                
                // 2. Build a solution using ACO construction
                std::vector<int> perm = aco_construct_permutation(instance, customer2node, tau, params.alpha, params.beta, thread_rng);
                
                // 3. Apply local search
                perm = local_search_customer_permutation(perm, instance, customer2node, params.LS, thread_rng);
                
                // 4. Evaluate solution
                Solution sol = Solver::evaluate(instance, perm, customer2node, true);
                thread_solutions.push_back(sol);
            }
            
            // Add thread solutions to global pool
            #pragma omp critical
            {
                iteration_solutions.insert(iteration_solutions.end(), 
                                          thread_solutions.begin(), 
                                          thread_solutions.end());
            }
        }
        
        if (verbose >= 2) std::cout << "[ACO] Finished parallel ant construction." << std::endl;
        
        // Sort solutions by objective value
        std::sort(iteration_solutions.begin(), iteration_solutions.end(), 
                  [](const Solution& a, const Solution& b) {
                      return a.objective_value < b.objective_value;
                  });
        
        // Update global best
        if (!iteration_solutions.empty() && iteration_solutions[0].objective_value < global_best.objective_value) {
            global_best = iteration_solutions[0];
            non_improved = 0;  // Reset non-improvement counter
            if (verbose >= 1) std::cout << "[ACO] New global best: " << global_best.objective_value << std::endl;
        } else {
            non_improved++;  // Increment non-improvement counter
        }
        
        // Pheromone evaporation
        for (int i = 0; i < num_nodes; ++i) {
            for (int j = 0; j < num_nodes; ++j) {
                tau[i][j] *= (1.0 - params.rho);
            }
        }
        
        // Pheromone update using top elite solutions
        int num_elite = std::min((int)iteration_solutions.size(), params.t);
        for (int rank = 0; rank < num_elite; ++rank) {
            const auto& sol = iteration_solutions[rank];
            double obj = sol.objective_value;
            
            // Update pheromone based on routes
            for (const auto& route : sol.routes) {
                for (size_t i = 1; i < route.size(); ++i) {
                    int u = route[i-1];
                    int v = route[i];
                    tau[u][v] += params.Q / obj;
                }
            }
        }
        
        // Record convergence
        if (history) convergence_history.push_back(global_best.objective_value);
        
        if (verbose >= 1) {
            std::cout << "[ACO] Iteration " << iter 
                      << ": Best = " << global_best.objective_value
                      << ", Non-improved: " << non_improved;
            if (!iteration_solutions.empty()) {
                std::cout << ", Iter best = " << iteration_solutions[0].objective_value;
            }
            std::cout << std::endl;
        }
        
        iter++;  // Increment iteration counter
    }
    
    // Save convergence history
    if (history) {
        std::filesystem::create_directories("../output/experiment");
        std::ofstream csv("../output/experiment/aco.cvr.csv");
        csv << "iter,best_objective\n";
        for (size_t i = 0; i < convergence_history.size(); ++i) {
            csv << i << "," << convergence_history[i] << "\n";
        }
        csv.close();
    }
    
    if (verbose >= 1) std::cout << "[ACO] Done. Returning best solution." << std::endl;
    return global_best;
}
