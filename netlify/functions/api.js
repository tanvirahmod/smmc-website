/**
 * Serverless wrapper around the whole Express API.
 *
 * Netlify rewrites `/api/*` to this function (see netlify.toml), so the browser
 * keeps calling the same paths it always has — no route is duplicated here.
 * Functions scale to zero between requests instead of a server being stopped,
 * so the first request after a quiet period costs a few hundred milliseconds,
 * not a minute-long spin-up.
 *
 * This file is ESM because the project root sets "type": "module". The API in
 * server/ is CommonJS (its own package.json), so it is loaded through
 * createRequire.
 *
 * Required environment variables (Netlify → Site settings → Environment):
 *   NEON_CONNECTION_STRING  database connection string
 *   SESSION_SECRET          signs session tokens (changing it signs everyone out)
 *   ALLOWED_ORIGINS         comma-separated browser origins, e.g.
 *                           https://sufiamotinmohilacollege.edu.bd
 */

import serverless from 'serverless-http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
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
export const handler = async (event, context) => {
  if (event && typeof event.path === 'string' && event.path.startsWith(FUNCTION_PREFIX)) {
    event.path = `/api${event.path.slice(FUNCTION_PREFIX.length)}`;
  }
  return inner(event, context);
};
