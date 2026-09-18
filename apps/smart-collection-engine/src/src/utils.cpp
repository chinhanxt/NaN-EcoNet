#include "utils.h"
#include <unordered_set>

namespace utils {
// Random initialization with constraint-aware delimiter insertion.
void random_init(const VRPInstance& instance, std::vector<int>& customer_perm, std::unordered_map<int,int>& customer2node, double p) {
    int n = instance.num_customers;
    int m = instance.num_vehicles > 0 ? instance.num_vehicles : 1;
    customer_perm.clear();
    customer2node.clear();
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<> prob(0.0, 1.0);
    // Step 1: randomly assign delivery nodes similar to initialize_solution but random locker choice when allowed
    std::vector<int> assigned_delivery_node(n, -1);
    for (int i = 0; i < n; ++i) {
        auto c = instance.customers[i];
        if (c->customer_type == 1) {
            assigned_delivery_node[i] = c->id;
        } else if (c->customer_type == 2) {
            // pick a preferred locker randomly among feasible, else first locker, else itself
            std::vector<int> prefs;
            if (!instance.customer_preferences.empty() && i < (int)instance.customer_preferences.size()) {
                for (size_t j = 0; j < instance.customer_preferences[i].size(); ++j) {
                    if (instance.customer_preferences[i][j] == 1) prefs.push_back(instance.lockers[j]->id);
                }
            }
            if (!prefs.empty()) {
                std::uniform_int_distribution<> pick(0, (int)prefs.size()-1);
                assigned_delivery_node[i] = prefs[pick(gen)];
            } else if (!instance.lockers.empty()) {
                std::uniform_int_distribution<> pick(0, (int)instance.lockers.size()-1);
                assigned_delivery_node[i] = instance.lockers[pick(gen)]->id;
            } else {
                assigned_delivery_node[i] = c->id;
            }
        } else if (c->customer_type == 3) {
            double r = prob(gen);
            if (r < p) {
                assigned_delivery_node[i] = c->id; // home
            } else {
                std::vector<int> prefs;
                if (!instance.customer_preferences.empty() && i < (int)instance.customer_preferences.size()) {
                    for (size_t j = 0; j < instance.customer_preferences[i].size(); ++j) {
                        if (instance.customer_preferences[i][j] == 1) prefs.push_back(instance.lockers[j]->id);
                    }
                }
                if (!prefs.empty()) {
                    std::uniform_int_distribution<> pick(0, (int)prefs.size()-1);
                    assigned_delivery_node[i] = prefs[pick(gen)];
                } else if (!instance.lockers.empty()) {
                    std::uniform_int_distribution<> pick(0, (int)instance.lockers.size()-1);
                    assigned_delivery_node[i] = instance.lockers[pick(gen)]->id;
                } else {
                    assigned_delivery_node[i] = c->id;
                }
            }
        }
        customer2node[c->id] = assigned_delivery_node[i];
    }
    // Step 2: nearest neighbor heuristic with constraint-aware insertion and delimiters
    const int depot_id = 0;
    int cap = instance.vehicle_capacity;
    int vehicle = 0;
    std::vector<char> remaining(n, 1); // 1 if not yet inserted
    int remaining_count = n;
    while (remaining_count > 0 && vehicle < m) {
        customer_perm.push_back(0); // start route
        int load = 0;
        int time = 0;
        int curr_node = depot_id;
        std::unordered_set<int> visited_lockers;
        int last_node = depot_id;
        bool progress = true;
        while (progress) {
            progress = false;
            double best_dist = std::numeric_limits<double>::max();
            int best_idx = -1;
            int best_delivery_node = -1;
            int best_demand = 0; int best_early=0; int best_late=0; bool best_is_locker=false;
            for (int i = 0; i < n; ++i) {
                if (!remaining[i]) continue;
                int cust_id = i + 1;
                int delivery_node = customer2node[cust_id];
                bool is_locker = (delivery_node > instance.num_customers);
                int demand=0, early=0, late=std::numeric_limits<int>::max();
                if (delivery_node <= instance.num_customers) {
                    auto c = instance.customers[delivery_node-1];
                    demand = c->demand; early = c->early_time; late = c->late_time;
                } else {
                    auto l = instance.lockers[delivery_node-1-instance.num_customers];
                    auto c = instance.customers[cust_id-1];
                    demand = c->demand; early = l->early_time; late = l->late_time;
                }
                int arr_time = time + (int)instance.distance_matrix[curr_node][delivery_node];
                bool duplicate_locker = false;
                if (is_locker && visited_lockers.count(delivery_node) && delivery_node != last_node) duplicate_locker = true;
                if (load + demand > cap || arr_time > late || duplicate_locker) continue; // infeasible
                double dist = instance.distance_matrix[curr_node][delivery_node];
                if (dist < best_dist) {
                    best_dist = dist;
                    best_idx = i;
                    best_delivery_node = delivery_node;
                    best_demand = demand; best_early = early; best_late = late; best_is_locker = is_locker;
                }
            }
            if (best_idx != -1) {
                // insert chosen customer
                int cust_id = best_idx + 1;
                remaining[best_idx] = 0; --remaining_count;
                customer_perm.push_back(cust_id);
                int arr_time = time + (int)instance.distance_matrix[curr_node][best_delivery_node];
                time = std::max(arr_time, best_early);
                load += best_demand;
                curr_node = best_delivery_node;
                if (best_is_locker) visited_lockers.insert(best_delivery_node);
                last_node = best_delivery_node;
                progress = true;
            }
        }
        // close route
        customer_perm.push_back(0);
        ++vehicle;
    }
    // If vehicles exhausted but customers remain, build one extra unconstrained route (nearest neighbor, ignoring constraints)
    if (remaining_count > 0) {
        const int depot_id2 = 0;
        customer_perm.push_back(0);
        int curr_node = depot_id2;
        while (remaining_count > 0) {
            double best_dist = std::numeric_limits<double>::max();
            int best_idx = -1; int best_delivery = -1;
            for (int i = 0; i < n; ++i) {
                if (!remaining[i]) continue;
                int cust_id = i + 1;
                int delivery_node = customer2node[cust_id];
                double dist = instance.distance_matrix[curr_node][delivery_node];
                if (dist < best_dist) { best_dist = dist; best_idx = i; best_delivery = delivery_node; }
            }
            if (best_idx == -1) break; // safety
            int cust_id = best_idx + 1;
            remaining[best_idx] = 0; --remaining_count;
            customer_perm.push_back(cust_id);
            curr_node = best_delivery;
        }
        customer_perm.push_back(0);
    }
}

// Initialization without depot delimiters: random delivery mode assignment then global nearest-neighbor ordering (customers only).
void no_delim_init(const VRPInstance& instance, std::vector<int>& customer_perm, std::unordered_map<int,int>& customer2node, double p) {
    int n = instance.num_customers;
    customer_perm.clear();
    customer2node.clear();
    if (n==0) return;
    std::random_device rd; std::mt19937 gen(rd()); std::uniform_real_distribution<> prob(0.0,1.0);
    // Assign delivery node (home/locker) randomly similar to random_init
    for (int i=0;i<n;++i) {
        auto c = instance.customers[i];
        int node = c->id;
        if (c->customer_type == 1) {
            node = c->id;
        } else if (c->customer_type == 2) {
            std::vector<int> prefs;
            if (!instance.customer_preferences.empty() && i < (int)instance.customer_preferences.size()) {
                for (size_t j=0;j<instance.customer_preferences[i].size();++j) if (instance.customer_preferences[i][j]==1) prefs.push_back(instance.lockers[j]->id);
            }
            if (!prefs.empty()) { std::uniform_int_distribution<> pick(0,(int)prefs.size()-1); node = prefs[pick(gen)]; }
            else if (!instance.lockers.empty()) { std::uniform_int_distribution<> pick(0,(int)instance.lockers.size()-1); node = instance.lockers[pick(gen)]->id; }
        } else if (c->customer_type == 3) {
            if (prob(gen) >= p) { // choose locker instead of home
                std::vector<int> prefs;
                if (!instance.customer_preferences.empty() && i < (int)instance.customer_preferences.size()) {
                    for (size_t j=0;j<instance.customer_preferences[i].size();++j) if (instance.customer_preferences[i][j]==1) prefs.push_back(instance.lockers[j]->id);
                }
                if (!prefs.empty()) { std::uniform_int_distribution<> pick(0,(int)prefs.size()-1); node = prefs[pick(gen)]; }
                else if (!instance.lockers.empty()) { std::uniform_int_distribution<> pick(0,(int)instance.lockers.size()-1); node = instance.lockers[pick(gen)]->id; }
            }
        }
        customer2node[c->id] = node;
    }
    // Build nearest-neighbor order starting from a random customer
    std::vector<char> remaining(n,1); int remaining_cnt = n;
    std::uniform_int_distribution<> start_pick(0,n-1);
    int current_cidx = start_pick(gen); // index 0..n-1 representing customer id = idx+1
    remaining[current_cidx]=0; --remaining_cnt; customer_perm.push_back(current_cidx+1);
    int current_node = customer2node[current_cidx+1];
    const auto& D = instance.distance_matrix;
    while (remaining_cnt>0) {
        double best_dist = std::numeric_limits<double>::max(); int best_idx=-1; int best_node=-1;
        for (int i=0;i<n;++i) if (remaining[i]) {
            int node = customer2node[i+1]; double dist = D[current_node][node];
            if (dist < best_dist) { best_dist=dist; best_idx=i; best_node=node; }
        }
        if (best_idx==-1) break; // safety
        remaining[best_idx]=0; --remaining_cnt; customer_perm.push_back(best_idx+1); current_node = best_node;
    }
}
} // namespace utils