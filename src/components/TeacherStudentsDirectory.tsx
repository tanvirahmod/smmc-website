import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap, Search, Filter, X, User, Award, BookOpen,
  Calendar, AlertCircle, Download, FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchStudentsBySubject, fetchStudentSessions, Student } from '@/lib/apiClient';
import { studentResultGroup, RESULT_GROUP_ORDER } from '@/lib/subjects';
import { downloadStudentListPDF, downloadStudentListCSV } from '@/lib/resultExport';
import { effectiveFourthSubjectFor } from '@/lib/subjects';

function parseSubjectList(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || '[]');
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function studentSubjects(s: Student): string[] {
  const list = new Set<string>();
  for (const sub of parseSubjectList(s.hsc_subjects)) list.add(sub);
  for (const sub of parseSubjectList(s.subjects)) list.add(sub);
  // Group-mandatory 4th subject (Science → Higher Math, Business → Economics)
  // even when the profile field is empty or stale.
  const fourth = effectiveFourthSubjectFor(s.fourth_subject, s.hsc_group);
  if (fourth) list.add(fourth);
  if (s.department) list.add(s.department);
  return Array.from(list);
}

type ProgramFilter = 'all' | 'HSC' | 'Degree' | 'Honours';

export default function TeacherStudentsDirectory() {
  const { teacher } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [program, setProgram] = useState<ProgramFilter>('all');
  const [session, setSession] = useState('');
  const [group, setGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const [exportError, setExportError] = useState('');

  const subject = (teacher?.subject || '').trim();

  useEffect(() => {
    fetchStudentSessions()
      .then(setSessions)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!teacher || !subject) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchStudentsBySubject(subject, session || undefined, program === 'all' ? undefined : program)
      .then((data) => {
        if (!cancelled) setStudents(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load students. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teacher, subject, session, program]);

  const matchesSearch = (s: Student): boolean => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.class_roll || s.student_id || '').toLowerCase().includes(q) ||
      (s.session || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q) ||
      (s.hsc_group || '').toLowerCase().includes(q)
    );
  };

  const matchesFilters = (s: Student): boolean => {
    if (group !== 'all' && studentResultGroup(s) !== group) return false;
    return matchesSearch(s);
  };

  const filtered = useMemo(() => {
    return students.filter(matchesFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, search, group]);

  /** Download the teacher's (filtered) student list: Roll, Name, Mobile +
   *  blank Remarks, two-column PDF or single-list CSV. */
  const handleExportStudentList = async (format: 'pdf' | 'csv') => {
    if (!subject) return;
    setExporting(format);
    setExportError('');
    try {
      const data = await fetchStudentsBySubject(subject, session || undefined, program === 'all' ? undefined : program);
      const groupRank = (g: string): number => {
        const i = RESULT_GROUP_ORDER.indexOf(g);
        return i === -1 ? RESULT_GROUP_ORDER.length : i;
      };
      const rows = data
        .filter(matchesFilters)
        .sort(
          (a, b) =>
            groupRank(studentResultGroup(a)) - groupRank(studentResultGroup(b)) ||
            (a.class_roll || a.student_id || '').localeCompare(b.class_roll || b.student_id || '', undefined, { numeric: true })
        )
        .map((s) => ({
          roll: s.class_roll || s.student_id || '',
          name: s.full_name || 'Profile not updated',
          mobile: s.mobile_number || '',
          group: studentResultGroup(s),
        }));
      if (rows.length === 0) {
        setExportError('No students match the current filters.');
        return;
      }
      const tag = (v: string): string =>
        v === 'all' || v === '' ? 'All' : v.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '');
      const base = `Student_List_${tag(subject)}_${tag(session)}_${tag(program)}_${tag(group)}`;
      const meta = {
        session: session || 'All Sessions',
        program: program === 'all' ? 'All Programs' : program,
        subject,
        group: group === 'all' ? 'All Groups' : group,
        count: rows.length,
      };
      if (format === 'pdf') await downloadStudentListPDF(rows, meta, base);
      else downloadStudentListCSV(rows, base);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export student list');
    } finally {
      setExporting(null);
    }
  };

  if (!subject) {
    return (
      <div className="card p-12 md:p-16 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-amber-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No teaching subject selected</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Set your teaching subject in your profile to see the students enrolled in it.
        </p>
        <Link to="/teacher-profile" className="btn-primary">
          <BookOpen size={18} className="mr-2" />
          Update My Profile
        </Link>
      </div>
    );
  }

  const programCounts = {
    HSC: students.filter((s) => s.program === 'HSC').length,
    Degree: students.filter((s) => s.program === 'Degree').length,
    Honours: students.filter((s) => s.program === 'Honours').length,
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Subject summary + filters */}
      <div className="card card-elevated p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="relative w-full">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, roll, session, or group..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-base"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 overscroll-x-contain" role="group" aria-label="Filter by program">
              {(['all', 'HSC', 'Degree', 'Honours'] as ProgramFilter[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProgram(p)}
                  className={`flex-shrink-0 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                    program === p
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {p === 'all' ? 'All Programs' : p}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-auto">
              <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full sm:w-auto pl-12 pr-8 py-3 sm:py-2.5 min-h-[48px] sm:min-h-[44px] border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none cursor-pointer"
                aria-label="Filter by session"
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="relative w-full sm:w-auto">
              <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full sm:w-auto pl-12 pr-8 py-3 sm:py-2.5 min-h-[48px] sm:min-h-[44px] border border-gray-200 rounded-xl text-sm font-medium text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none cursor-pointer"
                aria-label="Filter by group"
              >
                <option value="all">All Groups</option>
                {RESULT_GROUP_ORDER.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Filter size={14} className="text-gray-400" />
          <span>Subject:</span>
          <span className="badge badge-primary max-w-full truncate">{subject}</span>
          {program !== 'all' && (
            <span className="badge badge-primary flex items-center gap-1">
              {program}
              <button onClick={() => setProgram('all')} className="hover:opacity-70" aria-label="Clear program filter">
                <X size={12} />
              </button>
            </span>
          )}
          {session && (
            <span className="badge badge-primary flex items-center gap-1">
              Session: {session}
              <button onClick={() => setSession('')} className="hover:opacity-70" aria-label="Clear session filter">
                <X size={12} />
              </button>
            </span>
          )}
          {group !== 'all' && (
            <span className="badge badge-primary flex items-center gap-1">
              {group}
              <button onClick={() => setGroup('all')} className="hover:opacity-70" aria-label="Clear group filter">
                <X size={12} />
              </button>
            </span>
          )}
          <span className="ml-auto">
            HSC: {programCounts.HSC} | Degree: {programCounts.Degree} | Honours: {programCounts.Honours}
          </span>
        </div>

        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3">
          <button
            onClick={() => handleExportStudentList('pdf')}
            disabled={exporting !== null || loading}
            className="btn-secondary w-full sm:w-auto"
          >
            <Download size={18} />
            {exporting === 'pdf' ? 'Preparing PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={() => handleExportStudentList('csv')}
            disabled={exporting !== null || loading}
            className="btn-secondary w-full sm:w-auto"
          >
            <FileSpreadsheet size={18} />
            {exporting === 'csv' ? 'Preparing CSV...' : 'Download CSV'}
          </button>
        </div>
        {exportError && (
          <div className="mt-3 bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
            <AlertCircle size={16} /> {exportError}
          </div>
        )}
      </div>

      {/* Students Grid */}
      {loading ? (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" role="status">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-28 bg-gray-200" />
              <div className="p-6 pt-14 pb-5 text-center">
                <div className="w-24 h-24 rounded-full border-4 border-white bg-green-100 mx-auto -mt-12 mb-4" />
                <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-2" />
                <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Something went wrong</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 md:p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {search || program !== 'all' || session || group !== 'all' ? 'No students found' : 'No students enrolled in this subject yet'}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {search || program !== 'all' || session || group !== 'all'
              ? 'Try adjusting your search or filters to find matching students.'
              : `Students who select "${subject}" will appear here once they update their profile.`}
          </p>
          {(search || program !== 'all' || session || group !== 'all') && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {search && (
                <button onClick={() => setSearch('')} className="btn-outline">
                  <X size={16} className="mr-1" />
                  Clear Search
                </button>
              )}
              {(program !== 'all' || session || group !== 'all') && (
                <button
                  onClick={() => { setProgram('all'); setSession(''); setGroup('all'); }}
                  className="btn-secondary"
                >
                  <X size={16} className="mr-1" />
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" role="list">
          {filtered.map((student, index) => {
            const subs = studentSubjects(student);
            return (
              <article
                key={student.id}
                className="card card-interactive overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
                role="listitem"
              >
                <div className="relative h-32 bg-gradient-to-br from-green-50 to-green-100">
                  {student.program && (
                    <div className="absolute top-3 left-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        student.program === 'HSC' ? 'bg-blue-100 text-blue-700' :
                        student.program === 'Degree' ? 'bg-purple-100 text-purple-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {student.program}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                    <div className="w-20 h-20 rounded-full border-4 border-white bg-gradient-to-br from-green-600 to-green-800 text-white flex items-center justify-center shadow-xl">
                      <GraduationCap size={30} />
                    </div>
                  </div>
                </div>

                <div className="pt-12 pb-6 px-5 text-center">
                  <h3 className="font-bold text-gray-900 text-lg">
                    {student.full_name || 'Profile not updated'}
                  </h3>
                  <div className="mt-4 space-y-2 text-sm text-gray-500">
                    {student.class_roll && (
                      <div className="flex items-center justify-center gap-1.5">
                        <GraduationCap size={14} className="text-gray-400" />
                        <span>Roll: {student.class_roll}</span>
                      </div>
                    )}
                    {student.session && (
                      <div className="flex items-center justify-center gap-1.5">
                        <Calendar size={14} className="text-gray-400" />
                        <span>Session: {student.session}</span>
                      </div>
                    )}
                    {(student.hsc_group || student.department) && (
                      <div className="flex items-center justify-center gap-1.5">
                        <User size={14} className="text-gray-400" />
                        <span>{student.hsc_group || student.department}</span>
                      </div>
                    )}
                    {student.ssc_gpa && (
                      <div className="flex items-center justify-center gap-1.5 font-medium text-green-700">
                        <Award size={14} />
                        <span>SSC GPA: {student.ssc_gpa}</span>
                      </div>
                    )}
                  </div>
                  {subs.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {subs.map((sub) => (
                        <span
                          key={sub}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            sub === subject
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="text-center">
          <p className="text-gray-500">
            Showing {filtered.length} of {students.length} students
          </p>
        </div>
      )}
    </div>
  );
}
