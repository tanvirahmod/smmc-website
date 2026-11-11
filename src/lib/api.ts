import type { NeonQueryFunction } from '@neondatabase/serverless';
import { effectiveFourthSubjectFor } from './subjects';
// Pure rules live in examRules so the browser bundle (via apiClient) never
// pulls in the database driver. Re-exported here to keep this module's API.
// Only the one pure rule used in this module is imported locally; the rest are
// re-exported below straight from `examRules` (a local import would be unused).
import { MAX_PRACTICAL_MARKS } from './examRules';
export type { SubjectPassMarks, ExamPassMarks, ExamFail } from './examRules';
export {
  getSubjectPassMarks,
  getStudentFails,
  isTotalOnlySubject,
  MAX_PRACTICAL_MARKS,
} from './examRules';
import type { ExamPassMarks } from './examRules';

/**
 * This module is TYPE-ONLY at runtime.
 *
 * It used to open a Neon connection straight from the browser using a
 * `VITE_`-prefixed connection string. Vite inlines `VITE_*` values into the
 * client bundle, so that shipped the database password to every visitor.
 * All data now goes through the API server (see `apiClient.ts`), and this
 * client is a tripwire: importing this module for its runtime values fails
 * loudly instead of silently exposing a database credential.
 */
const sql = (() => {
  throw new Error(
    'lib/api.ts is type-only: the browser must call the API server, not the database directly.'
  );
})() as unknown as NeonQueryFunction<false, false>;

export interface Teacher {
  id: string;
  teacher_id: string;
  password: string;
  full_name: string;
  fathers_name: string;
  mothers_name: string;
  dob: string;
  mobile_number: string;
  email: string;
  tmis_no: string;
  ttis_no: string;
  current_address: string;
  permanent_address: string;
  nid_number: string;
  blood_group: string;
  gender: string;
  religion: string;
  joining_date: string;
  appointment_date: string;
  designation: string;
  subject: string;
  program: string;
  employment_type: string;
  appointment_type: string;
  pending_lawsuits: string;
  /** Export order: 1 = most senior. Null = unset, sorts after numbered. */
  seniority_priority: number | null;
  mpo_date: string;
  index_number: string;
  salary_grade: string;
  basic_scale: string;
  training_names: string;
  education_ssc: string;
  education_hsc: string;
  education_honours: string;
  education_masters: string;
  edu_ssc_year: string;
  edu_ssc_board: string;
  edu_ssc_result: string;
  edu_hsc_year: string;
  edu_hsc_board: string;
  edu_hsc_result: string;
  edu_honours_year: string;
  edu_honours_board: string;
  edu_honours_result: string;
  edu_masters_year: string;
  edu_masters_board: string;
  edu_masters_result: string;
  profile_pic_url: string;
  is_principal: boolean;
  can_write_notice: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  class: string | null;
  author: string | null;
  /** Department slug for department notices; null = main notice board. */
  department: string | null;
  published_date: string;
  created_at: string;
}

export async function fetchNotices(department?: string): Promise<Notice[]> {
  const rows = department
    ? await sql`SELECT * FROM notices WHERE department = ${department} ORDER BY published_date DESC`
    : await sql`SELECT * FROM notices WHERE department IS NULL ORDER BY published_date DESC`;
  return rows as Notice[];
}

export interface DepartmentStaff {
  id: string;
  department_slug: string;
  teacher_id: string;
  role: 'head' | 'member';
  created_at: string;
}

const VALID_DEPARTMENT_SLUGS = [
  'honours-english',
  'honours-political-science',
  'honours-sociology',
  'degree-ba',
  'degree-bss',
];

export async function fetchDepartmentStaff(department?: string, teacherId?: string): Promise<DepartmentStaff[]> {
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
  return rows as DepartmentStaff[];
}

export async function saveDepartmentStaff(
  principal_id: string,
  principal_password: string,
  teacherId: string,
  departmentSlug: string,
  role: 'head' | 'member'
): Promise<DepartmentStaff> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  if (!VALID_DEPARTMENT_SLUGS.includes(departmentSlug)) throw new Error('Invalid department');
  if (role !== 'head' && role !== 'member') throw new Error('Role must be head or member');
  const rows = await sql`
    INSERT INTO department_staff (department_slug, teacher_id, role)
    VALUES (${departmentSlug}, ${teacherId}, ${role})
    ON CONFLICT (department_slug, teacher_id)
    DO UPDATE SET role = ${role}
    RETURNING *
  `;
  return rows[0] as DepartmentStaff;
}

export async function removeDepartmentStaff(
  principal_id: string,
  principal_password: string,
  teacherId: string,
  departmentSlug: string
): Promise<void> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  await sql`DELETE FROM department_staff WHERE department_slug = ${departmentSlug} AND teacher_id = ${teacherId}`;
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const rows = await sql`SELECT * FROM teachers ORDER BY created_at ASC`;
  return rows as Teacher[];
}

export async function loginTeacher(teacher_id: string, password: string): Promise<Omit<Teacher, 'password'>> {
  const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
  const teacher = rows[0] as Teacher | undefined;
  if (!teacher) throw new Error('Teacher not found');
  if (teacher.password !== password) throw new Error('Invalid password');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = teacher;
  return safe;
}

export async function createTeacher(
  principal_id: string,
  principal_password: string,
  teacher_id: string,
  password: string,
  full_name: string
): Promise<Omit<Teacher, 'password'>> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  if (!teacher_id || !password) throw new Error('Teacher ID and password required');

  const existing = await sql`SELECT teacher_id FROM teachers WHERE teacher_id = ${teacher_id}`;
  if (existing.length > 0) throw new Error('Teacher ID already exists');

  const rows = await sql`INSERT INTO teachers (teacher_id, password, full_name) VALUES (${teacher_id}, ${password}, ${full_name || ''}) RETURNING *`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = rows[0] as Teacher;
  return safe;
}

export async function updateTeacher(
  caller_id: string,
  caller_password: string,
  teacher_id: string,
  updates: Partial<Teacher>
): Promise<Omit<Teacher, 'password'>> {
  const callerRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${caller_id}`;
  const caller = callerRows[0] as Teacher | undefined;
  if (!caller || caller.password !== caller_password) {
    throw new Error('Unauthorized');
  }
  const isSelf = caller.teacher_id === teacher_id;
  if (!isSelf && !caller.is_principal) {
    throw new Error('Unauthorized');
  }

  const allowed = [
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
  ] as const;
  const dateColumns = new Set(['dob', 'joining_date', 'appointment_date', 'mpo_date']);
  const clean: Record<string, unknown> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, k)) {
      const v = (updates as Record<string, unknown>)[k];
      clean[k] = dateColumns.has(k) && v === '' ? null : v;
    }
  }
  clean.updated_at = new Date().toISOString();

  const keys = Object.keys(clean);
  if (keys.length === 0) {
    const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...safe } = rows[0] as Teacher;
    return safe;
  }

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = Object.values(clean);
  
  const query = `UPDATE teachers SET ${setClause} WHERE teacher_id = $1 RETURNING *`;
  const rows = await sql.query(query, [teacher_id, ...values]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = rows[0] as Teacher;
  return safe;
}

export async function createNotice(
  principal_id: string,
  principal_password: string,
  title: string,
  content: string,
  category: string,
  noticeClass: string
): Promise<Notice> {
  let authorLabel = 'Principal';
  let authorized = false;

  if (principal_id && principal_password) {
    const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
    const principal = rows[0] as Teacher | undefined;
    if (principal && principal.is_principal && principal.password === principal_password) {
      authorized = true;
      authorLabel = principal.full_name || 'Principal';
    }
  }

  if (!authorized) throw new Error('Unauthorized');
  if (!title || !content) throw new Error('Title and content required');

  const rows = await sql`INSERT INTO notices (title, content, category, class, author) VALUES (${title}, ${content}, ${category || 'general'}, ${noticeClass || null}, ${authorLabel}) RETURNING *`;
  return rows[0] as Notice;
}

export async function deleteNotice(principal_id: string, principal_password: string, noticeId: string): Promise<void> {
  let authorized = false;

  if (principal_id && principal_password) {
    const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
    const principal = rows[0] as Teacher | undefined;
    if (principal && principal.is_principal && principal.password === principal_password) {
      authorized = true;
    }
  }

  if (!authorized) throw new Error('Unauthorized');

  await sql`DELETE FROM notices WHERE id = ${noticeId}`;
}

export async function createTeacherNotice(
  teacher_id: string,
  teacher_password: string,
  title: string,
  content: string,
  category: string,
  noticeClass: string,
  department?: string
): Promise<Notice> {
  const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
  const t = rows[0] as Teacher | undefined;
  if (!t || t.password !== teacher_password) {
    throw new Error('Unauthorized');
  }
  if (department) {
    if (!VALID_DEPARTMENT_SLUGS.includes(department)) throw new Error('Invalid department');
    const member = await sql`SELECT * FROM department_staff WHERE department_slug = ${department} AND teacher_id = ${teacher_id}`;
    if (!member[0]) throw new Error('You are not assigned to this department');
  } else if (!t.can_write_notice) {
    throw new Error('Unauthorized');
  }

  const authorLabel = t.full_name || t.teacher_id;
  const insertRows = await sql`INSERT INTO notices (title, content, category, class, author, department) VALUES (${title}, ${content}, ${category || 'general'}, ${noticeClass || null}, ${authorLabel}, ${department || null}) RETURNING *`;
  return insertRows[0] as Notice;
}

export async function deleteTeacherNotice(teacher_id: string, teacher_password: string, noticeId: string): Promise<void> {
  const rows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
  const t = rows[0] as Teacher | undefined;
  if (!t || t.password !== teacher_password) {
    throw new Error('Unauthorized');
  }
  if (!t.can_write_notice) {
    const target = await sql`SELECT department FROM notices WHERE id = ${noticeId}`;
    const dept = (target[0] as { department?: string } | undefined)?.department;
    if (!dept) throw new Error('Unauthorized');
    const member = await sql`SELECT * FROM department_staff WHERE department_slug = ${dept} AND teacher_id = ${teacher_id}`;
    if (!member[0]) throw new Error('Unauthorized');
  }

  await sql`DELETE FROM notices WHERE id = ${noticeId}`;
}

export async function toggleTeacherNoticeAccess(
  principal_id: string,
  principal_password: string,
  target_teacher_id: string,
  can_write_notice: boolean
): Promise<Omit<Teacher, 'password'>> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  if (!target_teacher_id) throw new Error('Target teacher ID required');

  const rows = await sql`UPDATE teachers SET can_write_notice = ${can_write_notice}, updated_at = ${new Date().toISOString()} WHERE teacher_id = ${target_teacher_id} RETURNING *`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = rows[0] as Teacher;
  return safe;
}

export interface Student {
  id: string;
  student_id: string;
  class_roll: string;
  session: string;
  program: string;
  department: string;
  subjects: string;
  full_name: string;
  fathers_name: string;
  mothers_name: string;
  birth_certificate_number: string;
  gender: string;
  religion: string;
  blood_group: string;
  father_alive: string;
  mother_alive: string;
  guardian_occupation: string;
  guardian_phone: string;
  guardian_annual_income: string;
  ssc_gpa: string;
  ssc_group: string;
  ssc_passing_year: string;
  ssc_board: string;
  ssc_roll: string;
  ssc_regi: string;
  ssc_institute: string;
  hsc_group: string;
  hsc_board: string;
  hsc_gpa: string;
  hsc_passing_year: string;
  hsc_roll: string;
  hsc_regi: string;
  hsc_institute: string;
  hsc_subjects: string;
  fourth_subject: string;
  mobile_number: string;
  present_address: string;
  permanent_address: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export async function fetchStudents(): Promise<Student[]> {
  const rows = await sql`SELECT * FROM students ORDER BY created_at ASC`;
  return rows as Student[];
}

export async function fetchStudentSessions(): Promise<string[]> {
  const rows = await sql`SELECT DISTINCT session FROM students WHERE session IS NOT NULL AND session <> '' ORDER BY session DESC`;
  return rows.map((r) => (r as { session: string }).session);
}

function parseSubjectList(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || '[]');
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * True when a student takes `subject` — either as a main subject, as their
 * effective 4th subject, or (Degree/Honours) as their department. The 4th
 * subject must go through effectiveFourthSubjectFor so group-mandatory 4th
 * subjects (Science → Higher Math, Business → Economics) always match, even
 * when the profile field holds a stale value from another group.
 */
function studentHasSubject(s: Student, subject: string): boolean {
  const target = subject.toLowerCase();
  const mainSubjects = [...parseSubjectList(s.hsc_subjects), ...parseSubjectList(s.subjects)];
  if (mainSubjects.some((x) => x.toLowerCase() === target)) return true;
  const fourth = effectiveFourthSubjectFor(s.fourth_subject, s.hsc_group);
  if (fourth && fourth.toLowerCase() === target) return true;
  return (s.department || '').toLowerCase() === target;
}

export async function fetchStudentsBySubject(
  subject: string,
  session?: string,
  program?: string
): Promise<Student[]> {
  if (!subject) return [];
  // Fetch broadly by program/session, then match precisely in JS so 4th-subject
  // semantics (group-mandatory fallback) are applied consistently.
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (session) {
    conditions.push(`session = $${values.length + 1}`);
    values.push(session);
  }
  if (program) {
    conditions.push(`program = $${values.length + 1}`);
    values.push(program);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT * FROM students ${whereClause} ORDER BY created_at ASC`;
  const rows = await sql.query(query, values);
  return (rows as Student[]).filter((s) => studentHasSubject(s, subject));
}

export async function loginStudent(student_id: string, password: string, program: string, session?: string): Promise<Omit<Student, 'password'>> {
  let studentRows;
  if (session) {
    studentRows = program
      ? await sql`SELECT * FROM students WHERE class_roll = ${student_id} AND session = ${session} AND program = ${program}`
      : await sql`SELECT * FROM students WHERE class_roll = ${student_id} AND session = ${session}`;
  } else {
    studentRows = await sql`SELECT * FROM students WHERE class_roll = ${student_id}`;
  }
  let student = studentRows[0] as Student | undefined;
  
  if (!student) {
    studentRows = await sql`SELECT * FROM students WHERE student_id = ${student_id}`;
    student = studentRows[0] as Student | undefined;
  }

  if (!student) throw new Error('Student not found');
  if (student.password !== password) throw new Error('Invalid password');
  if (program && student.program && student.program !== program) {
    throw new Error('Program does not match');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = student;
  return safe;
}

export async function createStudent(
  principal_id: string,
  principal_password: string,
  class_roll: string,
  password: string,
  full_name: string,
  session: string,
  program: string
): Promise<Omit<Student, 'password'>> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  if (!class_roll || !password) throw new Error('Class roll and mobile number required');

  const existing = await sql`SELECT student_id FROM students WHERE class_roll = ${class_roll} AND session = ${session || ''} AND program = ${program || ''}`;
  if (existing.length > 0) throw new Error('Class roll already exists in this session');

  const rows = await sql`INSERT INTO students (student_id, class_roll, password, full_name, mobile_number, session, program) VALUES (${`${program || ''}::${session || ''}::${class_roll}`}, ${class_roll}, ${password}, ${full_name || ''}, ${password}, ${session || ''}, ${program || ''}) RETURNING *`;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = rows[0] as Student;
  return safe;
}

export async function bulkCreateStudents(
  principal_id: string,
  principal_password: string,
  students: {
    class_roll: string;
    full_name: string;
    ssc_gpa: string;
    main_subjects: string[]; // Now contains all subjects (mandatory + additional)
    fourth_subject: string;
    mobile_number: string;
  }[],
  session: string,
  program: string,
  hscGroup?: string
): Promise<{ created: number; skipped: number; message?: string }> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  if (!students || !Array.isArray(students) || students.length === 0) {
    throw new Error('No student data provided');
  }
  if (!session) throw new Error('Session is required');

  // Validate HSC group and subjects if HSC program
  if (program === 'HSC' && hscGroup) {
    const validGroups = ['Humanities', 'Science', 'Business Studies'];
    if (!validGroups.includes(hscGroup)) {
      throw new Error(`Invalid HSC group: ${hscGroup}`);
    }
    
    // Define allowed additional subjects per group (beyond the 3 mandatory: Bangla, English, ICT)
    const groupAdditionalSubjects: Record<string, string[]> = {
      'Humanities': ['Civics', 'Sociology', 'Islamic History and Culture', 'Logic', 'Economics', 'Islamic Studies'],
      'Science': ['Physics', 'Chemistry', 'Biology'],
      'Business Studies': ['Accounting', 'Business Organization and Management', 'Production Management and Marketing', 'Economics'],
    };
    
    const allowedAdditional = groupAdditionalSubjects[hscGroup] || [];
    const mandatorySubjects = ['Bangla', 'English', 'ICT'];

    // Defaults when the 3 additional columns are empty: Science gets
    // Physics/Chemistry/Biology, Business Studies gets Accounting/Business
    // Organization and Management/Production Management and Marketing.
    const groupDefaultAdditional: Record<string, string[]> = {
      'Science': ['Physics', 'Chemistry', 'Biology'],
      'Business Studies': ['Accounting', 'Business Organization and Management', 'Production Management and Marketing'],
    };
    const defaultAdditional = groupDefaultAdditional[hscGroup] || [];
    for (const student of students) {
      const cur = Array.isArray(student.main_subjects) ? student.main_subjects : [];
      if (cur.slice(3).length === 0 && defaultAdditional.length > 0) {
        student.main_subjects = [...mandatorySubjects, ...defaultAdditional];
      }
    }
    
    for (const student of students) {
      // Verify mandatory subjects are present
      for (const mandatory of mandatorySubjects) {
        if (!student.main_subjects.includes(mandatory)) {
          throw new Error(`Missing mandatory subject "${mandatory}" for student ${student.class_roll}`);
        }
      }
      
      // Validate additional subjects (beyond the first 3 mandatory)
      const additionalSubjects = student.main_subjects.slice(3);
      if (additionalSubjects.length !== 3) {
        throw new Error(`Student ${student.class_roll} must have exactly 3 additional subjects (total 6 including mandatory Bangla, English, ICT)`);
      }
      
      for (const subject of additionalSubjects) {
        if (!allowedAdditional.includes(subject)) {
          throw new Error(`Subject "${subject}" is not valid for ${hscGroup} group. Allowed: ${allowedAdditional.join(', ')}`);
        }
      }
      
      // Validate fourth subject
      const fourthSubject = student.fourth_subject;
      const groupFourthSubjects: Record<string, string[]> = {
        'Humanities': ['Civics', 'Sociology', 'Islamic History and Culture', 'Logic', 'Economics', 'Islamic Studies'],
        'Science': ['Higher Math'],
        'Business Studies': ['Economics'],
      };
      const allowedFourth = groupFourthSubjects[hscGroup] || [];
      if (fourthSubject && !allowedFourth.includes(fourthSubject)) {
        throw new Error(`Fourth subject "${fourthSubject}" is not valid for ${hscGroup} group. Allowed: ${allowedFourth.join(', ')}`);
      }
    }
  }

  const rolls = students.map((s) => s.class_roll).filter(Boolean);
  const existingRows = await sql`SELECT class_roll FROM students WHERE session = ${session} AND program = ${program || ''} AND class_roll = ANY(${rolls})`;
  const existingRolls = new Set(existingRows.map((r) => (r as { class_roll: string }).class_roll));

  const seenInFile = new Set<string>();
  const toInsert = students
    .filter((s) => {
      if (!s.class_roll || !s.mobile_number) return false;
      if (existingRolls.has(s.class_roll)) return false;
      // Skip duplicate rolls within the same upload — only the first is kept.
      if (seenInFile.has(s.class_roll)) return false;
      seenInFile.add(s.class_roll);
      return true;
    })
    .map((s) => {
      const hscGroupValue = program === 'HSC' ? (hscGroup || 'Humanities') : null;
      const hscSubjects = s.main_subjects.length > 0 ? JSON.stringify(s.main_subjects) : '[]';
      const fourthSubject = program === 'HSC' ? (s.fourth_subject || (hscGroup === 'Science' ? 'Higher Math' : hscGroup === 'Business Studies' ? 'Economics' : '')) : '';
      
      return {
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
    return { created: 0, skipped, message: 'All students already exist' };
  }

  for (const student of toInsert) {
    await sql`
      INSERT INTO students (
        student_id, class_roll, password, full_name, mobile_number, 
        session, program, ssc_gpa, hsc_group, hsc_subjects, fourth_subject
      ) VALUES (
        ${student.student_id}, ${student.class_roll}, ${student.password}, 
        ${student.full_name}, ${student.mobile_number}, ${student.session}, 
        ${student.program}, ${student.ssc_gpa}, ${student.hsc_group}, 
        ${student.hsc_subjects}, ${student.fourth_subject}
      )
    `;
  }

  return { created: toInsert.length, skipped };
}

export async function updateStudent(student_id: string, password: string, updates: Partial<Student>): Promise<Omit<Student, 'password'>> {
  const studentRows = await sql`SELECT password FROM students WHERE student_id = ${student_id}`;
  const student = studentRows[0] as { password: string } | undefined;
  if (!student || student.password !== password) {
    throw new Error('Unauthorized');
  }

  const allowed = [
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
    // 'class_roll', 'session', and 'program' are intentionally NOT editable by
    // students — the principal assigns them and exams match students on them.
  ] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(updates, k)) clean[k] = (updates as Record<string, unknown>)[k];
  }
  clean.updated_at = new Date().toISOString();

  const keys = Object.keys(clean);
  if (keys.length === 0) {
    const rows = await sql`SELECT * FROM students WHERE student_id = ${student_id}`;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...safe } = rows[0] as Student;
    return safe;
  }

  const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = Object.values(clean);
  
  const query = `UPDATE students SET ${setClause} WHERE student_id = $1 RETURNING *`;
  const rows = await sql.query(query, [student_id, ...values]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _, ...safe } = rows[0] as Student;
  return safe;
}

export async function deleteTeacher(principal_id: string, principal_password: string, teacher_id: string): Promise<void> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  if (teacher_id === principal_id) throw new Error('Cannot delete yourself');

  await sql`DELETE FROM teachers WHERE teacher_id = ${teacher_id}`;
}

export async function deleteStudent(principal_id: string, principal_password: string, student_id: string): Promise<void> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }

  await sql`DELETE FROM students WHERE student_id = ${student_id}`;
}

export interface Exam {
  id: string;
  name: string;
  program: string;
  session: string;
  subjects: string[];
  is_active: boolean;
  created_by: string | null;
  marks_count?: number;
  pass_marks?: ExamPassMarks;
  created_at: string;
  updated_at: string;
}

export type ExamMarkStatus = 'present' | 'absent' | 'expelled';

export interface ExamMark {
  id: string;
  exam_id: string;
  student_id: string;
  subject: string;
  cq: number;
  mcq: number;
  status: ExamMarkStatus;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

function parseExamMark(row: Record<string, unknown>): ExamMark {
  return {
    ...row,
    cq: Number(row.cq),
    mcq: Number(row.mcq),
  } as ExamMark;
}

function cleanPassMarks(
  subjects: string[],
  passMarks: ExamPassMarks | undefined
): ExamPassMarks {
  const clean: ExamPassMarks = {};
  if (!passMarks) return clean;
  for (const s of subjects) {
    const pm = passMarks[s];
    if (!pm) continue;
    const outOfCq = Number(pm.outOfCq) || 0;
    const outOfMcq = Number(pm.outOfMcq) || 0;
    const cqPass = pm.cqPass == null ? null : Math.max(0, Number(pm.cqPass) || 0);
    const mcqPass = pm.mcqPass == null ? null : Math.max(0, Number(pm.mcqPass) || 0);
    const totalOnly = pm.totalOnly === true;
    if (outOfCq > 0 || outOfMcq > 0 || cqPass != null || mcqPass != null || totalOnly) {
      clean[s] = { outOfCq, cqPass, outOfMcq, mcqPass, ...(totalOnly ? { totalOnly: true as const } : {}) };
    }
    // cqPass/mcqPass above full marks are not rejected here, but the UI caps
    // them; a pass mark ≥ full marks simply means nobody can pass that component.
  }
  return clean;
}

export async function createExam(
  principal_id: string,
  principal_password: string,
  name: string,
  program: string,
  session: string,
  subjects: string[],
  is_active = false,
  passMarks?: ExamPassMarks
): Promise<Exam> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  const cleanSubjects = Array.from(new Set(subjects.filter((s) => s && s.trim())));
  if (!name || !program || !session || cleanSubjects.length === 0) {
    throw new Error('Exam name, class, session, and at least one subject are required');
  }

  const rows = await sql`
    INSERT INTO exams (name, program, session, subjects, is_active, created_by, pass_marks)
    VALUES (${name}, ${program}, ${session}, ${cleanSubjects}, ${is_active}, ${principal_id}, ${cleanPassMarks(cleanSubjects, passMarks)})
    RETURNING *
  `;
  return rows[0] as Exam;
}

export async function fetchExams(): Promise<Exam[]> {
  const rows = await sql`
    SELECT e.*, COUNT(em.id)::int AS marks_count
    FROM exams e
    LEFT JOIN exam_marks em ON em.exam_id = e.id
    GROUP BY e.id
    ORDER BY e.created_at DESC
  `;
  return rows as Exam[];
}

export async function fetchActiveExams(subject?: string): Promise<Exam[]> {
  const rows = subject
    ? await sql`SELECT * FROM exams WHERE is_active = true AND ${subject} = ANY(subjects) ORDER BY created_at DESC`
    : await sql`SELECT * FROM exams WHERE is_active = true ORDER BY created_at DESC`;
  return rows as Exam[];
}

export async function toggleExamActive(
  principal_id: string,
  principal_password: string,
  examId: string,
  is_active: boolean
): Promise<Exam> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }

  const rows = await sql`
    UPDATE exams SET is_active = ${is_active}, updated_at = ${new Date().toISOString()}
    WHERE id = ${examId} RETURNING *
  `;
  return rows[0] as Exam;
}

export async function updateExamSubjects(
  principal_id: string,
  principal_password: string,
  examId: string,
  subjects: string[]
): Promise<Exam> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }

  const cleanSubjects = Array.from(new Set(subjects.filter((s) => s && s.trim())));
  if (cleanSubjects.length === 0) {
    throw new Error('At least one subject is required');
  }

  // Prune pass-marks entries for subjects that are no longer on the exam.
  const previous = await sql`SELECT pass_marks FROM exams WHERE id = ${examId}`;
  const previousMarks = (previous[0] as { pass_marks?: ExamPassMarks } | undefined)?.pass_marks || {};
  const kept: ExamPassMarks = {};
  for (const s of cleanSubjects) {
    if (previousMarks[s]) kept[s] = previousMarks[s];
  }

  const rows = await sql`
    UPDATE exams SET subjects = ${cleanSubjects}, pass_marks = ${kept}, updated_at = ${new Date().toISOString()}
    WHERE id = ${examId} RETURNING *
  `;
  return rows[0] as Exam;
}

export async function updateExamPassMarks(
  principal_id: string,
  principal_password: string,
  examId: string,
  passMarks: ExamPassMarks
): Promise<Exam> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }

  const examRows = await sql`SELECT subjects FROM exams WHERE id = ${examId}`;
  const exam = examRows[0] as { subjects: string[] } | undefined;
  if (!exam) throw new Error('Exam not found');

  const rows = await sql`
    UPDATE exams SET pass_marks = ${cleanPassMarks(exam.subjects, passMarks)}, updated_at = ${new Date().toISOString()}
    WHERE id = ${examId} RETURNING *
  `;
  return rows[0] as Exam;
}

export async function deleteExam(
  principal_id: string,
  principal_password: string,
  examId: string
): Promise<void> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }

  await sql`DELETE FROM exams WHERE id = ${examId}`;
}

export async function fetchExamMarks(examId: string, subject?: string): Promise<ExamMark[]> {
  const rows = subject
    ? await sql`SELECT * FROM exam_marks WHERE exam_id = ${examId} AND subject = ${subject} ORDER BY student_id ASC`
    : await sql`SELECT * FROM exam_marks WHERE exam_id = ${examId} ORDER BY student_id ASC`;
  return rows.map((r) => parseExamMark(r as unknown as Record<string, unknown>));
}

// Upper bound for a single CQ or MCQ entry. The schema has no per-subject maximum,
// so this generous sanity cap just stops obvious typos (e.g. 1000).
const MAX_COMPONENT_MARKS = 200;

export async function saveExamMark(
  teacher_id: string,
  teacher_password: string,
  examId: string,
  student_id: string,
  cq: number,
  mcq: number,
  status: ExamMarkStatus = 'present'
): Promise<ExamMark> {
  const teacherRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
  const teacher = teacherRows[0] as Teacher | undefined;
  if (!teacher || teacher.password !== teacher_password) {
    throw new Error('Unauthorized');
  }
  if (isNaN(cq) || isNaN(mcq) || cq < 0 || mcq < 0 || cq > MAX_COMPONENT_MARKS || mcq > MAX_COMPONENT_MARKS) {
    throw new Error(`Marks must be between 0 and ${MAX_COMPONENT_MARKS}`);
  }
  if (status !== 'present' && status !== 'absent' && status !== 'expelled') {
    throw new Error('Invalid mark status');
  }
  const subject = (teacher.subject || '').trim();
  if (!subject) {
    throw new Error('Your teaching subject is not set. Update your profile first.');
  }

  const examRows = await sql`SELECT * FROM exams WHERE id = ${examId}`;
  const exam = examRows[0] as Exam | undefined;
  if (!exam) throw new Error('Exam not found');
  if (!exam.is_active) {
    throw new Error('This exam is not active. Marks can only be entered while the exam is active.');
  }
  if (!exam.subjects.includes(subject)) {
    throw new Error(`This exam does not include ${subject}.`);
  }

  const rows = await sql`
    INSERT INTO exam_marks (exam_id, student_id, subject, cq, mcq, status, entered_by)
    VALUES (${examId}, ${student_id}, ${subject}, ${cq}, ${mcq}, ${status}, ${teacher_id})
    ON CONFLICT (exam_id, student_id, subject)
    DO UPDATE SET cq = ${cq}, mcq = ${mcq}, status = ${status}, entered_by = ${teacher_id}, updated_at = ${new Date().toISOString()}
    RETURNING *
  `;
  return parseExamMark(rows[0] as unknown as Record<string, unknown>);
}

/**
 * Removes a student's saved mark row for the teacher's subject, returning them
 * to "Pending". Same guardrails as saveExamMark: teacher must authenticate and
 * the exam must be active and include their subject.
 */
export async function deleteExamMark(
  teacher_id: string,
  teacher_password: string,
  examId: string,
  student_id: string
): Promise<void> {
  const teacherRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${teacher_id}`;
  const teacher = teacherRows[0] as Teacher | undefined;
  if (!teacher || teacher.password !== teacher_password) {
    throw new Error('Unauthorized');
  }
  const subject = (teacher.subject || '').trim();
  if (!subject) {
    throw new Error('Your teaching subject is not set. Update your profile first.');
  }
  const examRows = await sql`SELECT * FROM exams WHERE id = ${examId}`;
  const exam = examRows[0] as Exam | undefined;
  if (!exam) throw new Error('Exam not found');
  if (!exam.is_active) {
    throw new Error('This exam is not active. Marks can only be changed while the exam is active.');
  }
  if (!exam.subjects.includes(subject)) {
    throw new Error(`This exam does not include ${subject}.`);
  }
  await sql`
    DELETE FROM exam_marks
    WHERE exam_id = ${examId} AND student_id = ${student_id} AND subject = ${subject}
  `;
}

/** One practical-marks value per student per exam (Science group), summed into Total. */
export interface ExamPracticalMark {
  id: string;
  exam_id: string;
  student_id: string;
  marks: number;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchPracticalMarks(examId: string): Promise<ExamPracticalMark[]> {
  const rows = await sql`SELECT * FROM exam_practical_marks WHERE exam_id = ${examId} ORDER BY student_id ASC`;
  return (rows as Record<string, unknown>[]).map((r) => ({ ...r, marks: Number(r.marks) }) as ExamPracticalMark);
}

export async function savePracticalMarks(
  principal_id: string,
  principal_password: string,
  examId: string,
  entries: { studentId: string; marks: number }[]
): Promise<ExamPracticalMark[]> {
  const principalRows = await sql`SELECT * FROM teachers WHERE teacher_id = ${principal_id}`;
  const principal = principalRows[0] as Teacher | undefined;
  if (!principal || !principal.is_principal || principal.password !== principal_password) {
    throw new Error('Unauthorized');
  }
  const examRows = await sql`SELECT * FROM exams WHERE id = ${examId}`;
  if (!examRows[0]) throw new Error('Exam not found');
  if (!entries || entries.length === 0) throw new Error('No practical marks provided');

  const saved: ExamPracticalMark[] = [];
  for (const e of entries) {
    const marks = Number(e.marks);
    if (!e.studentId || isNaN(marks) || marks < 0 || marks > MAX_PRACTICAL_MARKS) {
      throw new Error(`Invalid practical marks for ${e.studentId || 'a student'} (0–${MAX_PRACTICAL_MARKS})`);
    }
    const rows = await sql`
      INSERT INTO exam_practical_marks (exam_id, student_id, marks, entered_by)
      VALUES (${examId}, ${e.studentId}, ${marks}, ${principal_id})
      ON CONFLICT (exam_id, student_id)
      DO UPDATE SET marks = ${marks}, entered_by = ${principal_id}, updated_at = ${new Date().toISOString()}
      RETURNING *
    `;
    const row = rows[0] as unknown as Record<string, unknown>;
    saved.push({ ...row, marks: Number(row.marks) } as ExamPracticalMark);
  }
  return saved;
}

export async function fetchStudentsForExam(examId: string, subject: string): Promise<Student[]> {  const examRows = await sql`SELECT * FROM exams WHERE id = ${examId}`;
  const exam = examRows[0] as Exam | undefined;
  if (!exam || !subject) return [];

  const rows = await sql.query(
    `SELECT * FROM students
     WHERE program = $1 AND session = $2
     ORDER BY created_at ASC`,
    [exam.program, exam.session]
  );
  const students = (rows as Student[]).filter((s) => studentHasSubject(s, subject));
  return students.sort((a, b) =>
    (a.class_roll || a.student_id || '').localeCompare(
      (b.class_roll || b.student_id || ''),
      undefined,
      { numeric: true }
    )
  );
}

export async function fetchStudentsForExamResult(examId: string): Promise<Student[]> {
  const examRows = await sql`SELECT * FROM exams WHERE id = ${examId}`;
  const exam = examRows[0] as Exam | undefined;
  if (!exam) return [];

  const rows = await sql`
    SELECT * FROM students
    WHERE program = ${exam.program} AND session = ${exam.session}
    ORDER BY created_at ASC
  `;
  const students = rows as Student[];
  return students
    .filter((s) => exam.subjects.some((subj) => studentHasSubject(s, subj)))
    .sort((a, b) =>
      (a.class_roll || a.student_id || '').localeCompare(
        (b.class_roll || b.student_id || ''),
        undefined,
        { numeric: true }
      )
    );
}