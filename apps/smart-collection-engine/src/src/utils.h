#ifndef UTILS_H
#define UTILS_H

#include <vector>
#include <unordered_map>
#include <random>
#include <algorithm>

#include "core/VRPInstance.h" // adjust path relative to src/src

namespace utils {

// Initialize delivery node mapping for each customer type.
void initialize_customer2node(const VRPInstance& instance, std::unordered_map<int, int>& customer2node, double p, std::mt19937& gen);

// Construct a random customer permutation with depot delimiters (0) separating routes.
std::vector<int> random_delim_permutation(int n, int m, std::mt19937& gen);

void initialize_solution(const VRPInstance& instance, std::vector<int>& customer_perm, std::unordered_map<int, int>& customer2node, double p = 0.5, bool delimiters = false);

// Random initialization with delimiters aware of capacity, time windows, and locker duplication.
void random_init(const VRPInstance& instance, std::vector<int>& customer_perm, std::unordered_map<int,int>& customer2node, double p);

// Initialization without depot delimiters: random mode assignment then nearest-neighbor ordering of customers only.
void no_delim_init(const VRPInstance& instance, std::vector<int>& customer_perm, std::unordered_map<int,int>& customer2node, double p);
} // namespace utils

#endif // UTILS_H
