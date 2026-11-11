#!/usr/bin/env node
/**
 * One command that runs the whole app:  npm run dev:all
 *
 * Why this exists: every /api call is proxied by Vite to http://localhost:3001,
 * so if the API process is missing the browser gets a bare 500 for *every*
 * data request and the UI looks broken for no visible reason. This script:
 *
 *   - reuses an API/Vite that is already listening instead of fighting over
 *     the port (a second Vite would silently move to 5174 while the proxy
 *     still targets 3001, which is its own confusing failure);
 *   - keeps the API alive: crashed children are restarted with backoff, and a
 *     supervisor loop brings the API back if whatever spawned it goes away;
 *   - prefixes both streams with [api] / [vite] so interleaved output stays
 *     readable.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT, 'server');

// Match server/index.js: an invalid/zero PORT (this environment exports
// PORT=0) must not send us probing a random port.
const envPort = Number.parseInt(process.env.PORT || '', 10);
const API_PORT = Number.isInteger(envPort) && envPort > 0 && envPort < 65536 ? envPort : 3001;
const VITE_PORT = 5173;

const SUPERVISOR_INTERVAL_MS = 5000;
const MAX_RESTARTS = 5;
const STABLE_MS = 30000;

let shuttingDown = false;
let apiChild = null;
let viteChild = null;
let apiRestarts = 0;
let apiLastCrashAt = 0;
let viteRestarts = 0;
let viteLastCrashAt = 0;
let apiStarting = false;

const log = (tag, message) => console.log(`[${tag}] ${message}`);

/**
 * Resolve with the first status code received across `urls`, or null if none
 * answered. Both address families are probed because services in this project
 * bind inconsistently — Vite listens on ::1 only, while the API binds the
 * IPv4/IPv6 wildcard — and a miss here would spawn a duplicate that grabs a
 * different port while the proxy still targets the original.
 */
function probeFirst(urls, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let pending = urls.length;
    let settled = false;
    const done = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    urls.forEach((url) => {
      let req;
      try {
        req = http.get(url, (res) => {
          res.resume();
          done(res.statusCode || null);
        });
      } catch {
        pending -= 1;
        if (pending <= 0) done(null);
        return;
      }
      const fail = () => {
        pending -= 1;
        if (pending <= 0) done(null);
      };
      req.on('error', fail);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        fail();
      });
    });
  });
}

const apiUrls = [
  `http://127.0.0.1:${API_PORT}/api/health`,
  `http://[::1]:${API_PORT}/api/health`,
];
const viteUrls = [
  `http://127.0.0.1:${VITE_PORT}/`,
  `http://[::1]:${VITE_PORT}/`,
];

function probeApi() {
  return probeFirst(apiUrls);
}

function pipe(child, tag) {
  const forward = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      lines.forEach((line) => out.write(`[${tag}] ${line}\n`));
    });
    stream.on('end', () => {
      if (buffer) out.write(`[${tag}] ${buffer}\n`);
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
}

/** Restart policy shared by both children: bounded, with a budget that refills
 *  once a child has stayed up for a while (so a stable day is never exhausted). */
function scheduleRestart(kind, code, signal, restart) {
  const now = Date.now();
  const last = kind === 'api' ? apiLastCrashAt : viteLastCrashAt;
  let budget = kind === 'api' ? apiRestarts : viteRestarts;
  if (now - last > STABLE_MS) budget = 0;
  budget += 1;
  if (kind === 'api') { apiRestarts = budget; apiLastCrashAt = now; } else { viteRestarts = budget; viteLastCrashAt = now; }

  if (budget > MAX_RESTARTS) {
    log(kind, `crashed ${budget} times — giving up. Run \`node index.js\` in server/ to see why.`);
    return;
  }
  const delay = Math.min(1000 * budget, 5000);
  log(kind, `exited (code ${code ?? 'null'}, signal ${signal ?? 'null'}) — restarting in ${delay}ms (attempt ${budget}/${MAX_RESTARTS})`);
  setTimeout(() => { if (!shuttingDown) restart(); }, delay);
}

function startApi() {
  if (apiChild || apiStarting || shuttingDown) return;
  apiStarting = true;
  const child = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_DIR,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  apiChild = child;
  apiStarting = false;
  pipe(child, 'api');
  child.on('error', (err) => {
    apiChild = null;
    log('api', `failed to start: ${err.message}`);
  });
  child.on('exit', (code, signal) => {
    if (apiChild === child) apiChild = null;
    if (shuttingDown) return;
    scheduleRestart('api', code, signal, startApi);
  });
}

function startVite() {
  if (viteChild || shuttingDown) return;
  const viteJs = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  let child;
  if (fs.existsSync(viteJs)) {
    child = spawn(process.execPath, [viteJs], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    // Fallback: let npm resolve the local binary. Use `dev:vite`, not `dev` —
    // `dev` runs this script, so spawning it here would loop forever.
    child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:vite'], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
  }
  viteChild = child;
  pipe(child, 'vite');
  child.on('error', (err) => {
    viteChild = null;
    log('vite', `failed to start: ${err.message}`);
  });
  child.on('exit', (code, signal) => {
    if (viteChild === child) viteChild = null;
    if (shuttingDown) return;
    scheduleRestart('vite', code, signal, startVite);
  });
}

/** Supervisor: make sure the API is reachable, whatever spawned it. */
async function ensureApi() {
  if (shuttingDown || apiChild || apiStarting) return;
  const status = await probeApi();
  if (status !== 200) {
    log('api', `not responding on :${API_PORT} — starting it`);
    startApi();
  }
}

async function main() {
  const [apiStatus, viteStatus] = await Promise.all([probeApi(), probeFirst(viteUrls)]);

  if (apiStatus !== null && apiStatus < 500) {
    log('api', `already running on :${API_PORT} — reusing it`);
  } else {
    log('api', `starting on :${API_PORT}`);
    startApi();
  }

  if (viteStatus !== null) {
    log('vite', `already running on :${VITE_PORT} — reusing it`);
  } else {
    log('vite', `starting on :${VITE_PORT}`);
    startVite();
  }

  log('dev', `app will be at http://localhost:${VITE_PORT}`);
  setInterval(ensureApi, SUPERVISOR_INTERVAL_MS);

  // Give the freshly spawned processes a moment, then report readiness.
  setTimeout(async () => {
    const ok = await probeApi();
    log('api', ok === 200 ? `ready at http://localhost:${API_PORT}` : 'not ready yet — the supervisor keeps retrying');
  }, 1500);
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('dev', `received ${signal} — stopping children`);
  [apiChild, viteChild].filter(Boolean).forEach((child) => {
    try { child.kill('SIGTERM'); } catch { /* already gone */ }
  });
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('[dev] failed to start:', err);
  process.exit(1);
});
