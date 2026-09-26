def generate_instance_content(
    num_vehicles: int,
    vehicle_capacity: int,
    depot: dict,
    customers: list[dict],
    lockers: list[dict],
) -> str:
    """
    Generate VRP instance text content from structured data.

    Args:
        num_vehicles: Number of vehicles
        vehicle_capacity: Capacity of each vehicle
        depot: Dict with keys 'x', 'y', 'earliest', 'latest'
        customers: List of dicts with 'x', 'y', 'demand', 'earliest', 'latest', 'service_time', 'type'
        lockers: List of dicts with 'x', 'y', 'earliest', 'latest', 'service_time'

    Returns:
        String content in standard VRP format
    """
    lines = []
    n_customers = len(customers)
    n_lockers = len(lockers)

    # Header
    lines.append(f"{n_customers} {n_lockers}")
    lines.append(f"{num_vehicles} {vehicle_capacity}")

    # Demands
    for c in customers:
        lines.append(str(int(c.get("demand", 0))))

    # Nodes
    # Depot (type 0)
    lines.append(
        f"{depot['x']} {depot['y']} {depot.get('earliest', 0)} {depot.get('latest', 1000000)} 0 0"
    )

    # Customers
    for c in customers:
        lines.append(
            f"{c['x']} {c['y']} {c.get('earliest', 0)} {c.get('latest', 1000000)} {c.get('service_time', 5)} {c.get('type', 1)}"
        )

    # Lockers (type 4)
    for l in lockers:
        lines.append(
            f"{l['x']} {l['y']} {l.get('earliest', 0)} {l.get('latest', 1000000)} {l.get('service_time', 5)} 4"
        )

    # Assignment Matrix (Default: all lockers accessible to all customers)
    if n_lockers > 0:
        row = " ".join(["1"] * n_lockers)
        for _ in range(n_customers):
            lines.append(row)

    return "\n".join(lines)
