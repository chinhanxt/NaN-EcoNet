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
#include <set>
#include <memory>
#include <numeric>

struct ExperimentParams {
    std::string solver_name;
    std::string exp_size;
    std::string output_csv;
    int num_runs;
    std::string data_dir;
    YAML::Node params_node;
    int verbose = 0;
};

ExperimentParams parse_params(int argc, char* argv[]) {
    ExperimentParams params;
    params.exp_size = "small";
    params.num_runs = 5;
    params.output_csv = "../output/solutions/output.csv";
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
        } else if ((key == "--verbose" || key == "-v") && i + 1 < argc) {
            params.verbose = std::stoi(argv[++i]);
        }
    }

    if (params.solver_name.empty() || params_yaml_file.empty()) {
        std::cerr << "Usage: ./main --solver <name> --params <param_file.yaml> [--instances <dir>] [--num-runs <int>] [--output <output_file.csv>] [--size <experiment_size>] [--verbose <level> | -v <level>]" << std::endl;
        exit(1);
    }

    YAML::Node config = YAML::LoadFile(params_yaml_file);
    if (!config[params.exp_size]) {
        std::cerr << "Experiment size '" << params.exp_size << "' not found in " << params_yaml_file << std::endl;
        exit(1);
    }

    auto exp_config = config[params.exp_size];
    if (params.data_dir.empty() && exp_config["data_dir"])
        params.data_dir = exp_config["data_dir"].as<std::string>();
    if (params.output_csv == "../output/solutions/output.csv" && exp_config["output_csv"])
        params.output_csv = exp_config["output_csv"].as<std::string>();
    if (params.num_runs == 5 && exp_config["num_runs"])
        params.num_runs = exp_config["num_runs"].as<int>();

    params.params_node = exp_config["params"];
    if (!params.params_node) {
        std::cerr << "Error: 'params' section for experiment size '" << params.exp_size << "' not found in " << params_yaml_file << std::endl;
        exit(1);
    }

    return params;
}

std::vector<std::string> load_instance_files(const ExperimentParams& params) {
    std::vector<std::string> instance_files;
    std::string data_dir = params.data_dir;
    for (const auto& entry : std::filesystem::directory_iterator(data_dir)) {
        if (entry.is_regular_file() && entry.path().extension() == ".txt") {
            instance_files.push_back(entry.path().string());
        }
    }
    std::sort(instance_files.begin(), instance_files.end(), [](const std::string& a, const std::string& b) {
        auto get_type = [](const std::string& name) {
            if (name.find("RC") != std::string::npos) return 2;
            if (name.find("R") != std::string::npos) return 1;
            return 0; // C
        };
        auto get_num = [](const std::string& name) {
            size_t start = name.find_first_of("0123456789");
            size_t end = name.find_first_not_of("0123456789", start);
            return std::stoi(name.substr(start, end - start));
        };
        int type_a = get_type(a);
        int type_b = get_type(b);
        if (type_a != type_b) return type_a < type_b;
        int num_a = get_num(a);
        int num_b = get_num(b);
        return num_a < num_b;
    });
    std::cout << "Loaded instance files (" << instance_files.size() << "):" << std::endl;
    for (const auto& f : instance_files) {
        std::cout << "  " << std::filesystem::path(f).filename().string() << std::endl;
    }
    return instance_files;
}

std::set<std::string> load_completed_instances(const std::string& output_csv) {
    std::set<std::string> completed;
    std::ifstream ifs(output_csv);
    if (!ifs.is_open()) return completed;
    std::string line;
    std::getline(ifs, line); // Skip header
    while (std::getline(ifs, line)) {
        if (line.empty()) continue;
        auto comma = line.find(',');
        if (comma != std::string::npos) {
            completed.insert(line.substr(0, comma));
        }
    }
    return completed;
}

void print_params(const ExperimentParams& params) {
    std::cout << "Loaded parameters for solver '" << params.solver_name << "' and size '" << params.exp_size << "':" << std::endl;
    for (const auto& it : params.params_node) {
        std::cout << "  " << it.first.as<std::string>() << ": " << it.second.as<std::string>() << std::endl;
    }
    std::cout << "  num_runs: " << params.num_runs << std::endl;
    std::cout << "  output_csv: " << params.output_csv << std::endl;
    std::cout << "  data_dir: " << params.data_dir << std::endl;
    std::cout << "  verbose: " << params.verbose << std::endl;
}

void run_experiment(const ExperimentParams& params, const std::vector<std::string>& instance_files_unsorted) {
    std::vector<std::string> instance_files = instance_files_unsorted;
    std::sort(instance_files.begin(), instance_files.end());
    
    std::set<std::string> completed_instances;
    bool file_exists = std::filesystem::exists(params.output_csv);
    if (file_exists) {
        completed_instances = load_completed_instances(params.output_csv);
    }

    std::ofstream ofs;
    if (file_exists) {
        ofs.open(params.output_csv, std::ios::app);
    } else {
        ofs.open(params.output_csv);
        ofs << "instance_name,Num Vehicles,Best Distance,AVG Distance,Std Distance,AVG Runtime (s),Std Runtime (s)\n";
    }

    for (const auto& file : instance_files) {
        std::string instance_name = std::filesystem::path(file).filename().string();
        if (completed_instances.count(instance_name)) {
            std::cout << "Skipping already completed instance: " << instance_name << std::endl;
            continue;
        }

        std::cout << "\nProcessing instance: " << file << std::endl;
        std::vector<double> distances, runtimes;
        int best_num_vehicles = 0;
        double best_distance = std::numeric_limits<double>::max();

        std::unique_ptr<Solver> solver = SolverFactory::create(params.solver_name);
        if (!solver) {
            std::cerr << "Unknown or unregistered solver: " << params.solver_name << std::endl;
            continue; 
        }

        for (int run = 0; run < params.num_runs; ++run) {
            auto start = std::chrono::high_resolution_clock::now();
            VRPInstance instance = InstanceParser::parse(file);
            instance.build_distance_matrix();
            
            Solution sol = solver->solve(instance, params.params_node, false, params.verbose);
            
            auto end = std::chrono::high_resolution_clock::now();
            double runtime = std::chrono::duration<double>(end - start).count();
            
            runtimes.push_back(runtime);
            distances.push_back(sol.objective_value);
            
            if (sol.objective_value < best_distance) {
                best_distance = sol.objective_value;
                best_num_vehicles = sol.routes.size();
            }
            std::cout << "  Run " << (run + 1) << "/" << params.num_runs << ": Obj = " << sol.objective_value << ", Vehicles = " << sol.routes.size() << ", Time = " << runtime << "s" << std::endl;
        }

        double avg_dist = 0, std_dist = 0, avg_runtime = 0, std_runtime = 0;
        if (!distances.empty()) {
            double sum_dist = std::accumulate(distances.begin(), distances.end(), 0.0);
            avg_dist = sum_dist / distances.size();
            double sq_sum_dist = std::inner_product(distances.begin(), distances.end(), distances.begin(), 0.0);
            std_dist = std::sqrt(sq_sum_dist / distances.size() - avg_dist * avg_dist);
        }
        if (!runtimes.empty()) {
            double sum_runtime = std::accumulate(runtimes.begin(), runtimes.end(), 0.0);
            avg_runtime = sum_runtime / runtimes.size();
            double sq_sum_runtime = std::inner_product(runtimes.begin(), runtimes.end(), runtimes.begin(), 0.0);
            std_runtime = std::sqrt(sq_sum_runtime / runtimes.size() - avg_runtime * avg_runtime);
        }

        ofs << instance_name << "," << best_num_vehicles << "," << best_distance << "," << avg_dist << "," << std_dist << "," << avg_runtime << "," << std_runtime << "\n";
        ofs.flush();
        std::cout << "Finished: " << instance_name << " Best: " << best_distance << " Avg: " << avg_dist << std::endl;
        std::cout << "Results saved to: " << params.output_csv << std::endl;
    }
    ofs.close();
}

int main(int argc, char* argv[]) {
    ExperimentParams params = parse_params(argc, argv);
    std::vector<std::string> instance_files = load_instance_files(params);
    print_params(params);
    run_experiment(params, instance_files);
    return 0;
}
