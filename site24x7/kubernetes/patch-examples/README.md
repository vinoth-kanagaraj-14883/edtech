# Site24x7 APM — Kubernetes Patch Examples

This directory contains **strategic merge patches** that inject Site24x7 APM
configuration into the existing EdTech deployments **without modifying the original
`k8s/` manifests**.

## Strategy

Operators maintain two independent overlay layers:

```
k8s/overlays/production/   ← existing, untouched
site24x7/kubernetes/patch-examples/  ← additive Site24x7 layer
```

Both can be applied independently:

```bash
# Apply the existing production overlay (unchanged)
kubectl apply -k k8s/overlays/production/

# Apply Site24x7 APM patches (additive, on top)
kubectl apply -k site24x7/kubernetes/patch-examples/
```

## Files

| File | Target Deployment |
|------|------------------|
| `api-gateway-patch.yaml` | `api-gateway` (Go/Gin) |
| `user-service-patch.yaml` | `user-service` (Python/FastAPI) |
| `course-service-patch.yaml` | `course-service` (Java/Spring Boot) — includes init container |
| `content-service-patch.yaml` | `content-service` (Node.js/TypeScript) |
| `quiz-service-patch.yaml` | `quiz-service` (Ruby/Sinatra) |
| `notification-service-patch.yaml` | `notification-service` (Go/Fiber) |
| `frontend-patch.yaml` | `frontend` (Next.js 14) |
| `kustomization.yaml` | Kustomize overlay applying all patches |

## What Each Patch Adds

All patches add:
- `SITE24X7_APM_KEY` — from the `site24x7-device-key` Secret (namespace: `edtech`)
- `SITE24X7_SERVICE_NAME` — service-specific identifier shown in Site24x7 portal
- `SITE24X7_APM_ENDPOINT` — APM collector URL

Language-specific additions:
- **Go**: `OTEL_EXPORTER_OTLP_ENDPOINT` pointing to Site24x7's OTel endpoint
- **Java**: init container that downloads the APM agent JAR + `JAVA_TOOL_OPTIONS`
- **Node.js**: `NODE_OPTIONS` to preload the APM agent

## Prerequisites

Before applying patches, create the APM key secret in the `edtech` namespace:

```bash
kubectl create secret generic site24x7-device-key \
  --from-literal=device-key=YOUR_DEVICE_KEY \
  --namespace=edtech
```

## Apply

```bash
kubectl apply -k site24x7/kubernetes/patch-examples/
```

Or via the Makefile:
```bash
make -f site24x7/Makefile k8s-apm-patch DEVICE_KEY=YOUR_DEVICE_KEY
```
