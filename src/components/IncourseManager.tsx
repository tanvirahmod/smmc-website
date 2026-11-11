import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList, Plus, Eye, Pencil, Trash2, X, Check, AlertCircle,
  ArrowLeft, ArrowRight, Printer, Users, FlaskConical, BookOpen, Calendar,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import {
  fetchIncourseExams, createIncourseExam, updateIncourseExam, deleteIncourseExam,
  fetchIncourseStudents, fetchIncourseMarks, fetchIncourseResult, saveIncourseMark,
  fetchIncourseCatalog, saveIncourseCatalogSubjects, updateIncourseCatalogSubject, deleteIncourseCatalogSubject,
  saveIncourseRoutine,
  type InCourseAuth, type InCourseExam, type InCourseMark, type InCourseSubject, type InCourseCatalogSubject, type InCourseRoutineRow, type Student,
} from '@/lib/apiClient';
import { DEPARTMENTS } from '@/lib/departments';
import { printIncourseSheet, printIncourseRoutine, formatShortDate } from '@/lib/resultExport';

/** Name/code accessors (tolerate legacy plain-string subjects). */
function subjName(s: InCourseSubject | string): string {
  return typeof s === 'string' ? s : s.name;
}
function subjCode(s: InCourseSubject | string): string {
  return typeof s === 'string' ? '' : s.code || '';
}

export interface InCourseResultRow {
  student: Student;
  perSubject: { subject: string; mark?: InCourseMark }[];
  /** Sum of paper marks over present entries; null when nothing present entered. */
  paperTotal: number | null;
  /** Mean attendance over present entries; null when none. */
  atteAvg: number | null;
  hasAbsent: boolean;
  anyMarked: boolean;
}

function rollOf(s: Student): string {
  return (s.class_roll || s.student_id || '').trim();
}

function byRoll(a: Student, b: Student): number {
  return rollOf(a).localeCompare(rollOf(b), undefined, { numeric: true });
}

/** Pure result computation (totals + averages). Exported for checks. */
export function computeIncourseResult(  exam: InCourseExam,
  students: Student[],
  marks: InCourseMark[]
): InCourseResultRow[] {
  const rows = students.map((student) => {
    const perSubject = exam.subjects.map((s) => {
      const subject = subjName(s as InCourseSubject | string);
      return {
        subject,
        mark: marks.find((m) => m.student_id === student.student_id && m.subject === subject),
      };
    });
    const present = perSubject
      .map((p) => p.mark)
      .filter((m): m is InCourseMark => !!m && m.status === 'present');
    const hasAbsent = perSubject.some((p) => p.mark?.status === 'absent');
    return {
      student,
      perSubject,
      paperTotal: present.length ? present.reduce((sum, m) => sum + Number(m.paper), 0) : null,
      atteAvg: present.length
        ? present.reduce((sum, m) => sum + Number(m.attendance), 0) / present.length
        : null,
      hasAbsent,
      anyMarked: perSubject.some((p) => !!p.mark),
    };
  });
  rows.sort((a, b) => byRoll(a.student, b.student));
  return rows;
}

/**
 * Merge preconditions for an NU-style average sheet: two different exams,
 * same program/session/department, identical subject-name sets.
 * Returns an error message, or null when the pair can merge.
 */
export function validateIncourseMerge(a: InCourseExam, b: InCourseExam): string | null {
  if (a.id === b.id) return 'Select two different exams.';
  if (a.program !== b.program || a.session !== b.session) {
    return 'Both exams must share the same program and session.';
  }
  if (a.department_slug !== b.department_slug) {
    return 'Both exams must belong to the same department.';
  }
  const an = a.subjects.map((s) => s.name.toLowerCase());
  const bn = b.subjects.map((s) => s.name.toLowerCase());
  if (an.length !== bn.length || !an.every((n) => bn.includes(n))) {
    return 'Both exams must have the same subjects.';
  }
  return null;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * NU average sheet: per student per subject, mean of the two exams' present
 * marks. Absent/missing side counts as 0; absent on both sides stays Absent;
 * no marks on either side stays blank. Exported for checks.
 */
export function computeIncourseAverage(
  subjects: { name: string; code: string }[],
  marksA: InCourseMark[],
  marksB: InCourseMark[],
  students: Student[]
): InCourseMark[] {
  const out: InCourseMark[] = [];
  for (const s of students) {
    for (const subj of subjects) {
      const mA = marksA.find((m) => m.student_id === s.student_id && m.subject === subj.name);
      const mB = marksB.find((m) => m.student_id === s.student_id && m.subject === subj.name);
      if (!mA && !mB) continue;
      const pA = !!mA && mA.status === 'present';
      const pB = !!mB && mB.status === 'present';
      if (!pA && !pB) {
        out.push({
          id: `avg-${s.student_id}-${subj.name}`, exam_id: '', student_id: s.student_id,
          subject: subj.name, paper: 0, attendance: 0, status: 'absent',
          entered_by: null, created_at: '', updated_at: '',
        });
        continue;
      }
      out.push({
        id: `avg-${s.student_id}-${subj.name}`, exam_id: '', student_id: s.student_id,
        subject: subj.name,
        paper: round2(((pA ? Number(mA!.paper) : 0) + (pB ? Number(mB!.paper) : 0)) / 2),
        attendance: round2(((pA ? Number(mA!.attendance) : 0) + (pB ? Number(mB!.attendance) : 0)) / 2),
        status: 'present', entered_by: null, created_at: '', updated_at: '',
      });
    }
  }
  return out;
}

const ALL_DEPT_SLUGS = Object.keys(DEPARTMENTS);

/** Honours runs 4 years, Degree runs 3. Stored on the exam as e.g. '1st Year'. */
const INCOURSE_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const yearsForProgram = (p: string): string[] =>
  p === 'Degree' ? INCOURSE_YEARS.slice(0, 3) : INCOURSE_YEARS;

interface IncourseManagerProps {
  auth: InCourseAuth;
  /** Department slugs the caller may manage (principal: all five). */
  departments: string[];
  isPrincipal: boolean;
}

type SubView = 'list' | 'entry' | 'result';

interface SubjectInput {
  paper: string;
  attendance: string;
  absent: boolean;
}

const emptyInput = (): SubjectInput => ({ paper: '', attendance: '', absent: false });

export default function IncourseManager({ auth, departments, isPrincipal }: IncourseManagerProps) {
  const [exams, setExams] = useState<InCourseExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subView, setSubView] = useState<SubView>('list');

  // Create / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InCourseExam | null>(null);
  const [fName, setFName] = useState('');
  const [fProgram, setFProgram] = useState<'Honours' | 'Degree'>('Honours');
  const [fDepartment, setFDepartment] = useState('');
  const [fYear, setFYear] = useState('1st Year');
  const [fSession, setFSession] = useState('');
  const [fSubjects, setFSubjects] = useState<InCourseSubject[]>([{ name: '', code: '' }]);
  const [fPaperOutOf, setFPaperOutOf] = useState('80');
  const [fAtteOutOf, setFAtteOutOf] = useState('20');
  const [fActive, setFActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formCatalog, setFormCatalog] = useState<InCourseCatalogSubject[]>([]);

  // Subject catalog manager (saved subjects per program + year + department)
  const [catProgram, setCatProgram] = useState<'Honours' | 'Degree'>('Honours');
  const [catYear, setCatYear] = useState('1st Year');
  const [catDept, setCatDept] = useState('');
  const [catalog, setCatalog] = useState<InCourseCatalogSubject[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState('');
  const [catMsg, setCatMsg] = useState('');
  const [catBusy, setCatBusy] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');

  // Entry
  const [entryExam, setEntryExam] = useState<InCourseExam | null>(null);
  const [entryStudents, setEntryStudents] = useState<Student[]>([]);
  const [entryMarks, setEntryMarks] = useState<InCourseMark[]>([]);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [inputs, setInputs] = useState<Record<string, SubjectInput>>({});
  const [entryMsg, setEntryMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Result
  const [resultExam, setResultExam] = useState<InCourseExam | null>(null);
  const [resultData, setResultData] = useState<{ students: Student[]; marks: InCourseMark[] } | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState('');
  // NU average merge: two selected exam ids + the merged pair in result view.
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeError, setMergeError] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergePair, setMergePair] = useState<[InCourseExam, InCourseExam] | null>(null);

  /** Editable routine draft (custom flag marks free-typed subjects). */
  interface RoutineDraftRow extends InCourseRoutineRow {
    custom: boolean;
  }

  // Exam routine builder (one schedule per exam)
  const [routineExam, setRoutineExam] = useState<InCourseExam | null>(null);
  const [routineRows, setRoutineRows] = useState<RoutineDraftRow[]>([]);
  const [routineEditing, setRoutineEditing] = useState(false);
  const [routineSaving, setRoutineSaving] = useState(false);
  const [routineError, setRoutineError] = useState('');
  const [routineMsg, setRoutineMsg] = useState('');

  const loadExams = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchIncourseExams();
      setExams(data.filter((e) => isPrincipal || departments.includes(e.department_slug)));
    } catch {
      setError('Failed to load in-course exams.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const manageableDepts = isPrincipal ? ALL_DEPT_SLUGS : departments;
  const deptProgramOf = (slug: string): 'Honours' | 'Degree' | '' => {
    const g = DEPARTMENTS[slug]?.group;
    if (g === 'Honours') return 'Honours';
    if (g) return 'Degree';
    return '';
  };
  const deptOptions = manageableDepts.filter((slug) => deptProgramOf(slug) === fProgram);
  const programsOf = (slugs: string[]): ('Honours' | 'Degree')[] => {
    const set = new Set<string>();
    for (const slug of slugs) {
      const info = DEPARTMENTS[slug];
      if (info) set.add(info.group === 'Honours' ? 'Honours' : 'Degree');
    }
    if (set.size === 0) return ['Honours'];
    return Array.from(set) as ('Honours' | 'Degree')[];
  };

  // Catalog suggestions inside the exam form (same program + year + department).
  useEffect(() => {
    if (!showForm || !fDepartment) {
      setFormCatalog([]);
      return;
    }
    let cancelled = false;
    fetchIncourseCatalog({ program: fProgram, year: fYear, department: fDepartment })
      .then((rows) => { if (!cancelled) setFormCatalog(rows); })
      .catch(() => { if (!cancelled) setFormCatalog([]); });
    return () => { cancelled = true; };
  }, [showForm, fProgram, fYear, fDepartment]);

  const catDeptOptions = manageableDepts.filter((slug) => deptProgramOf(slug) === catProgram);

  // Subject catalog manager list (reloads when its selectors change).
  useEffect(() => {
    const validProgs = programsOf(manageableDepts);
    if (!validProgs.includes(catProgram)) {
      setCatProgram(validProgs[0]);
      return;
    }
    if (!catDeptOptions.includes(catDept)) {
      setCatDept(catDeptOptions[0] || '');
      return;
    }
    if (!catDept) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    setCatLoading(true);
    setCatError('');
    fetchIncourseCatalog({ program: catProgram, year: catYear, department: catDept })
      .then((rows) => { if (!cancelled) { setCatalog(rows); setCatLoading(false); } })
      .catch(() => { if (!cancelled) { setCatError('Failed to load subject catalog.'); setCatLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catProgram, catYear, catDept]);

  const handleAddCatalogSubject = async () => {
    const name = newCatName.trim();
    if (!name) {
      setCatError('Subject name is required.');
      return;
    }
    if (!catDept) {
      setCatError('Select a department.');
      return;
    }
    setCatBusy('new');
    setCatError('');
    try {
      const rows = await saveIncourseCatalogSubjects(auth, {
        program: catProgram,
        year: catYear,
        departmentSlug: catDept,
        subjects: [{ name, code: newCatCode.trim() }],
      });
      setCatalog(rows);
      setNewCatName('');
      setNewCatCode('');
      setCatMsg(`Saved "${name}" to the catalog.`);
      setTimeout(() => setCatMsg(''), 2500);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to save subject');
    } finally {
      setCatBusy(null);
    }
  };

  const handleSaveCatalogSubject = async (id: string, name: string, code: string) => {
    if (!name.trim()) {
      setCatError('Subject name is required.');
      return;
    }
    setCatBusy(id);
    setCatError('');
    try {
      const updated = await updateIncourseCatalogSubject(auth, id, { name: name.trim(), code: code.trim() });
      setCatalog((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setCatMsg('Subject updated.');
      setTimeout(() => setCatMsg(''), 2500);
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to update subject');
    } finally {
      setCatBusy(null);
    }
  };

  const handleDeleteCatalogSubject = async (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from the catalog? Existing exams keep their own copies.`)) return;
    setCatBusy(id);
    setCatError('');
    try {
      await deleteIncourseCatalogSubject(auth, id);
      setCatalog((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setCatError(err instanceof Error ? err.message : 'Failed to delete subject');
    } finally {
      setCatBusy(null);
    }
  };

  // ---- create / edit ----
  const openCreate = () => {
    setEditing(null);
    setFName('');
    const progs = programsOf(manageableDepts);
    const prog = progs[0];
    setFProgram(prog);
    const firstDept = manageableDepts.find((slug) => deptProgramOf(slug) === prog) || '';
    setFDepartment(firstDept);
    setFSession('');
    setFYear('1st Year');
    setFSubjects([{ name: '', code: '' }]);
    setFPaperOutOf('80');
    setFAtteOutOf('20');
    setFActive(true);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (exam: InCourseExam) => {
    setEditing(exam);
    setFName(exam.name);
    setFProgram(exam.program);
    setFDepartment(exam.department_slug);
    setFSession(exam.session);
    const validYears = yearsForProgram(exam.program);
    setFYear(validYears.includes(exam.year) ? exam.year : '1st Year');
    setFSubjects(exam.subjects.map((s) => ({ name: subjName(s), code: subjCode(s) })));
    setFPaperOutOf(String(exam.paper_out_of));
    setFAtteOutOf(String(exam.attendance_out_of));
    setFActive(exam.is_active);
    setFormError('');
    setShowForm(true);
  };

  const handleSaveExam = async () => {
    const subjects = fSubjects
      .map((s) => ({ name: s.name.trim(), code: s.code.trim() }))
      .filter((s) => s.name !== '');
    if (!fName.trim()) {
      setFormError('Exam name is required.');
      return;
    }
    if (!fSession.trim()) {
      setFormError('Session is required (e.g. 2025-2026).');
      return;
    }
    if (!fDepartment) {
      setFormError('Select a department.');
      return;
    }
    if (deptProgramOf(fDepartment) !== fProgram) {
      setFormError('Selected department does not belong to the chosen program.');
      return;
    }
    if (!yearsForProgram(fProgram).includes(fYear)) {
      setFormError('Select a valid year for the chosen program.');
      return;
    }
    if (subjects.length === 0) {
      setFormError('Add at least one subject.');
      return;
    }
    const paperOutOf = Number(fPaperOutOf);
    const atteOutOf = Number(fAtteOutOf);
    if (!(paperOutOf > 0) || !(atteOutOf >= 0)) {
      setFormError('Enter valid paper / attendance full marks.');
      return;
    }
    setFormSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateIncourseExam(auth, editing.id, {
          name: fName.trim(),
          year: fYear,
          subjects,
          paperOutOf,
          attendanceOutOf: atteOutOf,
          isActive: fActive,
        });
      } else {
        await createIncourseExam(auth, {
          name: fName.trim(),
          program: fProgram,
          session: fSession.trim(),
          departmentSlug: fDepartment,
          year: fYear,
          subjects,
          paperOutOf,
          attendanceOutOf: atteOutOf,
          isActive: fActive,
        });
      }
      setShowForm(false);
      try {
        await saveIncourseCatalogSubjects(auth, {
          program: fProgram,
          year: fYear,
          departmentSlug: fDepartment,
          subjects,
        });
      } catch {
        // Catalog sync is best-effort; the exam itself saved fine.
      }
      await loadExams();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save exam');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteExam = async (exam: InCourseExam) => {
    if (!window.confirm(`Delete "${exam.name}" and all its marks? This cannot be undone.`)) return;
    try {
      await deleteIncourseExam(auth, exam.id);
      await loadExams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete exam');
    }
  };

  const handleToggleActive = async (exam: InCourseExam) => {
    try {
      await updateIncourseExam(auth, exam.id, { isActive: !exam.is_active });
      await loadExams();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update exam');
    }
  };

  // ---- entry ----
  const prefillFor = (index: number, students: Student[], marks: InCourseMark[]) => {
    const s = students[index];
    const next: Record<string, SubjectInput> = {};
    for (const subj of (entryExam?.subjects || []).map((x) => x.name)) {
      const m = s ? marks.find((x) => x.student_id === s.student_id && x.subject === subj) : undefined;
      next[subj] = m
        ? { paper: String(m.paper), attendance: String(m.attendance), absent: m.status === 'absent' }
        : emptyInput();
    }
    setInputs(next);
  };

  const openEntry = async (exam: InCourseExam) => {
    setEntryExam(exam);
    setEntryError('');
    setEntryMsg('');
    setEntryLoading(true);
    setEntryStudents([]);
    setEntryMarks([]);
    setSubView('entry');
    try {
      const [students, marks] = await Promise.all([
        fetchIncourseStudents(exam.id),
        fetchIncourseMarks(exam.id),
      ]);
      const sorted = [...students].sort(byRoll);
      const entered = (sid: string): boolean =>
        exam.subjects.every((x) => marks.some((m) => m.student_id === sid && m.subject === x.name));
      const firstUnmarked = sorted.findIndex((s) => !entered(s.student_id));
      const idx = firstUnmarked === -1 ? 0 : firstUnmarked;
      setEntryStudents(sorted);
      setEntryMarks(marks);
      setCurrentIndex(idx);
      // prefill after exam state is set
      const s = sorted[idx];
      const next: Record<string, SubjectInput> = {};
      for (const x of exam.subjects) {
        const subj = x.name;
        const m = s ? marks.find((m) => m.student_id === s.student_id && m.subject === subj) : undefined;
        next[subj] = m
          ? { paper: String(m.paper), attendance: String(m.attendance), absent: m.status === 'absent' }
          : emptyInput();
      }
      setInputs(next);
    } catch {
      setEntryError('Failed to load entry data.');
    } finally {
      setEntryLoading(false);
    }
  };

  const saveCurrentStudent = async (): Promise<boolean> => {
    if (!entryExam) return false;
    const current = entryStudents[currentIndex];
    if (!current) return false;
    for (const x of entryExam.subjects) {
      const subj = x.name;
      const inp = inputs[subj] || emptyInput();
      if (!inp.absent) {
        const p = Number(inp.paper);
        const a = Number(inp.attendance);
        if (
          inp.paper.trim() === '' || inp.attendance.trim() === '' ||
          isNaN(p) || isNaN(a) || p < 0 || a < 0 ||
          p > Number(entryExam.paper_out_of) || a > Number(entryExam.attendance_out_of)
        ) {
          setEntryError(
            `"${subj}": enter Paper (0–${entryExam.paper_out_of}) and Attendance (0–${entryExam.attendance_out_of}), or tick Absent.`
          );
          return false;
        }
      }
    }
    setSaving(true);
    setEntryError('');
    try {
      for (const x of entryExam.subjects) {
        const subj = x.name;
        const inp = inputs[subj] || emptyInput();
        const mark = await saveIncourseMark(
          auth, entryExam.id, current.student_id, subj,
          inp.absent ? 0 : Number(inp.paper),
          inp.absent ? 0 : Number(inp.attendance),
          inp.absent ? 'absent' : 'present'
        );
        setEntryMarks((prev) => {
          const rest = prev.filter(
            (m) => !(m.student_id === current.student_id && m.subject === subj)
          );
          return [...rest, mark];
        });
      }
      setEntryMsg(`Saved for ${current.full_name || rollOf(current)}`);
      setTimeout(() => setEntryMsg(''), 2500);
      return true;
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : 'Failed to save marks');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const saved = await saveCurrentStudent();
    if (!saved) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= entryStudents.length) {
      setSubView('list');
      await loadExams();
    } else {
      setCurrentIndex(nextIndex);
      prefillFor(nextIndex, entryStudents, entryMarks);
    }
  };

  // ---- result ----
  const openResult = async (exam: InCourseExam) => {
    setResultExam(exam);
    setResultData(null);
    setResultError('');
    setResultLoading(true);
    setMergePair(null);
    setSubView('result');
    try {
      const [students, marks] = await Promise.all([
        fetchIncourseStudents(exam.id),
        fetchIncourseMarks(exam.id),
      ]);
      setResultData({ students: [...students].sort(byRoll), marks });
    } catch {
      setResultError('Failed to load result.');
    } finally {
      setResultLoading(false);
    }
  };

  const handleViewAverage = async () => {
    const a = exams.find((e) => e.id === mergeIds[0]);
    const b = exams.find((e) => e.id === mergeIds[1]);
    if (!a || !b) {
      setMergeError('Select two exams to merge.');
      return;
    }
    const problem = validateIncourseMerge(a, b);
    if (problem) {
      setMergeError(problem);
      return;
    }
    setMergeError('');
    setMerging(true);
    try {
      const [ra, rb] = await Promise.all([fetchIncourseResult(a.id), fetchIncourseResult(b.id)]);
      const display = a.subjects.map((s) => ({ name: s.name, code: s.code }));
      const byId = new Map<string, Student>();
      for (const s of [...ra.students, ...rb.students]) {
        if (!byId.has(s.student_id)) byId.set(s.student_id, s);
      }
      const students = [...byId.values()].sort(byRoll);
      const marks = computeIncourseAverage(display, ra.marks, rb.marks, students);
      setResultExam({ ...a, name: `${a.name} + ${b.name} (Average)` });
      setResultData({ students, marks });
      setMergePair([a, b]);
      setSubView('result');
    } catch {
      setMergeError('Failed to load exams for averaging.');
    } finally {
      setMerging(false);
    }
  };

  const openRoutine = (exam: InCourseExam) => {
    setRoutineExam(exam);
    setRoutineRows(
      exam.routine.length > 0
        ? exam.routine.map((r) => ({ ...r, custom: false }))
        : exam.subjects.map((s) => ({
            day: '',
            date: '',
            time: '',
            subject: s.name,
            code: s.code || '',
            custom: false,
          }))
    );
    setRoutineEditing(exam.routine.length === 0);
    setRoutineError('');
    setRoutineMsg('');
  };

  const routineMetaOf = (exam: InCourseExam): string =>
    `${exam.program} · ${exam.session}${exam.year ? ` · ${exam.year}` : ''} · ${DEPARTMENTS[exam.department_slug]?.title || exam.department_slug}`;

  const handleSaveRoutine = async () => {
    if (!routineExam) return;
    const rows = routineRows
      .map((r) => ({
        day: r.day.trim(),
        date: r.date.trim(),
        time: r.time.trim(),
        subject: r.subject.trim(),
        code: r.code.trim(),
      }))
      .filter((r) => r.day || r.date || r.time || r.subject);
    if (rows.length === 0) {
      setRoutineError('Add at least one routine row (day, date, time or subject).');
      return;
    }
    setRoutineSaving(true);
    setRoutineError('');
    try {
      const updated = await saveIncourseRoutine(auth, routineExam.id, rows);
      setExams((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setRoutineExam(updated);
      setRoutineRows(updated.routine.map((r) => ({ ...r, custom: false })));
      setRoutineEditing(false);
      setRoutineMsg('Routine saved.');
      setTimeout(() => setRoutineMsg(''), 2500);
    } catch (err) {
      setRoutineError(err instanceof Error ? err.message : 'Failed to save routine');
    } finally {
      setRoutineSaving(false);
    }
  };

  const handlePrintRoutine = () => {
    if (!routineExam) return;
    const source = routineEditing ? routineRows : routineExam.routine;
    const rows = source
      .map((r) => ({
        day: r.day.trim(),
        date: r.date.trim(),
        time: r.time.trim(),
        subject: r.subject.trim(),
        code: r.code.trim(),
      }))
      .filter((r) => r.day || r.date || r.time || r.subject);
    if (rows.length === 0) return;
    printIncourseRoutine(routineExam.name, routineMetaOf(routineExam), rows);
  };

  const handlePrintResult = () => {
    if (!resultExam || !resultData) return;
    import('@/lib/resultExport').then(({ printIncourseSheet }) => {
      printIncourseSheet(
        { name: resultExam.year ? `${resultExam.name} — ${resultExam.year}` : resultExam.name, program: resultExam.program, session: resultExam.session },
        resultExam.subjects.map((x) => x.name + (x.code ? ` (${x.code})` : '')),
        computeIncourseResult(resultExam, resultData.students, resultData.marks).map((r) => ({
          roll: rollOf(r.student),
          nameBlock: [
            r.student.full_name || 'Profile not updated',
            r.student.hsc_regi ? `Regi: ${r.student.hsc_regi}` : '',
            r.student.fathers_name ? `Father: ${r.student.fathers_name}` : '',
          ].filter(Boolean),
          cells: r.perSubject.flatMap((p) => {
            if (!p.mark) return ['—', '—', '—'];
            if (p.mark.status === 'absent') return ['—', '—', 'A'];
            return [String(p.mark.paper), String(p.mark.attendance), String(Number(p.mark.paper) + Number(p.mark.attendance))];
          }),
          total: r.paperTotal == null ? '—' : String(r.paperTotal),
          atte: r.atteAvg == null ? '—' : String(Math.round(r.atteAvg * 100) / 100),
        }))
      );
    });
  };

  if (loading) {
    return (
      <div className="card p-12 text-center animate-pulse" role="status">
        <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-3" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <p className="text-gray-500">{error}</p>
        <button onClick={loadExams} className="btn-secondary mt-4">Retry</button>
      </div>
    );
  }

  // ---- entry view ----
  if (subView === 'entry' && entryExam) {
    const enteredCount = entryStudents.filter((s) =>
      entryExam.subjects.every((x) =>
        entryMarks.some((m) => m.student_id === s.student_id && m.subject === x.name)
      )
    ).length;
    const current = entryStudents[currentIndex];
    return (
      <div className="card p-6 md:p-8 animate-fade-in">
        <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-6">
          <button onClick={() => { setSubView('list'); loadExams(); }} className="btn-secondary w-full sm:w-auto">
            <ArrowLeft size={16} className="mr-1" />
            Back to Exams
          </button>
          <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-medium sm:ml-auto max-w-full bg-teal-50 text-teal-700">
            <span className="truncate">{entryExam.name} — {entryExam.program}, {entryExam.session}{entryExam.year ? `, ${entryExam.year}` : ''}</span>
          </span>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">
              Student {entryStudents.length ? currentIndex + 1 : 0} of {entryStudents.length} | {enteredCount} completed
            </p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 rounded-full transition-all duration-300"
                style={{ width: `${entryStudents.length ? (enteredCount / entryStudents.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {entryLoading ? (
            <div className="text-center py-8" role="status">
              <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Loading students...</p>
            </div>
          ) : !current ? (
            <p className="text-gray-400 text-sm text-center py-6">
              No {entryExam.program} students in session {entryExam.session} yet.
            </p>
          ) : (
            <>
              <div className="text-center mb-6 px-1">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Users size={36} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">{current.full_name || 'Profile not updated'}</h3>
                <p className="text-sm text-gray-500 mt-1">Roll: {rollOf(current)}</p>
              </div>

              {entryError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                  <AlertCircle size={16} /> {entryError}
                </div>
              )}
              {entryMsg && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2">
                  <Check size={16} /> {entryMsg}
                </div>
              )}

              <div className="space-y-3 mb-6">
                {entryExam.subjects.map((x) => {
                  const subj = x.name;
                  const code = (x.code || '').trim();
                  const inp = inputs[subj] || emptyInput();
                  return (
                    <div key={subj} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2 min-w-0">
                          <BookOpen size={15} className="text-teal-600 flex-shrink-0" />
                          <span className="truncate">{subj}</span>
                          {code && (
                            <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-teal-50 text-teal-700 flex-shrink-0">
                              {code}
                            </span>
                          )}
                        </h4>
                        <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer min-h-[32px]">
                          <input
                            type="checkbox"
                            checked={inp.absent}
                            onChange={(e) =>
                              setInputs((prev) => ({ ...prev, [subj]: { ...inp, absent: e.target.checked } }))
                            }
                            className="w-4 h-4 rounded accent-amber-600"
                            disabled={saving}
                          />
                          Absent
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="form-group">
                          <label className="label text-xs">Paper (0–{entryExam.paper_out_of})</label>
                          <input
                            type="number"
                            min="0"
                            max={Number(entryExam.paper_out_of)}
                            step="0.01"
                            value={inp.paper}
                            onChange={(e) =>
                              setInputs((prev) => ({ ...prev, [subj]: { ...inp, paper: e.target.value } }))
                            }
                            placeholder="e.g. 60"
                            className="input text-center"
                            disabled={saving || inp.absent}
                          />
                        </div>
                        <div className="form-group">
                          <label className="label text-xs">Attendance (0–{entryExam.attendance_out_of})</label>
                          <input
                            type="number"
                            min="0"
                            max={Number(entryExam.attendance_out_of)}
                            step="0.01"
                            value={inp.attendance}
                            onChange={(e) =>
                              setInputs((prev) => ({ ...prev, [subj]: { ...inp, attendance: e.target.value } }))
                            }
                            placeholder="e.g. 15"
                            className="input text-center"
                            disabled={saving || inp.absent}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={handleNext} disabled={saving} className="btn-primary btn-lg w-full">
                {saving ? (
                  'Saving...'
                ) : currentIndex === entryStudents.length - 1 ? (
                  <>
                    <Check size={18} />
                    Finish &amp; View Exams
                  </>
                ) : (
                  <>
                    Next Student
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- result view ----
  if (subView === 'result' && resultExam) {
    const rows = resultData ? computeIncourseResult(resultExam, resultData.students, resultData.marks) : [];
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-6">
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-5">
            <button onClick={() => { setSubView('list'); setMergePair(null); }} className="btn-secondary w-full sm:w-auto">
              <ArrowLeft size={16} className="mr-1" />
              Back to Exams
            </button>
            <button
              onClick={handlePrintResult}
              disabled={resultLoading || rows.length === 0}
              className="btn-secondary w-full sm:w-auto sm:ml-auto"
            >
              <Printer size={16} className="mr-1" />
              Print
            </button>
          </div>
          {resultLoading ? (
            <div className="text-center py-8" role="status">
              <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-500">Loading result...</p>
            </div>
          ) : resultError ? (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
              <AlertCircle size={16} /> {resultError}
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{resultExam.name}</h2>
              <p className="text-sm text-gray-500 mb-1">
                {resultExam.program} · {resultExam.session} · {DEPARTMENTS[resultExam.department_slug]?.title || resultExam.department_slug}{resultExam.year ? ` · ${resultExam.year}` : ''}
              </p>
              {mergePair && (
                <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-4">
                  Average of “{mergePair[0].name}” + “{mergePair[1].name}” for NU submission · absent or missing counts as 0
                </p>
              )}
              {rows.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No students in this program and session yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 overscroll-x-contain" tabIndex={0} role="region" aria-label="In-course result table, scroll horizontally">
                  <table className="w-full min-w-[560px] text-sm text-center border-collapse [&_th]:align-middle [&_td]:align-middle">
                    <thead>
                      <tr className="bg-gray-50">
                        <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">Roll</th>
                        <th rowSpan={2} className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">Name</th>
                        {resultExam.subjects.map((x) => (
                          <th key={x.name} colSpan={3} title={x.code ? `${x.name} (${x.code})` : x.name} className="px-3 py-2 text-xs font-semibold text-teal-700 border-b border-l border-gray-200 whitespace-nowrap max-w-[140px] truncate">
                            {x.name}
                            {x.code ? <span className="font-normal text-teal-500"> · {x.code}</span> : null}
                          </th>
                        ))}
                        <th rowSpan={2} title="Sum of paper marks across subjects" className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-l border-gray-200 whitespace-nowrap cursor-help">Total</th>
                        <th rowSpan={2} title="Average attendance across entered subjects" className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-l border-gray-200 whitespace-nowrap cursor-help">Atte Avg</th>
                      </tr>
                      <tr className="bg-gray-50">
                        {resultExam.subjects.flatMap((x) => ([
                          <th key={`${x.name}-p`} className="px-2 py-1.5 text-[11px] font-medium text-gray-500 border-b border-l border-gray-200">Paper</th>,
                          <th key={`${x.name}-a`} className="px-2 py-1.5 text-[11px] font-medium text-gray-500 border-b border-gray-200">Atte</th>,
                          <th key={`${x.name}-t`} className="px-2 py-1.5 text-[11px] font-medium text-gray-500 border-b border-r border-gray-200">Total</th>,
                        ]))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.student.id} className="hover:bg-teal-50/40 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap border-b border-gray-100">{rollOf(r.student)}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap border-b border-gray-100 max-w-[140px] truncate" title={r.student.full_name || ''}>
                            {r.student.full_name || 'Profile not updated'}
                          </td>
                          {r.perSubject.flatMap((p) => {
                            const m = p.mark;
                            if (!m) {
                              return [
                                <td key={`${p.subject}-p`} className="px-2 py-2.5 border-b border-l border-gray-100"><span className="text-gray-300">—</span></td>,
                                <td key={`${p.subject}-a`} className="px-2 py-2.5 border-b border-gray-100"><span className="text-gray-300">—</span></td>,
                                <td key={`${p.subject}-t`} className="px-2 py-2.5 border-b border-r border-gray-100"><span className="text-gray-300">—</span></td>,
                              ];
                            }
                            if (m.status === 'absent') {
                              return [
                                <td key={`${p.subject}-p`} className="px-2 py-2.5 border-b border-l border-gray-100"><span className="text-gray-300">—</span></td>,
                                <td key={`${p.subject}-a`} className="px-2 py-2.5 border-b border-gray-100"><span className="text-gray-300">—</span></td>,
                                <td key={`${p.subject}-t`} className="px-2 py-2.5 border-b border-r border-gray-100 text-red-700 font-bold">A</td>,
                              ];
                            }
                            return [
                              <td key={`${p.subject}-p`} className="px-2 py-2.5 text-gray-700 border-b border-l border-gray-100">{m.paper}</td>,
                              <td key={`${p.subject}-a`} className="px-2 py-2.5 text-gray-700 border-b border-gray-100">{m.attendance}</td>,
                              <td key={`${p.subject}-t`} className="px-2 py-2.5 font-medium text-black border-b border-r border-gray-100">{Number(m.paper) + Number(m.attendance)}</td>,
                            ];
                          })}
                          <td className="px-3 py-2.5 font-bold text-gray-900 border-b border-l border-gray-100">
                            {r.paperTotal == null ? <span className="text-gray-300">—</span> : r.paperTotal}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-700 border-b border-l border-gray-100">
                            {r.atteAvg == null ? <span className="text-gray-300">—</span> : Math.round(r.atteAvg * 100) / 100}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- list view ----
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FlaskConical size={20} className="text-teal-600" />
              In-Course Exams
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Honours &amp; Degree in-course exams — paper and attendance marks per subject.
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary w-full sm:w-auto sm:ml-auto">
            <Plus size={18} />
            New Exam
          </button>
        </div>

        {mergeIds.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 sm:p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-sm text-indigo-800 font-medium flex-1">
              {mergeIds.length}/2 exams selected for NU average sheet
            </p>
            {mergeError && (
              <p className="text-sm text-red-600" role="alert">{mergeError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setMergeIds([]); setMergeError(''); }}
                className="btn-secondary btn-sm"
              >
                Clear
              </button>
              <button
                onClick={handleViewAverage}
                disabled={mergeIds.length !== 2 || merging}
                className="btn-primary btn-sm"
              >
                {merging ? 'Merging...' : 'View Average Result'}
              </button>
            </div>
          </div>
        )}

        {exams.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No in-course exams yet</h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Create an exam, choose how many subjects it has, then input paper and attendance marks.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam) => (
              <article key={exam.id} className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-gray-900 text-base break-words">{exam.name}</h4>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700">
                        {exam.program}
                      </span>
                      {exam.year && (
                        <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                          {exam.year}
                        </span>
                      )}
                      <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        {exam.session}
                      </span>
                      <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700">
                        {DEPARTMENTS[exam.department_slug]?.navLabel || exam.department_slug}
                      </span>
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <BookOpen size={12} />
                        {exam.subjects.length} subject{exam.subjects.length !== 1 ? 's' : ''} · Paper {exam.paper_out_of} + Atte {exam.attendance_out_of}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    exam.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${exam.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {exam.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {exam.subjects.map((s) => (
                    <span
                      key={s.name}
                      title={s.code ? `${s.name} (${s.code})` : s.name}
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
                    >
                      {s.name}
                      {s.code ? <span className="text-gray-400"> · {s.code}</span> : null}
                    </span>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer min-h-[32px] mb-2">
                    <input
                      type="checkbox"
                      checked={mergeIds.includes(exam.id)}
                      onChange={(e) => {
                        setMergeError('');
                        if (e.target.checked) {
                          if (mergeIds.length >= 2) {
                            setMergeError('Select at most two exams to average.');
                            return;
                          }
                          setMergeIds((prev) => [...prev, exam.id]);
                        } else {
                          setMergeIds((prev) => prev.filter((id) => id !== exam.id));
                        }
                      }}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    Select for average
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => openEntry(exam)}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                  >
                    <Pencil size={15} />
                    Input Marks
                  </button>
                  <button
                    onClick={() => openResult(exam)}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <Eye size={15} />
                    View Result
                  </button>
                  <button
                    onClick={() => openRoutine(exam)}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    <Calendar size={15} />
                    Routine{(exam.routine || []).length > 0 ? ` (${exam.routine.length})` : ''}
                  </button>
                  <button
                    onClick={() => openEdit(exam)}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Pencil size={15} />
                    Edit Exam
                  </button>
                  <button
                    onClick={() => handleToggleActive(exam)}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    {exam.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDeleteExam(exam)}
                    className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                  </div>
                </div>
                </article>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen size={20} className="text-teal-600" />
            Subject Catalog by Year
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Saved subjects appear as suggestions when creating an exam for the same program, year and department.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="form-group">
            <label className="label" htmlFor="incCatProgram">Program</label>
            <select
              id="incCatProgram"
              value={catProgram}
              onChange={(e) => {
                const prog = e.target.value as 'Honours' | 'Degree';
                setCatProgram(prog);
                setCatYear((prev) => (yearsForProgram(prog).includes(prev) ? prev : '1st Year'));
              }}
              className="input"
            >
              {programsOf(manageableDepts).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="incCatYear">Year</label>
            <select
              id="incCatYear"
              value={catYear}
              onChange={(e) => setCatYear(e.target.value)}
              className="input"
            >
              {yearsForProgram(catProgram).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label" htmlFor="incCatDept">Department</label>
            <select
              id="incCatDept"
              value={catDept}
              onChange={(e) => setCatDept(e.target.value)}
              className="input"
            >
              <option value="" disabled>Select department</option>
              {catDeptOptions.map((slug) => (
                <option key={slug} value={slug}>
                  {DEPARTMENTS[slug]?.title || slug}
                </option>
              ))}
            </select>
          </div>
        </div>
        {catError && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
            <AlertCircle size={16} /> {catError}
          </div>
        )}
        {catMsg && (
          <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2">
            <Check size={16} /> {catMsg}
          </div>
        )}
        {catLoading ? (
          <p className="text-sm text-gray-500 text-center py-4">Loading catalog...</p>
        ) : !catDept ? (
          <p className="text-gray-400 text-sm text-center py-4">Select a department to manage its subjects.</p>
        ) : (
          <div className="space-y-2">
            {catalog.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) =>
                    setCatalog((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
                  }
                  className="input"
                  aria-label="Catalog subject name"
                  disabled={catBusy !== null}
                />
                <input
                  type="text"
                  value={s.code}
                  onChange={(e) =>
                    setCatalog((prev) => prev.map((x) => (x.id === s.id ? { ...x, code: e.target.value } : x)))
                  }
                  placeholder="Code"
                  className="input w-24 flex-shrink-0 text-center"
                  aria-label="Catalog subject code"
                  disabled={catBusy !== null}
                />
                <button
                  type="button"
                  onClick={() => handleSaveCatalogSubject(s.id, s.name, s.code)}
                  disabled={catBusy !== null}
                  className="px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {catBusy === s.id ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCatalogSubject(s.id, s.name)}
                  disabled={catBusy !== null}
                  className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
                  aria-label={`Delete ${s.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {catalog.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-2">No saved subjects for this year yet.</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New subject name"
                className="input"
                aria-label="New catalog subject name"
                disabled={catBusy !== null}
              />
              <input
                type="text"
                value={newCatCode}
                onChange={(e) => setNewCatCode(e.target.value)}
                placeholder="Code"
                className="input w-24 flex-shrink-0 text-center"
                aria-label="New catalog subject code"
                disabled={catBusy !== null}
              />
              <button
                type="button"
                onClick={handleAddCatalogSubject}
                disabled={catBusy !== null}
                className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-green-700 text-white hover:bg-green-800 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Plus size={15} />
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exam routine modal (portaled to body so sticky page chrome can never cover it) */}
      {routineExam &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setRoutineExam(null)}
          >
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 rounded-t-2xl">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Calendar size={20} className="text-purple-600 flex-shrink-0" />
                    <span className="truncate">Exam Routine</span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {routineExam.name} · {routineMetaOf(routineExam)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={handlePrintRoutine}
                    title="Print routine"
                    aria-label="Print routine"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] min-w-[44px] rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <Printer size={16} />
                    <span className="hidden md:inline">Print</span>
                  </button>
                  <button
                    onClick={() => setRoutineExam(null)}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {routineError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {routineError}
                  </div>
                )}
                {routineMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2">
                    <Check size={16} /> {routineMsg}
                  </div>
                )}
                {routineEditing ? (
                  <>
                    <div className="space-y-3 mb-4">
                      {routineRows.map((r, i) => (
                        <div key={i} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-xs font-bold text-gray-500">SL {i + 1}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setRoutineRows((prev) => {
                                    if (i === 0) return prev;
                                    const next = [...prev];
                                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                    return next;
                                  })
                                }
                                disabled={i === 0}
                                className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-30"
                                aria-label={`Move row ${i + 1} up`}
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRoutineRows((prev) => {
                                    if (i === prev.length - 1) return prev;
                                    const next = [...prev];
                                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                                    return next;
                                  })
                                }
                                disabled={i === routineRows.length - 1}
                                className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 transition-colors disabled:opacity-30"
                                aria-label={`Move row ${i + 1} down`}
                              >
                                <ChevronDown size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRoutineRows((prev) => prev.filter((_, j) => j !== i))}
                                className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                                aria-label={`Remove row ${i + 1}`}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="form-group">
                              <label className="label text-xs" htmlFor={`routine-day-${i}`}>Day</label>
                              <input
                                id={`routine-day-${i}`}
                                type="text"
                                value={r.day}
                                onChange={(e) =>
                                  setRoutineRows((prev) => prev.map((x, j) => (j === i ? { ...x, day: e.target.value } : x)))
                                }
                                placeholder="e.g. Saturday"
                                className="input"
                              />
                            </div>
                            <div className="form-group">
                              <label className="label text-xs" htmlFor={`routine-date-${i}`}>Date</label>
                              <input
                                id={`routine-date-${i}`}
                                type="date"
                                value={r.date}
                                onChange={(e) =>
                                  setRoutineRows((prev) => prev.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))
                                }
                                className="input"
                              />
                            </div>
                            <div className="form-group">
                              <label className="label text-xs" htmlFor={`routine-time-${i}`}>Time</label>
                              <input
                                id={`routine-time-${i}`}
                                type="text"
                                value={r.time}
                                onChange={(e) =>
                                  setRoutineRows((prev) => prev.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))
                                }
                                placeholder="e.g. 10:00 AM – 1:00 PM"
                                className="input"
                              />
                            </div>
                            <div className="form-group">
                              <label className="label text-xs" htmlFor={`routine-subject-${i}`}>Subject</label>
                              <select
                                id={`routine-subject-${i}`}
                                value={r.custom ? '__custom__' : r.subject}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v === '__custom__') {
                                    setRoutineRows((prev) =>
                                      prev.map((x, j) => (j === i ? { ...x, subject: '', code: '', custom: true } : x))
                                    );
                                  } else {
                                    const match = (routineExam?.subjects || []).find((s) => s.name === v);
                                    setRoutineRows((prev) =>
                                      prev.map((x, j) =>
                                        j === i ? { ...x, subject: v, code: match?.code || '', custom: false } : x
                                      )
                                    );
                                  }
                                }}
                                className="input"
                              >
                                <option value="" disabled>Select subject</option>
                                {(routineExam?.subjects || []).map((s) => (
                                  <option key={s.name} value={s.name}>
                                    {s.code ? `${s.name} (${s.code})` : s.name}
                                  </option>
                                ))}
                                <option value="__custom__">Custom subject…</option>
                              </select>
                            </div>
                          </div>
                          {r.custom && (
                            <div className="grid grid-cols-[1fr_6rem] gap-3 mt-3">
                              <input
                                type="text"
                                value={r.subject}
                                onChange={(e) =>
                                  setRoutineRows((prev) => prev.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)))
                                }
                                placeholder="Custom subject name"
                                className="input"
                                aria-label={`Custom subject name for row ${i + 1}`}
                              />
                              <input
                                type="text"
                                value={r.code}
                                onChange={(e) =>
                                  setRoutineRows((prev) => prev.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))
                                }
                                placeholder="Code"
                                className="input text-center"
                                aria-label={`Custom subject code for row ${i + 1}`}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRoutineRows((prev) => [...prev, { day: '', date: '', time: '', subject: '', code: '', custom: false }])
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors w-full justify-center mb-4"
                    >
                      <Plus size={16} />
                      Add Row
                    </button>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRoutineEditing(false);
                          setRoutineError('');
                          if (routineExam) setRoutineRows(routineExam.routine.map((x) => ({ ...x, custom: false })));
                        }}
                        className="btn-secondary w-full sm:w-auto"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRoutine}
                        disabled={routineSaving}
                        className="btn-primary w-full sm:w-auto"
                      >
                        <Check size={18} />
                        {routineSaving ? 'Saving...' : 'Save Routine'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {routineExam.routine.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-6">
                        No routine yet for this exam. Click Edit Routine to build one.
                      </p>
                    ) : (
                      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-4">
                        <table className="w-full min-w-[520px] text-sm text-center border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">SL</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Day</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Date</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">Time</th>
                              <th className="px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200 text-left">Subject</th>
                            </tr>
                          </thead>
                          <tbody>
                            {routineExam.routine.map((r, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-purple-50/40 transition-colors">
                                <td className="px-3 py-2.5 text-gray-500">{i + 1}</td>
                                <td className="px-3 py-2.5 font-medium text-gray-700 whitespace-nowrap">{r.day || <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.date ? formatShortDate(r.date) : <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{r.time || <span className="text-gray-300">—</span>}</td>
                                <td className="px-3 py-2.5 text-left font-medium text-gray-900">
                                  {r.subject || <span className="text-gray-300">—</span>}
                                  {r.code && <span className="text-gray-400 font-normal"> · {r.code}</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
                      <button type="button" onClick={() => setRoutineExam(null)} className="btn-secondary w-full sm:w-auto">
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRoutineEditing(true);
                          setRoutineError('');
                        }}
                        className="btn-primary w-full sm:w-auto"
                      >
                        <Pencil size={18} />
                        {routineExam.routine.length === 0 ? 'Create Routine' : 'Edit Routine'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Create / edit modal (portaled to body so sticky page chrome can never cover it) */}
      {showForm &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lift w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3 rounded-t-2xl">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {editing ? 'Edit In-Course Exam' : 'New In-Course Exam'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {formError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                  <AlertCircle size={16} /> {formError}
                </div>
              )}
              <div className="space-y-4">
                <div className="form-group">
                  <label className="label" htmlFor="incExamName">Exam Name</label>
                  <input
                    id="incExamName"
                    type="text"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="e.g. 1st Year In-Course Exam 2026"
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label" htmlFor="incExamProgram">Program</label>
                    <select
                      id="incExamProgram"
                      value={fProgram}
                      onChange={(e) => {
                        const prog = e.target.value as 'Honours' | 'Degree';
                        setFProgram(prog);
                        setFYear((prev) => (yearsForProgram(prog).includes(prev) ? prev : '1st Year'));
                        setFDepartment((prev) =>
                          deptProgramOf(prev) === prog
                            ? prev
                            : manageableDepts.find((slug) => deptProgramOf(slug) === prog) || ''
                        );
                      }}
                      className="input"
                    >
                      {programsOf(manageableDepts).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="incExamSession">Session</label>
                    <input
                      id="incExamSession"
                      type="text"
                      value={fSession}
                      onChange={(e) => setFSession(e.target.value)}
                      placeholder="e.g. 2025-2026"
                      className="input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="incExamYear">Year</label>
                  <select
                    id="incExamYear"
                    value={fYear}
                    onChange={(e) => setFYear(e.target.value)}
                    className="input"
                  >
                    {yearsForProgram(fProgram).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label" htmlFor="incExamDept">Department</label>
                  <select
                    id="incExamDept"
                    value={fDepartment}
                    onChange={(e) => setFDepartment(e.target.value)}
                    className="input"
                  >
                    <option value="" disabled>Select department</option>
                    {deptOptions.map((slug) => (
                      <option key={slug} value={slug}>
                        {DEPARTMENTS[slug]?.title || slug}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label !mb-0">Subjects ({fSubjects.filter((s) => s.name.trim()).length})</label>
                    <button
                      type="button"
                      onClick={() => setFSubjects((prev) => [...prev, { name: '', code: '' }])}
                      className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800 min-h-[32px]"
                    >
                      <Plus size={15} />
                      Add subject
                    </button>
                  </div>
                  <div className="space-y-2">
                    {fSubjects.map((subj, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-5 flex-shrink-0">{i + 1}.</span>
                        <input
                          type="text"
                          value={subj.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            const match = formCatalog.find(
                              (c) => c.name.toLowerCase() === v.trim().toLowerCase()
                            );
                            setFSubjects((prev) =>
                              prev.map((s, j) => (j === i ? { ...s, name: v, code: match ? match.code : s.code } : s))
                            );
                          }}
                          placeholder={`Subject ${i + 1} name`}
                          className="input"
                          aria-label={`Subject ${i + 1} name`}
                          list="incCatalogSubjects"
                        />
                        <input
                          type="text"
                          value={subj.code}
                          onChange={(e) =>
                            setFSubjects((prev) => prev.map((s, j) => (j === i ? { ...s, code: e.target.value } : s)))
                          }
                          placeholder="Code"
                          className="input w-24 flex-shrink-0 text-center"
                          aria-label={`Subject ${i + 1} code`}
                        />
                        {fSubjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setFSubjects((prev) => prev.filter((_, j) => j !== i))}
                            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 flex-shrink-0"
                            aria-label={`Remove subject ${i + 1}`}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {formCatalog.length > 0 && (
                      <datalist id="incCatalogSubjects">
                        {formCatalog.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.code ? `${c.name} (${c.code})` : c.name}
                          </option>
                        ))}
                      </datalist>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label" htmlFor="incPaperOutOf">Paper Out Of</label>
                    <input
                      id="incPaperOutOf"
                      type="number"
                      min="1"
                      value={fPaperOutOf}
                      onChange={(e) => setFPaperOutOf(e.target.value)}
                      className="input text-center"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="incAtteOutOf">Attendance Out Of</label>
                    <input
                      id="incAtteOutOf"
                      type="number"
                      min="0"
                      value={fAtteOutOf}
                      onChange={(e) => setFAtteOutOf(e.target.value)}
                      className="input text-center"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fActive}
                    onChange={(e) => setFActive(e.target.checked)}
                    className="w-4 h-4 rounded accent-teal-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active now — marks can be entered immediately
                  </span>
                </label>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary w-full sm:w-auto">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveExam}
                    disabled={formSaving}
                    className="btn-primary w-full sm:w-auto"
                  >
                    <Check size={18} />
                    {formSaving ? 'Saving...' : editing ? 'Save Changes' : 'Create Exam'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
          document.body
          )
        }
    </div>
  );
}
