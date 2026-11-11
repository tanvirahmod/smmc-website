import { Link } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { useSEO } from '@/lib/useSEO';

export default function NotFound() {
  useSEO({
    title: 'Page Not Found',
    description: 'The page you are looking for does not exist or has been moved.',
    noindex: true,
  });

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 grid-pattern px-4 py-16">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex bg-green-50 text-green-700 p-4 rounded-2xl mb-6 shadow-soft">
          <FileQuestion size={48} />
        </div>
        <h1 className="font-display text-6xl md:text-7xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="font-display text-2xl font-bold text-gray-800 mb-3">Page Not Found</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/" className="btn-primary">
            <Home size={18} />
            Go Home
          </Link>
          <Link to="/notices" className="btn-outline">
            <ArrowLeft size={18} />
            View Notices
          </Link>
        </div>
      </div>
    </div>
  );
}
