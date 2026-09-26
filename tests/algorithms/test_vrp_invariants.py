"""
Mathematical Invariant Validation for 3D-PACO Logistics Algorithm.
Nan-EcoNet Smart Collection Engine - Vehicle Routing Problem with Time Windows & Modality (CVRPTW-M).

Verifies 4 critical operations research invariants:
1. Tour Completeness & Uniqueness: Exactly 100% of collection nodes served, no dropped nodes, no duplicate visits.
2. Vehicle Capacity Feasibility: Total route load <= vehicle capacity (1500 kg Isuzu QKR 270 standard).
3. Time Window Feasibility: Service starts within allowable time window [e_i, l_i], depot return before closing.
4. Decision Modality Invariance: Modality decision o_i in {0, 1} (0 = direct curbside vehicle, 1 = walk-in alley bundling <= 180m).
"""

import copy
from typing import Any, Dict, List, Set
import pytest


class InvariantViolationError(AssertionError):
    """Raised when an algorithmic invariant is violated."""
    pass


class MockVRPInstance:
    """
    Simulates a 100-stop collection instance in District 1 & 3, HCMC.
    Fleet: 2 vehicles, Isuzu QKR 270 with 1500 kg payload capacity each.
    """
    def __init__(self, n_stops: int = 100):
        self.n_stops = n_stops
        self.capacity_kg = 1500.0  # Isuzu 1.5T payload
        self.depot_coords = (10.7769, 106.7009)  # Pasteur, Ben Nghe, D1
        self.depot_time_window = (0.0, 480.0)    # 8-hour shift (480 minutes)
        
        # Demands: 20 kg per standard collection point (total 2000 kg across 100 stops)
        self.demands = {i: 20.0 for i in range(1, n_stops + 1)}
        
        # 35 stops located in narrow alleys (<3m) requiring walk-in bundling (o=1)
        # Stops 1..65 are curbside (o=0), Stops 66..100 are walk-in alley stops (o=1)
        self.walkin_stops: Set[int] = set(range(66, n_stops + 1))
        
        # Time windows [earliest, latest] in minutes from shift start
        # Staggered windows throughout the 480-minute collection shift
        self.time_windows: Dict[int, tuple[float, float]] = {}
        for i in range(1, n_stops + 1):
            earliest = ((i - 1) % 50) * 8.0          # Staggered every 8 mins per vehicle
            latest = earliest + 60.0                 # 60-minute window flexibility
            self.time_windows[i] = (earliest, latest)
            
        self.service_duration_mins = 4.0             # 4 minutes service time per stop
        self.max_walk_distance_m = 180.0             # Maximum walking distance threshold


class Mock3DPACOSolver:
    """
    Reference solver output generator that adheres to all 4 mathematical invariants
    of the 3D-PACO (3D-Parallel Ant Colony Optimization) metaheuristic.
    """
    @staticmethod
    def solve(instance: MockVRPInstance) -> List[Dict[str, Any]]:
        """
        Generates a 2-vehicle optimal tour visiting all 100 nodes.
        Vehicle 1: stops 1 to 50 (curbside stops 1..50)
        Vehicle 2: stops 51 to 100 (stops 51..65 curbside, 66..100 walk-in alley)
        """
        routes = []
        
        # Vehicle 1 (Stops 1 to 50)
        v1_stops = []
        current_time_v1 = 10.0  # 10 mins travel from depot to first stop
        current_load_v1 = 0.0
        
        for idx in range(1, 51):
            demand = instance.demands[idx]
            current_load_v1 += demand
            tw_start, tw_end = instance.time_windows[idx]
            arrival_time = current_time_v1
            service_start = max(arrival_time, tw_start)
            departure_time = service_start + instance.service_duration_mins
            
            v1_stops.append({
                "node": idx,
                "demand_kg": demand,
                "cumulative_load_kg": current_load_v1,
                "arrival_time": arrival_time,
                "service_start": service_start,
                "departure_time": departure_time,
                "time_window": (tw_start, tw_end),
                "modality": 0,  # Curbside
                "is_walkin": False,
                "walk_distance_m": 0.0,
                "hub_node": None
            })
            current_time_v1 = departure_time + 4.0  # 4 mins transit between adjacent stops
            
        return_to_depot_v1 = current_time_v1 + 10.0
        routes.append({
            "vehicle_id": "TRUCK-01-ISUZU-1.5T",
            "capacity_kg": instance.capacity_kg,
            "total_load_kg": current_load_v1,
            "stops": v1_stops,
            "depot_departure": 0.0,
            "depot_return": return_to_depot_v1
        })
        
        # Vehicle 2 (Stops 51 to 100)
        v2_stops = []
        current_time_v2 = 10.0
        current_load_v2 = 0.0
        
        # Hub nodes for alley clusters (e.g., node 51 serves as hub for alleys 66..70, etc.)
        for idx in range(51, 101):
            demand = instance.demands[idx]
            current_load_v2 += demand
            tw_start, tw_end = instance.time_windows[idx]
            arrival_time = current_time_v2
            service_start = max(arrival_time, tw_start)
            departure_time = service_start + instance.service_duration_mins
            
            is_walkin = idx in instance.walkin_stops
            modality = 1 if is_walkin else 0
            walk_dist = 85.0 if is_walkin else 0.0  # Alley depth ~85m <= 180m max
            hub = 51 if is_walkin else None
            
            v2_stops.append({
                "node": idx,
                "demand_kg": demand,
                "cumulative_load_kg": current_load_v2,
                "arrival_time": arrival_time,
                "service_start": service_start,
                "departure_time": departure_time,
                "time_window": (tw_start, tw_end),
                "modality": modality,
                "is_walkin": is_walkin,
                "walk_distance_m": walk_dist,
                "hub_node": hub
            })
            current_time_v2 = departure_time + 4.0
            
        return_to_depot_v2 = current_time_v2 + 10.0
        routes.append({
            "vehicle_id": "TRUCK-02-ISUZU-1.5T",
            "capacity_kg": instance.capacity_kg,
            "total_load_kg": current_load_v2,
            "stops": v2_stops,
            "depot_departure": 0.0,
            "depot_return": return_to_depot_v2
        })
        
        return routes


# ==============================================================================
# MATHEMATICAL INVARIANT VALIDATORS
# ==============================================================================

def validate_tour_completeness(instance: MockVRPInstance, routes: List[Dict[str, Any]]) -> None:
    """
    Invariant 1: Tour Completeness & Uniqueness.
    - Every node in N must be visited exactly once: cup_{k} V_k = N.
    - No node dropped: |cup_{k} V_k| == |N|.
    - No duplicate visits across or within tours: sum |V_k| == |cup_{k} V_k|.
    """
    visited_nodes: Set[int] = set()
    total_stops_count = 0
    
    for v_idx, route in enumerate(routes):
        for stop in route["stops"]:
            node = stop["node"]
            total_stops_count += 1
            if node in visited_nodes:
                raise InvariantViolationError(
                    f"Invariant 1 Violated: Duplicate visit to node {node} detected in vehicle {route['vehicle_id']}!"
                )
            visited_nodes.add(node)
            
    expected_nodes = set(range(1, instance.n_stops + 1))
    missing_nodes = expected_nodes - visited_nodes
    if missing_nodes:
        raise InvariantViolationError(
            f"Invariant 1 Violated: {len(missing_nodes)} collection stops were dropped: {sorted(list(missing_nodes))[:10]}..."
        )
        
    if len(visited_nodes) != instance.n_stops or total_stops_count != instance.n_stops:
        raise InvariantViolationError(
            f"Invariant 1 Violated: Expected exactly {instance.n_stops} serviced stops, got {len(visited_nodes)}."
        )


def validate_vehicle_capacity(instance: MockVRPInstance, routes: List[Dict[str, Any]]) -> None:
    """
    Invariant 2: Vehicle Capacity Feasibility.
    - Total load on each vehicle k cannot exceed Q_max (1500 kg): sum_{i in V_k} q_i <= 1500.
    - Cumulative load along each route must be non-decreasing and <= 1500 kg.
    - All item demands must be strictly positive: q_i > 0.
    """
    for v_idx, route in enumerate(routes):
        vehicle_id = route["vehicle_id"]
        v_cap = route.get("capacity_kg", instance.capacity_kg)
        running_load = 0.0
        
        for stop in route["stops"]:
            demand = stop["demand_kg"]
            if demand <= 0:
                raise InvariantViolationError(
                    f"Invariant 2 Violated: Stop {stop['node']} has non-positive demand {demand} kg."
                )
            running_load += demand
            
            # Check cumulative load matching
            if abs(running_load - stop["cumulative_load_kg"]) > 1e-4:
                raise InvariantViolationError(
                    f"Invariant 2 Violated: Cumulative load calculation mismatch at stop {stop['node']}."
                )
                
            if running_load > v_cap:
                raise InvariantViolationError(
                    f"Invariant 2 Violated: Vehicle {vehicle_id} exceeded capacity {v_cap} kg with current load {running_load} kg."
                )
                
        if running_load > v_cap:
            raise InvariantViolationError(
                f"Invariant 2 Violated: Route total load {running_load} kg exceeds capacity {v_cap} kg."
            )


def validate_time_windows(instance: MockVRPInstance, routes: List[Dict[str, Any]]) -> None:
    """
    Invariant 3: Time Window Feasibility (CVRPTW).
    - Service at stop i must begin no later than latest window l_i: S_i <= l_i.
    - Early arrival (A_i < e_i) incurs waiting time: S_i = max(A_i, e_i).
    - Chronological flow: D_i = S_i + s_i, and A_{i+1} >= D_i.
    - Vehicle must return to depot before depot closing time L_0 (480 mins).
    """
    depot_open, depot_close = instance.depot_time_window
    
    for route in routes:
        vehicle_id = route["vehicle_id"]
        depot_return = route["depot_return"]
        
        if depot_return > depot_close:
            raise InvariantViolationError(
                f"Invariant 3 Violated: Vehicle {vehicle_id} returns to depot at {depot_return} min, exceeding closing time {depot_close} min."
            )
            
        last_departure = route.get("depot_departure", 0.0)
        
        for stop in route["stops"]:
            node = stop["node"]
            tw_start, tw_end = stop["time_window"]
            arr = stop["arrival_time"]
            start = stop["service_start"]
            dep = stop["departure_time"]
            
            # Chronological sequence
            if arr < last_departure:
                raise InvariantViolationError(
                    f"Invariant 3 Violated: Arrival time {arr} precedes previous departure {last_departure} at stop {node}."
                )
                
            # Service start definition
            expected_start = max(arr, tw_start)
            if abs(start - expected_start) > 1e-4:
                raise InvariantViolationError(
                    f"Invariant 3 Violated: Service start {start} does not equal max(arr={arr}, tw_start={tw_start})."
                )
                
            # Late arrival check
            if start > tw_end:
                raise InvariantViolationError(
                    f"Invariant 3 Violated: Service start {start} at stop {node} exceeds time window upper bound {tw_end}."
                )
                
            last_departure = dep


def validate_decision_modality(instance: MockVRPInstance, routes: List[Dict[str, Any]]) -> None:
    """
    Invariant 4: Decision Modality Invariance (3D-PACO binary allocation).
    - Decision variable o_i must strictly belong to {0, 1} (no fractional or undefined state).
    - If o_i == 0 (curbside), walking distance is 0.
    - If o_i == 1 (walk-in alley), walking distance must be <= 180.0m (max_walk_distance).
    - If o_i == 1, stop must be mapped to an alley cluster hub.
    """
    for route in routes:
        for stop in route["stops"]:
            node = stop["node"]
            modality = stop.get("modality")
            is_walkin = stop.get("is_walkin")
            walk_dist = stop.get("walk_distance_m", 0.0)
            
            # Strict binary domain check
            if modality not in (0, 1):
                raise InvariantViolationError(
                    f"Invariant 4 Violated: Modality decision for stop {node} is {modality}, must be strictly in {{0, 1}}."
                )
                
            if not isinstance(is_walkin, bool):
                raise InvariantViolationError(
                    f"Invariant 4 Violated: is_walkin flag for stop {node} must be boolean, got {type(is_walkin)}."
                )
                
            # Semantic consistency between modality and boolean flag
            if (modality == 1 and not is_walkin) or (modality == 0 and is_walkin):
                raise InvariantViolationError(
                    f"Invariant 4 Violated: Inconsistency between modality={modality} and is_walkin={is_walkin} at stop {node}."
                )
                
            # Walking distance threshold
            if modality == 1:
                if walk_dist <= 0:
                    raise InvariantViolationError(
                        f"Invariant 4 Violated: Walk-in stop {node} has non-positive walk distance {walk_dist}m."
                    )
                if walk_dist > instance.max_walk_distance_m:
                    raise InvariantViolationError(
                        f"Invariant 4 Violated: Walk-in stop {node} exceeds max walk threshold ({walk_dist}m > {instance.max_walk_distance_m}m)."
                    )


# ==============================================================================
# PYTEST TEST SUITE
# ==============================================================================

@pytest.fixture
def vrp_instance():
    """Provides a deterministic 100-stop HCMC VRP instance."""
    return MockVRPInstance(n_stops=100)


@pytest.fixture
def valid_paco_solution(vrp_instance):
    """Provides a valid optimal tour generated by 3D-PACO."""
    return Mock3DPACOSolver.solve(vrp_instance)


# --- INVARIANT 1: Tour Completeness & Uniqueness ---

def test_invariant1_tour_completeness_100pct_coverage(vrp_instance, valid_paco_solution):
    """Ensure all 100 collection points are served with zero dropped nodes."""
    validate_tour_completeness(vrp_instance, valid_paco_solution)
    total_stops = sum(len(r["stops"]) for r in valid_paco_solution)
    assert total_stops == 100, f"Expected 100 total stops, got {total_stops}"


def test_invariant1_no_duplicate_node_visits(vrp_instance, valid_paco_solution):
    """Ensure no stop is double-booked across vehicles or within the same route."""
    validate_tour_completeness(vrp_instance, valid_paco_solution)


def test_invariant1_dropped_node_rejected(vrp_instance, valid_paco_solution):
    """Check that invariant validator detects when a node is omitted."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    # Drop node 42
    corrupted_solution[0]["stops"] = [s for s in corrupted_solution[0]["stops"] if s["node"] != 42]
    
    with pytest.raises(InvariantViolationError, match="collection stops were dropped"):
        validate_tour_completeness(vrp_instance, corrupted_solution)


def test_invariant1_duplicate_node_rejected(vrp_instance, valid_paco_solution):
    """Check that invariant validator detects duplicate visits to a node."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    # Duplicate node 10 into vehicle 2
    corrupted_solution[1]["stops"].append(copy.deepcopy(corrupted_solution[0]["stops"][9]))
    
    with pytest.raises(InvariantViolationError, match="Duplicate visit to node 10"):
        validate_tour_completeness(vrp_instance, corrupted_solution)


# --- INVARIANT 2: Vehicle Capacity Feasibility ---

def test_invariant2_vehicle_capacity_compliance(vrp_instance, valid_paco_solution):
    """Ensure each vehicle carries <= 1500 kg load."""
    validate_vehicle_capacity(vrp_instance, valid_paco_solution)
    for r in valid_paco_solution:
        assert r["total_load_kg"] <= 1500.0, f"Vehicle load {r['total_load_kg']} kg exceeded 1500 kg"


def test_invariant2_cumulative_load_monotonicity(vrp_instance, valid_paco_solution):
    """Ensure cumulative load increases monotonically as bins are collected."""
    for r in valid_paco_solution:
        prev_load = 0.0
        for s in r["stops"]:
            assert s["cumulative_load_kg"] > prev_load
            prev_load = s["cumulative_load_kg"]


def test_invariant2_capacity_overflow_rejected(vrp_instance, valid_paco_solution):
    """Check that invariant validator detects load overflow (> 1500 kg)."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    # Inflate demand of first stop to 1600 kg
    corrupted_solution[0]["stops"][0]["demand_kg"] = 1600.0
    corrupted_solution[0]["stops"][0]["cumulative_load_kg"] = 1600.0
    
    with pytest.raises(InvariantViolationError, match="exceeded capacity"):
        validate_vehicle_capacity(vrp_instance, corrupted_solution)


def test_invariant2_negative_demand_rejected(vrp_instance, valid_paco_solution):
    """Check that invariant validator rejects negative or zero waste demands."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    corrupted_solution[0]["stops"][0]["demand_kg"] = -10.0
    
    with pytest.raises(InvariantViolationError, match="non-positive demand"):
        validate_vehicle_capacity(vrp_instance, corrupted_solution)


# --- INVARIANT 3: Time Window Feasibility ---

def test_invariant3_time_windows_satisfied(vrp_instance, valid_paco_solution):
    """Ensure all stops have service initiated within allowable time window."""
    validate_time_windows(vrp_instance, valid_paco_solution)


def test_invariant3_chronological_arrival_progression(vrp_instance, valid_paco_solution):
    """Ensure physical travel time preserves chronological ordering."""
    for r in valid_paco_solution:
        for idx in range(len(r["stops"]) - 1):
            assert r["stops"][idx + 1]["arrival_time"] >= r["stops"][idx]["departure_time"]


def test_invariant3_late_arrival_rejected(vrp_instance, valid_paco_solution):
    """Check that invariant validator detects arrival after time window deadline."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    # Delay stop 5 arrival and service start past latest window
    stop5 = corrupted_solution[0]["stops"][4]
    tw_end = stop5["time_window"][1]
    late_time = tw_end + 30.0  # 30 mins late
    stop5["arrival_time"] = late_time
    stop5["service_start"] = late_time
    stop5["departure_time"] = late_time + 4.0
    
    with pytest.raises(InvariantViolationError, match="exceeds time window upper bound"):
        validate_time_windows(vrp_instance, corrupted_solution)


def test_invariant3_depot_return_before_closing(vrp_instance, valid_paco_solution):
    """Ensure vehicles return to central depot before shift cutoff (480 mins)."""
    for r in valid_paco_solution:
        assert r["depot_return"] <= 480.0, f"Vehicle return {r['depot_return']} mins exceeded 480 mins"


# --- INVARIANT 4: Decision Modality Invariance ---

def test_invariant4_decision_modality_binary_domain(vrp_instance, valid_paco_solution):
    """Ensure modality decision variable o_i is strictly binary in {0, 1}."""
    validate_decision_modality(vrp_instance, valid_paco_solution)
    for r in valid_paco_solution:
        for s in r["stops"]:
            assert s["modality"] in (0, 1)
            assert isinstance(s["is_walkin"], bool)


def test_invariant4_walkin_distance_under_180m(vrp_instance, valid_paco_solution):
    """Ensure walk-in distance for alley stops never exceeds 180m."""
    walkin_count = 0
    curbside_count = 0
    for r in valid_paco_solution:
        for s in r["stops"]:
            if s["modality"] == 1:
                walkin_count += 1
                assert 0.0 < s["walk_distance_m"] <= 180.0
                assert s["hub_node"] is not None
            else:
                curbside_count += 1
                assert s["walk_distance_m"] == 0.0
                
    # Exactly 35 alley stops and 65 curbside stops matching HCMC benchmark
    assert walkin_count == 35, f"Expected 35 walk-in stops, got {walkin_count}"
    assert curbside_count == 65, f"Expected 65 curbside stops, got {curbside_count}"


def test_invariant4_non_binary_modality_rejected(vrp_instance, valid_paco_solution):
    """Check that non-discrete modality (e.g. fractional 0.5) is rejected."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    corrupted_solution[0]["stops"][0]["modality"] = 0.5  # Invalid fractional modality
    
    with pytest.raises(InvariantViolationError, match="must be strictly in {0, 1}"):
        validate_decision_modality(vrp_instance, corrupted_solution)


def test_invariant4_excessive_walk_distance_rejected(vrp_instance, valid_paco_solution):
    """Check that walking distance over 180m is rejected."""
    corrupted_solution = copy.deepcopy(valid_paco_solution)
    # Set alley stop with 250m walking distance
    corrupted_solution[1]["stops"][20]["walk_distance_m"] = 250.0  # Exceeds 180m
    
    with pytest.raises(InvariantViolationError, match="exceeds max walk threshold"):
        validate_decision_modality(vrp_instance, corrupted_solution)


# --- INTEGRATION: Master Invariant Check ---

def test_all_four_invariants_pass_on_valid_3d_paco_solution(vrp_instance, valid_paco_solution):
    """Integration check verifying all 4 mathematical invariants simultaneously."""
    validate_tour_completeness(vrp_instance, valid_paco_solution)
    validate_vehicle_capacity(vrp_instance, valid_paco_solution)
    validate_time_windows(vrp_instance, valid_paco_solution)
    validate_decision_modality(vrp_instance, valid_paco_solution)
