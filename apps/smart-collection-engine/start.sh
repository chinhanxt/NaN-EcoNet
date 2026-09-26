#!/bin/bash

BASE_DIR="${BASE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"

# Start FastAPI backend on port 8000
echo "Starting FastAPI backend on port 8000..."
cd "$BASE_DIR/backend"
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start original Streamlit frontend on port 8501
echo "Starting original Streamlit frontend on port 8501..."
cd "$BASE_DIR/streamlit"
streamlit run app.py --server.address=0.0.0.0 --server.port=8501 &

# Start dedicated Map-Only UI on port 8502 (MapLibre GL JS + OpenFreeMap as in Traccar)
echo "Starting dedicated Map-Only UI on port 8502..."
cd "$BASE_DIR/map_ui"
uvicorn server:app --host 0.0.0.0 --port 8502 &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
