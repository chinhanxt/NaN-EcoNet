#!/usr/bin/env bash
set -uo pipefail

base_url="${POSTIZ_DEV_FRONTEND_URL:-http://127.0.0.1:4200}"
routes=(auth/login launches agents agents/new analytics media plugs third-party settings)

# Chờ Frontend sẵn sàng trước khi pre-warm
for ((i = 0; i < 30; i++)); do
  if curl -fsS --max-time 2 "${base_url}/auth" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

for route in "${routes[@]}"; do
  curl --silent --max-time 30 \
    --header 'Cookie: auth=postiz-dev-warmup' \
    --output /dev/null "${base_url}/${route}" 2>/dev/null || true
  sleep 0.1
done
