import { useState } from 'react';
import pptxgen from 'pptxgenjs';
import { ChevronLeft, ChevronRight, Download, LayoutTemplate, Sparkles, WandSparkles, X } from 'lucide-react';

interface Slide {
  title: string;
  detail: string;
}

export function LessonSlides() {
  const [topic, setTopic] = useState('Nhập môn Internet of Things');
  const [content, setContent] = useState('Khái niệm IoT, kiến trúc hệ thống, cảm biến và ví dụ ứng dụng trong trường học.');
  const [generatedSlides, setGeneratedSlides] = useState<Slide[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [style, setStyle] = useState('Trực quan');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const updateSlide = (index: number, field: keyof Slide, value: string) => {
    setGeneratedSlides((slides) => slides.map((slide, slideIndex) =>
      slideIndex === index ? { ...slide, [field]: value } : slide,
    ));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await fetch('/api/ai/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, content, slideCount, style }),
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
      setError('Hãy tạo cấu trúc slide trước khi xuất PowerPoint.');
      return;
    }

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
      pptSlide.addShape(pptxgen.ShapeType.rect, {
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

    await presentation.writeFile({ fileName: `${createFileName(topic)}.pptx` });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid xl:grid-cols-[360px_1fr] gap-5 items-start">
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Tạo slide bằng AI</h2>
              <p className="text-sm text-slate-500">Sinh cấu trúc bài thuyết trình trong vài phút</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Chủ đề bài giảng</span>
              <input value={topic} onChange={(event) => setTopic(event.target.value)} className="input-field mt-1.5" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Nội dung chính</span>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} className="input-field mt-1.5 resize-none" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Số slide</span>
                <select value={slideCount} onChange={(event) => setSlideCount(Number(event.target.value))} className="input-field mt-1.5"><option value={8}>8 slide</option><option value={12}>12 slide</option><option value={15}>15 slide</option></select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-600">Phong cách</span>
                <select value={style} onChange={(event) => setStyle(event.target.value)} className="input-field mt-1.5"><option>Trực quan</option><option>Tối giản</option><option>Học thuật</option></select>
              </label>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
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
              <p className="text-sm text-slate-500 mt-1">{generatedSlides.length > 0 ? content : 'Chưa có cấu trúc slide'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={openPreview} disabled={generatedSlides.length === 0} className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed">
                <LayoutTemplate className="w-4 h-4" /> Trình chiếu
              </button>
              <button onClick={handleExport} disabled={generatedSlides.length === 0} className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed">
                <Download className="w-4 h-4" /> Xuất PowerPoint
              </button>
            </div>
          </div>
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
