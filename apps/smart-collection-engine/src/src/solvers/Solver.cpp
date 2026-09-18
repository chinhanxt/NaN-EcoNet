#include "Solver.h"
#include <cmath>
#include <limits>
#include <algorithm>
#include <iostream>
#include <unordered_set>

// Route construction: builds routes from permutation and customer2node mapping
struct RouteResult {
    std::vector<std::vector<int>> routes; // node IDs
    double objective;
    bool feasible;
};

static RouteResult construct_routes(const VRPInstance& instance, const std::vector<int>& customer_perm, const std::unordered_map<int, int>& customer2node) {
    int n = instance.num_customers;
    int m = instance.num_vehicles;
    int cap = instance.vehicle_capacity;
    const int depot_id = 0;
    std::vector<std::vector<int>> routes;
    int vehicle = 0;
    int load = 0;
    int time = 0;
    int curr_node = depot_id;
    std::vector<int> route = {depot_id};
    bool feasible = true;
    double total_distance = 0.0;
    std::unordered_set<int> visited_lockers;
    int last_node = depot_id;
    for (int idx = 0; idx < n; ++idx) {
        int cust_id = customer_perm[idx];
        int cust_idx = cust_id - 1;
        int delivery_node = customer2node.at(cust_id);
        int demand = instance.customers[cust_idx]->demand;
        int node_idx = delivery_node;
        int arr_time = time + (int)instance.distance_matrix[curr_node][node_idx];
        int early = 0, late = 0;
        bool is_locker = (delivery_node > instance.num_customers);
        if (delivery_node <= instance.num_customers) {
            auto c = instance.customers[delivery_node-1];
            early = c->early_time;
            late = c->late_time;
        } else {
            auto l = instance.lockers[delivery_node-1-instance.num_customers];
            early = l->early_time;
            late = l->late_time;
        }
        bool duplicate_locker = false;
        if (is_locker) {
            if (visited_lockers.count(delivery_node) && delivery_node != last_node) {
                duplicate_locker = true;
            }
        }
        bool violates = (load + demand > cap) || (arr_time > late) || duplicate_locker;
        if (violates) {
            // End current route, return to depot
            if (curr_node != depot_id) {
                total_distance += instance.distance_matrix[curr_node][depot_id];
                route.push_back(depot_id);
            }
            routes.push_back(route);
            vehicle++;
            if (vehicle > m) {
                feasible = false;
                // break; // Allow soft penalty for exceeding vehicle limit
            }
            // Start new vehicle/route
            route = {depot_id};
            load = 0;
            curr_node = depot_id;
            time = 0;
            visited_lockers.clear();
            last_node = depot_id;
            // re-process this customer with new vehicle
            idx--;
            continue;
        }
        // Add distance from current node to delivery node
        total_distance += instance.distance_matrix[curr_node][delivery_node];
        // Update state
        time = std::max(arr_time, early);
        load += demand;
        route.push_back(delivery_node);
        curr_node = delivery_node;
        if (is_locker) visited_lockers.insert(delivery_node);
        last_node = delivery_node;
    }
    // End last route if not empty
    // if (!route.empty() && curr_node != depot_id && feasible) {
    //     total_distance += instance.distance_matrix[curr_node][depot_id];
    //     route.push_back(depot_id);
    //     routes.push_back(route);
    // }
    if (!route.empty() && curr_node != depot_id) {
        total_distance += instance.distance_matrix[curr_node][depot_id];
        route.push_back(depot_id);
        routes.push_back(route);
    }
    // if (!feasible) total_distance = 1e9;
    return {routes, total_distance, feasible};
}

static RouteResult construct_routes_delimiter(const VRPInstance& instance, const std::vector<int>& customer_perm, const std::unordered_map<int, int>& customer2node) {
    int n = instance.num_customers;
    int m = instance.num_vehicles;
    int cap = instance.vehicle_capacity;
    const int depot_id = 0;
    std::vector<std::vector<int>> routes;
    bool feasible = true;
    double total_distance = 0.0;
    int vehicle = 0;
    std::vector<int> route;
    int load = 0;
    int time = 0;
    int curr_node = depot_id;
    std::unordered_set<int> visited_lockers;
    int last_node = depot_id;
    for (size_t idx = 0; idx < customer_perm.size(); ++idx) {
        int node = customer_perm[idx];
        if (node == depot_id) {
            // If current route has customers, close it
            if (!route.empty() && route.size() > 1) {
                if (route.back() != depot_id) {
                    total_distance += instance.distance_matrix[curr_node][depot_id];
                    route.push_back(depot_id);
                }
                routes.push_back(route);
                vehicle++;
                if (vehicle > m) {
                    feasible = false;
                    break;
                }
            }
            // Start new route
            route.clear();
            route.push_back(depot_id);
            load = 0;
            time = 0;
            curr_node = depot_id;
            visited_lockers.clear();
            last_node = depot_id;
            continue;
        }
        // Only process customer nodes (not depot)
        int cust_id = node;
        int delivery_node = customer2node.at(cust_id);
        int demand = 0;
        int early = 0, late = 0;
        bool is_locker = (delivery_node > instance.num_customers);
        if (delivery_node <= instance.num_customers) {
            auto c = instance.customers[delivery_node-1];
            demand = c->demand;
            early = c->early_time;
            late = c->late_time;
        } else {
            // Locker: get demand from the customer, but time window from the locker
            auto l = instance.lockers[delivery_node-1-instance.num_customers];
            auto c = instance.customers[cust_id-1];
            demand = c->demand;
            early = l->early_time;
            late = l->late_time;
        }
        int arr_time = time + (int)instance.distance_matrix[curr_node][delivery_node];
        bool duplicate_locker = false;
        if (is_locker) {
            if (visited_lockers.count(delivery_node) && delivery_node != last_node) {
                duplicate_locker = true;
            }
        }
        bool violates = (load + demand > cap) || (arr_time > late) || duplicate_locker;
        if (violates) {
            feasible = false;
            break;
        }
        total_distance += instance.distance_matrix[curr_node][delivery_node];
        time = std::max(arr_time, early);
        load += demand;
        route.push_back(delivery_node);
        curr_node = delivery_node;
        if (is_locker) visited_lockers.insert(delivery_node);
        last_node = delivery_node;
    }
    // Finalize last route if not empty and feasible
    if (!route.empty() && route.size() > 1 && feasible) {
        if (route.back() != depot_id) {
            total_distance += instance.distance_matrix[curr_node][depot_id];
            route.push_back(depot_id);
        }
        routes.push_back(route);
    }
    if (!feasible) total_distance = 1e9;
    return {routes, total_distance, feasible};
}

Solution Solver::evaluate(const VRPInstance& instance, const std::vector<int>& customer_perm, const std::unordered_map<int, int>& customer2node, bool use_delimiter, int verbose) {
    int n = instance.num_customers;
    std::vector<int> delivery_nodes(n);
    for (int i = 0; i < n; ++i) {
        int cust_id = i + 1;
        delivery_nodes[i] = customer2node.at(cust_id);
    }
    RouteResult route_result = use_delimiter
        ? construct_routes_delimiter(instance, customer_perm, customer2node)
        : construct_routes(instance, customer_perm, customer2node);
    Solution sol;
    sol.routes = route_result.routes;
    sol.delivery_nodes = delivery_nodes;
    sol.customer2node = customer2node;
    sol.objective_value = route_result.objective;
    sol.customer_permutation = customer_perm; // Store the permutation used
    if (!route_result.feasible) sol.routes.clear();
    return sol;
}
