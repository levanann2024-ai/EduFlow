import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, BookOpen, Check, CheckCircle2, Clock3, FileText, LoaderCircle, Save, Sparkles, Trash2,
} from 'lucide-react';
import { authenticatedFetch } from '@/auth/authApi';
import {
  deleteClassAssignment,
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
import {
  distributeAssignmentPoints,
  parseAssignmentAnswers,
  parseAssignmentContent,
  withAssignmentQuestionPoints,
} from '@/pages/student/assignmentQuestions';
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

function getAiGradingAdvice(reply: string, maximum: number) {
  const scoreLine = /^\s*(?:#{1,6}\s*)?(?:[-*]\s*)?(?:\*\*)?(?:gợi ý điểm|điểm gợi ý)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(\d+(?:[.,]\d+)?)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:điểm)?)?(?:\*\*)?[ \t]*$/im;
  const match = scoreLine.exec(reply);
  if (!match) return { suggestedScore: null, explanation: reply };

  const parsedScore = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > maximum) {
    return { suggestedScore: null, explanation: reply };
  }

  return {
    suggestedScore: parsedScore,
    explanation: reply.slice(0, match.index) + reply.slice(match.index + match[0].length).trimStart(),
  };
}

function resizeFeedbackTextarea(textarea: HTMLTextAreaElement) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.max(textarea.scrollHeight, 64)}px`;
}

export function AssignmentGradingWorkspace() {
  const [activeTab, setActiveTab] = useState<'assignments' | 'exams'>('assignments');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [questionScoreInputs, setQuestionScoreInputs] = useState<Record<string, string>>({});
  const [questionFeedbackInputs, setQuestionFeedbackInputs] = useState<Record<string, string>>({});
  const questionFeedbackTextareas = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const feedbackTextarea = useRef<HTMLTextAreaElement | null>(null);
  const [questionAiHelp, setQuestionAiHelp] = useState<Record<string, string>>({});
  const [questionAiLoading, setQuestionAiLoading] = useState<string | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedClass = classes.find((classroom) => classroom.id === selectedClassId) ?? null;
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const selectedSubmission = submissions.find((submission) => submission.studentId === selectedStudentId) ?? null;
  const parsedAssignment = useMemo(
    () => selectedAssignment ? parseAssignmentContent(selectedAssignment.description) : null,
    [selectedAssignment],
  );
  const questionMaximums = distributeAssignmentPoints(parsedAssignment?.questions.length ?? 0);
  const questionTotal = parsedAssignment?.questions.reduce((total, _question, index) => {
    const raw = questionScoreInputs[String(index)];
    return total + (raw !== undefined && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : 0);
  }, 0) ?? 0;
  const allQuestionsScored = Boolean(parsedAssignment
    && parsedAssignment.questions.length > 0
    && parsedAssignment.questions.every((_, index) => {
      const raw = questionScoreInputs[String(index)];
      const value = Number(raw);
      return raw !== undefined && raw.trim() !== '' && Number.isFinite(value)
        && value >= 0 && value <= questionMaximums[index];
    }));
  const displayedScore = parsedAssignment
    ? Object.values(questionScoreInputs).some((value) => value.trim() !== '')
      ? questionTotal
      : selectedSubmission?.score ?? Number.NaN
    : score.trim() ? Number(score) : selectedSubmission?.score ?? Number.NaN;
  const submittedAnswers = useMemo(
    () => parsedAssignment && selectedSubmission?.responseText
      ? parseAssignmentAnswers(selectedSubmission.responseText, parsedAssignment.questions.length)
      : null,
    [parsedAssignment, selectedSubmission?.responseText],
  );
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
      const currentQuestionScores = Object.fromEntries(Object.entries(questionScoreInputs)
        .filter(([, value]) => value.trim() !== '')
        .map(([key, value]) => [key, Number(value)]));
      const currentQuestionFeedback = Object.fromEntries(Object.entries(questionFeedbackInputs)
        .filter(([, value]) => value.trim() !== ''));
      const savedQuestionFeedback = Object.fromEntries(Object.entries(currentSubmission?.questionFeedback ?? {})
        .filter(([, value]) => value.trim() !== ''));
      if (currentSubmission
        && (score !== (currentSubmission.score?.toString() ?? '')
          || feedback !== currentSubmission.teacherFeedback
          || (parsedAssignment && JSON.stringify(currentQuestionScores) !== JSON.stringify(currentSubmission.questionScores))
          || (parsedAssignment && JSON.stringify(currentQuestionFeedback) !== JSON.stringify(savedQuestionFeedback)))) {
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
            && JSON.stringify(previous.questionScores) === JSON.stringify(latest.questionScores)
            && JSON.stringify(previous.questionFeedback) === JSON.stringify(latest.questionFeedback)
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
    parsedAssignment,
    questionFeedbackInputs,
    questionScoreInputs,
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
    setQuestionScoreInputs(Object.fromEntries((parsedAssignment?.questions ?? []).map((_question, index) => {
      const existingScore = selectedSubmission?.questionScores[String(index)];
      return [String(index), existingScore === undefined ? '' : String(existingScore)];
    })));
    setQuestionFeedbackInputs(Object.fromEntries((parsedAssignment?.questions ?? []).map((_question, index) => [
      String(index),
      selectedSubmission?.questionFeedback[String(index)] ?? '',
    ])));
    setQuestionAiHelp({});
    setQuestionAiLoading(null);
  }, [parsedAssignment, selectedSubmission]);

  useEffect(() => {
    Object.values(questionFeedbackTextareas.current).forEach((textarea) => {
      if (textarea) resizeFeedbackTextarea(textarea);
    });
    if (feedbackTextarea.current) resizeFeedbackTextarea(feedbackTextarea.current);
  }, [feedback, questionFeedbackInputs]);

  const saveGrade = async () => {
    if (!selectedClassId || !selectedAssignmentId || !selectedSubmission
      || (!parsedAssignment && score.trim() === '')) return;
    if (parsedAssignment && !allQuestionsScored) {
      setError('Hãy nhập điểm cho từng câu và bảo đảm không vượt quá điểm tối đa của câu.');
      return;
    }
    const parsedScore = parsedAssignment
      ? Math.round(questionTotal * 100) / 100
      : Number(score);
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
        {
          score: parsedScore,
          teacherFeedback: feedback,
          ...(parsedAssignment ? {
            questionScores: Object.fromEntries(parsedAssignment.questions.map((_question, index) => [
              String(index),
              Number(questionScoreInputs[String(index)]),
            ])),
            questionFeedback: questionFeedbackInputs,
          } : {}),
        },
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
      setNotice('Đã lưu điểm từng câu và nhận xét.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu điểm.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedAssignment = async () => {
    if (!selectedClass || !selectedAssignment) return;
    const hasSubmissions = selectedAssignment.submittedCount > 0;
    if (!window.confirm(
      `Xóa bài tập "${selectedAssignment.title}"?${hasSubmissions
        ? ' Toàn bộ bài làm, điểm, lời phê và tệp nộp của học sinh cũng sẽ bị xóa vĩnh viễn.'
        : ''}`,
    )) return;
    setDeletingAssignment(true);
    setError('');
    setNotice('');
    try {
      await deleteClassAssignment(selectedClass.id, selectedAssignment.id, {
        academicYear: selectedClass.academic_year,
        semester: selectedAssignment.semester,
        subject: selectedAssignment.subject,
      });
      setAssignments((current) => current.filter((assignment) => assignment.id !== selectedAssignment.id));
      window.dispatchEvent(new CustomEvent('eduflow:assignment-deleted', { detail: { id: selectedAssignment.id } }));
      setSelectedAssignmentId('');
      setSubmissions([]);
      setSelectedStudentId('');
      setScore('');
      setFeedback('');
      setQuestionScoreInputs({});
      setQuestionFeedbackInputs({});
      setQuestionAiHelp({});
      setNotice(`Đã xóa bài tập "${selectedAssignment.title}" và dữ liệu bài nộp liên quan.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể xóa bài tập.');
    } finally {
      setDeletingAssignment(false);
    }
  };

  const askQuestionAi = async (questionIndex: number) => {
    if (!selectedAssignment || !parsedAssignment || !submittedAnswers || questionAiLoading !== null) return;
    const question = parsedAssignment.questions[questionIndex];
    const maximum = questionMaximums[questionIndex];
    setQuestionAiLoading(String(questionIndex));
    setError('');
    try {
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedAssignment.subject,
          message: [
            'Bạn là trợ lý hỗ trợ giáo viên chấm bài. Hãy đối chiếu câu trả lời với yêu cầu của câu hỏi, chỉ ra phần đúng, thiếu hoặc cần làm rõ dựa trên dữ liệu được cung cấp.',
            `Đưa ra điểm gợi ý cho riêng câu này trên tối đa ${maximum} điểm. Bắt đầu phản hồi bằng đúng một dòng: **Gợi ý điểm: X / ${maximum} điểm**. Điểm gợi ý phải nằm trong khoảng 0 đến ${maximum}, có thể dùng tối đa hai chữ số thập phân.`,
            'Đây chỉ là gợi ý tham khảo cho giáo viên, không thay thế quyết định chấm điểm cuối cùng. Không suy đoán nội dung không có trong bài làm.',
            `Môn học: ${selectedAssignment.subject}.`,
            `Câu hỏi: ${question.content}`,
            `Câu trả lời học sinh: ${submittedAnswers[questionIndex] || 'Không có câu trả lời dạng văn bản.'}`,
            'Sau dòng điểm gợi ý, nhận xét ngắn gọn bằng tiếng Việt; dùng Markdown và LaTeX đúng cú pháp khi cần.',
          ].join('\n\n'),
        }),
      });
      const result: { success: boolean; data?: { reply?: string }; message?: string } = await response.json();
      if (!response.ok || !result.success || !result.data?.reply) {
        throw new Error(result.message || 'AI chưa thể hỗ trợ câu này.');
      }
      const reply = result.data?.reply;
      if (!reply) throw new Error('AI chưa trả về nội dung hỗ trợ.');
      setQuestionAiHelp((current) => ({ ...current, [String(questionIndex)]: reply }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới trợ lý AI.');
    } finally {
      setQuestionAiLoading(null);
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
      <div className="space-y-4">
        {loadingClasses || loadingAssignments ? (
          <p role="status" className="text-sm text-slate-500">Đang tải bài tập...</p>
        ) : visibleAssignments.length === 0 ? (
          <p className="text-sm text-slate-500">Lớp này chưa có bài tập được giao.</p>
        ) : (
          <nav aria-label="Danh sách bài tập" className="flex gap-2 overflow-x-auto pb-1">
            {visibleAssignments.map((assignment) => {
              const submittedCount = assignment.students.filter((student) => student.submittedAt).length;
              const reviewedCount = assignment.students.filter((student) => student.gradedAt).length;
              return (
                <button
                  key={assignment.id}
                  type="button"
                  aria-pressed={selectedAssignmentId === assignment.id}
                  onClick={() => setSelectedAssignmentId(assignment.id)}
                  title={assignment.title}
                  className={`w-72 shrink-0 rounded-xl border p-3 text-left transition ${
                    selectedAssignmentId === assignment.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="block truncate text-sm font-bold text-slate-900">{assignment.title}</span>
                  <span className="mt-1 block text-xs font-medium text-slate-600">
                    {submittedCount}/{assignment.studentCount} bài nộp - {reviewedCount}/{assignment.studentCount} bài đã chấm
                  </span>
                </button>
              );
            })}
          </nav>
        )}

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white">
          {!selectedAssignment ? (
            <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
              <BookOpen className="h-8 w-8 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-700">Chọn bài tập để xem bài làm</p>
              <p className="mt-1 text-sm text-slate-500">Chọn bài tập ở phía trên để xem bài làm.</p>
            </div>
          ) : (
            <div className="flex min-h-[560px] flex-col">
              <div className="border-b border-slate-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="mt-1 text-2xl font-bold leading-tight text-slate-900">{selectedAssignment.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedAssignment()}
                    disabled={deletingAssignment || saving}
                    className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"
                  >
                    {deletingAssignment
                      ? <LoaderCircle className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                    {deletingAssignment ? 'Đang xóa...' : 'Xóa bài tập'}
                  </button>
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
                          <h3 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            <FileText className="h-4 w-4 text-blue-700" /> Bài làm của {selectedSubmission.studentName}
                          </h3>
                          {selectedSubmission.submittedAt && (
                            <span className="text-xs text-slate-500">
                              Nộp {new Date(selectedSubmission.submittedAt).toLocaleString('vi-VN')}
                            </span>
                          )}
                        </div>
                        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-stretch sm:p-5">
                          <div className="flex shrink-0 flex-col justify-center sm:border-r sm:border-slate-200 sm:pr-5">
                            <p className="text-sm font-semibold text-slate-600">Điểm:</p>
                            {parsedAssignment ? (
                              <p className="mt-1 flex items-baseline gap-1.5">
                                <span className="text-5xl font-extrabold leading-none tracking-tight" style={{ color: Number.isFinite(displayedScore) ? scoreColor(displayedScore) : '#64748b' }}>
                                  {Number.isFinite(displayedScore) ? Number(displayedScore.toFixed(2)).toString() : '—'}
                                </span>
                                <span className="text-2xl font-semibold leading-none text-slate-500">/ 10</span>
                              </p>
                            ) : (
                              <label className="mt-1 flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.25"
                                  value={score}
                                  onChange={(event) => setScore(event.target.value)}
                                  aria-label="Điểm bài tập"
                                  className="input-field h-12 w-28 px-3 text-2xl font-bold"
                                />
                                <span className="text-xl font-semibold text-slate-500">/ 10</span>
                              </label>
                            )}
                          </div>
                          <label className="min-w-0 flex-1 text-sm font-semibold text-slate-700">
                            Lời phê giáo viên:
                            <textarea
                              ref={feedbackTextarea}
                              rows={2}
                              maxLength={5000}
                              value={feedback}
                              onChange={(event) => {
                                resizeFeedbackTextarea(event.currentTarget);
                                setFeedback(event.target.value);
                              }}
                              placeholder="Ghi nhận xét cụ thể về bài làm..."
                              className="input-field mt-1 w-full resize-none overflow-hidden p-2.5 text-sm font-normal"
                            />
                          </label>
                        </section>
                        {parsedAssignment && submittedAnswers ? (
                          <div className="space-y-3">
                            {parsedAssignment.questions.map((question, index) => (
                              <article key={`${question.number}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <p className="text-xs font-semibold text-blue-700">
                                    Câu {question.number} - tối đa {questionMaximums[index]} điểm
                                  </p>
                                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    Điểm
                                    <input
                                      type="number"
                                      min="0"
                                      max={questionMaximums[index]}
                                      step="0.01"
                                      value={questionScoreInputs[String(index)] ?? ''}
                                      onChange={(event) => setQuestionScoreInputs((current) => ({
                                        ...current,
                                        [String(index)]: event.target.value,
                                      }))}
                                      aria-label={`Điểm câu ${question.number}`}
                                      className="input-field h-10 w-24 px-2 text-center text-base font-bold"
                                    />
                                    <span className="text-slate-500">/ {questionMaximums[index]}</span>
                                  </label>
                                </div>
                                <div className="text-sm leading-6 text-slate-700">
                                  <MathText text={withAssignmentQuestionPoints(question.content, questionMaximums[index])} />
                                </div>
                                <div className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-900">
                                  <span className="font-semibold">Bài làm:</span>
                                  {submittedAnswers[index]
                                    ? <div className="mt-1"><MathText text={submittedAnswers[index]} /></div>
                                    : ' Chưa trả lời'}
                                </div>
                                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                                  <label className="block text-xs font-semibold text-amber-900">
                                    Lời phê câu {question.number}
                                    <textarea
                                      ref={(textarea) => {
                                        questionFeedbackTextareas.current[String(index)] = textarea;
                                      }}
                                      rows={2}
                                      maxLength={5000}
                                      value={questionFeedbackInputs[String(index)] ?? ''}
                                      onChange={(event) => {
                                        resizeFeedbackTextarea(event.currentTarget);
                                        setQuestionFeedbackInputs((current) => ({
                                          ...current,
                                          [String(index)]: event.target.value,
                                        }));
                                      }}
                                      placeholder="Nhận xét riêng cho câu này..."
                                      className="input-field mt-1.5 w-full resize-none overflow-hidden bg-white p-2.5 text-sm font-normal"
                                    />
                                  </label>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void askQuestionAi(index)}
                                  disabled={questionAiLoading !== null}
                                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-violet-200 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
                                >
                                  {questionAiLoading === String(index)
                                    ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                    : <Sparkles className="h-4 w-4" />}
                                  {questionAiLoading === String(index) ? 'AI đang phân tích...' : 'Trợ giúp AI cho câu này'}
                                </button>
                                {questionAiHelp[String(index)] && (
                                  (() => {
                                    const advice = getAiGradingAdvice(
                                      questionAiHelp[String(index)],
                                      questionMaximums[index],
                                    );
                                    return (
                                      <div role="status" className="mt-2 rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm text-violet-900">
                                        {advice.suggestedScore !== null && (
                                          <p className="mb-2 font-bold">
                                            AI gợi ý điểm: {advice.suggestedScore} / {questionMaximums[index]} điểm
                                          </p>
                                        )}
                                        {advice.explanation && (
                                          <MathText
                                            text={advice.explanation}
                                            compact
                                            className="[&_.katex-display]:my-1 [&_.katex-display]:overflow-x-auto"
                                          />
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
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
                        <button
                          type="button"
                          onClick={() => void saveGrade()}
                          disabled={saving || (parsedAssignment ? !allQuestionsScored : score.trim() === '')}
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
