import { useEffect, useState } from 'react';
import { BookOpen, Presentation, Shapes } from 'lucide-react';
import { AIQuizGenerator } from '@/pages/teacher/AIQuizGenerator';
import { LessonPlan } from '@/pages/teacher/LessonPlan';
import { LessonSlides } from '@/pages/teacher/LessonSlides';
import { readQuestionSets, readSavedExams, writeQuestionSets, writeSavedExams, type ExamQuestion } from '@/pages/teacher/assessmentStorage';
import type { QuizQuestion } from '@/types';

type BuilderMode = 'lesson' | 'slides' | 'assessment';
type AssessmentType = 'practice' | 'official';

export function AILessonBuilder({ initialMode = 'lesson' }: { initialMode?: BuilderMode | 'assignment' | 'exam' }) {
  const [mode, setMode] = useState<BuilderMode>(initialMode === 'exam' || initialMode === 'assignment' ? 'assessment' : initialMode);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>(initialMode === 'exam' ? 'official' : 'practice');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(initialMode === 'exam' || initialMode === 'assignment' ? 'assessment' : initialMode);
    if (initialMode === 'exam') setAssessmentType('official');
    if (initialMode === 'assignment') setAssessmentType('practice');
  }, [initialMode]);

  const saveQuestionSet = (generated: { topic: string; subject: string; grade: string; questions: QuizQuestion[] }) => {
    try {
      const next = {
        ...generated,
        id: `bank-${Date.now()}`,
        createdAt: new Date().toLocaleDateString('vi-VN'),
      };
      writeQuestionSets([next, ...readQuestionSets()]);
      setFeedback('Đã lưu bộ câu hỏi vào Ngân hàng câu hỏi.');
      setError('');
    } catch (saveError) {
      console.error('Không thể lưu bộ câu hỏi trên thiết bị.', saveError);
      setError('Không lưu được bộ câu hỏi trên trình duyệt.');
      setFeedback('');
    }
  };

  const saveExam = (generated: {
    topic: string;
    subject: string;
    grade: string;
    questions: QuizQuestion[];
    durationMinutes?: number;
    structureSummary?: string[];
    writtenSection?: string;
  }) => {
    try {
      const next = {
        ...generated,
        id: `exam-${Date.now()}`,
        title: generated.topic,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        durationMinutes: generated.durationMinutes ?? durationMinutes,
        status: 'draft' as const,
        questions: generated.questions.map((question): ExamQuestion => ({
          ...question,
          type: 'multiple-choice',
          correctAnswer: question.options[question.correctIndex] ?? '',
          points: 1,
        })),
        structureSummary: generated.structureSummary,
        writtenSection: generated.writtenSection,
      };
      writeSavedExams([next, ...readSavedExams()]);
      setFeedback('Đã lưu đề kiểm tra vào Đề thi đã lưu.');
      setError('');
    } catch (saveError) {
      console.error('Không thể lưu đề kiểm tra trên thiết bị.', saveError);
      setError('Không lưu được đề kiểm tra trên trình duyệt.');
      setFeedback('');
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label="Công cụ soạn bài">
        {([
          ['lesson', 'Giáo án', BookOpen],
          ['slides', 'Slide', Presentation],
          ['assessment', 'Đề thi & Bài tập', Shapes],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            aria-selected={mode === value}
            onClick={() => { setMode(value); setFeedback(''); setError(''); }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {feedback && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{feedback}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {mode === 'lesson' ? <LessonPlan />
        : mode === 'slides' ? <LessonSlides />
          : (
            <AIQuizGenerator
              examMode={mode === 'assessment' && assessmentType === 'official'}
              assessmentType={assessmentType}
              onAssessmentTypeChange={setAssessmentType}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
              onSaveQuestions={mode === 'assessment' && assessmentType === 'official' ? saveExam : saveQuestionSet}
              saveLabel={mode === 'assessment' && assessmentType === 'official' ? 'Lưu đề kiểm tra' : 'Lưu bài tập'}
            />
          )}
    </section>
  );
}
