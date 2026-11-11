import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, BookOpen, Users, Trophy, ArrowRight, Calendar, GraduationCap,
  Megaphone, ClipboardList, Building2, Phone, Mail, ChevronRight,
  Landmark, Target, Eye,
} from 'lucide-react';
import { fetchNotices, Notice } from '@/lib/apiClient';
import { DEPARTMENT_NAV } from '@/lib/departments';
import { useSEO } from '@/lib/useSEO';

const stats = [
  { icon: Users, value: '5,000+', label: 'Alumni Network' },
  { icon: BookOpen, value: '120+', label: 'Faculty Members' },
  { icon: Trophy, value: '98.5%', label: 'Pass Rate' },
  { icon: Award, value: '25+', label: 'Years of Excellence' },
];

const values = [
  { icon: Target, title: 'Our Mission', desc: 'Quality, affordable education for women — combining strong academics with character, discipline and confidence.' },
  { icon: Eye, title: 'Our Vision', desc: 'A leading women’s college whose graduates lead in education, administration and public life.' },
  { icon: Landmark, title: 'Our Values', desc: 'Integrity in examinations, respect in the classroom, and service to community and country.' },
];

const noticeCategoryBadge: Record<string, string> = {
  admission: 'badge-blue',
  exam: 'badge-red',
  result: 'badge-primary',
  holiday: 'badge-accent',
  general: 'badge-secondary',
};

function formatDayMonth(dateStr: string): { day: string; mon: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: '—', mon: '' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

export default function Home() {
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [tickerNotices, setTickerNotices] = useState<Notice[]>([]);

  useSEO({
    title: 'HSC, Degree & Honours Programs',
    description: "Sufia Motin Mohila College is a premier women's college in Jatrapasha (3351), Baniachong, Habiganj. Offering HSC, Degree, Honours & Masters programs since 2000 with a 98.5% pass rate.",
    path: '/',
  });

  useEffect(() => {
    fetchNotices()
      .then((data) => {
        setNotices(data.slice(0, 5));
        setTickerNotices(data.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  const services = [
    { icon: Megaphone, title: 'Notice Board', desc: 'Routines, results & announcements', to: '/notices' },
    { icon: Building2, title: 'Departments', desc: 'Honours & Degree programs', to: '/departments/honours-english' },
    { icon: Users, title: 'Our Teachers', desc: 'Faculty directory', to: '/teachers' },
    { icon: ClipboardList, title: 'Student Portal', desc: 'Profile, results & records', to: '/login' },
  ];

  return (
    <div>
      {/* Notice ticker */}
      {tickerNotices.length > 0 && (
        <div className="bg-green-950 text-white overflow-hidden" role="marquee" aria-label="Latest notices">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-stretch gap-0">
            <span className="flex items-center gap-2 bg-red-700 text-white text-xs font-bold uppercase tracking-wide px-3 sm:px-4 py-2.5 flex-shrink-0">
              <Megaphone size={14} />
              <span className="hidden sm:inline">Notices</span>
            </span>
            <div className="relative flex-1 overflow-hidden">
              <div className="animate-marquee flex items-center gap-10 whitespace-nowrap py-2.5 text-sm w-max">
                {[...tickerNotices, ...tickerNotices].map((n, i) => (
                  <button
                    key={`${n.id}-${i}`}
                    onClick={() => navigate('/notices')}
                    className="hover:text-amber-300 transition-colors"
                    tabIndex={i < tickerNotices.length ? 0 : -1}
                    aria-hidden={i >= tickerNotices.length}
                  >
                    <span className="text-amber-400 mr-2">◆</span>
                    {n.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative hero-gradient text-white overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-60" aria-hidden="true" />
        <div className="absolute inset-0" aria-hidden="true">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 glow-green rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 glow-amber rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24 md:pt-20 md:pb-36">
          <div className="grid lg:grid-cols-[1fr_380px] gap-10 lg:gap-12 items-center">
            <div className="animate-fade-in">
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm backdrop-blur-sm border border-white/10">
                  <span className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                  Established 2000
                </span>
                <span className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm backdrop-blur-sm border border-white/10">
                  National University & BISE Sylhet
                </span>
              </div>
              <p className="text-green-200 font-semibold tracking-wide text-sm md:text-base mb-2 uppercase">
                Jatrapasha (3351), Baniachong, Habiganj — Women’s College
              </p>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] mb-5 text-balance">
                Sufia Motin
                <br />
                Mohila College
              </h1>
              <p className="text-lg text-green-100 mb-8 leading-relaxed max-w-2xl">
                Higher Secondary, Degree (Pass), Honours and Masters programs —
                shaping confident, capable leaders for over 25 years.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="group bg-white text-green-800 px-8 py-4 rounded-xl font-semibold text-base hover:bg-green-50 transition-all duration-200 shadow-lift flex items-center justify-center gap-3"
                >
                  <span>Apply for Admission</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => navigate('/notices')}
                  className="group border-2 border-white/30 text-white px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/10 hover:border-white/50 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-sm"
                >
                  <Megaphone size={20} />
                  <span>Notice Board</span>
                </button>
              </div>
            </div>

            {/* Online services panel */}
            <div className="animate-slide-up">
              <div className="bg-white rounded-2xl shadow-lift overflow-hidden">
                <div className="bg-green-950 px-5 py-3.5 flex items-center gap-2">
                  <ClipboardList size={18} className="text-amber-300" />
                  <h2 className="font-display font-bold text-white">Online Services</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {services.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.title}
                        onClick={() => navigate(s.to)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-green-50/60 transition-colors group"
                      >
                        <span className="inline-flex p-2.5 rounded-xl bg-green-50 text-green-700 group-hover:bg-green-700 group-hover:text-white transition-all">
                          <Icon size={20} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold text-gray-900">{s.title}</span>
                          <span className="block text-sm text-gray-500 truncate">{s.desc}</span>
                        </span>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-green-700 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-50 to-transparent" />
      </section>

      {/* Stats band */}
      <section className="bg-white border-b border-gray-100 -mt-16 relative z-10 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className={`text-center animate-slide-up ${i > 0 ? 'md:border-l md:border-gray-100' : ''}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="inline-flex bg-green-50 text-green-700 p-3 rounded-2xl mb-4 shadow-sm">
                    <Icon size={28} />
                  </div>
                  <div className="font-display text-3xl md:text-4xl font-bold text-gray-900 leading-tight">{stat.value}</div>
                  <div className="text-sm text-gray-500 mt-1 font-medium">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About / mission */}
      <section className="section bg-gray-50 grid-pattern relative" aria-labelledby="about-heading">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            <div>
              <span className="inline-flex items-center gap-2 text-green-700 font-semibold text-sm mb-3">
                <span className="w-8 h-px bg-green-600" />
                ABOUT THE COLLEGE
              </span>
              <h2 id="about-heading" className="font-display text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-4 text-balance">
                Six Decades of Women’s Education in Baniachong, Habiganj
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Sufia Motin Mohila College, Jatrapasha (3351), Baniachong, has served the women of Habiganj since 2000 —
                from Higher Secondary through Degree (Pass), Honours and Masters programs under the
                National University and BISE Sylhet.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Our graduates teach in classrooms across the country, serve in administration and the
                development sector, and lead in their communities — carrying the college’s name with them.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button onClick={() => navigate('/teachers')} className="btn-outline">
                  <Users size={18} />
                  Meet Our Faculty
                </button>
                <button onClick={() => navigate('/notices')} className="btn-secondary">
                  <Calendar size={18} />
                  Notices & Routines
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {values.map((v, i) => {
                const Icon = v.icon;
                return (
                  <article
                    key={i}
                    className="card p-5 sm:p-6 flex gap-4 animate-slide-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="inline-flex bg-green-700 text-white p-3 rounded-xl h-fit shadow-sm flex-shrink-0">
                      <Icon size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold text-gray-900 mb-1">{v.title}</h3>
                      <p className="text-gray-600 text-sm leading-relaxed">{v.desc}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Departments */}
      <section className="section bg-white" aria-labelledby="departments-heading">
        <div className="container">
          <div className="section-header">
            <span className="inline-flex items-center gap-2 text-green-700 font-semibold text-sm mb-4 animate-fade-in">
              <span className="w-8 h-px bg-green-600" />
              ACADEMICS
              <span className="w-8 h-px bg-green-600" />
            </span>
            <h2 id="departments-heading" className="section-title">Our Departments</h2>
            <p className="section-subtitle">
              Honours and Degree (Pass) programs — open a department for curriculum,
              careers, faculty and department notices.
            </p>
          </div>
          {DEPARTMENT_NAV.map((section) => (
            <div key={section.group} className="mb-8 last:mb-0">
              <h3 className="font-display text-lg font-bold text-gray-800 mb-4 flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-700 text-white uppercase tracking-wide">
                  {section.group}
                </span>
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {section.items.map((item, i) => (
                  <button
                    key={item.slug}
                    onClick={() => navigate(`/departments/${item.slug}`)}
                    className="card card-interactive p-5 sm:p-6 text-left animate-slide-up group"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex p-2.5 rounded-xl bg-green-50 text-green-700 group-hover:bg-green-700 group-hover:text-white transition-all">
                        <GraduationCap size={22} />
                      </span>
                      <span className="font-display text-lg font-bold text-gray-900">
                        {section.group === 'Honours' ? `Honours in ${item.label}` : `Degree ${item.label}`}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 mt-2">
                      Explore department
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notice board preview */}
      <section className="section bg-gray-50 grid-pattern relative" aria-labelledby="notices-heading">
        <div className="container">
          <div className="grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-12">
            <div>
              <span className="inline-flex items-center gap-2 text-green-700 font-semibold text-sm mb-3">
                <span className="w-8 h-px bg-green-600" />
                NOTICE BOARD
              </span>
              <h2 id="notices-heading" className="font-display text-3xl font-bold text-gray-900 mb-6">Latest Announcements</h2>
              {notices.length === 0 ? (
                <div className="card p-10 text-center">
                  <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">No notices at the moment. Check back later.</p>
                </div>
              ) : (
                <div className="card divide-y divide-gray-100 overflow-hidden">
                  {notices.map((notice) => {
                    const { day, mon } = formatDayMonth(notice.published_date);
                    return (
                      <button
                        key={notice.id}
                        onClick={() => navigate('/notices')}
                        className="w-full flex items-center gap-4 px-4 sm:px-5 py-4 text-left hover:bg-green-50/60 transition-colors group"
                      >
                        <span className="flex-shrink-0 w-14 text-center bg-green-700 text-white rounded-xl py-2 shadow-sm">
                          <span className="block font-display text-xl font-bold leading-none">{day}</span>
                          <span className="block text-[11px] uppercase tracking-wide text-green-100">{mon}</span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`${noticeCategoryBadge[notice.category] || noticeCategoryBadge.general}`}>
                              {notice.category.charAt(0).toUpperCase() + notice.category.slice(1)}
                            </span>
                          </span>
                          <span className="block font-semibold text-gray-900 line-clamp-1">{notice.title}</span>
                          <span className="block text-sm text-gray-500 line-clamp-1">{notice.content}</span>
                        </span>
                        <ChevronRight size={18} className="text-gray-300 group-hover:text-green-700 group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Contact card */}
            <div className="lg:pt-[52px]">
              <div className="card card-elevated overflow-hidden lg:sticky lg:top-28">
                <div className="bg-green-950 px-5 py-4">
                  <h3 className="font-display font-bold text-white">College Office</h3>
                  <p className="text-xs text-green-200 mt-0.5">Admission & general queries</p>
                </div>
                <div className="p-5 space-y-4 text-sm">
                  <a href="tel:01716584863" className="flex items-center gap-3 text-gray-700 hover:text-green-800 transition-colors">
                    <span className="inline-flex p-2.5 rounded-xl bg-green-50 text-green-700 flex-shrink-0">
                      <Phone size={18} />
                    </span>
                    <span className="font-semibold">01716-584863</span>
                  </a>
                  <a href="mailto:sufiamotinmohilacollege@gmail.com" className="flex items-center gap-3 text-gray-700 hover:text-green-800 transition-colors">
                    <span className="inline-flex p-2.5 rounded-xl bg-green-50 text-green-700 flex-shrink-0">
                      <Mail size={18} />
                    </span>
                    <span className="font-semibold break-all">sufiamotinmohilacollege@gmail.com</span>
                  </a>
                  <button onClick={() => navigate('/login')} className="btn-primary w-full">
                    <GraduationCap size={18} />
                    Apply for Admission
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section bg-green-950 text-white relative overflow-hidden" aria-labelledby="join-heading">
        <div className="absolute inset-0 hero-pattern opacity-50" aria-hidden="true" />
        <div className="relative max-w-3xl mx-auto text-center px-4 animate-fade-in">
          <h2 id="join-heading" className="font-display text-3xl md:text-4xl font-bold mb-4 text-balance">Admission Open 2026</h2>
          <p className="text-green-100 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            HSC, Degree (Pass), Honours and Masters — take the first step towards your future.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="bg-white text-green-900 px-8 py-4 rounded-xl font-semibold text-base hover:bg-green-50 transition-all duration-200 shadow-lift flex items-center justify-center gap-3"
            >
              Apply Now
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => navigate('/departments/honours-english')}
              className="border-2 border-white/30 px-8 py-4 rounded-xl font-semibold text-base hover:bg-white/10 hover:border-white/50 transition-all duration-200 flex items-center justify-center gap-3 backdrop-blur-sm"
            >
              Explore Departments
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
