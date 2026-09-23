"""
Dedicated Waste Collection Map Server on port 8502.
Uses FastAPI + Uvicorn to serve the MapLibre GL UI and AI Waste Routing APIs.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import Dict, Any, List

from waste_solver import (
    solve_waste_vrp,
    solve_ortools_vrp,
    solve_baseline_vrp,
    compare_solvers,
    resolve_incident,
)

app = FastAPI(title="Smart Waste Collection & Incident AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAP_UI_DIR = Path(__file__).parent


@app.get("/api/waste/preset")
def get_waste_preset():
    """Return realistic demo dataset for Waste Collection in Ho Chi Minh City center."""
    depot = {
        "id": 0,
        "name": "Trạm tập kết rác Bến Nghé (Depot)",
        "lat": 10.7745,
        "lon": 106.7042,
        "address": "Bến Bạch Đằng, Q.1, TP.HCM"
    }

    bins = [
        {"id": 1, "name": "Thùng #1", "address": "Phố đi bộ Nguyễn Huệ", "lat": 10.7735, "lon": 106.7032, "fill_level": 90, "demand": 45, "has_smell": True},
        {"id": 2, "name": "Thùng #2", "address": "Lê Thánh Tôn (Rex Hotel)", "lat": 10.7760, "lon": 106.7018, "fill_level": 80, "demand": 40, "has_smell": False},
        {"id": 3, "name": "Thùng #3", "address": "Nhà hát Thành phố (Đồng Khởi)", "lat": 10.7768, "lon": 106.7035, "fill_level": 100, "demand": 50, "has_smell": True},
        {"id": 4, "name": "Thùng #4", "address": "Công viên Bến Bạch Đằng", "lat": 10.7720, "lon": 106.7065, "fill_level": 85, "demand": 42, "has_smell": False},
        {"id": 5, "name": "Thùng #5", "address": "Chợ Bến Thành (Lê Lợi)", "lat": 10.7725, "lon": 106.6980, "fill_level": 95, "demand": 48, "has_smell": False},
        {"id": 6, "name": "Thùng #6", "address": "Phố đi bộ Bùi Viện", "lat": 10.7675, "lon": 106.6935, "fill_level": 100, "demand": 50, "has_smell": True},
        {"id": 7, "name": "Thùng #7", "address": "Dinh Độc Lập (Nam Kỳ Khởi Nghĩa)", "lat": 10.7770, "lon": 106.6955, "fill_level": 70, "demand": 35, "has_smell": False},
        {"id": 8, "name": "Thùng #8", "address": "Hồ Con Rùa", "lat": 10.7825, "lon": 106.6965, "fill_level": 75, "demand": 38, "has_smell": False},
        {"id": 9, "name": "Thùng #9", "address": "Nhà thờ Đức Bà", "lat": 10.7798, "lon": 106.6990, "fill_level": 85, "demand": 42, "has_smell": False},
        {"id": 10, "name": "Thùng #10", "address": "Bưu điện Thành phố", "lat": 10.7802, "lon": 106.7001, "fill_level": 90, "demand": 45, "has_smell": False},
        {"id": 11, "name": "Thùng #11", "address": "Đường sách Nguyễn Văn Bình", "lat": 10.7805, "lon": 106.7010, "fill_level": 65, "demand": 32, "has_smell": False},
        {"id": 12, "name": "Thùng #12", "address": "Bến Nhà Rồng", "lat": 10.7682, "lon": 106.7068, "fill_level": 80, "demand": 40, "has_smell": False}
    ]

    incidents = [
        {
            "id": 1,
            "type": "road_blocked",
            "name": "🚧 Đoạn đường Lê Lợi bị chặn thi công",
            "description": "Lê Lợi giao Pasteur đang rào chắn sửa chữa",
            "lat": 10.77397,
            "lon": 106.70061,
            "can_ai_resolve": True
        },
        {
            "id": 2,
            "type": "truck_breakdown",
            "name": "🛑 Xe rác gặp sự cố hỏng hóc động cơ",
            "description": "Ngã tư Pasteur - Lê Duẩn (gần Dinh Độc Lập)",
            "lat": 10.7785,
            "lon": 106.6975,
            "can_ai_resolve": False
        }
    ]

    vehicles = [
        {"id": 1, "name": "Xe rác số 1", "capacity": 300, "color": "#10b981", "lat": 10.7748, "lon": 106.7046},
        {"id": 2, "name": "Xe rác số 2", "capacity": 300, "color": "#3b82f6", "lat": 10.7742, "lon": 106.7038}
    ]

    return {
        "depot": depot,
        "bins": bins,
        "incidents": incidents,
        "vehicles": vehicles
    }


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
    """AI Incident Resolution Endpoint."""
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
