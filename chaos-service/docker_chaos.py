"""Docker-level chaos actions for the EduForge chaos-service.

The application-level scenarios (Redis chaos flags) already work identically
under Docker Compose and Kubernetes, because they are injected inside each
service. What was missing was *infrastructure* chaos on Compose: killing a
container, starving it of CPU, partitioning it off the network. Those existed
only as Kubernetes actions, so on a laptop running `docker compose up` half the
chaos catalogue was unusable.

This module closes that gap by talking to the Docker Engine API over the mounted
unix socket. It deliberately mirrors ``k8s_chaos.KubeChaos``:

* ``available`` / ``reason`` report whether the backend is usable, and every
  action degrades to a clear result instead of raising when it is not.
* Every mutation is tracked so ``stop`` and ``reset_all`` can revert it —
  including the original CPU/memory limits, which are read before being changed.

We use httpx with a unix-socket transport rather than the `docker` SDK to keep
the dependency footprint small (httpx is already used across the platform).

One capability here has no Kubernetes equivalent and is the most realistic fault
of the whole set: ``container_pause`` SIGSTOPs the process. TCP connections still
establish but nothing ever answers, so callers hang until their own timeout fires
instead of getting a fast connection-refused. That is what a GC death-spiral, a
deadlock, or a frozen VM actually looks like to its callers, and it is the case
naive retry logic handles worst.
"""

from __future__ import annotations

import json
import os
from typing import Any

import structlog

logger = structlog.get_logger("chaos-service.docker")

try:  # Optional at import time so the service still boots without httpx.
    import httpx
    _HTTPX_IMPORTED = True
except Exception:  # pragma: no cover - only when dependency missing
    httpx = None  # type: ignore
    _HTTPX_IMPORTED = False

DOCKER_SOCKET = "/var/run/docker.sock"
COMPOSE_SERVICE_LABEL = "com.docker.compose.service"
COMPOSE_PROJECT_LABEL = "com.docker.compose.project"
# Docker's default CPU scheduling period (microseconds). Quota is expressed
# against this: quota = period * cores.
CPU_PERIOD = 100_000


class DockerChaos:
    def __init__(self, socket_path: str = DOCKER_SOCKET, name_prefix: str = "edtech-") -> None:
        self.socket_path = socket_path
        self.name_prefix = name_prefix
        self.available = False
        self.reason = "httpx not installed"
        self._client: Any = None

        # Reversion state.
        self._stopped: set[str] = set()
        self._paused: set[str] = set()
        # container -> {"CpuQuota": int|None, "CpuPeriod": int|None, "Memory": int|None}
        self._original_limits: dict[str, dict[str, Any]] = {}
        # container -> [network ids it was disconnected from]
        self._disconnected: dict[str, list[str]] = {}
        # Cached host RAM, used when reverting a memory limit (see _restore_limits).
        self._host_mem_total: int = 0

        self._connect()

    # ── Setup ────────────────────────────────────────────────────────────────
    def _connect(self) -> None:
        if not _HTTPX_IMPORTED:
            return
        # Explicit opt-out: lets an operator mount the socket (or run on a host
        # where it exists) while still refusing to use it.
        if os.getenv("CHAOS_DISABLE_DOCKER", "").strip().lower() in {"1", "true", "yes"}:
            self.available = False
            self.reason = "disabled by CHAOS_DISABLE_DOCKER"
            logger.info("docker_disabled_by_env")
            return
        try:
            transport = httpx.HTTPTransport(uds=self.socket_path)
            self._client = httpx.Client(
                transport=transport, base_url="http://docker", timeout=10.0
            )
            response = self._client.get("/_ping")
            if response.status_code == 200:
                self.available = True
                version = self._client.get("/version").json()
                self.reason = f"docker engine {version.get('Version', 'unknown')} via {self.socket_path}"
                logger.info("docker_connected", reason=self.reason)
            else:
                self.reason = f"docker ping returned {response.status_code}"
        except Exception as exc:
            self.available = False
            self.reason = (
                f"docker socket unreachable at {self.socket_path}: {exc} "
                "(mount /var/run/docker.sock into the chaos-service container)"
            )
            logger.warning("docker_unavailable", error=str(exc))

    def _unavailable(self, action: str) -> dict[str, Any]:
        return {"ok": False, "action": action, "message": f"docker unavailable: {self.reason}"}

    # ── Target resolution ────────────────────────────────────────────────────
    def _resolve(self, target: str) -> dict[str, Any] | None:
        """Find a container for a logical service name.

        Tries the Compose service label first (most reliable), then the raw name
        and the `edtech-` prefixed name, so it works whether the stack was
        started by Compose or by hand.
        """
        try:
            response = self._client.get("/containers/json", params={"all": "1"})
            response.raise_for_status()
            containers = response.json()
        except Exception as exc:
            logger.warning("docker_list_failed", error=str(exc))
            return None

        wanted = {target, f"{self.name_prefix}{target}"}
        # Pass 1: compose service label.
        for c in containers:
            labels = c.get("Labels") or {}
            if labels.get(COMPOSE_SERVICE_LABEL) == target:
                return c
        # Pass 2: container names.
        for c in containers:
            names = {n.lstrip("/") for n in (c.get("Names") or [])}
            if names & wanted:
                return c
        return None

    def _container_id(self, target: str) -> tuple[str | None, dict[str, Any]]:
        container = self._resolve(target)
        if container is None:
            return None, {
                "ok": False,
                "message": f"no container found for '{target}' "
                f"(looked for compose service '{target}' and name '{self.name_prefix}{target}')",
            }
        return container.get("Id"), {}

    def _post(self, path: str, body: dict[str, Any] | None = None) -> tuple[bool, str]:
        try:
            response = self._client.post(
                path,
                content=json.dumps(body) if body is not None else None,
                headers={"Content-Type": "application/json"} if body is not None else None,
            )
            # 204 = success with no content, 304 = already in that state.
            if response.status_code in (200, 204, 304):
                return True, "ok"
            return False, f"docker returned {response.status_code}: {response.text[:200]}"
        except Exception as exc:
            return False, str(exc)

    # ── Actions ──────────────────────────────────────────────────────────────
    def start(self, action: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        if not self.available:
            return self._unavailable(action)

        container_id, error = self._container_id(target)
        if container_id is None:
            return {**error, "action": action}

        handler = {
            "container_kill": self._kill,
            "container_stop": self._stop_container,
            "container_pause": self._pause,
            "cpu_throttle": self._cpu_throttle,
            "memory_limit": self._memory_limit,
            "network_disconnect": self._network_disconnect,
        }.get(action)

        if handler is None:
            return {"ok": False, "action": action, "message": f"unknown docker action: {action}"}
        return handler(container_id, target, params)

    def stop(self, action: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        if not self.available:
            return self._unavailable(action)

        container_id, error = self._container_id(target)
        if container_id is None:
            return {**error, "action": action}

        handler = {
            # A kill is instantaneous and self-healing (the restart policy brings
            # it straight back), so there is nothing to undo.
            "container_kill": lambda cid, t: {"ok": True, "message": "nothing to revert for a kill"},
            "container_stop": self._start_container,
            "container_pause": self._unpause,
            "cpu_throttle": self._restore_limits,
            "memory_limit": self._restore_limits,
            "network_disconnect": self._network_reconnect,
        }.get(action)

        if handler is None:
            return {"ok": False, "action": action, "message": f"unknown docker action: {action}"}
        return handler(container_id, target)

    # -- kill / stop / pause --------------------------------------------------
    def _kill(self, cid: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        # `restart` rather than `kill` so the container comes back the way a
        # killed pod is recreated by its ReplicaSet, instead of leaving a hole
        # in the topology that only a manual `docker start` would fix.
        ok, message = self._post(f"/containers/{cid}/restart", None)
        return {
            "ok": ok,
            "action": "container_kill",
            "target": target,
            "message": f"restarted {target}" if ok else message,
        }

    def _stop_container(self, cid: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        ok, message = self._post(f"/containers/{cid}/stop?t=0", None)
        if ok:
            self._stopped.add(cid)
        return {
            "ok": ok,
            "action": "container_stop",
            "target": target,
            "message": f"stopped {target} — it stays down until this scenario is stopped" if ok else message,
        }

    def _start_container(self, cid: str, target: str) -> dict[str, Any]:
        ok, message = self._post(f"/containers/{cid}/start", None)
        self._stopped.discard(cid)
        return {"ok": ok, "target": target, "message": f"started {target}" if ok else message}

    def _pause(self, cid: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        ok, message = self._post(f"/containers/{cid}/pause", None)
        if ok:
            self._paused.add(cid)
        return {
            "ok": ok,
            "action": "container_pause",
            "target": target,
            "message": (
                f"froze {target} (SIGSTOP) — connections will hang, not refuse" if ok else message
            ),
        }

    def _unpause(self, cid: str, target: str) -> dict[str, Any]:
        ok, message = self._post(f"/containers/{cid}/unpause", None)
        self._paused.discard(cid)
        return {"ok": ok, "target": target, "message": f"unfroze {target}" if ok else message}

    # -- resource limits ------------------------------------------------------
    def _remember_limits(self, cid: str) -> None:
        if cid in self._original_limits:
            return
        try:
            host = self._client.get(f"/containers/{cid}/json").json().get("HostConfig", {})
            self._original_limits[cid] = {
                "CpuQuota": host.get("CpuQuota") or 0,
                "CpuPeriod": host.get("CpuPeriod") or 0,
                "Memory": host.get("Memory") or 0,
            }
        except Exception as exc:
            logger.warning("docker_inspect_failed", container=cid, error=str(exc))
            self._original_limits[cid] = {"CpuQuota": 0, "CpuPeriod": 0, "Memory": 0}

    def _cpu_throttle(self, cid: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        # magnitude = percent of ONE core the container may use (10 => 0.10 cores).
        percent = max(1, min(100, int(params.get("magnitude", 10))))
        self._remember_limits(cid)
        quota = int(CPU_PERIOD * percent / 100)
        ok, message = self._post(
            f"/containers/{cid}/update", {"CpuPeriod": CPU_PERIOD, "CpuQuota": quota}
        )
        return {
            "ok": ok,
            "action": "cpu_throttle",
            "target": target,
            "message": (
                f"capped {target} at {percent}% of one CPU core — latency should climb sharply"
                if ok
                else message
            ),
        }

    def _memory_limit(self, cid: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        megabytes = max(16, int(params.get("magnitude", 96)))
        self._remember_limits(cid)
        limit = megabytes * 1024 * 1024
        # MemorySwap == Memory disables swap, so the limit actually bites and the
        # kernel OOM-kills instead of silently swapping.
        ok, message = self._post(
            f"/containers/{cid}/update", {"Memory": limit, "MemorySwap": limit}
        )
        return {
            "ok": ok,
            "action": "memory_limit",
            "target": target,
            "message": (
                f"capped {target} at {megabytes}MB — expect an OOM kill under load"
                if ok
                else message
            ),
        }

    def _host_memory(self) -> int:
        """Total host RAM, used as the 'effectively unlimited' memory value."""
        if self._host_mem_total:
            return self._host_mem_total
        try:
            total = int(self._client.get("/info").json().get("MemTotal") or 0)
        except Exception:
            total = 0
        # Fall back to 8GiB if the daemon does not report it.
        self._host_mem_total = total or (8 * 1024 * 1024 * 1024)
        return self._host_mem_total

    def _restore_limits(self, cid: str, target: str) -> dict[str, Any]:
        original = self._original_limits.pop(cid, None)
        if original is None:
            return {"ok": True, "target": target, "message": "no limit change to revert"}

        original_cpu = original.get("CpuQuota") or 0
        original_mem = original.get("Memory") or 0

        # Docker's update API treats 0 as "unspecified", not "clear this", so
        # reverting must be done with the real sentinel values. Verified against
        # the Engine API on cgroup v2:
        #   CpuQuota: 0  -> silently ignored;  -1 -> correctly unlimited
        #   Memory:   0  -> silently ignored;  -1 -> HTTP 400 (min is 6MB)
        # There is therefore NO way to restore a truly unlimited memory limit on
        # a running container. We restore total host RAM instead, which is
        # functionally unlimited for these services, and say so in the message
        # rather than pretending the original state was recovered exactly.
        body: dict[str, Any] = {
            "CpuPeriod": original.get("CpuPeriod") or 0,
            "CpuQuota": original_cpu if original_cpu else -1,
        }
        mem_note = ""
        if original_mem:
            body["Memory"] = original_mem
            body["MemorySwap"] = original_mem
        else:
            effective = self._host_memory()
            body["Memory"] = effective
            body["MemorySwap"] = effective
            mem_note = (
                f"; memory restored to host total ({effective // (1024 * 1024)}MB) because "
                "Docker cannot unset a memory limit on a running container"
            )

        ok, message = self._post(f"/containers/{cid}/update", body)
        return {
            "ok": ok,
            "target": target,
            "message": (
                f"restored CPU/memory limits on {target}{mem_note}" if ok else message
            ),
        }

    # -- network partition ----------------------------------------------------
    def _networks_of(self, cid: str) -> list[str]:
        try:
            info = self._client.get(f"/containers/{cid}/json").json()
            return list((info.get("NetworkSettings", {}).get("Networks") or {}).keys())
        except Exception as exc:
            logger.warning("docker_networks_failed", container=cid, error=str(exc))
            return []

    def _network_disconnect(self, cid: str, target: str, params: dict[str, Any]) -> dict[str, Any]:
        networks = self._networks_of(cid)
        if not networks:
            return {"ok": False, "action": "network_disconnect", "target": target,
                    "message": f"{target} is not attached to any network"}
        detached: list[str] = []
        errors: list[str] = []
        for net in networks:
            ok, message = self._post(
                f"/networks/{net}/disconnect", {"Container": cid, "Force": True}
            )
            if ok:
                detached.append(net)
            else:
                errors.append(f"{net}: {message}")
        if detached:
            self._disconnected[cid] = detached
        return {
            "ok": bool(detached),
            "action": "network_disconnect",
            "target": target,
            "message": (
                f"cut {target} off {len(detached)} network(s) — callers see timeouts and DNS failures"
                if detached
                else "; ".join(errors)
            ),
        }

    def _network_reconnect(self, cid: str, target: str) -> dict[str, Any]:
        networks = self._disconnected.pop(cid, [])
        if not networks:
            return {"ok": True, "target": target, "message": "no network change to revert"}
        restored: list[str] = []
        for net in networks:
            ok, _ = self._post(f"/networks/{net}/connect", {"Container": cid})
            if ok:
                restored.append(net)
        return {
            "ok": bool(restored),
            "target": target,
            "message": f"reattached {target} to {len(restored)} network(s)",
        }

    # ── Introspection / cleanup ──────────────────────────────────────────────
    def status(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "reason": self.reason,
            "stoppedContainers": sorted(self._stopped),
            "pausedContainers": sorted(self._paused),
            "limitOverrides": sorted(self._original_limits),
            "disconnected": {k: v for k, v in self._disconnected.items()},
        }

    def list_targets(self) -> list[str]:
        """Compose service names the chaos-service can actually see."""
        if not self.available:
            return []
        try:
            containers = self._client.get("/containers/json", params={"all": "1"}).json()
        except Exception:
            return []
        names = set()
        for c in containers:
            label = (c.get("Labels") or {}).get(COMPOSE_SERVICE_LABEL)
            if label:
                names.add(label)
        return sorted(names)

    def reset_all(self) -> dict[str, Any]:
        """Undo everything this controller changed, best-effort."""
        if not self.available:
            return {"ok": False, "message": self.reason}
        results: list[str] = []
        for cid in list(self._paused):
            self._unpause(cid, cid[:12])
            results.append(f"unpaused {cid[:12]}")
        for cid in list(self._disconnected):
            self._network_reconnect(cid, cid[:12])
            results.append(f"reconnected {cid[:12]}")
        for cid in list(self._original_limits):
            self._restore_limits(cid, cid[:12])
            results.append(f"restored limits {cid[:12]}")
        # Start containers last so they come back with limits/networks already sane.
        for cid in list(self._stopped):
            self._start_container(cid, cid[:12])
            results.append(f"started {cid[:12]}")
        return {"ok": True, "reverted": results}

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass
