#!/bin/bash
export NEXT_TELEMETRY_DISABLED=1
export NODE_OPTIONS="--max-old-space-size=1536"
cd /app/apps/frontend
exec /app/node_modules/.bin/dotenv -e ../../.env -- /app/node_modules/.bin/next dev --webpack -p 4200 --disable-source-maps
