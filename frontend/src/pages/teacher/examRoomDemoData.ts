import { mockClasses, mockStudents } from '@/data';
import type { SavedExam } from '@/pages/teacher/assessmentStorage';

export type ExamRoomStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'completed';
export type ExamSessionStatus = 'not-started' | 'in-progress' | 'submitted' | 'disconnected' | 'review';

export interface ExamRoomSettings {
  shuffleQuestions: boolean;
  allowBackNavigation: boolean;
  allowEarlySubmit: boolean;
  requireCamera: boolean;
  requireMicrophone: boolean;
  monitorTabSwitch: boolean;
  monitorConnection: boolean;
  warningThreshold: number;
}

export interface DemoExamSession {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  status: ExamSessionStatus;
  startedAt: string | null;
  submittedAt: string | null;
  remainingMinutes: number | null;
  eventCount: number;
  risk: 'none' | 'low' | 'review';
  events: { id: string; at: string; label: string; kind: 'info' | 'warning' }[];
  score: number | null;
  needsManualGrading: number;
}

export interface ExamRoomRecord {
  id: string;
  code: string;
  title: string;
  instructions: string;
  organizer: string;
  classIds: string[];
  classNames: string[];
  studentCount: number;
  startsAt: string;
  durationMinutes: number;
  status: ExamRoomStatus;
  examId: string;
  examSnapshot: SavedExam;
  settings: ExamRoomSettings;
  sessions: DemoExamSession[];
  createdAt: string;
  isDemo: boolean;
}

export const demoClasses = mockClasses;
export const demoStudents = mockStudents;

export const demoSampleExam: SavedExam = {
  id: 'demo-exam-algebra',
  title: 'Ôn tập hàm số bậc hai',
  topic: 'Hàm số bậc hai',
  subject: 'Toán học',
  grade: 'Khối 10',
  createdAt: 'Dữ liệu minh họa',
  durationMinutes: 45,
  status: 'ready',
  questions: [
    { id: 'demo-q1', type: 'multiple-choice', question: 'Đồ thị hàm số y = x² có trục đối xứng là đường thẳng nào?', options: ['x = 0', 'y = 0', 'x = 1', 'y = 1'], correctIndex: 0, correctAnswer: 'x = 0', explanation: '', difficulty: 'easy', points: 1 },
    { id: 'demo-q2', type: 'multiple-choice', question: 'Hàm số y = x² - 4x + 3 đạt giá trị nhỏ nhất tại x bằng bao nhiêu?', options: ['-2', '2', '3', '4'], correctIndex: 1, correctAnswer: '2', explanation: '', difficulty: 'medium', points: 1 },
    { id: 'demo-q3', type: 'essay', question: 'Nêu các bước xác định tọa độ đỉnh của parabol y = ax² + bx + c.', options: [], correctIndex: 0, correctAnswer: '', explanation: '', difficulty: 'medium', points: 2 },
  ],
};

const defaultSettings: ExamRoomSettings = {
  shuffleQuestions: false,
  allowBackNavigation: true,
  allowEarlySubmit: true,
  requireCamera: false,
  requireMicrophone: false,
  monitorTabSwitch: true,
  monitorConnection: true,
  warningThreshold: 3,
};

const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function makeSampleRoom({
  id,
  code,
  title,
  classId,
  startsInMinutes,
  durationMinutes,
  status,
  sessions = [],
}: {
  id: string;
  code: string;
  title: string;
  classId: string;
  startsInMinutes: number;
  durationMinutes: number;
  status: ExamRoomStatus;
  sessions?: DemoExamSession[];
}): ExamRoomRecord {
  const classRoom = demoClasses.find((item) => item.id === classId) ?? demoClasses[0];
  const starts = new Date(Date.now() + startsInMinutes * 60_000);
  const students = demoStudents.filter((student) => student.classId === classId && student.status === 'active');
  return {
    id,
    code,
    title,
    instructions: 'Đọc kỹ từng câu hỏi. Hãy liên hệ giáo viên nếu gặp sự cố kỹ thuật.',
    organizer: 'Giáo viên (dữ liệu minh họa)',
    classIds: [classId],
    classNames: [classRoom.name],
    studentCount: classRoom.studentCount,
    startsAt: localDateTime(starts),
    durationMinutes,
    status,
    examId: demoSampleExam.id,
    examSnapshot: { ...demoSampleExam, questions: demoSampleExam.questions.map((question) => ({ ...question, options: [...question.options] })) },
    settings: { ...defaultSettings },
    sessions: sessions.length > 0 ? sessions : students.slice(0, 2).map((student) => ({
      id: `${id}-${student.id}`,
      studentId: student.id,
      studentName: student.name,
      className: classRoom.name,
      status: 'not-started',
      startedAt: null,
      submittedAt: null,
      remainingMinutes: null,
      eventCount: 0,
      risk: 'none',
      events: [],
      score: null,
      needsManualGrading: 0,
    })),
    createdAt: new Date().toISOString(),
    isDemo: true,
  };
}

export const demoRoomSeed: ExamRoomRecord[] = [
  makeSampleRoom({
    id: 'demo-room-active',
    code: 'RM10A1',
    title: 'Ôn tập hàm số bậc hai - 10A1',
    classId: 'c1',
    startsInMinutes: -20,
    durationMinutes: 45,
    status: 'open',
    sessions: [
      { id: 'demo-session-1', studentId: 's1', studentName: 'Nguyễn Minh Khôi', className: '10A1', status: 'in-progress', startedAt: new Date(Date.now() - 18 * 60_000).toISOString(), submittedAt: null, remainingMinutes: 27, eventCount: 1, risk: 'none', events: [{ id: 'e1', at: '08:02', label: 'Bắt đầu lượt làm bài', kind: 'info' }], score: null, needsManualGrading: 0 },
      { id: 'demo-session-2', studentId: 's2', studentName: 'Trần Hà Linh', className: '10A1', status: 'review', startedAt: new Date(Date.now() - 22 * 60_000).toISOString(), submittedAt: null, remainingMinutes: 23, eventCount: 2, risk: 'low', events: [{ id: 'e2', at: '08:03', label: 'Bắt đầu lượt làm bài', kind: 'info' }, { id: 'e3', at: '08:11', label: 'Rời màn hình trong thời gian ngắn - cần giáo viên xem xét', kind: 'warning' }], score: null, needsManualGrading: 0 },
      { id: 'demo-session-3', studentId: 'demo-s3', studentName: 'Lê Quốc Bảo', className: '10A1', status: 'submitted', startedAt: new Date(Date.now() - 40 * 60_000).toISOString(), submittedAt: new Date(Date.now() - 4 * 60_000).toISOString(), remainingMinutes: 12, eventCount: 0, risk: 'none', events: [{ id: 'e4', at: '08:01', label: 'Bắt đầu lượt làm bài', kind: 'info' }, { id: 'e5', at: '08:27', label: 'Học sinh chủ động nộp bài', kind: 'info' }], score: 8, needsManualGrading: 1 },
      { id: 'demo-session-4', studentId: 'demo-s4', studentName: 'Phạm Thu Trang', className: '10A1', status: 'disconnected', startedAt: new Date(Date.now() - 14 * 60_000).toISOString(), submittedAt: null, remainingMinutes: 31, eventCount: 1, risk: 'review', events: [{ id: 'e6', at: '08:09', label: 'Mất kết nối - đang chờ cập nhật phiên', kind: 'warning' }], score: null, needsManualGrading: 0 },
    ],
  }),
  makeSampleRoom({
    id: 'demo-room-scheduled',
    code: 'RM11B3',
    title: 'Kiểm tra chương 2 - 11B3',
    classId: 'c2',
    startsInMinutes: 180,
    durationMinutes: 60,
    status: 'scheduled',
  }),
  makeSampleRoom({
    id: 'demo-room-draft',
    code: 'RM12A2',
    title: 'Đề ôn tập cuối chương',
    classId: 'c3',
    startsInMinutes: 1440,
    durationMinutes: 45,
    status: 'completed',
  }),
];

export const examRoomDefaults = defaultSettings;
