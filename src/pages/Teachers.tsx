import { useEffect, useState } from 'react';
import { User, Mail, Search, GraduationCap, Award, X } from 'lucide-react';
import { fetchTeachers, Teacher } from '@/lib/apiClient';
import PageHeader from '@/components/PageHeader';
import { useSEO } from '@/lib/useSEO';

export default function Teachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'principal' | 'faculty'>('all');

  useSEO({
    title: 'Our Teachers & Faculty',
    description: 'Meet the dedicated teachers, principal, and faculty of Sufia Motin Mohila College, Jatrapasha (3351), Baniachong. Browse our teaching staff and their designations.',
    path: '/teachers',
  });

  useEffect(() => {
    fetchTeachers()
      .then(setTeachers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = teachers
    .filter((t) => {
      if (activeFilter === 'principal') return t.is_principal;
      if (activeFilter === 'faculty') return !t.is_principal;
      return true;
    })
    .filter(
      (t) =>
        (t.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.designation || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.teacher_id || '').toLowerCase().includes(search.toLowerCase())
    );

  const principalCount = teachers.filter((t) => t.is_principal).length;
  const facultyCount = teachers.filter((t) => !t.is_principal).length;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <PageHeader
        badge="Faculty & Staff"
        badgeIcon={<GraduationCap size={16} />}
        title="Our Dedicated Educators"
        subtitle="Meet the passionate teachers and staff who shape young minds and build futures at Sufia Motin Mohila College."
        meta={
          <>
            <span className="flex items-center gap-1">
              <User size={16} />
              {teachers.length} total faculty
            </span>
            <span className="flex items-center gap-1">
              <Award size={16} />
              {principalCount} principal
            </span>
            <span className="flex items-center gap-1">
              <GraduationCap size={16} />
              {facultyCount} faculty members
            </span>
          </>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12 -mt-6 relative z-10">
        {/* Search and Filter */}
        <div className="card card-elevated p-6 mb-8 animate-fade-in">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, designation, subject, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Faculty', icon: User },
                { id: 'principal', label: 'Principal', icon: Award },
                { id: 'faculty', label: 'Teaching Staff', icon: GraduationCap },
              ].map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id as typeof activeFilter)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 whitespace-nowrap border ${
                      activeFilter === filter.id
                        ? 'bg-green-600 text-white border-green-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Teachers Grid */}
        <div className="animate-fade-in">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="status">
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
          ) : filtered.length === 0 ? (
            <div className="card p-12 md:p-16 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <User size={32} className="text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {search ? 'No teachers found' : 'No faculty members yet'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                {search
                  ? 'Try adjusting your search or filter to find matching faculty.'
                  : 'Faculty directory is currently being updated.'}
              </p>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="btn-outline"
                >
                  <X size={16} className="mr-1" />
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="list">
              {filtered.map((teacher, index) => (
                <article
                  key={teacher.id}
                  className="card card-interactive overflow-hidden animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                  role="listitem"
                >
                  {/* Profile image area */}
                  <div className="relative h-32 bg-gradient-to-br from-green-50 to-green-100">
                    {teacher.is_principal && (
                      <div className="absolute top-3 right-3">
                        <span className="bg-amber-400 text-gray-900 px-2 py-1 rounded-full text-xs font-bold">
                          Principal
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                      {teacher.profile_pic_url ? (
                        <img
                          src={teacher.profile_pic_url}
                          alt={teacher.full_name || teacher.teacher_id}
                          className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-xl"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full border-4 border-white bg-gradient-to-br from-green-600 to-green-800 text-white flex items-center justify-center shadow-xl">
                          <User size={30} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-12 pb-6 px-5 text-center">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {teacher.full_name || 'Profile not updated'}
                    </h3>
                    {teacher.designation && (
                      <p className="text-sm text-green-700 font-medium mt-1">{teacher.designation}</p>
                    )}
                    {teacher.subject && (
                      <p className="text-sm text-gray-500 mt-0.5">{teacher.subject}</p>
                    )}
                    <div className="mt-4 space-y-2 text-sm text-gray-500">
                      {teacher.teacher_id && (
                        <div className="flex items-center justify-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          <span>ID: {teacher.teacher_id}</span>
                        </div>
                      )}
                      {teacher.email && (
                        <div className="flex items-center justify-center gap-1.5">
                          <Mail size={14} className="text-gray-400" />
                          <span>{teacher.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="text-center mt-10 animate-fade-in">
            <p className="text-gray-500">
              Showing {filtered.length} of {teachers.length} faculty members
            </p>
          </div>
        )}
      </div>
    </div>
  );
}