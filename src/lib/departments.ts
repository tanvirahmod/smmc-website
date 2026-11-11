// Department pages served at /departments/:slug. Copy here is intentionally
// generic (discipline strengths, typical curriculum areas, careers) — exact
// seat counts, fees and year-by-year syllabi follow the National University
// admission circular and are confirmed at the college office.

export interface DepartmentInfo {
  slug: string;
  navLabel: string;
  group: 'Honours' | 'Degree (Pass)';
  title: string;
  tagline: string;
  duration: string;
  affiliation: string;
  about: string[];
  /** Curriculum focus areas taught in the program. */
  highlights: { title: string; desc: string }[];
  careers: string[];
  /** Teacher `subject` values shown under "Our Faculty" (live directory data). */
  teacherSubjects: string[];
}

export const DEPARTMENTS: Record<string, DepartmentInfo> = {
  'honours-english': {
    slug: 'honours-english',
    navLabel: 'English',
    group: 'Honours',
    title: 'Department of English',
    tagline: 'Literature, language and critical thinking for a changing world.',
    duration: '4-year Honours (National University)',
    affiliation: 'National University',
    about: [
      'The Department of English offers a four-year Honours program that builds strong command over the English language alongside a deep reading of literature. Students move from language fundamentals to literary criticism, linguistics and research method.',
      'Graduates leave with writing, presentation and analytical skills that employers across education, media, administration and development sectors ask for by name.',
    ],
    highlights: [
      { title: 'English Language Skills', desc: 'Reading, writing, speaking and listening — the foundation of every semester.' },
      { title: 'Literature in English', desc: 'Poetry, drama, fiction and prose from classics to contemporary voices.' },
      { title: 'Linguistics & ELT', desc: 'How language works, and how to teach it — a direct path into teaching careers.' },
      { title: 'Criticism & Research', desc: 'Literary theory, academic writing and a final-year research outlook.' },
    ],
    careers: ['School & college teaching', 'BCS (General & Education cadres)', 'NGO and development communication', 'Journalism & content writing', 'Higher studies (Masters, MPhil)'],
    teacherSubjects: ['English'],
  },
  'honours-political-science': {
    slug: 'honours-political-science',
    navLabel: 'Political Science',
    group: 'Honours',
    title: 'Department of Political Science',
    tagline: 'Understanding power, governance and the citizen’s role in democracy.',
    duration: '4-year Honours (National University)',
    affiliation: 'National University',
    about: [
      'The Department of Political Science is one of the most sought-after Honours choices for students aiming at civil service, governance and social leadership. The program covers political theory, constitutional politics, public administration and international relations.',
      'Classroom study is paired with an emphasis on current affairs, debate and reasoned argument — the exact skills BCS and job examinations reward.',
    ],
    highlights: [
      { title: 'Political Theory', desc: 'Classical and modern thought, from statecraft to democratic ideals.' },
      { title: 'Constitution & Governance', desc: 'Constitutional politics of Bangladesh and comparative government.' },
      { title: 'Public Administration', desc: 'How the state runs — bureaucracy, local government and policy.' },
      { title: 'International Relations', desc: 'Global politics, diplomacy and Bangladesh in world affairs.' },
    ],
    careers: ['BCS Administration, Police & Foreign cadres', 'College teaching', 'Local government & development work', 'Journalism & research', 'Higher studies (Masters, MPhil)'],
    teacherSubjects: ['Political Science'],
  },
  'honours-sociology': {
    slug: 'honours-sociology',
    navLabel: 'Sociology',
    group: 'Honours',
    title: 'Department of Sociology',
    tagline: 'Study society to serve it — research, fieldwork and social insight.',
    duration: '4-year Honours (National University)',
    affiliation: 'National University',
    about: [
      'The Department of Sociology trains students to observe, research and explain social life — family, gender, rural society, urbanization and change in Bangladesh. Fieldwork and survey methods are a signature part of the training.',
      'Sociology graduates are in steady demand across NGOs, research organizations, government social programs and education.',
    ],
    highlights: [
      { title: 'Sociological Theory', desc: 'Classical and contemporary frameworks for reading society.' },
      { title: 'Research Methods', desc: 'Survey design, interviews, data handling and report writing.' },
      { title: 'Rural & Urban Sociology', desc: 'Village studies, urbanization and change in Bangladesh.' },
      { title: 'Gender & Development', desc: 'Women’s empowerment, social welfare and development practice.' },
    ],
    careers: ['NGO & development sector', 'Social research organizations', 'BCS General cadres', 'College teaching', 'Higher studies (Masters, MPhil)'],
    teacherSubjects: ['Sociology'],
  },
  'degree-ba': {
    slug: 'degree-ba',
    navLabel: 'BA',
    group: 'Degree (Pass)',
    title: 'Degree (Pass) — BA',
    tagline: 'A flexible three-year Bachelor of Arts across the humanities.',
    duration: '3-year Degree Pass Course (National University)',
    affiliation: 'National University',
    about: [
      'The Bachelor of Arts (Pass) is a three-year Degree program under the National University, combining compulsory Bangla, English and Bangladesh studies with elective humanities subjects. It is an ideal route for students balancing study with family or work.',
      'BA graduates qualify for Masters (Preliminary) admission, teaching posts, and general BCS and government job examinations.',
    ],
    highlights: [
      { title: 'Compulsory Core', desc: 'Bangla, English and history of Bangladesh Liberation War studies.' },
      { title: 'Humanities Electives', desc: 'Choices across language, history, philosophy and Islamic studies areas.' },
      { title: 'Affordable & Flexible', desc: 'Modest fees and a schedule suited to students from all backgrounds.' },
      { title: 'Masters Pathway', desc: 'Direct eligibility for NU Masters (Preliminary) programs.' },
    ],
    careers: ['Primary & secondary teaching', 'Government job examinations', 'Masters (Preliminary) admission', 'Office & administrative posts'],
    teacherSubjects: ['Bangla', 'English', 'Philosophy', 'Islamic History and Culture'],
  },
  'degree-bss': {
    slug: 'degree-bss',
    navLabel: 'BSS',
    group: 'Degree (Pass)',
    title: 'Degree (Pass) — BSS',
    tagline: 'A three-year Bachelor of Social Science for future administrators and researchers.',
    duration: '3-year Degree Pass Course (National University)',
    affiliation: 'National University',
    about: [
      'The Bachelor of Social Science (Pass) is a three-year Degree program under the National University built around society-facing subjects — political science, sociology and economics — with the compulsory Bangla and English core.',
      'BSS graduates are well placed for social-sector jobs, local administration, and Masters study in the social sciences.',
    ],
    highlights: [
      { title: 'Compulsory Core', desc: 'Bangla, English and history of Bangladesh Liberation War studies.' },
      { title: 'Social Science Electives', desc: 'Politics, society and economy — the classic administrator’s toolkit.' },
      { title: 'Practical Outlook', desc: 'Field awareness, survey basics and community understanding.' },
      { title: 'Masters Pathway', desc: 'Direct eligibility for NU Masters (Preliminary) programs.' },
    ],
    careers: ['NGO & social welfare posts', 'Government job examinations', 'Masters (Preliminary) admission', 'Research assistance & field work'],
    teacherSubjects: ['Political Science', 'Sociology', 'Economics'],
  },
};

export const DEPARTMENT_NAV: { group: string; items: { slug: string; label: string }[] }[] = [
  {
    group: 'Honours',
    items: [
      { slug: 'honours-english', label: 'English' },
      { slug: 'honours-political-science', label: 'Political Science' },
      { slug: 'honours-sociology', label: 'Sociology' },
    ],
  },
  {
    group: 'Degree (Pass)',
    items: [
      { slug: 'degree-ba', label: 'BA' },
      { slug: 'degree-bss', label: 'BSS' },
    ],
  },
];
