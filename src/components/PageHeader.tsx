import type { ReactNode } from 'react';

interface PageHeaderProps {
  badge: string;
  badgeIcon?: ReactNode;
  title: string;
  subtitle: string;
  meta?: ReactNode;
}

export default function PageHeader({ badge, badgeIcon, title, subtitle, meta }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-900 to-green-950 text-white">
      <div className="absolute inset-0 hero-pattern opacity-70" aria-hidden="true" />
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-green-500/20 rounded-full blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-amber-500/10 rounded-full blur-3xl" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" aria-hidden="true" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="max-w-3xl animate-fade-in">
          <span className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm mb-4 backdrop-blur-sm border border-white/10">
            {badgeIcon}
            {badge}
          </span>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-4 text-balance">
            {title}
          </h1>
          <p className="text-lg text-green-100 leading-relaxed max-w-2xl">{subtitle}</p>
          {meta && (
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-green-200">
              {meta}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
