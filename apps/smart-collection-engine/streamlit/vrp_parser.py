"""
VRP Instance Parser Module

Parses VRP-PL (Vehicle Routing Problem with Parcel Lockers) instance files.

Instance file format:
- Line 1: <num_customers> <num_lockers>
- Line 2: <num_vehicles> <vehicle_capacity>
- Next <num_customers> lines: <demand>
- Next (1 + num_customers + num_lockers) lines: <x> <y> <earliest> <latest> <service_time> <type>
  - First line: depot (type=0)
  - Next num_customers: customers (type 1=home-only, 2=locker-only, 3=flexible)
  - Last num_lockers: lockers (type=4)
- Next <num_customers> lines: locker assignment matrix (num_lockers columns of 0/1)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple


@dataclass
class Node:
    """Represents a node in the VRP instance."""
    id: int
    x: float
    y: float
    earliest: float
    latest: float
    service_time: float
    node_type: int  # 0=depot, 1=home-only, 2=locker-only, 3=flexible, 4=locker
    demand: int = 0  # Only for customers


@dataclass
class VRPInstance:
    """Parsed VRP instance data."""
    num_customers: int
    num_lockers: int
    num_vehicles: int
    vehicle_capacity: int
    depot: Node
    customers: List[Node]
    lockers: List[Node]
    assignment_matrix: List[List[int]] = field(default_factory=list)
    
    def get_all_nodes(self) -> List[Node]:
        """Return all nodes in order: depot, customers, lockers."""
        return [self.depot] + self.customers + self.lockers


def parse_instance(content: str) -> VRPInstance:
    """
    Parse VRP instance from file content string.
    
    Args:
        content: The raw text content of the instance file
        
    Returns:
        VRPInstance object with all parsed data
        
    Raises:
        ValueError: If the file format is invalid
    """
    # Split and clean lines
    raw_lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
    
    if len(raw_lines) < 3:
        raise ValueError("File too short or malformed")
    
    # Parse header
    try:
        n_customers, n_lockers = map(int, raw_lines[0].split())
        n_vehicles, capacity = map(int, raw_lines[1].split())
    except Exception as e:
        raise ValueError(f"Failed to parse header lines: {e}")
    
    # Parse demands
    offset = 2
    if len(raw_lines) < offset + n_customers:
        raise ValueError("Not enough lines for demands")
    
    try:
        demands = [int(raw_lines[offset + i].split()[0]) for i in range(n_customers)]
    except Exception as e:
        raise ValueError(f"Failed to parse demands: {e}")
    offset += n_customers
    
    # Parse nodes: 1 depot + N customers + L lockers
    nodes_expected = 1 + n_customers + n_lockers
    if len(raw_lines) < offset + nodes_expected:
        raise ValueError("Not enough lines for nodes block")
    
    nodes: List[Node] = []
    for i in range(nodes_expected):
        parts = raw_lines[offset + i].split()
        if len(parts) != 6:
            raise ValueError(
                f"Node line {offset + i + 1} should have 6 columns, got {len(parts)}"
            )
        x, y, e, l, st, t = parts
        node = Node(
            id=i,
            x=float(x),
            y=float(y),
            earliest=float(e),
            latest=float(l),
            service_time=float(st),
            node_type=int(t),
        )
        nodes.append(node)
    offset += nodes_expected
    
    # Assign demands to customers
    depot = nodes[0]
    customers = nodes[1:1 + n_customers]
    lockers = nodes[1 + n_customers:1 + n_customers + n_lockers]
    
    for idx, customer in enumerate(customers):
        customer.demand = demands[idx]
    
    # Parse assignment matrix (optional - may be missing in some files)
    assignment: List[List[int]] = []
    if len(raw_lines) >= offset + n_customers:
        for i in range(n_customers):
            parts = raw_lines[offset + i].split()
            if len(parts) != n_lockers:
                # Skip if format doesn't match
                break
            try:
                row = [int(v) for v in parts]
                assignment.append(row)
            except:
                break
    
    return VRPInstance(
        num_customers=n_customers,
        num_lockers=n_lockers,
        num_vehicles=n_vehicles,
        vehicle_capacity=capacity,
        depot=depot,
        customers=customers,
        lockers=lockers,
        assignment_matrix=assignment,
    )


def parse_instance_file(path: Path) -> VRPInstance:
    """
    Parse VRP instance from file path.
    
    Args:
        path: Path to the instance file
        
    Returns:
        VRPInstance object with all parsed data
    """
    content = path.read_text(encoding="utf-8")
    return parse_instance(content)


def get_node_type_name(node_type: int) -> str:
    """Get human-readable name for node type."""
    names = {
        0: "Depot",
        1: "Home-only",
        2: "Locker-only", 
        3: "Flexible",
        4: "Locker"
    }
    return names.get(node_type, f"Unknown ({node_type})")


def get_node_color(node_type: int) -> str:
    """Get color for node type for visualization."""
    colors = {
        0: "#FF0000",  # Depot: Red
        1: "#2196F3",  # Home-only: Blue
        2: "#FF9800",  # Locker-only: Orange
        3: "#4CAF50",  # Flexible: Green
        4: "#9C27B0",  # Locker: Purple
    }
    return colors.get(node_type, "#757575")


def generate_instance_content(
    num_vehicles: int,
    vehicle_capacity: int,
    depot: dict,
    customers: List[dict],
    lockers: List[dict]
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
        lines.append(str(int(c.get('demand', 0))))
        
    # Nodes
    # Depot (type 0)
    lines.append(f"{depot['x']} {depot['y']} {depot.get('earliest', 0)} {depot.get('latest', 1000)} 0 0")
    
    # Customers
    for c in customers:
        lines.append(
            f"{c['x']} {c['y']} {c['earliest']} {c['latest']} {c['service_time']} {c['type']}"
        )
        
    # Lockers (type 4)
    for l in lockers:
        lines.append(
            f"{l['x']} {l['y']} {l['earliest']} {l['latest']} {l['service_time']} 4"
        )
        
    # Assignment Matrix (Default: all lockers accessible to all customers)
    if n_lockers > 0:
        row = " ".join(["1"] * n_lockers)
        for _ in range(n_customers):
            lines.append(row)
            
    return "\n".join(lines)
