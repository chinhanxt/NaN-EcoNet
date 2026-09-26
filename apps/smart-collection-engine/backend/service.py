"""
Solver Service Module

Manages the execution of the C++ VRP solver binary.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class SolverResult:
    """Result from running the VRP solver."""

    objective: float
    vehicles: int
    runtime: float
    routes: list[list[str]] = field(default_factory=list)
    raw_routes: list[list[int]] = field(default_factory=list)
    delivery_nodes: list[int] = field(default_factory=list)
    success: bool = True
    error_message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


# Available solvers
AVAILABLE_SOLVERS = ["paco", "sa"]

# Size options
SIZE_OPTIONS = ["small", "medium", "large"]


class SolverService:
    @staticmethod
    def get_solver_binary_path() -> Path:
        """Get path to the solver binary."""
        candidates = [
            Path("/app/backend/bin/test"),
            Path(__file__).resolve().parent / "bin" / "test",
            Path.cwd() / "backend" / "bin" / "test",
            Path("/home/congnghip/project/routing-PL/backend/bin/test"),
        ]
        for c in candidates:
            if c.is_file():
                return c
        return candidates[1]

    @staticmethod
    def get_params_path(solver: str) -> Path:
        """Get path to solver parameter file."""
        candidates = [
            Path("/app/backend/parameters") / f"{solver}.param.yaml",
            Path(__file__).resolve().parent / "parameters" / f"{solver}.param.yaml",
            Path.cwd() / "backend" / "parameters" / f"{solver}.param.yaml",
            Path(
                f"/home/congnghip/project/routing-PL/backend/parameters/{solver}.param.yaml"
            ),
        ]
        for c in candidates:
            if c.is_file():
                return c
        return candidates[1]

    def run_solver(
        self,
        instance_content: str,
        solver: str = "paco",
        size: str = "small",
        params_override: dict | None = None,
    ) -> SolverResult:
        """
        Run the VRP solver on an instance file.
        """
        if solver not in AVAILABLE_SOLVERS:
            return SolverResult(
                objective=0,
                vehicles=0,
                runtime=0,
                success=False,
                error_message=f"Unknown solver: {solver}. Available: {AVAILABLE_SOLVERS}",
            )

        if size not in SIZE_OPTIONS:
            return SolverResult(
                objective=0,
                vehicles=0,
                runtime=0,
                success=False,
                error_message=f"Unknown size: {size}. Available: {SIZE_OPTIONS}",
            )

        solver_path = self.get_solver_binary_path()

        if not solver_path.exists():
            return SolverResult(
                objective=0,
                vehicles=0,
                runtime=0,
                success=False,
                error_message=f"Solver binary not found at: {solver_path}",
            )

        # Handle parameters (default or override)
        temp_params_path = None
        params_path = None

        try:
            if params_override:
                # Create temp file for overridden parameters
                import yaml

                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=".yaml", delete=False
                ) as f:
                    yaml.dump(params_override, f)
                    params_path = Path(f.name)
                    temp_params_path = params_path
            else:
                params_path = self.get_params_path(solver)
                if not params_path.exists():
                    return SolverResult(
                        objective=0,
                        vehicles=0,
                        runtime=0,
                        success=False,
                        error_message=f"Parameter file not found at: {params_path}",
                    )

            # Write instance to temp file
            instance_path = None
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False
            ) as f:
                f.write(instance_content)
                instance_path = Path(f.name)

            try:
                # Build command
                cmd = [
                    str(solver_path),
                    "--solver",
                    solver,
                    "--params",
                    str(params_path),
                    "--instance-file",
                    str(instance_path),
                    "--size",
                    size,
                    "--full-solution",
                ]
                print("[INFO]: Running command:", cmd)
                # Run solver
                env = os.environ.copy()
                env["LD_LIBRARY_PATH"] = (
                    f"{solver_path.parent}:{env.get('LD_LIBRARY_PATH', '')}"
                )
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5 minute timeout
                    env=env,
                    check=False,
                )

                if result.returncode != 0:
                    return SolverResult(
                        objective=0,
                        vehicles=0,
                        runtime=0,
                        success=False,
                        error_message=f"Solver exited with code {result.returncode}: {result.stderr}",
                    )

                # Parse JSON output
                stdout = result.stdout
                json_start = stdout.find("{")
                if json_start == -1:
                    return SolverResult(
                        objective=0,
                        vehicles=0,
                        runtime=0,
                        success=False,
                        error_message=f"No JSON output found in solver output: {stdout[:500]}",
                    )

                json_str = stdout[json_start:]

                try:
                    data = json.loads(json_str)
                except json.JSONDecodeError as e:
                    return SolverResult(
                        objective=0,
                        vehicles=0,
                        runtime=0,
                        success=False,
                        error_message=f"Failed to parse JSON: {e}. Output: {json_str[:500]}",
                    )

                return SolverResult(
                    objective=data.get("objective", 0),
                    vehicles=data.get("vehicles", 0),
                    runtime=data.get("runtime", 0),
                    routes=data.get("routes", []),
                    raw_routes=data.get("raw_routes", []),
                    delivery_nodes=data.get("delivery_nodes", []),
                    success=True,
                )

            except subprocess.TimeoutExpired:
                return SolverResult(
                    objective=0,
                    vehicles=0,
                    runtime=0,
                    success=False,
                    error_message="Solver timed out after 5 minutes",
                )
            except Exception as e:  # noqa: BLE001
                return SolverResult(
                    objective=0,
                    vehicles=0,
                    runtime=0,
                    success=False,
                    error_message=f"Error running solver: {e}",
                )
            finally:
                # Clean up instance file
                if instance_path:
                    try:
                        instance_path.unlink()
                    except OSError:
                        pass
        finally:
            # Clean up temp params file if created
            if temp_params_path:
                try:
                    temp_params_path.unlink()
                except OSError:
                    pass
