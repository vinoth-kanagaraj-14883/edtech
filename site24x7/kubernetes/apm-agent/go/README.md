# Site24x7 APM — Go Services (api-gateway, notification-service)

## Overview

The Go services (`api-gateway` with Gin, `notification-service` with Fiber) are already
instrumented with **OpenTelemetry**. Site24x7 supports OTel natively — no code changes
are required. Simply point the OTel exporter to Site24x7's OTel-compatible endpoint.

## Approach: OTel Endpoint Redirect

Instead of adding a new SDK, redirect the existing OTLP exporter to Site24x7:

```bash
# Add to the deployment's environment variables (done via patch-examples/):
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.site24x7.com:4317
OTEL_EXPORTER_OTLP_HEADERS=device-key=YOUR_DEVICE_KEY
```

This approach means:
- Zero application code changes
- Both Site24x7 AND the existing OTel collector can receive data (via separate env vars)
- APM traces appear in both Jaeger (existing) and Site24x7 portal

## Files

| File | Purpose |
|------|---------|
| `apm-snippet-api-gateway.go` | OTel-compatible Site24x7 initialization for api-gateway |
| `apm-snippet-notification.go` | OTel-compatible Site24x7 initialization for notification-service |

## Environment Variables (injected via K8s patch)

```yaml
- name: SITE24X7_APM_KEY
  valueFrom:
    secretKeyRef:
      name: site24x7-device-key
      key: device-key
- name: SITE24X7_SERVICE_NAME
  value: "edtech-api-gateway"
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: "https://otlp.site24x7.com:4317"
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "service.name=edtech-api-gateway,deployment.environment=production"
```

## Alternative: Direct SDK Integration

If you want richer Site24x7-specific features (synthetic transaction tracking,
custom events), you can optionally add the Site24x7 Go APM snippet shown in
`apm-snippet-api-gateway.go`. This wraps the existing OTel setup.
