// Pure exam-mark rules shared by the client and the legacy direct-DB module.
// This file must NEVER import the database driver: it ships in the browser
// bundle (via apiClient), and any `@neondatabase/serverless` import here
// would print its "Running SQL directly from the browser" warning on every
// frontend page.
import type { Exam, ExamMark } from './api';

export interface SubjectPassMarks {
  /** Full marks for the CQ component. */
  outOfCq: number;
  /** Minimum marks to pass the CQ component; null/undefined = no fail check. */
  cqPass?: number | null;
  /** Full marks for the MCQ component. */
  outOfMcq: number;
  /** Minimum marks to pass the MCQ component; null/undefined = no fail check. */
  mcqPass?: number | null;
  /** Total-only mode (e.g. English without MCQ): teachers enter one Total value
   *  and result sheets show a single Total column instead of CQ/MCQ/Total. */
  totalOnly?: boolean;
}

/** Keyed by subject name. */
export type ExamPassMarks = Record<string, SubjectPassMarks>;

export interface ExamFail {
  subject: string;
  component: 'CQ' | 'MCQ';
  mark: number;
  passMark: number;
}

export function getSubjectPassMarks(
  exam: Pick<Exam, 'pass_marks'> | null | undefined,
  subject: string
): SubjectPassMarks | undefined {
  return exam?.pass_marks?.[subject];
}

/** Whether a subject uses single-Total entry/display for an exam. */
export function isTotalOnlySubject(
  exam: Pick<Exam, 'pass_marks'> | null | undefined,
  subject: string
): boolean {
  return getSubjectPassMarks(exam, subject)?.totalOnly === true;
}

/** Per-component fail checks against an exam's pass-marks config. */
export function getStudentFails(
  exam: Pick<Exam, 'pass_marks'> | null | undefined,
  subject: string,
  mark: (Pick<ExamMark, 'cq' | 'mcq'> & Partial<Pick<ExamMark, 'status'>>) | undefined
): ExamFail[] {
  const pm = getSubjectPassMarks(exam, subject);
  // Absent/expelled students cannot "fail" a component — they are marked A/E instead.
  if (!pm || !mark || mark.status === 'absent' || mark.status === 'expelled') return [];
  const fails: ExamFail[] = [];
  if (
    pm.cqPass != null &&
    pm.cqPass > 0 &&
    Number(mark.cq) < Number(pm.cqPass)
  ) {
    fails.push({ subject, component: 'CQ', mark: Number(mark.cq), passMark: Number(pm.cqPass) });
  }
  if (
    pm.mcqPass != null &&
    pm.mcqPass > 0 &&
    pm.totalOnly !== true &&
    Number(mark.mcq) < Number(pm.mcqPass)
  ) {
    fails.push({ subject, component: 'MCQ', mark: Number(mark.mcq), passMark: Number(pm.mcqPass) });
  }
  return fails;
}

/** Upper bound for a single practical-marks value (Science, one per student). */
export const MAX_PRACTICAL_MARKS = 100;
