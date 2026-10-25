import { useEffect, useState } from 'react';
import type { FormEvent, TransitionEvent } from 'react';
import {
  ArrowRight,
  Bot,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Send,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Page } from '@/types';
import { studentResults } from './studentResults';
import { StudentSubjectCard } from './StudentSubjectCard';

interface StudentDashboardProps {
  onNavigate: (page: Page) => void;
  onOpenResources: (subjectCode: string) => void;
  onOpenAssignments: (subjectCode: string, topic?: string) => void;
  onAskAI: (prompt: string) => void;
}

const subjects = [
  { code: 'TOAN10', name: 'Toán học', lessons: '18/35', resources: 12, tasks: 3, progress: 51 },
  { code: 'VAN10', name: 'Ngữ văn', lessons: '20/35', resources: 10, tasks: 0, progress: 57 },
  { code: 'LY10', name: 'Vật lý', lessons: '14/28', resources: 8, tasks: 2, progress: 50 },
  { code: 'HOA10', name: 'Hóa học', lessons: '12/28', resources: 6, tasks: 1, progress: 43 },
  { code: 'ANH10', name: 'Tiếng Anh', lessons: '22/28', resources: 10, tasks: 1, progress: 78 },
  { code: 'TIN10', name: 'Tin học', lessons: '32/35', resources: 8, tasks: 0, progress: 91 },
  { code: 'SINH10', name: 'Sinh học', lessons: '22/35', resources: 8, tasks: 0, progress: 63 },
  { code: 'SU10', name: 'Lịch sử', lessons: '24/35', resources: 7, tasks: 1, progress: 69 },
  { code: 'DIA10', name: 'Địa lý', lessons: '0/1', resources: 1, tasks: 0, progress: 0 },
  { code: 'GDTC10', name: 'Giáo dục thể chất', lessons: '0/1', resources: 1, tasks: 0, progress: 0 },
] as const;

const assignments = [
  { code: '#TOAN10-CH2', subjectCode: 'TOAN10', subject: 'Toán học 10', title: 'Bài tập chương 3 – Toán', due: '24/10/2026', status: 'Chưa làm' },
  { code: '#VAN10-CH2', subjectCode: 'VAN10', subject: 'Ngữ văn 10', title: 'Đọc hiểu văn bản – Ngữ văn', due: '25/10/2026', status: 'Đang làm' },
  { code: '#VL10-CH3', subjectCode: 'LY10', subject: 'Vật lý 10', title: 'Bài tập chương 4 – Vật lý', due: '26/10/2026', status: 'Chưa làm' },
  { code: '#HH10-CH1', subjectCode: 'HOA10', subject: 'Hóa học 10', title: 'Chương 3 – Hóa học', due: '28/10/2026', status: 'Chưa làm' },
];

const exams = [
  { subjectCode: 'TOAN10', subject: 'Toán', date: '22/10/2026', weekday: 'Th 4', duration: '45 phút - Phòng 201', time: '7:30 - 8:15' },
  { subjectCode: 'VAN10', subject: 'Ngữ văn', date: '24/10/2026', weekday: 'Th 6', duration: '90 phút - Phòng 203', time: '13:30 - 15:00' },
  { subjectCode: 'LY10', subject: 'Vật lý', date: '27/10/2026', weekday: 'Th 2', duration: '45 phút - Phòng 202', time: '9:15 - 10:00' },
];

function SubjectCarousel({
  onNavigate,
  onOpenResources,
  onOpenAssignments,
}: {
  onNavigate: (page: Page) => void;
  onOpenResources: (subjectCode: string) => void;
  onOpenAssignments: (subjectCode: string, topic?: string) => void;
}) {
  const repeatedSubjects = [...subjects, ...subjects];
  const [slideIndex, setSlideIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const interval = window.setInterval(() => {
      setSlideIndex((index) => index + 1);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [paused]);

  const handleSlideTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || slideIndex !== subjects.length) return;
    setTransitionEnabled(false);
    window.requestAnimationFrame(() => {
      setSlideIndex(0);
      window.requestAnimationFrame(() => setTransitionEnabled(true));
    });
  };

  const showPreviousSubject = () => {
    if (slideIndex === 0) {
      setTransitionEnabled(false);
      setSlideIndex(subjects.length);
      window.requestAnimationFrame(() => {
        setTransitionEnabled(true);
        window.requestAnimationFrame(() => setSlideIndex(subjects.length - 1));
      });
      return;
    }
    setSlideIndex((index) => index - 1);
  };

  return (
    <section aria-label="Môn học của em" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <BookOpen className="h-4 w-4 text-blue-600" />
          Môn học của bạn
        </h2> 
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onNavigate('my-classes')} className="mr-2 text-[10px] font-semibold text-blue-700 hover:text-blue-900">
            Xem tất cả <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </button>
          <button type="button" aria-label="Môn học trước" onClick={showPreviousSubject} className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-300 hover:text-blue-700">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Môn học tiếp theo" onClick={() => setSlideIndex((index) => index + 1)} className="rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-blue-300 hover:text-blue-700">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="student-subject-marquee"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}
      >
        <div
          className="student-subject-marquee-track"
          onTransitionEnd={handleSlideTransitionEnd}
          style={{
            transform: `translateX(-${slideIndex * 5}%)`,
            transition: transitionEnabled ? 'transform 700ms ease-in-out' : 'none',
          }}
        >
          {repeatedSubjects.map((subject, index) => (
            <span key={`${subject.code}-${index}`} aria-hidden={index >= subjects.length} className="student-subject-card">
              <StudentSubjectCard
                artworkKey={subject.code}
                name={`${subject.name} 10`}
                lessons={subject.lessons}
                resources={subject.resources}
                assignments={subject.tasks}
                progress={subject.progress}
                isClone={index >= subjects.length}
                onLessonsClick={() => onNavigate('schedule')}
                onResourcesClick={() => onOpenResources(subject.code)}
                onAssignmentsClick={() => onOpenAssignments(subject.code)}
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StudentDashboard({ onNavigate, onOpenResources, onOpenAssignments, onAskAI }: StudentDashboardProps) {
  const [prompt, setPrompt] = useState('');
  const pendingAssignments = assignments.filter((assignment) => assignment.status !== 'Đã nộp');
  const focusAssignment = pendingAssignments.find((assignment) => assignment.status === 'Chưa làm') ?? pendingAssignments[0];
  const allAverage = studentResults.reduce((sum, result) => sum + result.score, 0) / studentResults.length;
  const subjectScores = [...new Set(studentResults.map((result) => result.subject))]
    .map((subject) => {
      const scores = studentResults.filter((result) => result.subject === subject);
      return { subject, average: scores.reduce((sum, result) => sum + result.score, 0) / scores.length };
    })
    .sort((first, second) => second.average - first.average);

  const submitPrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    onAskAI(prompt.trim());
  };

  return (
    <div className="student-dashboard-scale space-y-3 pb-4">
      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(260px,0.95fr)]">
        <div className="min-w-0 space-y-3">
          <section className="relative isolate min-h-[146px] overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm sm:px-6">
            <div className="relative z-10 max-w-full sm:max-w-[68%]">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Chào buổi sáng, An! 👋</h1>
              <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">Học tốt hơn mỗi ngày, từng bước nhỏ đều tạo nên kết quả lớn!</p>
              <form onSubmit={submitPrompt} className="mt-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-white p-1.5 shadow-sm">
                <Sparkles className="ml-1 h-4 w-4 shrink-0 text-blue-600" />
                <label htmlFor="dashboard-ai-prompt" className="sr-only">Hỏi trợ lý AI</label>
                <input
                  id="dashboard-ai-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Hỏi AI bất cứ điều gì về bài học của bạn..."
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
                />
                <button type="submit" aria-label="Gửi câu hỏi cho AI" disabled={!prompt.trim()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
            <svg aria-hidden="true" viewBox="0 0 260 170" className="absolute bottom-0 right-0 hidden h-[142px] w-[220px] sm:block lg:h-[160px] lg:w-[250px]">
              <ellipse cx="150" cy="155" rx="106" ry="10" fill="#bfdbfe" opacity=".55" />
              <path d="M38 145h190" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
              <path d="M62 142v-40h35v40M57 102h45v7H57z" fill="#34d399" />
              <path d="M78 102c-18-20-7-31 1-25 2-20 18-18 17-3 15-9 20 8 3 28" fill="#6ee7b7" />
              <path d="M117 141h41l-4-30h-34z" fill="#2563eb" />
              <path d="M119 111h39l-3 25h-33z" fill="#60a5fa" />
              <path d="M111 141h55v8h-55z" rx="3" fill="#1e3a8a" />
              <path d="M132 137h16" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
              <rect x="90" y="132" width="25" height="12" rx="2" fill="#fbbf24" />
              <rect x="94" y="124" width="23" height="10" rx="2" fill="#fb7185" />
              <rect x="96" y="117" width="20" height="8" rx="2" fill="#f8fafc" />
              <path d="M181 74c0-16 11-27 26-27s25 11 25 27v18h-51z" fill="#1e40af" />
              <circle cx="207" cy="77" r="20" fill="#f6c7a7" />
              <path d="M187 71c2-18 13-27 27-24 11 2 18 10 19 22-9-2-17-8-20-13-7 9-15 13-26 15z" fill="#1e3a8a" />
              <path d="M198 78h2m15 0h2" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M201 87c4 3 8 3 12 0" fill="none" stroke="#c2415d" strokeWidth="2" strokeLinecap="round" />
              <path d="M184 97c8-8 38-9 48 0l13 45h-74z" fill="#3b82f6" />
              <path d="M184 105c-10 5-18 15-25 27l9 5 22-20m38-12c8 5 14 13 20 22l-9 6-18-15" fill="#2563eb" />
              <path d="M149 101l16-9 4 5-14 13z" fill="#f6c7a7" />
              <path d="M235 59l12-8m-7 16 13-2M38 65l12-5-3 10m3-10 8 4" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M42 82c10-9 20-9 28 0M70 82l-5-6m5 6-7 4" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </section>

          <SubjectCarousel onNavigate={onNavigate} onOpenResources={onOpenResources} onOpenAssignments={onOpenAssignments} />

          <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.85fr)]">
            <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><FileText className="h-4 w-4 text-blue-600" />Bài tập cần làm gần đây</h2>
                <button type="button" onClick={() => onNavigate('assignments')} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Xem tất cả <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 px-4">
                {pendingAssignments.slice(0, 4).map((assignment) => (
                  <button
                    key={assignment.code}
                    type="button"
                    onClick={() => onOpenAssignments(assignment.subjectCode, assignment.title)}
                    className="flex min-h-[55px] w-full items-center gap-2.5 py-2 text-left transition hover:bg-blue-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><BookOpen className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-semibold text-slate-800">{assignment.title}</span>
                      <span className="mt-1 flex items-center gap-1 truncate text-[9px] text-slate-500">
                        {assignment.subject} - <Clock3 className="h-2.5 w-2.5 shrink-0" /> Hạn nộp: {assignment.due}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${assignment.status === 'Đang làm' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-600'}`}>{assignment.status}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </section>

            <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Trophy className="h-4 w-4 text-blue-600" />Tiến độ học tập</h2>
                <button type="button" onClick={() => onNavigate('my-results')} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">
                  Chi tiết <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
                </button>
              </div>
              <p className="mt-3 text-[10px] text-slate-500">Điểm trung bình</p>
              <div className="flex items-end gap-2 border-b border-slate-100 pb-2">
                <strong className="text-3xl font-extrabold leading-none text-slate-900">{allAverage.toFixed(1)}</strong>
                <span className="pb-0.5 text-[10px] text-slate-500">/10 - {studentResults.length} kết quả</span>
              </div>
              <div className="mt-3 flex-1 space-y-3">
                {subjectScores.slice(0, 4).map(({ subject, average }) => (
                  <div key={subject}>
                    <div className="mb-1 flex justify-between gap-2 text-[10px]">
                      <span className="truncate font-medium text-slate-700">{subject}</span>
                      <strong className="text-slate-800">{average.toFixed(1)}</strong>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${average * 10}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarClock className="h-4 w-4 text-blue-600" />Lịch kiểm tra sắp tới</h2>
              <button type="button" onClick={() => onNavigate('online-exams')} className="shrink-0 text-[10px] font-semibold text-blue-700 hover:text-blue-900">
                Xem tất cả <ArrowRight className="ml-0.5 inline h-3 w-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {exams.map((exam) => (
                <button key={exam.subjectCode} type="button" onClick={() => onNavigate('online-exams')} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-blue-50">
                  <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-blue-800">
                    <span className="text-[9px] font-medium text-slate-500">{exam.weekday}</span>
                    <span className="text-lg font-extrabold leading-5">{exam.date.slice(0, 2)}</span>
                    <span className="text-[9px] text-slate-500">Tháng 10</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-800">{exam.subject}</span>
                    <span className="mt-1 block truncate text-[10px] text-slate-500">{exam.duration}</span>
                    <span className="mt-1 block text-[10px] text-slate-500">{exam.time}</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </section>

          <section className="flex-1 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Bot className="h-4 w-4 text-blue-700" />AI Gợi ý hôm nay</h2>
            {focusAssignment ? (
              <div className="mt-3 space-y-2 text-xs leading-5 text-slate-700">
                <p>Ôn lại <strong>{focusAssignment.subject}</strong> trước khi làm “{focusAssignment.title}”.</p>
                <p>Ưu tiên hoàn thành bài này trước hạn <strong>{focusAssignment.due}</strong>.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-slate-700">Bạn đã hoàn thành các bài tập cần làm. Hãy xem lại những nội dung vừa học để ghi nhớ lâu hơn.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
