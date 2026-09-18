#include "InstanceParser.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <algorithm> // For std::any_of

VRPInstance InstanceParser::parse(const std::string& filename) {
    VRPInstance instance;
    std::ifstream infile(filename);
    if (!infile) {
        std::cerr << "Cannot open file: " << filename << std::endl;
        return instance;
    }
    std::string line;
    // Line 1: <Number of customer> <Number of lockers>
    std::getline(infile, line);
    std::istringstream iss1(line);
    iss1 >> instance.num_customers >> instance.num_lockers;
    // Line 2: <Maxium number of vehicle> <Capacit of each vehicle>
    std::getline(infile, line);
    std::istringstream iss2(line);
    iss2 >> instance.num_vehicles >> instance.vehicle_capacity;
    // Next num_customers lines: customer demand
    std::vector<int> demands;
    for (int i = 0; i < instance.num_customers; ++i) {
        std::getline(infile, line);
        int demand = std::stoi(line);
        demands.push_back(demand);
    }
    // Next: depot + customers + lockers locations
    int total_nodes = 1 + instance.num_customers + instance.num_lockers;
    std::vector<std::tuple<double, double, int, int, int, int>> node_data;
    for (int i = 0; i < total_nodes; ++i) {
        std::getline(infile, line);
        std::istringstream iss(line);
        double x, y; int early, late, service, type;
        iss >> x >> y >> early >> late >> service >> type;
        node_data.emplace_back(x, y, early, late, service, type);
    }
    // First node is depot
    {
        auto& tup = node_data[0];
        instance.depot = std::make_shared<Depot>(0, std::get<0>(tup), std::get<1>(tup), std::get<2>(tup), std::get<3>(tup), std::get<4>(tup));
    }
    // Next num_customers are customers
    for (int i = 0; i < instance.num_customers; ++i) {
        auto& tup = node_data[1 + i];
        int type = std::get<5>(tup);
        instance.customers.push_back(std::make_shared<Customer>(
            i + 1, std::get<0>(tup), std::get<1>(tup), std::get<2>(tup), std::get<3>(tup), std::get<4>(tup), type, demands[i]
        ));
    }
    // Next num_lockers are lockers
    for (int i = 0; i < instance.num_lockers; ++i) {
        auto& tup = node_data[1 + instance.num_customers + i];
        instance.lockers.push_back(std::make_shared<Locker>(
            1 + instance.num_customers + i, std::get<0>(tup), std::get<1>(tup), std::get<2>(tup), std::get<3>(tup), std::get<4>(tup)
        ));
    }
    // Last num_customers lines: customer preferences
    for (int i = 0; i < instance.num_customers; ++i) {
        std::getline(infile, line);
        std::istringstream iss(line);
        std::vector<int> prefs;
        for (int j = 0; j < instance.num_lockers; ++j) {
            int val; iss >> val; prefs.push_back(val);
        }
        instance.customer_preferences.push_back(prefs);
    }
    // Validation: check locker assignment rules
    for (int i = 0; i < instance.num_customers; ++i) {
        int type = instance.customers[i]->customer_type;
        const auto& prefs = instance.customer_preferences[i];
        bool any_assigned = std::any_of(prefs.begin(), prefs.end(), [](int v){ return v == 1; });
        if ((type == 2 || type == 3) && !any_assigned) {
            throw std::runtime_error("Customer " + std::to_string(i+1) + " (type-II or III) must have at least one locker assigned.");
        }
        if (type == 1 && any_assigned) {
            throw std::runtime_error("Customer " + std::to_string(i+1) + " (type-I) must not have any locker assigned.");
        }
    }
    return instance;
}
