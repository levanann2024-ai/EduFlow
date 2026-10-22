import { useEffect, useState } from 'react';
import { Check, FileImage, ScanLine, Sparkles, Upload } from 'lucide-react';

interface StudentWork {
  id: string;
  student: string;
  className: string;
  prompt: string;
  answer: string;
  score: number;
  reasoning: string[];
  diagnosis: string;
}

const submissions: StudentWork[] = [
  {
    id: 'W-01',
    student: 'Nguyễn Minh Khôi',
    className: '10A1',
    prompt: 'Tính sin(π/3) và giải phương trình x² = 2.',
    answer: 'sin(pi/3) = sqrt(3)/2\nx = sqrt(2) hoặc x = -sqrt(2)',
    score: 9,
    reasoning: ['Dùng đúng giá trị lượng giác của góc đặc biệt.', 'Tìm đủ hai nghiệm của phương trình.', 'Trình bày rõ, ký hiệu chính xác.'],
    diagnosis: 'Không có lỗi kiến thức. Có thể bổ sung điều kiện x ∈ ℝ.',
  },
  {
    id: 'W-02',
    student: 'Phạm Thu Trang',
    className: '10A1',
    prompt: 'Rút gọn biểu thức sqrt(2) - 1 và nêu điều kiện xác định.',
    answer: 'sqrt(2)-1 > 0 vì sqrt(2) > 1',
    score: 7,
    reasoning: ['Nhận định biểu thức dương là đúng.', 'Chưa giải thích căn bậc hai xác định với mọi số dương.', 'Bài làm ngắn, cần nêu rõ lập luận.'],
    diagnosis: 'Thiếu diễn giải điều kiện và bước so sánh căn thức.',
  },
];

export function AIGradingEngine() {
  const [selectedId, setSelectedId] = useState(submissions[0].id);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [approved, setApproved] = useState<string[]>([]);
  const [imageName, setImageName] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const selected = submissions.find((item) => item.id === selectedId) ?? submissions[0];
  const score = scores[selected.id] ?? selected.score;

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const saveScore = () => {
    setScores((items) => ({ ...items, [selected.id]: score }));
    setApproved((items) => items.includes(selected.id) ? items : [...items, selected.id]);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.8fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <h2 className="font-semibold text-slate-900">Bài nộp</h2>
          <p className="mt-1 text-sm text-slate-500">2 bài đang chờ duyệt</p>
        </div>
        <div className="divide-y divide-slate-100">
          {submissions.map((item) => (
            <button key={item.id} onClick={() => { setSelectedId(item.id); setImageName(''); setImagePreview(null); }} className={`w-full px-4 py-4 text-left hover:bg-slate-50 ${selectedId === item.id ? 'bg-violet-50/70' : ''}`}>
              <p className="font-semibold text-slate-900">{item.student}</p>
              <p className="mt-1 text-sm text-slate-500">{item.className} · Bài đại số</p>
              <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${approved.includes(item.id) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{approved.includes(item.id) ? `Đã duyệt · ${scores[item.id] ?? item.score} điểm` : 'Chờ duyệt'}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <FileImage className="h-4 w-4 text-blue-700" />
            <h2 className="font-semibold text-slate-900">Bài làm</h2>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">Đề bài</p>
          <p className="mt-1 leading-6 text-slate-800">{selected.prompt}</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Bài làm của {selected.student}</p>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-slate-800">{selected.answer}</pre>
          </div>
          {imagePreview && <img src={imagePreview} alt={`Bài viết tay của ${selected.student}`} className="mt-4 max-h-72 w-full rounded-xl border border-slate-200 object-contain" />}
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-violet-400 hover:bg-violet-50/50">
            <Upload className="h-4 w-4" />
            {imageName || 'Tải ảnh bài viết tay'}
            <input type="file" accept="image/*" className="sr-only" onChange={(event) => {
              const file = event.target.files?.[0];
              setImageName(file?.name ?? '');
              setImagePreview(file?.type.startsWith('image/') ? URL.createObjectURL(file) : null);
            }} />
          </label>
        </section>

        <section className="rounded-2xl border border-violet-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-700" />
            <h2 className="font-semibold text-slate-900">Đề xuất chấm</h2>
          </div>
          <div className="mt-4 rounded-xl bg-violet-50 p-4">
            <p className="text-sm text-violet-800">Điểm đề xuất</p>
            <div className="mt-2 flex items-center gap-2">
              <input aria-label="Điểm giáo viên chấm" type="number" min="0" max="10" step="0.5" value={score} onChange={(event) => setScores((items) => ({ ...items, [selected.id]: Number(event.target.value) }))} className="w-24 rounded-lg border border-violet-200 bg-white px-3 py-2 text-2xl font-semibold text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
              <span className="text-sm text-slate-500">/ 10 điểm · có thể sửa</span>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {selected.reasoning.map((step, index) => (
              <div key={step} className="flex gap-3 text-sm leading-5 text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800">{index + 1}</span>{step}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900"><ScanLine className="mr-1.5 inline h-4 w-4" />{selected.diagnosis}</div>
          <button onClick={saveScore} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800">
            <Check className="h-4 w-4" /> {approved.includes(selected.id) ? 'Cập nhật điểm' : 'Duyệt điểm'}
          </button>
        </section>
      </div>
    </div>
  );
}
