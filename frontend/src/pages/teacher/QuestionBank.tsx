import { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Check, ChevronDown, ClipboardList, Eye, Pencil, Plus, Search, Trash2, WandSparkles, X } from 'lucide-react';
import { AIQuizGenerator } from '@/pages/teacher/AIQuizGenerator';
import { readQuestionSets, readSavedExams, writeQuestionSets, writeSavedExams, type ExamQuestion, type QuestionSet, type SavedExam } from '@/pages/teacher/assessmentStorage';
import type { QuizQuestion } from '@/types';

interface QuestionEntry {
  set: QuestionSet;
  question: QuizQuestion;
  index: number;
}

const entryKey = ({ set, question }: QuestionEntry) => `${set.id}:${question.id}`;

export function QuestionBank() {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuestionEntry | null>(null);
  const [creatingExam, setCreatingExam] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(45);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    try {
      setSets(readQuestionSets());
    } catch (loadError) {
      console.error('Không thể đọc ngân hàng câu hỏi trên thiết bị.', loadError);
      setError('Không đọc được dữ liệu ngân hàng câu hỏi trong trình duyệt.');
    } finally {
      setLoading(false);
    }
  }, []);

  const entries = useMemo(() => sets.flatMap((set) => set.questions.map((question, index) => ({ set, question, index }))), [sets]);
  const subjects = useMemo(() => [...new Set(sets.map((set) => set.subject))].sort(), [sets]);
  const grades = useMemo(() => [...new Set(sets.map((set) => set.grade))].sort(), [sets]);
  const topics = useMemo(() => [...new Set(sets.map((set) => set.topic))].sort(), [sets]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return entries.filter(({ set, question }) => (
      (!normalized || `${question.question} ${set.topic} ${set.subject} ${set.grade}`.toLocaleLowerCase('vi').includes(normalized))
      && (!subjectFilter || set.subject === subjectFilter)
      && (!gradeFilter || set.grade === gradeFilter)
      && (!topicFilter || set.topic === topicFilter)
      && (!typeFilter || typeFilter === 'Trắc nghiệm')
    ));
  }, [entries, gradeFilter, query, subjectFilter, topicFilter, typeFilter]);
  const filteredIds = filtered.map(entryKey);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.includes(id));
  const selectedEntries = entries.filter((entry) => selected.includes(entryKey(entry)));

  const persist = (next: QuestionSet[], successMessage: string) => {
    try {
      writeQuestionSets(next);
      setSets(next);
      setError('');
      setFeedback(successMessage);
      return true;
    } catch (saveError) {
      console.error('Không thể cập nhật ngân hàng câu hỏi trên thiết bị.', saveError);
      setError('Không lưu được thay đổi. Hãy kiểm tra dung lượng lưu trữ của trình duyệt.');
      setFeedback('');
      return false;
    }
  };

  const saveQuestionSet = (generated: { topic: string; subject: string; grade: string; questions: QuizQuestion[] }) => {
    const nextSet: QuestionSet = {
      ...generated,
      id: `bank-${Date.now()}`,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };
    if (persist([nextSet, ...sets], 'Đã lưu bộ câu hỏi vào ngân hàng.')) setCreating(false);
  };

  const deleteQuestion = (entry: QuestionEntry) => {
    if (!window.confirm('Bạn có chắc muốn xóa câu hỏi này khỏi ngân hàng?')) return;
    const next = sets
      .map((set) => set.id === entry.set.id
        ? { ...set, questions: set.questions.filter((question) => question.id !== entry.question.id) }
        : set)
      .filter((set) => set.questions.length > 0);
    if (persist(next, 'Đã xóa câu hỏi.')) {
      setSelected((ids) => ids.filter((id) => id !== entryKey(entry)));
      if (expandedId === entryKey(entry)) setExpandedId(null);
    }
  };

  const saveEditedQuestion = () => {
    if (!editing || !editing.question.question.trim()) return;
    const next = sets.map((set) => set.id === editing.set.id
      ? {
        ...set,
        topic: editing.set.topic,
        subject: editing.set.subject,
        grade: editing.set.grade,
        questions: set.questions.map((question) => question.id === editing.question.id ? editing.question : question),
      }
      : set);
    if (persist(next, 'Đã cập nhật câu hỏi.')) setEditing(null);
  };

  const saveExamFromSelection = () => {
    if (!examTitle.trim() || selectedEntries.length === 0) return;
    const subjects = [...new Set(selectedEntries.map(({ set }) => set.subject))];
    const grades = [...new Set(selectedEntries.map(({ set }) => set.grade))];
    const topics = [...new Set(selectedEntries.map(({ set }) => set.topic))];
    const createdAt = Date.now();
    const exam: SavedExam = {
      id: `exam-${createdAt}`,
      title: examTitle.trim(),
      subject: subjects.length === 1 ? subjects[0] : 'Nhiều môn',
      grade: grades.length === 1 ? grades[0] : 'Nhiều khối',
      topic: topics.length === 1 ? topics[0] : 'Nhiều chủ đề',
      createdAt: new Date(createdAt).toLocaleDateString('vi-VN'),
      durationMinutes: examDuration,
      status: 'draft',
      questions: selectedEntries.map(({ question }, index): ExamQuestion => ({
        ...question,
        id: `exam-${createdAt}-question-${index}`,
        type: 'multiple-choice',
        correctAnswer: question.options[question.correctIndex] ?? '',
        points: 1,
      })),
    };
    try {
      writeSavedExams([exam, ...readSavedExams()]);
      setSelected([]);
      setExamTitle('');
      setCreatingExam(false);
      setError('');
      setFeedback('Đã tạo đề từ các câu hỏi đã chọn. Mở tab Đề thi đã lưu để xem đề.');
    } catch (saveError) {
      console.error('Không thể tạo đề từ câu hỏi đã chọn.', saveError);
      setError('Không lưu được đề vào trình duyệt.');
      setFeedback('');
    }
  };

  const toggleAll = () => {
    setSelected((current) => allSelected
      ? current.filter((id) => !filteredIds.includes(id))
      : [...new Set([...current, ...filteredIds])]);
  };

  return (
    <main className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setCreating((value) => !value); setFeedback(''); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
          {creating ? <BookOpenCheck className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {creating ? 'Xem ngân hàng' : 'Tạo câu hỏi'}
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {feedback && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback}</p>}

      {creating ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <WandSparkles className="h-4 w-4 text-blue-700" />
            <h2 className="font-semibold text-slate-900">Tạo bộ câu hỏi</h2>
          </div>
          <AIQuizGenerator onSaveQuestions={saveQuestionSet} />
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="space-y-3 border-b border-slate-100 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">{filtered.length}</span> câu hỏi hiển thị</p>
              <button onClick={toggleAll} disabled={filtered.length === 0} className="text-sm font-medium text-blue-700 hover:text-blue-900 disabled:text-slate-400">
                {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(130px,180px))]">
              <label className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm nội dung câu hỏi..." className="input-field pl-9" />
              </label>
              <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="input-field">
                <option value="">Tất cả môn học</option>
                {subjects.map((subject) => <option key={subject}>{subject}</option>)}
              </select>
              <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="input-field">
                <option value="">Tất cả khối lớp</option>
                {grades.map((grade) => <option key={grade}>{grade}</option>)}
              </select>
              <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="input-field">
                <option value="">Tất cả chủ đề</option>
                {topics.map((topic) => <option key={topic}>{topic}</option>)}
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="input-field">
                <option value="">Tất cả dạng câu hỏi</option>
                <option>Trắc nghiệm</option>
              </select>
            </div>
          </div>

          {selectedEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
              <Check className="h-4 w-4" />
              Đã chọn {selectedEntries.length} câu hỏi
              <button onClick={() => setCreatingExam(true)} className="ml-auto rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">Tạo đề từ câu đã chọn</button>
            </div>
          )}

          {loading ? (
            <p className="p-10 text-center text-sm text-slate-500">Đang tải ngân hàng câu hỏi...</p>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-5 py-10 text-center">
              <ClipboardList className="h-8 w-8 text-slate-300" />
              <h2 className="mt-3 font-semibold text-slate-800">{entries.length ? 'Không tìm thấy câu hỏi phù hợp' : 'Chưa có câu hỏi được lưu'}</h2>
              <p className="mt-1 max-w-md text-sm text-slate-500">{entries.length ? 'Thử thay đổi từ khóa hoặc bộ lọc.' : 'Tạo câu hỏi trong Soạn bài với AI hoặc dùng nút Tạo câu hỏi để lưu câu hỏi vào đây.'}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((entry) => {
                const { set, question, index } = entry;
                const key = entryKey(entry);
                const expanded = expandedId === key;
                return (
                  <article key={`${set.id}-${question.id}`} className="p-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Chọn câu hỏi ${index + 1}: ${question.question}`}
                        checked={selected.includes(key)}
                        onChange={() => setSelected((current) => current.includes(key) ? current.filter((id) => id !== key) : [...current, key])}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-6 text-slate-900">{question.question}</p>
                        <p className="mt-1 text-xs text-slate-500">{set.subject} · {set.grade} · {set.topic} · Trắc nghiệm · {set.createdAt}</p>
                        {expanded && (
                          <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                            {question.options.map((option, optionIndex) => (
                              <p key={`${question.id}-${optionIndex}`} className={`text-sm ${optionIndex === question.correctIndex ? 'font-medium text-emerald-800' : 'text-slate-600'}`}>
                                {String.fromCharCode(65 + optionIndex)}. {option}{optionIndex === question.correctIndex ? ' · Đáp án' : ''}
                              </p>
                            ))}
                            <p className="border-t border-slate-200 pt-2 text-sm text-slate-600"><span className="font-medium">Giải thích:</span> {question.explanation || 'Chưa có giải thích.'}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => setExpandedId(expanded ? null : key)} aria-label={expanded ? 'Ẩn chi tiết' : 'Xem chi tiết'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-700">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setEditing({ ...entry, question: { ...question, options: [...question.options] } })} aria-label="Chỉnh sửa câu hỏi" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => deleteQuestion(entry)} aria-label="Xóa câu hỏi" className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setEditing(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="edit-question-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="edit-question-title" className="text-lg font-semibold text-slate-950">Chỉnh sửa câu hỏi</h2>
              <button onClick={() => setEditing(null)} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Môn học
                <input value={editing.set.subject} onChange={(event) => setEditing({ ...editing, set: { ...editing.set, subject: event.target.value } })} className="input-field mt-1.5" />
              </label>
              <label className="text-sm font-medium text-slate-700">Khối lớp
                <input value={editing.set.grade} onChange={(event) => setEditing({ ...editing, set: { ...editing.set, grade: event.target.value } })} className="input-field mt-1.5" />
              </label>
              <label className="text-sm font-medium text-slate-700">Chủ đề / chương
                <input value={editing.set.topic} onChange={(event) => setEditing({ ...editing, set: { ...editing.set, topic: event.target.value } })} className="input-field mt-1.5" />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700">Nội dung câu hỏi
              <textarea value={editing.question.question} onChange={(event) => setEditing({ ...editing, question: { ...editing.question, question: event.target.value } })} rows={3} className="input-field mt-1.5" />
            </label>
            <fieldset className="mt-4 space-y-2">
              <legend className="mb-2 text-sm font-medium text-slate-700">Phương án · chọn đáp án đúng</legend>
              {editing.question.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input type="radio" name="correct-option" checked={editing.question.correctIndex === index} onChange={() => setEditing({ ...editing, question: { ...editing.question, correctIndex: index } })} aria-label={`Chọn phương án ${String.fromCharCode(65 + index)} là đáp án đúng`} />
                  <input value={option} onChange={(event) => {
                    const options = [...editing.question.options];
                    options[index] = event.target.value;
                    setEditing({ ...editing, question: { ...editing.question, options } });
                  }} className="input-field" aria-label={`Phương án ${String.fromCharCode(65 + index)}`} />
                </div>
              ))}
            </fieldset>
            <label className="mt-4 block text-sm font-medium text-slate-700">Mức độ
              <select value={editing.question.difficulty} onChange={(event) => setEditing({ ...editing, question: { ...editing.question, difficulty: event.target.value as QuizQuestion['difficulty'] } })} className="input-field mt-1.5">
                <option value="easy">Nhận biết / Dễ</option>
                <option value="medium">Thông hiểu / Trung bình</option>
                <option value="hard">Vận dụng cao / Khó</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">Giải thích
              <textarea value={editing.question.explanation} onChange={(event) => setEditing({ ...editing, question: { ...editing.question, explanation: event.target.value } })} rows={2} className="input-field mt-1.5" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hủy</button>
              <button onClick={saveEditedQuestion} disabled={!editing.question.question.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Lưu thay đổi</button>
            </div>
          </section>
        </div>
      )}

      {creatingExam && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setCreatingExam(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-exam-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="create-exam-title" className="text-lg font-semibold text-slate-950">Tạo đề từ câu đã chọn</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedEntries.length} câu hỏi · Lưu trên trình duyệt này</p>
              </div>
              <button onClick={() => setCreatingExam(false)} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-sm font-medium text-slate-700">Tên đề
              <input autoFocus value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="Ví dụ: Ôn tập chương 2" className="input-field mt-1.5" />
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">Thời lượng (phút)
              <input type="number" min={1} max={300} value={examDuration} onChange={(event) => setExamDuration(Math.min(300, Math.max(1, Number(event.target.value) || 1)))} className="input-field mt-1.5" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreatingExam(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Hủy</button>
              <button onClick={saveExamFromSelection} disabled={!examTitle.trim() || selectedEntries.length === 0} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">Lưu đề</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
