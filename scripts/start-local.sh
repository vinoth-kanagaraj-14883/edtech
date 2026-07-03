#!/bin/bash
# Start all services locally with Docker Compose
set -euo pipefail

echo "Starting EdTech platform locally..."
[ -f .env ] || cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
echo "Waiting for services to start..."
sleep 10
./scripts/health-check.sh
echo "Platform is running!"
echo "  Frontend:      http://localhost:3000"
echo "  API Gateway:   http://localhost:8080"
echo "  Grafana:       http://localhost:3001"
echo "  Prometheus:    http://localhost:9090"
echo "  Jaeger:        http://localhost:16686"
