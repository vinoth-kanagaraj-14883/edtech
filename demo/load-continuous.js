// ---------------------------------------------------------------------------
// load-continuous.js  --  always-on variant of demo/load.js.
//
// This drives the SAME realistic multi-service learner journey as load.js
// (auth -> browse courses -> view content -> take quiz -> notifications) but
// is designed to run FOREVER at a constant virtual-user count. It exists so an
// always-on k6 container (see docker-compose.observability.yml) can keep the
// Jaeger service map, Prometheus RED metrics, and Grafana dashboards
// continuously populated with fresh distributed traces.
//
// Differences vs demo/load.js:
//   * constant-vus executor (no ramp up/down to 0) so the service map never
//     goes idle.
//   * duration defaults to a very long window (effectively infinite); the
//     container restart policy loops it indefinitely.
//   * no thresholds that would abort the run.
//
// Run standalone:
//   API_URL=http://localhost:8080 VUS=10 k6 run demo/load-continuous.js
//
// Tunables (env):
//   API_URL   base gateway URL   (default http://localhost:8080)
//   VUS       virtual users      (default 10)
//   DURATION  run window          (default 24h -- container restarts loop it)
// ---------------------------------------------------------------------------
import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.API_URL || 'http://localhost:8080';
const errorRate = new Rate('journey_errors');

export const options = {
  scenarios: {
    learners: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '24h',
    },
  },
  // No aborting thresholds: this run is meant to sustain indefinitely, even
  // while faults are injected during a demo.
};

function tag(name) {
  // Attach a k6 tag AND a request header the services can echo into spans.
  return { tags: { journey: name }, headers: { 'X-Demo-Journey': name } };
}

// The catalog response shape varies by which upstream answered (course-service
// returns a Spring page, search-service returns {courses}, and some paths return
// a bare array). Accept all of them — if this returns '' the enroll/track/certify
// journeys are skipped and their service-map edges never appear, which is a very
// confusing failure to debug from the Jaeger UI alone.
function extractCourseId(response) {
  try {
    const body = response.json();
    const list = Array.isArray(body)
      ? body
      : (body && (body.courses || body.content || body.items || body.data)) || [];
    if (!list.length) {
      return '';
    }
    const picked = list[Math.floor(Math.random() * list.length)];
    if (!picked) {
      return '';
    }
    // NOTE: deliberately not using `??` (nullish coalescing) here. k6 0.52's
    // bundled Babel transform does not support it, and because this script is
    // compiled at container start a syntax error does not fail a test — it makes
    // the load generator crash-loop silently, which starves every dashboard and
    // the Jaeger service map of traffic. Validate changes with
    // `k6 inspect demo/load-continuous.js`, not with `node --check`.
    const candidates = [picked.id, picked.courseId, picked._id, picked.slug];
    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null && candidate !== '') {
        return String(candidate);
      }
    }
    return '';
  } catch (_) {
    return ''; // body may be empty/HTML while faults are injected
  }
}

// Runs once, before any VU starts. The loadgen container only waits for the
// gateway to *start*, not to be ready (the gateway has no healthcheck to depend
// on), so without this the first few seconds of every run are connection
// failures — which pollute the error-rate panels and look like a real incident.
// Polling here keeps the dashboards honest and means the generator self-heals if
// the gateway is slow to come up or is restarted underneath it.
export function setup() {
  const deadline = Date.now() + 120000; // give the stack up to 2 minutes
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    const probe = http.get(`${BASE}/health`, {
      tags: { journey: 'startup_probe' },
      timeout: '5s'
    });
    if (probe.status > 0 && probe.status < 500) {
      console.log(`gateway reachable after ${attempt} probe(s) — starting load`);
      return { ready: true };
    }
    sleep(2);
  }
  // Do not throw: a hard failure here would abort the run and the container
  // would crash-loop. Better to start generating traffic and let the resulting
  // errors show up as real signal on the dashboards.
  console.warn('gateway never became reachable — starting anyway');
  return { ready: false };
}

export default function () {
  let token = '';

  group('01_auth', function () {
    const email = `learner_${__VU}_${Math.floor(Math.random() * 1e6)}@demo.io`;
    // user-service's UserCreate schema requires `full_name` (min_length=1).
    // Sending `name` instead makes /auth/register return 422, which leaves the
    // token empty and then 401s every authenticated call downstream — the whole
    // journey silently collapses to auth-only traffic. Keep this field name in
    // sync with user-service/schemas.py.
    const payload = JSON.stringify({ email, password: 'Demo!2345', full_name: 'Demo Learner' });
    const opts = tag('auth');
    opts.headers['Content-Type'] = 'application/json';

    // Register (best-effort) then login.
    http.post(`${BASE}/api/auth/register`, payload, opts);
    const login = http.post(`${BASE}/api/auth/login`,
      JSON.stringify({ email, password: 'Demo!2345' }), opts);
    check(login, { 'login responded': (r) => r.status !== 0 }) || errorRate.add(1);
    try {
      const body = login.json();
      token = (body && (body.access_token || body.token)) || '';
    } catch (_) { /* ignore parse errors during fault injection */ }
  });

  const authOpts = tag('browse');
  if (token) authOpts.headers['Authorization'] = `Bearer ${token}`;

  // Authenticated JSON opts for POSTs that need the bearer token + a body.
  function authJson(name) {
    const o = tag(name);
    o.headers['Content-Type'] = 'application/json';
    if (token) o.headers['Authorization'] = `Bearer ${token}`;
    return o;
  }

  let courseId = '';

  group('02_browse_courses', function () {
    const r = http.get(`${BASE}/api/courses`, authOpts);
    check(r, { 'courses listed': (r) => r.status < 500 }) || errorRate.add(1);
    courseId = extractCourseId(r);
    sleep(Math.random() * 1.5);
  });

  group('03_view_content', function () {
    const r = http.get(`${BASE}/api/content`, tag('content'));
    check(r, { 'content ok': (r) => r.status < 500 }) || errorRate.add(1);
    http.get(`${BASE}/api/lessons`, tag('content'));
    sleep(Math.random() * 1.5);
  });

  group('04_take_quiz', function () {
    const r = http.get(`${BASE}/api/quizzes`, tag('quiz'));
    check(r, { 'quiz list ok': (r) => r.status < 500 }) || errorRate.add(1);
    // Submitting a quiz typically fans out to notification-service.
    const submit = http.post(`${BASE}/api/quizzes`,
      JSON.stringify({ quiz_id: 1, answers: [1, 2, 3] }),
      Object.assign(tag('quiz'), { headers: Object.assign(tag('quiz').headers, { 'Content-Type': 'application/json' }) }));
    check(submit, { 'quiz submit handled': (r) => r.status !== 0 }) || errorRate.add(1);
  });

  group('05_notifications', function () {
    const r = http.get(`${BASE}/api/notifications`, tag('notify'));
    check(r, { 'notifications ok': (r) => r.status < 500 }) || errorRate.add(1);
  });

  // 06 -> 08 exercise the revamped services so their service-map edges stay
  // populated: payment-service (-> course, notification), tracking-service
  // (-> content, certification, notification) and certification-service
  // (-> user, course, notification). Only runs when a course id was discovered.
  if (token && courseId) {
    group('06_enroll_pay', function () {
      const pay = http.post(`${BASE}/api/payments`,
        JSON.stringify({ courseId, amount: 49.99, currency: 'USD', method: 'card' }),
        authJson('payment'));
      check(pay, { 'payment handled': (r) => r.status !== 0 }) || errorRate.add(1);
      sleep(Math.random());
    });

    group('07_track_progress', function () {
      // A couple of lesson completions feed progress + completion detection.
      for (let i = 0; i < 2; i++) {
        http.post(`${BASE}/api/tracking/events`,
          JSON.stringify({ courseId, type: 'lesson_completed', refId: `lesson-${i}` }),
          authJson('tracking'));
      }
      const prog = http.get(`${BASE}/api/tracking/users/me/courses/${courseId}`, tag('tracking'));
      check(prog, { 'progress ok': (r) => r.status < 500 }) || errorRate.add(1);
    });

    group('08_certificate', function () {
      const cert = http.post(`${BASE}/api/certificates`,
        JSON.stringify({ courseId }), authJson('certificate'));
      check(cert, { 'certificate handled': (r) => r.status !== 0 }) || errorRate.add(1);
    });
  } else {
    // Fallback: we could not drive a full enrollment (no token, or the catalog
    // was empty / failing). Still exercise the read paths of the revamped
    // services so they keep appearing as nodes in the Jaeger service map and
    // keep reporting RED metrics, instead of silently vanishing from the graph.
    group('06_08_read_only_fallback', function () {
      http.get(`${BASE}/api/payments`, tag('payment'));
      http.get(`${BASE}/api/tracking/users/me`, tag('tracking'));
      http.get(`${BASE}/api/certificates`, tag('certificate'));
    });
  }

  sleep(1 + Math.random());
}
