#pragma once

#include "../core/VRPInstance.h"
#include <vector>
#include <unordered_map>
#include <yaml-cpp/yaml.h>

struct Solution {
    std::vector<std::vector<int>> routes; 
    double objective_value = 1e12;
    std::vector<int> delivery_nodes; // Assigned delivery node for each customer (index = customer-1)
    std::unordered_map<int, int> customer2node; 
    std::vector<int> customer_permutation; 
    bool history = false; 
};

class Solver {
public:
    virtual ~Solver() = default;
    virtual Solution solve(const VRPInstance& instance, const YAML::Node& params_node, bool history = false, int verbose = 0) = 0;
    static Solution evaluate(const VRPInstance& instance,
                             const std::vector<int>& customer_permutation,
                             const std::unordered_map<int, int>& customer2node,
                             bool feasibility_check = true,
                             int verbose = 0);
};
