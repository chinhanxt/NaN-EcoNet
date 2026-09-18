#include "SA.h"
#include "../core/SolverFactory.h"
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <random>
#include <iostream>
#include <fstream>
#include <filesystem>

namespace {
    SolverRegistrar<SA> registrar("sa");
}

struct SAParams {
    int max_iter = 1000;
    double T0 = 10.0;
    double Tf = 0.1;
    int patience = 50;
    double alpha = 0.97;
    double beta = 1.0;
    double p = 0.5; // for type-III locker assignment
};

static Solution iterate(const VRPInstance& instance, std::vector<int> customer_perm, std::unordered_map<int, int> customer2node, const SAParams& params, bool history, int verbose) {
    Solution sigma_best = Solver::evaluate(instance, customer_perm, customer2node);
    Solution sigma_current = sigma_best;
    int R = 0;
    double T = params.T0;
    bool FBS = false;
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<> prob(0.0, 1.0);
    int n = customer_perm.size();
    std::vector<double> convergence_history;
    if (history) convergence_history.push_back(sigma_best.objective_value);
    int outer_iter = 0;
    while (R < params.patience && T > params.Tf) {
        for (int iter = 0; iter < params.max_iter; ++iter) {
            std::vector<int> new_perm = customer_perm;
            // Neighborhood move
            double r = prob(gen);
            if (r <= 1.0/3) {
                int i = gen() % n, j = gen() % n;
                if (i != j) std::swap(new_perm[i], new_perm[j]);
            } else if (r <= 2.0/3) {
                int i = gen() % n, j = gen() % n;
                if (i != j) {
                    int val = new_perm[i];
                    new_perm.erase(new_perm.begin() + i);
                    new_perm.insert(new_perm.begin() + j, val);
                }
            } else {
                int i = gen() % n, j = gen() % n;
                if (i > j) std::swap(i, j);
                if (i != j) std::reverse(new_perm.begin() + i, new_perm.begin() + j + 1);
            }
            // Evaluate
            Solution sigma_new = Solver::evaluate(instance, new_perm, customer2node);
            double theta = sigma_new.objective_value - sigma_current.objective_value;
            if (theta <= 0) {
                sigma_current = sigma_new;
                customer_perm = new_perm;
            } else {
                double r2 = prob(gen);
                double accept_prob = std::exp(-theta / (params.beta * T));
                if (r2 < accept_prob) {
                    sigma_current = sigma_new;
                    customer_perm = new_perm;
                }
            }
            if (sigma_new.objective_value < sigma_best.objective_value) {
                sigma_best = sigma_new;
                R = 0;
                FBS = true;
            }
        }
        T *= params.alpha;
        if (verbose >= 2) {
            std::cout << "[SA] OuterIter " << outer_iter << " best = " << sigma_best.objective_value << " T=" << T << "\n";
        }
        ++outer_iter;
        if (history) convergence_history.push_back(sigma_best.objective_value);
        if (FBS) {
            FBS = false;
        } else {
            R += 1;
        }
    }
    if (history) {
        std::filesystem::create_directories("src/output/experiment");
        std::ofstream csv("src/output/experiment/sa.cvr.csv");
        csv << "iter,best_objective\n";
        for (size_t i = 0; i < convergence_history.size(); ++i) {
            csv << i << "," << convergence_history[i] << "\n";
        }
        csv.close();
    }
    return sigma_best;
}

Solution SA::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    SAParams params;
    params.max_iter = params_node["max_iter"].as<int>();
    params.T0 = params_node["T0"].as<double>();
    params.Tf = params_node["Tf"].as<double>();
    params.alpha = params_node["alpha"].as<double>();
    params.beta = params_node["beta"].as<double>();
    params.patience = params_node["patience"].as<int>();
    params.p = params_node["p"].as<double>();

    // Initialize customer-to-node mapping
    std::vector<int> customer_perm;
    std::unordered_map<int, int> customer2node;
    utils::random_init(instance, customer_perm, customer2node, params.p);

    return iterate(instance, customer_perm, customer2node, params, history, verbose);
}
