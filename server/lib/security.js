'use strict';

/**
 * Response safety and caller authentication.
 *
 * Two rules are enforced here so no individual route has to remember them:
 *   1. A credential column (`password`) must never leave the server.
 *   2. An anonymous caller gets a public-only projection of staff records —
 *      never the full personnel file (NID, addresses, salary, education, ...).
 *
 * Authentication is resolved in this order:
 *   1. A signed session token (`Authorization: Bearer ...` or `x-auth-token`).
 *      This is the normal path; the browser never holds or resends a password.
 *   2. Credentials in request headers (`x-auth-id` / `x-auth-password`).
 *   3. Credentials in the request body (older clients and curl).
 *
 * (2) and (3) are a transitional shim kept so existing clients keep working.
 * They disappear once nothing calls the API with a raw password.
 */

const { verifyPassword, hashPassword, isHash } = require('./passwords');
const { verifyToken } = require('./tokens');

/** Column names that must never appear in an API response. */
const SECRET_FIELDS = ['password'];

/**
 * The only teacher fields an anonymous caller may see. These are exactly the
 * fields the public faculty and department pages render (name, role, subject,
 * contact details and photo). Everything else is staff-only.
 */
const PUBLIC_TEACHER_FIELDS = [
  'id',
  'teacher_id',
  'full_name',
  'designation',
  'subject',
  'program',
  'email',
  'mobile_number',
  'profile_pic_url',
  'is_principal',
  'joining_date',
];

/** Copies a row without the credential columns. */
function stripSecrets(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = { ...row };
  for (const field of SECRET_FIELDS) delete clean[field];
  return clean;
}

/** Copies an array of rows without the credential columns. */
function stripSecretsFrom(rows) {
  return Array.isArray(rows) ? rows.map(stripSecrets) : rows;
}

/** Reduces a teacher row to the public projection. */
function publicTeacher(row) {
  if (!row || typeof row !== 'object') return row;
  const clean = {};
  for (const field of PUBLIC_TEACHER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(row, field)) clean[field] = row[field];
  }
  return clean;
}

/** Reads a session token from either accepted header. */
function readToken(req) {
  const token = req.get('x-auth-token');
  if (token) return token.trim();

  const auth = (req.get('authorization') || '').trim();
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : null;
}

async function findTeacher(sql, teacherId) {
  if (!teacherId) return null;
  const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacherId}`;
  return rows[0] || null;
}

async function findStudent(sql, studentId) {
  if (!studentId) return null;
  const rows = await sql`SELECT * FROM students WHERE student_id = ${studentId}`;
  return rows[0] || null;
}

/**
 * Replaces a legacy plaintext password with a hash after a successful sign-in.
 * Best effort: a failure here must never block the sign-in itself.
 */
async function upgradeStoredPassword(sql, kind, id, plain) {
  try {
    const hash = hashPassword(plain);
    if (kind === 'teacher') {
      await sql`UPDATE teachers SET password = ${hash} WHERE teacher_id = ${id}`;
    } else {
      await sql`UPDATE students SET password = ${hash} WHERE student_id = ${id}`;
    }
    console.log(`[auth] upgraded stored password to a hash for ${kind} ${id}`);
  } catch (err) {
    console.error('[auth] password upgrade failed:', err.message);
  }
}

/**
 * Verifies a candidate against a stored row, upgrading legacy plaintext to a
 * hash on a successful match. Used by the sign-in routes.
 */
async function authenticateRow(sql, kind, row, id, candidate) {
  const result = verifyPassword(candidate, row.password);      if (!result) return false;
  if (result === 'match-legacy') {
    await upgradeStoredPassword(sql, kind, id, candidate);
  }
  return true;
}

function teacherCaller(teacher) {
  return {
    role: teacher.is_principal ? 'principal' : 'teacher',
    id: teacher.teacher_id,
    teacher,
    isTeacher: true,
    isPrincipal: !!teacher.is_principal,
  };
}

function studentCaller(student) {
  return {
    role: 'student',
    id: student.student_id,
    student,
    isTeacher: false,
    isPrincipal: false,
  };
}

/**
 * Resolves who is calling, or null when unauthenticated.
 * Returns `{ role, id, isPrincipal, isTeacher, teacher?, student? }`.
 */
async function resolveCaller(req, sql) {
  // 1. Session token.
  const token = readToken(req);
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      if (payload.role === 'student') {
        const student = await findStudent(sql, payload.sub);
        return student ? studentCaller(student) : null;
      }
      const teacher = await findTeacher(sql, payload.sub);
      return teacher ? teacherCaller(teacher) : null;
    }
    // An invalid/expired token is not a credential — fall through so the
    // legacy paths can still authenticate, and unauthenticated callers stay
    // unauthenticated rather than erroring out.
  }

  // 2. Credentials in headers.
  const headerId = String(req.get('x-auth-id') || '').trim();
  const headerPassword = String(req.get('x-auth-password') || '');
  const roleHint = String(req.get('x-auth-role') || '').trim().toLowerCase();

  if (headerId && headerPassword) {
    if (roleHint !== 'student') {
      const teacher = await findTeacher(sql, headerId);
      if (teacher && (await authenticateRow(sql, 'teacher', teacher, headerId, headerPassword))) {
        return teacherCaller(teacher);
      }
      if (roleHint === 'principal' || roleHint === 'teacher') return null;
    }
    const student = await findStudent(sql, headerId);
    if (student && (await authenticateRow(sql, 'student', student, headerId, headerPassword))) {
      return studentCaller(student);
    }
  }

  // 3. Credentials in the body (older clients).
  const body = req.body || {};
  const shapes = [
    { id: body.principalId, password: body.principalPassword, teacherOnly: true },
    { id: body.teacherId, password: body.teacherPassword, teacherOnly: true },
    { id: body.callerId, password: body.callerPassword, teacherOnly: false },
  ];

  for (const shape of shapes) {
    const id = String(shape.id || '').trim();
    const password = String(shape.password || '');
    if (!id || !password) continue;

    const teacher = await findTeacher(sql, id);
    if (teacher && (await authenticateRow(sql, 'teacher', teacher, id, password))) {
      return teacherCaller(teacher);
    }
    if (shape.teacherOnly) continue;      const student = await findStudent(sql, id);
    if (student && (await authenticateRow(sql, 'student', student, id, password))) {
      return studentCaller(student);
    }
  }

  return null;
}

/** The acting principal's row, or null. */
async function requirePrincipal(req, sql) {
  const caller = await resolveCaller(req, sql);
  return caller && caller.isPrincipal ? caller.teacher : null;
}

/** The acting teacher's row (principal included), or null. */
async function requireTeacher(req, sql) {
  const caller = await resolveCaller(req, sql);
  return caller && caller.isTeacher ? caller.teacher : null;
}

/** The acting caller in full, or null. */
async function requireCaller(req, sql) {
  return resolveCaller(req, sql);
}

/** True when the caller may read staff/student records. */
function isStaffCaller(caller) {
  return !!caller && (caller.isPrincipal || caller.isTeacher);
}

/** Standard 401 body for a guarded route. */
const UNAUTHORIZED = { error: 'Unauthorized' };

module.exports = {
  SECRET_FIELDS,
  PUBLIC_TEACHER_FIELDS,
  stripSecrets,
  stripSecretsFrom,
  publicTeacher,
  resolveCaller,
  authenticateRow,
  hashPassword,
  requirePrincipal,
  requireTeacher,
  requireCaller,
  isStaffCaller,
  UNAUTHORIZED,
};
