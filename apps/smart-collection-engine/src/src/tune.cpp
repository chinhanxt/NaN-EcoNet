#include "core/InstanceParser.h"
#include "solvers/Solver.h"
#include "solvers/SA.h"      // Include SA solver
#include "solvers/GA.h"      // Include GA solver
#include "solvers/ACO_TS.h"  // Include ACO-TS solver
#include "solvers/PACO.h"    // Include PACO solver
#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <variant>
#include <random>
#include <chrono>
#include <numeric>
#include <limits>
#include <filesystem>
#include <fstream>
#include <yaml-cpp/yaml.h>
#include <algorithm> // For std::shuffle, std::min_element
#include <stdexcept> // For std::runtime_error

// --- Type Definitions ---
using ParamValue = std::variant<int, double>;
using Configuration = std::map<std::string, ParamValue>;

struct ParamDef {
    std::string type; // "int" or "float"
    ParamValue min_val;
    ParamValue max_val;
    ParamValue default_val;
    ParamValue step; // Used for generating neighbors
};
using ParamSpace = std::map<std::string, ParamDef>;

// --- Forward Declarations ---
ParamSpace load_param_space(const std::string& filename);
Configuration get_default_configuration(const ParamSpace& space);
Configuration get_random_configuration(const ParamSpace& space, std::mt19937& rng);
std::vector<Configuration> get_neighbors(const Configuration& config, const ParamSpace& space, std::mt19937& rng, int count = -1);
Configuration perturb_configuration(const Configuration& config, const ParamSpace& space, int perturbation_strength, std::mt19937& rng);
Solution run_solver_with_config(const std::string& solver_name, const VRPInstance& instance, const Configuration& config);
double evaluate_configuration(const std::string& solver_name, const Configuration& config, const std::vector<std::string>& instance_files, int num_runs_per_instance, double time_penalty_factor);
Configuration paramils(
    const std::string& solver_name,
    const ParamSpace& space,
    const std::vector<std::string>& instance_files,
    int max_evaluations, // Termination criterion
    int num_runs_per_instance,
    int R, // Initial random trials
    int s, // Perturbations per iteration
    double p_restart, // Restart probability
    double time_penalty_factor,
    int verbose_level, // Add verbose level
    const std::string& output_file // File to save best config immediately
);
void save_configuration(const std::string& filename, const std::string& solver_name, const Configuration& config);

// --- Function Implementations ---

// Load parameter space definition from YAML
ParamSpace load_param_space(const std::string& filename) {
    ParamSpace space;
    YAML::Node config = YAML::LoadFile(filename);
    if (!config["parameters"]) {
        throw std::runtime_error("YAML file missing 'parameters' key: " + filename);
    }
    for (const auto& param_node : config["parameters"]) {
        std::string name = param_node.first.as<std::string>();
        ParamDef def;
        def.type = param_node.second["type"].as<std::string>();
        if (def.type == "int") {
            def.min_val = param_node.second["range"][0].as<int>();
            def.max_val = param_node.second["range"][1].as<int>();
            def.default_val = param_node.second["default"].as<int>();
            def.step = param_node.second["step"].as<int>();
        } else if (def.type == "float") {
            def.min_val = param_node.second["range"][0].as<double>();
            def.max_val = param_node.second["range"][1].as<double>();
            def.default_val = param_node.second["default"].as<double>();
            def.step = param_node.second["step"].as<double>();
        } else {
            throw std::runtime_error("Unsupported parameter type: " + def.type + " for parameter " + name);
        }
        space[name] = def;
    }
    return space;
}

// Get the default configuration from the parameter space
Configuration get_default_configuration(const ParamSpace& space) {
    Configuration config;
    for (const auto& pair : space) {
        config[pair.first] = pair.second.default_val;
    }
    return config;
}

// Generate a random configuration within the defined ranges
Configuration get_random_configuration(const ParamSpace& space, std::mt19937& rng) {
    Configuration config;
    for (const auto& pair : space) {
        const ParamDef& def = pair.second;
        if (def.type == "int") {
            std::uniform_int_distribution<> dist(std::get<int>(def.min_val), std::get<int>(def.max_val));
            config[pair.first] = dist(rng);
        } else { // float
            std::uniform_real_distribution<> dist(std::get<double>(def.min_val), std::get<double>(def.max_val));
            config[pair.first] = dist(rng);
        }
    }
    return config;
}

// Helper to clamp value within range
template <typename T>
T clamp(T val, T min_val, T max_val) {
    return std::max(min_val, std::min(val, max_val));
}

// Generate neighboring configurations for local search (one-parameter changes using step)
std::vector<Configuration> get_neighbors(const Configuration& config, const ParamSpace& space, std::mt19937& rng, int count) {
    std::vector<Configuration> neighbors;
    std::vector<std::string> param_names;
    for(const auto& pair : config) param_names.push_back(pair.first);

    for (const auto& name : param_names) {
        const ParamDef& def = space.at(name);
        Configuration neighbor_up = config;
        Configuration neighbor_down = config;

        if (def.type == "int") {
            int current_val = std::get<int>(config.at(name));
            int step = std::get<int>(def.step);
            int min_val = std::get<int>(def.min_val);
            int max_val = std::get<int>(def.max_val);

            neighbor_up[name] = clamp(current_val + step, min_val, max_val);
            neighbor_down[name] = clamp(current_val - step, min_val, max_val);
        } else { // float
            double current_val = std::get<double>(config.at(name));
            double step = std::get<double>(def.step);
            double min_val = std::get<double>(def.min_val);
            double max_val = std::get<double>(def.max_val);

            neighbor_up[name] = clamp(current_val + step, min_val, max_val);
            neighbor_down[name] = clamp(current_val - step, min_val, max_val);
        }

        if (neighbor_up != config) neighbors.push_back(neighbor_up);
        if (neighbor_down != config) neighbors.push_back(neighbor_down);
    }
    // Add a random neighbor as well to increase diversity slightly
    neighbors.push_back(get_random_configuration(space, rng));
    if (count > 0 && !neighbors.empty()) {
        std::shuffle(neighbors.begin(), neighbors.end(), rng);
        if (neighbors.size() > count) {
            neighbors.resize(count); // Return only 'count' random neighbors
        }
    }
    return neighbors;
}

// Apply perturbation (larger random changes to multiple parameters)
Configuration perturb_configuration(const Configuration& config, const ParamSpace& space, int perturbation_strength, std::mt19937& rng) {
    Configuration perturbed_config = config;
    std::vector<std::string> param_names;
    for(const auto& pair : config) param_names.push_back(pair.first);
    std::shuffle(param_names.begin(), param_names.end(), rng);

    int params_to_change = std::min((int)param_names.size(), perturbation_strength);

    for (int i = 0; i < params_to_change; ++i) {
        const std::string& name = param_names[i];
        const ParamDef& def = space.at(name);
        if (def.type == "int") {
            std::uniform_int_distribution<> dist(std::get<int>(def.min_val), std::get<int>(def.max_val));
            perturbed_config[name] = dist(rng);
        } else { // float
            std::uniform_real_distribution<> dist(std::get<double>(def.min_val), std::get<double>(def.max_val));
            perturbed_config[name] = dist(rng);
        }
    }
    return perturbed_config;
}

// Run the target solver with a specific configuration
Solution run_solver_with_config(const std::string& solver_name, const VRPInstance& instance, const Configuration& config) {
    Solution sol;
    try {
        if (solver_name == "sa") {
            SAParams params;
            params.max_iter = std::get<int>(config.at("max_iter"));
            params.T0 = std::get<double>(config.at("T0"));
            params.Tf = std::get<double>(config.at("Tf"));
            params.alpha = std::get<double>(config.at("alpha"));
            params.beta = std::get<double>(config.at("beta"));
            params.patience = std::get<int>(config.at("patience"));
            params.p = std::get<double>(config.at("p"));
            sol = SA::solve(instance, params);
        } else if (solver_name == "ga") {
            GAParams params;
            params.population_size = std::get<int>(config.at("population_size"));
            params.generations = std::get<int>(config.at("generations"));
            params.crossover_rate = std::get<double>(config.at("crossover_rate"));
            params.mutation_rate = std::get<double>(config.at("mutation_rate"));
            params.p = std::get<double>(config.at("p"));
            sol = GA::solve(instance, params);
        } else if (solver_name == "aco-ts") {
            ACOTSParams params;
            params.num_ants = std::get<int>(config.at("num_ants"));
            params.num_iterations = std::get<int>(config.at("num_iterations"));
            params.alpha = std::get<double>(config.at("alpha"));
            params.beta = std::get<double>(config.at("beta"));
            params.rho = std::get<double>(config.at("evaporation_rate")); // Note: name mismatch
            params.Q = std::get<double>(config.at("Q"));
            params.p = std::get<double>(config.at("p"));
            params.stagnation_limit = std::get<int>(config.at("stagnation_limit"));
            sol = ACO_TS::solve(instance, params);
        } else if (solver_name == "paco") {
            PACOParams params;
            params.m = std::get<int>(config.at("m"));
            params.alpha = std::get<double>(config.at("alpha"));
            params.beta = std::get<double>(config.at("beta"));
            params.rho = std::get<double>(config.at("rho"));
            params.Q = std::get<double>(config.at("Q"));
            params.I = std::get<int>(config.at("I"));
            params.t = std::get<int>(config.at("t"));
            params.p = std::get<int>(config.at("p"));
            sol = PACO::solve(instance, params);
        } else {
            std::cerr << "Error: Unknown solver name '" << solver_name << "' in run_solver_with_config" << std::endl;
            sol.objective_value = std::numeric_limits<double>::max(); // Indicate error/infeasibility
        }
    } catch (const std::out_of_range& oor) {
         std::cerr << "Error: Missing parameter in configuration for solver '" << solver_name << "'. Details: " << oor.what() << std::endl;
         sol.objective_value = std::numeric_limits<double>::max();
    } catch (const std::bad_variant_access& bva) {
         std::cerr << "Error: Parameter type mismatch for solver '" << solver_name << "'. Details: " << bva.what() << std::endl;
         sol.objective_value = std::numeric_limits<double>::max();
    }

    // Handle infeasible solutions reported by the solver
    if (sol.routes.empty() && sol.objective_value < std::numeric_limits<double>::max() / 2.0) { // Check if solver didn't already set a high value
        sol.objective_value = std::numeric_limits<double>::max();
    }

    return sol;
}

// Evaluate a configuration on a set of instances
// Returns a performance score (lower is better). Combines quality and runtime.
double evaluate_configuration(const std::string& solver_name, const Configuration& config, const std::vector<std::string>& instance_files, int num_runs_per_instance, double time_penalty_factor = 0.01) {
    double total_avg_objective = 0.0;
    double total_avg_runtime = 0.0;
    int feasible_instances = 0;

    for (const auto& instance_file : instance_files) {
        std::vector<double> objectives;
        std::vector<double> runtimes;
        bool instance_feasible_at_least_once = false;

        VRPInstance instance;
        try {
            instance = InstanceParser::parse(instance_file);
            instance.build_distance_matrix();
        } catch (const std::exception& e) {
            std::cerr << "Warning: Failed to parse instance " << instance_file << ": " << e.what() << std::endl;
            continue; // Skip this instance
        }

        for (int run = 0; run < num_runs_per_instance; ++run) {
            auto start = std::chrono::high_resolution_clock::now();
            Solution sol = run_solver_with_config(solver_name, instance, config);
            auto end = std::chrono::high_resolution_clock::now();
            double runtime = std::chrono::duration<double>(end - start).count();

            runtimes.push_back(runtime);
            if (sol.objective_value < std::numeric_limits<double>::max()) {
                objectives.push_back(sol.objective_value);
                instance_feasible_at_least_once = true;
            } else {
                objectives.push_back(std::numeric_limits<double>::max()); // Keep max value for infeasible runs
            }
        }

        if (instance_feasible_at_least_once) {
            double avg_obj = 0;
            int feasible_runs = 0;
            for(double obj : objectives) {
                if (obj < std::numeric_limits<double>::max()) {
                    avg_obj += obj;
                    feasible_runs++;
                }
            }
             // Average objective over feasible runs, or max if none were feasible
            avg_obj = (feasible_runs > 0) ? (avg_obj / feasible_runs) : std::numeric_limits<double>::max();

            double avg_rt = std::accumulate(runtimes.begin(), runtimes.end(), 0.0) / runtimes.size();

            total_avg_objective += avg_obj;
            total_avg_runtime += avg_rt;
            feasible_instances++;
        } else {
             // If no run was feasible for this instance, add max objective and average runtime
             total_avg_objective += std::numeric_limits<double>::max();
             total_avg_runtime += std::accumulate(runtimes.begin(), runtimes.end(), 0.0) / runtimes.size();
             // feasible_instances is not incremented
        }
    }

    if (feasible_instances == 0) {
        return std::numeric_limits<double>::max(); // No instance could be solved feasibly
    }

    // Average over the instances where at least one run was feasible
    double final_avg_objective = total_avg_objective / feasible_instances;
    double final_avg_runtime = total_avg_runtime / instance_files.size(); // Average runtime over all attempted instances

    // Combine objective and runtime penalty
    double performance_score = final_avg_objective + time_penalty_factor * final_avg_runtime;

    // Handle potential overflow if many instances were infeasible
    if (performance_score >= std::numeric_limits<double>::max()) {
        return std::numeric_limits<double>::max();
    }

    return performance_score;
}

// Helper function to compare configurations based on score (lower is better)
bool better(double score1, double score2) {
    // Handle cases where one or both scores are infinity (infeasible)
    const double infinity = std::numeric_limits<double>::max(); // Use const instead of constexpr
    if (score1 == infinity && score2 == infinity) return false; // Neither is better
    if (score1 == infinity) return false;
    if (score2 == infinity) return true;
    return score1 < score2;
}

// --- Iterative First Improvement ---
Configuration iterative_first_improvement(
    const std::string& solver_name,
    Configuration current_config,
    double& current_score,
    const ParamSpace& space,
    const std::vector<std::string>& instance_files,
    int num_runs_per_instance,
    double time_penalty_factor,
    std::mt19937& rng,
    int& evaluations_count,
    int max_evaluations,
    int verbose_level // Add verbose level
) {
    bool improved = true;
    while (improved && evaluations_count < max_evaluations) {
        improved = false;
        std::vector<Configuration> neighbors = get_neighbors(current_config, space, rng);
        std::shuffle(neighbors.begin(), neighbors.end(), rng);

        if (verbose_level >= 2) {
            std::cout << "  IFI: Starting neighborhood search (size " << neighbors.size() << ") from score " << current_score << " (Evals: " << evaluations_count << "/" << max_evaluations << ")" << std::endl;
        }

        for (const auto& neighbor : neighbors) {
            if (evaluations_count >= max_evaluations) break;
            if (neighbor == current_config) continue;

            if (verbose_level >= 3) {
                std::cout << "    IFI: Evaluating neighbor..." << std::endl;
            }
            double neighbor_score = evaluate_configuration(solver_name, neighbor, instance_files, num_runs_per_instance, time_penalty_factor);
            evaluations_count++;
            if (verbose_level >= 3) {
                 std::cout << "    IFI: Neighbor score: " << neighbor_score << " (Eval " << evaluations_count << ")" << std::endl;
            }

            if (better(neighbor_score, current_score)) {
                if (verbose_level >= 2) {
                    std::cout << "    IFI: Found improving neighbor (" << current_score << " -> " << neighbor_score << "). Moving." << std::endl;
                }
                current_config = neighbor;
                current_score = neighbor_score;
                improved = true;
                break;
            }
        }
         if (!improved && verbose_level >= 2) {
             std::cout << "  IFI: No improving neighbor found. Local optimum reached at score " << current_score << std::endl;
         }
    }
     if (evaluations_count >= max_evaluations && verbose_level >= 1) {
        std::cout << "  IFI: Evaluation budget reached during IFI." << std::endl;
    }
    return current_config;
}

// --- ParamILS Main Logic ---
Configuration paramils(
    const std::string& solver_name,
    const ParamSpace& space,
    const std::vector<std::string>& instance_files,
    int max_evaluations,
    int num_runs_per_instance,
    int R,
    int s,
    double p_restart,
    double time_penalty_factor,
    int verbose_level, // Add verbose level
    const std::string& output_file // File to save best config immediately
) {
    std::random_device rd;
    std::mt19937 rng(rd());
    std::uniform_real_distribution<> restart_dist(0.0, 1.0);

    int evaluations_count = 0;

    Configuration c0_config = get_default_configuration(space);
    if (verbose_level >= 1) std::cout << "Evaluating default configuration..." << std::endl;
    double c0_score = evaluate_configuration(solver_name, c0_config, instance_files, num_runs_per_instance, time_penalty_factor);
    evaluations_count++;
    if (verbose_level >= 1) std::cout << "Default Config Score: " << c0_score << " (Eval " << evaluations_count << "/" << max_evaluations << ")" << std::endl;

    Configuration overall_best_config = c0_config;
    double overall_best_score = c0_score;

    if (verbose_level >= 1) std::cout << "\n--- Starting Initial Random Trials (R=" << R << ") ---" << std::endl;
    for (int i = 0; i < R && evaluations_count < max_evaluations; ++i) {
        Configuration c_rand = get_random_configuration(space, rng);
        if (verbose_level >= 2) std::cout << "  Trial " << (i + 1) << "/" << R << ": Evaluating random config..." << std::endl;
        double c_rand_score = evaluate_configuration(solver_name, c_rand, instance_files, num_runs_per_instance, time_penalty_factor);
        evaluations_count++;
        if (verbose_level >= 2) std::cout << "  Random Config Score: " << c_rand_score << " (Eval " << evaluations_count << ")" << std::endl;
        if (better(c_rand_score, c0_score)) {
            if (verbose_level >= 1) std::cout << "  Found better initial config (" << c0_score << " -> " << c_rand_score << ") (Eval " << evaluations_count << ")" << std::endl;
            c0_config = c_rand;
            c0_score = c_rand_score;
            if (better(c0_score, overall_best_score)) {
                overall_best_config = c0_config;
                overall_best_score = c0_score;
                save_configuration(output_file, solver_name, overall_best_config);
                if (verbose_level >= 1) std::cout << "  Exported new overall best to " << output_file << std::endl;
            }
        }
    }
    if (evaluations_count >= max_evaluations && verbose_level >= 1) {
        std::cout << "Evaluation budget reached during initial random trials." << std::endl;
        return overall_best_config;
    }

    if (verbose_level >= 1) std::cout << "\n--- Starting Initial Iterative First Improvement --- (Current best score: " << c0_score << ")" << std::endl;
    Configuration c_ils_config = iterative_first_improvement(solver_name, c0_config, c0_score, space, instance_files, num_runs_per_instance, time_penalty_factor, rng, evaluations_count, max_evaluations, verbose_level);
    double c_ils_score = c0_score;
    if (verbose_level >= 1) std::cout << "Initial IFI finished. Best score: " << c_ils_score << " (Evals: " << evaluations_count << "/" << max_evaluations << ")" << std::endl;

    if (better(c_ils_score, overall_best_score)) {
        if (verbose_level >= 1) std::cout << "Initial IFI improved overall best (" << overall_best_score << " -> " << c_ils_score << ")" << std::endl;
        overall_best_config = c_ils_config;
        overall_best_score = c_ils_score;
        save_configuration(output_file, solver_name, overall_best_config);
        if (verbose_level >= 1) std::cout << "Exported new overall best to " << output_file << std::endl;
    }

    if (verbose_level >= 1) std::cout << "\n--- Starting ParamILS Main Loop (Max Evals: " << max_evaluations << ") ---" << std::endl;
    int iteration = 0;
    while (evaluations_count < max_evaluations) {
        iteration++;
        if (verbose_level >= 1) std::cout << "\nIteration " << iteration << " (Current ILS best: " << c_ils_score << ", Overall best: " << overall_best_score << ", Evals: " << evaluations_count << "/" << max_evaluations << ")" << std::endl;

        Configuration c_current_config = c_ils_config;

        if (verbose_level >= 2) std::cout << "  Perturbing s=" << s << " times..." << std::endl;
        Configuration c_perturbed_config = c_current_config;
        for (int i = 0; i < s; ++i) {
            std::vector<Configuration> one_neighbor_vec = get_neighbors(c_perturbed_config, space, rng, 1);
            if (!one_neighbor_vec.empty()) {
                c_perturbed_config = one_neighbor_vec[0];
                if (verbose_level >= 3) std::cout << "    Perturbation " << (i+1) << "/" << s << ": Moved to a neighbor." << std::endl;
            } else {
                if (verbose_level >= 3) std::cout << "    Perturbation " << (i+1) << "/" << s << ": No neighbor found, trying random." << std::endl;
                c_perturbed_config = get_random_configuration(space, rng);
            }
        }
        if (verbose_level >= 2) std::cout << "  Evaluating final perturbed config before IFI..." << std::endl;
        double c_perturbed_score = evaluate_configuration(solver_name, c_perturbed_config, instance_files, num_runs_per_instance, time_penalty_factor);
        evaluations_count++;
        if (verbose_level >= 2) std::cout << "  Perturbed Config Score: " << c_perturbed_score << " (Eval " << evaluations_count << ")" << std::endl;

        if (evaluations_count >= max_evaluations) break;

        if (verbose_level >= 2) std::cout << "  Applying Iterative First Improvement to perturbed config..." << std::endl;
        Configuration c_double_prime_config = iterative_first_improvement(solver_name, c_perturbed_config, c_perturbed_score, space, instance_files, num_runs_per_instance, time_penalty_factor, rng, evaluations_count, max_evaluations, verbose_level);
        double c_double_prime_score = c_perturbed_score;
        if (verbose_level >= 2) std::cout << "  IFI on perturbed finished. Score: " << c_double_prime_score << " (Evals: " << evaluations_count << "/" << max_evaluations << ")" << std::endl;

        if (evaluations_count >= max_evaluations) break;

        if (better(c_double_prime_score, c_ils_score)) {
            if (verbose_level >= 1) std::cout << "  Acceptance: New ILS best found (" << c_ils_score << " -> " << c_double_prime_score << ")" << std::endl;
            c_ils_config = c_double_prime_config;
            c_ils_score = c_double_prime_score;

            if (better(c_ils_score, overall_best_score)) {
                if (verbose_level >= 1) std::cout << "  *** New overall best found! ***" << std::endl;
                overall_best_config = c_ils_config;
                overall_best_score = c_ils_score;
                save_configuration(output_file, solver_name, overall_best_config);
                if (verbose_level >= 1) std::cout << "  Exported new overall best to " << output_file << std::endl;
            }
        } else {
             if (verbose_level >= 2) std::cout << "  Acceptance: Did not improve ILS best (" << c_double_prime_score << " vs " << c_ils_score << ")" << std::endl;
        }

        if (restart_dist(rng) < p_restart) {
            if (verbose_level >= 1) std::cout << "  Restart triggered (p=" << p_restart << ")!" << std::endl;
            Configuration c_rand_restart = get_random_configuration(space, rng);
            if (verbose_level >= 2) std::cout << "    Evaluating random restart config..." << std::endl;
            double c_rand_restart_score = evaluate_configuration(solver_name, c_rand_restart, instance_files, num_runs_per_instance, time_penalty_factor);
            evaluations_count++;
             if (verbose_level >= 2) std::cout << "    Random Restart Config Score: " << c_rand_restart_score << " (Eval " << evaluations_count << ")" << std::endl;

             if (evaluations_count >= max_evaluations) break;

            if (verbose_level >= 2) std::cout << "    Applying IFI to restart config..." << std::endl;
            c_ils_config = iterative_first_improvement(solver_name, c_rand_restart, c_rand_restart_score, space, instance_files, num_runs_per_instance, time_penalty_factor, rng, evaluations_count, max_evaluations, verbose_level);
            c_ils_score = c_rand_restart_score;
            if (verbose_level >= 1) std::cout << "    IFI after restart finished. New ILS score: " << c_ils_score << " (Evals: " << evaluations_count << "/" << max_evaluations << ")" << std::endl;

            if (better(c_ils_score, overall_best_score)) {
                 if (verbose_level >= 1) std::cout << "    *** Restart resulted in new overall best! ***" << std::endl;
                overall_best_config = c_ils_config;
                overall_best_score = c_ils_score;
                save_configuration(output_file, solver_name, overall_best_config);
                if (verbose_level >= 1) std::cout << "    Exported new overall best to " << output_file << std::endl;
            }
             if (evaluations_count >= max_evaluations) break;
        }
    }

    if (verbose_level >= 1) {
        std::cout << "\n--- ParamILS Finished ---" << std::endl;
        std::cout << "Total Evaluations: " << evaluations_count << std::endl;
        std::cout << "Overall Best Score: " << overall_best_score << std::endl;
        std::cout << "Overall Best Configuration:" << std::endl;
        for(const auto& pair : overall_best_config) {
            std::cout << "  " << pair.first << ": ";
            std::visit([](auto&& arg){ std::cout << arg; }, pair.second);
            std::cout << std::endl;
        }
    }

    return overall_best_config;
}

// Helper function to save configuration to YAML
void save_configuration(const std::string& filename, const std::string& solver_name, const Configuration& config) {
    YAML::Emitter out;
    out << YAML::BeginMap;
    out << YAML::Key << solver_name;
    out << YAML::Value << YAML::BeginMap;
    for (const auto& pair : config) {
        out << YAML::Key << pair.first;
        out << YAML::Value;
        std::visit([&out](auto&& arg) {
            out << arg;
        }, pair.second);
    }
    out << YAML::EndMap;
    out << YAML::EndMap;

    std::ofstream fout(filename);
    if (!fout.is_open()) {
        std::cerr << "Error: Could not open file for saving configuration: " << filename << std::endl;
        return;
    }
    fout << out.c_str();
    fout.close();
    std::cout << "Saved best configuration to: " << filename << std::endl;
}

// --- Main Function ---
int main(int argc, char* argv[]) {
    if (argc < 5) {
        std::cerr << "Usage: ./tune --solver <name> --params <param_file.yaml> --instances <dir> [--max-evals <int>] [--runs-per-instance <int>] [--R <int>] [--s <int>] [--p-restart <float>] [--penalty <float>] [--output <output_file.yaml>] [--verbose <level> | -v <level>]" << std::endl;
        return 1;
    }

    std::string solver_name;
    std::string param_file;
    std::string instance_dir;
    int max_evaluations = 50; // Default changed to 50
    int num_runs_per_instance = 1;
    int R = 10; // Default set to 10
    int s = 3; // Default set to 3
    double p_restart = 0.01; // Default set to 0.01
    double time_penalty_factor = 10.0; // Default kept at 10.0
    std::string output_file = "../output/tuning/tuned_params.yaml"; // Default output path updated
    int verbose_level = 1; // Default verbose level set to 1

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--solver" && i + 1 < argc) {
            solver_name = argv[++i];
        } else if (arg == "--params" && i + 1 < argc) {
            param_file = argv[++i];
        } else if (arg == "--instances" && i + 1 < argc) {
            instance_dir = argv[++i];
        } else if (arg == "--max-evals" && i + 1 < argc) {
            max_evaluations = std::stoi(argv[++i]);
        } else if (arg == "--runs-per-instance" && i + 1 < argc) {
            num_runs_per_instance = std::stoi(argv[++i]);
        } else if (arg == "--R" && i + 1 < argc) {
            R = std::stoi(argv[++i]);
        } else if (arg == "--s" && i + 1 < argc) {
            s = std::stoi(argv[++i]);
        } else if (arg == "--p-restart" && i + 1 < argc) {
            p_restart = std::stod(argv[++i]);
        } else if (arg == "--penalty" && i + 1 < argc) {
            time_penalty_factor = std::stod(argv[++i]);
        } else if (arg == "--output" && i + 1 < argc) {
            output_file = argv[++i]; // Allow overriding default output file
        } else if (arg == "--verbose" || arg == "-v") {
            if (i + 1 < argc && argv[i+1][0] != '-') { // Check if next arg is a value and not another option
                try {
                    verbose_level = std::stoi(argv[++i]);
                } catch (const std::invalid_argument& ia) {
                    std::cerr << "Error: Invalid value for --verbose: " << argv[i] << std::endl;
                    return 1;
                } catch (const std::out_of_range& oor) {
                    std::cerr << "Error: Value out of range for --verbose: " << argv[i] << std::endl;
                    return 1;
                }
            } else {
                // If just --verbose or -v is given without a number, or next arg is another option
                verbose_level = 1; // Set to default verbose level 1
            }
        } else {
            std::cerr << "Usage: " << argv[0]
                      << " --solver <name> --params <param_file.yaml> --instances <dir>"
                      << " [--max-evals <int>] [--runs-per-instance <int>]"
                      << " [--R <int>] [--s <int>] [--p-restart <float>]"
                      << " [--penalty <float>] [--output <output_file.yaml>]"
                      << " [--verbose <level> | -v <level>]" << std::endl;
            return 1;
        }
    }

    if (solver_name.empty() || param_file.empty() || instance_dir.empty()) {
        std::cerr << "Error: --solver, --params, and --instances are required." << std::endl;
        return 1;
    }

    ParamSpace space = load_param_space(param_file);
    std::vector<std::string> instance_files;
    for (const auto& entry : std::filesystem::directory_iterator(instance_dir)) {
        if (entry.is_regular_file() && entry.path().extension() == ".txt") {
            instance_files.push_back(entry.path().string());
        }
    }
    if (instance_files.empty()) {
        std::cerr << "Error: No instance files found in " << instance_dir << std::endl;
        return 1;
    }

    Configuration best_config = paramils(
        solver_name,
        space,
        instance_files,
        max_evaluations,
        num_runs_per_instance,
        R,
        s,
        p_restart,
        time_penalty_factor,
        verbose_level, // Pass verbose level
        output_file // For immediate export
    );

    // Ensure the output directory exists
    std::filesystem::path out_path(output_file);
    if (out_path.has_parent_path()) {
        try {
            std::filesystem::create_directories(out_path.parent_path());
        } catch (const std::filesystem::filesystem_error& e) {
            std::cerr << "Warning: Could not create output directory " << out_path.parent_path() << ": " << e.what() << std::endl;
            // Proceed anyway, maybe the directory exists or save will fail gracefully
        }
    }
    save_configuration(output_file, solver_name, best_config); // Pass solver_name
    std::cout << "\nBest configuration saved to " << output_file << std::endl;

    return 0;
}
