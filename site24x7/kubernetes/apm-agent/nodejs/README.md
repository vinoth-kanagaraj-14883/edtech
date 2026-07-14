# Site24x7 APM — Node.js Services (content-service, frontend)

## Overview

The `content-service` (Node.js/TypeScript with Express) and `frontend` (Next.js 14)
use the Site24x7 Node.js APM package. Add `require('site24x7-apm')` as the **very
first line** of the application entry point — before any other imports.

## Installation

```bash
npm install site24x7-apm
# or
yarn add site24x7-apm
```

See `requirements-site24x7.txt` for the exact package name.

## Usage

```javascript
// Must be the FIRST line in your entry point (e.g., server.ts or index.ts)
require('site24x7-apm').init({
  licenseKey: process.env.SITE24X7_APM_KEY,
  appName: process.env.SITE24X7_SERVICE_NAME || 'edtech-content-service',
});
```

For TypeScript:
```typescript
import * as site24x7 from 'site24x7-apm';
site24x7.init({ licenseKey: process.env.SITE24X7_APM_KEY! });
```

## Files

| File | Purpose |
|------|---------|
| `apm-snippet-content-service.js` | Complete APM init snippet for content-service |
| `requirements-site24x7.txt` | npm package name |

## Auto-Instrumented Frameworks

- Express.js (all routes)
- Next.js (API routes and SSR)
- MySQL / mysql2 (database queries)
- Redis (ioredis / node-redis)
- http / https (outbound calls)
- PostgreSQL (pg)

## Environment Variables (injected via K8s patch)

```yaml
- name: SITE24X7_APM_KEY
  valueFrom:
    secretKeyRef:
      name: site24x7-device-key
      key: device-key
- name: SITE24X7_SERVICE_NAME
  value: "edtech-content-service"
```
