const { neon } = require('@neondatabase/serverless');

// Read the credential from the environment only. It must never carry a
// `VITE_` prefix: Vite inlines those into the client bundle, which would
// publish the database password to every visitor.
const connectionString = process.env.NEON_CONNECTION_STRING || '';

if (!connectionString) {
  console.error('ERROR: NEON_CONNECTION_STRING not set (add it to server/.env)');
  process.exit(1);
}

const raw = neon(connectionString);

/**
 * The Neon HTTP driver talks to the database over plain fetch, so a dropped
 * connection, DNS hiccup or brief network outage surfaces as
 * "Error connecting to database: TypeError: fetch failed" — which, relayed by
 * the route handlers' catch, reaches the UI as an unreadable 500.
 *
 * Reads are retried with backoff (idempotent, so retrying cannot duplicate
 * anything). Writes are attempted once: replaying an INSERT whose first
 * attempt may have landed is worse than an honest error. Every transient
 * failure is re-thrown with a message a person can act on.
 */
const RETRY_DELAYS_MS = [250, 750];

function isTransient(err) {
  const message = String((err && err.message) || '');
  return (
    /Error connecting to database/i.test(message) ||
    /\bfetch failed\b/i.test(message) ||
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ESOCKETTIMEDOUT|socket hang up/i.test(message)
  );
}

/** Only pure reads are retried: SELECT/WITH/SHOW/EXPLAIN/VALUES. */
function isReadOnly(sqlText) {
  return /^\s*(SELECT|WITH|SHOW|EXPLAIN|VALUES)/i.test(String(sqlText || ''));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function friendlyError(source) {
  const error = new Error(
    'Database temporarily unreachable — please try again in a moment. ' +
      '(If it keeps happening, check the network connection.)'
  );
  error.sourceError = source;
  return error;
}

async function withRetry(sqlText, run) {
  const attempts = isReadOnly(sqlText) ? 1 + RETRY_DELAYS_MS.length : 1;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || attempt === attempts) break;
      console.warn(
        `[db] transient failure on a read (attempt ${attempt}/${attempts}) — retrying in ${RETRY_DELAYS_MS[attempt - 1]}ms: ${err.message}`
      );
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
  }
  // Transient problems get the readable message; every other error (bad SQL,
  // constraint violation, ...) is re-thrown untouched so real bugs stay visible.
  if (isTransient(lastError)) throw friendlyError(lastError);
  throw lastError;
}

/**
 * Routes use `sql` as a tagged template *and* as sql.query(text, params), so
 * both shapes are wrapped. The template's SQL text is recovered from the
 * strings array purely to classify the statement as read or write.
 */
const sql = new Proxy(raw, {
  apply(target, thisArg, args) {
    const template = args[0];
    const text = template && typeof template === 'object' && Array.isArray(template)
      ? template.join('')
      : String(template || '');
    return withRetry(text, () => Reflect.apply(target, thisArg, args));
  },
  get(target, prop) {
    if (prop === 'query') {
      return (query, params) => withRetry(String(query || ''), () => target.query(query, params));
    }
    const value = Reflect.get(target, prop);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

module.exports = { sql };
