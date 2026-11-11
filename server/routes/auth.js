const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { authenticateRow } = require('../lib/security');
const { issueToken, DEFAULT_TTL_SECONDS } = require('../lib/tokens');
const { checkLogin, recordFailure, recordSuccess } = require('../lib/ratelimit');

// POST /api/auth/student/login - student login
// Rolls repeat across sessions, so callers pass session (+ program) to pick
// the right account. Without session the legacy class_roll lookup is kept.
router.post('/student/login', async (req, res) => {
  try {
    const { student_id, password, program, session } = req.body;

    const throttle = checkLogin(req, student_id);
    if (!throttle.allowed) {
      res.set('Retry-After', String(throttle.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many sign-in attempts. Please try again later.' });
    }

    let student;
    if (session) {
      const rows = program
        ? await sql`SELECT * FROM students WHERE class_roll = ${student_id} AND session = ${session} AND program = ${program}`
        : await sql`SELECT * FROM students WHERE class_roll = ${student_id} AND session = ${session}`;
      student = rows[0];
    } else {
      let studentRows = await sql`SELECT * FROM students WHERE class_roll = ${student_id}`;
      student = studentRows[0];

      if (!student) {
        studentRows = await sql`SELECT * FROM students WHERE student_id = ${student_id}`;
        student = studentRows[0];
      }
    }
    
    if (!student) {
      recordFailure(req, student_id);
      return res.status(401).json({ error: 'Student not found' });
    }
    if (!(await authenticateRow(sql, 'student', student, student.student_id, password))) {
      recordFailure(req, student_id);
      return res.status(401).json({ error: 'Invalid password' });
    }
    if (program && student.program && student.program !== program) {
      return res.status(401).json({ error: 'Program does not match' });
    }
    recordSuccess(req, student_id);

    const { password: _, ...safe } = student;
    res.json({ ...safe, token: issueToken({ sub: student.student_id, role: 'student' }), expiresIn: DEFAULT_TTL_SECONDS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/teacher/login - teacher login (already in teachers.js, but keeping for consistency)
router.post('/teacher/login', async (req, res) => {
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