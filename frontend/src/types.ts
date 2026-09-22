export type Role = 'admin' | 'lecturer' | 'student';

export type Page =
  | 'dashboard'
  | 'classes'
  | 'ai-quiz'
  | 'ai-chat'
  | 'lesson-plan'
  | 'lesson-slides'
  | 'analytics'
  | 'lectures'
  | 'assignments'
  | 'grading'
  | 'notifications'
  | 'settings'
  | 'users'
  | 'my-classes'
  | 'my-lessons'
  | 'my-results';

export interface ClassRoom {
  id: string;
  name: string;
  subject: string;
  grade: string;
  studentCount: number;
  color: string;
  progress: number;
  schedule: string;
  teacher: string;
  nextLesson: string;
  semester: 'Kỳ 1' | 'Kỳ 2';
  completedLessons: number;
  totalLessons: number;
  isHomeroom?: boolean;
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  classId: string;
  attendance: number;
  avgScore: number;
  status: 'active' | 'inactive';
}

export interface ActivityItem {
  id: string;
  type: 'lesson' | 'assignment' | 'quiz' | 'student' | 'ai';
  title: string;
  detail: string;
  time: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ScheduleItem {
  id: string;
  day: string;
  time: string;
  className: string;
  subject: string;
  room: string;
}

export interface AIGeneration {
  id: string;
  type: 'quiz' | 'lesson' | 'summary' | 'chat';
  title: string;
  detail: string;
  time: string;
  status: 'completed' | 'processing';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}
