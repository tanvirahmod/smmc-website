import { useEffect, useState } from 'react';
import {
  Calendar, Tag, ChevronRight, Search, X,
  Megaphone, GraduationCap, Award, Sun,
} from 'lucide-react';
import { fetchNotices, Notice } from '@/lib/apiClient';
import PageHeader from '@/components/PageHeader';
import { useSEO } from '@/lib/useSEO';

const categoryIcons: Record<string, typeof Megaphone> = {
  admission: GraduationCap,
  exam: Calendar,
  result: Award,
  holiday: Sun,
  general: Megaphone,
};

const categoryAccent: Record<string, string> = {
  admission: 'border-l-blue-500',
  exam: 'border-l-red-500',
  result: 'border-l-green-500',
  holiday: 'border-l-amber-500',
  general: 'border-l-gray-400',
};

const categoryBadge: Record<string, string> = {
  admission: 'bg-blue-50 text-blue-700 border-blue-100',
  exam: 'bg-red-50 text-red-700 border-red-100',
  result: 'bg-green-50 text-green-700 border-green-100',
  holiday: 'bg-amber-50 text-amber-700 border-amber-100',
  general: 'bg-gray-50 text-gray-700 border-gray-100',
};

export default function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeClass, setActiveClass] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useSEO({
    title: 'Notice Board & Announcements',
    description: 'Stay updated with the latest college notices, examination schedules, admission circulars, and important announcements from Sufia Motin Mohila College.',
    path: '/notices',
  });

  useEffect(() => {
    fetchNotices()
      .then(setNotices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', 'admission', 'exam', 'result', 'holiday', 'general'];
  const classes = ['all', 'HSC', 'Degree', 'Honours'];

  const filtered = notices.filter((n) => {
    const matchSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || n.category === activeCategory;
    const matchClass = activeClass === 'all' || n.class === activeClass || (!n.class && activeClass === 'all');
    return matchSearch && matchCat && matchClass;
  });

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return d;
    }
  };

  const hasActiveFilters = activeCategory !== 'all' || activeClass !== 'all';

  const clearAll = () => {
    setSearch('');
    setActiveCategory('all');
    setActiveClass('all');
  };

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <PageHeader
        badge="Notice Board"
        badgeIcon={<Megaphone size={16} />}
        title="College Notices & Announcements"
        subtitle="Stay updated with the latest announcements, examination schedules, admission notices, and important circulars."
        meta={
          <>
            <span className="flex items-center gap-1">
              <Calendar size={16} />
              {notices.length} total notices
            </span>
            <span className="flex items-center gap-1">
              <Tag size={16} />
              {categories.length - 1} categories
            </span>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        {/* Search and Filter */}
        <div className="card card-elevated p-6 mb-8 animate-fade-in">
          {/* Search */}
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notices by title or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 shadow-sm transition-all"
              aria-label="Search notices"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                aria-label="Clear search"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Filter groups */}
          <div className="mt-6 space-y-4">
            {/* Category */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <span className="text-sm font-semibold text-gray-500 flex items-center gap-2 flex-shrink-0 md:w-28">
                <Tag size={16} className="text-gray-400" />
                Category
              </span>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    aria-pressed={activeCategory === cat}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                      activeCategory === cat
                        ? 'bg-green-700 text-white border-green-700 shadow-soft'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-green-50 hover:border-green-200 hover:text-green-800'
                    }`}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Program */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <span className="text-sm font-semibold text-gray-500 flex items-center gap-2 flex-shrink-0 md:w-28">
                <GraduationCap size={16} className="text-gray-400" />
                Program
              </span>
              <div className="flex flex-wrap gap-2">
                {classes.map((cls) => (
                  <button
                    key={cls}
                    onClick={() => setActiveClass(cls)}
                    aria-pressed={activeClass === cls}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                      activeClass === cls
                        ? 'bg-blue-600 text-white border-blue-600 shadow-soft'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800'
                    }`}
                  >
                    {cls === 'all' ? 'All Programs' : cls}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active filters */}
          {hasActiveFilters && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Active filters:</span>
              {activeCategory !== 'all' && (
                <span className={`badge border flex items-center gap-1 ${categoryBadge[activeCategory] || categoryBadge.general}`}>
                  {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}
                  <button onClick={() => setActiveCategory('all')} className="ml-0.5 hover:opacity-70" aria-label="Remove category filter">
                    <X size={12} />
                  </button>
                </span>
              )}
              {activeClass !== 'all' && (
                <span className="badge badge-blue border border-blue-100 flex items-center gap-1">
                  {activeClass}
                  <button onClick={() => setActiveClass('all')} className="ml-0.5 hover:opacity-70" aria-label="Remove program filter">
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-gray-700 ml-auto font-medium transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Result count */}
        {!loading && filtered.length > 0 && (
          <p className="text-sm text-gray-500 mb-4 animate-fade-in">
            Showing <span className="font-semibold text-gray-700">{filtered.length}</span> of{' '}
            <span className="font-semibold text-gray-700">{notices.length}</span> notices
          </p>
        )}

        {/* Notices List */}
        <div className="animate-fade-in">
          {loading ? (
            <div className="space-y-4" role="status" aria-label="Loading notices">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="card p-6 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-full" />
                      <div className="h-4 bg-gray-200 rounded w-5/6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 md:p-16 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                <Megaphone size={32} className="text-green-600" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-800 mb-2">
                {search || hasActiveFilters ? 'No matching notices found' : 'No notices available'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto leading-relaxed">
                {search || hasActiveFilters
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'There are currently no notices published. Check back later for updates.'}
              </p>
              {(search || hasActiveFilters) && (
                <button onClick={clearAll} className="btn-outline">
                  <X size={16} className="mr-1" />
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4" role="list" aria-label="Notices">
              {filtered.map((notice, index) => {
                const CategoryIcon = categoryIcons[notice.category] || Megaphone;
                const accent = categoryAccent[notice.category] || categoryAccent.general;
                const isExpanded = expandedId === notice.id;
                const canExpand = notice.content.split('\n').length > 3 || notice.content.length > 200;

                return (
                  <article
                    key={notice.id}
                    className={`card overflow-hidden group animate-slide-up border-l-4 ${accent}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                    role="listitem"
                  >
                    <div className="p-6">
                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Calendar size={14} className="text-gray-400" />
                          <time dateTime={notice.published_date}>
                            {formatDate(notice.published_date)}
                          </time>
                        </span>
                        <span className="text-gray-300" aria-hidden="true">•</span>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${categoryBadge[notice.category] || categoryBadge.general}`}>
                          <CategoryIcon size={12} />
                          {notice.category.charAt(0).toUpperCase() + notice.category.slice(1)}
                        </span>
                        {notice.class && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            <GraduationCap size={12} />
                            {notice.class}
                          </span>
                        )}
                        {notice.author && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                            {notice.author}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="font-display text-lg md:text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-green-700 transition-colors">
                        {notice.title}
                      </h3>

                      {/* Content */}
                      <div
                        className={`text-gray-600 leading-relaxed transition-all duration-300 ${
                          isExpanded ? '' : 'line-clamp-3'
                        }`}
                      >
                        {notice.content}
                      </div>

                      {/* Read more */}
                      {canExpand && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                          <ChevronRight
                            size={16}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
