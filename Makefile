SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.yml
COMPOSE_OBS := docker compose -f docker-compose.yml -f docker-compose.observability.yml

.PHONY: up down up-obs build test health k8s-deploy k8s-delete load-test setup-db logs status

# Docker Compose
up:
	$(COMPOSE) up -d

down:
	$(COMPOSE_OBS) down -v

up-obs:
	$(COMPOSE_OBS) up -d

build:
	$(COMPOSE) build

# Testing
test:
	@echo "Running tests..."
	@if [ -d api-gateway ] && [ -f api-gateway/go.mod ]; then cd api-gateway && go test ./...; else echo "Skipping api-gateway (not present)"; fi
	@if [ -d notification-service ] && [ -f notification-service/go.mod ]; then cd notification-service && go test ./...; else echo "Skipping notification-service (not present)"; fi
	@if [ -d user-service ]; then cd user-service && python -m pytest; else echo "Skipping user-service (not present)"; fi
	@if [ -d content-service ] && [ -f content-service/package.json ]; then cd content-service && npm test; else echo "Skipping content-service (not present)"; fi

# Health checks
health:
	./scripts/health-check.sh

# Kubernetes
k8s-deploy:
	./scripts/start-k8s.sh

k8s-delete:
	kubectl delete -k k8s/base/ --ignore-not-found

# Load testing
load-test:
	./scripts/generate-load.sh

# Setup databases
setup-db:
	./scripts/setup-databases.sh

# Logs
logs:
	$(COMPOSE) logs -f

# Status
status:
	$(COMPOSE) ps
