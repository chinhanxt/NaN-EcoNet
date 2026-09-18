#pragma once
#include <string>

class Node {
public:
    int id;
    double x, y;
    int early_time, late_time, service_time;
    int node_type; // 0: depot, 1: type-I, 2: type-II, 3: type-III
    Node(int id_, double x_, double y_, int early, int late, int service, int type);
    virtual ~Node() = default;
};
