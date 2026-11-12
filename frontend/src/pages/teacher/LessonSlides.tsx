import { useEffect, useState } from 'react';
import pptxgen from 'pptxgenjs';
import { BookOpen, ChevronLeft, ChevronRight, Download, FileText, GraduationCap, LayoutTemplate, Layers, Palette, Target, WandSparkles, X } from 'lucide-react';
import { authenticatedFetch } from '@/auth/authApi';
import { showToast } from '@/components/toast';
import { LessonFormatSelector, type LessonFormat } from '@/pages/teacher/LessonFormatSelector';
import { textbookSeries } from './textbookOptions';
import { getAISubjectExamples } from './aiSubjectExamples';

interface Slide {
  title: string;
  detail: string;
}

export function LessonSlides({
  format,
  onFormatChange,
  assignedSubjects = [],
}: {
  format?: LessonFormat;
  onFormatChange?: (format: LessonFormat) => void;
  assignedSubjects?: string[];
} = {}) {
  const [textbook, setTextbook] = useState('');
  const [subject, setSubject] = useState(assignedSubjects[0] ?? '');
  const [volume, setVolume] = useState('Tập 1');
  const [grade, setGrade] = useState('Khối 10');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [generatedSlides, setGeneratedSlides] = useState<Slide[]>([]);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState('Trực quan');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const subjectExamples = getAISubjectExamples(subject);

  useEffect(() => {
    setSubject((current) => assignedSubjects.includes(current) ? current : assignedSubjects[0] ?? '');
  }, [assignedSubjects]);

  const updateSlide = (index: number, field: keyof Slide, value: string) => {
    setGeneratedSlides((slides) => slides.map((slide, slideIndex) =>
      slideIndex === index ? { ...slide, [field]: value } : slide,
    ));
  };

  const handleGenerate = async () => {
    if (!subject.trim() || !topic.trim() || !textbook.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/ai/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          subject,
          textbook,
          volume,
          grade,
          content: content || 'Tự đề xuất nội dung phù hợp.',
          slideCount,
          style,
        }),
      });
      const result: { success: boolean; data?: Slide[]; message?: string } = await response.json();
      if (!response.ok || !result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || 'Không thể tạo slide.');
      }
      setGeneratedSlides(result.data);
      setPreviewIndex(0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể kết nối tới AI server.');
    } finally {
      setGenerating(false);
    }
  };

  const openPreview = () => {
    if (generatedSlides.length === 0) {
      setError('Hãy tạo cấu trúc slide trước khi trình chiếu.');
      return;
    }
    setPreviewIndex(0);
    setPreviewOpen(true);
  };

  const showPreviousSlide = () => {
    setPreviewIndex((index) => (index - 1 + generatedSlides.length) % generatedSlides.length);
  };

  const showNextSlide = () => {
    setPreviewIndex((index) => (index + 1) % generatedSlides.length);
  };

  const handleExport = async () => {
    if (generatedSlides.length === 0) {
      setExportError('Hãy tạo cấu trúc slide trước khi xuất PowerPoint.');
      return;
    }

    setExporting(true);
    setExportError('');
    try {
      const presentation = new pptxgen();
      presentation.layout = 'LAYOUT_WIDE';
      presentation.author = 'EduFlow';
      presentation.subject = topic;
      presentation.title = topic || 'Bài giảng EduFlow';
      presentation.company = 'EduFlow';

      generatedSlides.forEach((slide, index) => {
        const pptSlide = presentation.addSlide();
        pptSlide.background = { color: 'F8FAFC' };
        pptSlide.addText(`SLIDE ${index + 1}`, {
          x: 0.55, y: 0.35, w: 1.3, h: 0.25,
          fontFace: 'Aptos', fontSize: 10, bold: true, color: '2563EB',
          margin: 0,
        });
        pptSlide.addText(slide.title || 'Slide không có tiêu đề', {
          x: 0.55, y: 0.75, w: 8.3, h: 0.7,
          fontFace: 'Aptos Display', fontSize: 24, bold: true, color: '0F172A',
          breakLine: false, margin: 0.02, fit: 'shrink',
        });
        pptSlide.addShape(presentation.ShapeType.rect, {
          x: 9.05, y: 0.55, w: 3.6, h: 2.05,
          rectRadius: 0.08, fill: { color: 'DBEAFE' },
          line: { color: 'BFDBFE', width: 1 },
        });
        pptSlide.addText('HÌNH MINH HỌA', {
          x: 9.35, y: 1.2, w: 3, h: 0.35,
          fontFace: 'Aptos', fontSize: 11, bold: true, color: '2563EB',
          align: 'center', margin: 0,
        });
        pptSlide.addText(slide.detail || 'Chưa có nội dung', {
          x: 0.7, y: 1.8, w: 7.9, h: 4.7,
          fontFace: 'Aptos', fontSize: 16, color: '334155',
          breakLine: false, margin: 0.08, valign: 'top', fit: 'shrink',
        });
        pptSlide.addText(topic, {
          x: 0.55, y: 7.05, w: 8, h: 0.2,
          fontFace: 'Aptos', fontSize: 9, color: '94A3B8', margin: 0,
        });
      });

      const fileName = `${createFileName(topic)}.pptx`;
      const fileData = await presentation.write({ outputType: 'blob' });
      if (!(fileData instanceof Blob)) {
        throw new Error('Dữ liệu PowerPoint xuất ra không đúng định dạng.');
      }
      const fileUrl = URL.createObjectURL(fileData);
      const downloadLink = document.createElement('a');
      downloadLink.href = fileUrl;
      downloadLink.download = fileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1_000);
      showToast(`Đã tạo ${fileName}. Kiểm tra thư mục Tải xuống nếu trình duyệt không tự mở tệp.`);
    } catch (exportRequestError) {
      setExportError(exportRequestError instanceof Error
        ? `Không thể xuất PowerPoint: ${exportRequestError.message}`
        : 'Không thể xuất PowerPoint do lỗi không xác định.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid xl:grid-cols-[360px_1fr] gap-5 items-start">
        <section className="card p-5">
          {format && onFormatChange && (
            <div className="mb-4">
              <LessonFormatSelector value={format} onChange={onFormatChange} />
            </div>
          )}
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Bộ sách và tập
                </label>
              <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                <input
                  list="lesson-slide-textbook-series"
                  value={textbook}
                  onChange={(event) => setTextbook(event.target.value)}
                  placeholder="Chọn hoặc nhập tên bộ sách"
                  aria-label="Tên bộ sách"
                  className="input-field min-w-0"
                  required
                />
                <datalist id="lesson-slide-textbook-series">
                  {textbookSeries.map((series) => <option key={series} value={series} />)}
                </datalist>
                <select
                  value={volume}
                  onChange={(event) => setVolume(event.target.value)}
                  className="input-field cursor-pointer"
                  aria-label="Tập sách"
                >
                  {['Tập 1', 'Tập 2'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block">
                <span className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Môn học
                </span>
                {assignedSubjects.length > 0 ? (
                  <select value={subject} onChange={(event) => setSubject(event.target.value)} className="input-field mt-1.5">
                    {assignedSubjects.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                ) : (
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Nhập môn học" className="input-field mt-1.5" />
                )}
              </label>
            </div>
            <div>
              <label className="block">
                <span className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> Khối lớp
                </span>
                <select value={grade} onChange={(event) => setGrade(event.target.value)} className="input-field mt-1.5">
                  {['Khối 10', 'Khối 11', 'Khối 12'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-slate-400" /> Chủ đề bài giảng
              </span>
              <input
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={`Ví dụ: ${subjectExamples.topic}`}
                className="input-field mt-1.5"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Nội dung chính / yêu cầu bổ sung
              </span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={5}
                placeholder={subjectExamples.content}
                className="input-field mt-1.5 resize-y"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" /> Số slide
                </span>
                <select value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))} className="input-field mt-1.5"><option value={8}>8 slide</option><option value={12}>12 slide</option><option value={15}>15 slide</option></select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-400" /> Phong cách
                </span>
                <input
                  list="lesson-slide-styles"
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  placeholder="Nhập phong cách mong muốn"
                  className="input-field mt-1.5"
                />
                <datalist id="lesson-slide-styles">
                  {['Trực quan', 'Tối giản', 'Học thuật', 'Kể chuyện', 'Tương tác', 'Nhiều ví dụ'].map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </label>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !subject.trim() || !topic.trim() || !textbook.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600 disabled:opacity-60"
            >
              <WandSparkles className="w-4 h-4" /> {generating ? 'Đang tạo...' : 'Tạo cấu trúc slide'}
            </button>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-blue-600 font-medium">BẢN NHÁP</p>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">{topic || 'Bài giảng mới'}</h2>
              {generatedSlides.length === 0 && (
                <p className="text-sm text-slate-500 mt-1">Chưa có cấu trúc bài giảng</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={openPreview} disabled={generatedSlides.length === 0} className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed">
                <LayoutTemplate className="w-4 h-4" /> Trình chiếu
              </button>
              <button type="button" onClick={() => void handleExport()} disabled={generatedSlides.length === 0 || exporting} className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" /> {exporting ? 'Đang xuất...' : 'Xuất PowerPoint'}
              </button>
            </div>
          </div>
          {exportError && <p role="alert" className="mt-3 text-sm text-rose-700">{exportError}</p>}
          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            {error ? <p className="text-sm text-rose-600">{error}</p> : generatedSlides.map((slide, index) => (
              <div key={`${slide.title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-600">SLIDE {index + 1}</span>
                  <LayoutTemplate className="w-4 h-4 text-slate-300" />
                </div>
                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50/70 h-28 overflow-hidden">
                  <SlideImage title={slide.title} index={index} className="h-full w-full" />
                </div>
                <label className="block mt-4">
                  <span className="sr-only">Tiêu đề slide {index + 1}</span>
                  <textarea
                    value={slide.title}
                    onChange={(event) => updateSlide(index, 'title', event.target.value)}
                    rows={2}
                    className="w-full resize-none bg-transparent font-medium text-slate-800 border border-transparent rounded-md p-1 hover:border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    aria-label={`Tiêu đề slide ${index + 1}`}
                  />
                </label>
                <label className="block mt-2">
                  <span className="sr-only">Nội dung slide {index + 1}</span>
                  <textarea
                    value={slide.detail}
                    onChange={(event) => updateSlide(index, 'detail', event.target.value)}
                    rows={5}
                    className="w-full resize-y bg-transparent text-sm text-slate-500 leading-relaxed border border-transparent rounded-md p-1 hover:border-slate-200 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    aria-label={`Nội dung slide ${index + 1}`}
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>
      {previewOpen && generatedSlides.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 p-4 sm:p-8 flex flex-col items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Trình chiếu slide"
        >
          <button
            onClick={() => setPreviewOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Đóng trình chiếu"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="w-full max-w-6xl aspect-video rounded-xl overflow-hidden bg-white shadow-2xl flex flex-col">
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1.35fr_1fr]">
              <div className="p-6 sm:p-10 lg:p-14 flex flex-col justify-center min-w-0">
                <span className="text-xs sm:text-sm font-semibold tracking-widest text-blue-600">
                  SLIDE {previewIndex + 1} / {generatedSlides.length}
                </span>
                <h2 className="mt-4 text-2xl sm:text-4xl lg:text-5xl font-bold leading-tight text-slate-900 break-words">
                  {generatedSlides[previewIndex].title || 'Slide không có tiêu đề'}
                </h2>
                <div className="mt-5 sm:mt-8 max-h-[42%] overflow-y-auto whitespace-pre-wrap text-sm sm:text-lg lg:text-xl leading-relaxed text-slate-600">
                  {generatedSlides[previewIndex].detail || 'Chưa có nội dung'}
                </div>
                <p className="mt-auto pt-4 text-xs sm:text-sm text-slate-400 truncate">{topic}</p>
              </div>
              <div className="m-5 sm:m-8 rounded-xl bg-blue-100 border border-blue-200 overflow-hidden">
                <SlideImage
                  title={generatedSlides[previewIndex].title}
                  index={previewIndex}
                  className="h-full w-full"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-5 text-white">
            <button
              onClick={showPreviousSlide}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Slide trước"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <span className="min-w-20 text-center text-sm font-medium tabular-nums">
              {previewIndex + 1} / {generatedSlides.length}
            </span>
            <button
              onClick={showNextSlide}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Slide tiếp theo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const slideImages = [
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1484417894907-623942c8ee29?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
];

function getSlideImage(index: number) {
  return slideImages[index % slideImages.length];
}

function SlideImage({
  title,
  index,
  className,
}: {
  title: string;
  index: number;
  className: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = getSlideImage(index);

  return (
    <img
      src={imageFailed ? slideImages[0] : imageUrl}
      alt={`Hình minh họa cho ${title || 'slide bài giảng'}`}
      className={`${className} object-cover`}
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}
function createFileName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized ? `eduflow-${normalized}` : 'eduflow-bai-giang';
}
