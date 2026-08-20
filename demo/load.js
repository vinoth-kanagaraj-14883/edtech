// ---------------------------------------------------------------------------
// load.js  --  realistic weighted learner journey for the EduForge platform.
//
// Unlike the basic health-ping load script, this drives a believable
// multi-service user flow so Jaeger shows rich, fan-out traces:
//
//   register/login (user-service, Python)
//        -> list courses      (course-service, Java)
//        -> view content      (content-service, Node)
//        -> start quiz         (quiz-service, Ruby)
//        -> submit quiz        (quiz-service -> notification-service, Go)
//
// Every request flows through the api-gateway (Go), which propagates W3C
// trace context, so each iteration produces one connected distributed trace.
//
// Run:
//   k6 run demo/load.js
//   API_URL=http://localhost:8080 VUS=15 DURATION=3m k6 run demo/load.js
//
// Tunables (env):
//   API_URL   base gateway URL      (default http://localhost:8080)
//   VUS       virtual users         (default 10)
//   DURATION  test duration         (default 90s)
// ---------------------------------------------------------------------------
import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.API_URL || 'http://localhost:8080';
const errorRate = new Rate('journey_errors');

export const options = {
  scenarios: {
    learners: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '15s', target: Number(__ENV.VUS || 10) },       // ramp up
        { duration: __ENV.DURATION || '90s', target: Number(__ENV.VUS || 10) }, // steady
        { duration: '10s', target: 0 },                              // ramp down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // Loose thresholds -- during fault injection we EXPECT these to breach,
    // which is exactly the story we want to show in Grafana.
    http_req_duration: ['p(95)<3000'],
    journey_errors: ['rate<0.5'],
  },
};

function tag(name) {
  // Attach a k6 tag AND a request header the services can echo into spans.
  return { tags: { journey: name }, headers: { 'X-Demo-Journey': name } };
}

export default function () {
  let token = '';

  group('01_auth', function () {
    const email = `learner_${__VU}_${Math.floor(Math.random() * 1e6)}@demo.io`;
    // Must be `full_name` to satisfy user-service's UserCreate schema; `name`
    // yields a 422 and an empty token, which 401s the rest of the journey.
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

  group('02_browse_courses', function () {
    const r = http.get(`${BASE}/api/courses`, authOpts);
    check(r, { 'courses listed': (r) => r.status < 500 }) || errorRate.add(1);
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

  sleep(1 + Math.random());
}
