'use strict';

/**
 * The Express app, without any assumption about how it is hosted.
 *
 * Two entry points use it:
 *
 *   - server/index.js         a long-running Node process (`npm start`), which
 *                             also serves the built SPA from dist/.
 *   - netlify/functions/api.js  a serverless handler, where the SPA is served
 *                             separately as a static site.
 *
 * Keeping this side-effect free (no dotenv, no listen, no static files) is what
 * makes the same 52 routes work in both places.
 */

const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Browser origins allowed to call this API.
 *
 * Requests with no Origin header (curl, the Vite dev proxy, or a host that also
 * serves the SPA) are always allowed — CORS only governs cross-origin browser
 * reads. Override with a comma-separated ALLOWED_ORIGINS.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // Static frontend on Render (custom domain included below).
  'https://smmc-website.onrender.com',
  'https://sufiamotinmohilacollege.edu.bd',
  'https://www.sufiamotinmohilacollege.edu.bd',
];

/**
 * @param {{ spaDir?: string }} [options]
 *   spaDir: when given and it contains index.html, serve that build and fall
 *   back to index.html for client-side routes (single-service deployment).
 */
function createApp({ spaDir } = {}) {
  const app = express();

  // Every supported host (Render, Netlify, Fly, a VPS) terminates TLS at a
  // proxy. Without this, req.ip is the proxy address and every visitor shares
  // one rate-limit bucket in lib/ratelimit.js.
  app.set('trust proxy', 1);

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

  app.use('/api/students', studentsRouter);
  app.use('/api/teachers', teachersRouter);
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
   * Optional SPA hosting: production `npm run build` writes dist/, so browser
   * requests to `/api` are same-origin — no CORS allowlist, no VITE_API_BASE.
   * The API routes above always win; only non-API paths reach the fallback.
   */
  const indexHtml = spaDir ? path.join(spaDir, 'index.html') : null;
  if (indexHtml && fs.existsSync(indexHtml)) {
    app.use(express.static(spaDir));
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => res.sendFile(indexHtml));
  } else if (spaDir) {
    console.warn(`WARNING: ${indexHtml} not found — only the API is being served. Run \`npm run build\` first.`);
  }

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { createApp, DEFAULT_ALLOWED_ORIGINS };
