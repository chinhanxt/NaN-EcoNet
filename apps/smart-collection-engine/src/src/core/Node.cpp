#include "Node.h"

Node::Node(int id_, double x_, double y_, int early, int late, int service, int type)
    : id(id_), x(x_), y(y_), early_time(early), late_time(late), service_time(service), node_type(type) {}
