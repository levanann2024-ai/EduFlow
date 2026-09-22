import type { ClassRoom, Student, ActivityItem, ScheduleItem, AIGeneration } from './types';

export const mockClasses: ClassRoom[] = [
  { id: 'c1', name: '10A1', subject: 'Toán học', grade: 'Khối 10', studentCount: 38, color: 'blue', progress: 72, schedule: 'T2, T4, T6 (7:30-9:00)', teacher: 'Nguyễn Văn An', nextLesson: 'Hàm số bậc hai', semester: 'Kỳ 1', completedLessons: 18, totalLessons: 25, isHomeroom: true },
  { id: 'c2', name: '11B3', subject: 'Vật lý', grade: 'Khối 11', studentCount: 35, color: 'slate', progress: 58, schedule: 'T3, T5, T7 (9:15-10:45)', teacher: 'Nguyễn Văn An', nextLesson: 'Định luật Ohm', semester: 'Kỳ 1', completedLessons: 14, totalLessons: 24 },
  { id: 'c3', name: '12A2', subject: 'Ngữ văn', grade: 'Khối 12', studentCount: 40, color: 'slate', progress: 85, schedule: 'T2, T3, T5 (13:30-15:00)', teacher: 'Nguyễn Văn An', nextLesson: 'Vợ chồng A Phủ', semester: 'Kỳ 2', completedLessons: 22, totalLessons: 26 },
  { id: 'c5', name: '10B2', subject: 'Hóa học', grade: 'Khối 10', studentCount: 36, color: 'blue', progress: 47, schedule: 'T3, T5 (9:15-10:45)', teacher: 'Nguyễn Văn An', nextLesson: 'Liên kết ion', semester: 'Kỳ 2', completedLessons: 9, totalLessons: 20 },
  { id: 'c6', name: '11A1', subject: 'Sinh học', grade: 'Khối 11', studentCount: 34, color: 'slate', progress: 91, schedule: 'T2, T6 (13:30-15:00)', teacher: 'Nguyễn Văn An', nextLesson: 'ADN và gene', semester: 'Kỳ 2', completedLessons: 20, totalLessons: 22 },
];

export const mockStudents: Student[] = [
  { id: 's1', name: 'Nguyễn Minh Khôi', avatar: 'NM', classId: 'c1', attendance: 98, avgScore: 9.2, status: 'active' },
  { id: 's2', name: 'Trần Hà Linh', avatar: 'TH', classId: 'c1', attendance: 95, avgScore: 8.7, status: 'active' },
  { id: 's3', name: 'Lê Quốc Bảo', avatar: 'LQ', classId: 'c2', attendance: 88, avgScore: 7.5, status: 'active' },
  { id: 's4', name: 'Phạm Thu Trang', avatar: 'PT', classId: 'c2', attendance: 72, avgScore: 6.1, status: 'inactive' },
  { id: 's5', name: 'Vũ Đức Anh', avatar: 'VD', classId: 'c3', attendance: 100, avgScore: 9.5, status: 'active' },
  { id: 's6', name: 'Đặng Khánh Hân', avatar: 'DK', classId: 'c3', attendance: 91, avgScore: 8.3, status: 'active' },
  { id: 's7', name: 'Bùi Tiến Đạt', avatar: 'BT', classId: 'c4', attendance: 85, avgScore: 7.9, status: 'active' },
  { id: 's8', name: 'Hoàng Mai Anh', avatar: 'HM', classId: 'c4', attendance: 68, avgScore: 5.4, status: 'inactive' },
];

export const mockActivities: ActivityItem[] = [
  { id: 'a1', type: 'lesson', title: 'Bài giảng mới được đăng', detail: 'Hàm số bậc hai • Lớp 10A1', time: '10 phút trước' },
  { id: 'a2', type: 'quiz', title: 'Bài kiểm tra đã hoàn thành', detail: 'Kiểm tra 15 phút • Lớp 11B3', time: '35 phút trước' },
  { id: 'a3', type: 'assignment', title: 'Bài tập được nộp', detail: '12 học sinh • Lớp 12A2', time: '1 giờ trước' },
  { id: 'a4', type: 'student', title: 'Học sinh mới tham gia', detail: 'Vũ Đức Anh • Lớp 12A2', time: '2 giờ trước' },
  { id: 'a5', type: 'ai', title: 'AI tạo bộ câu hỏi', detail: '15 câu • Trắc nghiệm Vật lý', time: '5 giờ trước' },
];

export const mockSchedule: ScheduleItem[] = [
  { id: 'sc1', day: 'T2', time: '7:30', className: '10A1', subject: 'Toán học', room: 'P.201' },
  { id: 'sc2', day: 'T2', time: '13:30', className: '12A2', subject: 'Ngữ văn', room: 'P.105' },
  { id: 'sc3', day: 'T3', time: '9:15', className: '11B3', subject: 'Vật lý', room: 'P.302' },
  { id: 'sc4', day: 'T3', time: '13:30', className: '10B2', subject: 'Hóa học', room: 'Lab.1' },
  { id: 'sc5', day: 'T4', time: '7:30', className: '10A1', subject: 'Toán học', room: 'P.201' },
  { id: 'sc7', day: 'T5', time: '9:15', className: '11B3', subject: 'Vật lý', room: 'P.302' },
  { id: 'sc8', day: 'T6', time: '7:30', className: '10A1', subject: 'Toán học', room: 'P.201' },
];

export const mockAIGenerations: AIGeneration[] = [
  { id: 'g1', type: 'quiz', title: 'Bộ câu hỏi trắc nghiệm', detail: '15 câu • Vật lý • Khối 11', time: '5 phút trước', status: 'completed' },
  { id: 'g2', type: 'lesson', title: 'Giáo án bài giảng', detail: 'Hàm số bậc hai • Toán 10', time: '32 phút trước', status: 'completed' },
  { id: 'g3', type: 'summary', title: 'Tóm tắt tài liệu', detail: 'Vật lý 11 - Chương 3.pdf', time: '1 giờ trước', status: 'completed' },
  { id: 'g4', type: 'chat', title: 'Hỏi đáp AI', detail: 'Giải thích định luật Ohm', time: '2 giờ trước', status: 'completed' },
  { id: 'g5', type: 'quiz', title: 'Bộ câu hỏi trắc nghiệm', detail: '10 câu • Ngữ văn • Khối 12', time: 'Hôm qua', status: 'completed' },
  { id: 'g6', type: 'lesson', title: 'Dàn ý bài thuyết trình', detail: 'Liên kết ion • Hóa 10', time: 'Hôm qua', status: 'completed' },
];

export const weeklyProgress = [
  { day: 'T2', lessons: 4, students: 78 },
  { day: 'T3', lessons: 3, students: 65 },
  { day: 'T4', lessons: 5, students: 82 },
  { day: 'T5', lessons: 2, students: 48 },
  { day: 'T6', lessons: 4, students: 70 },
  { day: 'T7', lessons: 1, students: 32 },
];

export const atRiskStudents = [
  { id: 's4', name: 'Phạm Thu Trang', class: '11B3', attendance: 72, avgScore: 6.1, risk: 'high' },
  { id: 's8', name: 'Hoàng Mai Anh', class: '10C1', attendance: 68, avgScore: 5.4, risk: 'high' },
  { id: 's3', name: 'Lê Quốc Bảo', class: '11B3', attendance: 88, avgScore: 7.5, risk: 'medium' },
  { id: 's7', name: 'Bùi Tiến Đạt', class: '10C1', attendance: 85, avgScore: 7.9, risk: 'low' },
];
