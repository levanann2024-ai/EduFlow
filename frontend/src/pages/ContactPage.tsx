import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  ClipboardCheck,
  Mail,
  MessageSquareText,
} from 'lucide-react';
import { GOOGLE_FORMS_SURVEY_URL } from '@/config/links';
import type { Role } from '@/types';

const supportEmail = 'eduflow.contact2026@gmail.com';

const roleContent = {
  student: {
    audience: 'Dành cho học sinh',
    heading: 'Cần hỗ trợ trong hành trình học tập?',
    description: 'Gửi câu hỏi hoặc báo vấn đề bạn gặp phải. EduFlow sẽ hỗ trợ bạn qua email.',
    topics: [
      { icon: BookOpen, title: 'Môn học & bài tập', text: 'Nội dung lớp, bài tập hoặc tài liệu học tập.' },
      { icon: ClipboardCheck, title: 'Kết quả & bài thi', text: 'Điểm số, lịch sử làm bài hoặc phòng thi.' },
      { icon: CircleHelp, title: 'Tài khoản', text: 'Đăng nhập, hồ sơ hoặc các vấn đề sử dụng.' },
    ],
  },
  lecturer: {
    audience: 'Dành cho giáo viên',
    heading: 'Cùng EduFlow hỗ trợ việc giảng dạy',
    description: 'Liên hệ với đội ngũ về lớp học, bài tập, chấm điểm hoặc vấn đề kỹ thuật.',
    topics: [
      { icon: BookOpen, title: 'Lớp học & tài liệu', text: 'Quản lý lớp, lịch dạy hoặc kho bài giảng.' },
      { icon: ClipboardCheck, title: 'Bài tập & điểm số', text: 'Giao bài, chấm bài hoặc kết quả học sinh.' },
      { icon: CircleHelp, title: 'Tài khoản & kỹ thuật', text: 'Đăng nhập, cài đặt hoặc lỗi khi sử dụng.' },
    ],
  },
  admin: {
    audience: 'Liên hệ EduFlow',
    heading: 'Chúng mình có thể hỗ trợ gì?',
    description: 'Gửi câu hỏi hoặc báo vấn đề bạn gặp phải khi sử dụng EduFlow.',
    topics: [
      { icon: BookOpen, title: 'Nội dung & hệ thống', text: 'Câu hỏi về nội dung hoặc các tính năng.' },
      { icon: ClipboardCheck, title: 'Quản lý & dữ liệu', text: 'Vấn đề quản lý hoặc dữ liệu hệ thống.' },
      { icon: CircleHelp, title: 'Tài khoản & kỹ thuật', text: 'Đăng nhập, cài đặt hoặc lỗi khi sử dụng.' },
    ],
  },
} satisfies Record<Role, {
  audience: string;
  heading: string;
  description: string;
  topics: Array<{ icon: typeof BookOpen; title: string; text: string }>;
}>;

const englishRoleContent = {
  student: {
    audience: 'Student',
    heading: 'Need help with your learning?',
    description: 'Ask a question or report an issue. The EduFlow team can help you by email.',
    topics: [
      { icon: BookOpen, title: 'Subjects & assignments', text: 'Class content, assignments, or learning resources.' },
      { icon: ClipboardCheck, title: 'Grades & exams', text: 'Scores, attempt history, or exam rooms.' },
      { icon: CircleHelp, title: 'Account', text: 'Sign-in, profile, or other usage questions.' },
    ],
  },
  lecturer: {
    audience: 'Teacher',
    heading: 'We are here to support your teaching',
    description: 'Contact us about classes, assignments, grading, or technical issues.',
    topics: [
      { icon: BookOpen, title: 'Classes & resources', text: 'Class management, schedule, or teaching resources.' },
      { icon: ClipboardCheck, title: 'Assignments & grades', text: 'Assignments, grading, or student results.' },
      { icon: CircleHelp, title: 'Account & technical help', text: 'Sign-in, settings, or technical issues.' },
    ],
  },
  admin: {
    audience: 'EduFlow support',
    heading: 'How can we help?',
    description: 'Ask a question or report an issue you encountered while using EduFlow.',
    topics: [
      { icon: BookOpen, title: 'Content & system', text: 'Questions about content or features.' },
      { icon: ClipboardCheck, title: 'Management & data', text: 'System management or data questions.' },
      { icon: CircleHelp, title: 'Account & technical help', text: 'Sign-in, settings, or technical issues.' },
    ],
  },
} satisfies typeof roleContent;

export function ContactPage({ role, language = 'vi' }: { role: Role; language?: 'vi' | 'en' }) {
  const content = language === 'en' ? englishRoleContent[role] : roleContent[role];
  const emailSubject = `${language === 'en' ? 'EduFlow support' : 'Hỗ trợ EduFlow'} - ${content.audience}`;
  const emailHref = `https://mail.google.com/mail/?${new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: supportEmail,
    su: emailSubject,
  }).toString()}`;

  return (
    <main className="mx-auto max-w-5xl space-y-7 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50 via-violet-50 to-cyan-50 p-6 sm:p-9 lg:p-11">
        <div aria-hidden="true" className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-indigo-200/30 blur-2xl" />
        <div aria-hidden="true" className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-200/30 blur-2xl" />
        <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(270px,0.8fr)]">
          <div>
            <h1 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {content.heading}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              {content.description}
            </p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-lg shadow-indigo-900/5 sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">{language === 'en' ? 'Email EduFlow support' : 'Gửi email cho EduFlow'}</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {language === 'en'
                ? 'Briefly describe your question or idea so our team can help.'
                : 'Mô tả ngắn gọn vấn đề hoặc ý tưởng để đội ngũ dễ hỗ trợ hơn.'}
            </p>
            <a
              href={emailHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-600/15 transition hover:from-indigo-700 hover:to-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <span className="break-all">{supportEmail}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-options-title">
        <div className="mb-4">
          <h2 id="contact-options-title" className="text-xl font-extrabold text-slate-900">{language === 'en' ? 'Get in touch' : 'Kết nối với chúng mình'}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={emailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <Mail className="h-5 w-5" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-indigo-600" />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">{language === 'en' ? 'Support email' : 'Email hỗ trợ'}</h3>
            <p className="mt-1 text-sm text-slate-500">{language === 'en' ? 'Ask a question, report a bug, or share feedback.' : 'Gửi câu hỏi, báo lỗi hoặc chia sẻ góp ý trực tiếp.'}</p>
            <p className="mt-4 break-all text-sm font-semibold text-indigo-700">{supportEmail}</p>
          </a>

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.6875rem] font-bold text-amber-800">{language === 'en' ? 'Have your say' : 'Cùng góp ý'}</span>
            </div>
            <h3 className="mt-4 font-bold text-slate-900">{language === 'en' ? 'Feedback form' : 'Biểu mẫu góp ý'}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              {language === 'en'
                ? 'Share your experience to help EduFlow improve teaching and learning.'
                : 'Chia sẻ trải nghiệm để EduFlow cải thiện việc dạy và học.'}
            </p>
            <a
              href={GOOGLE_FORMS_SURVEY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-amber-950 shadow-sm transition-colors hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
            >
              {language === 'en' ? 'Take the survey' : 'Tham gia khảo sát'} <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section aria-labelledby="contact-topics-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 id="contact-topics-title" className="text-lg font-bold text-slate-900">{language === 'en' ? 'What we can help with' : 'Các nội dung hỗ trợ'}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {content.topics.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl bg-slate-50 p-4">
              <Icon className="h-5 w-5 text-indigo-600" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
