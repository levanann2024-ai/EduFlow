import { useMemo, useState } from 'react';
import { BookOpen, FileText, Filter, Plus, Search, Download } from 'lucide-react';
import type { Role } from '@/types';

const documents = [
  { id: 1, title: 'Vật lý 11 - Chương 3.pdf', subject: 'Vật lý', grade: 'Khối 11', size: '4.2 MB', date: '12/09/2024' },
  { id: 2, title: 'Hàm số bậc hai - tài liệu.docx', subject: 'Toán học', grade: 'Khối 10', size: '1.8 MB', date: '10/09/2024' },
  { id: 3, title: 'Vợ chồng A Phủ - đọc hiểu.pdf', subject: 'Ngữ văn', grade: 'Khối 12', size: '2.5 MB', date: '08/09/2024' },
  { id: 4, title: 'Liên kết ion và cộng hóa trị.pdf', subject: 'Hóa học', grade: 'Khối 10', size: '3.1 MB', date: '05/09/2024' },
];

export function Lectures({ role }: { role: Role }) {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('Tất cả môn');
  const [grade, setGrade] = useState('Tất cả khối');

  const filtered = useMemo(() => 
    documents.filter((d) => 
      d.title.toLowerCase().includes(query.toLowerCase()) && 
      (subject === 'Tất cả môn' || d.subject === subject) && 
      (grade === 'Tất cả khối' || d.grade === grade)
    ), 
    [query, subject, grade]
  );

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Thư viện tài liệu</h2>
          </div>
          <button className="btn-primary flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Tải lên
          </button>
        </div>
        
        <div className="p-4 flex flex-wrap gap-2 border-b border-slate-100">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              className="input-field pl-9" 
              placeholder="Tìm tài liệu..." 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
          </div>
          <select className="input-field w-auto" value={subject} onChange={e => setSubject(e.target.value)}>
            <option>Tất cả môn</option>
            <option>Toán học</option>
            <option>Vật lý</option>
            <option>Ngữ văn</option>
            <option>Hóa học</option>
          </select>
          <select className="input-field w-auto" value={grade} onChange={e => setGrade(e.target.value)}>
            <option>Tất cả khối</option>
            <option>Khối 10</option>
            <option>Khối 11</option>
            <option>Khối 12</option>
          </select>
          <button className="btn-outline flex items-center gap-1.5">
            <Filter className="w-4 h-4" /> Lọc
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.map(d => (
            <div key={d.id} className="p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{d.title}</p>
                <p className="text-sm text-slate-500 mt-0.5">{d.subject} - {d.grade} - {d.size} - {d.date}</p>
              </div>
              <button className="btn-ghost p-2 text-slate-600 hover:text-blue-600" aria-label="Tải xuống">
                <Download className="w-4 h-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="p-8 text-center text-slate-500">Không tìm thấy tài liệu</p>
          )}
        </div>
      </section>
    </div>
  );
}