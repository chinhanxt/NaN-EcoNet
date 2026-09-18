#pragma once
#include <string>
#include "VRPInstance.h"

class InstanceParser {
public:
    static VRPInstance parse(const std::string& filename);
};
