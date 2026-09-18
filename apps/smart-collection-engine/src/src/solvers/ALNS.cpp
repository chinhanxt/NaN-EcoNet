// ALNS structural framework with placeholders
#include "ALNS.h"
#include "../core/SolverFactory.h"
#include "../utils.h"
#include <random>
#include <algorithm>
#include <iostream>
#include <cmath>
#include <filesystem>
#include <fstream>

namespace { SolverRegistrar<ALNS> registrar("alns"); }

struct ALNSParams {
    int iterations = 1000;
    double p = 0.5;                 // type-III assignment probability
    double w_decay = 0.8;           // reaction factor for adaptive weights
    double reward_1 = 5.0, reward_2 = 2.0, reward_3 = 1.0; // operator rewards
    // Simulated annealing parameters
    double init_temp = 100.0;       // initial temperature
    double cooling   = 0.995;       // geometric cooling factor per iteration
    double min_temp  = 1e-3;        // minimum temperature stopping criterion
    // Local search parameters
    bool enable_locker_grouping = true; // enable locker grouping local search
    bool enable_sa_moves = true;        // enable SA-style neighborhood moves
    int local_search_frequency = 1;    // apply local search every N iterations
    int min_local_moves = 10;           // maximum SA-style moves perlocal  search
};

struct OperatorScore { double weight=1.0; double score=0.0; int usage=0; };

struct ALNSSolution { std::vector<int> perm; std::unordered_map<int,int> c2n; double fitness=1e18; std::vector<int> removed; };

static ALNSSolution evaluate_sol(const VRPInstance& instance, std::vector<int> perm, std::unordered_map<int,int> c2n) {
    ALNSSolution s; s.perm = std::move(perm); s.c2n = std::move(c2n); s.fitness = Solver::evaluate(instance, s.perm, s.c2n, false).objective_value; return s; }

// ---- Locker Grouping Local Search Helpers ------------------------------------------
// Check if a delivery node is a locker (node ID > num_customers)
static bool is_locker_delivery(int delivery_node, const VRPInstance& instance) {
    return delivery_node > instance.num_customers;
}

// Get the locker ID from a delivery node (assumes it's already verified to be a locker)
static int get_locker_id(int delivery_node, const VRPInstance& instance) {
    return delivery_node - instance.num_customers; // Convert to 0-based locker index
}

// Check if a customer can use a specific locker based on preferences
static bool can_use_locker(int customer_id, int locker_delivery_node, const VRPInstance& instance) {
    int customer_idx = customer_id - 1; // Convert to 0-based index
    if (customer_idx < 0 || customer_idx >= instance.num_customers) return false;
    
    auto customer = instance.customers[customer_idx];
    // Type 1 (home only) cannot use lockers
    if (customer->customer_type == 1) return false;
    // Type 2 and 3 can use lockers if they have preference
    
    int locker_idx = get_locker_id(locker_delivery_node, instance);
    if (locker_idx < 0 || locker_idx >= (int)instance.customer_preferences[customer_idx].size()) return false;
    
    return instance.customer_preferences[customer_idx][locker_idx] == 1;
}

// Apply locker grouping optimization to group customers using the same locker
static void apply_locker_grouping_optimization(ALNSSolution& solution, const VRPInstance& instance) {
    auto& perm = solution.perm;
    auto& c2n = solution.c2n;
    
    bool improved = true;
    int max_iterations = 3; // Limit iterations to avoid infinite loops
    int iteration = 0;
    
    while (improved && iteration < max_iterations) {
        improved = false;
        iteration++;
        
        // Scan for patterns: locker_cust_A -> home_cust_B -> locker_cust_C (same locker)
        for (int i = 0; i < (int)perm.size() - 2; i++) {
            if (perm[i] == 0) continue; // skip depot
            
            int cust_A = perm[i];
            int cust_B = perm[i + 1];
            int cust_C = perm[i + 2];
            
            if (cust_B == 0 || cust_C == 0) continue; // don't cross route boundaries
            
            int node_A = c2n[cust_A];
            int node_B = c2n[cust_B];
            int node_C = c2n[cust_C];
            
            // Check pattern: locker -> home -> locker (same locker)
            if (is_locker_delivery(node_A, instance) && 
                !is_locker_delivery(node_B, instance) && 
                is_locker_delivery(node_C, instance) &&
                node_A == node_C) {
                
                // Try switching customer B to the same locker
                if (can_use_locker(cust_B, node_A, instance)) {
                    c2n[cust_B] = node_A;
                    improved = true;
                    continue;
                }
                
                // Try swapping positions of B and C
                std::swap(perm[i + 1], perm[i + 2]);
                improved = true;
            }
        }
        
        // Additional pattern: look for flexible customers (type 3) between lockers and try to group them
        for (int i = 0; i < (int)perm.size() - 1; i++) {
            if (perm[i] == 0) continue;
            
            int cust_A = perm[i];
            int node_A = c2n[cust_A];
            
            // If customer A uses a locker, look for nearby flexible customers to group
            if (is_locker_delivery(node_A, instance)) {
                for (int j = i + 1; j < std::min(i + 5, (int)perm.size()); j++) {
                    if (perm[j] == 0) break; // don't cross route boundaries
                    
                    int cust_B = perm[j];
                    int customer_idx_B = cust_B - 1;
                    
                    // Check if customer B is flexible (type 3) and not using the same locker
                    if (customer_idx_B >= 0 && customer_idx_B < instance.num_customers &&
                        instance.customers[customer_idx_B]->customer_type == 3 &&
                        c2n[cust_B] != node_A &&
                        can_use_locker(cust_B, node_A, instance)) {
                        
                        c2n[cust_B] = node_A;
                        improved = true;
                    }
                }
            }
        }
    }
}

// Apply SA-style neighborhood moves for local optimization
static void apply_sa_style_moves(ALNSSolution& solution, const VRPInstance& instance, std::mt19937& gen, int min_moves) {
    auto& perm = solution.perm;
    auto& c2n = solution.c2n;
    
    // Collect non-depot customers for neighborhood operations
    std::vector<int> customer_indices;
    for (int i = 0; i < (int)perm.size(); i++) {
        if (perm[i] != 0) {
            customer_indices.push_back(i);
        }
    }
    
    if (customer_indices.size() < 2) return;
    
    std::uniform_real_distribution<> prob(0.0, 1.0);
    std::uniform_int_distribution<> idx_dist(0, customer_indices.size() - 1);
    
    int num_moves = std::max(min_moves, (int)customer_indices.size()); // Limit number of moves
    
    for (int move = 0; move < num_moves; move++) {
        double current_fitness = solution.fitness;
        ALNSSolution trial = solution;
        
        double r = prob(gen);
        
        if (r <= 1.0/3) {
            // Swap move
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j) {
                int pos_i = customer_indices[i];
                int pos_j = customer_indices[j];
                std::swap(trial.perm[pos_i], trial.perm[pos_j]);
            }
        } else if (r <= 2.0/3) {
            // Relocate move
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j) {
                int pos_i = customer_indices[i];
                int pos_j = customer_indices[j];
                int customer = trial.perm[pos_i];
                trial.perm.erase(trial.perm.begin() + pos_i);
                // Adjust position after removal
                if (pos_j > pos_i) pos_j--;
                trial.perm.insert(trial.perm.begin() + pos_j, customer);
            }
        } else {
            // 2-opt move (reverse segment)
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j) {
                int pos_i = customer_indices[i];
                int pos_j = customer_indices[j];
                if (pos_i > pos_j) std::swap(pos_i, pos_j);
                std::reverse(trial.perm.begin() + pos_i, trial.perm.begin() + pos_j + 1);
            }
        }
        
        // Evaluate the trial solution
        trial.fitness = Solver::evaluate(instance, trial.perm, trial.c2n, false).objective_value;
        
        // Accept if improvement found
        if (trial.fitness < current_fitness) {
            solution = trial;
            // Update customer indices for next iteration
            customer_indices.clear();
            for (int i = 0; i < (int)solution.perm.size(); i++) {
                if (solution.perm[i] != 0) {
                    customer_indices.push_back(i);
                }
            }
        }
    }
}

// Apply comprehensive local search including SA-style neighborhood moves
static void apply_local_search(ALNSSolution& solution, const VRPInstance& instance, std::mt19937& gen, const ALNSParams& params) {
    auto& perm = solution.perm;
    auto& c2n = solution.c2n;
    
    // Phase 1: Locker grouping optimization
    apply_locker_grouping_optimization(solution, instance);
    
    // Phase 2: SA-style neighborhood moves
    if (params.enable_sa_moves) {
        apply_sa_style_moves(solution, instance, gen, params.min_local_moves);
    }
}
// ---- Destroy Operators -------------------------------------------------------------
// Random removal: remove a fraction of customers uniformly at random.
static void destroy_random(ALNSSolution& s, const VRPInstance& instance, std::mt19937& gen) {
    (void)instance;
    // Collect customers present (non-zero)
    std::vector<int> customers;
    customers.reserve(s.perm.size());
    for (int v : s.perm) if (v!=0) customers.push_back(v);
    if (customers.empty()) return;
    // Decide number to remove: 20% (at least 1)
    int to_remove = std::max(1, (int)(0.2 * customers.size()));
    std::shuffle(customers.begin(), customers.end(), gen);
    customers.resize(to_remove);
    // Remove from permutation
    for (int c : customers) {
        auto it = std::find(s.perm.begin(), s.perm.end(), c);
        if (it!=s.perm.end()) { s.perm.erase(it); s.removed.push_back(c); }
    }
}
// Related (Shaw-style simplified) removal: pick a random seed customer then remove the most "related" (closest) customers.
static void destroy_related(ALNSSolution& s, const VRPInstance& instance, std::mt19937& gen) {
    // Collect current customers (exclude zeros)
    std::vector<int> customers; customers.reserve(s.perm.size());
    for (int g : s.perm) if (g!=0) customers.push_back(g);
    if (customers.size() <= 1) return;
    std::uniform_int_distribution<> seed_dist(0, (int)customers.size()-1);
    int seed = customers[seed_dist(gen)];
    // Determine how many to remove (up to 20% like random removal)
    int max_remove = std::max(1, (int)(0.2 * customers.size()));
    // Build relatedness scores (lower = more related). Use distance between assigned delivery nodes.
    // Access delivery node via s.c2n mapping (fallback to customer id if not found).
    int seed_node = seed; auto itSeed = s.c2n.find(seed); if (itSeed!=s.c2n.end()) seed_node = itSeed->second;
    extern const VRPInstance* __alns_instance_ptr; // forward (will not be used; placeholder if design changes)
    std::shuffle(customers.begin(), customers.end(), gen);
    // Ensure seed at front
    auto seed_it = std::find(customers.begin(), customers.end(), seed);
    if (seed_it != customers.end()) std::iter_swap(customers.begin(), seed_it);
    int to_remove = std::min(max_remove, (int)customers.size()-1); // keep at least seed removed set sized properly
    std::vector<int> removal(customers.begin()+1, customers.begin()+1+to_remove); // exclude seed to keep seed in solution? Often seed also removed; choose to remove seed too
    removal.push_back(seed); // also remove seed (common in related removal)
    // Remove selected
    for (int c : removal) {
        auto it = std::find(s.perm.begin(), s.perm.end(), c);
        if (it!=s.perm.end()) { s.perm.erase(it); s.removed.push_back(c); }
    }
}
// Worst-cost removal: remove customers with highest removal cost impact
static void destroy_worst(ALNSSolution& s, const VRPInstance& instance, std::mt19937& gen) {
    (void)gen;
    s.removed.clear();
    if (s.perm.size() < 3) return;
    const auto& D = instance.distance_matrix;
    struct Cand { int cust; double impact; };
    std::vector<Cand> cands;

    bool has_delimiters = false;
    for(int node : s.perm) {
        if (node == 0) {
            has_delimiters = true;
            break;
        }
    }

    if (has_delimiters) {
        int start = -1;
        for (int i=0;i<(int)s.perm.size();++i) {
            if (s.perm[i]==0) {
                if (start==-1) { start = i; continue; }
                // route from start to i (inclusive end zero)
                for (int pos = start+1; pos < i; ++pos) {
                    int cust = s.perm[pos]; if (cust==0) continue;
                    int prev = s.perm[pos-1];
                    int next = s.perm[pos+1];
                    double impact = D[prev][cust] + D[cust][next] - D[prev][next];
                    cands.push_back({cust, impact});
                }
                start = i; // next route starts here
            }
        }
    } else { // No delimiters, treat as a single tour
        for (size_t i = 0; i < s.perm.size(); ++i) {
            int cust = s.perm[i];
            int prev = s.perm[(i == 0) ? s.perm.size() - 1 : i - 1];
            int next = s.perm[(i == s.perm.size() - 1) ? 0 : i + 1];
            double impact = D[prev][cust] + D[cust][next] - D[prev][next];
            cands.push_back({cust, impact});
        }
    }

    if (cands.empty()) return;
    std::sort(cands.begin(), cands.end(), [](const Cand& a, const Cand& b){ return a.impact > b.impact; });
    int to_remove = std::max(1, (int)(0.2 * cands.size()));
    for (int k=0; k<to_remove && k<(int)cands.size(); ++k) {
        int cust = cands[k].cust;
        for (auto it = s.perm.begin(); it != s.perm.end(); ++it) {
            if (*it == cust) { s.perm.erase(it); s.removed.push_back(cust); break; }
        }
    }
    // Clean consecutive zeros
    if(has_delimiters) {
        std::vector<int> cleaned; cleaned.reserve(s.perm.size()); int prev=-1;
        for (int v : s.perm) { if (v==0 && prev==0) continue; cleaned.push_back(v); prev=v; }
        if (cleaned.empty() || cleaned.front()!=0) cleaned.insert(cleaned.begin(),0);
        if (cleaned.back()!=0) cleaned.push_back(0);
        s.perm.swap(cleaned);
    }
}

// Utility: compute best insertion positions for a customer; returns vector of (index_before_insert, cost)
static std::vector<std::pair<int,double>> compute_insertion_costs(const ALNSSolution& s, int cust, const VRPInstance& instance) {
    const auto& D = instance.distance_matrix;
    std::vector<std::pair<int,double>> positions; // (i, delta) inserting after i
    if (s.perm.size()<2) return positions;
    for (int i=0;i<(int)s.perm.size()-1;++i) {
        int a = s.perm[i];
        int b = s.perm[i+1];
        // Avoid inserting between two consecutive zeros multiple times? allowed.
        double delta = D[a][cust] + D[cust][b] - D[a][b];
        positions.emplace_back(i, delta);
    }
    std::sort(positions.begin(), positions.end(), [](auto& x, auto& y){ return x.second < y.second; });
    return positions;
}
static void insert_customer_at(ALNSSolution& s, int cust, int index_before) {
    // Insert cust after position index_before
    s.perm.insert(s.perm.begin()+index_before+1, cust);
}
// Random-customer best-position repair: pick a random removed customer, insert at its best position.
static void repair_random(ALNSSolution& s, const VRPInstance& instance, std::mt19937& gen) {
    while (!s.removed.empty()) {
        if (s.perm.size() < 2) { // ensure at least a starting and ending depot
            if (s.perm.empty() || s.perm.front()!=0) s.perm.insert(s.perm.begin(),0);
            if (s.perm.back()!=0) s.perm.push_back(0);
        }
        std::uniform_int_distribution<> pick(0, (int)s.removed.size()-1);
        int idx = pick(gen);
        int cust = s.removed[idx];
        auto positions = compute_insertion_costs(s, cust, instance);
        if (positions.empty()) {
            // Fallback: insert after first node (after depot)
            s.perm.insert(s.perm.begin()+1, cust);
        } else {
            insert_customer_at(s, cust, positions[0].first);
        }
        s.removed.erase(s.removed.begin()+idx);
    }
}
// Regret-based repair (regret-2): choose customer with max (cost2 - cost1), insert at best position.
static void repair_regret(ALNSSolution& s, const VRPInstance& instance, std::mt19937& gen) {
    (void)gen;
    while (!s.removed.empty()) {
        double best_regret = -1.0; int select_cust=-1; int select_pos=-1; size_t select_idx=0;
        for (size_t idx=0; idx<s.removed.size(); ++idx) {
            int cust = s.removed[idx];
            auto positions = compute_insertion_costs(s, cust, instance);
            if (positions.empty()) continue;
            double cost1 = positions[0].second;
            double cost2 = positions.size()>1 ? positions[1].second : cost1; // if only one place, regret 0
            double regret = cost2 - cost1; // higher regret => prioritize
            // Tie-break by lower best insertion cost
            if (regret > best_regret || (std::abs(regret-best_regret)<1e-9 && cost1 < (select_pos==-1?1e18:positions[0].second))) {
                best_regret = regret; select_cust = cust; select_pos = positions[0].first; select_idx = idx; }
        }
        if (select_cust==-1) {
            // Fallback: random insert first removed just after first zero
            int fallback = s.removed.back(); s.removed.pop_back();
            s.perm.insert(s.perm.begin()+1, fallback); // after initial depot
            continue;
        }
        insert_customer_at(s, select_cust, select_pos);
        s.removed.erase(s.removed.begin()+select_idx);
    }
}

using DestroyOp = void(*)(ALNSSolution&, const VRPInstance&, std::mt19937&);
using RepairOp  = void(*)(ALNSSolution&, const VRPInstance&, std::mt19937&);

static ALNSSolution iterate(const VRPInstance& instance, const ALNSParams& params, int verbose, std::vector<double>* conv_hist=nullptr) {
    std::mt19937 gen(std::random_device{}());
    // Initial solution via random_init
    std::vector<int> perm; std::unordered_map<int,int> c2n;
    utils::no_delim_init(instance, perm, c2n, params.p);
    ALNSSolution best = evaluate_sol(instance, perm, c2n);
    ALNSSolution current = best;

    // Operator lists
    std::vector<DestroyOp> destroy_ops = { destroy_random, destroy_worst, destroy_related };
    std::vector<RepairOp>  repair_ops  = { repair_random, repair_regret };
    std::vector<OperatorScore> destroy_scores(destroy_ops.size());
    std::vector<OperatorScore> repair_scores(repair_ops.size());

    std::uniform_real_distribution<> ru(0.0,1.0);
    auto select_index = [&](std::vector<OperatorScore>& scores){
        double total=0; for (auto& sc: scores) total += sc.weight; double r = ru(gen)*total; double acc=0; for (size_t i=0;i<scores.size();++i){ acc+=scores[i].weight; if (r<=acc) return (int)i; } return (int)scores.size()-1; };

    double T = params.init_temp;

    for (int it=0; it<params.iterations; ++it) {
        int d_idx = select_index(destroy_scores); // Select destroy operators based on weight
        int r_idx = select_index(repair_scores); // Select prepair operators based on weight
        ALNSSolution trial = current; // copy
        if (verbose >= 3 && (it%100==0)) {
            std::cout << "[ALNS] iter " << it << " selected destroy_op=" << d_idx << " repair_op=" << r_idx << "\n";
        }
    destroy_ops[d_idx](trial, instance, gen);
        if (verbose >= 3) {
            std::cout << "  [DEBUG] After destroy: ";
            for(int customer : trial.perm) std::cout << customer << " ";
            std::cout << "| Removed: ";
            for(int customer : trial.removed) std::cout << customer << " ";
            std::cout << std::endl;
        }
        repair_ops[r_idx](trial, instance, gen);
        if (verbose >= 3) {
            std::cout << "  [DEBUG] After repair:  ";
            for(int customer : trial.perm) std::cout << customer << " ";
            std::cout << std::endl;
        }
        
        // Apply comprehensive local search (locker grouping + SA-style moves)
        if (params.enable_locker_grouping && (it % params.local_search_frequency == 0)) {
            apply_local_search(trial, instance, gen, params);
            if (verbose >= 3) {
                std::cout << "  [DEBUG] After local search:  ";
                for(int customer : trial.perm) std::cout << customer << " ";
                std::cout << std::endl;
            }
        }
        
        // Re-evaluate (placeholder: full rebuild already inside ops ideally)
        trial.fitness = Solver::evaluate(instance, trial.perm, trial.c2n, false).objective_value;
        double delta = trial.fitness - current.fitness;
        bool improvement = delta < 0;
        bool accept = improvement;
        if (!improvement && T > 0.0) {
            double prob = std::exp(-delta / T);
            if (ru(gen) < prob) accept = true;
        }
        if (accept) current = trial;
        if (trial.fitness < best.fitness) { // Best reward found
            best = trial;
            destroy_scores[d_idx].score += params.reward_1;
            repair_scores[r_idx].score += params.reward_1;
        } else if (accept) {
            destroy_scores[d_idx].score += params.reward_2;
            repair_scores[r_idx].score += params.reward_2;
        } else {
            destroy_scores[d_idx].score += params.reward_3;
            repair_scores[r_idx].score += params.reward_3;
        }
        // Update the destroy weights and repair weights
        destroy_scores[d_idx].usage++; repair_scores[r_idx].usage++;
        // Periodic weight update
        if ((it+1)%50==0) {
            for (auto* vec : { &destroy_scores, &repair_scores }) {
                for (auto& sc : *vec) {
                    if (sc.usage>0) sc.weight = sc.weight*params.w_decay + (1-params.w_decay)*(sc.score / sc.usage);
                    sc.score=0; sc.usage=0;
                }
            }
        }
    if (verbose>=2 && (it%100==0)) std::cout << "[ALNS] iter " << it << " T=" << T << " best=" << best.fitness << " current=" << current.fitness << " trial=" << trial.fitness << "\n";
    if (conv_hist && (it % 10000 == 0)) conv_hist->push_back(best.fitness);
        // Cooling & stopping checks
        if (T > params.min_temp) T *= params.cooling;
        // if (T < params.min_temp) {
        //     if (verbose>=2) std::cout << "[ALNS] temperature threshold reached -> stop at iter " << it << "\n";
        //     break;
        // }
    }
    return best;
}

Solution ALNS::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    (void)history; // history not yet used
    ALNSParams params;
    if (params_node["iterations"]) params.iterations = params_node["iterations"].as<int>();
    if (params_node["p"]) params.p = params_node["p"].as<double>();
    if (params_node["w_decay"]) params.w_decay = params_node["w_decay"].as<double>();
    if (params_node["reward_1"]) params.reward_1 = params_node["reward_1"].as<double>();
    if (params_node["reward_2"]) params.reward_2 = params_node["reward_2"].as<double>();
    if (params_node["reward_3"]) params.reward_3 = params_node["reward_3"].as<double>();
    if (params_node["init_temp"]) params.init_temp = params_node["init_temp"].as<double>();
    if (params_node["cooling"]) params.cooling = params_node["cooling"].as<double>();
    if (params_node["min_temp"]) params.min_temp = params_node["min_temp"].as<double>();
    if (params_node["enable_locker_grouping"]) params.enable_locker_grouping = params_node["enable_locker_grouping"].as<bool>();
    if (params_node["enable_sa_moves"]) params.enable_sa_moves = params_node["enable_sa_moves"].as<bool>();
    if (params_node["local_search_frequency"]) params.local_search_frequency = params_node["local_search_frequency"].as<int>();
    if (params_node["min_local_moves"]) params.min_local_moves = params_node["min_local_moves"].as<int>();
    std::vector<double> convergence_history;
    ALNSSolution best = iterate(instance, params, verbose, history ? &convergence_history : nullptr);
    if (history) {
        try {
            std::filesystem::create_directories("src/output/experiment");
            std::ofstream csv("src/output/experiment/alns.cvr.csv");
            csv << "iter,best_objective\n";
            for (size_t i=0;i<convergence_history.size();++i) {
                csv << (i*10000) << "," << convergence_history[i] << "\n"; // actual iteration number
            }
        } catch(...) { /* silent */ }
    }
    return Solver::evaluate(instance, best.perm, best.c2n, false);
}