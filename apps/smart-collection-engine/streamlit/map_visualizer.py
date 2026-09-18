"""
Interactive Map Visualizer using Folium and OpenStreetMap for VRP-PL.
"""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple
import folium
from folium import plugins

from vrp_parser import VRPInstance, Node, get_node_type_name
from solver_api_client import SolverResult

# Anchor cities in Vietnam for GPS projection
ANCHOR_CITIES: Dict[str, Tuple[float, float]] = {
    "TP. Hồ Chí Minh (Trung tâm Q.1)": (10.7769, 106.7009),
    "Hà Nội (Hồ Hoàn Kiếm)": (21.0285, 105.8542),
    "Đà Nẵng (Hải Châu)": (16.0544, 108.2022),
    "Cần Thơ (Bến Ninh Kiều)": (10.0353, 105.7877),
    "Hải Phòng (Nhà hát Lớn)": (20.8601, 106.6823),
}

# Color palette for vehicle routes (high contrast, distinct colors)
ROUTE_COLORS = [
    "#E6194B",  # Red
    "#3CB44B",  # Green
    "#4363D8",  # Blue
    "#F58231",  # Orange
    "#911EB4",  # Purple
    "#42D4F4",  # Cyan
    "#F032E6",  # Magenta
    "#BFEF45",  # Lime
    "#FABED4",  # Pink
    "#469990",  # Teal
    "#DCBEFF",  # Lavender
    "#9A6324",  # Brown
    "#800000",  # Maroon
    "#AAFFC3",  # Mint
    "#000075",  # Navy
]


def project_to_gps(
    x: float,
    y: float,
    ref_lat: float,
    ref_lon: float,
    center_x: float,
    center_y: float,
    scale_meters: float = 100.0,
    is_direct_gps: bool = False,
) -> Tuple[float, float]:
    """
    Project (x, y) coordinates to (latitude, longitude).
    
    If is_direct_gps is True, x and y are treated directly as GPS coordinates.
    Otherwise, applies equirectangular projection centered at (center_x, center_y)
    with reference GPS coordinates (ref_lat, ref_lon).
    """
    if is_direct_gps:
        # If coordinates look like lat/lon or lon/lat
        if 8.0 <= x <= 24.0 and 100.0 <= y <= 112.0:
            return x, y
        if 8.0 <= y <= 24.0 and 100.0 <= x <= 112.0:
            return y, x
        return y, x

    # Equirectangular offset
    dx = (x - center_x) * scale_meters
    dy = (y - center_y) * scale_meters

    meters_per_deg_lat = 111320.0
    meters_per_deg_lon = 111320.0 * math.cos(math.radians(ref_lat))

    lat = ref_lat + (dy / meters_per_deg_lat)
    lon = ref_lon + (dx / meters_per_deg_lon)

    return lat, lon


def create_vrp_map(
    instance: VRPInstance,
    solution: Optional[SolverResult] = None,
    anchor_name: str = "TP. Hồ Chí Minh (Trung tâm Q.1)",
    custom_lat: float = 10.7769,
    custom_lon: float = 106.7009,
    scale_meters: float = 100.0,
    is_direct_gps: bool = False,
    tile_layer: str = "OpenStreetMap",
    animate_routes: bool = True,
    show_stop_numbers: bool = True,
) -> folium.Map:
    """
    Generate an interactive Leaflet/Folium map with OpenStreetMap tiles,
    depot, lockers, customers, and optimized vehicle routes.
    """
    # Determine base GPS anchor
    if anchor_name in ANCHOR_CITIES:
        ref_lat, ref_lon = ANCHOR_CITIES[anchor_name]
    else:
        ref_lat, ref_lon = custom_lat, custom_lon

    all_nodes = instance.get_all_nodes()

    # Calculate center of the instance in Euclidean space (using depot or centroid)
    center_x = instance.depot.x
    center_y = instance.depot.y

    # Pre-calculate GPS coordinates for all nodes
    node_gps: Dict[int, Tuple[float, float]] = {}
    lats: List[float] = []
    lons: List[float] = []

    for node in all_nodes:
        lat, lon = project_to_gps(
            node.x, node.y,
            ref_lat, ref_lon,
            center_x, center_y,
            scale_meters,
            is_direct_gps
        )
        node_gps[node.id] = (lat, lon)
        lats.append(lat)
        lons.append(lon)

    # Initialize Folium Map with Google Maps (Clean, accurate, no nine-dash line)
    m = folium.Map(
        location=[ref_lat, ref_lon],
        zoom_start=13,
        tiles="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
        attr="Google Maps",
        name="Đường phố (Google Maps)",
        control_scale=True,
    )

    # Add Google Maps Satellite & Terrain Tile Layers (Free, high-res, clean of nine-dash line)
    folium.TileLayer(
        tiles="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
        attr="Google Maps",
        name="🛰️ Vệ tinh (Google Satellite)",
    ).add_to(m)

    folium.TileLayer(
        tiles="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
        attr="Google Maps",
        name="🏔️ Địa hình (Google Terrain)",
    ).add_to(m)

    # Plugins
    plugins.Fullscreen(
        position="topright",
        title="Toàn màn hình",
        title_cancel="Thoát toàn màn hình",
        force_separate_button=True
    ).add_to(m)
    plugins.MiniMap(toggle_display=True, position="bottomright").add_to(m)

    # Feature groups for layer control
    fg_routes = folium.FeatureGroup(name="🚚 Tuyến đường xe (Routes)", show=True)
    fg_depot = folium.FeatureGroup(name="🏢 Kho trung tâm (Depot)", show=True)
    fg_lockers = folium.FeatureGroup(name="🗄️ Tủ Parcel Lockers", show=True)
    fg_cust_home = folium.FeatureGroup(name="🏠 Khách nhận tại nhà (Type 1)", show=True)
    fg_cust_locker = folium.FeatureGroup(name="📦 Khách nhận tại Locker (Type 2)", show=True)
    fg_cust_flex = folium.FeatureGroup(name="🔄 Khách hàng linh hoạt (Type 3)", show=True)

    # 1. Plot Depot
    depot_lat, depot_lon = node_gps[instance.depot.id]
    depot_popup = f"""
    <div style="font-family: sans-serif; min-width: 180px;">
        <h4 style="margin: 0 0 6px 0; color: #D32F2F;">🏢 Kho trung tâm (Depot)</h4>
        <b>ID:</b> {instance.depot.id}<br>
        <b>Tọa độ gốc:</b> ({instance.depot.x:.1f}, {instance.depot.y:.1f})<br>
        <b>GPS:</b> {depot_lat:.5f}, {depot_lon:.5f}<br>
        <b>Khung giờ:</b> [{instance.depot.earliest:.0f} - {instance.depot.latest:.0f}]<br>
        <b>Số xe khả dụng:</b> {instance.num_vehicles}<br>
        <b>Sức chứa mỗi xe:</b> {instance.vehicle_capacity}
    </div>
    """
    folium.Marker(
        location=[depot_lat, depot_lon],
        popup=folium.Popup(depot_popup, max_width=300),
        tooltip=f"🏢 Kho Trung Tâm (Depot {instance.depot.id})",
        icon=folium.Icon(color="red", icon="warehouse", prefix="fa"),
        z_index_offset=1000
    ).add_to(fg_depot)

    # 2. Plot Lockers
    for locker in instance.lockers:
        l_lat, l_lon = node_gps[locker.id]
        locker_popup = f"""
        <div style="font-family: sans-serif; min-width: 180px;">
            <h4 style="margin: 0 0 6px 0; color: #7B1FA2;">🗄️ Tủ Parcel Locker #{locker.id}</h4>
            <b>Tọa độ gốc:</b> ({locker.x:.1f}, {locker.y:.1f})<br>
            <b>GPS:</b> {l_lat:.5f}, {l_lon:.5f}<br>
            <b>Khung giờ mở:</b> [{locker.earliest:.0f} - {locker.latest:.0f}]<br>
            <b>Thời gian phục vụ:</b> {locker.service_time:.1f}
        </div>
        """
        folium.Marker(
            location=[l_lat, l_lon],
            popup=folium.Popup(locker_popup, max_width=300),
            tooltip=f"🗄️ Locker #{locker.id}",
            icon=folium.Icon(color="purple", icon="lock", prefix="fa"),
            z_index_offset=800
        ).add_to(fg_lockers)

    # 3. Plot Customers
    for cust in instance.customers:
        c_lat, c_lon = node_gps[cust.id]
        ctype_name = get_node_type_name(cust.node_type)
        
        if cust.node_type == 1:
            color = "#1E88E5"  # Blue
            target_fg = fg_cust_home
            icon_name = "home"
        elif cust.node_type == 2:
            color = "#43A047"  # Green
            target_fg = fg_cust_locker
            icon_name = "cube"
        else:
            color = "#FB8C00"  # Orange
            target_fg = fg_cust_flex
            icon_name = "user-check"

        cust_popup = f"""
        <div style="font-family: sans-serif; min-width: 180px;">
            <h4 style="margin: 0 0 6px 0; color: {color};">👤 Khách hàng #{cust.id}</h4>
            <b>Loại:</b> {ctype_name}<br>
            <b>Nhu cầu (Demand):</b> {cust.demand}<br>
            <b>Khung giờ giao:</b> [{cust.earliest:.0f} - {cust.latest:.0f}]<br>
            <b>Thời gian phục vụ:</b> {cust.service_time:.1f}<br>
            <b>Tọa độ gốc:</b> ({cust.x:.1f}, {cust.y:.1f})<br>
            <b>GPS:</b> {c_lat:.5f}, {c_lon:.5f}
        </div>
        """

        folium.CircleMarker(
            location=[c_lat, c_lon],
            radius=7,
            color=color,
            weight=2,
            fill=True,
            fill_color=color,
            fill_opacity=0.85,
            popup=folium.Popup(cust_popup, max_width=300),
            tooltip=f"Khách hàng #{cust.id} ({ctype_name}) - Nhu cầu: {cust.demand}",
        ).add_to(target_fg)

    # 4. Plot Routes if solution is provided
    if solution and solution.success and solution.raw_routes:
        for route_idx, route in enumerate(solution.raw_routes):
            color = ROUTE_COLORS[route_idx % len(ROUTE_COLORS)]
            route_coords: List[Tuple[float, float]] = []

            for node_id in route:
                if node_id in node_gps:
                    route_coords.append(node_gps[node_id])

            if len(route_coords) > 1:
                # Tooltip and popup for route
                num_stops = len(route) - 2 if len(route) >= 2 else len(route)
                route_summary_html = f"""
                <div style="font-family: sans-serif; min-width: 200px;">
                    <h4 style="margin: 0 0 6px 0; color: {color};">🚚 Tuyến #{route_idx + 1}</h4>
                    <b>Số điểm dừng:</b> {num_stops}<br>
                    <b>Lộ trình:</b><br>
                    <div style="max-height: 120px; overflow-y: auto; font-size: 12px; background: #f5f5f5; padding: 4px; border-radius: 4px; margin-top: 4px;">
                        {' &rarr; '.join(map(str, route))}
                    </div>
                </div>
                """

                # Main route polyline
                folium.PolyLine(
                    locations=route_coords,
                    color=color,
                    weight=4,
                    opacity=0.85,
                    tooltip=f"Tuyến #{route_idx + 1} ({num_stops} điểm dừng)",
                    popup=folium.Popup(route_summary_html, max_width=320),
                ).add_to(fg_routes)

                # Optional animated AntPath
                if animate_routes:
                    plugins.AntPath(
                        locations=route_coords,
                        color=color,
                        weight=4,
                        opacity=0.9,
                        dash_array=[10, 20],
                        delay=1000,
                        tooltip=f"Tuyến #{route_idx + 1} (Luồng di chuyển)",
                    ).add_to(fg_routes)

                # Stop order badges along route
                if show_stop_numbers:
                    for stop_idx, node_id in enumerate(route[1:-1], start=1):
                        if node_id in node_gps:
                            stop_lat, stop_lon = node_gps[node_id]
                            # Small numbered badge
                            icon_html = f"""
                            <div style="
                                background-color: {color};
                                color: white;
                                border: 2px solid white;
                                border-radius: 50%;
                                width: 20px;
                                height: 20px;
                                font-size: 10px;
                                font-weight: bold;
                                text-align: center;
                                line-height: 18px;
                                box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                            ">{stop_idx}</div>
                            """
                            folium.Marker(
                                location=[stop_lat, stop_lon],
                                icon=folium.DivIcon(
                                    html=icon_html,
                                    icon_size=(20, 20),
                                    icon_anchor=(10, 10),
                                ),
                                tooltip=f"Tuyến #{route_idx + 1} - Điểm dừng #{stop_idx} (Node {node_id})",
                            ).add_to(fg_routes)

    # Add all feature groups to map
    fg_routes.add_to(m)
    fg_cust_home.add_to(m)
    fg_cust_locker.add_to(m)
    fg_cust_flex.add_to(m)
    fg_lockers.add_to(m)
    fg_depot.add_to(m)

    # Layer control to let user toggle elements
    folium.LayerControl(collapsed=False, position="topright").add_to(m)

    # Auto-fit bounds so all points are neatly visible
    if lats and lons:
        min_lat, max_lat = min(lats), max(lats)
        min_lon, max_lon = min(lons), max(lons)
        # Add small margin
        lat_margin = max((max_lat - min_lat) * 0.1, 0.005)
        lon_margin = max((max_lon - min_lon) * 0.1, 0.005)
        m.fit_bounds([
            [min_lat - lat_margin, min_lon - lon_margin],
            [max_lat + lat_margin, max_lon + lon_margin],
        ])

    return m
