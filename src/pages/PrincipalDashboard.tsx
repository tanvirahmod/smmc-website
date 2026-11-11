import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { useNavigate, Navigate } from 'react-router-dom';
import { UserPlus, FileText, Trash2, Check, AlertCircle, GraduationCap, Users, Search, Upload, FileSpreadsheet, PenSquare, Award, Bell, Eye, X, KeyRound, ClipboardList, Power, Calendar, BookOpen, ListPlus, LayoutDashboard, Zap, ShieldCheck, Printer, Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, FlaskConical, BarChart3, Building2, GripVertical, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import DashboardShell, { type DashboardNavGroup } from '@/components/DashboardShell';
import IncourseManager from '@/components/IncourseManager';
import {
  createTeacher, createStudent, createNotice, deleteNotice, fetchNotices,
  fetchTeachers, deleteTeacher, fetchStudents, deleteStudent, bulkCreateStudents, bulkDeleteStudents, bulkCreateTeachers,
  toggleTeacherNoticeAccess, updateTeacher,
  createExam, fetchExams, toggleExamActive, deleteExam, updateExamSubjects,
  updateExamPassMarks, getStudentFails, isTotalOnlySubject,
  fetchExamMarks, fetchStudentsForExamResult,
  fetchPracticalMarks, savePracticalMarks, MAX_PRACTICAL_MARKS,
  fetchDepartmentStaff, saveDepartmentStaff, removeDepartmentStaff,
  Exam, ExamMark, ExamPassMarks, ExamPracticalMark, DepartmentStaff,
  Notice, Teacher, Student,
} from '@/lib/apiClient';
import { useSEO } from '@/lib/useSEO';
import {
  examSubjectsForProgram,
  effectiveFourthSubjectFor,
  studentResultGroup,
  RESULT_GROUP_ORDER,
  ALL_SUBJECTS,
} from '@/lib/subjects';
import { DEPARTMENTS, DEPARTMENT_NAV } from '@/lib/departments';
import {
  printResultSheet,
  downloadResultPDF,
  printSummarySheet,
  downloadStudentListPDF,
  downloadStudentListCSV,
  downloadTeacherListPDF,
  downloadTeacherListCSV,
  resultColumnHeading,
  type ResultCellTone,
  type ResultExportGroup,
  type ResultExportRow,
  type ExamSummaryData,
} from '@/lib/resultExport';

type Tab = 'overview' | 'create-teacher' | 'create-student' | 'manage-teachers' | 'manage-students' | 'manage-notices' | 'manage-exams' | 'manage-departments' | 'manage-incourse';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Female', 'Male', 'Others'];
const RELIGIONS = ['Islam', 'Hinduism', 'Christianity', 'Buddhism', 'Others'];

type TeacherEditableField = Exclude<
  keyof Teacher,
  'id' | 'teacher_id' | 'password' | 'is_principal' | 'can_write_notice' | 'profile_pic_url' | 'created_at' | 'updated_at'
>;

const TEACHER_EDIT_SECTIONS: {
  title: string;
  fields: { key: TeacherEditableField; label: string; type?: 'text' | 'date' | 'textarea' | 'select'; options?: string[] }[];
}[] = [
  {
    title: 'Personal Information',
    fields: [
      { key: 'full_name', label: 'Full Name' },
      { key: 'fathers_name', label: "Father's Name" },
      { key: 'mothers_name', label: "Mother's Name" },
      { key: 'dob', label: 'Date of Birth', type: 'date' },
      { key: 'blood_group', label: 'Blood Group', type: 'select', options: BLOOD_GROUPS },
      { key: 'gender', label: 'Gender', type: 'select', options: GENDERS },
      { key: 'religion', label: 'Religion', type: 'select', options: RELIGIONS },
      { key: 'mobile_number', label: 'Mobile Number' },
      { key: 'email', label: 'Email' },
      { key: 'nid_number', label: 'NID Number' },
      { key: 'current_address', label: 'Current Address', type: 'textarea' },
      { key: 'permanent_address', label: 'Permanent Address', type: 'textarea' },
    ],
  },
  {
    title: 'Job Information',
    fields: [
      { key: 'designation', label: 'Designation' },
      { key: 'subject', label: 'Subject' },
      { key: 'program', label: 'Program', type: 'select', options: ['HSC', 'Honours', 'Degree'] },
      { key: 'joining_date', label: 'Joining Date', type: 'date' },
      { key: 'appointment_date', label: 'Appointment Date', type: 'date' },
      { key: 'mpo_date', label: 'MPO Date', type: 'date' },
      { key: 'index_number', label: 'Index Number' },
      { key: 'salary_grade', label: 'Salary Grade' },
      { key: 'basic_scale', label: 'Basic Scale/Salary' },
      { key: 'tmis_no', label: 'TMIS No.' },
      { key: 'ttis_no', label: 'TTIS No.' },
    ],
  },
  {
    title: 'Education',
    fields: [
      { key: 'education_ssc', label: 'SSC' },
      { key: 'education_hsc', label: 'HSC' },
      { key: 'education_honours', label: 'Honours' },
      { key: 'education_masters', label: 'Masters' },
      { key: 'training_names', label: 'Training Names', type: 'textarea' },
    ],
  },
  {
    title: 'Exam Results',
    fields: [
      { key: 'edu_ssc_year', label: 'SSC Passing Year' },
      { key: 'edu_ssc_board', label: 'SSC Board' },
      { key: 'edu_ssc_result', label: 'SSC Result' },
      { key: 'edu_hsc_year', label: 'HSC Passing Year' },
      { key: 'edu_hsc_board', label: 'HSC Board' },
      { key: 'edu_hsc_result', label: 'HSC Result' },
      { key: 'edu_honours_year', label: 'Honours Passing Year' },
      { key: 'edu_honours_board', label: 'Honours Board' },
      { key: 'edu_honours_result', label: 'Honours Result' },
      { key: 'edu_masters_year', label: 'Masters Passing Year' },
      { key: 'edu_masters_board', label: 'Masters Board' },
      { key: 'edu_masters_result', label: 'Masters Result' },
    ],
  },
];

const RESULT_GROUPS = ['Humanities', 'Science', 'Business Studies'];

const GROUP_SUBJECTS: Record<string, string[]> = {
  Humanities: ['English', 'Bangla', 'ICT', 'Civics', 'Sociology', 'Islamic History and Culture', 'Logic', 'Economics', 'Islamic Studies'],
  Science: ['English', 'Bangla', 'ICT', 'Physics', 'Chemistry', 'Biology', 'Higher Math'],
  'Business Studies': ['English', 'Bangla', 'ICT', 'Accounting', 'Business Organization and Management', 'Production Management and Marketing', 'Economics'],
};
const ALL_GROUP_SUBJECTS = new Set(RESULT_GROUPS.flatMap((g) => GROUP_SUBJECTS[g]));

function parseSubjectList(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || '[]');
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** Subject match across main lists, 4th subject and department (case-insensitive). */
export function studentHasSubjectName(s: Student, subject: string): boolean {
  const l = subject.toLowerCase();
  const main = [...parseSubjectList(s.hsc_subjects), ...parseSubjectList(s.subjects)];
  if (main.some((x) => String(x).toLowerCase() === l)) return true;
  if ((s.fourth_subject || '').trim().toLowerCase() === l) return true;
  return (s.department || '').trim().toLowerCase() === l;
}

/**
 * A student's 4th subject for exam-result purposes. Delegates to the shared
 * rule in subjects.ts: the group's mandatory 4th subject wins for Science and
 * Business Studies (even over a stale saved value from another group), and an
 * empty profile field falls back to that default. Other groups keep their
 * saved value.
 */
function effectiveFourthSubject(s: Student, group: string): string {
  return effectiveFourthSubjectFor(s.fourth_subject, group);
}

interface ExamResultRow {
  student: Student;
  studentMarks: (ExamMark | undefined)[];
  fourthBonus: number;
  hasFourth: boolean;
  fourthSubjectIndex: number;
  mainTotal: number;
  /** Science-only practical marks (single value per student, summed into mainTotal). */
  practical: number;
  hasPractical: boolean;
  anyMarked: boolean;
  rank: string;
  group: string;
  /** Count of failed CQ/MCQ components (only counted for students with marks). */
  failCount: number;
  /** Subjects the student was absent/expelled in (not rank-eligible). */
  absentCount: number;
  expelledCount: number;
}

/** Exported for reuse and measurement checks. */
export function buildExamResultRows(
  exam: Exam,
  data: { students: Student[]; marks: ExamMark[]; practical?: ExamPracticalMark[] }
): ExamResultRow[] {
  const practicalMap = new Map<string, number>();
  for (const p of data.practical || []) practicalMap.set(p.student_id, Number(p.marks) || 0);
  const rows = data.students.map((student) => {
    const studentMarks = exam.subjects.map((subj) =>
      data.marks.find((m) => m.student_id === student.student_id && m.subject === subj)
    );
    const anyMarked = studentMarks.some(Boolean);

    const group = studentResultGroup(student);
    const fourthSubject = effectiveFourthSubject(student, group);
    const fourthMark = fourthSubject
      ? data.marks.find(
          (m) =>
            m.student_id === student.student_id &&
            m.subject.toLowerCase() === fourthSubject.toLowerCase()
        )
      : undefined;
    const fourthTotal = fourthMark ? fourthMark.cq + fourthMark.mcq : 0;
    const fourthBonus = fourthTotal > 40 ? fourthTotal - 40 : 0;
    const fourthSubjectIndex = fourthSubject
      ? exam.subjects.findIndex(
          (s) => s.toLowerCase() === fourthSubject.toLowerCase()
        )
      : -1;

    const mainTotal =
      studentMarks.reduce((sum, m, i) => {
        // Skip the 4th-subject column by index (already resolved
        // case-insensitively above) so a differently-cased saved value can't
        // slip its marks back into the main total.
        if (i === fourthSubjectIndex) return sum;
        return sum + (m ? m.cq + m.mcq : 0);
      }, 0) + fourthBonus;

    // Science only: one practical value per student, summed into the total.
    const hasPractical = group === 'Science' && practicalMap.has(student.student_id);
    const practical = hasPractical ? practicalMap.get(student.student_id) || 0 : 0;

    // Fail checks against the exam's per-subject pass marks. Count failed
    // SUBJECTS (a subject fails if any of its CQ/MCQ components fails).
    const failedSubjects = new Set<string>();
    if (anyMarked) {
      exam.subjects.forEach((subj, i) => {
        if (getStudentFails(exam, subj, studentMarks[i]).length > 0) {
          failedSubjects.add(subj);
        }
      });
    }
    const failCount = failedSubjects.size;

    // Absent / expelled subjects (shown as A/E in the result sheet).
    const absentSubjects = new Set<string>();
    const expelledSubjects = new Set<string>();
    exam.subjects.forEach((subj, i) => {
      const m = studentMarks[i];
      if (!m) return;
      if (m.status === 'absent') absentSubjects.add(subj);
      else if (m.status === 'expelled') expelledSubjects.add(subj);
    });

    return {
      student, studentMarks, fourthBonus, hasFourth: !!fourthMark, fourthSubjectIndex,
      mainTotal: mainTotal + practical, practical, hasPractical, anyMarked, group, failCount,
      absentCount: absentSubjects.size, expelledCount: expelledSubjects.size,
    };
  });

  const rankLabels = ['1st', '2nd', '3rd'];
  const rankMap = new Map<string, string>();
  // Only students with marks AND no failed component are rank-eligible; a
  // student who failed any subject shows their fail count instead of a rank.
  const markedByGroup = new Map<string, { id: string; roll: string; total: number }[]>();
  rows.forEach((r) => {
    if (!r.anyMarked || r.failCount > 0 || r.absentCount > 0 || r.expelledCount > 0) return;
    const list = markedByGroup.get(r.group) || [];
    list.push({
      id: r.student.student_id,
      roll: (r.student.class_roll || r.student.student_id || '').trim(),
      total: r.mainTotal,
    });
    markedByGroup.set(r.group, list);
  });
  markedByGroup.forEach((list) => {
    list
      .sort(
        (a, b) =>
          b.total - a.total ||
          a.roll.localeCompare(b.roll, undefined, { numeric: true })
      )
      .slice(0, 3)
      .forEach((r, i) => {
        rankMap.set(r.id, rankLabels[i]);
      });
  });

  const ranked = rows.map((r) => ({
    ...r,
    rank:
      r.failCount > 0 || r.absentCount > 0 || r.expelledCount > 0
        ? ''
        : rankMap.get(r.student.student_id) || '',
  }));
  // Result sheets read top-to-bottom by roll: numeric-aware on trimmed rolls
  // (some stored rolls carry a leading space), student_id fallback.
  const rollKey = (s: Student): string => (s.class_roll || s.student_id || '').trim();
  ranked.sort((a, b) => rollKey(a.student).localeCompare(rollKey(b.student), undefined, { numeric: true }));
  return ranked;
}

/**
 * Exam-wide summary: per-group toppers, pass/fail counts, fail distribution
 * (failed in exactly 1/2/3/4/5+ subjects) and subject-wise pass rates.
 * Totals reuse buildExamResultRows so practical marks are already included.
 */
/** Pure teacher-list filter (search + employment + appointment + subject). Exported for checks. */
export function teacherMatchesFilters(
  t: Teacher,
  f: { search: string; employment: string; appointment: string; subject: string }
): boolean {
  const q = f.search.toLowerCase();
  const matchesSearch =
    !q ||
    (t.full_name || '').toLowerCase().includes(q) ||
    (t.teacher_id || '').toLowerCase().includes(q);
  const matchesEmployment = f.employment === 'all' || (t.employment_type || '') === f.employment;
  const matchesAppointment = f.appointment === 'all' || (t.appointment_type || '') === f.appointment;
  const matchesSubject = f.subject === 'all' || (t.subject || '') === f.subject;
  return matchesSearch && matchesEmployment && matchesAppointment && matchesSubject;
}

/**
 * Seniority order for display and export: numbered priorities first (1 = most
 * senior), unset (null) last, name tiebreak. Exported for checks.
 */
export function compareTeachersBySeniority(a: Teacher, b: Teacher): number {
  const pa = a.seniority_priority;
  const pb = b.seniority_priority;
  const nameCmp = (a.full_name || a.teacher_id || '').localeCompare(b.full_name || b.teacher_id || '');
  if (pa == null && pb == null) return nameCmp;
  if (pa == null) return 1;
  if (pb == null) return -1;
  return pa - pb || nameCmp;
}

/**
 * Move one id to a target index within an ordered id list (drag-and-drop
 * reorder). Exported for checks.
 */
export function moveIdInList(ids: string[], draggedId: string, toIndex: number): string[] {
  const from = ids.indexOf(draggedId);
  if (from === -1) return ids;
  const rest = ids.filter((id) => id !== draggedId);
  const to = Math.max(0, Math.min(toIndex, rest.length));
  rest.splice(to, 0, draggedId);
  return rest;
}

export function buildExamSummary(
  exam: Exam,
  data: { students: Student[]; marks: ExamMark[]; practical?: ExamPracticalMark[] }
): ExamSummaryData {
  const rows = buildExamResultRows(exam, data);
  const order = [...RESULT_GROUPS, 'Other'];
  const present = order.filter((g) => rows.some((r) => r.group === g));
  const markOf = (studentId: string, subj: string): ExamMark | undefined =>
    data.marks.find((m) => m.student_id === studentId && m.subject.toLowerCase() === subj.toLowerCase());

  return {
    groups: present.map((group) => {
      const gr = rows.filter((r) => r.group === group);
      const appearedRows = gr.filter((r) => r.anyMarked);
      const passedRows = appearedRows.filter((r) => r.failCount === 0 && r.absentCount === 0 && r.expelledCount === 0);
      const failedRows = appearedRows.filter((r) => r.failCount > 0);
      const aeRows = appearedRows.filter((r) => r.absentCount > 0 || r.expelledCount > 0);
      const totals = appearedRows.map((r) => r.mainTotal);
      const passRate = appearedRows.length ? (passedRows.length / appearedRows.length) * 100 : 0;
      const top3 = appearedRows
        .filter((r) => r.anyMarked && r.failCount === 0 && r.absentCount === 0 && r.expelledCount === 0)
        .sort(
          (a, b) =>
            b.mainTotal - a.mainTotal ||
            (a.student.class_roll || a.student.student_id || '').localeCompare(
              b.student.class_roll || b.student.student_id || '', undefined, { numeric: true }
            )
        )
        .slice(0, 3)
        .map((r) => ({
          roll: r.student.class_roll || r.student.student_id || '',
          name: r.student.full_name || 'Profile not updated',
          total: r.mainTotal,
        }));
      // Fixed 1..6 buckets, always shown even when a count is zero; extends
      // further (7, 8, ...) only if a group actually fails that many — never "+".
      const maxFails = Math.max(6, appearedRows.reduce((m, r) => Math.max(m, r.failCount), 0));
      const failDist = Array.from({ length: maxFails }, (_, i) => ({
        failedIn: String(i + 1),
        count: appearedRows.filter((r) => r.failCount === i + 1).length,
      }));
      const groupSubjects = (GROUP_SUBJECTS[group] || exam.subjects).filter((s) =>
        exam.subjects.some((e) => e.toLowerCase() === s.toLowerCase())
      );
      const subjects = groupSubjects.map((subj) => {
        let appeared = 0, passed = 0, failed = 0;
        for (const r of gr) {
          const m = markOf(r.student.student_id, subj);
          if (!m) continue;
          appeared += 1;
          if (m.status === 'absent' || m.status === 'expelled') continue;
          if (getStudentFails(exam, subj, m).length > 0) failed += 1;
          else passed += 1;
        }
        return { subject: subj, appeared, passed, failed };
      });
      const pracValues = group === 'Science' ? gr.filter((r) => r.hasPractical).map((r) => r.practical) : [];
      return {
        group,
        total: gr.length,
        appeared: appearedRows.length,
        notAppeared: gr.length - appearedRows.length,
        passed: passedRows.length,
        failed: failedRows.length,
        absentExpelled: aeRows.length,
        passRate,
        average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0,
        highest: totals.length ? Math.max(...totals) : 0,
        lowest: totals.length ? Math.min(...totals) : 0,
        avgPractical: pracValues.length ? pracValues.reduce((a, b) => a + b, 0) / pracValues.length : undefined,
        top3,
        failDist,
        subjects,
      };
    }),
  };
}

/**
 * Compact status codes for the Rank / Status column, shared by the on-screen
 * badge and the print/PDF sheet so both always read the same way:
 * F = failed subjects, A = absent, E = expelled. Empty when the student is
 * rank-eligible (or has no marks), letting the caller fall back to the rank.
 */
function resultStatusCodes(row: {
  failCount: number;
  absentCount: number;
  expelledCount: number;
}): string {
  const parts: string[] = [];
  if (row.failCount > 0) parts.push(`F(${row.failCount})`);
  if (row.absentCount > 0) parts.push(`A(${row.absentCount})`);
  if (row.expelledCount > 0) parts.push(`E(${row.expelledCount})`);
  return parts.join(', ');
}

export default function PrincipalDashboard() {
  const navigate = useNavigate();
  const { teacher, password, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  // Create teacher state
  const [newTeacherId, setNewTeacherId] = useState('');
  const [newTeacherPass, setNewTeacherPass] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Create student state
  const [newStudentRoll, setNewStudentRoll] = useState('');
  const [newStudentMobile, setNewStudentMobile] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentSession, setNewStudentSession] = useState('');
  const [newStudentProgram, setNewStudentProgram] = useState('HSC');
  const [studentMsg, setStudentMsg] = useState('');
  const [studentError, setStudentError] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);

  // CSV upload state
  const [csvSession, setCsvSession] = useState('');
  const [csvProgram, setCsvProgram] = useState('HSC');
  const [csvHscGroup, setCsvHscGroup] = useState<'Humanities' | 'Science' | 'Business Studies'>('Humanities');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{
    class_roll: string;
    full_name: string;
    ssc_gpa: string;
    additional_subjects: string[];
    fourth_subject: string;
    mobile_number: string;
  }[]>([]);
  const [csvMsg, setCsvMsg] = useState('');
  const [csvError, setCsvError] = useState('');
  const [uploading, setUploading] = useState(false);

  const [teacherCsvFile, setTeacherCsvFile] = useState<File | null>(null);
  const [teacherCsvPreview, setTeacherCsvPreview] = useState<{
    priority: string;
    full_name: string;
    teacher_id: string;
    password: string;
    subject: string;
    program: string;
  }[]>([]);
  const [teacherCsvMsg, setTeacherCsvMsg] = useState('');
  const [teacherCsvError, setTeacherCsvError] = useState('');
  const [teacherUploading, setTeacherUploading] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Manage teachers state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherFilterEmployment, setTeacherFilterEmployment] = useState('all');
  const [teacherFilterAppointment, setTeacherFilterAppointment] = useState('all');
  const [teacherFilterSubject, setTeacherFilterSubject] = useState('all');
  const [teacherExporting, setTeacherExporting] = useState<'pdf' | 'csv' | null>(null);
  const [teacherExportError, setTeacherExportError] = useState('');
  const [prioritySavingId, setPrioritySavingId] = useState<string | null>(null);
  const [dragTeacherId, setDragTeacherId] = useState<string | null>(null);
  const [dragOverTeacherId, setDragOverTeacherId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  /** Inline seniority priority (1 = most senior, empty = unset). Saves on blur/Enter. */
  const handlePriorityChange = async (teacherId: string, raw: string) => {
    if (!teacher) return;
    const trimmed = raw.trim();
    const value = trimmed === '' ? null : Math.floor(Number(trimmed));
    if (value !== null && (!Number.isFinite(value) || value < 1)) return;
    setPrioritySavingId(teacherId);
    try {
      await updateTeacher(teacher.teacher_id, password, teacherId, { seniority_priority: value });
      await loadTeachers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save priority');
    } finally {
      setPrioritySavingId(null);
    }
  };

  /**
   * Drag-and-drop / arrow reorder: the visible (filtered) list is rearranged,
   * then the whole roster is auto-numbered 1..N top to bottom (visible first,
   * the rest keep their relative order after). Duplicates can never survive.
   */
  const persistTeacherOrder = async (orderedIds: string[]) => {
    if (!teacher) return;
    setReordering(true);
    try {
      await Promise.all(
        orderedIds.map((id, i) =>
          updateTeacher(teacher.teacher_id, password, id, { seniority_priority: i + 1 })
        )
      );
      await loadTeachers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save order');
    } finally {
      setReordering(false);
    }
  };

  const handleDropTeacher = async (targetTeacherId: string) => {
    if (!dragTeacherId || dragTeacherId === targetTeacherId || reordering) return;
    const visibleIds = filteredTeachers.map((t) => t.teacher_id);
    const targetIndex = visibleIds.indexOf(targetTeacherId);
    if (targetIndex === -1) return;
    const reorderedVisible = moveIdInList(visibleIds, dragTeacherId, targetIndex);
    const visibleSet = new Set(reorderedVisible);
    const hiddenIds = [...teachers]
      .sort(compareTeachersBySeniority)
      .map((t) => t.teacher_id)
      .filter((id) => !visibleSet.has(id));
    setDragTeacherId(null);
    setDragOverTeacherId(null);
    await persistTeacherOrder([...reorderedVisible, ...hiddenIds]);
  };

  const handleMoveTeacher = async (teacherId: string, direction: -1 | 1) => {
    if (reordering) return;
    const visibleIds = filteredTeachers.map((t) => t.teacher_id);
    const from = visibleIds.indexOf(teacherId);
    if (from === -1) return;
    const reorderedVisible = moveIdInList(visibleIds, teacherId, from + direction);
    const visibleSet = new Set(reorderedVisible);
    const hiddenIds = [...teachers]
      .sort(compareTeachersBySeniority)
      .map((t) => t.teacher_id)
      .filter((id) => !visibleSet.has(id));
    await persistTeacherOrder([...reorderedVisible, ...hiddenIds]);
  };

  // Manage students state
  const [students, setStudents] = useState<Student[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilterSession, setStudentFilterSession] = useState('all');
  const [studentFilterProgram, setStudentFilterProgram] = useState('all');
  const [studentFilterGroup, setStudentFilterGroup] = useState('all');
  const [studentFilterSubject, setStudentFilterSubject] = useState('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [listExporting, setListExporting] = useState<'pdf' | 'csv' | null>(null);
  const [listExportError, setListExportError] = useState('');

  // Notice state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState('general');
  const [noticeClass, setNoticeClass] = useState('all');
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeMsg, setNoticeMsg] = useState('');
  const [noticeError, setNoticeError] = useState('');
  const [posting, setPosting] = useState(false);

  // Exam state
  const [exams, setExams] = useState<Exam[]>([]);
  const [examName, setExamName] = useState('');
  const [examProgram, setExamProgram] = useState('HSC');
  const [examSession, setExamSession] = useState('');
  const [examSubjects, setExamSubjects] = useState<string[]>([]);
  const [examActive, setExamActive] = useState(false);
  const [examMsg, setExamMsg] = useState('');
  const [examError, setExamError] = useState('');
  const [examSaving, setExamSaving] = useState(false);
  const [examTogglingId, setExamTogglingId] = useState<string | null>(null);
  const [examPassMarks, setExamPassMarks] = useState<ExamPassMarks>({});
  // Which exam card shows its full subject list (first 6 + expander otherwise).
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);

  // Modify exam subjects state
  const [subjectExam, setSubjectExam] = useState<Exam | null>(null);
  const [subjectList, setSubjectList] = useState<string[]>([]);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectMsg, setSubjectMsg] = useState('');
  const [subjectError, setSubjectError] = useState('');

  // Exam result view state
  const [viewingExamResult, setViewingExamResult] = useState<Exam | null>(null);
  const [examResultData, setExamResultData] = useState<{ students: Student[]; marks: ExamMark[]; practical: ExamPracticalMark[] } | null>(null);
  const [examResultLoading, setExamResultLoading] = useState(false);
  const [examResultError, setExamResultError] = useState('');
  const [resultTab, setResultTab] = useState<string>(RESULT_GROUPS[0]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfExportError, setPdfExportError] = useState('');

  // Per-subject pass marks editor state
  const [passMarksExam, setPassMarksExam] = useState<Exam | null>(null);
  const [passMarksForm, setPassMarksForm] = useState<ExamPassMarks>({});
  const [passMarksSaving, setPassMarksSaving] = useState(false);
  const [passMarksMsg, setPassMarksMsg] = useState('');
  const [passMarksError, setPassMarksError] = useState('');

  // Manage departments state
  const [deptStaff, setDeptStaff] = useState<DepartmentStaff[]>([]);
  const [deptForm, setDeptForm] = useState<Record<string, { head: string; members: string[] }>>({});
  const [deptSaving, setDeptSaving] = useState<string | null>(null);
  const [deptMsg, setDeptMsg] = useState('');
  const [deptError, setDeptError] = useState('');

  const loadDeptStaff = useCallback(async () => {
    try {
      setDeptStaff(await fetchDepartmentStaff());
    } catch { /* ignore */ }
  }, []);

  // Rebuild the per-department form whenever assignments reload.
  useEffect(() => {
    const form: Record<string, { head: string; members: string[] }> = {};
    for (const section of DEPARTMENT_NAV) {
      for (const item of section.items) {
        const rows = deptStaff.filter((r) => r.department_slug === item.slug);
        form[item.slug] = {
          head: rows.find((r) => r.role === 'head')?.teacher_id || '',
          members: rows.filter((r) => r.role === 'member').map((r) => r.teacher_id),
        };
      }
    }
    setDeptForm(form);
  }, [deptStaff]);

  const handleSaveDeptStaff = async (slug: string) => {
    if (!teacher) return;
    const form = deptForm[slug] || { head: '', members: [] };
    setDeptSaving(slug);
    setDeptError('');
    setDeptMsg('');
    try {
      const current = deptStaff.filter((r) => r.department_slug === slug);
      for (const r of current) {
        await removeDepartmentStaff(teacher.teacher_id, password, r.teacher_id, slug);
      }
      if (form.head) {
        await saveDepartmentStaff(teacher.teacher_id, password, form.head, slug, 'head');
      }
      for (const m of form.members) {
        if (m !== form.head) {
          await saveDepartmentStaff(teacher.teacher_id, password, m, slug, 'member');
        }
      }
      await loadDeptStaff();
      setDeptMsg('Department staff saved.');
      setTimeout(() => setDeptMsg(''), 4000);
    } catch (err) {
      setDeptError(err instanceof Error ? err.message : 'Failed to save department staff');
    } finally {
      setDeptSaving(null);
    }
  };

  // Science practical marks entry state (one value per student per exam)
  const [practicalExam, setPracticalExam] = useState<Exam | null>(null);  const [practicalStudents, setPracticalStudents] = useState<Student[]>([]);
  const [practicalForm, setPracticalForm] = useState<Record<string, string>>({});
  const [practicalLoading, setPracticalLoading] = useState(false);
  const [practicalSaving, setPracticalSaving] = useState(false);
  const [practicalMsg, setPracticalMsg] = useState('');
  const [practicalError, setPracticalError] = useState('');

  // Exam summary sheet state (toppers, pass/fail, fail distribution, subjects)
  const [summaryExam, setSummaryExam] = useState<Exam | null>(null);
  const [summaryData, setSummaryData] = useState<ExamSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // Edit/view teacher state
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [editForm, setEditForm] = useState<Partial<Teacher>>({});
  const [editNoticeAccess, setEditNoticeAccess] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState('');
  const [editError, setEditError] = useState('');

  // Change teacher password state
  const [passwordTeacher, setPasswordTeacher] = useState<Teacher | null>(null);
  const [newTeacherPassword, setNewTeacherPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useSEO({
    title: 'Principal Dashboard',
    description: 'Manage teachers, students, and notices from the principal dashboard at Sufia Motin Mohila College.',
    path: '/principal-dashboard',
    noindex: true,
  });

  const loadNotices = useCallback(async () => {
    try {
      const data = await fetchNotices();
      setNotices(data);
    } catch { /* ignore */ }
  }, []);

  const loadTeachers = useCallback(async () => {
    try {
      const data = await fetchTeachers();
      setTeachers(data);
    } catch { /* ignore */ }
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      // Load the full roster once: filters and search run client-side over all
      // students, so the live preview counts match the PDF/CSV export exactly.
      const all: Student[] = [];
      const PAGE = 200;
      for (let offset = 0; ; offset += PAGE) {
        const batch = await fetchStudents(PAGE, offset);
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      setStudents(all);
    } catch { /* ignore */ }
  }, []);

  // Rows per manage-students page (client-side over the filtered roster).
  const STUDENT_PAGE_SIZE = 50;

  const loadExams = useCallback(async () => {
    try {
      const data = await fetchExams();
      setExams(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadNotices();
    loadTeachers();
    loadStudents();
    loadExams();
    loadDeptStaff();
  }, [loadNotices, loadTeachers, loadStudents, loadExams, loadDeptStaff]);

  useEffect(() => {
    if (tab === 'manage-exams') loadExams();
    if (tab === 'manage-departments') {
      loadDeptStaff();
      loadTeachers();
    }
  }, [tab, loadExams, loadDeptStaff, loadTeachers]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearch, studentFilterSession, studentFilterProgram, studentFilterGroup, studentFilterSubject])

  // Clear selection when filters change
  useEffect(() => {
    setSelectedStudentIds(new Set());
  }, [studentSearch, studentFilterSession, studentFilterProgram, studentFilterGroup, studentFilterSubject])

  
  if (!teacher || !teacher.is_principal) {
    return <Navigate to="/login" replace />;
  }

  // Helper to render student status in result view
  const renderStudentStatus = (row: ExamResultRow) => {
    const codes = resultStatusCodes(row);
    if (codes) {
      return (
        <span
          className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-300 whitespace-nowrap"
          title="Not eligible for a rank — F = failed subjects, A = absent, E = expelled"
        >
          {codes}
        </span>
      );
    }
    if (row.rank) {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
          {row.rank}
        </span>
      );
    }
    return <span className="text-gray-300">—</span>;
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamSaving(true);
    setExamError('');
    setExamMsg('');
    try {
      await createExam(teacher.teacher_id, password, examName, examProgram, examSession, examSubjects, examActive, examPassMarks);
      setExamMsg(`Exam "${examName}" created successfully!`);
      setExamName('');
      setExamSession('');
      setExamSubjects([]);
      setExamPassMarks({});
      setExamActive(false);
      loadExams();
    } catch (err) {
      setExamError(err instanceof Error ? err.message : 'Failed to create exam');
    } finally {
      setExamSaving(false);
    }
  };

  const handleToggleExam = async (exam: Exam) => {
    setExamTogglingId(exam.id);
    try {
      await toggleExamActive(teacher.teacher_id, password, exam.id, !exam.is_active);
      loadExams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update exam');
    } finally {
      setExamTogglingId(null);
    }
  };

  const handleDeleteExam = async (exam: Exam) => {
    if (!confirm(`Delete exam "${exam.name}"? All entered marks for this exam will be deleted.`)) return;
    try {
      await deleteExam(teacher.teacher_id, password, exam.id);
      loadExams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete exam');
    }
  };

  const openModifySubjects = (exam: Exam) => {
    setSubjectExam(exam);
    setSubjectList([...exam.subjects]);
    setSubjectMsg('');
    setSubjectError('');
  };

  const openPassMarks = (exam: Exam) => {
    setPassMarksExam(exam);
    setPassMarksForm(JSON.parse(JSON.stringify(exam.pass_marks || {})) as ExamPassMarks);
    setPassMarksMsg('');
    setPassMarksError('');
  };

  const updatePassField = (
    subject: string,
    field: 'outOfCq' | 'cqPass' | 'outOfMcq' | 'mcqPass' | 'totalOnly',
    value: string | boolean
  ) => {
    setPassMarksForm((prev) => {
      const next = { ...prev };
      const cur = next[subject] || { outOfCq: 0, cqPass: null as number | null, outOfMcq: 0, mcqPass: null as number | null };
      if (field === 'totalOnly') {
        next[subject] = { ...cur, totalOnly: value === true } as typeof cur;
      } else {
        const num = (value as string).trim() === '' ? null : Math.max(0, Number(value) || 0);
        next[subject] = { ...cur, [field]: num } as typeof cur;
      }
      return next;
    });
  };

  const handleSavePassMarks = async () => {
    if (!passMarksExam) return;
    setPassMarksSaving(true);
    setPassMarksError('');
    setPassMarksMsg('');
    try {
      await updateExamPassMarks(teacher.teacher_id, password, passMarksExam.id, passMarksForm);
      setPassMarksExam(null);
      setPassMarksMsg(`Pass marks updated for "${passMarksExam.name}"`);
      setTimeout(() => setPassMarksMsg(''), 4000);
      loadExams();
    } catch (err) {
      setPassMarksError(err instanceof Error ? err.message : 'Failed to update pass marks');
    } finally {
      setPassMarksSaving(false);
    }
  };

  const openSummary = async (exam: Exam) => {
    setSummaryExam(exam);
    setSummaryData(null);
    setSummaryError('');
    setSummaryLoading(true);
    try {
      const [students, marks, practical] = await Promise.all([
        fetchStudentsForExamResult(exam.id),
        fetchExamMarks(exam.id),
        fetchPracticalMarks(exam.id),
      ]);
      setSummaryData(buildExamSummary(exam, { students, marks, practical }));
    } catch {
      setSummaryError('Failed to load exam summary. Please try again.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const handlePrintSummary = (): void => {
    if (!summaryExam || !summaryData) return;
    printSummarySheet(
      { name: summaryExam.name, program: summaryExam.program, session: summaryExam.session },
      summaryData
    );
  };

  const openPractical = async (exam: Exam) => {    setPracticalExam(exam);
    setPracticalStudents([]);
    setPracticalForm({});
    setPracticalMsg('');
    setPracticalError('');
    setPracticalLoading(true);
    try {
      const [students, practical] = await Promise.all([
        fetchStudentsForExamResult(exam.id),
        fetchPracticalMarks(exam.id),
      ]);
      const science = students
        .filter((s) => studentResultGroup(s) === 'Science')
        .sort((a, b) => (a.class_roll || a.student_id || '').localeCompare(b.class_roll || b.student_id || '', undefined, { numeric: true }));
      const form: Record<string, string> = {};
      for (const p of practical) form[p.student_id] = String(p.marks);
      setPracticalStudents(science);
      setPracticalForm(form);
    } catch {
      setPracticalError('Failed to load Science students.');
    } finally {
      setPracticalLoading(false);
    }
  };

  const handleSavePractical = async () => {
    if (!practicalExam) return;
    const entries = practicalStudents
      .map((s) => ({ studentId: s.student_id, raw: (practicalForm[s.student_id] || '').trim() }))
      .filter((e) => e.raw !== '')
      .map((e) => ({ studentId: e.studentId, marks: Number(e.raw) }));
    const invalid = entries.find((e) => isNaN(e.marks) || e.marks < 0 || e.marks > MAX_PRACTICAL_MARKS);
    if (invalid) {
      setPracticalError(`Invalid practical marks (0–${MAX_PRACTICAL_MARKS}).`);
      return;
    }
    if (entries.length === 0) {
      setPracticalError('Enter practical marks for at least one student.');
      return;
    }
    setPracticalSaving(true);
    setPracticalError('');
    setPracticalMsg('');
    try {
      await savePracticalMarks(teacher.teacher_id, password, practicalExam.id, entries);
      setPracticalMsg(`Practical marks saved for ${entries.length} Science student${entries.length === 1 ? '' : 's'}.`);
      setTimeout(() => setPracticalMsg(''), 4000);
      // Refresh the open result view so Totals update immediately.
      if (viewingExamResult && viewingExamResult.id === practicalExam.id && examResultData) {
        const practical = await fetchPracticalMarks(practicalExam.id);
        setExamResultData({ ...examResultData, practical });
      }
    } catch (err) {
      setPracticalError(err instanceof Error ? err.message : 'Failed to save practical marks');
    } finally {
      setPracticalSaving(false);
    }
  };

  const handleSaveSubjects = async () => {
    if (!subjectExam) return;
    setSubjectSaving(true);
    setSubjectError('');
    setSubjectMsg('');
    try {
      await updateExamSubjects(teacher.teacher_id, password, subjectExam.id, subjectList);
      setSubjectExam(null);
      setSubjectMsg(`Subjects updated for "${subjectExam.name}"`);
      setTimeout(() => setSubjectMsg(''), 4000);
      loadExams();
    } catch (err) {
      setSubjectError(err instanceof Error ? err.message : 'Failed to update subjects');
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleViewResult = async (exam: Exam) => {
    setViewingExamResult(exam);
    setResultTab(RESULT_GROUPS[0]);
    setExamResultLoading(true);
    setExamResultError('');
    setPdfExportError('');
    setExamResultData(null);
    try {
      const [students, marks, practical] = await Promise.all([
        fetchStudentsForExamResult(exam.id),
        fetchExamMarks(exam.id),
        fetchPracticalMarks(exam.id),
      ]);
      const data = { students, marks, practical };
      setExamResultData(data);
      // Open on the group with the most students instead of always "Humanities".
      const counts = new Map<string, number>();
      buildExamResultRows(exam, data).forEach((r) => {
        counts.set(r.group, (counts.get(r.group) || 0) + 1);
      });
      let defaultTab = RESULT_GROUPS[0];
      let defaultCount = 0;
      for (const g of [...RESULT_GROUPS, 'Other']) {
        const c = counts.get(g) || 0;
        if (c > defaultCount) {
          defaultCount = c;
          defaultTab = g;
        }
      }
      setResultTab(defaultTab);
    } catch {
      setExamResultError('Failed to load results. Please try again.');
    } finally {
      setExamResultLoading(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateMsg('');
    try {
      await createTeacher(teacher.teacher_id, password, newTeacherId, newTeacherPass, newTeacherName);
      setCreateMsg(`Teacher account created! ID: ${newTeacherId}`);
      setNewTeacherId('');
      setNewTeacherPass('');
      setNewTeacherName('');
      loadTeachers();
      setTimeout(() => setCreateMsg(''), 5000);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create teacher');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingStudent(true);
    setStudentError('');
    setStudentMsg('');
    try {
      await createStudent(teacher.teacher_id, password, newStudentRoll, newStudentMobile, newStudentName, newStudentSession, newStudentProgram);
      setStudentMsg(`Student account created! Roll: ${newStudentRoll}`);
      setNewStudentRoll('');
      setNewStudentMobile('');
      setNewStudentName('');
      setNewStudentSession('');
      setNewStudentProgram('HSC');
      loadStudents();
      setTimeout(() => setStudentMsg(''), 5000);
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : 'Failed to create student');
    } finally {
      setCreatingStudent(false);
    }
  };

  // Splits a CSV line on commas while honoring double-quoted fields ("" escapes a
  // quote), so names containing commas like "Hero, Jr." parse correctly.
  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCsv = (text: string): {
    class_roll: string;
    full_name: string;
    ssc_gpa: string;
    additional_subjects: string[]; // 3 group-specific main subjects from CSV
    fourth_subject: string;
    mobile_number: string;
  }[] => {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    
    // Check header - expecting 8 columns now
    const headerCols = splitCsvLine(lines[0]).map(h => h.toLowerCase().trim());
    const expectedHeaders = ['roll', 'students_name', 'ssc_gpa', 'additional_subject_1', 'additional_subject_2', 'additional_subject_3', '4th_subject', 'mobile_number'];
    const headerMatch = expectedHeaders.every((h, i) => headerCols[i]?.includes(h.replace('_', '')) || headerCols[i]?.includes(h));
    if (!headerMatch && lines.length > 1) {
      // Try to be lenient - just check minimum columns
      if (headerCols.length < 8) {
        return [];
      }
    }
    
    const seenRolls = new Set<string>();
    return lines.slice(1).map((line) => {
      const cols = splitCsvLine(line);
      const additionalSubjects = [cols[3] || '', cols[4] || '', cols[5] || ''].filter(s => s.trim());
      return {
        class_roll: cols[0] || '',
        full_name: cols[1] || '',
        ssc_gpa: cols[2] || '',
        additional_subjects: additionalSubjects,
        fourth_subject: cols[6] || '',
        mobile_number: cols[7] || '',
      };
    }).filter((r) => {
      if (!r.class_roll || !r.mobile_number) return false;
      // Skip duplicate rolls within the same file — only the first occurrence counts.
      if (seenRolls.has(r.class_roll)) return false;
      seenRolls.add(r.class_roll);
      return true;
    });
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvError('');
    setCsvMsg('');

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = () => {
      try {
        let parsed;
        if (isXlsx) {
          const data = new Uint8Array(reader.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
          parsed = parseXlsx(jsonData as string[][]);
        } else {
          parsed = parseCsv(reader.result as string);
        }
        setCsvPreview(parsed);
        if (parsed.length === 0) {
          setCsvError(isXlsx 
            ? 'No valid rows found in Excel file. Must have 8 columns.'
            : 'No valid rows found. CSV must have headers: roll, students_name, ssc_gpa, additional_subject_1, additional_subject_2, additional_subject_3, 4th_subject, mobile_number');
        }
      } catch {
        setCsvError('Failed to parse file. Ensure it is a valid CSV or Excel file.');
      }
    };

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const parseXlsx = (rows: string[][]): {
    class_roll: string;
    full_name: string;
    ssc_gpa: string;
    additional_subjects: string[];
    fourth_subject: string;
    mobile_number: string;
  }[] => {
    if (rows.length < 2) return [];
    const seenRolls = new Set<string>();
    const validRows = [];
    let consecutiveEmpty = 0;
    const MAX_CONSECUTIVE_EMPTY = 10; // Stop after this many fully-empty rows
    
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      // Check if row is fully empty
      const isEmpty = cols.every(c => !c || !c.trim());
      if (isEmpty) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
        continue;
      }
      consecutiveEmpty = 0;
      
      const additionalSubjects = [cols[3] || '', cols[4] || '', cols[5] || ''].filter(s => s && s.trim());
      const row = {
        class_roll: cols[0] || '',
        full_name: cols[1] || '',
        ssc_gpa: cols[2] || '',
        additional_subjects: additionalSubjects,
        fourth_subject: cols[6] || '',
        mobile_number: cols[7] || '',
      };
      
      if (!row.class_roll || !row.mobile_number) continue;
      if (seenRolls.has(row.class_roll)) continue;
      seenRolls.add(row.class_roll);
      validRows.push(row);
    }
    return validRows;
  };

  const handleCsvUpload = async () => {
    if (!csvPreview.length) return;
    if (!csvSession.trim()) {
      setCsvError('Please enter the session (e.g. 2024-2025)');
      return;
    }
    if (csvProgram === 'HSC' && !csvHscGroup) {
      setCsvError('Please select HSC Group');
      return;
    }

    // Build full hsc_subjects for each student: mandatory (Bangla, English, ICT) + additional from CSV.
    // Science / Business Studies default their standard 3 when the additional columns are empty.
    const mandatorySubjects = ['Bangla', 'English', 'ICT'];
    const groupDefaultAdditional: Record<string, string[]> = {
      Science: ['Physics', 'Chemistry', 'Biology'],
      'Business Studies': ['Accounting', 'Business Organization and Management', 'Production Management and Marketing'],
    };
    const studentsWithFullSubjects = csvPreview.map((row) => {
      const additional = row.additional_subjects.length > 0
        ? row.additional_subjects
        : (csvProgram === 'HSC' ? (groupDefaultAdditional[csvHscGroup] || []) : []);
      const fullSubjects = [...mandatorySubjects, ...additional];
      return {
        class_roll: row.class_roll,
        full_name: row.full_name,
        ssc_gpa: row.ssc_gpa,
        main_subjects: fullSubjects, // Now contains all 6 subjects for HSC
        fourth_subject: row.fourth_subject,
        mobile_number: row.mobile_number,
      };
    });

    setUploading(true);
    setCsvError('');
    setCsvMsg('');
    try {
      const result = await bulkCreateStudents(
        teacher.teacher_id,
        password,
        studentsWithFullSubjects,
        csvSession.trim(),
        csvProgram,
        csvProgram === 'HSC' ? csvHscGroup : undefined
      );
      setCsvMsg(`Created ${result.created} student accounts${result.skipped ? `, skipped ${result.skipped} duplicates` : ''}.`);
      setCsvFile(null);
      setCsvPreview([]);
      loadStudents();
      setTimeout(() => setCsvMsg(''), 10000);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploading(false);
    }
  };

  const parseTeacherCsv = (text: string): {
    priority: string;
    full_name: string;
    teacher_id: string;
    password: string;
    subject: string;
    program: string;
  }[] => {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];

    // Expecting 6 columns: priority, full_name, teacher_id, password, subject, program
    const headerCols = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const expectedHeaders = ['priority', 'full_name', 'teacher_id', 'password', 'subject', 'program'];
    const headerMatch = expectedHeaders.every((h, i) => headerCols[i]?.includes(h.replace('_', '')) || headerCols[i]?.includes(h));
    if (!headerMatch && lines.length > 1) {
      if (headerCols.length < 6) {
        return [];
      }
    }

    const seenIds = new Set<string>();
    return lines.slice(1).map((line) => {
      const cols = splitCsvLine(line);
      return {
        priority: cols[0] || '',
        full_name: cols[1] || '',
        teacher_id: cols[2] || '',
        password: cols[3] || '',
        subject: cols[4] || '',
        program: cols[5] || '',
      };
    }).filter((r) => {
      if (!r.teacher_id || !r.password) return false;
      // Skip duplicate IDs within the same file — only the first occurrence counts.
      if (seenIds.has(r.teacher_id)) return false;
      seenIds.add(r.teacher_id);
      return true;
    });
  };

  const parseTeacherXlsx = (rows: string[][]): {
    priority: string;
    full_name: string;
    teacher_id: string;
    password: string;
    subject: string;
    program: string;
  }[] => {
    if (rows.length < 2) return [];
    const seenIds = new Set<string>();
    const validRows = [];
    let consecutiveEmpty = 0;
    const MAX_CONSECUTIVE_EMPTY = 10; // Stop after this many fully-empty rows

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const isEmpty = cols.every((c) => !c || !String(c).trim());
      if (isEmpty) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
        continue;
      }
      consecutiveEmpty = 0;

      const row = {
        priority: String(cols[0] ?? ''),
        full_name: String(cols[1] ?? ''),
        teacher_id: String(cols[2] ?? ''),
        password: String(cols[3] ?? ''),
        subject: String(cols[4] ?? ''),
        program: String(cols[5] ?? ''),
      };

      if (!row.teacher_id || !row.password) continue;
      if (seenIds.has(row.teacher_id)) continue;
      seenIds.add(row.teacher_id);
      validRows.push(row);
    }
    return validRows;
  };

  const handleTeacherCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTeacherCsvFile(file);
    setTeacherCsvError('');
    setTeacherCsvMsg('');

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();

    reader.onload = () => {
      try {
        let parsed;
        if (isXlsx) {
          const data = new Uint8Array(reader.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
          parsed = parseTeacherXlsx(jsonData as string[][]);
        } else {
          parsed = parseTeacherCsv(reader.result as string);
        }
        setTeacherCsvPreview(parsed);
        if (parsed.length === 0) {
          setTeacherCsvError(isXlsx
            ? 'No valid rows found in Excel file. Must have 6 columns.'
            : 'No valid rows found. CSV must have headers: priority, full_name, teacher_id, password, subject, program');
        }
      } catch {
        setTeacherCsvError('Failed to parse file. Ensure it is a valid CSV or Excel file.');
      }
    };

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleTeacherCsvUpload = async () => {
    if (!teacherCsvPreview.length) return;
    setTeacherUploading(true);
    setTeacherCsvError('');
    setTeacherCsvMsg('');
    try {
      const result = await bulkCreateTeachers(
        teacher.teacher_id,
        password,
        teacherCsvPreview
      );
      setTeacherCsvMsg(`Created ${result.created} teacher accounts${result.skipped ? `, skipped ${result.skipped} duplicates` : ''}.`);
      setTeacherCsvFile(null);
      setTeacherCsvPreview([]);
      loadTeachers();
      setTimeout(() => setTeacherCsvMsg(''), 10000);
    } catch (err) {
      setTeacherCsvError(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setTeacherUploading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (!confirm(`Delete teacher "${teacherId}"? This cannot be undone.`)) return;
    try {
      await deleteTeacher(teacher.teacher_id, password, teacherId);
      loadTeachers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  /** Download the currently filtered teachers as PDF or CSV. */
  const handleExportTeacherList = async (format: 'pdf' | 'csv') => {
    setTeacherExporting(format);
    setTeacherExportError('');
    try {
      const yn = (v: boolean | undefined): string => (v ? 'Yes' : 'No');
      const rows = teachers
        .filter((t) =>
          teacherMatchesFilters(t, {
            search: teacherSearch,
            employment: teacherFilterEmployment,
            appointment: teacherFilterAppointment,
            subject: teacherFilterSubject,
          })
        )
        .sort(compareTeachersBySeniority)
        .map((t) => ({
          priority: t.seniority_priority == null ? '' : String(t.seniority_priority),
          id: t.id || '',
          teacher_id: t.teacher_id || '',
          full_name: t.full_name || '',
          fathers_name: t.fathers_name || '',
          mothers_name: t.mothers_name || '',
          dob: t.dob || '',
          mobile_number: t.mobile_number || '',
          email: t.email || '',
          tmis_no: t.tmis_no || '',
          ttis_no: t.ttis_no || '',
          current_address: t.current_address || '',
          permanent_address: t.permanent_address || '',
          nid_number: t.nid_number || '',
          blood_group: t.blood_group || '',
          gender: t.gender || '',
          religion: t.religion || '',
          joining_date: t.joining_date || '',
          appointment_date: t.appointment_date || '',
          designation: t.designation || '',
          subject: t.subject || '',
          program: t.program || '',
          employment_type: t.employment_type || '',
          appointment_type: t.appointment_type || '',
          pending_lawsuits: t.pending_lawsuits || '',
          seniority_priority: t.seniority_priority == null ? '' : String(t.seniority_priority),
          mpo_date: t.mpo_date || '',
          index_number: t.index_number || '',
          salary_grade: t.salary_grade || '',
          basic_scale: t.basic_scale || '',
          training_names: t.training_names || '',
          education_ssc: t.education_ssc || '',
          education_hsc: t.education_hsc || '',
          education_honours: t.education_honours || '',
          education_masters: t.education_masters || '',
          edu_ssc_year: t.edu_ssc_year || '',
          edu_ssc_board: t.edu_ssc_board || '',
          edu_ssc_result: t.edu_ssc_result || '',
          edu_hsc_year: t.edu_hsc_year || '',
          edu_hsc_board: t.edu_hsc_board || '',
          edu_hsc_result: t.edu_hsc_result || '',
          edu_honours_year: t.edu_honours_year || '',
          edu_honours_board: t.edu_honours_board || '',
          edu_honours_result: t.edu_honours_result || '',
          edu_masters_year: t.edu_masters_year || '',
          edu_masters_board: t.edu_masters_board || '',
          edu_masters_result: t.edu_masters_result || '',
          is_principal: yn(t.is_principal),
          can_write_notice: yn(t.can_write_notice),
          created_at: t.created_at || '',
          updated_at: t.updated_at || '',
          // PDF roster columns (subset)
          name: t.full_name || 'Profile not updated',
          employment: t.employment_type || '',
          appointment: t.appointment_type || '',
          mobile: t.mobile_number || '',
        }));
      if (rows.length === 0) {
        setTeacherExportError('No teachers match the current filters.');
        return;
      }
      const tag = (v: string): string => (v === 'all' ? 'All' : v.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ''));
      const filterTag = `${tag(teacherFilterEmployment)}_${tag(teacherFilterAppointment)}_${tag(teacherFilterSubject)}`;
      const base = format === 'pdf' ? `Staff_Pattern_${filterTag}` : `Teacher_List_${filterTag}`;
      const meta = {
        employment: teacherFilterEmployment === 'all' ? 'All Types' : teacherFilterEmployment,
        appointment: teacherFilterAppointment === 'all' ? 'All Types' : teacherFilterAppointment,
        subject: teacherFilterSubject === 'all' ? 'All Subjects' : teacherFilterSubject,
        count: rows.length,
      };
      if (format === 'pdf') {
        await downloadTeacherListPDF(rows, meta, base);
      } else downloadTeacherListCSV(rows, base);
    } catch (err) {
      setTeacherExportError(err instanceof Error ? err.message : 'Failed to export teacher list');
    } finally {
      setTeacherExporting(null);
    }
  };

  const openEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setEditForm({
      full_name: t.full_name || '',
      fathers_name: t.fathers_name || '',
      mothers_name: t.mothers_name || '',
      dob: t.dob || '',
      blood_group: t.blood_group || '',
      gender: t.gender || '',
      religion: t.religion || '',
      mobile_number: t.mobile_number || '',
      email: t.email || '',
      nid_number: t.nid_number || '',
      current_address: t.current_address || '',
      permanent_address: t.permanent_address || '',
      designation: t.designation || '',
      subject: t.subject || '',
      program: t.program || '',
      joining_date: t.joining_date || '',
      appointment_date: t.appointment_date || '',
      mpo_date: t.mpo_date || '',
      index_number: t.index_number || '',
      salary_grade: t.salary_grade || '',
      basic_scale: t.basic_scale || '',
      tmis_no: t.tmis_no || '',
      ttis_no: t.ttis_no || '',
      education_ssc: t.education_ssc || '',
      education_hsc: t.education_hsc || '',
      education_honours: t.education_honours || '',
      education_masters: t.education_masters || '',
      training_names: t.training_names || '',
      edu_ssc_year: t.edu_ssc_year || '',
      edu_ssc_board: t.edu_ssc_board || '',
      edu_ssc_result: t.edu_ssc_result || '',
      edu_hsc_year: t.edu_hsc_year || '',
      edu_hsc_board: t.edu_hsc_board || '',
      edu_hsc_result: t.edu_hsc_result || '',
      edu_honours_year: t.edu_honours_year || '',
      edu_honours_board: t.edu_honours_board || '',
      edu_honours_result: t.edu_honours_result || '',
      edu_masters_year: t.edu_masters_year || '',
      edu_masters_board: t.edu_masters_board || '',
      edu_masters_result: t.edu_masters_result || '',
    });
    setEditNoticeAccess(t.can_write_notice);
    setEditMsg('');
    setEditError('');
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    setEditSaving(true);
    setEditError('');
    setEditMsg('');
    try {
      const updated = await updateTeacher(teacher.teacher_id, password, editingTeacher.teacher_id, editForm);
      let finalTeacher = updated;
      if (editNoticeAccess !== editingTeacher.can_write_notice) {
        finalTeacher = await toggleTeacherNoticeAccess(
          teacher.teacher_id,
          password,
          editingTeacher.teacher_id,
          editNoticeAccess
        );
      }
      setTeachers((prev) =>
        prev.map((t) =>
          t.teacher_id === finalTeacher.teacher_id ? { ...t, ...finalTeacher } : t
        )
      );
      setEditingTeacher(null);
      setEditMsg('Teacher updated successfully!');
      setTimeout(() => setEditMsg(''), 4000);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update teacher');
    } finally {
      setEditSaving(false);
    }
  };

  const openChangePassword = (t: Teacher) => {
    setPasswordTeacher(t);
    setNewTeacherPassword('');
    setPasswordError('');
    setPasswordMsg('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTeacher) return;
    if (!newTeacherPassword.trim()) {
      setPasswordError('Please enter a new password');
      return;
    }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordMsg('');
    try {
      await updateTeacher(teacher.teacher_id, password, passwordTeacher.teacher_id, { password: newTeacherPassword.trim() });
      setTeachers((prev) =>
        prev.map((t) =>
          t.teacher_id === passwordTeacher.teacher_id ? { ...t, password: newTeacherPassword.trim() } : t
        )
      );
      const name = passwordTeacher.full_name || passwordTeacher.teacher_id;
      setPasswordTeacher(null);
      setPasswordMsg(`Password updated for ${name}`);
      setTimeout(() => setPasswordMsg(''), 4000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm(`Delete student "${studentId}"? This cannot be undone.`)) return;
    try {
      await deleteStudent(teacher.teacher_id, password, studentId);
      loadStudents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (pagedStudents.length > 0 && pagedStudents.every((s) => selectedStudentIds.has(s.student_id))) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        pagedStudents.forEach((s) => next.delete(s.student_id));
        return next;
      });
    } else {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        pagedStudents.forEach((s) => next.add(s.student_id));
        return next;
      });
    }
  };

  const handleBulkDeleteStudents = async (studentIds: string[]) => {
    if (!confirm(`Delete ${studentIds.length} student${studentIds.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeletingStudent(true);
    try {
      await bulkDeleteStudents(teacher.teacher_id, password, studentIds);
      setSelectedStudentIds(new Set());
      loadStudents();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeletingStudent(false);
    }
  };

  /** Download the currently filtered students (all pages) as a two-column
   *  roster PDF or a CSV: Roll, Name, Mobile + a blank Remarks column. */
  const handleExportStudentList = async (format: 'pdf' | 'csv') => {
    setListExporting(format);
    setListExportError('');
    try {
      const all: Student[] = [];
      const PAGE = 200;
      for (let offset = 0; ; offset += PAGE) {
        const batch = await fetchStudents(PAGE, offset);
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      const groupRank = (g: string): number => {
        const i = RESULT_GROUP_ORDER.indexOf(g);
        return i === -1 ? RESULT_GROUP_ORDER.length : i;
      };
      const rows = all
        .filter(matchesStudentFilters)
        .sort(
          (a, b) =>
            groupRank(studentResultGroup(a)) - groupRank(studentResultGroup(b)) ||
            (a.session || '').localeCompare(b.session || '') ||
            (a.program || '').localeCompare(b.program || '') ||
            (a.class_roll || a.student_id || '').localeCompare(b.class_roll || b.student_id || '', undefined, { numeric: true })
        )
        .map((s) => ({
          roll: s.class_roll || s.student_id || '',
          name: s.full_name || 'Profile not updated',
          mobile: s.mobile_number || '',
          group: studentResultGroup(s),
        }));
      if (rows.length === 0) {
        setListExportError('No students match the current filters.');
        return;
      }
      const tag = (v: string): string => (v === 'all' ? 'All' : v.replace(/\s+/g, ''));
      const base = `Student_List_${tag(studentFilterSession)}_${tag(studentFilterProgram)}_${tag(studentFilterSubject)}_${tag(studentFilterGroup)}`;
      const meta = {
        session: studentFilterSession === 'all' ? 'All Sessions' : studentFilterSession,
        program: studentFilterProgram === 'all' ? 'All Programs' : studentFilterProgram,
        subject: studentFilterSubject === 'all' ? 'All Subjects' : studentFilterSubject,
        group: studentFilterGroup === 'all' ? 'All Groups' : studentFilterGroup,
        count: rows.length,
      };
      if (format === 'pdf') await downloadStudentListPDF(rows, meta, base);
      else downloadStudentListCSV(rows, base);
    } catch (err) {
      setListExportError(err instanceof Error ? err.message : 'Failed to export student list');
    } finally {
      setListExporting(null);
    }
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setNoticeError('');
    setNoticeMsg('');
    try {
      await createNotice(teacher.teacher_id, password, noticeTitle, noticeContent, noticeCategory, noticeClass === 'all' ? '' : noticeClass);
      setNoticeMsg('Notice published successfully!');
      setNoticeTitle('');
      setNoticeContent('');
      setNoticeCategory('general');
      setNoticeClass('all');
      loadNotices();
      setTimeout(() => setNoticeMsg(''), 4000);
    } catch (err) {
      setNoticeError(err instanceof Error ? err.message : 'Failed to publish notice');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await deleteNotice(teacher.teacher_id, password, noticeId);
      loadNotices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const filteredTeachers = teachers
    .filter((t) =>
      teacherMatchesFilters(t, {
        search: teacherSearch,
        employment: teacherFilterEmployment,
        appointment: teacherFilterAppointment,
        subject: teacherFilterSubject,
      })
    )
    .sort(compareTeachersBySeniority);

  const filteredStudents = students.filter(matchesStudentFilters);
  const studentPageCount = Math.max(1, Math.ceil(filteredStudents.length / STUDENT_PAGE_SIZE));
  const safeStudentPage = Math.min(studentPage, studentPageCount);
  const pagedStudents = filteredStudents.slice(
    (safeStudentPage - 1) * STUDENT_PAGE_SIZE,
    safeStudentPage * STUDENT_PAGE_SIZE
  );

  function matchesStudentFilters(s: Student): boolean {
    const matchesSearch =
      (s.full_name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.class_roll || s.student_id || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.session || '').toLowerCase().includes(studentSearch.toLowerCase());
    const matchesSession = studentFilterSession === 'all' || s.session === studentFilterSession;
    const matchesProgram = studentFilterProgram === 'all' || s.program === studentFilterProgram;
    const matchesGroup = studentFilterGroup === 'all' || s.hsc_group === studentFilterGroup || s.ssc_group === studentFilterGroup;
    const matchesSubject = studentFilterSubject === 'all' || studentHasSubjectName(s, studentFilterSubject);
    return matchesSearch && matchesSession && matchesProgram && matchesGroup && matchesSubject;
  }

  const studentSessions = Array.from(new Set(students.map((s) => s.session).filter(Boolean))).sort();

  const resultRows = viewingExamResult && examResultData
    ? buildExamResultRows(viewingExamResult, examResultData)
    : [];

  // Modify-subjects modal: the exam program's own list, plus any legacy subjects
  // already stored on the exam so they stay visible instead of vanishing on save.
  const modifySubjectOptions = subjectExam
    ? Array.from(new Set([...examSubjectsForProgram(subjectExam.program), ...subjectList]))
    : [];

  const resultTabCounts = new Map<string, number>();
  resultRows.forEach((r) => {
    resultTabCounts.set(r.group, (resultTabCounts.get(r.group) || 0) + 1);
  });
  const resultTabs = [...RESULT_GROUPS];
  if ((resultTabCounts.get('Other') || 0) > 0) {
    resultTabs.push('Other');
  }
  const tabRows = resultRows.filter((r) => r.group === resultTab);

  const tabSubjectSet = new Set(GROUP_SUBJECTS[resultTab] || []);
  const tabSubjects = viewingExamResult
    ? GROUP_SUBJECTS[resultTab]?.filter((s) => tabSubjectSet.has(s) || !ALL_GROUP_SUBJECTS.has(s)) || []
    : [];

  const rankStatusLabel = (r: (typeof resultRows)[number]): string =>
    resultStatusCodes(r) || r.rank || '—';

  /** Build export groups with CQ/MCQ numbers and A/E only in Total.
   *  Print includes empty HSC groups; PDF keeps only groups with results. */
  const buildExportGroups = (includeEmptyGroups = false): ResultExportGroup[] => {
    if (!viewingExamResult) return [];
    return resultTabs
      .map((tab): ResultExportGroup | null => {
        const rows = resultRows.filter((r) => r.group === tab);
        const showEmptyGroup = includeEmptyGroups && viewingExamResult.program === 'HSC' && RESULT_GROUPS.includes(tab);
        if (rows.length === 0 && !showEmptyGroup) return null;
        const subjects = GROUP_SUBJECTS[tab] || [];
        // Exam-subject index -> position inside this group's exported columns,
        // so the 4th subject can be highlighted where it actually lands.
        const exportPosition = new Map<number, number>();
        subjects.forEach((subj, position) => {
          const examIndex = viewingExamResult.subjects.findIndex(
            (s) => s.toLowerCase() === subj.toLowerCase()
          );
          if (examIndex >= 0) exportPosition.set(examIndex, position);
        });
        const exportRows: ResultExportRow[] = rows.map((r) => {
          const cells: string[] = [];
          const cellTones: (ResultCellTone | null)[] = [];
          subjects.forEach((subj) => {
            const m = r.studentMarks[viewingExamResult.subjects.indexOf(subj)];
            // Total-only subjects (e.g. English without MCQ) export one Total cell.
            if (isTotalOnlySubject(viewingExamResult, subj)) {
              if (!m) {
                cells.push('—');
                cellTones.push(null);
              } else if (m.status === 'absent' || m.status === 'expelled') {
                cells.push(m.status === 'absent' ? 'A' : 'E');
                cellTones.push(m.status);
              } else {
                cells.push(String(m.cq + m.mcq));
                cellTones.push(getStudentFails(viewingExamResult, subj, m).length > 0 ? 'fail' : null);
              }
              return;
            }
            if (!m) {
              cells.push('—', '—', '—');
              cellTones.push(null, null, null);
              return;
            }
            const absentOrExpelled: ResultCellTone | null =
              m.status === 'absent' ? 'absent' : m.status === 'expelled' ? 'expelled' : null;
            const status = absentOrExpelled === 'absent' ? 'A' : absentOrExpelled === 'expelled' ? 'E' : null;
            cells.push(String(m.cq), String(m.mcq), status ?? String(m.cq + m.mcq));
            if (absentOrExpelled) {
              // A/E is shown only in Total; CQ and MCQ keep their normal text.
              cellTones.push(null, null, absentOrExpelled);
            } else {
              // Only failed CQ/MCQ components use red text; Total stays black.
              const fails = getStudentFails(viewingExamResult, subj, m);
              const cqFail = fails.some((f) => f.component === 'CQ') ? 'fail' : null;
              const mcqFail = fails.some((f) => f.component === 'MCQ') ? 'fail' : null;
              cellTones.push(cqFail, mcqFail, null);
            }
          });
          const effFourth = effectiveFourthSubject(r.student, r.group);
          const inExam = !!effFourth && subjects.some(
            (s) => s.toLowerCase() === effFourth.toLowerCase()
          );
          // Absolute cell index of the 4th subject's Total cell, accounting for
          // total-only subjects that contribute one cell instead of three.
          let fourthCellIndex = -1;
          const fourthPos = exportPosition.get(r.fourthSubjectIndex);
          if (fourthPos != null) {
            let idx = 0;
            for (let p = 0; p < fourthPos; p++) {
              idx += isTotalOnlySubject(viewingExamResult, subjects[p]) ? 1 : 3;
            }
            fourthCellIndex = idx + (isTotalOnlySubject(viewingExamResult, subjects[fourthPos]) ? 0 : 2);
          }
          return {
            roll: r.student.class_roll || r.student.student_id,
            name: r.student.full_name || 'Profile not updated',
            cells,
            cellTones,
            fourthSubjectIndex: exportPosition.get(r.fourthSubjectIndex) ?? -1,
            fourthCellIndex,
            fourthBonus: effFourth && !inExam ? 'N/A' : r.hasFourth ? String(r.fourthBonus) : '—',
            practical: tab === 'Science' ? (r.hasPractical ? String(r.practical) : '—') : undefined,
            total: r.anyMarked ? String(r.mainTotal) : '—',
            status: rankStatusLabel(r),
          };
        });
        return {
          group: tab,
          showPractical: tab === 'Science',
          subjects: subjects.map((s) => ({
            name: s,
            inExam: true,
            totalOnly: isTotalOnlySubject(viewingExamResult, s),
          })),
          rows: exportRows,
        };
      })
      .filter((g): g is ResultExportGroup => g !== null);
  };

  const handlePrintResult = (): void => {
    if (!viewingExamResult || resultRows.length === 0) return;
    const groups = buildExportGroups(true);
    if (groups.length === 0) return;
    printResultSheet(
      { name: viewingExamResult.name, program: viewingExamResult.program, session: viewingExamResult.session },
      groups
    );
  };

  const handleDownloadResultPdf = async (): Promise<void> => {
    if (!viewingExamResult || exportingPdf) return;
    const groups = buildExportGroups();
    if (groups.length === 0) return;
    setExportingPdf(true);
    setPdfExportError('');
    try {
      await downloadResultPDF(
        { name: viewingExamResult.name, program: viewingExamResult.program, session: viewingExamResult.session },
        groups
      );
    } catch (error) {
      setPdfExportError(error instanceof Error ? error.message : 'Failed to export PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const activeExamCount = exams.filter((e) => e.is_active).length;

  const navGroups: DashboardNavGroup[] = [
    {
      label: 'Dashboard',
      items: [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }],
    },
    {
      label: 'People',
      items: [
        { id: 'my-profile', label: 'My Profile', icon: UserRound },
        { id: 'create-teacher', label: 'Create Teacher', icon: UserPlus },
        { id: 'manage-teachers', label: 'Manage Teachers', icon: Users, hint: String(teachers.length) },
        { id: 'create-student', label: 'Create Student', icon: GraduationCap },
        { id: 'manage-students', label: 'Manage Students', icon: GraduationCap, hint: String(students.length) },
      ],
    },
    {
      label: 'Academics',
      items: [
        {
          id: 'manage-exams',
          label: 'Manage Exams',
          icon: ClipboardList,
          hint: activeExamCount > 0 ? `${activeExamCount} active` : undefined,
        },
        { id: 'manage-incourse', label: 'In-Course Exams', icon: FlaskConical },
        { id: 'manage-departments', label: 'Manage Departments', icon: Building2 },
      ],
    },
    {
      label: 'Communication',
      items: [
        { id: 'manage-notices', label: 'Manage Notices', icon: FileText, hint: String(notices.length) },
      ],
    },
  ];

  const quickActions: { id: Tab; label: string; icon: typeof UserPlus; classes: string }[] = [
    { id: 'create-student', label: 'Create Student', icon: GraduationCap, classes: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
    { id: 'create-teacher', label: 'Create Teacher', icon: UserPlus, classes: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { id: 'manage-exams', label: 'Manage Exams', icon: ClipboardList, classes: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
    { id: 'manage-notices', label: 'Publish Notice', icon: FileText, classes: 'bg-red-50 text-red-700 hover:bg-red-100' },
  ];

  const categoryOptions = [
    { value: 'general', label: 'General' },
    { value: 'admission', label: 'Admission' },
    { value: 'exam', label: 'Exam' },
    { value: 'result', label: 'Result' },
    { value: 'holiday', label: 'Holiday' },
  ];

  const classOptions = [
    { value: 'all', label: 'All Classes (Everyone)' },
    { value: 'HSC', label: 'HSC' },
    { value: 'Degree', label: 'Degree' },
    { value: 'Honours', label: 'Honours' },
  ];

  return (
    <DashboardShell
      roleLabel="Principal"
      title="Principal Dashboard"
      subtitle="Manage teachers, students, exams and notices"
      avatar={<ShieldCheck size={26} />}
      onLogout={handleLogout}
      navGroups={navGroups}
      activeId={tab}
      onNavigate={(id) => {
        // Principal's own profile lives on the shared profile page.
        if (id === 'my-profile') {
          navigate('/teacher-profile');
          return;
        }
        setTab(id as Tab);
      }}
    >
      {/* Overview */}
      {tab === 'overview' && (
        <div className="animate-fade-in space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-blue-700 font-medium truncate">Total Teachers</p>
                <p className="text-2xl font-bold text-blue-800">{teachers.length}</p>
              </div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                <Users size={24} className="text-white" />
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-purple-700 font-medium truncate">Total Students</p>
                <p className="text-2xl font-bold text-purple-800">{students.length}</p>
              </div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                <GraduationCap size={24} className="text-white" />
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-5 bg-gradient-to-br from-green-50 to-green-100 border-green-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-green-700 font-medium truncate">Published Notices</p>
                <p className="text-2xl font-bold text-green-800">{notices.length}</p>
              </div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                <Bell size={24} className="text-white" />
              </div>
            </div>
          </div>
          <div className="card p-4 sm:p-5 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-100">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-amber-700 font-medium truncate">Sessions</p>
                <p className="text-2xl font-bold text-amber-800">{studentSessions.length}</p>
              </div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <Award size={24} className="text-white" />
              </div>
            </div>
          </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <section className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Zap size={20} className="text-green-600" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 sm:gap-3">
                {quickActions.map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setTab(a.id)}
                      className={`flex min-[420px]:flex-col items-center min-[420px]:items-start gap-2 min-[420px]:gap-2.5 p-3.5 sm:p-4 rounded-xl text-sm font-semibold transition-colors min-h-[48px] ${a.classes}`}
                    >
                      <Icon size={20} />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList size={20} className="text-green-600" />
                  Active Exams
                </h2>
                <button
                  onClick={() => setTab('manage-exams')}
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  View all
                </button>
              </div>
              {exams.filter((e) => e.is_active).length === 0 ? (
                <p className="text-sm text-gray-500">
                  No active exams right now. Create one from Manage Exams.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {exams
                    .filter((e) => e.is_active)
                    .slice(0, 4)
                    .map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{e.name}</p>
                          <p className="text-xs text-gray-500">
                            {e.program} · {e.session} · {e.subjects.length} subject
                            {e.subjects.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className="badge-primary flex-shrink-0">Active</span>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          </div>

          <section className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bell size={20} className="text-green-600" />
                Latest Notices
              </h2>
              <button
                onClick={() => setTab('manage-notices')}
                className="text-sm font-medium text-green-700 hover:text-green-800"
              >
                Manage
              </button>
            </div>
            {notices.length === 0 ? (
              <p className="text-sm text-gray-500">No notices published yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {notices.slice(0, 3).map((n) => (
                  <li key={n.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 capitalize">{n.category}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

        {/* Tab Panels */}
        <div className="animate-slide-up">
          {/* Create Teacher tab */}
          {tab === 'create-teacher' && (
            <div className="space-y-6 animate-fade-in">
              {/* Single create */}
              <div className="card p-6 max-w-lg">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                  <UserPlus size={20} className="text-blue-600" />
                  Create Teacher Account
                </h2>
                <p className="text-sm text-gray-500">
                  Create a new login account for a teacher. The teacher can then log in and fill in their own information.
                </p>
              </div>

              {createMsg && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                  <Check size={16} /> {createMsg}
                </div>
              )}
              {createError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                  <AlertCircle size={16} /> {createError}
                </div>
              )}

              <form onSubmit={handleCreateTeacher} className="space-y-4">
                <div className="form-group">
                  <label className="label" htmlFor="newTeacherId">Teacher ID</label>
                  <input
                    id="newTeacherId"
                    type="text"
                    value={newTeacherId}
                    onChange={(e) => setNewTeacherId(e.target.value)}
                    placeholder="e.g. t001"
                    className="input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="newTeacherPass">Password</label>
                  <input
                    id="newTeacherPass"
                    type="text"
                    value={newTeacherPass}
                    onChange={(e) => setNewTeacherPass(e.target.value)}
                    placeholder="Set a password"
                    className="input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="newTeacherName">Full Name (optional)</label>
                  <input
                    id="newTeacherName"
                    type="text"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    placeholder="Teacher's full name"
                    className="input"
                  />
                </div>
                <button type="submit" disabled={creating} className="btn-primary w-full">
                  <UserPlus size={18} />
                  {creating ? 'Creating...' : 'Create Account'}
                </button>
              </form>
              </div>

              {/* CSV bulk upload */}
              <div className="card p-6 max-w-lg">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <FileSpreadsheet size={20} className="text-amber-600" />
                    Bulk Upload Teachers (CSV)
                  </h2>
                  <p className="text-sm text-gray-500">
                    Upload a CSV or Excel file with columns:
                    <strong>priority, full_name, teacher_id, password, subject, program</strong>.
                    <br />Subject must match a known subject name, program must be HSC, Honours or Degree.
                    The first row should be a header. Only these fields are set — teachers fill in the rest on their own profiles.
                  </p>
                </div>

                {teacherCsvMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <Check size={16} /> {teacherCsvMsg}
                  </div>
                )}
                {teacherCsvError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <AlertCircle size={16} /> {teacherCsvError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label">CSV / Excel File</label>
                    <label className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer hover:bg-green-100 transition-colors border-2 border-dashed border-green-200">
                      <Upload size={18} />
                      Choose File
                      <input
                        type="file"
                        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleTeacherCsvFile}
                        className="hidden"
                      />
                    </label>
                    {teacherCsvFile && (
                      <span className="ml-3 text-sm text-gray-500">{teacherCsvFile.name}</span>
                    )}
                  </div>

                  {teacherCsvPreview.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">Preview ({teacherCsvPreview.length} teachers)</p>
                      <div className="max-h-56 overflow-auto border border-gray-100 rounded-xl overscroll-contain">
                        <table className="w-full min-w-[600px] text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Priority</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Teacher ID</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Subject</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Program</th>
                            </tr>
                          </thead>
                          <tbody>
                            {teacherCsvPreview.map((row, i) => (
                              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-gray-700">{row.priority}</td>
                                <td className="px-4 py-3 text-gray-700">{row.full_name}</td>
                                <td className="px-4 py-3 text-gray-700">{row.teacher_id}</td>
                                <td className="px-4 py-3 text-gray-700">{row.subject}</td>
                                <td className="px-4 py-3 text-gray-700">{row.program}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={handleTeacherCsvUpload}
                        disabled={teacherUploading}
                        className="btn-primary w-full mt-4"
                      >
                        <Upload size={18} />
                        {teacherUploading ? 'Uploading...' : `Upload ${teacherCsvPreview.length} Teachers`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create Student tab */}
          {tab === 'create-student' && (
            <div className="space-y-6 animate-fade-in">
              {/* Single create */}
              <div className="card p-6 max-w-lg">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <GraduationCap size={20} className="text-purple-600" />
                    Create Student Account
                  </h2>
                  <p className="text-sm text-gray-500">
                    Use Class Roll as ID and Mobile Number as password. The student can then log in and fill in their own information.
                  </p>
                </div>

                {studentMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <Check size={16} /> {studentMsg}
                  </div>
                )}
                {studentError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <AlertCircle size={16} /> {studentError}
                  </div>
                )}

                <form onSubmit={handleCreateStudent} className="space-y-4">
                  <div className="form-group">
                    <label className="label" htmlFor="newStudentRoll">Class Roll</label>
                    <input
                      id="newStudentRoll"
                      type="text"
                      value={newStudentRoll}
                      onChange={(e) => setNewStudentRoll(e.target.value)}
                      placeholder="e.g. 101"
                      className="input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="newStudentMobile">Mobile Number (Password)</label>
                    <input
                      id="newStudentMobile"
                      type="text"
                      value={newStudentMobile}
                      onChange={(e) => setNewStudentMobile(e.target.value)}
                      placeholder="e.g. 01XXXXXXXXX"
                      className="input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="newStudentSession">Session</label>
                    <input
                      id="newStudentSession"
                      type="text"
                      value={newStudentSession}
                      onChange={(e) => setNewStudentSession(e.target.value)}
                      placeholder="e.g. 2024-2025"
                      className="input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="newStudentProgram">Program</label>
                    <select
                      id="newStudentProgram"
                      value={newStudentProgram}
                      onChange={(e) => setNewStudentProgram(e.target.value)}
                      className="input"
                    >
                      <option value="HSC">HSC</option>
                      <option value="Degree">Degree</option>
                      <option value="Honours">Honours</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="newStudentName">Full Name (optional)</label>
                    <input
                      id="newStudentName"
                      type="text"
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Student's full name"
                      className="input"
                    />
                  </div>
                  <button type="submit" disabled={creatingStudent} className="btn-primary w-full">
                    <GraduationCap size={18} />
                    {creatingStudent ? 'Creating...' : 'Create Account'}
                  </button>
                </form>
              </div>

              {/* CSV bulk upload */}
              <div className="card p-6 max-w-lg">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <FileSpreadsheet size={20} className="text-amber-600" />
                    Bulk Upload Students (CSV)
                  </h2>
                  <p className="text-sm text-gray-500">
                    Upload a CSV file with columns:
                    <strong>roll, students_name, ssc_gpa, additional_subject_1, additional_subject_2, additional_subject_3, 4th_subject, mobile_number</strong>.
                    <br />For HSC: Bangla, English, ICT are auto-added as mandatory. Provide 3 group-specific additional subjects + 4th subject.
                    The first row should be a header. For HSC, also select the group below.
                  </p>
                </div>

                {csvMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <Check size={16} /> {csvMsg}
                  </div>
                )}
                {csvError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <AlertCircle size={16} /> {csvError}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="form-group">
                    <label className="label" htmlFor="csvSession">Session</label>
                    <input
                      id="csvSession"
                      type="text"
                      value={csvSession}
                      onChange={(e) => setCsvSession(e.target.value)}
                      placeholder="e.g. 2024-2025"
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="csvProgram">Program</label>
                    <select
                      id="csvProgram"
                      value={csvProgram}
                      onChange={(e) => setCsvProgram(e.target.value)}
                      className="input"
                    >
                      <option value="HSC">HSC</option>
                      <option value="Degree">Degree</option>
                      <option value="Honours">Honours</option>
                    </select>
                  </div>
                  {csvProgram === 'HSC' && (
                    <div className="form-group">
                      <label className="label" htmlFor="csvHscGroup">HSC Group</label>
                      <select
                        id="csvHscGroup"
                        value={csvHscGroup}
                        onChange={(e) => setCsvHscGroup(e.target.value as 'Humanities' | 'Science' | 'Business Studies')}
                        className="input"
                      >
                        <option value="Humanities">Humanities</option>
                        <option value="Science">Science</option>
                        <option value="Business Studies">Business Studies</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Determines default 4th subject: Science → Higher Math, Business Studies → Economics.
                        Empty additional columns default to Physics/Chemistry/Biology (Science) or Accounting/Business Organization and Management/Production Management and Marketing (Business Studies).
                      </p>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="label">CSV / Excel File</label>
                    <label className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer hover:bg-green-100 transition-colors border-2 border-dashed border-green-200">
                      <Upload size={18} />
                      Choose File
                      <input
                        type="file"
                        accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleCsvFile}
                        className="hidden"
                      />
                    </label>
                    {csvFile && (
                      <span className="ml-3 text-sm text-gray-500">{csvFile.name}</span>
                    )}
                  </div>

                  {csvPreview.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">Preview ({csvPreview.length} students)</p>
                      <p className="text-xs text-blue-600 mb-2">Note: Bangla, English, ICT will be auto-added as mandatory subjects for all HSC students.</p>
                      <div className="max-h-56 overflow-auto border border-gray-100 rounded-xl overscroll-contain">
                        <table className="w-full min-w-[700px] text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Roll</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">SSC GPA</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Additional Subjects (3)</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">4th Subject</th>
                              <th className="text-left px-4 py-3 font-medium text-gray-600">Mobile</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((row, i) => (
                              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-gray-700">{row.class_roll}</td>
                                <td className="px-4 py-3 text-gray-700">{row.full_name}</td>
                                <td className="px-4 py-3 text-gray-700">{row.ssc_gpa || '—'}</td>
                                <td className="px-4 py-3 text-gray-700">{row.additional_subjects.join(', ') || '—'}</td>
                                <td className="px-4 py-3 text-gray-700">{row.fourth_subject || '—'}</td>
                                <td className="px-4 py-3 text-gray-700">{row.mobile_number}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleCsvUpload}
                    disabled={uploading || csvPreview.length === 0}
                    className="btn-primary w-full"
                  >
                    <Upload size={18} />
                    {uploading ? 'Uploading...' : `Upload ${csvPreview.length} Students`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manage Teachers tab */}
          {tab === 'manage-teachers' && (
            <div className="card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">All Teachers ({teachers.length})</h2>
              </div>

              <div className="relative mb-6 max-w-md">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="input pl-12"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
                <select
                  value={teacherFilterEmployment}
                  onChange={(e) => setTeacherFilterEmployment(e.target.value)}
                  className="input sm:w-auto sm:min-w-[180px]"
                  aria-label="Filter by employment type"
                >
                  <option value="all">All Employment Types</option>
                  <option value="MPO">MPO</option>
                  <option value="NON-MPO">NON-MPO</option>
                  <option value="Part Time">Part Time</option>
                </select>
                <select
                  value={teacherFilterAppointment}
                  onChange={(e) => setTeacherFilterAppointment(e.target.value)}
                  className="input sm:w-auto sm:min-w-[180px]"
                  aria-label="Filter by appointment type"
                >
                  <option value="all">All Appointment Types</option>
                  <option value="Committee">Committee</option>
                  <option value="NTRCA">NTRCA</option>
                </select>
                <select
                  value={teacherFilterSubject}
                  onChange={(e) => setTeacherFilterSubject(e.target.value)}
                  className="input sm:w-auto sm:min-w-[180px]"
                  aria-label="Filter by subject"
                >
                  <option value="all">All Subjects</option>
                  {ALL_SUBJECTS.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3 mb-6">
                <button
                  onClick={() => handleExportTeacherList('pdf')}
                  disabled={teacherExporting !== null}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <Download size={18} />
                  {teacherExporting === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => handleExportTeacherList('csv')}
                  disabled={teacherExporting !== null}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <FileSpreadsheet size={18} />
                  {teacherExporting === 'csv' ? 'Preparing CSV...' : 'Download CSV'}
                </button>
                <p className="text-xs text-gray-400 self-center">
                  Exports {filteredTeachers.length} matching teacher{filteredTeachers.length !== 1 ? 's' : ''} — CSV carries the full profile, PDF the roster columns.
                </p>
              </div>
              {teacherExportError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-6 flex items-center gap-2" role="alert">
                  <AlertCircle size={16} /> {teacherExportError}
                </div>
              )}

              {editMsg && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                  <Check size={16} /> {editMsg}
                </div>
              )}
              {passwordMsg && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                  <Check size={16} /> {passwordMsg}
                </div>
              )}

              {filteredTeachers.length === 0 ? (
                <div className="text-center py-12">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400">No teachers found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">
                    Tip: drag a row by its grip (or use ↑ ↓) to reorder — seniority auto-numbers the whole list 1…N.
                    {reordering && <span className="text-green-700 font-medium"> Saving new order...</span>}
                  </p>
                  {filteredTeachers.map((t, index) => (
                    <div
                      key={t.id}
                      draggable={!reordering}
                      onDragStart={(e) => {
                        setDragTeacherId(t.teacher_id);
                        e.dataTransfer.effectAllowed = 'move';
                        try {
                          e.dataTransfer.setData('text/plain', t.teacher_id);
                        } catch { /* some browsers need data set */ }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverTeacherId !== t.teacher_id) setDragOverTeacherId(t.teacher_id);
                      }}
                      onDragLeave={() => {
                        setDragOverTeacherId((cur) => (cur === t.teacher_id ? null : cur));
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropTeacher(t.teacher_id);
                      }}
                      onDragEnd={() => {
                        setDragTeacherId(null);
                        setDragOverTeacherId(null);
                      }}
                      className={`flex items-center justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex-wrap ${
                        dragOverTeacherId === t.teacher_id ? 'ring-2 ring-green-500 bg-green-50' : ''
                      } ${dragTeacherId === t.teacher_id ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
                          title="Drag to reorder"
                          aria-hidden="true"
                        >
                          <GripVertical size={18} />
                        </span>
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-green-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                          {(t.full_name || t.teacher_id).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-gray-800 text-sm flex flex-wrap items-center gap-2">
                            <span className="truncate min-w-0 max-w-full">{t.full_name || 'Not updated yet'}</span>
                            {t.is_principal && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                Principal
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-gray-500">
                            ID: {t.teacher_id}
                            {t.designation ? ` | ${t.designation}` : ''}
                            {t.subject ? ` | ${t.subject}` : ''}
                            {t.employment_type ? ` | ${t.employment_type}` : ''}
                            {t.appointment_type ? ` | ${t.appointment_type}` : ''}
                            {t.pending_lawsuits ? ` | Lawsuits: ${t.pending_lawsuits}` : ''}
                          </p>
                        </div>
                      </div>
                      {!t.is_principal && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleMoveTeacher(t.teacher_id, -1)}
                            disabled={reordering || index === 0}
                            title="Move up (senior)"
                            aria-label={`Move ${t.full_name || t.teacher_id} up`}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-40"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            onClick={() => handleMoveTeacher(t.teacher_id, 1)}
                            disabled={reordering || index === filteredTeachers.length - 1}
                            title="Move down (junior)"
                            aria-label={`Move ${t.full_name || t.teacher_id} down`}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-40"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <label
                            className="flex items-center gap-1.5 mr-1"
                            title="Seniority order for exports: 1 = most senior, empty = last"
                          >
                            <span className="text-xs text-gray-500">Priority</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              key={`${t.teacher_id}-${t.seniority_priority ?? 'x'}`}
                              defaultValue={t.seniority_priority ?? ''}
                              placeholder="—"
                              disabled={prioritySavingId === t.teacher_id}
                              onBlur={(e) => handlePriorityChange(t.teacher_id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              aria-label={`Seniority priority for ${t.full_name || t.teacher_id}`}
                              className="w-[72px] px-2 py-2 text-center text-sm rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm disabled:opacity-60"
                            />
                          </label>
                          <button
                            onClick={() => setViewingTeacher(t)}
                            title="View details"
                            aria-label="View teacher details"
                            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openEditTeacher(t)}
                            title="Edit teacher"
                            aria-label="Edit teacher"
                            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-green-700 hover:bg-green-50 transition-colors"
                          >
                            <PenSquare size={18} />
                          </button>
                          <button
                            onClick={() => openChangePassword(t)}
                            title="Change password"
                            aria-label="Change teacher password"
                            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <KeyRound size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteTeacher(t.teacher_id)}
                            className="text-red-500 hover:bg-red-50 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors"
                            aria-label="Delete teacher"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manage Students tab */}
          {tab === 'manage-students' && (
            <div className="card p-6 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 min-w-0">
                  All Students ({filteredStudents.length} matching, showing {pagedStudents.length} on page {safeStudentPage})
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Page {safeStudentPage} of {studentPageCount}</span>
                  <button
                    onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                    disabled={safeStudentPage <= 1}
                    className="btn-secondary btn-sm"
                  >
                    <ChevronLeft size={16} />
                    Prev
                  </button>
                  <button
                    onClick={() => setStudentPage(p => Math.min(studentPageCount, p + 1))}
                    disabled={safeStudentPage >= studentPageCount}
                    className="btn-secondary btn-sm"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-0 sm:min-w-[220px] sm:max-w-sm">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or roll..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="input pl-12"
                  />
                </div>
                <select
                  value={studentFilterSession}
                  onChange={(e) => setStudentFilterSession(e.target.value)}
                  className="input sm:w-auto sm:min-w-[160px]"
                >
                  <option value="all">All Sessions</option>
                  {studentSessions.map((sess) => (
                    <option key={sess} value={sess}>{sess}</option>
                  ))}
                </select>
                <select
                  value={studentFilterProgram}
                  onChange={(e) => setStudentFilterProgram(e.target.value)}
                  className="input sm:w-auto sm:min-w-[160px]"
                >
                  <option value="all">All Programs</option>
                  <option value="HSC">HSC</option>
                  <option value="Degree">Degree</option>
                  <option value="Honours">Honours</option>
                </select>
                <select
                  value={studentFilterGroup}
                  onChange={(e) => setStudentFilterGroup(e.target.value)}
                  className="input sm:w-auto sm:min-w-[160px]"
                >
                  <option value="all">All Groups</option>
                  <option value="Humanities">Humanities</option>
                  <option value="Science">Science</option>
                  <option value="Business Studies">Business Studies</option>
                </select>
                <select
                  value={studentFilterSubject}
                  onChange={(e) => setStudentFilterSubject(e.target.value)}
                  className="input sm:w-auto sm:min-w-[160px]"
                  aria-label="Filter by subject"
                >
                  <option value="all">All Subjects</option>
                  {ALL_SUBJECTS.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3 mb-6">
                <button
                  onClick={() => handleExportStudentList('pdf')}
                  disabled={listExporting !== null}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <Download size={18} />
                  {listExporting === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => handleExportStudentList('csv')}
                  disabled={listExporting !== null}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <FileSpreadsheet size={18} />
                  {listExporting === 'csv' ? 'Preparing CSV...' : 'Download CSV'}
                </button>
                <p className="text-xs text-gray-400 self-center">
                  Exports all students matching the filters above (Roll, Name, Mobile + blank Remarks column, two per row block).
                </p>
              </div>
              {listExportError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-6 flex items-center gap-2" role="alert">
                  <AlertCircle size={16} /> {listExportError}
                </div>
              )}

              {filteredStudents.length === 0 ? (
                <div className="text-center py-12">
                  <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400">No students found.</p>
                </div>
              ) : (
                <>
                  {selectedStudentIds.size > 0 && (
                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-amber-700 font-medium">
                        {selectedStudentIds.size} student{selectedStudentIds.size !== 1 ? 's' : ''} selected
                      </span>
                      <button
                        onClick={() => handleBulkDeleteStudents(Array.from(selectedStudentIds))}
                        className="btn-danger text-sm"
                        disabled={deletingStudent}
                      >
                        <Trash2 size={16} className="mr-1" />
                        Delete Selected ({selectedStudentIds.size})
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          ref={(el) => {
                            if (el) {
                              el.indeterminate = pagedStudents.some((s) => selectedStudentIds.has(s.student_id)) && !pagedStudents.every((s) => selectedStudentIds.has(s.student_id));
                            }
                          }}
                          checked={pagedStudents.length > 0 && pagedStudents.every((s) => selectedStudentIds.has(s.student_id))}
                          onChange={() => handleToggleSelectAll()}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Select All ({pagedStudents.length})</span>
                      </label>
                    </div>
                    <div className="space-y-2">
                      {pagedStudents.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors flex-wrap">
                          <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStudentIds.has(s.student_id)}
                              onChange={() => handleToggleStudent(s.student_id)}
                              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 flex-shrink-0"
                            />
                            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-green-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                              {(s.full_name || s.student_id).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-medium text-gray-800 text-sm truncate">{s.full_name || 'Not updated yet'}</h4>
                              <p className="text-xs text-gray-500 break-words">
                                Roll: {s.class_roll || s.student_id}
                                {s.program ? ` | ${s.program}` : ''}
                                {s.session ? ` | Session: ${s.session}` : ''}
                                {s.ssc_group ? ` | Group: ${s.ssc_group}` : ''}
                                {s.ssc_gpa ? ` | GPA: ${s.ssc_gpa}` : ''}
                                {s.mobile_number ? ` | Phone: ${s.mobile_number}` : ''}
                              </p>
                            </div>
                          </label>
                          <button
                            onClick={() => handleDeleteStudent(s.student_id)}
                            className="text-red-500 hover:bg-red-50 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                            aria-label="Delete student"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manage Notices tab */}
          {tab === 'manage-notices' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card p-6 max-w-lg">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <FileText size={20} className="text-red-600" />
                    Publish New Notice
                  </h2>
                  <p className="text-sm text-gray-500">Post a new notice to the notice board.</p>
                </div>

                {noticeMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <Check size={16} /> {noticeMsg}
                  </div>
                )}
                {noticeError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                    <AlertCircle size={16} /> {noticeError}
                  </div>
                )}

                <form onSubmit={handleCreateNotice} className="space-y-4">
                  <div className="form-group">
                    <label className="label" htmlFor="noticeTitle">Title</label>
                    <input
                      id="noticeTitle"
                      type="text"
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="Notice title"
                      className="input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="noticeCategory">Category</label>
                    <select
                      id="noticeCategory"
                      value={noticeCategory}
                      onChange={(e) => setNoticeCategory(e.target.value)}
                      className="input"
                    >
                      {categoryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="noticeClass">Class / Program</label>
                    <select
                      id="noticeClass"
                      value={noticeClass}
                      onChange={(e) => setNoticeClass(e.target.value)}
                      className="input"
                    >
                      {classOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="noticeContent">Content</label>
                    <textarea
                      id="noticeContent"
                      value={noticeContent}
                      onChange={(e) => setNoticeContent(e.target.value)}
                      rows={4}
                      placeholder="Notice content..."
                      className="input resize-none"
                      required
                    />
                  </div>
                  <button type="submit" disabled={posting} className="btn-primary w-full">
                    <FileText size={18} />
                    {posting ? 'Publishing...' : 'Publish Notice'}
                  </button>
                </form>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Existing Notices ({notices.length})</h2>
                {notices.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No notices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {notices.map((notice) => (
                      <div key={notice.id} className="flex items-start justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div className="flex-1 min-w-0">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            notice.category === 'admission' ? 'bg-blue-50 text-blue-700' :
                            notice.category === 'exam' ? 'bg-red-50 text-red-700' :
                            notice.category === 'result' ? 'bg-green-50 text-green-700' :
                            notice.category === 'holiday' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {notice.category.charAt(0).toUpperCase() + notice.category.slice(1)}
                          </span>
                          <h4 className="font-medium text-gray-800 text-sm mt-1 break-words">{notice.title}</h4>
                          <p className="text-xs text-gray-500 line-clamp-2 break-words">{notice.content}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteNotice(notice.id)}
                          className="text-red-500 hover:bg-red-50 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                          aria-label="Delete notice"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* In-Course Exams tab */}
        {tab === 'manage-incourse' && teacher && (
          <IncourseManager
            auth={{ principalId: teacher.teacher_id, principalPassword: password }}
            departments={Object.keys(DEPARTMENTS)}
            isPrincipal
          />
        )}

        {/* Manage Departments tab */}
        {tab === 'manage-departments' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                <Building2 size={20} className="text-teal-600" />
                Manage Departments
              </h2>
              <p className="text-sm text-gray-500">
                Assign a department head and other teachers for each department. Assigned teachers can publish notices
                to their department page, and their profiles appear there.
              </p>
            </div>

            {deptMsg && (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl flex items-center gap-2 animate-slide-down">
                <Check size={16} /> {deptMsg}
              </div>
            )}
            {deptError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2 animate-slide-down" role="alert">
                <AlertCircle size={16} /> {deptError}
              </div>
            )}

            {DEPARTMENT_NAV.map((section) => (
              <div key={section.group}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{section.group}</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {section.items.map((item) => {
                    const info = DEPARTMENTS[item.slug];
                    const form = deptForm[item.slug] || { head: '', members: [] };
                    const staffTeachers = teachers.filter((t) => !t.is_principal);
                    const saving = deptSaving === item.slug;
                    return (
                      <div key={item.slug} className="card p-5 sm:p-6">
                        <h4 className="font-bold text-gray-900 mb-1">{info ? info.title : item.label}</h4>
                        <p className="text-xs text-gray-500 mb-4">
                          {(deptStaff.filter((r) => r.department_slug === item.slug).length)} assigned
                        </p>
                        <div className="form-group mb-4">
                          <label className="label" htmlFor={`dept-head-${item.slug}`}>Department Head</label>
                          <select
                            id={`dept-head-${item.slug}`}
                            value={form.head}
                            onChange={(e) => setDeptForm((prev) => ({
                              ...prev,
                              [item.slug]: { head: e.target.value, members: (prev[item.slug]?.members || []).filter((m) => m !== e.target.value) },
                            }))}
                            className="input"
                            disabled={saving}
                          >
                            <option value="">— None —</option>
                            {staffTeachers.map((t) => (
                              <option key={t.teacher_id} value={t.teacher_id}>
                                {t.full_name || t.teacher_id} ({t.teacher_id}{t.subject ? ` · ${t.subject}` : ''})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group mb-4">
                          <span className="label">Other Teachers</span>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3 overscroll-contain">
                            {staffTeachers.filter((t) => t.teacher_id !== form.head).map((t) => {
                              const checked = form.members.includes(t.teacher_id);
                              return (
                                <label key={t.teacher_id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 cursor-pointer min-h-[44px]">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => setDeptForm((prev) => {
                                      const cur = prev[item.slug] || { head: '', members: [] };
                                      return {
                                        ...prev,
                                        [item.slug]: {
                                          ...cur,
                                          members: e.target.checked
                                            ? [...cur.members, t.teacher_id]
                                            : cur.members.filter((m) => m !== t.teacher_id),
                                        },
                                      };
                                    })}
                                    className="w-5 h-5 rounded accent-teal-600 flex-shrink-0"
                                    disabled={saving}
                                  />
                                  <span className="text-sm text-gray-700 truncate">
                                    {t.full_name || t.teacher_id}
                                    <span className="text-gray-400"> ({t.teacher_id}{t.subject ? ` · ${t.subject}` : ''})</span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveDeptStaff(item.slug)}
                          disabled={saving}
                          className="btn-primary w-full"
                        >
                          <Check size={18} />
                          {saving ? 'Saving...' : 'Save Department Staff'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manage Exams tab */}
        {tab === 'manage-exams' && (
          <div className="space-y-6 animate-fade-in">
            <div className="card p-6 max-w-lg">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-1">
                  <ClipboardList size={20} className="text-indigo-600" />
                  Create Exam
                </h2>
                <p className="text-sm text-gray-500">
                  Create an exam for a class, session, and subject. Teachers can input marks once the exam is active.
                </p>
              </div>

              {examMsg && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                  <Check size={16} /> {examMsg}
                </div>
              )}
              {examError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down" role="alert">
                  <AlertCircle size={16} /> {examError}
                </div>
              )}

              <form onSubmit={handleCreateExam} className="space-y-4">
                <div className="form-group">
                  <label className="label" htmlFor="examName">Exam Name</label>
                  <input
                    id="examName"
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. First Term Exam 2026"
                    className="input"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label" htmlFor="examProgram">Class / Program</label>
                    <select
                      id="examProgram"
                      value={examProgram}
                      onChange={(e) => {
                        const program = e.target.value;
                        setExamProgram(program);
                        // Drop any already-ticked subjects that don't belong to the new program.
                        setExamSubjects((prev) => prev.filter((s) => examSubjectsForProgram(program).includes(s)));
                      }}
                      className="input"
                    >
                      <option value="HSC">HSC</option>
                      <option value="Degree">Degree</option>
                      <option value="Honours">Honours</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="examSession">Session</label>
                    <input
                      id="examSession"
                      type="text"
                      list="exam-session-options"
                      value={examSession}
                      onChange={(e) => setExamSession(e.target.value)}
                      placeholder="e.g. 2025-2026"
                      className="input"
                      required
                    />
                    <datalist id="exam-session-options">
                      {studentSessions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Subjects</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-3">
                    {examSubjectsForProgram(examProgram).map((s) => {
                      const checked = examSubjects.includes(s);
                      return (
                        <label
                          key={s}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                            checked
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setExamSubjects((prev) =>
                                checked ? prev.filter((x) => x !== s) : [...prev, s]
                              )
                            }
                            className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
                          />
                          <span className="text-sm font-medium">{s}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Select all subjects for this exam — only {examProgram} subjects are listed. Teachers of the selected subjects will be able to input marks.
                  </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={examActive}
                    onChange={(e) => setExamActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active now — teachers can start inputting marks immediately
                  </span>
                </label>
                <button type="submit" disabled={examSaving} className="btn-primary w-full">
                  <ClipboardList size={18} />
                  {examSaving ? 'Creating...' : 'Create Exam'}
                </button>
              </form>
            </div>

            {subjectMsg && (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl flex items-center gap-2 animate-slide-down">
                <Check size={16} /> {subjectMsg}
              </div>
            )}
            {passMarksMsg && (
              <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl flex items-center gap-2 animate-slide-down">
                <Check size={16} /> {passMarksMsg}
              </div>
            )}

            <div className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">All Exams ({exams.length})</h2>
              {exams.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No exams yet.</p>
              ) : (
                <div className="space-y-3">
                  {exams.map((exam) => {
                    const expanded = expandedExamId === exam.id;
                    const visibleSubjects = expanded ? exam.subjects : exam.subjects.slice(0, 6);
                    return (
                    <article
                      key={exam.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 text-base break-words">{exam.name}</h4>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <span className={`inline-flex px-2 py-0.5 rounded-full font-medium ${
                              exam.program === 'HSC' ? 'bg-blue-50 text-blue-700' :
                              exam.program === 'Degree' ? 'bg-purple-50 text-purple-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {exam.program}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                              <Calendar size={12} />
                              {exam.session}
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <ClipboardList size={12} />
                              {exam.marks_count ?? 0} marks entered
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            exam.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${exam.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {exam.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <button
                            onClick={() => handleDeleteExam(exam)}
                            className="text-red-500 hover:bg-red-50 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors"
                            aria-label={`Delete exam ${exam.name}`}
                            title="Delete exam"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {visibleSubjects.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700"
                          >
                            <BookOpen size={12} />
                            {s}
                          </span>
                        ))}
                        {exam.subjects.length > 6 && (
                          <button
                            onClick={() => setExpandedExamId(expanded ? null : exam.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors min-h-[26px]"
                          >
                            {expanded ? 'Show less' : `+${exam.subjects.length - 6} more`}
                            <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => openModifySubjects(exam)}
                          className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <ListPlus size={15} />
                          Modify Subjects
                        </button>
                        <button
                          onClick={() => openPassMarks(exam)}
                          className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                        >
                          <FileSpreadsheet size={15} />
                          Pass Marks
                        </button>
                        {exam.program === 'HSC' && (
                          <button
                            onClick={() => openPractical(exam)}
                            className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                          >
                            <FlaskConical size={15} />
                            Practical
                          </button>
                        )}
                        <button
                          onClick={() => handleViewResult(exam)}
                          className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          <Eye size={15} />
                          View Result
                        </button>
                        <button
                          onClick={() => openSummary(exam)}
                          className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                        >
                          <BarChart3 size={15} />
                          Summary
                        </button>
                        <button
                          onClick={() => handleToggleExam(exam)}
                          disabled={examTogglingId === exam.id}
                          className={`inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${
                            exam.is_active
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          <Power size={15} />
                          {examTogglingId === exam.id
                            ? 'Updating...'
                            : exam.is_active
                              ? 'Deactivate'
                              : 'Activate'}
                        </button>
                      </div>
                    </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* View Teacher Modal */}
        {viewingTeacher && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setViewingTeacher(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between rounded-t-2xl">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Teacher Details</h3>
                <button
                  onClick={() => setViewingTeacher(null)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-green-600 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {(viewingTeacher.full_name || viewingTeacher.teacher_id).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{viewingTeacher.full_name || 'Not updated yet'}</p>
                    <p className="text-sm text-gray-500">ID: {viewingTeacher.teacher_id}</p>
                    {viewingTeacher.is_principal && (
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Principal
                      </span>
                    )}
                  </div>
                </div>
                {TEACHER_EDIT_SECTIONS.map((section) => {
                  const rows = section.fields
                    .map((f) => ({ label: f.label, value: viewingTeacher[f.key] }))
                    .filter((r) => r.value);
                  if (rows.length === 0) return null;
                  return (
                    <div key={section.title} className="mb-5">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{section.title}</h4>
                      <div>
                        {rows.map((r) => (
                          <div key={r.label} className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                            <span className="text-sm text-gray-500 flex-shrink-0">{r.label}</span>
                            <span className="text-sm font-medium text-gray-900 text-right break-words">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Access & Metadata</h4>
                  <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-500 flex-shrink-0">Notice Writing Access</span>
                    <span className={`text-sm font-medium ${viewingTeacher.can_write_notice ? 'text-green-700' : 'text-gray-400'}`}>
                      {viewingTeacher.can_write_notice ? 'Yes' : 'No'}
                    </span>
                  </div>
                  {viewingTeacher.created_at && (
                    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500 flex-shrink-0">Created At</span>
                      <span className="text-sm font-medium text-gray-900 text-right">{new Date(viewingTeacher.created_at).toLocaleString()}</span>
                    </div>
                  )}
                  {viewingTeacher.updated_at && (
                    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-500 flex-shrink-0">Last Updated</span>
                      <span className="text-sm font-medium text-gray-900 text-right">{new Date(viewingTeacher.updated_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Teacher Modal */}
        {editingTeacher && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditingTeacher(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Edit Teacher</h3>
                  <p className="text-xs text-gray-500 truncate">ID: {editingTeacher.teacher_id}</p>
                </div>
                <button
                  onClick={() => setEditingTeacher(null)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveTeacher} className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
                  {editError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
                      <AlertCircle size={16} /> {editError}
                    </div>
                  )}
                  {TEACHER_EDIT_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{section.title}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {section.fields.map((f) => (
                          <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
                            <label className="label" htmlFor={`edit-${f.key}`}>{f.label}</label>
                            {f.type === 'textarea' ? (
                              <textarea
                                id={`edit-${f.key}`}
                                rows={2}
                                value={(editForm[f.key] as string) || ''}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                className="input"
                              />
                            ) : f.type === 'select' ? (
                              <select
                                id={`edit-${f.key}`}
                                value={(editForm[f.key] as string) || ''}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                className="input"
                              >
                                <option value="" disabled>Select {f.label.toLowerCase()}</option>
                                {(f.options || []).map((opt) => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                id={`edit-${f.key}`}
                                type={f.type === 'date' ? 'date' : 'text'}
                                value={(editForm[f.key] as string) || ''}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                className="input"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editNoticeAccess}
                      onChange={(e) => setEditNoticeAccess(e.target.checked)}
                      className="w-4 h-4 rounded accent-green-700 flex-shrink-0"
                    />
                    <span className="text-sm font-medium text-gray-700">Can write notices</span>
                  </label>
                </div>
                <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 flex-shrink-0">
                  <button type="button" onClick={() => setEditingTeacher(null)} className="btn-secondary w-full sm:w-auto">
                    Cancel
                  </button>
                  <button type="submit" disabled={editSaving} className="btn-primary w-full sm:w-auto">
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Change Password Modal */}
        {passwordTeacher && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setPasswordTeacher(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-sm max-h-[92vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">Change Password</h3>
                  <p className="text-xs text-gray-500 truncate">ID: {passwordTeacher.teacher_id}</p>
                </div>
                <button
                  onClick={() => setPasswordTeacher(null)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleChangePassword} className="p-4 sm:p-6 space-y-4">
                {passwordError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {passwordError}
                  </div>
                )}
                <p className="text-sm text-gray-500">
                  Set a new password for <span className="font-semibold text-gray-700">{passwordTeacher.full_name || passwordTeacher.teacher_id}</span>. They will log in with this password.
                </p>
                <div className="form-group">
                  <label className="label" htmlFor="newTeacherPassword">New Password</label>
                  <input
                    id="newTeacherPassword"
                    type="text"
                    value={newTeacherPassword}
                    onChange={(e) => setNewTeacherPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="input"
                    required
                    minLength={4}
                    autoComplete="new-password"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
                  <button type="button" onClick={() => setPasswordTeacher(null)} className="btn-secondary w-full sm:w-auto">
                    Cancel
                  </button>
                  <button type="submit" disabled={passwordSaving} className="btn-primary w-full sm:w-auto">
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Exam Result Modal */}
        {viewingExamResult && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setViewingExamResult(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-6xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList size={20} className="text-indigo-600 flex-shrink-0" />
                    <span className="truncate">{viewingExamResult.name} — Result</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {viewingExamResult.program} | {viewingExamResult.session} | {viewingExamResult.subjects.join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={handlePrintResult}
                    disabled={examResultLoading || resultRows.length === 0}
                    title="Print result (all groups)"
                    aria-label="Print result"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={16} />
                    <span className="hidden md:inline">Print</span>
                  </button>
                  <button
                    onClick={handleDownloadResultPdf}
                    disabled={examResultLoading || exportingPdf || resultRows.length === 0}
                    title="Download result as PDF (all groups)"
                    aria-label="Download result as PDF"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={16} />
                    <span className="hidden md:inline">{exportingPdf ? 'Saving…' : 'PDF'}</span>
                  </button>
                  <button
                    onClick={() => setViewingExamResult(null)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-3 sm:p-6 overflow-y-auto overflow-x-scroll flex-1 overscroll-contain">
                {pdfExportError && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-lg mb-4" role="alert">
                    {pdfExportError}
                  </div>
                )}
                {examResultLoading ? (
                  <div className="text-center py-10" role="status">
                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading results...</p>
                  </div>
                ) : examResultError ? (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {examResultError}
                  </div>
                ) : !examResultData || examResultData.students.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">
                    No students with {viewingExamResult.subjects.join(' or ')} in {viewingExamResult.program}, {viewingExamResult.session} yet.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-4" role="tablist">
                      {resultTabs.map((t) => (
                        <button
                          key={t}
                          role="tab"
                          aria-selected={resultTab === t}
                          onClick={() => setResultTab(t)}
                          className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all ${
                            resultTab === t
                              ? 'bg-indigo-600 text-white shadow'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {t}
                          <span className={`text-xs ${resultTab === t ? 'text-indigo-100' : 'text-gray-400'}`}>
                            {resultTabCounts.get(t) || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                    {tabRows.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-6">
                        No {resultTab} students in {viewingExamResult.program}, {viewingExamResult.session} have marks for this exam yet.
                      </p>
                    ) : (
                      <div className="-mx-3 px-3 sm:mx-0 sm:px-0 overscroll-x-contain" tabIndex={0} role="region" aria-label="Exam result table, scroll horizontally to see all subjects">
                        <table className="w-full min-w-[560px] text-sm text-center border-collapse [&_th]:align-middle [&_td]:align-middle">
                          <thead>
                            <tr className="bg-gray-50">
                              <th rowSpan={2} className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap shadow-[1px_0_0_0_#e5e7eb]">
                                Roll
                              </th>
                              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap max-w-[140px] sm:max-w-none truncate">
                                Name
                              </th>
                              {tabSubjects.map((s) => {
                                const totalOnly = viewingExamResult ? isTotalOnlySubject(viewingExamResult, s) : false;
                                return (
                                  <th
                                    key={s}
                                    colSpan={totalOnly ? 1 : 3}
                                    title={totalOnly ? `${s} (Total only)` : s}
                                    className="px-3 py-2 text-center text-xs font-semibold text-indigo-700 border-b border-l border-gray-200 whitespace-nowrap"
                                  >
                                    {resultColumnHeading(s)}
                                  </th>
                                );
                              })}
                              <th
                                rowSpan={2}
                                title="4th subject marks are never added to the Total. If the 4th subject score is above 40, only the extra marks (score − 40) are added to the Total and shown in this column."
                                className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b border-l border-gray-200 whitespace-nowrap cursor-help"
                              >
                                4th subject
                              </th>
                              {resultTab === 'Science' && (
                                <th
                                  rowSpan={2}
                                  title="Science practical marks: one value per student, summed into the Total. Enter via the Practical button on the exam."
                                  className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b border-l border-gray-200 whitespace-nowrap cursor-help"
                                >
                                  Practical
                                </th>
                              )}
                              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b border-l border-gray-200 whitespace-nowrap">
                                Total
                              </th>
                              <th rowSpan={2} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border-b border-l border-r border-gray-200 whitespace-nowrap">
                                Rank / Status
                              </th>
                            </tr>
                            <tr className="bg-gray-50">
                              {tabSubjects.flatMap((s) => {
                                if (viewingExamResult && isTotalOnlySubject(viewingExamResult, s)) {
                                  return [
                                    <th key={`${s}-tot`} className="px-2 py-1.5 text-center text-[11px] font-medium text-gray-500 border-b border-l border-r border-gray-200">Total</th>,
                                  ];
                                }
                                return [
                                  <th key={`${s}-cq`} className="px-2 py-1.5 text-center text-[11px] font-medium text-gray-500 border-b border-l border-gray-200">CQ</th>,
                                  <th key={`${s}-mcq`} className="px-2 py-1.5 text-center text-[11px] font-medium text-gray-500 border-b border-gray-200">MCQ</th>,
                                  <th key={`${s}-tot`} className="px-2 py-1.5 text-center text-[11px] font-medium text-gray-500 border-b border-r border-gray-200">Total</th>,
                                ];
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {tabRows.map((row) => {
                              const { student } = row;
                              // Resolve the 4th subject by NAME. row.fourthSubjectIndex is
                              // an index into exam.subjects, while this table's columns are
                              // the group's subject list — comparing the two indexes directly
                              // highlighted whichever subject happened to share that slot.
                              const effFourth = effectiveFourthSubject(student, row.group);
                              const fourthInExam = !!effFourth && viewingExamResult.subjects.some(
                                (s) => s.toLowerCase() === effFourth.toLowerCase()
                              );
                              return (
                                <tr key={student.id} className="hover:bg-indigo-50/40 transition-colors">
                                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-center font-medium text-gray-700 whitespace-nowrap border-b border-gray-100 shadow-[1px_0_0_0_#f3f4f6]">
                                    {student.class_roll || student.student_id}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-medium text-gray-900 whitespace-nowrap border-b border-gray-100 max-w-[140px] sm:max-w-none truncate" title={student.full_name || 'Profile not updated'}>
                                    {student.full_name || 'Profile not updated'}
                                  </td>
                                  {tabSubjects.flatMap((subj, i) => {
                                    if (!tabSubjectSet.has(subj) && ALL_GROUP_SUBJECTS.has(subj)) {
                                      return [];
                                    }
                                    const m = row.studentMarks[viewingExamResult.subjects.indexOf(subj)];
                                    const markStatus = m?.status === 'absent' ? 'A' : m?.status === 'expelled' ? 'E' : null;
                                    const isFourth =
                                      fourthInExam && subj.toLowerCase() === effFourth.toLowerCase();
                                    // Total-only subjects (e.g. English without MCQ) render one Total cell.
                                    if (isTotalOnlySubject(viewingExamResult, subj)) {
                                      const fails = m && viewingExamResult ? getStudentFails(viewingExamResult, subj, m) : [];
                                      const failed = fails.length > 0;
                                      const failMark = fails[0]?.passMark;
                                      return [
                                        <td
                                          key={`tot-${i}`}
                                          title={markStatus === 'A' ? 'Absent' : markStatus === 'E' ? 'Expelled' : failed && m ? `Failed — pass mark is ${failMark}` : `${subj} (Total only)`}
                                          className={`px-2 py-2.5 text-center font-medium border-b border-l border-r border-gray-100 ${isFourth ? 'bg-yellow-200 ' : ''}${markStatus || failed ? 'text-red-700 font-bold' : 'text-black'}`}
                                        >
                                          {markStatus ?? (m ? m.cq + m.mcq : <span className="text-gray-300">—</span>)}
                                        </td>,
                                      ];
                                    }
                                    const cqFail =
                                      m && viewingExamResult
                                        ? getStudentFails(viewingExamResult, subj, m).some((f) => f.component === 'CQ')
                                        : false;
                                    const mcqFail =
                                      m && viewingExamResult
                                        ? getStudentFails(viewingExamResult, subj, m).some((f) => f.component === 'MCQ')
                                        : false;
                                    const cellTone = (failed: boolean) =>
                                      failed ? 'text-red-700 font-bold' : 'text-gray-700';
                                    const totalTone = `${isFourth ? 'bg-yellow-200 ' : ''}${markStatus ? 'text-red-700' : 'text-black'}`;
                                    return [
                                      <td
                                        key={`cq-${i}`}
                                        title={cqFail && m ? `Failed — CQ pass mark is ${getStudentFails(viewingExamResult!, subj, m).find((f) => f.component === 'CQ')!.passMark}` : undefined}
                                        className={`px-2 py-2.5 text-center border-b border-l border-gray-100 ${cellTone(cqFail)}`}
                                      >
                                        {m ? m.cq : <span className="text-gray-300">—</span>}
                                      </td>,
                                      <td
                                        key={`mcq-${i}`}
                                        title={mcqFail && m ? `Failed — MCQ pass mark is ${getStudentFails(viewingExamResult!, subj, m).find((f) => f.component === 'MCQ')!.passMark}` : undefined}
                                        className={`px-2 py-2.5 text-center border-b border-gray-100 ${cellTone(mcqFail)}`}
                                      >
                                        {m ? m.mcq : <span className="text-gray-300">—</span>}
                                      </td>,
                                      <td
                                        key={`tot-${i}`}
                                        title={markStatus === 'A' ? 'Absent' : markStatus === 'E' ? 'Expelled' : undefined}
                                        className={`px-2 py-2.5 text-center font-medium border-b border-r border-gray-100 ${totalTone} ${markStatus ? 'font-bold' : ''}`}
                                      >
                                        {markStatus ?? (m ? m.cq + m.mcq : <span className="text-gray-300">—</span>)}
                                      </td>,
                                    ];
                                  })}
                                  <td className="px-3 py-2.5 text-center border-b border-l border-gray-100">
                                    {(() => {
                                      if (effFourth && !fourthInExam) {
                                        return (
                                          <span
                                            className="text-xs font-normal text-gray-400 cursor-help"
                                            title={`${effFourth} is not part of this exam, so no 4th-subject marks or bonus apply for this student.`}
                                           >
                                             N/A
                                           </span>
                                         );
                                       }
                                       return row.hasFourth ? (
                                         row.fourthBonus
                                       ) : (
                                         <span className="text-gray-300">—</span>
                                       );
                                     })()}
                                  </td>
                                  {resultTab === 'Science' && (
                                    <td className="px-3 py-2.5 text-center font-medium text-gray-700 border-b border-l border-gray-100">
                                      {row.hasPractical ? (
                                        row.practical
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  )}
                                  <td className="px-3 py-2.5 text-center font-bold text-gray-900 border-b border-l border-gray-100">
                                    {row.anyMarked ? row.mainTotal : <span className="text-gray-300">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center border-b border-l border-r border-gray-100">
                                    {renderStudentStatus(row)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Exam Summary Modal */}
        {summaryExam && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSummaryExam(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 size={20} className="text-sky-600 flex-shrink-0" />
                    <span className="truncate">{summaryExam.name} — Summary</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {summaryExam.program} | {summaryExam.session}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  <button
                    onClick={handlePrintSummary}
                    disabled={summaryLoading || !summaryData}
                    title="Print summary (college pad)"
                    aria-label="Print summary"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={16} />
                    <span className="hidden md:inline">Print</span>
                  </button>
                  <button
                    onClick={() => setSummaryExam(null)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain">
                {summaryLoading ? (
                  <div className="text-center py-10" role="status">
                    <div className="w-12 h-12 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading summary...</p>
                  </div>
                ) : summaryError ? (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {summaryError}
                  </div>
                ) : summaryData && (
                  <>
                    {/* College pad header */}
                    <div className="text-center border-b-2 border-green-800 pb-4 mb-5">
                      <img src="/logo.png" alt="Sufia Motin Mohila College crest" className="w-14 h-14 mx-auto mb-2 object-contain" />
                      <h4 className="font-display text-lg sm:text-xl font-bold text-green-900">Sufia Motin Mohila College</h4>
                      <p className="text-xs text-gray-500">Jatrapasha (3351), Baniachong, Habiganj</p>
                      <h5 className="font-bold text-gray-900 mt-2">{summaryExam.name} — Exam Summary</h5>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {summaryExam.program} · {summaryExam.session} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>

                    {summaryData.groups.map((g) => (
                      <section key={g.group} className="mb-7 last:mb-0">
                        <h4 className="font-bold text-gray-900 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 mb-3 text-sm sm:text-base">
                          {g.group} — {g.appeared}/{g.total} appeared · Pass {g.passRate.toFixed(1)}%
                        </h4>

                        <div className="grid grid-cols-2 min-[480px]:grid-cols-4 gap-2.5 mb-4">
                          {[
                            { label: 'Appeared', value: String(g.appeared) },
                            { label: 'Passed', value: String(g.passed) },
                            { label: 'Failed', value: String(g.failed) },
                            { label: 'Absent/Expelled', value: String(g.absentExpelled) },
                            { label: 'Not appeared', value: String(g.notAppeared) },
                            { label: 'Average', value: g.appeared ? g.average.toFixed(1) : '—' },
                            { label: 'Highest', value: g.appeared ? String(g.highest) : '—' },
                            { label: 'Lowest', value: g.appeared ? String(g.lowest) : '—' },
                            ...(g.avgPractical != null ? [{ label: 'Avg practical', value: g.avgPractical.toFixed(1) }] : []),
                          ].map((s) => (
                            <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-center">
                              <p className="text-lg font-bold text-gray-900 leading-tight">{s.value}</p>
                              <p className="text-[11px] text-gray-500">{s.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Top 3 students</h5>
                            {g.top3.length === 0 ? (
                              <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-3">No rank-eligible students</p>
                            ) : (
                              <table className="w-full text-sm text-center border-collapse">
                                <thead>
                                  <tr className="bg-gray-50 text-xs text-gray-500">
                                    <th className="px-2 py-1.5 border-b border-gray-200">#</th>
                                    <th className="px-2 py-1.5 border-b border-gray-200">Roll</th>
                                    <th className="px-2 py-1.5 border-b border-gray-200 text-left">Name</th>
                                    <th className="px-2 py-1.5 border-b border-gray-200">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {g.top3.map((t, i) => (
                                    <tr key={t.roll} className="border-b border-gray-50">
                                      <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                                      <td className="px-2 py-2 font-medium text-gray-700">{t.roll}</td>
                                      <td className="px-2 py-2 text-left font-medium text-gray-900 max-w-[140px] truncate" title={t.name}>{t.name}</td>
                                      <td className="px-2 py-2 text-gray-900">{t.total}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Fail distribution</h5>
                            <table className="w-full text-sm text-center border-collapse">
                              <thead>
                                <tr className="bg-gray-50 text-xs text-gray-500">
                                  <th className="px-2 py-1.5 border-b border-gray-200 text-left">Fail bracket</th>
                                  <th className="px-2 py-1.5 border-b border-gray-200">Students</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.failDist.map((d) => (
                                  <tr key={d.failedIn} className="border-b border-gray-50">
                                    <td className="px-2 py-2 text-left text-gray-700">Failed in {d.failedIn} subject{d.failedIn === '1' ? '' : 's'}</td>
                                    <td className={`px-2 py-2 ${d.count > 0 ? 'text-red-700' : 'text-gray-400'}`}>{d.count}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <h5 className="text-sm font-semibold text-gray-700 mb-2">Subject-wise performance</h5>
                        <div className="overflow-x-auto overscroll-x-contain -mx-4 px-4 sm:mx-0 sm:px-0">
                          <table className="w-full min-w-[420px] text-sm text-center border-collapse">
                            <thead>
                              <tr className="bg-gray-50 text-xs text-gray-500">
                                <th className="px-2 py-1.5 border-b border-gray-200 text-left">Subject</th>
                                <th className="px-2 py-1.5 border-b border-gray-200">Appeared</th>
                                <th className="px-2 py-1.5 border-b border-gray-200">Passed</th>
                                <th className="px-2 py-1.5 border-b border-gray-200">Failed</th>
                                <th className="px-2 py-1.5 border-b border-gray-200">Pass %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.subjects.map((s) => (
                                <tr key={s.subject} className="border-b border-gray-50">
                                  <td className="px-2 py-2 text-left font-medium text-gray-800">{s.subject}</td>
                                  <td className="px-2 py-2 text-gray-700">{s.appeared}</td>
                                  <td className="px-2 py-2 text-green-700">{s.passed}</td>
                                  <td className={`px-2 py-2 ${s.failed > 0 ? 'text-red-700' : 'text-gray-400'}`}>{s.failed}</td>
                                  <td className="px-2 py-2 text-gray-900">{s.appeared ? Math.round((s.passed / s.appeared) * 100) : 0}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Modify Subjects Modal */}
        {subjectExam && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSubjectExam(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 rounded-t-2xl">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ListPlus size={20} className="text-indigo-600 flex-shrink-0" />
                    <span className="truncate">Modify Subjects</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {subjectExam.name} | {subjectExam.program} | {subjectExam.session}
                  </p>
                </div>
                <button
                  onClick={() => setSubjectExam(null)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                {subjectError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {subjectError}
                  </div>
                )}
                <div className="form-group">
                  <label className="label">Subjects</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-3">
                    {modifySubjectOptions.map((s) => {
                      const checked = subjectList.includes(s);
                      return (
                        <label
                          key={s}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${
                            checked
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSubjectList((prev) =>
                                checked ? prev.filter((x) => x !== s) : [...prev, s]
                              )
                            }
                            className="w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
                          />
                          <span className="text-sm font-medium">{s}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    Select the subjects included in this exam — only {subjectExam.program} subjects are listed. Removing a subject hides its marks from the result view.
                  </p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 mt-4">
                  <button type="button" onClick={() => setSubjectExam(null)} className="btn-secondary w-full sm:w-auto">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSubjects}
                    disabled={subjectSaving || subjectList.length === 0}
                    className="btn-primary w-full sm:w-auto"
                  >
                    <Check size={18} />
                    {subjectSaving ? 'Saving...' : 'Save Subjects'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Pass Marks Modal */}
        {passMarksExam && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setPassMarksExam(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 rounded-t-2xl">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet size={20} className="text-purple-600 flex-shrink-0" />
                    <span className="truncate">Pass Marks</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {passMarksExam.name} | {passMarksExam.program} | {passMarksExam.session}
                  </p>
                </div>
                <button
                  onClick={() => setPassMarksExam(null)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                {passMarksError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {passMarksError}
                  </div>
                )}
                <p className="text-sm text-gray-500 mb-4">
                  For each subject, set the full marks and minimum pass mark for CQ and MCQ. A student scoring below a pass mark gets that field red-flagged in the result view. Leave a pass mark empty to skip fail-checking for that component. Tick "Total only" for subjects with no CQ/MCQ split (e.g. English without MCQ) — teachers enter one Total value and the result shows a single Total column.
                </p>
                <div className="space-y-3">
                  {passMarksExam.subjects.map((s) => {
                    const pm = passMarksForm[s];
                    return (
                      <div key={s} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">{s}</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="label text-xs">CQ out of</label>
                            <input
                              type="number"
                              min="1"
                              value={pm?.outOfCq || ''}
                              onChange={(e) => updatePassField(s, 'outOfCq', e.target.value)}
                              placeholder="e.g. 50"
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">CQ pass mark</label>
                            <input
                              type="number"
                              min="0"
                              value={pm?.cqPass ?? ''}
                              onChange={(e) => updatePassField(s, 'cqPass', e.target.value)}
                              placeholder="e.g. 17"
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">MCQ out of</label>
                            <input
                              type="number"
                              min="1"
                              value={pm?.outOfMcq || ''}
                              onChange={(e) => updatePassField(s, 'outOfMcq', e.target.value)}
                              placeholder="e.g. 25"
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">MCQ pass mark</label>
                            <input
                              type="number"
                              min="0"
                              value={pm?.mcqPass ?? ''}
                              onChange={(e) => updatePassField(s, 'mcqPass', e.target.value)}
                              placeholder="e.g. 10"
                              className="input"
                            />
                          </div>
                        </div>
                        <label
                          className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer min-h-[44px]"
                          title="Single Total input and Total-only column instead of the CQ/MCQ split (e.g. English without MCQ)"
                        >
                          <input
                            type="checkbox"
                            checked={pm?.totalOnly === true}
                            onChange={(e) => updatePassField(s, 'totalOnly', e.target.checked)}
                            className="w-5 h-5 rounded accent-indigo-600"
                          />
                          Total only (no CQ/MCQ split)
                        </label>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 mt-4">
                  <button type="button" onClick={() => setPassMarksExam(null)} className="btn-secondary w-full sm:w-auto">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePassMarks}
                    disabled={passMarksSaving}
                    className="btn-primary w-full sm:w-auto"
                  >
                    <Check size={18} />
                    {passMarksSaving ? 'Saving...' : 'Save Pass Marks'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Practical Marks Modal (Science only) */}
        {practicalExam && createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setPracticalExam(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 rounded-t-2xl">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <FlaskConical size={20} className="text-teal-600 flex-shrink-0" />
                    <span className="truncate">Practical Marks — Science</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {practicalExam.name} | {practicalExam.program} | {practicalExam.session}
                  </p>
                </div>
                <button
                  onClick={() => setPracticalExam(null)}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 sm:p-6">
                {practicalMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2">
                    <Check size={16} /> {practicalMsg}
                  </div>
                )}
                {practicalError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {practicalError}
                  </div>
                )}
                <p className="text-sm text-gray-500 mb-4">
                  One practical value per Science student (0–{MAX_PRACTICAL_MARKS}). It is summed into the student's Total. Leave blank to skip a student.
                </p>
                {practicalLoading ? (
                  <div className="text-center py-8" role="status">
                    <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm text-gray-500">Loading Science students...</p>
                  </div>
                ) : practicalStudents.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-6">
                    No Science students in {practicalExam.program}, {practicalExam.session} yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {practicalStudents.map((s) => (
                      <div key={s.student_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{s.full_name || 'Profile not updated'}</p>
                          <p className="text-xs text-gray-500">Roll: {s.class_roll || s.student_id}</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={MAX_PRACTICAL_MARKS}
                          step="0.01"
                          value={practicalForm[s.student_id] ?? ''}
                          onChange={(e) => setPracticalForm((prev) => ({ ...prev, [s.student_id]: e.target.value }))}
                          placeholder="—"
                          aria-label={`Practical marks for ${s.full_name || s.class_roll}`}
                          className="input w-24 text-center"
                          disabled={practicalSaving}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 mt-4">
                  <button type="button" onClick={() => setPracticalExam(null)} className="btn-secondary w-full sm:w-auto">
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePractical}
                    disabled={practicalSaving || practicalLoading || practicalStudents.length === 0}
                    className="btn-primary w-full sm:w-auto"
                  >
                    <Check size={18} />
                    {practicalSaving ? 'Saving...' : 'Save Practical Marks'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DashboardShell>
  );
}
