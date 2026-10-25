import { useState } from 'react';
import { Check, Eye, Search, Sparkles, X, FileText, CheckCircle2, Clock, Award } from 'lucide-react';

type Submission = { 
  id: number; 
  student: string; 
  className: string; 
  assignment: string; 
  submitted: string; 
  status: 'Chưa chấm' | 'Đã chấm'; 
  score?: number; 
};

const initial: Submission[] = [
  { id: 1, student: 'Nguyễn Minh Khôi', className: '11A1', assignment: 'Bài tập Hàm số bậc hai', submitted: 'Hôm nay, 09:20', status: 'Chưa chấm' }, 
  { id: 2, student: 'Trần Hà Linh', className: '11A1', assignment: 'Bài tập Hàm số bậc hai', submitted: 'Hôm qua, 16:40', status: 'Chưa chấm' }, 
  { id: 3, student: 'Lê Quốc Bảo', className: '11A2', assignment: 'Kiểm tra chương 2', submitted: '12/09/2024', status: 'Đã chấm', score: 8.5 }, 
  { id: 4, student: 'Phạm Thu Trang', className: '11A2', assignment: 'Kiểm tra chương 2', submitted: '12/09/2024', status: 'Đã chấm', score: 7 }
];

export function Grading() {
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Tất cả' | 'Chưa chấm' | 'Đã chấm'>('Tất cả');

  const confirm = () => {
    if (!selected || score === '') return;
    setRows(rows.map(r => r.id === selected.id ? { ...r, status: 'Đã chấm', score: Number(score) } : r));
    setSelected(null);
    setScore('');
    setComment('');
  };

  const suggestComment = () => {
    setComment('Bài làm trình bày rõ ràng, nắm được kiến thức trọng tâm. Em nên bổ sung phần giải thích bước biến đổi để bài làm thuyết phục hơn.');
  };

  // Tính toán số liệu thống kê
  const totalCount = rows.length;
  const ungradedCount = rows.filter(r => r.status === 'Chưa chấm').length;
  const gradedCount = rows.filter(r => r.status === 'Đã chấm').length;
  const averageScore = gradedCount > 0 
    ? (rows.reduce((acc, r) => acc + (r.score ?? 0), 0) / gradedCount).toFixed(1) 
    : '0';

  // Lọc danh sách theo tìm kiếm và trạng thái
  const filteredRows = rows.filter(r => {
    const matchesSearch = r.student.toLowerCase().includes(searchTerm.toLowerCase()) || r.assignment.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterStatus === 'Chưa chấm') return matchesSearch && r.status === 'Chưa chấm';
    if (filterStatus === 'Đã chấm') return matchesSearch && r.status === 'Đã chấm';
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Các thẻ Thống kê tổng quan (Stats Overview) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Tổng bài nộp</p>
            <p className="text-2xl font-semibold text-slate-900 mt-0.5">{totalCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Cần chấm điểm</p>
            <p className="text-2xl font-semibold text-slate-900 mt-0.5">{ungradedCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Đã hoàn thành</p>
            <p className="text-2xl font-semibold text-slate-900 mt-0.5">{gradedCount}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Điểm trung bình</p>
            <p className="text-2xl font-semibold text-slate-900 mt-0.5">{averageScore}</p>
          </div>
        </div>
      </div>

      {/* 2. Khu vực Bảng danh sách kèm Tìm kiếm & Lọc */}
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Tìm học sinh hoặc bài tập..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input-field pl-9 py-1.5 text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg text-xs font-medium">
            {(['Tất cả', 'Chưa chấm', 'Đã chấm'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-md transition-all ${filterStatus === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase font-semibold tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Học sinh</th>
                <th className="px-4 py-3">Lớp</th>
                <th className="px-4 py-3">Bài tập</th>
                <th className="px-4 py-3">Thời gian nộp</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length > 0 ? (
                filteredRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.student}</td>
                    <td className="px-4 py-3 text-slate-600">{r.className}</td>
                    <td className="px-4 py-3 text-slate-600">{r.assignment}</td>
                    <td className="px-4 py-3 text-slate-500">{r.submitted}</td>
                    <td className="px-4 py-3">
                      {r.status === 'Đã chấm' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          Đã chấm - {r.score} điểm
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                          Chưa chấm
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        className="btn-outline inline-flex items-center gap-1.5 text-xs py-1.5 px-3" 
                        onClick={() => { setSelected(r); setScore(r.score?.toString() || ''); }}
                      >
                        <Eye className="w-3.5 h-3.5" /> Chấm bài
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    Không tìm thấy bài nộp phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Modal Chấm bài chi tiết */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-auto p-6 space-y-5 shadow-2xl animate-scaleIn" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selected.assignment}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{selected.student} - Lớp {selected.className} - Nộp lúc: {selected.submitted}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 p-1" onClick={() => setSelected(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <div className="mx-auto mb-3 h-14 w-14 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl border border-slate-100">📄</div>
              <p className="font-medium text-slate-800">Tài liệu bài làm của {selected.student}</p>
              <p className="text-xs text-slate-400 mt-1">Trình xem trước tệp đính kèm bài nộp trực tuyến</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="text-sm font-medium text-slate-700">Điểm số (0 - 10)</label>
                <input 
                  className="input-field mt-1.5 font-semibold text-blue-600" 
                  type="number" 
                  min="0" 
                  max="10" 
                  step="0.5" 
                  value={score} 
                  onChange={e => setScore(e.target.value)} 
                  placeholder="Ví dụ: 8.5"
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-700">Nhận xét của giáo viên</label>
                  <button type="button" onClick={suggestComment} className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Gợi ý từ AI
                  </button>
                </div>
                <textarea 
                  className="input-field mt-1.5 resize-none text-sm" 
                  rows={3}
                  placeholder="Nhập nhận xét chi tiết cho học sinh..." 
                  value={comment} 
                  onChange={e => setComment(e.target.value)} 
                />
              </div>
            </div>

            <div className="pt-2">
              <button className="btn-primary w-full py-2.5 flex items-center justify-center gap-2" onClick={confirm} disabled={score === ''}>
                <Check className="w-4 h-4" /> Xác nhận &amp; gửi kết quả cho học sinh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}