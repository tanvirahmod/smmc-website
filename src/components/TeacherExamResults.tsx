import { useEffect, useState } from 'react';
import {
  GraduationCap, Users, Calendar, BookOpen, ClipboardList,
  ChevronRight, ArrowLeft, ArrowRight, ListOrdered, AlertCircle,
  Check, RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import {
  fetchActiveExams, fetchStudentsForExam, fetchExamMarks, saveExamMark, deleteExamMark,
  getStudentFails, isTotalOnlySubject, Exam, ExamMark, ExamMarkStatus, Student,
} from '@/lib/apiClient';
import { effectiveFourthSubjectFor } from '@/lib/subjects';

type View = 'exams' | 'summary' | 'entry';

function rollOf(s: Student): string {
  return s.class_roll || s.student_id || '';
}

function byRoll(a: Student, b: Student): number {
  return rollOf(a).localeCompare(rollOf(b), undefined, { numeric: true });
}

function isMarkEntered(mark: ExamMark | undefined): boolean {
  // A saved row is "entered" regardless of the numbers — a genuine 0/0 used to
  // look identical to "no marks saved yet", which kept the student Pending
  // forever and made sequential entry jump back to them.
  return !!mark;
}

// Matches the server-side cap in api.ts. The schema has no per-subject maximum,
// so this generous bound just stops obvious typos.
const MAX_COMPONENT_MARKS = 200;

const programColors: Record<string, string> = {
  HSC: 'bg-blue-100 text-blue-700',
  Degree: 'bg-purple-100 text-purple-700',
  Honours: 'bg-amber-100 text-amber-700',
};

export default function TeacherExamResults() {
  const { teacher, password } = useAuth();
  const subject = (teacher?.subject || '').trim();

  const [view, setView] = useState<View>('exams');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examStudents, setExamStudents] = useState<Student[]>([]);
  const [marksMap, setMarksMap] = useState<Record<string, ExamMark>>({});
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [cq, setCq] = useState('');
  const [mcq, setMcq] = useState('');
  const [markStatus, setMarkStatus] = useState<ExamMarkStatus>('present');
  const [entryError, setEntryError] = useState('');
  const [entryMsg, setEntryMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [entryMode, setEntryMode] = useState<'sequential' | 'single'>('sequential');

  useEffect(() => {
    if (!teacher || !subject) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchActiveExams(subject)
      .then((data) => {
        if (!cancelled) setExams(data);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load exams. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teacher, subject]);

  if (!teacher) {
    return null;
  }

  const enteredCount = examStudents.filter((s) => isMarkEntered(marksMap[s.student_id])).length;

  // Total-only subjects (e.g. English without MCQ): one Total input, one Total column.
  const totalOnly = selectedExam ? isTotalOnlySubject(selectedExam, subject) : false;

  const statusLabel = (mark: ExamMark | undefined): 'A' | 'E' | null =>
    mark?.status === 'absent' ? 'A' : mark?.status === 'expelled' ? 'E' : null;

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    setExamError('');
    setExamLoading(true);
    setExamStudents([]);
    setMarksMap({});
    setView('summary');
    try {
      const [students, marks] = await Promise.all([
        fetchStudentsForExam(exam.id, subject),
        fetchExamMarks(exam.id, subject),
      ]);
      const sorted = [...students].sort(byRoll);
      setExamStudents(sorted);
      const map: Record<string, ExamMark> = {};
      for (const m of marks) map[m.student_id] = m;
      setMarksMap(map);
    } catch {
      setExamError('Failed to load exam data.');
    } finally {
      setExamLoading(false);
    }
  };

  const prefillFor = (index: number) => {
    const s = examStudents[index];
    const existing = s ? marksMap[s.student_id] : undefined;
    // Total-only rows store the total in CQ (MCQ 0); show the combined total.
    setCq(existing ? String(existing.cq + existing.mcq) : '');
    setMcq(existing && !isTotalOnlySubject(selectedExam, subject) ? String(existing.mcq) : '');
    setMarkStatus(existing?.status === 'absent' || existing?.status === 'expelled' ? existing.status : 'present');
  };

  const handleStartEntry = () => {
    const firstUnmarked = examStudents.findIndex((s) => !isMarkEntered(marksMap[s.student_id]));
    const idx = firstUnmarked === -1 ? 0 : firstUnmarked;
    setCurrentIndex(idx);
    prefillFor(idx);
    setEntryError('');
    setEntryMsg('');
    setEntryMode('sequential');
    setView('entry');
  };

  const handleJumpToStudent = (index: number) => {
    setCurrentIndex(index);
    prefillFor(index);
    setEntryError('');
    setEntryMsg('');
    setEntryMode('single');
    setView('entry');
  };

  const saveCurrentMark = async (): Promise<boolean> => {
    if (!selectedExam || !teacher) return false;
    const current = examStudents[currentIndex];
    if (!current) return false;

    // Absent/expelled: numbers are not required; zeros are stored.
    const isSpecial = markStatus === 'absent' || markStatus === 'expelled';
    let cqNum = 0;
    let mcqNum = 0;
    const totalOnlyMark = selectedExam ? isTotalOnlySubject(selectedExam, subject) : false;
    if (totalOnlyMark && !isSpecial) {
      cqNum = Number(cq);
      if (cq.trim() === '' || isNaN(cqNum) || cqNum < 0 || cqNum > MAX_COMPONENT_MARKS) {
        setEntryError(`Enter valid Total marks (0–${MAX_COMPONENT_MARKS}), or mark the student Absent/Expelled.`);
        return false;
      }
    } else if (!isSpecial) {
      cqNum = Number(cq);
      mcqNum = Number(mcq);
      if (
        cq.trim() === '' || mcq.trim() === '' ||
        isNaN(cqNum) || isNaN(mcqNum) ||
        cqNum < 0 || mcqNum < 0 ||
        cqNum > MAX_COMPONENT_MARKS || mcqNum > MAX_COMPONENT_MARKS
      ) {
        setEntryError(`Enter valid CQ and MCQ marks (0–${MAX_COMPONENT_MARKS}), or mark the student Absent/Expelled.`);
        return false;
      }
    }

    setSaving(true);
    setEntryError('');
    try {
      const mark = await saveExamMark(teacher.teacher_id, password, selectedExam.id, current.student_id, cqNum, mcqNum, markStatus);
      setMarksMap((prev) => ({ ...prev, [current.student_id]: mark }));
      const specialLabel = markStatus === 'absent' ? ' (Absent)' : markStatus === 'expelled' ? ' (Expelled)' : '';
      setEntryMsg(`Marks saved for ${current.full_name || rollOf(current)}${specialLabel}`);
      setTimeout(() => setEntryMsg(''), 2500);
      return true;
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : 'Failed to save marks');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const saved = await saveCurrentMark();
    if (!saved) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= examStudents.length) {
      setView('summary');
    } else {
      setCurrentIndex(nextIndex);
      prefillFor(nextIndex);
    }
  };

  const handleSaveSingle = async () => {
    const saved = await saveCurrentMark();
    if (saved) {
      setView('summary');
    }
  };

  // Clears the current student's saved row entirely, returning them to Pending
  // (e.g. marks were saved for the wrong student, or they were marked
  // absent/expelled by mistake).
  const handleResetToPending = async () => {
    if (!selectedExam || !teacher) return;
    const current = examStudents[currentIndex];
    if (!current || !isMarkEntered(marksMap[current.student_id])) return;

    const label = current.full_name || rollOf(current);
    if (!window.confirm(`Clear the saved ${subject} marks for ${label}? The student will go back to Pending.`)) {
      return;
    }

    setSaving(true);
    setEntryError('');
    try {
      await deleteExamMark(teacher.teacher_id, password, selectedExam.id, current.student_id);
      setMarksMap((prev) => {
        const next = { ...prev };
        delete next[current.student_id];
        return next;
      });
      setMarkStatus('present');
      setCq('');
      setMcq('');
      setEntryMsg(`Saved marks cleared — ${label} is Pending again.`);
      setTimeout(() => setEntryMsg(''), 2500);
    } catch (err) {
      setEntryError(err instanceof Error ? err.message : 'Failed to clear marks');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-12 text-center animate-pulse" role="status">
        <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-3" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Something went wrong</h3>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <div className="card p-12 md:p-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <ClipboardList size={32} className="text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No active exams for {subject}</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          The principal needs to create and activate an exam for your subject before you can input marks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View: exam list */}
      {view === 'exams' && (
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList size={20} className="text-green-600" />
              Active Exams
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Select an exam to view its summary and input {subject} marks.
            </p>
          </div>

          <div className="space-y-3">
            {exams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => handleSelectExam(exam)}
                className="w-full text-left card card-interactive p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4 min-h-[64px]"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base break-words">{exam.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${programColors[exam.program] || 'bg-gray-100 text-gray-600'}`}>
                      {exam.program}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      <Calendar size={12} />
                      {exam.session}
                    </span>
                    {exam.subjects.map((s) => (
                      <span
                        key={s}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          s === subject
                            ? 'bg-green-50 text-green-700 border border-green-300'
                            : 'bg-gray-50 text-gray-500'
                        }`}
                      >
                        <BookOpen size={12} />
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-green-600 text-white flex items-center justify-center flex-shrink-0">
                  <ChevronRight size={20} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View: exam summary */}
      {view === 'summary' && selectedExam && (
        <div className="space-y-6">
          <div className="card p-6">
              <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-5">
                <button onClick={() => setView('exams')} className="btn-secondary w-full sm:w-auto">
                  <ArrowLeft size={16} className="mr-1" />
                  Back to Exams
                </button>
                <button
                  onClick={handleStartEntry}
                  className="btn-primary w-full sm:w-auto sm:ml-auto"
                  disabled={examLoading || examStudents.length === 0}
                >
                <ClipboardList size={16} className="mr-1" />
                Input Marks
              </button>
            </div>

            {examLoading ? (
              <div className="text-center py-8" role="status">
                <div className="w-12 h-12 border-4 border-green-100 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-gray-500">Loading exam summary...</p>
              </div>
            ) : examError ? (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2" role="alert">
                <AlertCircle size={16} /> {examError}
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedExam.name}</h2>
                <div className="flex flex-wrap items-center gap-2 mb-5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${programColors[selectedExam.program] || 'bg-gray-100 text-gray-600'}`}>
                    {selectedExam.program}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    <Calendar size={12} />
                    {selectedExam.session}
                  </span>
                  {selectedExam.subjects.map((s) => (
                    <span
                      key={s}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        s === subject
                          ? 'bg-green-50 text-green-700 border border-green-300'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      <BookOpen size={12} />
                      {s}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                  <span>
                    <span className="font-semibold text-gray-800">{enteredCount}</span> of{' '}
                    <span className="font-semibold text-gray-800">{examStudents.length}</span> students marked ({subject})
                  </span>
                  <span>{examStudents.length ? Math.round((enteredCount / examStudents.length) * 100) : 0}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all duration-300"
                    style={{ width: `${examStudents.length ? (enteredCount / examStudents.length) * 100 : 0}%` }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Students & marks */}
          {!examLoading && !examError && (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <ListOrdered size={18} className="text-gray-400" />
                Students &amp; Marks ({subject})
              </h3>
              {examStudents.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">
                  No students in {selectedExam.program}, {selectedExam.session} have {subject} selected.
                </p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 overscroll-x-contain" tabIndex={0} role="region" aria-label="Student marks table, scroll horizontally">
                  <table className="w-full min-w-[460px] text-sm text-center [&_th]:align-middle [&_td]:align-middle">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-100">
                        <th className="pb-3 pr-4 font-medium">Roll</th>
                        <th className="pb-3 pr-4 font-medium">Student</th>
                        {!totalOnly && (
                          <>
                            <th className="pb-3 pr-4 font-medium text-center">CQ</th>
                            <th className="pb-3 pr-4 font-medium text-center">MCQ</th>
                          </>
                        )}
                        <th className="pb-3 pr-4 font-medium text-center">Total</th>
                        <th className="pb-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examStudents.map((s, index) => {
                        const mark = marksMap[s.student_id];
                        const special = statusLabel(mark);
                        const fails = getStudentFails(selectedExam, subject, mark);
                        const cqFail = fails.some((f) => f.component === 'CQ');
                        const mcqFail = fails.some((f) => f.component === 'MCQ');
                        const isFourth = effectiveFourthSubjectFor(s.fourth_subject, s.hsc_group).toLowerCase() === subject.toLowerCase();
                        return (
                          <tr
                            key={s.id}
                            onClick={() => handleJumpToStudent(index)}
                            className="border-b border-gray-50 hover:bg-green-50/50 cursor-pointer transition-colors"
                            title="Click to enter or edit marks"
                          >
                            <td className="py-3 pr-4 text-center font-medium text-gray-700">{rollOf(s)}</td>
                            <td className="py-3 pr-4 text-center font-medium text-gray-900">{s.full_name || 'Profile not updated'}</td>
                            {!totalOnly && (
                              <>
                                <td className={`py-3 pr-4 text-center ${cqFail ? 'text-red-700 font-bold' : ''}`}>
                                  {mark ? mark.cq : <span className="text-gray-300">—</span>}
                                </td>
                                <td className={`py-3 pr-4 text-center ${mcqFail ? 'text-red-700 font-bold' : ''}`}>
                                  {mark ? mark.mcq : <span className="text-gray-300">—</span>}
                                </td>
                              </>
                            )}
                            <td
                              className={`py-3 pr-4 text-center font-semibold ${isFourth ? 'bg-yellow-200' : ''} ${special || (totalOnly && fails.length > 0) ? 'text-red-700' : 'text-black'}`}
                              title={special === 'A' ? 'Absent' : special === 'E' ? 'Expelled' : undefined}
                            >
                              {special ?? (mark ? mark.cq + mark.mcq : <span className="text-gray-300">—</span>)}
                            </td>
                            <td className="py-3 text-center">
                              {mark?.status === 'absent' ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Absent</span>
                              ) : mark?.status === 'expelled' ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Expelled</span>
                              ) : isMarkEntered(mark) ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                                  <Check size={12} />
                                  Entered
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {examStudents.length > 0 && (
                <p className="text-xs text-gray-400 mt-4">
                  Click any student to enter or edit their marks.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* View: mark entry */}
      {view === 'entry' && selectedExam && (
        <div className="card p-6 md:p-8">
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-6">
            <button onClick={() => setView('summary')} className="btn-secondary w-full sm:w-auto">
              <ArrowLeft size={16} className="mr-1" />
              Back to Summary
            </button>
            <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium sm:ml-auto max-w-full ${programColors[selectedExam.program] || 'bg-gray-100 text-gray-600'}`}>
              <span className="truncate">{selectedExam.name} — {selectedExam.program}, {selectedExam.session}</span>
            </span>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500">
                Student {currentIndex + 1} of {examStudents.length} | {enteredCount} completed | Subject: {subject}
              </p>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full transition-all duration-300"
                  style={{ width: `${examStudents.length ? (enteredCount / examStudents.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {examStudents.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Users size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No students for this exam</h3>
                <p className="text-gray-500 text-sm">
                  No students in {selectedExam.program}, {selectedExam.session} have {subject} selected.
                </p>
              </div>
            ) : (
              <>
                {(() => {
                  const current = examStudents[currentIndex];
                  if (!current) return null;
                  return (
                    <div className="text-center mb-6 px-1">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-600 to-green-800 text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <GraduationCap size={36} />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900 break-words">{current.full_name || 'Profile not updated'}</h3>
                      <p className="text-sm text-gray-500 mt-1">Roll: {rollOf(current)}</p>
                      <p className="text-sm text-gray-500">Subject: {subject}</p>
                    </div>
                  );
                })()}

                {entryError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl mb-4 flex items-center gap-2" role="alert">
                    <AlertCircle size={16} /> {entryError}
                  </div>
                )}
                {entryMsg && (
                  <div className="bg-green-50 border border-green-100 text-green-700 text-sm p-4 rounded-xl mb-4 flex items-center gap-2">
                    <Check size={16} /> {entryMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  <div className="form-group">
                    <label className="label" htmlFor="cqMarks">{totalOnly ? 'Total Marks' : 'CQ Marks'}</label>
                    <input
                      id="cqMarks"
                      type="number"
                      min="0"
                      max="200"
                      step="0.01"
                      value={cq}
                      onChange={(e) => setCq(e.target.value)}
                      placeholder={totalOnly ? 'e.g. 65' : 'e.g. 25'}
                      className="input text-center text-lg"
                      disabled={saving || markStatus !== 'present'}
                    />
                  </div>
                  {!totalOnly && (
                  <div className="form-group">
                    <label className="label" htmlFor="mcqMarks">MCQ Marks</label>
                    <input
                      id="mcqMarks"
                      type="number"
                      min="0"
                      max="200"
                      step="0.01"
                      value={mcq}
                      onChange={(e) => setMcq(e.target.value)}
                      placeholder="e.g. 15"
                      className="input text-center text-lg"
                      disabled={saving || markStatus !== 'present'}
                    />
                  </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-6 p-3 sm:p-4 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={markStatus === 'absent'}
                      onChange={(e) => setMarkStatus(e.target.checked ? 'absent' : 'present')}
                      className="w-5 h-5 rounded accent-amber-600"
                      disabled={saving}
                    />
                    Absent (A)
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={markStatus === 'expelled'}
                      onChange={(e) => setMarkStatus(e.target.checked ? 'expelled' : 'present')}
                      className="w-5 h-5 rounded accent-red-600"
                      disabled={saving}
                    />
                    Expelled (E)
                  </label>
                  {markStatus !== 'present' && (
                    <span className="text-xs text-gray-500">
                      Marks inputs disabled — will save as {markStatus === 'absent' ? 'A' : 'E'} for this subject.
                    </span>
                  )}
                </div>

                {entryMode === 'single' ? (
                  <>
                    <button
                      onClick={handleNext}
                      disabled={saving}
                      className="btn-primary btn-lg w-full"
                    >
                      {saving ? (
                        'Saving...'
                      ) : (
                        <>
                          <Check size={18} />
                          Save &amp; Next
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleSaveSingle}
                      disabled={saving}
                      className="btn-secondary btn-lg w-full mt-3"
                    >
                      <Check size={18} />
                      Save &amp; Close
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="btn-primary btn-lg w-full"
                  >
                    {saving ? (
                      'Saving...'
                    ) : currentIndex === examStudents.length - 1 ? (
                      <>
                        <Check size={18} />
                        Finish &amp; View Summary
                      </>
                    ) : (
                      <>
                        Next Student
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                )}

                {(() => {
                  const current = examStudents[currentIndex];
                  if (!current || !isMarkEntered(marksMap[current.student_id])) return null;
                  return (
                    <button
                      onClick={handleResetToPending}
                      disabled={saving}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 underline underline-offset-2 disabled:opacity-50"
                    >
                      <RotateCcw size={14} />
                      Reset to Pending (clear saved marks)
                    </button>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
