import { useState } from 'react';
import { Sparkles, Wand2, RefreshCw, Download, FileText, BookOpen, GraduationCap, Target, Clock, ListChecks, Edit3, Save, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { authenticatedFetch } from '@/auth/authApi';
import { LessonFormatSelector, type LessonFormat } from '@/pages/teacher/LessonFormatSelector';

const subjects = ['Toán học', 'Vật lý', 'Hóa học', 'Sinh học', 'Ngữ văn', 'Lịch sử', 'Địa lý', 'Tiếng Anh'];
const methods = ['Thuyết trình', 'Thảo luận nhóm', 'Khám phá', 'Dự án', 'Luyện tập'];

interface LessonSection {
  title: string;
  content: string;
}

type LectureOutlineKey = 'flow';

const lectureOutlineFields = [{
  key: 'flow' as const,
  title: 'Nội dung theo trình tự',
  placeholder: 'Ví dụ:\n- Ôn lại đồ thị hàm số bậc nhất\n- Giới thiệu dạng parabol\n- Hướng dẫn cách xác định đỉnh',
}];

export function LessonPlan({
  format,
  onFormatChange,
  onAssignToStudents,
}: {
  format?: LessonFormat;
  onFormatChange?: (format: LessonFormat) => void;
  onAssignToStudents?: (draft: { title: string; subject: string; grade: string; content: string }) => void;
} = {}) {
  const [subject, setSubject] = useState('Toán học');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('Khối 10');
  const [duration, setDuration] = useState(45);
  const [method, setMethod] = useState('Thuyết trình');
  const [lectureOutline, setLectureOutline] = useState<Record<LectureOutlineKey, string>>({
    flow: '',
  });
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
      const requestBody = format
        ? {
          type: 'lesson-material',
          prompt: [
            'Hãy biên soạn một BÀI GIẢNG DẠNG TÀI LIỆU VĂN BẢN CHI TIẾT để học sinh tự đọc và học.',
            'Đây không phải giáo án dành cho giáo viên: không viết mục tiêu sư phạm, kế hoạch hoạt động trên lớp, phương pháp đánh giá hay tài liệu tham khảo.',
            '',
            'Thông tin bài giảng:',
            `- Môn học: ${subject}`,
            `- Khối lớp: ${grade}`,
            `- Chủ đề: ${topic.trim()}`,
            '',
            'Các nội dung cốt lõi giáo viên muốn triển khai theo thứ tự:',
            lectureOutline.flow.trim(),
            '',
            'Yêu cầu trình bày:',
            '1. Phát triển từng ý giáo viên đưa ra thành nội dung kiến thức chính xác, chi tiết vừa đủ, dễ hiểu và phù hợp với học sinh của khối lớp đã chọn.',
            '2. Chia bài thành các phần lớn theo đúng thứ tự trên; viết mỗi tiêu đề phần bằng Markdown heading cấp 2, bắt đầu bằng số La Mã rõ ràng: ## I. ..., ## II. ..., ## III. ... Không gộp hoặc đảo thứ tự các ý.',
            '3. Trong mỗi phần La Mã, chia kiến thức thành các mục nhỏ có tiêu đề Markdown cấp 3 và số thứ tự: ### 1. ..., ### 2. ..., ### 3. ...; giải thích khái niệm, quy tắc, công thức và mối liên hệ giữa các ý.',
            '4. Khi phù hợp với môn học, thêm ví dụ minh họa hoặc bài giải từng bước ngay trong mục liên quan. Dùng ký hiệu và công thức chính xác.',
            '5. Viết trực tiếp cho học sinh như một tài liệu học tập độc lập; không nhắc đến prompt, giáo viên hay quá trình tạo bằng AI.',
            '6. Chỉ trả về nội dung bài giảng, không thêm lời dẫn hoặc kết luận chung ngoài các phần kiến thức.',
          ].join('\n'),
        }
        : { subject, grade, topic, duration, method };
      const response = await authenticatedFetch(format ? '/api/ai' : '/api/ai/lesson-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const result: { success: boolean; data?: string; message?: string } = await response.json();

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || 'Không thể tạo giáo án.');
      }

      setPlan(format
        ? [{ title: 'Nội dung bài giảng', content: result.data }]
        : parseLessonPlan(result.data));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới backend AI.');
    } finally {
      setGenerating(false);
    }
  };

  const assignToStudents = () => {
    if (!format || !onAssignToStudents || !plan) return;
    const content = plan
      .map((section, index) => index === editingSection ? editText : section.content)
      .join('\n\n');
    if (editingSection !== null) {
      setPlan((current) => current?.map((section, index) => (
        index === editingSection ? { ...section, content: editText } : section
      )) ?? null);
      setEditingSection(null);
    }
    onAssignToStudents({ title: topic.trim(), subject, grade, content });
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
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* Config */}
        <div>
          <div className="card p-4 sticky top-4">
            {format && onFormatChange && (
              <div className="mb-4">
                <LessonFormatSelector value={format} onChange={onFormatChange} />
              </div>
            )}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">
                  {format ? 'Tạo nội dung bài giảng bằng AI' : 'Tạo giáo án bằng AI'}
                </h3>
                <p className="text-sm text-slate-400">Cấu hình nội dung</p>
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

              {format ? (
                <div>
                  {lectureOutlineFields.map(({ key, title, placeholder }) => (
                    <label key={key} className="block">
                      <span className="text-sm font-medium text-slate-600">{title}</span>
                      <textarea
                        value={lectureOutline[key]}
                        onChange={(event) => setLectureOutline((current) => ({ ...current, [key]: event.target.value }))}
                        placeholder={placeholder}
                        rows={8}
                        className="input-field mt-1.5 resize-y text-sm"
                      />
                    </label>
                  ))}
                </div>
              ) : (
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
              )}

              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600 disabled:opacity-60"
              >
                {generating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</> : <><Wand2 className="w-3.5 h-3.5" /> {format ? 'Tạo nội dung bài giảng' : 'Tạo giáo án'}</>}
              </button>
            </div>
          </div>
        </div>

        {/* Result */}
        <div className="min-w-0">
          {generating ? (
            <div className="card p-10 flex flex-col items-center justify-center min-h-[400px]">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-600">{format ? 'AI đang soạn bài giảng...' : 'AI đang soạn giáo án...'}</p>
              <p className="text-sm text-slate-400 mt-1">Phân tích chủ đề và tạo nội dung bài giảng</p>
            </div>
          ) : error ? (
            <div className="card p-10 flex flex-col items-center text-center min-h-[400px] justify-center">
              <FileText className="w-6 h-6 text-rose-500 mb-3" />
              <p className="text-sm font-medium text-rose-600">{format ? 'Không thể tạo bài giảng' : 'Không thể tạo giáo án'}</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md">{error}</p>
            </div>
          ) : plan ? (
            <div className="space-y-3">
              <div className="card px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{format ? 'Bài giảng' : 'Giáo án'}: {topic}</p>
                  <p className="text-sm text-slate-400">
                    {format ? `${subject} • ${grade}` : `${subject} • ${grade} • ${duration} phút • ${method}`}
                  </p>
                </div>
                {format && onAssignToStudents ? (
                  <button type="button" onClick={assignToStudents} className="btn-primary shrink-0">
                    <Send className="w-3.5 h-3.5" /> Giao cho học sinh
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button className="btn-outline"><Download className="w-3.5 h-3.5" /> Xuất PDF</button>
                    <button className="btn-primary"><Save className="w-3.5 h-3.5" /> Lưu</button>
                  </div>
                )}
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
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={format ? Math.max(20, Math.min(36, editText.split('\n').length + 4)) : 4}
                      className={`input-field w-full resize-y text-sm ${format ? 'min-h-[480px]' : ''}`}
                    />
                  ) : (
                    <div className={`text-sm text-slate-600 leading-relaxed space-y-2 ${format ? '' : 'pl-7'}`}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                          h1: ({ children }) => <h4 className="text-lg font-bold text-slate-900">{children}</h4>,
                          h2: ({ children }) => <h5 className="text-base font-bold text-slate-900">{children}</h5>,
                          h3: ({ children }) => <h6 className="text-sm font-semibold text-slate-800">{children}</h6>,
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
              <h3 className="text-base font-semibold text-slate-800 mt-4">
                {format ? 'Tạo nội dung bài giảng bằng AI' : 'Tạo giáo án bằng AI'}
              </h3>
              <p className="text-sm text-slate-400 mt-1.5 max-w-sm">
                {format
                  ? 'Nhập chủ đề, sau đó điền ý chính vào từng mục ở bảng bên trái. AI sẽ sắp xếp và phát triển thành nội dung bài giảng.'
                  : 'Nhập chủ đề và cấu hình ở bảng bên trái. AI sẽ tạo giáo án với mục tiêu, nội dung, hoạt động và đánh giá.'}
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
