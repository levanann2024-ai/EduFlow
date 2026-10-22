import { useState } from 'react';
import { Sparkles, Wand2, RefreshCw, Download, FileText, BookOpen, GraduationCap, Target, Clock, ListChecks, Edit3, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const subjects = ['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tiếng Anh'];
const methods = ['Thuyết trình', 'Thảo luận nhóm', 'Khám phá', 'Dự án', 'Luyện tập'];

interface LessonSection {
  title: string;
  content: string;
}

export function LessonPlan() {
  const [subject, setSubject] = useState('Toán học');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('Khối 10');
  const [duration, setDuration] = useState(45);
  const [method, setMethod] = useState('Thuyết trình');
  const [plan, setPlan] = useState<LessonSection[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setPlan(null);
    setError('');

    try {
      const response = await fetch('/api/ai/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, grade, topic, duration, method }),
      });
      const result: { success: boolean; data?: string; message?: string } = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Không thể tạo giáo án.');
      }

      setPlan(parseLessonPlan(result.data));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới backend AI.');
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = (idx: number) => {
    if (editingSection === idx) {
      setPlan((p) => p ? p.map((s, i) => i === idx ? { ...s, content: editText } : s) : p);
      setEditingSection(null);
    } else {
      setEditingSection(idx);
      setEditText(plan?.[idx].content || '');
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Config */}
        <div className="lg:col-span-1">
          <div className="card p-4 sticky top-4">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Tạo giáo án bằng AI</h3>
                <p className="text-sm text-slate-400">Cấu hình bài giảng</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Môn học
                </label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} className="input-field cursor-pointer">
                  {subjects.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> Khối lớp
                </label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className="input-field cursor-pointer">
                  {['Khối 10','Khối 11','Khối 12'].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-slate-400" /> Chủ đề bài giảng
                </label>
                <textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="VD: Hàm số bậc hai và đồ thị parabol" rows={2} className="input-field resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Thời lượng
                  </label>
                  <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input-field" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-slate-400" /> Phương pháp
                  </label>
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className="input-field cursor-pointer">
                    {methods.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600 disabled:opacity-60"
              >
                {generating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</> : <><Wand2 className="w-3.5 h-3.5" /> Tạo giáo án</>}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          {generating ? (
            <div className="card p-10 flex flex-col items-center justify-center min-h-[400px]">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">AI đang soạn giáo án...</p>
              <p className="text-sm text-slate-400 mt-1">Phân tích chủ đề và tạo nội dung bài giảng</p>
            </div>
          ) : error ? (
            <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
              <FileText className="w-6 h-6 text-rose-500 mb-3" />
              <p className="text-sm font-medium text-rose-600">Không thể tạo giáo án</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md">{error}</p>
            </div>
          ) : plan ? (
            <div className="space-y-3">
              <div className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">Giáo án: {topic}</p>
                  <p className="text-sm text-slate-400">{subject} • {grade} • {duration} phút • {method}</p>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn-outline"><Download className="w-3.5 h-3.5" /> Xuất PDF</button>
                  <button className="btn-primary"><Save className="w-3.5 h-3.5" /> Lưu</button>
                </div>
              </div>

              {plan.map((section, idx) => (
                <div key={idx} className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500">{idx + 1}</span>
                      {section.title}
                    </h4>
                    <button onClick={() => handleEdit(idx)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors">
                      {editingSection === idx ? <Save className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {editingSection === idx ? (
                    <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4} className="input-field resize-none text-sm" />
                  ) : (
                    <div className="pl-7 text-sm text-slate-600 leading-relaxed space-y-2">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                          h1: ({ children }) => <h5 className="font-semibold text-slate-800">{children}</h5>,
                          h2: ({ children }) => <h5 className="font-semibold text-slate-800">{children}</h5>,
                          h3: ({ children }) => <h5 className="font-semibold text-slate-800">{children}</h5>,
                          strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
                        }}
                      >
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
              <div className="w-14 h-14 rounded-md bg-slate-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-800 mt-4">Tạo giáo án bằng AI</h3>
              <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
                Nhập chủ đề và cấu hình ở bảng bên trái. AI sẽ tạo giáo án với mục tiêu, nội dung, hoạt động và đánh giá.
              </p>
              <div className="mt-5 flex flex-wrap gap-1.5 justify-center">
                {['Hàm số bậc hai', 'Định luật Ohm', 'Liên kết ion', 'Vợ chồng A Phủ'].map((t) => (
                  <span key={t} className="badge bg-slate-100 text-slate-500 border border-slate-200">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseLessonPlan(text: string): LessonSection[] {
  const titles = [
    'Mục tiêu học tập',
    'Kiến thức trọng tâm',
    'Nội dung bài giảng',
    'Hoạt động trên lớp',
    'Phương pháp đánh giá',
    'Tài liệu tham khảo',
  ];
  const sections: LessonSection[] = [];
  const titlePattern = titles.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const matcher = new RegExp(`(?:^|\\n)\\s*(?:\\d+[.)]\\s*)?(${titlePattern})\\s*:?\\s*([\\s\\S]*?)(?=\\n\\s*(?:\\d+[.)]\\s*)?(?:${titlePattern})\\s*:?|$)`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(text)) !== null) {
    const content = match[2].trim();
    if (content) sections.push({ title: match[1], content });
  }

  return sections.length > 0 ? sections : [{ title: 'Nội dung giáo án', content: text.trim() }];
}
