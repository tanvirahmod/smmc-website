import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import {
  Save, User, FileText, MapPin, Calendar, Award, BookOpen, Upload,
  Check, Phone, Mail, PenSquare, Trash2, AlertCircle, Users,
  LayoutGrid, Bell, ClipboardList, BadgeCheck, Stamp, Scale, FlaskConical, Droplet, Moon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { updateTeacher, fetchNotices, createTeacherNotice, deleteTeacherNotice, fetchActiveExams, fetchDepartmentStaff, Teacher, Notice, Exam, DepartmentStaff } from '@/lib/apiClient';
import { DEPARTMENTS } from '@/lib/departments';
import { useSEO } from '@/lib/useSEO';
import { ALL_SUBJECTS } from '@/lib/subjects';
import SaveToast from '@/components/SaveToast';
import DashboardShell, { type DashboardNavGroup } from '@/components/DashboardShell';
import TeacherStudentsDirectory from '@/components/TeacherStudentsDirectory';
import TeacherExamResults from '@/components/TeacherExamResults';
import IncourseManager from '@/components/IncourseManager';

type TeacherWithoutPassword = Omit<Teacher, 'password'>;

const DESIGNATIONS = [
  'Principal',
  'Vice-Principal',
  'Assistant Professor',
  'Lecturer',
  'Library Lecturer / Librarian',
  'Lecturer - BMT / Vocational',
  'Demonstrator',
  'Assistant Librarian cum Cataloger',
  'Head Assistant',
  'Accountant',
  'Office Assistant cum Computer Operator',
  'Lab Assistant',
  'Office Support Staff / Peon',
  'Lab Attendant / Bearer',
  'Security Guard / Night Guard',
  'Cleaner / Sweeper',
];

const EMPLOYMENT_TYPES = ['MPO', 'NON-MPO', 'Part Time'];
const APPOINTMENT_TYPES = ['Committee', 'NTRCA'];
const PENDING_LAWSUITS_OPTIONS = ['YES', 'NO'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Female', 'Male', 'Others'];
const RELIGIONS = ['Islam', 'Hinduism', 'Christianity', 'Buddhism', 'Others'];

interface TeacherFieldConfig {
  key: string;
  label: string;
  icon: typeof User;
  type: 'text' | 'date' | 'email' | 'textarea' | 'select';
  options?: string[];
}

const PERSONAL_FIELDS: TeacherFieldConfig[] = [
  { key: 'full_name', label: 'Full Name', icon: User, type: 'text' },
  { key: 'fathers_name', label: "Father's Name", icon: User, type: 'text' },
  { key: 'mothers_name', label: "Mother's Name", icon: User, type: 'text' },
  { key: 'dob', label: 'Date of Birth', icon: Calendar, type: 'date' },
  { key: 'blood_group', label: 'Blood Group', icon: Droplet, type: 'select', options: BLOOD_GROUPS },
  { key: 'gender', label: 'Gender', icon: Users, type: 'select', options: GENDERS },
  { key: 'religion', label: 'Religion', icon: Moon, type: 'select', options: RELIGIONS },
  { key: 'mobile_number', label: 'Mobile Number', icon: Phone, type: 'text' },
  { key: 'email', label: 'Email Address', icon: Mail, type: 'email' },
  { key: 'tmis_no', label: 'TMIS No', icon: FileText, type: 'text' },
  { key: 'ttis_no', label: 'TTIS No', icon: FileText, type: 'text' },
  { key: 'current_address', label: 'Current Address', icon: MapPin, type: 'textarea' },
  { key: 'permanent_address', label: 'Permanent Address', icon: MapPin, type: 'textarea' },
  { key: 'nid_number', label: 'NID Number', icon: FileText, type: 'text' },
  { key: 'joining_date', label: 'Joining Date', icon: Calendar, type: 'date' },
  { key: 'appointment_date', label: 'Appointment Date', icon: Calendar, type: 'date' },
  { key: 'designation', label: 'Designation', icon: Award, type: 'select', options: DESIGNATIONS },
  { key: 'employment_type', label: 'Employment Type', icon: BadgeCheck, type: 'select', options: EMPLOYMENT_TYPES },
  { key: 'appointment_type', label: 'Appointment Type', icon: Stamp, type: 'select', options: APPOINTMENT_TYPES },
  { key: 'pending_lawsuits', label: 'Pending Lawsuits', icon: Scale, type: 'select', options: PENDING_LAWSUITS_OPTIONS },
  { key: 'subject', label: 'Subject', icon: BookOpen, type: 'select', options: ALL_SUBJECTS },
  { key: 'mpo_date', label: 'MPO Date', icon: Calendar, type: 'date' },
  { key: 'index_number', label: 'Index Number', icon: FileText, type: 'text' },
  { key: 'salary_grade', label: 'Salary Grade', icon: Award, type: 'text' },
  { key: 'basic_scale', label: 'Basic Scale/Salary', icon: Award, type: 'text' },
  { key: 'training_names', label: 'Training Names', icon: BookOpen, type: 'textarea' },
];

const EDU_DEGREES = [
  { prefix: 'edu_ssc', label: 'SSC / Dakhil' },
  { prefix: 'edu_hsc', label: 'HSC / Alim' },
  { prefix: 'edu_honours', label: 'Honours' },
  { prefix: 'edu_masters', label: 'Masters' },
] as const;

function eduKey(prefix: string, field: string): string {
  if (field === 'institute') return `education_${prefix.replace('edu_', '')}`;
  return `${prefix}_${field}`;
}

type TabId = 'profile' | 'notices' | 'results' | 'students' | 'incourse';

export default function TeacherProfile() {
  const navigate = useNavigate();
  const { teacher, password, logout, updateTeacherData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState<Partial<TeacherWithoutPassword>>({});
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Notice writing state
  const [myNotices, setMyNotices] = useState<Notice[]>([]);
  const [myDepartments, setMyDepartments] = useState<DepartmentStaff[]>([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeCategory, setNoticeCategory] = useState('general');
  const [noticeClass, setNoticeClass] = useState('all');
  const [noticeTarget, setNoticeTarget] = useState('main');
  const [noticeMsg, setNoticeMsg] = useState('');
  const [noticeError, setNoticeError] = useState('');
  const [postingNotice, setPostingNotice] = useState(false);

  // Active exams for the teacher's subject
  const [activeExams, setActiveExams] = useState<Exam[]>([]);

  useSEO({
    title: 'Teacher Dashboard',
    description: 'Manage your profile, notices, and view your students at Sufia Motin Mohila College.',
    path: '/teacher-profile',
    noindex: true,
  });

  useEffect(() => {
    if (teacher) {
      setForm(teacher);
      setProfilePicUrl(teacher.profile_pic_url || '');
    }
  }, [teacher]);

  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    fetchDepartmentStaff(undefined, teacher.teacher_id)
      .then(async (rows) => {
        if (cancelled) return;
        setMyDepartments(rows);
        if (!teacher.can_write_notice && rows.length > 0) {
          setNoticeTarget((prev) => (prev === 'main' ? rows[0].department_slug : prev));
        }
        if (teacher.can_write_notice || rows.length > 0) {
          await refreshNotices(rows);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  useEffect(() => {
    fetchActiveExams()
      .then(setActiveExams)
      .catch(() => {});
  }, []);

  if (!teacher) {
    return <Navigate to="/login" replace />;
  }

  const hasSubjectExams = !!teacher.subject && activeExams.some((e) => e.subjects.includes(teacher.subject));

  const loadMyNotices = async () => {
    await refreshNotices(myDepartments);
  };

  const refreshNotices = async (depts: DepartmentStaff[]) => {
    try {
      const [main, ...deptLists] = await Promise.all([
        fetchNotices(),
        ...depts.map((a) => fetchNotices(a.department_slug)),
      ]);
      const merged = [...main, ...deptLists.flat()];
      const seen = new Set<string>();
      const unique = merged.filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });
      unique.sort((a, b) => (b.published_date || '').localeCompare(a.published_date || ''));
      setMyNotices(unique);
    } catch { /* ignore */ }
  };

  const canPublishNotices = teacher.can_write_notice || myDepartments.length > 0;

  const navGroups: DashboardNavGroup[] = [
    {
      label: 'My Workspace',
      items: [
        { id: 'profile', label: 'Profile', icon: LayoutGrid },
        ...(hasSubjectExams ? [{ id: 'results', label: 'Exam Results', icon: ClipboardList }] : []),
        ...(!teacher.is_principal ? [{ id: 'students', label: 'My Students', icon: Users }] : []),
        ...(myDepartments.length > 0 ? [{ id: 'incourse', label: 'In-Course', icon: FlaskConical }] : []),
      ],
    },
    ...(canPublishNotices
      ? [{ label: 'Communication', items: [{ id: 'notices', label: 'Notices', icon: Bell }] }]
      : []),
  ];

  const activeTabParam = searchParams.get('tab');
  const validTabIds = navGroups.flatMap((g) => g.items).map((i) => i.id);
  const activeTab: TabId = validTabIds.includes(activeTabParam ?? '')
    ? (activeTabParam as TabId)
    : 'profile';
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const currentDesignation = (form.designation as string) || '';
  const designationOptions =
    currentDesignation && !DESIGNATIONS.includes(currentDesignation)
      ? [currentDesignation, ...DESIGNATIONS]
      : DESIGNATIONS;

  const currentSubject = (form.subject as string) || '';
  const subjectOptions =
    currentSubject && !ALL_SUBJECTS.includes(currentSubject)
      ? [currentSubject, ...ALL_SUBJECTS]
      : ALL_SUBJECTS;

  const currentEmploymentType = (form.employment_type as string) || '';
  const employmentTypeOptions =
    currentEmploymentType && !EMPLOYMENT_TYPES.includes(currentEmploymentType)
      ? [currentEmploymentType, ...EMPLOYMENT_TYPES]
      : EMPLOYMENT_TYPES;

  const currentAppointmentType = (form.appointment_type as string) || '';
  const appointmentTypeOptions =
    currentAppointmentType && !APPOINTMENT_TYPES.includes(currentAppointmentType)
      ? [currentAppointmentType, ...APPOINTMENT_TYPES]
      : APPOINTMENT_TYPES;

  const currentPendingLawsuits = (form.pending_lawsuits as string) || '';
  const pendingLawsuitsOptions =
    currentPendingLawsuits && !PENDING_LAWSUITS_OPTIONS.includes(currentPendingLawsuits)
      ? [currentPendingLawsuits, ...PENDING_LAWSUITS_OPTIONS]
      : PENDING_LAWSUITS_OPTIONS;

  const getFieldOptions = (field: TeacherFieldConfig): string[] | undefined => {
    if (field.key === 'designation') return designationOptions;
    if (field.key === 'subject') return subjectOptions;
    if (field.key === 'employment_type') return employmentTypeOptions;
    if (field.key === 'appointment_type') return appointmentTypeOptions;
    if (field.key === 'pending_lawsuits') return pendingLawsuitsOptions;
    return field.options;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await updateTeacher(teacher.teacher_id, password, teacher.teacher_id, {
        ...form,
        profile_pic_url: profilePicUrl,
      });
      updateTeacherData(updated);
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

  const handlePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;
    setPostingNotice(true);
    setNoticeError('');
    setNoticeMsg('');
    try {
      await createTeacherNotice(
        teacher.teacher_id, password, noticeTitle, noticeContent, noticeCategory,
        noticeClass === 'all' ? '' : noticeClass,
        noticeTarget === 'main' ? undefined : noticeTarget
      );
      setNoticeMsg('Notice published successfully!');
      setNoticeTitle('');
      setNoticeContent('');
      setNoticeCategory('general');
      setNoticeClass('all');
      loadMyNotices();
      setTimeout(() => setNoticeMsg(''), 4000);
    } catch (err) {
      setNoticeError(err instanceof Error ? err.message : 'Failed to publish notice');
    } finally {
      setPostingNotice(false);
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await deleteTeacherNotice(teacher.teacher_id, password, noticeId);
      loadMyNotices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <DashboardShell
      roleLabel={teacher.is_principal ? 'Principal' : 'Teacher'}
      title={teacher.full_name || 'Teacher Dashboard'}
      subtitle={`Teacher ID: ${teacher.teacher_id}`}
      avatar={
        profilePicUrl ? (
          <img src={profilePicUrl} alt={teacher.full_name || 'Profile'} className="w-full h-full object-cover" />
        ) : (
          <User size={26} className="text-white" />
        )
      }
      meta={
        <>
          {teacher.designation && (
            <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 px-3 py-1 rounded-full text-xs font-medium text-green-50">
              <Award size={12} />
              {teacher.designation}
            </span>
          )}
          {teacher.subject && (
            <span className="inline-flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/30 px-3 py-1 rounded-full text-xs font-medium text-amber-200">
              <BookOpen size={12} />
              {teacher.subject}
            </span>
          )}
        </>
      }
      navGroups={navGroups}
      activeId={activeTab}
      onNavigate={(id) => setActiveTab(id as TabId)}
      onLogout={handleLogout}
    >
        {activeTab === 'profile' && (
          <div className="space-y-6 animate-fade-in">
            {/* Profile Picture */}
            <section className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <User size={20} className="text-green-600" />
                Profile Picture
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                <div className="relative self-start">
                  <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                    {profilePicUrl ? (
                      <img src={profilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={56} className="text-gray-300" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-xl cursor-pointer hover:bg-green-700 transition-colors shadow-lg">
                    <Upload size={16} />
                    <input type="file" accept="image/*" onChange={handlePicUpload} className="hidden" />
                  </label>
                </div>
                <div>
                  <p className="text-gray-600 mb-3">Upload a professional profile photo</p>
                  <label className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer hover:bg-green-100 transition-colors">
                    <Upload size={16} /> Choose Photo
                    <input type="file" accept="image/*" onChange={handlePicUpload} className="hidden" />
                  </label>
                  <p className="text-xs text-gray-400 mt-2">JPG, PNG up to 2MB</p>
                </div>
              </div>
            </section>

            {/* Personal Information */}
            <section className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <User size={20} className="text-green-600" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {PERSONAL_FIELDS.map((field) => {
                  const Icon = field.icon;
                  return (
                    <div key={field.key} className="form-group">
                      <label className="label flex items-center gap-1.5" htmlFor={field.key}>
                        <Icon size={16} className="text-gray-400" />
                        {field.label}
                      </label>
                      <div className="relative">
                        {field.type === 'select' ? (
                          <select
                            id={field.key}
                            value={(form[field.key as keyof TeacherWithoutPassword] as string) || ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            className="select"
                          >
                            <option value="" disabled>
                              Select {field.label.toLowerCase()}
                            </option>
                            {getFieldOptions(field)?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            id={field.key}
                            value={(form[field.key as keyof TeacherWithoutPassword] as string) || ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            rows={3}
                            className="input"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        ) : (
                          <input
                            id={field.key}
                            type={field.type}
                            value={(form[field.key as keyof TeacherWithoutPassword] as string) || ''}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            className="input"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Education Qualification */}
            <section className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BookOpen size={20} className="text-green-600" />
                Education Qualification
              </h2>
              <div className="space-y-6">
                {EDU_DEGREES.map((degree, idx) => (
                  <div key={degree.prefix} className="border border-gray-100 rounded-xl p-5 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-3">
                      <span className="bg-green-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-sm">
                        {idx + 1}
                      </span>
                      {degree.label}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="form-group">
                        <label className="label" htmlFor={eduKey(degree.prefix, 'institute')}>Institute / Group</label>
                        <input
                          id={eduKey(degree.prefix, 'institute')}
                          type="text"
                          value={(form[eduKey(degree.prefix, 'institute') as keyof TeacherWithoutPassword] as string) || ''}
                          onChange={(e) => handleChange(eduKey(degree.prefix, 'institute'), e.target.value)}
                          className="input"
                          placeholder="e.g. Science / Dhaka College"
                        />
                      </div>
                      <div className="form-group">
                        <label className="label" htmlFor={eduKey(degree.prefix, 'year')}>Passing Year</label>
                        <input
                          id={eduKey(degree.prefix, 'year')}
                          type="text"
                          value={(form[eduKey(degree.prefix, 'year') as keyof TeacherWithoutPassword] as string) || ''}
                          onChange={(e) => handleChange(eduKey(degree.prefix, 'year'), e.target.value)}
                          className="input"
                          placeholder="e.g. 2020"
                        />
                      </div>
                      <div className="form-group">
                        <label className="label" htmlFor={eduKey(degree.prefix, 'board')}>Board Name</label>
                        <input
                          id={eduKey(degree.prefix, 'board')}
                          type="text"
                          value={(form[eduKey(degree.prefix, 'board') as keyof TeacherWithoutPassword] as string) || ''}
                          onChange={(e) => handleChange(eduKey(degree.prefix, 'board'), e.target.value)}
                          className="input"
                          placeholder="e.g. Dhaka Board"
                        />
                      </div>
                      <div className="form-group">
                        <label className="label" htmlFor={eduKey(degree.prefix, 'result')}>Result (GPA/Division)</label>
                        <input
                          id={eduKey(degree.prefix, 'result')}
                          type="text"
                          value={(form[eduKey(degree.prefix, 'result') as keyof TeacherWithoutPassword] as string) || ''}
                          onChange={(e) => handleChange(eduKey(degree.prefix, 'result'), e.target.value)}
                          className="input"
                          placeholder="e.g. 5.00 / First Class"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Save Button */}
            <div className="flex sm:justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary btn-lg w-full sm:w-auto"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'notices' && canPublishNotices && (
          <div className="space-y-6 animate-fade-in">
            {/* Write Notice */}
            <section className="card p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <PenSquare size={20} className="text-green-600" />
                Write & Publish Notice
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {teacher.can_write_notice
                  ? 'You have been granted permission to publish notices.'
                  : 'You can publish notices to your assigned departments.'}
              </p>

              {noticeMsg && (
                <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down">
                  <Check size={16} /> {noticeMsg}
                </div>
              )}
              {noticeError && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2 animate-slide-down" role="alert">
                  <AlertCircle size={16} /> {noticeError}
                </div>
              )}

              <form onSubmit={handleCreateNotice} className="space-y-4">
                <div className="form-group">
                  <label className="label" htmlFor="noticeTarget">Publish To</label>
                  <select
                    id="noticeTarget"
                    value={noticeTarget}
                    onChange={(e) => setNoticeTarget(e.target.value)}
                    className="input"
                  >
                    {teacher.can_write_notice && (
                      <option value="main">Main Notice Board</option>
                    )}
                    {myDepartments.map((a) => (
                      <option key={a.department_slug} value={a.department_slug}>
                        {DEPARTMENTS[a.department_slug]?.title || a.department_slug} Department
                        {a.role === 'head' ? ' (Head)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <button type="submit" disabled={postingNotice} className="btn-primary w-full">
                  <PenSquare size={18} />
                  {postingNotice ? 'Publishing...' : 'Publish Notice'}
                </button>
              </form>
            </section>

            {/* My Notices */}
            <section className="card p-6">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-gray-400" />
                My Notices ({myNotices.length})
              </h3>
              {myNotices.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No notices yet.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {myNotices.map((n) => (
                    <div key={n.id} className="flex items-start justify-between gap-3 p-3 sm:p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                            n.category === 'admission' ? 'bg-blue-50 text-blue-700' :
                            n.category === 'exam' ? 'bg-red-50 text-red-700' :
                            n.category === 'result' ? 'bg-green-50 text-green-700' :
                            n.category === 'holiday' ? 'bg-amber-50 text-amber-700' :
                            'bg-gray-50 text-gray-700'
                          }`}>
                            {n.category.charAt(0).toUpperCase() + n.category.slice(1)}
                          </span>
                          {n.class && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {n.class}
                            </span>
                          )}
                          {n.department && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                              {DEPARTMENTS[n.department]?.title || n.department}
                            </span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-800 text-sm break-words">{n.title}</h4>
                        <p className="text-xs text-gray-500 line-clamp-2 break-words">{n.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNotice(n.id)}
                        className="text-red-500 hover:bg-red-50 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors flex-shrink-0"
                        aria-label="Delete notice"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'students' && <TeacherStudentsDirectory />}

        {activeTab === 'results' && <TeacherExamResults />}

        {activeTab === 'incourse' && myDepartments.length > 0 && (
          <IncourseManager
            auth={{ teacherId: teacher.teacher_id, teacherPassword: password }}
            departments={myDepartments.map((a) => a.department_slug)}
            isPrincipal={false}
          />
        )}

      <SaveToast saved={saved} error={error} onDismissError={() => setError('')} />
    </DashboardShell>
  );
}
