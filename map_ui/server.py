"""
Dedicated Waste Collection Map Server on port 8502.
Uses FastAPI + Uvicorn to serve the MapLibre GL UI and Dynamic Waste Routing APIs.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import Dict, Any, List, Optional
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
        "name": "Q.1 Trung Tâm & Phố Đi Bộ",
        "theme_color": "#10b981",
        "theme_gradient": "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Bến Nghé", "lat": 10.7745, "lon": 106.7042, "address": "Bến Bạch Đằng, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Hộ dân ngõ 42 Nguyễn Huệ (Hẻm sâu)", "address": "Hẻm 42 Nguyễn Huệ", "lat": 10.7735, "lon": 106.7032, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 2, "name": "Cửa hàng quà lưu niệm Bạch Đằng", "address": "Ven Công viên Bến Bạch Đằng", "lat": 10.7726, "lon": 106.7060, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Khu tập thể Đồng Khởi (Hẻm hẹp)", "address": "Đồng Khởi, sau Nhà hát TP", "lat": 10.7768, "lon": 106.7035, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 4, "name": "Trạm thu tập trung Bến Bạch Đằng", "address": "Công viên Bến Bạch Đằng", "lat": 10.7720, "lon": 106.7065, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Bô rác Chợ Bến Thành (Lê Lợi)", "address": "Cửa Đông Chợ Bến Thành", "lat": 10.7725, "lon": 106.6980, "fill_level": 95, "demand": 48, "has_smell": False, "collection_type": "centralized", "type": 2},
            {"id": 6, "name": "Hộ dân hẻm 20 Bùi Viện (Hẻm nhỏ)", "address": "Phố đi bộ Bùi Viện", "lat": 10.7675, "lon": 106.6935, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 7, "name": "Quán ăn Phan Chu Trinh (Gần chợ)", "address": "Phan Chu Trinh giao Lê Lợi", "lat": 10.7728, "lon": 106.6975, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 8, "name": "Hồ Con Rùa (Cà phê vỉa hè)", "address": "Vòng xoay Công trường Quốc Tế", "lat": 10.7825, "lon": 106.6965, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 9, "name": "Nhà thờ Đức Bà", "address": "Công xã Paris", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 10, "name": "Bưu điện Thành phố", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7001, "fill_level": 90, "demand": 45, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 11, "name": "Đường sách Nguyễn Văn Bình", "address": "Đường sách Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "fill_level": 65, "demand": 32, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 12, "name": "Trạm thu tập trung Bến Nhà Rồng", "address": "Bến Nhà Rồng ven sông", "lat": 10.7682, "lon": 106.7068, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "centralized", "type": 2}
        ],
        "incidents": [
            {"id": 1, "type": "road_blocked", "name": "🚧 Đoạn đường Lê Lợi bị chặn thi công", "description": "Lê Lợi giao Pasteur đang rào chắn sửa chữa", "lat": 10.77397, "lon": 106.70061, "can_ai_resolve": True},
            {"id": 2, "type": "truck_breakdown", "name": "🛑 Xe rác gặp sự cố hỏng hóc động cơ", "description": "Ngã tư Pasteur - Lê Duẩn (gần Dinh Độc Lập)", "lat": 10.7785, "lon": 106.6975, "can_ai_resolve": False}
        ],
        "vehicles": [
            {"id": 1, "name": "Xe rác số 1", "capacity": 300, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
            {"id": 2, "name": "Xe rác số 2", "capacity": 300, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038}
        ]
    },
    {
        "id": 2,
        "name": "Khu Ẩm Thực Chợ Bến Thành - Bùi Viện",
        "theme_color": "#8b5cf6",
        "theme_gradient": "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)",
        "depot": {"id": 0, "name": "Trạm tập kết Công viên 23/9", "lat": 10.7690, "lon": 106.6945, "address": "Công viên 23/9, Q.1, TP.HCM"},
        "bins": [
            {"id": 1, "name": "Bô rác Chợ Bến Thành cửa Nam", "address": "Chợ Bến Thành cửa Nam", "lat": 10.7720, "lon": 106.6982, "fill_level": 95, "demand": 48, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Hộ kinh doanh Phan Chu Trinh", "address": "Phan Chu Trinh", "lat": 10.7724, "lon": 106.6978, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Cửa hàng Chợ Bến Thành cửa Bắc", "address": "Chợ Bến Thành cửa Bắc", "lat": 10.7735, "lon": 106.6985, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 4, "name": "Hộ dân hẻm 175 Bùi Viện", "address": "Hẻm 175 Bùi Viện", "lat": 10.7672, "lon": 106.6938, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 5, "name": "Trạm thu gom tập trung Đề Thám", "address": "Khu ẩm thực đêm Đề Thám", "lat": 10.7665, "lon": 106.6925, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 6, "name": "Quán bia Phạm Ngũ Lão", "address": "Phạm Ngũ Lão", "lat": 10.7670, "lon": 106.6928, "fill_level": 60, "demand": 30, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 7, "name": "Hộ dân ngõ Cống Quỳnh (Hẻm cụt)", "address": "Hẻm Cống Quỳnh", "lat": 10.7660, "lon": 106.6895, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 8, "name": "Cửa hàng Nguyễn Thái Học", "address": "Nguyễn Thái Học", "lat": 10.7650, "lon": 106.6960, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 9, "name": "Trạm thu gom Trần Hưng Đạo", "address": "Trần Hưng Đạo", "lat": 10.7678, "lon": 106.6968, "fill_level": 65, "demand": 32, "has_smell": False, "collection_type": "centralized", "type": 2},
            {"id": 10, "name": "Hộ dân Tôn Thất Tùng", "address": "Tôn Thất Tùng", "lat": 10.7705, "lon": 106.6890, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 11, "name": "Hộ dân hẻm Trương Định", "address": "Trương Định", "lat": 10.7745, "lon": 106.6940, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 12, "name": "Hộ dân Nguyễn Du", "address": "Nguyễn Du", "lat": 10.7760, "lon": 106.6965, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 13, "name": "Nhà hàng Lý Tự Trọng", "address": "Lý Tự Trọng", "lat": 10.7740, "lon": 106.6995, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 14, "name": "Hộ dân Nguyễn Thị Nghĩa", "address": "Nguyễn Thị Nghĩa", "lat": 10.7700, "lon": 106.6925, "fill_level": 60, "demand": 30, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 15, "name": "Trạm gom Công viên 23/9 (Lê Lai)", "address": "Lê Lai mặt công viên", "lat": 10.7712, "lon": 106.6945, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "centralized", "type": 2}
        ],
        "incidents": [
            {"id": 1, "type": "road_blocked", "name": "🚧 Đề Thám rào chắn sửa cống ngầm", "description": "Rào chắn ngã tư Đề Thám - Bùi Viện", "lat": 10.7668, "lon": 106.6930, "can_ai_resolve": True}
        ],
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
            {"id": 1, "name": "Trạm thu gom Cổng Thảo Cầm Viên", "address": "Cổng Thảo Cầm Viên", "lat": 10.7875, "lon": 106.7052, "fill_level": 90, "demand": 45, "has_smell": False, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Bảo tàng Lịch sử TP.HCM", "address": "Nguyễn Bỉnh Khiêm", "lat": 10.7869, "lon": 106.7046, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Đài truyền hình HTV", "address": "Nguyễn Thị Minh Khai", "lat": 10.7850, "lon": 106.7015, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 4, "name": "Trạm thu gom Hồ Con Rùa", "address": "Công trường Quốc Tế", "lat": 10.7825, "lon": 106.6965, "fill_level": 95, "demand": 48, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Quán cà phê Nhà thờ Đức Bà", "address": "Công xã Paris", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 6, "name": "Bưu điện Thành phố", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7001, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 7, "name": "Đường sách Nguyễn Văn Bình", "address": "Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "fill_level": 60, "demand": 30, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 8, "name": "Dinh Độc Lập cổng chính", "address": "Nam Kỳ Khởi Nghĩa", "lat": 10.7770, "lon": 106.6955, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 9, "name": "Hộ dân ngõ Huyền Trân Công Chúa", "address": "Cổng sau Dinh Độc Lập", "lat": 10.7755, "lon": 106.6935, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 10, "name": "Trạm thu tập trung Công viên 30/4", "address": "Công viên 30/4", "lat": 10.7788, "lon": 106.6980, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 11, "name": "Hộ dân Lê Duẩn - Hai Bà Trưng", "address": "Lê Duẩn giao Hai Bà Trưng", "lat": 10.7818, "lon": 106.7002, "fill_level": 65, "demand": 32, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 12, "name": "Hộ dân hẻm Mạc Đĩnh Chi", "address": "Hẻm Mạc Đĩnh Chi", "lat": 10.7855, "lon": 106.6985, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 13, "name": "Hộ dân Nguyễn Đình Chiểu", "address": "Nguyễn Đình Chiểu", "lat": 10.7840, "lon": 106.6945, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [
            {"id": 1, "type": "road_blocked", "name": "🚧 Lê Duẩn phân luồng sự kiện", "description": "Rào chắn khúc giao Công Xã Paris", "lat": 10.7808, "lon": 106.6992, "can_ai_resolve": True}
        ],
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
            {"id": 1, "name": "Trạm thu gom Bến Nhà Rồng", "address": "Bến Nhà Rồng", "lat": 10.7682, "lon": 106.7068, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "centralized", "type": 2},
            {"id": 2, "name": "Hộ dân ven Cầu Mống", "address": "Chân Cầu Mống", "lat": 10.7688, "lon": 106.7058, "fill_level": 95, "demand": 48, "has_smell": True, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Hộ dân mặt tiền Võ Văn Kiệt", "address": "Võ Văn Kiệt", "lat": 10.7705, "lon": 106.7035, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 4, "name": "Trạm thu Bến Bạch Đằng Waterbus", "address": "Bến Bạch Đằng Waterbus", "lat": 10.7735, "lon": 106.7058, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Quán nước Tôn Đức Thắng", "address": "Tôn Đức Thắng giao Hàm Nghi", "lat": 10.7728, "lon": 106.7052, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 6, "name": "Bô rác Hàm Nghi chợ cũ", "address": "Hàm Nghi chợ cũ", "lat": 10.7720, "lon": 106.7020, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 7, "name": "Tòa nhà Bitexco (Thu gom riêng)", "address": "Hải Triều, Bitexco", "lat": 10.7715, "lon": 106.7040, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 8, "name": "Hộ dân hẻm Pasteur ven bờ kênh", "address": "Hẻm Pasteur", "lat": 10.7690, "lon": 106.7025, "fill_level": 65, "demand": 32, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 9, "name": "Hộ dân Phó Đức Chính", "address": "Phó Đức Chính", "lat": 10.7695, "lon": 106.7005, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 10, "name": "Hộ dân hẻm Calmette", "address": "Hẻm Calmette", "lat": 10.7680, "lon": 106.6995, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 11, "name": "Trạm thu gom Cầu Ông Lãnh", "address": "Chân Cầu Ông Lãnh", "lat": 10.7655, "lon": 106.6975, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 12, "name": "Hộ dân Bến Vân Đồn ven sông", "address": "Bến Vân Đồn", "lat": 10.7665, "lon": 106.7005, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 13, "name": "Hộ dân Nguyễn Thái Bình", "address": "Nguyễn Thái Bình", "lat": 10.7700, "lon": 106.6990, "fill_level": 60, "demand": 30, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 14, "name": "Hộ dân Nam Kỳ Khởi Nghĩa ven kênh", "address": "Nam Kỳ Khởi Nghĩa", "lat": 10.7710, "lon": 106.7015, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [
            {"id": 1, "type": "road_blocked", "name": "🚧 Thi công bờ kè Bến Bạch Đằng", "description": "Làn xe sát bờ sông tạm dừng", "lat": 10.7730, "lon": 106.7055, "can_ai_resolve": True}
        ],
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
            {"id": 1, "name": "Hộ dân ngõ 42 Nguyễn Huệ", "address": "Hẻm 42 Nguyễn Huệ", "lat": 10.7735, "lon": 106.7032, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 2, "name": "Cửa hàng quà Bạch Đằng", "address": "Bến Bạch Đằng", "lat": 10.7726, "lon": 106.7060, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 3, "name": "Hộ dân hẻm Đồng Khởi", "address": "Đồng Khởi", "lat": 10.7768, "lon": 106.7035, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 4, "name": "Trạm thu gom Bến Bạch Đằng", "address": "Công viên Bến Bạch Đằng", "lat": 10.7720, "lon": 106.7065, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 5, "name": "Trạm thu gom Chợ Bến Thành", "address": "Chợ Bến Thành", "lat": 10.7725, "lon": 106.6980, "fill_level": 95, "demand": 48, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 6, "name": "Hộ dân hẻm sâu Bùi Viện", "address": "Phố Tây Bùi Viện", "lat": 10.7675, "lon": 106.6935, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 7, "name": "Dinh Độc Lập", "address": "Nam Kỳ Khởi Nghĩa", "lat": 10.7770, "lon": 106.6955, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 8, "name": "Trạm thu gom Hồ Con Rùa", "address": "Hồ Con Rùa", "lat": 10.7825, "lon": 106.6965, "fill_level": 100, "demand": 50, "has_smell": True, "collection_type": "centralized", "type": 2},
            {"id": 9, "name": "Quán cà phê Nhà thờ Đức Bà", "address": "Công xã Paris", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 10, "name": "Bưu điện Thành phố", "address": "Công xã Paris", "lat": 10.7802, "lon": 106.7001, "fill_level": 90, "demand": 45, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 11, "name": "Đường sách Nguyễn Văn Bình", "address": "Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "fill_level": 65, "demand": 32, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 12, "name": "Trạm thu gom Bến Nhà Rồng", "address": "Bến Nhà Rồng", "lat": 10.7682, "lon": 106.7068, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "centralized", "type": 2},
            {"id": 13, "name": "Hộ dân ngõ Đề Thám", "address": "Hẻm Đề Thám", "lat": 10.7665, "lon": 106.6925, "fill_level": 95, "demand": 48, "has_smell": True, "collection_type": "home", "type": 1},
            {"id": 14, "name": "Quán ăn Hàm Nghi", "address": "Hàm Nghi", "lat": 10.7720, "lon": 106.7020, "fill_level": 85, "demand": 42, "has_smell": False, "collection_type": "flexible", "type": 3},
            {"id": 15, "name": "Hộ dân Trương Định", "address": "Trương Định", "lat": 10.7745, "lon": 106.6940, "fill_level": 75, "demand": 38, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 16, "name": "Điểm tham quan Cầu Mống", "address": "Cầu Mống", "lat": 10.7695, "lon": 106.7045, "fill_level": 90, "demand": 45, "has_smell": True, "collection_type": "flexible", "type": 3},
            {"id": 17, "name": "Hộ dân ngõ Mạc Đĩnh Chi", "address": "Mạc Đĩnh Chi", "lat": 10.7855, "lon": 106.6985, "fill_level": 70, "demand": 35, "has_smell": False, "collection_type": "home", "type": 1},
            {"id": 18, "name": "Quán ăn Phan Chu Trinh", "address": "Phan Chu Trinh", "lat": 10.7728, "lon": 106.6975, "fill_level": 80, "demand": 40, "has_smell": False, "collection_type": "flexible", "type": 3}
        ],
        "incidents": [
            {"id": 1, "type": "road_blocked", "name": "🚧 Đường hoa Nguyễn Huệ cấm xe", "description": "Làn xe Nguyễn Huệ cấm xe để phục vụ lễ hội", "lat": 10.77397, "lon": 106.70061, "can_ai_resolve": True},
            {"id": 2, "type": "truck_breakdown", "name": "🛑 Xe rác hỏng động cơ", "description": "Ngã tư Pasteur - Lê Duẩn", "lat": 10.7785, "lon": 106.6975, "can_ai_resolve": False}
        ],
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
            "smell_count": len([b for b in p["bins"] if b.get("has_smell")])
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8502)
