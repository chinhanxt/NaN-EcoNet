#pragma once
#include "Node.h"

class Depot : public Node {
public:
    Depot(int id_, double x_, double y_, int early, int late, int service);
};
