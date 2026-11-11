const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const {
  publicTeacher,
  stripSecretsFrom,
  resolveCaller,
  requirePrincipal,
  requireTeacher,
  authenticateRow,
  hashPassword,
} = require('../lib/security');
const { issueToken, DEFAULT_TTL_SECONDS } = require('../lib/tokens');
const { checkLogin, recordFailure, recordSuccess } = require('../lib/ratelimit');

const ALLOWED_TEACHER_FIELDS = [
  'full_name', 'fathers_name', 'mothers_name', 'dob',
  'mobile_number', 'email', 'tmis_no', 'ttis_no',
  'current_address', 'permanent_address', 'nid_number', 'blood_group', 'gender', 'religion',
  'joining_date', 'appointment_date', 'designation', 'subject', 'program',
  'employment_type', 'appointment_type', 'pending_lawsuits', 'seniority_priority',
  'mpo_date', 'index_number', 'salary_grade', 'basic_scale', 'training_names',
  'education_ssc', 'education_hsc', 'education_honours', 'education_masters',
  'edu_ssc_year', 'edu_ssc_board', 'edu_ssc_result',
  'edu_hsc_year', 'edu_hsc_board', 'edu_hsc_result',
  'edu_honours_year', 'edu_honours_board', 'edu_honours_result',
  'edu_masters_year', 'edu_masters_board', 'edu_masters_result',
  'profile_pic_url', 'password'
];

const DATE_COLUMNS = ['dob', 'joining_date', 'appointment_date', 'mpo_date'];

// Teacher subject master for bulk import (must match src/lib/subjects.ts ALL_SUBJECTS).
const KNOWN_TEACHER_SUBJECTS = [
  'Bangla', 'English', 'ICT', 'Civics', 'Sociology',
  'Islamic History and Culture', 'Logic', 'Economics', 'Islamic Studies',
  'Physics', 'Chemistry', 'Biology', 'Accounting',
  'Business Organization and Management', 'Production Management and Marketing',
  'Political Science', 'Philosophy', 'Higher Math',
];

const VALID_TEACHER_PROGRAMS = ['HSC', 'Honours', 'Degree'];

// GET /api/teachers - list all teachers.
// Anonymous callers (the public faculty and department pages) receive the
// public projection only. A signed-in principal receives the full staff record
// so the management screens keep working. The password column is never
// returned to anyone.
router.get('/', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM teachers ORDER BY created_at ASC`;
    const caller = await resolveCaller(req, sql);
    if (caller && caller.isPrincipal) {
      return res.json(stripSecretsFrom(rows));
    }
    res.json(rows.map(publicTeacher));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teachers - create teacher (principal only)
router.post('/', async (req, res) => {
  try {
    const { principalId, principalPassword, teacher_id, password, full_name } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!teacher_id || !password) {
      return res.status(400).json({ error: 'Teacher ID and password required' });
    }
    
    const existing = await sql`SELECT teacher_id FROM teachers WHERE teacher_id = ${teacher_id}`;
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Teacher ID already exists' });
    }
    
    const rows = await sql`INSERT INTO teachers (teacher_id, password, full_name) VALUES (${teacher_id}, ${hashPassword(password)}, ${full_name || ''}) RETURNING *`;
    const { password: _, ...safe } = rows[0];
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teachers/bulk - bulk create teachers from CSV/Excel (principal only).
// Only priority, full name, teacher ID, password, subject and program are set;
// teachers fill in everything else on their own profiles.
router.post('/bulk', async (req, res) => {
  try {
    const { principalId, principalPassword, teachers } = req.body;

    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!teachers || !Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({ error: 'No teacher data provided' });
    }

    const ids = teachers.map((t) => String((t && t.teacher_id) || '').trim()).filter(Boolean);
    const existingRows = await sql`SELECT teacher_id FROM teachers WHERE teacher_id = ANY(${ids})`;
    const existingIds = new Set(existingRows.map((r) => r.teacher_id));

    const seenInFile = new Set();
    const toInsert = [];
    for (const t of teachers) {
      const teacher_id = String((t && t.teacher_id) || '').trim();
      const password = String((t && t.password) || '').trim();
      if (!teacher_id || !password) continue;
      if (existingIds.has(teacher_id) || seenInFile.has(teacher_id)) continue;
      seenInFile.add(teacher_id);

      const programRaw = String((t && t.program) || '').trim();
      const program = VALID_TEACHER_PROGRAMS.find((p) => p.toLowerCase() === programRaw.toLowerCase());
      if (!program) {
        return res.status(400).json({ error: `Teacher ${teacher_id}: invalid program "${programRaw}" (use HSC, Honours or Degree)` });
      }
      const subjectRaw = String((t && t.subject) || '').trim();
      if (!subjectRaw) {
        return res.status(400).json({ error: `Teacher ${teacher_id}: subject is required` });
      }
      const subject = KNOWN_TEACHER_SUBJECTS.find((s) => s.toLowerCase() === subjectRaw.toLowerCase());
      if (!subject) {
        return res.status(400).json({ error: `Teacher ${teacher_id}: subject "${subjectRaw}" does not match any known subject` });
      }
      const pr = parseInt(String((t && t.priority) || '').trim(), 10);
      toInsert.push({
        teacher_id,
        password,
        full_name: String((t && t.full_name) || '').trim(),
        subject,
        program,
        seniority_priority: Number.isInteger(pr) && pr > 0 ? pr : null,
      });
    }

    const skipped = teachers.length - toInsert.length;
    if (toInsert.length === 0) {
      return res.json({ created: 0, skipped, message: 'All teachers already exist' });
    }

    for (const s of toInsert) {
      await sql`
        INSERT INTO teachers (teacher_id, password, full_name, subject, program, seniority_priority)
        VALUES (${s.teacher_id}, ${hashPassword(s.password)}, ${s.full_name}, ${s.subject}, ${s.program}, ${s.seniority_priority})
      `;
    }
    res.json({ created: toInsert.length, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teachers/:id - update teacher (self or principal)
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body || {};
    const teacherId = req.params.id;

    const caller = await requireTeacher(req, sql);
    if (!caller) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const isSelf = caller.teacher_id === teacherId;
    if (!isSelf && !caller.is_principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const clean = {};
    for (const k of ALLOWED_TEACHER_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(updates, k)) continue;
      const v = updates[k];

      // A teacher may edit their own profile but not the field that decides
      // which exam marks they may enter — otherwise they could grant
      // themselves another subject's marks. The principal owns this field.
      if (k === 'subject' && !caller.is_principal && String(v) !== String(caller.subject || '')) {
        return res.status(403).json({
          error: 'Only the principal can change your teaching subject. Please ask the principal.',
        });
      }

      // Passwords are stored hashed, and omission never clears one.
      if (k === 'password') {
        if (v) clean[k] = hashPassword(v);
        continue;
      }

      clean[k] = DATE_COLUMNS.includes(k) && v === '' ? null : v;
    }
    clean.updated_at = new Date().toISOString();
    
    const keys = Object.keys(clean);
    if (keys.length === 0) {
      const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacherId}`;
      const { password: _, ...safe } = rows[0];
      return res.json(safe);
    }
    
    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(clean);
    const query = `UPDATE teachers SET ${setClause} WHERE teacher_id = $1 RETURNING *`;
    const rows = await sql.query(query, [teacherId, ...values]);
    const { password: _, ...safe } = rows[0];
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teachers/:id - delete teacher (principal only)
router.delete('/:id', async (req, res) => {
  try {
    const { principalId, principalPassword } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (req.params.id === principal.teacher_id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    
    await sql`DELETE FROM teachers WHERE teacher_id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teachers/:id/toggle-notice - toggle notice access (principal only)
router.post('/:id/toggle-notice', async (req, res) => {
  try {
    const { principalId, principalPassword, can_write_notice } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const rows = await sql`
      UPDATE teachers SET can_write_notice = ${can_write_notice}, updated_at = ${new Date().toISOString()} 
      WHERE teacher_id = ${req.params.id} RETURNING *
    `;
    const { password: _, ...safe } = rows[0];
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teachers/login - teacher login.
// Returns a signed, expiring session token, so the browser keeps that instead
// of the password and never resends a credential. A successful sign-in also
// upgrades a legacy plaintext password to a hash.
router.post('/login', async (req, res) => {
  try {
    const { teacher_id, password } = req.body;

    const throttle = checkLogin(req, teacher_id);
    if (!throttle.allowed) {
      res.set('Retry-After', String(throttle.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
    }

    const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
    const teacher = rows[0];
    if (!teacher) {
      recordFailure(req, teacher_id);
      return res.status(401).json({ error: 'Teacher not found' });
    }
    if (!(await authenticateRow(sql, 'teacher', teacher, teacher.teacher_id, password))) {
      recordFailure(req, teacher_id);
      return res.status(401).json({ error: 'Invalid password' });
    }
    recordSuccess(req, teacher_id);

    const { password: _, ...safe } = teacher;
    res.json({
      ...safe,
      token: issueToken({
        sub: teacher.teacher_id,
        role: teacher.is_principal ? 'principal' : 'teacher',
      }),
      expiresIn: DEFAULT_TTL_SECONDS,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;