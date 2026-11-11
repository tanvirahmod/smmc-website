import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Save, User, Phone, MapPin, BookOpen, GraduationCap, Lock, Droplet, FileText, Briefcase, Wallet, Moon, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { updateStudent, Student } from '@/lib/apiClient';
import { useSEO } from '@/lib/useSEO';
import SaveToast from '@/components/SaveToast';
import DashboardShell, { type DashboardNavGroup } from '@/components/DashboardShell';
import {
  DEGREE_SUBJECTS,
  HSC_HUMANITIES_SUBJECTS,
  HSC_HUMANITIES_DEFAULT,
  HSC_FOURTH_SUBJECTS,
  HSC_SCIENCE_SUBJECTS,
  HSC_SCIENCE_FOURTH_SUBJECTS,
  HSC_BUSINESS_SUBJECTS,
  HSC_BUSINESS_FOURTH_SUBJECTS,
} from '@/lib/subjects';

type StudentWithoutPassword = Omit<Student, 'password'>;

const GROUPS = ['Humanities', 'Science', 'Business Studies'];

const BD_BOARDS = [
  'Dhaka Board',
  'Chittagong Board',
  'Rajshahi Board',
  'Comilla Board',
  'Barisal Board',
  'Sylhet Board',
  'Dinajpur Board',
  'Jessore Board',
  'Mymensingh Board',
  'Bangladesh Madrasah Education Board',
  'Bangladesh Technical Education Board',
];

const YES_NO_OPTIONS = ['Yes', 'No'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const RELIGIONS = ['Islam', 'Hinduism', 'Christianity', 'Buddhism', 'Others'];
const GENDERS = ['Female', 'Male', 'Others'];

function parseSubjectList(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || '[]');
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

type FieldType = 'text' | 'select' | 'textarea' | 'subjects' | 'hsc-group';

interface FieldConfig {
  key: string;
  label: string;
  icon: typeof User;
  type: FieldType;
  options?: string[];
  autoComplete?: string;
  disabled?: boolean;
  hint?: string;
}

const COMMON_FIELDS: FieldConfig[] = [
  { key: 'full_name', label: 'Full Name', icon: User, type: 'text', autoComplete: 'name' },
  { key: 'fathers_name', label: "Father's Name", icon: User, type: 'text', autoComplete: 'off' },
  { key: 'mothers_name', label: "Mother's Name", icon: User, type: 'text', autoComplete: 'off' },
  { key: 'birth_certificate_number', label: 'Birth Certificate Number', icon: FileText, type: 'text', autoComplete: 'off' },
  { key: 'gender', label: 'Gender', icon: Users, type: 'select', options: GENDERS },
  { key: 'religion', label: 'Religion', icon: Moon, type: 'select', options: RELIGIONS },
  { key: 'blood_group', label: 'Blood Group', icon: Droplet, type: 'select', options: BLOOD_GROUPS },
  { key: 'father_alive', label: 'Is Your Father Alive?', icon: User, type: 'select', options: YES_NO_OPTIONS },
  { key: 'mother_alive', label: 'Is Your Mother Alive?', icon: User, type: 'select', options: YES_NO_OPTIONS },
  { key: 'guardian_occupation', label: "Guardian's Occupation", icon: Briefcase, type: 'text', autoComplete: 'off' },
  { key: 'guardian_phone', label: 'Guardian Phone Number', icon: Phone, type: 'text', autoComplete: 'tel' },
  { key: 'guardian_annual_income', label: 'Guardian Annual Income', icon: Wallet, type: 'text', autoComplete: 'off' },
  { key: 'class_roll', label: 'Class Roll', icon: GraduationCap, type: 'text', autoComplete: 'off', disabled: true, hint: 'Only the principal can change this' },
  { key: 'session', label: 'Session', icon: GraduationCap, type: 'text', autoComplete: 'off', disabled: true, hint: 'Only the principal can change this' },
  { key: 'program', label: 'Program', icon: BookOpen, type: 'select', options: ['HSC', 'Degree', 'Honours'], disabled: true, hint: 'Only the principal can change this' },
  { key: 'mobile_number', label: 'Mobile Number', icon: Phone, type: 'text', autoComplete: 'tel' },
  { key: 'present_address', label: 'Present Address', icon: MapPin, type: 'textarea', autoComplete: 'street-address' },
  { key: 'permanent_address', label: 'Permanent Address', icon: MapPin, type: 'textarea', autoComplete: 'street-address' },
];

const DEPARTMENT_FIELD: FieldConfig = {
  key: 'department',
  label: 'Department/Group',
  icon: BookOpen,
  type: 'select',
  options: ['BA', 'BSS'],
};

const HONOURS_DEPARTMENT_FIELD: FieldConfig = {
  key: 'department',
  label: 'Department',
  icon: BookOpen,
  type: 'select',
  options: ['English', 'Political Science', 'Sociology'],
};

const SUBJECTS_FIELD: FieldConfig = {
  key: 'subjects',
  label: 'Pick Subjects',
  icon: BookOpen,
  type: 'subjects',
};

const HSC_GROUP_FIELD: FieldConfig = {
  key: 'hsc_group',
  label: 'Group',
  icon: BookOpen,
  type: 'hsc-group',
  options: GROUPS,
};

const HSC_SUBJECTS_FIELD: FieldConfig = {
  key: 'hsc_subjects',
  label: 'Subjects',
  icon: BookOpen,
  type: 'subjects',
  options: HSC_HUMANITIES_SUBJECTS,
};

const FOURTH_SUBJECT_FIELD: FieldConfig = {
  key: 'fourth_subject',
  label: '4th Subject',
  icon: BookOpen,
  type: 'select',
  options: HSC_FOURTH_SUBJECTS,
};

const SSC_GROUP: FieldConfig = { key: 'ssc_group', label: 'SSC Group', icon: BookOpen, type: 'select', options: GROUPS };
const SSC_BOARD: FieldConfig = { key: 'ssc_board', label: 'SSC Board', icon: BookOpen, type: 'select', options: BD_BOARDS };
const HSC_GROUP: FieldConfig = { key: 'hsc_group', label: 'HSC Group', icon: BookOpen, type: 'select', options: GROUPS };
const HSC_BOARD: FieldConfig = { key: 'hsc_board', label: 'HSC Board', icon: BookOpen, type: 'select', options: BD_BOARDS };

interface AcademicSection {
  title: string;
  fields: FieldConfig[];
}

function getAcademicSections(program: string): AcademicSection[] {
  if (program === 'HSC') {
    return [
      {
        title: 'SSC Academic Background',
        fields: [
          SSC_GROUP,
          SSC_BOARD,
          { key: 'ssc_gpa', label: 'SSC GPA', icon: GraduationCap, type: 'text' },
          { key: 'ssc_passing_year', label: 'SSC Passing Year', icon: GraduationCap, type: 'text' },
          { key: 'ssc_roll', label: 'SSC Roll', icon: GraduationCap, type: 'text' },
          { key: 'ssc_regi', label: 'SSC Registration No.', icon: GraduationCap, type: 'text' },
          { key: 'ssc_institute', label: 'SSC Institute Name', icon: BookOpen, type: 'text' },
        ],
      },
    ];
  }
  if (program === 'Degree' || program === 'Honours') {
    return [
      {
        title: 'HSC Academic Background',
        fields: [
          HSC_GROUP,
          HSC_BOARD,
          { key: 'hsc_gpa', label: 'HSC GPA', icon: GraduationCap, type: 'text' },
          { key: 'hsc_passing_year', label: 'HSC Passing Year', icon: GraduationCap, type: 'text' },
          { key: 'hsc_roll', label: 'HSC Roll', icon: GraduationCap, type: 'text' },
          { key: 'hsc_regi', label: 'HSC Registration No.', icon: GraduationCap, type: 'text' },
          { key: 'hsc_institute', label: 'HSC Institute Name', icon: BookOpen, type: 'text' },
        ],
      },
    ];
  }
  return [];
}

export default function StudentProfile() {
  const navigate = useNavigate();
  const { student, password, logout, updateStudentData } = useAuth();
  const [form, setForm] = useState<Partial<StudentWithoutPassword>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [fourthSubjectWarning, setFourthSubjectWarning] = useState('');
  const [activeSection, setActiveSection] = useState('sec-info');

  useSEO({
    title: 'Student Profile',
    description: 'View and update your student profile, academic details, and results at Sufia Motin Mohila College.',
    path: '/student-profile',
    noindex: true,
  });

  useEffect(() => {
    if (student) {
      const initial: Partial<StudentWithoutPassword> = { ...student };
      if (student.program === 'HSC') {
        if (student.hsc_group === 'Humanities') {
          if (parseSubjectList(student.hsc_subjects).length === 0) {
            initial.hsc_subjects = JSON.stringify(HSC_HUMANITIES_DEFAULT);
          }
        } else if (student.hsc_group === 'Science') {
          if (parseSubjectList(student.hsc_subjects).length === 0) {
            initial.hsc_subjects = JSON.stringify(HSC_SCIENCE_SUBJECTS);
          }
          // Empty OR stale values (e.g. 'Economics' saved before the group was
          // known) both resolve to the group's mandatory 4th subject, so the
          // next save repairs the data.
          if (!HSC_SCIENCE_FOURTH_SUBJECTS.includes(initial.fourth_subject || '')) {
            initial.fourth_subject = HSC_SCIENCE_FOURTH_SUBJECTS[0];
          }
        } else if (student.hsc_group === 'Business Studies') {
          if (parseSubjectList(student.hsc_subjects).length === 0) {
            initial.hsc_subjects = JSON.stringify(HSC_BUSINESS_SUBJECTS);
          }
          if (!HSC_BUSINESS_FOURTH_SUBJECTS.includes(initial.fourth_subject || '')) {
            initial.fourth_subject = HSC_BUSINESS_FOURTH_SUBJECTS[0];
          }
        }
      }
      setForm(initial);
    }
  }, [student]);

  if (!student) {
    return <Navigate to="/login" replace />;
  }

  const currentProgram = (form.program as string) || student.program || 'HSC';
  const academicSections = getAcademicSections(currentProgram);

  // Sidebar items jump to the form's sections; the form still saves as a whole,
  // so sections stay anchors rather than separate tabs.
  const navGroups: DashboardNavGroup[] = [
    {
      label: 'My Profile',
      items: [
        { id: 'sec-info', label: 'Student Information', icon: User },
        ...academicSections.map((section, sectionIndex) => ({
          id: `sec-academic-${sectionIndex}`,
          label: section.title,
          icon: GraduationCap,
        })),
      ],
    },
  ];

  const handleSectionNav = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const department = (form.department as string) || '';
  const hscGroup = (form.hsc_group as string) || '';
  const hscMainSubjects = parseSubjectList(form.hsc_subjects);
  const studentInfoFields = COMMON_FIELDS.flatMap((field) => {
    if (field.key === 'program') {
      if (currentProgram === 'Degree') {
        const fields: FieldConfig[] = [field, DEPARTMENT_FIELD];
        if (department === 'BA' || department === 'BSS') {
          fields.push(SUBJECTS_FIELD);
        }
        return fields;
      }
      if (currentProgram === 'Honours') {
        return [field, HONOURS_DEPARTMENT_FIELD];
      }
      if (currentProgram === 'HSC') {
        const fields: FieldConfig[] = [field, HSC_GROUP_FIELD];
        if (hscGroup === 'Humanities') {
          // Keep a saved 4th subject visible in the dropdown even if it is no
          // longer in the Humanities option list (e.g. Political Science).
          const savedFourth = (form.fourth_subject as string) || '';
          const humanitiesFourths = savedFourth && !HSC_FOURTH_SUBJECTS.includes(savedFourth)
            ? [savedFourth, ...HSC_FOURTH_SUBJECTS]
            : HSC_FOURTH_SUBJECTS;
          fields.push(
            HSC_SUBJECTS_FIELD,
            {
              ...FOURTH_SUBJECT_FIELD,
              options: humanitiesFourths.filter(
                (s) => !hscMainSubjects.includes(s)
              ),
            }
          );
        } else if (hscGroup === 'Science') {
          fields.push(
            { ...HSC_SUBJECTS_FIELD, options: HSC_SCIENCE_SUBJECTS },
            { ...FOURTH_SUBJECT_FIELD, options: HSC_SCIENCE_FOURTH_SUBJECTS }
          );
        } else if (hscGroup === 'Business Studies') {
          fields.push(
            { ...HSC_SUBJECTS_FIELD, options: HSC_BUSINESS_SUBJECTS },
            { ...FOURTH_SUBJECT_FIELD, options: HSC_BUSINESS_FOURTH_SUBJECTS }
          );
        }
        return fields;
      }
    }
    return [field];
  });

  const handleChange = (key: string, value: string) => {
    if (key === 'hsc_subjects' && form.fourth_subject) {
      const selected = parseSubjectList(value);
      if (selected.includes(form.fourth_subject as string)) {
        setFourthSubjectWarning(
          `${form.fourth_subject} is already selected as a main subject, so it can't be the 4th subject. Please choose a different 4th subject.`
        );
        setForm((prev) => ({ ...prev, hsc_subjects: value, fourth_subject: '' }));
        return;
      }
    }
    if (key === 'fourth_subject') {
      setFourthSubjectWarning('');
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleHscGroupChange = (value: string) => {
    setFourthSubjectWarning('');
    handleChange('hsc_group', value);
    if (value === 'Humanities') {
      handleChange('hsc_subjects', JSON.stringify(HSC_HUMANITIES_DEFAULT));
      if (!HSC_FOURTH_SUBJECTS.includes(form.fourth_subject as string)) {
        handleChange('fourth_subject', '');
      }
    } else if (value === 'Science') {
      handleChange('hsc_subjects', JSON.stringify(HSC_SCIENCE_SUBJECTS));
      handleChange('fourth_subject', HSC_SCIENCE_FOURTH_SUBJECTS[0]);
    } else if (value === 'Business Studies') {
      handleChange('hsc_subjects', JSON.stringify(HSC_BUSINESS_SUBJECTS));
      handleChange('fourth_subject', HSC_BUSINESS_FOURTH_SUBJECTS[0]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await updateStudent(student.student_id, password, form);
      updateStudentData(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const programColors = {
    HSC: 'bg-blue-100 text-blue-700',
    Degree: 'bg-purple-100 text-purple-700',
    Honours: 'bg-amber-100 text-amber-700',
  };

  const renderField = (field: FieldConfig) => {
    const Icon = field.icon;
    const value = (form[field.key as keyof StudentWithoutPassword] as string) || '';

    if (field.type === 'hsc-group') {
      return (
        <div key={field.key} className="form-group">
          <label className="label flex items-center gap-1.5" htmlFor={field.key}>
            <Icon size={16} className="text-gray-400" />
            {field.label}
          </label>
          <select
            id={field.key}
            value={value}
            onChange={(e) => handleHscGroupChange(e.target.value)}
            className="select"
            disabled={field.disabled}
          >
            <option value="" disabled>
              Select {field.label.toLowerCase()}
            </option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (field.type === 'subjects') {
      const subjectList = field.options || DEGREE_SUBJECTS;
      const selected = parseSubjectList(
        form[field.key as keyof StudentWithoutPassword]
      );
      const toggle = (subject: string) => {
        const next = selected.includes(subject)
          ? selected.filter((s) => s !== subject)
          : [...selected, subject];
        handleChange(field.key, JSON.stringify(next));
      };
      return (
        <div key={field.key} className="form-group md:col-span-2">
          <div className="label flex items-center gap-1.5">
            <Icon size={16} className="text-gray-400" />
            {field.label}
            <span className="text-xs font-normal text-gray-400">— select all that apply</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {subjectList.map((subject) => {
              const checked = selected.includes(subject);
              return (
                <label
                  key={subject}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                    checked
                      ? 'border-green-600 bg-green-50 text-green-800 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:bg-green-50/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(subject)}
                    className="w-4 h-4 rounded accent-green-700 flex-shrink-0"
                  />
                  <span className="text-sm font-medium">{subject}</span>
                </label>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div key={field.key} className="form-group">
        <label className="label flex items-center gap-1.5" htmlFor={field.key}>
          <Icon size={16} className="text-gray-400" />
          {field.label}
          {field.disabled && <Lock size={14} className="text-gray-400 flex-shrink-0" />}
          {field.hint && (
            <span className="text-xs font-normal text-gray-400">— {field.hint}</span>
          )}
        </label>
        {field.type === 'textarea' ? (
          <textarea
            id={field.key}
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            rows={3}
            className="input"
            placeholder={`Enter ${field.label.toLowerCase()}`}
            autoComplete={field.autoComplete}
            disabled={field.disabled}
          />
        ) : field.type === 'select' ? (
          <>
            <select
              id={field.key}
              value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="select"
            disabled={field.disabled}
          >
              <option value="" disabled>
                Select {field.label.toLowerCase()}
              </option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {field.key === 'fourth_subject' && fourthSubjectWarning && (
              <p
                className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2"
                role="alert"
              >
                <span className="flex-shrink-0" aria-hidden="true">⚠</span>
                {fourthSubjectWarning}
              </p>
            )}
          </>
        ) : (
          <input
            id={field.key}
            type="text"
            value={value}
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="input"
            placeholder={`Enter ${field.label.toLowerCase()}`}
            autoComplete={field.autoComplete}
            disabled={field.disabled}
          />
        )}
      </div>
    );
  };

  return (
    <DashboardShell
      roleLabel="Student"
      title={student.full_name || 'Update your profile'}
      subtitle={`Class Roll: ${student.class_roll || student.student_id}`}
      avatar={<GraduationCap size={26} />}
      meta={
        student.program ? (
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${programColors[student.program as keyof typeof programColors] || 'bg-gray-100 text-gray-700'}`}>
            {student.program}
          </span>
        ) : undefined
      }
      navGroups={navGroups}
      activeId={activeSection}
      onNavigate={handleSectionNav}
      onLogout={handleLogout}
    >
      <div className="max-w-4xl">
        {/* Student Information */}
        <section id="sec-info" className="card p-4 md:p-6 mb-4 md:mb-6 animate-fade-in scroll-mt-36">
          <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
            <User size={20} className="text-green-600" />
            Student Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {studentInfoFields.map(renderField)}
          </div>
        </section>

        {/* Program-specific Academic Sections */}
        {academicSections.map((section, sectionIndex) => (
          <section key={section.title} id={`sec-academic-${sectionIndex}`} className="card p-4 md:p-6 mb-4 md:mb-6 animate-fade-in scroll-mt-36">
            <h2 className="text-base md:text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <GraduationCap size={20} className="text-green-600" />
              {section.title}
            </h2>
            <p className="text-sm text-gray-500 mb-4 md:mb-6">
              Fields for the <span className="font-semibold text-green-700">{currentProgram}</span> program. Change the Program field above to switch forms.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {section.fields.map(renderField)}
            </div>
          </section>
        ))}

        {/* Save Button */}
        <div className="mt-4 md:mt-6 md:flex md:justify-end animate-fade-in">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary btn-lg w-full md:w-auto"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <SaveToast saved={saved} error={error} onDismissError={() => setError('')} />
    </DashboardShell>
  );
}
