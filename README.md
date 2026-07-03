# EdTech Platform

A polyglot, microservices-based EdTech platform combining Python, Java, TypeScript, Go-ready, and Ruby-ready service boundaries with Docker, Kubernetes, Helm, and an observability stack.

## 1. Architecture diagram

```text
                             ┌────────────────────────────┐
                             │         Frontend           │
                             │   Next.js / Web Client     │
                             │         :3000              │
                             └─────────────┬──────────────┘
                                           │
                                           ▼
                             ┌────────────────────────────┐
                             │        API Gateway         │
                             │          Go-ready          │
                             │          :8080             │
                             └──────┬──────┬──────┬───────┘
                                    │      │      │
            ┌───────────────────────┘      │      └───────────────────────┐
            ▼                              ▼                              ▼
┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
│    User Service    │        │   Course Service   │        │  Content Service   │
│      Python        │        │       Java         │        │   Node/TypeScript  │
│       :8001        │        │       :8002        │        │       :8003        │
└─────────┬──────────┘        └─────────┬──────────┘        └─────────┬──────────┘
          │                             │                             │
          ▼                             ▼                             ▼
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │ PostgreSQL   │              │ PostgreSQL   │              │    MySQL     │
  │   userdb     │              │  coursedb    │              │  contentdb   │
  └──────────────┘              └──────────────┘              └──────────────┘

            ┌───────────────────────┐              ┌──────────────────────────┐
            │     Quiz Service      │              │   Notification Service   │
            │      Ruby-ready       │              │         Go-ready          │
            │        :8004          │              │           :8005           │
            └──────────┬────────────┘              └────────────┬─────────────┘
                       │                                          │
                       └────────────────┬─────────────────────────┘
                                        ▼
                                 ┌──────────────┐
                                 │    Redis     │
                                 └──────────────┘

                   ┌────────────────────────────────────────────────────┐
                   │ Observability: OpenTelemetry + Prometheus +        │
                   │ Grafana + Jaeger + Alertmanager                    │
                   └────────────────────────────────────────────────────┘
```

## 2. Prerequisites

- Docker Engine 24+ and Docker Compose v2
- GNU Make
- Kubernetes cluster plus `kubectl` for cluster deployments
- Helm 3 for chart-based installs
- Optional: `k6` for load testing
- Language runtimes for local development:
  - Python 3.11+
  - Node.js 20+
  - Java 21+
  - Go 1.22+
  - Ruby 3.2+

## 3. Quick start guide (Docker Compose)

1. Copy environment defaults:

   ```bash
   cp .env.example .env
   ```

2. Start the full platform plus observability:

   ```bash
   make up-obs
   ```

   Or use the helper script:

   ```bash
   ./scripts/start-local.sh
   ```

3. Initialize databases:

   ```bash
   make setup-db
   ```

4. Verify health:

   ```bash
   make health
   ```

5. View status and logs:

   ```bash
   make status
   make logs
   ```

6. Stop everything:

   ```bash
   make down
   ```

### Local endpoints

- Frontend: http://localhost:3000
- API Gateway: http://localhost:8080
- User Service: http://localhost:8001/health
- Course Service: http://localhost:8002/health
- Content Service: http://localhost:8003/health
- Quiz Service: http://localhost:8004/health
- Notification Service: http://localhost:8005/health

## 4. Kubernetes deployment guide

### Kustomize deployment

Development:

```bash
./scripts/start-k8s.sh development
```

Staging:

```bash
./scripts/start-k8s.sh staging
```

Production:

```bash
./scripts/start-k8s.sh production
```

Delete base resources:

```bash
make k8s-delete
```

### Helm deployment

Install with default values:

```bash
helm upgrade --install edtech ./helm/edtech -n edtech --create-namespace
```

Install with production overrides:

```bash
helm upgrade --install edtech ./helm/edtech -n edtech -f helm/edtech/values-production.yaml
```

## 5. Observability stack guide

`docker-compose.observability.yml` adds:

- OpenTelemetry Collector on `4317`/`4318`
- Prometheus on `9090`
- Grafana on `3001`
- Jaeger on `16686`
- Alertmanager on `9093`

Typical workflow:

```bash
make up-obs
make load-test
```

Then inspect:

- Grafana dashboards: http://localhost:3001
- Prometheus targets: http://localhost:9090/targets
- Jaeger traces: http://localhost:16686
- Alertmanager UI: http://localhost:9093

## 6. API documentation per service

### API Gateway (`:8080`)

- `GET /health` — gateway health
- `GET /api/courses` — example course listing route
- Proxies requests to downstream services defined by service URL environment variables

### User Service (`:8001`)

- `GET /health` — liveliness probe
- `GET /ready` — readiness probe with database check
- `GET /metrics` — Prometheus metrics
- Auth and profile endpoints are implemented in `user-service/main.py`

### Course Service (`:8002`)

- `GET /health` — liveliness probe
- `GET /ready` — readiness probe with DB validation
- `GET /actuator/prometheus` — Prometheus metrics
- Domain APIs are under `course-service/src/main/java/.../controller`

### Content Service (`:8003`)

- `GET /health` — liveliness probe
- `GET /ready` — readiness probe
- `GET /metrics` — Prometheus metrics
- `GET /content`, `GET /lessons` — domain routes

### Quiz Service (`:8004`)

- `GET /health` — liveliness probe
- Quiz CRUD and grading endpoints are expected here

### Notification Service (`:8005`)

- `GET /health` — liveliness probe
- Email, push, and in-app notification workflows are expected here

### Frontend (`:3000`)

- Serves the learner/instructor/admin web UI
- Uses `NEXT_PUBLIC_API_URL` to reach the gateway

## 7. Environment variables reference

| Variable | Purpose | Default |
| --- | --- | --- |
| `JWT_SECRET` | Shared JWT signing secret | `your-super-secret-jwt-key-change-in-production` |
| `POSTGRES_HOST` | PostgreSQL hostname | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USER` | PostgreSQL username | `edtech` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `edtech_password` |
| `POSTGRES_DB` | Bootstrap PostgreSQL database | `edtech` |
| `MYSQL_HOST` | MySQL hostname | `localhost` |
| `MYSQL_PORT` | MySQL port | `3306` |
| `MYSQL_USER` | MySQL username | `edtech` |
| `MYSQL_PASSWORD` | MySQL password | `edtech_password` |
| `MYSQL_DB` | Bootstrap MySQL database | `edtech` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Redis password | empty |
| `USER_SERVICE_URL` | Gateway route to user service | `http://localhost:8001` |
| `COURSE_SERVICE_URL` | Gateway route to course service | `http://localhost:8002` |
| `CONTENT_SERVICE_URL` | Gateway route to content service | `http://localhost:8003` |
| `QUIZ_SERVICE_URL` | Gateway route to quiz service | `http://localhost:8004` |
| `NOTIFICATION_SERVICE_URL` | Gateway route to notification service | `http://localhost:8005` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint | `http://localhost:4317` |
| `OTEL_SERVICE_NAME` | Default OTel service name | `edtech-api-gateway` |
| `OTEL_RESOURCE_ATTRIBUTES` | OTel resource metadata | `deployment.environment=development` |
| `PROMETHEUS_PORT` | Published Prometheus port | `9090` |
| `GRAFANA_PORT` | Published Grafana port | `3001` |
| `JAEGER_PORT` | Published Jaeger UI port | `16686` |
| `ALERTMANAGER_PORT` | Published Alertmanager port | `9093` |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL | `http://localhost:8080` |

## 8. Troubleshooting guide

### Compose services fail to start

- Run `docker compose -f docker-compose.yml ps`
- Inspect logs with `make logs`
- Ensure ports `3000`, `3001`, `3306`, `5432`, `6379`, `8001-8005`, `8080`, `9090`, and `16686` are free

### Database initialization issues

- Start the platform before running `make setup-db`
- Confirm the `postgres` and `mysql` containers are healthy
- Re-run `./scripts/setup-databases.sh` after credentials changes

### Kubernetes rollout hangs

- Verify images exist in GHCR for each service
- Check `kubectl get events -n edtech --sort-by=.lastTimestamp`
- Ensure the selected overlay exists under `k8s/overlays/`

### Observability data is missing

- Confirm `otel-collector`, `prometheus`, and `jaeger` are running
- Check `OTEL_EXPORTER_OTLP_ENDPOINT` values in containers
- Open Prometheus targets and verify scrape status

### Notes about service coverage

This repository includes service source code plus platform scaffolding for local Docker, Kubernetes, Helm, and GitHub Actions automation. The top-level operational assets are designed so teams can run, observe, test, and promote the platform consistently across environments.
