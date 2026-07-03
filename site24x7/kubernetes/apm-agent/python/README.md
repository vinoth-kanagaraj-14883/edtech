# Site24x7 APM — Python Services (user-service)

## Overview

The `user-service` runs Python with FastAPI. Site24x7 provides a Python APM package
(`site24x7-apm`) that auto-instruments popular frameworks including FastAPI, Flask,
Django, SQLAlchemy, and Redis.

## Installation

```bash
pip install site24x7-apm
```

Or add to `requirements.txt` (see `requirements-site24x7.txt` for the exact package).

## Usage

Add the Site24x7 APM import as the **very first import** in your application entry point:

```python
import site24x7
site24x7.init(
    license_key=os.environ["SITE24X7_APM_KEY"],
    app_name="edtech-user-service",
)
```

The `apm-snippet-user-service.py` file shows the complete integration with FastAPI.

## Files

| File | Purpose |
|------|---------|
| `apm-snippet-user-service.py` | Complete APM init snippet for FastAPI user-service |
| `requirements-site24x7.txt` | Site24x7 APM package for pip install |

## Environment Variables (injected via K8s patch)

```yaml
- name: SITE24X7_APM_KEY
  valueFrom:
    secretKeyRef:
      name: site24x7-device-key
      key: device-key
- name: SITE24X7_SERVICE_NAME
  value: "edtech-user-service"
- name: SITE24X7_APM_ENDPOINT
  value: "https://apmcollector.site24x7.com"
```

## Auto-Instrumented Libraries

When `site24x7.init()` is called, the following are auto-instrumented:
- FastAPI / Starlette (all routes)
- SQLAlchemy (database queries)
- httpx / requests (outbound HTTP calls)
- Redis (cache operations)
- PostgreSQL via psycopg2/asyncpg

No further code changes are needed.
