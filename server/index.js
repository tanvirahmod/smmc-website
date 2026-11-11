require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');

const app = express();

// Render (and most hosts) terminate TLS at a proxy in front of this process.
// Without this, req.ip is the proxy address, so every visitor would share one
// rate-limit bucket in server/lib/ratelimit.js.
app.set('trust proxy', 1);

// The Vite dev server proxies /api to http://localhost:3001, so the API must
// bind there. Guard against an invalid/zero PORT (e.g. PORT=0 in the shell
// environment), which would otherwise bind a random port and break the proxy.
const parsedPort = Number.parseInt(process.env.PORT || '', 10);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 3001;

/**
 * Browser origins allowed to call this API.
 *
 * Requests with no Origin header (curl, the Vite dev proxy, or a server that
 * also serves the SPA) are always allowed — CORS only governs cross-origin
 * browser reads. Override with a comma-separated ALLOWED_ORIGINS.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://sufiamotinmohilacollege.edu.bd',
  'https://www.sufiamotinmohilacollege.edu.bd',
];

const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      // Refused by omitting the CORS headers rather than throwing, so a
      // disallowed browser origin simply cannot read the response.
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-auth-token',
      // Legacy header credentials, still accepted while clients migrate.
      'x-auth-id',
      'x-auth-password',
      'x-auth-role',
    ],
    maxAge: 600,
  })
);
app.use(express.json({ limit: '10mb' }));

// Startup visibility: which origins this instance will serve.
console.log(`CORS allowlist (${allowedOrigins.length}): ${allowedOrigins.join(', ')}`);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Routes
const studentsRouter = require('./routes/students');
const teachersRouter = require('./routes/teachers');
const examsRouter = require('./routes/exams');
const noticesRouter = require('./routes/notices');
const authRouter = require('./routes/auth');
const departmentsRouter = require('./routes/departments');
const incourseRouter = require('./routes/incourse');

app.use('/api/students', studentsRouter);app.use('/api/teachers', teachersRouter);
app.use('/api/exams', examsRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/auth', authRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/incourse', incourseRouter);

// Unmatched /api paths must answer JSON, not the SPA: the client classifies a
// 5xx or HTML body as "API server did not respond", which would hide a plain
// wrong URL.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
});

/**
 * Serve the built SPA from the same origin as the API.
 *
 * In production `npm run build` writes dist/, so browser requests to `/api`
 * are same-origin: no CORS allowlist, no VITE_API_BASE, one Render service.
 * The API routes above always win; only non-API paths reach the SPA fallback.
 */
const DIST_DIR = path.join(__dirname, '..', 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

if (fs.existsSync(INDEX_HTML)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => res.sendFile(INDEX_HTML));
} else {
  console.warn(`WARNING: ${INDEX_HTML} not found — only the API is being served. Run \`npm run build\` first.`);
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: port ${PORT} is already in use. The Vite dev server proxies /api to this port, so stop the other process (or start this one with PORT=<free port> and update vite.config.ts).`);
    process.exit(1);
  }
  throw err;
});