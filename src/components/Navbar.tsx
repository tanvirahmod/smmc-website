import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X, Home, FileText, Users, LogIn, LogOut, BookOpen, UserRound, ChevronDown, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { DEPARTMENT_NAV } from '@/lib/departments';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [mobileDeptOpen, setMobileDeptOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const deptRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { teacher, student, logout } = useAuth();
  const onDepartmentsPage = location.pathname.startsWith('/departments');

  const role = teacher?.is_principal ? 'principal' : teacher ? 'teacher' : student ? 'student' : null;
  const profileTo = role === 'principal' ? '/principal-dashboard' : role === 'teacher' ? '/teacher-profile' : role === 'student' ? '/student-profile' : '/login';
  const displayName = teacher
    ? teacher.full_name || teacher.teacher_id
    : student
      ? student.full_name || student.class_roll || student.student_id
      : '';
  const roleLabel = role === 'principal' ? 'Principal' : role === 'teacher' ? 'Teacher' : role === 'student' ? 'Student' : '';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close the account menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen && !deptOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (deptRef.current && !deptRef.current.contains(e.target as Node)) setDeptOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setDeptOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen, deptOpen]);

  // Close the departments menu on navigation.
  useEffect(() => {
    setDeptOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    setMobileOpen(false);
    logout();
    navigate('/');
  };

  const links = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/notices', label: 'Notice Board', icon: FileText },
    { to: '/teachers', label: 'Our Teachers', icon: Users },
  ];

  const allLinks = role === 'teacher'
    ? [...links, { to: '/teacher-profile?tab=students', label: 'My Students', icon: BookOpen }]
    : links;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl shadow-lift border-b border-gray-100'
          : 'bg-white shadow-soft'
      }`}
    >
      {/* Top bar */}
      <div className="bg-green-950 text-white text-xs py-1.5 px-4 hidden sm:block">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-soft" />
            Sufia Motin Mohila College, Jatrapasha (3351), Baniachong, Habiganj
          </span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="hidden lg:inline">Phone:</span>
              <a href="tel:01716584863" className="hover:text-green-300 hover:underline underline-offset-2 transition-colors">01716-584863</a>
            </span>
            <span className="flex items-center gap-1">
              <span className="hidden lg:inline">Email:</span>
              <a href="mailto:sufiamotinmohilacollege@gmail.com" className="hover:text-green-300 hover:underline underline-offset-2 transition-colors">sufiamotinmohilacollege@gmail.com</a>
            </span>
          </span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex items-center justify-between h-16 md:h-[4.5rem]">
          <Link
            to="/"
            className="flex items-center gap-3 cursor-pointer group"
            aria-label="Sufia Motin Mohila College - Home"
          >
            <div className="relative flex-shrink-0">
              <img
                src="/logo.png"
                alt="Sufia Motin Mohila College crest"
                className="w-11 h-11 md:w-12 md:h-12 rounded-xl object-cover shadow-soft group-hover:shadow-lift group-hover:scale-105 transition-all duration-300 bg-white"
              />
            </div>
            <div className="text-left">
              <span className="font-display text-lg md:text-xl font-bold text-gray-900 leading-tight">Sufia Motin Mohila College</span>
              <p className="text-xs text-gray-500 hidden sm:block">Jatrapasha (3351), Baniachong, Habiganj</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {allLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-green-700 text-white shadow-soft'
                        : 'text-gray-600 hover:bg-green-50 hover:text-green-800'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={16} />
                      <span>{link.label}</span>
                      {isActive && (
                        <span
                          className="absolute -bottom-[1.35rem] left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-green-500 to-amber-400 rounded-full"
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
            {/* Departments dropdown */}
            <div className="relative" ref={deptRef}>
              <button
                onClick={() => setDeptOpen(!deptOpen)}
                aria-expanded={deptOpen}
                aria-haspopup="menu"
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  onDepartmentsPage
                    ? 'bg-green-700 text-white shadow-soft'
                    : 'text-gray-600 hover:bg-green-50 hover:text-green-800'
                }`}
              >
                <Building2 size={16} />
                <span>Departments</span>
                <ChevronDown size={14} className={`transition-transform ${deptOpen ? 'rotate-180' : ''}`} />
                {onDepartmentsPage && (
                  <span
                    className="absolute -bottom-[1.35rem] left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-green-500 to-amber-400 rounded-full"
                    aria-hidden="true"
                  />
                )}
              </button>
              {deptOpen && (
                <div
                  role="menu"
                  className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-lift border border-gray-100 p-2 animate-scale-in"
                >
                  {DEPARTMENT_NAV.map((section) => (
                    <div key={section.group} className="mb-1 last:mb-0">
                      <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {section.group}
                      </p>
                      {section.items.map((item) => (
                        <Link
                          key={item.slug}
                          to={`/departments/${item.slug}`}
                          role="menuitem"
                          onClick={() => setDeptOpen(false)}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
                        >
                          <GraduationCap size={18} className="text-gray-400" />
                          {section.group === 'Honours' ? `Honours in ${item.label}` : `Degree ${item.label}`}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Desktop CTA + Toggle */}
          <div className="flex items-center gap-2">
            {role ? (
              <div className="hidden sm:block relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 bg-green-700 text-white pl-2 pr-3 py-1.5 rounded-xl font-semibold text-sm hover:bg-green-800 hover:shadow-lift transition-all duration-200 shadow-soft"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/15 border border-white/10 flex items-center justify-center font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate">{displayName}</span>
                  <ChevronDown size={16} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lift border border-gray-100 p-2 animate-scale-in"
                  >
                    <p className="px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {roleLabel} Account
                    </p>
                    <Link
                      to={profileTo}
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-800 transition-colors"
                    >
                      <UserRound size={18} />
                      My Profile
                    </Link>
                    <button
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                to="/login"
                className="hidden sm:flex items-center gap-2 bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-800 hover:shadow-lift transition-all duration-200 shadow-soft"
              >
                <LogIn size={16} />
                Login
              </NavLink>
            )}
            <button
              className="lg:hidden p-2 text-gray-600 hover:bg-green-50 hover:text-green-800 rounded-xl transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div
            id="mobile-nav"
            className="lg:hidden border-t border-gray-100 bg-white/95 backdrop-blur-xl animate-slide-down py-2 shadow-lift"
            role="navigation"
          >
            {allLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 w-full px-4 py-3.5 text-left text-base font-medium rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-green-50 text-green-800 shadow-sm'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`inline-flex p-2 rounded-lg transition-colors ${
                          isActive ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <Icon size={18} />
                      </span>
                      {link.label}
                      {isActive && <span className="ml-auto w-2 h-2 rounded-full bg-green-600" aria-hidden="true" />}
                    </>
                  )}
                </NavLink>
              );
            })}
            {/* Mobile departments expander */}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={() => setMobileDeptOpen(!mobileDeptOpen)}
                aria-expanded={mobileDeptOpen}
                className={`flex items-center gap-3 w-full px-4 py-3.5 text-left text-base font-medium rounded-xl transition-all duration-200 ${
                  onDepartmentsPage ? 'bg-green-50 text-green-800 shadow-sm' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span
                  className={`inline-flex p-2 rounded-lg transition-colors ${
                    onDepartmentsPage ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Building2 size={18} />
                </span>
                Departments
                <ChevronDown size={18} className={`ml-auto text-gray-400 transition-transform ${mobileDeptOpen ? 'rotate-180' : ''}`} />
              </button>
              {mobileDeptOpen && (
                <div className="pb-1 animate-slide-down">
                  {DEPARTMENT_NAV.map((section) => (
                    <div key={section.group}>
                      <p className="px-4 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {section.group}
                      </p>
                      {section.items.map((item) => (
                        <NavLink
                          key={item.slug}
                          to={`/departments/${item.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-3 w-full pl-8 pr-4 py-3 text-left text-[15px] font-medium rounded-xl transition-all duration-200 ${
                              isActive ? 'bg-green-50 text-green-800' : 'text-gray-600 hover:bg-gray-50'
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {section.group === 'Honours' ? `Honours in ${item.label}` : `Degree ${item.label}`}
                              {isActive && (
                                <span className="ml-auto w-2 h-2 rounded-full bg-green-600" aria-hidden="true" />
                              )}
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-4 pt-2 pb-4 border-t border-gray-100 mt-2">
              {role ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 px-1 py-1">
                    <span className="w-10 h-10 rounded-xl bg-green-700 text-white flex items-center justify-center font-bold text-lg">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500">{roleLabel} Account</p>
                    </div>
                  </div>
                  <NavLink
                    to={profileTo}
                    onClick={() => setMobileOpen(false)}
                    className="w-full flex items-center justify-center gap-2 bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 transition-all duration-200 shadow-soft"
                  >
                    <UserRound size={18} />
                    My Profile
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl font-semibold hover:bg-red-100 transition-all duration-200"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </div>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full flex items-center justify-center gap-2 bg-green-700 text-white py-3 rounded-xl font-semibold hover:bg-green-800 transition-all duration-200 shadow-soft"
                >
                  <LogIn size={18} />
                  Login to Portal
                </NavLink>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
