# site24x7/kubernetes/apm-agent/python/apm-snippet-user-service.py
#
# Site24x7 APM initialization for user-service (Python/FastAPI).
#
# USAGE:
#   1. Install: pip install site24x7-apm
#   2. Add this snippet at the top of user-service/main.py (before all other imports)
#   3. Set SITE24X7_APM_KEY env var via Kubernetes patch (see patch-examples/)
#
# The K8s patch in patch-examples/user-service-patch.yaml injects the required
# environment variables — no code changes are strictly necessary for basic monitoring.
# This snippet enables richer custom transaction tracking.

import os
import logging

logger = logging.getLogger(__name__)


def init_site24x7_apm():
    """Initialize Site24x7 APM for the user-service (FastAPI).

    Call this function at module level, before importing FastAPI or SQLAlchemy.
    Returns True if APM was initialized successfully, False otherwise.
    """
    apm_key = os.environ.get("SITE24X7_APM_KEY")
    if not apm_key:
        logger.info("[site24x7] SITE24X7_APM_KEY not set — APM disabled")
        return False

    try:
        import site24x7  # noqa: F401  # installed via requirements-site24x7.txt

        site24x7.init(
            license_key=apm_key,
            app_name=os.environ.get("SITE24X7_SERVICE_NAME", "edtech-user-service"),
            log_level=os.environ.get("SITE24X7_LOG_LEVEL", "info"),
            # APM collector endpoint (auto-detected when server agent is running)
            collector_host=os.environ.get(
                "SITE24X7_APM_ENDPOINT", "https://apmcollector.site24x7.com"
            ),
        )
        logger.info(
            "[site24x7] APM initialized for app=%s",
            os.environ.get("SITE24X7_SERVICE_NAME", "edtech-user-service"),
        )
        return True
    except ImportError:
        logger.warning(
            "[site24x7] site24x7-apm package not installed. "
            "Run: pip install site24x7-apm"
        )
        return False
    except Exception as exc:
        logger.error("[site24x7] APM initialization failed: %s", exc)
        return False


# ── Integration example for user-service/main.py ─────────────────────────────
#
# Place this block at the very top of main.py, before other imports:
#
#   from site24x7.apm_snippet_user_service import init_site24x7_apm
#   init_site24x7_apm()
#
#   from fastapi import FastAPI
#   # ... rest of imports
#
# FastAPI middleware auto-instrumentation (alternative to init above):
#
#   from fastapi import FastAPI
#   from site24x7.fastapi import Site24x7Middleware
#
#   app = FastAPI()
#   app.add_middleware(Site24x7Middleware, app_name="edtech-user-service")
#
# Custom transaction tracking example:
#
#   import site24x7
#
#   @app.post("/users/register")
#   async def register_user(user: UserCreate):
#       with site24x7.transaction("user.register"):
#           result = await user_service.create(user)
#           site24x7.add_attribute("user.id", result.id)
#           return result
