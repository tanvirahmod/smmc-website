import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, Shield, GraduationCap, Eye, EyeOff, Award, BookOpen, Users, Trophy, Calendar } from 'lucide-react';
import { loginTeacher, loginStudent, fetchStudentSessions } from '@/lib/apiClient';
import { useAuth } from '@/lib/auth';
import { useSEO } from '@/lib/useSEO';

const perks = [
  { icon: BookOpen, text: 'Access course materials & results' },
  { icon: Users, text: 'Connect with faculty & staff' },
  { icon: Trophy, text: 'Track your academic progress' },
  { icon: Award, text: 'Stay updated with notices' },
];

export default function Login() {
  const navigate = useNavigate();
  const { loginTeacher: setTeacher, loginStudent: setStudent } = useAuth();
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [program, setProgram] = useState('HSC');
  const [session, setSession] = useState('');
  const [sessions, setSessions] = useState<string[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Session list comes from the database so rolls can repeat across sessions.
  useEffect(() => {
    if (role !== 'student') return;
    let cancelled = false;
    setSessionsLoading(true);
    fetchStudentSessions()
      .then((list) => {
        if (cancelled) return;
        setSessions(list);
        setSession((prev) => (prev && list.includes(prev) ? prev : list[0] || ''));
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  useSEO({
    title: 'Portal Login',
    description: 'Sign in to the Sufia Motin Mohila College portal. Teacher, principal, and student access to profiles, notices, and academic resources.',
    path: '/login',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (role === 'teacher') {
        const teacher = await loginTeacher(loginId, password);
        setTeacher(teacher, password);
        if (teacher.is_principal) {
          navigate('/principal-dashboard');
        } else {
          navigate('/teacher-profile');
        }
      } else {
        if (!session) {
          setError('Please select your session.');
          setLoading(false);
          return;
        }
        const student = await loginStudent(loginId, password, program, session);
        setStudent(student, password);
        navigate('/student-profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 grid-pattern relative py-12 px-4">
      <div className="absolute -top-24 -left-24 w-96 h-96 glow-green rounded-full blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 glow-amber rounded-full blur-3xl" aria-hidden="true" />

      <div className="w-full max-w-4xl relative">
        <div className="card card-elevated overflow-hidden animate-scale-in grid md:grid-cols-2">
          {/* Branding panel */}
          <div className="relative bg-gradient-to-br from-green-700 via-green-800 to-green-950 text-white p-8 md:p-10 flex flex-col justify-between overflow-hidden hidden md:flex">
            <div className="absolute inset-0 hero-pattern opacity-50" aria-hidden="true" />
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-green-500/20 rounded-full blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" aria-hidden="true" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <img
                  src="/logo.png"
                  alt="Sufia Motin Mohila College crest"
                  className="w-12 h-12 rounded-xl object-cover shadow-soft bg-white"
                />
                <div>
                  <p className="font-display font-bold leading-tight">Sufia Motin Mohila College</p>
                  <p className="text-xs text-green-300">Jatrapasha (3351), Baniachong, Habiganj</p>
                </div>
              </div>
              <h2 className="font-display text-2xl lg:text-3xl font-bold leading-tight mb-3 text-balance">
                Welcome to the College Portal
              </h2>
              <p className="text-green-100 leading-relaxed mb-8">
                Sign in to access your academic profile, notices, and college resources.
              </p>
              <ul className="space-y-3.5">
                {perks.map((perk) => {
                  const Icon = perk.icon;
                  return (
                    <li key={perk.text} className="flex items-center gap-3 text-sm text-green-100">
                      <span className="inline-flex p-2 rounded-lg bg-white/10 border border-white/10">
                        <Icon size={16} className="text-amber-300" />
                      </span>
                      {perk.text}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="relative mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-green-300">
                Need help?{' '}
                <a href="mailto:sufiamotinmohilacollege@gmail.com" className="text-amber-300 hover:text-amber-200 font-medium transition-colors">
                  Contact Support
                </a>
              </p>
            </div>
          </div>

          {/* Form panel */}
          <div className="p-8 md:p-10">
            <div className="text-center mb-8 md:hidden">
              <img
                src="/logo.png"
                alt="Sufia Motin Mohila College crest"
                className="w-14 h-14 rounded-2xl object-cover mx-auto mb-4 shadow-soft bg-white"
              />
              <h2 className="font-display text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-500 text-sm mt-1">Sign in to your college portal</p>
            </div>

            <div className="hidden md:block mb-8">
              <h2 className="font-display text-2xl font-bold text-gray-900 mb-1">Welcome Back</h2>
              <p className="text-gray-500 text-sm">
                {role === 'teacher' ? 'Teacher & Principal Portal' : 'Student Portal'}
              </p>
            </div>

            {/* Role Tabs */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-xl" role="tablist">
              <button
                role="tab"
                aria-selected={role === 'teacher'}
                onClick={() => { setRole('teacher'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  role === 'teacher'
                    ? 'bg-white text-green-800 shadow-soft'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <User size={18} />
                Teacher / Principal
              </button>
              <button
                role="tab"
                aria-selected={role === 'student'}
                onClick={() => { setRole('student'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  role === 'student'
                    ? 'bg-white text-green-800 shadow-soft'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <GraduationCap size={18} />
                Student
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-start gap-3 animate-slide-down" role="alert">
                  <Shield size={20} className="flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              <div className="form-group">
                <label className="label" htmlFor="loginId">
                  {role === 'teacher' ? 'Teacher ID' : 'Class Roll Number'}
                </label>
                <div className="relative">
                  {role === 'teacher' ? (
                    <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  ) : (
                    <GraduationCap size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  )}
                  <input
                    id="loginId"
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={role === 'teacher' ? 'Enter your teacher ID (e.g. t001)' : 'Enter your class roll number'}
                    className="input pl-12"
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label" htmlFor="password">
                  {role === 'teacher' ? 'Password' : 'Mobile Number (Password)'}
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={role === 'teacher' ? 'Enter your password' : 'Enter your mobile number'}
                    className="input pl-12 pr-12"
                    required
                    autoComplete={role === 'teacher' ? 'current-password' : 'tel'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {role === 'student' && (
                <>
                  <div className="form-group">
                    <label className="label" htmlFor="program">Program</label>
                    <div className="relative">
                      <GraduationCap size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        id="program"
                        value={program}
                        onChange={(e) => setProgram(e.target.value)}
                        className="select pl-12"
                      >
                        <option value="HSC">HSC</option>
                        <option value="Degree">Degree</option>
                        <option value="Honours">Honours</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label" htmlFor="session">Session</label>
                    <div className="relative">
                      <Calendar size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <select
                        id="session"
                        value={session}
                        onChange={(e) => setSession(e.target.value)}
                        className="select pl-12"
                        required
                        disabled={sessionsLoading || sessions.length === 0}
                      >
                        <option value="" disabled>
                          {sessionsLoading ? 'Loading sessions...' : sessions.length === 0 ? 'No sessions found' : 'Select your session'}
                        </option>
                        {sessions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full mt-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    Sign In
                  </>
                )}
              </button>

              {/* Help Text */}
              {role === 'teacher' && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Shield size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-medium mb-2">Demo Principal Login:</p>
                      <div className="flex flex-col gap-1 text-sm font-mono bg-amber-100 rounded-lg p-2">
                        <code>ID: principal</code>
                        <code>Password: principal123</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {role === 'student' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <GraduationCap size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Student Login Info:</p>
                      <p>Use your <strong>Class Roll Number</strong> as ID and your <strong>Mobile Number</strong> as password.</p>
                      <p className="mt-1">Select your program and session — the same roll number can exist in different sessions.</p>
                    </div>
                  </div>
                </div>
              )}
            </form>

            <p className="text-center text-sm text-gray-500 mt-6 md:hidden">
              Need help?{' '}
              <a href="mailto:sufiamotinmohilacollege@gmail.com" className="text-green-700 hover:underline font-medium">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
