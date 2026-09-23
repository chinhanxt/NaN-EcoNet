"""
Waste Collection Routing & AI Incident Resolution Engine.
Supports VRP optimization for garbage trucks and human-in-the-loop incident resolution.
"""

from __future__ import annotations
import math
import requests
from typing import Dict, List, Optional, Tuple, Any

BACKEND_URL = "http://localhost:8000"


def gps_to_meters(lat: float, lon: float, ref_lat: float, ref_lon: float) -> Tuple[float, float]:
    """Convert GPS (lat, lon) to Euclidean meters relative to reference point."""
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * math.cos(math.radians(ref_lat))
    dx = (lon - ref_lon) * meters_per_deg_lon
    dy = (lat - ref_lat) * meters_per_deg_lat
    return dx, dy


def meters_to_gps(dx: float, dy: float, ref_lat: float, ref_lon: float) -> Tuple[float, float]:
    """Convert local meters offset back to GPS (lat, lon)."""
    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * math.cos(math.radians(ref_lat))
    lat = ref_lat + (dy / meters_per_deg_lat)
    lon = ref_lon + (dx / meters_per_deg_lon)
    return lat, lon


def clarke_wright_vrp(
    depot_coords: Tuple[float, float],
    bins: List[Dict[str, Any]],
    num_vehicles: int,
    capacity: float
) -> List[List[int]]:
    """
    Fast, robust Clarke-Wright Savings algorithm with capacity constraints
    for waste collection routing.
    Returns list of routes (each route is a list of bin IDs, starting and ending at 0).
    """
    if not bins:
        return []

    n = len(bins)
    # Node 0 is depot, 1..n are bins
    all_points = [depot_coords] + [(b["x"], b["y"]) for b in bins]
    demands = [0] + [b.get("demand", 10) for b in bins]

    def dist(i: int, j: int) -> float:
        p1, p2 = all_points[i], all_points[j]
        return math.hypot(p1[0] - p2[0], p1[1] - p2[1])

    # Calculate savings S(i, j) = d(0, i) + d(0, j) - d(i, j)
    savings = []
    for i in range(1, n + 1):
        for j in range(i + 1, n + 1):
            s = dist(0, i) + dist(0, j) - dist(i, j)
            urgency_bonus = 0.0
            if bins[i - 1].get("has_smell"):
                urgency_bonus += 150.0
            if bins[j - 1].get("has_smell"):
                urgency_bonus += 150.0
            savings.append((s + urgency_bonus, i, j))

    savings.sort(key=lambda x: x[0], reverse=True)

    # Initially, each bin is its own route: 0 -> i -> 0
    routes = {i: [i] for i in range(1, n + 1)}
    route_loads = {i: demands[i] for i in range(1, n + 1)}
    node_to_route = {i: i for i in range(1, n + 1)}

    for s, i, j in savings:
        r_i = node_to_route[i]
        r_j = node_to_route[j]

        if r_i == r_j:
            continue

        route_i = routes[r_i]
        route_j = routes[r_j]

        # Check capacity
        if route_loads[r_i] + route_loads[r_j] > capacity:
            continue

        # Check if i and j are at the exterior of their respective routes
        can_merge = False
        new_route = None

        if route_i[-1] == i and route_j[0] == j:
            can_merge = True
            new_route = route_i + route_j
        elif route_j[-1] == j and route_i[0] == i:
            can_merge = True
            new_route = route_j + route_i
        elif route_i[0] == i and route_j[0] == j:
            can_merge = True
            new_route = route_i[::-1] + route_j
        elif route_i[-1] == i and route_j[-1] == j:
            can_merge = True
            new_route = route_i + route_j[::-1]

        if can_merge and new_route:
            routes[r_i] = new_route
            route_loads[r_i] += route_loads[r_j]
            del routes[r_j]
            del route_loads[r_j]
            for node in new_route:
                node_to_route[node] = r_i

    # Collect and format routes (wrap with depot 0)
    raw_routes = []
    for r_nodes in routes.values():
        if r_nodes:
            raw_routes.append([0] + r_nodes + [0])

    # If number of routes exceeds available vehicles, merge smallest
    while len(raw_routes) > num_vehicles and len(raw_routes) > 1:
        raw_routes.sort(key=len)
        r1 = raw_routes.pop(0)
        # Append inner nodes to next route
        raw_routes[0] = [0] + r1[1:-1] + raw_routes[0][1:]

    # If number of routes is fewer than available vehicles, split longest routes
    while len(raw_routes) < num_vehicles and len(raw_routes) < len(bins):
        candidates = [r for r in raw_routes if len(r) > 3]
        if not candidates:
            break
        candidates.sort(key=len, reverse=True)
        longest = candidates[0]
        inner_stops = longest[1:-1]
        mid = len(inner_stops) // 2
        r_part1 = [0] + inner_stops[:mid] + [0]
        r_part2 = [0] + inner_stops[mid:] + [0]
        raw_routes.remove(longest)
        raw_routes.append(r_part1)
        raw_routes.append(r_part2)

    return raw_routes


def solve_waste_vrp(
    depot: Dict[str, Any],
    bins: List[Dict[str, Any]],
    num_vehicles: int = 2,
    vehicle_capacity: float = 500.0,
    vehicles: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Solve the Waste Collection routing problem.
    Tries PACO solver backend first, falls back to Clarke-Wright algorithm.
    """
    ref_lat = depot["lat"]
    ref_lon = depot["lon"]

    # Calculate local (x, y) coordinates in meters
    depot_x, depot_y = 0.0, 0.0
    processed_bins = []
    for i, b in enumerate(bins, start=1):
        dx, dy = gps_to_meters(b["lat"], b["lon"], ref_lat, ref_lon)
        processed_bins.append({
            "id": b.get("id", i),
            "internal_idx": i,
            "x": dx,
            "y": dy,
            "lat": b["lat"],
            "lon": b["lon"],
            "demand": b.get("demand", int(b.get("fill_level", 80) * 0.5)),
            "fill_level": b.get("fill_level", 80),
            "has_smell": bool(b.get("has_smell", False)),
            "address": b.get("address", f"Thùng rác #{b.get('id', i)}"),
        })

    # Try PACO solver via backend if available
    solution_routes = None
    total_objective = 0.0

    try:
        customers_payload = [
            {
                "x": b["x"] / 10.0,
                "y": b["y"] / 10.0,
                "demand": b["demand"],
                "earliest": 0.0,
                "latest": 1000.0,
                "service_time": 5.0,
                "type": 1
            }
            for b in processed_bins
        ]
        depot_payload = {"x": 0.0, "y": 0.0, "earliest": 0.0, "latest": 1000.0}

        resp = requests.post(
            f"{BACKEND_URL}/solve/manual",
            json={
                "num_vehicles": num_vehicles,
                "vehicle_capacity": int(vehicle_capacity),
                "depot": depot_payload,
                "customers": customers_payload,
                "lockers": [],
                "solver": "paco",
                "size": "small"
            },
            timeout=8
        )
        if resp.status_code == 200:
            res_data = resp.json()
            if res_data.get("success") and res_data.get("raw_routes"):
                solution_routes = res_data["raw_routes"]
                total_objective = res_data.get("objective", 0.0) * 10.0  # Scale back to meters
    except Exception:
        pass

    # Fallback to Clarke-Wright algorithm if PACO not available
    if not solution_routes:
        solution_routes = clarke_wright_vrp(
            depot_coords=(depot_x, depot_y),
            bins=processed_bins,
            num_vehicles=num_vehicles,
            capacity=vehicle_capacity
        )

    # Ensure available vehicles are utilized if there are enough bins
    while len(solution_routes) < num_vehicles and len(solution_routes) < len(processed_bins):
        candidates = [r for r in solution_routes if len(r) > 3]
        if not candidates:
            break
        candidates.sort(key=len, reverse=True)
        longest = candidates[0]
        inner_stops = longest[1:-1]
        mid = len(inner_stops) // 2
        r_part1 = [0] + inner_stops[:mid] + [0]
        r_part2 = [0] + inner_stops[mid:] + [0]
        solution_routes.remove(longest)
        solution_routes.append(r_part1)
        solution_routes.append(r_part2)

    # Map routes to original bin objects and GPS coordinates
    idx_to_bin = {b["internal_idx"]: b for b in processed_bins}
    routes_details = []
    total_dist_km = 0.0

    for r_idx, route_indices in enumerate(solution_routes):
        v_info = vehicles[r_idx] if (vehicles and r_idx < len(vehicles)) else None
        v_name = v_info.get("name", f"Xe thu gom #{r_idx + 1}") if v_info else f"Xe thu gom #{r_idx + 1}"
        v_cap = v_info.get("capacity", vehicle_capacity) if v_info else vehicle_capacity
        v_id = v_info.get("id", r_idx + 1) if v_info else (r_idx + 1)
        v_color = v_info.get("color") if v_info else None

        # Vehicle start position: either custom (v_lat, v_lon) or depot
        start_lat = v_info.get("lat", depot["lat"]) if v_info else depot["lat"]
        start_lon = v_info.get("lon", depot["lon"]) if v_info else depot["lon"]

        route_stops = []
        route_coords = []
        current_load = 0
        route_length_m = 0.0

        prev_point = (start_lon, start_lat)
        route_coords.append(prev_point)
        route_stops.append({"type": "start", "id": v_id, "name": f"Điểm xuất phát ({v_name})", "lat": start_lat, "lon": start_lon})

        for node_idx in route_indices[1:-1]:
            if node_idx in idx_to_bin:
                b = idx_to_bin[node_idx]
                curr_point = (b["lon"], b["lat"])
                route_coords.append(curr_point)
                current_load += b["demand"]
                route_stops.append({
                    "type": "bin",
                    "id": b["id"],
                    "address": b["address"],
                    "demand": b["demand"],
                    "fill_level": b["fill_level"],
                    "has_smell": b.get("has_smell", False),
                    "lat": b["lat"],
                    "lon": b["lon"]
                })
                # Euclidean distance approx
                route_length_m += math.hypot(b["x"] - (0 if len(route_stops) == 2 else idx_to_bin[route_indices[len(route_stops)-2]]["x"]),
                                             b["y"] - (0 if len(route_stops) == 2 else idx_to_bin[route_indices[len(route_stops)-2]]["y"]))

        # Return to depot for unloading
        route_coords.append((depot["lon"], depot["lat"]))
        route_stops.append({"type": "depot", "id": 0, "name": depot.get("name", "Bãi rác trung tâm"), "lat": depot["lat"], "lon": depot["lon"]})

        dist_km = route_length_m / 1000.0 if route_length_m > 0 else 2.5
        total_dist_km += dist_km

        routes_details.append({
            "truck_id": v_id,
            "truck_name": v_name,
            "capacity": v_cap,
            "color": v_color,
            "total_load": current_load,
            "stops_count": len(route_stops) - 2,
            "distance_km": round(dist_km, 2),
            "stops": route_stops,
            "coordinates": route_coords
        })

    return {
        "success": True,
        "total_distance_km": round(total_dist_km, 2),
        "trucks_used": len(routes_details),
        "total_bins": len(processed_bins),
        "routes": routes_details
    }


def resolve_incident(
    incident: Dict[str, Any],
    current_truck_state: Dict[str, Any],
    all_trucks: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    AI Incident Handler:
    - If incident is solvable by AI (e.g. road blocked, minor overflow): resolves automatically.
    - If incident is critical or ambiguous (e.g. engine breakdown, depot closed):
      requests human decision (needs_human: True) and provides specific action options.
    """
    inc_type = incident.get("type", "road_blocked")
    truck_id = current_truck_state.get("truck_id", 1)
    location_desc = incident.get("description", "Vị trí không xác định")

    if inc_type == "road_blocked":
        # AI CAN RESOLVE: Find detour route around blockage
        return {
            "resolved_by_ai": True,
            "needs_human": False,
            "action": "reroute_detour",
            "log": f"🤖 [AI Tự Động]: Phát hiện đường bị chặn tại {location_desc}. AI đã tính toán đường vòng (Detour) né tránh khu vực này và tiếp tục lộ trình đến thùng rác kế tiếp.",
            "detour_applied": True
        }

    elif inc_type == "bin_overflow":
        # Check truck remaining capacity
        current_load = current_truck_state.get("current_load", 100)
        max_cap = current_truck_state.get("capacity", 500)
        extra_waste = incident.get("extra_demand", 60)

        if current_load + extra_waste <= max_cap:
            return {
                "resolved_by_ai": True,
                "needs_human": False,
                "action": "compress_and_collect",
                "log": f"🤖 [AI Tự Động]: Thùng rác phát sinh quá tải thêm +{extra_waste}kg. Tải trọng xe hiện tại ({current_load}/{max_cap}kg) vẫn đủ sức chứa -> AI quyết định bốc toàn bộ lượng rác này.",
                "new_load": current_load + extra_waste
            }
        else:
            # Capacity exceeded -> AI suggests human decision
            return {
                "resolved_by_ai": False,
                "needs_human": True,
                "title": "⚠️ Thùng rác quá tải vượt sức chứa của xe",
                "message": f"Thùng rác phát sinh thêm {extra_waste}kg rác, nhưng Xe #{truck_id} chỉ còn lại {max_cap - current_load}kg sức chứa trống. AI cần ý kiến điều phối viên:",
                "options": [
                    {
                        "id": "collect_partial",
                        "label": f"Chỉ bốc tối đa {max_cap - current_load}kg (vừa đầy xe), phần còn lại để xe khác nhận",
                        "action": "collect_partial"
                    },
                    {
                        "id": "dump_early",
                        "label": "Cho xe về bãi đổ rác ngay lập tức, rồi quay lại lấy tiếp",
                        "action": "dump_early"
                    },
                    {
                        "id": "reassign_truck2",
                        "label": "Bỏ qua điểm này, giao toàn bộ cho Xe số 2 đến xử lý",
                        "action": "reassign_truck2"
                    }
                ]
            }

    elif inc_type == "truck_breakdown":
        # CRITICAL HARDWARE FAILURE: AI CANNOT DECIDE -> ASK HUMAN!
        return {
            "resolved_by_ai": False,
            "needs_human": True,
            "title": "🛑 Sự cố nghiêm trọng: Xe thu gom bị hỏng hóc!",
            "message": f"Xe thu gom #{truck_id} gặp sự cố hỏng động cơ/thủy lực tại {location_desc}. Xe không thể tiếp tục di chuyển. AI xin chỉ đạo từ người điều phối:",
            "options": [
                {
                    "id": "dispatch_rescue",
                    "label": "Điều xe cứu hộ kỹ thuật + xe dự phòng #3 đến kéo xe và tiếp quản tuyến đường",
                    "action": "dispatch_rescue"
                },
                {
                    "id": "split_to_active_trucks",
                    "label": "Chuyển các thùng rác còn lại của xe này chia đều cho các xe khác đang chạy",
                    "action": "split_to_active_trucks"
                },
                {
                    "id": "abort_shift",
                    "label": "Hủy ca làm việc của xe này, đưa các điểm còn lại vào ca sáng mai",
                    "action": "abort_shift"
                }
            ]
        }

    elif inc_type == "depot_closed":
        # DEPOT UNAVAILABLE: ASK HUMAN
        return {
            "resolved_by_ai": False,
            "needs_human": True,
            "title": "🚨 Bãi rác trung tâm tạm dừng tiếp nhận",
            "message": f"Bãi tập kết rác chính thông báo quá tải hoặc bảo trì trạm cân. Xe #{truck_id} đã gom đầy rác và chuẩn bị về. Xin chỉ đạo hướng xử lý:",
            "options": [
                {
                    "id": "redirect_secondary_depot",
                    "label": "Chuyển hướng toàn bộ xe sang Bãi xử lý rác dự phòng số 2 (Đa Phước)",
                    "action": "redirect_secondary_depot"
                },
                {
                    "id": "wait_on_site",
                    "label": "Cho xe tạm dừng tại chỗ chờ bãi rác chính mở cửa lại (dự kiến 30 phút)",
                    "action": "wait_on_site"
                }
            ]
        }

    # Default fallback
    return {
        "resolved_by_ai": True,
        "needs_human": False,
        "action": "continue",
        "log": f"🤖 [AI Tự Động]: Sự cố nhẹ tại {location_desc} đã được phân tích an toàn, xe tiếp tục lộ trình."
    }
