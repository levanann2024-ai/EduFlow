import {
  ArrowRight,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  PenLine,
  Star,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Page } from '@/types';

interface TeacherDashboardProps {
  onNavigate: (page: Page) => void;
}

const workload = { submitted: 36, awaitingSubmission: 4, awaitingGrading: 2, appeals: 2 };

const quickFunctions: { label: string; description: string; page: Page; icon: LucideIcon; color: string }[] = [
  { label: 'Soạn bài nhanh', description: 'Lên kế hoạch giảng dạy', page: 'lesson-builder', icon: PenLine, color: 'emerald' },
  { label: 'Tạo đề kiểm tra', description: 'Sinh đề từ ngân hàng câu hỏi', page: 'exams', icon: FileCheck2, color: 'amber' },
  { label: 'Quản lý tài liệu', description: 'Lưu trữ bài giảng', page: 'lessons', icon: BookOpen, color: 'blue' },
  { label: 'Kết quả học tập', description: 'Xem điểm và tiến độ lớp', page: 'analytics', icon: ClipboardCheck, color: 'emerald' },
  { label: 'Quản lý lớp', description: 'Danh sách lớp và học sinh', page: 'classes', icon: Users, color: 'blue' },
];

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
        <Icon className="h-5 w-5 shrink-0 text-blue-600" />
        {children}
      </h2>
    </div>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${className}`}>{children}</section>;
}

export function TeacherDashboard({ onNavigate }: TeacherDashboardProps) {
  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-7xl pb-3 text-slate-900">
      <div className="flex w-full flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <section className="relative isolate flex min-h-[120px] items-center overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-100 via-blue-50 to-white px-5 py-4 shadow-sm sm:min-h-[132px] sm:px-6">
            <span aria-hidden="true" className="absolute -right-8 -top-12 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl" />
            <div className="relative z-10 max-w-[72%]">
              <p className="text-sm font-medium text-slate-700">Chào {now.getHours() < 11 ? 'buổi sáng' : now.getHours() < 14 ? 'buổi trưa' : now.getHours() < 18 ? 'buổi chiều' : 'buổi tối'},</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Nguyễn Văn An <span className="text-emerald-600">✦</span></h1>
              <p className="mt-2 text-sm text-slate-700 sm:text-base">Chúc thầy/cô có một ngày làm việc hiệu quả!</p>
              <p className="mt-2 text-xs italic text-slate-600 sm:text-sm">“Giáo dục là hành trình không có điểm kết thúc.”</p>
            </div>
            <svg aria-hidden="true" viewBox="0 0 180 160" className="absolute bottom-0 right-3 hidden h-36 w-44 sm:block">
              <path d="M0 150c30-25 45-12 70-25s48-36 110-20v55H0z" fill="#dbeafe" />
              <rect x="98" y="45" width="70" height="74" rx="5" fill="#99f6e4" />
              <path d="M108 60h50M108 72h38M108 84h46" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" opacity=".7" />
              <path d="M14 148h100l-9-27H25z" fill="#2563eb" />
              <path d="M38 119c2-31 12-52 34-52s34 21 36 52z" fill="#1d4ed8" />
              <path d="M53 76c-2-27 7-45 23-45s25 18 23 45l-8 20H60z" fill="#1e293b" />
              <ellipse cx="76" cy="57" rx="18" ry="23" fill="#f4c7a1" />
              <path d="M58 54c0-21 9-31 21-31 13 0 19 10 17 28-8-1-14-5-20-12-3 7-9 12-18 15z" fill="#1e293b" />
              <circle cx="70" cy="58" r="1.6" fill="#334155" /><circle cx="83" cy="58" r="1.6" fill="#334155" />
              <path d="M72 69c3 2 6 2 9 0" fill="none" stroke="#b4534b" strokeWidth="1.5" strokeLinecap="round" />
              <path d="m63 83 13 14 13-14-8-6h-10z" fill="white" />
              <path d="M108 88c9-5 16-14 21-24l8 2c-1 20-10 35-25 41z" fill="#2563eb" />
              <path d="m127 64 11-9 3 4-10 11" fill="#f4c7a1" />
              <rect x="28" y="99" width="20" height="30" rx="2" fill="#0f3b73" transform="rotate(-8 28 99)" />
              <rect x="31" y="102" width="14" height="23" rx="1" fill="#dbeafe" transform="rotate(-8 31 102)" />
            </svg>
          </section>

          <section aria-labelledby="teacher-priority-title" className="overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-white to-orange-50 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><ClipboardCheck className="h-7 w-7" /></span>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> Ưu tiên hôm nay</span>
                  <h2 id="teacher-priority-title" className="mt-0.5 text-lg font-extrabold text-slate-950 sm:text-xl">Bài cần chấm</h2>
                  <p className="mt-0.5 text-sm text-slate-700">{workload.awaitingGrading} bài nộp đang chờ chấm</p>
                </div>
              </div>
              <button type="button" onClick={() => onNavigate('ai-grading')} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800">
                Vào chấm bài <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => onNavigate('classes')} className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Users className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">Bài tập đã nộp</span><span className="mt-0.5 block text-sm text-slate-700"><strong>{workload.submitted} bài</strong> - cần xem và phản hồi</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-blue-700" />
            </button>
            <button type="button" onClick={() => onNavigate('appeals')} className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertTriangle className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">Phúc khảo &amp; sự cố</span><span className="mt-0.5 block text-sm text-slate-700"><strong>{workload.appeals} yêu cầu</strong> - cần kiểm tra</span></span>
              <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" />
            </button>
          </div>

          <Panel className="!p-5 sm:!p-6">
            <SectionTitle icon={Star}>Lối tắt chức năng</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {quickFunctions.map(({ label, description, page, icon: Icon, color }) => (
                <button key={label} type="button" onClick={() => onNavigate(page)} className={`group flex min-h-32 min-w-0 items-center gap-4 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm lg:flex-col lg:items-start lg:justify-center ${color === 'emerald' ? 'border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50' : color === 'amber' ? 'border-amber-100 bg-amber-50/30 hover:bg-amber-50' : 'border-blue-100 bg-blue-50/30 hover:bg-blue-50'}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
