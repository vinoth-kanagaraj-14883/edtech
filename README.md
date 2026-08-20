# EduForge Platform

EduForge is a polyglot, microservices-based EdTech platform. It is deliberately
built across five languages — **Python** (FastAPI), **Java** (Spring Boot),
**Node/TypeScript** (Express), **Go** (Gin/Fiber) and **Ruby** (Sinatra) — so a
single distributed request fans out across every runtime, making it an ideal
prototype for an **observability demo**: OpenTelemetry traces stitch the whole
journey together, Prometheus captures RED metrics per service, and Jaeger draws
the live service dependency map. A dedicated **chaos server** on its own port
lets you inject failures — in the application and in Kubernetes — and then find
them in the telemetry.

## Services

| Service | Language | Port | Datastore | Calls (trace edges) |
| --- | --- | --- | --- | --- |
| frontend | Next.js | 3000 | — | api-gateway |
| api-gateway | Go / Gin | 8080 | Redis (rate limit) | all services |
| user-service | Python / FastAPI | 8001 | PostgreSQL `userdb` | — |
| course-service | Java / Spring Boot | 8002 | PostgreSQL `coursedb` | — |
| content-service | Node / TypeScript | 8003 | MySQL `contentdb` | — |
| quiz-service | Ruby / Sinatra | 8004 | MySQL `quizdb` | notification |
| notification-service | Go / Fiber | 8005 | Redis (store + pub/sub) | — |
| search-service | Node / TypeScript | 8006 | Redis (cache) | course |
| **payment-service** | **Python / FastAPI** | **8007** | **PostgreSQL `paymentdb`** | **course, user, notification** |
| **tracking-service** | **Node / TypeScript** | **8008** | **MySQL `trackingdb`** | **content, certification, notification** |
| **certification-service** | **Python / FastAPI** | **8009** | **PostgreSQL `certificationdb`** | **user, course, notification** |
| **chaos-service** | **Python / FastAPI** | **8090** | **Redis (chaos flags)** | **Kubernetes API** |

## 1. Architecture diagram

```text
                        ┌────────────────────────┐
                        │        Frontend        │  Next.js :3000
                        └───────────┬────────────┘
                                    ▼
                        ┌────────────────────────┐
                        │       API Gateway      │  Go/Gin :8080
                        │  JWT · rate-limit · CB  │
                        └──┬───┬───┬───┬───┬───┬──┘
        ┌──────────────────┘   │   │   │   │   └──────────────────┐
        ▼                      ▼   ▼   ▼   ▼                      ▼
  ┌───────────┐   ┌───────────┐  ...  ┌───────────┐   ┌────────────────┐
  │   user    │   │  course   │       │   quiz    │   │  search :8006  │
  │  :8001 PG │   │ :8002 PG  │       │ :8004 MySQL│  │  Node → course │
  └─────▲─────┘   └─────▲─────┘       └─────┬─────┘   └────────────────┘
        │               │                   │ quiz.completed
        │        ┌──────┴──────────┐        ▼
        │        │                 │  ┌──────────────┐
  ┌─────┴──────┐ │           ┌─────┴──┤ notification │◄──────────────┐
  │  payment   │─┘           │        │  :8005 Redis │               │
  │  :8007 PG  │─────────────┼───────►└──────────────┘               │
  │  (charge)  │             │                                        │
  └────────────┘             │                                        │
        ▲ enroll/pay         │ lesson/quiz completed                 │
        │                    ▼                                        │
        │            ┌───────────────┐   100% done   ┌───────────────┴─┐
        └────────────│   tracking    │──────────────►│  certification  │
                     │  :8008 MySQL  │──► content     │  :8009 PG       │──► user, course
                     └───────────────┘                └─────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │ Observability: OpenTelemetry Collector → Jaeger (traces / service map)│
  │ + Prometheus (RED metrics) + Grafana (dashboards) + Alertmanager      │
  └──────────────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Chaos server :8090  — app faults via Redis chaos flags + k8s chaos    │
  └──────────────────────────────────────────────────────────────────────┘
```

### Key end-to-end flows (what builds the service map)

1. **Enroll & pay** — frontend → gateway → `payment-service`, which calls
   `course-service` (price) and `user-service`, then emits a `payment.received`
   notification. Edges: payment → course, payment → user, payment → notification.
2. **Learn & track** — lesson/quiz completions → `tracking-service`, which calls
   `content-service` (lesson count) to compute progress. Edges: tracking → content.
3. **Complete & certify** — at 100% progress `tracking-service` calls
   `certification-service`, which looks up `user-service` + `course-service` and
   emits `certificate.issued`. Edges: tracking → certification → user/course/notification.

Every hop propagates W3C trace context, so a single learner journey appears as
one connected trace spanning all five languages.

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
- Search Service: http://localhost:8006/health
- Payment Service: http://localhost:8007/health
- Tracking Service: http://localhost:8008/health
- Certification Service: http://localhost:8009/health
- **Chaos server dashboard: http://localhost:8090/**

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

- `GET /health`, `GET /ready`, `GET /metrics`
- `POST /notifications`, `GET /notifications`, `PUT /notifications/:id/read`
- Redis-backed store + pub/sub consumer

### Search Service (`:8006`)

- `GET /health`, `GET /ready`, `GET /metrics`
- `GET /search`, `GET /search/courses` — Redis-cached course search (falls back to course-service)

### Payment Service (`:8007`)

- `GET /health`, `GET /ready`, `GET /metrics`
- `POST /payments` — charge for a course enrollment (verifies price with course-service, emits `payment.received`)
- `GET /payments/{id}`, `GET /users/{userId}/payments`, `POST /payments/{id}/refund`

### Tracking Service (`:8008`)

- `GET /health`, `GET /ready`, `GET /metrics`
- `POST /tracking/events` — record lesson/quiz completion; recomputes progress and triggers a certificate at 100%
- `GET /tracking/users/{userId}/courses/{courseId}`, `GET /tracking/users/{userId}`, `GET /tracking/courses/{courseId}/stats`

### Certification Service (`:8009`)

- `GET /health`, `GET /ready`, `GET /metrics`
- `POST /certificates` — mint a completion certificate (idempotent per user+course; emits `certificate.issued`)
- `GET /certificates/{id}`, `GET /certificates/{id}/verify` (public), `GET /users/{userId}/certificates`

### Chaos server (`:8090`)

- `GET /` — web dashboard with Start/Stop buttons and live status
- `GET /scenarios`, `POST /scenarios/{name}/start`, `POST /scenarios/{name}/stop`
- `GET /status`, `POST /reset`
- See [`chaos-service/README.md`](chaos-service/README.md) and section 9 below.

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
| `SEARCH_SERVICE_URL` | Gateway route to search service | `http://localhost:8006` |
| `PAYMENT_SERVICE_URL` | Gateway route to payment service | `http://localhost:8007` |
| `TRACKING_SERVICE_URL` | Gateway route to tracking service | `http://localhost:8008` |
| `CERTIFICATION_SERVICE_URL` | Gateway route to certification service | `http://localhost:8009` |
| `CHAOS_PORT` | Chaos server port | `8090` |
| `KUBE_NAMESPACE` | Namespace targeted by k8s chaos scenarios | `edtech` |
| `FLAG_TTL_SECONDS` | Default TTL for Redis chaos flags | `600` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector endpoint | `http://localhost:4317` |
| `OTEL_SERVICE_NAME` | Default OTel service name | `edtech-api-gateway` |
| `OTEL_RESOURCE_ATTRIBUTES` | OTel resource metadata | `deployment.environment=development` |
| `PROMETHEUS_PORT` | Published Prometheus port | `9090` |
| `GRAFANA_PORT` | Published Grafana port | `3001` |
| `JAEGER_PORT` | Published Jaeger UI port | `16686` |
| `ALERTMANAGER_PORT` | Published Alertmanager port | `9093` |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL | `http://localhost:8080` |

## 8. Chaos engineering & failure scenarios

A dedicated **chaos server** runs on its own port (`:8090`) with a web dashboard
and REST API. It injects faults two ways:

- **Application faults** set Redis chaos flags (`chaos:<kind>:<service>`) that
  every service polls every 3s and self-injects (latency / error-rate / CPU /
  memory-leak). Works in Docker Compose and Kubernetes. Flags carry a TTL so a
  forgotten experiment self-heals.
- **Kubernetes faults** call the Kubernetes API (pod-kill, CPU/memory stress,
  network partition, bad rollout). They no-op with a clear message when no
  cluster is reachable, and there are equivalent [Chaos Mesh](chaos-service/k8s-chaos/)
  manifests for a declarative alternative.

Chaos runs on **three backends**, so it is not Kubernetes-only — 18 of the 23
scenarios work under plain `docker compose up`:

| Backend | Count | Needs | Compose | k8s |
|---|---|---|---|---|
| application (Redis flags, injected in-process) | 12 | Redis | ✅ | ✅ |
| docker (Engine API via the mounted socket) | 6 | `/var/run/docker.sock` | ✅ | ✖ |
| kubernetes (Kubernetes API) | 5 | a cluster | ✖ | ✅ |

The Docker backend adds real infrastructure faults locally: container kill,
hard outage, **freeze (SIGSTOP)**, cgroup CPU quota, memory limit with a genuine
OOM kill, and network partition. The freeze has no Kubernetes equivalent and is
the most realistic fault in the set — the container still accepts connections but
never answers, so callers hang until their own timeout instead of failing fast.

The chaos server is **active**, not just a set of switches:

- **Timed experiments** — every injection can carry a `duration` and auto-clears
  when it elapses (the dashboard counts it down live).
- **Auto mode (chaos monkey)** — a background loop continuously injects random
  faults at randomised magnitudes, at `calm` / `normal` / `aggressive` intensity,
  so the platform stays interesting with nobody clicking anything.
- **Game days** — four multi-step playbooks (`cascading-failure`,
  `checkout-meltdown`, `learner-journey-degradation`, `silent-degradation`) that
  layer faults so the blast radius compounds like a real incident, then clean up
  after themselves.
- **Jitter** — injected latency varies ~0.55×–1.75× per request instead of being
  a constant delay, so p50 and p99 diverge the way a real degraded dependency
  makes them.

Open the dashboard at **http://localhost:8090/** — sliders for magnitude and
duration, live countdowns, a blast-radius map, and a streaming event feed of
everything the engine does. Or drive it via the API:

```bash
# List the 10 scenarios and what each one shows in the telemetry
curl -s localhost:8090/scenarios | jq '.scenarios[] | {name, category, howItShows}'

# Slow every checkout by 800ms, watch payment-service p99 in Grafana / Jaeger
curl -XPOST localhost:8090/scenarios/payment-gateway-latency/start
curl -XPOST localhost:8090/scenarios/payment-gateway-latency/stop

# Run a 3-minute cascading-failure game day, then watch the map light up hop by hop
curl -XPOST localhost:8090/playbooks/cascading-failure/run

# Or just let chaos run itself while you explore the dashboards
curl -XPOST localhost:8090/auto/start -H 'content-type: application/json' \
  -d '{"intensity":"normal"}'

# Follow everything the engine is doing
curl -s localhost:8090/events | jq '.events[] | "\(.kind): \(.message)"'

# Freeze a container (SIGSTOP) — callers hang instead of failing fast
curl -XPOST localhost:8090/scenarios/docker-container-freeze/start \
  -H 'content-type: application/json' -d '{"duration":90}'

# Clear everything (also stops auto mode and any running game day)
curl -XPOST localhost:8090/reset
```

### Seeing chaos on the dashboards

Every experiment sets `chaos_scenario_active{scenario,category,target}`, which
Grafana renders as a **labelled red band across the SLO, overview,
service-detail, app-runtime and L7 dashboards**. That is what makes a latency
spike attributable to a specific injected fault instead of a guess.

There is also a dedicated **`EduForge - Chaos Engineering`** dashboard
(uid `edtech-chaos`) laid out as cause-above-effect: what is being injected on
top, what it did to p99 / error rate / `up` / throughput underneath. A band with
no bump under it means the platform absorbed the fault — a passing resilience
test. See [chaos-service/README.md](chaos-service/README.md) for what to look for.

**The 10 scenarios**

| # | Scenario | Type | Target | What to watch |
| --- | --- | --- | --- | --- |
| 1 | `payment-gateway-latency` | app | payment-service | payment p99 latency climbs |
| 2 | `payment-gateway-down` | app | payment-service | failed transactions spike, payment→notification edge drops |
| 3 | `certification-error-storm` | app | certification-service | error rate up; `chaos.injected=error` traces |
| 4 | `tracking-cpu-saturation` | app | tracking-service | CPU pegged, tracking latency widens, HPA may scale |
| 5 | `certification-memory-leak` | app | certification-service | memory sawtooth → OOM restart |
| 6 | `pod-kill` | k8s | api-gateway | restart blip then recovery |
| 7 | `cpu-stress` | k8s | node | node CPU saturation across co-located pods |
| 8 | `memory-oom` | k8s | node | pod OOMKilled + restart |
| 9 | `network-partition` | k8s | notification-service | service-map edges break (timeouts) |
| 10 | `bad-deploy` | k8s | course-service | ImagePullBackOff, rollout stalls |

For Kubernetes scenarios, deploy the chaos server in-cluster with its RBAC
(`chaos-service/k8s/chaos-service.yaml`, also included in the kustomize base) and
reach the dashboard on NodePort `30890`.

A complementary Toxiproxy-based network-fault harness also lives under `demo/`
(`make demo-*`, `demo/scenarios.sh`).

## 9. Troubleshooting guide

### Compose services fail to start

- Run `docker compose -f docker-compose.yml ps`
- Inspect logs with `make logs`
- Ensure ports `3000`, `3001`, `3306`, `5432`, `6379`, `8001-8009`, `8080`, `8090`, `9090`, and `16686` are free

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
