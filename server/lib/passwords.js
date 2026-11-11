'use strict';

/**
 * Password hashing, using Node's built-in scrypt so no new dependency is needed.
 *
 * Stored format: scrypt$<salt-hex>$<hash-hex>
 *
 * Existing rows hold plaintext. Rather than a risky bulk rewrite, verification
 * understands both forms: a plaintext match is reported as 'match-legacy' so the
 * caller can re-save it as a hash. The table converts itself as people sign in
 * and nobody is locked out.
 */

const crypto = require('node:crypto');

const PREFIX = 'scrypt';
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Hashes a plaintext password for storage. */
function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(plain), salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** True when the stored value is already a hash. */
function isHash(stored) {
  return typeof stored === 'string' && stored.startsWith(`${PREFIX}$`);
}

/** Length-safe comparison for the legacy plaintext path. */
function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left); // keep the work roughly constant
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

/**
 * Verifies a candidate password.
 * @returns {'match'|'match-legacy'|null} 'match-legacy' means the stored value
 *   was plaintext and should be replaced with hashPassword(candidate).
 */
function verifyPassword(candidate, stored) {
  if (typeof stored !== 'string' || stored.length === 0) return null;

  if (isHash(stored)) {
    const [, saltHex, hashHex] = stored.split('$');
    const expected = Buffer.from(hashHex || '', 'hex');
    if (!saltHex || expected.length === 0) return null;
    const derived = crypto.scryptSync(
      String(candidate),
      Buffer.from(saltHex, 'hex'),
      expected.length,
      SCRYPT_OPTIONS
    );
    return crypto.timingSafeEqual(derived, expected) ? 'match' : null;
  }

  return constantTimeEquals(candidate, stored) ? 'match-legacy' : null;
}

module.exports = { hashPassword, verifyPassword, isHash };
