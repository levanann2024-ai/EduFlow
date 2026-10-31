import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, Check, ChevronLeft, ChevronRight, Eye, FileCheck2, FileText, Search, ShieldCheck, Users, X } from 'lucide-react';
import { listClasses, listClassStudents, type SchoolClass } from '@/api/schoolApi';
import { loadTeacherAssessments, type SavedExam } from './assessmentStorage';
import { examRoomDefaults, type ExamRoomRecord } from './examRoomDemoData';
import { ExamRoomPhasePreview } from './ExamRoomPhasePreview';
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

function dateTimeInput(value: string) {
  return localDateTime(new Date(value));
}

function getDateDefaults() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(8, 0, 0, 0);
  return { startsAt: localDateTime(start) };
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

type RoomClass = SchoolClass & { studentCount: number };

export function ExamRoomWizard({
  initialRoom,
  initialExam,
  onCancel,
  onSave,
  onNavigate,
}: {
  initialRoom?: ExamRoomRecord | null;
  initialExam?: SavedExam | null;
  onCancel: () => void;
  onSave: (room: ExamRoomRecord, publish: boolean) => Promise<void>;
  onNavigate: (page: Page) => void;
}) {
  const dateDefaults = getDateDefaults();
  const [step, setStep] = useState(initialExam ? 1 : 0);
  const [savedExams, setSavedExams] = useState<SavedExam[]>([]);
  const [examLoadError, setExamLoadError] = useState('');
  const [classes, setClasses] = useState<RoomClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [classesError, setClassesError] = useState('');
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [examPage, setExamPage] = useState(0);
  const [selectedExamId, setSelectedExamId] = useState(initialRoom?.examId ?? initialExam?.id ?? '');
  const [previewExam, setPreviewExam] = useState<SavedExam | null>(null);
  const [roomTitle, setRoomTitle] = useState(initialRoom?.title ?? initialExam?.title ?? '');
  const [instructions, setInstructions] = useState(initialRoom?.instructions ?? '');
  const [classIds, setClassIds] = useState<string[]>(initialRoom?.classIds ?? []);
  const [startsAt, setStartsAt] = useState(initialRoom ? dateTimeInput(initialRoom.startsAt) : dateDefaults.startsAt);
  const [durationMinutes, setDurationMinutes] = useState(initialRoom?.durationMinutes ?? initialExam?.durationMinutes ?? 45);
  const [shuffleQuestions, setShuffleQuestions] = useState(initialRoom?.settings.shuffleQuestions ?? false);
  const [allowBackNavigation, setAllowBackNavigation] = useState(initialRoom?.settings.allowBackNavigation ?? true);
  const [allowEarlySubmit, setAllowEarlySubmit] = useState(initialRoom?.settings.allowEarlySubmit ?? true);
  const [requireCamera, setRequireCamera] = useState(initialRoom?.settings.requireCamera ?? false);
  const [requireMicrophone, setRequireMicrophone] = useState(initialRoom?.settings.requireMicrophone ?? false);
  const [monitorTabSwitch, setMonitorTabSwitch] = useState(initialRoom?.settings.monitorTabSwitch ?? true);
  const [monitorConnection, setMonitorConnection] = useState(initialRoom?.settings.monitorConnection ?? true);
  const [warningThreshold, setWarningThreshold] = useState(initialRoom?.settings.warningThreshold ?? 3);
  const [showPhasePreview, setShowPhasePreview] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    loadTeacherAssessments('exam')
      .then((items) => { if (active) setSavedExams(items); })
      .catch((loadError: unknown) => {
        console.error('Không thể tải danh sách đề lưu từ máy chủ.', loadError);
        if (active) setExamLoadError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đề đã lưu.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    listClasses()
      .then(async (availableClasses) => {
        const studentCounts = await Promise.all(availableClasses.map(async (classRoom) => (
          (await listClassStudents(classRoom.id)).length
        )));
        if (active) {
          setClasses(availableClasses.map((classRoom, index) => ({
            ...classRoom,
            studentCount: studentCounts[index],
          })));
        }
      })
      .catch((loadError: unknown) => {
        console.error('Không thể tải lớp và danh sách học sinh để cấu hình phòng thi.', loadError);
        if (active) setClassesError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách lớp.');
      })
      .finally(() => { if (active) setClassesLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedExam = savedExams.find((exam) => exam.id === selectedExamId)
    ?? (initialExam?.id === selectedExamId ? initialExam : null)
    ?? (initialRoom?.examSnapshot.id === selectedExamId ? initialRoom.examSnapshot : null);
  useEffect(() => {
    if (!initialRoom && selectedExam?.durationMinutes) setDurationMinutes(selectedExam.durationMinutes);
  }, [initialRoom, selectedExam]);
  const filteredExams = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return savedExams.filter((exam) => examReady(exam) && (
      (!normalized || `${exam.title} ${exam.topic} ${exam.subject} ${exam.grade}`.toLocaleLowerCase('vi').includes(normalized))
      && (!gradeFilter || exam.grade === gradeFilter)
    ));
  }, [gradeFilter, query, savedExams]);
  const visibleExams = filteredExams.slice(examPage * 2, examPage * 2 + 2);
  const sortedClasses = [...classes].sort((a, b) => (
    Number(a.grade.replace(/\D/g, '')) - Number(b.grade.replace(/\D/g, ''))
  ));
  const selectedClasses = classes.filter((item) => classIds.includes(item.id));
  const studentCount = selectedClasses.reduce((sum, item) => sum + item.studentCount, 0);
  const totalPoints = selectedExam?.questions.reduce((sum, question) => sum + question.points, 0) ?? 0;
  const timeError = useMemo(() => {
    const starts = new Date(startsAt).getTime();
    if (!Number.isFinite(starts)) return 'Hãy nhập thời điểm bắt đầu hợp lệ.';
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) return 'Thời gian làm bài phải từ 1 đến 600 phút.';
    return '';
  }, [durationMinutes, startsAt]);

  const settings = {
    shuffleQuestions,
    allowBackNavigation,
    allowEarlySubmit,
    requireCamera,
    requireMicrophone,
    monitorTabSwitch,
    monitorConnection,
    warningThreshold,
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

  const save = async (publish: boolean) => {
    if (!selectedExam || !examReady(selectedExam) || !roomTitle.trim() || classIds.length === 0 || timeError) {
      setError(!selectedExam ? 'Chọn một đề thi trước khi lưu.' : !roomTitle.trim() || classIds.length === 0 ? 'Bổ sung tên phòng và lớp tham gia.' : timeError || 'Đề thi cần ở trạng thái sẵn sàng sử dụng.');
      return;
    }
    const previous = initialRoom;
    const roomId = previous?.id ?? crypto.randomUUID();
    const room: ExamRoomRecord = {
      id: roomId,
      code: previous?.code ?? roomId.replace(/-/g, '').slice(-8).toLocaleUpperCase('en'),
      title: roomTitle.trim(),
      instructions: instructions.trim(),
      organizer: 'Giáo viên',
      classIds,
      classNames: selectedClasses.map((item) => item.name),
      studentCount,
      startsAt: new Date(startsAt).toISOString(),
      durationMinutes,
      status: publish ? new Date(startsAt).getTime() > Date.now() ? 'scheduled' : 'open' : 'draft',
      examId: selectedExam.id,
      examSnapshot: { ...selectedExam, questions: selectedExam.questions.map((question) => ({ ...question, options: [...question.options] })) },
      settings,
      sessions: previous?.sessions ?? [],
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      isDemo: false,
    };
    setSaving(true);
    try {
      await onSave(room, publish);
    } catch (saveError) {
      console.error('Không thể lưu cấu hình phòng thi.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu cấu hình phòng thi.');
    } finally {
      setSaving(false);
    }
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
                  <p className="mt-3 font-semibold text-slate-800">{savedExams.some(examReady) ? 'Không tìm thấy đề phù hợp' : 'Chưa có đề sẵn sàng sử dụng'}</p>
                  <p className="mt-1 text-sm text-slate-500">{savedExams.some(examReady) ? 'Thử đổi từ khóa hoặc bộ lọc.' : 'Chỉ đề đã sẵn sàng mới được dùng để tạo phòng thi.'}</p>
                  {!savedExams.some(examReady) && <button type="button" onClick={() => onNavigate('exams')} className="mt-4 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">Mở Ngân hàng đề thi</button>}
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
                {classesLoading && <p className="text-sm text-slate-500">Đang tải lớp được phân công...</p>}
                {classesError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{classesError}</p>}
                {!classesLoading && !classesError && classes.length === 0 && <p className="text-sm text-slate-500">Chưa có lớp nào được phân công cho tài khoản này.</p>}
                {sortedClasses.map((classRoom) => (
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
                <label className="block text-sm font-medium text-slate-700">Ngày giờ bắt đầu<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="input-field mt-1.5" /></label>
                <label className="block text-sm font-medium text-slate-700">Thời gian làm bài (phút)<input type="number" min={1} max={600} value={durationMinutes} onChange={(event) => setDurationMinutes(Math.max(1, Math.min(600, Number(event.target.value) || 1)))} className="input-field mt-1.5" /></label>
              </div>
              {timeError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{timeError}</p>}
              <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-blue-900">Mỗi học sinh có đủ thời gian này kể từ lúc bắt đầu lượt làm bài. Hết giờ thì bài được nộp; không cần đặt thêm hạn kết thúc chung. Mốc bắt đầu là thời gian dự kiến, giáo viên chủ động mở và đóng phòng.</p>
            </section>
          )}

          {step === 3 && (
            <section className="mx-auto max-w-3xl space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {checkbox(shuffleQuestions, setShuffleQuestions, 'Trộn thứ tự câu hỏi')}
                {checkbox(allowBackNavigation, setAllowBackNavigation, 'Cho quay lại câu trước')}
                {checkbox(allowEarlySubmit, setAllowEarlySubmit, 'Cho phép nộp bài sớm')}
                {checkbox(requireCamera, setRequireCamera, 'Yêu cầu kiểm tra webcam trước khi thi')}
                {checkbox(requireMicrophone, setRequireMicrophone, 'Yêu cầu kiểm tra micro trước khi thi')}
              </div>
              <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4">
                <div className="flex items-center gap-2 font-semibold text-violet-950"><ShieldCheck className="h-4 w-4" /> Ghi nhận sự kiện</div>
                {checkbox(monitorTabSwitch, setMonitorTabSwitch, 'Ghi nhận chuyển tab / rời màn hình')}
                {checkbox(monitorConnection, setMonitorConnection, 'Ghi nhận mất / khôi phục kết nối')}
                <label className="block text-sm font-medium text-slate-700">Ngưỡng cảnh báo<select value={warningThreshold} onChange={(event) => setWarningThreshold(Number(event.target.value))} className="input-field mt-1.5"><option value={1}>1 sự kiện</option><option value={2}>2 sự kiện</option><option value={3}>3 sự kiện</option><option value={5}>5 sự kiện</option></select></label>
                <p className="text-xs leading-5 text-violet-900">Sự kiện được đưa vào danh sách giáo viên cần xem xét khi đạt ngưỡng; không tự động trừ điểm hay nộp bài. Hiện phần này là giao diện minh họa, chưa ghi sự kiện lên máy chủ.</p>
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
                  <p><span className="text-slate-500">Bắt đầu:</span> {formatDate(startsAt)}</p>
                  <p><span className="text-slate-500">Thời gian làm bài:</span> {durationMinutes} phút mỗi học sinh</p>
                </article>
                <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="font-semibold text-slate-900">Quy tắc</h4>
                  <p>{shuffleQuestions ? 'Có' : 'Không'} trộn câu hỏi</p>
                  <p>{allowBackNavigation ? 'Được' : 'Không được'} quay lại - {allowEarlySubmit ? 'Được' : 'Không được'} nộp sớm</p>
                  <p>Ghi nhận: {monitorTabSwitch || monitorConnection ? [monitorTabSwitch && 'chuyển tab', monitorConnection && 'mất kết nối'].filter(Boolean).join(', ') : 'tắt'}</p>
                  <p>Chuyển giáo viên xem xét từ {warningThreshold} sự kiện</p>
                  <p>Thiết bị: {requireCamera || requireMicrophone ? [requireCamera && 'webcam', requireMicrophone && 'micro'].filter(Boolean).join(', ') : 'không yêu cầu webcam/micro'}</p>
                </article>
              </div>
              <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">Mã phòng: <strong className="tracking-widest">{initialRoom?.code ?? 'Tạo xong sẽ hiển thị mã phòng'}</strong></p>
              <button type="button" onClick={() => setShowPhasePreview(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"><Eye className="h-4 w-4" /> Xem trước 3 giai đoạn của học sinh</button>
              <p className="text-xs leading-5 text-slate-500">Cấu hình phòng và bản chụp đề sẽ được lưu vào cơ sở dữ liệu.</p>
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
          {showPhasePreview && (
            <ExamRoomPhasePreview
              examTitle={selectedExam?.title ?? roomTitle}
              durationMinutes={durationMinutes}
              warningThreshold={warningThreshold}
              onClose={() => setShowPhasePreview(false)}
            />
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button type="button" onClick={() => step === 0 ? onCancel() : (setError(''), setStep((current) => current - 1))} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Hủy' : 'Quay lại'}</button>
          <div className="flex min-w-0 flex-wrap justify-end gap-2">
            {step === 4 && <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Lưu bản nháp</button>}
            {step < 4 ? <button type="button" onClick={goNext} disabled={saving || (step === 0 && (!selectedExam || !examReady(selectedExam)))} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40">Tiếp tục <ArrowRight className="h-4 w-4" /></button> : <button type="button" onClick={() => void save(true)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"><Check className="h-4 w-4" /> {saving ? 'Đang lưu...' : 'Tạo phòng'}</button>}
          </div>
        </footer>
      </section>
    </div>
  );
}
