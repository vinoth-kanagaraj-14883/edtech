"""Kubernetes-level chaos actions for the EduForge chaos-service.

Wraps the official Kubernetes Python client. Every action degrades gracefully:
if no in-cluster config and no kubeconfig are available, ``available`` is False
and each action returns a clear "kubernetes unavailable" result instead of
raising. Objects the controller creates (Jobs, NetworkPolicies) and mutations it
makes (deployment image patches) are tracked so ``stop``/``reset`` can revert
them.
"""

from __future__ import annotations

import time
from typing import Any

import structlog

logger = structlog.get_logger("chaos-service.k8s")

try:  # The client is optional at import time so the service still boots without it.
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
    _KUBERNETES_IMPORTED = True
except Exception:  # pragma: no cover - only when dependency missing
    client = None  # type: ignore
    config = None  # type: ignore
    ApiException = Exception  # type: ignore
    _KUBERNETES_IMPORTED = False


CHAOS_LABEL = "chaos.eduforge.io/experiment"


class KubeChaos:
    def __init__(self, namespace: str) -> None:
        self.namespace = namespace
        self.available = False
        self.reason = "kubernetes client library not installed"
        self._core = None
        self._apps = None
        self._net = None
        self._batch = None
        # Track state we must revert on stop/reset.
        self._created_jobs: set[str] = set()
        self._created_netpols: set[str] = set()
        self._patched_deploys: dict[str, str] = {}  # deployment -> original image
        self._load_config()

    def _load_config(self) -> None:
        if not _KUBERNETES_IMPORTED:
            return
        try:
            config.load_incluster_config()
            self._init_clients()
            self.available = True
            self.reason = "in-cluster config"
            logger.info("k8s_config_loaded", mode="in-cluster", namespace=self.namespace)
            return
        except Exception:
            pass
        try:
            config.load_kube_config()
            self._init_clients()
            self.available = True
            self.reason = "kubeconfig"
            logger.info("k8s_config_loaded", mode="kubeconfig", namespace=self.namespace)
        except Exception as exc:
            self.available = False
            self.reason = f"no cluster reachable: {exc}"
            logger.warning("k8s_unavailable", error=str(exc))

    def _init_clients(self) -> None:
        self._core = client.CoreV1Api()
        self._apps = client.AppsV1Api()
        self._net = client.NetworkingV1Api()
        self._batch = client.BatchV1Api()

    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "reason": self.reason,
            "namespace": self.namespace,
            "createdJobs": sorted(self._created_jobs),
            "createdNetworkPolicies": sorted(self._created_netpols),
            "patchedDeployments": dict(self._patched_deploys),
        }

    def _unavailable(self) -> dict[str, Any]:
        return {
            "ok": False,
            "available": False,
            "message": (
                "Kubernetes is not available to the chaos-service "
                f"({self.reason}). Run it in-cluster with RBAC, or use the "
                "application-level scenarios which need only Redis."
            ),
        }

    # ── Dispatch ─────────────────────────────────────────────────────────────
    def start(self, action: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        if not self.available:
            return self._unavailable()
        handler = getattr(self, f"_start_{action}", None)
        if handler is None:
            return {"ok": False, "message": f"unknown kubernetes action: {action}"}
        try:
            return handler(target, params)
        except ApiException as exc:
            logger.warning("k8s_action_failed", action=action, error=str(exc))
            return {"ok": False, "message": f"kubernetes API error: {exc.reason} ({exc.status})"}
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("k8s_action_error", action=action, error=str(exc))
            return {"ok": False, "message": str(exc)}

    def stop(self, action: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        if not self.available:
            return self._unavailable()
        handler = getattr(self, f"_stop_{action}", None)
        if handler is None:
            # Nothing to revert for one-shot actions (pod-kill).
            return {"ok": True, "message": f"no revert needed for {action}"}
        try:
            return handler(target, params)
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    # ── pod-kill (one-shot) ──────────────────────────────────────────────────
    def _start_pod_kill(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        pods = self._core.list_namespaced_pod(
            self.namespace, label_selector=f"app={target}"
        ).items
        running = [p for p in pods if p.status and p.status.phase == "Running"]
        if not running:
            return {"ok": False, "message": f"no running pods with app={target}"}
        victim = running[0]
        self._core.delete_namespaced_pod(victim.metadata.name, self.namespace)
        return {
            "ok": True,
            "message": f"deleted pod {victim.metadata.name} (app={target}); "
            "Kubernetes will reschedule it",
            "pod": victim.metadata.name,
        }

    # ── cpu-stress (Job) ─────────────────────────────────────────────────────
    def _start_cpu_stress(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        workers = int(params.get("workers", 2))
        duration = int(params.get("duration", 120))
        name = "chaos-cpu-stress"
        # busybox is tiny and always present; spin N shells doing integer math.
        script = (
            f"for i in $(seq 1 {workers}); do "
            "(while true; do :; done) & done; "
            f"sleep {duration}; kill 0"
        )
        self._create_stress_job(name, script, cpu_limit="1", mem_limit="64Mi")
        return {
            "ok": True,
            "message": f"launched CPU-stress Job {name} ({workers} workers, {duration}s)",
            "job": name,
        }

    # ── memory-oom (Job with a tight limit) ──────────────────────────────────
    def _start_memory_oom(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        limit_mb = int(params.get("limitMb", 64))
        name = "chaos-memory-oom"
        # Allocate a file in tmpfs (/dev/shm counts against the memory limit) far
        # bigger than the limit -> the container is OOMKilled.
        alloc_mb = limit_mb * 4
        script = f"dd if=/dev/zero of=/dev/shm/fill bs=1M count={alloc_mb}; sleep 3600"
        self._create_stress_job(
            name, script, cpu_limit="200m", mem_limit=f"{limit_mb}Mi", restart="OnFailure"
        )
        return {
            "ok": True,
            "message": f"launched OOM Job {name} (limit {limit_mb}Mi, allocates {alloc_mb}Mi)",
            "job": name,
        }

    def _create_stress_job(
        self,
        name: str,
        script: str,
        cpu_limit: str,
        mem_limit: str,
        restart: str = "Never",
    ) -> None:
        # Clean up any prior instance so re-running is idempotent.
        self._delete_job_if_exists(name)
        container = client.V1Container(
            name="stress",
            image="busybox:1.36",
            command=["/bin/sh", "-c", script],
            resources=client.V1ResourceRequirements(
                limits={"cpu": cpu_limit, "memory": mem_limit},
                requests={"cpu": "50m", "memory": "16Mi"},
            ),
        )
        template = client.V1PodTemplateSpec(
            metadata=client.V1ObjectMeta(labels={CHAOS_LABEL: name, "app": name}),
            spec=client.V1PodSpec(restart_policy=restart, containers=[container]),
        )
        job = client.V1Job(
            metadata=client.V1ObjectMeta(
                name=name, labels={CHAOS_LABEL: name}
            ),
            spec=client.V1JobSpec(
                template=template, backoff_limit=4, ttl_seconds_after_finished=600
            ),
        )
        self._batch.create_namespaced_job(self.namespace, job)
        self._created_jobs.add(name)

    def _stop_cpu_stress(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        return self._delete_tracked_job("chaos-cpu-stress")

    def _stop_memory_oom(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        return self._delete_tracked_job("chaos-memory-oom")

    def _delete_tracked_job(self, name: str) -> dict[str, Any]:
        self._delete_job_if_exists(name)
        self._created_jobs.discard(name)
        return {"ok": True, "message": f"deleted Job {name}"}

    def _delete_job_if_exists(self, name: str) -> None:
        try:
            self._batch.delete_namespaced_job(
                name, self.namespace, propagation_policy="Background"
            )
        except ApiException as exc:
            if exc.status != 404:
                raise

    # ── network-partition (NetworkPolicy) ────────────────────────────────────
    def _start_network_partition(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        name = f"chaos-deny-{target}"
        policy = client.V1NetworkPolicy(
            metadata=client.V1ObjectMeta(name=name, labels={CHAOS_LABEL: name}),
            spec=client.V1NetworkPolicySpec(
                pod_selector=client.V1LabelSelector(match_labels={"app": target}),
                policy_types=["Ingress", "Egress"],
                ingress=[],  # deny all ingress
                egress=[],   # deny all egress
            ),
        )
        # Replace if it already exists.
        try:
            self._net.create_namespaced_network_policy(self.namespace, policy)
        except ApiException as exc:
            if exc.status == 409:
                self._net.replace_namespaced_network_policy(name, self.namespace, policy)
            else:
                raise
        self._created_netpols.add(name)
        return {
            "ok": True,
            "message": f"isolated app={target} with deny-all NetworkPolicy {name}",
            "networkPolicy": name,
        }

    def _stop_network_partition(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        name = f"chaos-deny-{target}"
        try:
            self._net.delete_namespaced_network_policy(name, self.namespace)
        except ApiException as exc:
            if exc.status != 404:
                raise
        self._created_netpols.discard(name)
        return {"ok": True, "message": f"removed NetworkPolicy {name}; connectivity restored"}

    # ── bad-deploy (image patch) ─────────────────────────────────────────────
    def _start_bad_deploy(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        bad_image = params.get("image", f"{target}:chaos-nonexistent-tag")
        deploy = self._apps.read_namespaced_deployment(target, self.namespace)
        containers = deploy.spec.template.spec.containers
        if not containers:
            return {"ok": False, "message": f"deployment {target} has no containers"}
        original_image = containers[0].image
        # Only record the original once so repeated starts don't lose it.
        self._patched_deploys.setdefault(target, original_image)
        body = {
            "spec": {
                "template": {
                    "spec": {"containers": [{"name": containers[0].name, "image": bad_image}]}
                }
            }
        }
        self._apps.patch_namespaced_deployment(target, self.namespace, body)
        return {
            "ok": True,
            "message": f"patched deployment {target} to bad image {bad_image} "
            f"(was {original_image}); new pods will ImagePullBackOff",
            "deployment": target,
            "badImage": bad_image,
            "originalImage": original_image,
        }

    def _stop_bad_deploy(self, target: str, params: dict[str, Any]) -> dict[str, Any]:
        original = self._patched_deploys.get(target)
        if original is None:
            return {"ok": True, "message": f"no recorded original image for {target}"}
        deploy = self._apps.read_namespaced_deployment(target, self.namespace)
        container_name = deploy.spec.template.spec.containers[0].name
        body = {
            "spec": {
                "template": {
                    "spec": {"containers": [{"name": container_name, "image": original}]}
                }
            }
        }
        self._apps.patch_namespaced_deployment(target, self.namespace, body)
        self._patched_deploys.pop(target, None)
        return {"ok": True, "message": f"reverted deployment {target} to {original}"}

    # ── Global revert ────────────────────────────────────────────────────────
    def reset_all(self) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        if not self.available:
            return [self._unavailable()]
        for name in list(self._created_jobs):
            results.append(self._delete_tracked_job(name))
        for name in list(self._created_netpols):
            target = name.removeprefix("chaos-deny-")
            results.append(self._stop_network_partition(target, {}))
        for target in list(self._patched_deploys.keys()):
            results.append(self._stop_bad_deploy(target, {}))
        return results
