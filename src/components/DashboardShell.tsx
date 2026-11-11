import { useState, useEffect, useRef, type ReactNode } from 'react';
import { ChevronDown, LogOut, Menu, X, type LucideIcon } from 'lucide-react';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional right-aligned count/hint, e.g. number of students. */
  hint?: string;
}

export interface DashboardNavGroup {
  label: string;
  items: DashboardNavItem[];
}

interface DashboardShellProps {
  /** Small badge over the title, e.g. "Principal" / "Teacher" / "Student". */
  roleLabel: string;
  title: string;
  subtitle?: string;
  /** Avatar content (img or icon); rendered inside a fixed-size rounded frame. */
  avatar?: ReactNode;
  /** Extra header chips (designation, subject, program…). Hidden on small screens. */
  meta?: ReactNode;
  navGroups: DashboardNavGroup[];
  activeId: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

// The public navbar above these pages is h-16 on mobile (top bar hidden below
// sm), h-16 + top bar on sm, and h-[4.5rem] + top bar on md+ — sticky elements
// anchor to those heights. The old sm offset (5.75rem) left a visible gap.
const STICKY_TOP = 'top-16 sm:top-[5.5rem] md:top-[6.25rem]';

/**
 * Shared chrome for the three role dashboards (principal, teacher, student):
 * a compact gradient header band, a grouped navigation sidebar on desktop and a
 * sticky section bar with a dropdown drawer on mobile, plus a wide content
 * column so data-heavy panels (exam result sheets) stop feeling cramped.
 */
export default function DashboardShell({
  roleLabel,
  title,
  subtitle,
  avatar,
  meta,
  navGroups,
  activeId,
  onNavigate,
  onLogout,
  children,
}: DashboardShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const activeLabel =
    navGroups.flatMap((g) => g.items).find((i) => i.id === activeId)?.label ?? 'Menu';

  // Dismiss the mobile drawer on outside tap or Escape so it never sits
  // stuck over the page content.
  useEffect(() => {
    if (!drawerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const renderNav = (onSelect?: () => void) => (
    <nav aria-label={`${roleLabel} dashboard sections`} className="space-y-5">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onSelect?.();
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    active
                      ? 'bg-green-700 text-white shadow-soft'
                      : 'text-gray-600 hover:bg-green-50 hover:text-green-800'
                  }`}
                >
                  <Icon size={17} className={active ? 'text-white' : 'text-gray-400'} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.hint !== undefined && (
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header band */}
      <header className="relative bg-gradient-to-br from-green-700 via-green-800 to-green-950 text-white overflow-hidden">
        <div className="absolute inset-0 hero-pattern opacity-50" aria-hidden="true" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-green-500/20 rounded-full blur-3xl" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 relative">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5 min-w-0">
              {avatar && (
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatar}
                </div>
              )}
              <div className="min-w-0">
                <span className="inline-block bg-white/10 border border-white/15 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide text-green-100">
                  {roleLabel}
                </span>
                <h1 className="font-display text-lg md:text-2xl font-bold truncate mt-1">{title}</h1>
                {subtitle && (
                  <p className="text-green-100/90 text-xs md:text-sm truncate">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {meta && <div className="hidden md:flex items-center gap-2">{meta}</div>}
              <button
                onClick={onLogout}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-3.5 sm:px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors flex-shrink-0"
              >
                <LogOut size={15} />
                <span className="hidden min-[420px]:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile section bar + dropdown drawer */}
      <div
        ref={drawerRef}
        className={`lg:hidden sticky ${STICKY_TOP} z-40 bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-soft`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            aria-expanded={drawerOpen}
            className="w-full flex items-center justify-between py-3 min-h-[48px] text-sm font-semibold text-gray-700"
          >
            <span className="flex items-center gap-2 min-w-0">
              {drawerOpen ? (
                <X size={16} className="text-gray-400 flex-shrink-0" />
              ) : (
                <Menu size={16} className="text-green-700 flex-shrink-0" />
              )}
              <span className="truncate">{activeLabel}</span>
            </span>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform ${drawerOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {drawerOpen && (
            <div className="absolute inset-x-3 sm:inset-x-6 top-full mt-1 rounded-2xl bg-white shadow-lift border border-gray-100 p-4 max-h-[65vh] overflow-y-auto animate-slide-down">
              {renderNav(() => setDrawerOpen(false))}
            </div>
          )}
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-8 lg:items-start">
          <aside className="hidden lg:block">
            <div className="sticky top-28 card p-4">{renderNav()}</div>
          </aside>
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
