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

export default function () {
  let token = '';

  group('01_auth', function () {
    const email = `learner_${__VU}_${Math.floor(Math.random() * 1e6)}@demo.io`;
    const payload = JSON.stringify({ email, password: 'Demo!2345', name: 'Demo Learner' });
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
    try {
      const body = r.json();
      const list = (body && (body.courses || body.content || body.items)) || [];
      if (list.length) courseId = list[Math.floor(Math.random() * list.length)].id;
    } catch (_) { /* ignore during fault injection */ }
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
  }

  sleep(1 + Math.random());
}
