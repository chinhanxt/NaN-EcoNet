#pragma once
#include "Node.h"

class Locker : public Node {
public:
    Locker(int id_, double x_, double y_, int early, int late, int service);
};
