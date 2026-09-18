#pragma once
#include "Solver.h"
#include "../utils.h"

class HHO : public Solver {
public:
    Solution solve(const VRPInstance& instance, const YAML::Node& params_node, bool history = false, int verbose = 0) override;
};
