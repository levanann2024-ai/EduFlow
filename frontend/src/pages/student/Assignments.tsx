import { CalendarDays, CheckCircle2, ClipboardList, Clock3 } from 'lucide-react';
import { useState } from 'react';

type AssignmentStatus = 'Đang làm' | 'Chưa làm' | 'Đã nộp';

const assignments: {
  title: string;
  subject: string;
  subjectCode: string;
  due: string;
  status: AssignmentStatus;
}[] = [
  { title: 'Hàm số bậc hai', subject: 'Toán học', subjectCode: 'TOAN10', due: '22/10/2026', status: 'Chưa làm' },
  { title: 'Đồ thị hàm số', subject: 'Toán học', subjectCode: 'TOAN10', due: '23/10/2026', status: 'Chưa làm' },
  { title: 'Phương trình bậc hai', subject: 'Toán học', subjectCode: 'TOAN10', due: '24/10/2026', status: 'Chưa làm' },
  { title: 'Định luật II Newton', subject: 'Vật lý', subjectCode: 'LY10', due: '23/10/2026', status: 'Đang làm' },
  { title: 'Lực ma sát', subject: 'Vật lý', subjectCode: 'LY10', due: '24/10/2026', status: 'Chưa làm' },
  { title: 'Đọc hiểu văn bản', subject: 'Ngữ văn', subjectCode: 'VAN10', due: '24/10/2026', status: 'Đã nộp' },
  { title: 'Cấu tạo nguyên tử', subject: 'Hóa học', subjectCode: 'HOA10', due: '25/10/2026', status: 'Chưa làm' },
  { title: 'Unit 4 - For a better community', subject: 'Tiếng Anh', subjectCode: 'ANH10', due: '26/10/2026', status: 'Chưa làm' },
  { title: 'Mạng máy tính và Internet', subject: 'Tin học', subjectCode: 'TIN10', due: '27/10/2026', status: 'Đã nộp' },
  { title: 'Tế bào nhân thực', subject: 'Sinh học', subjectCode: 'SINH10', due: '28/10/2026', status: 'Chưa làm' },
  { title: 'Văn minh cổ đại', subject: 'Lịch sử', subjectCode: 'SU10', due: '29/10/2026', status: 'Chưa làm' },
];

const statusStyles: Record<AssignmentStatus, string> = {
  'Đang làm': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Chưa làm': 'bg-slate-100 text-slate-600 ring-slate-200',
  'Đã nộp': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
};

export function Assignments({ initialSubjectCode = null }: { initialSubjectCode?: string | null }) {
  const [subjectFilter, setSubjectFilter] = useState(initialSubjectCode ?? 'all');
  const filteredAssignments = subjectFilter === 'all'
    ? assignments
    : assignments.filter((assignment) => assignment.subjectCode === subjectFilter);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <span>Môn học</span>
          <select className="input-field min-w-40" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="all">Tất cả môn</option>
            {Array.from(new Map(assignments.map(({ subjectCode, subject }) => [subjectCode, subject])).entries()).map(([code, subject]) => (
              <option key={code} value={code}>{subject}</option>
            ))}
          </select>
        </label>
      </div>
      {filteredAssignments.length > 0 ? (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Danh sách bài tập">
        {filteredAssignments.map((assignment) => {
          const submitted = assignment.status === 'Đã nộp';

          return (
            <article
              key={assignment.title}
              className="flex min-h-[248px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-slate-600">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <span className="truncate">{assignment.subject}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[assignment.status]}`}>
                  {assignment.status}
                </span>
              </div>

              <div className="flex-1 py-5">
                <h3 className="text-base font-semibold leading-6 text-slate-900">{assignment.title}</h3>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
                  {submitted ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : assignment.status === 'Đang làm' ? (
                    <Clock3 className="h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />
                  )}
                  <span className="text-slate-500">{submitted ? 'Đã nộp' : 'Hạn nộp'}</span>
                  <span className={`ml-auto font-semibold ${submitted ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {assignment.due}
                  </span>
                </div>
              </div>

              <footer className="border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    submitted
                      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {submitted && <CheckCircle2 className="h-4 w-4" />}
                  {submitted ? 'Xem bài nộp' : 'Làm bài'}
                </button>
              </footer>
            </article>
          );
        })}
      </section>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">Môn học này chưa có bài tập.</p>
      )}
    </div>
  );
}
