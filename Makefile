SHELL := /bin/bash
COMPOSE := docker compose -f docker-compose.yml
COMPOSE_OBS := docker compose -f docker-compose.yml -f docker-compose.observability.yml
COMPOSE_DEMO := docker compose -f docker-compose.yml -f docker-compose.observability.yml -f demo/docker-compose.demo.yml

.PHONY: up down up-obs build rebuild rebuild-one smoke test health k8s-deploy k8s-delete load-test setup-db logs status \
        loadgen-logs loadgen-stop loadgen-start \
        demo-up demo-init demo-down demo-reset demo-healthy demo-slow-db demo-error-storm demo-cascade demo-timeout demo-noisy-neighbor demo-retry-storm demo-partial demo-status

# Docker Compose
up:
	$(COMPOSE) up -d

down:
	$(COMPOSE_OBS) down -v

up-obs:
	$(COMPOSE_OBS) up -d

build:
	$(COMPOSE) build

# Rebuild all images and recreate containers (use after code changes)
rebuild:
	$(COMPOSE_OBS) build
	$(COMPOSE_OBS) up -d --force-recreate

# Rebuild a single service: make rebuild-one SVC=api-gateway
rebuild-one:
	$(COMPOSE) build $(SVC)
	$(COMPOSE_OBS) up -d --force-recreate $(SVC)

# Run end-to-end smoke test across all flows
smoke:
	./scripts/smoke-test.sh

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

# Load testing (one-off, fixed duration)
load-test:
	./scripts/generate-load.sh

# Always-on load generator (part of the observability stack). It starts
# automatically with `make up-obs` / `make rebuild`. These targets just help
# you inspect or toggle it without touching the rest of the stack.
loadgen-logs:
	$(COMPOSE_OBS) logs -f loadgen

loadgen-stop:
	$(COMPOSE_OBS) stop loadgen

loadgen-start:
	$(COMPOSE_OBS) up -d loadgen

# Setup databases
setup-db:
	./scripts/setup-databases.sh

# Logs
logs:
	$(COMPOSE) logs -f

# Status
status:
	$(COMPOSE) ps

# ---------------------------------------------------------------------------
# Observability DEMO (Toxiproxy fault-injection scenarios). See demo/RUNBOOK.md
# ---------------------------------------------------------------------------

# Bring up platform + observability + toxiproxy sidecar
demo-up:
	$(COMPOSE_DEMO) up -d

# Register the per-service toxiproxy proxies. NOTE: the scenario targets below
# now auto-register proxies on first run (see demo/scenarios.sh preflight), so
# this is only needed as a manual/troubleshooting step.
demo-init:
	./demo/toxiproxy-init.sh

# Tear the whole demo stack down
demo-down:
	$(COMPOSE_DEMO) down -v

# Clear all injected faults, back to healthy baseline
demo-reset:
	./demo/scenarios.sh reset

# Show currently active toxics per service
demo-status:
	./demo/inject-fault.sh status

# Individual scenarios (see demo/RUNBOOK.md for the narration)
demo-healthy:
	./demo/scenarios.sh healthy

demo-slow-db:
	./demo/scenarios.sh slow-db

demo-error-storm:
	./demo/scenarios.sh error-storm

demo-cascade:
	./demo/scenarios.sh cascade

demo-timeout:
	./demo/scenarios.sh timeout

demo-noisy-neighbor:
	./demo/scenarios.sh noisy-neighbor

demo-retry-storm:
	./demo/scenarios.sh retry-storm

demo-partial:
	./demo/scenarios.sh partial-degradation
