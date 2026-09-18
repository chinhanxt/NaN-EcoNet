#!/bin/bash

# Script to run Bayesian optimization for HFA solver for different data sizes.

SOLVER="paco"
TUNE_FILE="parameters/${SOLVER}.tune.yaml"
PARAM_FILE="parameters/${SOLVER}.param.yaml"
OUTPUT_FILE="output/tuning/${SOLVER}_best_params.json"
TEST_EXEC="build/test"
N_CALLS=30 # A reasonable number for BO

# Small
# echo "--- Tuning for small instances (data/25) ---"
# uv run src/experiment/bao_tune.py \
#     --solver $SOLVER \
#     --tune-file $TUNE_FILE \
#     --param-file $PARAM_FILE \
#     --runtime-weight 1.0 \
#     --instance-dir data/25 \
#     --size small \
#     --n-calls $N_CALLS \
#     --output output/tuning/$SOLVER.small.json \
#     --test-exec $TEST_EXEC \
#     --n-samples 5 \
#     --timeout 10

# # Medium
# echo "--- Tuning for medium instances (data/50) ---"
# uv run src/experiment/bao_tune.py \
#     --solver $SOLVER \
#     --tune-file $TUNE_FILE \
#     --param-file $PARAM_FILE \
#     --runtime-weight 1.0 \
#     --instance-dir data/50 \
#     --size medium \
#     --n-calls $N_CALLS \
#     --output output/tuning/$SOLVER.medium.json \
#     --test-exec $TEST_EXEC \
#     --n-samples 5 \
#     --timeout 100

# Large
echo "--- Tuning for large instances (data/100) ---"
uv run src/experiment/bao_tune.py \
    --solver $SOLVER \
    --tune-file $TUNE_FILE \
    --param-file $PARAM_FILE \
    --runtime-weight 0.5 \
    --instance-dir data/100 \
    --size large \
    --n-calls $N_CALLS \
    --output output/tuning/$SOLVER.large.json \
    --test-exec $TEST_EXEC \
    --n-samples 5 \
    --timeout 500

echo "--- PACO tuning complete ---"
