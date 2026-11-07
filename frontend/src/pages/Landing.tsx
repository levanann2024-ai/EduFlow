import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { GOOGLE_FORMS_SURVEY_URL } from '@/config/links';
import studentDashboard from '@/assets/landing-student-dashboard.png';
import teacherDashboard from '@/assets/landing-teacher-dashboard.png';
import aiLecture from '@/assets/landing-ai-lecture.png';
import aiAssessment from '@/assets/landing-ai-assessment.png';
import aiLesson from '@/assets/landing-ai-lesson.png';

const journeySteps = [
  { number: '01', title: 'Đăng nhập', detail: 'Sử dụng tài khoản được nhà trường cấp.' },
  { number: '02', title: 'Khám phá', detail: 'Truy cập lớp học, môn học và tài liệu.' },
  { number: '03', title: 'Học tập và giảng dạy', detail: 'Giao bài, làm bài, tổ chức kiểm tra.' },
  { number: '04', title: 'Theo dõi và cải thiện', detail: 'Xem kết quả, phân tích tiến độ và định hướng tiếp theo.' },
];

const aiPreviews = [
  { label: 'Bài giảng', image: aiLecture, alt: 'Giao diện chuẩn bị bài giảng với AI' },
  { label: 'Đề kiểm tra', image: aiAssessment, alt: 'Giao diện tạo đề kiểm tra với AI' },
  { label: 'Giáo án', image: aiLesson, alt: 'Giao diện soạn giáo án với AI' },
];
const surveyCtaClassName = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

function ProductVisual({ image, label }: { image: string; label: string }) {
  return (
    <figure className="rounded-2xl border border-white/90 bg-white p-1.5 shadow-[0_24px_65px_-25px_rgba(30,64,175,0.38),0_4px_14px_rgba(30,64,175,0.08)] sm:rounded-[1.25rem] sm:p-2">
      <img src={image} alt={label} className="block h-auto w-full rounded-xl" />
    </figure>
  );
}

export function Landing({ onLogin }: { onLogin: () => void }) {
  const [aiPreview, setAiPreview] = useState(0);

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-900">
      <header className="relative z-10 bg-[#f2f7ff]">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          <a href="#gioi-thieu" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" aria-label="EduFlow - Giới thiệu">
            <img src="/eduflow-mark.png" alt="" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-bold tracking-tight text-slate-950">EduFlow</span>
          </a>
          <nav aria-label="Điều hướng trang giới thiệu" className="hidden items-center gap-9 text-base font-semibold text-slate-600 md:flex">
            <a href="#doi-tuong" className="transition-colors hover:text-blue-700">Dành cho bạn</a>
            <a href="#hanh-trinh" className="transition-colors hover:text-blue-700">Cách bắt đầu</a>
            <a href="#ai" className="transition-colors hover:text-blue-700">AI trong EduFlow</a>
          </nav>
        </div>
      </header>

      <section id="gioi-thieu" className="relative scroll-mt-8 bg-gradient-to-br from-[#f2f7ff] via-[#eaf2ff] to-[#f8fbff]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-0 h-[34rem] w-[48rem] rounded-full bg-blue-200/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-14 lg:min-h-[640px] lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] lg:gap-10 lg:px-12 lg:pb-28 lg:pt-20">
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Nền tảng dạy và học EduFlow</p>
            <h1 className="mt-5 text-[clamp(1.65rem,8vw,2rem)] font-bold leading-[1.12] tracking-[-0.035em] text-[#0b1c42] sm:text-5xl lg:text-[2.75rem] xl:text-[3.5rem]">
              <span className="block whitespace-nowrap">Dạy học hiệu quả hơn.</span>
              <span className="mt-2 block text-blue-700">Học tập có định <span className="sm:block">hướng hơn.</span></span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl sm:leading-9">
              EduFlow kết nối giáo viên và học sinh trong một môi trường học tập thống nhất, với AI hỗ trợ chuẩn bị bài giảng, tổ chức lớp học và định hướng học tập.
            </p>
            <button type="button" onClick={onLogin} className="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-blue-700 px-7 py-4 text-base font-bold text-white shadow-lg shadow-blue-700/20 transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
              Đăng nhập <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="relative lg:py-6">
            <div aria-hidden="true" className="absolute -inset-4 rounded-[2rem] bg-blue-200/35 sm:-inset-6" />
            <div className="relative">
              <ProductVisual image={studentDashboard} label="Giao diện học sinh EduFlow" />
            </div>
          </div>
        </div>
      </section>

      <section id="doi-tuong" aria-labelledby="audiences-heading" className="scroll-mt-8 bg-white">
        <div className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Dành cho bạn</p>
            <h2 id="audiences-heading" className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#0b1c42] sm:text-4xl lg:text-5xl">
              Một nền tảng. Hai hành trình học tập và giảng dạy.
            </h2>
          </div>
          <div className="mt-12 space-y-6 sm:mt-16 sm:space-y-8">
            <article id="giao-vien" className="grid items-center gap-8 overflow-hidden rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-[#f7faff] to-[#eaf2ff] p-6 sm:p-9 lg:grid-cols-[minmax(0,48fr)_minmax(0,52fr)] lg:gap-12 lg:p-12">
              <div className="max-w-lg">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Giảng dạy cùng EduFlow</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1c42] sm:text-4xl">Dành cho giáo viên</h3>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Chuẩn bị bài giảng, tổ chức lớp học và theo dõi kết quả học tập. AI hỗ trợ công việc chuyên môn để giáo viên có thêm thời gian tập trung vào học sinh.
                </p>
              </div>
              <ProductVisual image={teacherDashboard} label="Minh họa AI giao diện giáo viên với dữ liệu ví dụ" />
            </article>
            <article id="hoc-sinh" className="grid items-center gap-8 overflow-hidden rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-[#f7faff] to-[#eaf2ff] p-6 sm:p-9 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] lg:gap-12 lg:p-12">
              <div className="max-w-lg lg:order-2">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-blue-700">Học tập cùng EduFlow</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-[#0b1c42] sm:text-4xl">Dành cho học sinh</h3>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Tìm tài liệu, theo dõi bài tập và lịch kiểm tra, xem kết quả học tập và biết mình nên ôn tập điều gì tiếp theo.
                </p>
              </div>
              <div className="lg:order-1">
                <ProductVisual image={studentDashboard} label="Giao diện học sinh EduFlow" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="hanh-trinh" aria-labelledby="journey-heading" className="scroll-mt-8 bg-[#f5f9ff]">
        <div className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">Hành trình trên EduFlow</p>
            <h2 id="journey-heading" className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#0b1c42] sm:text-4xl lg:text-5xl">
              Bắt đầu đơn giản, học tập có định hướng.
            </h2>
          </div>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-12 lg:mt-16 lg:grid-cols-4">
            {journeySteps.map((step) => (
              <li key={step.number} className="relative border-l-2 border-blue-200 pl-6 sm:pl-7 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white shadow-md shadow-blue-700/20">{step.number}</span>
                <h3 className="mt-5 text-xl font-bold leading-7 text-[#0b1c42]">{step.title}</h3>
                <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="ai" aria-labelledby="ai-heading" className="scroll-mt-8 bg-white">
        <div className="mx-auto max-w-[1360px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
          <div className="relative grid items-center gap-10 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#edf4ff] to-[#dceaff] p-7 sm:p-12 lg:grid-cols-2 lg:gap-16 lg:p-16">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-32 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />
            <div className="relative">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-700">AI trong EduFlow</p>
              <h2 id="ai-heading" className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#0b1c42] sm:text-4xl">
                AI hỗ trợ công việc chuyên môn. <span className="text-blue-700">Giáo viên giữ quyền quyết định.</span>
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                AI giúp giáo viên chuẩn bị bài giảng, xây dựng câu hỏi và phân tích kết quả học tập. Mọi nội dung đều được giáo viên kiểm tra, chỉnh sửa và quyết định trước khi sử dụng.
              </p>
              <p className="mt-6 border-l-2 border-blue-600 pl-4 text-base font-bold leading-7 text-slate-800">
                AI hỗ trợ, không thay thế giáo viên.
              </p>
            </div>
            <div className="relative rounded-[1.5rem] border border-white bg-white/70 p-4 shadow-[0_20px_50px_-25px_rgba(30,64,175,0.4)] sm:p-6">
              <p className="text-base font-bold text-[#0b1c42]">Công cụ soạn bài với AI</p>
              <div role="group" aria-label="Chọn giao diện AI" className="mt-4 flex flex-wrap gap-2">
                {aiPreviews.map((preview, index) => (
                  <button
                    key={preview.label}
                    type="button"
                    aria-pressed={aiPreview === index}
                    onClick={() => setAiPreview(index)}
                    className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${aiPreview === index ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
                  >
                    {preview.label}
                  </button>
                ))}
              </div>
              <figure className="mt-4 flex h-[410px] items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-[#f7faff] p-3 sm:h-[480px]">
                <img src={aiPreviews[aiPreview].image} alt={aiPreviews[aiPreview].alt} className="block h-auto max-h-full max-w-full rounded-lg object-contain shadow-sm" />
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="start-heading" className="bg-white px-5 pb-20 sm:px-8 sm:pb-24 lg:px-12">
        <div className="mx-auto max-w-[1264px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-800 via-blue-700 to-[#416be0] px-7 py-14 text-center text-white shadow-xl shadow-blue-900/15 sm:px-12 sm:py-20">
          <h2 id="start-heading" className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Sẵn sàng bắt đầu với EduFlow?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-blue-50 sm:text-xl sm:leading-9">
            Đăng nhập bằng tài khoản được nhà trường cấp và khám phá môi trường học tập của bạn.
          </p>
        </div>
      </section>

      <section aria-labelledby="survey-heading" className="bg-white px-5 pb-12 sm:px-8 sm:pb-16 lg:px-12">
        <div className="mx-auto flex max-w-[1264px] flex-col gap-5 rounded-2xl border border-blue-100 bg-[#f5f9ff] px-6 py-7 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-9 sm:py-8">
          <div className="max-w-3xl">
            <h2 id="survey-heading" className="text-xl font-bold tracking-tight text-[#0b1c42] sm:text-2xl">
              Chia sẻ ý kiến của bạn
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
              Mỗi góp ý của bạn đều giúp EduFlow hoàn thiện hơn, mang đến trải nghiệm dạy và học tốt hơn.
            </p>
          </div>
          <a
            href={GOOGLE_FORMS_SURVEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${surveyCtaClassName} w-full shrink-0 sm:w-auto`}
          >
            Tham gia khảo sát <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>

      <footer className="border-t border-blue-100 bg-[#f5f9ff]">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-4 px-5 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <a href="#gioi-thieu" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <img src="/eduflow-mark.png" alt="" className="h-9 w-9 rounded-lg" /> EduFlow
          </a>
          <a href="mailto:eduflow.contact2026@gmail.com" className="break-all hover:text-blue-700">Liên hệ: eduflow.contact2026@gmail.com</a>
        </div>
      </footer>
    </main>
  );
}
