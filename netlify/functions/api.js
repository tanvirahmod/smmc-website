'use strict';

/**
 * Serverless wrapper around the whole Express API.
 *
 * Netlify rewrites `/api/*` to this function (see netlify.toml), so the browser
 * keeps calling the same paths it always has — no route is duplicated here.
 * Functions scale to zero between requests instead of a server being stopped,
 * so the first request after a quiet period costs a few hundred milliseconds,
 * not a minute-long spin-up.
 *
 * This directory has its own package.json marking it CommonJS: a bundle emitted
 * as ESM turns Express's `require('http')` into "Dynamic require is not
 * supported" at runtime.
 *
 * Required environment variables (Netlify → Site settings → Environment):
 *   NEON_CONNECTION_STRING  database connection string
 *   SESSION_SECRET          signs session tokens (changing it signs everyone out)
 *   ALLOWED_ORIGINS         comma-separated browser origins, e.g.
 *                           https://sufiamotinmohilacollege.edu.bd
 */

const serverless = require('serverless-http');
// Static require so the bundler inlines server/app.js; the deployed bundle has
// no server/ directory to load from at runtime.
const { createApp } = require('../../server/app.js');

// One app instance per warm container, so route tables are built once.
const app = createApp();
const inner = serverless(app);

const FUNCTION_PREFIX = '/.netlify/functions/api';

/**
 * Netlify has already rewritten `/api/notices` to
 * `/.netlify/functions/api/notices` by the time the function runs, while the
 * Express routes are mounted under `/api`. Put the prefix back so one handler
 * serves every route without a second router.
 */
exports.handler = async (event, context) => {
  if (event && typeof event.path === 'string' && event.path.startsWith(FUNCTION_PREFIX)) {
    event.path = `/api${event.path.slice(FUNCTION_PREFIX.length)}`;
  }
  return inner(event, context);
};
