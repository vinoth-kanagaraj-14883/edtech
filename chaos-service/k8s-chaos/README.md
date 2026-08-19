# Declarative Kubernetes chaos with Chaos Mesh

These manifests express the chaos-service's Kubernetes scenarios as
[Chaos Mesh](https://chaos-mesh.org) custom resources. They are an **alternative**
to the chaos-service's built-in imperative actions — use whichever fits your
demo. Chaos Mesh gives you richer scheduling, a dashboard of its own, and more
fault types (IO, time, kernel), at the cost of installing an operator.

## Install Chaos Mesh

```bash
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update
kubectl create ns chaos-mesh
helm install chaos-mesh chaos-mesh/chaos-mesh -n chaos-mesh \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock
```

(Adjust `runtime`/`socketPath` for your cluster's container runtime.)

## Apply a scenario

```bash
kubectl apply -f podchaos-pod-kill.yaml
kubectl apply -f stresschaos-cpu.yaml
kubectl apply -f stresschaos-memory.yaml
kubectl apply -f networkchaos-partition.yaml
kubectl apply -f iochaos-latency.yaml
# stop it
kubectl delete -f podchaos-pod-kill.yaml
```

All target the `edtech` namespace and select pods by their `app` label. Each has
`spec.duration` so it self-terminates. Watch the effects in the same
Jaeger / Prometheus / Grafana stack the application scenarios use.

| File | Chaos-service equivalent | Effect |
|---|---|---|
| `podchaos-pod-kill.yaml` | `pod-kill` | Kills api-gateway pods on a schedule |
| `stresschaos-cpu.yaml` | `cpu-stress` | CPU stress inside tracking-service pods |
| `stresschaos-memory.yaml` | `memory-oom` | Memory stress inside certification-service pods |
| `networkchaos-partition.yaml` | `network-partition` | Isolates notification-service |
| `iochaos-latency.yaml` | (bonus) | Adds network latency to course-service |
