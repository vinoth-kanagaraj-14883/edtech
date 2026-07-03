// site24x7/kubernetes/apm-agent/nodejs/apm-snippet-content-service.js
//
// Site24x7 APM initialization for content-service (Node.js/TypeScript/Express).
//
// USAGE:
//   1. Install: npm install site24x7-apm
//   2. Add this as the FIRST line of your entry point (src/index.ts or src/server.ts)
//   3. Set SITE24X7_APM_KEY env var via Kubernetes patch (see patch-examples/)
//
// The K8s patch in patch-examples/content-service-patch.yaml injects the
// required environment variables. This snippet enables explicit initialization
// with custom configuration and error handling.

'use strict';

/**
 * Initialize Site24x7 APM for the content-service.
 * Must be called before requiring Express, mysql2, redis, or any other module.
 *
 * @returns {boolean} true if APM was initialized successfully
 */
function initSite24x7APM() {
  const apmKey = process.env.SITE24X7_APM_KEY;
  if (!apmKey) {
    console.log('[site24x7] SITE24X7_APM_KEY not set — APM disabled');
    return false;
  }

  const serviceName = process.env.SITE24X7_SERVICE_NAME || 'edtech-content-service';

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const site24x7 = require('site24x7-apm');

    site24x7.init({
      licenseKey: apmKey,
      appName: serviceName,
      logLevel: process.env.SITE24X7_LOG_LEVEL || 'info',
      collectorHost: process.env.SITE24X7_APM_ENDPOINT || 'https://apmcollector.site24x7.com',

      // Auto-instrumentation settings
      captureHeaders: true,
      captureQueryParams: true,
      captureBody: false, // Don't capture request bodies (privacy)

      // MySQL auto-instrumentation
      mysql: { enabled: true },

      // Redis auto-instrumentation
      redis: { enabled: true },

      // Outbound HTTP tracking
      http: { enabled: true },
    });

    console.log(`[site24x7] APM initialized for service=${serviceName}`);
    return true;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn(
        '[site24x7] site24x7-apm package not installed. Run: npm install site24x7-apm'
      );
    } else {
      console.error('[site24x7] APM initialization failed:', err.message);
    }
    return false;
  }
}

// Initialize APM immediately when this module is required.
// In TypeScript, import this module as the very first import:
//
//   import './site24x7-apm';  // or require('./site24x7-apm') as first line
//
initSite24x7APM();

// ── For Next.js (frontend) ────────────────────────────────────────────────────
// Add to next.config.js instrumentation hook:
//
//   // instrumentation.ts (Next.js 14 instrumentation file)
//   export async function register() {
//     if (process.env.NEXT_RUNTIME === 'nodejs') {
//       const { initSite24x7APM } = await import('./site24x7-apm');
//       initSite24x7APM();
//     }
//   }
//
// Or add to pages/_app.tsx for client-side monitoring (limited):
//   // Site24x7 browser agent is separate — see docs/apm-languages.md

module.exports = { initSite24x7APM };
