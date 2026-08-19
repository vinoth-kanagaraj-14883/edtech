# certification-service

Issues and verifies course-completion certificates for the polyglot **EduForge**
EdTech platform. Part of the same observability demo as `user-service` — it shares
the OpenTelemetry, structlog and Prometheus conventions so its spans join the
distributed trace and its outbound calls light up service-map edges in Jaeger.

- **Language / stack:** Python 3.11, FastAPI, uvicorn
- **Port:** `8009`
- **Database:** PostgreSQL via async SQLAlchemy + asyncpg (`certificationdb`)

## Responsibilities

Given a learner and a course, the service generates a human-readable certificate
number (`EDU-CERT-XXXXXXXX`), enriches it with the learner display name and course
title (fetched best-effort from `user-service` / `course-service`), persists it,
and notifies the learner via `notification-service`. Issuance is idempotent per
`(userId, courseId)` pair. Certificates can be looked up and publicly verified.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET  | `/health` | Liveness — `{status, service, timestamp}` |
| GET  | `/ready`  | Readiness — checks the database |
| GET  | `/metrics` | Prometheus exposition |
| POST | `/certificates` | Issue (or return existing) certificate for `{userId, courseId}` |
| GET  | `/certificates/{id}` | Fetch a certificate |
| GET  | `/certificates/{id}/verify` | Public verification `{valid, certificateNumber, userName, courseTitle, issuedAt}` |
| GET  | `/users/{userId}/certificates` | List a learner's certificates |

### POST /certificates flow

1. Resolve the learner id from the request body (`userId`) or the gateway header
   `X-User-Id`.
2. If a certificate already exists for `(userId, courseId)`, return it (idempotent).
3. Best-effort fetch of the learner display name from
   `GET {USER_SERVICE_URL}/users/{userId}` and course title from
   `GET {COURSE_SERVICE_URL}/courses/{courseId}`. Failures are tolerated (fields
   stay `null`).
4. Generate a certificate number, persist the record.
5. Best-effort `POST {NOTIFICATION_SERVICE_URL}/notifications` with
   `{userId, type: "certificate.issued", title, message, metadata: {certificateNumber}}`.
6. Return the certificate.

## Data model

`Certificate`: `id` (uuid string PK), `certificate_number` (unique, `EDU-CERT-…`),
`user_id`, `user_name` (nullable), `course_id`, `course_title` (nullable),
`issued_at`, `status` (`issued` | `revoked`). There is a unique constraint on
`(user_id, course_id)` to enforce idempotency. Tables are created on startup via
`Base.metadata.create_all` — no Alembic migrations.

## Authentication

The service has no independent auth. It trusts identity headers injected by the API
gateway: `X-User-Id`, `X-User-Role`, `X-User-Email`. When `POST /certificates` is
called without `userId` in the body, `X-User-Id` is used as the fallback.

## Observability

- **Tracing:** OpenTelemetry SDK with the OTLP gRPC exporter. Service name
  `certification-service`. The global propagator is a
  `CompositePropagator([TraceContext, W3CBaggage])` so the incoming `traceparent`
  is extracted and outbound calls re-inject it. FastAPI, SQLAlchemy and **httpx**
  are instrumented; instrumenting httpx is what makes the
  `certification-service -> user-service`, `-> course-service` and
  `-> notification-service` edges appear in Jaeger. `/health`, `/ready` and
  `/metrics` are excluded from tracing.
- **OTLP endpoint:** unlike `user-service` (which reads `OTLP_ENDPOINT`), this
  service reads the standard **`OTEL_EXPORTER_OTLP_ENDPOINT`** (default
  `otel-collector:4317`), and **also accepts `OTLP_ENDPOINT` as a fallback** for
  consistency with the rest of the fleet. If both are set, `OTLP_ENDPOINT` wins.
- **Logging:** structlog JSON logs enriched with `trace_id` / `span_id`.
- **Metrics:** Prometheus (`prometheus-client`):
  - `certification_service_http_requests_total{method,route,status}`
  - `certification_service_http_request_duration_seconds`
  - `certification_service_certificates_issued_total`

## Environment variables

| Variable | Default | Description |
| -------- | ------- | ----------- |
| `DATABASE_URL` | `postgresql://edtech:edtech_password@postgres:5432/certificationdb` | `postgresql://` is auto-rewritten to `postgresql+asyncpg://` |
| `USER_SERVICE_URL` | `http://user-service:8001` | Learner display-name lookup |
| `COURSE_SERVICE_URL` | `http://course-service:8002` | Course title lookup |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service:8005` | Issued-certificate notifications |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `otel-collector:4317` | OTLP gRPC collector endpoint |
| `OTLP_ENDPOINT` | _(unset)_ | Fallback for the collector endpoint; wins if set |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |

JWT configuration is not required — this service does not mint or validate tokens.

## Running locally

```sh
python -m venv .venv
. .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://edtech:edtech_password@localhost:5432/certificationdb
uvicorn main:app --host 0.0.0.0 --port 8009
```

## Docker

```sh
docker build -t eduforge/certification-service .
docker run -p 8009:8009 eduforge/certification-service
```
