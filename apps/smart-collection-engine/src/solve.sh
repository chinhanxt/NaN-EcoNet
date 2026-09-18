SOLVER="aco"
PARAM_FILE="src/parameters/${SOLVER}.param.yaml"
TEST_EXEC="src/build/main"
N_RUNS=1 # A reasonable number for BO

echo "--- Solving small instances (data/25) ---"
# $TEST_EXEC --solver $SOLVER --params $PARAM_FILE --instances src/data/25 --num-runs $N_RUNS --size small --output src/output/solutions/small_$SOLVER.csv
$TEST_EXEC --solver $SOLVER --params $PARAM_FILE --instance-file src/data/25/C101_co_25.txt --num-runs $N_RUNS --size small

# echo "--- Solving medium instances (data/50) ---"
# $TEST_EXEC --solver $SOLVER --params $PARAM_FILE --instances data/50 --num-runs $N_RUNS --size medium --output output/solutions/medium_$SOLVER.csv

# echo "--- Solving large instances (data/100) ---"
# $TEST_EXEC --solver $SOLVER --params $PARAM_FILE --instances data/100 --num-runs $N_RUNS --size large --output output/solutions/large_$SOLVER.csv