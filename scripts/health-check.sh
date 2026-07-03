#!/bin/bash
set -u

SERVICES=(
    "api-gateway|http://localhost:8080/health"
    "user-service|http://localhost:8001/health"
    "course-service|http://localhost:8002/health"
    "content-service|http://localhost:8003/health"
    "quiz-service|http://localhost:8004/health"
    "notification-service|http://localhost:8005/health"
    "frontend|http://localhost:3000"
)

all_healthy=true

for service_url in "${SERVICES[@]}"; do
    service="${service_url%%|*}"
    url="${service_url##*|}"

    if curl -s -f "$url" >/dev/null 2>&1; then
        echo "✅ $service is healthy"
    else
        echo "❌ $service is NOT healthy ($url)"
        all_healthy=false
    fi
done

if $all_healthy; then
    echo ""
    echo "All services are healthy! 🎉"
    exit 0
else
    echo ""
    echo "Some services are unhealthy!"
    exit 1
fi
