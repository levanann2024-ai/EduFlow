import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileCheck2, FileText, Plus, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import {
  defaultAssessmentSections,
  normalizeAssessmentSections,
  type AssessmentSection,
  type ExamQuestion,
  type ExamQuestionType,
  type SavedExam,
} from '@/pages/teacher/assessmentStorage';

const questionTypeLabels: Record<ExamQuestionType, string> = {
  'multiple-choice': 'Trắc nghiệm ABCD',
  'true-false': 'Đúng / Sai',
  'short-answer': 'Trả lời ngắn',
  essay: 'Tự luận',
};

const romanNumbers = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function pointsForType(type: ExamQuestionType) {
  if (type === 'multiple-choice') return 0.25;
  if (type === 'true-false') return 1;
  if (type === 'short-answer') return 0.5;
  return 2;
}

function createQuestion(type: ExamQuestionType, index: number): ExamQuestion {
  const options = type === 'multiple-choice'
    ? ['', '', '', '']
    : type === 'true-false'
      ? ['', '', '', '']
      : [];
  return {
    id: `question-${Date.now()}-${index}`,
    type,
    question: '',
    options,
    correctIndex: 0,
    correctAnswer: '',
    ...(type === 'true-false' ? { correctAnswers: [false, false, false, false] } : {}),
    explanation: '',
    difficulty: 'medium',
    points: pointsForType(type),
  };
}

function editableExam(exam: SavedExam): SavedExam {
  const questions = exam.questions.map((question) => ({ ...question, options: [...question.options] }));
  return { ...exam, questions, sections: normalizeAssessmentSections(questions, exam.sections) };
}

export function ExamEditor({
  exam,
  kind = 'exam',
  onClose,
  onSave,
}: {
  exam: SavedExam;
  kind?: 'exam' | 'assignment';
  onClose: () => void;
  onSave: (updated: SavedExam, status: 'draft' | 'ready') => void;
}) {
  const originalEditableExam = useMemo(() => editableExam(exam), [exam]);
  const [workingExam, setWorkingExam] = useState<SavedExam>(() => editableExam(exam));
  const [selectedId, setSelectedId] = useState(workingExam.questions[0]?.id ?? null);
  const [selectedSectionId, setSelectedSectionId] = useState(() => (
    workingExam.sections?.find((section) => section.questionIds.includes(workingExam.questions[0]?.id ?? ''))?.id
    ?? workingExam.sections?.[0]?.id
    ?? null
  ));
  const [preview, setPreview] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [focusedOption, setFocusedOption] = useState<string | null>(null);
  const [sectionPointInputs, setSectionPointInputs] = useState<Record<string, string>>({});
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const optionInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const sectionListRef = useRef<HTMLDivElement>(null);
  const pendingSectionScrollId = useRef<string | null>(null);
  const selectedQuestion = workingExam.questions.find((question) => question.id === selectedId) ?? null;
  const totalPoints = useMemo(() => workingExam.questions.reduce((total, question) => total + Math.max(0, question.points), 0), [workingExam.questions]);
  const hasUnsavedChanges = JSON.stringify(workingExam) !== JSON.stringify(originalEditableExam);
  const assessmentLabel = kind === 'assignment' ? 'bài tập' : 'đề';
  const readyLabel = kind === 'assignment' ? 'Sẵn sàng giao' : 'Sẵn sàng sử dụng';
  const sections = workingExam.sections ?? defaultAssessmentSections(workingExam.questions);
  const selectedQuestionSectionId = selectedQuestion
    ? sections.find((section) => section.questionIds.includes(selectedQuestion.id))?.id ?? ''
    : '';

  useEffect(() => {
    setSectionPointInputs(Object.fromEntries(sections.map((section) => [
      section.id,
      String(Number(workingExam.questions
        .filter((question) => section.questionIds.includes(question.id))
        .reduce((total, question) => total + question.points, 0)
        .toFixed(4))),
    ])));
  }, [sections, workingExam.questions]);

  useEffect(() => {
    if (focusedOption) optionInputs.current[focusedOption]?.focus();
  }, [focusedOption]);

  useEffect(() => {
    const sectionId = pendingSectionScrollId.current;
    if (!sectionId) return;
    pendingSectionScrollId.current = null;
    sectionListRef.current
      ?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [sections.length, workingExam.questions.length]);

  const closeEditor = () => {
    if (hasUnsavedChanges && !window.confirm('Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?')) return;
    onClose();
  };

  const updateQuestion = (questionId: string, patch: Partial<ExamQuestion>) => {
    setWorkingExam((current) => ({
      ...current,
      questions: current.questions.map((question) => question.id === questionId
        ? { ...question, ...patch }
        : question),
    }));
  };

  const distributeSectionPoints = (section: AssessmentSection, value: string) => {
    const total = Number(value.replace(',', '.'));
    const questionCount = section.questionIds.length;
    if (!Number.isFinite(total) || total < 0 || questionCount === 0) return;
    const pointsPerQuestion = total / questionCount;
    setWorkingExam((current) => ({
      ...current,
      questions: current.questions.map((question) => (
        section.questionIds.includes(question.id) ? { ...question, points: pointsPerQuestion } : question
      )),
    }));
    setSectionPointInputs((current) => ({ ...current, [section.id]: String(total) }));
  };

  const changeQuestionType = (type: ExamQuestionType) => {
    if (!selectedQuestion) return;
    const section = sections.find((item) => item.questionIds.includes(selectedQuestion.id));
    if (!section) return;
    const otherQuestions = section.questionIds.filter((id) => id !== selectedQuestion.id);
    if (otherQuestions.some((id) => workingExam.questions.find((question) => question.id === id)?.type !== type)) {
      setValidationError('Mỗi phần chỉ chứa một loại câu hỏi. Hãy tạo phần riêng cho dạng câu hỏi khác.');
      return;
    }
    const replacement = createQuestion(type, workingExam.questions.indexOf(selectedQuestion));
    updateQuestion(selectedQuestion.id, { ...replacement, id: selectedQuestion.id });
    updateSection(section.id, { questionType: type });
    setValidationError('');
  };

  const addQuestionOfType = (sectionId: string) => {
    const section = sections.find((item) => item.id === sectionId);
    if (!section) return;
    const type = section.questionType ?? 'multiple-choice';
    const question = createQuestion(type, workingExam.questions.length);
    const sectionQuestions = workingExam.questions.filter((item) => section.questionIds.includes(item.id));
    const previousCount = sectionQuestions.length;
    const sectionTotal = sectionQuestions.reduce((total, item) => total + item.points, 0);
    const points = previousCount > 0
      ? sectionTotal / (previousCount + 1)
      : pointsForType(type);
    setWorkingExam((current) => ({
      ...current,
      sections: (current.sections ?? []).map((item) => item.id === sectionId
        ? { ...item, questionIds: [...item.questionIds, question.id] }
        : item),
      questions: [
        ...current.questions.map((item) => (
          section.questionIds.includes(item.id) && previousCount > 0 ? { ...item, points } : item
        )),
        { ...question, points },
      ],
    }));
    if (section.questionIds.length === 0 && section.title === 'Phần I: Tự luận') {
      setWorkingExam((current) => ({
        ...current,
        sections: (current.sections ?? []).map((item) => item.id === sectionId
          ? { ...item, title: `Phần I: ${questionTypeLabels[type]}` }
          : item),
      }));
    }
    setSelectedId(question.id);
    setSelectedSectionId(sectionId);
    pendingSectionScrollId.current = sectionId;
    setPreview(false);
  };

  const removeQuestion = (questionId: string) => {
    const nextQuestions = workingExam.questions.filter((question) => question.id !== questionId);
    setWorkingExam((current) => ({
      ...current,
      questions: nextQuestions,
      sections: (current.sections ?? []).map((section) => ({
        ...section,
        questionIds: section.questionIds.filter((id) => id !== questionId),
      })),
    }));
    setSelectedId(nextQuestions[0]?.id ?? null);
  };

  const groupedQuestions = sections.map((section) => ({
    ...section,
    questions: section.questionIds.flatMap((id) => {
      const question = workingExam.questions.find((item) => item.id === id);
      return question ? [question] : [];
    }),
  }));
  const questionNumber = (question: ExamQuestion) => {
    const section = groupedQuestions.find((item) => item.questionIds.includes(question.id));
    return section ? section.questions.findIndex((item) => item.id === question.id) + 1 : 0;
  };

  const addSection = () => {
    const id = `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const section: AssessmentSection = {
      id,
      title: `Phần ${romanNumbers[sections.length] ?? sections.length + 1}: Phần mới`,
      description: '',
      questionIds: [],
      questionType: 'multiple-choice',
    };
    setWorkingExam((current) => ({ ...current, sections: [...(current.sections ?? []), section] }));
    setSelectedSectionId(id);
    pendingSectionScrollId.current = id;
  };

  const removeSection = (section: AssessmentSection) => {
    if (sections.length <= 1) return;
    const target = sections.find((item) => item.id !== section.id);
    if (!target) return;
    if (section.questionIds.length > 0
      && !window.confirm(`Xóa "${section.title}" và chuyển ${section.questionIds.length} câu sang "${target.title}"?`)) return;
    setWorkingExam((current) => ({
      ...current,
      sections: (current.sections ?? [])
        .filter((item) => item.id !== section.id)
        .map((item) => item.id === target.id
          ? { ...item, questionIds: [...item.questionIds, ...section.questionIds] }
          : item),
    }));
    if (selectedSectionId === section.id) setSelectedSectionId(target.id);
  };

  const moveQuestionToSection = (questionId: string, sectionId: string) => {
    const question = workingExam.questions.find((item) => item.id === questionId);
    const targetSection = sections.find((section) => section.id === sectionId);
    if (!question || !targetSection || targetSection.questionType !== question.type) {
      setValidationError('Chỉ có thể chuyển câu hỏi vào phần cùng loại câu hỏi.');
      return;
    }
    setWorkingExam((current) => ({
      ...current,
      sections: (current.sections ?? []).map((section) => ({
        ...section,
        questionIds: section.id === sectionId
          ? [...section.questionIds.filter((id) => id !== questionId), questionId]
          : section.questionIds.filter((id) => id !== questionId),
      })),
    }));
    setSelectedSectionId(sectionId);
    setValidationError('');
  };

  const updateSection = (sectionId: string, patch: Partial<AssessmentSection>) => {
    setWorkingExam((current) => ({
      ...current,
      sections: (current.sections ?? []).map((section) => section.id === sectionId
        ? { ...section, ...patch }
        : section),
    }));
  };

  const save = (status: 'draft' | 'ready') => {
    if (!workingExam.title.trim()) {
      setValidationError(`Hãy nhập tên ${assessmentLabel} trước khi lưu.`);
      return;
    }
    if (sections.some((section) => !section.title.trim() || section.title.length > 160 || section.description.length > 2000)) {
      setValidationError('Mỗi phần cần có tiêu đề tối đa 160 ký tự; hướng dẫn không được vượt quá 2.000 ký tự.');
      return;
    }
    if (status === 'ready') {
      const incompleteIndex = workingExam.questions.findIndex((question) => (
        !question.question.trim()
        || question.points <= 0
        || (question.type === 'multiple-choice' && (question.options.length !== 4 || question.options.some((option) => !option.trim()) || question.correctIndex < 0 || question.correctIndex >= 4))
        || (question.type === 'true-false' && (question.options.length !== 4 || question.options.some((option) => !option.trim()) || question.correctAnswers?.length !== 4))
        || ((question.type === 'short-answer' || question.type === 'essay') && !question.correctAnswer.trim())
      ));
      if (incompleteIndex >= 0) {
        setValidationError(`Câu ${questionNumber(workingExam.questions[incompleteIndex])} còn thiếu nội dung, đáp án hoặc điểm. Hoàn thiện trước khi xác nhận ${assessmentLabel}.`);
        setSelectedId(workingExam.questions[incompleteIndex].id);
        return;
      }
      if (kind === 'exam' && Math.abs(totalPoints - 10) > 0.000001) {
        setValidationError(`Tổng điểm đề thi hiện là ${Number(totalPoints.toFixed(2))}; cần phân bổ đúng 10 điểm trước khi xác nhận.`);
        return;
      }
      if (workingExam.questions.length === 0) {
        setValidationError(`${kind === 'assignment' ? 'Bài tập' : 'Đề'} cần có ít nhất một câu hỏi để chuyển sang trạng thái sẵn sàng.`);
        return;
      }
    }
    setValidationError('');
    onSave({
      ...workingExam,
      sectionPoints: undefined,
    }, status);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 sm:p-6" onClick={closeEditor}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-editor-title"
        onClick={(event) => event.stopPropagation()}
        className="flex h-[calc(100dvh-120px)] max-h-[calc(100dvh-120px)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="exam-editor-title" className="truncate text-lg font-semibold text-slate-950">{workingExam.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPreview((current) => !current)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${preview ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <Eye className="h-4 w-4" /> {preview ? 'Quay lại chỉnh sửa' : 'Xem trước học sinh'}
            </button>
            {!preview && (
              <button onClick={() => save('ready')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                <FileCheck2 className="h-4 w-4" /> {readyLabel}
              </button>
            )}
            <button onClick={closeEditor} aria-label="Đóng trình chỉnh sửa" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
        </header>

        {preview ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <h1 className="text-center text-xl font-bold text-slate-950">{workingExam.title}</h1>
              <p className="mt-2 text-center text-sm text-slate-500">
                {[kind === 'assignment' ? workingExam.subject : '', workingExam.grade, workingExam.durationMinutes ? `${workingExam.durationMinutes} phút` : '']
                  .filter(Boolean)
                  .join(' - ')}
              </p>
              <p className="mt-1 text-center text-xs text-slate-500">{workingExam.questions.length} câu - {totalPoints} điểm</p>
              <div className="mt-6 space-y-6">
                {groupedQuestions.filter((section) => section.questions.length > 0).map((section) => (
                  <section key={section.id} className="space-y-4">
                    <header className="rounded-lg bg-slate-50 p-3">
                      <h2 className="font-bold text-slate-900">{section.title} ({section.questions.reduce((total, question) => total + question.points, 0)} điểm)</h2>
                      {section.description && <p className="mt-1 text-sm font-semibold text-slate-700">{section.description}</p>}
                    </header>
                    {section.questions.map((question) => (
                  <article key={question.id} className="border-b border-slate-100 pb-5 last:border-0">
                    <div className="font-medium leading-6 text-slate-900">
                      <MathText text={`Câu ${questionNumber(question)}. ${question.question || 'Chưa nhập nội dung câu hỏi'}`} />
                      <span className="ml-2 whitespace-nowrap text-xs font-normal text-slate-500">({question.points} điểm)</span>
                    </div>
                    {question.type === 'multiple-choice' && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <input type="radio" name={`preview-${question.id}`} className="accent-blue-700" />
                            <MathText text={`${String.fromCharCode(65 + optionIndex)}. ${option || '...'}`} />
                          </div>
                        ))}
                      </div>
                    )}
                    {question.type === 'true-false' && (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="grid grid-cols-[1fr_100px] items-center gap-2 text-sm text-slate-700">
                            <MathText text={`${String.fromCharCode(97 + optionIndex)}) ${option}`} />
                            <select defaultValue="" className="input-field h-9"><option value="" disabled>Chọn</option><option>Đúng</option><option>Sai</option></select>
                          </div>
                        ))}
                      </div>
                    )}
                    {(question.type === 'short-answer' || question.type === 'essay') && <div className={`mt-3 rounded-lg border border-dashed border-slate-300 ${question.type === 'essay' ? 'h-28' : 'h-10'}`} />}
                  </article>
                    ))}
                  </section>
                ))}
              </div>
            </article>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
            <aside className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Câu hỏi ({workingExam.questions.length})</h3>
                <button type="button" onClick={addSection} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100">
                  <Plus className="h-3 w-3" /> Thêm phần
                </button>
              </div>
              <div ref={sectionListRef} className="space-y-4">
                {groupedQuestions.map((section) => (
                  <section key={section.id} data-section-id={section.id}>
                    <header className="mb-1.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        {editingSectionId === section.id ? (
                          <input
                            autoFocus
                            value={section.title}
                            onChange={(event) => updateSection(section.id, { title: event.target.value })}
                            onBlur={() => setEditingSectionId(null)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                setEditingSectionId(null);
                              }
                            }}
                            aria-label="Tên phần"
                            className="input-field min-w-0 px-2 py-1 text-base font-bold text-blue-700"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingSectionId(section.id)}
                            aria-label={`Đổi tên ${section.title}`}
                            title={section.title}
                            className="min-w-0 flex-1 rounded-md border border-transparent px-0 py-1 text-left text-base font-bold leading-6 text-blue-700 hover:border-slate-200 hover:bg-white"
                          >
                            {section.title || `Phần ${romanNumbers[sections.findIndex((item) => item.id === section.id)] ?? sections.findIndex((item) => item.id === section.id) + 1}`}
                          </button>
                        )}
                        <button type="button" onClick={() => removeSection(section)} disabled={sections.length <= 1} aria-label={`Xóa ${section.title}`} className="mt-0.5 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        value={section.description}
                        onChange={(event) => updateSection(section.id, { description: event.target.value })}
                        placeholder="Hướng dẫn cho phần này"
                        aria-label="Hướng dẫn phần"
                        rows={2}
                        spellCheck={false}
                        className="w-full resize-y rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-700 outline-none hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                      <div className="space-y-1.5">
                        {section.questions.length === 0 ? (
                          <>
                            <label htmlFor={`question-type-${section.id}`} className="block text-sm font-bold text-slate-700">Loại câu hỏi</label>
                            <select
                              id={`question-type-${section.id}`}
                              value={section.questionType ?? 'multiple-choice'}
                              onChange={(event) => updateSection(section.id, { questionType: event.target.value as ExamQuestionType })}
                              aria-label={`Loại câu hỏi trong ${section.title}`}
                              className="input-field box-border h-10 min-h-10 w-full min-w-0 !py-0 !pl-3 !pr-8 text-sm leading-normal"
                            >
                              {Object.entries(questionTypeLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}
                            </select>
                          </>
                        ) : (
                          <div className="flex min-w-0 items-center gap-1 whitespace-nowrap py-1 text-sm">
                            <span className="shrink-0 font-bold text-slate-700">Loại câu hỏi:</span>
                            <span className="min-w-0 truncate font-semibold text-slate-800">{questionTypeLabels[section.questionType ?? 'multiple-choice']}</span>
                          </div>
                        )}
                      </div>
                      {kind === 'exam' ? (
                        <div className="flex items-center justify-between gap-2 py-1">
                          <label htmlFor={`section-points-${section.id}`} className="text-sm font-bold text-slate-700">Tổng điểm:</label>
                          <input
                            id={`section-points-${section.id}`}
                            type="number"
                            min={0}
                            max={10}
                            step={0.25}
                            value={sectionPointInputs[section.id] ?? '0'}
                            disabled={section.questions.length === 0}
                            onChange={(event) => setSectionPointInputs((current) => ({
                              ...current,
                              [section.id]: event.target.value,
                            }))}
                            onBlur={(event) => distributeSectionPoints(section, event.target.value)}
                            aria-label={`${section.title}, tổng điểm`}
                            className="input-field h-8 w-20 px-2 text-right text-sm font-semibold disabled:bg-slate-50"
                          />
                        </div>
                      ) : (
                        <p className="py-1 text-sm font-bold text-slate-700">
                          Tổng điểm: {Number(section.questions.reduce((total, question) => total + question.points, 0).toFixed(2))}
                        </p>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => addQuestionOfType(section.id)}
                          aria-label={`Thêm câu vào ${section.title}`}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
                        >
                          <Plus className="h-3 w-3" /> Thêm câu
                        </button>
                      </div>
                    </header>
                    <div className="space-y-1.5">
                    {section.questions.map((question) => (
                  <div key={question.id} className={`rounded-lg border p-2 ${selectedId === question.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100'}`}>
                    <button onClick={() => { setSelectedId(question.id); setSelectedSectionId(section.id); }} className="block w-full text-left">
                      <span className="block text-xs font-semibold text-slate-800">Câu {questionNumber(question)}</span>
                      <MathText
                        text={question.question || 'Chưa nhập nội dung'}
                        className="mt-1 block truncate text-xs text-slate-500"
                      />
                    </button>
                  </div>
                ))}
                    {section.questions.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-2 text-center text-[11px] text-slate-500">Chưa có câu hỏi</p>}
                    </div>
                  </section>
                ))}
              </div>
            </aside>

            <section className="min-h-0 min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4">
              {selectedQuestion ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-950">Chỉnh sửa câu hỏi {questionNumber(selectedQuestion)}</h3>
                    <button onClick={() => removeQuestion(selectedQuestion.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Xóa câu hỏi</button>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Dạng câu hỏi
                    <select value={selectedQuestion.type} onChange={(event) => changeQuestionType(event.target.value as ExamQuestionType)} className="input-field mt-1.5">
                      {Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Phần
                    <select
                      value={selectedQuestionSectionId}
                      onChange={(event) => moveQuestionToSection(selectedQuestion.id, event.target.value)}
                      className="input-field mt-1.5"
                    >
                      {sections.filter((section) => section.questionType === selectedQuestion.type)
                        .map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Nội dung câu hỏi
                    <textarea value={selectedQuestion.question} onChange={(event) => updateQuestion(selectedQuestion.id, { question: event.target.value })} rows={4} className="input-field mt-1.5 resize-y" />
                  </label>
                  <MathPreview value={selectedQuestion.question} />

                  {selectedQuestion.type === 'multiple-choice' && (
                    <fieldset className="space-y-2">
                      <legend className="mb-2 text-sm font-medium text-slate-700">Phương án - chọn đáp án đúng</legend>
                      {selectedQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${selectedQuestion.id}`} checked={selectedQuestion.correctIndex === index} onChange={() => updateQuestion(selectedQuestion.id, { correctIndex: index, correctAnswer: option })} aria-label={`Đặt phương án ${String.fromCharCode(65 + index)} là đáp án đúng`} className="accent-blue-700" />
                          <span className="w-5 text-sm text-slate-500">{String.fromCharCode(65 + index)}.</span>
                          <div className="min-w-0 flex-1">
                            {focusedOption === `${selectedQuestion.id}-${index}` ? (
                              <>
                                <input
                                  ref={(element) => { optionInputs.current[`${selectedQuestion.id}-${index}`] = element; }}
                                  value={option}
                                  onChange={(event) => {
                                    const options = [...selectedQuestion.options];
                                    options[index] = event.target.value;
                                    updateQuestion(selectedQuestion.id, {
                                      options,
                                      ...(selectedQuestion.correctIndex === index ? { correctAnswer: event.target.value } : {}),
                                    });
                                  }}
                                  onBlur={() => setFocusedOption(null)}
                                  className="input-field"
                                  aria-label={`Phương án ${String.fromCharCode(65 + index)}`}
                                />
                                <MathPreview value={option} compact />
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setFocusedOption(`${selectedQuestion.id}-${index}`)}
                                className="input-field min-h-10 w-full text-left"
                                aria-label={`Bấm để sửa phương án ${String.fromCharCode(65 + index)}`}
                              >
                                <MathText text={option || 'Nhấn để nhập phương án'} className="text-sm text-slate-800" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </fieldset>
                  )}

                  {selectedQuestion.type === 'true-false' && (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium text-slate-700">Các nhận định - chọn nhận định đúng</legend>
                      {selectedQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <select
                            value={selectedQuestion.correctAnswers?.[index] ? 'true' : 'false'}
                            onChange={(event) => {
                              const correctAnswers = [...(selectedQuestion.correctAnswers ?? selectedQuestion.options.map(() => false))];
                              correctAnswers[index] = event.target.value === 'true';
                              updateQuestion(selectedQuestion.id, { correctAnswers });
                            }}
                            aria-label={`Đáp án nhận định ${String.fromCharCode(97 + index)}`}
                            className="input-field h-9 w-24"
                          >
                            <option value="true">Đúng</option>
                            <option value="false">Sai</option>
                          </select>
                          <span className="w-5 text-sm text-slate-500">{String.fromCharCode(97 + index)}.</span>
                          <div className="min-w-0 flex-1">
                            <input value={option} onChange={(event) => {
                              const options = [...selectedQuestion.options];
                              options[index] = event.target.value;
                              updateQuestion(selectedQuestion.id, { options });
                            }} className="input-field" aria-label={`Nhận định ${String.fromCharCode(97 + index)}`} />
                            <MathPreview value={`${String.fromCharCode(97 + index)}. ${option}`} compact />
                          </div>
                        </div>
                      ))}
                      <button onClick={() => updateQuestion(selectedQuestion.id, { options: [...selectedQuestion.options, ''] })} className="text-xs font-semibold text-blue-700 hover:underline">+ Thêm nhận định</button>
                    </fieldset>
                  )}

                  {(selectedQuestion.type === 'short-answer' || selectedQuestion.type === 'essay') && (
                    <label className="block text-sm font-medium text-slate-700">Đáp án / hướng dẫn chấm
                      <textarea value={selectedQuestion.correctAnswer} onChange={(event) => updateQuestion(selectedQuestion.id, { correctAnswer: event.target.value })} rows={selectedQuestion.type === 'essay' ? 4 : 2} className="input-field mt-1.5 resize-y" />
                    </label>
                  )}
                  {(selectedQuestion.type === 'short-answer' || selectedQuestion.type === 'essay') && (
                    <MathPreview value={selectedQuestion.correctAnswer} />
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Điểm
                      <input type="number" min={0} step={0.25} value={selectedQuestion.points} onChange={(event) => updateQuestion(selectedQuestion.id, { points: Math.max(0, Number(event.target.value) || 0) })} className="input-field mt-1.5" />
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Lời giải / ghi chú chấm
                    <textarea value={selectedQuestion.explanation} onChange={(event) => updateQuestion(selectedQuestion.id, { explanation: event.target.value })} rows={3} className="input-field mt-1.5 resize-y" />
                  </label>
                  <MathPreview value={selectedQuestion.explanation} />
                </div>
              ) : (
                <div className="flex min-h-48 flex-col items-center justify-center text-center text-sm text-slate-500">
                  <FileText className="h-8 w-8 text-slate-300" />
                  <p className="mt-2">Chọn câu hỏi để chỉnh sửa hoặc thêm câu mới.</p>
                </div>
              )}
              {validationError && !preview && <p role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{validationError}</p>}
            </section>

            <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-900">Thông tin {assessmentLabel}</h3>
              <label className="block text-xs font-medium text-slate-600">Tên {assessmentLabel}
                <input value={workingExam.title} onChange={(event) => setWorkingExam((current) => ({ ...current, title: event.target.value, topic: event.target.value }))} className="input-field mt-1" />
              </label>
              {kind === 'assignment' && (
                <label className="block text-xs font-medium text-slate-600">Môn học
                  <input value={workingExam.subject} onChange={(event) => setWorkingExam((current) => ({ ...current, subject: event.target.value }))} className="input-field mt-1" />
                </label>
              )}
              <label className="block text-xs font-medium text-slate-600">Khối lớp
                <input value={workingExam.grade} onChange={(event) => setWorkingExam((current) => ({ ...current, grade: event.target.value }))} className="input-field mt-1" />
              </label>
              <label className="block text-xs font-medium text-slate-600">Thời gian (phút)
                <input type="number" min={1} max={300} value={workingExam.durationMinutes ?? ''} onChange={(event) => setWorkingExam((current) => ({ ...current, durationMinutes: event.target.value ? Math.min(300, Math.max(1, Number(event.target.value))) : null }))} className="input-field mt-1" />
              </label>
              <dl className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Số câu</dt><dd className="font-semibold text-slate-900">{workingExam.questions.length}</dd></div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Tổng điểm</dt>
                  <dd className={`font-semibold ${kind === 'exam' && Math.abs(totalPoints - 10) > 0.000001 ? 'text-rose-700' : 'text-slate-900'}`}>
                    {Number(totalPoints.toFixed(2))}{kind === 'exam' ? ' / 10' : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Trạng thái</dt><dd className={`font-semibold ${exam.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'}`}>{exam.status === 'ready' ? readyLabel : 'Bản nháp'}</dd></div>
              </dl>
              {kind === 'exam' && Math.abs(totalPoints - 10) > 0.000001 && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium leading-5 text-rose-800">
                  Tổng điểm hiện là {Number(totalPoints.toFixed(2))}. Hãy điều chỉnh điểm các phần để đề thi có đúng 10 điểm.
                </p>
              )}
              {kind === 'assignment' && (
                <p className="text-xs leading-5 text-slate-500">Các thay đổi chỉ có hiệu lực sau khi lưu. Bài tập được lưu riêng, không dùng làm đề kiểm tra.</p>
              )}
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}

function MathPreview({ value, compact = false }: { value: string; compact?: boolean }) {
  const normalized = normalizeMathDelimiters(value);
  if (!normalized.trim() || !/(\$[^$]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/.test(normalized)) return null;
  return (
    <div className={compact
      ? 'mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600'
      : 'rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2'}>
      {!compact && <p className="mb-1 text-[11px] font-semibold text-blue-800">Xem trước công thức</p>}
      <MathText text={normalized} className="min-w-0 overflow-x-auto text-sm leading-6 text-slate-800" />
    </div>
  );
}

function MathText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </div>
  );
}

function normalizeMathDelimiters(value: string) {
  return value
    .replace(/\\\$/g, '$')
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => `$${formula}$`)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => `$$${formula}$$`);
}
