'use strict';

/**
 * Stateless session tokens: base64url(payload).HMAC-SHA256(payload).
 *
 * Signing uses SESSION_SECRET, which lives only in the server environment.
 * The payload is readable but not forgeable — it carries an id and a role, and
 * the server re-reads the account on every request so a role change or a
 * deletion takes effect immediately rather than at token expiry.
 */

const crypto = require('node:crypto');

const DEFAULT_TTL_SECONDS = 12 * 60 * 60; // 12 hours

function secret() {
  const value = process.env.SESSION_SECRET || '';
  if (!value) {
    throw new Error('SESSION_SECRET is not set (add it to server/.env)');
  }
  return value;
}

function sign(payloadPart) {
  return crypto.createHmac('sha256', secret()).update(payloadPart).digest('base64url');
}

/** Issues a token for an account id and role ('teacher', 'principal' or 'student'). */
function issueToken({ sub, role }, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const payload = {
    sub: String(sub),
    role: String(role),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/** Verifies signature and expiry. Returns the payload, or null. */
function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;

  const encoded = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(encoded);

  const providedBuf = Buffer.from(provided, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

module.exports = { issueToken, verifyToken, DEFAULT_TTL_SECONDS };
