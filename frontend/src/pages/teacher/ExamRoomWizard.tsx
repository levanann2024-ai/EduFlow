import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, Check, ChevronLeft, ChevronRight, Eye, FileCheck2, FileText, Search, ShieldCheck, Users, X } from 'lucide-react';
import { demoClasses, demoSampleExam, demoStudents, examRoomDefaults, type ExamRoomRecord } from './examRoomDemoData';
import { readSavedExams, type SavedExam } from './assessmentStorage';
import type { Page } from '@/types';

const steps = [
  { label: 'Chọn đề', icon: FileText },
  { label: 'Thông tin phòng thi', icon: Users },
  { label: 'Lịch thi', icon: CalendarClock },
  { label: 'Quy tắc', icon: FileCheck2 },
  { label: 'Xác nhận', icon: Check },
];

function localDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getDateDefaults() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  const opens = new Date(start.getTime() - 30 * 60_000);
  const ends = new Date(start.getTime() + 60 * 60_000);
  return { opensAt: localDateTime(opens), startsAt: localDateTime(start), endsAt: localDateTime(ends) };
}

function formatDate(value: string) {
  if (!value) return 'Chưa thiết lập';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function examReady(exam: SavedExam) {
  return exam.status === 'ready'
    && exam.questions.length > 0
    && exam.questions.every((question) => question.question.trim() && question.points > 0);
}

export function ExamRoomWizard({
  initialRoom,
  onCancel,
  onSave,
  onNavigate,
}: {
  initialRoom?: ExamRoomRecord | null;
  onCancel: () => void;
  onSave: (room: ExamRoomRecord, publish: boolean) => void;
  onNavigate: (page: Page) => void;
}) {
  const dateDefaults = getDateDefaults();
  const [step, setStep] = useState(0);
  const [savedExams, setSavedExams] = useState<SavedExam[]>([]);
  const [examLoadError, setExamLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [examPage, setExamPage] = useState(0);
  const [selectedExamId, setSelectedExamId] = useState(initialRoom?.examId ?? '');
  const [previewExam, setPreviewExam] = useState<SavedExam | null>(null);
  const [roomTitle, setRoomTitle] = useState(initialRoom?.title ?? '');
  const [instructions, setInstructions] = useState(initialRoom?.instructions ?? '');
  const [classIds, setClassIds] = useState<string[]>(initialRoom?.classIds ?? []);
  const [opensAt, setOpensAt] = useState(initialRoom?.opensAt ?? dateDefaults.opensAt);
  const [startsAt, setStartsAt] = useState(initialRoom?.startsAt ?? dateDefaults.startsAt);
  const [endsAt, setEndsAt] = useState(initialRoom?.endsAt ?? dateDefaults.endsAt);
  const [durationMinutes, setDurationMinutes] = useState(initialRoom?.durationMinutes ?? 45);
  const [allowLateEntry, setAllowLateEntry] = useState(initialRoom?.settings.allowLateEntry ?? true);
  const [autoSubmitAtDeadline, setAutoSubmitAtDeadline] = useState(initialRoom?.settings.autoSubmitAtDeadline ?? true);
  const [closeRoomAtDeadline, setCloseRoomAtDeadline] = useState(initialRoom?.settings.closeRoomAtDeadline ?? true);
  const [maxAttempts, setMaxAttempts] = useState(initialRoom?.settings.maxAttempts ?? 1);
  const [shuffleQuestions, setShuffleQuestions] = useState(initialRoom?.settings.shuffleQuestions ?? false);
  const [shuffleAnswers, setShuffleAnswers] = useState(initialRoom?.settings.shuffleAnswers ?? false);
  const [allowBackNavigation, setAllowBackNavigation] = useState(initialRoom?.settings.allowBackNavigation ?? true);
  const [allowEarlySubmit, setAllowEarlySubmit] = useState(initialRoom?.settings.allowEarlySubmit ?? true);
  const [scoreRelease, setScoreRelease] = useState(initialRoom?.settings.scoreRelease ?? 'after-close');
  const [answerRelease, setAnswerRelease] = useState(initialRoom?.settings.answerRelease ?? 'never');
  const [monitorTabSwitch, setMonitorTabSwitch] = useState(initialRoom?.settings.monitorTabSwitch ?? true);
  const [monitorConnection, setMonitorConnection] = useState(initialRoom?.settings.monitorConnection ?? true);
  const [warningThreshold, setWarningThreshold] = useState(initialRoom?.settings.warningThreshold ?? 3);
  const [warningAction, setWarningAction] = useState(initialRoom?.settings.warningAction ?? 'teacher-review');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      setSavedExams(readSavedExams());
    } catch (loadError) {
      console.error('Không thể đọc danh sách đề lưu trên thiết bị.', loadError);
      setExamLoadError('Không đọc được danh sách đề đã lưu trên trình duyệt.');
    }
  }, []);

  const selectedExam = savedExams.find((exam) => exam.id === selectedExamId)
    ?? (initialRoom?.examSnapshot.id === selectedExamId ? initialRoom.examSnapshot : null)
    ?? (demoSampleExam.id === selectedExamId ? demoSampleExam : null);
  const filteredExams = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return savedExams.filter((exam) => (
      (!normalized || `${exam.title} ${exam.topic} ${exam.subject} ${exam.grade}`.toLocaleLowerCase('vi').includes(normalized))
      && (!gradeFilter || exam.grade === gradeFilter)
    ));
  }, [gradeFilter, query, savedExams]);
  const visibleExams = filteredExams.slice(examPage * 2, examPage * 2 + 2);
  const sortedDemoClasses = [...demoClasses].sort((a, b) => (
    Number(a.grade.replace(/\D/g, '')) - Number(b.grade.replace(/\D/g, ''))
  ));
  const selectedClasses = demoClasses.filter((item) => classIds.includes(item.id));
  const studentCount = selectedClasses.reduce((sum, item) => sum + item.studentCount, 0);
  const selectedDemoStudents = selectedClasses.flatMap((classRoom) => demoStudents.filter((student) => student.classId === classRoom.id && student.status === 'active'));
  const totalPoints = selectedExam?.questions.reduce((sum, question) => sum + question.points, 0) ?? 0;
  const timeError = useMemo(() => {
    const opens = new Date(opensAt).getTime();
    const starts = new Date(startsAt).getTime();
    const ends = new Date(endsAt).getTime();
    if (![opens, starts, ends].every(Number.isFinite)) return 'Hãy nhập đầy đủ các mốc thời gian.';
    if (opens >= starts) return 'Thời điểm mở phòng phải trước thời gian bắt đầu.';
    if (starts >= ends) return 'Hạn kết thúc chung phải sau thời gian bắt đầu.';
    if (durationMinutes < 1 || durationMinutes > 600) return 'Thời lượng mỗi lượt phải từ 1 đến 600 phút.';
    if (starts + durationMinutes * 60_000 > ends && !allowLateEntry) {
      return 'Thời lượng làm bài vượt hạn kết thúc chung. Hãy tăng hạn kết thúc hoặc giảm thời lượng.';
    }
    return '';
  }, [allowLateEntry, durationMinutes, endsAt, opensAt, startsAt]);

  const settings = {
    allowLateEntry,
    autoSubmitAtDeadline,
    closeRoomAtDeadline,
    maxAttempts,
    shuffleQuestions,
    shuffleAnswers,
    allowBackNavigation,
    allowEarlySubmit,
    scoreRelease,
    answerRelease,
    monitorTabSwitch,
    monitorConnection,
    warningThreshold,
    warningAction,
  } satisfies typeof examRoomDefaults;

  const goNext = () => {
    if (step === 0 && (!selectedExam || !examReady(selectedExam))) {
      setError('Chọn một đề đã hoàn thiện để tiếp tục.');
      return;
    }
    if (step === 1 && (!roomTitle.trim() || classIds.length === 0)) {
      setError('Nhập tên phòng và chọn ít nhất một lớp.');
      return;
    }
    if (step === 2 && timeError) {
      setError(timeError);
      return;
    }
    setError('');
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const toggleClass = (id: string) => {
    setClassIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const save = (publish: boolean) => {
    if (!selectedExam || !examReady(selectedExam) || !roomTitle.trim() || classIds.length === 0 || timeError) {
      setError(!selectedExam ? 'Chọn một đề thi trước khi lưu.' : !roomTitle.trim() || classIds.length === 0 ? 'Bổ sung tên phòng và lớp tham gia.' : timeError || 'Đề thi cần ở trạng thái sẵn sàng sử dụng.');
      return;
    }
    const previous = initialRoom;
    const room: ExamRoomRecord = {
      id: previous?.id ?? `demo-room-${Date.now()}`,
      code: previous?.code ?? Date.now().toString(36).slice(-6).toLocaleUpperCase('en'),
      title: roomTitle.trim(),
      instructions: instructions.trim(),
      organizer: 'Giáo viên',
      classIds,
      classNames: selectedClasses.map((item) => item.name),
      studentCount,
      opensAt,
      startsAt,
      endsAt,
      durationMinutes,
      status: publish ? new Date(startsAt).getTime() > Date.now() ? 'scheduled' : 'open' : 'draft',
      examId: selectedExam.id,
      examSnapshot: { ...selectedExam, questions: selectedExam.questions.map((question) => ({ ...question, options: [...question.options] })) },
      settings,
      sessions: previous?.sessions ?? selectedDemoStudents.map((student) => ({
        id: `${previous?.id ?? 'demo-room'}-${student.id}`,
        studentId: student.id,
        studentName: student.name,
        className: demoClasses.find((item) => item.id === student.classId)?.name ?? '',
        status: 'not-started',
        startedAt: null,
        submittedAt: null,
        remainingMinutes: null,
        eventCount: 0,
        risk: 'none',
        events: [],
        score: null,
        needsManualGrading: 0,
      })),
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      isDemo: true,
    };
    onSave(room, publish);
  };

  const checkbox = (checked: boolean, onChange: (value: boolean) => void, label: string, description?: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 accent-blue-700" />
      <span><span className="block text-sm font-medium text-slate-800">{label}</span>{description && <span className="mt-0.5 block text-xs text-slate-500">{description}</span>}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-2 sm:p-4" onClick={onCancel}>
      <section role="dialog" aria-modal="true" aria-labelledby="room-wizard-title" onClick={(event) => event.stopPropagation()} className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Quy trình tạo phòng</p>
            <h2 id="room-wizard-title" className="mt-1 text-xl font-bold text-slate-950">{initialRoom ? 'Tiếp tục cấu hình phòng' : 'Tạo phòng thi'}</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="Đóng quy trình" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </header>
        <nav aria-label="Các bước tạo phòng" className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="shrink-0 font-medium text-slate-500">Bước {step + 1}/{steps.length}</span>
          </div>
          <ol className="grid grid-cols-5 gap-2">
            {steps.map(({ label, icon: Icon }, index) => (
              <li key={label}>
                <button
                  type="button"
                  aria-label={`Bước ${index + 1}: ${label}`}
                  aria-current={step === index ? 'step' : undefined}
                  onClick={() => { setError(''); setStep(index); }}
                  className="group flex w-full flex-col items-center gap-1"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors group-hover:bg-blue-100 group-hover:text-blue-800 ${step === index ? 'bg-blue-700 text-white group-hover:bg-blue-700 group-hover:text-white' : step > index ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-400'}`}>
                    {step > index ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className={`hidden text-center text-[10px] leading-4 sm:block ${step === index ? 'font-semibold text-blue-700' : step > index ? 'text-slate-600 group-hover:text-blue-700' : 'text-slate-400'}`}>{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {examLoadError && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{examLoadError}</p>}
          {error && step !== 2 && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          {step === 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Đề đã lưu</h3>
                {filteredExams.length > 2 && (
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Xem các đề trước" disabled={examPage === 0} onClick={() => setExamPage((page) => page - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" aria-label="Xem các đề tiếp theo" disabled={(examPage + 1) * 2 >= filteredExams.length} onClick={() => setExamPage((page) => page + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_160px]">
                <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setExamPage(0); }} className="input-field pl-9" placeholder="Tìm đề thi..." /></label>
                <select value={gradeFilter} onChange={(event) => { setGradeFilter(event.target.value); setExamPage(0); }} className="input-field"><option value="">Tất cả khối</option>{[...new Set(savedExams.map((exam) => exam.grade))].map((grade) => <option key={grade}>{grade}</option>)}</select>
              </div>
              {filteredExams.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-800">{savedExams.length ? 'Không tìm thấy đề phù hợp' : 'Chưa có đề đã lưu trên thiết bị này'}</p>
                  <p className="mt-1 text-sm text-slate-500">{savedExams.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Lưu và xác nhận đề trong Ngân hàng câu hỏi & Đề thi để dùng tại đây.'}</p>
                  <button type="button" onClick={() => onNavigate('exams')} className="mt-4 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Mở Ngân hàng đề thi</button>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleExams.map((exam) => {
                    const ready = examReady(exam);
                    return (
                      <article key={exam.id} className={`flex min-h-[164px] flex-col rounded-xl border bg-white p-4 ${selectedExamId === exam.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-slate-900">{exam.title} <span className={`text-sm font-semibold ${ready ? 'text-emerald-700' : 'text-amber-700'}`}>({ready ? 'Sẵn sàng' : 'Bản nháp'})</span></h4>
                            <p className="mt-1 text-sm text-slate-500">{exam.subject} - {exam.grade}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">{exam.questions.length} câu, {exam.durationMinutes ? `${exam.durationMinutes} phút` : 'chưa đặt thời lượng'}</p>
                        <div className="mt-auto flex flex-wrap gap-2 pt-4">
                          <button type="button" onClick={() => setPreviewExam(exam)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><Eye className="h-4 w-4" /> Xem trước</button>
                          {!ready && <button type="button" onClick={() => onNavigate('exams')} className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50">Hoàn thiện đề</button>}
                          <button type="button" disabled={!ready} onClick={() => { setSelectedExamId(exam.id); setRoomTitle((current) => current || exam.title); setError(''); }} className={`ml-auto rounded-lg border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${selectedExamId === exam.id ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{selectedExamId === exam.id ? 'Đã chọn' : 'Chọn đề'}</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="mx-auto max-w-3xl space-y-5">
              <label className="block text-sm font-medium text-slate-700">Tên phòng<input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} className="input-field mt-1.5" placeholder="Ví dụ: Kiểm tra chương 2 - 10A1" /></label>
              <label className="block text-sm font-medium text-slate-700">Hướng dẫn làm bài<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} className="input-field mt-1.5" placeholder="Nhập hướng dẫn hiển thị cho học sinh..." /></label>
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-slate-800">Lớp tham gia</legend>
                {sortedDemoClasses.map((classRoom) => (
                  <label key={classRoom.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50">
                    <input type="checkbox" checked={classIds.includes(classRoom.id)} onChange={() => toggleClass(classRoom.id)} className="accent-blue-700" />
                    <span className="min-w-0 flex-1 font-medium text-slate-900">{classRoom.name}</span>
                    <span className="text-sm text-slate-500">{classRoom.studentCount} học sinh</span>
                  </label>
                ))}
              </fieldset>
            </section>
          )}

          {step === 2 && (
            <section className="mx-auto max-w-3xl space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Mở phòng<input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} className="input-field mt-1.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Bắt đầu làm bài<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="input-field mt-1.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Hạn kết thúc chung<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="input-field mt-1.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Thời lượng mỗi lượt (phút)<input type="number" min={1} max={600} value={durationMinutes} onChange={(event) => setDurationMinutes(Math.max(1, Math.min(600, Number(event.target.value) || 1)))} className="input-field mt-1.5" /></label>
              </div>
              {timeError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{timeError}</p>}
              {checkbox(allowLateEntry, setAllowLateEntry, 'Cho phép học sinh vào muộn', 'Thời gian làm bài kết thúc tại mốc đến trước giữa thời lượng lượt và hạn đóng chung.')}
              {checkbox(autoSubmitAtDeadline, setAutoSubmitAtDeadline, 'Tự nộp khi hết thời lượng', 'Cần máy chủ thực thi để áp dụng quy tắc này.')}
              {checkbox(closeRoomAtDeadline, setCloseRoomAtDeadline, 'Đóng phòng ở hạn kết thúc chung')}
            </section>
          )}

          {step === 3 && (
            <section className="mx-auto max-w-3xl space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {checkbox(shuffleQuestions, setShuffleQuestions, 'Trộn thứ tự câu hỏi')}
                {checkbox(shuffleAnswers, setShuffleAnswers, 'Trộn thứ tự đáp án', 'Cần backend giữ đáp án đúng gắn với lựa chọn.')}
                {checkbox(allowBackNavigation, setAllowBackNavigation, 'Cho quay lại câu trước')}
                {checkbox(allowEarlySubmit, setAllowEarlySubmit, 'Cho phép nộp bài sớm')}
              </div>
              <label className="block text-sm font-medium text-slate-700">Số lượt làm tối đa<select value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value) as 1 | 2 | 3)} className="input-field mt-1.5"><option value={1}>1 lượt</option><option value={2}>2 lượt</option><option value={3}>3 lượt</option></select></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">Công bố điểm<select value={scoreRelease} onChange={(event) => setScoreRelease(event.target.value as typeof scoreRelease)} className="input-field mt-1.5"><option value="immediate">Ngay sau khi nộp</option><option value="after-close">Sau khi đóng phòng</option><option value="manual">Giáo viên công bố</option></select></label>
                <label className="block text-sm font-medium text-slate-700">Công bố đáp án<select value={answerRelease} onChange={(event) => setAnswerRelease(event.target.value as typeof answerRelease)} className="input-field mt-1.5"><option value="never">Không công bố</option><option value="after-close">Sau khi đóng phòng</option><option value="manual">Giáo viên công bố</option></select></label>
              </div>
              <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-violet-950"><ShieldCheck className="h-4 w-4" /> Ghi nhận sự kiện</div>
                {checkbox(monitorTabSwitch, setMonitorTabSwitch, 'Ghi nhận chuyển tab / rời màn hình', 'Sự kiện là cảnh báo để giáo viên xem xét, không tự động trừ điểm.')}
                {checkbox(monitorConnection, setMonitorConnection, 'Theo dõi trạng thái kết nối phiên')}
                <label className="block text-sm font-medium text-slate-700">Ngưỡng cảnh báo<select value={warningThreshold} onChange={(event) => setWarningThreshold(Number(event.target.value))} className="input-field mt-1.5"><option value={1}>1 sự kiện</option><option value={2}>2 sự kiện</option><option value={3}>3 sự kiện</option><option value={5}>5 sự kiện</option></select></label>
                <label className="block text-sm font-medium text-slate-700">Khi vượt ngưỡng<select value={warningAction} onChange={(event) => setWarningAction(event.target.value as typeof warningAction)} className="input-field mt-1.5"><option value="warn">Nhắc nhở học sinh</option><option value="teacher-review">Gửi giáo viên xem xét</option></select></label>
                <p className="text-xs leading-5 text-violet-900">Không bật camera hay giám sát nâng cao. Frontend hiện không gửi/ghi nhận sự kiện lên máy chủ.</p>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="mx-auto max-w-3xl space-y-4">
              <h3 className="font-semibold text-slate-900">Kiểm tra trước khi tạo</h3>
              <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="font-semibold text-slate-900">Thông tin phòng</h4>
                  <p><span className="text-slate-500">Tên:</span> <strong>{roomTitle || 'Chưa đặt tên'}</strong></p>
                  <p><span className="text-slate-500">Đề:</span> {selectedExam?.title ?? 'Chưa chọn'} - {selectedExam?.questions.length ?? 0} câu - {totalPoints} điểm</p>
                  <p><span className="text-slate-500">Lớp:</span> {selectedClasses.map((item) => item.name).join(', ') || 'Chưa chọn'} - {studentCount} học sinh</p>
                  <p><span className="text-slate-500">Người tổ chức:</span> Giáo viên</p>
                  <p><span className="text-slate-500">Mở:</span> {formatDate(opensAt)}</p>
                  <p><span className="text-slate-500">Bắt đầu:</span> {formatDate(startsAt)} - {durationMinutes} phút/lượt</p>
                  <p><span className="text-slate-500">Hạn chung:</span> {formatDate(endsAt)}</p>
                </article>
                <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="font-semibold text-slate-900">Quy tắc</h4>
                  <p>{maxAttempts} lượt - {shuffleQuestions ? 'Có' : 'Không'} trộn câu - {shuffleAnswers ? 'Có' : 'Không'} trộn đáp án</p>
                  <p>{allowBackNavigation ? 'Được' : 'Không được'} quay lại - {allowEarlySubmit ? 'Được' : 'Không được'} nộp sớm</p>
                  <p>Điểm: {scoreRelease === 'immediate' ? 'ngay sau nộp' : scoreRelease === 'after-close' ? 'sau khi đóng' : 'giáo viên công bố'}</p>
                  <p>Đáp án: {answerRelease === 'never' ? 'không công bố' : answerRelease === 'after-close' ? 'sau khi đóng' : 'giáo viên công bố'}</p>
                  <p>Giám sát: {monitorTabSwitch || monitorConnection ? [monitorTabSwitch && 'chuyển tab', monitorConnection && 'kết nối'].filter(Boolean).join(', ') : 'tắt'}</p>
                </article>
              </div>
              <p className="text-xs leading-5 text-slate-500">Phòng chỉ được giữ trong phiên làm việc hiện tại, chưa đồng bộ lên máy chủ.</p>
            </section>
          )}
          {previewExam && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3" onClick={() => setPreviewExam(null)}>
              <section role="dialog" aria-modal="true" aria-label="Xem trước đề" onClick={(event) => event.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-slate-200 p-4"><div><p className="text-xs text-slate-500">Xem trước đề</p><h3 className="font-semibold text-slate-900">{previewExam.title}</h3></div><button type="button" onClick={() => setPreviewExam(null)} aria-label="Đóng xem trước" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></header>
                <div className="overflow-y-auto p-4"><p className="mb-4 text-sm text-slate-500">{previewExam.subject} - {previewExam.grade} - {previewExam.questions.length} câu - {previewExam.durationMinutes ?? '—'} phút</p><div className="space-y-4">{previewExam.questions.map((question, index) => <article key={question.id} className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-medium text-slate-900">Câu {index + 1}. {question.question}</p>{question.options.length > 0 && <ol className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">{question.options.map((option, optionIndex) => <li key={`${question.id}-${optionIndex}`}>{String.fromCharCode(65 + optionIndex)}. {option}</li>)}</ol>}</article>)}</div></div>
              </section>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button type="button" onClick={() => step === 0 ? onCancel() : (setError(''), setStep((current) => current - 1))} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Hủy' : 'Quay lại'}</button>
          <div className="flex min-w-0 flex-wrap justify-end gap-2">
            {step === 4 && <button type="button" onClick={() => save(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Lưu bản nháp</button>}
            {step < 4 ? <button type="button" onClick={goNext} disabled={step === 0 && (!selectedExam || !examReady(selectedExam))} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40">Tiếp tục <ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={() => save(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Check className="h-4 w-4" /> Tạo phòng</button>}
          </div>
        </footer>
      </section>
    </div>
  );
}
