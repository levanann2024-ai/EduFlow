import { ArrowRight } from 'lucide-react';

const learningSteps = [
  { number: '01', title: 'Soạn bài', detail: 'Bài giảng, câu hỏi' },
  { number: '02', title: 'Dạy và học', detail: 'Lớp học, học liệu' },
  { number: '03', title: 'Phân tích', detail: 'Kết quả học tập' },
  { number: '04', title: 'Định hướng', detail: 'Bước học tiếp theo' },
];

export function Landing({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <a href="#gioi-thieu" className="flex shrink-0 items-center gap-2.5" aria-label="EduFlow - Giới thiệu">
            <img src="/eduflow-mark.png" alt="" className="h-9 w-9 rounded-xl" />
            <span className="text-lg font-bold tracking-tight">EduFlow</span>
          </a>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-base font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Đăng nhập <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <section id="gioi-thieu" className="scroll-mt-20 bg-gradient-to-br from-blue-50/80 via-white to-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 sm:px-7 sm:py-12 lg:grid-cols-2 lg:gap-14 lg:py-14">
          <div className="max-w-xl">
            <h1 className="mt-4 text-5xl font-bold leading-[1.06] tracking-tight text-slate-950 sm:text-6xl">
              Dạy học có kết nối.
              <span className="mt-1 block text-blue-700">Học tập có định hướng.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
              Từ chuẩn bị bài và tổ chức lớp học đến theo dõi kết quả, EduFlow kết nối công việc của
              giáo viên với hành trình học tập của học sinh.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-[0_16px_44px_-32px_rgba(30,64,175,0.5)] sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <img src="/eduflow-mark.png" alt="" className="h-10 w-10 rounded-xl" />
              <div>
                <p className="text-base font-semibold text-slate-900">Quy trình trên EduFlow</p>
              </div>
            </div>
            <ol className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-3">
              {learningSteps.map((step) => (
                <li key={step.number} className="min-w-0">
                  <p className="text-sm font-bold tracking-wide text-blue-700">{step.number}</p>
                  <h2 className="mt-1.5 text-base font-semibold text-slate-900">{step.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="audiences-heading" className="mx-auto max-w-6xl px-4 py-9 sm:px-7 sm:py-11">
        <div className="mb-6">
          <h2 id="audiences-heading" className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Mỗi vai trò, một cách hỗ trợ
          </h2>
        </div>
        <div className="grid gap-6 border-y border-slate-200 py-6 md:grid-cols-2 md:gap-10">
          <article id="giao-vien" className="scroll-mt-24 md:border-r md:border-slate-200 md:pr-10">
            <h3 className="text-lg font-semibold text-blue-800">Dành cho giáo viên</h3>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Chuẩn bị bài giảng, quản lý lớp và học liệu, rồi xem kết quả để nhận biết học sinh cần hỗ trợ ở đâu.
            </p>
          </article>
          <article id="hoc-sinh" className="scroll-mt-24">
            <h3 className="text-lg font-semibold text-blue-800">Dành cho học sinh</h3>
            <p className="mt-2 text-base leading-7 text-slate-600">
              Tìm tài liệu theo môn, nắm bài tập và lịch kiểm tra, theo dõi tiến độ để biết mình nên ôn tập gì tiếp theo.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="ai-heading" className="border-t border-blue-100 bg-[#f7faff]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:px-7 sm:py-9 md:flex-row md:items-center md:justify-between md:gap-10">
          <div className="max-w-3xl">
            <h2 id="ai-heading" className="text-lg font-semibold text-slate-900">
              AI hỗ trợ công việc chuyên môn
            </h2>
            <p className="mt-1.5 text-base leading-7 text-slate-600">
              AI giúp chuẩn bị bài giảng, tạo câu hỏi và phân tích kết quả. Giáo viên kiểm tra, chỉnh sửa
              và quyết định nội dung phù hợp trước khi sử dụng.
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      </footer>
    </main>
  );
}
