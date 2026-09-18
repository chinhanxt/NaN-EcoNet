#pragma once
#include "Solver.h"

class ALNS : public Solver {
public:
    Solution solve(const VRPInstance& instance, const YAML::Node& params_node, bool history = false, int verbose = 0) override;
};
