import { createContext, useContext, useState, ReactNode } from 'react';
import { Teacher, Student, setApiCredentials } from '@/lib/apiClient';

type TeacherWithoutPassword = Omit<Teacher, 'password'> & { token?: string };
type StudentWithoutPassword = Omit<Student, 'password'> & { token?: string };

interface AuthState {
  teacher: TeacherWithoutPassword | null;
  student: StudentWithoutPassword | null;
  /**
   * Vestigial. Sign-in used to keep the password here and resend it on every
   * request; identity now travels as a session token, so these credentials are
   * never persisted and are stripped from every outgoing request. The field
   * remains so existing component signatures keep compiling.
   */
  password: string;
  loginTeacher: (teacher: TeacherWithoutPassword, password: string) => void;
  loginStudent: (student: StudentWithoutPassword, password: string) => void;
  logout: () => void;
  updateTeacherData: (teacher: TeacherWithoutPassword) => void;
  updateStudentData: (student: StudentWithoutPassword) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = 'college_auth';

interface SavedAuth {
  teacher?: TeacherWithoutPassword;
  student?: StudentWithoutPassword;
  /** Signed, expiring session token — persisted instead of the password. */
  token?: string;
}

function loadSavedAuth(): SavedAuth | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SavedAuth) : null;
  } catch {
    return null;
  }
}

/**
 * Mirrors the session token into the API client's request headers. Called
 * during the initial render so a reloaded page still authenticates its very
 * first request (child effects run before parent effects, so an effect here
 * would be too late).
 */
function applyToken(token: string | undefined): void {
  setApiCredentials(token ? { token } : null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [savedAuth] = useState<SavedAuth | null>(() => {
    const saved = loadSavedAuth();
    applyToken(saved?.token);
    return saved;
  });
  const [teacher, setTeacher] = useState<TeacherWithoutPassword | null>(savedAuth?.teacher || null);
  const [student, setStudent] = useState<StudentWithoutPassword | null>(savedAuth?.student || null);
  const [token, setToken] = useState(savedAuth?.token || '');
  // Held in memory only for signature compatibility; never persisted, never sent.
  const [password, setPassword] = useState('');

  const loginTeacher = (t: TeacherWithoutPassword, pw: string) => {
    const nextToken = t.token || '';
    setTeacher(t);
    setStudent(null);
    setPassword(pw);
    setToken(nextToken);
    applyToken(nextToken);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ teacher: t, token: nextToken }));
  };

  const loginStudent = (s: StudentWithoutPassword, pw: string) => {
    const nextToken = s.token || '';
    setStudent(s);
    setTeacher(null);
    setPassword(pw);
    setToken(nextToken);
    applyToken(nextToken);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ student: s, token: nextToken }));
  };

  const logout = () => {
    setTeacher(null);
    setStudent(null);
    setPassword('');
    setToken('');
    applyToken(undefined);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const updateTeacherData = (t: TeacherWithoutPassword) => {
    setTeacher(t);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ teacher: t, token }));
  };

  const updateStudentData = (s: StudentWithoutPassword) => {
    setStudent(s);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ student: s, token }));
  };

  return (
    <AuthContext.Provider value={{ teacher, student, password, loginTeacher, loginStudent, logout, updateTeacherData, updateStudentData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
