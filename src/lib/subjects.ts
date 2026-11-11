export const HSC_HUMANITIES_SUBJECTS = [
  'Bangla',
  'English',
  'ICT',
  'Civics',
  'Sociology',
  'Islamic History and Culture',
  'Logic',
  'Economics',
  'Islamic Studies',
  // 'Political Science' is intentionally NOT here — Civics and Political Science
  // are the same subject at HSC level, so it would duplicate. It remains available
  // for Degree (DEGREE_SUBJECTS) and Honours (HONOURS_EXAM_SUBJECTS) only.
];

export const HSC_HUMANITIES_DEFAULT = ['Bangla', 'English', 'ICT'];

export const HSC_FOURTH_SUBJECTS = HSC_HUMANITIES_SUBJECTS.filter(
  (s) => !HSC_HUMANITIES_DEFAULT.includes(s)
);

export const HSC_SCIENCE_SUBJECTS = [
  'Bangla',
  'English',
  'ICT',
  'Physics',
  'Chemistry',
  'Biology',
];

export const HSC_SCIENCE_FOURTH_SUBJECTS = ['Higher Math'];

export const HSC_BUSINESS_SUBJECTS = [
  'Bangla',
  'English',
  'ICT',
  'Accounting',
  'Business Organization and Management',
  'Production Management and Marketing',
  'Economics',
];

export const HSC_BUSINESS_FOURTH_SUBJECTS = ['Economics'];

export const DEGREE_SUBJECTS = [
  'Islamic History and Culture',
  'Political Science',
  'Sociology',
  'Philosophy',
];

export const ALL_SUBJECTS = Array.from(
  new Set([
    ...HSC_HUMANITIES_SUBJECTS,
    ...HSC_SCIENCE_SUBJECTS,
    ...HSC_BUSINESS_SUBJECTS,
    ...DEGREE_SUBJECTS,
    ...HSC_SCIENCE_FOURTH_SUBJECTS,
    ...HSC_BUSINESS_FOURTH_SUBJECTS,
  ])
);

/**
 * Subjects an exam can include, scoped by program so an HSC exam only picks HSC
 * subjects and Degree/Honours exams pick their own — no cross-program mixing.
 * Each list is Set-deduped, so no subject (e.g. Economics, which HSC lists share
 * across groups) can appear twice in a picker.
 */
export const HSC_EXAM_SUBJECTS = Array.from(
  new Set([
    ...HSC_HUMANITIES_SUBJECTS,
    ...HSC_SCIENCE_SUBJECTS,
    ...HSC_BUSINESS_SUBJECTS,
    ...HSC_SCIENCE_FOURTH_SUBJECTS,
    ...HSC_BUSINESS_FOURTH_SUBJECTS,
  ])
);

export const DEGREE_EXAM_SUBJECTS = [...DEGREE_SUBJECTS];

// Honours students are matched to exams by their department, so those are the
// only subjects an Honours exam can meaningfully include.
export const HONOURS_EXAM_SUBJECTS = ['English', 'Political Science', 'Sociology'];

export function examSubjectsForProgram(program: string): string[] {
  if (program === 'HSC') return HSC_EXAM_SUBJECTS;
  if (program === 'Degree') return DEGREE_EXAM_SUBJECTS;
  if (program === 'Honours') return HONOURS_EXAM_SUBJECTS;
  return ALL_SUBJECTS;
}

/**
 * A student's effective 4th subject. The group's mandatory 4th subject wins
 * for Science (Higher Math) and Business Studies (Economics): those groups have
 * exactly one 4th subject, so any other saved value on the profile (e.g. legacy
 * or dirty data like a Science student saved with 'Economics') is stale and
 * must not shadow the real one — that student would otherwise vanish from the
 * Higher Math entry/result lists entirely.
 * Other groups (Humanities pick from a list; Degree/Honours) keep their saved
 * value as-is, empty or not.
 */
export function effectiveFourthSubjectFor(
  savedFourthSubject: string | null | undefined,
  hscGroup: string | null | undefined
): string {
  const saved = (savedFourthSubject || '').trim();
  if (hscGroup === 'Science') {
    const isFourth = HSC_SCIENCE_FOURTH_SUBJECTS.some(
      (x) => x.toLowerCase() === saved.toLowerCase()
    );
    return isFourth ? saved : HSC_SCIENCE_FOURTH_SUBJECTS[0];
  }
  if (hscGroup === 'Business Studies') {
    const isFourth = HSC_BUSINESS_FOURTH_SUBJECTS.some(
      (x) => x.toLowerCase() === saved.toLowerCase()
    );
    return isFourth ? saved : HSC_BUSINESS_FOURTH_SUBJECTS[0];
  }
  return saved;
}

const SCIENCE_GROUP_MARKERS = ['Physics', 'Chemistry', 'Biology', 'Higher Math'];
// 'Economics' is excluded from both marker lists because it is a main subject
// for Humanities AND Business Studies, so it identifies neither.
const BUSINESS_GROUP_MARKERS = [
  'Accounting',
  'Business Organization and Management',
  'Production Management and Marketing',
];
const HUMANITIES_GROUP_MARKERS = [
  'Civics',
  'Sociology',
  'Islamic History and Culture',
  'Logic',
  'Islamic Studies',
  'Political Science',
];

/** Canonical group order for roster sections and result tabs. */
export const RESULT_GROUP_ORDER = ['Humanities', 'Science', 'Business Studies'];

function parseSubjectListValue(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || '[]');
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * A student's result group: their saved HSC group when set, otherwise inferred
 * from their subjects via the marker lists. Shared by the principal dashboard,
 * teacher directory and roster exports so grouping is identical everywhere.
 */
export function studentResultGroup(s: {
  hsc_group?: string | null;
  hsc_subjects?: unknown;
  subjects?: unknown;
}): string {
  const g = (s.hsc_group || '').trim();
  if (RESULT_GROUP_ORDER.includes(g)) return g;
  const subjects = [
    ...parseSubjectListValue(s.hsc_subjects),
    ...parseSubjectListValue(s.subjects),
  ];
  if (subjects.some((x) => SCIENCE_GROUP_MARKERS.includes(x))) return 'Science';
  if (subjects.some((x) => BUSINESS_GROUP_MARKERS.includes(x))) return 'Business Studies';
  if (subjects.some((x) => HUMANITIES_GROUP_MARKERS.includes(x))) return 'Humanities';
  return 'Other';
}
