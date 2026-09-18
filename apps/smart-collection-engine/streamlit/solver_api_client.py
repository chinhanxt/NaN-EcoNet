import requests
import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any

# Initializing structure similar to the backend result for compatibility
@dataclass
class SolverResult:
    """Result from running the VRP solver."""
    objective: float
    vehicles: int
    runtime: float
    routes: List[List[str]]
    raw_routes: List[List[int]] = field(default_factory=list)
    delivery_nodes: List[int] = field(default_factory=list)
    success: bool = True
    error_message: str = ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SolverResult':
        return cls(
            objective=data.get("objective", 0.0),
            vehicles=data.get("vehicles", 0),
            runtime=data.get("runtime", 0.0),
            routes=data.get("routes", []),
            raw_routes=data.get("raw_routes", []),
            delivery_nodes=data.get("delivery_nodes", []),
            success=data.get("success", False),
            error_message=data.get("error_message", "")
        )

# Constants
AVAILABLE_SOLVERS = ["paco", "sa"]
SIZE_OPTIONS = ["small", "medium", "large"]
API_URL = "http://localhost:8000"

def get_params_path(solver: str) -> str:
    # This is a bit tricky since params are now on the backend.
    # For the frontend manual configuration, we normally read the yaml file.
    # We might need an endpoint to get the parameters if we want to perfect this.
    # FOR NOW: We will assume the frontend can still read local files if they exist, 
    # BUT we moved them to backend/parameters. 
    # The frontend is running on the same machine in this setup, so we can point to ../backend/parameters
    from pathlib import Path
    return Path(__file__).parent.parent / "backend" / "parameters" / f"{solver}.param.yaml"

def run_solver(
    instance_content: str,
    solver: str = "paco",
    size: str = "small",
    params_override: Optional[dict] = None,
) -> SolverResult:
    """
    Run the solver via the API.
    """
    try:
        payload = {
            "instance_content": instance_content,
            "solver": solver,
            "size": size,
            "params_override": params_override
        }
        
        response = requests.post(f"{API_URL}/solve", json=payload, timeout=310)
        
        if response.status_code == 200:
            return SolverResult.from_dict(response.json())
        else:
            return SolverResult(
                objective=0, vehicles=0, runtime=0, routes=[],
                success=False,
                error_message=f"API Error {response.status_code}: {response.text}"
            )
            
    except requests.exceptions.ConnectionError:
        return SolverResult(
            objective=0, vehicles=0, runtime=0, routes=[],
            success=False,
            error_message="Could not connect to backend API. Is it running?"
        )
    except Exception as e:
        return SolverResult(
            objective=0, vehicles=0, runtime=0, routes=[],
            success=False,
            error_message=f"Client Error: {e}"
        )

def solve_manual(
    manual_data: Dict[str, Any],
    solver: str = "paco",
    size: str = "small",
    params_override: Optional[dict] = None,
) -> SolverResult:
    """
    Run the solver via the manual definition API.
    """
    try:
        payload = {
            **manual_data,
            "solver": solver,
            "size": size,
            "params_override": params_override
        }
        # Ensure payload is JSON serializable (handle numpy types if any)
        class NumpyEncoder(json.JSONEncoder):
            def default(self, obj):
                if hasattr(obj, 'item'):
                    return obj.item()
                if hasattr(obj, 'tolist'):
                    return obj.tolist()
                return super().default(obj)

        print(f"Sending request to {API_URL}/solve/manual")
        json_payload = json.dumps(payload, cls=NumpyEncoder)
        print(f"Payload: {json_payload}")
        # Send as pre-encoded string to avoid any issues with requests' default serializer
        # response = requests.post(
        #     f"{API_URL}/solve/manual", 
        #     data=json_payload, 
        #     headers={"Content-Type": "application/json"},
        #     timeout=310
        # )
        
        if response.status_code == 200:
            return SolverResult.from_dict(response.json())
        else:
            return SolverResult(
                objective=0, vehicles=0, runtime=0, routes=[],
                success=False,
                error_message=f"API Error {response.status_code}: {response.text}"
            )
            
    except requests.exceptions.ConnectionError:
        return SolverResult(
            objective=0, vehicles=0, runtime=0, routes=[],
            success=False,
            error_message="Could not connect to backend API. Is it running?"
        )
    except Exception as e:
        return SolverResult(
            objective=0, vehicles=0, runtime=0, routes=[],
            success=False,
            error_message=f"Client Error: {e}"
        )
