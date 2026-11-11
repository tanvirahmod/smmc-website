const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const {
  stripSecretsFrom,
  resolveCaller,
  requirePrincipal,
  requireTeacher,
  isStaffCaller,
  UNAUTHORIZED,
} = require('../lib/security');

const MAX_COMPONENT_MARKS = 200;

// GET /api/exams - list all exams with mark counts (staff only)
router.get('/', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const rows = await sql`
      SELECT e.*, COUNT(em.id)::int AS marks_count
      FROM exams e
      LEFT JOIN exam_marks em ON em.exam_id = e.id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/active - get active exams (staff only)
router.get('/active', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { subject } = req.query;
    let rows;
    if (subject) {
      rows = await sql`SELECT * FROM exams WHERE is_active = true AND ${subject} = ANY(subjects) ORDER BY created_at DESC`;
    } else {
      rows = await sql`SELECT * FROM exams WHERE is_active = true ORDER BY created_at DESC`;
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams - create exam (principal only)
router.post('/', async (req, res) => {
  try {
    const { principalId, principalPassword, name, program, session, subjects, is_active, passMarks } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const cleanSubjects = Array.from(new Set(subjects.filter(s => s && s.trim())));
    if (!name || !program || !session || cleanSubjects.length === 0) {
      return res.status(400).json({ error: 'Exam name, program, session, and at least one subject required' });
    }
    
    // Clean pass marks
    const cleanPassMarks = {};
    if (passMarks) {
      for (const s of cleanSubjects) {
        const pm = passMarks[s];
        if (!pm) continue;
        const outOfCq = Number(pm.outOfCq) || 0;
        const outOfMcq = Number(pm.outOfMcq) || 0;
        const cqPass = pm.cqPass == null ? null : Math.max(0, Number(pm.cqPass) || 0);
        const mcqPass = pm.mcqPass == null ? null : Math.max(0, Number(pm.mcqPass) || 0);
        const totalOnly = pm.totalOnly === true;
        if (outOfCq > 0 || outOfMcq > 0 || cqPass != null || mcqPass != null || totalOnly) {
          cleanPassMarks[s] = { outOfCq, cqPass, outOfMcq, mcqPass, ...(totalOnly ? { totalOnly: true } : {}) };
        }
      }
    }
    
    const rows = await sql`
      INSERT INTO exams (name, program, session, subjects, is_active, created_by, pass_marks)
      VALUES (${name}, ${program}, ${session}, ${cleanSubjects}, ${is_active || false}, ${principal.teacher_id}, ${cleanPassMarks})
      RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exams/:id/toggle - toggle active status (principal only)
router.put('/:id/toggle', async (req, res) => {
  try {
    const { principalId, principalPassword, is_active } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const rows = await sql`
      UPDATE exams SET is_active = ${is_active}, updated_at = ${new Date().toISOString()}
      WHERE id = ${req.params.id} RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exams/:id/subjects - update subjects (principal only)
router.put('/:id/subjects', async (req, res) => {
  try {
    const { principalId, principalPassword, subjects } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const cleanSubjects = Array.from(new Set(subjects.filter(s => s && s.trim())));
    if (cleanSubjects.length === 0) {
      return res.status(400).json({ error: 'At least one subject required' });
    }
    
    // Prune pass marks for removed subjects
    const previous = await sql`SELECT pass_marks FROM exams WHERE id = ${req.params.id}`;
    const previousMarks = (previous[0] || {}).pass_marks || {};
    const kept = {};
    for (const s of cleanSubjects) {
      if (previousMarks[s]) kept[s] = previousMarks[s];
    }
    
    const rows = await sql`
      UPDATE exams SET subjects = ${cleanSubjects}, pass_marks = ${kept}, updated_at = ${new Date().toISOString()}
      WHERE id = ${req.params.id} RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exams/:id/pass-marks - update pass marks (principal only)
router.put('/:id/pass-marks', async (req, res) => {
  try {
    const { principalId, principalPassword, passMarks } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const examRows = await sql`SELECT subjects FROM exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    
    const clean = {};
    for (const s of exam.subjects) {
      const pm = passMarks?.[s];
      if (!pm) continue;
      const outOfCq = Number(pm.outOfCq) || 0;
      const outOfMcq = Number(pm.outOfMcq) || 0;
      const cqPass = pm.cqPass == null ? null : Math.max(0, Number(pm.cqPass) || 0);
      const mcqPass = pm.mcqPass == null ? null : Math.max(0, Number(pm.mcqPass) || 0);
      const totalOnly = pm.totalOnly === true;
      if (outOfCq > 0 || outOfMcq > 0 || cqPass != null || mcqPass != null || totalOnly) {
        clean[s] = { outOfCq, cqPass, outOfMcq, mcqPass, ...(totalOnly ? { totalOnly: true } : {}) };
      }
    }
    
    const rows = await sql`
      UPDATE exams SET pass_marks = ${clean}, updated_at = ${new Date().toISOString()}
      WHERE id = ${req.params.id} RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exams/:id - delete exam (principal only)
router.delete('/:id', async (req, res) => {
  try {
    const { principalId, principalPassword } = req.body;
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    await sql`DELETE FROM exams WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/:id/marks - get marks for exam (staff only)
router.get('/:id/marks', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { subject } = req.query;
    let rows;
    if (subject) {
      rows = await sql`SELECT * FROM exam_marks WHERE exam_id = ${req.params.id} AND subject = ${subject} ORDER BY student_id ASC`;
    } else {
      rows = await sql`SELECT * FROM exam_marks WHERE exam_id = ${req.params.id} ORDER BY student_id ASC`;
    }
    res.json(rows.map(r => ({ ...r, cq: Number(r.cq), mcq: Number(r.mcq) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams/:id/marks - save mark (teacher)
router.post('/:id/marks', async (req, res) => {
  try {
    const { teacherId, teacherPassword, studentId, cq, mcq, status } = req.body;
    
    const teacher = await requireTeacher(req, sql);
    if (!teacher) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (isNaN(cq) || isNaN(mcq) || cq < 0 || mcq < 0 || cq > MAX_COMPONENT_MARKS || mcq > MAX_COMPONENT_MARKS) {
      return res.status(400).json({ error: `Marks must be between 0 and ${MAX_COMPONENT_MARKS}` });
    }
    if (!['present', 'absent', 'expelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid mark status' });
    }
    
    const subject = (teacher.subject || '').trim();
    if (!subject) {
      return res.status(400).json({ error: 'Your teaching subject is not set. Update your profile first.' });
    }
    
    const examRows = await sql`SELECT * FROM exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (!exam.is_active) {
      return res.status(400).json({ error: 'This exam is not active. Marks can only be entered while the exam is active.' });
    }
    if (!exam.subjects.includes(subject)) {
      return res.status(400).json({ error: `This exam does not include ${subject}.` });
    }
    
    const rows = await sql`
      INSERT INTO exam_marks (exam_id, student_id, subject, cq, mcq, status, entered_by)
      VALUES (${req.params.id}, ${studentId}, ${subject}, ${cq}, ${mcq}, ${status}, ${teacher.teacher_id})
      ON CONFLICT (exam_id, student_id, subject)
      DO UPDATE SET cq = ${cq}, mcq = ${mcq}, status = ${status}, entered_by = ${teacher.teacher_id}, updated_at = ${new Date().toISOString()}
      RETURNING *
    `;
    res.json({ ...rows[0], cq: Number(rows[0].cq), mcq: Number(rows[0].mcq) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exams/:id/marks - delete mark (teacher)
router.delete('/:id/marks', async (req, res) => {
  try {
    const { teacherId, teacherPassword, studentId } = req.body;
    
    const teacher = await requireTeacher(req, sql);
    if (!teacher) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const subject = (teacher.subject || '').trim();
    if (!subject) {
      return res.status(400).json({ error: 'Your teaching subject is not set. Update your profile first.' });
    }
    
    const examRows = await sql`SELECT * FROM exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found' });
    if (!exam.is_active) {
      return res.status(400).json({ error: 'This exam is not active. Marks can only be changed while the exam is active.' });
    }
    if (!exam.subjects.includes(subject)) {
      return res.status(400).json({ error: `This exam does not include ${subject}.` });
    }
    
    await sql`
      DELETE FROM exam_marks
      WHERE exam_id = ${req.params.id} AND student_id = ${studentId} AND subject = ${subject}
    `;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/:id/practical - get practical marks for exam (Science, one value per student)
router.get('/:id/practical', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const rows = await sql`SELECT * FROM exam_practical_marks WHERE exam_id = ${req.params.id} ORDER BY student_id ASC`;
    res.json(rows.map(r => ({ ...r, marks: Number(r.marks) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams/:id/practical - save practical marks (principal only)
// Body: { principalId, principalPassword, entries: [{ studentId, marks }] }
const MAX_PRACTICAL_MARKS = 100;
router.post('/:id/practical', async (req, res) => {
  try {
    const { principalId, principalPassword, entries } = req.body;

    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const examRows = await sql`SELECT * FROM exams WHERE id = ${req.params.id}`;
    if (!examRows[0]) return res.status(404).json({ error: 'Exam not found' });

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'No practical marks provided' });
    }

    const saved = [];
    for (const e of entries) {
      const marks = Number(e.studentId != null ? e.marks : NaN);
      if (!e.studentId || isNaN(marks) || marks < 0 || marks > MAX_PRACTICAL_MARKS) {
        return res.status(400).json({ error: `Invalid practical marks for ${e.studentId || 'a student'} (0–${MAX_PRACTICAL_MARKS})` });
      }
      const rows = await sql`
        INSERT INTO exam_practical_marks (exam_id, student_id, marks, entered_by)
        VALUES (${req.params.id}, ${e.studentId}, ${marks}, ${principal.teacher_id})
        ON CONFLICT (exam_id, student_id)
        DO UPDATE SET marks = ${marks}, entered_by = ${principal.teacher_id}, updated_at = ${new Date().toISOString()}
        RETURNING *
      `;
      saved.push({ ...rows[0], marks: Number(rows[0].marks) });
    }
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/:id/students/:subject - get students for exam + subject (staff only)
router.get('/:id/students/:subject', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { id, subject } = req.params;
    const examRows = await sql`SELECT * FROM exams WHERE id = ${id}`;
    const exam = examRows[0];
    if (!exam || !subject) return res.json([]);
    
    const rows = await sql`
      SELECT * FROM students
      WHERE program = ${exam.program} AND session = ${exam.session}
      ORDER BY created_at ASC
    `;
    
    // Filter students who have this subject
    const students = rows.filter(s => {
      const main = [...JSON.parse(s.hsc_subjects || '[]'), ...JSON.parse(s.subjects || '[]')];
      if (main.some(x => x.toLowerCase() === subject.toLowerCase())) return true;
      const fourth = (s.fourth_subject || '').trim();
      if (fourth && fourth.toLowerCase() === subject.toLowerCase()) return true;
      return (s.department || '').toLowerCase() === subject.toLowerCase();
    });
    
    students.sort((a, b) => (a.class_roll || a.student_id || '').localeCompare(b.class_roll || b.student_id || '', undefined, { numeric: true }));
    res.json(stripSecretsFrom(students));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/:id/result - get full exam result (staff only)
router.get('/:id/result', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const examRows = await sql`SELECT * FROM exams WHERE id = ${req.params.id}`;
    const exam = examRows[0];
    if (!exam) return res.json({ students: [], marks: [] });
    
    const [students, marks] = await Promise.all([
      sql`SELECT * FROM students WHERE program = ${exam.program} AND session = ${exam.session} ORDER BY created_at ASC`,
      sql`SELECT * FROM exam_marks WHERE exam_id = ${req.params.id}`
    ]);
    
    res.json({ students: stripSecretsFrom(students), marks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;