import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export default function TeacherStudents() {
  const { teacher } = useAuth();
  if (!teacher) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/teacher-profile?tab=students" replace />;
}
