"""
Autonomous, self-contained Waste Collection Presets for NaN-EcoNet.
Contains 8 realistic, large-scale presets with 28 to 67 bins each across District 1, HCMC.
"""
"""
Script to generate ultra-rich waste presets and expanded driver telemetry data.
"""
import json
import random
from pathlib import Path

# All coordinates verified inside District 1 and bordering districts of HCMC (on solid roads, not water).
BINS_MASTER_POOL = [
    # Phường Bến Nghé & Bến Thành (Khu lõi trung tâm)
    {"name": "Chợ Bến Thành (Cửa Nam)", "address": "Quảng trường Quách Thị Trang", "lat": 10.7722, "lon": 106.6985, "type": 2, "collection_type": "centralized"},
    {"name": "Chợ Bến Thành (Cửa Bắc)", "address": "Lê Thánh Tôn", "lat": 10.7730, "lon": 106.6982, "type": 3, "collection_type": "flexible"},
    {"name": "Chợ Bến Thành (Cửa Đông)", "address": "Phan Bội Châu", "lat": 10.7725, "lon": 106.6990, "type": 2, "collection_type": "centralized"},
    {"name": "Chợ Bến Thành (Cửa Tây)", "address": "Phan Chu Trinh", "lat": 10.7728, "lon": 106.6975, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân ngõ 42 Nguyễn Huệ", "address": "Hẻm 42 Nguyễn Huệ", "lat": 10.7735, "lon": 106.7032, "type": 1, "collection_type": "home"},
    {"name": "Phố đi bộ Nguyễn Huệ (Ngô Đức Kế)", "address": "Nguyễn Huệ", "lat": 10.7730, "lon": 106.7048, "type": 3, "collection_type": "flexible"},
    {"name": "Phố đi bộ Nguyễn Huệ (Mạc Thị Bưởi)", "address": "Nguyễn Huệ giao Mạc Thị Bưởi", "lat": 10.7748, "lon": 106.7035, "type": 3, "collection_type": "flexible"},
    {"name": "Nhà hát Thành phố (Opera House)", "address": "Công trường Lam Sơn", "lat": 10.7767, "lon": 106.7032, "type": 3, "collection_type": "flexible"},
    {"name": "Trụ sở UBND Thành phố", "address": "Lê Thánh Tôn", "lat": 10.7768, "lon": 106.7008, "type": 3, "collection_type": "flexible"},
    {"name": "TTTM Vincom Center Đồng Khởi", "address": "72 Lê Thánh Tôn", "lat": 10.7780, "lon": 106.7020, "type": 3, "collection_type": "flexible"},
    {"name": "TTTM Parkson Saigontourist", "address": "Lê Thánh Tôn giao Đồng Khởi", "lat": 10.7775, "lon": 106.7015, "type": 3, "collection_type": "flexible"},
    {"name": "Bưu điện Trung tâm Sài Gòn", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7002, "type": 3, "collection_type": "flexible"},
    {"name": "Nhà thờ Đức Bà Sài Gòn", "address": "1 Công xã Paris", "lat": 10.7798, "lon": 106.6990, "type": 3, "collection_type": "flexible"},
    {"name": "Đường sách Nguyễn Văn Bình", "address": "Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "type": 3, "collection_type": "flexible"},
    {"name": "Dinh Độc Lập (Cổng chính)", "address": "135 Nam Kỳ Khởi Nghĩa", "lat": 10.7770, "lon": 106.6955, "type": 3, "collection_type": "flexible"},
    {"name": "Dinh Độc Lập (Cổng Huyền Trân Công Chúa)", "address": "Huyền Trân Công Chúa", "lat": 10.7755, "lon": 106.6938, "type": 1, "collection_type": "home"},
    {"name": "Công viên Tao Đàn (Trương Định)", "address": "Trương Định", "lat": 10.7745, "lon": 106.6925, "type": 3, "collection_type": "flexible"},
    {"name": "Công viên Tao Đàn (Cách Mạng Tháng 8)", "address": "CMT8 giao Nguyễn Thị Minh Khai", "lat": 10.7738, "lon": 106.6912, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân hẻm 38 CMT8", "address": "Hẻm 38 Cách Mạng Tháng 8", "lat": 10.7728, "lon": 106.6912, "type": 1, "collection_type": "home"},
    {"name": "TTTM Saigon Centre / Takashimaya", "address": "65 Lê Lợi", "lat": 10.7735, "lon": 106.7010, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân ngõ Pasteur", "address": "Hẻm 158 Pasteur", "lat": 10.7750, "lon": 106.6995, "type": 1, "collection_type": "home"},
    {"name": "Hộ dân ngõ Lý Tự Trọng", "address": "Hẻm 26 Lý Tự Trọng", "lat": 10.7785, "lon": 106.7030, "type": 1, "collection_type": "home"},

    # Phường Phạm Ngũ Lão & Nguyễn Cư Trinh (Khu phố Tây & Ẩm thực đêm)
    {"name": "Phố Tây Bùi Viện (Hẻm sâu 20)", "address": "Hẻm 20 Bùi Viện", "lat": 10.7672, "lon": 106.6922, "type": 1, "collection_type": "home"},
    {"name": "Phố Tây Bùi Viện (Hẻm 175)", "address": "Hẻm 175 Bùi Viện", "lat": 10.7672, "lon": 106.6938, "type": 1, "collection_type": "home"},
    {"name": "Trạm thu gom Đề Thám", "address": "Bùi Viện giao Đề Thám", "lat": 10.7678, "lon": 106.6948, "type": 2, "collection_type": "centralized"},
    {"name": "Khu ẩm thực Phạm Ngũ Lão", "address": "Phạm Ngũ Lão", "lat": 10.7680, "lon": 106.6930, "type": 3, "collection_type": "flexible"},
    {"name": "Công viên 23/9 (Khu B)", "address": "Phạm Ngũ Lão mặt công viên", "lat": 10.7690, "lon": 106.6920, "type": 2, "collection_type": "centralized"},
    {"name": "Công viên 23/9 (Khu A)", "address": "Lê Lai mặt công viên", "lat": 10.7712, "lon": 106.6945, "type": 2, "collection_type": "centralized"},
    {"name": "Hộ dân ngõ Cống Quỳnh (Hẻm cụt)", "address": "Hẻm 189C Cống Quỳnh", "lat": 10.7665, "lon": 106.6888, "type": 1, "collection_type": "home"},
    {"name": "Siêu thị Co.opmart Cống Quỳnh", "address": "189 Cống Quỳnh", "lat": 10.7675, "lon": 106.6875, "type": 2, "collection_type": "centralized"},
    {"name": "Bệnh viện Từ Dũ (Cổng Cống Quỳnh)", "address": "284 Cống Quỳnh", "lat": 10.7685, "lon": 106.6865, "type": 2, "collection_type": "centralized"},
    {"name": "Ngã 5 Cống Quỳnh - Nguyễn Trãi", "address": "Ngã 5 Nguyễn Trãi", "lat": 10.7688, "lon": 106.6890, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân hẻm Nguyễn Trãi", "address": "Hẻm 120 Nguyễn Trãi", "lat": 10.7695, "lon": 106.6905, "type": 1, "collection_type": "home"},

    # Phường Nguyễn Thái Bình, Cầu Ông Lãnh & Cô Giang (Khu Chợ Cũ & Ven Kênh)
    {"name": "Hộ dân ngõ Hải Triều (Bitexco)", "address": "Hải Triều", "lat": 10.7715, "lon": 106.7042, "type": 1, "collection_type": "home"},
    {"name": "Bô rác Chợ Cũ Tôn Thất Đạm", "address": "Tôn Thất Đạm", "lat": 10.7720, "lon": 106.7030, "type": 2, "collection_type": "centralized"},
    {"name": "Bô rác Hàm Nghi", "address": "Hàm Nghi giao Nam Kỳ Khởi Nghĩa", "lat": 10.7710, "lon": 106.7020, "type": 2, "collection_type": "centralized"},
    {"name": "Trạm thu Bến Bạch Đằng Waterbus", "address": "Bến Bạch Đằng", "lat": 10.7738, "lon": 106.7058, "type": 2, "collection_type": "centralized"},
    {"name": "Công viên Bến Bạch Đằng (Cột cờ Thủ Ngữ)", "address": "Tôn Đức Thắng", "lat": 10.7682, "lon": 106.7068, "type": 3, "collection_type": "flexible"},
    {"name": "Khu ẩm thực Cầu Mống", "address": "Võ Văn Kiệt chân Cầu Mống", "lat": 10.7690, "lon": 106.7045, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân ngõ Phó Đức Chính", "address": "Phó Đức Chính", "lat": 10.7695, "lon": 106.7005, "type": 1, "collection_type": "home"},
    {"name": "Bảo tàng Mỹ thuật TP.HCM", "address": "97A Phó Đức Chính", "lat": 10.7698, "lon": 106.6998, "type": 3, "collection_type": "flexible"},
    {"name": "Chợ Dân Sinh (Yersin)", "address": "Yersin", "lat": 10.7655, "lon": 106.6965, "type": 3, "collection_type": "flexible"},
    {"name": "Trạm thu gom Cầu Calmette", "address": "Võ Văn Kiệt chân Cầu Calmette", "lat": 10.7670, "lon": 106.6995, "type": 2, "collection_type": "centralized"},
    {"name": "Trạm thu gom Cầu Ông Lãnh", "address": "Võ Văn Kiệt chân Cầu Ông Lãnh", "lat": 10.7645, "lon": 106.6965, "type": 2, "collection_type": "centralized"},
    {"name": "Chợ Cầu Ông Lãnh (Cô Bắc)", "address": "Cô Bắc", "lat": 10.7635, "lon": 106.6948, "type": 2, "collection_type": "centralized"},
    {"name": "Hộ dân ngõ Cô Giang", "address": "Hẻm 88 Cô Giang", "lat": 10.7620, "lon": 106.6930, "type": 1, "collection_type": "home"},
    {"name": "Chợ Cầu Kho (Trần Hưng Đạo)", "address": "Trần Hưng Đạo, Cầu Kho", "lat": 10.7605, "lon": 106.6890, "type": 2, "collection_type": "centralized"},
    {"name": "Hộ dân ngõ Nguyễn Cảnh Chân", "address": "Hẻm Nguyễn Cảnh Chân", "lat": 10.7575, "lon": 106.6872, "type": 1, "collection_type": "home"},
    {"name": "Giao lộ Trần Hưng Đạo - Nguyễn Văn Cừ", "address": "Trần Hưng Đạo", "lat": 10.7580, "lon": 106.6850, "type": 3, "collection_type": "flexible"},
    {"name": "Bến Vân Đồn (Chân Cầu Khánh Hội)", "address": "Bến Vân Đồn, P.12", "lat": 10.7668, "lon": 106.7065, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân ven kênh Bến Vân Đồn", "address": "Bến Vân Đồn", "lat": 10.7650, "lon": 106.7010, "type": 1, "collection_type": "home"},

    # Phường Đa Kao, Tân Định & Giáp Ranh Q.3 (Phía Bắc & Ven Kênh Nhiêu Lộc)
    {"name": "Bô rác Hồ Con Rùa", "address": "Công trường Quốc Tế", "lat": 10.7825, "lon": 106.6965, "type": 2, "collection_type": "centralized"},
    {"name": "Trường ĐH Kinh Tế TP.HCM", "address": "59C Nguyễn Đình Chiểu", "lat": 10.7832, "lon": 106.6955, "type": 3, "collection_type": "flexible"},
    {"name": "Hộ dân hẻm Mạc Đĩnh Chi", "address": "Hẻm 40 Mạc Đĩnh Chi", "lat": 10.7855, "lon": 106.6985, "type": 1, "collection_type": "home"},
    {"name": "Đài truyền hình HTV", "address": "Nguyễn Thị Minh Khai", "lat": 10.7850, "lon": 106.7015, "type": 3, "collection_type": "flexible"},
    {"name": "Trạm gom Cổng Thảo Cầm Viên", "address": "Nguyễn Bỉnh Khiêm", "lat": 10.7875, "lon": 106.7050, "type": 2, "collection_type": "centralized"},
    {"name": "Bảo tàng Lịch sử TP.HCM", "address": "2 Nguyễn Bỉnh Khiêm", "lat": 10.7869, "lon": 106.7046, "type": 3, "collection_type": "flexible"},
    {"name": "Công viên Lê Văn Tám (Cổng Hai Bà Trưng)", "address": "Hai Bà Trưng", "lat": 10.7870, "lon": 106.6950, "type": 2, "collection_type": "centralized"},
    {"name": "Công viên Lê Văn Tám (Cổng Điện Biên Phủ)", "address": "Điện Biên Phủ", "lat": 10.7885, "lon": 106.6965, "type": 3, "collection_type": "flexible"},
    {"name": "Chợ Tân Định (Cổng Hai Bà Trưng)", "address": "336 Hai Bà Trưng", "lat": 10.7885, "lon": 106.6915, "type": 2, "collection_type": "centralized"},
    {"name": "Chợ Tân Định (Cổng Nguyễn Hữu Cầu)", "address": "Nguyễn Hữu Cầu", "lat": 10.7892, "lon": 106.6910, "type": 3, "collection_type": "flexible"},
    {"name": "Nhà thờ Tân Định (Màu hồng)", "address": "289 Hai Bà Trưng", "lat": 10.7868, "lon": 106.6908, "type": 3, "collection_type": "flexible"},
    {"name": "Chợ Đa Kao (Nguyễn Huy Tự)", "address": "Nguyễn Huy Tự, Đa Kao", "lat": 10.7915, "lon": 106.6995, "type": 2, "collection_type": "centralized"},
    {"name": "Trạm gom Cầu Bông (Hoàng Sa)", "address": "Hoàng Sa chân Cầu Bông", "lat": 10.7930, "lon": 106.6960, "type": 2, "collection_type": "centralized"},
    {"name": "Hộ dân ven kênh Trường Sa", "address": "Trường Sa, Đa Kao", "lat": 10.7925, "lon": 106.6980, "type": 1, "collection_type": "home"},
    {"name": "Trạm gom Cầu Thị Nghè", "address": "Nguyễn Thị Minh Khai chân Cầu Thị Nghè", "lat": 10.7910, "lon": 106.7050, "type": 2, "collection_type": "centralized"},
    {"name": "Hộ dân ngõ Phan Kế Bính", "address": "Hẻm Phan Kế Bính, Đa Kao", "lat": 10.7895, "lon": 106.6985, "type": 1, "collection_type": "home"}
]

print(f"Total Unique Verified Bins in Master Pool: {len(BINS_MASTER_POOL)}")

"""
Comprehensive Waste Collection Presets Generator for NaN-EcoNet.
Generates 8 realistic, large-scale presets with 28 to 67 bins each across District 1, HCMC.
"""



# 1. Preset 1: Mạng Lưới Toàn Diện Q.1 & Trung Tâm TP.HCM (55 Bins, 4 Vehicles)
p1_bins_pool = BINS_MASTER_POOL[:55]
preset_1_bins = []
for idx, b in enumerate(p1_bins_pool):
    item = dict(b)
    item["id"] = idx + 1
    # Realistic fill levels with peak distribution
    fill = 60 + ((idx * 7) % 41)
    if idx in [0, 4, 13, 22, 33, 44, 51]:
        fill = random_fill = 95
    item["fill_level"] = fill
    item["demand"] = int(fill * 0.5)
    item["sensor_status"] = "active"
    item["battery_pct"] = 80 + ((idx * 3) % 20)
    item["temperature_c"] = round(28.0 + ((idx * 1.3) % 6.5), 1)
    item["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    item["last_collected_mins"] = 60 + ((idx * 17) % 300)
    preset_1_bins.append(item)

# 2. Preset 2: Khu Ẩm Thực Phố Đi Bộ & Bến Thành - Bùi Viện (32 Bins, 3 Vehicles)
p2_indices = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 21,  # Bến Thành, Nguyễn Huệ, Đồng Khởi, Lê Lợi
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,      # Bùi Viện, Đề Thám, Phạm Ngũ Lão, Cống Quỳnh
    33, 34, 35, 36, 37, 38, 39                       # Chợ Cũ, Hàm Nghi, Bạch Đằng, Cầu Mống
]
preset_2_bins = []
for new_id, idx in enumerate(p2_indices):
    b = dict(BINS_MASTER_POOL[idx])
    b["id"] = new_id + 1
    fill = 70 + ((new_id * 5) % 31)
    if new_id in [0, 3, 14, 15, 25]:
        fill = 100
    b["fill_level"] = fill
    b["demand"] = int(fill * 0.5)
    b["sensor_status"] = "active"
    b["battery_pct"] = 82 + ((new_id * 4) % 18)
    b["temperature_c"] = round(29.0 + ((new_id * 1.1) % 6.0), 1)
    b["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    b["last_collected_mins"] = 45 + ((new_id * 13) % 240)
    preset_2_bins.append(b)

# 3. Preset 3: Tuyến Di Tích Lịch Sử, Văn Hóa & Công Viên (30 Bins, 3 Vehicles)
p3_indices = [
    7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,     # Lam Sơn, Bưu Điện, Nhà Thờ, Dinh Độc Lập, Tao Đàn
    50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,      # Hồ Con Rùa, ĐH Kinh Tế, HTV, Thảo Cầm Viên, CV Lê Văn Tám, Tân Định
    4, 5, 19, 20, 37, 39                             # Nguyễn Huệ, Takashimaya, Bảo Tàng Mỹ Thuật
]
preset_3_bins = []
for new_id, idx in enumerate(p3_indices):
    b = dict(BINS_MASTER_POOL[idx])
    b["id"] = new_id + 1
    fill = 65 + ((new_id * 6) % 35)
    b["fill_level"] = fill
    b["demand"] = int(fill * 0.5)
    b["sensor_status"] = "active"
    b["battery_pct"] = 85 + ((new_id * 3) % 15)
    b["temperature_c"] = round(28.5 + ((new_id * 1.2) % 5.5), 1)
    b["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    b["last_collected_mins"] = 90 + ((new_id * 15) % 320)
    preset_3_bins.append(b)

# 4. Preset 4: Vành Đai Ven Sông Sài Gòn - Cầu Mống - Bến Vân Đồn (28 Bins, 3 Vehicles)
p4_indices = [
    5, 6, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44,  # Bạch Đằng, Bitexco, Chợ Cũ, Cầu Mống, Cầu Calmette, Cầu Ông Lãnh
    45, 46, 47, 48, 49,                                     # Cô Giang, Cầu Kho, Bến Vân Đồn, Cầu Khánh Hội
    0, 2, 7, 19, 24, 25, 26, 27, 28                        # Bến Thành, Lam Sơn, Đề Thám, Phạm Ngũ Lão
]
preset_4_bins = []
for new_id, idx in enumerate(p4_indices):
    b = dict(BINS_MASTER_POOL[idx])
    b["id"] = new_id + 1
    fill = 65 + ((new_id * 7) % 35)
    if new_id in [2, 3, 7, 15]:
        fill = 95
    b["fill_level"] = fill
    b["demand"] = int(fill * 0.5)
    b["sensor_status"] = "active"
    b["battery_pct"] = 84 + ((new_id * 4) % 16)
    b["temperature_c"] = round(28.0 + ((new_id * 1.4) % 6.0), 1)
    b["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    b["last_collected_mins"] = 60 + ((new_id * 20) % 280)
    preset_4_bins.append(b)

# 5. Preset 5: Giờ Cao Điểm Lễ Hội & Chợ Đêm Sài Gòn (36 Bins, 4 Vehicles)
p5_indices = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16,      # Phố đi bộ, Chợ Bến Thành, Nhà Thờ, Dinh Độc Lập
    22, 23, 24, 25, 26, 27, 31, 33, 34, 35, 36, 37, 38,     # Bùi Viện, Đề Thám, Bạch Đằng, Cầu Mống, Chợ Cũ
    50, 53, 54, 55, 57, 58, 60, 61                          # Hồ Con Rùa, Thảo Cầm Viên, Chợ Tân Định, Đa Kao
]
preset_5_bins = []
for new_id, idx in enumerate(p5_indices):
    b = dict(BINS_MASTER_POOL[idx])
    b["id"] = new_id + 1
    fill = 80 + ((new_id * 4) % 21)  # High fill for festival hours
    if new_id in [0, 4, 15, 16, 20, 28]:
        fill = 100
    b["fill_level"] = fill
    b["demand"] = int(fill * 0.5)
    b["sensor_status"] = "active"
    b["battery_pct"] = 88 + ((new_id * 3) % 12)
    b["temperature_c"] = round(29.5 + ((new_id * 1.1) % 5.5), 1)
    b["odor_level"] = "high" if fill >= 85 else "medium"
    b["last_collected_mins"] = 30 + ((new_id * 11) % 180)
    preset_5_bins.append(b)

# 6. Preset 6: Tuyến Thu Gom Ngõ Hẻm Sâu & Xe Máy Điện / Đi Bộ (40 Bins, 3 Vehicles)
p6_indices = [
    4, 15, 18, 20, 21, 22, 23, 28, 31, 32, 33, 37, 38, 41, 43, 44, 45, 46, 48, 51, 52, 63, 65,  # All home/alley bins
    0, 1, 3, 5, 8, 12, 16, 24, 25, 27, 34, 40, 42, 50, 54, 58, 61                               # Supporting street bins
]
preset_6_bins = []
for new_id, idx in enumerate(p6_indices):
    b = dict(BINS_MASTER_POOL[idx])
    b["id"] = new_id + 1
    fill = 70 + ((new_id * 5) % 31)
    b["fill_level"] = fill
    b["demand"] = int(fill * 0.5)
    b["sensor_status"] = "active"
    b["battery_pct"] = 85 + ((new_id * 2) % 15)
    b["temperature_c"] = round(28.2 + ((new_id * 1.3) % 5.8), 1)
    b["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    b["last_collected_mins"] = 80 + ((new_id * 19) % 360)
    preset_6_bins.append(b)

# 7. Preset 7: Khu Vực Mở Rộng Tân Định - Nhiêu Lộc - Thị Nghè (38 Bins, 3 Vehicles)
p7_indices = [
    50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65,  # Tân Định, Đa Kao, Kênh Nhiêu Lộc, Thị Nghè
    7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,                          # Dinh Độc Lập, Nhà Thờ, Bưu Điện, Tao Đàn
    0, 1, 4, 5, 6, 19, 20, 21, 33, 34, 35                            # Trung tâm Bến Nghé
]
preset_7_bins = []
for new_id, idx in enumerate(p7_indices):
    b = dict(BINS_MASTER_POOL[idx])
    b["id"] = new_id + 1
    fill = 65 + ((new_id * 6) % 35)
    if new_id in [0, 8, 9, 13, 14]:
        fill = 95
    b["fill_level"] = fill
    b["demand"] = int(fill * 0.5)
    b["sensor_status"] = "active"
    b["battery_pct"] = 83 + ((new_id * 4) % 17)
    b["temperature_c"] = round(28.6 + ((new_id * 1.2) % 5.4), 1)
    b["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    b["last_collected_mins"] = 60 + ((new_id * 18) % 300)
    preset_7_bins.append(b)

# 8. Preset 8: Đại Đô Thị TP.HCM - Mega Fleet Simulation (67 Bins, 5 Vehicles)
preset_8_bins = []
for idx, b in enumerate(BINS_MASTER_POOL):
    item = dict(b)
    item["id"] = idx + 1
    fill = 60 + ((idx * 8) % 41)
    if idx in [0, 4, 12, 22, 24, 34, 43, 54, 58, 62]:
        fill = 100
    item["fill_level"] = fill
    item["demand"] = int(fill * 0.5)
    item["sensor_status"] = "active"
    item["battery_pct"] = 85 + ((idx * 3) % 15)
    item["temperature_c"] = round(28.0 + ((idx * 1.1) % 6.2), 1)
    item["odor_level"] = "high" if fill >= 90 else ("medium" if fill >= 75 else "low")
    item["last_collected_mins"] = 45 + ((idx * 14) % 320)
    preset_8_bins.append(item)


WASTE_PRESETS = [
    {
        "id": 1,
        "name": "Mạng Lưới Toàn Diện Q.1 & Trung Tâm (55 Điểm Gom)",
        "theme_color": "#10b981",
        "theme_gradient": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Bến Nghé (Depot)", "lat": 10.7745, "lon": 106.7042, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": preset_1_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Đội Bắc)", "capacity": 550, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
            {"id": 2, "name": "Xe rác số 2 (Đội Trung Tâm)", "capacity": 550, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038},
            {"id": 3, "name": "Xe rác số 3 (Đội Đông)", "capacity": 550, "color": "#8b5cf6", "lat": 10.7750, "lon": 106.7040},
            {"id": 4, "name": "Xe rác số 4 (Đội Nam)", "capacity": 550, "color": "#f59e0b", "lat": 10.7740, "lon": 106.7045}
        ]
    },
    {
        "id": 2,
        "name": "Khu Ẩm Thực Phố Đi Bộ & Bến Thành - Bùi Viện (32 Điểm Gom)",
        "theme_color": "#8b5cf6",
        "theme_gradient": "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Công viên 23/9", "lat": 10.7690, "lon": 106.6945, "address": "Công viên 23/9, Q.1, TP.HCM"},
        "bins": preset_2_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Phố Đi Bộ)", "capacity": 450, "color": "#10b981", "lat": 10.7692, "lon": 106.6948},
            {"id": 2, "name": "Xe rác số 2 (Bùi Viện)", "capacity": 450, "color": "#3b82f6", "lat": 10.7688, "lon": 106.6942},
            {"id": 3, "name": "Xe rác số 3 (Chợ Bến Thành)", "capacity": 450, "color": "#8b5cf6", "lat": 10.7695, "lon": 106.6950}
        ]
    },
    {
        "id": 3,
        "name": "Tuyến Di Tích Lịch Sử, Văn Hóa & Công Viên (30 Điểm Gom)",
        "theme_color": "#f59e0b",
        "theme_gradient": "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Thảo Cầm Viên", "lat": 10.7885, "lon": 106.7045, "address": "Nguyễn Bỉnh Khiêm, Q.1, TP.HCM"},
        "bins": preset_3_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Di Tích)", "capacity": 450, "color": "#10b981", "lat": 10.7888, "lon": 106.7048},
            {"id": 2, "name": "Xe rác số 2 (Công Viên)", "capacity": 450, "color": "#3b82f6", "lat": 10.7882, "lon": 106.7042},
            {"id": 3, "name": "Xe rác số 3 (Hồ Con Rùa)", "capacity": 450, "color": "#f59e0b", "lat": 10.7886, "lon": 106.7040}
        ]
    },
    {
        "id": 4,
        "name": "Vành Đai Ven Sông Sài Gòn - Cầu Mống - Bến Vân Đồn (28 Điểm Gom)",
        "theme_color": "#06b6d4",
        "theme_gradient": "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Cảng Bến Nghé", "lat": 10.7680, "lon": 106.7070, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": preset_4_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Ven Sông)", "capacity": 400, "color": "#10b981", "lat": 10.7682, "lon": 106.7072},
            {"id": 2, "name": "Xe rác số 2 (Cầu Mống)", "capacity": 400, "color": "#3b82f6", "lat": 10.7678, "lon": 106.7068},
            {"id": 3, "name": "Xe rác số 3 (Bến Vân Đồn)", "capacity": 400, "color": "#06b6d4", "lat": 10.7685, "lon": 106.7075}
        ]
    },
    {
        "id": 5,
        "name": "Giờ Cao Điểm Lễ Hội & Chợ Đêm Sài Gòn (36 Điểm Gom)",
        "theme_color": "#ec4899",
        "theme_gradient": "linear-gradient(135deg, #db2777 0%, #ec4899 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Bến Nghé (Depot)", "lat": 10.7745, "lon": 106.7042, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": preset_5_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Đội Phản Ứng)", "capacity": 450, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
            {"id": 2, "name": "Xe rác số 2 (Đội Lễ Hội)", "capacity": 450, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038},
            {"id": 3, "name": "Xe rác số 3 (Đội Chợ Đêm)", "capacity": 450, "color": "#ec4899", "lat": 10.7750, "lon": 106.7040},
            {"id": 4, "name": "Xe rác số 4 (Đội Tăng Cường)", "capacity": 450, "color": "#8b5cf6", "lat": 10.7740, "lon": 106.7044}
        ]
    },
    {
        "id": 6,
        "name": "Tuyến Thu Gom Ngõ Hẻm Sâu & Xe Máy Điện (40 Điểm Gom)",
        "theme_color": "#14b8a6",
        "theme_gradient": "linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Cống Quỳnh", "lat": 10.7665, "lon": 106.6890, "address": "189 Cống Quỳnh, Q.1, TP.HCM"},
        "bins": preset_6_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe Điện Mini GreenFleet 1", "capacity": 350, "color": "#14b8a6", "lat": 10.7668, "lon": 106.6892},
            {"id": 2, "name": "Xe Điện Mini GreenFleet 2", "capacity": 350, "color": "#06b6d4", "lat": 10.7662, "lon": 106.6888},
            {"id": 3, "name": "Xe Tải Nhẹ Luồn Hẻm 3", "capacity": 400, "color": "#3b82f6", "lat": 10.7670, "lon": 106.6895}
        ]
    },
    {
        "id": 7,
        "name": "Khu Vực Tân Định - Nhiêu Lộc - Thị Nghè (38 Điểm Gom)",
        "theme_color": "#f97316",
        "theme_gradient": "linear-gradient(135deg, #ea580c 0%, #f97316 100%)",
        "depot": {"id": 0, "name": "Trạm trung chuyển Cầu Bông", "lat": 10.7930, "lon": 106.6960, "address": "Hoàng Sa chân Cầu Bông, Đa Kao"},
        "bins": preset_7_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Kênh Nhiêu Lộc)", "capacity": 450, "color": "#f97316", "lat": 10.7932, "lon": 106.6962},
            {"id": 2, "name": "Xe rác số 2 (Chợ Tân Định)", "capacity": 450, "color": "#10b981", "lat": 10.7928, "lon": 106.6958},
            {"id": 3, "name": "Xe rác số 3 (Thị Nghè)", "capacity": 450, "color": "#8b5cf6", "lat": 10.7935, "lon": 106.6965}
        ]
    },
    {
        "id": 8,
        "name": "Đại Đô Thị TP.HCM - Mega Fleet Simulation (67 Điểm Gom)",
        "theme_color": "#6366f1",
        "theme_gradient": "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Trung Tâm Bến Nghé", "lat": 10.7745, "lon": 106.7042, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": preset_8_bins,
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe số 1 (Đội Bắc - Tân Định)", "capacity": 600, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
            {"id": 2, "name": "Xe số 2 (Đội Tây - Bến Thành/Bùi Viện)", "capacity": 600, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038},
            {"id": 3, "name": "Xe số 3 (Đội Trung Tâm - Nguyễn Huệ)", "capacity": 600, "color": "#8b5cf6", "lat": 10.7750, "lon": 106.7040},
            {"id": 4, "name": "Xe số 4 (Đội Nam - Kênh Bến Nghé)", "capacity": 600, "color": "#f59e0b", "lat": 10.7740, "lon": 106.7045},
            {"id": 5, "name": "Xe số 5 (Đội Cơ Động Phản Ứng Nhanh)", "capacity": 600, "color": "#ec4899", "lat": 10.7746, "lon": 106.7043}
        ]
    }
]
