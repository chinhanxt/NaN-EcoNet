"""
Dedicated Waste Collection Map Server on port 8502.
Uses FastAPI + Uvicorn to serve the MapLibre GL UI and Dynamic Waste Routing APIs.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import random

import json
import urllib.request
from waste_solver import (
    solve_waste_vrp,
    solve_ortools_vrp,
    solve_baseline_vrp,
    compare_solvers,
    resolve_incident,
    ROUTE_CACHE,
    CACHE_FILE,
)
from telemetry_ml import (
    TELEMETRY_MGR,
    GLOBAL_ML_ENGINE,
    CORNER_NODES,
    DRIVERS_FLEET,
    CORNER_NODES_DICT,
    RAG_GRAPH_SPEC,
    RAG_PRESET_TRIPS,
    generate_dense_rag_network,
)

app = FastAPI(title="Smart Waste Collection & Incident Dispatching Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAP_UI_DIR = Path(__file__).parent


WASTE_PRESETS = [
    {
        "id": 1,
        "name": "Mạng Lưới Toàn Q.1 (28 Thùng Rác Đô Thị)",
        "theme_color": "#10b981",
        "theme_gradient": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Bến Nghé (Depot)", "lat": 10.7745, "lon": 106.7042, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Chợ Bến Thành (Cửa Nam)", "address": "Quảng trường Quách Thị Trang", "lat": 10.7722, "lon": 106.6985, "fill_level": 95, "demand": 48, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Chợ Bến Thành (Cửa Bắc)", "address": "Lê Thánh Tôn", "lat": 10.7730, "lon": 106.6982, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Hộ dân ngõ 42 Nguyễn Huệ", "address": "Hẻm 42 Nguyễn Huệ", "lat": 10.7735, "lon": 106.7032, "fill_level": 90, "demand": 45, "collection_type": "home", "type": 1},
            {"id": 4, "name": "Phố đi bộ Nguyễn Huệ (Ngô Đức Kế)", "address": "Nguyễn Huệ", "lat": 10.7730, "lon": 106.7048, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 5, "name": "Nhà hát Thành phố (Opera House)", "address": "Công trường Lam Sơn", "lat": 10.7767, "lon": 106.7032, "fill_level": 70, "demand": 35, "collection_type": "flexible", "type": 3},
            {"id": 6, "name": "Trụ sở UBND Thành phố", "address": "Lê Thánh Tôn", "lat": 10.7768, "lon": 106.7008, "fill_level": 60, "demand": 30, "collection_type": "flexible", "type": 3},
            {"id": 7, "name": "TTTM Vincom Center Đồng Khởi", "address": "72 Lê Thánh Tôn", "lat": 10.7780, "lon": 106.7020, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 8, "name": "Bưu điện Trung tâm Sài Gòn", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7002, "fill_level": 75, "demand": 38, "collection_type": "flexible", "type": 3},
            {"id": 9, "name": "Nhà thờ Đức Bà Sài Gòn", "address": "1 Công xã Paris", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 10, "name": "Dinh Độc Lập (Cổng chính)", "address": "135 Nam Kỳ Khởi Nghĩa", "lat": 10.7770, "lon": 106.6955, "fill_level": 70, "demand": 35, "collection_type": "flexible", "type": 3},
            {"id": 11, "name": "Hộ dân ngõ Huyền Trân Công Chúa", "address": "Huyền Trân Công Chúa", "lat": 10.7755, "lon": 106.6938, "fill_level": 85, "demand": 42, "collection_type": "home", "type": 1},
            {"id": 12, "name": "Công viên Tao Đàn (Trương Định)", "address": "Trương Định", "lat": 10.7745, "lon": 106.6925, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 13, "name": "Hộ dân hẻm CMT8", "address": "Cách Mạng Tháng 8", "lat": 10.7728, "lon": 106.6912, "fill_level": 90, "demand": 45, "collection_type": "home", "type": 1},
            {"id": 14, "name": "Phố Tây Bùi Viện (Hẻm sâu)", "address": "Hẻm 20 Bùi Viện", "lat": 10.7672, "lon": 106.6922, "fill_level": 100, "demand": 50, "collection_type": "home", "type": 1},
            {"id": 15, "name": "Trạm thu gom Đề Thám", "address": "Bùi Viện giao Đề Thám", "lat": 10.7678, "lon": 106.6948, "fill_level": 95, "demand": 48, "collection_type": "centralized", "type": 2},
            {"id": 16, "name": "Khu ẩm thực Phạm Ngũ Lão", "address": "Phạm Ngũ Lão", "lat": 10.7680, "lon": 106.6930, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 17, "name": "TTTM Saigon Centre / Takashimaya", "address": "65 Lê Lợi", "lat": 10.7735, "lon": 106.7010, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 18, "name": "Hộ dân ngõ Hải Triều (Bitexco)", "address": "Hải Triều", "lat": 10.7715, "lon": 106.7042, "fill_level": 80, "demand": 40, "collection_type": "home", "type": 1},
            {"id": 19, "name": "Bô rác Chợ Cũ Tôn Thất Đạm", "address": "Tôn Thất Đạm", "lat": 10.7720, "lon": 106.7030, "fill_level": 95, "demand": 48, "collection_type": "centralized", "type": 2},
            {"id": 20, "name": "Trạm thu Bến Bạch Đằng Waterbus", "address": "Bến Bạch Đằng", "lat": 10.7738, "lon": 106.7058, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 21, "name": "Công viên Bến Bạch Đằng (Thủ Ngữ)", "address": "Tôn Đức Thắng", "lat": 10.7682, "lon": 106.7068, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 22, "name": "Khu ẩm thực Cầu Mống", "address": "Võ Văn Kiệt chân Cầu Mống", "lat": 10.7690, "lon": 106.7045, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 23, "name": "Hộ dân ngõ Phó Đức Chính", "address": "Phó Đức Chính", "lat": 10.7695, "lon": 106.7005, "fill_level": 75, "demand": 38, "collection_type": "home", "type": 1},
            {"id": 24, "name": "Chợ Dân Sinh (Yersin)", "address": "Yersin", "lat": 10.7655, "lon": 106.6965, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 25, "name": "Hộ dân hẻm Cống Quỳnh", "address": "189C Cống Quỳnh", "lat": 10.7665, "lon": 106.6888, "fill_level": 85, "demand": 42, "collection_type": "home", "type": 1},
            {"id": 26, "name": "Bô rác Hồ Con Rùa", "address": "Công trường Quốc Tế", "lat": 10.7825, "lon": 106.6965, "fill_level": 100, "demand": 50, "collection_type": "centralized", "type": 2},
            {"id": 27, "name": "Trạm gom Cổng Thảo Cầm Viên", "address": "Nguyễn Bỉnh Khiêm", "lat": 10.7875, "lon": 106.7050, "fill_level": 85, "demand": 42, "collection_type": "centralized", "type": 2},
            {"id": 28, "name": "Chợ Tân Định", "address": "Hai Bà Trưng", "lat": 10.7885, "lon": 106.6915, "fill_level": 95, "demand": 48, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1 (Đội Bắc)", "capacity": 450, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
            {"id": 2, "name": "Xe rác số 2 (Đội Trung Tâm)", "capacity": 450, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038},
            {"id": 3, "name": "Xe rác số 3 (Đội Đông)", "capacity": 450, "color": "#8b5cf6", "lat": 10.7750, "lon": 106.7040}
        ]
    },
    {
        "id": 2,
        "name": "Khu Ẩm Thực Chợ Bến Thành - Bùi Viện",
        "theme_color": "#8b5cf6",
        "theme_gradient": "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Công viên 23/9", "lat": 10.7690, "lon": 106.6945, "address": "Công viên 23/9, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Bô rác Chợ Bến Thành cửa Nam", "address": "Chợ Bến Thành cửa Nam", "lat": 10.7720, "lon": 106.6982, "fill_level": 95, "demand": 48, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Hộ kinh doanh Phan Chu Trinh", "address": "Phan Chu Trinh", "lat": 10.7724, "lon": 106.6978, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Cửa hàng Chợ Bến Thành cửa Bắc", "address": "Chợ Bến Thành cửa Bắc", "lat": 10.7735, "lon": 106.6985, "fill_level": 70, "demand": 35, "collection_type": "flexible", "type": 3},
            {"id": 4, "name": "Hộ dân hẻm 175 Bùi Viện", "address": "Hẻm 175 Bùi Viện", "lat": 10.7672, "lon": 106.6938, "fill_level": 100, "demand": 50, "collection_type": "home", "type": 1},
            {"id": 5, "name": "Trạm thu gom tập trung Đề Thám", "address": "Khu ẩm thực đêm Đề Thám", "lat": 10.7665, "lon": 106.6925, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 6, "name": "Quán bia Phạm Ngũ Lão", "address": "Phạm Ngũ Lão", "lat": 10.7670, "lon": 106.6928, "fill_level": 60, "demand": 30, "collection_type": "flexible", "type": 3},
            {"id": 7, "name": "Hộ dân ngõ Cống Quỳnh (Hẻm cụt)", "address": "Hẻm Cống Quỳnh", "lat": 10.7660, "lon": 106.6895, "fill_level": 75, "demand": 38, "collection_type": "home", "type": 1},
            {"id": 8, "name": "Cửa hàng Nguyễn Thái Học", "address": "Nguyễn Thái Học", "lat": 10.7650, "lon": 106.6960, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 9, "name": "Trạm thu gom Trần Hưng Đạo", "address": "Trần Hưng Đạo", "lat": 10.7678, "lon": 106.6968, "fill_level": 65, "demand": 32, "collection_type": "centralized", "type": 2},
            {"id": 10, "name": "Hộ dân Tôn Thất Tùng", "address": "Tôn Thất Tùng", "lat": 10.7705, "lon": 106.6890, "fill_level": 70, "demand": 35, "collection_type": "flexible", "type": 3},
            {"id": 11, "name": "Hộ dân hẻm Trương Định", "address": "Trương Định", "lat": 10.7745, "lon": 106.6940, "fill_level": 80, "demand": 40, "collection_type": "home", "type": 1},
            {"id": 12, "name": "Hộ dân Nguyễn Du", "address": "Nguyễn Du", "lat": 10.7760, "lon": 106.6965, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 13, "name": "Nhà hàng Lý Tự Trọng", "address": "Lý Tự Trọng", "lat": 10.7740, "lon": 106.6995, "fill_level": 90, "demand": 45, "collection_type": "home", "type": 1},
            {"id": 14, "name": "Hộ dân Nguyễn Thị Nghĩa", "address": "Nguyễn Thị Nghĩa", "lat": 10.7700, "lon": 106.6925, "fill_level": 60, "demand": 30, "collection_type": "flexible", "type": 3},
            {"id": 15, "name": "Trạm gom Công viên 23/9 (Lê Lai)", "address": "Lê Lai mặt công viên", "lat": 10.7712, "lon": 106.6945, "fill_level": 75, "demand": 38, "collection_type": "centralized", "type": 2}
        ],
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1", "capacity": 300, "color": "#10b981", "lat": 10.7692, "lon": 106.6948},
            {"id": 2, "name": "Xe rác số 2", "capacity": 300, "color": "#3b82f6", "lat": 10.7688, "lon": 106.6942},
            {"id": 3, "name": "Xe rác số 3", "capacity": 300, "color": "#8b5cf6", "lat": 10.7695, "lon": 106.6950}
        ]
    },
    {
        "id": 3,
        "name": "Di Tích Lịch Sử & Hồ Con Rùa",
        "theme_color": "#f59e0b",
        "theme_gradient": "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Thảo Cầm Viên", "lat": 10.7885, "lon": 106.7045, "address": "Nguyễn Bỉnh Khiêm, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Trạm thu gom Cổng Thảo Cầm Viên", "address": "Cổng Thảo Cầm Viên", "lat": 10.7875, "lon": 106.7052, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Bảo tàng Lịch sử TP.HCM", "address": "Nguyễn Bỉnh Khiêm", "lat": 10.7869, "lon": 106.7046, "fill_level": 70, "demand": 35, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Đài truyền hình HTV", "address": "Nguyễn Thị Minh Khai", "lat": 10.7850, "lon": 106.7015, "fill_level": 80, "demand": 40, "collection_type": "home", "type": 1},
            {"id": 4, "name": "Trạm thu gom Hồ Con Rùa", "address": "Công trường Quốc Tế", "lat": 10.7825, "lon": 106.6965, "fill_level": 95, "demand": 48, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Quán cà phê Nhà thờ Đức Bà", "address": "Công xã Paris", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 6, "name": "Bưu điện Thành phố", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7001, "fill_level": 75, "demand": 38, "collection_type": "flexible", "type": 3},
            {"id": 7, "name": "Đường sách Nguyễn Văn Bình", "address": "Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "fill_level": 60, "demand": 30, "collection_type": "flexible", "type": 3},
            {"id": 8, "name": "Dinh Độc Lập cổng chính", "address": "Nam Kỳ Khởi Nghĩa", "lat": 10.7770, "lon": 106.6955, "fill_level": 85, "demand": 42, "collection_type": "home", "type": 1},
            {"id": 9, "name": "Hộ dân ngõ Huyền Trân Công Chúa", "address": "Cổng sau Dinh Độc Lập", "lat": 10.7755, "lon": 106.6935, "fill_level": 70, "demand": 35, "collection_type": "home", "type": 1},
            {"id": 10, "name": "Trạm thu tập trung Công viên 30/4", "address": "Công viên 30/4", "lat": 10.7788, "lon": 106.6980, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 11, "name": "Hộ dân Lê Duẩn - Hai Bà Trưng", "address": "Lê Duẩn giao Hai Bà Trưng", "lat": 10.7818, "lon": 106.7002, "fill_level": 65, "demand": 32, "collection_type": "flexible", "type": 3},
            {"id": 12, "name": "Hộ dân hẻm Mạc Đĩnh Chi", "address": "Hẻm Mạc Đĩnh Chi", "lat": 10.7855, "lon": 106.6985, "fill_level": 70, "demand": 35, "collection_type": "home", "type": 1},
            {"id": 13, "name": "Hộ dân Nguyễn Đình Chiểu", "address": "Nguyễn Đình Chiểu", "lat": 10.7840, "lon": 106.6945, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1", "capacity": 300, "color": "#10b981", "lat": 10.7888, "lon": 106.7048},
            {"id": 2, "name": "Xe rác số 2", "capacity": 300, "color": "#3b82f6", "lat": 10.7882, "lon": 106.7042}
        ]
    },
    {
        "id": 4,
        "name": "Tuyến Ven Sông Sài Gòn & Cầu Mống",
        "theme_color": "#06b6d4",
        "theme_gradient": "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Cảng Bến Nghé", "lat": 10.7680, "lon": 106.7070, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Trạm thu gom Bến Nhà Rồng", "address": "Bến Nhà Rồng", "lat": 10.7682, "lon": 106.7068, "fill_level": 85, "demand": 42, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Hộ dân ven Cầu Mống", "address": "Chân Cầu Mống", "lat": 10.7688, "lon": 106.7058, "fill_level": 95, "demand": 48, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Hộ dân mặt tiền Võ Văn Kiệt", "address": "Võ Văn Kiệt", "lat": 10.7705, "lon": 106.7035, "fill_level": 75, "demand": 38, "collection_type": "flexible", "type": 3},
            {"id": 4, "name": "Trạm thu Bến Bạch Đằng Waterbus", "address": "Bến Bạch Đằng Waterbus", "lat": 10.7735, "lon": 106.7058, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Quán nước Tôn Đức Thắng", "address": "Tôn Đức Thắng giao Hàm Nghi", "lat": 10.7728, "lon": 106.7052, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 6, "name": "Bô rác Hàm Nghi chợ cũ", "address": "Hàm Nghi chợ cũ", "lat": 10.7720, "lon": 106.7020, "fill_level": 100, "demand": 50, "collection_type": "centralized", "type": 2},
            {"id": 7, "name": "Tòa nhà Bitexco (Thu gom riêng)", "address": "Hải Triều, Bitexco", "lat": 10.7715, "lon": 106.7040, "fill_level": 70, "demand": 35, "collection_type": "home", "type": 1},
            {"id": 8, "name": "Hộ dân hẻm Pasteur ven bờ kênh", "address": "Hẻm Pasteur", "lat": 10.7690, "lon": 106.7025, "fill_level": 65, "demand": 32, "collection_type": "home", "type": 1},
            {"id": 9, "name": "Hộ dân Phó Đức Chính", "address": "Phó Đức Chính", "lat": 10.7695, "lon": 106.7005, "fill_level": 75, "demand": 38, "collection_type": "flexible", "type": 3},
            {"id": 10, "name": "Hộ dân hẻm Calmette", "address": "Hẻm Calmette", "lat": 10.7680, "lon": 106.6995, "fill_level": 80, "demand": 40, "collection_type": "home", "type": 1},
            {"id": 11, "name": "Trạm thu gom Cầu Ông Lãnh", "address": "Chân Cầu Ông Lãnh", "lat": 10.7655, "lon": 106.6975, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 12, "name": "Hộ dân Bến Vân Đồn ven sông", "address": "Bến Vân Đồn", "lat": 10.7665, "lon": 106.7005, "fill_level": 70, "demand": 35, "collection_type": "flexible", "type": 3},
            {"id": 13, "name": "Hộ dân Nguyễn Thái Bình", "address": "Nguyễn Thái Bình", "lat": 10.7700, "lon": 106.6990, "fill_level": 60, "demand": 30, "collection_type": "flexible", "type": 3},
            {"id": 14, "name": "Hộ dân Nam Kỳ Khởi Nghĩa ven kênh", "address": "Nam Kỳ Khởi Nghĩa", "lat": 10.7710, "lon": 106.7015, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1", "capacity": 300, "color": "#10b981", "lat": 10.7682, "lon": 106.7072},
            {"id": 2, "name": "Xe rác số 2", "capacity": 300, "color": "#3b82f6", "lat": 10.7678, "lon": 106.7068},
            {"id": 3, "name": "Xe rác số 3", "capacity": 300, "color": "#06b6d4", "lat": 10.7685, "lon": 106.7075}
        ]
    },
    {
        "id": 5,
        "name": "Giờ Cao Điểm Lễ Hội (Toàn Quận 1)",
        "theme_color": "#ec4899",
        "theme_gradient": "linear-gradient(135deg, #db2777 0%, #ec4899 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Bến Nghé (Depot)", "lat": 10.7745, "lon": 106.7042, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Hộ dân ngõ 42 Nguyễn Huệ", "address": "Hẻm 42 Nguyễn Huệ", "lat": 10.7735, "lon": 106.7032, "fill_level": 100, "demand": 50, "collection_type": "home", "type": 1},
            {"id": 2, "name": "Cửa hàng quà Bạch Đằng", "address": "Bến Bạch Đằng", "lat": 10.7726, "lon": 106.7060, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Hộ dân hẻm Đồng Khởi", "address": "Đồng Khởi", "lat": 10.7768, "lon": 106.7035, "fill_level": 100, "demand": 50, "collection_type": "home", "type": 1},
            {"id": 4, "name": "Trạm thu gom Bến Bạch Đằng", "address": "Công viên Bến Bạch Đằng", "lat": 10.7720, "lon": 106.7065, "fill_level": 90, "demand": 45, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Trạm thu gom Chợ Bến Thành", "address": "Chợ Bến Thành", "lat": 10.7725, "lon": 106.6980, "fill_level": 95, "demand": 48, "collection_type": "centralized", "type": 2},
            {"id": 6, "name": "Hộ dân hẻm sâu Bùi Viện", "address": "Phố Tây Bùi Viện", "lat": 10.7675, "lon": 106.6935, "fill_level": 100, "demand": 50, "collection_type": "home", "type": 1},
            {"id": 7, "name": "Dinh Độc Lập", "address": "Nam Kỳ Khởi Nghĩa", "lat": 10.7770, "lon": 106.6955, "fill_level": 70, "demand": 35, "collection_type": "home", "type": 1},
            {"id": 8, "name": "Trạm thu gom Hồ Con Rùa", "address": "Hồ Con Rùa", "lat": 10.7825, "lon": 106.6965, "fill_level": 100, "demand": 50, "collection_type": "centralized", "type": 2},
            {"id": 9, "name": "Quán cà phê Nhà thờ Đức Bà", "address": "Công xã Paris", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 10, "name": "Bưu điện Thành phố", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7001, "fill_level": 90, "demand": 45, "collection_type": "flexible", "type": 3},
            {"id": 11, "name": "Đường sách Nguyễn Văn Bình", "address": "Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "fill_level": 65, "demand": 32, "collection_type": "flexible", "type": 3},
            {"id": 12, "name": "Trạm thu gom Bến Nhà Rồng", "address": "Bến Nhà Rồng", "lat": 10.7682, "lon": 106.7068, "fill_level": 80, "demand": 40, "collection_type": "centralized", "type": 2},
            {"id": 13, "name": "Hộ dân ngõ Đề Thám", "address": "Hẻm Đề Thám", "lat": 10.7665, "lon": 106.6925, "fill_level": 95, "demand": 48, "collection_type": "home", "type": 1},
            {"id": 14, "name": "Quán ăn Hàm Nghi", "address": "Hàm Nghi", "lat": 10.7720, "lon": 106.7020, "fill_level": 85, "demand": 42, "collection_type": "flexible", "type": 3},
            {"id": 15, "name": "Hộ dân Trương Định", "address": "Trương Định", "lat": 10.7745, "lon": 106.6940, "fill_level": 75, "demand": 38, "collection_type": "home", "type": 1},
            {"id": 16, "name": "Điểm tham quan Cầu Mống", "address": "Cầu Mống", "lat": 10.7695, "lon": 106.7045, "fill_level": 90, "demand": 45, "collection_type": "flexible", "type": 3},
            {"id": 17, "name": "Hộ dân ngõ Mạc Đĩnh Chi", "address": "Mạc Đĩnh Chi", "lat": 10.7855, "lon": 106.6985, "fill_level": 70, "demand": 35, "collection_type": "home", "type": 1},
            {"id": 18, "name": "Quán ăn Phan Chu Trinh", "address": "Phan Chu Trinh", "lat": 10.7728, "lon": 106.6975, "fill_level": 80, "demand": 40, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1", "capacity": 300, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
            {"id": 2, "name": "Xe rác số 2", "capacity": 300, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038},
            {"id": 3, "name": "Xe rác số 3", "capacity": 300, "color": "#ec4899", "lat": 10.7750, "lon": 106.7040}
        ]
    }
]


@app.get("/api/waste/preset")
def get_waste_preset(id: Optional[int] = None, random_pick: bool = False):
    """Return a demo dataset. If random_pick is True, pick randomly."""
    if id is not None and 1 <= id <= len(WASTE_PRESETS):
        return WASTE_PRESETS[id - 1]
    if random_pick:
        return random.choice(WASTE_PRESETS)
    return WASTE_PRESETS[0]


@app.get("/api/waste/presets")
def get_waste_presets():
    """Return list of all available presets with metadata."""
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "theme_color": p["theme_color"],
            "theme_gradient": p["theme_gradient"],
            "bins_count": len(p["bins"]),
            "vehicles_count": len(p["vehicles"]),
                    }
        for p in WASTE_PRESETS
    ]


@app.get("/api/waste/route-geometry")
def get_route_geometry(coords: str):
    """
    Get turn-by-turn road geometry for coordinates string (lon1,lat1;lon2,lat2;...).
    Checks local persistent cache first, then high-speed mirrors with retries.
    """
    if not coords:
        raise HTTPException(status_code=400, detail="coords parameter is required")

    # 1. Fast cache lookup
    if coords in ROUTE_CACHE:
        return JSONResponse(content=ROUTE_CACHE[coords])

    # 2. Try fast mirrors
    mirrors = [
        f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{coords}?overview=full&geometries=geojson",
        f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson"
    ]
    for url in mirrors:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "WasteVRP-Optimizer/2.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("code") == "Ok" and data.get("routes"):
                    ROUTE_CACHE[coords] = data
                    try:
                        with open(CACHE_FILE, "w", encoding="utf-8") as f:
                            json.dump(ROUTE_CACHE, f, ensure_ascii=False)
                    except Exception:
                        pass
                    return JSONResponse(content=data)
        except Exception:
            continue

    return JSONResponse(content={"code": "Fallback", "routes": []})


@app.post("/api/waste/solve")
async def solve_waste(request: Request):
    """Calculate optimal collection routes using VRP optimization."""
    body = await request.json()
    depot = body.get("depot")
    bins = body.get("bins", [])
    vehicles = body.get("vehicles", [])
    num_vehicles = len(vehicles) if vehicles else 2
    capacity = vehicles[0].get("capacity", 300) if vehicles else 300

    if not depot or not bins:
        raise HTTPException(status_code=400, detail="Depot and bins are required")

    result = solve_waste_vrp(
        depot=depot,
        bins=bins,
        num_vehicles=num_vehicles,
        vehicle_capacity=capacity,
        vehicles=vehicles
    )
    return JSONResponse(content=result)


@app.post("/api/waste/solve-ortools")
async def solve_waste_ortools(request: Request):
    """Calculate collection routes using Google OR-Tools Routing Solver."""
    body = await request.json()
    depot = body.get("depot")
    bins = body.get("bins", [])
    vehicles = body.get("vehicles", [])
    num_vehicles = len(vehicles) if vehicles else 2
    capacity = vehicles[0].get("capacity", 300) if vehicles else 300

    if not depot or not bins:
        raise HTTPException(status_code=400, detail="Depot and bins are required")

    result = solve_ortools_vrp(
        depot=depot,
        bins=bins,
        num_vehicles=num_vehicles,
        vehicle_capacity=capacity,
        vehicles=vehicles
    )
    return JSONResponse(content=result)


@app.post("/api/waste/solve-baseline")
async def solve_waste_baseline(request: Request):
    """Simulate traditional fixed-schedule waste collection (URENCO Baseline)."""
    body = await request.json()
    depot = body.get("depot")
    bins = body.get("bins", [])
    vehicles = body.get("vehicles", [])
    num_vehicles = len(vehicles) if vehicles else 2
    capacity = vehicles[0].get("capacity", 300) if vehicles else 300

    if not depot or not bins:
        raise HTTPException(status_code=400, detail="Depot and bins are required")

    result = solve_baseline_vrp(
        depot=depot,
        bins=bins,
        num_vehicles=num_vehicles,
        vehicle_capacity=capacity,
        vehicles=vehicles
    )
    return JSONResponse(content=result)


@app.post("/api/waste/compare")
async def compare_all(request: Request):
    """Run Head-to-Head Comparison: 3D-PACO vs Google OR-Tools vs Traditional Baseline."""
    body = await request.json()
    depot = body.get("depot")
    bins = body.get("bins", [])
    vehicles = body.get("vehicles", [])
    num_vehicles = len(vehicles) if vehicles else 2
    capacity = vehicles[0].get("capacity", 300) if vehicles else 300

    if not depot or not bins:
        raise HTTPException(status_code=400, detail="Depot and bins are required")

    result = compare_solvers(
        depot=depot,
        bins=bins,
        num_vehicles=num_vehicles,
        vehicle_capacity=capacity,
        vehicles=vehicles
    )
    return JSONResponse(content=result)


@app.post("/api/waste/resolve-incident")
async def handle_incident(request: Request):
    """Dynamic Incident Resolution Endpoint (Human-in-the-Loop)."""
    body = await request.json()
    incident = body.get("incident", {})
    current_truck = body.get("truck_state", {})
    all_trucks = body.get("all_trucks", [])

    result = resolve_incident(
        incident=incident,
        current_truck_state=current_truck,
        all_trucks=all_trucks
    )
    return JSONResponse(content=result)


@app.get("/", response_class=HTMLResponse)
def index():
    html_path = MAP_UI_DIR / "index.html"
    with open(html_path, "r", encoding="utf-8") as f:
        return f.read()


@app.get("/driver-data", response_class=HTMLResponse)
def driver_data_page():
    """Driver Route Telemetry & Machine Learning Portal."""
    html_path = MAP_UI_DIR / "driver_data.html"
    with open(html_path, "r", encoding="utf-8") as f:
        return f.read()


@app.get("/engine", response_class=HTMLResponse)
def engine_page():
    """3D-PACO Engine Comparison Visualizer."""
    html_path = MAP_UI_DIR / "engine.html"
    with open(html_path, "r", encoding="utf-8") as f:
        return f.read()


@app.get("/api/driver-telemetry")
def get_driver_telemetry(limit: int = 150):
    """Fetch real-world driver trajectory logs, nodes, and ML status."""
    all_rec = TELEMETRY_MGR.get_all_records()
    summary = TELEMETRY_MGR.get_summary()
    return JSONResponse(content={
        "summary": summary,
        "drivers": DRIVERS_FLEET,
        "nodes": CORNER_NODES,
        "records": all_rec[-limit:] if len(all_rec) > limit else all_rec,
        "ml_metrics": GLOBAL_ML_ENGINE.metrics,
        "feature_importances": GLOBAL_ML_ENGINE.feature_importances
    })


@app.post("/api/driver-telemetry/record")
async def record_telemetry_ping(request: Request):
    """Receive or simulate a live GPS node transition ping."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    auto_sim = body.get("auto_simulate", True)
    if auto_sim or not body.get("to_node_id"):
        rec = TELEMETRY_MGR.add_single_record(None)
    else:
        rec = TELEMETRY_MGR.add_single_record(body)
    return JSONResponse(content={"status": "ok", "record": rec, "summary": TELEMETRY_MGR.get_summary()})


@app.post("/api/driver-telemetry/simulate-batch")
async def simulate_batch_telemetry(request: Request):
    """Simulate batch of realistic driver shifts across corner nodes."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    count = body.get("count", 25)
    total = TELEMETRY_MGR.simulate_batch(count=count)
    return JSONResponse(content={"status": "ok", "total_records": total, "summary": TELEMETRY_MGR.get_summary()})


@app.post("/api/driver-telemetry/clear")
def clear_driver_telemetry():
    """Clear telemetry logs and reset to seeded baseline."""
    TELEMETRY_MGR.clear()
    return JSONResponse(content={"status": "ok", "summary": TELEMETRY_MGR.get_summary()})


@app.get("/api/driver-telemetry/nodes")
def get_driver_nodes():
    """Get all 22 Corner / Intersection nodes with metadata."""
    return JSONResponse(content={"nodes": CORNER_NODES})


@app.get("/api/driver-telemetry/rag-spec")
def get_rag_spec(extra_seed: int = 0):
    """Return RAG hierarchical graph network spec and preset interactive JSON trips."""
    graph = generate_dense_rag_network(extra_seed_count=extra_seed) if extra_seed > 0 else RAG_GRAPH_SPEC
    return JSONResponse(content={
        "graph": graph,
        "trips": RAG_PRESET_TRIPS,
        "ml_metrics": GLOBAL_ML_ENGINE.metrics
    })


@app.get("/api/driver-telemetry/export-csv")
def export_telemetry_csv():
    """Export telemetry records as CSV attachment."""
    records = TELEMETRY_MGR.get_all_records()
    import csv
    import io
    output = io.StringIO()
    if records:
        fieldnames = list(records[0].keys())
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=driver_telemetry_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )


@app.post("/api/ml/predict-hourly")
async def predict_hourly(request: Request):
    """Predict travel times, turn delays, and bin fills for any hour of day."""
    body = await request.json()
    hour = float(body.get("hour", 12.0))
    preset_bins = body.get("bins")
    if not preset_bins:
        preset_bins = WASTE_PRESETS[0]["bins"]
    result = GLOBAL_ML_ENGINE.predict_hourly_network_state(hour, preset_bins)
    return JSONResponse(content=result)


@app.post("/api/ml/optimize-route")
async def optimize_ml_route(request: Request):
    """Generate ML-Adaptive Route tailored to the chosen hour and compare with naive baseline."""
    body = await request.json()
    hour = float(body.get("hour", 12.0))
    preset = WASTE_PRESETS[0]
    depot = body.get("depot", preset["depot"])
    bins = body.get("bins", preset["bins"])
    vehicles = body.get("vehicles", preset["vehicles"])
    result = GLOBAL_ML_ENGINE.generate_ml_adaptive_route(hour, depot, bins, vehicles)
    return JSONResponse(content=result)


@app.post("/api/ml/retrain")
def retrain_ml():
    """Retrain the ML model on collected telemetry records."""
    records = TELEMETRY_MGR.get_all_records()
    GLOBAL_ML_ENGINE.train(records)
    return JSONResponse(content={
        "status": "ok",
        "metrics": GLOBAL_ML_ENGINE.metrics,
        "feature_importances": GLOBAL_ML_ENGINE.feature_importances
    })



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8502)
