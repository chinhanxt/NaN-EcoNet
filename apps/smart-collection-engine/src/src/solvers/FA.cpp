#include "FA.h"
#include "../core/SolverFactory.h"
#include "../utils.h"
#include <algorithm>
#include <limits>
#include <cmath>
#include <iostream>
#include <fstream>
#include <filesystem>
#include <vector>
#include <random>
#include <numeric>
#include <unordered_map>

namespace {
    SolverRegistrar<FA> registrar("hfa");
}

struct FAParams {
    int pop_size;
    int i_max;
    double c_rate; // Crossover rate
    double m_rate; // Mutation rate
    double p = 0.5; // for type-III assignment
    int ls_intensity = 1;
};

// Solution hfa(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    
// }

// --- Firefly operators (placeholders) -------------------------------------------------
struct Firefly {
    std::vector<int> perm;                // permutation with delimiters
    std::unordered_map<int,int> c2n;      // customer->delivery node
    double fitness = std::numeric_limits<double>::infinity();
    double intensity = 0.0;               // light intensity (higher -> brighter)
};

// Compute Hamming distance between two permutations (optionally ignoring depot delimiters if both have 0 in that position)
static int hamming_distance(const std::vector<int>& a, const std::vector<int>& b) {
    size_t n = std::min(a.size(), b.size());
    int hd = 0;
    for (size_t i = 0; i < n; ++i) {
        if (a[i] == 0 && b[i] == 0) continue; // ignore matching delimiters
        if (a[i] != b[i]) ++hd;
    }
    // Count extra positions if lengths differ
    hd += (int)std::abs((long)a.size() - (long)b.size());
    return hd;
}

// Assign light intensity l_i = Uniform[1, HD_i,best] (if HD < 1 -> 1) as described.
static void assign_light_intensity(std::vector<Firefly>& pop, const Firefly& best, std::mt19937& gen) {
    for (auto& f : pop) {
        int hd = hamming_distance(f.perm, best.perm);
        int upper = std::max(1, hd);
        std::uniform_int_distribution<> dist(1, upper);
        f.intensity = static_cast<double>(dist(gen));
    }
}

static std::vector<int> op_crossover_pmx(const Firefly& a, const Firefly& best, std::mt19937& gen) {
    // PMX over customer genes only; preserve delimiter positions from parent a.
    // Extract customer sequences (non-zero entries)
    std::vector<int> seqA; seqA.reserve(a.perm.size());
    std::vector<int> seqB; seqB.reserve(best.perm.size());
    for (int g : a.perm) if (g != 0) seqA.push_back(g);
    for (int g : best.perm) if (g != 0) seqB.push_back(g);
    size_t k = seqA.size();
    if (k == 0 || k != seqB.size()) return a.perm; // fallback
    std::uniform_int_distribution<> dist(0, (int)k-1);
    int c1 = dist(gen);
    int c2 = dist(gen);
    if (c1 > c2) std::swap(c1,c2);
    // Child customer sequence initialized with -1
    std::vector<int> child(k, -1);
    // Copy slice from parent A
    for (int i = c1; i <= c2; ++i) child[i] = seqA[i];
    // Mapping from A slice to B slice
    auto in_slice = [&](int val){ for (int i=c1;i<=c2;++i) if (seqA[i]==val) return true; return false; };
    // For each position in slice, try to place B gene if not already present
    for (int i = c1; i <= c2; ++i) {
        int geneB = seqB[i];
        if (in_slice(geneB)) continue; // already there via A slice
        // Find position in A where geneB sits
        int pos = -1;
        int lookup = geneB;
        int safety = 0;
        while (safety < (int)k) { // resolve mapping chain
            for (int p=0;p<(int)k;++p) if (seqA[p]==lookup) { pos = p; break; }
            if (pos < c1 || pos > c2) break; // found position outside slice
            // Inside slice: map to corresponding B gene at that position
            lookup = seqB[pos];
            pos = -1;
            ++safety;
        }
        if (pos != -1 && child[pos] == -1) child[pos] = geneB;
    }
    // Fill remaining spots with genes from B in order
    auto exists = [&](int val){ return std::find(child.begin(), child.end(), val) != child.end(); };
    size_t fill_idx = 0;
    for (size_t i = 0; i < k; ++i) {
        if (child[i] != -1) continue;
        while (fill_idx < k && exists(seqB[fill_idx])) ++fill_idx;
        if (fill_idx < k) child[i] = seqB[fill_idx++];
    }
    // Reconstruct full permutation using delimiter layout from parent a
    std::vector<int> result = a.perm;
    size_t cust_ptr = 0;
    for (size_t i=0;i<result.size() && cust_ptr < child.size();++i) {
        if (result[i] != 0) result[i] = child[cust_ptr++];
    }
    return result;
}

static void op_mutation(std::vector<int>& perm, double m_rate, std::mt19937& gen) {
    // Implements only mutation types 2 and 3 (skip type 1 2-h-opt route merging) according to probability m_rate.
    if (perm.size() < 5) return; // nothing meaningful
    std::uniform_real_distribution<> ur(0.0,1.0);
    if (ur(gen) > m_rate) return; // no mutation
    // Identify route boundaries (indices of zeros). Each route: [zero ... zero]
    std::vector<std::pair<int,int>> routes; // [start_idx, end_idx] inclusive, includes starting zero
    int start = -1;
    for (int i=0;i<(int)perm.size();++i) {
        if (perm[i] == 0) {
            if (start == -1) start = i; // start new
            else { // close previous route (end at i)
                routes.emplace_back(start, i);
                start = i; // new route start at same delimiter for next accumulation
            }
        }
    }
    // Ensure last route captured if not ended by extra zero (should end with zero by construction)
    if (!routes.empty() && routes.back().second != (int)perm.size()-1 && perm.back()==0) {
        routes.back().second = (int)perm.size()-1;
    }
    // Filter routes that have at least 2 customers (non-zero) for intra-route swap
    std::vector<int> candidate_routes;
    for (int r=0;r<(int)routes.size();++r) {
        int cust_count = 0;
        for (int i=routes[r].first+1;i<routes[r].second;++i) if (perm[i]!=0) ++cust_count;
        if (cust_count>=1) candidate_routes.push_back(r);
    }
    if (candidate_routes.empty()) return;
    // Decide between mutation 2 (intra-route) and mutation 3 (inter-route)
    bool intra = true;
    if (candidate_routes.size() >= 2) {
        std::uniform_real_distribution<> coin(0.0,1.0);
        intra = coin(gen) < 0.5; // 50% choose intra-route, else inter-route
    }
    if (intra) {
        // Pick a route with at least 2 customers
        std::vector<int> multi_routes;
        for (int r: candidate_routes) {
            int cust_count = 0; for (int i=routes[r].first+1;i<routes[r].second;++i) if (perm[i]!=0) ++cust_count;
            if (cust_count>=2) multi_routes.push_back(r);
        }
        if (multi_routes.empty()) return; // cannot perform
        std::uniform_int_distribution<> pickR(0,(int)multi_routes.size()-1);
        int route_idx = multi_routes[pickR(gen)];
        // Collect customer indices inside the route
        std::vector<int> positions;
        for (int i=routes[route_idx].first+1;i<routes[route_idx].second;++i) if (perm[i]!=0) positions.push_back(i);
        if (positions.size()<2) return;
        std::uniform_int_distribution<> pickPos(0,(int)positions.size()-1);
        int p1 = pickPos(gen);
        int p2 = pickPos(gen);
        if (p1==p2) p2 = (p2+1)%positions.size();
        std::swap(perm[positions[p1]], perm[positions[p2]]);
    } else {
        // Inter-route swap: pick two distinct routes each with at least 1 customer
        if (candidate_routes.size()<2) return;
        std::uniform_int_distribution<> pickR(0,(int)candidate_routes.size()-1);
        int r1 = candidate_routes[pickR(gen)];
        int r2 = candidate_routes[pickR(gen)];
        if (r1==r2) r2 = candidate_routes[(r2+1)%candidate_routes.size()];
        // Collect customer positions for each
        std::vector<int> pos1; for (int i=routes[r1].first+1;i<routes[r1].second;++i) if (perm[i]!=0) pos1.push_back(i);
        std::vector<int> pos2; for (int i=routes[r2].first+1;i<routes[r2].second;++i) if (perm[i]!=0) pos2.push_back(i);
        if (pos1.empty() || pos2.empty()) return;
        std::uniform_int_distribution<> pick1(0,(int)pos1.size()-1);
        std::uniform_int_distribution<> pick2(0,(int)pos2.size()-1);
        int i1 = pos1[pick1(gen)];
        int i2 = pos2[pick2(gen)];
        std::swap(perm[i1], perm[i2]);
    }
}

static void op_local_search_2opt(std::vector<int>& perm, const std::unordered_map<int,int>& c2n, const VRPInstance& instance) {
    if (perm.size() < 4) return;
    const auto& D = instance.distance_matrix;
    
    auto get_node_id = [&](int customer_id) {
        if (customer_id == 0) return 0;
        return c2n.at(customer_id);
    };

    std::vector<int> delim_idx;
    for (size_t i = 0; i < perm.size(); ++i) {
        if (perm[i] == 0) {
            delim_idx.push_back(i);
        }
    }
    if (delim_idx.size() < 2) return;

    for (size_t r = 0; r + 1 < delim_idx.size(); ++r) {
        int start = delim_idx[r];
        int end = delim_idx[r+1];
        if (end - start < 3) continue;

        bool improved = true;
        while (improved) {
            improved = false;
            for (int i = start + 1; i < end; ++i) {
                for (int j = i + 1; j < end; ++j) {
                    int u1 = perm[i-1], v1 = perm[i];
                    int u2 = perm[j], v2 = perm[j+1];

                    int n_u1 = get_node_id(u1);
                    int n_v1 = get_node_id(v1);
                    int n_u2 = get_node_id(u2);
                    int n_v2 = get_node_id(v2);

                    if (D.at(n_u1).at(n_v1) + D.at(n_u2).at(n_v2) > D.at(n_u1).at(n_u2) + D.at(n_v1).at(n_v2) + 1e-9) {
                        std::reverse(perm.begin() + i, perm.begin() + j + 1);
                        improved = true;
                    }
                }
            }
        }
    }
}

static void group_lockers(std::vector<int>& perm, std::unordered_map<int, int>& c2n, const VRPInstance& instance) {
    if (instance.lockers.empty()) return;

    for (size_t i = 1; i < perm.size() - 1; ++i) {
        int prev_cust_id = perm[i-1];
        int curr_cust_id = perm[i];
        int next_cust_id = perm[i+1];

        if (prev_cust_id == 0 || curr_cust_id == 0 || next_cust_id == 0) continue;

        int prev_node = c2n.at(prev_cust_id);
        int curr_node = c2n.at(curr_cust_id);
        int next_node = c2n.at(next_cust_id);

        bool prev_is_locker = prev_node > instance.num_customers;
        bool curr_is_home = curr_node <= instance.num_customers;
        bool next_is_locker = next_node > instance.num_customers;

        if (prev_is_locker && curr_is_home && next_is_locker && prev_node == next_node) {
            const auto& customer = instance.customers[curr_cust_id - 1];

            if (customer->customer_type == 3) { // Flexible customer
                c2n[curr_cust_id] = prev_node;
            } else {
                std::swap(perm[i], perm[i+1]);
            }
        }
    }
}

static void apply_full_local_search(std::vector<int>& perm, std::unordered_map<int, int>& c2n, const VRPInstance& instance, std::mt19937& gen, int intensity) {
    for (int i = 0; i < intensity; ++i) {
        int n = perm.size();
        if (n < 2) return;
        std::uniform_real_distribution<> prob(0.0, 1.0);
        std::uniform_int_distribution<> idx_dist(0, n - 1);

        double r = prob(gen);
        if (r < 0.33) {
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j) std::swap(perm[i], perm[j]);
        } else if (r < 0.66) {
            int i = idx_dist(gen);
            int j = idx_dist(gen);
            if (i != j) {
                int val = perm[i];
                perm.erase(perm.begin() + i);
                perm.insert(perm.begin() + j, val);
            }
        }
        op_local_search_2opt(perm, c2n, instance);
    }
}

static void recompute_fitness(Firefly& f, const VRPInstance& instance) {
    f.fitness = Solver::evaluate(instance, f.perm, f.c2n, true).objective_value;
}

static Solution iterate(const VRPInstance& instance, std::vector<int> seed_perm, std::unordered_map<int,int> seed_c2n, const FAParams& params, bool history, int verbose) {
    (void)history; // history currently unused
    // Initialization
    std::vector<Firefly> pop; pop.reserve(params.pop_size);
    for (int i=0;i<params.pop_size;++i) {
        Firefly f; utils::random_init(instance, f.perm, f.c2n, params.p); recompute_fitness(f, instance); pop.push_back(std::move(f)); }
    auto sort_pop = [&]() { std::sort(pop.begin(), pop.end(), [](const Firefly& a, const Firefly& b){ return a.fitness < b.fitness; }); };
    if (pop.empty()) { Firefly seed{seed_perm, seed_c2n, 0.0}; recompute_fitness(seed, instance); pop.push_back(seed); }
    sort_pop();
    Firefly global_best = pop.front();
    std::mt19937 gen(std::random_device{}());
    std::uniform_real_distribution<> ur(0.0,1.0);
    assign_light_intensity(pop, global_best, gen);
    // Main iteration
    int t=0;
    while (t < params.i_max) {
        for (int i = 1; i < (int)pop.size(); ++i) {
            for (int j = 0; j < i; ++j) {
                // Move only if target is brighter: compare intensity (fallback to fitness)
                if (!(pop[j].intensity > pop[i].intensity || (pop[j].intensity == pop[i].intensity && pop[j].fitness < pop[i].fitness))) continue;
                // if (verbose >= 3) {
                //     std::cout << "[FA] - Attracting " << i << " to " << j << " (intensities: " << pop[i].intensity << " -> " << pop[j].intensity << ")\n";
                // }
                bool do_crossover = ur(gen) < params.c_rate;
                std::vector<int> trial = do_crossover ? op_crossover_pmx(pop[i], global_best, gen) : pop[i].perm;
                
                apply_full_local_search(trial, pop[i].c2n, instance, gen, params.ls_intensity);

                if (ur(gen) < params.m_rate) op_mutation(trial, params.m_rate, gen);
                Firefly candidate = pop[i];
                candidate.perm = std::move(trial);
                recompute_fitness(candidate, instance);
                if (verbose >= 3) {
                    std::cout << "[FA] - Evaluating candidate " << i << " (fitness: " << candidate.fitness << ")\n";
                }
                if (candidate.fitness < pop[i].fitness) pop[i] = std::move(candidate);
            }
        }
        sort_pop();
        if (pop.front().fitness < global_best.fitness) global_best = pop.front();
        if (verbose >= 2) {
            std::cout << "[FA] Iter " << t << " best = " << global_best.fitness << "\n";
        }
    assign_light_intensity(pop, global_best, gen);
        ++t;
    }
    return Solver::evaluate(instance, global_best.perm, global_best.c2n, true);
}

Solution FA::solve(const VRPInstance& instance, const YAML::Node& params_node, bool history, int verbose) {
    FAParams params;
    params.p = params_node["p"].as<double>();
    params.i_max = params_node["i_max"].as<int>();
    params.pop_size = params_node["pop_size"].as<int>();
    params.m_rate = params_node["m_rate"].as<double>();
    params.c_rate = params_node["c_rate"].as<double>();
    if (params_node["ls_intensity"]) {
        params.ls_intensity = params_node["ls_intensity"].as<int>();
    }

    int n = instance.num_customers;
        
    // Initialize customer-to-node mapping
    std::vector<int> customer_perm;
    std::unordered_map<int, int> customer2node;
    utils::random_init(instance, customer_perm, customer2node, params.p);
    // Evaluate the initial solution

    return iterate(instance, customer_perm, customer2node, params, history, verbose);
}