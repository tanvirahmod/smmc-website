const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { stripSecretsFrom, resolveCaller, isStaffCaller, UNAUTHORIZED } = require('../lib/security');

// Must match the slugs in src/lib/departments.ts.
const VALID_DEPARTMENTS = [
  'honours-english',
  'honours-political-science',
  'honours-sociology',
  'degree-ba',
  'degree-bss',
];

const VALID_PROGRAMS = ['Honours', 'Degree'];

const YEAR_OPTIONS = {
  Honours: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  Degree: ['1st Year', '2nd Year', '3rd Year'],
};

/**
 * Who may manage an in-course exam: the principal (any department) or a
 * teacher assigned to the exam's department via department_staff.
 * Returns { ok, teacherId } — teacherId is the acting teacher (or principal id).
 */
/**
 * Who may manage an in-course exam: the principal (any department) or a
 * teacher assigned to the exam's department via department_staff.
 * Returns { ok, teacherId } — teacherId is the acting teacher (or principal id).
 */
async function canManage(req, departmentSlug) {
  const caller = await resolveCaller(req, sql);
  if (!caller) return { ok: false };
  if (caller.isPrincipal) return { ok: true, teacherId: caller.id };
  if (caller.isTeacher && departmentSlug) {
    const member = await sql`SELECT id FROM department_staff WHERE department_slug = ${departmentSlug} AND teacher_id = ${caller.id}`;
    if (member[0]) return { ok: true, teacherId: caller.id };
  }
  return { ok: false };
}

function cleanSubjects(subjects) {
  if (!Array.isArray(subjects)) return [];
  const seen = new Set();
  const out = [];
  for (const s of subjects) {
    const name = String((s && typeof s === 'object' ? s.name : s) || '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const code = s && typeof s === 'object' ? String(s.code || '').trim() : '';
    out.push({ name, code });
  }
  return out;
}

/** Cleaned routine rows (day/date/time/subject/code); drops fully blank rows. */
function cleanRoutine(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => ({
      day: String((r && r.day) || '').trim(),
      date: String((r && r.date) || '').trim(),
      time: String((r && r.time) || '').trim(),
      subject: String((r && r.subject) || '').trim(),
      code: String((r && r.code) || '').trim(),
    }))
    .filter((r) => r.day || r.date || r.time || r.subject);
}
/** Subject names of an exam row (tolerates legacy plain-string entries). */
function subjectNames(exam) {
  return (exam.subjects || []).map((s) => (s && typeof s === 'object' ? s.name : String(s)));
}

// GET /api/incourse/exams - list (?program=&session=&department=) — staff only
router.get('/exams', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { program, session, department } = req.query;
    let rows = await sql`SELECT *, (SELECT COUNT(*)::int FROM incourse_marks WHERE exam_id = incourse_exams.id) AS marks_count FROM incourse_exams ORDER BY created_at DESC`;
    if (program) rows = rows.filter((e) => e.program === program);
    if (session) rows = rows.filter((e) => e.session === session);
    if (department) rows = rows.filter((e) => e.department_slug === department);
    if (req.query.year) rows = rows.filter((e) => e.year === req.query.year);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incourse/exams - create (principal or assigned teacher of the department)
router.post('/exams', async (req, res) => {
  try {
    const { name, program, session, departmentSlug, subjects, paperOutOf, attendanceOutOf, is_active } = req.body;
    if (!VALID_DEPARTMENTS.includes(departmentSlug)) {
      return res.status(400).json({ error: 'Invalid department' });
    }
    const auth = await canManage(req, departmentSlug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Exam name is required' });
    if (!VALID_PROGRAMS.includes(program)) return res.status(400).json({ error: 'Program must be Honours or Degree' });
    const year = String(req.body.year || '').trim();
    if (!YEAR_OPTIONS[program].includes(year)) {
      return res.status(400).json({ error: 'Select a valid year for the program' });
    }
    if (!session || !session.trim()) return res.status(400).json({ error: 'Session is required' });
    const clean = cleanSubjects(subjects);
    if (clean.length === 0) return res.status(400).json({ error: 'At least one subject is required' });
    const paperMax = Number(paperOutOf);
    const atteMax = Number(attendanceOutOf);
    if (!(paperMax > 0) || !(atteMax >= 0)) {
      return res.status(400).json({ error: 'Valid paper/attendance full marks are required' });
    }

    const rows = await sql`
      INSERT INTO incourse_exams (name, program, session, department_slug, year, subjects, paper_out_of, attendance_out_of, is_active, created_by)
      VALUES (${name.trim()}, ${program}, ${session.trim()}, ${departmentSlug}, ${year}, ${JSON.stringify(clean)}, ${paperMax}, ${atteMax}, ${is_active || false}, ${auth.teacherId})
      RETURNING *
    `;
    res.json({ ...rows[0], paper_out_of: Number(rows[0].paper_out_of), attendance_out_of: Number(rows[0].attendance_out_of) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incourse/exams/:id - update name/subjects/caps/active (same auth, marks for removed subjects are kept but hidden)
router.put('/exams/:id', async (req, res) => {
  try {
    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const auth = await canManage(req, exam.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });

    const { name, subjects, paperOutOf, attendanceOutOf, is_active, year } = req.body;
    const clean = subjects === undefined ? exam.subjects : cleanSubjects(subjects);
    if (clean.length === 0) return res.status(400).json({ error: 'At least one subject is required' });
    const nextYear = year === undefined ? (exam.year || '') : String(year).trim();
    if (year !== undefined && !YEAR_OPTIONS[exam.program].includes(nextYear)) {
      return res.status(400).json({ error: 'Select a valid year for the program' });
    }
    const paperMax = paperOutOf === undefined ? Number(exam.paper_out_of) : Number(paperOutOf);
    const atteMax = attendanceOutOf === undefined ? Number(exam.attendance_out_of) : Number(attendanceOutOf);
    if (!(paperMax > 0) || !(atteMax >= 0)) {
      return res.status(400).json({ error: 'Valid paper/attendance full marks are required' });
    }

    const rows = await sql`
      UPDATE incourse_exams
      SET name = ${name && name.trim() ? name.trim() : exam.name},
          year = ${nextYear},
          subjects = ${JSON.stringify(clean)},
          paper_out_of = ${paperMax},
          attendance_out_of = ${atteMax},
          is_active = ${is_active === undefined ? exam.is_active : !!is_active},
          updated_at = ${new Date().toISOString()}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ ...rows[0], paper_out_of: Number(rows[0].paper_out_of), attendance_out_of: Number(rows[0].attendance_out_of) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/incourse/exams/:id - delete exam + marks (same auth)
router.delete('/exams/:id', async (req, res) => {
  try {
    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const auth = await canManage(req, exam.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    await sql`DELETE FROM incourse_exams WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incourse/exams/:id/routine - save the exam routine (same auth)
router.put('/exams/:id/routine', async (req, res) => {
  try {
    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const auth = await canManage(req, exam.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    const clean = cleanRoutine(req.body.rows);
    const rows = await sql`
      UPDATE incourse_exams
      SET routine = ${JSON.stringify(clean)},
          updated_at = ${new Date().toISOString()}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json({ ...rows[0], paper_out_of: Number(rows[0].paper_out_of), attendance_out_of: Number(rows[0].attendance_out_of) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incourse/exams/:id/marks - all marks (?subject=) — staff only
router.get('/exams/:id/marks', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { subject } = req.query;
    let rows;
    if (subject) {
      rows = await sql`SELECT * FROM incourse_marks WHERE exam_id = ${req.params.id} AND subject = ${subject} ORDER BY student_id ASC`;
    } else {
      rows = await sql`SELECT * FROM incourse_marks WHERE exam_id = ${req.params.id} ORDER BY student_id ASC`;
    }
    res.json(rows.map((r) => ({ ...r, paper: Number(r.paper), attendance: Number(r.attendance) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incourse/exams/:id/marks - save one mark (same auth; absent stores 0/0)
router.post('/exams/:id/marks', async (req, res) => {
  try {
    const { studentId, subject, paper, attendance, status } = req.body;
    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const auth = await canManage(req, exam.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    if (!studentId || !subject || !subjectNames(exam).includes(subject)) {
      return res.status(400).json({ error: 'Valid student and exam subject are required' });
    }
    const st = status || 'present';
    if (st !== 'present' && st !== 'absent') return res.status(400).json({ error: 'Invalid status' });
    const paperMax = Number(exam.paper_out_of);
    const atteMax = Number(exam.attendance_out_of);
    let paperNum = 0;
    let atteNum = 0;
    if (st === 'present') {
      paperNum = Number(paper);
      atteNum = Number(attendance);
      if (isNaN(paperNum) || isNaN(atteNum) || paperNum < 0 || atteNum < 0 || paperNum > paperMax || atteNum > atteMax) {
        return res.status(400).json({ error: `Marks must be within paper 0–${paperMax}, attendance 0–${atteMax}` });
      }
    }

    const rows = await sql`
      INSERT INTO incourse_marks (exam_id, student_id, subject, paper, attendance, status, entered_by)
      VALUES (${req.params.id}, ${studentId}, ${subject}, ${paperNum}, ${atteNum}, ${st}, ${auth.teacherId})
      ON CONFLICT (exam_id, student_id, subject)
      DO UPDATE SET paper = ${paperNum}, attendance = ${atteNum}, status = ${st}, entered_by = ${auth.teacherId}, updated_at = ${new Date().toISOString()}
      RETURNING *
    `;
    res.json({ ...rows[0], paper: Number(rows[0].paper), attendance: Number(rows[0].attendance) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/incourse/exams/:id/marks - remove one mark (same auth)
router.delete('/exams/:id/marks', async (req, res) => {
  try {
    const { studentId, subject } = req.body;
    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    const auth = await canManage(req, exam.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    await sql`DELETE FROM incourse_marks WHERE exam_id = ${req.params.id} AND student_id = ${studentId} AND subject = ${subject}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incourse/exams/:id/students - program + session roster, roll-sorted (staff only)
router.get('/exams/:id/students', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.json([]);
    const rows = await sql`
      SELECT * FROM students
      WHERE program = ${exam.program} AND session = ${exam.session}
      ORDER BY created_at ASC
    `;
    rows.sort((a, b) => (a.class_roll || a.student_id || '').localeCompare(b.class_roll || b.student_id || '', undefined, { numeric: true }));
    res.json(stripSecretsFrom(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incourse/exams/:id/result - full result payload (staff only)
router.get('/exams/:id/result', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const examRows = await sql`SELECT * FROM incourse_exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.json({ students: [], marks: [] });
    const [students, marks] = await Promise.all([
      sql`SELECT * FROM students WHERE program = ${exam.program} AND session = ${exam.session} ORDER BY created_at ASC`,
      sql`SELECT * FROM incourse_marks WHERE exam_id = ${req.params.id}`,
    ]);
    res.json({
      students: stripSecretsFrom(students),
      marks: marks.map((r) => ({ ...r, paper: Number(r.paper), attendance: Number(r.attendance) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incourse/subjects - reusable subject catalog (?program=&year=&department=) — staff only
router.get('/subjects', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { program, year, department } = req.query;
    let rows = await sql`SELECT * FROM incourse_subject_catalog ORDER BY name ASC`;
    if (program) rows = rows.filter((s) => s.program === program);
    if (year) rows = rows.filter((s) => s.year === year);
    if (department) rows = rows.filter((s) => s.department_slug === department);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incourse/subjects - upsert catalog entries (principal or assigned teacher)
router.post('/subjects', async (req, res) => {
  try {
    const { program, year, departmentSlug, subjects } = req.body;
    if (!VALID_PROGRAMS.includes(program)) {
      return res.status(400).json({ error: 'Program must be Honours or Degree' });
    }
    const cleanYear = String(year || '').trim();
    if (!YEAR_OPTIONS[program].includes(cleanYear)) {
      return res.status(400).json({ error: 'Select a valid year for the program' });
    }
    if (!VALID_DEPARTMENTS.includes(departmentSlug)) {
      return res.status(400).json({ error: 'Invalid department' });
    }
    const auth = await canManage(req, departmentSlug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    const clean = cleanSubjects(subjects);
    if (clean.length === 0) return res.status(400).json({ error: 'At least one subject is required' });
    for (const s of clean) {
      await sql`
        INSERT INTO incourse_subject_catalog (program, year, department_slug, name, code, created_by)
        VALUES (${program}, ${cleanYear}, ${departmentSlug}, ${s.name}, ${s.code}, ${auth.teacherId})
        ON CONFLICT (program, year, department_slug, name)
        DO UPDATE SET code = EXCLUDED.code, updated_at = ${new Date().toISOString()}
      `;
    }
    const rows = await sql`SELECT * FROM incourse_subject_catalog WHERE program = ${program} AND year = ${cleanYear} AND department_slug = ${departmentSlug} ORDER BY name ASC`;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/incourse/subjects/:id - rename / re-code one catalog entry (same auth)
router.put('/subjects/:id', async (req, res) => {
  try {
    const cur = await sql`SELECT * FROM incourse_subject_catalog WHERE id = ${req.params.id}`;
    const row = cur[0];
    if (!row) return res.status(404).json({ error: 'Subject not found' });
    const auth = await canManage(req, row.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    const nextName = String(req.body.name !== undefined ? req.body.name : row.name).trim();
    const nextCode = req.body.code === undefined ? row.code : String(req.body.code).trim();
    if (!nextName) return res.status(400).json({ error: 'Subject name is required' });
    const clash = await sql`SELECT id FROM incourse_subject_catalog WHERE program = ${row.program} AND year = ${row.year} AND department_slug = ${row.department_slug} AND LOWER(name) = ${nextName.toLowerCase()} AND id <> ${req.params.id}`;
    if (clash.length > 0) {
      return res.status(400).json({ error: 'A subject with this name already exists for this year' });
    }
    const rows = await sql`
      UPDATE incourse_subject_catalog
      SET name = ${nextName}, code = ${nextCode}, updated_at = ${new Date().toISOString()}
      WHERE id = ${req.params.id}
      RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/incourse/subjects/:id - remove one catalog entry (same auth)
router.delete('/subjects/:id', async (req, res) => {
  try {
    const cur = await sql`SELECT * FROM incourse_subject_catalog WHERE id = ${req.params.id}`;
    const row = cur[0];
    if (!row) return res.status(404).json({ error: 'Subject not found' });
    const auth = await canManage(req, row.department_slug);
    if (!auth.ok) return res.status(401).json({ error: 'Unauthorized' });
    await sql`DELETE FROM incourse_subject_catalog WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
