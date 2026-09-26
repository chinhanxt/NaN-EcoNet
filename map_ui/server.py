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


from waste_presets import WASTE_PRESETS

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


@app.get("/api/driver-telemetry/comparison")
def get_route_comparison():
    """Return datasets comparing Theoretical vs Actual routes with 28 waste bins."""
    comp_file = MAP_UI_DIR / "comparison_datasets.json"
    if not comp_file.exists():
        comp_file = MAP_UI_DIR / "comparison_route_data.json"
    if comp_file.exists():
        with open(comp_file, "r", encoding="utf-8") as f:
            return JSONResponse(content=json.load(f))
    return JSONResponse(content={"error": "Data not found"}, status_code=404)


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
