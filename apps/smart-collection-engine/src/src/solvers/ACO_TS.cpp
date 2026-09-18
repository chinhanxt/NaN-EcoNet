#include "ACO_TS.h"
#include "../core/SolverFactory.h"
#include <algorithm>
#include <limits>
#include <cmath>
#include <iostream>
#include <fstream>
#include <filesystem>
#include <numeric>
#include <random>

namespace {
    SolverRegistrar<ACO_TS> registrar("aco-ts");
}

struct ACOTSParams {
    int num_ants = 50;
    int num_iterations = 1000;
    double alpha = 1.0;
    double beta = 2.0;
    double rho = 0.1; // evaporation
    double Q = 1.0;
    int stagnation_limit = 10;
    double p = 0.5; // for type-III assignment
};

// Helper: initialize delivery node mapping for each customer
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

// Helper: construct a random initial permutation with depot delimiters
static std::vector<int> random_delim_permutation(int n, int m, std::mt19937& gen) {
    std::vector<int> perm(n);
    for (int i = 0; i < n; ++i) perm[i] = i + 1;
    std::shuffle(perm.begin(), perm.end(), gen);
    // Insert m+1 depot delimiters (0) at start, between, and end
    std::vector<int> result;
    int per_route = (n + m - 1) / m;
    int idx = 0;
    for (int v = 0; v < m; ++v) {
        result.push_back(0);
        for (int j = 0; j < per_route && idx < n; ++j) {
            result.push_back(perm[idx++]);
        }
    }
    result.push_back(0);
    return result;
}

// Helper: ACO construction using transition probability (delimeter-based)
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
        for (double& p : probs) p /= sum_prob;
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

// Local search on customer permutation (with depot delimiters)
static std::vector<int> local_search_customer_permutation(const std::vector<int>& perm, std::mt19937& gen) {
    std::vector<int> best_perm = perm;
    int n = perm.size();
    if (n <= 3) return perm; // nothing to do
    // Try swap (exchange)
    for (int i = 1; i < n - 1; ++i) {
        if (best_perm[i] == 0) continue;
        for (int j = i + 1; j < n - 1; ++j) {
            if (best_perm[j] == 0) continue;
            std::vector<int> new_perm = best_perm;
            std::swap(new_perm[i], new_perm[j]);
            if (new_perm != best_perm) {
                return new_perm;
            }
        }
    }
    // Try insertion
    for (int i = 1; i < n - 1; ++i) {
        if (best_perm[i] == 0) continue;
        for (int j = 1; j < n - 1; ++j) {
            if (i == j || best_perm[j] == 0) continue;
            std::vector<int> new_perm = best_perm;
            int val = new_perm[i];
            new_perm.erase(new_perm.begin() + i);
            new_perm.insert(new_perm.begin() + j, val);
            if (new_perm != best_perm) {
                return new_perm;
            }
        }
    }
    // Try 2-opt (reverse a segment)
    for (int i = 1; i < n - 2; ++i) {
        if (best_perm[i] == 0) continue;
        for (int j = i + 1; j < n - 1; ++j) {
            if (best_perm[j] == 0) continue;
            std::vector<int> new_perm = best_perm;
            std::reverse(new_perm.begin() + i, new_perm.begin() + j + 1);
            if (new_perm != best_perm) {
                return new_perm;
            }
        }
    }
    return best_perm;
}

// Tabu Search for VRPPL (exchange, insert, 2-opt) on customer permutation
// Accepts: customer permutation (with depot delimiters), customer2node, and other params
static Solution tabu_search(const VRPInstance& instance, const std::vector<int>& init_perm, const std::unordered_map<int, int>& customer2node, const ACOTSParams& params, std::vector<std::vector<double>>& tau, int max_iter = 100, int max_no_improve = 20) {
    int n = instance.num_customers;
    int tabu_tenure = std::max(1, n / 2);
    std::mt19937 gen(std::random_device{}());
    std::vector<int> curr_perm = init_perm;
    Solution best = Solver::evaluate(instance, curr_perm, customer2node, true);
    Solution curr = best;
    int no_improve = 0;
    std::unordered_map<int, int> tabu_list;
    for (int iter = 0; iter < max_iter && no_improve < max_no_improve; ++iter) {
        Solution best_candidate;
        best_candidate.objective_value = 1e12;
        std::vector<int> best_move; // [type, i, j, ...]
        std::vector<int> candidate_perm;
        // 1. Exchange (swap)
        for (int i = 1; i < (int)curr_perm.size() - 1; ++i) {
            if (curr_perm[i] == 0) continue;
            for (int j = i + 1; j < (int)curr_perm.size() - 1; ++j) {
                if (curr_perm[j] == 0) continue;
                std::vector<int> new_perm = curr_perm;
                std::swap(new_perm[i], new_perm[j]);
                Solution cand = Solver::evaluate(instance, new_perm, customer2node, true);
                int cust1 = curr_perm[i], cust2 = curr_perm[j];
                bool is_tabu = (tabu_list[cust1] > iter) || (tabu_list[cust2] > iter);
                bool aspiration = cand.objective_value < best.objective_value;
                if ((cand.objective_value < best_candidate.objective_value && (!is_tabu || aspiration))) {
                    best_candidate = cand;
                    best_move = {1, i, j};
                    candidate_perm = new_perm;
                }
            }
        }
        // 2. Insert
        for (int i = 1; i < (int)curr_perm.size() - 1; ++i) {
            if (curr_perm[i] == 0) continue;
            for (int j = 1; j < (int)curr_perm.size() - 1; ++j) {
                if (i == j || curr_perm[j] == 0) continue;
                std::vector<int> new_perm = curr_perm;
                int val = new_perm[i];
                new_perm.erase(new_perm.begin() + i);
                new_perm.insert(new_perm.begin() + j, val);
                Solution cand = Solver::evaluate(instance, new_perm, customer2node, true);
                bool is_tabu = (tabu_list[val] > iter);
                bool aspiration = cand.objective_value < best.objective_value;
                if ((cand.objective_value < best_candidate.objective_value && (!is_tabu || aspiration))) {
                    best_candidate = cand;
                    best_move = {2, i, j};
                    candidate_perm = new_perm;
                }
            }
        }
        // 3. 2-opt
        for (int i = 1; i < (int)curr_perm.size() - 2; ++i) {
            if (curr_perm[i] == 0) continue;
            for (int j = i + 1; j < (int)curr_perm.size() - 1; ++j) {
                if (curr_perm[j] == 0) continue;
                std::vector<int> new_perm = curr_perm;
                std::reverse(new_perm.begin() + i, new_perm.begin() + j + 1);
                Solution cand = Solver::evaluate(instance, new_perm, customer2node, true);
                bool is_tabu = false;
                for (int k = i; k <= j; ++k) if (tabu_list[curr_perm[k]] > iter) is_tabu = true;
                bool aspiration = cand.objective_value < best.objective_value;
                if ((cand.objective_value < best_candidate.objective_value && (!is_tabu || aspiration))) {
                    best_candidate = cand;
                    best_move = {3, i, j};
                    candidate_perm = new_perm;
                }
            }
        }
        // If no improvement, break
        if (best_candidate.objective_value >= curr.objective_value) {
            no_improve++;
        } else {
            no_improve = 0;
            curr = best_candidate;
            curr_perm = candidate_perm;
            // Update Tabu list
            if (!best_move.empty()) {
                if (best_move[0] == 1) { // swap
                    tabu_list[curr_perm[best_move[1]]] = iter + tabu_tenure;
                    tabu_list[curr_perm[best_move[2]]] = iter + tabu_tenure;
                } else if (best_move[0] == 2) { // insert
                    tabu_list[curr_perm[best_move[2]]] = iter + tabu_tenure;
                } else if (best_move[0] == 3) { // 2-opt
                    for (int k = best_move[1]; k <= best_move[2]; ++k)
                        tabu_list[curr_perm[k]] = iter + tabu_tenure;
                }
            }
            // Pheromone update for each move
            for (const auto& route : curr.routes) {
                for (size_t i = 1; i < route.size(); ++i) {
                    int u = route[i-1], v = route[i];
                    tau[u][v] += params.Q / curr.objective_value;
                }
            }
            if (curr.objective_value < best.objective_value) {
                best = curr;
            }
        }
    }
    return best;
}

Solution ACO_TS::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    ACOTSParams params;
    params.num_ants = params_node["num_ants"].as<int>();
    params.num_iterations = params_node["num_iterations"].as<int>();
    params.alpha = params_node["alpha"].as<double>();
    params.beta = params_node["beta"].as<double>();
    params.rho = params_node["evaporation_rate"].as<double>();
    params.Q = params_node["Q"].as<double>();
    params.p = params_node["p"].as<double>();

    int n = instance.num_customers;
    int m = instance.num_vehicles;
    int num_nodes = n + instance.num_lockers + 1;
    std::mt19937 gen(std::random_device{}());
    std::vector<std::vector<double>> tau(num_nodes, std::vector<double>(num_nodes, 1.0));
    Solution best_sol;
    best_sol.objective_value = 1e12;
    int stagnation = 0;
    bool tabu_applied = false;
    std::vector<double> convergence_history;
    if (history) convergence_history.push_back(best_sol.objective_value);
    for (int iter = 0; iter < params.num_iterations; ++iter) {
        std::vector<Solution> ant_sols(params.num_ants);
        for (int k = 0; k < params.num_ants; ++k) {
            // 1. Assign delivery nodes
            std::unordered_map<int, int> customer2node;
            initialize_customer2node(instance, customer2node, params.p, gen);
            // 2. Build a solution (permutation with delimiters)
            std::vector<int> perm = aco_construct_permutation(instance, customer2node, tau, params.alpha, params.beta, gen);
            // 2.5. Local search on customer permutation
            perm = local_search_customer_permutation(perm, gen);
            // 3. Construct solution using delimiter-based evaluation
            Solution sol = Solver::evaluate(instance, perm, customer2node, true);
            ant_sols[k] = sol;
        }
        // Find best ant
        auto best_ant = std::min_element(ant_sols.begin(), ant_sols.end(), [](const Solution& a, const Solution& b) {
            return a.objective_value < b.objective_value;
        });
        if (best_ant->objective_value < best_sol.objective_value) {
            best_sol = *best_ant;
            stagnation = 0;
        } else {
            stagnation++;
        }
        // Pheromone evaporation
        for (int i = 0; i < num_nodes; ++i)
            for (int j = 0; j < num_nodes; ++j)
                tau[i][j] *= (1.0 - params.rho);
        // Pheromone update (only best ant)
        for (const auto& route : best_ant->routes) {
            for (size_t i = 1; i < route.size(); ++i) {
                int u = route[i-1], v = route[i];
                tau[u][v] += params.Q / best_ant->objective_value;
            }
        }
        // Tabu Search integration
        if (!tabu_applied && stagnation >= params.stagnation_limit) {
            // std::cout << "[ACO] Stagnation detected, applying Tabu Search..." << std::endl;
            best_sol = tabu_search(instance, best_sol.customer_permutation, best_sol.customer2node, params, tau);
            stagnation = 0;
            tabu_applied = true;
        }
        // Record best objective at this iteration
        if (history) convergence_history.push_back(best_sol.objective_value);
        if (history) std::cout << "[ACO] Iter " << iter << ": Best = " << best_sol.objective_value << std::endl;
    }
    if (history) {
        std::filesystem::create_directories("..//output/experiment");
        std::ofstream csv("../output/experiment/aco-ts.cvr.csv");
        csv << "iter,best_objective\n";
        for (size_t i = 0; i < convergence_history.size(); ++i) {
            csv << i << "," << convergence_history[i] << "\n";
        }
        csv.close();
    }
    return best_sol;
}
