
import sys
import unittest
from unittest.mock import MagicMock, patch
import asyncio

# Ensure we can import from backend
sys.path.append(".")

from main import solve_manual, ManualSolveRequest, DepotModel, CustomerModel, LockerModel
from service import SolverResult

class TestManualSolve(unittest.TestCase):
    @patch('main.service')
    def test_solve_manual_conversion(self, mock_service):
        # Setup mock return
        mock_service.run_solver.return_value = SolverResult(
            objective=100.0, vehicles=2, runtime=1.0, success=True
        )

        # Create input
        input_data = ManualSolveRequest(
            num_vehicles=5,
            vehicle_capacity=100,
            depot=DepotModel(x=50, y=50),
            customers=[
                CustomerModel(x=20, y=20, demand=10, type=1),
                CustomerModel(x=80, y=80, demand=15, type=2)
            ],
            lockers=[
                LockerModel(x=30, y=30)
            ],
            solver="paco",
            size="small"
        )

        # Run async function
        result = asyncio.run(solve_manual(input_data))

        # Check result
        self.assertEqual(result['objective'], 100.0)
        
        # Check conversion logic
        mock_service.run_solver.assert_called_once()
        call_args = mock_service.run_solver.call_args
        instance_content = call_args.kwargs['instance_content']
        
        # Verify content structure
        lines = instance_content.strip().split('\n')
        
        # Header: 2 customers, 1 locker
        self.assertEqual(lines[0], "2 1")
        # Vehicles: 5, 100
        self.assertEqual(lines[1], "5 100")
        # Demands: 10, 15
        self.assertEqual(lines[2], "10")
        self.assertEqual(lines[3], "15")
        # Depot: 50.0 50.0 0.0 1000.0 0 0
        self.assertEqual(lines[4], "50.0 50.0 0.0 1000.0 0 0")
        # Customer 1: 20.0 20.0 0.0 1000.0 10.0 1
        self.assertEqual(lines[5], "20.0 20.0 0.0 1000.0 10.0 1")
        # Customer 2: 80.0 80.0 0.0 1000.0 10.0 2
        self.assertEqual(lines[6], "80.0 80.0 0.0 1000.0 10.0 2")
        # Locker 1: 30.0 30.0 0.0 1000.0 0.0 4
        self.assertEqual(lines[7], "30.0 30.0 0.0 1000.0 0.0 4")
        # Matrix: 1 1 (1 locker, 1 available for each customer)
        self.assertEqual(lines[8], "1") # Customer 1
        self.assertEqual(lines[9], "1") # Customer 2

        print("Verification passed!")

if __name__ == "__main__":
    unittest.main()
