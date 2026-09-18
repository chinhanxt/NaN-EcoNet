#pragma once
#include "Node.h"

class Customer : public Node {
public:
    int demand;
    int customer_type; // 1: home only, 2: locker only, 3: flexible
    Customer(int id_, double x_, double y_, int early, int late, int service, int type, int demand_);
};
