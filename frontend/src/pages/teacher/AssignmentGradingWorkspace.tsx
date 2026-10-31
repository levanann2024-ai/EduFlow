import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BookOpen, Check, CheckCircle2, Clock3, FileText, Save,
} from 'lucide-react';
import {
  listClassAssignmentSubmissions,
  listClassAssignments,
  listClassSubjects,
  listClasses,
  saveClassAssignmentGrade,
  type AssignmentSubmission,
  type ClassAssignment,
  type SchoolClass,
} from '@/api/schoolApi';
import { AssignmentSubmissionFiles } from '@/components/AssignmentSubmissionFiles';
import { MathText } from '@/components/MathText';
import { parseAssignmentAnswers, parseAssignmentContent } from '@/pages/student/assignmentQuestions';
import { ExamGradingWorkspace } from './ExamGradingWorkspace';

function scoreColor(score: number) {
  const stops = [
    { score: 0, color: [17, 24, 39] },
    { score: 2, color: [185, 28, 28] },
    { score: 4, color: [234, 88, 12] },
    { score: 6, color: [202, 138, 4] },
    { score: 8, color: [101, 163, 13] },
    { score: 10, color: [21, 128, 61] },
  ];
  const boundedScore = Math.min(10, Math.max(0, score));
  const upperIndex = stops.findIndex((stop) => stop.score >= boundedScore);
  const upper = stops[upperIndex] ?? stops[stops.length - 1];
  const lower = stops[Math.max(0, upperIndex - 1)];
  const ratio = (boundedScore - lower.score) / (upper.score - lower.score || 1);
  const channels = lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * ratio));
  return `rgb(${channels.join(' ')})`;
}

export function AssignmentGradingWorkspace() {
  const [activeTab, setActiveTab] = useState<'assignments' | 'exams'>('assignments');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedClass = classes.find((classroom) => classroom.id === selectedClassId) ?? null;
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const selectedSubmission = submissions.find((submission) => submission.studentId === selectedStudentId) ?? null;
  const parsedAssignment = selectedAssignment ? parseAssignmentContent(selectedAssignment.description) : null;
  const submittedAnswers = parsedAssignment && selectedSubmission?.responseText
    ? parseAssignmentAnswers(selectedSubmission.responseText, parsedAssignment.questions.length)
    : null;
  const submittedWork = submissions.filter((submission) => submission.responseText !== null);
  const sortedSubmissions = useMemo(() => [...submissions].sort((first, second) => {
    const firstPriority = first.responseText === null ? 0 : first.gradedAt === null ? 1 : 2;
    const secondPriority = second.responseText === null ? 0 : second.gradedAt === null ? 1 : 2;
    return firstPriority - secondPriority || first.studentName.localeCompare(second.studentName, 'vi');
  }), [submissions]);
  const visibleAssignments = useMemo(() => [...assignments].sort((first, second) => {
    const firstGraded = first.students.filter((student) => student.gradedAt).length;
    const secondGraded = second.students.filter((student) => student.gradedAt).length;
    return firstGraded - secondGraded || second.dueAt.localeCompare(first.dueAt);
  }), [assignments]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    listClasses()
      .then((items) => {
        if (!active) return;
        setClasses(items);
        setSelectedClassId(items[0]?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách lớp.');
      })
      .finally(() => {
        if (active) setLoadingClasses(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSubjects([]);
    setAssignments([]);
    setSelectedAssignmentId('');
    setSubmissions([]);
    setSelectedStudentId('');
    if (!selectedClassId) return () => { active = false; };
    listClassSubjects(selectedClassId)
      .then((items) => {
        if (active) setSubjects(items);
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải môn học được phân công.');
      });
    return () => { active = false; };
  }, [selectedClassId]);

  useEffect(() => {
    let active = true;
    if (!selectedClass || subjects.length === 0) {
      setAssignments([]);
      setLoadingAssignments(false);
      return () => { active = false; };
    }
    setLoadingAssignments(true);
    setAssignments([]);
    setSelectedAssignmentId('');
    setSubmissions([]);
    setSelectedStudentId('');
    setError('');
    Promise.all(subjects.flatMap((subject) => ['Kỳ 1', 'Kỳ 2'].map((semester) =>
      listClassAssignments(selectedClass.id, selectedClass.academic_year, semester, subject))))
      .then((results) => {
        if (!active) return;
        const items = results.flat().sort((first, second) =>
          first.students.filter((student) => student.gradedAt).length
            - second.students.filter((student) => student.gradedAt).length
            || (second.createdAt ?? second.dueAt).localeCompare(first.createdAt ?? first.dueAt));
        setAssignments(items);
        setSelectedAssignmentId(items[0]?.id ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải bài tập.');
      })
      .finally(() => {
        if (active) setLoadingAssignments(false);
      });
    return () => { active = false; };
  }, [selectedClass, subjects]);

  useEffect(() => {
    let active = true;
    if (!selectedClassId || !selectedAssignmentId) {
      setSubmissions([]);
      setSelectedStudentId('');
      return () => { active = false; };
    }
    setLoadingSubmissions(true);
    setSubmissions([]);
    setSelectedStudentId('');
    setError('');
    listClassAssignmentSubmissions(selectedClassId, selectedAssignmentId)
      .then((items) => {
        if (!active) return;
        setSubmissions(items);
        const firstToGrade = items.find((item) => item.responseText !== null && item.gradedAt === null)
          ?? items.find((item) => item.responseText !== null);
        setSelectedStudentId(firstToGrade?.studentId ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Không thể tải bài làm.');
      })
      .finally(() => {
        if (active) setLoadingSubmissions(false);
      });
    return () => { active = false; };
  }, [selectedClassId, selectedAssignmentId]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    if (!selectedClassId || !selectedAssignmentId || activeTab !== 'assignments') {
      return () => { active = false; };
    }

    const syncSubmissions = async () => {
      if (!active || inFlight || document.hidden || saving) return;
      const currentSubmission = submissions.find((item) => item.studentId === selectedStudentId);
      if (currentSubmission
        && (score !== (currentSubmission.score?.toString() ?? '')
          || feedback !== currentSubmission.teacherFeedback)) {
        return;
      }

      inFlight = true;
      try {
        const latestSubmissions = await listClassAssignmentSubmissions(selectedClassId, selectedAssignmentId);
        if (!active) return;
        setSubmissions((current) => latestSubmissions.map((latest) => {
          const previous = current.find((item) => item.studentId === latest.studentId);
          return previous
            && previous.studentName === latest.studentName
            && previous.responseText === latest.responseText
            && previous.submittedAt === latest.submittedAt
            && previous.score === latest.score
            && previous.teacherFeedback === latest.teacherFeedback
            && previous.gradedAt === latest.gradedAt
            && previous.files.length === latest.files.length
            && previous.files.every((file, index) => (
              file.id === latest.files[index].id
              && file.name === latest.files[index].name
              && file.mediaType === latest.files[index].mediaType
              && file.sizeBytes === latest.files[index].sizeBytes
            ))
            ? previous
            : latest;
        }));
        setAssignments((current) => current.map((assignment) => {
          if (assignment.id !== selectedAssignmentId) return assignment;
          const students = assignment.students.map((student) => {
            const submission = latestSubmissions.find((item) => item.studentId === student.id);
            return submission
              ? { ...student, submittedAt: submission.submittedAt, score: submission.score, gradedAt: submission.gradedAt }
              : student;
          });
          return {
            ...assignment,
            submittedCount: students.filter((student) => student.submittedAt).length,
            students,
          };
        }));
        if (!selectedStudentId) {
          const firstToGrade = latestSubmissions.find((item) => item.responseText !== null && item.gradedAt === null)
            ?? latestSubmissions.find((item) => item.responseText !== null);
          if (firstToGrade) setSelectedStudentId(firstToGrade.studentId);
        }
        setError((current) => current.startsWith('Không thể đồng bộ bài làm mới nhất:')
          ? ''
          : current);
      } catch (requestError) {
        if (active) {
          setError(`Không thể đồng bộ bài làm mới nhất: ${
            requestError instanceof Error ? requestError.message : 'Lỗi không xác định.'
          }`);
        }
      } finally {
        inFlight = false;
      }
    };

    const timer = window.setInterval(() => void syncSubmissions(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    activeTab,
    feedback,
    saving,
    score,
    selectedAssignmentId,
    selectedClassId,
    selectedStudentId,
    submissions,
  ]);

  useEffect(() => {
    setScore(selectedSubmission?.score?.toString() ?? '');
    setFeedback(selectedSubmission?.teacherFeedback ?? '');
  }, [selectedSubmission]);

  const saveGrade = async () => {
    if (!selectedClassId || !selectedAssignmentId || !selectedSubmission || score.trim() === '') return;
    const parsedScore = Number(score);
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 10) {
      setError('Điểm phải là số từ 0 đến 10.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await saveClassAssignmentGrade(
        selectedClassId,
        selectedAssignmentId,
        selectedSubmission.studentId,
        { score: parsedScore, teacherFeedback: feedback },
      );
      setSubmissions((current) => current.map((item) => item.studentId === selectedSubmission.studentId
        ? { ...item, ...result }
        : item));
      setAssignments((current) => current.map((assignment) => assignment.id === selectedAssignmentId
        ? {
          ...assignment,
          students: assignment.students.map((student) => student.id === selectedSubmission.studentId
            ? { ...student, submittedAt: selectedSubmission.submittedAt, gradedAt: result.gradedAt }
            : student),
        }
        : assignment));
      setNotice('Đã lưu điểm và nhận xét.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu điểm.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Loại bài cần chấm">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'assignments'}
            onClick={() => setActiveTab('assignments')}
            className={`rounded-lg border border-slate-900/15 px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'assignments' ? 'bg-blue-700 text-white shadow-sm hover:bg-blue-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            Bài tập
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'exams'}
            onClick={() => setActiveTab('exams')}
            className={`rounded-lg border border-slate-900/15 px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'exams' ? 'bg-blue-700 text-white shadow-sm hover:bg-blue-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            Bài kiểm tra
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Lớp
          <select
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
            disabled={loadingClasses || classes.length === 0}
            className="input-field min-h-10 w-44 px-3"
          >
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>{classroom.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
        </div>
      )}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {activeTab === 'exams' ? (
        <ExamGradingWorkspace />
      ) : (
      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-semibold text-slate-900">Bài tập đã giao</h2>
            <p className="mt-1 text-xs text-slate-500">Bài ít lượt chấm được ưu tiên hiển thị trước.</p>
          </div>
          {loadingClasses || loadingAssignments ? (
            <p role="status" className="p-4 text-sm text-slate-500">Đang tải bài tập...</p>
          ) : visibleAssignments.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Lớp này chưa có bài tập được giao.
            </p>
          ) : (
            <nav aria-label="Danh sách bài tập" className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
              {visibleAssignments.map((assignment) => {
                const submittedCount = assignment.students.filter((student) => student.submittedAt).length;
                const reviewedCount = assignment.students.filter((student) => student.gradedAt).length;
                const isPastDue = currentTime > new Date(assignment.dueAt).getTime();
                const submissionCountColor = !isPastDue
                  ? 'text-slate-500'
                  : submittedCount === assignment.studentCount
                    ? 'text-emerald-700'
                    : 'text-rose-700';
                const gradedCountColor = !isPastDue
                  ? 'text-slate-500'
                  : reviewedCount === assignment.studentCount
                    ? 'text-emerald-700'
                    : 'text-rose-700';
                return (
                  <button
                    key={assignment.id}
                    type="button"
                    aria-current={selectedAssignmentId === assignment.id ? 'true' : undefined}
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                    className={`w-full p-4 text-left transition hover:bg-slate-50 ${selectedAssignmentId === assignment.id ? 'border-l-2 border-blue-700 bg-blue-50/70' : ''}`}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-900">{assignment.title}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{assignment.subject} - {assignment.semester}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className={submissionCountColor}>{submittedCount}/{assignment.studentCount} bài nộp</span>
                      <span className={gradedCountColor}>{reviewedCount}/{assignment.studentCount} bài đã chấm</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          {!selectedAssignment ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">Chọn bài tập để xem bài làm</p>
              <p className="mt-1 text-sm text-slate-500">Bài tập đã giao sẽ xuất hiện ở danh sách bên trái.</p>
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-col">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedAssignment.title}</h2>
                    {selectedAssignment.description && (
                      <MathText
                        className="mt-2 text-sm leading-6 text-slate-600"
                        text={selectedAssignment.description}
                      />
                    )}
                  </div>
                </div>
              </div>
              {loadingSubmissions ? (
                <p role="status" className="p-6 text-sm text-slate-500">Đang tải bài làm...</p>
              ) : (
                <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_250px]">
                  <section className="min-w-0 space-y-4 p-4 sm:p-5">
                    {selectedSubmission ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                            <FileText className="h-4 w-4 text-blue-700" /> Bài làm của {selectedSubmission.studentName}
                          </h3>
                          {selectedSubmission.submittedAt && (
                            <span className="text-xs text-slate-500">
                              Nộp {new Date(selectedSubmission.submittedAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                        {parsedAssignment && submittedAnswers ? (
                          <div className="space-y-3">
                            {parsedAssignment.introduction && (
                              <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                                <MathText text={parsedAssignment.introduction} />
                              </div>
                            )}
                            {parsedAssignment.questions.map((question, index) => (
                              <article key={`${question.number}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-sm leading-6 text-slate-700"><MathText text={question.content} /></div>
                                <div className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-900">
                                  <span className="font-semibold">Bài làm:</span>
                                  {submittedAnswers[index]
                                    ? <div className="mt-1"><MathText text={submittedAnswers[index]} /></div>
                                    : ' Chưa trả lời'}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <div className="min-h-48 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800">
                            {selectedSubmission.responseText && <MathText text={selectedSubmission.responseText} />}
                          </div>
                        )}
                        <AssignmentSubmissionFiles
                          assignmentId={selectedAssignmentId}
                          studentId={selectedSubmission.studentId}
                          files={selectedSubmission.files}
                        />
                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-end justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-600">Điểm tổng</p>
                              <p className="mt-1 text-5xl font-black leading-none tracking-tight" style={{ color: selectedSubmission.score === null ? '#64748b' : scoreColor(selectedSubmission.score) }}>
                                {score.trim() ? Number(score).toFixed(1) : selectedSubmission.score?.toFixed(1) ?? '—'}
                                <span className="ml-1 text-2xl font-bold text-slate-400">/ 10</span>
                              </p>
                            </div>
                            <label className="w-36 text-xs font-semibold text-slate-600">
                              Điểm bài tập / 10
                              <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.25"
                                value={score}
                                onChange={(event) => setScore(event.target.value)}
                                className="input-field mt-1 min-h-10 w-full px-3 text-base font-bold"
                              />
                            </label>
                          </div>
                        </section>
                        <label className="block text-sm font-medium text-slate-700">
                          Nhận xét cho học sinh
                          <textarea
                            rows={4}
                            maxLength={5000}
                            value={feedback}
                            onChange={(event) => setFeedback(event.target.value)}
                            placeholder="Ghi nhận xét cụ thể về bài làm..."
                            className="input-field mt-1 w-full resize-y p-3 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void saveGrade()}
                          disabled={saving || score.trim() === ''}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {selectedSubmission.score === null
                            ? <><Check className="h-4 w-4" />{saving ? 'Đang lưu...' : 'Xác nhận điểm'}</>
                            : <><Save className="h-4 w-4" />{saving ? 'Đang lưu...' : 'Cập nhật điểm'}</>}
                        </button>
                      </>
                    ) : (
                      <div className="flex min-h-64 items-center justify-center text-center text-sm text-slate-500">
                        Chọn học sinh đã nộp bài ở danh sách bên phải để xem bài làm.
                      </div>
                    )}
                  </section>
                  <aside className="border-t border-slate-100 lg:border-l lg:border-t-0">
                    <div className="border-b border-slate-100 p-4">
                      <h3 className="font-semibold text-slate-900">Danh sách học sinh</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {submittedWork.length}/{selectedAssignment.studentCount} bài nộp · {submissions.filter((submission) => submission.gradedAt).length}/{selectedAssignment.studentCount} bài đã chấm
                      </p>
                    </div>
                    <nav aria-label="Danh sách bài làm học sinh" className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                      {sortedSubmissions.map((submission) => {
                        const hasSubmitted = submission.responseText !== null;
                        return (
                          <button
                            key={submission.studentId}
                            type="button"
                            disabled={!hasSubmitted}
                            aria-pressed={selectedStudentId === submission.studentId}
                            onClick={() => setSelectedStudentId(submission.studentId)}
                            className={`w-full p-3 text-left transition ${selectedStudentId === submission.studentId ? 'border-l-2 border-blue-700 bg-blue-50' : hasSubmitted ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-60'}`}
                          >
                            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                              {submission.gradedAt
                                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                : <Clock3 className={`h-4 w-4 shrink-0 ${hasSubmitted ? 'text-amber-600' : 'text-slate-400'}`} />}
                              <span className="truncate">{submission.studentName}</span>
                            </span>
                            <span className="mt-1 block pl-6 text-xs text-slate-500">
                              {!hasSubmitted ? 'Chưa nộp' : submission.gradedAt ? 'Đã chấm' : 'Chưa chấm'}
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </aside>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );
}
