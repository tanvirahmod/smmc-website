'use strict';

/**
 * Login throttling, in memory (no dependency).
 *
 * Two buckets guard each sign-in attempt:
 *   - per client address, so one source cannot spray many accounts;
 *   - per account, so a single account cannot be hammered.
 *
 * Both are sliding windows of failures: a successful sign-in clears the account
 * bucket so a legitimate user is never locked out by their own typo streak.
 *
 * Note: the address is `req.ip` (the socket address unless Express is told to
 * trust a proxy). Behind a load balancer, set `app.set('trust proxy', 1)` so
 * every user does not share one bucket.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_ADDRESS = 20;
const MAX_FAILURES_PER_ACCOUNT = 10;

const buckets = new Map(); // key -> { count, resetAt }

function prune(now) {
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

function bucketKeys(req, accountId) {
  const address = (req.ip || req.socket?.remoteAddress || 'unknown').trim();
  const keys = [`ip:${address}`];
  if (accountId) keys.push(`acct:${String(accountId).trim().toLowerCase()}`);
  return keys;
}

/**
 * Call before verifying credentials.
 * @returns {{ allowed: boolean, retryAfterSeconds: number }}
 */
function checkLogin(req, accountId) {
  const now = Date.now();
  prune(now);

  let retryAfterSeconds = 0;
  for (const key of bucketKeys(req, accountId)) {
    const entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) continue;
    const max = key.startsWith('ip:') ? MAX_FAILURES_PER_ADDRESS : MAX_FAILURES_PER_ACCOUNT;
    if (entry.count >= max) {
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((entry.resetAt - now) / 1000));
    }
  }
  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

/** Call after a failed verification. */
function recordFailure(req, accountId) {
  const now = Date.now();
  for (const key of bucketKeys(req, accountId)) {
    const entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }
}

/** Call after a successful verification. */
function recordSuccess(req, accountId) {
  for (const key of bucketKeys(req, accountId)) {
    if (key.startsWith('acct:')) buckets.delete(key);
  }
}

/** Test seam: forget all recorded failures. */
function reset() {
  buckets.clear();
}

module.exports = { checkLogin, recordFailure, recordSuccess, reset, WINDOW_MS };
