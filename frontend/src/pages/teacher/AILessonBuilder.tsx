import { useEffect, useState } from 'react';
import { BookOpen, Presentation, Shapes } from 'lucide-react';
import { AIQuizGenerator } from '@/pages/teacher/AIQuizGenerator';
import { LessonPlan } from '@/pages/teacher/LessonPlan';
import { LessonSlides } from '@/pages/teacher/LessonSlides';
import type { LessonFormat } from '@/pages/teacher/LessonFormatSelector';
import { listClasses, listClassSubjects, saveTeacherAssessment } from '@/api/schoolApi';
import type { ExamQuestion } from '@/pages/teacher/assessmentStorage';
import { distributeAssignmentPoints } from '@/pages/student/assignmentQuestions';
import type { QuizQuestion } from '@/types';
import { showToast } from '@/components/toast';

type BuilderMode = 'lesson' | 'lecture' | 'assessment';
type AssessmentType = 'practice' | 'official';

type InitialBuilderMode = BuilderMode | 'slides' | 'assignment' | 'exam';
type AssignableLessonDraft = {
  title: string;
  subject: string;
  grade: string;
  content: string;
  editorDraftId?: string;
};

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
  const [error, setError] = useState('');
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [assignedSubjectsLoading, setAssignedSubjectsLoading] = useState(true);
  const [assignedSubjectsError, setAssignedSubjectsError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(async () => {
        const classrooms = await listClasses();
        const subjectsByClass = await Promise.all(
          classrooms.map((classroom) => listClassSubjects(classroom.id)),
        );
        if (active) {
          setAssignedSubjects([...new Set(subjectsByClass.flat())].sort((first, second) => first.localeCompare(second, 'vi')));
        }
      })
      .catch((loadError: unknown) => {
        console.error('Không thể tải môn học được phân công cho giáo viên.', loadError);
        if (active) {
          setAssignedSubjectsError(loadError instanceof Error ? loadError.message : 'Không thể tải môn học được phân công.');
        }
      })
      .finally(() => {
        if (active) setAssignedSubjectsLoading(false);
      });
    return () => { active = false; };
  }, []);

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

  const saveAssignment = async (generated: {
    topic: string;
    subject: string;
    grade: string;
    questions: QuizQuestion[];
    durationMinutes?: number | null;
    sourceReferences?: { title: string; url: string }[];
  }) => {
    try {
      const questionPoints = distributeAssignmentPoints(generated.questions.length);
      const next = {
        ...generated,
        id: `assignment-${Date.now()}`,
        title: generated.topic,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        durationMinutes: generated.durationMinutes ?? null,
        status: 'draft' as const,
        questions: generated.questions.map((question, index): ExamQuestion => ({
          ...question,
          type: question.type ?? 'multiple-choice',
          correctAnswer: question.correctAnswer ?? question.options[question.correctIndex] ?? '',
          correctAnswers: question.correctAnswers,
          points: questionPoints[index],
        })),
      };
      await saveTeacherAssessment('assignment', next);
      showToast('Đã lưu bài tập vào tab Bài tập đã lưu.');
      setError('');
    } catch (saveError) {
      console.error('Không thể lưu bài tập vào cơ sở dữ liệu.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu bài tập vào cơ sở dữ liệu.');
    }
  };

  const saveExam = async (generated: {
    topic: string;
    subject: string;
    grade: string;
    questions: QuizQuestion[];
    durationMinutes?: number | null;
    structureSummary?: string[];
    sectionPoints?: Record<NonNullable<QuizQuestion['type']>, number>;
    writtenSection?: string;
    sourceReferences?: { title: string; url: string }[];
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
          points: question.points ?? (question.type === 'essay' ? 3 : question.type === 'short-answer' ? 2 : 1),
        })),
        structureSummary: generated.structureSummary,
        sectionPoints: generated.sectionPoints,
        writtenSection: generated.writtenSection,
      };
      await saveTeacherAssessment('exam', next);
      showToast('Đã lưu đề kiểm tra vào Đề thi đã lưu.');
      setError('');
    } catch (saveError) {
      console.error('Không thể lưu đề kiểm tra vào cơ sở dữ liệu.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu đề kiểm tra vào cơ sở dữ liệu.');
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
            onClick={() => { setMode(value); setError(''); }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mode === value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {mode === 'lesson' ? <LessonPlan assignedSubjects={assignedSubjects} />
        : mode === 'lecture' ? (
          <>
            <div hidden={lessonFormat !== 'text'}>
              <LessonPlan
                format={lessonFormat}
                onFormatChange={setLessonFormat}
                onAssignToStudents={onAssignLesson}
                assignedSubjects={assignedSubjects}
              />
            </div>
            <div hidden={lessonFormat !== 'slides'}>
              <LessonSlides
                format={lessonFormat}
                onFormatChange={setLessonFormat}
                assignedSubjects={assignedSubjects}
              />
            </div>
          </>
        )
          : (
            assignedSubjectsLoading ? (
              <p role="status" className="card p-6 text-center text-sm text-slate-600">Đang tải môn học được phân công...</p>
            ) : assignedSubjectsError ? (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{assignedSubjectsError}</p>
            ) : assignedSubjects.length === 0 ? (
              <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Tài khoản giáo viên chưa được phân công môn học trong lớp nào.</p>
            ) : (
              <AIQuizGenerator
                examMode={mode === 'assessment' && assessmentType === 'official'}
                assessmentType={assessmentType}
                assignedSubjects={assignedSubjects}
                onAssessmentTypeChange={setAssessmentType}
                onSaveQuestions={mode === 'assessment' && assessmentType === 'official' ? saveExam : saveAssignment}
                saveLabel={mode === 'assessment' && assessmentType === 'official' ? 'Lưu đề kiểm tra' : 'Lưu bài tập'}
              />
            )
          )}
    </section>
  );
}
