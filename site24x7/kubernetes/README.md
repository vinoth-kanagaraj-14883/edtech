# Site24x7 Kubernetes Integration

This directory contains all Kubernetes manifests and configuration for deploying
Site24x7 observability on the EdTech Kubernetes cluster.

## Components

| Directory | Purpose |
|-----------|---------|
| `server-agent/` | DaemonSet that runs Site24x7 server monitoring agent on every node |
| `apm-agent/` | Language-specific APM snippets and init scripts |
| `kubernetes-monitoring/` | Kubernetes cluster monitoring config |
| `patch-examples/` | Strategic merge patches to inject APM into existing deployments |

## Files

- `namespace.yaml` — Creates the `site24x7-monitoring` namespace
- `apm-init-configmap.yaml` — Shared APM configuration for all services
- `apm-device-key-secret.yaml.example` — Template for the device key Secret

## Deployment Order

1. Apply namespace: `kubectl apply -f namespace.yaml`
2. Create device key secret (see [../docs/device-key-setup.md](../docs/device-key-setup.md))
3. Apply server agent: `kubectl apply -f server-agent/`
4. (Optional) Apply APM patches: `kubectl apply -k patch-examples/`

Or simply use the Makefile from the `site24x7/` root:

```bash
make k8s-install DEVICE_KEY=your_device_key
```

## Namespace

All Site24x7 infrastructure runs in the `site24x7-monitoring` namespace, completely
separate from the `edtech` namespace where application workloads run.
