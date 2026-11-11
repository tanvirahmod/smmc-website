const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { resolveCaller } = require('../lib/security');

// Must match the slugs in src/lib/departments.ts.
const VALID_DEPARTMENT_SLUGS = [
  'honours-english',
  'honours-political-science',
  'honours-sociology',
  'degree-ba',
  'degree-bss',
];

// GET /api/notices - main board by default (?department=slug for one department)
router.get('/', async (req, res) => {
  try {
    const { department } = req.query;
    let rows;
    if (department) {
      rows = await sql`SELECT * FROM notices WHERE department = ${department} ORDER BY published_date DESC`;
    } else {
      rows = await sql`SELECT * FROM notices WHERE department IS NULL ORDER BY published_date DESC`;
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notices - create notice (principal anywhere; teacher on the main
// board with can_write_notice, or in an assigned department via department_staff)
router.post('/', async (req, res) => {
  try {
    const { principalId, principalPassword, teacherId, teacherPassword, title, content, category, noticeClass, department } = req.body;

    if (department && !VALID_DEPARTMENT_SLUGS.includes(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    // The principal may publish anywhere; a teacher needs notice access on the
    // main board, or membership of the department the notice targets.
    const caller = await resolveCaller(req, sql);
    let authorLabel;
    if (caller && caller.isPrincipal) {
      authorLabel = caller.teacher.full_name || 'Principal';
    } else if (caller && caller.isTeacher) {
      const actingTeacher = caller.teacher;
      if (department) {
        const member = await sql`SELECT id FROM department_staff WHERE department_slug = ${department} AND teacher_id = ${actingTeacher.teacher_id}`;
        if (member[0]) authorLabel = actingTeacher.full_name || actingTeacher.teacher_id;
      } else if (actingTeacher.can_write_notice) {
        authorLabel = actingTeacher.full_name || actingTeacher.teacher_id;
      }
    }
    if (!authorLabel) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    const rows = await sql`
      INSERT INTO notices (title, content, category, class, author, department)
      VALUES (${title}, ${content}, ${category || 'general'}, ${noticeClass || null}, ${authorLabel}, ${department || null})
      RETURNING *
    `;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notices/:id - delete notice (principal anything; teacher with
// can_write_notice, or an assigned teacher for their own department's notices)
router.delete('/:id', async (req, res) => {
  try {
    const { principalId, principalPassword, teacherId, teacherPassword } = req.body;

    // The principal may delete anything; a teacher needs notice access, or
    // membership of the department that owns the notice.
    const caller = await resolveCaller(req, sql);
    let authorized = false;
    if (caller && caller.isPrincipal) {
      authorized = true;
    } else if (caller && caller.isTeacher) {
      const actingTeacher = caller.teacher;
      if (actingTeacher.can_write_notice) {
        authorized = true;
      } else {
        const target = await sql`SELECT department FROM notices WHERE id = ${req.params.id}`;
        const dept = target[0] && target[0].department;
        if (dept) {
          const member = await sql`SELECT id FROM department_staff WHERE department_slug = ${dept} AND teacher_id = ${actingTeacher.teacher_id}`;
          if (member[0]) authorized = true;
        }
      }
    }
    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await sql`DELETE FROM notices WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;