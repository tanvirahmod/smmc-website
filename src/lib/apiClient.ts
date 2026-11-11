// API client that calls the backend server instead of direct Neon
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * The signed-in session token, attached to every request.
 *
 * The API server verifies the token and decides what the caller may see: an
 * anonymous visitor only ever receives the public projection, a signed-in
 * member of staff receives the full records. The browser never holds or
 * resends a password.
 */
let authHeaders: Record<string, string> = {};

/** Set on sign-in / restore, cleared on sign-out. Pass null to clear. */
export function setApiCredentials(creds: { token?: string } | null): void {
  const token = creds?.token?.trim();
  authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Credential fields the older client put in request bodies. Identity now
 * travels in the session token, so these are stripped centrally here and never
 * leave the browser.
 *
 * Note that a bare `password` is NOT stripped: it is real data when the
 * principal creates a teacher or student account.
 */
const LEGACY_CREDENTIAL_KEYS = [
  'principalId',
  'principalPassword',
  'teacherId',
  'teacherPassword',
  'callerId',
  'callerPassword',
];

/** Removes credential fields from a JSON request body. */
function withoutLegacyCredentials(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (typeof body !== 'string') return body;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body;
    const record = parsed as Record<string, unknown>;
    let changed = false;
    for (const key of LEGACY_CREDENTIAL_KEYS) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        delete record[key];
        changed = true;
      }
    }
    return changed ? JSON.stringify(record) : body;
  } catch {
    return body;
  }
}

/**
 * Infrastructure failures otherwise look like random data errors: when the API
 * process is missing, Vite's proxy answers every /api call with a bare 500 that
 * has no body at all, and a database blip returns JSON that reads like a stack
 * fragment. Classifying both here lets the UI say what is actually wrong.
 */
export type ApiOfflineState = 'online' | 'api-down' | 'db-down';

export const API_OFFLINE_HELP =
  'Start it with: npm run dev:all   (or: cd server && node index.js)';

let offlineState: ApiOfflineState = 'online';
const offlineListeners = new Set<() => void>();

export function getApiOfflineState(): ApiOfflineState {
  return offlineState;
}

export function subscribeApiOffline(listener: () => void): () => void {
  offlineListeners.add(listener);
  return () => {
    offlineListeners.delete(listener);
  };
}

function setApiOfflineState(next: ApiOfflineState): void {
  if (next === offlineState) return;
  offlineState = next;
  offlineListeners.forEach((listener) => listener());
}

/**
 * Re-probe the API after a failure and clear the banner once both the process
 * and the database answer. Never throws — this is wired to a Retry button.
 */
export async function probeApi(): Promise<boolean> {
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (!health.ok) {
      setApiOfflineState('api-down');
      return false;
    }
    // Notices rather than exams: this must exercise the database without
    // needing staff credentials, or a signed-out probe would look like an
    // outage.
    const notices = await fetch(`${API_BASE}/notices`);
    if (!notices.ok) {
      setApiOfflineState('db-down');
      return false;
    }
    setApiOfflineState('online');
    return true;
  } catch {
    setApiOfflineState('api-down');
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    // Pull `headers`/`body` out of the options so a caller-supplied header set
    // cannot clobber the auth header, and so credential fields are stripped.
    const { headers: optionHeaders, body, ...rest } = options;
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(optionHeaders as Record<string, string> | undefined),
      },
      body: withoutLegacyCredentials(body),
    });
  } catch {
    // fetch() itself failed — dev server gone or machine offline.
    setApiOfflineState('api-down');
    throw new Error(`Could not reach the server. ${API_OFFLINE_HELP}`);
  }

  if (!res.ok) {
    const raw = await res.text();
    let body: { error?: string } = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        // Non-JSON error body — see the 5xx branch below.
      }
    }

    if (body.error) {
      setApiOfflineState(/database temporarily unreachable/i.test(body.error) ? 'db-down' : 'online');
      throw new Error(body.error);
    }
    if (res.status >= 500) {
      // A 5xx with no JSON body is the proxy reporting "API process missing".
      setApiOfflineState('api-down');
      throw new Error(`The API server did not respond. ${API_OFFLINE_HELP}`);
    }
    setApiOfflineState('online');
    throw new Error(`HTTP ${res.status}`);
  }

  setApiOfflineState('online');
  return res.json();
}

// Type imports for generic usage
import type { Teacher, Notice, Student, Exam, ExamMark, ExamPracticalMark, DepartmentStaff } from './api';

// --- Notices ---
export async function fetchNotices(department?: string): Promise<Notice[]> {
  const params = department ? `?department=${encodeURIComponent(department)}` : '';
  return request<Notice[]>(`/notices${params}`);
}

export async function createNotice(principal_id: string, principal_password: string, title: string, content: string, category: string, noticeClass: string): Promise<Notice> {
  return request<Notice>('/notices', { method: 'POST', body: JSON.stringify({ principalId: principal_id, principalPassword: principal_password, title, content, category, noticeClass }) });
}

export async function deleteNotice(principal_id: string, principal_password: string, noticeId: string): Promise<void> {
  return request<void>(`/notices/${noticeId}`, { method: 'DELETE', body: JSON.stringify({ principalId: principal_id, principalPassword: principal_password }) });
}

// --- Teachers ---
export async function fetchTeachers(): Promise<Teacher[]> {
  return request<Teacher[]>('/teachers');
}

export type TeacherSession = Teacher & { token: string; expiresIn?: number };
export type StudentSession = Student & { token: string; expiresIn?: number };

export async function loginTeacher(teacher_id: string, password: string): Promise<TeacherSession> {
  return request<TeacherSession>('/teachers/login', { method: 'POST', body: JSON.stringify({ teacher_id, password }) });
}

export async function createTeacher(principalId: string, principalPassword: string, teacher_id: string, password: string, full_name: string): Promise<Teacher> {
  return request<Teacher>('/teachers', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, teacher_id, password, full_name }) });
}

export async function bulkCreateTeachers(principalId: string, principalPassword: string, teachers: unknown[]): Promise<{ created: number; skipped: number; message?: string }> {
  return request<{ created: number; skipped: number; message?: string }>('/teachers/bulk', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, teachers }) });
}

export async function updateTeacher(callerId: string, callerPassword: string, teacherId: string, updates: Record<string, unknown>): Promise<Teacher> {
  return request<Teacher>(`/teachers/${teacherId}`, { method: 'PUT', body: JSON.stringify({ callerId, callerPassword, ...updates }) });
}

export async function deleteTeacher(principalId: string, principalPassword: string, teacherId: string): Promise<void> {
  return request<void>(`/teachers/${teacherId}`, { method: 'DELETE', body: JSON.stringify({ principalId, principalPassword }) });
}

export async function toggleTeacherNoticeAccess(principalId: string, principalPassword: string, targetTeacherId: string, canWriteNotice: boolean): Promise<Teacher> {
  return request<Teacher>(`/teachers/${targetTeacherId}/toggle-notice`, { method: 'POST', body: JSON.stringify({ principalId, principalPassword, can_write_notice: canWriteNotice }) });
}

export async function createTeacherNotice(teacherId: string, teacherPassword: string, title: string, content: string, category: string, noticeClass: string, department?: string): Promise<Notice> {
  return request<Notice>('/notices', { method: 'POST', body: JSON.stringify({ teacherId, teacherPassword, title, content, category, noticeClass, department }) });
}

export async function deleteTeacherNotice(teacherId: string, teacherPassword: string, noticeId: string): Promise<void> {
  return request<void>(`/notices/${noticeId}`, { method: 'DELETE', body: JSON.stringify({ teacherId, teacherPassword }) });
}

// --- In-course exams (Honours / Degree) ---
export interface InCourseSubject {
  name: string;
  code: string;
}

export interface InCourseRoutineRow {
  day: string;
  date: string;
  time: string;
  subject: string;
  code: string;
}

/** Normalize stored routine rows (legacy rows without a routine come back []). Exported for checks. */
export function normalizeIncourseRoutine(rows: unknown): InCourseRoutineRow[] {
  if (!Array.isArray(rows)) return [];
  const out: InCourseRoutineRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const row: InCourseRoutineRow = {
      day: String(o.day || '').trim(),
      date: String(o.date || '').trim(),
      time: String(o.time || '').trim(),
      subject: String(o.subject || '').trim(),
      code: String(o.code || '').trim(),
    };
    if (row.day || row.date || row.time || row.subject) out.push(row);
  }
  return out;
}

export interface InCourseExam {
  id: string;
  name: string;
  program: 'Honours' | 'Degree';
  session: string;
  department_slug: string;
  year: string;
  routine: InCourseRoutineRow[];
  subjects: InCourseSubject[];
  paper_out_of: number;
  attendance_out_of: number;
  is_active: boolean;
  created_by: string | null;
  marks_count?: number;
  created_at: string;
  updated_at: string;
}

/** Normalize stored subjects (legacy plain strings or {name, code} objects). Exported for checks. */
export function normalizeIncourseSubjects(
  subjects: unknown
): InCourseSubject[] {
  if (!Array.isArray(subjects)) return [];
  const out: InCourseSubject[] = [];
  for (const s of subjects) {
    if (typeof s === 'string') {
      if (s.trim()) out.push({ name: s.trim(), code: '' });
    } else if (s && typeof s === 'object') {
      const o = s as Record<string, unknown>;
      const name = String(o.name || '').trim();
      if (name) out.push({ name, code: String(o.code || '').trim() });
    }
  }
  return out;
}

export interface InCourseMark {
  id: string;
  exam_id: string;
  student_id: string;
  subject: string;
  paper: number;
  attendance: number;
  status: 'present' | 'absent';
  entered_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Principal ({principalId, principalPassword}) or assigned teacher ({teacherId, teacherPassword}) auth. */
export type InCourseAuth =
  | { principalId: string; principalPassword: string }
  | { teacherId: string; teacherPassword: string };

export async function fetchIncourseExams(filters?: { program?: string; session?: string; department?: string }): Promise<InCourseExam[]> {
  const params = new URLSearchParams();
  if (filters?.program) params.set('program', filters.program);
  if (filters?.session) params.set('session', filters.session);
  if (filters?.department) params.set('department', filters.department);
  const query = params.toString() ? `?${params.toString()}` : '';
  const rows = await request<Record<string, unknown>[]>(`/incourse/exams${query}`);
  return rows.map((r) => ({
    ...r,
    year: String(r.year || ''),
    routine: normalizeIncourseRoutine(r.routine),
    subjects: normalizeIncourseSubjects(r.subjects),
    paper_out_of: Number(r.paper_out_of),
    attendance_out_of: Number(r.attendance_out_of),
  }) as InCourseExam);
}

export async function createIncourseExam(
  auth: InCourseAuth,
  data: { name: string; program: string; session: string; departmentSlug: string; year: string; subjects: InCourseSubject[]; paperOutOf: number; attendanceOutOf: number; isActive: boolean }
): Promise<InCourseExam> {
  const r = await request<Record<string, unknown>>(`/incourse/exams`, { method: 'POST', body: JSON.stringify({ ...auth, ...data }) });
  return { ...r, subjects: normalizeIncourseSubjects(r.subjects), routine: normalizeIncourseRoutine(r.routine), paper_out_of: Number(r.paper_out_of), attendance_out_of: Number(r.attendance_out_of) } as InCourseExam;
}

export async function updateIncourseExam(
  auth: InCourseAuth,
  examId: string,
  data: { name?: string; year?: string; subjects?: InCourseSubject[]; paperOutOf?: number; attendanceOutOf?: number; isActive?: boolean }
): Promise<InCourseExam> {
  const r = await request<Record<string, unknown>>(`/incourse/exams/${examId}`, { method: 'PUT', body: JSON.stringify({ ...auth, ...data }) });
  return { ...r, subjects: normalizeIncourseSubjects(r.subjects), routine: normalizeIncourseRoutine(r.routine), paper_out_of: Number(r.paper_out_of), attendance_out_of: Number(r.attendance_out_of) } as InCourseExam;
}

export async function deleteIncourseExam(auth: InCourseAuth, examId: string): Promise<void> {
  return request<void>(`/incourse/exams/${examId}`, { method: 'DELETE', body: JSON.stringify({ ...auth }) });
}

export async function saveIncourseRoutine(
  auth: InCourseAuth,
  examId: string,
  rows: InCourseRoutineRow[]
): Promise<InCourseExam> {
  const r = await request<Record<string, unknown>>(`/incourse/exams/${examId}/routine`, { method: 'PUT', body: JSON.stringify({ ...auth, rows }) });
  return { ...r, subjects: normalizeIncourseSubjects(r.subjects), routine: normalizeIncourseRoutine(r.routine), paper_out_of: Number(r.paper_out_of), attendance_out_of: Number(r.attendance_out_of) } as InCourseExam;
}

// --- Reusable in-course subject catalog (per program + year + department) ---
export interface InCourseCatalogSubject {
  id: string;
  program: string;
  year: string;
  department_slug: string;
  name: string;
  code: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchIncourseCatalog(filters: { program?: string; year?: string; department?: string }): Promise<InCourseCatalogSubject[]> {
  const params = new URLSearchParams();
  if (filters?.program) params.set('program', filters.program);
  if (filters?.year) params.set('year', filters.year);
  if (filters?.department) params.set('department', filters.department);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<InCourseCatalogSubject[]>(`/incourse/subjects${query}`);
}

export async function saveIncourseCatalogSubjects(
  auth: InCourseAuth,
  data: { program: string; year: string; departmentSlug: string; subjects: { name: string; code: string }[] }
): Promise<InCourseCatalogSubject[]> {
  return request<InCourseCatalogSubject[]>(`/incourse/subjects`, { method: 'POST', body: JSON.stringify({ ...auth, ...data }) });
}

export async function updateIncourseCatalogSubject(
  auth: InCourseAuth,
  subjectId: string,
  data: { name: string; code: string }
): Promise<InCourseCatalogSubject> {
  return request<InCourseCatalogSubject>(`/incourse/subjects/${subjectId}`, { method: 'PUT', body: JSON.stringify({ ...auth, ...data }) });
}

export async function deleteIncourseCatalogSubject(auth: InCourseAuth, subjectId: string): Promise<void> {
  return request<void>(`/incourse/subjects/${subjectId}`, { method: 'DELETE', body: JSON.stringify({ ...auth }) });
}

export async function fetchIncourseMarks(examId: string, subject?: string): Promise<InCourseMark[]> {
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return request<InCourseMark[]>(`/incourse/exams/${examId}/marks${params}`);
}

export async function saveIncourseMark(
  auth: InCourseAuth,
  examId: string,
  studentId: string,
  subject: string,
  paper: number,
  attendance: number,
  status: 'present' | 'absent' = 'present'
): Promise<InCourseMark> {
  return request<InCourseMark>(`/incourse/exams/${examId}/marks`, {
    method: 'POST',
    body: JSON.stringify({ ...auth, studentId, subject, paper, attendance, status }),
  });
}

export async function deleteIncourseMark(auth: InCourseAuth, examId: string, studentId: string, subject: string): Promise<void> {
  return request<void>(`/incourse/exams/${examId}/marks`, { method: 'DELETE', body: JSON.stringify({ ...auth, studentId, subject }) });
}

export async function fetchIncourseStudents(examId: string): Promise<Student[]> {
  return request<Student[]>(`/incourse/exams/${examId}/students`);
}

export async function fetchIncourseResult(examId: string): Promise<{ students: Student[]; marks: InCourseMark[] }> {
  return request<{ students: Student[]; marks: InCourseMark[] }>(`/incourse/exams/${examId}/result`);
}

// --- Department staff (principal assigns heads/members per department) ---
export async function fetchDepartmentStaff(department?: string, teacherId?: string): Promise<DepartmentStaff[]> {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (teacherId) params.set('teacherId', teacherId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<DepartmentStaff[]>(`/departments/staff${query}`);
}

export async function saveDepartmentStaff(principalId: string, principalPassword: string, teacherId: string, departmentSlug: string, role: 'head' | 'member'): Promise<DepartmentStaff> {
  return request<DepartmentStaff>('/departments/staff', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, teacherId, departmentSlug, role }) });
}

export async function removeDepartmentStaff(principalId: string, principalPassword: string, teacherId: string, departmentSlug: string): Promise<void> {
  return request<void>('/departments/staff', { method: 'DELETE', body: JSON.stringify({ principalId, principalPassword, teacherId, departmentSlug }) });
}

// --- Students ---
export async function fetchStudents(limit = 50, offset = 0): Promise<Student[]> {
  return request<Student[]>(`/students?limit=${limit}&offset=${offset}`);
}

export async function fetchStudentsCount(): Promise<{ total: number }> {
  return request<{ total: number }>('/students/count');
}

export async function fetchStudentSessions(): Promise<string[]> {
  return request<string[]>('/students/sessions');
}

export async function fetchStudentsBySubject(subject: string, session?: string, program?: string): Promise<Student[]> {
  const params = new URLSearchParams();
  if (session) params.set('session', session);
  if (program) params.set('program', program);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<Student[]>(`/students/by-subject/${encodeURIComponent(subject)}${query}`);
}

export async function loginStudent(student_id: string, password: string, program: string, session?: string): Promise<StudentSession> {
  return request<StudentSession>('/auth/student/login', { method: 'POST', body: JSON.stringify({ student_id, password, program, session }) });
}

export async function createStudent(principalId: string, principalPassword: string, class_roll: string, password: string, full_name: string, session: string, program: string): Promise<Student> {
  return request<Student>('/students', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, class_roll, password, full_name, session, program }) });
}

export async function bulkCreateStudents(principalId: string, principalPassword: string, students: unknown[], session: string, program: string, hscGroup?: string): Promise<{ created: number; skipped: number; message?: string }> {
  return request<{ created: number; skipped: number; message?: string }>('/students/bulk', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, students, session, program, hscGroup }) });
}

export async function updateStudent(studentId: string, password: string, updates: Record<string, unknown>): Promise<Student> {
  return request<Student>(`/students/${studentId}`, { method: 'PUT', body: JSON.stringify({ callerId: studentId, callerPassword: password, ...updates }) });
}

export async function deleteStudent(principalId: string, principalPassword: string, studentId: string): Promise<void> {
  return request<void>(`/students/${studentId}`, { method: 'DELETE', body: JSON.stringify({ principalId, principalPassword }) });
}

export async function bulkDeleteStudents(principalId: string, principalPassword: string, studentIds: string[]): Promise<{ success: boolean; deleted: number }> {
  return request<{ success: boolean; deleted: number }>('/students/bulk-delete', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, studentIds }) });
}

// --- Exams ---
export async function fetchExams(): Promise<Exam[]> {
  return request<Exam[]>('/exams');
}

export async function fetchActiveExams(subject?: string): Promise<Exam[]> {
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return request<Exam[]>(`/exams/active${params}`);
}

export async function createExam(principalId: string, principalPassword: string, name: string, program: string, session: string, subjects: string[], isActive: boolean, passMarks: Record<string, unknown>): Promise<Exam> {
  return request<Exam>('/exams', { method: 'POST', body: JSON.stringify({ principalId, principalPassword, name, program, session, subjects, is_active: isActive, passMarks }) });
}

export async function toggleExamActive(principalId: string, principalPassword: string, examId: string, isActive: boolean): Promise<Exam> {
  return request<Exam>(`/exams/${examId}/toggle`, { method: 'PUT', body: JSON.stringify({ principalId, principalPassword, is_active: isActive }) });
}

export async function updateExamSubjects(principalId: string, principalPassword: string, examId: string, subjects: string[]): Promise<Exam> {
  return request<Exam>(`/exams/${examId}/subjects`, { method: 'PUT', body: JSON.stringify({ principalId, principalPassword, subjects }) });
}

export async function updateExamPassMarks(principalId: string, principalPassword: string, examId: string, passMarks: Record<string, unknown>): Promise<Exam> {
  return request<Exam>(`/exams/${examId}/pass-marks`, { method: 'PUT', body: JSON.stringify({ principalId, principalPassword, passMarks }) });
}

export async function deleteExam(principalId: string, principalPassword: string, examId: string): Promise<void> {
  return request<void>(`/exams/${examId}`, { method: 'DELETE', body: JSON.stringify({ principalId, principalPassword }) });
}

export async function fetchExamMarks(examId: string, subject?: string): Promise<ExamMark[]> {
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return request<ExamMark[]>(`/exams/${examId}/marks${params}`);
}

export async function saveExamMark(teacherId: string, teacherPassword: string, examId: string, studentId: string, cq: number, mcq: number, status: string = 'present'): Promise<ExamMark> {
  return request<ExamMark>(`/exams/${examId}/marks`, { method: 'POST', body: JSON.stringify({ teacherId, teacherPassword, studentId, cq, mcq, status }) });
}

export async function deleteExamMark(teacherId: string, teacherPassword: string, examId: string, studentId: string): Promise<void> {
  return request<void>(`/exams/${examId}/marks`, { method: 'DELETE', body: JSON.stringify({ teacherId, teacherPassword, studentId }) });
}

export async function fetchPracticalMarks(examId: string): Promise<ExamPracticalMark[]> {
  return request<ExamPracticalMark[]>(`/exams/${examId}/practical`);
}

export async function savePracticalMarks(principalId: string, principalPassword: string, examId: string, entries: { studentId: string; marks: number }[]): Promise<ExamPracticalMark[]> {
  return request<ExamPracticalMark[]>(`/exams/${examId}/practical`, { method: 'POST', body: JSON.stringify({ principalId, principalPassword, entries }) });
}

export async function fetchStudentsForExam(examId: string, subject: string): Promise<Student[]> {
  return request<Student[]>(`/exams/${examId}/students/${encodeURIComponent(subject)}`);
}

export async function fetchStudentsForExamResult(examId: string): Promise<Student[]> {
  const data = await request<{ students: Student[]; marks: ExamMark[] }>(`/exams/${examId}/result`);
  return data.students;
}

// Re-export types and helpers from the original api.ts
export { getSubjectPassMarks, getStudentFails, isTotalOnlySubject, MAX_PRACTICAL_MARKS } from './examRules';
export type { Teacher, Notice, Student, Exam, ExamMark, ExamPassMarks, ExamFail, SubjectPassMarks, ExamMarkStatus, ExamPracticalMark, DepartmentStaff } from './api';