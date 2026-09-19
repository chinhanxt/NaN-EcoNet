import json
import math
import random
from datetime import datetime, timedelta, timezone

# Load cached OSRM route data
with open('/tmp/osrm_cache.json', 'r', encoding='utf-8') as f:
    OSRM_DATA = json.load(f)

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def bearing(lat1, lon1, lat2, lon2):
    y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
    return (math.degrees(math.atan2(y, x)) + 360) % 360

def interpolate_step(coords, max_gap=25.0):
    """Subdivides coordinates so no straight segment exceeds max_gap meters"""
    dense = []
    for i in range(len(coords) - 1):
        p1 = coords[i]
        p2 = coords[i+1]
        d = haversine(p1[1], p1[0], p2[1], p2[0])
        if d <= max_gap:
            dense.append(p1)
        else:
            num = int(math.ceil(d / max_gap))
            for k in range(num):
                f = k / float(num)
                lon = p1[0] + (p2[0] - p1[0]) * f
                lat = p1[1] + (p2[1] - p1[1]) * f
                dense.append([lon, lat])
    dense.append(coords[-1])
    return dense

def build_dense_legs(osrm_route, waypoints):
    """
    Parses OSRM legs and steps to produce a high-density, road-snapped point sequence
    for each leg between waypoints, along with road names.
    """
    dense_legs = []
    for leg_idx, leg in enumerate(osrm_route['legs']):
        wpt_start = waypoints[leg_idx]
        wpt_end = waypoints[leg_idx + 1]
        
        leg_pts = []
        for step in leg['steps']:
            step_name = step.get('name')
            if not step_name or step_name.strip() == '':
                step_name = wpt_start[3].split(',')[0] # fallback to landmark street
            else:
                step_name = f"Đường {step_name}" if not step_name.lower().startswith(("đường", "hẻm", "xa lộ", "phố")) else step_name
            
            geom = step.get('geometry')
            if isinstance(geom, dict) and 'coordinates' in geom and len(geom['coordinates']) > 0:
                dense_step = interpolate_step(geom['coordinates'], max_gap=25.0)
                for pt in dense_step:
                    leg_pts.append({
                        "lon": pt[0],
                        "lat": pt[1],
                        "road": f"{step_name}, TP. Thủ Đức, TP. Hồ Chí Minh"
                    })
        
        # Deduplicate consecutive identical coordinates
        filtered_pts = []
        for p in leg_pts:
            if not filtered_pts or (abs(p['lat'] - filtered_pts[-1]['lat']) > 1e-6 or abs(p['lon'] - filtered_pts[-1]['lon']) > 1e-6):
                filtered_pts.append(p)
        
        dense_legs.append({
            "start_wpt": wpt_start,
            "end_wpt": wpt_end,
            "points": filtered_pts
        })
    return dense_legs

def esc(text):
    if text is None:
        return ""
    return str(text).replace("'", "''")

def main():
    print("Generating comprehensive realistic fleet telemetry...")
    
    # Pre-process dense legs for the 3 devices
    dev_legs = {}
    for dev_key, dev_data in OSRM_DATA.items():
        dev_legs[dev_key] = build_dense_legs(dev_data['osrm'], dev_data['info']['waypoints'])
        total_pts = sum(len(leg['points']) for leg in dev_legs[dev_key])
        print(f"[{dev_key}] Built {len(dev_legs[dev_key])} dense legs with {total_pts} road-snapped points.")

    sql_statements = []
    
    # Header & Cleanup
    sql_statements.append("-- Reset all previous test/mock data for devices 12, 13, 16")
    sql_statements.append("DELETE FROM TC_EVENTS WHERE DEVICEID IN (12, 13, 16);")
    sql_statements.append("DELETE FROM TC_POSITIONS WHERE DEVICEID IN (12, 13, 16);")
    sql_statements.append("DELETE FROM TC_STATISTICS;")
    
    # Update Device Names & Models
    sql_statements.append("\n-- Update Device Information with smart bin fleet details")
    sql_statements.append("UPDATE TC_DEVICES SET NAME = 'Xe thu gom rác 06 (Khu A - Thủ Đức)', MODEL = 'Hino 5 Tấn - IoT Smartbin', CONTACT = '0912.345.678', STATUS = 'online' WHERE ID = 13;")
    sql_statements.append("UPDATE TC_DEVICES SET NAME = 'Xe ép rác số 03 (Tuyến Đô Thị)', MODEL = 'Isuzu FVR - Ép rác', CONTACT = '0988.765.432', STATUS = 'online' WHERE ID = 12;")
    sql_statements.append("UPDATE TC_DEVICES SET NAME = 'Xe tuần tra môi trường 07', MODEL = 'Ford Ranger Giám sát', CONTACT = '0903.112.233', STATUS = 'online' WHERE ID = 16;")
    sql_statements.append("UPDATE TC_USERS SET ATTRIBUTES = '{\"userLanguage\":\"vi\"}' WHERE ID = 1;")

    # Drivers
    sql_statements.append("\n-- Enterprise Drivers")
    sql_statements.append("MERGE INTO TC_DRIVERS (ID, NAME, UNIQUEID, ATTRIBUTES) KEY(ID) VALUES (1, 'Nguyễn Văn Tuấn', 'TX-06', '{\"phone\":\"0912.345.678\",\"license\":\"GPLX Hạng C - 790123456\"}');")
    sql_statements.append("MERGE INTO TC_DRIVERS (ID, NAME, UNIQUEID, ATTRIBUTES) KEY(ID) VALUES (2, 'Trần Đình Trọng', 'TX-03', '{\"phone\":\"0988.765.432\",\"license\":\"GPLX Hạng FC - 790654321\"}');")
    sql_statements.append("MERGE INTO TC_DRIVERS (ID, NAME, UNIQUEID, ATTRIBUTES) KEY(ID) VALUES (3, 'Lê Hoàng Quân', 'TX-07', '{\"phone\":\"0903.112.233\",\"license\":\"GPLX Hạng B2 - 790987654\"}');")

    sql_statements.append("MERGE INTO TC_DEVICE_DRIVER (DEVICEID, DRIVERID) KEY(DEVICEID, DRIVERID) VALUES (13, 1);")
    sql_statements.append("MERGE INTO TC_DEVICE_DRIVER (DEVICEID, DRIVERID) KEY(DEVICEID, DRIVERID) VALUES (12, 2);")
    sql_statements.append("MERGE INTO TC_DEVICE_DRIVER (DEVICEID, DRIVERID) KEY(DEVICEID, DRIVERID) VALUES (16, 3);")

    sql_statements.append("MERGE INTO TC_USER_DRIVER (USERID, DRIVERID) KEY(USERID, DRIVERID) VALUES (1, 1);")
    sql_statements.append("MERGE INTO TC_USER_DRIVER (USERID, DRIVERID) KEY(USERID, DRIVERID) VALUES (1, 2);")
    sql_statements.append("MERGE INTO TC_USER_DRIVER (USERID, DRIVERID) KEY(USERID, DRIVERID) VALUES (1, 3);")

    # Geofences
    sql_statements.append("\n-- Realistic Operational Geofences")
    sql_statements.append("MERGE INTO TC_GEOFENCES (ID, NAME, DESCRIPTION, AREA) KEY(ID) VALUES (1, 'Bãi xe Môi trường Đô thị Hàng Tre', 'Trạm đỗ & sạc trung tâm Khu A', 'CIRCLE (10.845361 106.813553, 60)');")
    sql_statements.append("MERGE INTO TC_GEOFENCES (ID, NAME, DESCRIPTION, AREA) KEY(ID) VALUES (2, 'Khu Đô thị Vinhomes Grand Park', 'Khu vực dịch vụ thu gom thông minh', 'CIRCLE (10.855000 106.835000, 900)');")
    sql_statements.append("MERGE INTO TC_GEOFENCES (ID, NAME, DESCRIPTION, AREA) KEY(ID) VALUES (3, 'Khu Công nghệ cao TP.HCM (SHTP)', 'Khu vực thu gom chất thải công nghiệp & dịch vụ', 'CIRCLE (10.855000 106.805000, 1400)');")
    sql_statements.append("MERGE INTO TC_GEOFENCES (ID, NAME, DESCRIPTION, AREA) KEY(ID) VALUES (4, 'Trạm xử lý chất thải rắn & Ép rác SHTP', 'Trạm ép rác & xử lý trung tâm', 'CIRCLE (10.861885 106.814071, 120)');")

    for did in (12, 13, 16):
        for gid in (1, 2, 3, 4):
            sql_statements.append(f"MERGE INTO TC_DEVICE_GEOFENCE (DEVICEID, GEOFENCEID) KEY(DEVICEID, GEOFENCEID) VALUES ({did}, {gid});")

    # 30 Days of Server Statistics
    sql_statements.append("\n-- 30 Days of System Statistics")
    stat_start = datetime(2026, 8, 18, 0, 0, 0, tzinfo=timezone.utc)
    for day_i in range(31):
        s_date = stat_start + timedelta(days=day_i)
        d_str = s_date.strftime("%Y-%m-%d 00:00:00")
        active_u = 4 + (day_i % 3)
        reqs = 1450 + day_i * 120 + random.randint(-40, 60)
        msgs = 4200 + day_i * 310 + random.randint(-80, 110)
        geocs = 110 + day_i * 8 + random.randint(-5, 10)
        sql_statements.append(
            f"INSERT INTO TC_STATISTICS (CAPTURETIME, ACTIVEUSERS, ACTIVEDEVICES, REQUESTS, MESSAGESRECEIVED, MESSAGESSTORED, ATTRIBUTES, MAILSENT, SMSSENT, GEOCODERREQUESTS, GEOLOCATIONREQUESTS, PROTOCOLS) "
            f"VALUES ('{d_str}', {active_u}, 3, {reqs}, {msgs}, {msgs}, '{{}}', 0, 0, {geocs}, 0, '{{\"osmand\":{msgs}}}');"
        )

    # Telemetry simulation configuration
    device_configs = [
        {
            "id": 13,
            "key": "dev13",
            "base_odo": 42150000.0,
            "base_hours": 1840.5,
            "speed_mult": 1.0,
            "geofence_id": 1,
            "depot_name": "Bãi xe Môi trường Đô thị - 74 Đường Hàng Tre, P. Long Thạnh Mỹ, TP. Thủ Đức"
        },
        {
            "id": 12,
            "key": "dev12",
            "base_odo": 68420000.0,
            "base_hours": 2950.0,
            "speed_mult": 1.05,
            "geofence_id": 3,
            "depot_name": "Bãi xe Môi trường Đô thị - Đường Lê Văn Việt, P. Tăng Nhơn Phú A, TP. Thủ Đức"
        },
        {
            "id": 16,
            "key": "dev16",
            "base_odo": 18900000.0,
            "base_hours": 780.2,
            "speed_mult": 1.25, # faster patrol vehicle
            "geofence_id": 1,
            "depot_name": "Trung tâm Điều hành Môi trường Đô thị - 74 Đường Hàng Tre, TP. Thủ Đức"
        }
    ]

    # Date range: 7 full operating days (Sept 11 to Sept 17, 2026)
    days = [
        datetime(2026, 9, 11, 0, 0, 0, tzinfo=timezone.utc), # Fri
        datetime(2026, 9, 12, 0, 0, 0, tzinfo=timezone.utc), # Sat
        datetime(2026, 9, 13, 0, 0, 0, tzinfo=timezone.utc), # Sun
        datetime(2026, 9, 14, 0, 0, 0, tzinfo=timezone.utc), # Mon
        datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc), # Tue
        datetime(2026, 9, 16, 0, 0, 0, tzinfo=timezone.utc), # Wed (Yesterday)
        datetime(2026, 9, 17, 0, 0, 0, tzinfo=timezone.utc), # Thu (Today)
    ]

    latest_positions = {}
    pos_global_id = 10000
    event_global_id = 5000

    print("Simulating telemetry trajectories across 7 days...")

    for dev in device_configs:
        dev_id = dev['id']
        legs = dev_legs[dev['key']]
        cur_odo = dev['base_odo']
        cur_hours = dev['base_hours']
        battery = 98.0
        
        for day_dt in days:
            is_today = (day_dt.day == 17)
            is_sunday = (day_dt.weekday() == 6)
            
            # Schedules in UTC (Vietnam UTC+7 is UTC + 7 hours)
            # Ca sáng: 06:15 VN = 23:15 UTC previous day
            # Ca chiều: 13:15 VN = 06:15 UTC same day
            # Today early morning shift: 04:00 VN = 21:00 UTC previous day (Sept 16 21:00 UTC)
            
            if is_today:
                # Early morning market shift running right up to current local time (04:46 VN = 21:46 UTC)
                shifts = [
                    {
                        "start_utc": day_dt - timedelta(days=1) + timedelta(hours=21, minutes=0), # 04:00 AM VN
                        "is_live_today": True
                    }
                ]
            elif is_sunday:
                # Lighter weekend patrol/collection: single shift 07:15 VN (00:15 UTC)
                shifts = [
                    {
                        "start_utc": day_dt + timedelta(hours=0, minutes=15), # 07:15 AM VN
                        "is_live_today": False
                    }
                ]
            else:
                # Standard 2-shift day
                shifts = [
                    {
                        "start_utc": day_dt - timedelta(days=1) + timedelta(hours=23, minutes=15), # 06:15 AM VN
                        "is_live_today": False
                    },
                    {
                        "start_utc": day_dt + timedelta(hours=6, minutes=15), # 13:15 PM VN
                        "is_live_today": False
                    }
                ]

            for shift in shifts:
                cur_time = shift['start_utc']
                is_live = shift['is_live_today']
                
                # Depot start position
                start_wpt = legs[0]['start_wpt']
                cur_lat = start_wpt[2]
                cur_lon = start_wpt[1]
                
                # 1. Event: Ignition ON at depot
                pos_global_id += 1
                pos_time_str = cur_time.strftime("%Y-%m-%d %H:%M:%S")
                attrs_json = json.dumps({
                    "ignition": True, "motion": False, "batteryLevel": int(battery), "charge": True,
                    "wasteLevel": 0, "totalDistance": round(cur_odo, 1), "hours": int(cur_hours * 3600 * 1000), "temp": 42
                })
                sql_statements.append(
                    f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ACCURACY, ATTRIBUTES) "
                    f"VALUES ({pos_global_id}, 'osmand', {dev_id}, '{pos_time_str}', '{pos_time_str}', '{pos_time_str}', TRUE, {cur_lat:.6f}, {cur_lon:.6f}, 16.0, 0.0, 0.0, '{esc(start_wpt[3])}', 5.0, '{esc(attrs_json)}');"
                )
                latest_positions[dev_id] = pos_global_id

                event_global_id += 1
                sql_statements.append(
                    f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                    f"VALUES ({event_global_id}, 'ignitionOn', '{pos_time_str}', {dev_id}, {pos_global_id}, {dev['geofence_id']}, '{{}}');"
                )

                # 4 minutes warm up & pre-trip check
                cur_time += timedelta(minutes=4)
                cur_hours += 4.0 / 60.0

                # 2. Event: Device Moving
                pos_global_id += 1
                pos_time_str = cur_time.strftime("%Y-%m-%d %H:%M:%S")
                attrs_json = json.dumps({
                    "ignition": True, "motion": True, "batteryLevel": int(battery), "charge": False,
                    "wasteLevel": 0, "totalDistance": round(cur_odo, 1), "hours": int(cur_hours * 3600 * 1000), "temp": 65
                })
                sql_statements.append(
                    f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ACCURACY, ATTRIBUTES) "
                    f"VALUES ({pos_global_id}, 'osmand', {dev_id}, '{pos_time_str}', '{pos_time_str}', '{pos_time_str}', TRUE, {cur_lat:.6f}, {cur_lon:.6f}, 16.0, 5.4, 45.0, '{esc(start_wpt[3])}', 5.0, '{esc(attrs_json)}');"
                )
                latest_positions[dev_id] = pos_global_id

                event_global_id += 1
                sql_statements.append(
                    f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                    f"VALUES ({event_global_id}, 'deviceMoving', '{pos_time_str}', {dev_id}, {pos_global_id}, {dev['geofence_id']}, '{{}}');"
                )

                # 3. Event: Geofence Exit
                cur_time += timedelta(minutes=2)
                event_global_id += 1
                sql_statements.append(
                    f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                    f"VALUES ({event_global_id}, 'geofenceExit', '{cur_time.strftime('%Y-%m-%d %H:%M:%S')}', {dev_id}, {pos_global_id}, {dev['geofence_id']}, '{{}}');"
                )

                # Iterate through each leg of the circuit
                waste_level = 0
                load_weight = 0
                overspeed_triggered = False

                for leg_idx, leg in enumerate(legs):
                    pts = leg['points']
                    dest_wpt = leg['end_wpt']
                    num_pts = len(pts)
                    
                    # Drive along the road
                    for i in range(num_pts):
                        p = pts[i]
                        next_p = pts[i+1] if i < num_pts - 1 else p
                        
                        dist = haversine(cur_lat, cur_lon, p['lat'], p['lon'])
                        if dist > 0.5:
                            cur_odo += dist
                        
                        heading = bearing(cur_lat, cur_lon, next_p['lat'], next_p['lon']) if dist > 0.5 else 0.0
                        cur_lat = p['lat']
                        cur_lon = p['lon']

                        # Realistic urban speed profile
                        # Acceleration out of stop, slow down at turns, cruising speed
                        rel_pos = float(i) / max(num_pts, 1)
                        if rel_pos < 0.1:
                            kmh = 15.0 + rel_pos * 150.0 # 15 -> 30 km/h
                        elif rel_pos > 0.9:
                            kmh = 30.0 - (rel_pos - 0.9) * 150.0 # 30 -> 15 km/h
                        else:
                            kmh = 28.0 + random.uniform(-4.0, 7.0) * dev['speed_mult']
                        
                        # Overspeed event on straight avenue
                        if not overspeed_triggered and kmh > 46.0 and random.random() < 0.2:
                            kmh = 53.5 # trigger overspeed
                            overspeed_triggered = True
                            event_global_id += 1
                            sql_statements.append(
                                f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                                f"VALUES ({event_global_id}, 'deviceOverspeed', '{cur_time.strftime('%Y-%m-%d %H:%M:%S')}', {dev_id}, {pos_global_id}, NULL, '{{\"speed\":53.5,\"speedLimit\":50.0}}');"
                            )

                        speed_knots = kmh * 0.539957
                        dt_sec = max(3.0, min(8.0, dist / max(kmh / 3.6, 2.0))) if dist > 0.5 else 4.0
                        cur_time += timedelta(seconds=dt_sec)
                        cur_hours += dt_sec / 3600.0
                        battery = max(35.0, battery - 0.003 * dt_sec)

                        # Store position
                        pos_global_id += 1
                        pos_time_str = cur_time.strftime("%Y-%m-%d %H:%M:%S")
                        attrs_json = json.dumps({
                            "ignition": True, "motion": True, "batteryLevel": int(battery), "charge": False,
                            "wasteLevel": waste_level, "loadWeight": load_weight, "totalDistance": round(cur_odo, 1),
                            "hours": int(cur_hours * 3600 * 1000), "temp": int(76 + kmh * 0.2), "distance": round(dist, 1)
                        })
                        sql_statements.append(
                            f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ACCURACY, ATTRIBUTES) "
                            f"VALUES ({pos_global_id}, 'osmand', {dev_id}, '{pos_time_str}', '{pos_time_str}', '{pos_time_str}', TRUE, {cur_lat:.6f}, {cur_lon:.6f}, {15.0 + random.uniform(0, 4):.1f}, {speed_knots:.2f}, {heading:.1f}, '{esc(p['road'])}', 5.0, '{esc(attrs_json)}');"
                        )
                        latest_positions[dev_id] = pos_global_id

                        # If this is today's shift and we've reached current time (21:46 UTC = 04:46 VN), stop!
                        if is_live and cur_time >= datetime(2026, 9, 16, 21, 46, 0, tzinfo=timezone.utc):
                            break
                    
                    if is_live and cur_time >= datetime(2026, 9, 16, 21, 46, 0, tzinfo=timezone.utc):
                        print(f"[{dev['key']}] Live today route reached current time: {cur_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
                        break

                    # ARRIVAL AT WAYPOINT STOP
                    is_final_depot = (leg_idx == len(legs) - 1)
                    stop_duration_mins = 25 if is_final_depot else random.randint(8, 14)
                    
                    # Update waste level
                    if dest_wpt[4] == 0 and not is_final_depot:
                        # Waste transfer / dumping station!
                        waste_level = 0
                        load_weight = 0
                    elif dest_wpt[4] > 0:
                        waste_level = min(100, dest_wpt[4] + random.randint(-3, 3))
                        load_weight = int(waste_level * 48.0) # ~4800 kg max capacity

                    # 1. Event: Device Stopped
                    pos_global_id += 1
                    pos_time_str = cur_time.strftime("%Y-%m-%d %H:%M:%S")
                    attrs_json = json.dumps({
                        "ignition": not is_final_depot, "motion": False, "batteryLevel": int(battery),
                        "charge": is_final_depot, "wasteLevel": waste_level, "loadWeight": load_weight,
                        "totalDistance": round(cur_odo, 1), "hours": int(cur_hours * 3600 * 1000), "temp": 68
                    })
                    sql_statements.append(
                        f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ACCURACY, ATTRIBUTES) "
                        f"VALUES ({pos_global_id}, 'osmand', {dev_id}, '{pos_time_str}', '{pos_time_str}', '{pos_time_str}', TRUE, {cur_lat:.6f}, {cur_lon:.6f}, 16.0, 0.0, 0.0, '{esc(dest_wpt[3])}', 5.0, '{esc(attrs_json)}');"
                    )
                    latest_positions[dev_id] = pos_global_id

                    event_global_id += 1
                    sql_statements.append(
                        f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                        f"VALUES ({event_global_id}, 'deviceStopped', '{pos_time_str}', {dev_id}, {pos_global_id}, {dev['geofence_id'] if is_final_depot else 'NULL'}, '{{}}');"
                    )

                    # Stationary pings during stop
                    num_stop_pings = 4
                    ping_step_sec = (stop_duration_mins * 60) / num_stop_pings
                    for sp in range(num_stop_pings):
                        cur_time += timedelta(seconds=ping_step_sec)
                        if not is_final_depot:
                            cur_hours += (ping_step_sec / 3600.0) * 0.4 # idling PTO pump
                        pos_global_id += 1
                        pos_time_str = cur_time.strftime("%Y-%m-%d %H:%M:%S")
                        attrs_json = json.dumps({
                            "ignition": not is_final_depot, "motion": False, "batteryLevel": int(battery),
                            "charge": is_final_depot, "wasteLevel": waste_level, "loadWeight": load_weight,
                            "totalDistance": round(cur_odo, 1), "hours": int(cur_hours * 3600 * 1000), "temp": 62
                        })
                        sql_statements.append(
                            f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ACCURACY, ATTRIBUTES) "
                            f"VALUES ({pos_global_id}, 'osmand', {dev_id}, '{pos_time_str}', '{pos_time_str}', '{pos_time_str}', TRUE, {cur_lat:.6f}, {cur_lon:.6f}, 16.0, 0.0, 0.0, '{esc(dest_wpt[3])}', 5.0, '{esc(attrs_json)}');"
                        )
                        latest_positions[dev_id] = pos_global_id

                    # If not final depot, vehicle resumes moving
                    if not is_final_depot:
                        event_global_id += 1
                        sql_statements.append(
                            f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                            f"VALUES ({event_global_id}, 'deviceMoving', '{cur_time.strftime('%Y-%m-%d %H:%M:%S')}', {dev_id}, {pos_global_id}, NULL, '{{}}');"
                        )
                    else:
                        # Reached Depot at end of shift
                        event_global_id += 1
                        sql_statements.append(
                            f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                            f"VALUES ({event_global_id}, 'geofenceEnter', '{cur_time.strftime('%Y-%m-%d %H:%M:%S')}', {dev_id}, {pos_global_id}, {dev['geofence_id']}, '{{}}');"
                        )
                        event_global_id += 1
                        sql_statements.append(
                            f"INSERT INTO TC_EVENTS (ID, TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) "
                            f"VALUES ({event_global_id}, 'ignitionOff', '{cur_time.strftime('%Y-%m-%d %H:%M:%S')}', {dev_id}, {pos_global_id}, {dev['geofence_id']}, '{{}}');"
                        )
                        # Recharging battery at depot
                        battery = 100.0

        # Update Device latest position
        sql_statements.append(
            f"UPDATE TC_DEVICES SET POSITIONID = {latest_positions[dev_id]}, STATUS = 'online' WHERE ID = {dev_id};"
        )
    
    # Save SQL file
    output_path = "/tmp/seed_traccar_realistic.sql"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_statements))
        f.write("\n")

    print(f"Done! Generated {len(sql_statements)} SQL statements.")
    print(f"Output saved to {output_path}")

if __name__ == "__main__":
    main()
