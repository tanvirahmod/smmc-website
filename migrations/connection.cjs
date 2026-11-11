'use strict';

/**
 * Loads the database connection string from the environment.
 *
 * The credential is deliberately NOT stored in source. Read it from
 * NEON_CONNECTION_STRING in the project-root .env or server/.env.
 *
 * Parsing is done inline (rather than with dotenv) so the migration scripts
 * stay runnable no matter which package the caller has installed.
 */

const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

/** Parses KEY=VALUE lines from an env file into `into` without overwriting. */
function loadEnvFile(file, into) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in into)) into[key] = value;
  }
}

/** Returns the connection string, or exits with a helpful message. */
function loadConnectionString() {
  const root = path.resolve(__dirname, '..');
  const fromFiles = {};
  // Project root first, then server/.env which holds the canonical name.
  loadEnvFile(path.join(root, '.env'), fromFiles);
  loadEnvFile(path.join(root, 'server', '.env'), fromFiles);

  const connectionString =
    process.env.NEON_CONNECTION_STRING || fromFiles.NEON_CONNECTION_STRING || '';

  if (!connectionString) {
    console.error(
      'ERROR: NEON_CONNECTION_STRING is not set.\n' +
        'Add it to .env in the project root or in server/.env, then re-run.'
    );
    process.exit(1);
  }
  return connectionString;
}

module.exports = { loadConnectionString, loadEnvFile };
