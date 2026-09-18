#include <cmath>
#include "VRPInstance.h"

VRPInstance::VRPInstance()
    : num_customers(0), num_lockers(0), num_vehicles(0), vehicle_capacity(0) {}

// Helper: compute Euclidean distance between two nodes
static double euclidean(const Node& a, const Node& b) {
    double dx = a.x - b.x;
    double dy = a.y - b.y;
    return std::sqrt(dx * dx + dy * dy);
}

// Build the distance matrix after all nodes are parsed
void VRPInstance::build_distance_matrix() {
    int total_nodes = 1 + num_customers + num_lockers;
    distance_matrix.assign(total_nodes, std::vector<double>(total_nodes, 0.0));
    std::vector<const Node*> nodes;
    nodes.push_back(depot.get());
    for (const auto& c : customers) nodes.push_back(c.get());
    for (const auto& l : lockers) nodes.push_back(l.get());
    for (int i = 0; i < total_nodes; ++i) {
        for (int j = 0; j < total_nodes; ++j) {
            distance_matrix[i][j] = euclidean(*nodes[i], *nodes[j]);
        }
    }
}
