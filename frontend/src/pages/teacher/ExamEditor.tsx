import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, FileCheck2, FileText, Plus, Save, X } from 'lucide-react';
import type { ExamQuestion, ExamQuestionType, SavedExam } from '@/pages/teacher/assessmentStorage';

const questionTypeLabels: Record<ExamQuestionType, string> = {
  'multiple-choice': 'Trắc nghiệm ABCD',
  'true-false': 'Đúng / Sai',
  'short-answer': 'Trả lời ngắn',
  essay: 'Tự luận',
};

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
    points: 1,
  };
}

export function ExamEditor({
  exam,
  onClose,
  onSave,
}: {
  exam: SavedExam;
  onClose: () => void;
  onSave: (updated: SavedExam, status: 'draft' | 'ready') => void;
}) {
  const [workingExam, setWorkingExam] = useState<SavedExam>(() => ({
    ...exam,
    questions: exam.questions.map((question) => ({ ...question, options: [...question.options] })),
  }));
  const [selectedId, setSelectedId] = useState(workingExam.questions[0]?.id ?? null);
  const [preview, setPreview] = useState(false);
  const [validationError, setValidationError] = useState('');
  const selectedQuestion = workingExam.questions.find((question) => question.id === selectedId) ?? null;
  const totalPoints = useMemo(() => workingExam.questions.reduce((total, question) => total + Math.max(0, question.points), 0), [workingExam.questions]);
  const hasUnsavedChanges = JSON.stringify(workingExam) !== JSON.stringify(exam);

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

  const changeQuestionType = (type: ExamQuestionType) => {
    if (!selectedQuestion) return;
    const replacement = createQuestion(type, workingExam.questions.indexOf(selectedQuestion));
    updateQuestion(selectedQuestion.id, { ...replacement, id: selectedQuestion.id });
  };

  const addQuestion = () => {
    const question = createQuestion('multiple-choice', workingExam.questions.length);
    setWorkingExam((current) => ({ ...current, questions: [...current.questions, question] }));
    setSelectedId(question.id);
    setPreview(false);
  };

  const removeQuestion = (questionId: string) => {
    const nextQuestions = workingExam.questions.filter((question) => question.id !== questionId);
    setWorkingExam((current) => ({ ...current, questions: nextQuestions }));
    setSelectedId(nextQuestions[0]?.id ?? null);
  };

  const moveQuestion = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= workingExam.questions.length) return;
    const questions = [...workingExam.questions];
    [questions[index], questions[nextIndex]] = [questions[nextIndex], questions[index]];
    setWorkingExam((current) => ({ ...current, questions }));
  };

  const save = (status: 'draft' | 'ready') => {
    if (!workingExam.title.trim()) {
      setValidationError('Hãy nhập tên đề trước khi lưu.');
      return;
    }
    if (status === 'ready') {
      const incompleteIndex = workingExam.questions.findIndex((question) => (
        !question.question.trim()
        || question.points <= 0
        || (question.type === 'multiple-choice' && (question.options.length < 2 || question.options.some((option) => !option.trim())))
        || (question.type === 'true-false' && (question.options.length < 2 || question.options.some((option) => !option.trim())))
        || ((question.type === 'short-answer' || question.type === 'essay') && !question.correctAnswer.trim())
      ));
      if (incompleteIndex >= 0) {
        setValidationError(`Câu ${incompleteIndex + 1} còn thiếu nội dung, đáp án hoặc điểm. Hoàn thiện trước khi xác nhận đề.`);
        setSelectedId(workingExam.questions[incompleteIndex].id);
        return;
      }
      if (workingExam.questions.length === 0) {
        setValidationError('Đề cần có ít nhất một câu hỏi để chuyển sang trạng thái sẵn sàng.');
        return;
      }
    }
    setValidationError('');
    onSave(workingExam, status);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-2 sm:p-4" onClick={closeEditor}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-editor-title"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Môi trường chỉnh sửa đề</p>
            <h2 id="exam-editor-title" className="truncate text-lg font-semibold text-slate-950">{workingExam.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPreview((current) => !current)} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold ${preview ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <Eye className="h-4 w-4" /> {preview ? 'Quay lại chỉnh sửa' : 'Xem trước học sinh'}
            </button>
            {!preview && (
              <>
                <button onClick={() => save('draft')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Save className="h-4 w-4" /> Lưu bản nháp
                </button>
                <button onClick={() => save('ready')} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                  <FileCheck2 className="h-4 w-4" /> Sẵn sàng sử dụng
                </button>
              </>
            )}
            <button onClick={closeEditor} aria-label="Đóng trình chỉnh sửa" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
        </header>

        {preview ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <h1 className="text-center text-xl font-bold text-slate-950">{workingExam.title}</h1>
              <p className="mt-2 text-center text-sm text-slate-500">{workingExam.subject} - {workingExam.grade}{workingExam.durationMinutes ? ` - ${workingExam.durationMinutes} phút` : ''}</p>
              <p className="mt-1 text-center text-xs text-slate-500">{workingExam.questions.length} câu - {totalPoints} điểm</p>
              <div className="mt-6 space-y-6">
                {workingExam.questions.map((question, index) => (
                  <section key={question.id} className="border-b border-slate-100 pb-5 last:border-0">
                    <p className="font-medium leading-6 text-slate-900">
                      Câu {index + 1}. {question.question || <span className="italic text-slate-400">Chưa nhập nội dung câu hỏi</span>}
                      <span className="ml-2 whitespace-nowrap text-xs font-normal text-slate-500">({question.points} điểm)</span>
                    </p>
                    {question.type === 'multiple-choice' && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {question.options.map((option, optionIndex) => (
                          <label key={optionIndex} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <input type="radio" name={`preview-${question.id}`} className="accent-blue-700" />
                            {String.fromCharCode(65 + optionIndex)}. {option || '...'}
                          </label>
                        ))}
                      </div>
                    )}
                    {question.type === 'true-false' && (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <label key={optionIndex} className="grid grid-cols-[1fr_100px] items-center gap-2 text-sm text-slate-700">
                            <span>{String.fromCharCode(97 + optionIndex)}) {option}</span>
                            <select defaultValue="" className="input-field h-9"><option value="" disabled>Chọn</option><option>Đúng</option><option>Sai</option></select>
                          </label>
                        ))}
                      </div>
                    )}
                    {(question.type === 'short-answer' || question.type === 'essay') && <div className={`mt-3 rounded-lg border border-dashed border-slate-300 ${question.type === 'essay' ? 'h-28' : 'h-10'}`} />}
                  </section>
                ))}
              </div>
            </article>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[240px_minmax(0,1fr)_260px] lg:overflow-hidden">
            <aside className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Câu hỏi ({workingExam.questions.length})</h3>
                <button onClick={addQuestion} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"><Plus className="h-3.5 w-3.5" /> Thêm</button>
              </div>
              <div className="space-y-1.5">
                {workingExam.questions.map((question, index) => (
                  <div key={question.id} className={`rounded-lg border p-2 ${selectedId === question.id ? 'border-blue-300 bg-blue-50' : 'border-slate-100'}`}>
                    <button onClick={() => setSelectedId(question.id)} className="block w-full text-left">
                      <span className="block text-xs font-semibold text-slate-800">Câu {index + 1} - {questionTypeLabels[question.type]}</span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{question.question || 'Chưa nhập nội dung'}</span>
                      <span className="mt-1 block text-[11px] text-slate-500">{question.points} điểm</span>
                    </button>
                    <div className="mt-1 flex justify-end gap-1">
                      <button disabled={index === 0} onClick={() => moveQuestion(index, -1)} aria-label={`Chuyển câu ${index + 1} lên`} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button disabled={index === workingExam.questions.length - 1} onClick={() => moveQuestion(index, 1)} aria-label={`Chuyển câu ${index + 1} xuống`} className="rounded p-1 text-slate-500 hover:bg-white disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                {workingExam.questions.length === 0 && <p className="py-5 text-center text-xs text-slate-500">Chưa có câu hỏi. Bấm Thêm để tạo câu mới.</p>}
              </div>
            </aside>

            <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
              {selectedQuestion ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-950">Chỉnh sửa câu hỏi {workingExam.questions.indexOf(selectedQuestion) + 1}</h3>
                    <button onClick={() => removeQuestion(selectedQuestion.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">Xóa câu hỏi</button>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Dạng câu hỏi
                    <select value={selectedQuestion.type} onChange={(event) => changeQuestionType(event.target.value as ExamQuestionType)} className="input-field mt-1.5">
                      {Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Nội dung câu hỏi
                    <textarea value={selectedQuestion.question} onChange={(event) => updateQuestion(selectedQuestion.id, { question: event.target.value })} rows={4} className="input-field mt-1.5 resize-y" />
                  </label>

                  {selectedQuestion.type === 'multiple-choice' && (
                    <fieldset className="space-y-2">
                      <legend className="mb-2 text-sm font-medium text-slate-700">Phương án - chọn đáp án đúng</legend>
                      {selectedQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${selectedQuestion.id}`} checked={selectedQuestion.correctIndex === index} onChange={() => updateQuestion(selectedQuestion.id, { correctIndex: index, correctAnswer: option })} aria-label={`Đặt phương án ${String.fromCharCode(65 + index)} là đáp án đúng`} className="accent-blue-700" />
                          <span className="w-5 text-sm text-slate-500">{String.fromCharCode(65 + index)}.</span>
                          <input value={option} onChange={(event) => {
                            const options = [...selectedQuestion.options];
                            options[index] = event.target.value;
                            updateQuestion(selectedQuestion.id, {
                              options,
                              ...(selectedQuestion.correctIndex === index ? { correctAnswer: event.target.value } : {}),
                            });
                          }} className="input-field" aria-label={`Phương án ${String.fromCharCode(65 + index)}`} />
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
                          <input value={option} onChange={(event) => {
                            const options = [...selectedQuestion.options];
                            options[index] = event.target.value;
                            updateQuestion(selectedQuestion.id, { options });
                          }} className="input-field" aria-label={`Nhận định ${String.fromCharCode(97 + index)}`} />
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">Điểm
                      <input type="number" min={0} step={0.25} value={selectedQuestion.points} onChange={(event) => updateQuestion(selectedQuestion.id, { points: Math.max(0, Number(event.target.value) || 0) })} className="input-field mt-1.5" />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">Mức độ
                      <select value={selectedQuestion.difficulty} onChange={(event) => updateQuestion(selectedQuestion.id, { difficulty: event.target.value as ExamQuestion['difficulty'] })} className="input-field mt-1.5">
                        <option value="easy">Nhận biết / Dễ</option><option value="medium">Thông hiểu / Trung bình</option><option value="hard">Vận dụng cao / Khó</option>
                      </select>
                    </label>
                  </div>
                  <label className="block text-sm font-medium text-slate-700">Lời giải / ghi chú chấm
                    <textarea value={selectedQuestion.explanation} onChange={(event) => updateQuestion(selectedQuestion.id, { explanation: event.target.value })} rows={3} className="input-field mt-1.5 resize-y" />
                  </label>
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
              <h3 className="text-sm font-semibold text-slate-900">Thông tin đề</h3>
              <label className="block text-xs font-medium text-slate-600">Tên đề
                <input value={workingExam.title} onChange={(event) => setWorkingExam((current) => ({ ...current, title: event.target.value, topic: event.target.value }))} className="input-field mt-1" />
              </label>
              <label className="block text-xs font-medium text-slate-600">Môn học
                <input value={workingExam.subject} onChange={(event) => setWorkingExam((current) => ({ ...current, subject: event.target.value }))} className="input-field mt-1" />
              </label>
              <label className="block text-xs font-medium text-slate-600">Khối lớp
                <input value={workingExam.grade} onChange={(event) => setWorkingExam((current) => ({ ...current, grade: event.target.value }))} className="input-field mt-1" />
              </label>
              <label className="block text-xs font-medium text-slate-600">Thời gian (phút)
                <input type="number" min={1} max={300} value={workingExam.durationMinutes ?? ''} onChange={(event) => setWorkingExam((current) => ({ ...current, durationMinutes: event.target.value ? Math.min(300, Math.max(1, Number(event.target.value))) : null }))} className="input-field mt-1" />
              </label>
              <dl className="space-y-2 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Số câu</dt><dd className="font-semibold text-slate-900">{workingExam.questions.length}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Tổng điểm</dt><dd className="font-semibold text-slate-900">{totalPoints}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-500">Trạng thái</dt><dd className={`font-semibold ${exam.status === 'ready' ? 'text-emerald-700' : 'text-amber-700'}`}>{exam.status === 'ready' ? 'Sẵn sàng sử dụng' : 'Bản nháp'}</dd></div>
              </dl>
              <p className="text-xs leading-5 text-slate-500">Các thay đổi chỉ có hiệu lực sau khi lưu. Đề đã gắn với phòng thi cần được lưu thành phiên bản riêng khi tạo phòng.</p>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
