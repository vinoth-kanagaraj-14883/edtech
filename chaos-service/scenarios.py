"""Chaos scenario registry for the EduForge chaos-service.

Two families of scenarios:

* ``application`` scenarios inject faults *inside* the target services by setting
  Redis chaos flags (the ``chaos:<kind>:<service>`` contract every EduForge
  service polls every 3 seconds). No Kubernetes access is needed — they work in
  Docker Compose and Kubernetes alike.

* ``kubernetes`` scenarios inject faults at the *platform* level (pod kills, CPU
  / memory stress, network isolation, bad rollouts) through the Kubernetes API.
  They require the chaos-service to run with a ServiceAccount that can manage
  pods / deployments / jobs / networkpolicies in the target namespace, and they
  no-op with a clear message when no cluster is reachable.

Each scenario documents ``how_it_shows`` — exactly what an operator should watch
for in Jaeger (traces / service map), Prometheus (RED metrics) and Grafana. That
is the whole point of the prototype: make a fault, then find it in the telemetry.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


# Default TTL (seconds) applied to every Redis chaos flag so a scenario can never
# be left running forever if a "stop" is missed. "start" re-arms it.
DEFAULT_FLAG_TTL_SECONDS = 600


@dataclass
class RedisFault:
    """A single Redis chaos flag written by an application scenario."""

    key: str
    value: str


@dataclass
class Scenario:
    name: str
    # "application" runs anywhere (Redis flags injected inside each service).
    # "docker" needs the Docker socket; "kubernetes" needs a cluster.
    category: str  # "application" | "docker" | "kubernetes"
    title: str
    description: str
    target_service: str
    blast_radius: str
    how_it_shows: str
    # Application scenarios: the Redis flags to set (with a magnitude default that
    # a start request may override via {"magnitude": N}).
    default_magnitude: int = 0
    magnitude_unit: str = ""
    build_faults: Any = None  # callable(magnitude) -> list[RedisFault]
    # Kubernetes scenarios: the handler key dispatched to k8s_chaos.
    kube_action: str = ""
    default_target_workload: str = ""
    # Docker scenarios: the handler key dispatched to docker_chaos.
    docker_action: str = ""

    def to_public(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "targetService": self.target_service,
            "blastRadius": self.blast_radius,
            "howItShows": self.how_it_shows,
            "defaultMagnitude": self.default_magnitude or None,
            "magnitudeUnit": self.magnitude_unit or None,
            "defaultTargetWorkload": self.default_target_workload or None,
        }


# ── Application scenarios (Redis chaos flags) ────────────────────────────────

def _latency(service: str):
    return lambda mag: [RedisFault(f"chaos:latency:{service}", str(mag))]


def _error(service: str):
    return lambda mag: [RedisFault(f"chaos:error:{service}", str(mag))]


def _cpu(service: str):
    return lambda mag: [RedisFault(f"chaos:cpu:{service}", str(mag))]


def _memleak(service: str):
    return lambda mag: [RedisFault(f"chaos:memleak:{service}", str(mag))]


APPLICATION_SCENARIOS = [
    Scenario(
        name="login-storm-latency",
        category="application",
        title="Login storm — auth latency",
        description=(
            "Slow every user-service request, as if the identity database were "
            "saturated during a morning login storm. Injected at the gateway hop "
            "so it degrades the very first step of every learner journey."
        ),
        target_service="user-service",
        blast_radius="All logins, registrations and profile reads.",
        how_it_shows=(
            "Jaeger: the api-gateway -> user-service span balloons and it becomes "
            "the critical path of every trace. Prometheus: user-service p99 and "
            "gateway p99 rise together. Grafana overview: auth latency panel "
            "breaches while other services stay flat — a clean 'one slow "
            "dependency drags the journey' story."
        ),
        default_magnitude=900,
        magnitude_unit="ms latency per request",
        build_faults=_latency("user-service"),
    ),
    Scenario(
        name="course-catalog-brownout",
        category="application",
        title="Course catalog brownout",
        description=(
            "Fail a share of course-service requests. course-service is the most "
            "fanned-in service in the platform (gateway, search, payment, "
            "certification all call it), so this exercises real blast radius."
        ),
        target_service="course-service",
        blast_radius=(
            "Course browsing, plus search / payment / certification which all "
            "depend on the catalog."
        ),
        how_it_shows=(
            "Jaeger service map: multiple callers light up red at once — the "
            "hallmark of a shared-dependency failure rather than a single broken "
            "endpoint. Prometheus: error_rate_5m spikes for course-service AND "
            "its callers. The api-gateway circuit breaker may trip after 5 "
            "consecutive failures, turning errors into fast-fail 503s."
        ),
        default_magnitude=40,
        magnitude_unit="% of requests failed",
        build_faults=_error("course-service"),
    ),
    Scenario(
        name="content-delivery-slowdown",
        category="application",
        title="Lesson content slowdown",
        description=(
            "Add latency inside content-service (self-injected via its own chaos "
            "hook), simulating slow object storage when learners open a lesson."
        ),
        target_service="content-service",
        blast_radius=(
            "Lesson/content reads, and course-tracking which calls content to "
            "count lessons for progress."
        ),
        how_it_shows=(
            "Jaeger: content-service server spans carry chaos.injected=latency, "
            "and the tracking-service -> content-service edge slows, delaying "
            "progress computation. Prometheus: content p99 climbs; tracking p99 "
            "follows a beat later — visible causal propagation."
        ),
        default_magnitude=700,
        magnitude_unit="ms latency per request",
        build_faults=_latency("content-service"),
    ),
    Scenario(
        name="quiz-grading-errors",
        category="application",
        title="Quiz grading errors",
        description=(
            "Fail a share of quiz-service requests so submissions break. Injected "
            "at the gateway hop (quiz-service is Ruby and has no in-service hook)."
        ),
        target_service="quiz-service",
        blast_radius="Quiz listing, submission and grading.",
        how_it_shows=(
            "Jaeger: quiz traces end in 503 and the downstream "
            "quiz-service -> notification-service edge stops appearing — you can "
            "watch an edge vanish from the dependency graph. Prometheus: quiz "
            "error rate spikes while notification traffic drops."
        ),
        default_magnitude=45,
        magnitude_unit="% of requests failed",
        build_faults=_error("quiz-service"),
    ),
    Scenario(
        name="notification-backpressure",
        category="application",
        title="Notification backpressure",
        description=(
            "Slow notification-service, the most fanned-out consumer in the "
            "platform (quiz, payment, tracking and certification all notify it)."
        ),
        target_service="notification-service",
        blast_radius=(
            "Every producer that emits a notification — quiz, payment, tracking, "
            "certification."
        ),
        how_it_shows=(
            "Jaeger: four different callers all show a slow "
            "-> notification-service child span in the same window. Because "
            "producers call it best-effort, the parent requests still succeed — "
            "a great demo of 'latency without errors' and why you need traces, "
            "not just status codes, to find it."
        ),
        default_magnitude=1200,
        magnitude_unit="ms latency per request",
        build_faults=_latency("notification-service"),
    ),
    Scenario(
        name="search-cache-miss-storm",
        category="application",
        title="Search cache-miss storm",
        description=(
            "Slow search-service so its Redis-cached fast path is overwhelmed and "
            "queries fall through to course-service."
        ),
        target_service="search-service",
        blast_radius="Course search for anonymous and signed-in visitors.",
        how_it_shows=(
            "Jaeger: search-service spans slow and the "
            "search-service -> course-service fallback edge gets busier. "
            "Prometheus: search_cache_events_total{result=\"miss\"} rises and "
            "search_query_duration_seconds widens by source label."
        ),
        default_magnitude=800,
        magnitude_unit="ms latency per request",
        build_faults=_latency("search-service"),
    ),
    Scenario(
        name="gateway-brownout",
        category="application",
        title="API gateway brownout",
        description=(
            "Degrade the api-gateway itself — every inbound request pays the "
            "penalty. The bluntest, most visible fault in the platform."
        ),
        target_service="api-gateway",
        blast_radius="Literally every request into the platform, all journeys.",
        how_it_shows=(
            "Jaeger: every trace, regardless of journey, starts with a slow or "
            "failed gateway span. Prometheus: api_gateway_http_request_duration_"
            "seconds shifts wholesale. Grafana SLO: error-budget burn rate "
            "spikes across the board — the 'is it one service or is it "
            "everything?' triage exercise."
        ),
        default_magnitude=600,
        magnitude_unit="ms latency per request",
        build_faults=_latency("api-gateway"),
    ),
    Scenario(
        name="payment-gateway-latency",
        category="application",
        title="Payment gateway latency",
        description=(
            "Inject request latency into payment-service to simulate a slow "
            "upstream payment provider during checkout."
        ),
        target_service="payment-service",
        blast_radius="Every checkout / enrollment that charges a card.",
        how_it_shows=(
            "Jaeger: payment-service server spans jump to ~800ms and the "
            "api-gateway -> payment-service edge turns slow. Prometheus: "
            "payment_service_http_request_duration_seconds p99 climbs. Grafana "
            "SLO panel for payment latency breaches."
        ),
        default_magnitude=800,
        magnitude_unit="ms latency per request",
        build_faults=_latency("payment-service"),
    ),
    Scenario(
        name="payment-gateway-down",
        category="application",
        title="Payment provider outage",
        description=(
            "Flip the payment-service mock PSP into a hard-outage state so every "
            "charge is declined (payment.received events stop flowing)."
        ),
        target_service="payment-service",
        blast_radius="All new paid enrollments fail; free content unaffected.",
        how_it_shows=(
            "Jaeger: payment-service traces end in errors and the "
            "payment-service -> notification-service edge disappears. Prometheus: "
            "payment_transactions_total{status=\"failed\"} spikes. Grafana error-"
            "rate panel for payment-service goes red."
        ),
        default_magnitude=1,
        magnitude_unit="flag (on)",
        build_faults=lambda mag: [RedisFault("chaos:payment-gateway:down", "1")],
    ),
    Scenario(
        name="certification-error-storm",
        category="application",
        title="Certification error storm",
        description=(
            "Make a percentage of certification-service requests fail with 503, "
            "as if the service were partially broken."
        ),
        target_service="certification-service",
        blast_radius="Course completions that try to mint a certificate.",
        how_it_shows=(
            "Jaeger: tracking-service -> certification-service spans show errors; "
            "error-tagged traces are filterable by chaos.injected=error. "
            "Prometheus: error_rate_5m for certification-service rises. Grafana "
            "overview error panel highlights certification-service."
        ),
        default_magnitude=50,
        magnitude_unit="% of requests failed",
        build_faults=_error("certification-service"),
    ),
    Scenario(
        name="tracking-cpu-saturation",
        category="application",
        title="Course-tracking CPU saturation",
        description=(
            "Spin busy-loop workers inside tracking-service to saturate CPU and "
            "degrade progress/completion processing."
        ),
        target_service="tracking-service",
        blast_radius="Lesson/quiz progress ingestion and completion detection.",
        how_it_shows=(
            "Jaeger: tracking-service span durations grow under load. Prometheus / "
            "Grafana: container CPU for tracking-service pegs near its limit, "
            "tracking latency histogram widens. Kubernetes HPA may scale it out."
        ),
        default_magnitude=4,
        magnitude_unit="busy-loop workers",
        build_faults=_cpu("tracking-service"),
    ),
    Scenario(
        name="certification-memory-leak",
        category="application",
        title="Certification memory leak",
        description=(
            "Leak memory continuously inside certification-service to reproduce a "
            "slow OOM / restart cycle."
        ),
        target_service="certification-service",
        blast_radius="certification-service pod memory; eventual OOM restart.",
        how_it_shows=(
            "Grafana / Prometheus: certification-service container RSS climbs "
            "steadily until the pod OOM-restarts (container_memory_working_set_"
            "bytes sawtooth, restart counter increments). Traces show a gap at "
            "the restart."
        ),
        default_magnitude=25,
        magnitude_unit="MB leaked per second",
        build_faults=_memleak("certification-service"),
    ),
]


# ── Kubernetes scenarios (platform faults via the k8s API) ───────────────────

KUBERNETES_SCENARIOS = [
    Scenario(
        name="pod-kill",
        category="kubernetes",
        title="Pod kill (self-healing test)",
        description=(
            "Delete a running pod of the target deployment to verify Kubernetes "
            "reschedules it and traffic recovers."
        ),
        target_service="api-gateway",
        blast_radius="One replica of the target workload; brief capacity dip.",
        how_it_shows=(
            "Grafana infra/k8s dashboard: pod restart count increments and a "
            "replica goes Not Ready then Ready. Prometheus: a short 5xx / "
            "connection-refused blip. Jaeger: a gap then recovery on that "
            "service's edges."
        ),
        kube_action="pod_kill",
        default_target_workload="api-gateway",
    ),
    Scenario(
        name="cpu-stress",
        category="kubernetes",
        title="Node/pod CPU stress",
        description=(
            "Launch a short-lived stress Job that pegs CPU, contending with app "
            "pods scheduled on the same node."
        ),
        target_service="cluster node",
        blast_radius="Pods co-scheduled on the stressed node.",
        how_it_shows=(
            "Grafana infra-nodes dashboard: node CPU saturation. Prometheus: "
            "latency histograms widen across co-located services. Jaeger: "
            "broad, correlated span slowdowns."
        ),
        kube_action="cpu_stress",
        default_target_workload="",
    ),
    Scenario(
        name="memory-oom",
        category="kubernetes",
        title="Memory pressure / OOMKill",
        description=(
            "Run a pod with a tight memory limit that allocates until the kernel "
            "OOM-kills it, exercising OOM handling and restarts."
        ),
        target_service="cluster node",
        blast_radius="The stress pod (self-contained); node memory pressure.",
        how_it_shows=(
            "Kubernetes: pod terminates with reason OOMKilled and restarts. "
            "Grafana: memory working-set sawtooth, restart counter. Prometheus "
            "kube_pod_container_status_restarts_total increments."
        ),
        kube_action="memory_oom",
        default_target_workload="",
    ),
    Scenario(
        name="network-partition",
        category="kubernetes",
        title="Network partition",
        description=(
            "Apply a deny-all NetworkPolicy that isolates the target service, "
            "cutting it off from callers and dependencies."
        ),
        target_service="notification-service",
        blast_radius="All traffic to/from the isolated service.",
        how_it_shows=(
            "Jaeger service map: edges into the isolated service break "
            "(connection timeouts). Prometheus: caller error_rate spikes, the "
            "service's own scrape target goes down. Grafana overview shows the "
            "service unreachable."
        ),
        kube_action="network_partition",
        default_target_workload="notification-service",
    ),
    Scenario(
        name="bad-deploy",
        category="kubernetes",
        title="Bad rollout (ImagePullBackOff)",
        description=(
            "Patch the target deployment to an invalid image tag to simulate a "
            "broken release; stop reverts to the previous image."
        ),
        target_service="course-service",
        blast_radius="New pods of the target workload fail to start.",
        how_it_shows=(
            "Kubernetes: new ReplicaSet stuck in ImagePullBackOff, rollout does "
            "not progress. Grafana k8s dashboard: unavailable replicas > 0. "
            "Prometheus: capacity/latency degrade if old pods are rolled."
        ),
        kube_action="bad_deploy",
        default_target_workload="course-service",
    ),
]


# ── Docker scenarios (Docker Engine API via the mounted socket) ──────────────
# These give Compose users the infrastructure-level half of the chaos catalogue
# that previously only existed for Kubernetes. They are genuinely different
# faults from the application scenarios: the application ones are injected
# *inside* a healthy process, whereas these attack the process and its network
# from the outside, so the failure modes callers observe are different.

DOCKER_SCENARIOS = [
    Scenario(
        name="docker-container-kill",
        category="docker",
        title="Container kill (crash + recover)",
        description=(
            "Restarts the container out from under live traffic — the Compose "
            "equivalent of a pod being killed and recreated."
        ),
        target_service="payment-service",
        blast_radius="the target service, plus anything mid-request through it",
        how_it_shows=(
            "In-flight requests fail immediately, then recover once the process is "
            "back and its DB pool has re-warmed. In Jaeger you get a cluster of "
            "connection-refused error spans followed by a burst of cold-start "
            "latency — the classic 'why is p99 spiky after a deploy?' shape."
        ),
        docker_action="container_kill",
    ),
    Scenario(
        name="docker-container-stop",
        category="docker",
        title="Container outage (hard down)",
        description=(
            "Stops the container and leaves it down until the scenario is stopped. "
            "Tests whether callers degrade gracefully or cascade."
        ),
        target_service="notification-service",
        blast_radius="the target service and every caller that does not degrade",
        how_it_shows=(
            "Callers get connection-refused fast. Watch whether the gateway's "
            "circuit breaker opens (good) or whether the failure propagates into "
            "user-facing 5xx (bad). The service disappears as a node in Jaeger's "
            "service map, which makes the dependency obvious."
        ),
        docker_action="container_stop",
    ),
    Scenario(
        name="docker-container-freeze",
        category="docker",
        title="Container freeze (SIGSTOP — hung process)",
        description=(
            "Pauses every process in the container. TCP still accepts, but nothing "
            "ever answers. This has no Kubernetes equivalent and is the most "
            "realistic fault in the catalogue."
        ),
        target_service="course-service",
        blast_radius="the target service and every caller without a sane timeout",
        how_it_shows=(
            "The nastiest failure mode there is: callers hang until their own "
            "timeout fires instead of failing fast, so connection pools and "
            "thread pools fill up and the outage spreads to services that are "
            "themselves perfectly healthy. This is what a GC death-spiral, a "
            "deadlock, or a frozen VM looks like from the outside — and it is "
            "exactly the case naive retry logic handles worst. Look for p99 "
            "pinned at the client timeout value rather than an error spike."
        ),
        docker_action="container_pause",
    ),
    Scenario(
        name="docker-cpu-throttle",
        category="docker",
        title="CPU starvation (cgroup quota)",
        description=(
            "Caps the container at a fraction of one CPU core using the real "
            "cgroup quota — not a busy-loop inside the app."
        ),
        target_service="course-service",
        blast_radius="the target service, worsening under concurrency",
        how_it_shows=(
            "Latency climbs non-linearly with load because requests queue for CPU. "
            "Unlike the in-app CPU scenario this throttles the whole container "
            "including the runtime and GC, so JVM/Node services degrade the way "
            "they do on an oversubscribed node."
        ),
        default_magnitude=10,
        magnitude_unit="% of one core",
        docker_action="cpu_throttle",
    ),
    Scenario(
        name="docker-memory-limit",
        category="docker",
        title="Memory limit (real OOM kill)",
        description=(
            "Lowers the container's memory limit so the kernel OOM-kills it under "
            "load. Swap is disabled so the limit actually bites."
        ),
        target_service="content-service",
        blast_radius="the target service; repeated kills look like a crash loop",
        how_it_shows=(
            "The container is killed by the kernel (exit 137) and restarted, "
            "repeatedly if traffic keeps up — a genuine crash loop rather than a "
            "simulated one. Compare with the in-app memleak scenario: that grows "
            "RSS gradually, this kills abruptly with no warning in the app logs."
        ),
        default_magnitude=96,
        magnitude_unit="MB",
        docker_action="memory_limit",
    ),
    Scenario(
        name="docker-network-partition",
        category="docker",
        title="Network partition (detach from network)",
        description=(
            "Disconnects the container from its Docker networks. The process stays "
            "alive and healthy but is unreachable — a true split-brain."
        ),
        target_service="quiz-service",
        blast_radius="the target service in both directions, including its DB and Redis",
        how_it_shows=(
            "Different from a stop: the process is still running and still thinks "
            "it is fine, but its own outbound calls fail too (DNS included). The "
            "service keeps reporting itself healthy internally while every caller "
            "times out — the hardest kind of outage to diagnose from logs alone, "
            "and the best argument for external black-box probing."
        ),
        docker_action="network_disconnect",
    ),
]

ALL_SCENARIOS = APPLICATION_SCENARIOS + DOCKER_SCENARIOS + KUBERNETES_SCENARIOS
SCENARIOS_BY_NAME = {s.name: s for s in ALL_SCENARIOS}


# ── Playbooks (game days) ────────────────────────────────────────────────────
# A playbook layers several faults in order, holding each one so the effects
# compound. This reproduces how real incidents actually unfold — one dependency
# degrades, its callers pile up, and the blast radius widens — instead of a
# single isolated fault. Every playbook clears all of its faults when it ends.

@dataclass
class PlaybookStep:
    scenario: str
    label: str
    hold_seconds: float
    magnitude: int = 0


@dataclass
class Playbook:
    name: str
    title: str
    description: str
    what_to_watch: str
    steps: list[PlaybookStep]

    @property
    def total_seconds(self) -> float:
        return sum(step.hold_seconds for step in self.steps)

    def to_public(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "whatToWatch": self.what_to_watch,
            "totalSeconds": int(self.total_seconds),
            "steps": [
                {
                    "scenario": s.scenario,
                    "label": s.label,
                    "holdSeconds": int(s.hold_seconds),
                    "magnitude": s.magnitude or None,
                }
                for s in self.steps
            ],
        }


PLAYBOOKS = [
    Playbook(
        name="cascading-failure",
        title="Cascading failure",
        description=(
            "A shared dependency degrades, its callers slow down waiting on it, "
            "and the pressure spreads outward until the gateway itself is hurting."
        ),
        what_to_watch=(
            "Watch the Jaeger service map light up one hop at a time: course-service "
            "first, then payment and certification (its callers), then the gateway. "
            "In Grafana the error-budget burn goes from one service to platform-wide — "
            "this is the classic 'is it one service or everything?' triage drill."
        ),
        steps=[
            PlaybookStep("course-catalog-brownout", "Course catalog starts failing", 45, 35),
            PlaybookStep("certification-error-storm", "Certification calls to course pile up", 45, 45),
            PlaybookStep("payment-gateway-latency", "Checkout slows waiting on the catalog", 45, 1200),
            PlaybookStep("gateway-brownout", "Gateway saturates — everything is affected", 45, 700),
        ],
    ),
    Playbook(
        name="checkout-meltdown",
        title="Checkout meltdown",
        description=(
            "Peak-traffic payment incident: the provider slows, then starts declining, "
            "and notifications back up behind it."
        ),
        what_to_watch=(
            "payment_transactions_total{status=\"failed\"} climbs while the "
            "payment-service -> notification-service edge thins out and finally "
            "disappears. A textbook revenue-impacting incident in the traces."
        ),
        steps=[
            PlaybookStep("payment-gateway-latency", "Provider latency creeps up", 40, 900),
            PlaybookStep("notification-backpressure", "Receipts queue behind slow notifications", 40, 1500),
            PlaybookStep("payment-gateway-down", "Provider hard-fails — checkout is down", 50),
        ],
    ),
    Playbook(
        name="learner-journey-degradation",
        title="Learner journey degradation",
        description=(
            "Walks the fault down the learner journey — sign-in, then browsing, then "
            "lesson content, then progress tracking — one step at a time."
        ),
        what_to_watch=(
            "Each step moves the fat span one hop further along the same trace. "
            "Great for showing how a single trace pinpoints which stage of a journey "
            "regressed, when the overall error rate barely moves."
        ),
        steps=[
            PlaybookStep("login-storm-latency", "Sign-in slows", 35, 700),
            PlaybookStep("content-delivery-slowdown", "Lesson content slows", 35, 800),
            PlaybookStep("tracking-cpu-saturation", "Progress tracking saturates CPU", 40, 4),
            PlaybookStep("certification-error-storm", "Certificates start failing", 40, 55),
        ],
    ),
    Playbook(
        name="silent-degradation",
        title="Silent degradation",
        description=(
            "Nothing errors — everything just gets slower. The hardest class of "
            "incident to catch with status-code monitoring alone."
        ),
        what_to_watch=(
            "Error rate stays flat and green the whole time while p99 latency climbs "
            "across four services. This is the case that proves why you need traces "
            "and percentile latency, not just uptime checks."
        ),
        steps=[
            PlaybookStep("notification-backpressure", "Notifications quietly slow", 40, 1400),
            PlaybookStep("search-cache-miss-storm", "Search falls through its cache", 40, 900),
            PlaybookStep("content-delivery-slowdown", "Content delivery drags", 40, 850),
            PlaybookStep("login-storm-latency", "Sign-in joins in", 40, 800),
        ],
    ),
]

PLAYBOOKS_BY_NAME = {p.name: p for p in PLAYBOOKS}
