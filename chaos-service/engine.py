"""Active chaos engine for the EduForge chaos-service.

Everything here turns chaos from a set of manual on/off switches into something
that *runs on its own* and reports what it did:

* **Event log** — a bounded, timestamped ring buffer of everything the engine
  does (started / stopped / expired / auto-mode decisions / playbook steps).
  The dashboard streams this so an operator sees chaos happening live.
* **Timed experiments** — a scenario started with a ``duration`` is stopped
  automatically when it elapses, and the countdown is exposed to the UI. This
  is independent of the Redis TTL, which is only a fail-safe.
* **Auto mode (chaos monkey)** — a background loop that keeps picking random
  scenarios at a configurable intensity, runs each for a random window, then
  clears it. This is what makes the platform continuously "interesting" for an
  observability demo without anyone clicking anything.
* **Playbooks (game days)** — ordered, multi-step incidents (e.g. a cascading
  failure) that reproduce a realistic outage rather than a single fault.

The engine never talks to Redis or Kubernetes directly: ``main`` injects async
``starter``/``stopper`` callables, which keeps this module free of circular
imports and easy to reason about.
"""

from __future__ import annotations

import asyncio
import random
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

import structlog

logger = structlog.get_logger("chaos-service.engine")

EVENT_LOG_CAPACITY = 300

# Auto-mode intensity presets: (min_gap, max_gap, min_duration, max_duration,
# max_concurrent, magnitude_scale). Gaps/durations are seconds.
INTENSITY_PRESETS: dict[str, dict[str, Any]] = {
    "calm": {
        "gap": (75, 150),
        "duration": (45, 90),
        "max_concurrent": 1,
        "magnitude_scale": 0.6,
        "allow_infrastructure": False,
    },
    "normal": {
        "gap": (35, 80),
        "duration": (60, 120),
        "max_concurrent": 2,
        "magnitude_scale": 1.0,
        "allow_infrastructure": False,
    },
    "aggressive": {
        "gap": (15, 40),
        "duration": (75, 150),
        "max_concurrent": 3,
        "magnitude_scale": 1.6,
        "allow_infrastructure": False,
    },
}
DEFAULT_INTENSITY = "normal"


@dataclass
class ChaosEvent:
    seq: int
    at: float
    kind: str          # started | stopped | expired | auto | playbook | error | info
    scenario: str
    message: str
    detail: dict[str, Any] = field(default_factory=dict)

    def to_public(self) -> dict[str, Any]:
        return {
            "seq": self.seq,
            "at": self.at,
            "kind": self.kind,
            "scenario": self.scenario,
            "message": self.message,
            "detail": self.detail,
        }


class EventLog:
    """Bounded, monotonically-sequenced event buffer."""

    def __init__(self, capacity: int = EVENT_LOG_CAPACITY) -> None:
        self._events: deque[ChaosEvent] = deque(maxlen=capacity)
        self._seq = 0

    def record(
        self,
        kind: str,
        message: str,
        scenario: str = "",
        clock: float = 0.0,
        **detail: Any,
    ) -> ChaosEvent:
        self._seq += 1
        event = ChaosEvent(
            seq=self._seq,
            at=clock,
            kind=kind,
            scenario=scenario,
            message=message,
            detail=detail,
        )
        self._events.append(event)
        return event

    def since(self, after_seq: int = 0, limit: int = 100) -> list[dict[str, Any]]:
        items = [e.to_public() for e in self._events if e.seq > after_seq]
        return items[-limit:]

    @property
    def latest_seq(self) -> int:
        return self._seq


StarterFn = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]
StopperFn = Callable[[str, dict[str, Any]], Awaitable[dict[str, Any]]]


class ChaosEngine:
    def __init__(
        self,
        starter: StarterFn,
        stopper: StopperFn,
        clock: Callable[[], float],
    ) -> None:
        self._start = starter
        self._stop = stopper
        self._clock = clock
        self.events = EventLog()

        # name -> asyncio.Task that stops the scenario when its window elapses.
        self._expiry_tasks: dict[str, asyncio.Task] = {}
        # name -> unix timestamp at which it auto-stops (for UI countdowns).
        self.expires_at: dict[str, float] = {}

        self._auto_task: asyncio.Task | None = None
        self._auto_stop = asyncio.Event()
        self.auto_enabled = False
        self.auto_intensity = DEFAULT_INTENSITY
        self._auto_pool: list[Any] = []

        self._playbook_task: asyncio.Task | None = None
        self.playbook_state: dict[str, Any] = {}

    # ── Event helpers ────────────────────────────────────────────────────────
    def record(self, kind: str, message: str, scenario: str = "", **detail: Any) -> None:
        self.events.record(kind, message, scenario=scenario, clock=self._clock(), **detail)
        logger.info("chaos_event", kind=kind, scenario=scenario, message=message, **detail)

    # ── Timed experiments ────────────────────────────────────────────────────
    def schedule_expiry(self, name: str, duration: float) -> None:
        """Auto-stop `name` after `duration` seconds, replacing any prior timer."""
        self.cancel_expiry(name)
        if duration <= 0:
            return
        self.expires_at[name] = self._clock() + duration
        self._expiry_tasks[name] = asyncio.create_task(
            self._expire_after(name, duration), name=f"chaos-expire-{name}"
        )

    def cancel_expiry(self, name: str) -> None:
        task = self._expiry_tasks.pop(name, None)
        if task is not None and not task.done():
            task.cancel()
        self.expires_at.pop(name, None)

    async def _expire_after(self, name: str, duration: float) -> None:
        try:
            await asyncio.sleep(duration)
        except asyncio.CancelledError:
            return
        self.expires_at.pop(name, None)
        self._expiry_tasks.pop(name, None)
        try:
            await self._stop(name, {})
            self.record("expired", f"{name} reached the end of its window and was cleared", name)
        except Exception as exc:  # pragma: no cover - defensive
            self.record("error", f"failed to auto-stop {name}: {exc}", name)

    def remaining_seconds(self, name: str) -> float | None:
        deadline = self.expires_at.get(name)
        if deadline is None:
            return None
        return max(0.0, deadline - self._clock())

    # ── Auto mode (chaos monkey) ─────────────────────────────────────────────
    def configure_auto_pool(self, scenarios: list[Any]) -> None:
        self._auto_pool = scenarios

    async def start_auto(self, intensity: str, active_names: Callable[[], list[str]]) -> None:
        self.auto_intensity = intensity if intensity in INTENSITY_PRESETS else DEFAULT_INTENSITY
        if self.auto_enabled:
            self.record("auto", f"auto mode re-tuned to {self.auto_intensity}")
            return
        self.auto_enabled = True
        self._auto_stop.clear()
        self._auto_task = asyncio.create_task(
            self._auto_loop(active_names), name="chaos-auto-mode"
        )
        self.record("auto", f"auto mode ON at {self.auto_intensity} intensity")

    async def stop_auto(self) -> None:
        if not self.auto_enabled:
            return
        self.auto_enabled = False
        self._auto_stop.set()
        if self._auto_task is not None:
            self._auto_task.cancel()
            try:
                await self._auto_task
            except (asyncio.CancelledError, Exception):
                pass
            self._auto_task = None
        self.record("auto", "auto mode OFF")

    async def _auto_loop(self, active_names: Callable[[], list[str]]) -> None:
        """Pick a random scenario, run it for a window, clear it, repeat."""
        while not self._auto_stop.is_set():
            preset = INTENSITY_PRESETS[self.auto_intensity]
            gap = random.uniform(*preset["gap"])
            if await self._sleep_or_stop(gap):
                return

            running = active_names()
            if len(running) >= preset["max_concurrent"]:
                continue

            candidates = [
                s
                for s in self._auto_pool
                if s.name not in running
                and (preset["allow_infrastructure"] or s.category == "application")
            ]
            if not candidates:
                continue

            scenario = random.choice(candidates)
            duration = random.uniform(*preset["duration"])
            params: dict[str, Any] = {"duration": duration}

            # Vary the magnitude around the scenario default so successive runs
            # of the same fault do not look identical in the telemetry.
            if scenario.category == "application" and scenario.default_magnitude:
                scale = preset["magnitude_scale"] * random.uniform(0.65, 1.35)
                magnitude = max(1, int(scenario.default_magnitude * scale))
                if scenario.magnitude_unit.startswith("%"):
                    magnitude = min(95, magnitude)
                params["magnitude"] = magnitude

            try:
                await self._start(scenario.name, params)
                self.record(
                    "auto",
                    f"auto-injected {scenario.title} for {int(duration)}s",
                    scenario.name,
                    magnitude=params.get("magnitude"),
                    duration=int(duration),
                )
            except Exception as exc:  # pragma: no cover - defensive
                self.record("error", f"auto-injection failed for {scenario.name}: {exc}", scenario.name)

    async def _sleep_or_stop(self, seconds: float) -> bool:
        """Sleep unless auto mode is switched off; returns True if it stopped."""
        try:
            await asyncio.wait_for(self._auto_stop.wait(), timeout=seconds)
            return True
        except asyncio.TimeoutError:
            return False

    # ── Playbooks (game days) ────────────────────────────────────────────────
    def playbook_running(self) -> bool:
        return self._playbook_task is not None and not self._playbook_task.done()

    async def run_playbook(self, playbook: Any) -> None:
        if self.playbook_running():
            raise RuntimeError("a playbook is already running")
        self._playbook_task = asyncio.create_task(
            self._playbook_loop(playbook), name=f"chaos-playbook-{playbook.name}"
        )

    async def cancel_playbook(self) -> None:
        if self._playbook_task is not None and not self._playbook_task.done():
            self._playbook_task.cancel()
            try:
                await self._playbook_task
            except (asyncio.CancelledError, Exception):
                pass
        self._playbook_task = None
        if self.playbook_state:
            name = self.playbook_state.get("name", "playbook")
            self.playbook_state = {}
            self.record("playbook", f"{name} cancelled")

    async def _playbook_loop(self, playbook: Any) -> None:
        started: list[str] = []
        self.playbook_state = {
            "name": playbook.name,
            "title": playbook.title,
            "step": 0,
            "totalSteps": len(playbook.steps),
            "startedAt": self._clock(),
        }
        self.record("playbook", f"▶ {playbook.title} started ({len(playbook.steps)} steps)")
        try:
            for index, step in enumerate(playbook.steps, start=1):
                self.playbook_state["step"] = index
                self.playbook_state["currentStep"] = step.label
                params: dict[str, Any] = {}
                if step.magnitude:
                    params["magnitude"] = step.magnitude
                # The playbook stops everything at the end, so individual steps
                # stay active for the rest of the run (that is what builds a
                # realistic cascade).
                await self._start(step.scenario, params)
                started.append(step.scenario)
                self.record(
                    "playbook",
                    f"step {index}/{len(playbook.steps)}: {step.label}",
                    step.scenario,
                    magnitude=step.magnitude,
                )
                await asyncio.sleep(step.hold_seconds)

            self.record("playbook", f"✔ {playbook.title} complete — clearing all faults")
        except asyncio.CancelledError:
            self.record("playbook", f"{playbook.title} interrupted — clearing faults")
            raise
        finally:
            for name in reversed(started):
                try:
                    await self._stop(name, {})
                except Exception:
                    pass
            self.playbook_state = {}
            self._playbook_task = None

    # ── Shutdown ─────────────────────────────────────────────────────────────
    async def shutdown(self) -> None:
        await self.stop_auto()
        await self.cancel_playbook()
        for name in list(self._expiry_tasks):
            self.cancel_expiry(name)
