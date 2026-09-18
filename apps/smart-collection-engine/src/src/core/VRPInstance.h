#pragma once
#include <vector>
#include <memory>
#include "Customer.h"
#include "Locker.h"
#include "Depot.h"

class VRPInstance {
public:
    int num_customers;
    int num_lockers;
    int num_vehicles;
    int vehicle_capacity;
    std::vector<std::shared_ptr<Customer>> customers;
    std::vector<std::shared_ptr<Locker>> lockers;
    std::shared_ptr<Depot> depot;
    std::vector<std::vector<int>> customer_preferences; // [customer][locker]
    std::vector<std::vector<double>> distance_matrix; // [node][node] Euclidean distances
    VRPInstance();
    void build_distance_matrix(); // Call after parsing all nodes
};
