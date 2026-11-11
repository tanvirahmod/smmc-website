const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { requirePrincipal } = require('../lib/security');

// Must match the slugs in src/lib/departments.ts.
const VALID_DEPARTMENTS = [
  'honours-english',
  'honours-political-science',
  'honours-sociology',
  'degree-ba',
  'degree-bss',
];

// Principal authentication comes from ../lib/security so it understands
// session tokens as well as legacy body credentials.

// GET /api/departments/staff - list assignments (?department=slug, ?teacherId=)
router.get('/staff', async (req, res) => {
  try {
    const { department, teacherId } = req.query;
    let rows;
    if (department && teacherId) {
      rows = await sql`SELECT * FROM department_staff WHERE department_slug = ${department} AND teacher_id = ${teacherId} ORDER BY role ASC`;
    } else if (department) {
      rows = await sql`SELECT * FROM department_staff WHERE department_slug = ${department} ORDER BY role ASC`;
    } else if (teacherId) {
      rows = await sql`SELECT * FROM department_staff WHERE teacher_id = ${teacherId} ORDER BY department_slug ASC`;
    } else {
      rows = await sql`SELECT * FROM department_staff ORDER BY department_slug ASC, role ASC`;
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/departments/staff - assign head/member (principal only)
router.post('/staff', async (req, res) => {
  try {
    const { principalId, principalPassword, teacherId, departmentSlug, role } = req.body;
    if (!(await requirePrincipal(req, sql))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!VALID_DEPARTMENTS.includes(departmentSlug)) {
      return res.status(400).json({ error: 'Invalid department' });
    }
    if (role !== 'head' && role !== 'member') {
      return res.status(400).json({ error: 'Role must be head or member' });
    }
    const teacherRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacherId}`;
    if (!teacherRows[0]) return res.status(404).json({ error: 'Teacher not found' });

    const rows = await sql`
      INSERT INTO department_staff (department_slug, teacher_id, role)
      VALUES (${departmentSlug}, ${teacherId}, ${role})
      ON CONFLICT (department_slug, teacher_id)
      DO UPDATE SET role = ${role}
      RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/departments/staff - remove assignment (principal only)
router.delete('/staff', async (req, res) => {
  try {
    const { principalId, principalPassword, teacherId, departmentSlug } = req.body;
    if (!(await requirePrincipal(req, sql))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await sql`DELETE FROM department_staff WHERE department_slug = ${departmentSlug} AND teacher_id = ${teacherId}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
