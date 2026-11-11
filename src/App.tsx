import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import ApiOfflineBanner from '@/components/ApiOfflineBanner';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import Home from '@/pages/Home';
import Notices from '@/pages/Notices';
import Teachers from '@/pages/Teachers';
import DepartmentPage from '@/pages/DepartmentPage';
import Login from '@/pages/Login';
import TeacherProfile from '@/pages/TeacherProfile';
import TeacherStudents from '@/pages/TeacherStudents';
import StudentProfile from '@/pages/StudentProfile';
import PrincipalDashboard from '@/pages/PrincipalDashboard';
import NotFound from '@/pages/NotFound';

function ScrollToTopOnRouteChange() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

function AppContent() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-green-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lift"
      >
        Skip to main content
      </a>
      <ApiOfflineBanner />
      <Navbar />
      <main id="main-content" className="flex-1">
        <ScrollToTopOnRouteChange />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/departments/:slug" element={<DepartmentPage />} />          <Route path="/login" element={<Login />} />
          <Route path="/teacher-profile" element={<TeacherProfile />} />
          <Route path="/teacher-students" element={<TeacherStudents />} />
          <Route path="/student-profile" element={<StudentProfile />} />
          <Route path="/principal-dashboard" element={<PrincipalDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
