#include "Locker.h"

Locker::Locker(int id_, double x_, double y_, int early, int late, int service)
    : Node(id_, x_, y_, early, late, service, 4) {}
