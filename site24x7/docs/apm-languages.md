# APM Language-by-Language Setup Guide

This guide covers Site24x7 APM instrumentation for each language used in the EdTech platform.

---

## Go — api-gateway (Gin) and notification-service (Fiber)

### Approach: OpenTelemetry Endpoint Redirect

The Go services already use the OpenTelemetry SDK. Site24x7 accepts OTel data natively —
**no code changes are required**. Simply redirect the OTLP exporter endpoint.

### Setup (Kubernetes)

Add these env vars via the Kubernetes patch (already done in `patch-examples/`):

```yaml
env:
  - name: SITE24X7_APM_KEY
    valueFrom:
      secretKeyRef:
        name: site24x7-device-key
        key: device-key
  - name: SITE24X7_OTLP_ENDPOINT
    value: "otlp.site24x7.com:4317"
```

### Setup (Bare Metal)

```bash
# Run the install script
DEVICE_KEY=your_key SERVICE_NAME=edtech-api-gateway \
  ./site24x7/bare-metal/scripts/install-apm-go.sh

# Add to the systemd unit file:
# EnvironmentFile=/opt/site24x7/go-apm.env

systemctl daemon-reload && systemctl restart api-gateway
```

### What Gets Instrumented

- All HTTP routes (via existing `otelgin` / `otelfiber` middleware)
- Outbound HTTP calls (via `otelhttp.Transport`)
- Redis operations (via existing OTel instrumentation)
- Custom spans (existing `tracer.Start()` calls)

---

## Python — user-service (FastAPI)

### Approach: site24x7-apm Package

Install the `site24x7-apm` Python package and call `site24x7.init()` before other imports.

### Setup (Kubernetes)

1. Apply the env var patch (already in `patch-examples/user-service-patch.yaml`)
2. In `user-service/main.py`, add at the top:

```python
import os
import site24x7

site24x7.init(
    license_key=os.environ["SITE24X7_APM_KEY"],
    app_name=os.environ.get("SITE24X7_SERVICE_NAME", "edtech-user-service"),
)

# Then import FastAPI and everything else
from fastapi import FastAPI
```

3. Add to `requirements.txt`:
```
site24x7-apm>=1.0.0
```

### Setup (Bare Metal)

```bash
DEVICE_KEY=your_key SERVICE_NAME=edtech-user-service \
  ./site24x7/bare-metal/scripts/install-apm-python.sh
```

### What Gets Auto-Instrumented

- FastAPI routes (all endpoints)
- SQLAlchemy queries (response time, slow queries)
- PostgreSQL via psycopg2/asyncpg
- Redis operations
- httpx/requests outbound calls

---

## Java — course-service (Spring Boot)

### Approach: JVM Agent (Zero Code Changes)

The Site24x7 Java APM agent attaches to the JVM via `-javaagent`. No code changes needed.

### Setup (Kubernetes)

The `patch-examples/course-service-patch.yaml` adds:
1. An init container that downloads `apm-agent.jar` into a shared emptyDir volume
2. `JAVA_TOOL_OPTIONS=-javaagent:/opt/site24x7/apm-agent.jar`
3. `SITE24X7_APM_KEY` from the Kubernetes Secret

```bash
kubectl apply -k site24x7/kubernetes/patch-examples/
```

### Setup (Bare Metal)

```bash
DEVICE_KEY=your_key SERVICE_NAME=edtech-course-service \
  ./site24x7/bare-metal/scripts/install-apm-java.sh

# Then add to course-service systemd unit:
# EnvironmentFile=/opt/site24x7/java-apm.env
systemctl daemon-reload && systemctl restart course-service
```

### What Gets Auto-Instrumented

- Spring Boot / Spring MVC (all HTTP endpoints)
- JDBC / JPA / Hibernate (SQL queries, slow queries)
- RestTemplate / WebClient (outbound HTTP)
- Connection pool metrics
- Exception tracking

---

## Node.js — content-service (Express) and frontend (Next.js 14)

### Approach: site24x7-apm npm Package

Require `site24x7-apm` as the **very first line** of the entry point.

### Setup (Kubernetes)

1. Apply the env var patch (already in `patch-examples/content-service-patch.yaml`)
2. In `content-service/src/index.ts`, add as the FIRST line:

```typescript
// Must be first — before any other requires
require('site24x7-apm').init({
  licenseKey: process.env.SITE24X7_APM_KEY!,
  appName: process.env.SITE24X7_SERVICE_NAME || 'edtech-content-service',
});
```

3. Add to `package.json`:
```json
"dependencies": {
  "site24x7-apm": "^1.0.0"
}
```

### Setup for Next.js (frontend)

In `frontend/instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const apm = require('site24x7-apm');
    apm.init({
      licenseKey: process.env.SITE24X7_APM_KEY,
      appName: 'edtech-frontend',
    });
  }
}
```

Enable in `next.config.js`:
```js
module.exports = {
  experimental: { instrumentationHook: true },
};
```

### Setup (Bare Metal)

```bash
DEVICE_KEY=your_key SERVICE_NAME=edtech-content-service \
  ./site24x7/bare-metal/scripts/install-apm-nodejs.sh
```

### What Gets Auto-Instrumented

- Express routes
- Next.js API routes and SSR
- MySQL2 queries
- Redis operations (ioredis)
- Outbound HTTP calls

---

## Ruby — quiz-service (Sinatra)

### Approach: site24x7 gem

Add the `site24x7` gem and require it at the top of `config.ru`.

### Setup (Kubernetes)

1. Apply the env var patch (already in `patch-examples/quiz-service-patch.yaml`)
2. In `quiz-service/config.ru`, add as the FIRST line:

```ruby
require 'site24x7'
Site24x7::APM.init(
  license_key: ENV['SITE24X7_APM_KEY'],
  app_name: ENV.fetch('SITE24X7_SERVICE_NAME', 'edtech-quiz-service'),
)

# Then require Sinatra
require 'sinatra/base'
require_relative 'app'
run QuizApp
```

3. Add to `Gemfile`:
```ruby
gem 'site24x7', '~> 1.0'
```

### Setup (Bare Metal)

```bash
DEVICE_KEY=your_key SERVICE_NAME=edtech-quiz-service \
  ./site24x7/bare-metal/scripts/install-apm-ruby.sh
```

### What Gets Auto-Instrumented

- Sinatra routes (all endpoints)
- MySQL2 queries
- Redis operations
- Net::HTTP outbound calls
- Rack middleware

---

## Summary Table

| Service | Language | APM Method | Code Change Required? |
|---------|----------|-----------|----------------------|
| api-gateway | Go/Gin | OTel endpoint redirect | ❌ No |
| user-service | Python/FastAPI | `site24x7.init()` | ✅ 3 lines |
| course-service | Java/Spring | `-javaagent` JAR | ❌ No |
| content-service | Node.js | `require('site24x7-apm')` | ✅ 2 lines |
| quiz-service | Ruby/Sinatra | `require 'site24x7'` | ✅ 3 lines |
| notification-service | Go/Fiber | OTel endpoint redirect | ❌ No |
| frontend | Next.js | `instrumentation.ts` hook | ✅ 5 lines |
