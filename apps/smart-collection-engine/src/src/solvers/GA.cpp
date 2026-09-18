#include "GA.h"
#include "../core/SolverFactory.h"
#include <vector>
#include <unordered_map>
#include <random>
#include <algorithm>
#include <limits>

namespace {
    SolverRegistrar<GA> registrar("ga");
}

struct GAParams {
    int population_size = 50;
    int generations = 1000;
    double crossover_rate = 0.8;
    double mutation_rate = 0.2;
    double p = 0.5; // for type-III locker assignment
};

// Helper: initialize the initial solution for GA (same as SA)
static void initialize_solution(const VRPInstance& instance, std::vector<int>& customer_perm, std::unordered_map<int, int>& customer2node, double p = 0.5) {
    int n = instance.num_customers;
    customer_perm.clear();
    customer2node.clear();
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<> prob(0.0, 1.0);
    std::vector<int> assigned_delivery_node(n, -1);
    for (int i = 0; i < n; ++i) {
        auto c = instance.customers[i];
        if (c->customer_type == 1) {
            assigned_delivery_node[i] = c->id;
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
                assigned_delivery_node[i] = assigned;
            } else if (!instance.lockers.empty()) {
                assigned_delivery_node[i] = instance.lockers[0]->id;
            } else {
                assigned_delivery_node[i] = c->id;
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
                    assigned_delivery_node[i] = assigned;
                } else if (!instance.lockers.empty()) {
                    assigned_delivery_node[i] = instance.lockers[0]->id;
                } else {
                    assigned_delivery_node[i] = c->id;
                }
            } else {
                assigned_delivery_node[i] = c->id;
            }
        }
        customer2node[c->id] = assigned_delivery_node[i];
    }
    std::vector<bool> assigned(n, false);
    int current_node = 0;
    for (int step = 0; step < n; ++step) {
        double min_dist = std::numeric_limits<double>::max();
        int next_customer = -1;
        for (int i = 0; i < n; ++i) {
            if (assigned[i]) continue;
            int delivery_node = assigned_delivery_node[i];
            double dist = instance.distance_matrix[current_node][delivery_node];
            if (dist < min_dist) {
                min_dist = dist;
                next_customer = i;
            }
        }
        if (next_customer == -1) break;
        assigned[next_customer] = true;
        customer_perm.push_back(next_customer + 1);
        current_node = assigned_delivery_node[next_customer];
    }
}

// --- Helper: Generate a random permutation of customer IDs (1-based) ---
static std::vector<int> random_permutation(int n, std::mt19937& gen) {
    std::vector<int> perm(n);
    for (int i = 0; i < n; ++i) perm[i] = i + 1;
    std::shuffle(perm.begin(), perm.end(), gen);
    return perm;
}

// --- Helper: Mutation (swap, insert, invert) ---
static void mutate(std::vector<int>& perm, std::mt19937& gen) {
    int n = perm.size();
    std::uniform_real_distribution<> prob(0.0, 1.0);
    double r = prob(gen);
    if (r < 1.0/3) {
        int i = gen() % n, j = gen() % n;
        if (i != j) std::swap(perm[i], perm[j]);
    } else if (r < 2.0/3) {
        int i = gen() % n, j = gen() % n;
        if (i != j) {
            int val = perm[i];
            perm.erase(perm.begin() + i);
            perm.insert(perm.begin() + j, val);
        }
    } else {
        int i = gen() % n, j = gen() % n;
        if (i > j) std::swap(i, j);
        if (i != j) std::reverse(perm.begin() + i, perm.begin() + j + 1);
    }
}

// --- Helper: Order Crossover (OX) for permutations ---
static std::vector<int> order_crossover(const std::vector<int>& p1, const std::vector<int>& p2, std::mt19937& gen) {
    int n = p1.size();
    std::vector<int> child(n, -1);
    std::uniform_int_distribution<> dist(0, n - 1);
    int a = dist(gen), b = dist(gen);
    if (a > b) std::swap(a, b);
    // Copy a slice from p1
    for (int i = a; i <= b; ++i) child[i] = p1[i];
    // Fill from p2
    int idx = (b + 1) % n, p2_idx = (b + 1) % n;
    while (std::count(child.begin(), child.end(), -1) > 0) {
        if (std::find(child.begin(), child.end(), p2[p2_idx]) == child.end()) {
            child[idx] = p2[p2_idx];
            idx = (idx + 1) % n;
        }
        p2_idx = (p2_idx + 1) % n;
    }
    return child;
}

// --- Helper: Tournament selection ---
static int tournament(const std::vector<double>& fitness, std::mt19937& gen) {
    int n = fitness.size();
    std::uniform_int_distribution<> dist(0, n - 1);
    int i = dist(gen), j = dist(gen);
    return (fitness[i] < fitness[j]) ? i : j;
}

static Solution iterate(const VRPInstance& instance, std::vector<int> customer_perm, std::unordered_map<int, int> customer2node, const GAParams& params) {
    int n = customer_perm.size();
    int pop_size = params.population_size;
    int generations = params.generations;
    double crossover_rate = params.crossover_rate;
    double mutation_rate = params.mutation_rate;
    std::random_device rd;
    std::mt19937 gen(rd());
    // --- Initialize population ---
    std::vector<std::vector<int>> population(pop_size);
    for (int i = 0; i < pop_size; ++i) {
        population[i] = random_permutation(n, gen);
    }
    // --- Evaluate initial population ---
    std::vector<Solution> solutions(pop_size);
    std::vector<double> fitness(pop_size);
    for (int i = 0; i < pop_size; ++i) {
        solutions[i] = Solver::evaluate(instance, population[i], customer2node);
        fitness[i] = solutions[i].objective_value;
    }
    Solution best_sol = solutions[0];
    for (int i = 1; i < pop_size; ++i) {
        if (solutions[i].objective_value < best_sol.objective_value) best_sol = solutions[i];
    }
    // --- Main GA loop ---
    for (int gen_idx = 0; gen_idx < generations; ++gen_idx) {
        std::vector<std::vector<int>> new_population;
        while ((int)new_population.size() < pop_size) {
            // Selection
            int p1_idx = tournament(fitness, gen);
            int p2_idx = tournament(fitness, gen);
            std::vector<int> child = population[p1_idx];
            // Crossover
            std::uniform_real_distribution<> prob(0.0, 1.0);
            if (prob(gen) < crossover_rate) {
                child = order_crossover(population[p1_idx], population[p2_idx], gen);
            }
            // Mutation
            if (prob(gen) < mutation_rate) {
                mutate(child, gen);
            }
            new_population.push_back(child);
        }
        // Evaluate new population
        for (int i = 0; i < pop_size; ++i) {
            solutions[i] = Solver::evaluate(instance, new_population[i], customer2node);
            fitness[i] = solutions[i].objective_value;
            if (solutions[i].objective_value < best_sol.objective_value) best_sol = solutions[i];
        }
        population = std::move(new_population);
    }
    return best_sol;
}

Solution GA::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    GAParams params;
    params.population_size = params_node["population_size"].as<int>();
    params.generations = params_node["generations"].as<int>();
    params.crossover_rate = params_node["crossover_rate"].as<double>();
    params.mutation_rate = params_node["mutation_rate"].as<double>();
    params.p = params_node["p"].as<double>();

    int n = instance.num_customers;
    std::vector<int> customer_perm;
    std::unordered_map<int, int> customer2node;
    initialize_solution(instance, customer_perm, customer2node, params.p);
    return iterate(instance, customer_perm, customer2node, params);
}
