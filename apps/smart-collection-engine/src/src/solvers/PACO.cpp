#include "PACO.h"
#include "../core/SolverFactory.h"
#include <omp.h>
#include <algorithm>
#include <limits>
#include <fstream>
#include <yaml-cpp/yaml.h>
#include <random>
#include <numeric>
#include <iostream>
#include <filesystem>
#include <cmath>
#include <set>

namespace {
    SolverRegistrar<PACO> registrar("paco");
}

struct PACOParams {
    int m;      // Number of ants
    double alpha;
    double beta;
    double rho;
    double Q;
    int I;     // Number of iterations
    int t;     // Top ants for elitist update
    int p = 32;     // Number of processors (threads)
    int LS = 10;    // Local search strategy (0: none, 1: 2-opt, 2: 3-opt)
};

// Helper: PACO ant solution construction using 3D-ACO transition rule
static std::pair<std::vector<int>, std::unordered_map<int, int>>
paco_construct_solution(const VRPInstance& instance,
    const std::vector<std::vector<std::vector<double>>>& tau,
    double alpha, double beta, std::mt19937& gen) {
    int n = instance.num_customers;
    int depot_id = 0;
    std::vector<int> unvisited;
    for (int i = 1; i <= n; ++i) unvisited.push_back(i);
    std::vector<int> perm;
    std::unordered_map<int, int> customer2node;
    int prev_index = depot_id;
    while (!unvisited.empty()) {
        std::vector<std::tuple<int, int, double>> candidate_options; // (j, d, value)
        for (int j : unvisited) {
            auto c = instance.customers[j-1];
            std::vector<int> allowed;
            if (c->customer_type == 1) allowed = {0};
            else if (c->customer_type == 2) allowed = {1};
            else allowed = {0, 1};
            for (int d : allowed) {
                if (tau[prev_index][j][d] == 0.0) continue; // skip infeasible
                double value = std::pow(tau[prev_index][j][d], alpha);
                candidate_options.emplace_back(j, d, value);
            }
        }
        double sum = 0.0;
        for (auto& opt : candidate_options) sum += std::get<2>(opt);
        std::vector<double> probs;
        for (auto& opt : candidate_options)
            probs.push_back(sum > 0 ? std::get<2>(opt) / sum : 1.0 / candidate_options.size());
        if (probs.empty()) break;
        std::discrete_distribution<> dist(probs.begin(), probs.end());
        int idx = dist(gen);
        int j = std::get<0>(candidate_options[idx]);
        int d = std::get<1>(candidate_options[idx]);
        // Locker assignment
        int delivery_node = (d == 0) ? j : -1;
        if (d == 1) {
            int assigned = -1;
            if (!instance.customer_preferences.empty() && j-1 < (int)instance.customer_preferences.size()) {
                for (size_t k = 0; k < instance.customer_preferences[j-1].size(); ++k) {
                    if (instance.customer_preferences[j-1][k] == 1) {
                        assigned = instance.lockers[k]->id;
                        break;
                    }
                }
            }
            if (assigned == -1 && !instance.lockers.empty()) assigned = instance.lockers[0]->id;
            delivery_node = assigned;
        }
        perm.push_back(j);
        customer2node[j] = delivery_node;
        prev_index = j;
        unvisited.erase(std::remove(unvisited.begin(), unvisited.end(), j), unvisited.end());
    }
    // Do NOT add depot at the end
    return {perm, customer2node};
}

// Helper: Compute Hamming distance between two permutations
static int hamming_distance(const std::vector<int>& a, const std::vector<int>& b) {
    int n = std::min(a.size(), b.size());
    int dist = 0;
    for (int i = 0; i < n; ++i) {
        if (a[i] != b[i]) ++dist;
    }
    // If sizes differ, count extra elements as differences
    dist += std::abs((int)a.size() - (int)b.size());
    return dist;
}

Solution PACO::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    PACOParams params;
    params.m = params_node["m"].as<int>();
    params.I = params_node["I"].as<int>();
    params.alpha = params_node["alpha"].as<double>();
    params.beta = params_node["beta"].as<double>();
    params.rho = params_node["rho"].as<double>();
    params.Q = params_node["Q"].as<double>();
    params.t = params_node["t"].as<int>();
    params.p = params_node["p"].as<int>();

    if (verbose >= 1) std::cout << "[PACO] Starting solve..." << std::endl;
    int n_nodes = instance.num_customers + 1; // including depot, for pheromone matrix indexing
    int m = params.m; // total number of ants
    int p = params.p; // number of parallel threads
    int t = params.t; // number of elite solutions for pheromone update
    int I = params.I; // max non-improved iterations

    if (verbose >= 2) std::cout << "[PACO] n_nodes=" << n_nodes << ", m=" << m << ", p=" << p << ", t=" << t << ", I=" << I << std::endl;
    std::vector<std::vector<std::vector<double>>> tau(n_nodes, std::vector<std::vector<double>>(n_nodes, std::vector<double>(2, 1.0)));
    std::vector<std::vector<std::vector<int>>> mask(n_nodes, std::vector<std::vector<int>>(n_nodes, std::vector<int>(2, 1)));

    if (verbose >= 2) std::cout << "[PACO] Building feasibility mask..." << std::endl;
    for (int i = 0; i < n_nodes; ++i) {
        for (int j = 0; j < n_nodes; ++j) {
            mask[i][j][0] = (i != j) ? 1 : 0; // Direct delivery
            mask[i][j][1] = (i != j) ? 1 : 0; // Locker delivery
            if (j > 0 && j <= instance.num_customers) { // j is a customer node (1 to num_customers)
                auto c = instance.customers[j-1]; // Assuming customers vector is 0-indexed
                if (c->customer_type == 2) mask[i][j][0] = 0; // Customer type 2 cannot be direct
                if (c->customer_type == 1) mask[i][j][1] = 0; // Customer type 1 cannot be locker
            }
        }
    }
    if (verbose >= 2) std::cout << "[PACO] Applying mask to pheromone matrix..." << std::endl;
    for (int i = 0; i < n_nodes; ++i)
        for (int j = 0; j < n_nodes; ++j)
            for (int o = 0; o < 2; ++o)
                if (!mask[i][j][o]) tau[i][j][o] = 0.0;

    Solution global_best;
    double global_best_obj = std::numeric_limits<double>::max();
    std::vector<double> convergence_history;
    if (history) convergence_history.push_back(global_best_obj);

    double rho_ini = params.rho;
    int non_improved = 0;
    int iter = 0;
    double rho = rho_ini;
    double diversity_ratio = 1.0;
    auto sigmoid = [](double x) { return 1.0 / (1.0 + std::exp(-x)); };

    std::random_device rd_global_seed; // For seeding thread-local RNGs

    while (non_improved < I && diversity_ratio > 0.2) {
        if (verbose >= 1) std::cout << "[PACO] Iteration " << iter << std::endl;
        
        std::vector<Solution> iteration_final_solutions; // Collects solutions from all threads

        // Scale number of threads based on stagnation: active_p = max_threads * min(I_stag, I-2) / (I-2)
        int max_threads = p;
        int active_p = max_threads * std::min(non_improved + 1, I-2) / (I-2);
        if (active_p < 1) active_p = 1; // Ensure at least 1 thread

        #pragma omp parallel num_threads(active_p)
        {
            int tid = omp_get_thread_num();
            // Calculate ants per thread
            // int ants_per_thread = m;
            // int extra_ants = std::min(non_improved + 1, 15); // Extra ants for exploration
            // int start_ant_idx_global = tid * ants_per_thread;
            int num_ants_this_thread = m;

            std::mt19937 thread_rng(rd_global_seed() + tid + iter); // Thread-local RNG

            std::vector<Solution> thread_ant_solutions(num_ants_this_thread);
            std::vector<double> thread_ant_objs(num_ants_this_thread);

            if (num_ants_this_thread > 0) {
                // 1. Ant construction and Local Search for this thread's ants
                for (int k_local = 0; k_local < num_ants_this_thread; ++k_local) {
                    auto [perm, customer2node_map] = paco_construct_solution(instance, tau, params.alpha, params.beta, thread_rng);
                    std::vector<int> best_perm_ls = perm;
                    Solution initial_eval_sol = Solver::evaluate(instance, best_perm_ls, customer2node_map, false, verbose);
                    double best_obj_ls = initial_eval_sol.objective_value;
                    std::vector<int> curr_perm_ls = best_perm_ls;
                    double curr_obj_ls = best_obj_ls;
                    for (int ls_iter_count = 0; ls_iter_count < params.LS; ++ls_iter_count) {
                        std::vector<int> neighbor_perm = curr_perm_ls;
                        int n_ls = neighbor_perm.size();
                        if (n_ls > 1) {
                            std::uniform_real_distribution<> op_dist(0.0, 1.0);
                            double r_ls = op_dist(thread_rng);
                            std::uniform_int_distribution<> idx_dist(0, n_ls - 1);
                            int i_ls = idx_dist(thread_rng);
                            int j_ls = idx_dist(thread_rng);
                            if (r_ls < 1.0/3.0) { // Swap
                                if (i_ls != j_ls) std::swap(neighbor_perm[i_ls], neighbor_perm[j_ls]);
                            } else if (r_ls < 2.0/3.0) { // Insert
                                if (i_ls != j_ls && !neighbor_perm.empty()) {
                                    int val_to_move = neighbor_perm[i_ls];
                                    neighbor_perm.erase(neighbor_perm.begin() + i_ls);
                                    int insert_at_idx = j_ls;
                                    if (neighbor_perm.empty()) {
                                        insert_at_idx = 0;
                                    } else if (insert_at_idx > neighbor_perm.size()) {
                                        insert_at_idx = neighbor_perm.size(); 
                                    }
                                    if (insert_at_idx == 0 || neighbor_perm.empty()) {
                                       neighbor_perm.insert(neighbor_perm.begin(), val_to_move);
                                    } else if (insert_at_idx >= neighbor_perm.size()) {
                                       neighbor_perm.push_back(val_to_move);
                                    }
                                    else {
                                       neighbor_perm.insert(neighbor_perm.begin() + insert_at_idx, val_to_move);
                                    }
                                }
                            } else { // Reverse (2-opt style)
                                if (i_ls > j_ls) std::swap(i_ls, j_ls);
                                if (i_ls != j_ls && i_ls < neighbor_perm.size() && j_ls < neighbor_perm.size() && (j_ls + 1) <= neighbor_perm.size()) {
                                   std::reverse(neighbor_perm.begin() + i_ls, neighbor_perm.begin() + j_ls + 1);
                                }
                            }
                            Solution neighbor_sol_eval = Solver::evaluate(instance, neighbor_perm, customer2node_map, false, verbose);
                            double neighbor_obj_ls = neighbor_sol_eval.objective_value;
                            if (neighbor_obj_ls < curr_obj_ls) {
                                curr_perm_ls = neighbor_perm;
                                curr_obj_ls = neighbor_obj_ls;
                                if (curr_obj_ls < best_obj_ls) {
                                    best_perm_ls = curr_perm_ls;
                                    best_obj_ls = curr_obj_ls;
                                }
                            }
                        }
                    }
                    Solution final_ant_sol = Solver::evaluate(instance, best_perm_ls, customer2node_map, false, verbose);
                    thread_ant_solutions[k_local] = final_ant_sol;
                    thread_ant_objs[k_local] = final_ant_sol.objective_value;
                }
                // Add this thread's best ant solutions to the global pool
                #pragma omp critical
                {
                    iteration_final_solutions.insert(iteration_final_solutions.end(),
                                                     thread_ant_solutions.begin(),
                                                     thread_ant_solutions.end());
                }
            } // if (num_ants_this_thread > 0)
        } // End of #pragma omp parallel
        if (verbose >= 2) std::cout << "[PACO] Finished parallel ant construction." << std::endl;

        // Sort all collected candidate solutions from all threads
        // Sort all collected candidate solutions from all threads
        std::sort(iteration_final_solutions.begin(), iteration_final_solutions.end(), 
                  [](const Solution& a, const Solution& b) {
            return a.objective_value < b.objective_value;
        });

        // Check Elitist Diversity
        int limit = 0;
        int num_ne_elements = 0;
        if (!iteration_final_solutions.empty()) {
            limit = std::min((int)iteration_final_solutions.size(), t);
            num_ne_elements = 1;
            const Solution* ptr = &iteration_final_solutions[0];
            for (int k = 1; k < limit; ++k) {
                const Solution& current = iteration_final_solutions[k];
                bool different = false;
                // Check objective first (fastest)
                if (std::abs(ptr->objective_value - current.objective_value) > 1e-6) different = true;
                else if (ptr->customer_permutation != current.customer_permutation) different = true;
                else if (ptr->customer2node != current.customer2node) different = true;

                if (different) {
                    num_ne_elements++;
                    ptr = &current;
                }
            }
            if (limit > 0) diversity_ratio = (double)num_ne_elements / limit;

            if (verbose >= 2) {
                std::cout << "[PACO] Elitist diversity: " << num_ne_elements << "/" << limit 
                          << " (" << diversity_ratio << ")" << std::endl;
            }
        }

        // --- Compute and print average Hamming distance among top-t elitist ants ---
        int num_solutions_for_pheromone_update = std::min((int)iteration_final_solutions.size(), t);

        // Pheromone evaporation
        for (int i = 0; i < n_nodes; ++i)
            for (int j = 0; j < n_nodes; ++j)
                for (int o = 0; o < 2; ++o) {
                    tau[i][j][o] *= (1.0 - rho);
                }

        // Pheromone update using the top 't' solutions from iteration_final_solutions
        num_solutions_for_pheromone_update = std::min((int)iteration_final_solutions.size(), t);
        for (int rank = 0; rank < num_solutions_for_pheromone_update; ++rank) {
            const auto& sol_for_update = iteration_final_solutions[rank];
            const auto& perm = sol_for_update.customer_permutation; // Assumed to be customer IDs
            const auto& customer2node = sol_for_update.customer2node;
            double obj = sol_for_update.objective_value;

            if (!perm.empty()) {
                int first_cust = perm[0]; // Assuming perm holds customer IDs (1..N)
                auto it_map_first = customer2node.find(first_cust);
                if (it_map_first != customer2node.end() && first_cust > 0 && first_cust < n_nodes) {
                    int delivery_type_first = (it_map_first->second == first_cust) ? 0 : 1;
                    if (mask[0][first_cust][delivery_type_first]) { // Check mask
                        tau[0][first_cust][delivery_type_first] += params.Q / obj;
                    }
                }
            }
            for (size_t s = 0; s + 1 < perm.size(); ++s) {
                int u = perm[s];
                int v = perm[s+1];
                auto it_map_v = customer2node.find(v);
                if (it_map_v != customer2node.end() && u > 0 && u < n_nodes && v > 0 && v < n_nodes) {
                    int delivery_type_v = (it_map_v->second == v) ? 0 : 1;
                     if (mask[u][v][delivery_type_v]) { // Check mask
                        tau[u][v][delivery_type_v] += params.Q / obj;
                    }
                }
            }
            if (!perm.empty()) {
                int last_cust = perm.back();
                if (last_cust > 0 && last_cust < n_nodes) {
                    if (mask[last_cust][0][0]) { // Assuming direct return to depot (type 0)
                        tau[last_cust][0][0] += params.Q / obj;
                    }
                }
            }
        }

        // Update global best solution
        if (!iteration_final_solutions.empty()) {
            if (iteration_final_solutions[0].objective_value < global_best_obj) {
                global_best = iteration_final_solutions[0];
                global_best_obj = iteration_final_solutions[0].objective_value;
                non_improved = 0;
                if (verbose >= 1) std::cout << "[PACO] New global best: " << global_best_obj << std::endl;
                // rho = rho_ini;
            } else {
                non_improved++;
                rho = rho_ini + (0.8 - rho_ini) * sigmoid(10 * (static_cast<double>(non_improved) / I - 0.5)); // Avoid division by zero if I=0
            }
        } else {
             non_improved++; // No solutions, count as non-improvement
             rho = rho_ini + (0.8 - rho_ini) * sigmoid(10 * (static_cast<double>(non_improved) / I - 0.5)); // Avoid division by zero if I=0
        }

        if (history) convergence_history.push_back(global_best_obj);
        if (verbose >= 1) std::cout << "[PACO] Iteration " << iter
            << ": Best solution so far: " << global_best_obj
            << ", Non-improved iterations: " << non_improved
            << ", Evaporation rate: " << rho << std::endl;
        iter++;
    }
    if (history) {
        std::filesystem::create_directories("../output/experiment");
        std::ofstream csv("../output/experiment/paco.cvr.csv");
        csv << "iter,best_objective\n";
        for (size_t i = 0; i < convergence_history.size(); ++i) {
            csv << i << "," << convergence_history[i] << "\n";
        }
        csv.close();
    }
    if (verbose >= 1) std::cout << "[PACO] Done. Returning best solution." << std::endl;
    return global_best;
}