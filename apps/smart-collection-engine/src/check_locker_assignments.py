#!/usr/bin/env python3
"""
Check mismatches between customer type and locker assignment in an instance file.

Rules:
- Customers type 2 (locker-only) or type 3 (home/locker) must have at least one locker assigned.
- If missing, suggest the nearest locker (by Euclidean distance) based on the coordinates of lockers (type 4 nodes).

Input format (per data/readme.txt):
- Line 1: <num_customers> <num_lockers>
- Line 2: <num_vehicles> <vehicle_capacity>
- Next <num_customers> lines: <demand>
- Next (1 + num_customers + num_lockers) lines: <x> <y> <earliest> <latest> <service_time> <type>
  where the first line is the depot (type 0), following num_customers are customers (type 1/2/3),
  and last num_lockers are lockers (type 4).
- Next <num_customers> lines: locker assignment matrix with <num_lockers> columns of 0/1 per customer

Usage:
  python check_locker_assignments.py <path-to-instance>
"""

from __future__ import annotations

import math
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple


@dataclass
class Node:
    x: float
    y: float
    earliest: float
    latest: float
    service_time: float
    node_type: int  # 0=depot, 1=home, 2=locker-only, 3=either, 4=locker


def parse_instance(path: Path) -> Tuple[int, int, int, int, List[int], List[Node], List[List[int]]]:
    text = path.read_text(encoding="utf-8")
    # Split preserving line boundaries; ignore completely empty lines
    raw_lines = [ln.strip() for ln in text.splitlines() if ln.strip() != ""]
    if len(raw_lines) < 3:
        raise ValueError("File too short or malformed")

    # Header
    try:
        n_customers, n_lockers = map(int, raw_lines[0].split())
        _n_vehicles, _veh_cap = map(int, raw_lines[1].split())
    except Exception as e:
        raise ValueError(f"Failed to parse header lines: {e}")

    # Demands
    offset = 2
    if len(raw_lines) < offset + n_customers:
        raise ValueError("Not enough lines for demands")
    try:
        demands = [int(raw_lines[offset + i].split()[0]) for i in range(n_customers)]
    except Exception as e:
        raise ValueError(f"Failed to parse demands: {e}")
    offset += n_customers

    # Nodes: 1 depot + N customers + L lockers
    nodes_expected = 1 + n_customers + n_lockers
    if len(raw_lines) < offset + nodes_expected:
        raise ValueError("Not enough lines for nodes block")
    nodes: List[Node] = []
    for i in range(nodes_expected):
        parts = raw_lines[offset + i].split()
        if len(parts) != 6:
            raise ValueError(
                f"Node line {offset + i + 1} should have 6 columns, got {len(parts)}: {raw_lines[offset + i]}"
            )
        x, y, e, l, st, t = parts
        node = Node(
            x=float(x),
            y=float(y),
            earliest=float(e),
            latest=float(l),
            service_time=float(st),
            node_type=int(t),
        )
        nodes.append(node)
    offset += nodes_expected

    # Assignment matrix: N rows, L columns
    if len(raw_lines) < offset + n_customers:
        raise ValueError("Not enough lines for locker assignment matrix")
    assignment: List[List[int]] = []
    for i in range(n_customers):
        parts = raw_lines[offset + i].split()
        if len(parts) != n_lockers:
            raise ValueError(
                f"Assignment line {offset + i + 1} should have {n_lockers} columns, got {len(parts)}: {raw_lines[offset + i]}"
            )
        try:
            row = [int(v) for v in parts]
        except Exception as e:
            raise ValueError(f"Non-integer in assignment matrix at customer {i+1}: {e}")
        if any(v not in (0, 1) for v in row):
            raise ValueError(f"Assignment row for customer {i+1} contains values other than 0/1: {row}")
        assignment.append(row)

    return n_customers, n_lockers, _n_vehicles, _veh_cap, demands, nodes, assignment


def euclidean(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print("Usage: python check_locker_assignments.py <instance-file>")
        return 2

    path = Path(argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        return 2

    try:
        n_cust, n_lock, _nv, _cap, demands, nodes, assign = parse_instance(path)
    except Exception as e:
        print(f"Error parsing instance: {e}")
        return 2

    # Sanity checks for types
    depot = nodes[0]
    cust_nodes = nodes[1 : 1 + n_cust]
    locker_nodes = nodes[1 + n_cust : 1 + n_cust + n_lock]

    if any(n.node_type != 4 for n in locker_nodes):
        print("Warning: some of the last nodes are not type 4 (lockers). Proceeding anyway.")

    # Precompute locker coords
    locker_coords = [(lk.x, lk.y) for lk in locker_nodes]

    issues = 0
    for idx in range(n_cust):
        node = cust_nodes[idx]
        arow = assign[idx]
        assigned_any = any(v == 1 for v in arow)

        if node.node_type in (2, 3):
            if not assigned_any:
                # Suggest nearest locker
                cx, cy = node.x, node.y
                dists = [euclidean((cx, cy), lc) for lc in locker_coords]
                nearest = min(range(n_lock), key=lambda i: dists[i])
                issues += 1
                print(
                    f"Customer {idx+1} (type={node.node_type}) has no locker assigned. "
                    f"Nearest locker: {nearest+1} at distance {dists[nearest]:.3f}."
                )
        else:
            # Type 1 or others: they shouldn't require locker; if assigned, we note it.
            if assigned_any and node.node_type == 1:
                print(
                    f"Note: Customer {idx+1} is type=1 (home-only) but has locker assignment {arow}."
                )

    if issues == 0:
        print("No mismatches found: all type-2/3 customers have at least one locker assigned.")
    else:
        print(f"Total customers needing locker assignment suggestions: {issues}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
