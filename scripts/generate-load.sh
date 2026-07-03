#!/bin/bash
set -euo pipefail

API_URL=${API_URL:-http://localhost:8080}
DURATION=${DURATION:-60}

echo "Generating load against $API_URL for ${DURATION}s..."

if command -v k6 >/dev/null 2>&1; then
    API_URL="$API_URL" DURATION="$DURATION" k6 run - <<'EOF'
import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 10,
  duration: `${__ENV.DURATION || 60}s`,
};

export default function () {
  const baseUrl = __ENV.API_URL || 'http://localhost:8080';
  const health = http.get(`${baseUrl}/health`);
  check(health, { 'status is 200': (r) => r.status === 200 });
  http.get(`${baseUrl}/api/courses`);
  sleep(1);
}
EOF
else
    echo "k6 not found, using curl for basic load..."
    for _ in $(seq 1 "$DURATION"); do
        curl -s "$API_URL/health" >/dev/null &
        curl -s "$API_URL/api/courses" >/dev/null &
        sleep 1
    done
    wait
fi

echo "Load generation complete!"
