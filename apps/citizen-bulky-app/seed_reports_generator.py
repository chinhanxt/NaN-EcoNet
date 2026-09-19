import math
import random
from datetime import datetime, timedelta, timezone

# Reference coordinates around Thu Duc, Ho Chi Minh City
# Base / Depot: Hàng Tre, Long Thạnh Mỹ
DEPOT_LAT = 10.845646
DEPOT_LON = 106.813437

# Real road waypoints in Long Thạnh Mỹ / Long Bình / Vinhomes Grand Park
WAYPOINTS_CIRCUIT_1 = [
    (10.845646, 106.813437, "Trạm trung tâm Hàng Tre, P. Long Thạnh Mỹ, TP. Thủ Đức"),
    (10.846520, 106.815300, "Đường Hàng Tre nối Nguyễn Văn Tăng, TP. Thủ Đức"),
    (10.847850, 106.818200, "Trạm rác Chợ Long Thạnh Mỹ, Đường Nguyễn Văn Tăng"),
    (10.849300, 106.821600, "Ngã ba Gò Công - Nguyễn Văn Tăng, TP. Thủ Đức"),
    (10.851200, 106.825100, "Đường Nguyễn Xiển, P. Long Thạnh Mỹ"),
    (10.853600, 106.829200, "Trạm rác Cổng 1 Vinhomes Grand Park, Đ. Phước Thiện"),
    (10.856200, 106.834100, "Đại lộ Ánh Sáng - Công viên Grand Park 36ha"),
    (10.854100, 106.837500, "Phân khu Origami - Cầu Vồng, TP. Thủ Đức"),
    (10.850500, 106.835200, "Đường D2A - Khu đô thị Grand Park"),
    (10.848200, 106.831800, "Đường Vành đai 3 nối Nguyễn Xiển"),
    (10.844300, 106.824200, "Đường Hoàng Hữu Nam, P. Long Thạnh Mỹ"),
    (10.841200, 106.818100, "Trạm rác Khu phố Mỹ Thành, Đường Hoàng Hữu Nam"),
    (10.843600, 106.814600, "Ngã ba Nguyễn Văn Tăng về Hàng Tre"),
    (10.845646, 106.813437, "Trạm trung tâm Hàng Tre, P. Long Thạnh Mỹ, TP. Thủ Đức"),
]

WAYPOINTS_CIRCUIT_2 = [
    (10.845646, 106.813437, "Trạm trung tâm Hàng Tre, P. Long Thạnh Mỹ, TP. Thủ Đức"),
    (10.843100, 106.810500, "Đường Lê Văn Việt, P. Tăng Nhơn Phú A"),
    (10.841500, 106.806200, "Trạm thu gom rác Bệnh viện Quận 9, Đ. Lê Văn Việt"),
    (10.838800, 106.801500, "Đại học Sư phạm Kỹ thuật (Cơ sở 2), Đ. Lê Văn Việt"),
    (10.842000, 106.797200, "Khu Công Nghệ Cao (SHTP) - Đường D1"),
    (10.846500, 106.801800, "Trạm ép rác phân loại Khu Công Nghệ Cao TP. Thủ Đức"),
    (10.851000, 106.808000, "Đường Lã Xuân Oai, TP. Thủ Đức"),
    (10.848500, 106.812500, "Khu dân cư Long Thạnh Mỹ, TP. Thủ Đức"),
    (10.845646, 106.813437, "Trạm trung tâm Hàng Tre, P. Long Thạnh Mỹ, TP. Thủ Đức"),
]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def bearing(lat1, lon1, lat2, lon2):
    y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.cos(math.radians(lon2 - lon1))
    b = math.degrees(math.atan2(y, x))
    return (b + 360) % 360

def generate_sql():
    sql_lines = []
    
    # 1. Clean previous data for devices 12, 13, 16
    sql_lines.append("-- Reset data for fleet devices 12, 13, 16")
    sql_lines.append("DELETE FROM TC_EVENTS WHERE DEVICEID IN (12, 13, 16);")
    sql_lines.append("DELETE FROM TC_POSITIONS WHERE DEVICEID IN (12, 13, 16);")
    sql_lines.append("DELETE FROM TC_STATISTICS;")
    
    # 2. Update Device Info
    sql_lines.append("\n-- Update Device Information with smart bin fleet details")
    sql_lines.append("UPDATE TC_DEVICES SET NAME = 'Xe thu gom rác 06 (Khu A - Thủ Đức)', MODEL = 'Hino 5 Tấn - IoT Smartbin', CONTACT = '0912.345.678', STATUS = 'online' WHERE ID = 13;")
    sql_lines.append("UPDATE TC_DEVICES SET NAME = 'Xe ép rác số 03 (Tuyến Đô Thị)', MODEL = 'Isuzu FVR - Ép rác', CONTACT = '0988.765.432', STATUS = 'online' WHERE ID = 12;")
    sql_lines.append("UPDATE TC_DEVICES SET NAME = 'Xe tuần tra môi trường 07', MODEL = 'Ford Ranger Giám sát', CONTACT = '0903.112.233', STATUS = 'online' WHERE ID = 16;")

    # 3. Drivers & Geofences associations
    sql_lines.append("\n-- Drivers & Geofence permissions")
    sql_lines.append("MERGE INTO TC_DRIVERS (ID, NAME, UNIQUEID, ATTRIBUTES) KEY(ID) VALUES (1, 'Nguyễn Văn Tuấn', 'TX-06', '{\"phone\":\"0912.345.678\"}');")
    sql_lines.append("MERGE INTO TC_DRIVERS (ID, NAME, UNIQUEID, ATTRIBUTES) KEY(ID) VALUES (2, 'Trần Đình Trọng', 'TX-03', '{\"phone\":\"0988.765.432\"}');")
    sql_lines.append("MERGE INTO TC_DRIVERS (ID, NAME, UNIQUEID, ATTRIBUTES) KEY(ID) VALUES (3, 'Lê Hoàng Quân', 'TX-07', '{\"phone\":\"0903.112.233\"}');")

    sql_lines.append("MERGE INTO TC_DEVICE_DRIVER (DEVICEID, DRIVERID) KEY(DEVICEID, DRIVERID) VALUES (13, 1);")
    sql_lines.append("MERGE INTO TC_DEVICE_DRIVER (DEVICEID, DRIVERID) KEY(DEVICEID, DRIVERID) VALUES (12, 2);")
    sql_lines.append("MERGE INTO TC_DEVICE_DRIVER (DEVICEID, DRIVERID) KEY(DEVICEID, DRIVERID) VALUES (16, 3);")

    sql_lines.append("MERGE INTO TC_USER_DRIVER (USERID, DRIVERID) KEY(USERID, DRIVERID) VALUES (1, 1);")
    sql_lines.append("MERGE INTO TC_USER_DRIVER (USERID, DRIVERID) KEY(USERID, DRIVERID) VALUES (1, 2);")
    sql_lines.append("MERGE INTO TC_USER_DRIVER (USERID, DRIVERID) KEY(USERID, DRIVERID) VALUES (1, 3);")

    sql_lines.append("MERGE INTO TC_DEVICE_GEOFENCE (DEVICEID, GEOFENCEID) KEY(DEVICEID, GEOFENCEID) VALUES (13, 1);")
    sql_lines.append("MERGE INTO TC_DEVICE_GEOFENCE (DEVICEID, GEOFENCEID) KEY(DEVICEID, GEOFENCEID) VALUES (12, 1);")
    sql_lines.append("MERGE INTO TC_DEVICE_GEOFENCE (DEVICEID, GEOFENCEID) KEY(DEVICEID, GEOFENCEID) VALUES (16, 1);")

    # 4. Daily Statistics (14 days from 2026-09-03 to 2026-09-17)
    sql_lines.append("\n-- Daily System Statistics for /reports/statistics")
    base_date = datetime(2026, 9, 3, 0, 0, 0, tzinfo=timezone.utc)
    for d in range(15):
        stat_date = base_date + timedelta(days=d)
        date_str = stat_date.strftime("%Y-%m-%d 00:00:00")
        active_users = 3 + (d % 3)
        active_devices = 3
        reqs = 1200 + d * 180 + random.randint(-50, 80)
        msgs = 3800 + d * 520 + random.randint(-120, 150)
        geocodes = 90 + d * 12 + random.randint(-5, 15)
        sql_lines.append(
            f"INSERT INTO TC_STATISTICS (CAPTURETIME, ACTIVEUSERS, ACTIVEDEVICES, REQUESTS, MESSAGESRECEIVED, MESSAGESSTORED, ATTRIBUTES, MAILSENT, SMSSENT, GEOCODERREQUESTS, GEOLOCATIONREQUESTS, PROTOCOLS) "
            f"VALUES ('{date_str}', {active_users}, {active_devices}, {reqs}, {msgs}, {msgs}, '{{}}', 0, 0, {geocodes}, 0, '{{\"osmand\":{msgs}}}');"
        )

    # 5. Trajectory Generator for Device 13, 12, 16
    # Let's seed Device 13 primarily (Xe 06), and also Xe 12 & Xe 16
    devices = [
        (13, WAYPOINTS_CIRCUIT_1, 24000.0, 95.0), # Device 13
        (12, WAYPOINTS_CIRCUIT_2, 18500.0, 98.0), # Device 12
        (16, WAYPOINTS_CIRCUIT_1, 31000.0, 92.0), # Device 16
    ]

    # Generate dates: 2026-09-12 to 2026-09-17 (Past 6 days + Today)
    days_to_generate = [
        datetime(2026, 9, 12, tzinfo=timezone.utc),
        datetime(2026, 9, 13, tzinfo=timezone.utc),
        datetime(2026, 9, 14, tzinfo=timezone.utc),
        datetime(2026, 9, 15, tzinfo=timezone.utc),
        datetime(2026, 9, 16, tzinfo=timezone.utc), # Yesterday
        datetime(2026, 9, 17, tzinfo=timezone.utc), # Today
    ]

    position_counter = 10000

    for dev_id, circuit, start_odo, init_batt in devices:
        sql_lines.append(f"\n-- Telemetry and Events for Device {dev_id}")
        current_odo = start_odo
        
        for day in days_to_generate:
            is_today = (day.day == 17)
            is_yesterday = (day.day == 16)
            
            # Shifts per day:
            # Morning: 06:00 to 09:30
            # Afternoon: 13:30 to 16:30 (except today where afternoon hasn't happened yet)
            shifts = [("Morning", 6, 0)]
            if not is_today:
                shifts.append(("Afternoon", 13, 30))
            
            batt = init_batt
            
            for shift_name, s_hour, s_min in shifts:
                current_time = day.replace(hour=s_hour, minute=s_min, second=0)
                
                # Event: deviceOnline & ignitionOn
                time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('deviceOnline', '{time_str}', {dev_id}, NULL, 0, '{{}}');")
                sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('ignitionOn', '{time_str}', {dev_id}, NULL, 0, '{{}}');")
                
                # Loop through waypoints
                for w_idx in range(len(circuit) - 1):
                    p_start = circuit[w_idx]
                    p_end = circuit[w_idx + 1]
                    
                    dist_seg = haversine(p_start[0], p_start[1], p_end[0], p_end[1])
                    crs = bearing(p_start[0], p_start[1], p_end[0], p_end[1])
                    
                    # Number of interpolation steps (every ~40 meters or ~15 seconds)
                    steps = max(3, int(dist_seg / 50))
                    
                    # Trip segment: start moving event on first step of first segment
                    if w_idx == 0:
                        sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('deviceMoving', '{time_str}', {dev_id}, NULL, 0, '{{}}');")
                        sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('geofenceExit', '{time_str}', {dev_id}, NULL, 1, '{{}}');")

                    for s in range(steps):
                        frac = s / float(steps)
                        lat = p_start[0] + frac * (p_end[0] - p_start[0])
                        lon = p_start[1] + frac * (p_end[1] - p_start[1])
                        
                        # Speed bell curve: 20 to 45 km/h -> in knots (1 km/h = 0.539957 knots)
                        kmh = 24.0 + 18.0 * math.sin(frac * math.pi) + random.uniform(-2.0, 3.0)
                        speed_knots = kmh * 0.539957
                        
                        step_dist = dist_seg / steps
                        current_odo += step_dist
                        batt = max(45.0, batt - 0.02)
                        alt = 14.0 + 4.0 * math.sin(frac * math.pi * 2) + random.uniform(-0.5, 0.5)
                        acc = 3.5 + random.uniform(0.1, 1.5)
                        
                        current_time += timedelta(seconds=15)
                        time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                        position_counter += 1
                        pos_id = position_counter

                        addr = p_start[2] if frac < 0.5 else p_end[2]
                        attr_json = f'{{\"batteryLevel\":{batt:.1f},\"charge\":false,\"distance\":{step_dist:.1f},\"totalDistance\":{current_odo:.1f},\"motion\":true,\"ignition\":true}}'
                        
                        sql_lines.append(
                            f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ATTRIBUTES, ACCURACY, GEOFENCEIDS) "
                            f"VALUES ({pos_id}, 'osmand', {dev_id}, '{time_str}', '{time_str}', '{time_str}', true, {lat:.6f}, {lon:.6f}, {alt:.1f}, {speed_knots:.2f}, {crs:.1f}, '{addr}', '{attr_json}', {acc:.1f}, NULL);"
                        )

                    # Arrived at waypoint: check if this waypoint is a STOP (Trạm rác / Thu gom)
                    # Stop if waypoint is index 2, 5, 7, 11 (collecting trash for 6 - 12 minutes)
                    if w_idx in [2, 5, 7, 11]:
                        stop_duration_mins = random.randint(7, 12)
                        stop_time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                        
                        # Stop event
                        sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('deviceStopped', '{stop_time_str}', {dev_id}, {pos_id}, 0, '{{}}');")
                        
                        # Trigger SOS or Overspeed event occasionally for richness
                        if is_yesterday and w_idx == 5 and dev_id == 13:
                            sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('alarm', '{stop_time_str}', {dev_id}, {pos_id}, 0, '{{\"alarm\":\"sos\"}}');")
                        elif is_today and w_idx == 2 and dev_id == 13:
                            sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('alarm', '{stop_time_str}', {dev_id}, {pos_id}, 0, '{{\"alarm\":\"sos\"}}');")

                        # Stationary points during stop (speed = 0, motion = false)
                        # Spaced 90 seconds apart
                        stop_points = stop_duration_mins * 60 // 90
                        for _ in range(stop_points):
                            current_time += timedelta(seconds=90)
                            time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                            position_counter += 1
                            pos_id = position_counter
                            attr_json = f'{{\"batteryLevel\":{batt:.1f},\"charge\":false,\"distance\":0.0,\"totalDistance\":{current_odo:.1f},\"motion\":false,\"ignition\":false}}'
                            sql_lines.append(
                                f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ATTRIBUTES, ACCURACY, GEOFENCEIDS) "
                                f"VALUES ({pos_id}, 'osmand', {dev_id}, '{time_str}', '{time_str}', '{time_str}', true, {p_end[0]:.6f}, {p_end[1]:.6f}, 14.5, 0.0, 0.0, '{p_end[2]}', '{attr_json}', 3.2, NULL);"
                            )
                        
                        # Resume moving event after stop
                        resume_time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                        sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('deviceMoving', '{resume_time_str}', {dev_id}, {pos_id}, 0, '{{}}');")

                # Arrived back at Depot at the end of the shift
                end_time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('geofenceEnter', '{end_time_str}', {dev_id}, {pos_id}, 1, '{{}}');")
                sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('deviceStopped', '{end_time_str}', {dev_id}, {pos_id}, 1, '{{}}');")
                sql_lines.append(f"INSERT INTO TC_EVENTS (TYPE, EVENTTIME, DEVICEID, POSITIONID, GEOFENCEID, ATTRIBUTES) VALUES ('ignitionOff', '{end_time_str}', {dev_id}, {pos_id}, 0, '{{}}');")

                # Parked at Depot for 40 minutes (speed = 0, charge = true)
                for _ in range(10):
                    current_time += timedelta(minutes=4)
                    time_str = current_time.strftime("%Y-%m-%d %H:%M:%S")
                    position_counter += 1
                    pos_id = position_counter
                    batt = min(99.0, batt + 2.5) # Charging while parked
                    attr_json = f'{{\"batteryLevel\":{batt:.1f},\"charge\":true,\"distance\":0.0,\"totalDistance\":{current_odo:.1f},\"motion\":false,\"ignition\":false}}'
                    sql_lines.append(
                        f"INSERT INTO TC_POSITIONS (ID, PROTOCOL, DEVICEID, SERVERTIME, DEVICETIME, FIXTIME, VALID, LATITUDE, LONGITUDE, ALTITUDE, SPEED, COURSE, ADDRESS, ATTRIBUTES, ACCURACY, GEOFENCEIDS) "
                        f"VALUES ({pos_id}, 'osmand', {dev_id}, '{time_str}', '{time_str}', '{time_str}', true, {DEPOT_LAT:.6f}, {DEPOT_LON:.6f}, 12.0, 0.0, 0.0, 'Trạm trung tâm Hàng Tre, P. Long Thạnh Mỹ, TP. Thủ Đức', '{attr_json}', 2.5, '1');"
                    )

        # Update last position pointer on device
        sql_lines.append(f"\nUPDATE TC_DEVICES SET POSITIONID = {pos_id}, LASTUPDATE = '{time_str}' WHERE ID = {dev_id};")

    return "\n".join(sql_lines)

if __name__ == "__main__":
    sql_content = generate_sql()
    with open("/tmp/seed_traccar_reports.sql", "w", encoding="utf-8") as f:
        f.write(sql_content)
    print(f"Generated seed SQL: {len(sql_content.splitlines())} lines written to /tmp/seed_traccar_reports.sql")
