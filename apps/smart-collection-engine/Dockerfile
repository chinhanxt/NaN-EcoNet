FROM python:3.13-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libyaml-cpp-dev \
    nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source code relative to the build context
COPY src/ /app/src/

# Build C++ solver
WORKDIR /app/src/build
RUN cmake .. && make test

# --- Backend Setup ---
WORKDIR /app/backend
COPY backend/ /app/backend/

# Copy compiled binary to where the backend expects it
RUN mkdir -p bin && cp /app/src/build/test bin/test

# Install Backend dependencies
RUN uv pip install --system .

# --- Streamlit Setup ---
WORKDIR /app/streamlit
COPY streamlit/ /app/streamlit/

# Install Streamlit dependencies
# Note: requests is needed by solver_api_client.py but was missing in streamlit/pyproject.toml.
# It will be provided by backend dependencies.
RUN uv pip install --system .

# --- Final Setup ---
WORKDIR /app
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose ports: 8000 for FastAPI, 8501 for Streamlit
EXPOSE 8000
EXPOSE 8501

# Run the startup script
CMD ["/app/start.sh"]
