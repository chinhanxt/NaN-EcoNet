#include "Customer.h"

Customer::Customer(int id_, double x_, double y_, int early, int late, int service, int type, int demand_)
    : Node(id_, x_, y_, early, late, service, type), demand(demand_), customer_type(type) {}
