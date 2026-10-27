import { useEffect, useState } from 'react';
import { BookOpen, Presentation, Shapes } from 'lucide-react';
import { AIQuizGenerator } from '@/pages/teacher/AIQuizGenerator';
import { LessonPlan } from '@/pages/teacher/LessonPlan';
import { LessonSlides } from '@/pages/teacher/LessonSlides';
import type { LessonFormat } from '@/pages/teacher/LessonFormatSelector';
import { readQuestionSets, readSavedExams, writeQuestionSets, writeSavedExams, type ExamQuestion } from '@/pages/teacher/assessmentStorage';
import type { QuizQuestion } from '@/types';

type BuilderMode = 'lesson' | 'lecture' | 'assessment';
type AssessmentType = 'practice' | 'official';

type InitialBuilderMode = BuilderMode | 'slides' | 'assignment' | 'exam';
type AssignableLessonDraft = { title: string; subject: string; grade: string; content: string };

function getBuilderMode(initialMode: InitialBuilderMode): BuilderMode {
  if (initialMode === 'exam' || initialMode === 'assignment') return 'assessment';
  if (initialMode === 'slides') return 'lecture';
  return initialMode;
}

export function AILessonBuilder({
  initialMode = 'lesson',
  onAssignLesson,
}: {
  initialMode?: InitialBuilderMode;
  onAssignLesson?: (draft: AssignableLessonDraft) => void;
}) {
  const [mode, setMode] = useState<BuilderMode>(() => getBuilderMode(initialMode));
  const [lessonFormat, setLessonFormat] = useState<LessonFormat>(initialMode === 'slides' ? 'slides' : 'text');
  const [assessmentType, setAssessmentType] = useState<AssessmentType>(initialMode === 'exam' ? 'official' : 'practice');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialMode === 'exam') {
      setMode('assessment');
      setAssessmentType('official');
    } else if (initialMode === 'assignment') {
      setMode('assessment');
      setAssessmentType('practice');
    } else if (initialMode === 'slides') {
      setMode('lecture');
      setLessonFormat('slides');
    }
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
    durationMinutes?: number | null;
    structureSummary?: string[];
    writtenSection?: string;
  }) => {
    try {
      const next = {
        ...generated,
        id: `exam-${Date.now()}`,
        title: generated.topic,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        durationMinutes: generated.durationMinutes ?? null,
        status: 'draft' as const,
        questions: generated.questions.map((question): ExamQuestion => ({
          ...question,
          type: question.type ?? 'multiple-choice',
          correctAnswer: question.correctAnswer ?? question.options[question.correctIndex] ?? '',
          correctAnswers: question.correctAnswers,
          points: question.type === 'essay' ? 3 : question.type === 'short-answer' ? 2 : 1,
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
          ['lecture', 'Bài giảng', Presentation],
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
        : mode === 'lecture' ? (
          <>
            <div hidden={lessonFormat !== 'text'}>
              <LessonPlan
                format={lessonFormat}
                onFormatChange={setLessonFormat}
                onAssignToStudents={onAssignLesson}
              />
            </div>
            <div hidden={lessonFormat !== 'slides'}>
              <LessonSlides format={lessonFormat} onFormatChange={setLessonFormat} />
            </div>
          </>
        )
          : (
            <AIQuizGenerator
              examMode={mode === 'assessment' && assessmentType === 'official'}
              assessmentType={assessmentType}
              onAssessmentTypeChange={setAssessmentType}
              onSaveQuestions={mode === 'assessment' && assessmentType === 'official' ? saveExam : saveQuestionSet}
              saveLabel={mode === 'assessment' && assessmentType === 'official' ? 'Lưu đề kiểm tra' : 'Lưu bài tập'}
            />
          )}
    </section>
  );
}
