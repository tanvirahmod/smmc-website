import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GraduationCap, BookOpen, Briefcase, Users, ArrowRight, Clock, Award, Phone, CalendarDays } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import NotFound from '@/pages/NotFound';
import { DEPARTMENTS } from '@/lib/departments';
import { fetchTeachers, fetchNotices, fetchDepartmentStaff, type Teacher, type Notice, type DepartmentStaff } from '@/lib/apiClient';
import { useSEO } from '@/lib/useSEO';

/** "2023-07-01" -> "1 Jul 2023"; passes through anything unparseable. */
function formatJoiningDate(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Compact teacher card with photo (or initial) for department member grids. */
function TeacherMiniCard({ teacher }: { teacher: Teacher }) {  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-2xl">
      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-green-600 to-green-800 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
        {teacher.profile_pic_url ? (
          <img
            src={teacher.profile_pic_url}
            alt={teacher.full_name || teacher.teacher_id}
            className="w-full h-full object-cover"
          />
        ) : (
          (teacher.full_name || teacher.teacher_id).charAt(0).toUpperCase()
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 truncate">{teacher.full_name || 'Profile not updated'}</p>
        {teacher.designation && (
          <p className="text-xs text-green-700 font-medium truncate">{teacher.designation}</p>
        )}
        <p className="text-xs text-gray-500 truncate">
          {teacher.subject || ''}
          {teacher.subject && teacher.teacher_id ? ' · ' : ''}{teacher.teacher_id}
        </p>
        {teacher.mobile_number && (
          <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
            <Phone size={11} className="flex-shrink-0" />
            <a href={`tel:${teacher.mobile_number}`} className="hover:text-green-700 hover:underline">
              {teacher.mobile_number}
            </a>
          </p>
        )}
        {teacher.joining_date && (
          <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
            <CalendarDays size={11} className="flex-shrink-0" />
            Joined {formatJoiningDate(teacher.joining_date)}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DepartmentPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const dept = DEPARTMENTS[slug];
  const [faculty, setFaculty] = useState<Teacher[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(true);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [deptStaff, setDeptStaff] = useState<DepartmentStaff[]>([]);
  const [deptNotices, setDeptNotices] = useState<Notice[]>([]);
  const [mainNotices, setMainNotices] = useState<Notice[]>([]);
  const [loadingNotices, setLoadingNotices] = useState(true);

  useSEO({
    title: dept ? `${dept.title} | ${dept.group}` : 'Department',
    description: dept
      ? `${dept.title} at Sufia Motin Mohila College, Jatrapasha (3351), Baniachong, Habiganj. ${dept.tagline}`
      : 'College department page.',
    path: `/departments/${slug}`,
  });

  useEffect(() => {
    if (!dept) {
      setLoadingFaculty(false);
      setLoadingNotices(false);
      return;
    }
    let cancelled = false;
    setLoadingFaculty(true);
    setLoadingNotices(true);
    fetchTeachers()
      .then((teachers) => {
        if (cancelled) return;
        setAllTeachers(teachers.filter((t) => !t.is_principal));
        const wanted = new Set(dept.teacherSubjects.map((s) => s.toLowerCase()));
        setFaculty(teachers.filter((t) => !t.is_principal && t.subject && wanted.has(t.subject.toLowerCase())));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingFaculty(false);
      });
    Promise.all([fetchDepartmentStaff(slug), fetchNotices(slug), fetchNotices()])
      .then(([staff, deptNs, mainNs]) => {
        if (cancelled) return;
        setDeptStaff(staff);
        setDeptNotices(deptNs);
        setMainNotices(mainNs.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingNotices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dept, slug]);

  if (!dept) return <NotFound />;

  const teacherById = new Map(allTeachers.map((t) => [t.teacher_id, t]));
  const headAssignment = deptStaff.find((r) => r.role === 'head');
  const memberAssignments = deptStaff.filter((r) => r.role === 'member');
  const headTeacher = headAssignment ? teacherById.get(headAssignment.teacher_id) : undefined;
  const memberTeachers = memberAssignments
    .map((r) => teacherById.get(r.teacher_id))
    .filter((t): t is Teacher => !!t);
  // Before the principal assigns staff, fall back to subject-matched faculty.
  const showFallbackFaculty = deptStaff.length === 0;

  return (
    <div>
      <PageHeader
        badge={`${dept.group} Department`}
        badgeIcon={<GraduationCap size={16} />}
        title={dept.title}
        subtitle={dept.tagline}
        meta={
          <>
            <span className="flex items-center gap-1">
              <Clock size={16} />
              {dept.duration}
            </span>
            <span className="flex items-center gap-1">
              <Award size={16} />
              {dept.affiliation}
            </span>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12 -mt-6 relative z-10">
        {/* About */}
        <div className="card card-elevated p-6 md:p-8 mb-8 animate-fade-in">
          <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900 mb-4">About the Program</h2>
          <div className="space-y-4 text-gray-600 leading-relaxed">
            {dept.about.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        {/* Curriculum highlights */}
        <div className="mb-8">
          <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900 mb-5">What You Will Study</h2>
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {dept.highlights.map((h, i) => (
              <article
                key={i}
                className="card card-interactive p-5 sm:p-6 animate-slide-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="inline-flex bg-green-50 text-green-700 p-2.5 rounded-xl mb-3">
                  <BookOpen size={22} />
                </div>
                <h3 className="font-display text-lg font-bold text-gray-900 mb-1.5">{h.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{h.desc}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Careers + Faculty */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
          <div className="card p-6 md:p-8">
            <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase size={20} className="text-green-700" />
              Career Prospects
            </h2>
            <ul className="space-y-3">
              {dept.careers.map((career) => (
                <li key={career} className="flex items-start gap-3 text-gray-700">
                  <span className="w-1.5 h-1.5 bg-green-600 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-sm sm:text-base">{career}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card overflow-hidden md:p-0">
            <div className="p-6 md:p-8 pb-0">
              <h2 className="font-display text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={20} className="text-green-700" />
                Department Leadership
              </h2>
            </div>
            {loadingFaculty ? (
              <div className="p-6 md:p-8 pt-0 space-y-3" role="status">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {headTeacher ? (
                  <div className="px-6 md:px-8">
                    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-green-700 via-green-800 to-green-950 text-white text-center px-6 pt-8 pb-6">
                      <div className="absolute inset-0 hero-pattern opacity-40" aria-hidden="true" />
                      <span className="relative inline-block bg-amber-400 text-amber-950 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4">
                        Department Head
                      </span>
                      <div className="relative w-28 h-28 rounded-full border-4 border-white/80 overflow-hidden mx-auto mb-4 shadow-lift bg-white/15 flex items-center justify-center">
                        {headTeacher.profile_pic_url ? (
                          <img
                            src={headTeacher.profile_pic_url}
                            alt={headTeacher.full_name || headTeacher.teacher_id}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-4xl font-bold">
                            {(headTeacher.full_name || headTeacher.teacher_id).charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <h3 className="relative font-display text-xl md:text-2xl font-bold break-words">
                        {headTeacher.full_name || 'Profile not updated'}
                      </h3>
                      {headTeacher.designation && (
                        <p className="relative text-green-200 font-medium mt-1">{headTeacher.designation}</p>
                      )}
                      <div className="relative mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                        {headTeacher.subject && (
                          <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                            {headTeacher.subject}
                          </span>
                        )}
                        <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                          ID: {headTeacher.teacher_id}
                        </span>
                      </div>
                      {headTeacher.email && (
                        <p className="relative text-green-100/80 text-xs mt-2 break-all">{headTeacher.email}</p>
                      )}
                      {(headTeacher.mobile_number || headTeacher.joining_date) && (
                        <div className="relative mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                          {headTeacher.mobile_number && (
                            <a
                              href={`tel:${headTeacher.mobile_number}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 hover:bg-white/25 transition-colors"
                            >
                              <Phone size={13} />
                              {headTeacher.mobile_number}
                            </a>
                          )}
                          {headTeacher.joining_date && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/20">
                              <CalendarDays size={13} />
                              Joined {formatJoiningDate(headTeacher.joining_date)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-6 md:px-8">
                    <p className="text-gray-500 text-sm bg-gray-50 rounded-xl px-4 py-3 text-center">
                      Department head will be announced soon.
                    </p>
                  </div>
                )}

                <div className="p-6 md:p-8">
                  <h3 className="font-semibold text-gray-800 mb-3">Department Teachers</h3>
                  {showFallbackFaculty ? (
                    faculty.length === 0 ? (
                      <p className="text-gray-500 text-sm">
                        Faculty profiles for this department are being updated. Visit the{' '}
                        <button onClick={() => navigate('/teachers')} className="text-green-700 font-medium hover:underline">
                          Our Teachers
                        </button>{' '}
                        page for the full directory.
                      </p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {faculty.map((t) => (
                          <TeacherMiniCard key={t.id} teacher={t} />
                        ))}
                      </div>
                    )
                  ) : memberTeachers.length === 0 ? (
                    <p className="text-gray-500 text-sm">No other teachers assigned yet.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {memberTeachers.map((t) => (
                        <TeacherMiniCard key={t.id} teacher={t} />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notices */}
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
          <div className="card p-6 md:p-8">
            <h2 className="font-display text-xl font-bold text-gray-900 mb-1">Department Notices</h2>
            <p className="text-sm text-gray-500 mb-4">Published by the {dept.title} staff.</p>
            {loadingNotices ? (
              <div className="space-y-3" role="status">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : deptNotices.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No department notices yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto overscroll-contain">
                {deptNotices.map((n) => (
                  <article key={n.id} className="p-4 bg-teal-50/60 border border-teal-100 rounded-xl">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 break-words">{n.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-3 break-words">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {n.author ? `${n.author} · ` : ''}
                      {new Date(n.published_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="card p-6 md:p-8">
            <h2 className="font-display text-xl font-bold text-gray-900 mb-1">College Notice Board</h2>
            <p className="text-sm text-gray-500 mb-4">Latest from the main board.</p>
            {loadingNotices ? (
              <div className="space-y-3" role="status">
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : mainNotices.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No college notices yet.</p>
            ) : (
              <div className="space-y-3">
                {mainNotices.map((n) => (
                  <article key={n.id} className="p-4 bg-gray-50 rounded-xl">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 break-words">{n.title}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2 break-words">{n.content}</p>
                  </article>
                ))}
                <button onClick={() => navigate('/notices')} className="btn-outline w-full">
                  View All Notices
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="card p-6 md:p-8 bg-green-950 text-white border-green-900 text-center">
          <h2 className="font-display text-xl md:text-2xl font-bold mb-2">Interested in {dept.title}?</h2>
          <p className="text-green-100 text-sm sm:text-base mb-6 max-w-xl mx-auto">
            Admissions follow the National University circular. Contact the college office for seats, deadlines and requirements.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/login')} className="btn-primary btn-lg bg-white text-green-900 hover:bg-green-50">
              <GraduationCap size={18} />
              Apply for Admission
            </button>
            <button onClick={() => navigate('/teachers')} className="border-2 border-white/30 px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/10 hover:border-white/50 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-sm">
              Meet Our Faculty
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
