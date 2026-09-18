"""Common utilities for experiment analyses (sensitivity, scalability, speedup)."""
from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, Tuple, Any
import yaml


def load_parameters(param_file: str | Path) -> Dict[str, Any]:
    with open(param_file, 'r') as f:
        return yaml.safe_load(f)


def _create_temp_param_file(params: Dict[str, Any], instance_path: str | Path, size: str = "medium") -> str:
    temp_config = {
        size: {
            "data_dir": str(Path(instance_path).parent),
            "params": params,
            "num_runs": 1,
            "output_csv": "/tmp/paco_temp_output.csv",
        }
    }
    temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False)
    yaml.dump(temp_config, temp_file, default_flow_style=False)
    temp_file.close()
    return temp_file.name


def run_paco(params: Dict[str, Any], instance_path: str | Path, paco_exec: Path, size: str = "medium") -> Tuple[float | None, float | None]:
    """Run PACO binary once with given parameters.

    Returns (runtime_seconds, objective) or (None, None) if failure.
    """
    instance_path = Path(instance_path)
    temp_param_file = _create_temp_param_file(params, instance_path, size)
    try:
        cmd = [
            str(paco_exec),
            "--solver", "paco",
            "--params", temp_param_file,
            "--instances", str(instance_path.parent),
            "--instance-file", str(instance_path),  # Pass the specific instance file
            "--num-runs", "1",
            "--output", "/tmp/paco_temp_output.csv",
            "--size", size,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=20000)
        if result.returncode != 0:
            print(f"PACO failed: {result.stderr}")
            return None, None
        import re
        obj, runtime = None, None
        for line in result.stdout.splitlines():
            m = re.search(r"Obj = ([0-9.eE+-]+), Vehicles = (\d+), Time = ([0-9.eE+-]+)s", line)
            if m:
                obj = float(m.group(1))
                runtime = float(m.group(3))
                break
        if obj is not None and runtime is not None:
            return runtime, obj
        print("Could not parse PACO output:\n", result.stdout)
        return None, None
    except Exception as e:  # noqa: BLE001
        print(f"Error running PACO: {e}")
        return None, None
    finally:
        if os.path.exists(temp_param_file):
            os.unlink(temp_param_file)
        if os.path.exists("/tmp/paco_temp_output.csv"):
            os.unlink("/tmp/paco_temp_output.csv")


def get_paco_exec(current_file: str | Path) -> Path:
    """Return path to compiled PACO test executable.

    We walk up until repository root (heuristic: presence of CMakeLists.txt) then append build/test.
    Fallback to previous relative logic if not found.
    """
    current = Path(current_file).resolve()
    for parent in current.parents:
        if (parent / "CMakeLists.txt").exists():
            candidate = parent / "build" / "test"
            if candidate.exists():
                return candidate
    return Path(current_file).resolve().parent.parent.parent / "build" / "test"
