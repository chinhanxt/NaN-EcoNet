#include "core/InstanceParser.h"
#include "solvers/Solver.h"
#include "core/SolverFactory.h"
#include <iostream>
#include <yaml-cpp/yaml.h>
#include <fstream>
#include <chrono>
#include <filesystem>
#include <algorithm>
#include <cmath>
#include <memory>

struct ExperimentParams {
    std::string solver_name;
    std::string exp_size;
    std::string instance_file;
    std::string output_csv;
    int num_runs;
    std::string data_dir;
    YAML::Node params_node; // A single node to hold solver-specific params
    int verbose = 0;
    bool full_solution = false; // Output full solution as JSON
};

ExperimentParams parse_params(int argc, char* argv[]) {
    ExperimentParams params;
    params.exp_size = "small";
    params.num_runs = 1;
    std::string params_yaml_file = "";

    for (int i = 1; i < argc; ++i) {
        std::string key = argv[i];
        if (key == "--solver" && i + 1 < argc) {
            params.solver_name = argv[++i];
        } else if ((key == "--size" || key == "--exp-size") && i + 1 < argc) {
            params.exp_size = argv[++i];
        } else if (key == "--params" && i + 1 < argc) {
            params_yaml_file = argv[++i];
        } else if (key == "--instances" && i + 1 < argc) {
            params.data_dir = argv[++i];
        } else if (key == "--num-runs" && i + 1 < argc) {
            params.num_runs = std::stoi(argv[++i]);
        } else if (key == "--output" && i + 1 < argc) {
            params.output_csv = argv[++i];
        } else if (key == "--instance-file" && i + 1 < argc) {
            params.instance_file = argv[++i];
        } else if ((key == "--verbose" || key == "-v") && i + 1 < argc) {
            params.verbose = std::stoi(argv[++i]);
        } else if (key == "--full-solution") {
            params.full_solution = true;
        }
    }

    if (params.solver_name.empty()) {
        std::cerr << "Usage: ./test --solver <name> [--params <file.yaml>] [--instances <dir>] [--num-runs <int>] [--output <file.csv>] [--size <size>] [--instance-file <file>] [-v <level>] [--full-solution]" << std::endl;
        exit(1);
    }

    if (params_yaml_file.empty()) {
        // Default params file based on solver name, e.g., "sa.param.yaml"
        params_yaml_file = params.solver_name + ".param.yaml";
    }

    YAML::Node config = YAML::LoadFile(params_yaml_file);
    if (!config[params.exp_size]) {
        std::cerr << "Error: Experiment size '" << params.exp_size << "' not found in " << params_yaml_file << std::endl;
        exit(1);
    }
    
    // Store the specific parameter node for the solver
    params.params_node = config[params.exp_size]["params"];
    if (!params.params_node) {
         std::cerr << "Error: 'params' section for experiment size '" << params.exp_size << "' not found in " << params_yaml_file << std::endl;
        exit(1);
    }

    // Set general experiment settings from YAML if not provided via CLI
    auto exp_config = config[params.exp_size];
    if (params.data_dir.empty() && exp_config["data_dir"])
        params.data_dir = exp_config["data_dir"].as<std::string>();
    if (params.output_csv.empty() && exp_config["output_csv"])
        params.output_csv = exp_config["output_csv"].as<std::string>();
    if (params.num_runs == 1 && exp_config["num_runs"])
        params.num_runs = exp_config["num_runs"].as<int>();

    return params;
}

// Helper: get first instance file in a directory
std::string get_first_instance(const std::string& dir) {
    std::vector<std::string> files;
    for (const auto& entry : std::filesystem::directory_iterator(dir)) {
        if (entry.is_regular_file()) {
            files.push_back(entry.path().string());
        }
    }

    // Sort files based on the format <{C | R | RC}><101 -> 209>_co_<size>.txt
    std::sort(files.begin(), files.end(), [](const std::string& a, const std::string& b) {
        auto extract_key = [](const std::string& filename) -> std::pair<char, int> {
            std::string fname = filename.substr(filename.find_last_of("/\\") + 1);
            char prefix = fname[0];
            size_t num_start = 1;
            // Handle RC prefix
            if (fname[0] == 'R' && fname[1] == 'C') {
                prefix = 'Z'; // RC after R and C
                num_start = 2;
            }
            size_t num_end = fname.find("_co_");
            if (num_end == std::string::npos || num_end <= num_start) return {prefix, 9999};
            std::string num_str = fname.substr(num_start, num_end - num_start);
            int num = 9999;
            try {
                num = std::stoi(num_str);
            } catch (...) {}
            return {prefix, num};
        };

        auto [prefix_a, num_a] = extract_key(a);
        auto [prefix_b, num_b] = extract_key(b);
        if (prefix_a != prefix_b) return prefix_a < prefix_b;
        return num_a < num_b;
    });

    return files.empty() ? "" : files.front();
}

// Helper: Print distances between consecutive nodes in a route for debugging
void print_route_distances(const VRPInstance& instance, const std::vector<int>& route) {
    std::cout << "Route: ";
    for (size_t i = 0; i < route.size(); ++i) {
        std::cout << route[i];
        if (i + 1 < route.size()) std::cout << " -> ";
    }
    std::cout << std::endl;
    double total = 0.0;
    for (size_t i = 0; i + 1 < route.size(); ++i) {
        int from = route[i];
        int to = route[i+1];
        double dist = instance.distance_matrix[from][to];
        std::cout << "  " << from << " -> " << to << ": " << dist << std::endl;
        total += dist;
    }
    std::cout << "Total distance: " << total << std::endl;
}

int main(int argc, char* argv[]) {
    ExperimentParams params = parse_params(argc, argv);

    std::cout << "Running solver: " << params.solver_name << " for experiment size: " << params.exp_size << std::endl;

    std::string instance_file;
    if (!params.instance_file.empty()) {
        instance_file = params.instance_file;
    } else if (!params.data_dir.empty()) {
        instance_file = get_first_instance(params.data_dir);
    }

    if (instance_file.empty()) {
        std::cout << "No instance found for size: " << params.exp_size << std::endl;
        return 1;
    }

    std::cout << "\nTesting instance: " << instance_file << std::endl;
    VRPInstance instance = InstanceParser::parse(instance_file);
    instance.build_distance_matrix();

    // Use the factory to create the solver instance
    std::unique_ptr<Solver> solver = SolverFactory::create(params.solver_name);
    if (!solver) {
        std::cerr << "Unknown or unregistered solver: " << params.solver_name << std::endl;
        return 1;
    }

    Solution sol;
    auto start = std::chrono::high_resolution_clock::now();
    
    // Call the solver through the common interface
    sol = solver->solve(instance, params.params_node, true, params.verbose);

    auto end = std::chrono::high_resolution_clock::now();
    double runtime = std::chrono::duration<double>(end - start).count();

    if (params.full_solution) {
        // Build reverse mapping: delivery_node -> list of customers delivered there
        // But we need to track customer order in routes, so we'll rebuild route info
        
        // Output JSON format for programmatic parsing
        std::cout << "{" << std::endl;
        std::cout << "  \"objective\": " << sol.objective_value << "," << std::endl;
        std::cout << "  \"vehicles\": " << sol.routes.size() << "," << std::endl;
        std::cout << "  \"runtime\": " << runtime << "," << std::endl;
        
        // Output routes with customer(delivery_node) format as strings
        std::cout << "  \"routes\": [" << std::endl;
        
        // We need to reconstruct which customer corresponds to each delivery node in routes
        // Use customer_permutation and customer2node to rebuild this
        int perm_idx = 0;
        for (size_t i = 0; i < sol.routes.size(); ++i) {
            std::cout << "    [";
            for (size_t j = 0; j < sol.routes[i].size(); ++j) {
                int node = sol.routes[i][j];
                if (node == 0) {
                    // Depot
                    std::cout << "\"0\"";
                } else {
                    // Find the customer(s) delivered to this node at this position
                    // The customer_permutation tells us the order of customers
                    if (perm_idx < (int)sol.customer_permutation.size()) {
                        int cust_id = sol.customer_permutation[perm_idx];
                        int delivery_node = sol.customer2node.at(cust_id);
                        // Output format: "customer_id(delivery_node)"
                        if (cust_id == delivery_node) {
                            // Home delivery - just show the ID
                            std::cout << "\"" << cust_id << "\"";
                        } else {
                            // Locker delivery - show customer(locker)
                            std::cout << "\"" << cust_id << "(" << delivery_node << ")\"";
                        }
                        perm_idx++;
                    } else {
                        std::cout << "\"" << node << "\"";
                    }
                }
                if (j + 1 < sol.routes[i].size()) std::cout << ", ";
            }
            std::cout << "]";
            if (i + 1 < sol.routes.size()) std::cout << ",";
            std::cout << std::endl;
        }
        std::cout << "  ]," << std::endl;
        
        // Also output raw routes (just node IDs) for visualization
        std::cout << "  \"raw_routes\": [" << std::endl;
        for (size_t i = 0; i < sol.routes.size(); ++i) {
            std::cout << "    [";
            for (size_t j = 0; j < sol.routes[i].size(); ++j) {
                std::cout << sol.routes[i][j];
                if (j + 1 < sol.routes[i].size()) std::cout << ", ";
            }
            std::cout << "]";
            if (i + 1 < sol.routes.size()) std::cout << ",";
            std::cout << std::endl;
        }
        std::cout << "  ]," << std::endl;
        
        std::cout << "  \"delivery_nodes\": [";
        for (size_t i = 0; i < sol.delivery_nodes.size(); ++i) {
            std::cout << sol.delivery_nodes[i];
            if (i + 1 < sol.delivery_nodes.size()) std::cout << ", ";
        }
        std::cout << "]," << std::endl;
        // Output customer2node mapping: customer_id -> delivery_node_id
        std::cout << "  \"customer2node\": {";
        bool first = true;
        for (const auto& [cust_id, node_id] : sol.customer2node) {
            if (!first) std::cout << ", ";
            std::cout << "\"" << cust_id << "\": " << node_id;
            first = false;
        }
        std::cout << "}" << std::endl;
        std::cout << "}" << std::endl;
    } else {
        std::cout << "  Obj = " << sol.objective_value << ", Vehicles = " << sol.routes.size() << ", Time = " << runtime << "s" << std::endl;
        
        if (params.verbose > 0) {
            std::cout << "Customer permutation: ";
            for (size_t i = 0; i < sol.customer_permutation.size(); ++i) {
                std::cout << sol.customer_permutation[i];
                if (i + 1 < sol.customer_permutation.size()) std::cout << ", ";
            }
            std::cout << std::endl;

            if (params.verbose > 1) {
                std::cout << "\nRoute details:" << std::endl;
                for (size_t i = 0; i < sol.routes.size(); ++i) {
                    std::cout << "Route " << i+1 << ":" << std::endl;
                    print_route_distances(instance, sol.routes[i]);
                }
            }
        }
        std::cout << std::endl;
    }
    return 0;
}
