#include "HHO.h"
#include "../core/SolverFactory.h"
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <random>
#include <iostream>
#include <fstream>
#include <filesystem>
#include <cmath>

namespace {
    SolverRegistrar<HHO> registrar("hho");
}

struct HHOParams {
    int max_iter = 200; // T: maximum number of iterations
    int population_size = 100; // N: population size  
    int num_iterations = 30; // Number of iterations per stage
    double p = 0.5; // for type-III locker assignment
    double lower_bound = 0.0; // LB: Lower bound for escaping energy
    double upper_bound = 1.0; // UB: Upper bound for escaping energy
    double learning_rate = 0.0001; // Model.eta (learning rate)
    double beta = 1.5; // Levy flight parameter
};

struct Hawk {
    std::vector<int> customer_perm;
    std::unordered_map<int, int> customer2node;
    Solution solution;
    double fitness;
    int num_vehicles; // Number of vehicles used in this solution
    double total_cost; // Total travel cost
    
    Hawk() : fitness(1e12), num_vehicles(0), total_cost(1e12) {}
    
    // Calculate fitness for Stage 1: minimize vehicles first
    void calculateStage1Fitness() {
        if (solution.routes.empty()) {
            fitness = 1e12;
            return;
        }
        num_vehicles = solution.routes.size();
        total_cost = solution.objective_value;
        // f(σ) = |σ| + (sum c(σ_i) for i in 1 to |σ|) / |σ|
        fitness = num_vehicles + (total_cost / num_vehicles);
    }
    
    // Calculate fitness for Stage 2: minimize cost with fixed vehicles
    void calculateStage2Fitness() {
        fitness = solution.objective_value; // Just the total travel cost
    }
};

// Levy flight for diversity (placeholder implementation)
std::vector<int> applyLevyFlight(const std::vector<int>& customer_perm, std::mt19937& gen, double beta) {
    std::vector<int> new_perm = customer_perm;
    
    // TODO: Implement proper Levy flight
    // For now, apply small random perturbations
    if (new_perm.size() > 1) {
        std::uniform_int_distribution<> dist(0, new_perm.size() - 1);
        int idx1 = dist(gen);
        int idx2 = dist(gen);
        if (idx1 != idx2) {
            std::swap(new_perm[idx1], new_perm[idx2]);
        }
    }
    
    return new_perm;
}

// Local search operators (placeholders)
std::vector<int> apply2Opt(const std::vector<int>& customer_perm, std::mt19937& gen) {
    // TODO: Implement 2-opt local search
    std::vector<int> new_perm = customer_perm;
    if (new_perm.size() > 3) {
        std::uniform_int_distribution<> dist(0, new_perm.size() - 1);
        int i = dist(gen);
        int j = dist(gen);
        if (i > j) std::swap(i, j);
        if (i != j) {
            std::reverse(new_perm.begin() + i, new_perm.begin() + j + 1);
        }
    }
    return new_perm;
}

std::vector<int> applyInsertMove(const std::vector<int>& customer_perm, std::mt19937& gen) {
    // TODO: Implement insert move local search
    std::vector<int> new_perm = customer_perm;
    if (new_perm.size() > 1) {
        std::uniform_int_distribution<> dist(0, new_perm.size() - 1);
        int i = dist(gen);
        int j = dist(gen);
        if (i != j) {
            int val = new_perm[i];
            new_perm.erase(new_perm.begin() + i);
            new_perm.insert(new_perm.begin() + j, val);
        }
    }
    return new_perm;
}

// HHO two-stage optimization
static Solution iterate(const VRPInstance& instance, std::vector<Hawk>& population, const HHOParams& params, bool history, int verbose) {
    Solution best_solution;
    best_solution.objective_value = 1e12;
    Hawk* best_hawk = nullptr;
    
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<> prob(0.0, 1.0);
    std::vector<double> convergence_history;
    
    // ==============================================
    // STAGE 1: Global Search to Minimize Vehicles
    // ==============================================
    if (verbose >= 1) {
        std::cout << "[HHO] Starting Stage 1: Minimize number of vehicles\n";
    }
    
    // Initialize population fitness for Stage 1
    for (auto& hawk : population) {
        hawk.calculateStage1Fitness();
        if (hawk.fitness < best_solution.objective_value) {
            best_solution = hawk.solution;
            best_hawk = &hawk;
        }
    }
    
    if (history) convergence_history.push_back(best_solution.objective_value);
    
    int T = params.max_iter / 2; // Half iterations for Stage 1
    for (int t = 0; t < T; ++t) {
        // Calculate escaping energy: |E| = 2 * (1 - t/T)
        double E = 2.0 * (1.0 - (double)t / T);
        double abs_E = std::abs(E);
        
        for (size_t i = 0; i < population.size(); ++i) {
            Hawk& current_hawk = population[i];
            
            // HHO Exploration Phase (Global Search)
            if (prob(gen) >= abs_E) { // High energy: exploration
                std::vector<int> new_perm;
                std::unordered_map<int, int> new_customer2node = current_hawk.customer2node;
                
                // Update position randomly or based on other hawks' positions
                double exploration_strategy = prob(gen);
                if (exploration_strategy < 0.5) {
                    // Random position update
                    utils::random_init(instance, new_perm, new_customer2node, params.p);
                } else {
                    // Update based on other hawks (use best hawk as reference)
                    if (best_hawk != nullptr) {
                        new_perm = applyLevyFlight(best_hawk->customer_perm, gen, params.beta);
                    } else {
                        new_perm = applyLevyFlight(current_hawk.customer_perm, gen, params.beta);
                    }
                }
                
                // Evaluate new solution
                Solution new_solution = Solver::evaluate(instance, new_perm, new_customer2node);
                
                // Create temporary hawk to calculate Stage 1 fitness
                Hawk temp_hawk;
                temp_hawk.solution = new_solution;
                temp_hawk.calculateStage1Fitness();
                
                // Replace if better (fewer vehicles or better cost with same vehicles)
                if (temp_hawk.fitness < current_hawk.fitness) {
                    current_hawk.customer_perm = new_perm;
                    current_hawk.customer2node = new_customer2node;
                    current_hawk.solution = new_solution;
                    current_hawk.fitness = temp_hawk.fitness;
                    current_hawk.num_vehicles = temp_hawk.num_vehicles;
                    current_hawk.total_cost = temp_hawk.total_cost;
                    
                    // Update global best
                    if (temp_hawk.fitness < best_solution.objective_value) {
                        best_solution = new_solution;
                        best_hawk = &current_hawk;
                    }
                }
            } else { // Low energy: transition to exploitation
                double r = prob(gen); // Escape probability
                std::vector<int> new_perm;
                
                if (r >= 0.5 && abs_E >= 0.5) { // Soft besiege
                    // Update towards best solution with levy flight for diversity
                    if (best_hawk != nullptr) {
                        new_perm = applyLevyFlight(best_hawk->customer_perm, gen, params.beta);
                    } else {
                        new_perm = applyLevyFlight(current_hawk.customer_perm, gen, params.beta);
                    }
                } else if (r >= 0.5 && abs_E < 0.5) { // Hard besiege
                    // Directly update towards best solution
                    if (best_hawk != nullptr) {
                        new_perm = best_hawk->customer_perm;
                        // Apply small perturbation
                        if (new_perm.size() > 1) {
                            std::uniform_int_distribution<> dist(0, new_perm.size() - 1);
                            int idx1 = dist(gen), idx2 = dist(gen);
                            if (idx1 != idx2) std::swap(new_perm[idx1], new_perm[idx2]);
                        }
                    } else {
                        new_perm = current_hawk.customer_perm;
                    }
                } else {
                    // Progressive dives (soft/hard besiege with swapping/inserting customers)
                    new_perm = applyInsertMove(current_hawk.customer_perm, gen);
                }
                
                // Evaluate and update if better
                Solution new_solution = Solver::evaluate(instance, new_perm, current_hawk.customer2node);
                Hawk temp_hawk;
                temp_hawk.solution = new_solution;
                temp_hawk.calculateStage1Fitness();
                
                if (temp_hawk.fitness < current_hawk.fitness) {
                    current_hawk.customer_perm = new_perm;
                    current_hawk.solution = new_solution;
                    current_hawk.fitness = temp_hawk.fitness;
                    current_hawk.num_vehicles = temp_hawk.num_vehicles;
                    current_hawk.total_cost = temp_hawk.total_cost;
                    
                    if (temp_hawk.fitness < best_solution.objective_value) {
                        best_solution = new_solution;
                        best_hawk = &current_hawk;
                    }
                }
            }
        }
        
        if (verbose >= 2) {
            std::cout << "[HHO] Stage 1 - Iter " << t << " best vehicles = " << best_hawk->num_vehicles 
                      << " cost = " << best_hawk->total_cost << " E=" << E << "\n";
        }
        
        if (history) convergence_history.push_back(best_solution.objective_value);
    }
    
    // ==============================================
    // STAGE 2: Local Search to Minimize Travel Cost
    // ==============================================
    if (verbose >= 1) {
        std::cout << "[HHO] Starting Stage 2: Minimize travel cost\n";
    }
    
    // Reset iteration counter for Stage 2
    // Set best solution as "rabbit" and focus on cost minimization
    for (auto& hawk : population) {
        hawk.calculateStage2Fitness(); // Switch to Stage 2 fitness (just cost)
    }
    
    T = params.max_iter / 2; // Remaining half for Stage 2
    for (int t = 0; t < T; ++t) {
        double E = 2.0 * (1.0 - (double)t / T);
        double abs_E = std::abs(E);
        
        for (size_t i = 0; i < population.size(); ++i) {
            Hawk& current_hawk = population[i];
            
            // Focus on local updates: Adjust routes (swap customers, shorten paths)
            std::vector<int> new_perm;
            
            if (abs_E >= 0.5) { // Soft besiege with local search
                new_perm = apply2Opt(current_hawk.customer_perm, gen);
            } else { // Hard besiege with intensive local search
                new_perm = applyInsertMove(current_hawk.customer_perm, gen);
            }
            
            // Apply small perturbations with Levy flight
            if (prob(gen) < 0.1) { // 10% chance for Levy flight
                new_perm = applyLevyFlight(new_perm, gen, params.beta);
            }
            
            // Evaluate new solution (prioritize total travel cost, keep vehicle count)
            Solution new_solution = Solver::evaluate(instance, new_perm, current_hawk.customer2node);
            
            // Only accept if cost improves and vehicle count doesn't increase
            if (new_solution.objective_value < current_hawk.solution.objective_value &&
                new_solution.routes.size() <= current_hawk.solution.routes.size()) {
                current_hawk.customer_perm = new_perm;
                current_hawk.solution = new_solution;
                current_hawk.fitness = new_solution.objective_value;
                current_hawk.total_cost = new_solution.objective_value;
                
                if (new_solution.objective_value < best_solution.objective_value) {
                    best_solution = new_solution;
                    best_hawk = &current_hawk;
                }
            }
        }
        
        if (verbose >= 2) {
            std::cout << "[HHO] Stage 2 - Iter " << t << " best cost = " << best_solution.objective_value 
                      << " vehicles = " << best_solution.routes.size() << " E=" << E << "\n";
        }
        
        if (history) convergence_history.push_back(best_solution.objective_value);
    }
    
    if (history) {
        std::filesystem::create_directories("src/output/experiment");
        std::ofstream csv("src/output/experiment/hho.cvr.csv");
        csv << "iter,best_objective\n";
        for (size_t i = 0; i < convergence_history.size(); ++i) {
            csv << i << "," << convergence_history[i] << "\n";
        }
        csv.close();
    }
    
    return best_solution;
}

Solution HHO::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    HHOParams params;
    params.max_iter = params_node["max_iter"].as<int>();
    params.population_size = params_node["population_size"].as<int>();
    params.p = params_node["p"].as<double>();
    
    // Optional parameters with defaults
    if (params_node["num_iterations"]) params.num_iterations = params_node["num_iterations"].as<int>();
    if (params_node["lower_bound"]) params.lower_bound = params_node["lower_bound"].as<double>();
    if (params_node["upper_bound"]) params.upper_bound = params_node["upper_bound"].as<double>();
    if (params_node["learning_rate"]) params.learning_rate = params_node["learning_rate"].as<double>();
    if (params_node["beta"]) params.beta = params_node["beta"].as<double>();

    // Initialize population of hawks
    std::vector<Hawk> population(params.population_size);
    
    for (int i = 0; i < params.population_size; ++i) {
        // Initialize customer-to-node mapping for each hawk
        utils::random_init(instance, population[i].customer_perm, population[i].customer2node, params.p);
        
        // Evaluate initial solution
        population[i].solution = Solver::evaluate(instance, population[i].customer_perm, population[i].customer2node);
        population[i].calculateStage1Fitness(); // Start with Stage 1 fitness
    }

    return iterate(instance, population, params, history, verbose);
}