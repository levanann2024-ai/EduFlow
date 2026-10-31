import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Clock3, FileImage, FileText, X } from 'lucide-react';
import { MathText } from '@/components/MathText';
import { TeacherExamSubmissionFiles } from '@/components/TeacherExamSubmissionFiles';
import {
  getTeacherExamRoomGrading,
  listTeacherExamRooms,
  publishTeacherExamRoomGrades,
  saveTeacherExamSessionGrade,
  type TeacherExamGradingQuestion,
  type TeacherExamGradingRoom,
  type TeacherExamGradingStudent,
} from '@/api/schoolApi';

interface LoadedExam {
  room: TeacherExamGradingRoom;
  students: TeacherExamGradingStudent[];
}

const examSections: Array<{
  type: TeacherExamGradingQuestion['type'];
  title: string;
  instruction: string;
}> = [
  {
    type: 'multiple-choice',
    title: 'Phần I: Trắc nghiệm nhiều phương án chọn',
    instruction: 'Thí sinh chọn một phương án đúng cho mỗi câu.',
  },
  {
    type: 'true-false',
    title: 'Phần II: Trắc nghiệm đúng sai',
    instruction: 'Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.',
  },
  {
    type: 'short-answer',
    title: 'Phần III: Trắc nghiệm trả lời ngắn',
    instruction: 'Thí sinh ghi câu trả lời ngắn cho từng câu.',
  },
  {
    type: 'essay',
    title: 'Phần IV: Tự luận',
    instruction: 'Giáo viên chấm phần này dựa trên bài làm và hướng dẫn chấm.',
  },
];

function isAutomaticallyGraded(question: TeacherExamGradingQuestion) {
  return question.type !== 'essay';
}

function scoreInputsForStudent(
  questions: TeacherExamGradingQuestion[],
  student: TeacherExamGradingStudent | undefined,
) {
  if (!student) return {};
  const scores = student.grade?.questionScores ?? student.automaticScores;
  return Object.fromEntries(questions.map((question, index) => {
    const key = getQuestionId(question, index);
    return [key, scores[key] === undefined ? '' : String(scores[key])];
  }));
}

function questionFeedbackForStudent(
  questions: TeacherExamGradingQuestion[],
  student: TeacherExamGradingStudent | undefined,
) {
  return Object.fromEntries(questions.flatMap((question, index) => {
    if (question.type !== 'essay') return [];
    const key = getQuestionId(question, index);
    return [[key, student?.grade?.questionFeedback[key] ?? '']];
  }));
}

function formatCorrectAnswer(question: TeacherExamGradingQuestion) {
  if (question.type === 'multiple-choice') {
    const correctIndex = Number.isInteger(question.correctIndex)
      ? question.correctIndex
      : question.options.indexOf(question.correctAnswer);
    const answer = question.options[correctIndex];
    return answer === undefined
      ? question.correctAnswer
      : `${String.fromCharCode(65 + correctIndex)}. ${answer}`;
  }
  if (question.type === 'true-false') {
    return question.options
      .map((statement, index) => (
        `${String.fromCharCode(97 + index)}. ${statement} — ${question.correctAnswers?.[index] ? 'Đúng' : 'Sai'}`
      ))
      .join('\n');
  }
  return question.correctAnswer;
}

function formatPoints(points: number) {
  return Number(points.toFixed(2)).toString();
}

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

function getQuestionId(question: TeacherExamGradingQuestion, index: number) {
  return question.id || `question-${index + 1}`;
}

function answerText(
  question: TeacherExamGradingQuestion,
  index: number,
  answers: Record<string, string>,
) {
  const rawAnswer = answers[String(index + 1)] ?? '';
  if (!rawAnswer) return 'Học sinh chưa trả lời câu này.';
  if (question.type === 'multiple-choice') {
    const optionIndex = Number(rawAnswer);
    if (Number.isInteger(optionIndex) && question.options[optionIndex] !== undefined) {
      return `${String.fromCharCode(65 + optionIndex)}. ${question.options[optionIndex]}`;
    }
  }
  if (question.type === 'true-false') {
    try {
      const selected = JSON.parse(rawAnswer) as Record<string, string>;
      if (selected && typeof selected === 'object' && !Array.isArray(selected)) {
        const statements = question.options
          .map((statement, statementIndex) => {
            const value = selected[String(statementIndex)];
            return value
              ? `${String.fromCharCode(97 + statementIndex)}. ${statement} — ${value}`
              : '';
          })
          .filter(Boolean);
        if (statements.length > 0) return statements.join('\n');
      }
    } catch {
      return rawAnswer;
    }
  }
  return rawAnswer;
}

export function ExamGradingWorkspace() {
  const [exams, setExams] = useState<LoadedExam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [questionFeedbackInputs, setQuestionFeedbackInputs] = useState<Record<string, string>>({});
  const [newEvidenceFiles, setNewEvidenceFiles] = useState<Array<{ questionId: string; file: File }>>([]);
  const [deletedEvidenceIds, setDeletedEvidenceIds] = useState<string[]>([]);
  const evidenceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [notice, setNotice] = useState('');
  const selectedExamIdRef = useRef('');
  const selectedStudentIdRef = useRef('');

  useEffect(() => {
    let active = true;
    let refreshing = false;
    async function loadExams(initial = false) {
      if (refreshing) return;
      refreshing = true;
      try {
        const rooms = await listTeacherExamRooms<TeacherExamGradingRoom>();
        const details = await Promise.all(rooms.map((room) => getTeacherExamRoomGrading(room.id)));
        if (!active) return;
        const loaded = details.map(({ room, students }) => ({ room, students }));
        loaded.sort((first, second) => {
          const firstGraded = first.students.filter((student) => student.grade).length;
          const secondGraded = second.students.filter((student) => student.grade).length;
          return firstGraded - secondGraded || first.room.title.localeCompare(second.room.title, 'vi');
        });
        setExams(loaded);
        setSyncError('');
        const selectedExam = loaded.find((exam) => exam.room.id === selectedExamIdRef.current) ?? loaded[0];
        const selectedExamId = selectedExam?.room.id ?? '';
        const currentStudent = selectedExam?.students.find(
          (student) => student.studentId === selectedStudentIdRef.current,
        );
        const selectedStudent = currentStudent ?? selectedExam?.students
          .filter((student) => student.status === 'submitted')
          .sort((first, second) => Number(Boolean(first.grade)) - Number(Boolean(second.grade)))[0];
        const selectedStudentId = selectedStudent?.studentId ?? '';
        if (initial || selectedExamId !== selectedExamIdRef.current) {
          setSelectedExamId(selectedExamId);
          selectedExamIdRef.current = selectedExamId;
        }
        if (initial || selectedStudentId !== selectedStudentIdRef.current) {
          setSelectedStudentId(selectedStudentId);
          selectedStudentIdRef.current = selectedStudentId;
          setScoreInputs(scoreInputsForStudent(selectedExam?.room.examSnapshot.questions ?? [], selectedStudent));
          setFeedback(selectedStudent?.grade?.teacherFeedback ?? '');
          setQuestionFeedbackInputs(questionFeedbackForStudent(
            selectedExam?.room.examSnapshot.questions ?? [],
            selectedStudent,
          ));
          setNewEvidenceFiles([]);
          setDeletedEvidenceIds([]);
        }
      } catch (loadError: unknown) {
        if (active) {
          const message = loadError instanceof Error ? loadError.message : 'Không thể tải bài thi cần chấm.';
          setSyncError(message);
        }
      } finally {
        refreshing = false;
        if (active && initial) setLoading(false);
      }
    }
    void loadExams(true);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadExams();
    }, 5000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadExams();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const selectedExam = exams.find((exam) => exam.room.id === selectedExamId) ?? null;
  const submittedStudents = useMemo(
    () => selectedExam?.students.filter((student) => student.status === 'submitted') ?? [],
    [selectedExam],
  );
  const sortedStudents = useMemo(() => [...(selectedExam?.students ?? [])].sort((first, second) => {
    const priority = (student: TeacherExamGradingStudent) => (
      student.status !== 'submitted' ? 0 : student.grade ? 2 : 1
    );
    return priority(first) - priority(second)
      || first.studentName.localeCompare(second.studentName, 'vi');
  }), [selectedExam]);
  const gradedCount = submittedStudents.filter((student) => student.grade).length;
  const publishedCount = submittedStudents.filter((student) => student.grade?.publishedAt).length;
  const gradesToPublish = gradedCount - publishedCount;
  const selectedStudent = selectedExam?.students.find((student) => student.studentId === selectedStudentId) ?? null;
  const questions = selectedExam?.room.examSnapshot.questions ?? [];
  const groupedQuestions = examSections.map((section) => ({
    ...section,
    questions: questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => question.type === section.type),
  }));
  const totalPoints = questions.reduce((total, question) => total + question.points, 0);
  const currentTotal = questions.reduce((total, question, index) => {
    const score = Number(scoreInputs[getQuestionId(question, index)]);
    return total + (Number.isFinite(score) ? score : 0);
  }, 0);
  const allQuestionsScored = questions.length > 0 && questions.every((question, index) => {
    const score = scoreInputs[getQuestionId(question, index)];
    return score !== undefined && score.trim() !== '' && Number.isFinite(Number(score));
  });
  const gradeOutOfTen = totalPoints ? (currentTotal / totalPoints) * 10 : 0;

  function chooseExam(exam: LoadedExam) {
    selectedExamIdRef.current = exam.room.id;
    setSelectedExamId(exam.room.id);
    const firstToGrade = exam.students
      .filter((student) => student.status === 'submitted')
      .sort((first, second) => Number(Boolean(first.grade)) - Number(Boolean(second.grade)))[0];
    selectedStudentIdRef.current = firstToGrade?.studentId ?? '';
    setSelectedStudentId(selectedStudentIdRef.current);
    setScoreInputs(scoreInputsForStudent(exam.room.examSnapshot.questions, firstToGrade));
    setFeedback(firstToGrade?.grade?.teacherFeedback ?? '');
    setQuestionFeedbackInputs(questionFeedbackForStudent(exam.room.examSnapshot.questions, firstToGrade));
    setNewEvidenceFiles([]);
    setDeletedEvidenceIds([]);
    setError('');
    setNotice('');
  }

  function chooseStudent(student: TeacherExamGradingStudent) {
    selectedStudentIdRef.current = student.studentId;
    setSelectedStudentId(student.studentId);
    setScoreInputs(scoreInputsForStudent(questions, student));
    setFeedback(student.grade?.teacherFeedback ?? '');
    setQuestionFeedbackInputs(questionFeedbackForStudent(questions, student));
    setNewEvidenceFiles([]);
    setDeletedEvidenceIds([]);
    setError('');
    setNotice('');
  }

  async function saveGrade() {
    if (!selectedExam || !selectedStudent?.sessionId || !allQuestionsScored || saving) return;
    const questionScores = Object.fromEntries(questions.map((question, index) => [
      getQuestionId(question, index),
      Number(scoreInputs[getQuestionId(question, index)]),
    ]));
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const grade = await saveTeacherExamSessionGrade(
        selectedExam.room.id,
        selectedStudent.sessionId,
        {
          questionScores,
          questionFeedback: questionFeedbackInputs,
          teacherFeedback: feedback,
          evidenceFiles: newEvidenceFiles,
          deletedEvidenceIds,
        },
      );
      setExams((current) => current.map((exam) => exam.room.id !== selectedExam.room.id
        ? exam
        : {
          ...exam,
          students: exam.students.map((student) => student.studentId === selectedStudent.studentId
            ? { ...student, grade }
            : student),
        }));
      setNewEvidenceFiles([]);
      setDeletedEvidenceIds([]);
      setNotice('Đã lưu điểm, lời phê và ảnh minh chứng.');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu điểm bài thi.');
    } finally {
      setSaving(false);
    }
  }

  async function publishGrades() {
    if (!selectedExam || gradesToPublish <= 0 || publishing) return;
    setPublishing(true);
    setError('');
    setNotice('');
    try {
      const publication = await publishTeacherExamRoomGrades(selectedExam.room.id);
      setExams((current) => current.map((exam) => exam.room.id !== selectedExam.room.id
        ? exam
        : {
          ...exam,
          students: exam.students.map((student) => (
            student.grade && !student.grade.publishedAt
              ? { ...student, grade: { ...student.grade, publishedAt: publication.publishedAt } }
              : student
          )),
        }));
      setNotice(`Đã công bố điểm cho ${publication.publishedCount} học sinh.`);
    } catch (publishError: unknown) {
      setError(publishError instanceof Error ? publishError.message : 'Không thể công bố điểm bài thi.');
    } finally {
      setPublishing(false);
    }
  }

  function formatAnswer(question: TeacherExamGradingQuestion, index: number) {
    return answerText(question, index, selectedStudent?.answers ?? {});
  }

  function updateScore(question: TeacherExamGradingQuestion, index: number, raw: string) {
    if (raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > question.points)) return;
    setScoreInputs((current) => ({ ...current, [getQuestionId(question, index)]: raw }));
    setNotice('');
  }

  return (
    <section className="space-y-4">
      {(error || syncError) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || syncError}</p>}
      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Đang tải dữ liệu bài thi và bài nộp...</p>
      ) : exams.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <FileText className="h-9 w-9 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">Chưa có phòng thi được giao</p>
          <p className="mt-1 text-sm text-slate-500">Các phòng thi và bài nộp của học sinh sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {exams.map((exam) => {
              const submitted = exam.students.filter((student) => student.status === 'submitted').length;
              const graded = exam.students.filter((student) => student.grade).length;
              return (
                <button
                  key={exam.room.id}
                  type="button"
                  aria-pressed={selectedExam?.room.id === exam.room.id}
                  onClick={() => chooseExam(exam)}
                  className={`min-w-52 rounded-xl border p-3 text-left transition ${selectedExam?.room.id === exam.room.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className="block truncate text-sm font-bold text-slate-900">{exam.room.title}</span>
                  <span className="mt-1 block text-xs font-medium text-slate-600">
                    {submitted}/{exam.students.length} bài nộp · {graded}/{exam.students.length} bài đã chấm
                  </span>
                </button>
              );
            })}
          </div>

          {selectedExam && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold text-slate-900">Công bố điểm cho học sinh</p>
                <p className="mt-1 text-sm text-slate-500">
                  {gradedCount} bài đã chấm · {publishedCount} bài đã công bố
                  {gradesToPublish > 0 ? ` · ${gradesToPublish} bài sẵn sàng công bố` : ''}
                </p>
              </div>
              {gradesToPublish > 0 ? (
                <button
                  type="button"
                  disabled={publishing}
                  onClick={() => void publishGrades()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {publishing ? <Clock3 className="h-4 w-4 animate-pulse" /> : <CheckCircle2 className="h-4 w-4" />}
                  {publishing ? 'Đang công bố...' : 'Công bố điểm'}
                </button>
              ) : publishedCount > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" /> Đã công bố
                </span>
              ) : (
                <span className="text-sm text-slate-500">Chưa có bài nào sẵn sàng công bố.</span>
              )}
            </section>
          )}
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

          <div className="grid min-h-[560px] gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <main className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {!selectedStudent || selectedStudent.status !== 'submitted' ? (
                <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                  <FileText className="h-9 w-9 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-700">Chọn bài đã nộp để chấm</p>
                </div>
              ) : (
                <div className="space-y-4 p-4 sm:p-5">
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{selectedStudent.studentName}</h3>

                  {groupedQuestions.filter((section) => section.questions.length > 0).map((section) => (
                    <section key={section.type} className="space-y-3">
                      <header className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                        <h4 className="font-extrabold text-slate-900">
                          {section.title} ({formatPoints(section.questions.reduce((total, item) => total + item.question.points, 0))} điểm)
                        </h4>
                        <p className="mt-1 text-sm font-semibold text-slate-700">{section.instruction}</p>
                      </header>
                      {section.questions.map(({ question, index }) => {
                        const answerIsWrong = isAutomaticallyGraded(question)
                          && (selectedStudent.automaticScores[getQuestionId(question, index)] ?? 0) < question.points;
                        return (
                    <article key={getQuestionId(question, index)} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-blue-700">Câu {index + 1} · {formatPoints(question.points)} điểm</p>
                          <div className="mt-1 font-semibold leading-6 text-slate-900">
                            <MathText text={question.question} />
                          </div>
                          <div className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-sm leading-6 ${
                            answerIsWrong ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-700'
                          }`}>
                            <div className="min-w-0 flex-1">
                              <MathText text={formatAnswer(question, index)} />
                            </div>
                            {answerIsWrong && (
                              <span className="shrink-0 font-extrabold text-rose-800">SAI</span>
                            )}
                          </div>
                          {answerIsWrong && (
                            <div className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">
                              <span className="font-bold">Đáp án đúng: </span>
                              <MathText text={formatCorrectAnswer(question)} />
                            </div>
                          )}
                          {selectedStudent.sessionId && selectedExam && (
                            <TeacherExamSubmissionFiles
                              roomId={selectedExam.room.id}
                              sessionId={selectedStudent.sessionId}
                              files={selectedStudent.files.filter((file) => file.questionNumber === index + 1)}
                            />
                          )}
                          {question.type === 'essay' && (
                            <div className="mt-4 space-y-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                              <label className="block text-xs font-semibold text-slate-700">
                                Lời phê câu {index + 1}
                                <textarea
                                  rows={2}
                                  maxLength={5000}
                                  value={questionFeedbackInputs[getQuestionId(question, index)] ?? ''}
                                  onChange={(event) => setQuestionFeedbackInputs((current) => ({
                                    ...current,
                                    [getQuestionId(question, index)]: event.target.value,
                                  }))}
                                  placeholder="Nhận xét riêng cho câu tự luận này..."
                                  className="input-field mt-1.5 w-full resize-y p-3 font-normal"
                                />
                              </label>
                              {selectedStudent.sessionId && selectedExam && (
                                <TeacherExamSubmissionFiles
                                  roomId={selectedExam.room.id}
                                  sessionId={selectedStudent.sessionId}
                                  heading={`Ảnh minh chứng câu ${index + 1}`}
                                  files={(selectedStudent.grade?.evidenceFiles ?? []).filter((file) => (
                                    file.questionId === getQuestionId(question, index)
                                    && !deletedEvidenceIds.includes(file.id)
                                  ))}
                                  onRemoveFile={(fileId) => setDeletedEvidenceIds((current) => (
                                    current.includes(fileId) ? current : [...current, fileId]
                                  ))}
                                />
                              )}
                              <div className="space-y-2">
                                {newEvidenceFiles
                                  .map((entry, fileIndex) => ({ ...entry, fileIndex }))
                                  .filter((entry) => entry.questionId === getQuestionId(question, index))
                                  .map(({ file, fileIndex }) => (
                                    <div key={`${file.name}-${file.lastModified}-${fileIndex}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                      <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-slate-700">
                                        <FileImage className="h-4 w-4 shrink-0 text-blue-700" />
                                        <span className="truncate">{file.name}</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setNewEvidenceFiles((current) => current.filter(
                                          (entry) => entry.file !== file || entry.questionId !== getQuestionId(question, index),
                                        ))}
                                        aria-label={`Xóa ảnh minh chứng ${file.name}`}
                                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                <input
                                  ref={(element) => { evidenceInputRefs.current[getQuestionId(question, index)] = element; }}
                                  type="file"
                                  accept="image/jpeg,image/png,image/gif,image/webp"
                                  multiple
                                  className="hidden"
                                  aria-label={`Chọn ảnh minh chứng câu ${index + 1}`}
                                  onChange={(event) => {
                                    const chosenFiles = Array.from(event.currentTarget.files ?? []);
                                    const savedCount = (selectedStudent.grade?.evidenceFiles.length ?? 0)
                                      - deletedEvidenceIds.length;
                                    if (savedCount + newEvidenceFiles.length + chosenFiles.length > 5) {
                                      setError('Mỗi bài thi được lưu tối đa 5 ảnh minh chứng.');
                                    } else {
                                      setNewEvidenceFiles((current) => [
                                        ...current,
                                        ...chosenFiles.map((file) => ({
                                          questionId: getQuestionId(question, index),
                                          file,
                                        })),
                                      ]);
                                      setError('');
                                    }
                                    event.currentTarget.value = '';
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => evidenceInputRefs.current[getQuestionId(question, index)]?.click()}
                                  className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                >
                                  <FileImage className="h-4 w-4" />
                                  Thêm ảnh minh chứng
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <input
                            type="number"
                            aria-label={`Điểm câu ${index + 1}`}
                            min="0"
                            max={question.points}
                            step="0.01"
                            value={scoreInputs[getQuestionId(question, index)] ?? ''}
                            onChange={(event) => updateScore(question, index, event.target.value)}
                            disabled={isAutomaticallyGraded(question)}
                            className="input-field min-h-12 w-28 px-3 text-lg font-bold"
                          />
                          <span className="text-lg font-semibold text-slate-600">/ {formatPoints(question.points)}</span>
                        </div>
                      </div>
                    </article>
                        );
                      })}
                    </section>
                  ))}

                  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-600">Điểm tổng</p>
                        <p className="mt-1 text-5xl font-black leading-none tracking-tight" style={{ color: scoreColor(gradeOutOfTen) }}>
                          {currentTotal.toFixed(2).replace(/\.?0+$/, '')}
                          <span className="ml-1 text-2xl font-bold text-slate-400">/ {totalPoints}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500">Quy đổi thang 10</p>
                        <p className="text-2xl font-extrabold" style={{ color: scoreColor(gradeOutOfTen) }}>{gradeOutOfTen.toFixed(1)}</p>
                      </div>
                    </div>
                  </section>

                  <label className="block text-sm font-semibold text-slate-700">
                    Nhận xét cho học sinh
                    <textarea
                      rows={3}
                      value={feedback}
                      onChange={(event) => setFeedback(event.target.value)}
                      placeholder="Ghi nhận xét về bài làm..."
                      className="input-field mt-1.5 w-full resize-y p-3 font-normal"
                    />
                  </label>
                  {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
                  <button
                    type="button"
                    disabled={!allQuestionsScored || saving}
                    onClick={() => void saveGrade()}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? <Clock3 className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
                    {saving ? 'Đang lưu...' : 'Lưu điểm'}
                  </button>
                </div>
              )}
            </main>

            <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <header className="border-b border-slate-100 p-4">
                <h3 className="font-semibold text-slate-900">Danh sách học sinh</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {submittedStudents.length}/{selectedExam?.students.length ?? 0} bài nộp · {gradedCount}/{selectedExam?.students.length ?? 0} bài đã chấm
                </p>
              </header>
              <nav aria-label="Danh sách bài làm học sinh" className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
                {sortedStudents.map((student) => {
                  const submitted = student.status === 'submitted';
                  const selected = student.studentId === selectedStudentId;
                  return (
                    <button
                      key={student.studentId}
                      type="button"
                      disabled={!submitted}
                      aria-pressed={selected}
                      onClick={() => chooseStudent(student)}
                      className={`w-full p-3 text-left transition ${selected ? 'border-l-2 border-blue-700 bg-blue-50' : submitted ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-60'}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        {student.grade
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          : <Clock3 className={`h-4 w-4 shrink-0 ${submitted ? 'text-amber-600' : 'text-slate-400'}`} />}
                        <span className="truncate">{student.studentName}</span>
                      </span>
                      <span className="mt-1 block pl-6 text-xs text-slate-500">
                        {!student.sessionId ? 'Chưa làm' : !submitted ? 'Đang làm' : student.grade ? 'Đã chấm' : 'Chưa chấm'}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
