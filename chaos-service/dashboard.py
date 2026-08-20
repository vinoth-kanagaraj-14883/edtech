"""Self-contained, live HTML dashboard for the chaos-service (no external assets).

The page is deliberately "active": it polls /status and the incremental /events
feed, ticks countdowns locally between polls, and exposes the engine controls
(auto mode, playbooks, per-scenario magnitude + duration) rather than being a
row of on/off buttons.

The template is assembled with token substitution rather than str.format() so
the embedded CSS and JavaScript braces do not need escaping.
"""

from __future__ import annotations

import html
import json
from typing import Any


def render_dashboard(scenarios: list[dict[str, Any]], playbooks: list[dict[str, Any]] | None = None) -> str:
    playbooks = playbooks or []
    return (
        _TEMPLATE
        .replace("__APP_CARDS__", _scenario_cards([s for s in scenarios if s["category"] == "application"]))
        .replace("__DOCKER_CARDS__", _scenario_cards([s for s in scenarios if s["category"] == "docker"]))
        .replace("__KUBE_CARDS__", _scenario_cards([s for s in scenarios if s["category"] == "kubernetes"]))
        .replace("__PLAYBOOK_CARDS__", _playbook_cards(playbooks))
        .replace("__SCENARIOS_JSON__", _json_for_script(scenarios))
        .replace("__PLAYBOOKS_JSON__", _json_for_script(playbooks))
    )


def _json_for_script(value: Any) -> str:
    """Embed JSON inside a <script> safely (no premature </script>, no HTML escaping)."""
    return json.dumps(value).replace("</", "<\\/")


def _playbook_cards(playbooks: list[dict[str, Any]]) -> str:
    if not playbooks:
        return '<p class="empty">No playbooks defined.</p>'
    out = []
    for p in playbooks:
        name = html.escape(p["name"])
        steps = "".join(
            f'<li><span class="step-dot" data-step="{i + 1}"></span>{html.escape(s["label"])}'
            f'<span class="step-hold">{s["holdSeconds"]}s</span></li>'
            for i, s in enumerate(p.get("steps", []))
        )
        out.append(
            f"""
        <div class="card playbook" id="pb-{name}">
          <div class="card-head">
            <div>
              <div class="title">{html.escape(p["title"])}</div>
              <code class="sid">{name} · ~{p["totalSeconds"]}s</code>
            </div>
            <span class="badge" id="pb-badge-{name}">idle</span>
          </div>
          <p class="desc">{html.escape(p["description"])}</p>
          <ol class="steps" id="pb-steps-{name}">{steps}</ol>
          <div class="meta shows"><b>What to watch:</b> {html.escape(p["whatToWatch"])}</div>
          <div class="actions">
            <button class="start" onclick="runPlaybook('{name}')">Run game day</button>
            <button class="stop" onclick="cancelPlaybook()">Cancel</button>
          </div>
        </div>"""
        )
    return "\n".join(out)


def _scenario_cards(scenarios: list[dict[str, Any]]) -> str:
    out = []
    for s in scenarios:
        name = html.escape(s["name"])
        mag = s.get("defaultMagnitude")
        unit = html.escape(str(s.get("magnitudeUnit") or ""))

        if mag:
            # Slider range scales with the default so each fault gets a sensible
            # dial: percentages cap at 100, everything else at 3x the default.
            is_pct = str(s.get("magnitudeUnit") or "").strip().startswith("%")
            max_v = 100 if is_pct else max(1, int(mag) * 3)
            step = 1 if is_pct or int(mag) <= 20 else 50
            control = f"""
          <div class="control">
            <label for="mag-{name}">Magnitude <span class="val" id="magval-{name}">{mag}</span>
              <span class="unit">{unit}</span></label>
            <input type="range" id="mag-{name}" min="1" max="{max_v}" step="{step}" value="{mag}"
                   oninput="document.getElementById('magval-{name}').textContent=this.value">
          </div>"""
        else:
            control = ""

        out.append(
            f"""
        <div class="card" id="card-{name}" data-category="{html.escape(s["category"])}">
          <div class="card-head">
            <div>
              <div class="title">{html.escape(s["title"])}</div>
              <code class="sid">{name}</code>
            </div>
            <span class="badge" id="badge-{name}">idle</span>
          </div>
          <p class="desc">{html.escape(s["description"])}</p>
          <div class="meta"><b>Target:</b> {html.escape(str(s.get("targetService", "")))}</div>
          <div class="meta"><b>Blast radius:</b> {html.escape(str(s.get("blastRadius", "")))}</div>
          <div class="meta shows"><b>Where it shows:</b> {html.escape(str(s.get("howItShows", "")))}</div>
          {control}
          <div class="control">
            <label for="dur-{name}">Run for <span class="val" id="durval-{name}">120</span><span class="unit">seconds (0 = until stopped)</span></label>
            <input type="range" id="dur-{name}" min="0" max="600" step="30" value="120"
                   oninput="document.getElementById('durval-{name}').textContent=this.value">
          </div>
          <div class="timer" id="timer-{name}"></div>
          <div class="actions">
            <button class="start" onclick="startScenario('{name}')">Inject</button>
            <button class="stop" onclick="stopScenario('{name}')">Stop</button>
          </div>
        </div>"""
        )
    return "\n".join(out)


_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>EduForge Chaos Control</title>
<style>
  :root {
    --bg:#0d1117; --panel:#161b22; --panel2:#1c2129; --border:#30363d; --text:#e6edf3;
    --muted:#8b949e; --accent:#f78166; --green:#3fb950; --red:#f85149;
    --blue:#58a6ff; --yellow:#d29922; --violet:#a371f7;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }

  header { position:sticky; top:0; z-index:20; padding:14px 28px; border-bottom:1px solid var(--border);
    background:rgba(13,17,23,.92); backdrop-filter:blur(8px);
    display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
  header h1 { margin:0; font-size:19px; }
  header .sub { color:var(--muted); font-size:12.5px; margin-top:3px; }
  .toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }

  button { cursor:pointer; border:1px solid var(--border); border-radius:6px;
    padding:7px 13px; font-size:13px; font-weight:600; color:var(--text); background:#21262d;
    transition:filter .15s, background .15s; }
  button.start { border-color:#238636; background:#238636; }
  button.stop { background:#21262d; }
  button.reset { border-color:var(--red); color:var(--red); background:transparent; }
  button.auto-on { border-color:var(--accent); background:var(--accent); color:#1b1005; }
  button:hover { filter:brightness(1.15); }
  select { background:#21262d; color:var(--text); border:1px solid var(--border);
    border-radius:6px; padding:7px 9px; font-size:13px; font-weight:600; }

  h2.section { padding:0 28px; margin:24px 0 6px; font-size:13px; letter-spacing:.07em;
    text-transform:uppercase; color:var(--muted); display:flex; align-items:center; gap:10px; }
  h2.section::after { content:''; flex:1; height:1px; background:var(--border); }

  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr));
    gap:14px; padding:8px 28px 18px; }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:10px; padding:15px;
    display:flex; flex-direction:column; transition:border-color .2s, box-shadow .2s; }
  .card.active { border-color:var(--accent); box-shadow:0 0 0 1px var(--accent), 0 6px 24px -8px rgba(247,129,102,.5); }
  .card.running { border-color:var(--violet); box-shadow:0 0 0 1px var(--violet); }
  .card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
  .title { font-weight:700; font-size:14.5px; }
  .sid { color:var(--muted); font-size:11px; }
  .desc { color:var(--text); font-size:12.5px; line-height:1.5; margin:9px 0; }
  .meta { font-size:11.5px; color:var(--muted); margin:3px 0; line-height:1.45; }
  .meta b { color:var(--text); }

  .badge { font-size:10.5px; padding:2px 9px; border-radius:20px; background:#21262d;
    color:var(--muted); border:1px solid var(--border); white-space:nowrap; }
  .badge.on { background:rgba(247,129,102,.18); color:var(--accent); border-color:var(--accent); }
  .badge.run { background:rgba(163,113,247,.18); color:var(--violet); border-color:var(--violet); }

  .control { margin-top:9px; }
  .control label { display:block; font-size:11px; color:var(--muted); margin-bottom:4px; }
  .control .val { color:var(--blue); font-weight:700; }
  .control .unit { margin-left:5px; }
  input[type=range] { width:100%; accent-color:var(--accent); height:18px; }

  .timer { font-size:11.5px; color:var(--accent); min-height:15px; margin-top:6px; font-variant-numeric:tabular-nums; }
  .actions { display:flex; gap:8px; margin-top:11px; }
  .actions button { flex:1; }

  ol.steps { margin:8px 0 4px; padding-left:0; list-style:none; }
  ol.steps li { font-size:12px; color:var(--muted); padding:4px 0; display:flex; align-items:center; gap:8px; }
  .step-dot { width:7px; height:7px; border-radius:50%; background:var(--border); flex:none; }
  ol.steps li.done .step-dot { background:var(--green); }
  ol.steps li.current .step-dot { background:var(--violet); box-shadow:0 0 0 3px rgba(163,113,247,.25); }
  ol.steps li.current { color:var(--text); font-weight:600; }
  .step-hold { margin-left:auto; font-size:10.5px; opacity:.7; }

  .layout { display:grid; grid-template-columns:1fr 380px; gap:0; align-items:start; }
  @media (max-width:1100px) { .layout { grid-template-columns:1fr; } }

  aside { position:sticky; top:64px; padding:14px 28px 40px 0; }
  @media (max-width:1100px) { aside { position:static; padding:0 28px 30px; } }
  .panel { background:var(--panel); border:1px solid var(--border); border-radius:10px; margin-bottom:14px; }
  .panel h3 { margin:0; padding:11px 14px; font-size:12px; text-transform:uppercase;
    letter-spacing:.06em; color:var(--muted); border-bottom:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between; }
  .panel .body { padding:12px 14px; }

  .stat-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .stat { background:var(--panel2); border:1px solid var(--border); border-radius:8px; padding:9px 11px; }
  .stat .n { font-size:20px; font-weight:800; font-variant-numeric:tabular-nums; }
  .stat .l { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin-top:1px; }
  .stat.hot .n { color:var(--accent); }

  #feed { max-height:340px; overflow-y:auto; padding:6px 0; }
  .ev { display:flex; gap:9px; padding:6px 14px; font-size:12px; line-height:1.45;
    border-left:2px solid transparent; animation:slidein .25s ease-out; }
  @keyframes slidein { from { opacity:0; transform:translateX(-6px);} to {opacity:1; transform:none;} }
  .ev .t { color:var(--muted); font-variant-numeric:tabular-nums; font-size:11px; flex:none; }
  .ev.started { border-left-color:var(--accent); }
  .ev.stopped { border-left-color:var(--muted); }
  .ev.expired { border-left-color:var(--blue); }
  .ev.auto    { border-left-color:var(--yellow); }
  .ev.playbook{ border-left-color:var(--violet); }
  .ev.error   { border-left-color:var(--red); color:var(--red); }
  .ev.info    { border-left-color:var(--green); }

  .blast { display:flex; flex-wrap:wrap; gap:6px; padding:2px 0; }
  .svc { font-size:11px; padding:3px 8px; border-radius:5px; background:var(--panel2);
    border:1px solid var(--border); color:var(--muted); transition:all .25s; }
  .svc.hit { background:rgba(248,81,73,.16); border-color:var(--red); color:#ffb4ae; font-weight:700; }

  .pill { display:inline-block; font-size:10.5px; padding:2px 8px; border-radius:12px; }
  .pill.up { background:rgba(63,185,80,.15); color:var(--green); }
  .pill.down { background:rgba(248,81,73,.15); color:var(--red); }

  .works { color:var(--green); text-transform:none; letter-spacing:0; font-weight:600; }
  .backend-note { margin:0 28px 6px; font-size:12px; color:var(--muted); }
  .backend-note.bad { color:var(--yellow); }
  /* Cards whose backend is unreachable stay visible but are clearly inert, so
     the catalogue still documents what exists in the other environment. */
  .card.disabled { opacity:.45; filter:grayscale(.7); }
  .card.disabled .actions button { pointer-events:none; }
  .empty { color:var(--muted); font-size:12px; padding:10px 14px; }
  #toast { position:fixed; bottom:18px; right:18px; background:var(--panel);
    border:1px solid var(--accent); border-radius:8px; padding:11px 15px; font-size:12.5px;
    max-width:420px; opacity:0; transform:translateY(8px); transition:.2s; pointer-events:none; z-index:50; }
  #toast.show { opacity:1; transform:translateY(0); }
  .dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--green);
    margin-right:6px; animation:pulse 1.6s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.25;} }
</style>
</head>
<body>
<header>
  <div>
    <h1>&#9889; EduForge Chaos Control</h1>
    <div class="sub">Inject faults, then find them in Jaeger / Prometheus / Grafana. Everything auto-expires.</div>
  </div>
  <div class="toolbar">
    <span id="docker-pill" class="pill down">docker: ?</span>
    <span id="kube-pill" class="pill down">kubernetes: ?</span>
    <select id="intensity" title="Auto-mode intensity">
      <option value="calm">calm</option>
      <option value="normal" selected>normal</option>
      <option value="aggressive">aggressive</option>
    </select>
    <button id="auto-btn" onclick="toggleAuto()">Auto mode: OFF</button>
    <button class="reset" onclick="resetAll()">Reset all</button>
  </div>
</header>

<div class="layout">
  <div>
    <h2 class="section">Game days &middot; multi-step incidents</h2>
    <div class="grid">__PLAYBOOK_CARDS__</div>

    <h2 class="section">Application scenarios &middot; via Redis chaos flags &middot; <span class="works">works everywhere</span></h2>
    <div class="grid">__APP_CARDS__</div>

    <h2 class="section">Docker scenarios &middot; via the Docker Engine API</h2>
    <div class="backend-note" id="docker-note"></div>
    <div class="grid">__DOCKER_CARDS__</div>

    <h2 class="section">Kubernetes scenarios &middot; via the Kubernetes API</h2>
    <div class="backend-note" id="kube-note"></div>
    <div class="grid">__KUBE_CARDS__</div>
  </div>

  <aside>
    <div class="panel">
      <h3>Live state</h3>
      <div class="body">
        <div class="stat-row">
          <div class="stat" id="stat-active"><div class="n">0</div><div class="l">Active faults</div></div>
          <div class="stat" id="stat-flags"><div class="n">0</div><div class="l">Redis flags</div></div>
        </div>
        <div style="margin-top:12px">
          <div class="l" style="font-size:10px;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:6px">Blast radius</div>
          <div class="blast" id="blast"></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3><span><span class="dot"></span>Event feed</span><span id="feed-count" style="font-size:10px">0</span></h3>
      <div id="feed"></div>
    </div>
  </aside>
</div>

<div id="toast"></div>

<script>
  const SCENARIOS = __SCENARIOS_JSON__;
  const PLAYBOOKS = __PLAYBOOKS_JSON__;
  const SERVICES = [...new Set(SCENARIOS.map(s => s.targetService).filter(Boolean))].sort();

  let lastSeq = 0;
  let autoOn = false;
  // name -> {remaining, at} so countdowns tick smoothly between polls.
  let timers = {};

  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(window._tt); window._tt = setTimeout(() => t.classList.remove('show'), 4200);
  }

  async function post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return r.json();
  }

  function num(id) {
    const el = document.getElementById(id);
    return el ? Number(el.value) : 0;
  }

  async function startScenario(name) {
    const body = { duration: num('dur-' + name) };
    const magEl = document.getElementById('mag-' + name);
    if (magEl) body.magnitude = Number(magEl.value);
    try {
      const d = await post('/scenarios/' + name + '/start', body);
      toast((d.ok ? '\\u2705 ' : '\\u26a0\\ufe0f ') + (d.message || name));
      refresh();
    } catch (e) { toast('Failed to start ' + name); }
  }

  async function stopScenario(name) {
    try {
      const d = await post('/scenarios/' + name + '/stop');
      toast('\\u23f9\\ufe0f ' + (d.message || name));
      refresh();
    } catch (e) { toast('Failed to stop ' + name); }
  }

  async function runPlaybook(name) {
    try {
      const d = await post('/playbooks/' + name + '/run');
      toast((d.ok ? '\\u25b6 ' : '\\u26a0\\ufe0f ') + (d.message || name));
      refresh();
    } catch (e) { toast('Failed to run ' + name); }
  }

  async function cancelPlaybook() {
    try { const d = await post('/playbooks/cancel'); toast('\\u23f9\\ufe0f ' + (d.message || '')); refresh(); }
    catch (e) { toast('Cancel failed'); }
  }

  async function toggleAuto() {
    try {
      if (autoOn) {
        const d = await post('/auto/stop');
        toast('\\u23f8\\ufe0f ' + (d.message || 'auto off'));
      } else {
        const intensity = document.getElementById('intensity').value;
        const d = await post('/auto/start', { intensity });
        toast('\\u267b\\ufe0f ' + (d.message || 'auto on'));
      }
      refresh();
    } catch (e) { toast('Auto mode toggle failed'); }
  }

  async function resetAll() {
    try { const d = await post('/reset'); toast('\\u267b\\ufe0f ' + (d.message || 'reset')); refresh(); }
    catch (e) { toast('Reset failed'); }
  }

  function fmt(sec) {
    if (sec == null) return '';
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? m + 'm ' + String(s).padStart(2, '0') + 's' : s + 's';
  }

  function renderEvents(events) {
    if (!events.length) return;
    const feed = document.getElementById('feed');
    for (const ev of events) {
      const div = document.createElement('div');
      div.className = 'ev ' + ev.kind;
      const time = new Date(ev.at * 1000).toLocaleTimeString();
      const t = document.createElement('span'); t.className = 't'; t.textContent = time;
      const m = document.createElement('span'); m.textContent = ev.message;
      div.appendChild(t); div.appendChild(m);
      feed.prepend(div);
      lastSeq = Math.max(lastSeq, ev.seq);
    }
    while (feed.childElementCount > 120) feed.removeChild(feed.lastChild);
    document.getElementById('feed-count').textContent = lastSeq;
  }

  async function pollEvents() {
    try {
      const r = await fetch('/events?after=' + lastSeq);
      const d = await r.json();
      renderEvents(d.events || []);
    } catch (e) { /* keep the page alive if the feed blips */ }
  }

  function renderBlast(activeTargets) {
    const el = document.getElementById('blast');
    if (!el.childElementCount) {
      for (const s of SERVICES) {
        const span = document.createElement('span');
        span.className = 'svc'; span.id = 'svc-' + s; span.textContent = s;
        el.appendChild(span);
      }
    }
    for (const s of SERVICES) {
      const node = document.getElementById('svc-' + s);
      if (node) node.classList.toggle('hit', activeTargets.has(s));
    }
  }

  async function refresh() {
    try {
      const r = await fetch('/status');
      const s = await r.json();
      const active = s.active || {};
      const names = new Set(Object.keys(active));

      timers = {};
      const targets = new Set();
      for (const [name, rec] of Object.entries(active)) {
        if (rec.target) targets.add(rec.target);
        if (rec.remainingSeconds != null) timers[name] = { left: rec.remainingSeconds, at: Date.now() };
      }

      SCENARIOS.forEach(sc => {
        const card = document.getElementById('card-' + sc.name);
        const badge = document.getElementById('badge-' + sc.name);
        if (!card || !badge) return;
        const on = names.has(sc.name);
        card.classList.toggle('active', on);
        badge.classList.toggle('on', on);
        if (!on) {
          badge.textContent = 'idle';
          const tEl = document.getElementById('timer-' + sc.name);
          if (tEl) tEl.textContent = '';
        } else {
          const rec = active[sc.name];
          badge.textContent = rec.magnitude != null ? ('active \\u00b7 ' + rec.magnitude) : 'active';
        }
      });

      // Playbook progress
      const pb = s.playbook || {};
      PLAYBOOKS.forEach(p => {
        const card = document.getElementById('pb-' + p.name);
        const badge = document.getElementById('pb-badge-' + p.name);
        if (!card || !badge) return;
        const running = pb.name === p.name;
        card.classList.toggle('running', running);
        badge.classList.toggle('run', running);
        badge.textContent = running ? ('step ' + pb.step + '/' + pb.totalSteps) : 'idle';
        const items = document.querySelectorAll('#pb-steps-' + p.name + ' li');
        items.forEach((li, i) => {
          li.classList.toggle('done', running && i + 1 < pb.step);
          li.classList.toggle('current', running && i + 1 === pb.step);
        });
      });

      // Auto mode
      autoOn = !!(s.auto && s.auto.enabled);
      const btn = document.getElementById('auto-btn');
      btn.textContent = 'Auto mode: ' + (autoOn ? 'ON' : 'OFF');
      btn.classList.toggle('auto-on', autoOn);
      if (s.auto && s.auto.intensity) document.getElementById('intensity').value = s.auto.intensity;

      // Stats + blast radius
      const flagCount = s.liveRedisFlags && !s.liveRedisFlags.error
        ? Object.keys(s.liveRedisFlags).length : 0;
      const statActive = document.getElementById('stat-active');
      statActive.querySelector('.n').textContent = names.size;
      statActive.classList.toggle('hot', names.size > 0);
      document.getElementById('stat-flags').querySelector('.n').textContent = flagCount;
      renderBlast(targets);

      // Backend availability: reflect it on the pills, the section notes, and by
      // visibly disabling scenarios that cannot run in this environment.
      const kubeOk = !!(s.kubernetes && s.kubernetes.available);
      const dockerOk = !!(s.docker && s.docker.available);

      const kp = document.getElementById('kube-pill');
      kp.className = 'pill ' + (kubeOk ? 'up' : 'down');
      kp.textContent = 'kubernetes: ' + (kubeOk ? 'connected' : 'unavailable');

      const dp = document.getElementById('docker-pill');
      if (dp) {
        dp.className = 'pill ' + (dockerOk ? 'up' : 'down');
        dp.textContent = 'docker: ' + (dockerOk ? 'connected' : 'unavailable');
      }

      const setNote = (id, ok, reason, hint) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.className = 'backend-note' + (ok ? '' : ' bad');
        el.textContent = ok ? reason : (reason + ' \\u2014 ' + hint);
      };
      setNote('docker-note', dockerOk,
        (s.docker && s.docker.reason) || 'docker backend',
        'mount /var/run/docker.sock into the chaos-service container to enable these');
      setNote('kube-note', kubeOk,
        (s.kubernetes && s.kubernetes.reason) || 'kubernetes backend',
        'these run only against a Kubernetes cluster');

      document.querySelectorAll('.card[data-category]').forEach((card) => {
        const cat = card.getAttribute('data-category');
        const usable = cat === 'application'
          || (cat === 'docker' && dockerOk)
          || (cat === 'kubernetes' && kubeOk);
        card.classList.toggle('disabled', !usable);
      });
    } catch (e) { /* transient */ }
  }

  // Tick countdowns locally so the UI feels live between polls.
  setInterval(() => {
    for (const [name, t] of Object.entries(timers)) {
      const el = document.getElementById('timer-' + name);
      if (!el) continue;
      const left = t.left - (Date.now() - t.at) / 1000;
      el.textContent = left > 0 ? ('\\u23f1 auto-clears in ' + fmt(left)) : '\\u23f1 clearing\\u2026';
    }
  }, 1000);

  refresh();
  pollEvents();
  setInterval(refresh, 3000);
  setInterval(pollEvents, 2000);
</script>
</body>
</html>"""
