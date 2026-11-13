const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { v4: uuidv4 } = require('uuid');
const {
  stripSecretsFrom,
  resolveCaller,
  requirePrincipal,
  requireCaller,
  isStaffCaller,
  hashPassword,
  UNAUTHORIZED,
} = require('../lib/security');

const MANDATORY_HSC_SUBJECTS = ['Bangla', 'English', 'ICT'];

const GROUP_ADDITIONAL_SUBJECTS = {
  'Humanities': ['Civics', 'Sociology', 'Islamic History and Culture', 'Logic', 'Economics', 'Islamic Studies'],
  'Science': ['Physics', 'Chemistry', 'Biology'],
  'Business Studies': ['Accounting', 'Business Organization and Management', 'Production Management and Marketing', 'Economics'],
};

const GROUP_FOURTH_SUBJECTS = {
  'Humanities': ['Civics', 'Sociology', 'Islamic History and Culture', 'Logic', 'Economics', 'Islamic Studies'],
  'Science': ['Higher Math'],
  'Business Studies': ['Economics'],
};

// Defaults applied when the upload leaves the 3 additional columns empty.
// Science and Business Studies have a standard set; Humanities has no single
// default so it still requires 3 explicit subjects.
const GROUP_DEFAULT_ADDITIONAL = {
  'Science': ['Physics', 'Chemistry', 'Biology'],
  'Business Studies': ['Accounting', 'Business Organization and Management', 'Production Management and Marketing'],
};

function validateHscSubjects(group, mainSubjects, fourthSubject) {
  if (!GROUP_ADDITIONAL_SUBJECTS[group]) return { valid: false, error: `Invalid group: ${group}` };
  
  const mandatory = MANDATORY_HSC_SUBJECTS;
  const allowedAdditional = GROUP_ADDITIONAL_SUBJECTS[group];
  const allowedFourth = GROUP_FOURTH_SUBJECTS[group];
  
  // Check mandatory subjects
  for (const m of mandatory) {
    if (!mainSubjects.includes(m)) {
      return { valid: false, error: `Missing mandatory subject: ${m}` };
    }
  }
  
  // Check additional subjects (should be 3)
  const additional = mainSubjects.slice(3);
  if (additional.length !== 3) {
    return { valid: false, error: 'Must have exactly 3 additional subjects' };
  }
  
  for (const s of additional) {
    if (!allowedAdditional.includes(s)) {
      return { valid: false, error: `Subject "${s}" not allowed for ${group}. Allowed: ${allowedAdditional.join(', ')}` };
    }
  }
  
  // Check fourth subject
  if (fourthSubject && !allowedFourth.includes(fourthSubject)) {
    return { valid: false, error: `Fourth subject "${fourthSubject}" not allowed for ${group}. Allowed: ${allowedFourth.join(', ')}` };
  }
  
  return { valid: true };
}

// GET /api/students - list students with filters.
// Staff-only: the roster carries guardian contact details, addresses and
// national-ID style identifiers, so an anonymous request is refused outright.
router.get('/', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { session, program, search } = req.query;
    // Bound the page size so one request cannot pull the entire roster, and
    // parse defensively so a junk value cannot reach the query as NaN.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (session) {
      query += ` AND session = $${paramIndex++}`;
      params.push(session);
    }
    if (program) {
      query += ` AND program = $${paramIndex++}`;
      params.push(program);
    }
    if (search) {
      query += ` AND (full_name ILIKE $${paramIndex} OR class_roll ILIKE $${paramIndex} OR student_id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at ASC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const rows = await sql.query(query, params);
    res.json(stripSecretsFrom(rows));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/count - get total students count for pagination
router.get('/count', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { session, program, search } = req.query;
    
    let query = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (session) {
      query += ` AND session = $${paramIndex++}`;
      params.push(session);
    }
    if (program) {
      query += ` AND program = $${paramIndex++}`;
      params.push(program);
    }
    if (search) {
      query += ` AND (full_name ILIKE $${paramIndex} OR class_roll ILIKE $${paramIndex} OR student_id ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }
    
    const rows = await sql.query(query, params);
    res.json({ total: parseInt(rows[0].total) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/sessions - distinct sessions.
// Deliberately public: the sign-in form needs the session names before the
// visitor has credentials, and this exposes no personal data.
router.get('/sessions', async (req, res) => {
  try {
    const rows = await sql`SELECT DISTINCT session FROM students WHERE session IS NOT NULL AND session <> '' ORDER BY session DESC`;
    res.json(rows.map(r => r.session));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/by-subject/:subject - students having a subject in their
// main lists, 4th subject or department (teacher directory + export)
router.get('/by-subject/:subject', async (req, res) => {
  try {
    const caller = await resolveCaller(req, sql);
    if (!isStaffCaller(caller)) return res.status(401).json(UNAUTHORIZED);

    const { subject } = req.params;
    const { session, program } = req.query;
    const l = (subject || '').toLowerCase();
    if (!l) return res.json([]);

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    if (session) {
      query += ` AND session = $${paramIndex++}`;
      params.push(session);
    }
    if (program) {
      query += ` AND program = $${paramIndex++}`;
      params.push(program);
    }
    query += ' ORDER BY created_at ASC';

    const rows = await sql.query(query, params);
    const out = rows.filter((s) => {
      let main = [];
      try {
        main = [...JSON.parse(s.hsc_subjects || '[]'), ...JSON.parse(s.subjects || '[]')];
      } catch (e) { /* treat unparseable as empty */ }
      if (main.some((x) => String(x).toLowerCase() === l)) return true;
      if (String(s.fourth_subject || '').trim().toLowerCase() === l) return true;
      return String(s.department || '').trim().toLowerCase() === l;
    });
    out.sort((a, b) => (a.class_roll || a.student_id || '').localeCompare(b.class_roll || b.student_id || '', undefined, { numeric: true }));
    res.json(stripSecretsFrom(out));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/bulk - bulk create students
router.post('/bulk', async (req, res) => {
  try {
    const { students, session, program, hscGroup } = req.body;
    
    
    // Verify principal
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'No student data provided' });
    }
    if (!session) {
      return res.status(400).json({ error: 'Session is required' });
    }
    
    // Fill default additional subjects when the 3 additional columns are empty.
    // Science -> Physics, Chemistry, Biology; Business Studies -> Accounting,
    // Business Organization and Management, Production Management and Marketing.
    if (program === 'HSC' && hscGroup && GROUP_DEFAULT_ADDITIONAL[hscGroup]) {
      for (const student of students) {
        const cur = Array.isArray(student.main_subjects) ? student.main_subjects : [];
        if (cur.slice(3).length === 0) {
          student.main_subjects = [...MANDATORY_HSC_SUBJECTS, ...GROUP_DEFAULT_ADDITIONAL[hscGroup]];
        }
      }
    }

    // Validate HSC subjects if HSC program
    if (program === 'HSC' && hscGroup) {
      for (const student of students) {
        const validation = validateHscSubjects(hscGroup, student.main_subjects, student.fourth_subject);
        if (!validation.valid) {
          return res.status(400).json({ error: `Student ${student.class_roll}: ${validation.error}` });
        }
      }
    }
    
    const rolls = students.map(s => s.class_roll).filter(Boolean);
    // Rolls are unique per session+program: the same roll may exist in other
    // sessions, so only rows in THIS session+program count as duplicates.
    const existingRows = await sql`SELECT class_roll FROM students WHERE session = ${session} AND program = ${program || ''} AND class_roll = ANY(${rolls})`;
    const existingRolls = new Set(existingRows.map(r => r.class_roll));
    
    const seenInFile = new Set();
    const toInsert = students
      .filter(s => {
        if (!s.class_roll || !s.mobile_number) return false;
        if (existingRolls.has(s.class_roll)) return false;
        if (seenInFile.has(s.class_roll)) return false;
        seenInFile.add(s.class_roll);
        return true;
      })
      .map(s => {
        const hscGroupValue = program === 'HSC' ? (hscGroup || 'Humanities') : null;
        const hscSubjects = s.main_subjects.length > 0 ? JSON.stringify(s.main_subjects) : '[]';
        const fourthSubject = program === 'HSC' 
          ? (s.fourth_subject || (hscGroup === 'Science' ? 'Higher Math' : hscGroup === 'Business Studies' ? 'Economics' : ''))
          : '';
        
        return {
          // Internal id is session-scoped so the same roll can be reused in
          // other sessions. Login and display keep using class_roll.
          student_id: `${program || ''}::${session}::${s.class_roll}`,
          class_roll: s.class_roll,
          password: s.mobile_number,
          full_name: s.full_name || '',
          mobile_number: s.mobile_number,
          session,
          program: program || '',
          ssc_gpa: s.ssc_gpa || '',
          hsc_group: hscGroupValue,
          hsc_subjects: hscSubjects,
          fourth_subject: fourthSubject,
        };
      });
    
    const skipped = students.length - toInsert.length;
    
    if (toInsert.length === 0) {
      return res.json({ created: 0, skipped, message: 'All students already exist' });
    }
    
    for (const student of toInsert) {
      await sql`
        INSERT INTO students (
          student_id, class_roll, password, full_name, mobile_number, 
          session, program, ssc_gpa, hsc_group, hsc_subjects, fourth_subject
        ) VALUES (
          ${student.student_id}, ${student.class_roll}, ${hashPassword(student.password)}, 
          ${student.full_name}, ${student.mobile_number}, ${student.session}, 
          ${student.program}, ${student.ssc_gpa}, ${student.hsc_group}, 
          ${student.hsc_subjects}, ${student.fourth_subject}
        )
      `;
    }
    
    res.json({ created: toInsert.length, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students - create single student
router.post('/', async (req, res) => {
  try {
    const { class_roll, full_name, mobile_number, session, program, password } = req.body;
    
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!class_roll || !mobile_number) {
      return res.status(400).json({ error: 'Class roll and mobile number required' });
    }
    
    const existing = await sql`SELECT student_id FROM students WHERE class_roll = ${class_roll} AND session = ${session || ''} AND program = ${program || ''}`;
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Class roll already exists in this session' });
    }
    
    const student = {
      student_id: `${program || ''}::${session || ''}::${class_roll}`,
      class_roll,
      password: password || mobile_number,
      full_name: full_name || '',
      mobile_number,
      session: session || '',
      program: program || '',
      ssc_gpa: '',
      hsc_group: null,
      hsc_subjects: '[]',
      fourth_subject: '',
    };
    
    await sql`
      INSERT INTO students (student_id, class_roll, password, full_name, mobile_number, session, program)
      VALUES (${student.student_id}, ${student.class_roll}, ${hashPassword(student.password)}, ${student.full_name}, ${student.mobile_number}, ${student.session}, ${student.program})
    `;
    
    const { password: _, ...safe } = student;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id - delete student
router.delete('/:id', async (req, res) => {
  try {
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Delete related exam marks first to avoid orphaned marks
    await sql`DELETE FROM exam_marks WHERE student_id = ${req.params.id}`;
    await sql`DELETE FROM students WHERE student_id = ${req.params.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/bulk-delete - delete multiple students (principal only)
router.post('/bulk-delete', async (req, res) => {
  try {
    const { studentIds } = req.body;
    
    
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Student IDs array required' });
    }
    
    const principal = await requirePrincipal(req, sql);
    if (!principal) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Delete related exam marks first
    await sql`DELETE FROM exam_marks WHERE student_id = ANY(${studentIds})`;
    // Use a single DELETE with IN clause for efficiency
    await sql`DELETE FROM students WHERE student_id = ANY(${studentIds})`;
    res.json({ success: true, deleted: studentIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/students/:id - update student (self or principal)
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body || {};
    const studentId = req.params.id;

    // A principal may edit anyone; a student may edit only their own record.
    const caller = await requireCaller(req, sql);
    const authorized =
      !!caller && (caller.isPrincipal || (caller.role === 'student' && caller.id === studentId));
    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const ALLOWED_STUDENT_FIELDS = [
      'full_name', 'fathers_name', 'mothers_name',
      'birth_certificate_number', 'gender', 'religion', 'blood_group',
      'father_alive', 'mother_alive',
      'guardian_occupation', 'guardian_phone', 'guardian_annual_income',
      'ssc_gpa', 'ssc_group', 'ssc_passing_year', 'ssc_board',
      'ssc_roll', 'ssc_regi', 'ssc_institute',
      'hsc_group', 'hsc_board',
      'hsc_gpa', 'hsc_passing_year', 'hsc_roll', 'hsc_regi', 'hsc_institute',
      'hsc_subjects', 'fourth_subject',
      'mobile_number', 'present_address', 'permanent_address',
      'department', 'subjects'
      // 'class_roll', 'session', 'program' and 'student_id' are intentionally
      // NOT editable — the principal assigns them and exams match on them.
    ];

    const clean = {};
    for (const k of ALLOWED_STUDENT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(updates, k)) {
        clean[k] = updates[k];
      }
    }
    clean.updated_at = new Date().toISOString();

    const keys = Object.keys(clean);
    if (keys.length === 0) {
      const rows = await sql`SELECT * FROM students WHERE student_id = ${studentId}`;
      const { password: _, ...safe } = rows[0];
      return res.json(safe);
    }

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(clean);
    const query = `UPDATE students SET ${setClause} WHERE student_id = $1 RETURNING *`;
    const rows = await sql.query(query, [studentId, ...values]);
    const { password: _, ...safe } = rows[0];
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;