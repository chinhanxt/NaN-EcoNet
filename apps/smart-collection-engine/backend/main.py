from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from service import SolverService, SolverResult

app = FastAPI(title="VRP Solver API", description="API for Vehicle Routing Problem with Parcel Lockers")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = SolverService()

class SolveRequest(BaseModel):
    instance_content: str
    solver: str = "paco"
    size: str = "small"
    params_override: Optional[Dict[str, Any]] = None

class RouteResult(BaseModel):
    objective: float
    vehicles: int
    runtime: float
    routes: List[List[str]]
    raw_routes: List[List[int]]
    delivery_nodes: List[int]
    success: bool
    error_message: str

@app.post("/solve", response_model=RouteResult)
async def solve(request: SolveRequest):
    """
    Run the VRP solver on the provided instance content.
    """
    result = service.run_solver(
        instance_content=request.instance_content,
        solver=request.solver,
        size=request.size,
        params_override=request.params_override
    )
    
    return result.to_dict()

@app.get("/health")
async def health():
    return {"status": "ok"}

# Manual Input Models
class DepotModel(BaseModel):
    x: float
    y: float
    earliest: float = 0.0
    latest: float = 1000.0

class CustomerModel(BaseModel):
    x: float
    y: float
    demand: int
    earliest: float = 0.0
    latest: float = 1000.0
    service_time: float = 10.0
    type: int

class LockerModel(BaseModel):
    x: float
    y: float
    earliest: float = 0.0
    latest: float = 1000.0
    service_time: float = 0.0

class ManualSolveRequest(BaseModel):
    num_vehicles: int
    vehicle_capacity: int
    depot: DepotModel
    customers: List[CustomerModel]
    lockers: List[LockerModel]
    solver: str = "paco"
    size: str = "small"
    params_override: Optional[Dict[str, Any]] = None

from utils import generate_instance_content

@app.post("/solve/manual", response_model=RouteResult)
async def solve_manual(request: ManualSolveRequest):
    """
    Run the VRP solver on manually provided instance data.
    """
    # Convert models to dicts for the generator
    depot_dict = request.depot.dict()
    customers_list = [c.dict() for c in request.customers]
    lockers_list = [l.dict() for l in request.lockers]
    
    # Generate content
    content = generate_instance_content(
        num_vehicles=request.num_vehicles,
        vehicle_capacity=request.vehicle_capacity,
        depot=depot_dict,
        customers=customers_list,
        lockers=lockers_list
    )
    
    # Run solver
    result = service.run_solver(
        instance_content=content,
        solver=request.solver,
        size=request.size,
        params_override=request.params_override
    )
    
    return result.to_dict()
