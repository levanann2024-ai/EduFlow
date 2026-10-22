import { useState } from 'react';
import { BookOpen, Presentation } from 'lucide-react';
import { LessonPlan } from '@/pages/teacher/LessonPlan';
import { LessonSlides } from '@/pages/teacher/LessonSlides';

export function AILessonBuilder() {
  const [mode, setMode] = useState<'lesson' | 'slides'>('lesson');

  return (
    <section className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          onClick={() => setMode('lesson')}
          aria-pressed={mode === 'lesson'}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'lesson' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
        >
          <BookOpen className="h-4 w-4" /> Giáo án
        </button>
        <button
          onClick={() => setMode('slides')}
          aria-pressed={mode === 'slides'}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'slides' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
        >
          <Presentation className="h-4 w-4" /> Slide
        </button>
      </div>
      {mode === 'lesson' ? <LessonPlan /> : <LessonSlides />}
    </section>
  );
}
