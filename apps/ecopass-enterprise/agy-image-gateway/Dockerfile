# ==============================================================================
# AI Visual Synthesis Gateway (Port 5002)
# Multi-Provider AI Art Studio & Gateway powered by FastAPI & FLUX/Gemini
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p storage/generated storage/cache

ENV PORT=5002
ENV PROXY_PORT=8899

EXPOSE 5002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5002"]
